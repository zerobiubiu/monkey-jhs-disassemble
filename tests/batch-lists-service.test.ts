/** 完整多清单预写、逐视频并发、关联替代与恢复边界。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drainBatchRatings } from '../src/plugins/list-page/lp-batch-sync';
import { applyBatchListItem } from '../src/plugins/list-page/batch-lists/site';
import { readBatchListJobs } from '../src/plugins/list-page/batch-lists/journal';
import { captureBatchRating, finishBatchRatings, prepareBatchRatings } from '../src/plugins/list-page/batch-lists/ratings';
import { publishListIntent, isCurrentListIntent, readCurrentListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';
import { recoverBatchListJobs, startBatchListJob } from '../src/plugins/list-page/batch-lists/service';
import { finishTimers, installBatchListEnvironment, item, journalItem, journalKey, list, pendingJob, secondList,
    type BatchListTestEnvironment } from './batch-lists-test-env';

vi.mock('../src/plugins/list-page/lp-batch-sync', () => ({ drainBatchRatings: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/site', () => ({ applyBatchListItem: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/ratings', () => ({ captureBatchRating: vi.fn(), prepareBatchRatings: vi.fn(), finishBatchRatings: vi.fn() }));
let env: BatchListTestEnvironment;
beforeEach(() => { env = installBatchListEnvironment(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const successful = (id: number) => journalItem(id, { state: 'success', operations: [{ listId: list.id, state: 'success', error: '' }] });

describe('完整预写与多清单恢复', () => {
    it('任何评价或清单请求前，一次预写完整视频、所有清单和稳定评价身份', async () => {
        vi.mocked(prepareBatchRatings).mockImplementationOnce(async (job, persist, _signal, items = job.items) => {
            const initial = JSON.parse(env.gmSet.mock.calls.find(([key]) => key === journalKey)![1] as string)[0];
            expect(initial).toMatchObject({ version: 2, lists: [list, secondList], rating: { kind: 'watched', score: 5 } });
            expect(initial.items).toHaveLength(2);
            for (const entry of initial.items) expect(entry).toMatchObject({ ratingsComplete: false, state: 'pending',
                rating: { phase: 'pending', revision: expect.any(String) },
                operations: [{ listId: 'L1', state: 'pending' }, { listId: 'L2', state: 'pending' }] });
            for (const entry of items) entry.rating!.phase = 'registered';
            await persist();
        });
        const result = await startBatchListJob([item(1), item(2)], [list, secondList], true, vi.fn(), undefined, { kind: 'watched', score: 5 });
        expect(result).toMatchObject({ total: 2, succeeded: 2, done: 2, failed: 0, pending: 0, concurrency: 2 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(4);
        expect(readBatchListJobs()[0].items.every((entry) => entry.ratingsComplete && entry.state === 'success')).toBe(true);
    });

    it.each(['throw', 'drop'])('预写失败或回读不一致不得开始网站与本地评价：%s', async (mode) => {
        env.gmSet.mockImplementationOnce(() => { if (mode === 'throw') throw new Error('持久存储失败'); });
        await expect(startBatchListJob([item(1)], [list, secondList], true, vi.fn(), undefined, { kind: 'favorite', score: 0 })).rejects.toThrow();
        expect(prepareBatchRatings).not.toHaveBeenCalled();
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('缺少互斥、无选择、无效评价及损坏日志均不发请求或改坏原记录', async () => {
        vi.stubGlobal('navigator', {});
        await expect(startBatchListJob([item(1)], [list], true, vi.fn())).rejects.toThrow('Web Locks');
        vi.stubGlobal('navigator', { locks: { request: env.lockRequest } });
        await expect(startBatchListJob([], [list], true, vi.fn())).rejects.toThrow('选择视频');
        await expect(startBatchListJob([item(1)], [], true, vi.fn())).rejects.toThrow('有效的视频清单');
        await expect(startBatchListJob([item(1)], [list], true, vi.fn(), undefined, { kind: 'watched', score: 6 })).rejects.toThrow('有效的批量评价');
        env.persisted.set(journalKey, 'invalid-json');
        await expect(startBatchListJob([item(1)], [list], true, vi.fn())).rejects.toThrow();
        expect(env.persisted.get(journalKey)).toBe('invalid-json');
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('聚合路由落在对应operation，恢复不丢创建/不确定边界或重复分配', async () => {
        const grouped = { id: 'group:等待更新', name: '等待更新', url: '',
            group: { base: '等待更新', pattern: '^(.+?)(\\d+)$', excludeNames: [] },
            members: [{ id: 'L1', name: '等待更新1', num: 1 }, { id: 'L2', name: '等待更新2', num: 2 }] };
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            await context!.saveRoute({ listIds: ['L2'], uncertain: true });
            expect(readBatchListJobs()[0].items[0].operations[0].route).toEqual({ listIds: ['L2'], uncertain: true });
            throw new Error('请求发出后关页');
        });
        expect(await startBatchListJob([item(1)], [grouped], true, vi.fn())).toMatchObject({ succeeded: 0, pending: 1 });
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            expect(context?.route).toEqual({ listIds: ['L2'], uncertain: true });
        });
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(readCurrentListIntent('v1', 'L1')?.supersedeOnly).toBe(true);
        expect(readCurrentListIntent('v1', 'L2')?.supersedeOnly).not.toBe(true);
    });

    it('创建回执未知的日志恢复仅保留同一创建尝试', async () => {
        env.seed(pendingJob({ items: [journalItem(1, { operations: [{ listId: 'L1', state: 'pending', error: '创建未知',
            route: { listIds: [], createName: '等待更新3', createAttempted: true } }] })] }));
        vi.mocked(applyBatchListItem).mockImplementationOnce(async (_item, _list, _desired, _token, context) => {
            expect(context?.route).toEqual({ listIds: [], createName: '等待更新3', createAttempted: true });
            throw new Error('回查仍未确认');
        });
        await recoverBatchListJobs(vi.fn(), true);
        expect(readBatchListJobs()[0].items[0].operations[0].route?.createAttempted).toBe(true);
    });

    it('多清单部分失败只恢复未完关联，已确认评价和其他清单不重放', async () => {
        vi.mocked(applyBatchListItem).mockImplementationOnce(async () => { throw new Error('清单一失败'); });
        const result = await startBatchListJob([item(1)], [list, secondList], true, vi.fn(), undefined, { kind: 'watched', score: 3 });
        expect(result).toMatchObject({ total: 1, done: 1, succeeded: 0, failed: 1, pending: 1 });
        const saved = readBatchListJobs()[0].items[0];
        expect(saved).toMatchObject({ ratingsComplete: true, rating: { phase: 'success' },
            operations: [{ listId: 'L1', state: 'pending' }, { listId: 'L2', state: 'success' }] });
        vi.mocked(applyBatchListItem).mockClear();
        vi.mocked(drainBatchRatings).mockClear();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(vi.mocked(applyBatchListItem).mock.calls[0][1].id).toBe('L1');
        expect(drainBatchRatings).not.toHaveBeenCalled();
        expect(captureBatchRating).toHaveBeenCalledTimes(1);
    });

    it('网站成功但日志写入失败不假计成功，失败视频仅计一次', async () => {
        vi.mocked(applyBatchListItem).mockImplementationOnce(async () => {
            const original = env.gmSet.getMockImplementation()!;
            let failed = false;
            env.gmSet.mockImplementation((key, value) => {
                if (key === journalKey && !failed) { failed = true; throw new Error('成功日志写入失败'); }
                original(key, value);
            });
        });
        expect(await startBatchListJob([item(1)], [list], true, vi.fn())).toMatchObject({ succeeded: 0, failed: 1, pending: 1 });
        expect(readBatchListJobs()[0].items[0].operations[0]).toMatchObject({ state: 'pending', error: '成功日志写入失败' });
    });

    it('模块重载只执行未完成视频，已完成视频不加入恢复分母', async () => {
        env.seed(pendingJob({ items: [successful(1), journalItem(2)] }));
        vi.resetModules();
        // 此用例专门覆盖模块重载，静态导入无法模拟新页面的模块初始化边界。
        const reloaded = await import('../src/plugins/list-page/batch-lists/service');
        expect(await reloaded.recoverBatchListJobs(vi.fn())).toMatchObject({ total: 1, succeeded: 1, pending: 0 });
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
        expect(vi.mocked(applyBatchListItem).mock.calls[0][0].videoId).toBe('v2');
    });

    it('退避时间未到不自动重试，明确继续可立即恢复', async () => {
        env.seed(pendingJob({ retryAt: Date.now() + 30000 }));
        expect(await recoverBatchListJobs(vi.fn())).toMatchObject({ total: 0, phase: 'done' });
        expect(applyBatchListItem).not.toHaveBeenCalled();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1 });
    });
});

describe('逐视频并发和独立评价', () => {
    it('默认两视频并发：视频一清单不等视频二评价，完成视频才释放槽位', async () => {
        let release!: () => void;
        vi.mocked(drainBatchRatings).mockImplementation(async (targets) => {
            expect(targets).toHaveLength(1);
            if (targets[0].videoId === 'v2') await new Promise<void>((resolve) => { release = resolve; });
            return { total: 1, succeeded: 1, failed: 0 };
        });
        const running = startBatchListJob([item(1), item(2), item(3)], [list, secondList], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(vi.mocked(drainBatchRatings).mock.calls.map(([targets]) => targets[0].videoId)).toEqual(['v1', 'v2']);
        expect(vi.mocked(applyBatchListItem).mock.calls.map(([video, target]) => [video.videoId, target.id])).toEqual([['v1', 'L1'], ['v1', 'L2']]);
        await vi.advanceTimersByTimeAsync(900);
        expect(vi.mocked(drainBatchRatings).mock.calls.map(([targets]) => targets[0].videoId)).toEqual(['v1', 'v2', 'v3']);
        release();
        expect(await running).toMatchObject({ total: 3, succeeded: 3, pending: 0, ratingDone: 3, concurrency: 2 });
        expect(readBatchListJobs()[0].items.every((entry) => entry.ratingsComplete && entry.state === 'success')).toBe(true);
    });

    it.each([[3, 3], [1, 1], [0, 2], ['bad', 2], [99, 4]])('读取并发设置%j并限制到视频数量，实际槽数%d', async (setting, count) => {
        env.getSetting.mockResolvedValue(setting);
        const releases: (() => void)[] = [];
        vi.mocked(applyBatchListItem).mockImplementation(async (video) => {
            if (Number(video.videoId.slice(1)) <= count) await new Promise<void>((resolve) => { releases.push(resolve); });
        });
        const running = startBatchListJob([item(1), item(2), item(3), item(4)], [list], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(env.getSetting).toHaveBeenCalledWith('batchOperationConcurrency');
        expect(applyBatchListItem).toHaveBeenCalledTimes(count);
        for (const release of releases) release();
        expect(await finishTimers(running)).toMatchObject({ succeeded: 4, concurrency: count });
    });

    it('一个视频评价准备异常只保留该视频，其余视频继续完整执行', async () => {
        vi.mocked(prepareBatchRatings).mockImplementationOnce(async (job, persist, _signal, items = job.items) => {
            items[0].rating!.phase = 'applying'; await persist(); throw new Error('本地已写，登记中断');
        });
        expect(await startBatchListJob([item(1), item(2)], [list], true, vi.fn(), undefined, { kind: 'favorite', score: 0 }))
            .toMatchObject({ total: 2, done: 2, succeeded: 1, failed: 1, pending: 1 });
        expect(vi.mocked(applyBatchListItem).mock.calls.map(([video]) => video.videoId)).toEqual(['v2']);
        const before = readBatchListJobs()[0].items[0].rating!;
        expect(before.phase).toBe('applying');
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(readBatchListJobs()[0].items[0].rating?.revision).toBe(before.revision);
        expect(captureBatchRating).toHaveBeenCalledTimes(2);
    });

    it('评价失败已结算仍做该视频所有清单，但整视频不能计成功且恢复不重做清单', async () => {
        vi.mocked(drainBatchRatings).mockResolvedValueOnce({ total: 2, succeeded: 1, failed: 1 });
        expect(await startBatchListJob([item(1)], [list, secondList], true, vi.fn()))
            .toMatchObject({ succeeded: 0, done: 1, failed: 1, pending: 1, ratingTotal: 2, ratingDone: 2, ratingFailed: 1 });
        expect(readBatchListJobs()[0].items[0]).toMatchObject({ state: 'success', ratingsComplete: false });
        expect(applyBatchListItem).toHaveBeenCalledTimes(2);
        vi.mocked(applyBatchListItem).mockClear();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('评价排空异常保留该视频责任，不伪造完成或提前执行其清单', async () => {
        vi.mocked(drainBatchRatings).mockRejectedValueOnce(new Error('评价执行中断'));
        expect(await startBatchListJob([item(1)], [list], true, vi.fn())).toMatchObject({ succeeded: 0, failed: 1, pending: 1 });
        expect(readBatchListJobs()[0]).toMatchObject({ ratingsComplete: false, items: [{ state: 'pending', error: '评价执行中断' }] });
        expect(applyBatchListItem).not.toHaveBeenCalled();
    });

    it('新评价尚未确认不得把清单完成的视频计成功', async () => {
        vi.mocked(finishBatchRatings).mockResolvedValueOnce(undefined);
        expect(await startBatchListJob([item(1)], [list], true, vi.fn(), undefined, { kind: 'watched', score: 2 }))
            .toMatchObject({ succeeded: 0, failed: 1, pending: 1, ratingPending: 1 });
        expect(readBatchListJobs()[0].items[0].operations[0].state).toBe('success');
    });

    it('未选择新评价不捕获/准备新意图，仍排空该视频已有评价', async () => {
        await startBatchListJob([item(1)], [list], true, vi.fn());
        expect(captureBatchRating).not.toHaveBeenCalled();
        expect(prepareBatchRatings).not.toHaveBeenCalled();
        expect(drainBatchRatings).toHaveBeenCalledWith([expect.objectContaining({ videoId: 'v1' })], expect.any(Function), expect.any(AbortSignal));
    });
});

describe('跨任务合并与关联替代', () => {
    it('后续操作仅替代重叠清单，旧视频另一清单和独立评价仍须恢复', async () => {
        const rating = await captureBatchRating(item(1), 'stable-rating');
        env.seed(pendingJob({ lists: [list, secondList], rating: { kind: 'watched', score: 4 }, ratingsComplete: false,
            items: [journalItem(1, { ratingsComplete: false, rating }, [list, secondList])] }));
        await startBatchListJob([item(1)], [list], false, vi.fn());
        expect(readBatchListJobs().find((job) => job.id === 'persisted-job')!.items[0]).toMatchObject({ state: 'pending', ratingsComplete: false,
            operations: [{ listId: 'L1', state: 'superseded' }, { listId: 'L2', state: 'pending' }], rating: { revision: 'stable-rating', phase: 'pending' } });
        vi.mocked(applyBatchListItem).mockClear();
        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(vi.mocked(applyBatchListItem).mock.calls.map(([, target]) => target.id)).toEqual(['L2']);
        expect(readBatchListJobs().find((job) => job.id === 'persisted-job')!.items[0].rating?.phase).toBe('success');
    });

    it('旧worker进度提交不能覆盖等待锁的新任务或它写下的替代标记', async () => {
        let release!: () => void;
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
        const first = startBatchListJob([item(1)], [list, secondList], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        const second = startBatchListJob([item(1)], [list], false, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(readBatchListJobs()).toHaveLength(2);
        release();
        await Promise.all([first, second]);
        const jobs = readBatchListJobs();
        expect(jobs[0].items[0].operations).toMatchObject([{ state: 'superseded' }, { state: 'success' }]);
        expect(jobs[1].items[0].operations).toMatchObject([{ state: 'success' }]);
    });

    it('旧批量等锁后不能用拿锁时刻覆盖较新的详情意图', async () => {
        let release!: () => void;
        vi.mocked(applyBatchListItem).mockImplementation(async (video, target, _desired, token) =>
            isCurrentListIntent(video.videoId, target.id, token!) ? undefined : 'superseded');
        vi.mocked(applyBatchListItem).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
        const first = startBatchListJob([item(2)], [list], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        vi.setSystemTime(Date.now() + 100);
        const second = startBatchListJob([item(1)], [list], true, vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        vi.setSystemTime(Date.now() + 100);
        publishListIntent('v1', 'L1', 'later-native', Date.now(), false, { explicit: true });
        release();
        const [, result] = await Promise.all([first, second]);
        expect(result).toMatchObject({ succeeded: 0, pending: 0, superseded: 1 });
        expect(isCurrentListIntent('v1', 'L1', 'later-native')).toBe(true);
    });

    it('多个恢复任务共享一个视频时占同一槽位，进度分母按视频去重', async () => {
        env.seed(pendingJob({ id: 'first' }),
            pendingJob({ id: 'second', lists: [secondList], items: [journalItem(1, {}, [secondList])] }),
            pendingJob({ id: 'other', items: [journalItem(2)] }));
        let release!: () => void;
        vi.mocked(applyBatchListItem).mockImplementation(async (video, target) => {
            if (video.videoId === 'v1' && target.id === 'L1') await new Promise<void>((resolve) => { release = resolve; });
        });
        const running = recoverBatchListJobs(vi.fn(), true);
        await vi.advanceTimersByTimeAsync(0);
        expect(vi.mocked(applyBatchListItem).mock.calls.map(([video, target]) => [video.videoId, target.id]))
            .toEqual([['v1', 'L1'], ['v2', 'L1']]);
        release();
        expect(await running).toMatchObject({ total: 2, done: 2, succeeded: 2, pending: 0, concurrency: 2 });
        expect(vi.mocked(applyBatchListItem).mock.calls[2][1].id).toBe('L2');
    });

    it('只裁剪已结束历史，不按容量淘汰未完成日志', async () => {
        const completed = Array.from({ length: 25 }, (_, index) => pendingJob({ id: `done-${index}`, items: [successful(index)] }));
        env.seed(...completed, pendingJob({ id: 'old-pending', lists: [secondList], items: [journalItem(1, {}, [secondList])] }));
        await startBatchListJob([item(1)], [list], false, vi.fn());
        expect(readBatchListJobs()).toHaveLength(21);
        expect(readBatchListJobs().some((job) => job.id === 'old-pending')).toBe(true);
    });
});
