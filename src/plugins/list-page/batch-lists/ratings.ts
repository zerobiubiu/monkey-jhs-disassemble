/** 组合评价的本地准备与回执交接；只入账，不启动后台网络队列。 */
import { BATCH_RATING_SYNC_LOCK, FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../../constants/status';

import { carNumEquals, normalizeCarNum } from '../../../core/domain/car-num';
import { featureFlags } from '../../../core/feature-flags';
import { withExclusiveLock } from '../../../core/sync/sync-lock';
import { saveCarListGuarded } from '../../../core/storage/car-list-ops';
import type { CarRecord } from '../../../core/storage/car-list-ops';

import type { BatchListItem, BatchListJob, BatchListJournalItem, BatchRatingChoice, BatchRatingIntent } from '../../../types/batch-lists';

import { planFavoriteBatch, planWatchedBatch } from '../lp-batch-state';
import {
    ensureOpSync, listOpSyncRecords, releaseRetainedOpSync, setOpSyncState, withStrictOpSyncPersistenceSync,
    type OpSyncRecord
} from '../../setting/jhs-sync/op-sync-records';
import { extractVideoId } from '../../setting/jhs-sync/sync-common';
import { readBatchListJobs } from './journal';

function strictRows(): OpSyncRecord[] {
    return withStrictOpSyncPersistenceSync(() => listOpSyncRecords());
}

function sameVideo(item: BatchListItem, record: OpSyncRecord): boolean {
    const videoId = extractVideoId(record.url);
    return videoId ? videoId === item.videoId : normalizeCarNum(record.carNum) === normalizeCarNum(item.carNum);
}

/** 排除推送进度字段；同一意图从 pending 变 success 不是新的用户评价。 */
function signature(item: BatchListItem, rows: OpSyncRecord[]): string {
    return JSON.stringify(rows.filter((row) => sameVideo(item, row)).map((row) =>
        [row.carNum, row.kind, row.revision ?? '', row.requestedAt ?? row.enqueuedAt, row.score, row.url])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

/** 旧历史被容量淘汰或清理不会构成新评价；只允许删除旧身份，拒绝新增或改变身份。 */
function matchesBaseline(item: BatchListJournalItem, rows: OpSyncRecord[], baseline: string): boolean {
    const previous: unknown = JSON.parse(baseline);
    if (!Array.isArray(previous) || !previous.every((row: unknown) => Array.isArray(row) && row.length === 6 &&
        typeof row[0] === 'string' && typeof row[1] === 'string' && typeof row[2] === 'string' &&
        typeof row[3] === 'number' && Number.isFinite(row[3]) && typeof row[4] === 'number' && typeof row[5] === 'string')) {
        throw new Error('组合评价意图基线损坏');
    }
    const allowed = new Set(previous.map((row) => JSON.stringify(row)));
    const predecessors = readBatchListJobs();
    return rows.filter((row) => sameVideo(item, row)).every((row) =>
        allowed.has(JSON.stringify([row.carNum, row.kind, row.revision ?? '', row.requestedAt ?? row.enqueuedAt, row.score, row.url])) ||
        !!earlierCombo(item, row, predecessors));
}

function valueOf(car: CarRecord | undefined): BatchRatingIntent['before'] {
    return { status: car?.status ?? '', score: typeof car?.score === 'number' ? car.score : 0 };
}

async function localValue(item: BatchListItem): Promise<BatchRatingIntent['before']> {
    storageManager.clearCarListCache();
    return valueOf(await storageManager.getCar(item.carNum) as CarRecord | undefined);
}

function targetMatches(value: BatchRatingIntent['before'], rating: BatchRatingChoice): boolean {
    return rating.kind === 'favorite' ? value.status === FAVORITE_ACTION
        : value.status === HAS_WATCH_ACTION && value.score === rating.score;
}

/** 只有真实任务日志与稳定账本身份、顺序和值同时相符，才允许后点击的组合任务覆盖前序。 */
function earlierCombo(item: BatchListJournalItem, record: OpSyncRecord, jobs: BatchListJob[]): BatchRatingChoice | undefined {
    if (!sameVideo(item, record)) return undefined;
    for (const job of jobs) {
        if (!job.rating || job.rating.kind !== record.kind || record.score !== (job.rating.kind === 'favorite' ? 0 : job.rating.score)) continue;
        const prior = job.items.find((candidate) => candidate.videoId === item.videoId && candidate.rating?.revision === record.revision);
        if (prior?.rating && prior.rating.requestedAt === record.requestedAt &&
            prior.rating.requestedAt < (item.rating?.requestedAt ?? 0)) return job.rating;
    }
    return undefined;
}

function matchesEarlierLocal(item: BatchListJournalItem, value: BatchRatingIntent['before'], rows: OpSyncRecord[]): boolean {
    const jobs = readBatchListJobs();
    return rows.some((row) => {
        const prior = earlierCombo(item, row, jobs);
        return prior && targetMatches(value, prior);
    });
}

function beforeMatches(left: BatchRatingIntent['before'], right: BatchRatingIntent['before']): boolean {
    return left.status === right.status && left.score === right.score;
}

function ownRecord(item: BatchListJournalItem, rating: BatchRatingChoice, rows: OpSyncRecord[]): OpSyncRecord | undefined {
    return rows.find((row) => row.kind === rating.kind && row.revision === item.rating?.revision && sameVideo(item, row));
}

function hasNewer(item: BatchListJournalItem, rows: OpSyncRecord[]): boolean {
    return rows.some((row) => sameVideo(item, row) && row.revision !== item.rating?.revision &&
        (row.requestedAt ?? row.enqueuedAt) >= (item.rating?.requestedAt ?? 0));
}

export async function captureBatchRating(item: BatchListItem, revision: string, startedAt = Date.now()): Promise<BatchRatingIntent> {
    if (!revision.trim()) throw new Error('缺少组合评价稳定身份');
    // 所有目标均在第一次 await 前捕获同批点击的基线，不能把后项的慢读取当成新意图。
    const rows = strictRows();
    const baseline = signature(item, rows);
    const requestedAt = rows.reduce((latest, row) => Math.max(latest, row.requestedAt ?? row.enqueuedAt), startedAt) + 1;
    if (!Number.isSafeInteger(requestedAt)) throw new Error('组合评价登记时间无效');
    const before = await localValue(item);
    return { revision, requestedAt, baseline, before, phase: 'pending' };
}

async function applyLocal(
    item: BatchListJournalItem, rating: BatchRatingChoice, current: BatchRatingIntent['before'], signal?: AbortSignal
): Promise<boolean> {
    const info = new Map([[item.carNum.trim().toLowerCase(), { ...item }]]);
    const plan = rating.kind === 'favorite'
        ? planFavoriteBatch([item.carNum], info, current.status === FAVORITE_ACTION ? [item.carNum] : [])
        : planWatchedBatch([item.carNum], info, rating.score);
    if (plan.missing.length) throw new Error('缺少组合评价的视频信息');
    return saveCarListGuarded(storageManager, targetMatches(current, rating) ? [] : plan.inputs, (records: readonly CarRecord[]) => {
        if (signal?.aborted) return false;
        const fresh = valueOf(records.find((record) => carNumEquals(record.carNum, item.carNum, featureFlags.caseInsensitiveCarNum)));
        const rows = strictRows();
        return !hasNewer(item, rows) && matchesBaseline(item, rows, item.rating!.baseline) &&
            (beforeMatches(fresh, item.rating!.before) || targetMatches(fresh, rating) || matchesEarlierLocal(item, fresh, rows));
    });
}

/** 完整组合任务已经预写后调用；每次恢复均先检查原始基线，不重放后来已改变的评价。 */
export async function prepareBatchRatings(job: BatchListJob, persist: () => Promise<void>, signal?: AbortSignal): Promise<void> {
    const rating = job.rating;
    if (!rating) return;
    if (!['favorite', 'watched'].includes(rating.kind) || !Number.isInteger(rating.score) || rating.score < 0 || rating.score > 5) {
        throw new Error('组合评价类型或星级无效');
    }
    for (const item of job.items) {
        if (signal?.aborted) return;
        await withExclusiveLock(BATCH_RATING_SYNC_LOCK, async () => {
            if (signal?.aborted) return;
            const intent = item.rating;
            if (!intent) throw new Error('组合评价完整预写记录缺失，尚未修改本地评价');
            if (intent.phase === 'success' || intent.phase === 'superseded') return;
            const supersede = async (): Promise<void> => { intent.phase = 'superseded'; await persist(); };
            let rows = strictRows();
            const own = ownRecord(item, rating, rows);
            if (hasNewer(item, rows)) { await supersede(); return; }
            const current = await localValue(item);
            if (own) {
                if (own.requestedAt !== intent.requestedAt || own.score !== (rating.kind === 'favorite' ? 0 : rating.score)) {
                    throw new Error('组合评价稳定身份不能复用为不同操作');
                }
                if (!targetMatches(current, rating) || own.state === 'cancelled') {
                    withStrictOpSyncPersistenceSync(() => setOpSyncState(own.carNum, own.kind, 'cancelled', {
                        error: '当前本地评价已变化，不再恢复旧组合评价', expectedRevision: own.revision
                    }));
                    await supersede(); return;
                }
                intent.phase = own.state === 'success' ? 'success' : 'registered';
                await persist(); return;
            }
            if (intent.phase === 'registered') return; // 已入账的身份不能因为记录暂不可读而重新创建。
            const unchanged = beforeMatches(current, intent.before) || matchesEarlierLocal(item, current, rows);
            const resumable = intent.phase === 'applying' && targetMatches(current, rating);
            if (!matchesBaseline(item, rows, intent.baseline) || (!unchanged && !resumable)) { await supersede(); return; }
            if (signal?.aborted) return;
            intent.phase = 'applying';
            await persist();
            if (signal?.aborted) return;
            // applying 落盘后再读一次，避免等待任务日志期间出现后续评价。
            rows = strictRows();
            const fresh = await localValue(item);
            if (!matchesBaseline(item, rows, intent.baseline) ||
                (!beforeMatches(fresh, intent.before) && !targetMatches(fresh, rating) && !matchesEarlierLocal(item, fresh, rows))) {
                await supersede(); return;
            }
            if (signal?.aborted) return;
            const applied = await applyLocal(item, rating, fresh, signal);
            if (!applied) {
                if (signal?.aborted) return;
                await supersede(); return;
            }
            rows = strictRows();
            if (!matchesBaseline(item, rows, intent.baseline)) { await supersede(); return; }
            const registered = withStrictOpSyncPersistenceSync(() => ensureOpSync({
                carNum: item.carNum, url: item.url, kind: rating.kind, score: rating.kind === 'favorite' ? 0 : rating.score,
                revision: intent.revision, requestedAt: intent.requestedAt, origin: 'list'
            }));
            intent.phase = registered ? 'registered' : 'superseded';
            await persist();
        });
    }
}

/** 先将逐条回执交接到组合日志，再释放账本保留，避免大批任务被容量淘汰丢失成功证据。 */
export async function finishBatchRatings(job: BatchListJob, persist: () => Promise<void>): Promise<void> {
    if (!job.rating) return;
    for (const item of job.items) {
        const intent = item.rating;
        if (!intent || intent.phase === 'success' || intent.phase === 'superseded') continue;
        const rows = strictRows();
        const own = ownRecord(item, job.rating, rows);
        if (hasNewer(item, rows) || own?.state === 'cancelled') intent.phase = 'superseded';
        else if (own?.state === 'success') intent.phase = 'success';
    }
    await persist();
    for (const item of job.items) {
        if (!item.rating || !['success', 'superseded'].includes(item.rating.phase)) continue;
        withStrictOpSyncPersistenceSync(() => releaseRetainedOpSync({
            carNum: item.carNum, kind: job.rating!.kind, revision: item.rating!.revision
        }));
    }
}
