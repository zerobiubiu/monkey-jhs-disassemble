import { normalizeBatchOperationConcurrency } from '../../../constants/batch-operations';
import type { BatchListJob, BatchListJournalItem, BatchListProgress } from '../../../types/batch-lists';
import { drainBatchRatings } from '../lp-batch-sync';
import { finishBatchRatings, prepareBatchRatings } from './ratings';
import { applyBatchListItem } from './site';
import { isBatchListItemPending, isBatchListJobPending, persistBatchListProgress, readBatchListJobs,
    setBatchListJobsPaused, syncBatchListItem, updateBatchListItemState } from './journal';
import { publishBatchListExecution } from './execution-state';

const PACING_MS = 900;
type Entry = { job: BatchListJob; item: BatchListJournalItem };
type Video = { id: string; entries: Entry[] };

export function emptyBatchListProgress(): BatchListProgress {
    return { total: 0, done: 0, succeeded: 0, failed: 0, pending: 0, superseded: 0,
        phase: 'lists', current: '', ratingTotal: 0, ratingDone: 0, ratingFailed: 0, ratingPending: 0 };
}

function videosForJobs(jobs: readonly BatchListJob[]): Video[] {
    const videos = new Map<string, Video>();
    for (const job of jobs) for (const item of job.items) {
        if (!isBatchListItemPending(item) && item.state !== 'superseded') continue;
        let video = videos.get(item.videoId);
        if (!video) { video = { id: item.videoId, entries: [] }; videos.set(video.id, video); }
        video.entries.push({ job, item });
    }
    return [...videos.values()];
}

export function progressForBatchListJobs(jobs: readonly BatchListJob[]): BatchListProgress {
    const videos = videosForJobs(jobs);
    const superseded = videos.filter((video) => video.entries.every(({ item }) => !isBatchListItemPending(item))).length;
    return { ...emptyBatchListProgress(), total: videos.length, done: superseded, superseded,
        pending: videos.length - superseded,
        ratingPending: videos.filter((video) => video.entries.some(({ item }) => !item.ratingsComplete)).length };
}

export async function pauseBatchListJobs(jobs: BatchListJob[], progress: BatchListProgress,
    notify: (progress: BatchListProgress) => void): Promise<BatchListProgress> {
    const fresh = await setBatchListJobsPaused(new Set(jobs.map((job) => job.id)), true);
    const remaining = progressForBatchListJobs(fresh);
    const stopped: BatchListProgress = { ...progress, pending: remaining.pending, ratingPending: remaining.ratingPending,
        stopped: true, phase: 'done', current: '已停止执行，未完成记录已保留；点击继续执行后恢复' };
    notify(stopped);
    return stopped;
}

/** 每个槽位独占一个视频，先结算评价，再逐项执行其清单；同视频的多个恢复任务也不会并跑。 */
export async function executeBatchListJobs(jobs: BatchListJob[], notify: (progress: BatchListProgress) => void,
    signal?: AbortSignal): Promise<BatchListProgress> {
    const videos = videosForJobs(jobs);
    if (!videos.length) return { ...emptyBatchListProgress(), phase: 'done' };
    const controller = new AbortController();
    const stop = (): void => controller.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const execution = publishBatchListExecution(jobs);
    const publish = (progress: BatchListProgress): void => { execution.update(progress); notify(progress); };
    const observePause = (): void => {
        if (signal?.aborted || readBatchListJobs().some((job) => job.paused && jobs.some((entry) => entry.id === job.id))) stop();
    };
    try {
        observePause();
        if (controller.signal.aborted) return await pauseBatchListJobs(jobs, progressForBatchListJobs(jobs), publish);
        return await runWorkers(jobs, videos, publish, controller, observePause);
    } finally {
        signal?.removeEventListener('abort', stop);
        execution.close();
    }
}

async function runWorkers(jobs: BatchListJob[], videos: Video[], notify: (progress: BatchListProgress) => void,
    controller: AbortController, observePause: () => void): Promise<BatchListProgress> {
    const concurrency = Math.min(videos.length, normalizeBatchOperationConcurrency(await storageManager.getSetting('batchOperationConcurrency')));
    const progress = { ...progressForBatchListJobs(jobs), concurrency };
    const completed = new Set<string>();
    const failed = new Set<string>();
    const ratings = new Map<BatchListJournalItem, { total: number; done: number; failed: number }>();
    const signal = controller.signal;
    let cursor = 0;
    let executionFailed = false;
    const publish = (): void => {
        progress.done = 0; progress.succeeded = 0; progress.failed = 0; progress.pending = 0; progress.superseded = 0;
        progress.ratingPending = 0; progress.ratingTotal = 0; progress.ratingDone = 0; progress.ratingFailed = 0;
        for (const video of videos) {
            const pending = video.entries.some(({ item }) => isBatchListItemPending(item));
            if (completed.has(video.id) || !pending) progress.done++;
            if (pending) { progress.pending++; if (failed.has(video.id)) progress.failed++; }
            else if (video.entries.every(({ item }) => item.state === 'superseded')) progress.superseded++;
            else progress.succeeded++;
            if (video.entries.some(({ item }) => !item.ratingsComplete)) progress.ratingPending++;
        }
        for (const rating of ratings.values()) {
            progress.ratingTotal += rating.total; progress.ratingDone += rating.done; progress.ratingFailed += rating.failed;
        }
        observePause();
        notify({ ...progress });
    };
    const refresh = ({ job, item }: Entry): void => {
        const stored = readBatchListJobs().find((entry) => entry.id === job.id)?.items.find((entry) => entry.videoId === item.videoId);
        if (!stored) throw new Error('视频恢复记录丢失，已停止执行');
        syncBatchListItem(item, stored);
        observePause();
    };
    const process = async (entry: Entry): Promise<void> => {
        const { job, item } = entry;
        const persist = async (): Promise<void> => {
            job.updatedAt = Date.now();
            updateBatchListItemState(item);
            await persistBatchListProgress(job, [item]);
            observePause();
        };
        refresh(entry);
        if (signal.aborted || executionFailed || !isBatchListItemPending(item)) return;
        item.error = '';
        if (!item.ratingsComplete) {
            progress.phase = 'ratings';
            progress.current = `${item.carNum}：确认评价后执行所选清单`;
            publish();
            try {
                if (job.rating) await prepareBatchRatings(job, persist, signal, [item]);
                if (signal.aborted || executionFailed) return;
                const result = await drainBatchRatings([item], (done, total, count) => {
                    ratings.set(item, { done, total, failed: count }); publish();
                }, signal);
                ratings.set(item, { total: result.total, done: result.succeeded + result.failed, failed: result.failed });
                if (job.rating) await finishBatchRatings(job, persist, [item]);
                item.ratingsComplete = !result.stopped && result.failed === 0 &&
                    (!job.rating || item.rating?.phase === 'success' || item.rating?.phase === 'superseded');
                if (!item.ratingsComplete && !result.stopped) { failed.add(item.videoId); item.error = '评价尚未确认'; }
                await persist();
                if (result.stopped) controller.abort();
                publish();
            } catch (error: unknown) {
                item.error = error instanceof Error ? error.message : String(error);
                failed.add(item.videoId);
                await persist();
                clog.error(`[批量清单] ${item.carNum} 评价未完成，已保留恢复记录：${item.error}`);
                return;
            }
        }
        for (const operation of item.operations) {
            refresh(entry);
            if (signal.aborted || executionFailed) return;
            if (operation.state !== 'pending') continue;
            const list = job.lists.find((choice) => choice.id === operation.listId);
            if (!list) throw new Error('缺少已预写的目标清单，已停止网站请求');
            progress.phase = 'lists';
            progress.current = `${item.carNum} → ${list.name}（${job.desiredChecked ? '加入' : '移出'}）`;
            publish();
            try {
                const outcome = await applyBatchListItem(item, list, job.desiredChecked, job.id, {
                    createdAt: job.createdAt, route: operation.route, signal,
                    saveRoute: async (route) => {
                        operation.route = { ...route, listIds: [...route.listIds] };
                        await persist();
                    }
                });
                if (outcome === 'stopped') { controller.abort(); return; }
                operation.state = outcome === 'superseded' ? 'superseded' : 'success';
                operation.error = '';
                item.error = item.operations.filter((op) => op.state === 'pending').map((op) => op.error).filter(Boolean).join('；') ||
                    (item.ratingsComplete ? '' : item.error);
                await persist();
            } catch (error: unknown) {
                operation.state = 'pending';
                operation.error = error instanceof Error ? error.message : String(error);
                item.error = item.operations.filter((op) => op.state === 'pending').map((op) => op.error).filter(Boolean).join('；');
                failed.add(item.videoId);
                await persist();
                clog.error(`[批量清单] ${item.carNum} → ${list.name} 未完成，已保留恢复记录：${operation.error}`);
            }
            publish();
        }
    };
    for (const job of jobs) {
        if (!isBatchListJobPending(job)) continue;
        job.attempts++;
        job.retryAt = Date.now() + Math.min(300000, 30000 * 2 ** Math.min(job.attempts - 1, 4));
        await persistBatchListProgress(job);
    }
    publish();
    const worker = async (): Promise<void> => {
        try {
            while (!signal.aborted && !executionFailed && cursor < videos.length) {
                const video = videos[cursor++];
                for (const entry of video.entries) {
                    if (signal.aborted || executionFailed) break;
                    await process(entry);
                }
                if ((!signal.aborted && !executionFailed) || video.entries.every(({ item }) => !isBatchListItemPending(item))) completed.add(video.id);
                publish();
                if (!signal.aborted && !executionFailed && cursor < videos.length) {
                    await new Promise<void>((resolve) => {
                        const finish = (): void => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
                        const timer = setTimeout(finish, PACING_MS);
                        signal.addEventListener('abort', finish, { once: true });
                        if (signal.aborted) finish();
                    });
                }
            }
        } catch (error: unknown) { executionFailed = true; throw error; }
    };
    // 单个日志写入失败也必须等待其他已发请求结算，不能提前释放跨页执行锁。
    const outcomes = await Promise.allSettled(Array.from({ length: concurrency }, worker));
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    if (rejected?.status === 'rejected') throw rejected.reason;
    if (signal.aborted && jobs.some(isBatchListJobPending)) return pauseBatchListJobs(jobs, progress, notify);
    progress.phase = 'done';
    progress.current = progress.pending ? '未完成项目已保留，将自动校验并继续执行'
        : progress.superseded ? '已完成校验；被后续操作替代的项目已跳过' : '网站与本地数据已同步完成';
    publish();
    return { ...progress };
}
