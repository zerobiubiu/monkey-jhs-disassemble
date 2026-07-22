/**
 * CarListReaderPlugin —— javdb 端车辆状态同步插件。
 *
 * 来源：archetype/jhsCarListReader.user.js（1320 行）。
 * 原架构读取 JAV-JHS IndexedDB 的 car_list，转列存 gzip 后 POST 到后端服务器。
 * 现改为两层同步机制：
 *
 * 1. 增量推送（实时）：storageManager 的写方法（saveCar/removeCar 等）内部
 *    触发 carListChangeCallback，本插件注入回调后立即 GM_setValue 推送单条/
 *    批量变更到 missav 端。载荷几十字节，不压缩，毫秒级到达。
 *
 * 2. 全量同步（兜底）：页面加载时延迟 2s 执行全量同步（读 car_list → 列存
 *    → gzip+base64 → GM_setValue）。保证 missav 端离线后上线的数据一致性。
 *
 * 核心原理：集成后 javdb 和 missav 运行的是同一个 userscript，
 * GM 存储在同一脚本的所有实例间共享，GM_addValueChangeListener
 * 的 remote=true 表示变更来自其他标签页/域名实例。
 */

import { BasePlugin } from '../base-plugin';
import {
    CAR_STATUS_DELTA_COMPACT_THRESHOLD,
    CAR_STATUS_DELTA_MAX_ITEMS,
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    GM_KEY_CAR_STATUS_REVISION,
    LOG_PREFIX_JHS,
    STATUS_LIST,
    type CarStatusDeltaJournal,
    type CarStatusPayload,
    type CarStatusDeltaPayload
} from './car-status-config';
import {
    countColumnar,
    emptyStore,
    gzipToBase64,
    normalizeUrl,
    toColumnar
} from './car-status-columnar';

/** 日志辅助。 */
function logInfo(step: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_JHS} %c${step}`,
        'color:#25b1dc;font-weight:bold;',
        'color:inherit;font-weight:bold;',
        ...args
    );
}
function logOk(step: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_JHS} ✓ %c${step}`,
        'color:#1f7a3d;font-weight:bold;',
        'color:inherit;font-weight:bold;',
        ...args
    );
}
function logWarn(step: string, ...args: any[]): void {
    console.warn(`%c${LOG_PREFIX_JHS} ⚠ ${step}`, 'color:#d7a80c;font-weight:bold;', ...args);
}
function logErr(step: string, ...args: any[]): void {
    console.error(`%c${LOG_PREFIX_JHS} ✗ ${step}`, 'color:#de3333;font-weight:bold;', ...args);
}

/** 全量同步锁，防止并发触发。 */
let isFullSyncing = false;
/** 全量进行中又收到大批变更时，结束后再补发一次最新快照。 */
let fullResyncRequested = false;

/**
 * 当前 javdb 标签页内的单调修订号。
 *
 * 全量同步会在读取快照前取号；若读取/压缩期间发生增量，增量修订号必然更大，
 * missav 端即可拒绝较晚送达的旧快照。跨标签页时仍以同一设备的毫秒时间为主，
 * 同毫秒冲突由消费端的“增量优先”规则兜底。
 */
let lastIssuedRevision = 0;

interface NavigatorWithOptionalLocks {
    locks?: {
        request<T>(
            name: string,
            options: { mode: 'exclusive' },
            callback: () => Promise<T>
        ): Promise<T>;
    };
}

const JAVDB_SYNC_LOCK_NAME = 'jhs-javdb-car-status-publisher';

async function withPublisherLock<T>(task: () => Promise<T>): Promise<T> {
    const browserNavigator =
        typeof navigator === 'undefined'
            ? undefined
            : (navigator as NavigatorWithOptionalLocks);
    if (!browserNavigator?.locks) return task();
    return browserNavigator.locks.request(JAVDB_SYNC_LOCK_NAME, { mode: 'exclusive' }, task);
}

async function nextRevision(): Promise<number> {
    return withPublisherLock(async () => {
        const now = Date.now();
        let persisted = 0;
        try {
            const value = GM_getValue(GM_KEY_CAR_STATUS_REVISION, 0);
            if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                persisted = value;
            }
        } catch {
            // 读取失败时仍用当前标签页的逻辑时钟，后续全量同步会校正状态。
        }
        lastIssuedRevision = Math.max(now, persisted + 1, lastIssuedRevision + 1);
        GM_setValue(GM_KEY_CAR_STATUS_REVISION, lastIssuedRevision);
        return lastIssuedRevision;
    });
}

function payloadRevision(payload: CarStatusDeltaPayload | CarStatusPayload): number {
    const revision = payload.revision ?? payload.ts;
    return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0
        ? revision
        : -1;
}

function isDeltaPayload(value: unknown): value is CarStatusDeltaPayload {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    if (payload.action !== 'upsert' && payload.action !== 'delete') return false;
    if (!Array.isArray(payload.items) || payload.items.length === 0) return false;
    if (typeof payload.ts !== 'number' || !Number.isInteger(payload.ts) || payload.ts < 0) {
        return false;
    }
    if (
        payload.revision !== undefined &&
        (typeof payload.revision !== 'number' ||
            !Number.isInteger(payload.revision) ||
            payload.revision < 0)
    ) {
        return false;
    }
    return payload.items.every((item) => {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
        const record = item as Record<string, unknown>;
        if (typeof record.carNum !== 'string' || record.carNum.trim() === '') return false;
        if (payload.action === 'delete') return true;
        return (
            typeof record.status === 'string' &&
            record.status.trim() !== '' &&
            STATUS_LIST.includes(record.status as (typeof STATUS_LIST)[number]) &&
            typeof record.url_path === 'string' &&
            record.url_path.trim() !== ''
        );
    });
}

function readDeltaJournal(value: unknown): CarStatusDeltaJournal {
    const values: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
    return values.filter(isDeltaPayload);
}

function sortDeltaJournal(journal: CarStatusDeltaJournal): CarStatusDeltaJournal {
    return journal
        .map((payload, index) => ({ payload, index }))
        .sort((left, right) => {
            const revisionDiff = payloadRevision(left.payload) - payloadRevision(right.payload);
            return revisionDiff || left.index - right.index;
        })
        .map(({ payload }) => payload);
}

function countDeltaItems(journal: CarStatusDeltaJournal): number {
    return journal.reduce((total, payload) => total + payload.items.length, 0);
}

/** 日志较长时按番号保留最终操作，避免中间重复更新占用 GM 配额。 */
function compactDeltaJournal(journal: CarStatusDeltaJournal): CarStatusDeltaJournal {
    if (countDeltaItems(journal) <= CAR_STATUS_DELTA_COMPACT_THRESHOLD) return journal;
    const latestByCar = new Map<
        string,
        { payload: CarStatusDeltaPayload; item: CarStatusDeltaPayload['items'][number] }
    >();
    for (const payload of sortDeltaJournal(journal)) {
        for (const item of payload.items) {
            latestByCar.set(item.carNum.trim().toUpperCase(), { payload, item });
        }
    }
    // 仍按原 revision/action 分组，不能把旧状态抬升到最新 revision；否则它可能
    // 在较新的全量快照之后被重新应用。只压掉同番号的中间状态。
    const grouped = new Map<string, CarStatusDeltaPayload>();
    for (const { payload, item } of latestByCar.values()) {
        const key = `${payloadRevision(payload)}:${payload.action}:${payload.ts}`;
        const existing = grouped.get(key);
        if (existing) existing.items.push(item);
        else grouped.set(key, { ...payload, items: [item] });
    }
    return sortDeltaJournal(Array.from(grouped.values()));
}

async function appendDeltaJournal(payload: CarStatusDeltaPayload): Promise<boolean> {
    return withPublisherLock(async () => {
        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        journal.push(payload);
        const compacted = compactDeltaJournal(sortDeltaJournal(journal));
        GM_setValue(
            GM_KEY_CAR_STATUS_DELTA,
            compacted
        );
        // 超过阈值时保留 journal 作为失败兜底，同时要求调用方发布压缩全量；
        // 全量成功后 publishSnapshot 会按 revision 安全裁剪这些旧增量。
        return countDeltaItems(compacted) > CAR_STATUS_DELTA_COMPACT_THRESHOLD;
    });
}

/**
 * 发布全量快照时同时保护 GM 中的“最后快照”指针。
 * 较早开始、较晚压缩完成的旧全量不能覆盖已经发布的新全量。
 */
async function publishSnapshot(payload: CarStatusPayload): Promise<boolean> {
    return withPublisherLock(async () => {
        const current = GM_getValue(GM_KEY_CAR_STATUS_DATA) as
            | CarStatusPayload
            | undefined;
        const currentRevision = current ? payloadRevision(current) : -1;
        if (currentRevision >= payloadRevision(payload)) {
            return false;
        }
        GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);

        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        // 同修订号的增量保留：旧浏览器没有 Web Locks 时可能发生同毫秒冲突，
        // 由 MissAV 端“同 revision 增量优先”规则兜底，不能在发布全量时丢掉。
        const retained = journal.filter((delta) => payloadRevision(delta) >= payloadRevision(payload));
        if (retained.length !== journal.length) {
            GM_setValue(GM_KEY_CAR_STATUS_DELTA, sortDeltaJournal(retained));
        }
        return true;
    });
}

export class CarListReaderPlugin extends BasePlugin {
    getName(): string {
        return 'CarListReaderPlugin';
    }

    async initCss(): Promise<string> {
        return '';
    }

    async handle(): Promise<void> {
        // 跳过 iframe 内的重复触发
        if (window.self !== window.top) return;

        // 注册菜单命令
        try {
            GM_registerMenuCommand('🔁 全量同步车辆状态到 missav', () => {
                this.syncFullCarStatus();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 注入增量回调：storageManager 每次 saveCar/removeCar 等操作后实时触发
        storageManager.setCarListChangeCallback(
            (event: { action: 'upsert' | 'delete'; upserts?: any[]; deletes?: string[] }) => {
                void this.pushDelta(event);
            }
        );

        // 页面加载后延迟 2s 执行全量同步（等 jhs 初始化完成 + storageManager 数据就绪）
        setTimeout(() => this.syncFullCarStatus(), 2000);
    }

    /**
     * 增量推送：将单条/批量变更推送到 GM 存储。
     * 小批次不压缩、不冷却；journal 读改写由 publisher Web Lock 串行化，
     * 超过阈值时压缩或收敛为全量快照。
     * @param event storageManager 的变更事件
     */
    async pushDelta(
        event: { action: 'upsert' | 'delete'; upserts?: any[]; deletes?: string[] }
    ): Promise<void> {
        try {
            if (event.action === 'upsert' && event.upserts) {
                // 将完整 CarRecord 转为 missav 端需要的格式（url 转为 url_path 节省体积）
                const items = event.upserts.map((car) => {
                    const { code } = normalizeUrl(car.url || '');
                    return {
                        carNum: car.carNum,
                        status: car.status,
                        url_path: code
                    };
                });
                if (items.length === 0) return;
                if (items.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                    logWarn(
                        '批量变更超过增量上限，改发压缩全量快照',
                        `${items.length} 条`
                    );
                    await this.syncFullCarStatus();
                    return;
                }
                const revision = await nextRevision();
                const payload: CarStatusDeltaPayload = {
                    action: 'upsert',
                    items,
                    ts: revision,
                    revision
                };
                const needsFullSnapshot = await appendDeltaJournal(payload);
                logInfo('增量推送', `upsert ${items.length} 条`);
                if (needsFullSnapshot) {
                    logInfo('增量日志超过阈值，发布压缩全量快照');
                    await this.syncFullCarStatus();
                }
            } else if (event.action === 'delete' && event.deletes) {
                if (event.deletes.length === 0) return;
                if (event.deletes.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                    logWarn(
                        '批量删除超过增量上限，改发压缩全量快照',
                        `${event.deletes.length} 条`
                    );
                    await this.syncFullCarStatus();
                    return;
                }
                const revision = await nextRevision();
                const payload: CarStatusDeltaPayload = {
                    action: 'delete',
                    items: event.deletes.map((carNum) => ({ carNum })),
                    ts: revision,
                    revision
                };
                const needsFullSnapshot = await appendDeltaJournal(payload);
                logInfo('增量推送', `delete ${event.deletes.length} 条`);
                if (needsFullSnapshot) {
                    logInfo('增量日志超过阈值，发布压缩全量快照');
                    await this.syncFullCarStatus();
                }
            }
        } catch (err: any) {
            logErr('增量推送失败', err.message || String(err));
        }
    }

    /**
     * 全量同步：读 car_list → 转列存 → gzip → 写 GM 存储。
     * 页面加载时执行一次（延迟 2s），或菜单手动触发。
     * 不设冷却期（本地操作无瓶颈），但有 isFullSyncing 锁防并发。
     */
    async syncFullCarStatus(): Promise<boolean> {
        if (isFullSyncing) {
            fullResyncRequested = true;
            logWarn('全量同步任务在进行中，已安排完成后补发最新快照');
            return false;
        }
        isFullSyncing = true;

        try {
            logInfo('全量同步开始');

            // 快照修订号必须在读取 car_list 前生成，不能在压缩完成后才取号。
            const revision = await nextRevision();

            // 1) 读取本地 car_list
            if (typeof storageManager.getCarListSnapshot !== 'function') {
                logErr('无法确认 car_list 是否已初始化，跳过全量快照发布');
                return false;
            }
            const snapshotState = await storageManager.getCarListSnapshot();
            if (!snapshotState.exists) {
                logWarn('本地 car_list 尚未初始化，跳过空快照发布');
                return false;
            }
            const carList = snapshotState.records;
            logInfo('1-读取', `本地 car_list 记录数：${carList.length}`);

            // 2) 转列存格式
            const colRes = toColumnar(carList);
            const count = countColumnar(colRes.byStatus);
            logInfo(
                '2-转列存',
                `列存 ${count} 条 / 丢弃 ${colRes.dropped} / url 异常 ${colRes.malformed}`
            );

            // 丢弃或 URL 异常意味着本次读取不是完整、可验证的权威快照，
            // 不能让 MissAV 按部分数据删除其余记录。
            if (colRes.dropped > 0 || colRes.malformed > 0) {
                logWarn('快照包含无效记录，拒绝发布以保护 MissAV 端数据');
                return false;
            }

            // 3) gzip + base64 压缩
            // 空清单也必须发布明确快照，否则 missav 端永远无法删除旧记录和标签。
            const snapshot = count === 0 ? emptyStore() : colRes.byStatus;
            const base64 = await gzipToBase64(snapshot);
            if (!base64) {
                logErr('gzip 压缩失败（CompressionStream 不可用？非 https 环境？）');
                return false;
            }
            logInfo('3-压缩', `gzip+base64 体积：约 ${(base64.length / 1024).toFixed(1)} KB`);

            // 4) 写入 GM 存储（触发 missav 端 GM_addValueChangeListener）
            const payload: CarStatusPayload = {
                data: base64,
                hwm: new Date(revision).toISOString(),
                count,
                ts: revision,
                revision,
                mode: 'snapshot',
                ready: true
            };
            const published = await publishSnapshot(payload);
            if (!published) {
                logWarn('发现更新的全量快照，放弃发布本次旧快照', `revision=${revision}`);
                return false;
            }

            logOk('4-完成', `已写入 GM 存储，count=${count}，hwm=${payload.hwm}`);
            return true;
        } catch (err: any) {
            logErr('全量同步失败', err.message || String(err), err);
            return false;
        } finally {
            isFullSyncing = false;
            if (fullResyncRequested) {
                fullResyncRequested = false;
                setTimeout(() => void this.syncFullCarStatus(), 0);
            }
        }
    }
}
