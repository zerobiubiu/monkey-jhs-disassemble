/**
 * 跨站同步共享基础设施 —— 键控串行队列。
 *
 * 提取自两处重复实现（doc/195）：
 * - missav-status-tag-plugin.ts 的 enqueueConsume（Promise 链）
 * - video-lists-tag/vlt-lock-queue.ts 的 enqueueAssociationTask（按 key 的 Promise Map）
 *
 * 同 key 任务串行执行，不同 key 可并发；前一任务失败不阻塞后续。
 */

/**
 * 键控串行队列：同 key 任务串行执行，不同 key 可并发。
 * 前一任务失败不阻塞后续（错误由调用方处理）。
 */
export class KeyedQueue {
    /** 每个 key 当前的队列尾 Promise。 */
    private queues = new Map<string, Promise<void>>();

    /**
     * 将任务加入指定 key 的串行队列，返回任务的 Promise。
     * @param key 队列键（同键串行，异键并发）
     * @param task 待执行的异步任务
     * @returns 任务自身的 Promise（保留其成功值/拒绝原因）
     */
    enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
        const prev = this.queues.get(key) ?? Promise.resolve();
        // 队列尾：任务结算后即 resolve（吞掉错误，防止链断裂）
        let resolveTail!: () => void;
        const tail = new Promise<void>((resolve) => {
            resolveTail = resolve;
        });
        this.queues.set(key, tail);
        // 前一任务无论成败都执行当前任务（错误由调用方处理）
        const result = prev.then(task, task);
        result.then(
            () => resolveTail(),
            () => resolveTail()
        );
        // 自清理：队列尾仍是自己时删除 Map 项，避免内存泄漏
        tail.then(() => {
            if (this.queues.get(key) === tail) this.queues.delete(key);
        });
        return result;
    }
}
