/** 列表页评价后台队列及批量清单操作前的阻塞式补同步。 */
import { BATCH_RATING_SYNC_LOCK, FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import { normalizeCarNum } from '../../core/domain/car-num';
import { withExclusiveLock } from '../../core/sync/sync-lock';
import { siteSelector } from '../../core/util/site/selectors';

import { readServerReviewState } from '../detail-page-button/dpb-review-sync';
import {
    deleteReview, extractVideoId, fetchPageHtml, findReviewIdInHtml,
    postWantToWatch, postWatched
} from '../setting/jhs-sync/sync-common';
import {
    cancelOpSyncRecord, getOpSyncRecord, isCurrentOpSyncIntent, listOpSyncRecords, setOpSyncState, upsertOpSync, withStrictOpSyncPersistenceSync,
    type OpSyncKind, type OpSyncOrigin, type OpSyncRecord
} from '../setting/jhs-sync/op-sync-records';

export type BatchPushKind = 'favorite' | 'watched' | 'unwatch';
export interface BatchPushItem { carNum: string; url: string }
export interface BatchPushEntry extends BatchPushItem {
    kind: BatchPushKind;
    score: number;
    videoId: string;
    attempts: number;
    revision?: string;
    recordKind?: OpSyncKind;
    origin?: OpSyncOrigin;
}
export interface BatchSyncStatus {
    pending: number;
    succeeded: number;
    failed: number;
    scheduled: boolean;
}

const DEFAULT_PACING_MS = 900;
const MAX_ATTEMPTS = 2;
let pacingMs = DEFAULT_PACING_MS;
let queue: BatchPushEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let active: Promise<void> | null = null;
let activeEntry: BatchPushEntry | null = null;
const claimedScopes = new Set<(item: BatchPushItem) => boolean>();
const scopedExecutions = new Map<string, ReturnType<typeof executeEntry>>();
const stats = { succeeded: 0, failed: 0 };

/** 纯计划函数：URL 无法定位的项单独返回，不静默计为成功。 */
export function planBatchPush(items: BatchPushItem[], kind: BatchPushKind, score = 0): {
    entries: BatchPushEntry[]; skipped: string[];
} {
    const entries: BatchPushEntry[] = [];
    const skipped: string[] = [];
    for (const item of items) {
        const videoId = extractVideoId(item.url);
        if (!videoId) skipped.push(item.carNum);
        else entries.push({ carNum: item.carNum, url: item.url, kind, score, videoId, attempts: 0 });
    }
    return { entries, skipped };
}

/** 先登记持久化意图，再启动后台队列。清单补同步期间的新登记由排空循环接管。 */
export function enqueueBatchPush(
    items: BatchPushItem[], kind: BatchPushKind, score = 0,
    options?: { pacingMs?: number; origin?: OpSyncOrigin; recordKind?: OpSyncKind }
): number {
    if (options?.pacingMs !== undefined) pacingMs = options.pacingMs;
    const { entries, skipped } = planBatchPush(items, kind, score);
    for (const item of items) {
        const recordKind = options?.recordKind ?? kind;
        const record = upsertOpSync({ ...item, kind: recordKind, score, origin: options?.origin ?? 'list' });
        const entry = entries.find((candidate) => candidate.carNum === item.carNum);
        if (entry) {
            entry.revision = record.revision;
            entry.recordKind = recordKind;
            entry.origin = record.origin;
        } else {
            setOpSyncState(item.carNum, recordKind, 'failed', {
                error: '缺少 videoId，无法定位详情页', expectedRevision: record.revision
            });
        }
    }
    if (skipped.length) clog.warn(`[列表页批量操作] ${skipped.length} 项缺少 videoId: ${skipped.join(', ')}`);
    queue.push(...entries);
    if (entries.length) schedule(0);
    return entries.length;
}

export function getBatchSyncStatus(): BatchSyncStatus {
    return { pending: queue.length, ...stats, scheduled: timer !== null || active !== null };
}

/** 页面退出只清内存；未确认的账本记录保留供后续恢复。 */
export function stopBatchSync(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    queue = [];
    stats.succeeded = 0;
    stats.failed = 0;
}

export function resetBatchSyncForTest(): void {
    stopBatchSync();
    pacingMs = DEFAULT_PACING_MS;
}

function schedule(delay: number): void {
    if (timer !== null || active || !queue.some((entry) => !isClaimed(entry))) return;
    timer = setTimeout(() => {
        timer = null;
        active = step().finally(() => {
            active = null;
            activeEntry = null;
            if (queue.some((entry) => !isClaimed(entry))) schedule(pacingMs);
            else if (!queue.length) finish();
        });
    }, delay);
}

/** 发请求前重新读 GM；旧意图、用户取消和其他标签页已完成的项不重推。 */
function currentRecord(entry: BatchPushEntry): OpSyncRecord | null {
    const kind = entry.recordKind ?? entry.kind;
    const record = getOpSyncRecord(entry.carNum, kind);
    return record && isCurrentOpSyncIntent({ carNum: entry.carNum, kind, revision: entry.revision }) ? record : null;
}

/** 恢复旧账本以当前本地评价为准，避免重推已经过期的收藏或星级。 */
async function matchesLocal(record: OpSyncRecord): Promise<boolean> {
    storageManager.clearCarListCache();
    const car = await storageManager.getCar(record.carNum);
    if (record.kind === 'favorite') return car?.status === FAVORITE_ACTION;
    if (record.kind === 'watched') return car?.status === HAS_WATCH_ACTION && (car.score ?? 0) === record.score;
    if (record.kind === 'filter') return car?.status === FILTER_ACTION;
    return !car?.status;
}

/** 站点回读复用详情页原生评价解析器，HTTP 2xx 本身不计成功。 */
async function pushEntry(entry: BatchPushEntry, signal?: AbortSignal): Promise<'confirmed' | 'stopped'> {
    if (signal?.aborted) return 'stopped';
    if (entry.kind === 'favorite') await postWantToWatch(entry.videoId);
    else if (entry.kind === 'watched') await postWatched(entry.videoId, entry.score);
    else {
        const before = await fetchPageHtml(`/v/${entry.videoId}`);
        const reviewId = findReviewIdInHtml(before);
        // 获取 reviewId 属只读准备；停止后不能再启动删除这一新的站点写请求。
        if (signal?.aborted) return 'stopped';
        if (reviewId) await deleteReview(entry.videoId, reviewId);
    }
    const html = await fetchPageHtml(`/v/${entry.videoId}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.querySelector(siteSelector('detailReviewButtons'))) throw new Error('未取得有效的网站评价状态');
    const state = readServerReviewState(doc);
    const confirmed = entry.kind === 'favorite' ? state.want
        : entry.kind === 'watched' ? state.watched && state.score === entry.score
        : !state.want && !state.watched;
    if (!confirmed) throw new Error('网站回读尚未确认目标评价');
    return 'confirmed';
}

/** 后台队列和补同步共用跨标签页锁，旧回执按 revision 回绑。 */
async function executeEntry(entry: BatchPushEntry, checkLocal: boolean, signal?: AbortSignal): Promise<'success' | 'failed' | 'skipped' | 'stopped'> {
    return withExclusiveLock(BATCH_RATING_SYNC_LOCK, async () => {
        if (signal?.aborted) return 'stopped';
        const persist = <T,>(task: () => T): T => checkLocal ? withStrictOpSyncPersistenceSync(task) : task();
        const record = persist(() => currentRecord(entry));
        if (!record) return 'skipped';
        const localMatches = !checkLocal || await matchesLocal(record);
        if (signal?.aborted) return 'stopped';
        if (!localMatches) {
            persist(() => setOpSyncState(record.carNum, record.kind, 'cancelled', {
                error: '当前本地评价已变化，不再重推旧操作', expectedRevision: record.revision
            }));
            return 'skipped';
        }
        if (!persist(() => currentRecord(entry))) return 'skipped';
        if (signal?.aborted) return 'stopped';
        const patch = { attempts: entry.attempts, expectedRevision: entry.revision };
        if (!persist(() => setOpSyncState(record.carNum, record.kind, 'running', patch))) return 'skipped';
        try {
            const pushed = await pushEntry(entry, signal);
            if (pushed === 'stopped') {
                if (persist(() => currentRecord(entry))) {
                    persist(() => setOpSyncState(record.carNum, record.kind, 'pending', { ...patch, error: '' }));
                }
                return 'stopped';
            }
            if (!persist(() => currentRecord(entry))) return 'skipped';
            persist(() => setOpSyncState(record.carNum, record.kind, 'success', { ...patch, error: '' }));
            return 'success';
        } catch (error: unknown) {
            entry.attempts++;
            if (!persist(() => currentRecord(entry))) return 'skipped';
            const reason = error instanceof Error ? error.message : String(error);
            persist(() => setOpSyncState(record.carNum, record.kind, 'failed', {
                attempts: entry.attempts, expectedRevision: entry.revision, error: reason
            }));
            clog.warn(`[列表页批量操作] 同步未完成 ${record.carNum}: ${reason}`);
            return 'failed';
        }
    });
}

async function step(): Promise<void> {
    const index = queue.findIndex((entry) => !isClaimed(entry));
    if (index < 0) return;
    const [entry] = queue.splice(index, 1);
    activeEntry = entry;
    const result = await executeEntry(entry, false);
    if (result === 'success') stats.succeeded++;
    if (result === 'failed') {
        if (entry.attempts < MAX_ATTEMPTS) queue.push(entry);
        else stats.failed++;
    }
}

function finish(): void {
    if (stats.succeeded || stats.failed) {
        const message = `后台同步 JavDB 完成：成功 ${stats.succeeded} 项，失败 ${stats.failed} 项`;
        if (stats.failed) show.error(message); else show.ok(message);
    }
    stats.succeeded = 0;
    stats.failed = 0;
}

/**
 * 仅同步本次清单视频已有的未完成评价；其他视频保持后台异步。
 * 各调用独立接管目标范围，不合并不同清单任务；失败留账供同范围恢复。
 * 停止只阻止后续任务，不中止在途网络；total 仅计已处理项，stopped 表示仍需恢复。
 */
export function drainBatchRatings(
    targets: readonly BatchPushItem[],
    onProgress?: (done: number, total: number, failed: number) => void,
    signal?: AbortSignal
): Promise<{ total: number; succeeded: number; failed: number; stopped?: boolean }> {
    const matches = targetMatcher(targets);
    const taken: BatchPushEntry[] = [];
    claimedScopes.add(matches);
    const run = async () => {
        const handled = new Set<string>();
        const result = { total: 0, succeeded: 0, failed: 0 };
        if (signal?.aborted) return { ...result, stopped: true };
        if (!targets.length) return result;
        while (true) {
            if (signal?.aborted) return { ...result, stopped: true };
            const records = withStrictOpSyncPersistenceSync(() => listOpSyncRecords({ states: ['pending', 'running', 'failed'] }))
                .filter((record) => matches(record) && !handled.has(identity(record)))
                .sort((a, b) => (a.requestedAt ?? a.enqueuedAt) - (b.requestedAt ?? b.enqueuedAt));
            const record = records[0];
            if (!record) break;
            handled.add(identity(record));
            const kind = toBatchPushKind(record.kind);
            const entry: BatchPushEntry = {
                ...record, recordKind: record.kind, kind,
                videoId: extractVideoId(record.url) ?? '', attempts: 0
            };
            taken.push(...removeClaimedEntry(record));
            if (!withStrictOpSyncPersistenceSync(() => currentRecord(entry))) {
                if (wasConfirmed(record)) {
                    result.total++;
                    result.succeeded++;
                    onProgress?.(result.succeeded + result.failed, result.total + records.length - 1, result.failed);
                }
                continue;
            }
            result.total++;
            onProgress?.(result.succeeded + result.failed, result.total + records.length - 1, result.failed);
            let outcome: 'success' | 'failed' | 'skipped' | 'stopped' = 'stopped';
            // 只等待该版本目标的在途任务；无关 active 不整体等待。
            if (active && activeEntry && identity(activeEntry) === identity(record)) {
                await active;
                taken.push(...removeClaimedEntry(record));
                if (wasConfirmed(record)) outcome = 'success';
                else {
                    const latest = withStrictOpSyncPersistenceSync(() => getOpSyncRecord(record.carNum, record.kind));
                    if (latest?.revision === record.revision && latest?.state === 'failed') outcome = 'failed';
                }
            }
            do {
                if (signal?.aborted) break;
                if (!entry.videoId) {
                    outcome = 'failed';
                    withStrictOpSyncPersistenceSync(() => setOpSyncState(record.carNum, record.kind, 'failed', {
                        error: '缺少 videoId，无法定位详情页', expectedRevision: record.revision
                    }));
                    break;
                }
                const key = identity(record);
                let execution = scopedExecutions.get(key);
                if (!execution) {
                    execution = executeEntry(entry, true, signal).finally(() => scopedExecutions.delete(key));
                    scopedExecutions.set(key, execution);
                }
                outcome = await execution;
                if (outcome === 'skipped' && wasConfirmed(record)) outcome = 'success';
                if (outcome === 'failed') {
                    const latest = withStrictOpSyncPersistenceSync(() => getOpSyncRecord(record.carNum, record.kind));
                    if (latest && latest.revision === record.revision) entry.attempts = Math.max(entry.attempts, latest.attempts);
                }
                if (signal?.aborted) break;
                if (outcome === 'failed' && entry.attempts < MAX_ATTEMPTS) await pause(signal);
            } while ((outcome === 'failed' && entry.attempts < MAX_ATTEMPTS) || (outcome === 'stopped' && !signal?.aborted));
            if (outcome === 'success') result.succeeded++;
            else if (outcome === 'failed') result.failed++;
            else result.total--;
            onProgress?.(result.succeeded + result.failed, result.total + records.length - 1, result.failed);
            if (signal?.aborted) return { ...result, stopped: true };
            if (records.length > 1) await pause(signal);
        }
        return result;
    };
    return run().finally(() => {
        claimedScopes.delete(matches);
        // 只暂停清单的阻塞补同步；原本属于后台队列的未完成意图可继续后台执行。
        if (signal?.aborted) {
            for (const entry of taken) {
                const latest = getOpSyncRecord(entry.carNum, entry.recordKind ?? entry.kind);
                if (!latest || latest.revision !== entry.revision || latest.state === 'success' || latest.state === 'cancelled') continue;
                if (latest.state === 'failed' && latest.attempts >= MAX_ATTEMPTS) continue;
                if (!queue.some((queued) => identity(queued) === identity(entry))) {
                    queue.push({ ...entry, attempts: latest.attempts });
                }
            }
        }
        if (!queue.length && !active) finish();
        else schedule(0);
    });
}

/** 两侧都有网站 ID 时只认 ID；缺 ID 时才回退到统一的番号归一化口径。 */
function targetMatcher(targets: readonly BatchPushItem[]): (item: BatchPushItem) => boolean {
    const scope = targets.map((item) => ({ videoId: extractVideoId(item.url), carNum: normalizeCarNum(item.carNum) }));
    return (item) => {
        const videoId = extractVideoId(item.url);
        const carNum = normalizeCarNum(item.carNum);
        return scope.some((target) => target.videoId && videoId
            ? target.videoId === videoId : !!carNum && target.carNum === carNum);
    };
}

function isClaimed(entry: BatchPushEntry): boolean {
    return [...claimedScopes].some((matches) => matches(entry));
}

function removeClaimedEntry(record: OpSyncRecord): BatchPushEntry[] {
    const removed = queue.filter((entry) => identity(entry) === identity(record));
    queue = queue.filter((entry) => identity(entry) !== identity(record));
    return removed;
}

/** 目标可能在读取待办后由在途任务确认，仍应计入本轮成功且不重发。 */
function wasConfirmed(record: OpSyncRecord): boolean {
    const latest = withStrictOpSyncPersistenceSync(() => getOpSyncRecord(record.carNum, record.kind));
    return latest?.revision === record.revision && latest?.state === 'success';
}

function identity(record: Pick<OpSyncRecord, 'carNum' | 'kind' | 'revision' | 'score'> & { enqueuedAt?: number; recordKind?: OpSyncKind }): string {
    return `${record.carNum}::${record.recordKind ?? record.kind}::${record.revision ?? `${record.enqueuedAt}:${record.score}`}`;
}
function pause(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', finish);
            resolve();
        };
        const timer = setTimeout(finish, pacingMs);
        signal?.addEventListener('abort', finish, { once: true });
        if (signal?.aborted) finish();
    });
}

export function toBatchPushKind(kind: OpSyncKind): BatchPushKind {
    return kind === 'filter' ? 'watched' : kind;
}
export function retryOpSync(record: Pick<OpSyncRecord, 'carNum' | 'url' | 'kind' | 'score' | 'origin'>): boolean {
    return enqueueBatchPush([record], toBatchPushKind(record.kind), record.score, {
        origin: record.origin, recordKind: record.kind
    }) > 0;
}
export function retryFailedOpSync(): number {
    return listOpSyncRecords({ states: ['failed'] }).filter(retryOpSync).length;
}
export function cancelOpSync(carNum: string, kind: OpSyncKind): boolean {
    queue = queue.filter((entry) => entry.carNum !== carNum || (entry.recordKind ?? entry.kind) !== kind);
    return cancelOpSyncRecord(carNum, kind);
}
export function isOpSyncQueued(carNum: string, kind: OpSyncKind): boolean {
    return queue.some((entry) => entry.carNum === carNum && (entry.recordKind ?? entry.kind) === kind);
}
