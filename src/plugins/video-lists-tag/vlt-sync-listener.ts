/**
 * 跨标签页同步监听模块 —— 三重监听机制接收清单同步事件并触发精准刷新。
 *
 * 提取自 vlt-tags.ts：
 * - setupAutoRefreshListener：设置三重监听（CustomEvent / storage / GM_addValueChangeListener）
 * - handleSyncNotify：处理同步通知（过滤 + 防抖 + 回调）
 */
import type { VltTags } from './vlt-tags';

/** GM 存储键 + localStorage 键：最后一次同步事件 payload。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

/** 跨标签页同步事件 payload 结构。 */
export interface SyncPayload {
    designation?: string;
    association?: string;
    action?: string;
    time?: number;
}

/** 服务器返回的「未变更」类 association —— 标签不会变化，跳过刷新。 */
const NO_CHANGE_ASSOCS: Record<string, true> = { existed: true, limit_exceeded: true, unchanged: true };

/** 防抖间隔（毫秒），500ms 内不重复刷新。 */
const SYNC_DEBOUNCE_MS = 500;

/**
 * 处理同步通知，通过过滤后回调 onSync（对应原 handleSyncNotify 闭包）。
 *
 * 过滤条件：
 * - autoRefreshEnabled 关闭 → 跳过
 * - payload 无 designation → 跳过
 * - association 为 existed/limit_exceeded/unchanged → 标签不变，跳过
 * - 距上次刷新 < 500ms → 防抖跳过
 *
 * @param plugin VltTags 实例
 * @param payload 同步事件 payload
 * @param onSync 通过过滤后的回调
 * @param state 可变状态（lastRefreshTime 防抖时间戳）
 */
export function handleSyncNotify(
    plugin: VltTags,
    payload: SyncPayload | null,
    onSync: (payload: SyncPayload) => void,
    state: { lastRefreshTime: number }
): void {
    if (!plugin.autoRefreshEnabled) {
        console.log('[视频清单标签] 收到同步事件但自动刷新已关闭，跳过');
        return;
    }
    if (!payload || !payload.designation) {
        console.warn('[视频清单标签] 收到同步事件但无 designation:', payload);
        return;
    }
    if (NO_CHANGE_ASSOCS[payload.association ?? '']) {
        console.log(`[视频清单标签] association=${payload.association} 不影响标签，跳过`);
        return;
    }

    const now = Date.now();
    if (now - state.lastRefreshTime < SYNC_DEBOUNCE_MS) {
        console.log(
            `[视频清单标签] 距上次刷新 ${now - state.lastRefreshTime}ms < ${SYNC_DEBOUNCE_MS}ms，防抖跳过`
        );
        return;
    }
    state.lastRefreshTime = now;

    console.log('[视频清单标签] 收到同步事件 → 精准刷新', payload);
    onSync(payload);
}

/**
 * 设置跨脚本跨标签页联动监听（对应原 L1189-1282）。
 *
 * 三重监听机制（与 listsOptionSync 的三重广播对应）：
 * 1. CustomEvent 'jdb:sync-complete' —— 跨脚本同页面（即时）
 * 2. window 'storage' 事件 —— 跨脚本跨标签页（localStorage）
 * 3. GM_addValueChangeListener —— 同脚本跨标签页（GM 原生通道，兜底）
 *
 * 收到同步事件后，handleSyncNotify 做过滤，全部通过后调用 onSync(payload)，
 * 由调用方决定如何刷新（通常传入 `(payload) => this.refreshDesignation(payload.designation)`）。
 *
 * @param plugin VltTags 实例
 * @param onSync 同步事件回调（payload 包含 designation/action/association/time）
 */
export function setupAutoRefreshListener(
    plugin: VltTags,
    onSync: (payload: SyncPayload) => void
): void {
    const state = { lastRefreshTime: 0 };

    // 1) 跨脚本同页面（CustomEvent）
    document.addEventListener('jdb:sync-complete', (e: Event) => {
        console.log('[视频清单标签] [CustomEvent] 收到 jdb:sync-complete');
        handleSyncNotify(plugin, (e as CustomEvent).detail, onSync, state);
    });

    // 2) 跨脚本跨标签页（localStorage storage 事件，只在其他标签页触发）
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== LAST_SYNC_KEY) {
            return;
        }
        console.log(
            `[视频清单标签] [storage] key=${e.key} newValue=${e.newValue ? '<set>' : '<empty>'}`
        );
        if (!e.newValue) return;
        let payload: SyncPayload | null = null;
        try {
            payload = JSON.parse(e.newValue);
        } catch {
            return;
        }
        handleSyncNotify(plugin, payload, onSync, state);
    });

    // 3) 同脚本跨标签页（GM 原生通道，兜底）
    GM_addValueChangeListener(
        LAST_SYNC_KEY,
        (_name: string, _oldValue, newValue, remote: boolean): void => {
            console.log(
                `[视频清单标签] [GM_addValueChangeListener] remote=${remote} newValue=${newValue ? '<set>' : '<empty>'}`
            );
            if (!newValue) return;
            let payload: SyncPayload | null = null;
            try {
                payload = JSON.parse(newValue);
            } catch {
                return;
            }
            handleSyncNotify(plugin, payload, onSync, state);
        }
    );

    console.log(
        `[视频清单标签] 自动刷新监听已就绪 (autoRefreshEnabled=${plugin.autoRefreshEnabled})`
    );
}
