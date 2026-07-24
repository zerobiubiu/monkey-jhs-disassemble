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
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    LOG_PREFIX_MISSAV,
    STATUS_LIST,
    type CarStatusDeltaJournal,
    type CarStatusPayload,
    type CarStatusDeltaPayload,
    type CarStatusSyncKind,
    type StatusColumn
} from './car-status-config';
import { gunzipFromBase64, columnarToFlat, validateColumnarSnapshot } from './car-status-columnar';
import {
    upsertLocalCars,
    queryLocalCars,
    deleteLocalCars,
    readLocalCarsSelection,
    readLocalCarsSnapshot,
    replaceLocalCars,
    restoreLocalCarsSelection,
    restoreLocalCarsSnapshot,
    withSyncRevision
} from './car-status-db';
import { featureFlags } from '../../core/feature-flags';
import { normalizeCarNum, renderBadges, isVideoPage } from './missav-renderer';
import { createLogger } from './car-status-logger';
import { deltaRoute } from './car-status-delta-route';

const { info: logInfo, ok: logOk, warn: logWarn, err: logErr } = createLogger(LOG_PREFIX_MISSAV);

/** 全量消费锁（增量不锁，因为处理极快）。 */
let isFullConsuming = false;

export class MissavStatusTagPlugin extends BasePlugin {
    /** 串行消费全量和增量，避免两类 IDB 写入交错（跨站同步协议升级，feature flag 门控）。 */
    private consumeQueue: Promise<void> = Promise.resolve();
    /** 当前页面实例已应用的最高修订号（跨站同步协议升级）。 */
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

        // 2) 注册增量变更监听（实时，不锁不冷却）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DELTA,
                (_key: string, _oldValue: unknown, newValue: unknown, remote: boolean) => {
                    if (remote && newValue) {
                        // 按载荷形状路由（doc/189）：数组无条件走 journal 消费器，修复 javdb=ON/
                        // missav=OFF 时数组增量被旧 consumeDelta 静默丢弃；单对象维持本地 flag 门控。
                        if (deltaRoute(newValue, featureFlags.crossSiteSyncProtocol) === 'journal') {
                            void this.consumeDeltaJournal(newValue);
                        } else {
                            this.consumeDelta(newValue as CarStatusDeltaPayload);
                        }
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
                (_key: string, _oldValue: unknown, newValue: unknown, remote: boolean) => {
                    if (remote && newValue) {
                        logInfo('收到 javdb 端全量数据通知');
                        if (featureFlags.crossSiteSyncProtocol) {
                            void this.consumeFullFlagged(newValue as CarStatusPayload);
                        } else {
                            this.consumeFull(newValue as CarStatusPayload);
                        }
                    }
                }
            );
        } catch {
            /* ignore */
        }

        // 4) 页面加载时读取当前 GM 存储全量数据初始化
        if (featureFlags.crossSiteSyncProtocol) {
            // 跨站同步协议升级（feature flag 门控）：flag 开走修订号门控消费，并在初始化后补消费 journal。
            await this.consumeFullFlagged(undefined);
            await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        } else {
            await this.consumeFull(undefined);
            // flag 关兜底（doc/189）：若 javdb=ON 只发了数组增量，此处按形状补消费一次，
            // 否则初始化丢增量（监听器仅在后续变更时触发）。
            const initDelta: unknown = GM_getValue(GM_KEY_CAR_STATUS_DELTA);
            if (deltaRoute(initDelta, false) === 'journal') {
                await this.consumeDeltaJournal(initDelta);
            }
        }

        // 5) 启动 MutationObserver 监听动态加载的缩略图
        this.observeAndProcess();
    }

    /**
     * 消费增量变更：直接 upsert/delete 本地 IndexedDB + 刷新标签。
     * 不压缩（几条记录），不锁（处理极快），不冷却（实时）。
     */
    async consumeDelta(delta: CarStatusDeltaPayload): Promise<void> {
        if (featureFlags.crossSiteSyncProtocol) {
            // 跨站同步协议升级（feature flag 门控）：串行队列 + 修订号门控 + 条件回滚。
            await this.applyDeltaFlagged(delta);
            return;
        }
        try {
            if (delta.action === 'upsert' && delta.items) {
                // 将增量项转为 upsertLocalCars 需要的格式
                const records = delta.items.map((item) => ({
                    carNum: item.carNum,
                    status: item.status || '',
                    url_path: item.url_path || ''
                }));
                await upsertLocalCars(records);
                logInfo('增量更新', `upsert ${records.length} 条`);
            } else if (delta.action === 'delete' && delta.items) {
                const carNums = delta.items.map((item) => item.carNum);
                await deleteLocalCars(carNums);
                logInfo('增量更新', `delete ${carNums.length} 条`);
            }
            // 刷新页面标签
            await this.processAll();
        } catch (err: unknown) {
            logErr('增量消费失败', err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * 消费全量数据：解压 → 全量 upsert → 刷新标签。
     * @param payload 直接传入的载荷；undefined 时从 GM_getValue 读取
     */
    async consumeFull(payload?: CarStatusPayload): Promise<void> {
        if (featureFlags.crossSiteSyncProtocol) {
            await this.consumeFullFlagged(payload);
            return;
        }
        if (isFullConsuming) {
            logWarn('全量消费任务在进行中');
            return;
        }
        isFullConsuming = true;

        try {
            // 读取 GM 存储数据
            const data: CarStatusPayload | undefined =
                payload ?? (GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined);
            if (!data || !data.data) {
                if (payload !== undefined) logWarn('GM 存储中无全量数据');
                return;
            }

            logInfo('全量消费开始', `count=${data.count} hwm=${data.hwm}`);

            // 1) 解压 base64 + gzip
            const store = await gunzipFromBase64<Record<string, StatusColumn>>(data.data);
            if (!store) {
                logErr('解压失败（DecompressionStream 不可用？数据损坏？）');
                return;
            }

            // 2) 转行式 → 写入本地 IndexedDB
            const records = columnarToFlat(store);
            if (records.length === 0) {
                logWarn('解压后无有效记录');
                return;
            }

            logInfo('解压完成', `${records.length} 条记录`);
            const written = await upsertLocalCars(records);
            logOk('写入本地 IDB', `${written} 条`);

            // 3) 刷新页面标签
            await this.processAll();
        } catch (err: unknown) {
            logErr('全量消费失败', err instanceof Error ? err.message : String(err));
        } finally {
            isFullConsuming = false;
        }
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

            if (allCarNums.size === 0) return;

            const carMap = await queryLocalCars(Array.from(allCarNums));
            if (carMap.size === 0) return;

            this.processPage(carMap);
        } catch (err: unknown) {
            logErr('处理页面失败', err instanceof Error ? err.message : String(err));
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
            this.queryAndRender(bottomGrid, carMap.size > 0 ? carMap : null, '视频页-底部推荐');
        }

        const sideContainer = document.querySelector<HTMLElement>(
            'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.hidden.lg\\:flex.h-full.ml-6.order-last > div'
        );
        if (sideContainer) {
            this.queryAndRender(sideContainer, carMap.size > 0 ? carMap : null, '视频页-侧边推荐');
        }
    }

    /**
     * 处理列表页：视频卡片网格。
     * 来源：missavStatusTag.user.js L669-677 processListPage。
     */
    processListPage(carMap: Map<string, { status: string; url: string }>): void {
        this.queryAndRender(document.body, carMap.size > 0 ? carMap : null, '列表页');
    }

    /**
     * 统一的"查询 + 渲染"流程。
     * 来源：missavStatusTag.user.js L688-718 queryAndRender。
     */
    async queryAndRender(
        container: HTMLElement | null,
        existingMap: Map<string, { status: string; url: string }> | null,
        label: string
    ): Promise<void> {
        if (!container) return;

        let map = existingMap;
        if (!map || map.size === 0) {
            const carNums = new Set<string>();
            const thumbs = container.querySelectorAll<HTMLElement>('.thumbnail.group');
            for (const thumb of thumbs) {
                const link = thumb.querySelector<HTMLAnchorElement>('a[alt]');
                if (link) {
                    const cn = link.getAttribute('alt');
                    if (cn) carNums.add(normalizeCarNum(cn));
                }
            }
            if (carNums.size === 0) return;
            map = await queryLocalCars(Array.from(carNums));
        }

        if (!map || map.size === 0) return;

        const { total, matched } = renderBadges(container, map);
        const cumulativeMatched = container.querySelectorAll('.missav-status-tag').length;
        const totalThumbs = container.querySelectorAll('.thumbnail.group').length;
        logInfo(
            '渲染标签',
            `${label}: +${total} 新增, +${matched} 命中 | 累计 ${cumulativeMatched}/${totalThumbs} 个标签`
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
    /** 消费新数组日志或旧版本单对象，并按修订号排序（跨站同步协议升级，feature flag 门控）。 */
    async consumeDeltaJournal(value: unknown): Promise<void> {
        const journal = sortDeltaJournal(readDeltaJournal(value));
        for (const delta of journal) {
            await this.enqueueConsume(() => this.applyDeltaFlagged(delta));
        }
    }

    /** 协议升级版全量消费入口（featureFlags.crossSiteSyncProtocol 门控，默认关）。 */
    async consumeFullFlagged(payload?: CarStatusPayload): Promise<void> {
        return this.enqueueConsume(() => this.applyFullFlagged(payload));
    }

    /** 协议升级版增量应用：修订号门控 + 条件回滚（feature flag 门控）。 */
    private async applyDeltaFlagged(delta: CarStatusDeltaPayload): Promise<void> {
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
                            status: (item.status || '').trim(),
                            url_path: (item.url_path || '').trim()
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
            await this.processAll();
        } catch (err: unknown) {
            logErr('增量消费失败', err instanceof Error ? err.message : String(err));
        }
    }

    /** 协议升级版全量应用：严格校验 + 批量对账 + 修订号门控（feature flag 门控）。 */
    private async applyFullFlagged(payload?: CarStatusPayload): Promise<void> {
        try {
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
                data.ready === false ||
                (data.count === 0 && data.ready !== true)
            ) {
                logWarn('拒绝未就绪或格式无效的全量快照');
                return;
            }
            if (!this.shouldApply(revision, 'full')) return;
            logInfo('全量消费开始', `count=${data.count} hwm=${data.hwm} revision=${revision}`);
            const store = await gunzipFromBase64<unknown>(data.data);
            if (!store) {
                logErr('解压失败（DecompressionStream 不可用？数据损坏？）');
                return;
            }
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
            await this.processAll();
        } catch (err: unknown) {
            logErr('全量消费失败', err instanceof Error ? err.message : String(err));
        }
    }

    /** 将消费任务加入串行队列；前一任务失败也不阻塞后续同步（跨站同步协议升级）。 */
    private enqueueConsume(task: () => Promise<void>): Promise<void> {
        const next = this.consumeQueue.then(task, task);
        this.consumeQueue = next.catch((err: unknown) => {
            logErr('同步队列任务失败', err instanceof Error ? err.message : String(err));
        });
        return next;
    }

    /** 拒绝旧修订；同修订号下增量优先于全量，防止慢压缩快照复活已删除记录（协议升级）。 */
    private shouldApply(revision: number, kind: CarStatusSyncKind): boolean {
        if (revision < this.lastAppliedRevision) {
            logWarn('忽略过期同步载荷', `${kind} revision=${revision} < ${this.lastAppliedRevision}`);
            return false;
        }
        if (revision === this.lastAppliedRevision && kind === 'full') {
            logWarn('忽略重复或落后的全量快照', `revision=${revision}, last=${this.lastAppliedKind || 'none'}`);
            return false;
        }
        return true;
    }

    private markApplied(revision: number, kind: CarStatusSyncKind): void {
        this.lastAppliedRevision = Math.max(this.lastAppliedRevision, revision);
        this.lastAppliedKind = kind;
    }

}

/* ===========================================================================
 * 跨站车号状态同步协议升级 —— missav 端消费侧辅助（featureFlags.crossSiteSyncProtocol 门控，默认关）。
 * 载荷修订号解析 + 增量 journal 读取/排序/校验，均为新增模块级函数，仅 flag 开启时被调用。
 * ========================================================================= */

/** 兼容旧载荷：新协议使用 revision，旧协议回退到 ts（协议升级）。 */
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
            const revisionDiff = getPayloadRevision(left.payload) - getPayloadRevision(right.payload);
            return revisionDiff || left.index - right.index;
        })
        .map(({ payload }) => payload);
}
