/** 执行权、运行发布和停止/继续的跨页行为；不依赖恢复调度器的实现细节。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drainBatchRatings } from '../src/plugins/list-page/lp-batch-sync';
import { applyBatchListItem } from '../src/plugins/list-page/batch-lists/site';
import { readBatchListJobs } from '../src/plugins/list-page/batch-lists/journal';
import { isBatchListExecutionRunning, recoverBatchListJobs, runAutomaticBatchListRecovery, startBatchListJob } from '../src/plugins/list-page/batch-lists/service';
import { executionKey, executionLock, finishTimers, installBatchListEnvironment, item, journalKey, list, pendingJob, secondList,
    type BatchListTestEnvironment } from './batch-lists-test-env';

vi.mock('../src/plugins/list-page/lp-batch-sync', () => ({ drainBatchRatings: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/site', () => ({ applyBatchListItem: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/ratings', () => ({ captureBatchRating: vi.fn(), prepareBatchRatings: vi.fn(), finishBatchRatings: vi.fn() }));
let env: BatchListTestEnvironment;
beforeEach(() => { env = installBatchListEnvironment(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('原子自动恢复与执行状态', () => {
    it('活页面执行时新页面不打开恢复窗、不排队重放，不按运行时长接管', async () => {
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const running = startBatchListJob([item(1)], [list], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(await isBatchListExecutionRunning()).toBe(true);
        const state = JSON.parse(env.persisted.get(executionKey) as string);
        expect(state).toMatchObject({ token: expect.any(String), jobIds: [readBatchListJobs()[0].id], progress: { total: 1, pending: 1 } });
        vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
        const open = vi.fn();
        expect(await runAutomaticBatchListRecovery(open)).toBe(false);
        expect(open).not.toHaveBeenCalled();
        settle();
        await running;
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(await isBatchListExecutionRunning()).toBe(false);
    });

    it('即使query曾显示空闲，真正尝试时有持锁者也不会打开恢复窗', async () => {
        env.seed(pendingJob());
        expect(await isBatchListExecutionRunning()).toBe(false);
        let release!: () => void;
        const held = navigator.locks.request(executionLock, { mode: 'exclusive' }, async () => {
            await new Promise<void>((resolve) => { release = resolve; });
        });
        await vi.advanceTimersByTimeAsync(0);
        const open = vi.fn();
        expect(await runAutomaticBatchListRecovery(open)).toBe(false);
        expect(open).not.toHaveBeenCalled();
        release(); await held;
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('旧GM运行标记不会阻止真正中断恢复，持锁读取最新due且UI只打开一次', async () => {
        env.seed(pendingJob());
        env.persisted.set(executionKey, JSON.stringify({ token: 'dead-tab', jobIds: ['persisted-job'], progress: {} }));
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const open = vi.fn(async (work) => {
            expect(await isBatchListExecutionRunning()).toBe(true);
            await work(vi.fn());
        });
        const first = runAutomaticBatchListRecovery(open);
        await vi.advanceTimersByTimeAsync(0);
        expect(await runAutomaticBatchListRecovery(open)).toBe(false);
        expect(open).toHaveBeenCalledTimes(1);
        settle();
        expect(await first).toBe(true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
    });

    it('任务结算即释放锁，仍打开的结果窗内手动继续不等待自身锁', async () => {
        env.seed(pendingJob());
        vi.mocked(applyBatchListItem).mockRejectedValueOnce(new Error('首轮失败'));
        let close!: () => void;
        let workFinished = false;
        const automatic = runAutomaticBatchListRecovery(async (work) => {
            await work(vi.fn()); workFinished = true;
            await new Promise<void>((resolve) => { close = resolve; });
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(workFinished).toBe(true);
        expect(await isBatchListExecutionRunning()).toBe(false);
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        close(); expect(await automatic).toBe(true);
    });

    it('刚预写尚未排队时不会作为到期任务自动弹窗', async () => {
        const automatic: Promise<boolean>[] = [];
        const open = vi.fn();
        await startBatchListJob([item(1)], [list], true, () => {
            if (env.persisted.has(journalKey) && automatic.length === 0) automatic.push(runAutomaticBatchListRecovery(open));
        });
        expect(await Promise.all(automatic)).toEqual([false]);
        expect(open).not.toHaveBeenCalled();
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
    });

    it('未到期及明确暂停的任务不会自动弹窗', async () => {
        env.seed(pendingJob({ retryAt: Date.now() + 30000 }), pendingJob({ id: 'paused', paused: true }));
        const open = vi.fn();
        expect(await runAutomaticBatchListRecovery(open)).toBe(false);
        expect(open).not.toHaveBeenCalled();
    });
});

describe('停止与持久继续', () => {
    it('两条已发请求结算前不能返回或释放锁，停止后下一视频及下一清单不启动', async () => {
        const controller = new AbortController();
        const settles: (() => void)[] = [];
        vi.mocked(applyBatchListItem).mockImplementation(async () => new Promise<void>((resolve) => { settles.push(resolve); }));
        let finished = false;
        const running = startBatchListJob([item(1), item(2), item(3)], [list, secondList], true, vi.fn(), controller.signal)
            .then((result) => { finished = true; return result; });
        await vi.advanceTimersByTimeAsync(0);
        expect(settles).toHaveLength(2);
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);
        expect(readBatchListJobs()[0].paused).toBe(true);
        expect(finished).toBe(false);
        settles[0]();
        await vi.advanceTimersByTimeAsync(0);
        expect(finished).toBe(false);
        expect(await isBatchListExecutionRunning()).toBe(true);
        settles[1]();
        expect(await running).toMatchObject({ stopped: true, succeeded: 0, pending: 3 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(2);
        expect(readBatchListJobs()[0].items.slice(0, 2).every((entry) => entry.operations[0].state === 'success' && entry.operations[1].state === 'pending')).toBe(true);
        vi.mocked(applyBatchListItem).mockResolvedValue(undefined).mockClear();
        await recoverBatchListJobs(vi.fn());
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await finishTimers(recoverBatchListJobs(vi.fn(), true))).toMatchObject({ succeeded: 3, pending: 0 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(4);
    });

    it('单并发已发项目确认成功后才停止，成功计数保留且不会启动下一视频', async () => {
        env.getSetting.mockResolvedValue(1);
        const controller = new AbortController();
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const running = startBatchListJob([item(1), item(2)], [list], true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort(); settle();
        expect(await running).toMatchObject({ stopped: true, done: 1, succeeded: 1, pending: 1 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
    });

    it('较早排队的继续不能清除同毫秒较新的停止修订', async () => {
        env.getSetting.mockResolvedValue(1);
        const controller = new AbortController();
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const first = startBatchListJob([item(1), item(2)], [list], true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        const earlierResume = recoverBatchListJobs(vi.fn(), true);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);
        const revision = readBatchListJobs()[0].pauseRevision;
        settle(); await first;
        expect(await earlierResume).toMatchObject({ stopped: true, pending: 1, succeeded: 0 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, pauseRevision: revision });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
    });

    it('等待其他任务执行锁时可以即时停止，且不影响持锁任务', async () => {
        let settle!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
        const first = startBatchListJob([item(1)], [list], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        const controller = new AbortController();
        const second = startBatchListJob([item(2)], [list], true, vi.fn(), controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        expect(await second).toMatchObject({ stopped: true, succeeded: 0, pending: 1 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        settle(); expect(await first).toMatchObject({ succeeded: 1, pending: 0 });
    });

    it('开始时已停止仍完整预写，但无评价或清单副作用', async () => {
        const controller = new AbortController(); controller.abort();
        expect(await startBatchListJob([item(1)], [list], true, vi.fn(), controller.signal)).toMatchObject({ stopped: true, pending: 1 });
        expect(readBatchListJobs()[0].paused).toBe(true);
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('评价中停止保留评价和清单责任，明确继续恢复', async () => {
        const controller = new AbortController();
        vi.mocked(drainBatchRatings).mockImplementationOnce(async () => {
            controller.abort(); return { total: 1, succeeded: 1, failed: 0, stopped: true };
        });
        expect(await startBatchListJob([item(1)], [list], true, vi.fn(), controller.signal)).toMatchObject({ stopped: true, pending: 1, ratingDone: 1 });
        expect(readBatchListJobs()[0]).toMatchObject({ paused: true, ratingsComplete: false });
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
    });

    it('暂停短锁前的新路由必须保留，停止不回写旧执行快照', async () => {
        const ordinary = env.lockRequest.getMockImplementation()!;
        let writes = 0;
        env.lockRequest.mockImplementation((name, options, task) => ordinary(name, options, async (lock) => {
            if (name === journalKey && ++writes === 2) {
                const latest = readBatchListJobs();
                latest[0].items[0].operations[0].route = { listIds: ['L2'], createName: '清单二', createAttempted: true, uncertain: true };
                env.persisted.set(journalKey, JSON.stringify(latest));
            }
            return task(lock);
        }));
        const controller = new AbortController(); controller.abort();
        await startBatchListJob([item(1)], [list], true, vi.fn(), controller.signal);
        expect(readBatchListJobs()[0].items[0].operations[0].route).toEqual({ listIds: ['L2'], createName: '清单二', createAttempted: true, uncertain: true });
    });

    it('一个worker日志永久失败也等待另一个已发请求结算后才释放执行锁', async () => {
        const settles = new Map<string, () => void>();
        vi.mocked(applyBatchListItem).mockImplementation(async (video) => {
            await new Promise<void>((resolve) => { settles.set(video.videoId, resolve); });
            if (video.videoId === 'v1') env.gmSet.mockImplementation((key, value) => {
                if (key === journalKey) throw new Error('日志永久不可写');
                env.persisted.set(key, value);
            });
        });
        let finished = false;
        const running = startBatchListJob([item(1), item(2), item(3)], [list], true, vi.fn())
            .catch((error: unknown) => { finished = true; return error; });
        await vi.advanceTimersByTimeAsync(0);
        expect(settles.size).toBe(2);
        settles.get('v1')!();
        await vi.advanceTimersByTimeAsync(0);
        expect(finished).toBe(false);
        expect(await isBatchListExecutionRunning()).toBe(true);
        settles.get('v2')!();
        expect(await running).toEqual(new Error('日志永久不可写'));
        expect(applyBatchListItem).toHaveBeenCalledTimes(2);
        expect(await isBatchListExecutionRunning()).toBe(false);
    });

    it('暂停持久化失败必须报告，不能伪装为安全停止', async () => {
        const controller = new AbortController();
        vi.mocked(drainBatchRatings).mockImplementationOnce(async () => {
            controller.abort();
            env.gmSet.mockImplementation((key, value) => {
                if (key === journalKey) throw new Error('暂停存储失败');
                env.persisted.set(key, value);
            });
            return { total: 0, succeeded: 0, failed: 0, stopped: true };
        });
        await expect(startBatchListJob([item(1)], [list], true, vi.fn(), controller.signal)).rejects.toThrow('暂停存储失败');
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await isBatchListExecutionRunning()).toBe(false);
    });
});
