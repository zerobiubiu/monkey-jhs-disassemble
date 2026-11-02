// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn(), fetchHtml: vi.fn(), deleteReview: vi.fn(), findReviewId: vi.fn() }));
vi.mock('../src/plugins/setting/jhs-sync/sync-common', () => ({
    extractVideoId: (url: string) => url?.match(/\/v\/([^/?#]+)/)?.[1] ?? null,
    postWantToWatch: (id: string) => api.post(id, 'favorite', 0),
    postWatched: (id: string, score: number) => api.post(id, 'watched', score),
    fetchPageHtml: api.fetchHtml,
    findReviewIdInHtml: api.findReviewId,
    deleteReview: api.deleteReview
}));

import {
    cancelOpSync, drainBatchRatings, enqueueBatchPush, getBatchSyncStatus, resetBatchSyncForTest, stopBatchSync
} from '../src/plugins/list-page/lp-batch-sync';
import {
    getOpSyncRecord, listOpSyncRecords, setOpSyncState, setOpSyncStorageForTest, upsertOpSync,
    type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

const local = new Map<string, { status: string; score?: number }>();
const server = new Map<string, { kind: string; score: number }>();
let disk: OpSyncRecord[];

const targets = (...carNums: string[]) => carNums.map((carNum) => ({ carNum, url: `/v/${carNum}` }));

function html(id: string): string {
    const state = server.get(id);
    return `<div class="review-buttons">${state?.kind === 'favorite'
        ? '<a href="/users/want_watch_videos"><span class="tag is-info is-light"></span></a>'
        : state?.kind === 'watched'
          ? `<a href="/users/watched_videos"><span class="tag is-success is-light"></span></a><input name="video_review[score]" checked value="${state.score}">`
          : ''}</div>`;
}

function register(carNum: string, state: 'pending' | 'running' | 'failed' = 'pending', score = 4): OpSyncRecord {
    local.set(carNum, { status: 'hasWatch', score });
    const record = upsertOpSync({ carNum, url: `/v/${carNum}`, kind: 'watched', score });
    setOpSyncState(carNum, 'watched', state);
    return record;
}

beforeEach(() => {
    vi.useFakeTimers();
    disk = [];
    local.clear();
    server.clear();
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    vi.stubGlobal('show', { ok: vi.fn(), error: vi.fn() });
    vi.stubGlobal('storageManager', {
        clearCarListCache: vi.fn(), getCar: vi.fn(async (carNum: string) => local.get(carNum))
    });
    setOpSyncStorageForTest({
        read: () => structuredClone(disk), write: (records) => { disk = structuredClone(records); }
    });
    resetBatchSyncForTest();
    enqueueBatchPush([], 'favorite', 0, { pacingMs: 0 });
    api.post.mockReset().mockImplementation(async (id, kind, score) => { server.set(id, { kind, score }); });
    api.fetchHtml.mockReset().mockImplementation(async (url: string) => html(url.slice(3)));
    api.findReviewId.mockReset().mockReturnValue(null);
    api.deleteReview.mockReset().mockImplementation(async (id: string) => { server.delete(id); });
});
afterEach(() => {
    stopBatchSync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('批量清单前的评价排空', () => {
    it('停止信号已触发时不读取或修改目标账本，不发出目标网站请求', async () => {
        register('A');
        const previous = structuredClone(disk);
        const controller = new AbortController(); controller.abort();
        expect(await drainBatchRatings(targets('A'), undefined, controller.signal)).toEqual({
            total: 0, succeeded: 0, failed: 0, stopped: true
        });
        expect(disk).toEqual(previous);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('等待共享执行锁时停止，获得锁后也不会新发目标请求', async () => {
        register('A');
        let release!: () => void;
        vi.stubGlobal('navigator', { locks: {
            request: <T>(_name: string, _options: unknown, task: () => Promise<T>) => new Promise<T>((resolve, reject) => {
                release = () => { task().then(resolve, reject); };
            })
        } });
        const controller = new AbortController();
        const run = drainBatchRatings(targets('A'), undefined, controller.signal);
        controller.abort();
        release();
        expect(await run).toEqual({ total: 0, succeeded: 0, failed: 0, stopped: true });
        expect(api.post).not.toHaveBeenCalled();
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('pending');
    });

    it('取消已读的前置GET期间停止，返回reviewId后不得新发删除POST或假记成功', async () => {
        local.set('A', { status: '' });
        server.set('A', { kind: 'watched', score: 3 });
        const record = upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'unwatch' });
        api.findReviewId.mockReturnValue('42');
        let releaseGet!: () => void;
        api.fetchHtml.mockImplementationOnce(() => new Promise<string>((resolve) => {
            releaseGet = () => resolve(html('A'));
        }));
        const controller = new AbortController();
        const run = drainBatchRatings(targets('A'), undefined, controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        expect(api.fetchHtml).toHaveBeenCalledTimes(1);
        controller.abort();
        releaseGet();
        expect(await run).toEqual({ total: 0, succeeded: 0, failed: 0, stopped: true });
        expect(api.deleteReview).not.toHaveBeenCalled();
        expect(api.post).not.toHaveBeenCalled();
        expect(api.fetchHtml).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord('A', 'unwatch')).toMatchObject({
            revision: record.revision, state: 'pending', attempts: 0
        });
        expect(server.get('A')).toEqual({ kind: 'watched', score: 3 });
    });

    it('删除POST已经发出后停止，仍等待删除回执和网站回读成功再落账', async () => {
        local.set('A', { status: '' });
        server.set('A', { kind: 'watched', score: 3 });
        upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'unwatch' });
        api.findReviewId.mockReturnValue('42');
        let releaseDelete!: () => void;
        api.deleteReview.mockImplementationOnce(() => new Promise<void>((resolve) => {
            releaseDelete = () => { server.delete('A'); resolve(); };
        }));
        const controller = new AbortController();
        const run = drainBatchRatings(targets('A'), undefined, controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        expect(api.deleteReview).toHaveBeenCalledExactlyOnceWith('A', '42');
        controller.abort();
        releaseDelete();
        expect(await run).toEqual({ total: 1, succeeded: 1, failed: 0, stopped: true });
        expect(api.fetchHtml).toHaveBeenCalledTimes(2);
        expect(api.deleteReview).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord('A', 'unwatch')?.state).toBe('success');
    });

    it('在途目标正常回查落账后停止，不再处理下个目标；无关后台不停止', async () => {
        register('A'); register('C');
        const controller = new AbortController();
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('A', { kind: 'watched', score: 4 }); resolve(); };
        }));
        const run = drainBatchRatings(targets('A', 'C'), undefined, controller.signal);
        await Promise.resolve(); await Promise.resolve();
        controller.abort();
        enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 3);
        release();
        expect(await run).toEqual({ total: 1, succeeded: 1, failed: 0, stopped: true });
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('success');
        expect(getOpSyncRecord('C', 'watched')?.state).toBe('pending');
        expect(api.post).not.toHaveBeenCalledWith('C', expect.anything(), expect.anything());
        await vi.runAllTimersAsync();
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('success');
    });

    it('本次请求失败时若已停止，则保留实际失败记录且不启动重试', async () => {
        register('A');
        const controller = new AbortController();
        api.post.mockImplementationOnce(async () => { controller.abort(); throw new Error('网站尚未成功'); });
        expect(await drainBatchRatings(targets('A'), undefined, controller.signal)).toEqual({
            total: 1, succeeded: 0, failed: 1, stopped: true
        });
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ state: 'failed', attempts: 1 });
    });

    it('在重试节流期间停止能及时退出，不改写未完成评价为已取消', async () => {
        register('A');
        enqueueBatchPush([], 'favorite', 0, { pacingMs: 10_000 });
        const controller = new AbortController();
        api.post.mockRejectedValue(new Error('等待恢复'));
        const run = drainBatchRatings(targets('A'), undefined, controller.signal);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        expect(await run).toEqual({ total: 1, succeeded: 0, failed: 1, stopped: true });
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('failed');
    });

    it('开始回调中停止时恢复原后台评价队列，不永久取消用户评价意图', async () => {
        local.set('A', { status: 'hasWatch', score: 4 });
        enqueueBatchPush([{ carNum: 'A', url: '/v/A' }], 'watched', 4);
        const controller = new AbortController();
        expect(await drainBatchRatings(targets('A'), () => controller.abort(), controller.signal)).toEqual({
            total: 0, succeeded: 0, failed: 0, stopped: true
        });
        expect(api.post).not.toHaveBeenCalled();
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('pending');
        await vi.runAllTimersAsync();
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 4);
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('success');
    });

    it('只恢复本次目标；无关失败和待处理记录保持原样，不校验或取消', async () => {
        register('A'); register('B', 'failed'); register('C', 'running');
        local.set('B', { status: 'favorite' });
        const previous = structuredClone(disk.filter((row) => row.carNum !== 'A'));
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 4);
        expect(disk.filter((row) => row.carNum !== 'A')).toEqual(previous);
    });

    it('无关后台队列在目标补同步的节流间隙继续推进，且不计入目标进度', async () => {
        register('A'); register('C');
        local.set('B', { status: 'hasWatch', score: 3 });
        enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 3, { pacingMs: 100 });
        let finished = false;
        const progress = vi.fn();
        const run = drainBatchRatings(targets('A', 'C'), progress).then((result) => { finished = true; return result; });
        await vi.advanceTimersByTimeAsync(0);
        expect(finished).toBe(false);
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('success');
        expect(getOpSyncRecord('C', 'watched')?.state).toBe('pending');
        expect(progress).toHaveBeenCalledWith(1, 2, 0);
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 2, succeeded: 2, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(3);
    });

    it('目标接管剩余队列后，无关在途后台批次正常收尾，统计不混入下一批', async () => {
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('B', { kind: 'watched', score: 3 }); resolve(); };
        }));
        local.set('B', { status: 'hasWatch', score: 3 });
        enqueueBatchPush(targets('B'), 'watched', 3);
        await vi.advanceTimersByTimeAsync(0);
        local.set('A', { status: 'hasWatch', score: 4 });
        local.set('C', { status: 'hasWatch', score: 4 });
        enqueueBatchPush(targets('A', 'C'), 'watched', 4, { pacingMs: 100 });
        const run = drainBatchRatings(targets('A', 'C'));
        release();
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 2, succeeded: 2, failed: 0 });
        expect(show.ok).toHaveBeenCalledWith('后台同步 JavDB 完成：成功 1 项，失败 0 项');
        expect(getBatchSyncStatus().succeeded).toBe(0);
        enqueueBatchPush(targets('D'), 'watched', 1);
        await vi.runAllTimersAsync();
        expect(show.ok).toHaveBeenLastCalledWith('后台同步 JavDB 完成：成功 1 项，失败 0 项');
    });

    it('期间新入队的无关视频留在后台，不会扩大本次同步范围', async () => {
        register('A');
        api.post.mockImplementationOnce(async (id, kind, score) => {
            server.set(id, { kind, score });
            local.set('B', { status: 'hasWatch', score: 2 });
            enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 2);
        });
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('pending');
        expect(api.post).toHaveBeenCalledTimes(1);
        await vi.runAllTimersAsync();
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('success');
    });

    it('目标网络等待期间无关后台登记仍采用原有持久化降级，不继承目标严格模式', async () => {
        register('A');
        vi.stubGlobal('GM_getValue', () => JSON.stringify(disk));
        vi.stubGlobal('GM_setValue', (_key: string, value: string) => {
            const rows = JSON.parse(value) as OpSyncRecord[];
            if (rows.some((row) => row.carNum === 'B')) throw new Error('无关任务写入暂时失败');
            disk = rows;
        });
        setOpSyncStorageForTest(null);
        api.post.mockImplementationOnce(async (id, kind, score) => {
            expect(() => enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 3)).not.toThrow();
            server.set(id, { kind, score });
        });
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        await vi.runAllTimersAsync();
    });

    it.each(['list', 'detail'] as const)('无目标评价时不等待正在执行的无关视频（来源%s）', async (origin) => {
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('B', { kind: 'watched', score: 3 }); resolve(); };
        }));
        enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 3, { origin });
        await vi.advanceTimersByTimeAsync(0);
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('running');
        release();
        await vi.runAllTimersAsync();
    });

    it.each(['pending', 'running', 'failed'] as const)('目标视频的详情来源评价也必须同步完成（%s）', async (state) => {
        register('A');
        upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'watched', score: 4, origin: 'detail' });
        setOpSyncState('A', 'watched', state);
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ state: 'success', origin: 'detail' });
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 4);
    });

    it('两个不同目标范围的调用独立执行，不复用同一排空结果', async () => {
        register('A', 'failed'); register('B', 'failed');
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('A', { kind: 'watched', score: 4 }); resolve(); };
        }));
        const progressA = vi.fn(); const progressB = vi.fn();
        const first = drainBatchRatings(targets('A'), progressA);
        const second = drainBatchRatings(targets('B'), progressB);
        expect(first).not.toBe(second);
        await Promise.resolve(); await Promise.resolve();
        release();
        expect(await first).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(await second).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(2);
        expect(progressA).toHaveBeenLastCalledWith(1, 1, 0);
        expect(progressB).toHaveBeenLastCalledWith(1, 1, 0);
    });

    it('两边都有videoId时优先按ID，番号相同但网站ID不同的不接管', async () => {
        register('A', 'failed');
        expect(await drainBatchRatings([{ carNum: 'A', url: '/v/other' }])).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('failed');
        expect(await drainBatchRatings([{ carNum: '别名', url: '/v/A' }])).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 4);
    });

    it('一侧缺网站ID时按统一trim及大小写归一化番号回退', async () => {
        register('A');
        expect(await drainBatchRatings([{ carNum: ' a ', url: '' }])).toEqual({ total: 1, succeeded: 1, failed: 0 });
    });

    it('重叠目标范围等待同一网站操作，两次独立统计都成功但不重复POST', async () => {
        register('A');
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('A', { kind: 'watched', score: 4 }); resolve(); };
        }));
        const first = drainBatchRatings(targets('A'));
        const second = drainBatchRatings(targets('A'));
        await Promise.resolve(); await Promise.resolve();
        release();
        expect(await first).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(await second).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('目标在读取待办后被其他标签页确认，仍计成功且不重复POST', async () => {
        register('A', 'running');
        let reads = 0;
        setOpSyncStorageForTest({
            read: () => {
                if (++reads === 2) disk[0].state = 'success';
                return structuredClone(disk);
            },
            write: (rows) => { disk = structuredClone(rows); }
        });
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).not.toHaveBeenCalled();
    });

    it('恢复 pending/running/failed；不依赖自动同步开关，不创作新意图', async () => {
        register('A', 'pending'); register('B', 'running'); register('C', 'failed');
        const run = drainBatchRatings(targets('A', 'B', 'C'));
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 3, succeeded: 3, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(3);
        expect(listOpSyncRecords().every((row) => row.state === 'success')).toBe(true);
    });

    it('等待已经在途的后台请求，且不会重发同一项', async () => {
        local.set('A', { status: 'hasWatch', score: 4 });
        let release!: () => void;
        api.post.mockImplementationOnce(() => new Promise<void>((resolve) => {
            release = () => { server.set('A', { kind: 'watched', score: 4 }); resolve(); };
        }));
        enqueueBatchPush([{ carNum: 'A', url: '/v/A' }], 'watched', 4);
        await vi.advanceTimersByTimeAsync(0);
        let finished = false;
        const run = drainBatchRatings(targets('A')).then((result) => { finished = true; return result; });
        await Promise.resolve();
        expect(finished).toBe(false);
        release();
        expect(await run).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('success');
    });

    it('取消记录和无关视频的详情来源记录不被补推', async () => {
        register('A'); cancelOpSync('A', 'watched');
        upsertOpSync({ carNum: 'B', url: '/v/B', kind: 'favorite', origin: 'detail' });
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(api.post).not.toHaveBeenCalled();
    });

    it('过滤旧收藏意图，只推最新的本地已读星级', async () => {
        upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'favorite' });
        register('A', 'pending', 5);
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 5);
        expect(getOpSyncRecord('A', 'favorite')?.state).toBe('cancelled');
    });

    it('本地评价已被修改且没有新登记时，不恢复旧星级', async () => {
        register('A'); local.set('A', { status: 'favorite' });
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(api.post).not.toHaveBeenCalled();
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('cancelled');
    });

    it('HTTP 返回但网站回读不匹配时，不伪装成功并保留失败记录', async () => {
        register('A'); api.post.mockResolvedValue(undefined);
        const run = drainBatchRatings(targets('A'));
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 1, succeeded: 0, failed: 1 });
        expect(api.post).toHaveBeenCalledTimes(2);
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ state: 'failed', attempts: 2 });
    });

    it('登录页或无评价区域的 HTML 不算已同步', async () => {
        register('A'); api.fetchHtml.mockResolvedValue('<form action="/login"></form>');
        const run = drainBatchRatings(targets('A'));
        await vi.runAllTimersAsync();
        expect((await run).failed).toBe(1);
        expect(getOpSyncRecord('A', 'watched')?.error).toContain('有效的网站评价状态');
    });

    it('补同步期间目标范围内新入队的评价在同一次排空中完成', async () => {
        register('A');
        api.post.mockImplementationOnce(async (id, kind, score) => {
            server.set(id, { kind, score });
            local.set('B', { status: 'hasWatch', score: 2 });
            enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 2);
        });
        const run = drainBatchRatings(targets('A', 'B'));
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 2, succeeded: 2, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it('旧回执不会把同番号的新评分记录改成 success', async () => {
        register('A');
        api.post.mockImplementationOnce(async (id, kind, score) => {
            server.set(id, { kind, score });
            register('A', 'pending', 5);
        });
        const run = drainBatchRatings(targets('A'));
        await vi.runAllTimersAsync();
        await run;
        expect(api.post).toHaveBeenCalledTimes(2);
        expect(api.post).toHaveBeenLastCalledWith('A', 'watched', 5);
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ state: 'success', score: 5 });
    });

    it('另一个标签页从 GM 取消后，旧内存缓存不重新推送', async () => {
        register('A'); listOpSyncRecords();
        disk[0].state = 'cancelled';
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(api.post).not.toHaveBeenCalled();
    });

    it('缺少 videoId 被明确计为失败', async () => {
        register('A'); disk[0].url = '';
        expect(await drainBatchRatings(targets('A'))).toEqual({ total: 1, succeeded: 0, failed: 1 });
        expect(getOpSyncRecord('A', 'watched')?.error).toContain('videoId');
    });

    it('账本读失败会拒绝排空，而非返回零项已完成', async () => {
        setOpSyncStorageForTest({
            read: () => { throw new Error('读盘失败'); }, write: () => {}
        });
        await expect(drainBatchRatings(targets('A'))).rejects.toThrow('读盘失败');
        expect(api.post).not.toHaveBeenCalled();
    });

    it('账本running未落盘会阻止发请求，不能返回排空完成', async () => {
        register('A');
        setOpSyncStorageForTest({ read: () => structuredClone(disk), write: () => {} });
        await expect(drainBatchRatings(targets('A'))).rejects.toThrow('回读不一致');
        expect(api.post).not.toHaveBeenCalled();
    });
});
