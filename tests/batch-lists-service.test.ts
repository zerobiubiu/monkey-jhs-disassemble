/** 持久化预写与恢复执行器：网站适配替身，日志与 Web Locks 包装真实执行。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BatchListJob, BatchListProgress } from '../src/types/batch-lists';
import { drainBatchRatings } from '../src/plugins/list-page/lp-batch-sync';
import { applyBatchListItem } from '../src/plugins/list-page/batch-lists/site';
import { readBatchListJobs } from '../src/plugins/list-page/batch-lists/journal';
import { captureBatchRating, finishBatchRatings, prepareBatchRatings } from '../src/plugins/list-page/batch-lists/ratings';
import { publishListIntent, isCurrentListIntent, readCurrentListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';
import { recoverBatchListJobs, startBatchListJob } from '../src/plugins/list-page/batch-lists/service';

vi.mock('../src/plugins/list-page/lp-batch-sync', () => ({ drainBatchRatings: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/site', () => ({ applyBatchListItem: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/ratings', () => ({
    captureBatchRating: vi.fn(), prepareBatchRatings: vi.fn(), finishBatchRatings: vi.fn()
}));

const origin = 'https://javdb.com';
const key = 'jhs:batch-list-journal:' + origin;
const list = { id: 'L1', name: '清单一', url: origin + '/lists/L1' };
const item = (id: number) => ({ carNum: `TEST-00${id}`, videoId: `v${id}`, url: `${origin}/v/v${id}` });
let persisted: Map<string, unknown>;
let lockRequest: ReturnType<typeof vi.fn>;
let gmSet: ReturnType<typeof vi.fn>;
let gmGet: ReturnType<typeof vi.fn>;

function pendingJob(overrides: Partial<BatchListJob> = {}): BatchListJob {
    return {
        version: 1, id: 'persisted-job', origin, list, desiredChecked: true,
        createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000,
        attempts: 1, retryAt: Date.now() - 1000, ratingsComplete: true,
        items: [{ ...item(1), state: 'pending', error: '页面曾中断' }], ...overrides
    };
}

function seed(...jobs: BatchListJob[]): void {
    persisted.set(key, JSON.stringify(jobs));
}

async function finishTimers<T>(running: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return running;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    vi.clearAllMocks();
    persisted = new Map();
    gmSet = vi.fn((name: string, value: unknown) => { persisted.set(name, value); });
    gmGet = vi.fn((name: string, fallback: unknown) => persisted.get(name) ?? fallback);
    vi.stubGlobal('GM_setValue', gmSet);
    vi.stubGlobal('GM_getValue', gmGet);
    vi.stubGlobal('window', { location: { origin } });
    vi.stubGlobal('clog', { error: vi.fn(), warn: vi.fn(), log: vi.fn() });
    const tails = new Map<string, Promise<unknown>>();
    lockRequest = vi.fn((name: string, options: { signal?: AbortSignal }, task: () => Promise<unknown>) => {
        let started = false;
        const run = () => {
            if (options.signal?.aborted) throw options.signal.reason;
            started = true;
            return task();
        };
        const current = (tails.get(name) ?? Promise.resolve()).then(run, run);
        tails.set(name, current.catch(() => undefined));
        if (!options.signal) return current;
        const signal = options.signal;
        return new Promise((resolve, reject) => {
            const stop = () => { if (!started) reject(signal.reason); };
            signal.addEventListener('abort', stop, { once: true });
            current.then(resolve, reject).then(() => signal.removeEventListener('abort', stop));
            if (signal.aborted) stop();
        });
    });
    vi.stubGlobal('navigator', { locks: { request: lockRequest } });
    vi.mocked(applyBatchListItem).mockReset().mockResolvedValue(undefined);
    vi.mocked(drainBatchRatings).mockReset().mockImplementation(async (_targets, notify) => {
        notify?.(0, 0, 0);
        return { total: 0, succeeded: 0, failed: 0 };
    });
    vi.mocked(captureBatchRating).mockReset().mockImplementation(async (_item, revision) => ({
        revision, requestedAt: Date.now(), baseline: '', before: { status: '', score: 0 }, phase: 'pending'
    }));
    vi.mocked(prepareBatchRatings).mockReset().mockImplementation(async (job, persist) => {
        for (const entry of job.items) if (entry.rating && entry.rating.phase !== 'superseded') entry.rating.phase = 'registered';
        await persist();
    });
    vi.mocked(finishBatchRatings).mockReset().mockImplementation(async (job) => {
        for (const entry of job.items) if (entry.rating?.phase === 'registered') entry.rating.phase = 'success';
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('批量清单预写与真实成功计数', () => {
    it('聚合路由先落盘；中断重载仍交给同一具体清单，不重复分配', async () => {
        const grouped = {
            id: 'group:等待更新', name: '等待更新', url: '',
            group: { base: '等待更新', pattern: '^(.+?)(\\d+)$', excludeNames: [] },
            members: [{ id: 'L1', name: '等待更新1', num: 1 }, { id: 'L2', name: '等待更新2', num: 2 }]
        };
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            await context!.saveRoute({ listIds: ['L2'], uncertain: true });
            expect(readBatchListJobs()[0].items[0].route).toEqual({ listIds: ['L2'], uncertain: true });
            throw new Error('请求发出后关页');
        });
        expect(await startBatchListJob([item(1)], grouped, true, vi.fn())).toMatchObject({ succeeded: 0, pending: 1 });
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            expect(context?.route).toEqual({ listIds: ['L2'], uncertain: true });
        });
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(isCurrentListIntent('v1', 'L1', readBatchListJobs()[0].id)).toBe(true);
        expect(isCurrentListIntent('v1', 'L2', readBatchListJobs()[0].id)).toBe(true);
        expect(readCurrentListIntent('v1', 'L1')?.supersedeOnly).toBe(true);
        expect(readCurrentListIntent('v1', 'L2')?.supersedeOnly).not.toBe(true);
    });

    it('未知创建记录重载时保留名称与已尝试标记，不丢失创建边界', async () => {
        seed(pendingJob({ items: [{ ...item(1), state: 'pending', error: '创建回执未知',
            route: { listIds: [], createName: '等待更新3', createAttempted: true } }] }));
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            expect(context?.route).toEqual({ listIds: [], createName: '等待更新3', createAttempted: true });
            throw new Error('仅回查仍未确认');
        });
        await recoverBatchListJobs(vi.fn(), true);
        expect(readBatchListJobs()[0].items[0].route?.createAttempted).toBe(true);
    });
    it('首次预写失败时不发清单或评价请求', async () => {
        gmSet.mockImplementationOnce(() => { throw new Error('持久存储失败'); });
        await expect(startBatchListJob([item(1)], list, true, vi.fn())).rejects.toThrow('持久存储失败');
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('预写回读不一致也必须停止，保留原记录', async () => {
        gmSet.mockImplementationOnce(() => undefined);
        await expect(startBatchListJob([item(1)], list, true, vi.fn())).rejects.toThrow('回读不一致');
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('清单和评价执行开始前，完整意图已经落盘', async () => {
        vi.mocked(drainBatchRatings).mockImplementationOnce(async () => {
            const saved = readBatchListJobs()[0];
            expect(saved.items.map((entry) => entry.state)).toEqual(['pending', 'pending']);
            expect(saved.ratingsComplete).toBe(false);
            return { total: 1, succeeded: 1, failed: 0 };
        });
        vi.mocked(applyBatchListItem).mockImplementation(async () => {
            expect(readBatchListJobs()[0].ratingsComplete).toBe(true);
        });
        const result = await finishTimers(startBatchListJob([item(1), item(2)], list, true, vi.fn()));
        expect(result).toMatchObject({ succeeded: 2, pending: 0, ratingDone: 1, phase: 'done' });
        expect(readBatchListJobs()[0].items.every((entry) => entry.state === 'success')).toBe(true);
    });

    it('部分失败只累计真正成功项，失败仍为待恢复', async () => {
        vi.mocked(applyBatchListItem).mockRejectedValueOnce(new Error('网站未确认'));
        const snapshots: BatchListProgress[] = [];
        const result = await finishTimers(startBatchListJob([item(1), item(2)], list, true, (p) => snapshots.push(p)));
        expect(result).toMatchObject({ total: 2, done: 2, succeeded: 1, failed: 1, pending: 1 });
        expect(readBatchListJobs()[0].items).toMatchObject([
            { state: 'pending', error: '网站未确认' }, { state: 'success', error: '' }
        ]);
        expect(snapshots.filter((p) => p.phase === 'lists' && p.done === 0).every((p) => p.succeeded === 0)).toBe(true);
    });

    it('网站完成后若成功日志无法落盘，不假计成功且可恢复', async () => {
        vi.mocked(applyBatchListItem).mockImplementationOnce(async () => {
            gmSet.mockImplementationOnce(() => { throw new Error('成功日志写入失败'); });
        });
        const result = await startBatchListJob([item(1)], list, true, vi.fn());
        expect(result).toMatchObject({ succeeded: 0, failed: 1, pending: 1 });
        expect(readBatchListJobs()[0].items[0]).toMatchObject({ state: 'pending', error: '成功日志写入失败' });
    });

    it('无 Web Locks、无选择或损坏日志均不发请求', async () => {
        vi.stubGlobal('navigator', {});
        await expect(startBatchListJob([item(1)], list, true, vi.fn())).rejects.toThrow('Web Locks');
        vi.stubGlobal('navigator', { locks: { request: lockRequest } });
        await expect(startBatchListJob([], list, true, vi.fn())).rejects.toThrow('选择视频');
        persisted.set(key, 'invalid-json');
        await expect(startBatchListJob([item(1)], list, true, vi.fn())).rejects.toThrow();
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(persisted.get(key)).toBe('invalid-json');
    });
});

describe('持久日志恢复与多标签互斥', () => {
    it('旧批量等待执行锁期间，较新详情意图仍胜出，不能用拿锁时间反转顺序', async () => {
        let release!: () => void;
        vi.mocked(applyBatchListItem).mockImplementation(async (video, target, _desired, token) =>
            isCurrentListIntent(video.videoId, target.id, token!) ? undefined : 'superseded');
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
        const first = startBatchListJob([item(2)], list, true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        const clickedAt = Date.now() + 100;
        vi.setSystemTime(clickedAt);
        const second = startBatchListJob([item(1)], list, true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(readBatchListJobs().find((job) => job.items[0].videoId === 'v1')?.createdAt).toBe(clickedAt);
        vi.setSystemTime(clickedAt + 100);
        publishListIntent('v1', 'L1', 'later-native', Date.now(), false, { explicit: true });
        release();
        const [, result] = await Promise.all([first, second]);
        expect(result).toMatchObject({ succeeded: 0, pending: 0, superseded: 1 });
        expect(isCurrentListIntent('v1', 'L1', 'later-native')).toBe(true);
    });
    it('旧批量恢复不会重新发布覆盖较新详情意图，被替代项不计为成功', async () => {
        const old = pendingJob();
        seed(old);
        publishListIntent('v1', 'L1', 'new-detail', Date.now(), false, { explicit: true });
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, token) => {
            expect(isCurrentListIntent('v1', 'L1', 'new-detail')).toBe(true);
            return isCurrentListIntent('v1', 'L1', token!) ? undefined : 'superseded';
        });
        const result = await recoverBatchListJobs(vi.fn(), true);
        expect(result).toMatchObject({ done: 1, succeeded: 0, failed: 0, pending: 0, superseded: 1 });
        expect(readBatchListJobs()[0].items[0].state).toBe('superseded');
    });
    it('模块重新载入后从持久日志恢复，已成功项不重做', async () => {
        seed(pendingJob({ items: [
            { ...item(1), state: 'success', error: '' },
            { ...item(2), state: 'pending', error: '关页中断' }
        ] }));
        vi.resetModules();
        const reloaded = await import('../src/plugins/list-page/batch-lists/service');
        const result = await reloaded.recoverBatchListJobs(vi.fn());
        expect(result).toMatchObject({ total: 1, succeeded: 1, pending: 0 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(applyBatchListItem).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'v2' }), list, true, 'persisted-job', expect.objectContaining({ createdAt: expect.any(Number), saveRoute: expect.any(Function) }));
        expect(readBatchListJobs()[0].items.every((entry) => entry.state === 'success')).toBe(true);
    });

    it('退避时间未到不重试，force 可以立即校验', async () => {
        seed(pendingJob({ retryAt: Date.now() + 30000 }));
        expect(await recoverBatchListJobs(vi.fn())).toMatchObject({ total: 0, phase: 'done' });
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ total: 1, succeeded: 1 });
    });

    it('相反的新意图 supersede 旧未完成项，后台恢复不反向覆盖', async () => {
        seed(pendingJob());
        await startBatchListJob([item(1)], list, false, vi.fn());
        expect(readBatchListJobs().map((job) => job.items[0].state)).toEqual(['superseded', 'success']);
        await recoverBatchListJobs(vi.fn(), true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(applyBatchListItem).toHaveBeenCalledWith(expect.anything(), list, false, expect.any(String), expect.objectContaining({ saveRoute: expect.any(Function) }));
    });

    it('不同清单的旧意图保持待恢复，不被新意图覆盖', async () => {
        seed(pendingJob());
        await startBatchListJob([item(1)], { ...list, id: 'L2' }, false, vi.fn());
        expect(readBatchListJobs().find((job) => job.list.id === 'L1')?.items[0].state).toBe('pending');
    });

    it('同源两次执行共用跨标签排他锁，第二次持锁后重读最新日志', async () => {
        let release!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
        const first = startBatchListJob([item(1)], list, true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        const second = startBatchListJob([item(2)], list, true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        // 第二次点击虽仍在等待执行锁，也必须已经可靠预写，关页后才能恢复。
        expect(readBatchListJobs()).toHaveLength(2);
        release();
        await Promise.all([first, second]);
        expect(lockRequest).toHaveBeenCalledWith('jhs:batch-lists:' + origin, { mode: 'exclusive' }, expect.any(Function));
        expect(readBatchListJobs()).toHaveLength(2);
        expect(readBatchListJobs().every((job) => job.items[0].state === 'success')).toBe(true);
    });

    it('只裁剪已结束历史，所有未完成日志均保留', async () => {
        const completed = Array.from({ length: 25 }, (_, index) => pendingJob({ id: `done-${index}`, items: [{ ...item(index), state: 'success', error: '' }] }));
        seed(...completed, pendingJob({ id: 'old-pending', list: { ...list, id: 'old-list' } }));
        await startBatchListJob([item(1)], list, false, vi.fn());
        const jobs = readBatchListJobs();
        expect(jobs).toHaveLength(21);
        expect(jobs.some((job) => job.id === 'old-pending')).toBe(true);
    });
});

describe('批量评价联动恢复', () => {
    it('阻塞评价严格绑定当前清单任务的视频，不把其它视频追加进范围', async () => {
        const scope = [item(1), item(2)];
        await finishTimers(startBatchListJob(scope, list, true, vi.fn()));
        expect(drainBatchRatings).toHaveBeenCalledWith(
            scope.map((entry) => expect.objectContaining({ videoId: entry.videoId, carNum: entry.carNum })),
            expect.any(Function), expect.any(AbortSignal)
        );
    });

    it('只有评价未完成的恢复仍限定原任务视频，清单已成功项不重新修改', async () => {
        seed(pendingJob({ ratingsComplete: false, items: [{ ...item(1), state: 'success', error: '' }] }));
        await recoverBatchListJobs(vi.fn(), true);
        expect(drainBatchRatings).toHaveBeenCalledWith([expect.objectContaining({ videoId: 'v1' })], expect.any(Function), expect.any(AbortSignal));
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });
    it('评价部分失败保持 ratingsComplete=false，清单成功也不删除恢复责任', async () => {
        vi.mocked(drainBatchRatings).mockResolvedValueOnce({ total: 2, succeeded: 1, failed: 1 });
        const result = await startBatchListJob([item(1)], list, true, vi.fn());
        expect(result).toMatchObject({ succeeded: 1, ratingTotal: 2, ratingDone: 2, ratingFailed: 1 });
        expect(readBatchListJobs()[0].ratingsComplete).toBe(false);
        vi.mocked(applyBatchListItem).mockClear();
        await recoverBatchListJobs(vi.fn(), true);
        expect(drainBatchRatings).toHaveBeenCalledTimes(2);
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(readBatchListJobs()[0].ratingsComplete).toBe(true);
    });

    it('评价执行异常时完整预写仍保留，清单不得提前执行', async () => {
        vi.mocked(drainBatchRatings).mockRejectedValueOnce(new Error('评价执行中断'));
        await expect(startBatchListJob([item(1)], list, true, vi.fn())).rejects.toThrow('评价执行中断');
        expect(readBatchListJobs()[0]).toMatchObject({ ratingsComplete: false, items: [{ state: 'pending' }] });
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });
});

describe('手动停止与明确继续', () => {
    it('较早排队的继续请求不能清除较新的跨页停止，即使发生于同一毫秒', async () => {
        const controller = new AbortController();
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const first = startBatchListJob([item(1), item(2)], list, true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        const earlierResume = recoverBatchListJobs(vi.fn(), true);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);
        const revision = readBatchListJobs()[0].pauseRevision;
        expect(revision).toBeGreaterThan(0);
        settle();
        await finishTimers(first);
        expect(await earlierResume).toMatchObject({ stopped: true, pending: 1, succeeded: 0 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, pauseRevision: revision });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        await recoverBatchListJobs(vi.fn(), true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(2);
    });

    it('在途请求尚未结算时停止指令已落盘，关页重载不得自动续做', async () => {
        const controller = new AbortController();
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const running = startBatchListJob([item(1), item(2)], list, true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);
        const pausedWhileRequestInFlight = readBatchListJobs()[0].paused;
        // 清理在途替身后再断言，避免失败用例留下悬挂任务影响后续回归。
        settle();
        await finishTimers(running);
        expect(pausedWhileRequestInFlight).toBe(true);
    });

    it('暂停取得日志短锁前已有新路由提交时，只更新暂停标记，保留最新创建防重边界', async () => {
        const ordinaryLock = lockRequest.getMockImplementation()!;
        let journalWrites = 0;
        lockRequest.mockImplementation((name, options, task) => ordinaryLock(name, options, async () => {
            if (name === 'jhs:batch-list-journal:' + origin && ++journalWrites === 2) {
                // 模拟另一执行者的进度提交先取得短锁；暂停方仍持有等锁前的旧快照。
                const latest = readBatchListJobs();
                latest[0].items[0].route = { listIds: ['L2'], createName: '清单二', createAttempted: true, uncertain: true };
                persisted.set(key, JSON.stringify(latest));
            }
            return task();
        }));
        const controller = new AbortController();
        controller.abort();
        const result = await startBatchListJob([item(1)], list, true, vi.fn(), controller.signal);
        expect(result.stopped).toBe(true);
        expect(readBatchListJobs()[0].paused).toBe(true);
        expect(readBatchListJobs()[0].items[0].route).toEqual({
            listIds: ['L2'], createName: '清单二', createAttempted: true, uncertain: true
        });
    });

    it('开始时已停止也先可靠预写，但不执行评价或清单', async () => {
        const controller = new AbortController();
        controller.abort();
        const result = await startBatchListJob([item(1)], list, true, vi.fn(), controller.signal);
        expect(result).toMatchObject({ stopped: true, succeeded: 0, pending: 1 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, items: [{ state: 'pending' }] });
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('评价阶段停止后保留清单责任，显式继续仍可完成', async () => {
        const controller = new AbortController();
        vi.mocked(drainBatchRatings).mockImplementationOnce(async (_targets, _notify, signal) => {
            expect(signal?.aborted).toBe(false);
            controller.abort();
            expect(signal?.aborted).toBe(true);
            return { total: 1, succeeded: 1, failed: 0, stopped: true };
        });
        expect(await startBatchListJob([item(1)], list, true, vi.fn(), controller.signal))
            .toMatchObject({ stopped: true, succeeded: 0, pending: 1, ratingDone: 1 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, ratingsComplete: false });
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: false, ratingsComplete: true });
    });

    it('已发项目确认成功后才停止，下一项目不启动且成功数保留', async () => {
        const controller = new AbortController();
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _id, context) => {
            expect(context?.signal?.aborted).toBe(false);
            await new Promise<void>((resolve) => { settle = resolve; });
        });
        const running = startBatchListJob([item(1), item(2)], list, true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        expect(readBatchListJobs()[0].items[0].state).toBe('pending');
        settle();
        const result = await finishTimers(running);
        expect(result).toMatchObject({ stopped: true, done: 1, succeeded: 1, pending: 1 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, items: [{ state: 'success' }, { state: 'pending' }] });
        await recoverBatchListJobs(vi.fn());
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        await recoverBatchListJobs(vi.fn(), true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(2);
        expect(readBatchListJobs()[0].items.every((entry) => entry.state === 'success')).toBe(true);
    });

    it('聚合成员中途停止不算整个视频成功，并保留具体路由', async () => {
        const controller = new AbortController();
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _id, context) => {
            await context!.saveRoute({ listIds: ['L1', 'L2'] });
            controller.abort();
            return 'stopped';
        });
        const result = await startBatchListJob([item(1)], list, false, vi.fn(), controller.signal);
        expect(result).toMatchObject({ stopped: true, succeeded: 0, done: 0, pending: 1 });
        expect(readBatchListJobs()[0].items[0]).toMatchObject({ state: 'pending', route: { listIds: ['L1', 'L2'] } });
    });

    it('等待另一批执行锁时能立即停止，并且不影响持锁任务', async () => {
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const first = startBatchListJob([item(1)], list, true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        const controller = new AbortController();
        const second = startBatchListJob([item(2)], list, true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        const result = await second;
        expect(result).toMatchObject({ stopped: true, succeeded: 0, pending: 1 });
        expect(readBatchListJobs().find((job) => job.items[0].videoId === 'v2')?.paused).toBe(true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        settle();
        expect(await first).toMatchObject({ succeeded: 1, pending: 0 });
    });

    it('暂停日志持久化失败不能伪装成已安全暂停', async () => {
        const controller = new AbortController();
        vi.mocked(drainBatchRatings).mockImplementationOnce(async () => {
            controller.abort();
            gmSet.mockImplementation(() => { throw new Error('暂停存储失败'); });
            return { total: 0, succeeded: 0, failed: 0, stopped: true };
        });
        await expect(startBatchListJob([item(1)], list, true, vi.fn(), controller.signal)).rejects.toThrow('暂停存储失败');
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });
});

describe('评价与清单一次配置执行', () => {
    it('完整评价和清单先预写，再准备评价、确认网站，最后执行清单', async () => {
        const order: string[] = [];
        vi.mocked(prepareBatchRatings).mockImplementationOnce(async (job, persist) => {
            const saved = readBatchListJobs()[0];
            expect(saved.rating).toEqual({ kind: 'watched', score: 5 });
            expect(saved.list).toEqual(list);
            expect(saved.items.map((entry) => entry.rating?.phase)).toEqual(['pending', 'pending']);
            expect(saved.items.every((entry) => !!entry.rating?.revision)).toBe(true);
            order.push('prepare');
            for (const entry of job.items) entry.rating!.phase = 'registered';
            await persist();
        });
        vi.mocked(drainBatchRatings).mockImplementationOnce(async () => {
            order.push('drain');
            expect(readBatchListJobs()[0].items.every((entry) => entry.rating?.phase === 'registered')).toBe(true);
            return { total: 2, succeeded: 2, failed: 0 };
        });
        vi.mocked(applyBatchListItem).mockImplementation(async () => { order.push('list'); });
        const result = await finishTimers(startBatchListJob([item(1), item(2)], list, true, vi.fn(), undefined, { kind: 'watched', score: 5 }));
        expect(order).toEqual(['prepare', 'drain', 'list', 'list']);
        expect(result).toMatchObject({ succeeded: 2, pending: 0, ratingDone: 2 });
        expect(readBatchListJobs()[0]).toMatchObject({ ratingsComplete: true, items: [{ rating: { phase: 'success' } }, { rating: { phase: 'success' } }] });
        expect(vi.mocked(captureBatchRating).mock.calls.every((call) => call[2] === readBatchListJobs()[0].createdAt)).toBe(true);
    });

    it('默认单独清单不捕获或修改评价配置，仍补同步目标已有评价', async () => {
        await startBatchListJob([item(1)], list, true, vi.fn());
        expect(readBatchListJobs()[0].rating).toBeUndefined();
        expect(captureBatchRating).not.toHaveBeenCalled();
        expect(prepareBatchRatings).not.toHaveBeenCalled();
        expect(drainBatchRatings).toHaveBeenCalledTimes(1);
    });

    it('组合预写失败时评价与清单均无执行副作用', async () => {
        gmSet.mockImplementationOnce(() => { throw new Error('组合预写失败'); });
        await expect(startBatchListJob([item(1)], list, true, vi.fn(), undefined, { kind: 'favorite', score: 0 })).rejects.toThrow('组合预写失败');
        expect(prepareBatchRatings).not.toHaveBeenCalled();
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('无效评价不得登记任务或开始本地准备', async () => {
        await expect(startBatchListJob([item(1)], list, true, vi.fn(), undefined, { kind: 'watched', score: 6 })).rejects.toThrow('有效的批量评价');
        expect(readBatchListJobs()).toHaveLength(0);
        expect(captureBatchRating).not.toHaveBeenCalled();
        expect(prepareBatchRatings).not.toHaveBeenCalled();
    });

    it('评价本地准备中断后恢复相同意图，不重新捕获为较新操作', async () => {
        vi.mocked(prepareBatchRatings).mockImplementationOnce(async (job, persist) => {
            job.items[0].rating!.phase = 'applying';
            await persist();
            throw new Error('本地已写，网站账本尚未登记');
        });
        await expect(startBatchListJob([item(1)], list, true, vi.fn(), undefined, { kind: 'favorite', score: 0 })).rejects.toThrow('本地已写');
        const before = readBatchListJobs()[0].items[0].rating;
        expect(before?.phase).toBe('applying');
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(captureBatchRating).toHaveBeenCalledTimes(1);
        expect(readBatchListJobs()[0].items[0].rating?.revision).toBe(before?.revision);
    });

    it('评价成功而清单失败时恢复保留评价身份和完成态', async () => {
        vi.mocked(applyBatchListItem).mockRejectedValueOnce(new Error('清单未确认'));
        await startBatchListJob([item(1)], list, true, vi.fn(), undefined, { kind: 'watched', score: 3 });
        const before = readBatchListJobs()[0].items[0].rating;
        expect(before?.phase).toBe('success');
        expect(readBatchListJobs()[0].items[0].state).toBe('pending');
        await recoverBatchListJobs(vi.fn(), true);
        expect(captureBatchRating).toHaveBeenCalledTimes(1);
        expect(readBatchListJobs()[0].items[0].rating?.revision).toBe(before?.revision);
    });

    it('清单意图被替代后仍保留独立未完成评价的同步责任', async () => {
        const intent = await captureBatchRating(item(1), 'stable-rating');
        seed(pendingJob({ rating: { kind: 'watched', score: 4 }, ratingsComplete: false,
            items: [{ ...item(1), state: 'superseded', error: '', rating: intent }] }));
        await recoverBatchListJobs(vi.fn(), true);
        expect(prepareBatchRatings).toHaveBeenCalled();
        expect(drainBatchRatings).toHaveBeenCalledWith([expect.objectContaining({ videoId: 'v1' })], expect.any(Function), expect.any(AbortSignal));
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(readBatchListJobs()[0].ratingsComplete).toBe(true);
    });

    it('清单成功不掩盖仍待确认的新评价，保留独立恢复责任', async () => {
        vi.mocked(finishBatchRatings).mockResolvedValueOnce(undefined);
        const result = await startBatchListJob([item(1)], list, true, vi.fn(), undefined, { kind: 'watched', score: 2 });
        expect(result).toMatchObject({ succeeded: 1, pending: 0, ratingPending: 1, ratingFailed: 0 });
        expect(result.current).toContain('未完成');
        expect(readBatchListJobs()[0].ratingsComplete).toBe(false);
    });
});
