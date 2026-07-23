/**
 * 锁队列 —— Web Locks API + 同页 Promise 队列，串行化并发写入。
 *
 * 提取自 vlt-sync.tsx：
 * - withAssociationLock：Web Locks 排他锁包装（navigator.locks.request）
 * - enqueueAssociationTask：同页 Promise 队列（按 association key 串行，
 *   防止同一影片-清单对的并发写入竞争）
 */

/** 按 association key 串行化的 Promise 队列。 */
const checkboxMutationQueues = new Map<string, Promise<void>>();

async function withAssociationLock(key: string, task: () => Promise<void>): Promise<void> {
    if (!navigator.locks) {
        await task();
        return;
    }
    await navigator.locks.request(`javdb-power-tools:vlt:${key}`, { mode: 'exclusive' }, task);
}

export function enqueueAssociationTask(key: string, task: () => Promise<void>): Promise<void> {
    const previous = checkboxMutationQueues.get(key) || Promise.resolve();
    const current = previous
        .catch(() => {})
        .then(() => withAssociationLock(key, task));
    checkboxMutationQueues.set(key, current);
    current.finally(() => {
        if (checkboxMutationQueues.get(key) === current) checkboxMutationQueues.delete(key);
    });
    return current;
}
