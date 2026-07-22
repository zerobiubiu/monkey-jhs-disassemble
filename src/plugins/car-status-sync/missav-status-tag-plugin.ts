/**
 * MissavStatusTagPlugin —— missav 端状态标签渲染插件。
 *
 * 来源：archetype/missavStatusTag.user.js（895 行）。
 * 原架构从后端服务器增量拉取数据到本地 IndexedDB，在 missav 页面渲染状态标签。
 * 现改为从 GM 存储实时消费数据（两层监听）：
 *
 * 1. 增量监听（实时）：GM_addValueChangeListener('jhs_car_status_delta')
 *    javdb 端每次 saveCar/removeCar 时触发，载荷几十字节不压缩，
 *    missav 端收到后直接 upsert/delete 本地 IndexedDB + 刷新标签，毫秒级。
 *
 * 2. 全量监听（兜底）：GM_addValueChangeListener('jhs_car_status_data')
 *    javdb 端页面加载时触发，载荷 ~600KB gzip+base64，
 *    missav 端收到后解压 + 全量 upsert + 刷新标签。
 *
 * 页面加载时先读 GM 存储中的全量数据初始化本地 IndexedDB，之后增量实时更新。
 */

import { BasePlugin } from '../base-plugin';
import {
    type CarStatusDeltaJournal,
    type CarStatusSyncKind,
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    LOG_PREFIX_MISSAV,
    STATUS_LIST,
    type CarStatusPayload,
    type CarStatusDeltaPayload
} from './car-status-config';
import { gunzipFromBase64, validateColumnarSnapshot } from './car-status-columnar';
import {
    deleteLocalCars,
    queryLocalCars,
    readLocalCarsSelection,
    readLocalCarsSnapshot,
    replaceLocalCars,
    restoreLocalCarsSelection,
    restoreLocalCarsSnapshot,
    upsertLocalCars,
    withSyncRevision
} from './car-status-db';
import { normalizeCarNum, renderBadges, isVideoPage } from './missav-renderer';

/** 日志辅助。 */
function logInfo(msg: string, ...args: any[]): void {
    console.log(`%c${LOG_PREFIX_MISSAV} %c${msg}`, 'color:#25b1dc;font-weight:bold;', '', ...args);
}
function logOk(msg: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_MISSAV} ✓%c ${msg}`,
        'color:#1f7a3d;font-weight:bold;',
        '',
        ...args
    );
}
function logWarn(msg: string, ...args: any[]): void {
    console.warn(
        `%c${LOG_PREFIX_MISSAV} ⚠%c ${msg}`,
        'color:#d7a80c;font-weight:bold;',
        '',
        ...args
    );
}
function logErr(msg: string, ...args: any[]): void {
    console.error(
        `%c${LOG_PREFIX_MISSAV} ✗%c ${msg}`,
        'color:#de3333;font-weight:bold;',
        '',
        ...args
    );
}

/** 兼容旧载荷：新协议使用 revision，旧协议回退到 ts。 */
function getPayloadRevision(payload: { revision?: number; ts: number }): number {
    const revision = payload.revision ?? payload.ts;
    return Number.isInteger(revision) && revision >= 0 ? revision : -1;
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
            const revisionDiff =
                getPayloadRevision(left.payload) - getPayloadRevision(right.payload);
            return revisionDiff || left.index - right.index;
        })
        .map(({ payload }) => payload);
}

export class MissavStatusTagPlugin extends BasePlugin {
    /** 串行消费全量和增量，避免两类 IDB 写入交错。 */
    private consumeQueue: Promise<void> = Promise.resolve();

    /** 当前页面实例已应用的最高修订号。 */
    private lastAppliedRevision = -1;

    private lastAppliedKind: CarStatusSyncKind | null = null;

    getName(): string {
        return 'MissavStatusTagPlugin';
    }

    async initCss(): Promise<string> {
        return '';
    }

    async handle(): Promise<void> {
        logInfo('脚本启动', `页面类型: ${isVideoPage() ? '视频播放页' : '列表页'}`);

        // 1) 注册菜单命令
        try {
            GM_registerMenuCommand('🔄 MissAV 刷新标签', () => {
                this.processAll();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 2) 注册增量变更监听（实时；消费队列与可用时的 Web Lock 负责串行化）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DELTA,
                (_key: string, _oldValue: any, newValue: any, remote: boolean) => {
                    if (remote && newValue) {
                        void this.consumeDeltaJournal(newValue);
                    }
                }
            );
            logOk('已注册增量变更监听');
        } catch {
            logWarn('GM_addValueChangeListener 不可用');
        }

        // 3) 注册全量数据监听（兜底）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DATA,
                (_key: string, _oldValue: any, newValue: any, remote: boolean) => {
                    if (remote && newValue) {
                        logInfo('收到 javdb 端全量数据通知');
                        void this.consumeFull(newValue as CarStatusPayload);
                    }
                }
            );
        } catch {
            /* ignore */
        }

        // 4) 页面加载时读取当前 GM 存储全量数据初始化
        await this.consumeFull(undefined);

        // 全量之后按 revision 补消费 GM 中保留的全部增量日志；兼容旧单对象格式。
        await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));

        // 5) 启动 MutationObserver 监听动态加载的缩略图
        this.observeAndProcess();
    }

    /**
     * 消费增量变更：直接 upsert/delete 本地 IndexedDB + 刷新标签。
     * 小批次不压缩、不冷却；消费队列与可用时的 Web Lock 负责串行化。
     */
    async consumeDelta(delta: CarStatusDeltaPayload): Promise<void> {
        return this.enqueueConsume(() => this.applyDelta(delta));
    }

    /** 消费新数组日志或旧版本单对象，并按修订号排序。 */
    async consumeDeltaJournal(value: unknown): Promise<void> {
        const journal = sortDeltaJournal(readDeltaJournal(value));
        for (const delta of journal) {
            await this.consumeDelta(delta);
        }
    }

    private async applyDelta(delta: CarStatusDeltaPayload): Promise<void> {
        try {
            const revision = getPayloadRevision(delta);
            if (revision < 0 || !isDeltaPayload(delta)) {
                logWarn('忽略无效增量载荷');
                return;
            }
            if (!this.shouldApply(revision, 'delta')) return;

            let rollback: (() => Promise<void>) | undefined;
            const result = await withSyncRevision(
                revision,
                'delta',
                async () => {
                    const affectedCarNums = delta.items.map((item) => item.carNum);
                    const previous = await readLocalCarsSelection(affectedCarNums);
                    rollback = () => restoreLocalCarsSelection(previous);
                    if (delta.action === 'upsert') {
                        const records = delta.items.map((item) => ({
                            carNum: item.carNum.trim(),
                            status: item.status!.trim(),
                            url_path: item.url_path!.trim()
                        }));
                        await upsertLocalCars(records);
                        logInfo('增量更新', `upsert ${records.length} 条`);
                    } else {
                        const carNums = delta.items.map((item) => item.carNum.trim());
                        await deleteLocalCars(carNums);
                        logInfo('增量更新', `delete ${carNums.length} 条`);
                    }
                },
                async () => {
                    if (rollback) await rollback();
                }
            );
            if (!result.applied) {
                this.markApplied(revision, 'delta');
                return;
            }

            this.markApplied(revision, 'delta');
            // 刷新页面标签
            await this.processAll();
        } catch (err: any) {
            logErr('增量消费失败', err.message || String(err));
        }
    }

    /**
     * 消费全量数据：解压 → 全量 upsert → 刷新标签。
     * @param payload 直接传入的载荷；undefined 时从 GM_getValue 读取
     */
    async consumeFull(payload?: CarStatusPayload): Promise<void> {
        return this.enqueueConsume(() => this.applyFull(payload));
    }

    private async applyFull(payload?: CarStatusPayload): Promise<void> {
        try {
            // 读取 GM 存储数据
            const data: CarStatusPayload | undefined =
                payload ?? (GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined);
            if (!data || typeof data !== 'object' || typeof data.data !== 'string' || !data.data) {
                if (payload !== undefined) logWarn('GM 存储中无全量数据');
                return;
            }

            const revision = getPayloadRevision(data);
            if (
                revision < 0 ||
                !Number.isInteger(data.count) ||
                data.count < 0 ||
                (data.mode !== undefined && data.mode !== 'snapshot') ||
                (data.ready === false) ||
                (data.count === 0 && data.ready !== true)
            ) {
                logWarn('拒绝未就绪或格式无效的全量快照');
                return;
            }
            if (!this.shouldApply(revision, 'full')) return;

            logInfo(
                '全量消费开始',
                `count=${data.count} hwm=${data.hwm} revision=${revision}`
            );

            // 1) 解压 base64 + gzip
            const store = await gunzipFromBase64<unknown>(data.data);
            if (!store) {
                logErr('解压失败（DecompressionStream 不可用？数据损坏？）');
                return;
            }

            // 2) 严格校验列存结构，再写入本地 IndexedDB
            const validation = validateColumnarSnapshot(store, data.count);
            if (!validation.ok) {
                logErr('全量快照校验失败，拒绝覆盖本地数据', validation.reason);
                return;
            }

            logInfo('解压完成', `${validation.records.length} 条记录`);
            let rollback: (() => Promise<void>) | undefined;
            const result = await withSyncRevision(
                revision,
                'full',
                async () => {
                    const previous = await readLocalCarsSnapshot();
                    rollback = () => restoreLocalCarsSnapshot(previous);
                    return replaceLocalCars(validation.records, previous);
                },
                async () => {
                    if (rollback) await rollback();
                }
            );
            if (!result.applied) {
                this.markApplied(revision, 'full');
                return;
            }
            const { written, deleted } = result.value!;
            logOk('对账本地 IDB', `写入 ${written} 条，删除 ${deleted} 条`);

            this.markApplied(revision, 'full');

            // 3) 刷新页面标签
            await this.processAll();
        } catch (err: any) {
            logErr('全量消费失败', err.message || String(err));
        }
    }

    /**
     * 将消费任务加入串行队列。前一任务失败也不会阻塞后续同步；具体任务负责记录错误。
     */
    private enqueueConsume(task: () => Promise<void>): Promise<void> {
        const next = this.consumeQueue.then(task, task);
        this.consumeQueue = next.catch((err: unknown) => {
            logErr('同步队列任务失败', err instanceof Error ? err.message : String(err));
        });
        return next;
    }

    /**
     * 拒绝旧修订；同修订号下增量优先于全量，防止慢压缩快照复活已删除记录。
     */
    private shouldApply(revision: number, kind: CarStatusSyncKind): boolean {
        if (revision < this.lastAppliedRevision) {
            logWarn(
                '忽略过期同步载荷',
                `${kind} revision=${revision} < ${this.lastAppliedRevision}`
            );
            return false;
        }
        if (revision === this.lastAppliedRevision && kind === 'full') {
            logWarn(
                '忽略重复或落后的全量快照',
                `revision=${revision}, last=${this.lastAppliedKind || 'none'}`
            );
            return false;
        }
        return true;
    }

    private markApplied(revision: number, kind: CarStatusSyncKind): void {
        this.lastAppliedRevision = Math.max(this.lastAppliedRevision, revision);
        this.lastAppliedKind = kind;
    }

    /**
     * 全量处理：从本地 IndexedDB 查出所有记录，然后渲染所有页面区域。
     * 来源：missavStatusTag.user.js L797-823 processAll。
     */
    async processAll(): Promise<void> {
        try {
            // 收集页面所有番号
            const allCarNums = new Set<string>();
            const allThumbs = document.querySelectorAll<HTMLElement>('.thumbnail.group');
            for (const thumb of allThumbs) {
                const link = thumb.querySelector<HTMLAnchorElement>('a[alt]');
                if (link) {
                    const cn = link.getAttribute('alt');
                    if (cn) {
                        allCarNums.add(normalizeCarNum(cn));
                    }
                }
            }

            const carMap =
                allCarNums.size > 0
                    ? await queryLocalCars(Array.from(allCarNums))
                    : new Map<string, { status: string; url: string }>();

            this.processPage(carMap);
        } catch (err: any) {
            logErr('处理页面失败', err.message || String(err));
        }
    }

    /**
     * 收集页面所有番号，去重后批量查库，再统一渲染。
     * 来源：missavStatusTag.user.js L606-677 processPage/processVideoPage/processListPage。
     */
    processPage(carMap: Map<string, { status: string; url: string }>): void {
        if (isVideoPage()) {
            this.processVideoPage(carMap);
        } else {
            this.processListPage(carMap);
        }
    }

    /**
     * 处理视频播放页：底部推荐网格 + 侧边推荐列表。
     * 来源：missavStatusTag.user.js L618-663 processVideoPage。
     */
    processVideoPage(carMap: Map<string, { status: string; url: string }>): void {
        const bottomGrid = document.querySelector<HTMLElement>(
            'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.relative.overflow-hidden > div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5'
        );
        if (bottomGrid) {
            this.queryAndRender(bottomGrid, carMap, '视频页-底部推荐');
        }

        const sideContainer = document.querySelector<HTMLElement>(
            'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.hidden.lg\\:flex.h-full.ml-6.order-last > div'
        );
        if (sideContainer) {
            this.queryAndRender(sideContainer, carMap, '视频页-侧边推荐');
        }
    }

    /**
     * 处理列表页：视频卡片网格。
     * 来源：missavStatusTag.user.js L669-677 processListPage。
     */
    processListPage(carMap: Map<string, { status: string; url: string }>): void {
        this.queryAndRender(document.body, carMap, '列表页');
    }

    /**
     * 统一的"查询 + 渲染"流程。
     * 来源：missavStatusTag.user.js L688-718 queryAndRender。
     */
    queryAndRender(
        container: HTMLElement | null,
        carMap: Map<string, { status: string; url: string }>,
        label: string
    ): void {
        if (!container) return;

        const { total, matched, added, updated, removed } = renderBadges(container, carMap);
        const cumulativeMatched = container.querySelectorAll('.missav-status-tag').length;
        const totalThumbs = container.querySelectorAll('.thumbnail.group').length;
        logInfo(
            '渲染标签',
            `${label}: ${matched}/${total} 命中，新增 ${added}、更新 ${updated}、删除 ${removed} | 累计 ${cumulativeMatched}/${totalThumbs} 个标签`
        );
    }

    /**
     * 使用 MutationObserver 监听 DOM 变化，在 Alpine.js 渲染完成后自动处理。
     * 来源：missavStatusTag.user.js L727-792 observeAndProcess。
     */
    observeAndProcess(): void {
        let retries = 0;
        const maxRetries = 30;
        const tryProcess = (): void => {
            const thumbItems = document.querySelectorAll('.thumbnail.group');
            if (thumbItems.length > 0) {
                this.processAll();
                return;
            }
            retries++;
            if (retries < maxRetries) {
                setTimeout(tryProcess, 500);
            }
        };

        setTimeout(tryProcess, 1500);

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const observer = new MutationObserver((mutations: MutationRecord[]) => {
            let hasNewThumbnails = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        const el = node as HTMLElement;
                        if (
                            el.matches?.('.thumbnail.group') ||
                            el.querySelector?.('.thumbnail.group')
                        ) {
                            hasNewThumbnails = true;
                            break;
                        }
                    }
                }
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName === 'alt' &&
                    (mutation.target as HTMLElement).matches?.('a[alt]') &&
                    (mutation.target as HTMLElement).closest?.('.thumbnail.group')
                ) {
                    hasNewThumbnails = true;
                }
                if (hasNewThumbnails) break;
            }
            if (hasNewThumbnails) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.processAll(), 300);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['alt']
        });
    }
}
