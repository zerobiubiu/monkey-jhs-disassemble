/** 评价网络按网站影片互斥；共享 GM 账本及本地准备只持短锁，不覆盖网络等待。 */
import { BATCH_RATING_SYNC_LOCK } from '../../../constants/status';

import { KeyedQueue } from '../../../core/sync/sync-queue';
import { withExclusiveLock } from '../../../core/sync/sync-lock';

const queue = new KeyedQueue();

/** 所有评价账本读改写共用此锁；回调须在写入前重读，不能带入跨网络等待的快照。 */
export function withRatingStateLock<T>(task: () => T | Promise<T>): Promise<T> {
    return queue.enqueue(BATCH_RATING_SYNC_LOCK, () => withExclusiveLock(BATCH_RATING_SYNC_LOCK, async () => task()));
}

/** 相同影片的后台、补同步与详情快捷评价共享网络锁；不同影片可同时发请求。 */
export function withRatingVideoLock<T>(videoId: string, task: () => Promise<T>): Promise<T> {
    const key = `${BATCH_RATING_SYNC_LOCK}:video:${videoId}`;
    return queue.enqueue(key, () => withExclusiveLock(key, task));
}
