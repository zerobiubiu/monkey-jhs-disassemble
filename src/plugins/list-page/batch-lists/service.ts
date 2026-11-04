import type { BatchListChoice, BatchListItem, BatchListJob, BatchListProgress, BatchRatingChoice } from '../../../types/batch-lists';
import { enqueueAssociationTask, listAssociationKey } from '../../video-lists-tag/vlt-lock-queue';
import { publishListIntent } from '../../video-lists-tag/server/vlt-intent';
import { isBatchListChoice, isBatchListJobPending, isBatchRatingChoice, readBatchListJobs, setBatchListJobsPaused,
    updateBatchListItemState, withBatchListJournalLock, writeBatchListJobs } from './journal';
import { captureBatchRating } from './ratings';
import { emptyBatchListProgress, executeBatchListJobs, pauseBatchListJobs, progressForBatchListJobs } from './executor';
import { batchListExecutionLockName, requireBatchListLocks, withBatchListExecutionLock } from './execution-state';

export { emptyBatchListProgress } from './executor';
export { isBatchListExecutionRunning } from './execution-state';

/** 点击开始后先完整预写所有视频与所选清单，再排队取得执行权。 */
export async function startBatchListJob(
    items: BatchListItem[], lists: BatchListChoice[], desiredChecked: boolean,
    notify: (progress: BatchListProgress) => void, signal?: AbortSignal, rating?: BatchRatingChoice
): Promise<BatchListProgress> {
    const now = Date.now();
    const id = crypto.randomUUID();
    requireBatchListLocks();
    if (!Array.isArray(lists) || !lists.length || !lists.every(isBatchListChoice)) throw new Error('请选择有效的视频清单');
    if (rating !== undefined && !isBatchRatingChoice(rating)) throw new Error('请选择有效的批量评价及星级');
    const uniqueLists = [...new Map(lists.map((list) => [list.id, { ...list,
        ...(list.group ? { group: { ...list.group, excludeNames: [...list.group.excludeNames] } } : {}),
        ...(list.members ? { members: list.members.map((member) => ({ ...member })) } : {})
    }])).values()];
    const unique = new Map<string, BatchListItem>();
    for (const item of items) {
        if (!item.carNum.trim() || !/^[\w-]+$/.test(item.videoId) ||
            !item.url.includes('/v/' + item.videoId)) throw new Error('视频信息不完整，未开始任何清单修改');
        unique.set(item.videoId, { ...item });
    }
    if (!unique.size) throw new Error('请先选择视频');
    const job: BatchListJob = {
        version: 2, id, origin: window.location.origin, lists: uniqueLists,
        rating: rating ? { ...rating } : undefined, desiredChecked, createdAt: now, updatedAt: now,
        // 预写与排队之间尚未持有长锁，新页面不能把刚点击的任务误判为中断。
        attempts: 0, retryAt: now + 30000, ratingsComplete: false,
        items: [...unique.values()].map((item) => ({ ...item, state: 'pending', error: '', ratingsComplete: false,
            operations: uniqueLists.map((list) => ({ listId: list.id, state: 'pending', error: '' })) }))
    };
    const progress = { ...emptyBatchListProgress(), current: '正在保存完整操作记录', total: job.items.length, pending: job.items.length };
    notify({ ...progress });
    if (rating) await Promise.all(job.items.map(async (item) => {
        item.rating = await captureBatchRating(item, `${id}:${item.videoId}`, now);
    }));
    await withBatchListJournalLock(async () => {
        const jobs = readBatchListJobs();
        if (job.rating) {
            const newest = [...jobs, job].reduce((latest, entry) => entry.items.reduce((value, item) =>
                Math.max(value, item.rating?.requestedAt ?? 0), latest), 0) + 1;
            if (!Number.isSafeInteger(newest)) throw new Error('无法安全登记组合评价顺序，尚未开始执行');
            for (const item of job.items) item.rating!.requestedAt = newest;
        }
        const listIds = new Set(job.lists.map((list) => list.id));
        for (const old of jobs) {
            if (old.createdAt > now) continue;
            for (const item of old.items) {
                if (!unique.has(item.videoId)) continue;
                for (const operation of item.operations) {
                    if (operation.state === 'pending' && listIds.has(operation.listId)) {
                        operation.state = 'superseded'; operation.error = '';
                    }
                }
                updateBatchListItemState(item);
            }
        }
        const pending = jobs.filter(isBatchListJobPending);
        const finished = jobs.filter((entry) => !isBatchListJobPending(entry)).slice(-19);
        job.retryAt = Date.now() + 30000;
        writeBatchListJobs([...finished, ...pending, job]);
    });
    progress.current = '预写已保存，等待其他标签页完成批量清单操作';
    notify({ ...progress });
    return withStopPersistence(new Set([id]), signal, async () => {
        try {
            return await withBatchListExecutionLock(async (): Promise<BatchListProgress> => {
                const registered = readBatchListJobs().find((entry) => entry.id === id);
                if (!registered) throw new Error('未找到已预写的批量清单任务，已停止网站请求');
                if (signal?.aborted || registered.paused) return pauseBatchListJobs([registered], progress, notify);
                if (!isBatchListJobPending(registered)) {
                    const superseded = registered.items.filter((item) => item.state === 'superseded').length;
                    return { ...emptyBatchListProgress(), total: registered.items.length, done: registered.items.length,
                        succeeded: registered.items.length - superseded, superseded, phase: 'done' };
                }
                await publishJobIntents(registered, true);
                return executeBatchListJobs([registered], notify, signal);
            }, signal);
        } catch (error: unknown) {
            if (!signal?.aborted || error !== signal.reason) throw error;
            const registered = readBatchListJobs().find((entry) => entry.id === id);
            if (!registered) throw error;
            return pauseBatchListJobs([registered], progress, notify);
        }
    });
}

/** 手动继续沿用同一执行锁；等锁后重新读取状态，较早的继续不能清除较新的停止。 */
export async function recoverBatchListJobs(
    notify: (progress: BatchListProgress) => void, force = false, signal?: AbortSignal
): Promise<BatchListProgress> {
    const requested = readBatchListJobs().filter((job) => isBatchListJobPending(job) &&
        (force || (!job.paused && job.retryAt <= Date.now())));
    const ids = new Set(requested.map((job) => job.id));
    const expectedRevisions = new Map(requested.map((job) => [job.id, job.pauseRevision ?? 0]));
    return withStopPersistence(ids, signal, async () => {
        try {
            return await withBatchListExecutionLock(async (): Promise<BatchListProgress> => {
                let due = readBatchListJobs().filter((job) => ids.has(job.id) && isBatchListJobPending(job) &&
                    (force || (!job.paused && job.retryAt <= Date.now())));
                if (signal?.aborted) return pauseBatchListJobs(due, progressForBatchListJobs(due), notify);
                if (force) due = await setBatchListJobsPaused(new Set(due.map((job) => job.id)), false, { signal, expectedRevisions });
                for (const job of due) if (!job.paused) await publishJobIntents(job);
                return executeBatchListJobs(due, notify, signal);
            }, signal);
        } catch (error: unknown) {
            if (!signal?.aborted || error !== signal.reason) throw error;
            const due = readBatchListJobs().filter((job) => ids.has(job.id) && isBatchListJobPending(job));
            return pauseBatchListJobs(due, progressForBatchListJobs(due), notify);
        }
    });
}

type RecoveryWork = (notify: (progress: BatchListProgress) => void, signal?: AbortSignal) => Promise<BatchListProgress>;

/** 原子尝试取得执行权后才检查到期记录及打开窗口，不查询后排队唤醒活页面任务。 */
export async function runAutomaticBatchListRecovery(open: (work: RecoveryWork) => Promise<void>): Promise<boolean> {
    let opened: Promise<void> | undefined;
    const started = await requireBatchListLocks().request(batchListExecutionLockName(), { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) return false;
        const due = readBatchListJobs().filter((job) => isBatchListJobPending(job) && !job.paused && job.retryAt <= Date.now());
        if (!due.length) return false;
        let finish!: () => void;
        const settled = new Promise<void>((resolve) => { finish = resolve; });
        let execution: Promise<BatchListProgress> | undefined;
        opened = Promise.resolve().then(() => open((notify, signal) => {
            if (execution) return execution;
            execution = withStopPersistence(new Set(due.map((job) => job.id)), signal, async () => {
                for (const job of due) await publishJobIntents(job);
                return executeBatchListJobs(due, notify, signal);
            }).finally(finish);
            return execution;
        }));
        // 执行结束即释放锁；结果窗关闭在锁外等待，窗口中的手动继续不会等待自身锁。
        void opened.then(() => { if (!execution) finish(); }, () => { if (!execution) finish(); });
        await settled;
        return true;
    });
    if (opened) await opened;
    return started;
}

/** 停止意图即时单独落盘；网络结算和暂停持久化互不等待。 */
async function withStopPersistence<T>(ids: Set<string>, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    let pauseWrite: Promise<BatchListJob[]> | undefined;
    const persistStop = (): void => {
        pauseWrite ??= setBatchListJobsPaused(ids, true, { newIntent: true });
        void pauseWrite.catch(() => undefined);
    };
    signal?.addEventListener('abort', persistStop, { once: true });
    if (signal?.aborted) persistStop();
    try { return await work(); }
    finally {
        signal?.removeEventListener('abort', persistStop);
        if (pauseWrite) await pauseWrite;
    }
}

/** 只发布待执行关联，未重叠的其他清单和独立评价不随某个清单被替代。 */
async function publishJobIntents(job: BatchListJob, explicit = false): Promise<void> {
    for (const item of job.items) for (const operation of item.operations) {
        if (operation.state !== 'pending') continue;
        const list = job.lists.find((choice) => choice.id === operation.listId);
        if (!list) throw new Error('缺少已预写的目标清单');
        const ids = new Set([list.id, ...(list.members?.map((member) => member.id) ?? []), ...(operation.route?.listIds ?? [])]);
        for (const id of ids) await enqueueAssociationTask(listAssociationKey(item.videoId, id), async () => {
            const supersedeOnly = !!list.group && job.desiredChecked && id !== list.id && !operation.route?.listIds.includes(id);
            publishListIntent(item.videoId, id, job.id, job.createdAt, job.desiredChecked, { explicit, supersedeOnly });
        });
    }
}
