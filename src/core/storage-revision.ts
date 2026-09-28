/**
 * StorageRevision — 存储修订号追踪（Storage V2 基础设施）。
 *
 * 每次 StorageManager 写入操作后递增修订号，
 * 通过 BroadcastChannel 广播到其他标签页，
 * 其他标签页比较本地修订号，过期则失效缓存。
 *
 * 设计原则：
 * - 修订号仅用于跨标签页缓存失效，不持久化（每会话从 0 开始）
 * - 广播是额外信号，不替代现有 BroadcastChannel('channel-refresh') 协议
 * - 幂等：多次 init 安全，destroy 后不再广播
 *
 * 使用方式：
 * ```typescript
 * // main.tsx 启动时
 * storageRevision.init();
 * storageRevision.onRemoteChange(() => {
 *     storageManager.clearCarListCache();
 *     storageManager.clearSettingCache();
 * });
 *
 * // StorageManager 每次写入后
 * storageRevision.increment();
 * ```
 */

/** 跨标签页修订号广播通道名。 */
const REVISION_CHANNEL = 'jhs-storage-revision';

/** 修订号广播消息格式。 */
interface RevisionMessage {
    /** 数据修订号（car_list / 清单等写入）。 */
    revision: number;
    /**
     * 设置修订号（仅设置写入递增）。
     *
     * doc/39：设置与数据必须分开计数 —— 否则任何一次写库都会连带失效设置缓存，
     * 使下次设置读取落到 IndexedDB 并排在写事务之后（详情弹窗打开被旧操作拖住）。
     */
    settingsRevision: number;
    /** 发送方标签页 ID（排除自身广播）。 */
    senderId: string;
}

export class StorageRevision {
    private revision = 0;
    private settingsRevision = 0;
    private channel: BroadcastChannel | null = null;
    private readonly senderId = Math.random().toString(36).slice(2, 10);
    private callbacks: Array<(newRevision: number) => void> = [];
    private settingsCallbacks: Array<(newSettingsRevision: number) => void> = [];

    /** 当前修订号。 */
    get current(): number {
        return this.revision;
    }

    /**
     * 初始化：创建 BroadcastChannel 并监听远程修订号变更。
     * 幂等：多次调用安全。
     */
    init(): void {
        if (this.channel) return;
        try {
            this.channel = new BroadcastChannel(REVISION_CHANNEL);
            this.channel.addEventListener('message', (event: MessageEvent) => {
                const msg = event.data as RevisionMessage;
                if (!msg || msg.senderId === this.senderId) return;
                // 数据修订号：car_list / 清单等写入（**不**连带失效设置缓存，doc/39）
                if (typeof msg.revision === 'number' && msg.revision > this.revision) {
                    this.revision = msg.revision;
                    this.fireCallbacks(this.callbacks, msg.revision);
                }
                // 设置修订号：仅设置写入递增，独立失效设置缓存
                if (
                    typeof msg.settingsRevision === 'number' &&
                    msg.settingsRevision > this.settingsRevision
                ) {
                    this.settingsRevision = msg.settingsRevision;
                    this.fireCallbacks(this.settingsCallbacks, msg.settingsRevision);
                }
            });
        } catch {
            /* BroadcastChannel 不可用时静默降级 */
        }
    }

    /**
     * 递增修订号并广播到其他标签页。
     * @returns 新修订号
     */
    increment(): number {
        this.revision++;
        try {
            this.channel?.postMessage({
                revision: this.revision,
                settingsRevision: this.settingsRevision,
                senderId: this.senderId
            } satisfies RevisionMessage);
        } catch {
            /* 广播失败不影响本地修订号 */
        }
        return this.revision;
    }

    /**
     * 递增**设置**修订号并广播（仅设置写入调用，doc/39）。
     *
     * 与 `increment()` 分开：数据写入不得连带失效设置缓存。
     *
     * @returns 新的设置修订号
     */
    incrementSettings(): number {
        this.settingsRevision++;
        try {
            this.channel?.postMessage({
                revision: this.revision,
                settingsRevision: this.settingsRevision,
                senderId: this.senderId
            } satisfies RevisionMessage);
        } catch {
            /* 广播失败不影响本地修订号 */
        }
        return this.settingsRevision;
    }

    /** 当前设置修订号。 */
    get currentSettings(): number {
        return this.settingsRevision;
    }

    /**
     * 注册远程**设置**变更回调（其他标签页写入设置时触发）。
     *
     * @param callback 回调接收新的设置修订号
     */
    onSettingsChange(callback: (newSettingsRevision: number) => void): void {
        this.settingsCallbacks.push(callback);
    }

    /**
     * 逐个回调执行（单个回调报错不影响其余）。
     *
     * @param list 回调列表
     * @param value 传入回调的值
     */
    private fireCallbacks(list: Array<(value: number) => void>, value: number): void {
        for (const cb of list) {
            try {
                cb(value);
            } catch (err) {
                console.error('[StorageRevision] 回调执行失败', err);
            }
        }
    }

    /**
     * 注册远程修订号变更回调（其他标签页写入时触发）。
     * 回调接收新修订号，用于失效本地缓存。
     */
    onRemoteChange(callback: (newRevision: number) => void): void {
        this.callbacks.push(callback);
    }

    /** 清理资源。幂等。 */
    destroy(): void {
        this.channel?.close();
        this.channel = null;
        this.callbacks.length = 0;
        this.settingsCallbacks.length = 0;
    }
}

/** 全局单例（main.tsx 启动时 init）。 */
export const storageRevision = new StorageRevision();
