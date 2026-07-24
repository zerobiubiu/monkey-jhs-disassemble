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
import type { CarListChangeEvent } from '../../core/storage-manager';
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
import { toColumnar, gzipToBase64, countColumnar, normalizeUrl } from './car-status-columnar';
import { featureFlags } from '../../core/feature-flags';
import { createLogger } from './car-status-logger';

const { info: logInfo, ok: logOk, warn: logWarn, err: logErr } = createLogger(LOG_PREFIX_JHS);

/** 全量同步锁，防止并发触发。 */
let isFullSyncing = false;

/** car_list 变更代号（每次增量推送时递增）。 */
const GM_KEY_CAR_LIST_REV = 'jhs_car_list_rev';
/** 上次全量同步时的变更代号。 */
const GM_KEY_SYNCED_REV = 'jhs_car_status_synced_rev';
/** 上次全量同步时间戳。 */
const GM_KEY_LAST_SYNC_TIME = 'jhs_car_status_last_sync';
/** 每日兜底同步间隔（24 小时）。 */
const DAILY_SYNC_INTERVAL = 24 * 60 * 60 * 1000;

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
                if (featureFlags.crossSiteSyncProtocol) {
                    // 跨站同步协议升级（feature flag 门控）：手动全量同步也走修订号保护发布，与 handle()/pushDelta/consume* 一致，避免 flag-ON 下旧全量覆盖新快照/毒化修订号序。
                    void this.syncFullCarStatusFlagged();
                } else {
                    this.syncFullCarStatus();
                }
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 注入增量回调：storageManager 每次 saveCar/removeCar 等操作后实时触发
        storageManager.setCarListChangeCallback(
            (event: CarListChangeEvent) => {
                this.pushDelta(event);
            }
        );

        // 版本门控全量同步：仅在数据变更或每日兜底时执行（doc/138）
        const currentRev: number = GM_getValue(GM_KEY_CAR_LIST_REV, 0);
        const syncedRev: number = GM_getValue(GM_KEY_SYNCED_REV, -1);
        const lastSyncTime: number = GM_getValue(GM_KEY_LAST_SYNC_TIME, 0);
        const needsSync =
            currentRev !== syncedRev || Date.now() - lastSyncTime > DAILY_SYNC_INTERVAL;
        if (needsSync) {
            logInfo('全量同步已调度', `rev=${currentRev}, synced=${syncedRev}`);
            if (featureFlags.crossSiteSyncProtocol) {
                // 跨站同步协议升级（feature flag 门控）：flag 开走修订号保护的全量发布，
                // 避免并发标签页旧全量覆盖新快照并裁剪增量日志；与 pushDelta/consume* 门控模式一致。
                setTimeout(() => {
                    void this.syncFullCarStatusFlagged();
                }, 2000);
            } else {
                setTimeout(() => this.syncFullCarStatus(), 2000);
            }
        } else {
            logInfo('跳过全量同步', `数据未变更 (rev=${currentRev})，上次同步 ${new Date(lastSyncTime).toLocaleString()}`);
        }
    }

    /**
     * 增量推送：将单条/批量变更推送到 GM 存储。
     * 不压缩（几条记录几十字节），不锁（处理极快），不冷却（实时）。
     * @param event storageManager 的变更事件
     */
    pushDelta(event: CarListChangeEvent): void {
        if (featureFlags.crossSiteSyncProtocol) {
            // 跨站同步协议升级（feature flag 门控）：走 journal 增量路径，原同步推送逻辑保持不变。
            void this.pushDeltaFlagged(event);
            return;
        }
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
                const payload: CarStatusDeltaPayload = {
                    action: 'upsert',
                    items,
                    ts: Date.now()
                };
                GM_setValue(GM_KEY_CAR_STATUS_DELTA, payload);
                logInfo('增量推送', `upsert ${items.length} 条`);
            } else if (event.action === 'delete' && event.deletes) {
                const payload: CarStatusDeltaPayload = {
                    action: 'delete',
                    items: event.deletes.map((carNum) => ({ carNum })),
                    ts: Date.now()
                };
                GM_setValue(GM_KEY_CAR_STATUS_DELTA, payload);
                logInfo('增量推送', `delete ${event.deletes.length} 条`);
            }
            // 递增变更代号（供下次页面加载判断是否需要全量同步）
            GM_setValue(GM_KEY_CAR_LIST_REV, (GM_getValue(GM_KEY_CAR_LIST_REV, 0) as number) + 1);
        } catch (err: unknown) {
            logErr('增量推送失败', err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * 全量同步：读 car_list → 转列存 → gzip → 写 GM 存储。
     * 页面加载时执行一次（延迟 2s），或菜单手动触发。
     * 不设冷却期（本地操作无瓶颈），但有 isFullSyncing 锁防并发。
     */
    async syncFullCarStatus(): Promise<void> {
        if (isFullSyncing) {
            logWarn('全量同步任务在进行中，跳过');
            return;
        }
        isFullSyncing = true;

        try {
            logInfo('全量同步开始');

            // 1) 读取本地 car_list
            const carList = await storageManager.getCarList();
            logInfo('1-读取', `本地 car_list 记录数：${carList.length}`);

            if (carList.length === 0) {
                logWarn('car_list 为空，跳过同步（jhs 可能尚未写入数据）');
                return;
            }

            // 2) 转列存格式
            const colRes = toColumnar(carList);
            const count = countColumnar(colRes.byStatus);
            logInfo(
                '2-转列存',
                `列存 ${count} 条 / 丢弃 ${colRes.dropped} / url 异常 ${colRes.malformed}`
            );

            if (count === 0) {
                logWarn('列存后无有效记录，跳过');
                return;
            }

            // 3) gzip + base64 压缩
            const base64 = await gzipToBase64(colRes.byStatus);
            if (!base64) {
                logErr('gzip 压缩失败（CompressionStream 不可用？非 https 环境？）');
                return;
            }
            logInfo('3-压缩', `gzip+base64 体积：约 ${(base64.length / 1024).toFixed(1)} KB`);

            // 4) 写入 GM 存储（触发 missav 端 GM_addValueChangeListener）
            const payload: CarStatusPayload = {
                data: base64,
                hwm: new Date().toISOString(),
                count,
                ts: Date.now()
            };
            GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);

            logOk('4-完成', `已写入 GM 存储，count=${count}，hwm=${payload.hwm}`);
            // 记录同步完成时的代号和时间（供下次页面加载跳过无变更同步）
            GM_setValue(GM_KEY_SYNCED_REV, GM_getValue(GM_KEY_CAR_LIST_REV, 0));
            GM_setValue(GM_KEY_LAST_SYNC_TIME, Date.now());
        } catch (err: unknown) {
            logErr('全量同步失败', err instanceof Error ? err.message : String(err), err);
        } finally {
            isFullSyncing = false;
        }
    }

    /**
     * 协议升级版增量推送（featureFlags.crossSiteSyncProtocol 门控，默认关）。
     * 单调修订号 + 增量 journal（按 carNum 去重 + 阈值压缩 + 超限收敛为全量快照）。
     */
    async pushDeltaFlagged(event: CarListChangeEvent): Promise<void> {
        try {
            if (event.action === 'upsert' && event.upserts) {
                const items = event.upserts.map((car) => {
                    const { code } = normalizeUrl(car.url || '');
                    return { carNum: car.carNum, status: car.status, url_path: code };
                });
                if (items.length === 0) return;
                if (items.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                    logWarn('批量变更超过增量上限，改发压缩全量快照', `${items.length} 条`);
                    await this.syncFullCarStatusFlagged();
                    return;
                }
                const revision = await nextRevision();
                const payload: CarStatusDeltaPayload = { action: 'upsert', items, ts: revision, revision };
                const needsFullSnapshot = await appendDeltaJournal(payload);
                logInfo('增量推送', `upsert ${items.length} 条`);
                if (needsFullSnapshot) {
                    logInfo('增量日志超过阈值，发布压缩全量快照');
                    await this.syncFullCarStatusFlagged();
                }
            } else if (event.action === 'delete' && event.deletes) {
                if (event.deletes.length === 0) return;
                if (event.deletes.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                    logWarn('批量删除超过增量上限，改发压缩全量快照', `${event.deletes.length} 条`);
                    await this.syncFullCarStatusFlagged();
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
                    await this.syncFullCarStatusFlagged();
                }
            }
            GM_setValue(GM_KEY_CAR_LIST_REV, (GM_getValue(GM_KEY_CAR_LIST_REV, 0) as number) + 1);
        } catch (err: unknown) {
            logErr('增量推送失败', err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * 协议升级版全量同步（featureFlags.crossSiteSyncProtocol 门控，默认关）。
     * 读取 car_list 前取修订号；发布时按修订号保护「最后快照」指针，并安全裁剪旧增量。
     */
    async syncFullCarStatusFlagged(): Promise<boolean> {
        if (isFullSyncingFlagged) {
            fullResyncRequested = true;
            logWarn('全量同步任务在进行中，已安排完成后补发最新快照');
            return false;
        }
        isFullSyncingFlagged = true;
        try {
            logInfo('全量同步开始');
            const revision = await nextRevision();
            const carList = await storageManager.getCarList();
            logInfo('1-读取', `本地 car_list 记录数：${carList.length}`);
            if (carList.length === 0) {
                logWarn('car_list 为空，跳过同步（jhs 可能尚未写入数据）');
                return false;
            }
            const colRes = toColumnar(carList);
            const count = countColumnar(colRes.byStatus);
            logInfo('2-转列存', `列存 ${count} 条 / 丢弃 ${colRes.dropped} / url 异常 ${colRes.malformed}`);
            if (count === 0) {
                logWarn('列存后无有效记录，跳过');
                return false;
            }
            const base64 = await gzipToBase64(colRes.byStatus);
            if (!base64) {
                logErr('gzip 压缩失败（CompressionStream 不可用？非 https 环境？）');
                return false;
            }
            logInfo('3-压缩', `gzip+base64 体积：约 ${(base64.length / 1024).toFixed(1)} KB`);
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
            GM_setValue(GM_KEY_SYNCED_REV, GM_getValue(GM_KEY_CAR_LIST_REV, 0));
            GM_setValue(GM_KEY_LAST_SYNC_TIME, Date.now());
            return true;
        } catch (err: unknown) {
            logErr('全量同步失败', err instanceof Error ? err.message : String(err), err);
            return false;
        } finally {
            isFullSyncingFlagged = false;
            if (fullResyncRequested) {
                fullResyncRequested = false;
                setTimeout(() => void this.syncFullCarStatusFlagged(), 0);
            }
        }
    }
}

/* ===========================================================================
 * 跨站车号状态同步协议升级 —— javdb 端发布侧（featureFlags.crossSiteSyncProtocol 门控，默认关）。
 * 单调修订号分配 + 增量 journal 读改写（Web Lock 串行化、按番号去重压缩、超限收敛全量）
 * + 全量快照指针保护。全部为新增模块级函数，仅在 flag 开启时被上方方法调用。
 * ========================================================================= */

/** 协议升级版全量同步锁（与原 isFullSyncing 独立，避免互相干扰）。 */
let isFullSyncingFlagged = false;
/** 全量进行中又收到大批变更时，结束后再补发一次最新快照。 */
let fullResyncRequested = false;
/** 当前 javdb 标签页内的单调修订号逻辑时钟。 */
let lastIssuedRevision = 0;

interface NavigatorWithOptionalLocks {
    locks?: {
        request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
    };
}

const JAVDB_SYNC_LOCK_NAME = 'jhs-javdb-car-status-publisher';

/** 在支持 Web Locks 的浏览器中把 javdb 发布侧读改写串行化（协议升级）。 */
async function withPublisherLock<T>(task: () => Promise<T>): Promise<T> {
    const browserNavigator =
        typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithOptionalLocks);
    if (!browserNavigator?.locks) return task();
    return browserNavigator.locks.request(JAVDB_SYNC_LOCK_NAME, { mode: 'exclusive' }, task);
}

/** 分配下一个单调修订号（跨标签页以 GM 持久值 + 本地逻辑时钟取大，协议升级）。 */
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
            /* 读取失败时仍用当前标签页的逻辑时钟，后续全量同步会校正状态。 */
        }
        lastIssuedRevision = Math.max(now, persisted + 1, lastIssuedRevision + 1);
        GM_setValue(GM_KEY_CAR_STATUS_REVISION, lastIssuedRevision);
        return lastIssuedRevision;
    });
}

/** 兼容旧载荷：新协议使用 revision，旧协议回退到 ts（协议升级）。 */
function payloadRevision(payload: CarStatusDeltaPayload | CarStatusPayload): number {
    const revision = payload.revision ?? payload.ts;
    return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 ? revision : -1;
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
        (typeof payload.revision !== 'number' || !Number.isInteger(payload.revision) || payload.revision < 0)
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

/** 读取 GM 中的增量日志，兼容新数组与旧单对象形态（协议升级）。 */
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

/** 日志较长时按番号保留最终操作，避免中间重复更新占用 GM 配额（协议升级）。 */
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
    const grouped = new Map<string, CarStatusDeltaPayload>();
    for (const { payload, item } of latestByCar.values()) {
        const key = `${payloadRevision(payload)}:${payload.action}:${payload.ts}`;
        const existing = grouped.get(key);
        if (existing) existing.items.push(item);
        else grouped.set(key, { ...payload, items: [item] });
    }
    return sortDeltaJournal(Array.from(grouped.values()));
}

/** 追加一条增量到 journal；超过压缩阈值时返回 true 提示调用方发布全量（协议升级）。 */
async function appendDeltaJournal(payload: CarStatusDeltaPayload): Promise<boolean> {
    return withPublisherLock(async () => {
        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        journal.push(payload);
        const compacted = compactDeltaJournal(sortDeltaJournal(journal));
        GM_setValue(GM_KEY_CAR_STATUS_DELTA, compacted);
        return countDeltaItems(compacted) > CAR_STATUS_DELTA_COMPACT_THRESHOLD;
    });
}

/**
 * 发布全量快照并保护 GM 中的「最后快照」指针（协议升级）。
 * 较早开始、较晚压缩完成的旧全量不能覆盖已发布的新全量；同修订号增量保留由消费端兜底。
 */
async function publishSnapshot(payload: CarStatusPayload): Promise<boolean> {
    return withPublisherLock(async () => {
        const current = GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined;
        const currentRevision = current ? payloadRevision(current) : -1;
        if (currentRevision >= payloadRevision(payload)) {
            return false;
        }
        GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);
        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        const retained = journal.filter((delta) => payloadRevision(delta) >= payloadRevision(payload));
        if (retained.length !== journal.length) {
            GM_setValue(GM_KEY_CAR_STATUS_DELTA, sortDeltaJournal(retained));
        }
        return true;
    });
}
