import { withExclusiveLock } from '../../../core/sync';
import type { BatchListChoice, BatchListItem, BatchListJob, BatchListJournalItem, BatchListJournalOperation,
    BatchListRoute, BatchRatingChoice, BatchRatingIntent } from '../../../types/batch-lists';

const KEY_PREFIX = 'jhs:batch-list-journal:';
type LegacyItem = BatchListItem & Pick<BatchListJournalItem, 'state' | 'error' | 'rating'> & { route?: BatchListRoute };
type LegacyJob = Omit<BatchListJob, 'version' | 'lists' | 'items'> & { version: 1; list: BatchListChoice; items: LegacyItem[] };

function storageKey(): string { return KEY_PREFIX + window.location.origin; }

export async function withBatchListJournalLock<T>(work: () => Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
        throw new Error('当前浏览器不支持 Web Locks，无法安全执行可恢复的批量清单操作');
    }
    return withExclusiveLock(storageKey(), work);
}

/** 不使用内存缓存：持锁后必须看到另一个标签页刚提交的日志。旧格式仅在读取边界转换。 */
export function readBatchListJobs(): BatchListJob[] {
    if (typeof GM_getValue !== 'function') throw new Error('无法读取批量清单恢复日志');
    const raw: unknown = GM_getValue(storageKey(), null);
    if (raw === null) return [];
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || !parsed.every((entry) => isJob(entry) || isLegacyJob(entry)) ||
        new Set(parsed.map((entry: BatchListJob | LegacyJob) => entry.id)).size !== parsed.length) {
        throw new Error('批量清单恢复日志损坏，已停止写入以保留原始记录');
    }
    return parsed.map((entry: BatchListJob | LegacyJob): BatchListJob => {
        if (entry.version === 2) return entry;
        const { list, items, ...job } = entry;
        return { ...job, version: 2, lists: [list], items: items.map(({ route, ...item }) => ({
            ...item, ratingsComplete: job.ratingsComplete,
            operations: [{ listId: list.id, state: item.state, error: item.error, ...(route ? { route } : {}) }]
        })) };
    });
}

/** 写后回读；未能可靠持久化时抛错，调用方不得继续网站请求。 */
export function writeBatchListJobs(jobs: BatchListJob[]): void {
    if (typeof GM_setValue !== 'function') throw new Error('无法保存批量清单恢复日志');
    if (!jobs.every(isJob)) throw new Error('批量清单日志状态不完整，已停止写入');
    const payload = JSON.stringify(jobs);
    GM_setValue(storageKey(), payload);
    if (GM_getValue(storageKey(), null) !== payload) throw new Error('批量清单预写日志回读不一致，已停止执行');
}

export function isBatchListItemPending(item: BatchListJournalItem): boolean {
    return !item.ratingsComplete || item.operations.some((operation) => operation.state === 'pending');
}

export function isBatchListJobPending(job: BatchListJob): boolean { return job.items.some(isBatchListItemPending); }

export function updateBatchListItemState(item: BatchListJournalItem): void {
    item.state = item.operations.some((operation) => operation.state === 'pending') ? 'pending'
        : item.operations.every((operation) => operation.state === 'superseded') ? 'superseded' : 'success';
    if (!isBatchListItemPending(item)) item.error = '';
}

/** 合并单视频进度；其他 worker、后续任务的替代标记和暂停指令均以最新持久状态为准。 */
export async function persistBatchListProgress(job: BatchListJob, items: readonly BatchListJournalItem[] = []): Promise<void> {
    await withBatchListJournalLock(async () => {
        const current = readBatchListJobs();
        const stored = current.find((entry) => entry.id === job.id);
        if (!stored) throw new Error('任务恢复日志丢失，已停止执行');
        stored.updatedAt = Math.max(stored.updatedAt, job.updatedAt);
        stored.attempts = Math.max(stored.attempts, job.attempts);
        stored.retryAt = Math.max(stored.retryAt, job.retryAt);
        for (const item of items) {
            const index = stored.items.findIndex((entry) => entry.videoId === item.videoId);
            if (index < 0) throw new Error('视频恢复记录丢失，已停止执行');
            const previous = stored.items[index];
            const merged = { ...item, operations: item.operations.map((operation) => {
                const old = previous.operations.find((entry) => entry.listId === operation.listId);
                if (!old) throw new Error('清单恢复记录丢失，已停止执行');
                return old.state === 'superseded' || (old.state === 'success' && operation.state === 'pending')
                    ? { ...old } : { ...operation };
            }) };
            if (previous.rating && ['success', 'superseded'].includes(previous.rating.phase)) merged.rating = previous.rating;
            merged.ratingsComplete = previous.ratingsComplete || item.ratingsComplete;
            updateBatchListItemState(merged);
            stored.items[index] = merged;
        }
        stored.ratingsComplete = stored.items.every((item) => item.ratingsComplete);
        writeBatchListJobs(current);
        job.paused = stored.paused;
        job.pauseRevision = stored.pauseRevision;
        job.ratingsComplete = stored.ratingsComplete;
        for (const item of items) syncBatchListItem(item, stored.items.find((entry) => entry.videoId === item.videoId)!);
    });
}

/** 保留执行中的对象身份，评价准备与路由回调不会持有被替换的旧引用。 */
export function syncBatchListItem(item: BatchListJournalItem, stored: BatchListJournalItem): void {
    item.state = stored.state;
    item.error = stored.error;
    item.ratingsComplete = stored.ratingsComplete;
    if (item.rating && stored.rating) Object.assign(item.rating, stored.rating);
    for (const operation of item.operations) {
        const fresh = stored.operations.find((entry) => entry.listId === operation.listId);
        if (fresh) Object.assign(operation, fresh);
    }
}

/** 仅更新暂停指令；较早排队的继续不能清除较新的跨页停止。 */
export async function setBatchListJobsPaused(ids: ReadonlySet<string>, paused: boolean, options: {
    signal?: AbortSignal; expectedRevisions?: ReadonlyMap<string, number>; newIntent?: boolean
} = {}): Promise<BatchListJob[]> {
    return withBatchListJournalLock(async () => {
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
    });
}

export function isBatchListChoice(value: unknown): value is BatchListChoice {
    if (!value || typeof value !== 'object') return false;
    const choice = value as Partial<BatchListChoice>;
    if (typeof choice.id !== 'string' || !choice.id.trim() || typeof choice.name !== 'string' ||
        !choice.name.trim() || typeof choice.url !== 'string') return false;
    if (choice.members !== undefined && (!Array.isArray(choice.members) || !choice.members.every((member) =>
        member && typeof member.id === 'string' && !!member.id.trim() && typeof member.name === 'string' &&
        !!member.name.trim() && Number.isSafeInteger(member.num) && member.num >= 0))) return false;
    if (choice.group !== undefined) {
        const group = choice.group;
        if (!group || typeof group.base !== 'string' || !group.base.trim() || typeof group.pattern !== 'string' ||
            !Array.isArray(group.excludeNames) || !group.excludeNames.every((name) => typeof name === 'string') ||
            !choice.members?.length) return false;
        try { new RegExp(group.pattern); } catch { return false; }
    }
    return true;
}

function isRoute(value: unknown): value is BatchListRoute {
    if (!value || typeof value !== 'object') return false;
    const route = value as Partial<BatchListRoute>;
    return Array.isArray(route.listIds) && route.listIds.every((id) => typeof id === 'string' && !!id.trim()) &&
        (route.createName === undefined || (typeof route.createName === 'string' && !!route.createName.trim())) &&
        (route.createAttempted === undefined || typeof route.createAttempted === 'boolean') &&
        (route.uncertain === undefined || typeof route.uncertain === 'boolean') &&
        (!route.createAttempted || !!route.createName) && (!route.uncertain || route.listIds.length > 0 || !!route.createName);
}

function hasJobFields(job: Partial<BatchListJob> | Partial<LegacyJob>): boolean {
    return typeof job.id === 'string' && !!job.id && job.origin === window.location.origin &&
        typeof job.desiredChecked === 'boolean' && Number.isFinite(job.createdAt) && Number.isFinite(job.updatedAt) &&
        Number.isFinite(job.retryAt) && Number.isInteger(job.attempts) && (job.attempts ?? -1) >= 0 &&
        typeof job.ratingsComplete === 'boolean' && (job.rating === undefined || isBatchRatingChoice(job.rating)) &&
        (job.paused === undefined || typeof job.paused === 'boolean') &&
        (job.pauseRevision === undefined || (Number.isSafeInteger(job.pauseRevision) && job.pauseRevision >= 0));
}

function hasItemFields(value: unknown, rating: BatchRatingChoice | undefined): value is LegacyItem {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<LegacyItem>;
    return typeof item.carNum === 'string' && !!item.carNum.trim() && typeof item.url === 'string' &&
        typeof item.videoId === 'string' && /^[\w-]+$/.test(item.videoId) && item.url.includes('/v/' + item.videoId) &&
        typeof item.error === 'string' && ['pending', 'success', 'superseded'].includes(item.state ?? '') &&
        (item.publishTime === undefined || typeof item.publishTime === 'string') &&
        (item.names === undefined || typeof item.names === 'string') &&
        (rating ? isRatingIntent(item.rating) : item.rating === undefined);
}

function isOperation(value: unknown): value is BatchListJournalOperation {
    if (!value || typeof value !== 'object') return false;
    const operation = value as Partial<BatchListJournalOperation>;
    return typeof operation.listId === 'string' && !!operation.listId.trim() && typeof operation.error === 'string' &&
        ['pending', 'success', 'superseded'].includes(operation.state ?? '') &&
        (operation.route === undefined || isRoute(operation.route));
}

function isJob(value: unknown): value is BatchListJob {
    if (!value || typeof value !== 'object') return false;
    const job = value as Partial<BatchListJob>;
    if (job.version !== 2 || !hasJobFields(job) || !Array.isArray(job.lists) || !job.lists.length ||
        !job.lists.every(isBatchListChoice) || new Set(job.lists.map((list) => list.id)).size !== job.lists.length ||
        !Array.isArray(job.items) || !job.items.length) return false;
    const ids = new Set(job.lists.map((list) => list.id));
    return new Set(job.items.map((item) => item?.videoId)).size === job.items.length && job.items.every((item) => {
        if (!hasItemFields(item, job.rating) || typeof item.ratingsComplete !== 'boolean' || !Array.isArray(item.operations) ||
            item.operations.length !== ids.size || !item.operations.every(isOperation) ||
            new Set(item.operations.map((operation) => operation.listId)).size !== ids.size ||
            !item.operations.every((operation) => ids.has(operation.listId))) return false;
        const state = item.operations.some((operation) => operation.state === 'pending') ? 'pending'
            : item.operations.every((operation) => operation.state === 'superseded') ? 'superseded' : 'success';
        return item.state === state && (!item.ratingsComplete || !job.rating || ['success', 'superseded'].includes(item.rating!.phase));
    }) && job.ratingsComplete === job.items.every((item) => item.ratingsComplete);
}

function isLegacyJob(value: unknown): value is LegacyJob {
    if (!value || typeof value !== 'object') return false;
    const job = value as Partial<LegacyJob>;
    return job.version === 1 && hasJobFields(job) && isBatchListChoice(job.list) &&
        Array.isArray(job.items) && job.items.length > 0 && new Set(job.items.map((item) => item?.videoId)).size === job.items.length &&
        job.items.every((item) => hasItemFields(item, job.rating) && (item.route === undefined || isRoute(item.route)) &&
            (!job.ratingsComplete || !job.rating || ['success', 'superseded'].includes(item.rating!.phase)));
}

export function isBatchRatingChoice(value: unknown): value is BatchRatingChoice {
    if (!value || typeof value !== 'object') return false;
    const rating = value as Partial<BatchRatingChoice>;
    return (rating.kind === 'favorite' || rating.kind === 'watched') && Number.isInteger(rating.score) &&
        (rating.score ?? -1) >= 0 && (rating.score ?? 6) <= 5 && (rating.kind !== 'favorite' || rating.score === 0);
}

function isRatingIntent(value: unknown): value is BatchRatingIntent {
    if (!value || typeof value !== 'object') return false;
    const intent = value as Partial<BatchRatingIntent>;
    return typeof intent.revision === 'string' && !!intent.revision && Number.isSafeInteger(intent.requestedAt) && (intent.requestedAt ?? -1) >= 0 &&
        typeof intent.baseline === 'string' && !!intent.before && typeof intent.before.status === 'string' &&
        typeof intent.before.score === 'number' && Number.isFinite(intent.before.score) &&
        ['pending', 'applying', 'registered', 'success', 'superseded'].includes(intent.phase ?? '');
}
