import type { BatchListChoice, BatchListJob, BatchListRoute, BatchRatingChoice, BatchRatingIntent } from '../../../types/batch-lists';

const KEY_PREFIX = 'jhs:batch-list-journal:';

function storageKey(): string {
    return KEY_PREFIX + window.location.origin;
}

/** 不使用内存缓存：持锁后必须看到另一个标签页刚提交的日志。 */
export function readBatchListJobs(): BatchListJob[] {
    if (typeof GM_getValue !== 'function') throw new Error('无法读取批量清单恢复日志');
    const raw: unknown = GM_getValue(storageKey(), null);
    if (raw === null) return [];
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || !parsed.every(isJob)) {
        throw new Error('批量清单恢复日志损坏，已停止写入以保留原始记录');
    }
    return parsed;
}

/** 写后回读；未能可靠持久化时抛错，调用方不得继续网站请求。 */
export function writeBatchListJobs(jobs: BatchListJob[]): void {
    if (typeof GM_setValue !== 'function') throw new Error('无法保存批量清单恢复日志');
    const payload = JSON.stringify(jobs);
    GM_setValue(storageKey(), payload);
    if (GM_getValue(storageKey(), null) !== payload) {
        throw new Error('批量清单预写日志回读不一致，已停止执行');
    }
}

export function isBatchListJobPending(job: BatchListJob): boolean {
    return !job.ratingsComplete || job.items.some((item) => item.state === 'pending');
}

function isChoice(value: unknown): value is BatchListChoice {
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
        (!route.createAttempted || !!route.createName) &&
        (!route.uncertain || route.listIds.length > 0 || !!route.createName);
}

function isJob(value: unknown): value is BatchListJob {
    if (!value || typeof value !== 'object') return false;
    const job = value as Partial<BatchListJob>;
    return job.version === 1 && typeof job.id === 'string' && job.id.length > 0 &&
        job.origin === window.location.origin && typeof job.desiredChecked === 'boolean' &&
        Number.isFinite(job.createdAt) && Number.isFinite(job.updatedAt) &&
        Number.isFinite(job.retryAt) && Number.isInteger(job.attempts) && (job.attempts ?? -1) >= 0 &&
        typeof job.ratingsComplete === 'boolean' && isChoice(job.list) &&
        (job.rating === undefined || isBatchRatingChoice(job.rating)) &&
        (job.paused === undefined || typeof job.paused === 'boolean') &&
        (job.pauseRevision === undefined || (Number.isSafeInteger(job.pauseRevision) && job.pauseRevision >= 0)) &&
        Array.isArray(job.items) && job.items.length > 0 && job.items.every((item) =>
            item && typeof item.carNum === 'string' && typeof item.url === 'string' &&
            item.carNum.length > 0 && typeof item.videoId === 'string' && /^[\w-]+$/.test(item.videoId) &&
            item.url.includes('/v/' + item.videoId) && typeof item.error === 'string' &&
            (item.route === undefined || isRoute(item.route)) &&
            (job.rating ? isRatingIntent(item.rating) : item.rating === undefined) &&
            ['pending', 'success', 'superseded'].includes(item.state));
}

export function isBatchRatingChoice(value: unknown): value is BatchRatingChoice {
    if (!value || typeof value !== 'object') return false;
    const rating = value as Partial<BatchRatingChoice>;
    return (rating.kind === 'favorite' || rating.kind === 'watched') &&
        Number.isInteger(rating.score) && (rating.score ?? -1) >= 0 && (rating.score ?? 6) <= 5 &&
        (rating.kind !== 'favorite' || rating.score === 0);
}

function isRatingIntent(value: unknown): value is BatchRatingIntent {
    if (!value || typeof value !== 'object') return false;
    const intent = value as Partial<BatchRatingIntent>;
    return typeof intent.revision === 'string' && !!intent.revision && Number.isSafeInteger(intent.requestedAt) && (intent.requestedAt ?? -1) >= 0 &&
        typeof intent.baseline === 'string' && !!intent.before && typeof intent.before.status === 'string' &&
        typeof intent.before.score === 'number' && Number.isFinite(intent.before.score) &&
        ['pending', 'applying', 'registered', 'success', 'superseded'].includes(intent.phase ?? '');
}
