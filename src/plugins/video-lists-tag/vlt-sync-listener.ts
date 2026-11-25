/**
 * 跨标签页实时标签同步订阅模块 —— 永久开启的三重广播接收与去重。
 *
 * 原独立脚本通过 `autoRefreshEnabled` 开关控制是否响应跨标签页同步；
 * 现已移除开关逻辑，标签同步永久生效，本模块彻底解耦 `VltTags`：
 * - `shouldProcessTagSync`：校验载荷是否携带有效番号且属于会产生标签变更的关联结果
 * - `createTagSyncDeduper`：对同一广播经 CustomEvent/storage/GM 三通道送达的回声精准去重，
 *   不再使用全局时间窗口误吞并发场景下其他番号的更新
 * - `subscribeTagSync`：订阅 `jdb:last-sync` / `jdb:sync-complete`，支持 `AbortSignal` 生命周期回收
 */
import { broadcastSubscribe } from '../../core/util/broadcast';

/** GM 存储键 + localStorage 键：最后一次同步事件 payload。 */
export const LAST_SYNC_KEY = 'jdb:last-sync';

/** 同页面即时同步事件名。 */
export const SYNC_COMPLETE_EVENT = 'jdb:sync-complete';

/** 跨标签页同步事件 payload 结构。 */
export interface SyncPayload {
    designation?: string;
    association?: string;
    action?: string;
    time?: number;
}

/** 已通过基本校验的同步载荷。 */
export type ValidSyncPayload = SyncPayload & { designation: string };

/** 同步去重器接口。 */
export interface TagSyncDeduper {
    accept(payload: ValidSyncPayload, now?: number): boolean;
}

/** 服务器返回的「未变更」类 association —— 标签不会变化，跳过刷新。 */
const NO_CHANGE_ASSOCS: Record<string, true> = {
    existed: true,
    limit_exceeded: true,
    unchanged: true
};

/** 缺少 `time` 字段的兼容载荷按番号去重的默认窗口（毫秒）。 */
const FALLBACK_DESIGNATION_WINDOW_MS = 500;

/** 带时间戳事件的跨通道回声记忆 TTL（毫秒）。 */
const EVENT_DEDUPE_TTL_MS = 5000;

/** 校验同步载荷是否应触发标签刷新。 */
export function shouldProcessTagSync(payload: SyncPayload | null): payload is ValidSyncPayload {
    if (!payload || !payload.designation) {
        console.warn('[视频清单标签] 收到同步事件但无 designation:', payload);
        return false;
    }
    if (NO_CHANGE_ASSOCS[payload.association ?? '']) {
        console.log(`[视频清单标签] association=${payload.association} 不影响标签，跳过`);
        return false;
    }
    return true;
}

/**
 * 创建跨通道同步去重器：
 * - 带 `time` 的标准载荷按 `(designation, action, association, time)` 精确去重，
 *   拦截 storage + GM 双通道回声，同时绝不误吞不同番号或同一番号的新变更；
 * - 无 `time` 的旧格式载荷退回按番号独立窗口去重，不互相阻塞。
 */
export function createTagSyncDeduper(
    fallbackWindowMs = FALLBACK_DESIGNATION_WINDOW_MS,
    eventTtlMs = EVENT_DEDUPE_TTL_MS
): TagSyncDeduper {
    const seenEvents = new Map<string, number>();
    const lastByDesignation = new Map<string, number>();

    const pruneExpired = (map: Map<string, number>, ttl: number, now: number): void => {
        if (map.size <= 64) return;
        for (const [key, ts] of map) {
            if (now - ts >= ttl) map.delete(key);
        }
    };

    return {
        accept(payload: ValidSyncPayload, now = Date.now()): boolean {
            if (typeof payload.time === 'number' && Number.isFinite(payload.time)) {
                const key = `${payload.designation}|${payload.action ?? ''}|${payload.association ?? ''}|${payload.time}`;
                const seenAt = seenEvents.get(key);
                if (seenAt !== undefined && now - seenAt < eventTtlMs) {
                    return false;
                }
                pruneExpired(seenEvents, eventTtlMs, now);
                seenEvents.set(key, now);
                return true;
            }

            const prev = lastByDesignation.get(payload.designation);
            if (prev !== undefined && now - prev < fallbackWindowMs) {
                return false;
            }
            pruneExpired(lastByDesignation, fallbackWindowMs, now);
            lastByDesignation.set(payload.designation, now);
            return true;
        }
    };
}

/**
 * 订阅跨脚本/跨标签页清单同步广播（永久生效）。
 *
 * 三重通道（与 `broadcastSyncComplete` 对应）：
 * 1. CustomEvent `jdb:sync-complete` —— 同页面即时
 * 2. window `storage` —— 同源跨标签页 / 跨脚本
 * 3. `GM_addValueChangeListener` —— 同脚本跨标签页兜底
 *
 * @param onSync 通过校验与去重后的同步事件回调
 * @param opts 可选取消信号（插件销毁时自动停止接收）
 */
export function subscribeTagSync(
    onSync: (payload: ValidSyncPayload) => void,
    opts: { signal?: AbortSignal } = {}
): void {
    const deduper = createTagSyncDeduper();

    broadcastSubscribe<SyncPayload>(
        LAST_SYNC_KEY,
        (payload) => {
            if (!shouldProcessTagSync(payload)) return;
            if (!deduper.accept(payload)) return;
            console.log('[视频清单标签] 收到同步事件 → 刷新标签', payload);
            onSync(payload);
        },
        {
            eventName: SYNC_COMPLETE_EVENT,
            signal: opts.signal,
            onDelivery: (delivery) => {
                if (delivery.channel === 'customEvent') {
                    console.log('[视频清单标签] [CustomEvent] 收到 jdb:sync-complete');
                } else if (delivery.channel === 'storage') {
                    console.log(
                        `[视频清单标签] [storage] key=${LAST_SYNC_KEY} newValue=${delivery.rawValue ? '<set>' : '<empty>'}`
                    );
                } else {
                    console.log(
                        `[视频清单标签] [GM_addValueChangeListener] remote=${delivery.remote} newValue=${delivery.rawValue ? '<set>' : '<empty>'}`
                    );
                }
            }
        }
    );

    console.log('[视频清单标签] 跨标签页实时同步监听已就绪');
}
