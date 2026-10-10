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
    CAR_STATUS_DELTA_MAX_ITEMS,
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    GM_KEY_CAR_STATUS_REVISION,
    LOG_PREFIX_JHS,
    type CarStatusDeltaPayload
} from './car-status-config';
import { allocateRevision, appendDeltaJournal, publishFullSnapshot } from './car-status-publish';
import { normalizeUrl } from './car-status-columnar';
import { createLogger } from './car-status-logger';

const { info: logInfo, ok: logOk, warn: logWarn, err: logErr } = createLogger(LOG_PREFIX_JHS);

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
        // 增量回调必须在所有帧（含 layui 详情页 iframe）注册——
        // 详情页操作（收藏/已看/屏蔽）在 iframe 中触发 saveCar，
        // 若 callback 未注册则增量静默丢失（doc/193 root cause）。
        storageManager.setCarListChangeCallback(
            (event: CarListChangeEvent) => {
                this.pushDelta(event);
            }
        );

        // 菜单命令、全量同步、诊断仅在 top frame 执行（避免 iframe 重复注册）
        if (window.self !== window.top) return;

        // 注册菜单命令
        try {
            GM_registerMenuCommand('🔁 全量同步车辆状态到 missav', () => {
                void this.syncFullCarStatus();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 诊断菜单命令：转储跨站同步发布侧状态（doc/191）
        try {
            GM_registerMenuCommand('🔍 诊断：跨站同步发布侧', () => {
                void (async () => {
                    const delta = GM_getValue(GM_KEY_CAR_STATUS_DELTA);
                    const data = GM_getValue(GM_KEY_CAR_STATUS_DATA) as Record<string, unknown> | undefined;
                    const journal: unknown[] = Array.isArray(delta) ? delta : delta ? [delta] : [];
                    const info = {
                        site: 'javdb',
                        version: GM_info.script.version,
                        gmRevision: GM_getValue(GM_KEY_CAR_STATUS_REVISION, 0),
                        carListRev: GM_getValue(GM_KEY_CAR_LIST_REV, 0),
                        syncedRev: GM_getValue(GM_KEY_SYNCED_REV, -1),
                        journal: {
                            length: journal.length,
                            entries: journal.slice(-5).map((e: unknown) => {
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
                        } : null
                    };
                    const text = JSON.stringify(info, null, 2);
                    console.log('[JHS CarSync 诊断-发布侧]', text);
                    try { await navigator.clipboard.writeText(text); } catch { /* clipboard may fail */ }
                    show.ok('诊断信息已输出到控制台并复制到剪贴板');
                })();
            });
        } catch { /* ignore */ }

        // 版本门控全量同步：仅在数据变更或每日兜底时执行（doc/138）
        const currentRev: number = GM_getValue(GM_KEY_CAR_LIST_REV, 0);
        const syncedRev: number = GM_getValue(GM_KEY_SYNCED_REV, -1);
        const lastSyncTime: number = GM_getValue(GM_KEY_LAST_SYNC_TIME, 0);
        const needsSync =
            currentRev !== syncedRev || Date.now() - lastSyncTime > DAILY_SYNC_INTERVAL;
        if (needsSync) {
            logInfo('全量同步已调度', `rev=${currentRev}, synced=${syncedRev}`);
            setTimeout(() => {
                void this.syncFullCarStatus();
            }, 2000);
        } else {
            logInfo('跳过全量同步', `数据未变更 (rev=${currentRev})，上次同步 ${new Date(lastSyncTime).toLocaleString()}`);
        }
    }

    /** 当前正在进行的增量推送 Promise（含本地写入与后台上传；供 waitForPendingPush 等待）。 */
    private pendingPush: Promise<void> = Promise.resolve();

    /** 当前「本地持久化」阶段的 Promise（journal / GM 写入；毫秒级、不含网络）。 */
    private pendingJournal: Promise<void> = Promise.resolve();

    /**
     * 增量推送入口（fire-and-forget）：把异步推送挂到 pendingPush / pendingJournal 上。
     *
     * **两段拆开**（doc/37）：
     * - `pendingJournal`：本地持久化（journal 追加 + 修订号），关页前只需等这一段；
     * - `pendingPush`：含后续后台上传（同步全量快照 POST），**不阻塞关页** ——
     *   未传完时修订号会大于已同步修订号，下次页面加载（needsSync 门控）会自动续传。
     *
     * @param event storageManager 的变更事件
     */
    pushDelta(event: CarListChangeEvent): void {
        let markDurable!: () => void;
        this.pendingJournal = new Promise<void>((resolve) => {
            markDurable = resolve;
        });
        const durableOnce = (): void => {
            markDurable();
            markDurable = () => {};
        };
        this.pendingPush = this.pushDeltaAsync(event, durableOnce)
            .catch((err: unknown) => {
                logErr('增量推送失败', err instanceof Error ? err.message : String(err));
            })
            // 兜底：无论成功/失败/早返回，本地持久化阶段必定兑现（避免关页 await 挂起）
            .finally(durableOnce);
    }

    /**
     * 等待**本地持久化**完成（journal / GM 写入，毫秒级、不含网络）。
     *
     * 关闭详情页（closePage）前只应等这一段：本地状态已落盘即可安全关页，
     * 后台上传由修订号门控在下次加载续传（见 pushDelta 注释）。
     */
    async waitForPendingJournal(): Promise<void> {
        await this.pendingJournal;
    }

    /** 等待增量推送**全部**完成（含后台上传）—— 仅在确实需要等上传时使用。 */
    async waitForPendingPush(): Promise<void> {
        await this.pendingPush;
    }

    /**
     * 增量推送：单调修订号 + 增量 journal（按 carNum 去重 + 阈值压缩 + 超限收敛为全量快照）。
     * @param event storageManager 的变更事件
     */
    private async pushDeltaAsync(event: CarListChangeEvent, markDurable: () => void): Promise<void> {
        if (event.action === 'upsert' && event.upserts) {
            const items = event.upserts.map((car) => {
                const { code } = normalizeUrl(car.url || '');
                return { carNum: car.carNum, status: car.status, url_path: code };
            });
            if (items.length === 0) return;
            if (items.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                logWarn('批量变更超过增量上限，改发压缩全量快照', `${items.length} 条`);
                // 超限分支无 journal 写入：本地状态已在 car_list 落盘，上传自行后台完成
                markDurable();
                await this.syncFullCarStatus();
                return;
            }
            const revision = await allocateRevision();
            const payload: CarStatusDeltaPayload = { action: 'upsert', items, ts: revision, revision };
            const needsFullSnapshot = await appendDeltaJournal(payload);
            // 本地持久化完成（journal 已写入）—— 后续上传不阻塞关页
            markDurable();
            logInfo('增量推送', `upsert ${items.length} 条`);
            if (needsFullSnapshot) {
                logInfo('增量日志超过阈值，发布压缩全量快照');
                await this.syncFullCarStatus();
            }
        } else if (event.action === 'delete' && event.deletes) {
            if (event.deletes.length === 0) return;
            if (event.deletes.length > CAR_STATUS_DELTA_MAX_ITEMS) {
                logWarn('批量删除超过增量上限，改发压缩全量快照', `${event.deletes.length} 条`);
                markDurable();
                await this.syncFullCarStatus();
                return;
            }
            const revision = await allocateRevision();
            const payload: CarStatusDeltaPayload = {
                action: 'delete',
                items: event.deletes.map((carNum) => ({ carNum })),
                ts: revision,
                revision
            };
            const needsFullSnapshot = await appendDeltaJournal(payload);
            // 本地持久化完成（journal 已写入）—— 后续上传不阻塞关页
            markDurable();
            logInfo('增量推送', `delete ${event.deletes.length} 条`);
            if (needsFullSnapshot) {
                logInfo('增量日志超过阈值，发布压缩全量快照');
                await this.syncFullCarStatus();
            }
        }
        GM_setValue(GM_KEY_CAR_LIST_REV, (GM_getValue(GM_KEY_CAR_LIST_REV, 0) as number) + 1);
    }

/**
     * 全量同步：读 car_list → 列存 → gzip → 修订号保护发布 → 安全裁剪旧增量。
     * 页面加载时执行一次（延迟 2s），或菜单手动触发。
     * isFullSyncing 锁防并发；进行中收到大批变更时结束后补发最新快照。
     *
     * 载荷构造与指针副作用统一在 `car-status-publish.publishFullSnapshot`（doc/47）。
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
            const result = await publishFullSnapshot(() => storageManager.getCarList());
            if (!result.ok) {
                logWarn('全量同步未完成', `原因=${result.reason}`, `revision=${result.revision}`);
                return false;
            }
            logOk('4-完成', `已写入 GM 存储，count=${result.count}，revision=${result.revision}`);
            return true;
        } catch (err: unknown) {
            logErr('全量同步失败', err instanceof Error ? err.message : String(err), err);
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

/* ===========================================================================
 * 跨站车号状态同步 —— javdb 端发布侧：**载荷构造与修订号分配已提取到
 * `car-status-publish.ts`**（doc/47，唯一权威构造点，设置面板手动同步共用）。
 * 本文件只保留调度状态（并发锁 / 补发标记）。
 * ========================================================================= */

/** 全量同步锁，防止并发触发。 */
let isFullSyncing = false;
/** 全量进行中又收到大批变更时，结束后再补发一次最新快照。 */
let fullResyncRequested = false;
