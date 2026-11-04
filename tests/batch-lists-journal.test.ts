/** 旧版仅在迁移专用用例中出现；新格式负责逐关联完成态和逐视频评价责任。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchListJob } from '../src/types/batch-lists';
import { isBatchListJobPending, persistBatchListProgress, readBatchListJobs, writeBatchListJobs } from '../src/plugins/list-page/batch-lists/journal';

const origin = 'https://javdb.com';
const key = 'jhs:batch-list-journal:' + origin;
const list = { id: 'L1', name: '清单一', url: `${origin}/lists/L1` };
let persisted: Map<string, unknown>;

function legacyJob() {
    return { version: 1, id: 'legacy', origin, list, desiredChecked: true, createdAt: 10, updatedAt: 20,
        attempts: 2, retryAt: 300, ratingsComplete: false, paused: true, pauseRevision: 7,
        rating: { kind: 'watched', score: 4 }, items: [
            { carNum: 'TEST-001', url: `${origin}/v/v1`, videoId: 'v1', state: 'success', error: '',
                route: { listIds: ['L1'], uncertain: false },
                rating: { revision: 'r1', requestedAt: 12, baseline: 'old', before: { status: '', score: 0 }, phase: 'success' } },
            { carNum: 'TEST-002', url: `${origin}/v/v2`, videoId: 'v2', state: 'pending', error: '创建未知',
                route: { listIds: [], createName: '清单2', createAttempted: true },
                rating: { revision: 'r2', requestedAt: 12, baseline: 'old2', before: { status: '', score: 0 }, phase: 'applying' } }
        ] };
}

function currentJob(): BatchListJob {
    return { version: 2, id: 'current', origin, lists: [list], desiredChecked: true, createdAt: 10, updatedAt: 20,
        attempts: 1, retryAt: 30, ratingsComplete: true, items: [1, 2].map((id) => ({
            carNum: `TEST-00${id}`, url: `${origin}/v/v${id}`, videoId: `v${id}`, state: 'pending', error: '', ratingsComplete: true,
            operations: [{ listId: list.id, state: 'pending', error: '' }]
        })) };
}

beforeEach(() => {
    persisted = new Map();
    vi.stubGlobal('window', { location: { origin } });
    vi.stubGlobal('GM_getValue', (name: string, fallback: unknown) => persisted.get(name) ?? fallback);
    vi.stubGlobal('GM_setValue', (name: string, value: unknown) => { persisted.set(name, value); });
    let tail = Promise.resolve();
    vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: unknown, task: () => Promise<void>) => {
        const next = tail.then(task); tail = next.catch(() => undefined); return next;
    } } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('version1严格迁移', () => {
    it('保留任务身份、时间、暂停修订、确认态、路由和评价稳定身份，新写只留version2', () => {
        const old = legacyJob();
        const raw = JSON.stringify([old]); persisted.set(key, raw);
        const jobs = readBatchListJobs();
        expect(jobs[0]).toMatchObject({ version: 2, id: 'legacy', lists: [list], createdAt: 10, updatedAt: 20,
            paused: true, pauseRevision: 7, attempts: 2, retryAt: 300, ratingsComplete: false });
        expect(jobs[0]).not.toHaveProperty('list');
        expect(jobs[0].items[0]).toMatchObject({ state: 'success', ratingsComplete: false,
            rating: old.items[0].rating, operations: [{ listId: 'L1', state: 'success', route: old.items[0].route }] });
        expect(jobs[0].items[1]).toMatchObject({ state: 'pending', ratingsComplete: false,
            rating: old.items[1].rating, operations: [{ listId: 'L1', state: 'pending', route: old.items[1].route }] });
        expect(jobs[0].items[0]).not.toHaveProperty('route');
        expect(persisted.get(key)).toBe(raw);
        expect(isBatchListJobPending(jobs[0])).toBe(true);
        writeBatchListJobs(jobs);
        expect(JSON.parse(persisted.get(key) as string)[0].version).toBe(2);
    });

    it('旧任务全部评价已确认时逐视频继承完成态，已确认清单不退回pending', () => {
        const old = legacyJob();
        old.ratingsComplete = true;
        old.items[1].rating.phase = 'superseded';
        old.items[1].state = 'superseded';
        persisted.set(key, [old]);
        const [job] = readBatchListJobs();
        expect(job.items.every((entry) => entry.ratingsComplete)).toBe(true);
        expect(job.items.map((entry) => entry.operations[0].state)).toEqual(['success', 'superseded']);
        expect(isBatchListJobPending(job)).toBe(false);
    });

    it.each(['missing-rating', 'bad-route', 'foreign-origin', 'duplicate-video', 'bad-phase'])('拒绝损坏旧记录而不覆盖原始数据：%s', (kind) => {
        const old = legacyJob();
        if (kind === 'missing-rating') Reflect.deleteProperty(old.items[0], 'rating');
        if (kind === 'bad-route') old.items[1].route.createName = '';
        if (kind === 'foreign-origin') old.origin = 'https://foreign.test';
        if (kind === 'duplicate-video') old.items[1] = old.items[0];
        if (kind === 'bad-phase') old.items[0].rating.phase = 'unknown';
        const raw = JSON.stringify([old]); persisted.set(key, raw);
        expect(() => readBatchListJobs()).toThrow('恢复日志损坏');
        expect(persisted.get(key)).toBe(raw);
    });
});

describe('version2完整性与并发合并', () => {
    it.each(['duplicate-list', 'missing-operation', 'wrong-operation', 'wrong-aggregate', 'wrong-rating-aggregate'])('拒绝不完整的新日志：%s', (kind) => {
        const job = currentJob();
        if (kind === 'duplicate-list') job.lists.push(list);
        if (kind === 'missing-operation') job.items[0].operations = [];
        if (kind === 'wrong-operation') job.items[0].operations[0].listId = 'unknown';
        if (kind === 'wrong-aggregate') job.items[0].state = 'success';
        if (kind === 'wrong-rating-aggregate') job.items[0].ratingsComplete = false;
        const raw = JSON.stringify([job]); persisted.set(key, raw);
        expect(() => readBatchListJobs()).toThrow('恢复日志损坏');
        expect(persisted.get(key)).toBe(raw);
    });

    it('不同worker的旧快照只提交自己视频，不抹去另一个视频的成功', async () => {
        writeBatchListJobs([currentJob()]);
        const [first] = readBatchListJobs();
        const [second] = readBatchListJobs();
        first.items[0].operations[0].state = 'success';
        second.items[1].operations[0].state = 'success';
        await Promise.all([persistBatchListProgress(first, [first.items[0]]), persistBatchListProgress(second, [second.items[1]])]);
        expect(readBatchListJobs()[0].items.map((entry) => entry.state)).toEqual(['success', 'success']);
    });

    it('旧worker不能覆盖更新的暂停修订、关联替代和另一个已登记任务', async () => {
        writeBatchListJobs([currentJob()]);
        const [stale] = readBatchListJobs();
        const [fresh] = readBatchListJobs();
        fresh.paused = true; fresh.pauseRevision = 9;
        fresh.items[0].operations[0].state = 'superseded'; fresh.items[0].state = 'superseded';
        writeBatchListJobs([fresh, { ...currentJob(), id: 'new-job' }]);
        stale.items[0].operations[0].state = 'success';
        await persistBatchListProgress(stale, [stale.items[0]]);
        expect(readBatchListJobs()).toHaveLength(2);
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, pauseRevision: 9,
            items: [{ state: 'superseded', operations: [{ state: 'superseded' }] }, { state: 'pending' }] });
        expect(stale.items[0].operations[0].state).toBe('superseded');
    });
});
