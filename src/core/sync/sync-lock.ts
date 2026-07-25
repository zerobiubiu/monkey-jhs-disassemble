/**
 * 跨站同步共享基础设施 —— Web Locks 统一包装。
 *
 * 提取自三处近乎相同的实现（doc/195）：
 * - car-list-reader-plugin.ts 的 withPublisherLock
 * - car-status-db.ts 的 withLocalSyncLock
 * - video-lists-tag/vlt-lock-queue.ts 的 withAssociationLock
 *
 * 用于把跨标签页的读改写临界区串行化，避免多标签页并发写入竞争。
 */

/** navigator.locks 的最小结构声明（部分浏览器/环境不支持）。 */
interface NavigatorWithOptionalLocks {
    locks?: {
        request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
    };
}

/**
 * Web Locks 统一包装（跨标签页排他锁）。
 * navigator.locks 不可用时降级为直接执行。
 * @param lockName 锁名称（不同业务用不同名称隔离）
 * @param task 需要在锁内串行执行的异步任务
 * @returns 任务的返回值
 */
export async function withExclusiveLock<T>(lockName: string, task: () => Promise<T>): Promise<T> {
    const browserNavigator =
        typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithOptionalLocks);
    if (!browserNavigator?.locks) return task();
    return browserNavigator.locks.request(lockName, { mode: 'exclusive' }, task);
}
