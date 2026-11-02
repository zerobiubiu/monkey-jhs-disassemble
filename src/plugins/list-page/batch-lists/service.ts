import { withExclusiveLock } from '../../../core/sync';
import type { BatchListChoice, BatchListItem, BatchListJob, BatchListProgress, BatchRatingChoice } from '../../../types/batch-lists';

import { drainBatchRatings } from '../lp-batch-sync';
import { enqueueAssociationTask, listAssociationKey } from '../../video-lists-tag/vlt-lock-queue';
import { publishListIntent } from '../../video-lists-tag/server/vlt-intent';
import { isBatchListJobPending, isBatchRatingChoice, readBatchListJobs, writeBatchListJobs } from './journal';
import { captureBatchRating, finishBatchRatings, prepareBatchRatings } from './ratings';
import { applyBatchListItem } from './site';

const PACING_MS = 900;

/** 日志短锁与执行长锁分开；无可靠互斥时拒绝执行。 */
async function locked<T>(work: () => Promise<T>, journal = false, signal?: AbortSignal): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
        throw new Error('当前浏览器不支持 Web Locks，无法安全执行可恢复的批量清单操作');
    }
    const name = (journal ? 'jhs:batch-list-journal:' : 'jhs:batch-lists:') + window.location.origin;
    return signal && !journal ? navigator.locks.request(name, { mode: 'exclusive', signal }, work) : withExclusiveLock(name, work);
}

export function emptyBatchListProgress(): BatchListProgress {
    return {
        total: 0, done: 0, succeeded: 0, failed: 0, pending: 0, superseded: 0,
        phase: 'lists', current: '', ratingTotal: 0, ratingDone: 0, ratingFailed: 0, ratingPending: 0
    };
}

/** 点击开始后先持久化完整意图，再允许任何网站写入。 */
export async function startBatchListJob(
    items: BatchListItem[], list: BatchListChoice, desiredChecked: boolean,
    notify: (progress: BatchListProgress) => void, signal?: AbortSignal, rating?: BatchRatingChoice
): Promise<BatchListProgress> {
    // 捕获用户开始的时刻，不能让等待执行锁的旧点击变成较新意图。
    const now = Date.now();
    const id = crypto.randomUUID();
    if (!list.id.trim() || !list.name.trim()) throw new Error('请选择有效的视频清单');
    if (rating !== undefined && !isBatchRatingChoice(rating)) throw new Error('请选择有效的批量评价及星级');
    const unique = new Map<string, BatchListItem>();
    for (const item of items) {
        if (!item.carNum.trim() || !/^[\w-]+$/.test(item.videoId) ||
            !item.url.includes('/v/' + item.videoId)) throw new Error('视频信息不完整，未开始任何清单修改');
        unique.set(item.videoId, { ...item });
    }
    if (unique.size === 0) throw new Error('请先选择视频');
    const job: BatchListJob = {
        version: 1, id, origin: window.location.origin,
        list: { ...list }, rating: rating ? { ...rating } : undefined, desiredChecked, createdAt: now, updatedAt: now,
        attempts: 0, retryAt: now, ratingsComplete: false,
        items: [...unique.values()].map((item) => ({ ...item, state: 'pending', error: '' }))
    };
    const progress = emptyBatchListProgress();
    progress.current = '正在保存完整操作记录';
    progress.total = job.items.length;
    progress.pending = job.items.length;
    notify({ ...progress });
    if (rating) {
        await Promise.all(job.items.map(async (item) => {
            item.rating = await captureBatchRating(item, `${id}:${item.videoId}`, now);
        }));
    }
    // 日志锁只保护同步读改写，排队等待长网络请求之前即落盘。
    await locked(async () => {
        const jobs = readBatchListJobs();
        if (job.rating) {
            const newest = [...jobs, job].reduce((latest, entry) => entry.items.reduce((value, item) =>
                Math.max(value, item.rating?.requestedAt ?? 0), latest), 0) + 1;
            if (!Number.isSafeInteger(newest)) throw new Error('无法安全登记组合评价顺序，尚未开始执行');
            for (const item of job.items) item.rating!.requestedAt = newest;
        }
        // 新的明确意图取代同一关联的未完成旧意图，防止旧恢复任务反向覆盖。
        for (const old of jobs) {
            if (old.list.id !== list.id || old.createdAt > now) continue;
            for (const item of old.items) {
                if (item.state === 'pending' && unique.has(item.videoId)) item.state = 'superseded';
            }
        }
        // 仅裁剪已完成历史；所有未完成意图均保留。
        const pending = jobs.filter(isBatchListJobPending);
        const finished = jobs.filter((entry) => !isBatchListJobPending(entry)).slice(-19);
        const next = [...finished, ...pending, job];
        writeBatchListJobs(next);
    }, true);
    progress.current = '预写已保存，等待其他标签页完成批量清单操作';
    notify({ ...progress });
    return withStopPersistence(new Set([id]), signal, async () => {
        try {
            return await locked(async () => {
                const registered = readBatchListJobs().find((entry) => entry.id === id);
                if (!registered) throw new Error('未找到已预写的批量清单任务，已停止网站请求');
                if (signal?.aborted) return pauseJobs([registered], progress, notify);
                await publishJobIntents(registered, true);
                return executeJobs([registered], notify, signal);
            }, false, signal);
        } catch (error: unknown) {
            if (!signal?.aborted || error !== signal.reason) throw error;
            const registered = readBatchListJobs().find((entry) => entry.id === id);
            if (!registered) throw error;
            return pauseJobs([registered], progress, notify);
        }
    });
}

/** 恢复前逐项查询网站；已经生效的项只补本地提交，避免重复 POST。 */
export async function recoverBatchListJobs(
    notify: (progress: BatchListProgress) => void, force = false, signal?: AbortSignal
): Promise<BatchListProgress> {
    const requested = readBatchListJobs().filter((job) => isBatchListJobPending(job) &&
        (force || (!job.paused && job.retryAt <= Date.now())));
    const requestedIds = new Set(requested.map((job) => job.id));
    const expectedRevisions = new Map(requested.map((job) => [job.id, job.pauseRevision ?? 0]));
    return withStopPersistence(requestedIds, signal, async () => {
        try {
            return await locked(async () => {
                let due = readBatchListJobs().filter((job) => requestedIds.has(job.id) && isBatchListJobPending(job) && (force || !job.paused));
                if (signal?.aborted) return pauseJobs(due, progressForJobs(due), notify);
                if (force) due = await setJobsPaused(new Set(due.map((job) => job.id)), false, { signal, expectedRevisions });
                for (const job of due) await publishJobIntents(job);
                return executeJobs(due, notify, signal);
            }, false, signal);
        } catch (error: unknown) {
            if (!signal?.aborted || error !== signal.reason) throw error;
            const due = readBatchListJobs().filter((job) => requestedIds.has(job.id) && isBatchListJobPending(job));
            return pauseJobs(due, progressForJobs(due), notify);
        }
    });
}

/** 停止意图立即单独落盘；网络结算和暂停持久化互不等待。 */
async function withStopPersistence<T>(ids: Set<string>, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    let pauseWrite: Promise<BatchListJob[]> | undefined;
    const persistStop = (): void => {
        pauseWrite ??= setJobsPaused(ids, true, { newIntent: true });
        // 先挂拒绝处理避免在途请求期间出现未处理拒绝，返回前仍须抛出持久化错误。
        void pauseWrite.catch(() => undefined);
    };
    signal?.addEventListener('abort', persistStop, { once: true });
    if (signal?.aborted) persistStop();
    try {
        return await work();
    } finally {
        signal?.removeEventListener('abort', persistStop);
        if (pauseWrite) await pauseWrite;
    }
}

/** 只改变暂停指令，不用等待执行锁之前的旧快照覆盖成功状态或创建防重路由。 */
async function setJobsPaused(ids: Set<string>, paused: boolean, options: {
    signal?: AbortSignal; expectedRevisions?: ReadonlyMap<string, number>; newIntent?: boolean
} = {}): Promise<BatchListJob[]> {
    return locked(async () => {
        const current = readBatchListJobs();
        const selected = current.filter((job) => ids.has(job.id));
        const nextPaused = paused || !!options.signal?.aborted;
        for (const job of selected) {
            if (!nextPaused && options.expectedRevisions && options.expectedRevisions.get(job.id) !== (job.pauseRevision ?? 0)) continue;
            if (nextPaused && !isBatchListJobPending(job)) continue;
            if (nextPaused && (options.newIntent || !job.paused)) job.pauseRevision = (job.pauseRevision ?? 0) + 1;
            job.paused = nextPaused;
        }
        writeBatchListJobs(current);
        return selected;
    }, true);
}

/** 意图登记与详情页共用关联锁；时间较旧的恢复记录不得覆盖更新的明确操作。 */
async function publishJobIntents(job: BatchListJob, explicit = false): Promise<void> {
    for (const item of job.items) {
        if (item.state !== 'pending') continue;
        const ids = new Set([job.list.id, ...(job.list.members?.map((member) => member.id) ?? []), ...(item.route?.listIds ?? [])]);
        for (const id of ids) {
            await enqueueAssociationTask(listAssociationKey(item.videoId, id), async () => {
                const supersedeOnly = !!job.list.group && job.desiredChecked && id !== job.list.id && !item.route?.listIds.includes(id);
                publishListIntent(item.videoId, id, job.id, job.createdAt, job.desiredChecked, { explicit, supersedeOnly });
            });
        }
    }
}

/** 只合并当前任务的进度；等待执行的新任务和其替代标记不得被旧快照抹去。 */
async function persistProgress(jobs: BatchListJob[]): Promise<void> {
    await locked(async () => {
        const current = readBatchListJobs();
        for (const patch of jobs) {
            const index = current.findIndex((entry) => entry.id === patch.id);
            if (index < 0) throw new Error('任务恢复日志丢失，已停止执行');
            const stored = current[index];
            current[index] = { ...patch, paused: stored.paused, pauseRevision: stored.pauseRevision, items: patch.items.map((item) =>
                stored.items.find((old) => old.videoId === item.videoId)?.state === 'superseded'
                    ? { ...item, state: 'superseded', error: '' } : { ...item }) };
        }
        writeBatchListJobs(current);
    }, true);
}

function progressForJobs(jobs: BatchListJob[]): BatchListProgress {
    const progress = emptyBatchListProgress();
    const pendingItems = jobs.flatMap((job) => job.items.filter((item) => item.state === 'pending'));
    progress.superseded = jobs.reduce((count, job) => count + job.items.filter((item) => item.state === 'superseded').length, 0);
    progress.done = progress.superseded;
    progress.total = pendingItems.length + progress.superseded;
    progress.pending = pendingItems.length;
    progress.ratingPending = jobs.reduce((count, job) => count + job.items.filter((item) => item.rating &&
        !['success', 'superseded'].includes(item.rating.phase)).length, 0);
    return progress;
}

async function pauseJobs(jobs: BatchListJob[], progress: BatchListProgress,
    notify: (progress: BatchListProgress) => void): Promise<BatchListProgress> {
    const fresh = await setJobsPaused(new Set(jobs.map((job) => job.id)), true);
    const remaining = progressForJobs(fresh);
    const stopped: BatchListProgress = { ...progress, pending: remaining.pending, ratingPending: remaining.ratingPending,
        stopped: true, phase: 'done', current: '已停止执行，未完成记录已保留；点击继续执行后恢复' };
    notify(stopped);
    return stopped;
}

async function executeJobs(jobs: BatchListJob[], notify: (progress: BatchListProgress) => void, signal?: AbortSignal): Promise<BatchListProgress> {
    const controller = new AbortController();
    const stop = (): void => controller.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const observePause = (): void => {
        if (signal?.aborted || readBatchListJobs().some((job) => job.paused && jobs.some((entry) => entry.id === job.id))) stop();
    };
    observePause();
    try {
        return await executeJobsWithSignal(jobs, (progress) => { observePause(); notify(progress); }, controller.signal, observePause);
    } finally {
        signal?.removeEventListener('abort', stop);
    }
}

async function executeJobsWithSignal(jobs: BatchListJob[], notify: (progress: BatchListProgress) => void,
    signal: AbortSignal, observePause: () => void): Promise<BatchListProgress> {
    const progress = progressForJobs(jobs);
    if (jobs.length === 0) return { ...progress, phase: 'done' };
    if (signal?.aborted) return pauseJobs(jobs, progress, notify);
    const publish = (): void => notify({ ...progress });
    progress.phase = 'ratings';
    progress.current = jobs.some((job) => job.rating)
        ? '准备本次评价设置并同步网站，随后执行清单；其他评价继续后台同步'
        : '同步本次清单操作视频的未完成评价，其他评价继续后台同步';
    publish();
    for (const job of jobs) {
        if (!job.rating) continue;
        await prepareBatchRatings(job, async () => { await persistProgress([job]); observePause(); }, signal);
        if (signal.aborted) return pauseJobs(jobs, progress, notify);
    }
    const targets = [...new Map(jobs.flatMap((job) => job.items.filter((item) => item.state !== 'superseded' ||
        (item.rating && !['success', 'superseded'].includes(item.rating.phase))))
        .map((item) => [item.videoId, item])).values()];
    const ratings = await drainBatchRatings(targets, (done, total, failed) => {
        progress.ratingDone = done;
        progress.ratingTotal = total;
        progress.ratingFailed = failed;
        publish();
    }, signal);
    progress.ratingTotal = ratings.total;
    progress.ratingDone = ratings.succeeded + ratings.failed;
    progress.ratingFailed = ratings.failed;
    for (const job of jobs) {
        if (job.rating) await finishBatchRatings(job, () => persistProgress([job]));
        job.ratingsComplete = !ratings.stopped && ratings.failed === 0 && (!job.rating || job.items.every((item) =>
            item.rating?.phase === 'success' || item.rating?.phase === 'superseded'));
    }
    progress.ratingPending = progressForJobs(jobs).ratingPending;
    await persistProgress(jobs);
    if (signal?.aborted || ratings.stopped) return pauseJobs(jobs, progress, notify);
    progress.phase = 'lists';
    for (const job of jobs) {
        job.attempts++;
        // 在发请求前即设置下一次检查时间；页面被关闭也能在后续加载中恢复。
        job.retryAt = Date.now() + Math.min(300000, 30000 * 2 ** Math.min(job.attempts - 1, 4));
        await persistProgress([job]);
        for (const item of job.items) {
            if (item.state !== 'pending') continue;
            if (signal?.aborted) return pauseJobs(jobs, progress, notify);
            const stored = readBatchListJobs().find((entry) => entry.id === job.id);
            if (stored?.items.find((entry) => entry.videoId === item.videoId)?.state === 'superseded') {
                item.state = 'superseded';
                progress.done++;
                progress.pending--;
                progress.superseded = (progress.superseded ?? 0) + 1;
                publish();
                continue;
            }
            progress.current = `${item.carNum} → ${job.list.name}（${job.desiredChecked ? '加入' : '移出'}）`;
            publish();
            try {
                const context = {
                    createdAt: job.createdAt,
                    route: item.route,
                    signal,
                    saveRoute: async (route: NonNullable<typeof item.route>): Promise<void> => {
                        item.route = { ...route, listIds: [...route.listIds] };
                        job.updatedAt = Date.now();
                        await persistProgress([job]);
                        observePause();
                    }
                };
                const outcome = await applyBatchListItem(item, job.list, job.desiredChecked, job.id, context);
                if (outcome === 'stopped') return pauseJobs(jobs, progress, notify);
                item.state = outcome === 'superseded' ? 'superseded' : 'success';
                item.error = '';
                job.updatedAt = Date.now();
                // 本地关联提交成功后，再将预写状态提升为成功并持久化。
                await persistProgress([job]);
                if (outcome === 'superseded') progress.superseded = (progress.superseded ?? 0) + 1;
                else progress.succeeded++;
                progress.pending--;
            } catch (error: unknown) {
                item.state = 'pending';
                item.error = error instanceof Error ? error.message : String(error);
                job.updatedAt = Date.now();
                await persistProgress([job]);
                progress.failed++;
                clog.error(`[批量清单] ${item.carNum} 未完成，已保留恢复记录：${item.error}`);
            }
            progress.done++;
            publish();
            if (progress.done < progress.total) await new Promise((resolve) => setTimeout(resolve, PACING_MS));
        }
    }
    if (signal?.aborted && jobs.some(isBatchListJobPending)) return pauseJobs(jobs, progress, notify);
    progress.phase = 'done';
    progress.current = progress.pending || progress.ratingFailed || progress.ratingPending ? '未完成项目已保留，将自动校验并继续执行'
        : progress.superseded ? '已完成校验；被后续操作替代的项目已跳过' : '网站与本地数据已同步完成';
    publish();
    return progress;
}
