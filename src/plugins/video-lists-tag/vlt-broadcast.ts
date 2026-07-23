/**
 * 三重广播总线 —— GM_setValue / localStorage / CustomEvent 三通道广播。
 *
 * 提取自 vlt-sync.tsx：
 * - broadcastWantWatchedSync：「想看/观看」状态变更广播
 * - broadcastSyncComplete：清单 checkbox 同步完成广播
 * - broadcastListMgmt：清单管理（删除/改名）广播
 */

/** 日志前缀。 */
const LOG_PREFIX = '[JavDB]';

/** 同步事件广播键。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

/** 「想看/观看」状态变更广播键（与 DetailPageButtonPlugin.broadcastWantWatchedSync 一致）。 */
const WANT_WATCHED_SYNC_KEY = 'jdb:want-watched-sync';

/** 清单管理广播键（独立通道，不与 jdb:last-sync 混用）。 */
const LIST_MGMT_KEY = 'jdb:list-mgmt';

/**
 * 广播「想看/观看」状态变更，与 DetailPageButtonPlugin.broadcastWantWatchedSync 等价。
 *
 * 三重通道：GM_setValue（跨标签页）/ localStorage（跨脚本同源）/ CustomEvent（同页面即时）。
 * 接收方为 DetailPageButtonPlugin.setupWantWatchedSyncListener，会：
 *   1. 详情页：showStatus 刷新菜单按钮文案（屏蔽/收藏/已观看）
 *   2. 列表页：refreshItemStatusTag 刷新匹配卡片 status-tag
 *
 * 自动收藏必须广播，才能让其他标签页/列表页/当前详情页同步刷新状态，
 * 与手动点击收藏（onWantAdded/quickConvertToFav）效果一致。
 *
 * @param carNum 番号
 * @param status 状态动作（FAVORITE_ACTION 等）
 * @param op 操作类型（'add' / 'remove'）
 */
export function broadcastWantWatchedSync(carNum: string, status: string, op: 'add' | 'remove'): void {
    try {
        const payload = { carNum, status, op, time: Date.now() };
        const json = JSON.stringify(payload);
        // 1) GM 原生通道（跨标签页）
        try {
            GM_setValue(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 2) localStorage（跨脚本同源）
        try {
            localStorage.setItem(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 3) CustomEvent（同页面即时，DetailPageButtonPlugin.setupWantWatchedSyncListener 接收）
        try {
            document.dispatchEvent(new CustomEvent(WANT_WATCHED_SYNC_KEY, { detail: payload }));
        } catch {}
    } catch (err: unknown) {
        clog.error(`${LOG_PREFIX} 自动收藏广播失败`, err);
    }
}

/**
 * 广播清单 checkbox 同步完成事件（三重机制确保跨脚本/跨标签页联动）。
 *
 * @param designation 番号
 * @param action 操作（'add' / 'remove'）
 * @param association 关联结果（SyncResult.association）
 */
export function broadcastSyncComplete(designation: string, action: string, association: string): void {
    const syncPayload = {
        designation,
        action,
        association,
        time: Date.now()
    };
    const payloadStr = JSON.stringify(syncPayload);

    // 1) 同脚本跨标签页（GM 原生通道）
    try {
        GM_setValue(LAST_SYNC_KEY, payloadStr);
    } catch (error) {
        console.warn(`${LOG_PREFIX} GM 同步广播失败`, error);
    }

    // 2) 跨脚本跨标签页（localStorage 触发 storage 事件）
    try {
        localStorage.setItem(LAST_SYNC_KEY, payloadStr);
    } catch (error) {
        console.warn(`${LOG_PREFIX} localStorage 同步广播失败`, error);
    }

    // 3) 跨脚本同页面（CustomEvent 即时）
    try {
        document.dispatchEvent(new CustomEvent('jdb:sync-complete', { detail: syncPayload }));
    } catch (error) {
        console.warn(`${LOG_PREFIX} 页面同步广播失败`, error);
    }
}

/**
 * 三重广播清单管理事件（删除/改名），独立通道 jdb:list-mgmt。
 * 接收方：详情页 setupListMgmtBroadcastListener（移除/更新 checkbox）+
 * 列表页 setupListMgmtBroadcastListener（refreshAllTags）。
 *
 * @param type 'delete' | 'rename'
 * @param listId 清单 ID
 * @param extra 额外字段（rename 时带 newName）
 */
export function broadcastListMgmt(
    type: 'delete' | 'rename',
    listId: string,
    extra?: { newName?: string }
): void {
    const payload = { type, listId, newName: extra?.newName, time: Date.now() };
    const json = JSON.stringify(payload);
    try {
        GM_setValue(LIST_MGMT_KEY, json);
    } catch {}
    try {
        localStorage.setItem(LIST_MGMT_KEY, json);
    } catch {}
    try {
        document.dispatchEvent(new CustomEvent(LIST_MGMT_KEY, { detail: payload }));
    } catch {}
}
