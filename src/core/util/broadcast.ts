/**
 * 三重广播总线 —— GM_setValue / localStorage / CustomEvent 三通道统一收发。
 *
 * 结构保持地去重自 4 处发送点（vlt-broadcast 的 broadcastWantWatchedSync /
 * broadcastSyncComplete / broadcastListMgmt，dpb-want-watched 的
 * broadcastWantWatchedSync）与 3 处订阅点（vlt-remote-sync 的
 * setupListMgmtBroadcastListener、vlt-sync-listener 的 setupAutoRefreshListener、
 * dpb-want-watched 的 setupWantWatchedSyncListener）。
 *
 * 线格式（wire format）与原始实现逐字节一致：
 * - GM/localStorage 写入 JSON.stringify(payload)；CustomEvent 的 detail 为 payload 对象本身。
 * - 无 senderId、无发送方排除机制：发送页经 CustomEvent 自收一次；其他标签页经
 *   storage + GM 各收一次（原始代码即如此，本模块不引入 senderId）。
 * - 不做跨通道去重：是否去重/防抖由订阅方 handler 决定（如 vlt-sync-listener 的 500ms 防抖）。
 */

/** 订阅侧送达通道（CustomEvent 事件 / storage 事件 / GM 监听器）。 */
export type BroadcastDeliveryChannel = 'customEvent' | 'storage' | 'gm';

/** 发送侧写入通道（GM_setValue / localStorage.setItem / dispatchEvent）。 */
export type BroadcastSendChannel = 'gm' | 'localStorage' | 'customEvent';

/** broadcastSend 选项。 */
export interface BroadcastSendOptions {
    /** CustomEvent 事件名；默认与存储键 key 相同。
     *  jdb:last-sync 通道的事件名为 'jdb:sync-complete'（与存储键不同），需显式传入。 */
    eventName?: string;
    /** CustomEvent 的 detail 载荷；默认与写入 GM/localStorage 的 payload 相同。
     *  dpb-want-watched 的广播 CustomEvent detail 为不含 time 的原始 payload，
     *  而 GM/localStorage 写入 {...payload, time}，需显式传入以逐字节保留。 */
    eventDetail?: object;
    /** 单通道写入失败回调；不传则静默吞掉（与多数发送点一致）。 */
    onError?: (channel: BroadcastSendChannel, error: unknown) => void;
}

/** 一次广播送达的上下文（供订阅方做通道级诊断日志）。 */
export interface BroadcastDelivery {
    /** 送达通道。 */
    channel: BroadcastDeliveryChannel;
    /** storage/GM 通道的原始 newValue（未解析）；customEvent 为 undefined。 */
    rawValue?: string;
    /** GM 通道是否来自其他标签页（remote 标志）；仅 channel==='gm' 有意义。 */
    remote?: boolean;
}

/** broadcastSubscribe 选项。 */
export interface BroadcastSubscribeOptions {
    /** CustomEvent 事件名；默认与存储键 key 相同。 */
    eventName?: string;
    /** true：handler 收原始值（customEvent 的 detail 对象 / storage·GM 的原始字符串），
     *  由 handler 自行解析——dpb-want-watched 的 handleSync 即如此，且其 CustomEvent
     *  路径因 detail 无 .detail 字段而为有意 no-op，必须原样保留。
     *  false（默认）：本函数对 storage/GM 值 JSON.parse 后传对象，解析失败跳过该条
     *  ——vlt-remote-sync / vlt-sync-listener 用。 */
    raw?: boolean;
    /** 通道级诊断回调：每条通道送达时先于 handler 调用（storage/GM 在 key 过滤后、
     *  空值检查前触发，与原始实现的日志时序一致）。用于保留各订阅点的 console 诊断日志。 */
    onDelivery?: (delivery: BroadcastDelivery) => void;
}

/**
 * 三重通道广播一条消息。
 *
 * 通道与顺序（与原始实现一致）：
 * 1) GM_setValue —— 同脚本跨标签页（GM 原生通道）
 * 2) localStorage.setItem —— 跨脚本同源（触发其他标签页 storage 事件）
 * 3) document.dispatchEvent(CustomEvent) —— 同页面即时
 *
 * 每个通道独立 try/catch 容错；失败时调用 opts.onError（不传则静默）。
 * JSON.stringify 位于 try 之外，序列化失败向上抛出（与原始发送点一致）。
 *
 * @param key GM 存储键 + localStorage 键（写入的字符串值不变）
 * @param payload 载荷对象（GM/localStorage 写其 JSON；CustomEvent 默认传其对象本身）
 * @param opts eventName / eventDetail / onError
 */
export function broadcastSend<T extends object>(
    key: string,
    payload: T,
    opts: BroadcastSendOptions = {}
): void {
    const { eventName = key, eventDetail = payload, onError } = opts;
    const json = JSON.stringify(payload);
    // 1) GM 原生通道（同脚本跨标签页）
    try {
        GM_setValue(key, json);
    } catch (error) {
        onError?.('gm', error);
    }
    // 2) localStorage（跨脚本同源）
    try {
        localStorage.setItem(key, json);
    } catch (error) {
        onError?.('localStorage', error);
    }
    // 3) CustomEvent（同页面即时）
    try {
        document.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
    } catch (error) {
        onError?.('customEvent', error);
    }
}

/**
 * 三重通道订阅广播，注册 CustomEvent / storage / GM 三个监听器。
 *
 * 不做跨通道去重（与原始实现一致）：handler 在每条通道送达时各调用一次。
 * 发送页经 CustomEvent 自收一次；其他标签页经 storage + GM 各收一次。
 * 如需去重/防抖由 handler 自行处理（如 vlt-sync-listener 的 500ms 防抖）。
 *
 * 送达语义：
 * - customEvent：传 detail 对象（raw/parsed 相同）。
 * - storage：按 key 过滤且 newValue 非空后送达；parsed 模式先 JSON.parse（失败跳过），
 *   raw 模式直传原始字符串。
 * - gm：newValue 非空后送达；parsed 模式先 JSON.parse（失败跳过），raw 模式直传原始值。
 *
 * 注册后不返回卸载函数（与原始 3 处订阅点一致：均为页面级一次性安装，无 teardown；
 * GM_removeValueChangeListener 在本项目 globals 中亦未声明）。GM_addValueChangeListener
 * 注册包裹 try/catch（与 vlt-remote-sync / dpb-want-watched 一致）。
 *
 * @param key localStorage 键 + GM 存储键（storage 事件按此键过滤）
 * @param handler 载荷处理回调；delivery 提供通道与诊断元信息
 * @param opts eventName / raw / onDelivery
 */
export function broadcastSubscribe<T>(
    key: string,
    handler: (payload: T, delivery: BroadcastDelivery) => void,
    opts: BroadcastSubscribeOptions = {}
): void {
    const eventName = opts.eventName ?? key;
    const raw = opts.raw === true;
    const onDelivery = opts.onDelivery;

    // 1) 同页面 CustomEvent（即时）—— detail 对象直传
    document.addEventListener(eventName, (e: Event) => {
        onDelivery?.({ channel: 'customEvent' });
        handler((e as CustomEvent).detail as T, { channel: 'customEvent' });
    });

    // 2) 跨标签页/跨脚本 localStorage storage 事件（仅其他标签页触发）
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== key) return;
        const delivery: BroadcastDelivery = { channel: 'storage', rawValue: e.newValue ?? undefined };
        onDelivery?.(delivery);
        if (!e.newValue) return;
        if (raw) {
            // raw 模式直传原始字符串（泛型擦除，非 as-any）
            handler(e.newValue as unknown as T, delivery);
            return;
        }
        let payload: T;
        try {
            payload = JSON.parse(e.newValue) as T;
        } catch {
            return;
        }
        handler(payload, delivery);
    });

    // 3) 同脚本跨标签页 GM 原生通道
    try {
        GM_addValueChangeListener(
            key,
            (_name: string, _oldValue: unknown, newValue: unknown, remote: boolean) => {
                const delivery: BroadcastDelivery = {
                    channel: 'gm',
                    rawValue: newValue as string | undefined,
                    remote
                };
                onDelivery?.(delivery);
                if (!newValue) return;
                if (raw) {
                    handler(newValue as T, delivery);
                    return;
                }
                let payload: T;
                try {
                    payload = JSON.parse(newValue as string) as T;
                } catch {
                    return;
                }
                handler(payload, delivery);
            }
        );
    } catch {}
}
