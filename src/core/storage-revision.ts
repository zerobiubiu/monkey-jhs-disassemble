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
    revision: number;
    /** 发送方标签页 ID（排除自身广播）。 */
    senderId: string;
}

export class StorageRevision {
    private revision = 0;
    private channel: BroadcastChannel | null = null;
    private readonly senderId = Math.random().toString(36).slice(2, 10);
    private callbacks: Array<(newRevision: number) => void> = [];

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
                if (msg && typeof msg.revision === 'number' && msg.senderId !== this.senderId) {
                    // 修订号仅作元数据（每会话从 0 开始，不跨会话单调递增）
                    // 任何远程消息都触发缓存失效（senderId 已排除自身）
                    if (msg.revision > this.revision) this.revision = msg.revision;
                    for (const cb of this.callbacks) {
                        try {
                            cb(msg.revision);
                        } catch (err) {
                            console.error('[StorageRevision] 回调执行失败', err);
                        }
                    }
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
                senderId: this.senderId
            } satisfies RevisionMessage);
        } catch {
            /* 广播失败不影响本地修订号 */
        }
        return this.revision;
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
    }
}

/** 全局单例（main.tsx 启动时 init）。 */
export const storageRevision = new StorageRevision();
