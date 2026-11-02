/**
 * 锁队列 —— 按 association key 串行化并发写入。
 *
 * 底层使用 src/core/sync 共享基础设施（doc/195）：
 * - withExclusiveLock：Web Locks 排他锁（跨标签页互斥）
 * - KeyedQueue：同页 Promise 队列（同 key 串行，不同 key 并发）
 *
 * 锁名格式：javdb-power-tools:vlt:{associationKey}
 */

import { KeyedQueue, withExclusiveLock } from '../../core/sync';

const queue = new KeyedQueue();
const LOCK_PREFIX = 'javdb-power-tools:vlt:';

/** 网站影片 ID 是跨入口锁身份；番号显示的大小写或别名不能分裂同一关联的锁。 */
export function listAssociationKey(videoId: string, listId: string): string {
    return `video:${videoId}::${listId}`;
}

/** 将任务加入指定 association key 的串行队列（Web Lock 跨标签页互斥）。 */
export function enqueueAssociationTask(key: string, task: () => Promise<void>): Promise<void> {
    return queue.enqueue(key, () => withExclusiveLock(LOCK_PREFIX + key, task));
}
