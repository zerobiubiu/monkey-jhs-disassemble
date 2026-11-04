import type { BatchListJob, BatchListProgress } from '../../../types/batch-lists';

export function batchListExecutionLockName(): string { return 'jhs:batch-lists:' + window.location.origin; }

export function requireBatchListLocks(): LockManager {
    if (typeof navigator === 'undefined' || !navigator.locks) {
        throw new Error('当前浏览器不支持 Web Locks，无法安全执行可恢复的批量清单操作');
    }
    return navigator.locks;
}

/** 运行权威来自浏览器持锁状态，不用时间戳判断后台或慢网络页面已经失活。 */
export async function isBatchListExecutionRunning(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks) return false;
    const snapshot = await navigator.locks.query();
    return snapshot.held?.some((lock) => lock.name === batchListExecutionLockName()) ?? false;
}

export async function withBatchListExecutionLock<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return requireBatchListLocks().request(batchListExecutionLockName(), { mode: 'exclusive', ...(signal ? { signal } : {}) }, work);
}

/** 只在执行锁内创建发布者；旧运行结束时不会误清除其他运行的状态。 */
export function publishBatchListExecution(jobs: readonly BatchListJob[]): {
    update(progress: BatchListProgress): void; close(): void;
} {
    if (typeof GM_setValue !== 'function' || typeof GM_getValue !== 'function') throw new Error('无法保存批量执行状态');
    const key = 'jhs:batch-list-running:' + window.location.origin;
    const token = crypto.randomUUID();
    const jobIds = jobs.map((job) => job.id);
    return {
        update: (progress) => { GM_setValue(key, JSON.stringify({ token, jobIds, progress })); },
        close: () => {
            const raw: unknown = GM_getValue(key, null);
            const current: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (current && typeof current === 'object' && 'token' in current && current.token === token) GM_setValue(key, 'null');
        }
    };
}
