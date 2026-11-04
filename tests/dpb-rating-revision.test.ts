// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn(), fetchHtml: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-sync', () => ({ removeFromNonProtectedListsOnWatch: vi.fn() }));
vi.mock('../src/plugins/setting/jhs-sync/sync-common', () => ({
    extractVideoId: (url: string) => url?.match(/\/v\/([^/?#]+)/)?.[1] ?? null,
    postWantToWatch: (id: string) => api.post(id, 'favorite', 0),
    postWatched: (id: string, score: number) => api.post(id, 'watched', score),
    fetchPageHtml: api.fetchHtml,
    findReviewIdInHtml: () => null,
    deleteReview: vi.fn()
}));

import { quickBlock, quickConvertToFav, quickSetHasWatch } from '../src/plugins/detail-page-button/dpb-rating-api';
import type { DetailPageButtonPlugin } from '../src/plugins/detail-page-button-plugin';
import { autoSyncReviewState } from '../src/plugins/detail-page-button/dpb-review-sync';
import { drainBatchRatings, enqueueBatchPush, resetBatchSyncForTest } from '../src/plugins/list-page/lp-batch-sync';
import {
    getOpSyncRecord, setOpSyncStorageForTest, upsertOpSync, type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

let local: { status: string; score: number };
let remote: { kind: string; score: number };
let events: string[];
let disk: OpSyncRecord[];

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

function createPlugin(gate: ReturnType<typeof deferred>) {
    return {
        getPageInfo: () => ({ carNum: 'A', url: '/v/A' }),
        _triggerJavdbReview: vi.fn(async (score: number) => {
            events.push(`详情开始:${score}`);
            await gate.promise;
            remote = { kind: 'watched', score };
            events.push(`详情完成:${score}`);
        }),
        _triggerJavdbWant: vi.fn(async () => {
            events.push('详情开始:收藏');
            await gate.promise;
            remote = { kind: 'favorite', score: 0 };
            events.push('详情完成:收藏');
        }),
        _syncRatingBar: vi.fn(), broadcastWantWatchedSync: vi.fn(), _setRatingBusy: vi.fn(),
        _reviewChain: undefined as Promise<void> | undefined,
        getBean: () => null, showStatus: vi.fn(async () => {})
    };
}

beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    local = { status: 'hasWatch', score: 0 };
    remote = { kind: 'watched', score: 0 };
    events = [];
    disk = [];
    const locks = new Map<string, Promise<unknown>>();
    vi.stubGlobal('navigator', { locks: {
        request: <T>(name: string, _options: unknown, task: () => Promise<T>) => {
            const run = (locks.get(name) ?? Promise.resolve()).then(task);
            locks.set(name, run.then(() => {}, () => {}));
            return run;
        }
    } });
    vi.stubGlobal('storageManager', {
        getCar: vi.fn(async () => local),
        removeCar: vi.fn(async () => {}), clearCarListCache: vi.fn(),
        saveCar: vi.fn(async (input: { actionType: string; score?: number }) => {
            local = { status: input.actionType, score: input.score ?? 0 };
        })
    });
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    vi.stubGlobal('show', { ok: vi.fn(), error: vi.fn() });
    vi.stubGlobal('refresh', vi.fn());
    vi.stubGlobal('utils', { closePage: vi.fn(), q: vi.fn() });
    setOpSyncStorageForTest({ read: () => structuredClone(disk), write: (rows) => { disk = structuredClone(rows); } });
    resetBatchSyncForTest();
    await enqueueBatchPush([], 'favorite', 0, { pacingMs: 0 });
    api.post.mockReset().mockImplementation(async (_id, kind, score) => {
        events.push(`列表完成:${score}`);
        remote = { kind, score };
    });
    api.fetchHtml.mockReset().mockImplementation(async () => `<div class="review-buttons">${remote.kind === 'watched'
        ? `<a href="/users/watched_videos"><span class="tag is-success is-light"></span></a><input name="video_review[score]" checked value="${remote.score}">`
        : '<a href="/users/want_watch_videos"><span class="tag is-info is-light"></span></a>'}</div>`);
});
afterEach(() => {
    resetBatchSyncForTest();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function enqueueFiveStars() {
    local = { status: 'hasWatch', score: 5 };
    await enqueueBatchPush([{ carNum: 'A', url: '/v/A' }], 'watched', 5);
}

describe('详情与列表评价共同执行锁及意图回执', () => {
    it('在途详情2星先完成，列表5星随后实际发送，网站最终不能倒退至2星', async () => {
        const gate = deferred();
        const plugin = createPlugin(gate);
        await quickSetHasWatch(plugin as unknown as DetailPageButtonPlugin, 2);
        await vi.advanceTimersByTimeAsync(0);
        expect(events).toEqual(['详情开始:2']);
        await enqueueFiveStars();
        const run = drainBatchRatings([{ carNum: 'A', url: '/v/A' }]);
        await vi.advanceTimersByTimeAsync(0);
        expect(api.post).not.toHaveBeenCalled();
        gate.resolve();
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(events).toEqual(['详情开始:2', '详情完成:2', '列表完成:5']);
        expect(remote).toEqual({ kind: 'watched', score: 5 });
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ score: 5, state: 'success', origin: 'list' });
    });

    it('详情A网络未返回时，列表B已完成评价且不改变A的待确认账本', async () => {
        const gate = deferred();
        const plugin = createPlugin(gate);
        await quickSetHasWatch(plugin as unknown as DetailPageButtonPlugin, 2);
        await vi.advanceTimersByTimeAsync(0);
        expect(events).toEqual(['详情开始:2']);
        await enqueueBatchPush([{ carNum: 'B', url: '/v/B' }], 'watched', 2);
        expect(await drainBatchRatings([{ carNum: 'B', url: '/v/B' }])).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('success');
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('running');
        expect(events).toEqual(['详情开始:2', '列表完成:2']);
        gate.resolve();
        await plugin._reviewChain;
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('success');
        expect(getOpSyncRecord('B', 'watched')?.state).toBe('success');
        await vi.runAllTimersAsync();
    });

    it('详情旧2星尚在自身队列时，列表5星成功后旧请求不再发送', async () => {
        const previous = deferred();
        const gate = deferred(); gate.resolve();
        const plugin = createPlugin(gate);
        plugin._reviewChain = previous.promise;
        await quickSetHasWatch(plugin as unknown as DetailPageButtonPlugin, 2);
        await enqueueFiveStars();
        await drainBatchRatings([{ carNum: 'A', url: '/v/A' }]);
        previous.resolve();
        await plugin._reviewChain;
        expect(plugin._triggerJavdbReview).not.toHaveBeenCalled();
        expect(remote.score).toBe(5);
        expect(events).toEqual(['列表完成:5']);
    });

    it('详情旧请求失败回执不把列表新5星记录标成failed', async () => {
        const gate = deferred();
        const plugin = createPlugin(gate);
        await quickSetHasWatch(plugin as unknown as DetailPageButtonPlugin, 2);
        await vi.advanceTimersByTimeAsync(0);
        await enqueueFiveStars();
        gate.reject(new Error('旧请求失败'));
        await plugin._reviewChain;
        expect(getOpSyncRecord('A', 'watched')).toMatchObject({ score: 5, state: 'pending' });
        await drainBatchRatings([{ carNum: 'A', url: '/v/A' }]);
        expect(remote.score).toBe(5);
    });

    it('同类型详情收藏在途回执不覆盖后来登记的新收藏', async () => {
        const gate = deferred();
        const plugin = createPlugin(gate);
        await quickConvertToFav(plugin as unknown as DetailPageButtonPlugin);
        await vi.advanceTimersByTimeAsync(0);
        const newer = upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'favorite', origin: 'list' });
        gate.resolve();
        await plugin._reviewChain;
        expect(getOpSyncRecord('A', 'favorite')).toMatchObject({ revision: newer.revision, state: 'pending' });
    });

    it('拉黑在途回执同样绑定revision，不能覆盖较新的同类型记录', async () => {
        const gate = deferred();
        const plugin = createPlugin(gate);
        let confirmed: Promise<void> | undefined;
        vi.stubGlobal('utils', {
            closePage: vi.fn(), q: (_title: unknown, _content: unknown, confirm: () => Promise<void>) => { confirmed = confirm(); }
        });
        await quickBlock(plugin as unknown as DetailPageButtonPlugin);
        await confirmed;
        await vi.advanceTimersByTimeAsync(0);
        const newer = upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'filter', origin: 'list' });
        gate.resolve();
        await plugin._reviewChain;
        expect(getOpSyncRecord('A', 'filter')).toMatchObject({ revision: newer.revision, state: 'pending' });
    });

    it('旧收藏与新已读类型不同也会跳过旧请求，避免网站从5星退回想看', async () => {
        const previous = deferred();
        const gate = deferred(); gate.resolve();
        const plugin = createPlugin(gate);
        plugin._reviewChain = previous.promise;
        await quickConvertToFav(plugin as unknown as DetailPageButtonPlugin);
        await enqueueFiveStars();
        await drainBatchRatings([{ carNum: 'A', url: '/v/A' }]);
        previous.resolve();
        await plugin._reviewChain;
        expect(plugin._triggerJavdbWant).not.toHaveBeenCalled();
        expect(remote).toEqual({ kind: 'watched', score: 5 });
        expect(getOpSyncRecord('A', 'favorite')?.state).toBe('cancelled');
    });
    it('新详情页自动对账等待在途批量评价，并按新鲜网站状态跳过重复提交', async () => {
        const pending = deferred();
        const activePage = createPlugin(pending);
        const immediate = deferred(); immediate.resolve();
        const newPage = createPlugin(immediate);
        document.body.innerHTML = '<div class="review-buttons"></div>';
        await quickSetHasWatch(activePage as unknown as DetailPageButtonPlugin, 4);
        await vi.advanceTimersByTimeAsync(0);
        const reconciliation = autoSyncReviewState(newPage as unknown as DetailPageButtonPlugin);
        await vi.advanceTimersByTimeAsync(0);
        try {
            expect(newPage._triggerJavdbReview).not.toHaveBeenCalled();
        } finally {
            pending.resolve();
            await activePage._reviewChain;
            await reconciliation;
        }
        expect(newPage._triggerJavdbReview).not.toHaveBeenCalled();
        expect(remote).toEqual({ kind: 'watched', score: 4 });
    });

    it('自动对账等待期间本地出现新评分，不按旧快照覆盖后续明确操作', async () => {
        const pending = deferred();
        const activePage = createPlugin(pending);
        const immediate = deferred(); immediate.resolve();
        const newPage = createPlugin(immediate);
        document.body.innerHTML = '<div class="review-buttons"></div>';
        await quickSetHasWatch(activePage as unknown as DetailPageButtonPlugin, 2);
        await vi.advanceTimersByTimeAsync(0);
        const reconciliation = autoSyncReviewState(newPage as unknown as DetailPageButtonPlugin);
        await vi.advanceTimersByTimeAsync(0);
        await enqueueFiveStars();
        const latest = drainBatchRatings([{ carNum: 'A', url: '/v/A' }]);
        pending.resolve();
        await vi.runAllTimersAsync();
        await Promise.all([activePage._reviewChain, reconciliation, latest]);
        expect(newPage._triggerJavdbReview).not.toHaveBeenCalled();
        expect(remote).toEqual({ kind: 'watched', score: 5 });
    });
});
