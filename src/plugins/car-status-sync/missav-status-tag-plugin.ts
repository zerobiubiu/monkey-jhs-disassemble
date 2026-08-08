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

import {
    KeyedQueue,
    writeIntent,
    clearIntent,
    readPendingIntents,
    cleanStaleIntents
} from '../../core/sync';

import { BasePlugin } from '../base-plugin';
import {
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    GM_KEY_CAR_STATUS_REVISION,
    LOG_PREFIX_MISSAV,
    MISSAV_DB_META_STORE,
    MISSAV_DB_STORE,
    MISSAV_SYNC_META_KEY,
    type CarStatusDeltaPayload,
    type CarStatusSyncKind,
    type CarStatusPayload
} from './car-status-config';
import { getPayloadRevision, isDeltaPayload, readDeltaJournal, sortDeltaJournal } from './car-status-journal';
import { gunzipFromBase64, validateColumnarSnapshot } from './car-status-columnar';
import {
    openLocalDB,
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
import { normalizeCarNum, renderBadges, isVideoPage } from './missav-renderer';
import { createLogger } from './car-status-logger';

const { info: logInfo, ok: logOk, warn: logWarn, err: logErr } = createLogger(LOG_PREFIX_MISSAV);

export class MissavStatusTagPlugin extends BasePlugin {
    /** 串行消费全量和增量，避免两类 IDB 写入交错（键控串行队列，doc/195）。 */
    private consumeQueue = new KeyedQueue();
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

        // 强制重新同步菜单：清除水位线后重新消费全量 + 增量（恢复手段）
        try {
            GM_registerMenuCommand('🔄 强制重新同步（清除水位线）', () => {
                void (async () => {
                    try {
                        show.ok('正在清除同步水位线...');
                        await clearAppliedRevisionLocal();
                        this.lastAppliedRevision = -1;
                        this.lastAppliedKind = 'delta';
                        show.ok('水位线已清除，开始重新消费...');
                        await this.consumeFull(undefined);
                        await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
                        await this.processAll();
                        show.ok('强制重新同步完成');
                    } catch (err: unknown) {
                        show.error('强制重新同步失败: ' + (err instanceof Error ? err.message : String(err)));
                    }
                })();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 诊断菜单命令：转储跨站同步消费侧状态（doc/191）
        try {
            GM_registerMenuCommand('🔍 诊断：跨站同步消费侧', () => {
                void (async () => {
                    const delta = GM_getValue(GM_KEY_CAR_STATUS_DELTA);
                    const data = GM_getValue(GM_KEY_CAR_STATUS_DATA) as Record<string, unknown> | undefined;
                    const journal: unknown[] = Array.isArray(delta) ? delta : delta ? [delta] : [];
                    let syncMeta: unknown = null;
                    let carCount = -1;
                    let mgt140: unknown = null;
                    try {
                        const db = await openLocalDB();
                        try {
                            syncMeta = await new Promise((resolve) => {
                                const tx = db.transaction(MISSAV_DB_META_STORE, 'readonly');
                                const req = tx.objectStore(MISSAV_DB_META_STORE).get(MISSAV_SYNC_META_KEY);
                                req.onsuccess = () => resolve(req.result ?? null);
                                req.onerror = () => resolve(null);
                            });
                            carCount = await new Promise<number>((resolve) => {
                                const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
                                const req = tx.objectStore(MISSAV_DB_STORE).count();
                                req.onsuccess = () => resolve(req.result);
                                req.onerror = () => resolve(-1);
                            });
                            mgt140 = await new Promise((resolve) => {
                                const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
                                const req = tx.objectStore(MISSAV_DB_STORE).get('MGT-140');
                                req.onsuccess = () => resolve(req.result ?? null);
                                req.onerror = () => resolve(null);
                            });
                        } finally {
                            db.close();
                        }
                    } catch { /* IDB open may fail */ }
                    const info = {
                        site: 'missav',
                        version: GM_info.script.version,
                        gmRevision: GM_getValue(GM_KEY_CAR_STATUS_REVISION, 0),
                        journal: {
                            length: journal.length,
                            lastEntries: journal.slice(-3).map((e: unknown) => {
                                const entry = e as Record<string, unknown>;
                                return {
                                    action: entry?.action,
                                    revision: entry?.revision ?? entry?.ts,
                                    carNums: Array.isArray(entry?.items)
                                        ? (entry.items as Array<Record<string, unknown>>).map((i) => i?.carNum)
                                        : undefined
                                };
                            })
                        },
                        fullSnapshot: data ? {
                            revision: data.revision ?? data.ts,
                            count: data.count,
                            ready: data.ready
                        } : null,
                        idb: { syncMeta, carCount, MGT140: mgt140 },
                        inMemory: {
                            lastAppliedRevision: this.lastAppliedRevision,
                            lastAppliedKind: this.lastAppliedKind
                        }
                    };
                    const text = JSON.stringify(info, null, 2);
                    console.log('[MissAV 诊断-消费侧]', text);
                    try { await navigator.clipboard.writeText(text); } catch { /* clipboard may fail */ }
                    show.ok('诊断信息已输出到控制台并复制到剪贴板');
                })();
            });
        } catch { /* ignore */ }

        // 2) 注册增量变更监听（实时，不锁不冷却）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DELTA,
                (_key: string, _oldValue: unknown, newValue: unknown, remote: boolean) => {
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
                (_key: string, _oldValue: unknown, newValue: unknown, remote: boolean) => {
                    if (remote && newValue) {
                        logInfo('收到 javdb 端全量数据通知');
                        void this.consumeFull(newValue as CarStatusPayload);
                    }
                }
            );
        } catch {
            /* ignore */
        }

        // 4) 先启动渲染（用 IDB 已有数据立即渲染首屏，不阻塞于全量/增量消费）
        this.observeAndProcess();

        // 5) 页面加载时读取当前 GM 存储全量数据初始化
        await this.consumeFull(undefined);
        await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));

        // 5.5) 消费验证：对比 GM 存储最新修订号与 IDB 水位线
        try {
            const gmRevision = GM_getValue(GM_KEY_CAR_STATUS_REVISION, 0) as number;
            if (typeof gmRevision === 'number' && gmRevision > 0 && this.lastAppliedRevision < gmRevision) {
                logWarn('消费验证：IDB 水位线落后于 GM 修订号', `idb=${this.lastAppliedRevision} gm=${gmRevision}，尝试补消费`);
                // 补消费一次 journal（可能是初始化消费时被修订号门控拒绝的条目）
                await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
            }
        } catch {
            /* 验证失败不阻塞启动 */
        }

        // 5.6) 意图日志恢复：处理上次未完成消费的载荷（doc/195）
        const pending = readPendingIntents();
        if (pending.length > 0) {
            logInfo('恢复未完成消费', `${pending.length} 条待处理意图`);
            for (const intent of pending) {
                if (intent.type === 'delta') {
                    const journal = GM_getValue(GM_KEY_CAR_STATUS_DELTA);
                    await this.consumeDeltaJournal(journal);
                }
                // full 类型：consumeFull 已在步骤 4 执行，只需清理过期意图
                clearIntent(intent.revision);
            }
        }
        cleanStaleIntents();
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

        // 兜底：精确选择器均未命中时（missav 改版），用 document.body 全页扫描
        if (!bottomGrid && !sideContainer) {
            logWarn('视频页选择器未命中，回退到全页扫描');
            this.queryAndRender(document.body, carMap.size > 0 ? carMap : null, '视频页-兜底全页');
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

        // 立即尝试一次：DOM 已就绪时零延迟渲染；未就绪由内部 500ms 重试链接管
        tryProcess();

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
    /** 消费增量日志（兼容数组 journal 与单对象载荷），按修订号排序后串行应用。 */
    async consumeDeltaJournal(value: unknown): Promise<void> {
        const journal = sortDeltaJournal(readDeltaJournal(value));
        for (const delta of journal) {
            await this.consumeQueue.enqueue('consume', () => this.applyDelta(delta));
        }
    }

    /** 全量消费入口：串行队列 + 修订号门控 + 条件回滚。 */
    async consumeFull(payload?: CarStatusPayload): Promise<void> {
        return this.consumeQueue.enqueue('consume', () => this.applyFull(payload));
    }

    /** 增量应用：修订号门控 + 条件回滚。 */
    private async applyDelta(delta: CarStatusDeltaPayload): Promise<void> {
        try {
            const revision = getPayloadRevision(delta);
            if (revision < 0 || !isDeltaPayload(delta)) {
                logWarn('忽略无效增量载荷');
                return;
            }
            if (!this.shouldApply(revision, 'delta')) return;
            // 意图日志：记录「已接收但未完成消费」，崩溃后下次加载可恢复（doc/195）
            writeIntent(revision, 'delta');
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
                clearIntent(revision);
                return;
            }
            this.markApplied(revision, 'delta');
            await this.processAll();
            clearIntent(revision);
        } catch (err: unknown) {
            logErr('增量消费失败', err instanceof Error ? err.message : String(err));
        }
    }

    /** 全量应用：严格校验 + 批量对账 + 修订号门控。 */
    private async applyFull(payload?: CarStatusPayload): Promise<void> {
        try {
            // 读取全量快照（双读一致性：防止读取期间 javdb 正在写入导致混合数据，doc/195）
            let data: CarStatusPayload | undefined =
                payload ?? (GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined);
            if (!payload && data) {
                const rev1 = data.revision ?? data.ts;
                await new Promise((resolve) => setTimeout(resolve, 50));
                const data2 = GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined;
                const rev2 = data2 ? (data2.revision ?? data2.ts) : -1;
                if (rev1 !== rev2) {
                    logWarn('全量快照双读不一致', `rev1=${rev1} rev2=${rev2}，使用第二次读取结果`);
                    data = data2;
                }
            }
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
            // 意图日志：记录「已接收但未完成消费」（doc/195）
            writeIntent(revision, 'full');
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
                clearIntent(revision);
                return;
            }
            const { written, deleted } = result.value!;
            logOk('对账本地 IDB', `写入 ${written} 条，删除 ${deleted} 条`);
            this.markApplied(revision, 'full');
            await this.processAll();
            clearIntent(revision);
        } catch (err: unknown) {
            logErr('全量消费失败', err instanceof Error ? err.message : String(err));
        }
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



/**
 * 清除 IDB sync_meta 中的已应用修订号水位线（强制重新同步用）。
 * car-status-db.ts 中 clearAppliedRevision 未导出，此处用已导出的 openLocalDB 本地实现。
 */
async function clearAppliedRevisionLocal(): Promise<void> {
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readwrite');
            tx.objectStore(MISSAV_DB_META_STORE).delete(MISSAV_SYNC_META_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('清理同步修订号失败'));
            tx.onabort = () => reject(tx.error || new Error('清理同步修订号事务中止'));
        });
    } finally {
        db.close();
    }
}
