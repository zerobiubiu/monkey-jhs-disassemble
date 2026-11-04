// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpSyncRecord } from '../src/plugins/setting/jhs-sync/op-sync-records';
import type * as BatchQueue from '../src/plugins/list-page/lp-batch-sync';
import type * as RatingLedger from '../src/plugins/setting/jhs-sync/op-sync-records';

const api = vi.hoisted(() => ({ post: vi.fn(), fetchHtml: vi.fn() }));
vi.mock('../src/plugins/setting/jhs-sync/sync-common', () => ({
    extractVideoId: (url: string) => url?.match(/\/v\/([^/?#]+)/)?.[1] ?? null,
    postWantToWatch: (id: string) => api.post(id, 'favorite', 0),
    postWatched: (id: string, score: number) => api.post(id, 'watched', score),
    fetchPageHtml: api.fetchHtml,
    findReviewIdInHtml: () => null,
    deleteReview: vi.fn()
}));

type Context = {
    queue: typeof BatchQueue;
    ledger: typeof RatingLedger;
};
let contexts: Context[];
let disk: OpSyncRecord[];
const local = new Map<string, { status: string; score: number }>();
const server = new Map<string, { kind: string; score: number }>();
const target = (id: string) => [{ carNum: id, url: `/v/${id}` }];

/** 刻意重新加载模块模拟独立页面缓存，静态导入会共享队列而掩盖跨页锁缺失。 */
async function createContext(): Promise<Context> {
    vi.resetModules();
    const ledger = await import('../src/plugins/setting/jhs-sync/op-sync-records');
    ledger.setOpSyncStorageForTest({ read: () => structuredClone(disk), write: (rows) => { disk = structuredClone(rows); } });
    const queue = await import('../src/plugins/list-page/lp-batch-sync');
    await queue.enqueueBatchPush([], 'favorite', 0, { pacingMs: 0 });
    const context = { queue, ledger };
    contexts.push(context);
    return context;
}

beforeEach(() => {
    vi.useFakeTimers();
    contexts = []; disk = []; local.clear(); server.clear();
    const locks = new Map<string, Promise<unknown>>();
    vi.stubGlobal('navigator', { locks: {
        request: <T>(name: string, _options: unknown, task: () => Promise<T>) => {
            const run = (locks.get(name) ?? Promise.resolve()).then(task);
            locks.set(name, run.then(() => {}, () => {}));
            return run;
        }
    } });
    vi.stubGlobal('storageManager', { clearCarListCache: vi.fn(), getCar: vi.fn(async (id: string) => local.get(id)) });
    vi.stubGlobal('clog', { warn: vi.fn() });
    vi.stubGlobal('show', { ok: vi.fn(), error: vi.fn() });
    api.post.mockReset();
    api.fetchHtml.mockReset().mockImplementation(async (url: string) => {
        const state = server.get(url.slice(3));
        return `<div class="review-buttons">${state?.kind === 'watched'
            ? `<a href="/users/watched_videos"><span class="tag is-success is-light"></span></a><input name="video_review[score]" checked value="${state.score}">`
            : ''}</div>`;
    });
});
afterEach(() => {
    for (const context of contexts) {
        context.queue.stopBatchSync();
        context.ledger.setOpSyncStorageForTest(null);
    }
    vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('跨上下文逐影片评价并发', () => {
    it('两个影片同时进入真实推送，先完成的B立即返回且不丢失A的运行记录', async () => {
        const firstPage = await createContext(); const secondPage = await createContext();
        for (const id of ['A', 'B']) {
            local.set(id, { status: 'hasWatch', score: 4 });
            firstPage.ledger.upsertOpSync({ ...target(id)[0], kind: 'watched', score: 4 });
        }
        const release = new Map<string, () => void>();
        api.post.mockImplementation((id, kind, score) => {
            const { promise, resolve } = Promise.withResolvers<void>();
            release.set(id, () => { server.set(id, { kind, score }); resolve(); });
            return promise;
        });
        const progressA = vi.fn(); const progressB = vi.fn();
        const first = firstPage.queue.drainBatchRatings(target('A'), progressA);
        const second = secondPage.queue.drainBatchRatings(target('B'), progressB);
        await vi.advanceTimersByTimeAsync(0);
        expect([...release.keys()].sort()).toEqual(['A', 'B']);
        expect(disk.every((record) => record.state === 'running')).toBe(true);
        release.get('B')!();
        expect(await second).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(firstPage.ledger.getOpSyncRecord('A', 'watched')?.state).toBe('running');
        expect(firstPage.ledger.getOpSyncRecord('B', 'watched')?.state).toBe('success');
        release.get('A')!();
        expect(await first).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(secondPage.ledger.listOpSyncRecords()).toHaveLength(2);
        expect(disk.every((record) => record.state === 'success')).toBe(true);
        expect(progressA).toHaveBeenLastCalledWith(1, 1, 0);
        expect(progressB).toHaveBeenLastCalledWith(1, 1, 0);
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it('两个页面接管同一个影片意图只提交一次，两侧都取得持久成功回执', async () => {
        const firstPage = await createContext(); const secondPage = await createContext();
        local.set('A', { status: 'hasWatch', score: 4 });
        firstPage.ledger.upsertOpSync({ ...target('A')[0], kind: 'watched', score: 4 });
        let release!: () => void;
        api.post.mockImplementation((id, kind, score) => {
            const { promise, resolve } = Promise.withResolvers<void>();
            release = () => { server.set(id, { kind, score }); resolve(); };
            return promise;
        });
        const first = firstPage.queue.drainBatchRatings(target('A'));
        const second = secondPage.queue.drainBatchRatings(target('A'));
        await vi.advanceTimersByTimeAsync(0);
        expect(api.post).toHaveBeenCalledTimes(1);
        release();
        expect(await first).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(await second).toEqual({ total: 1, succeeded: 1, failed: 0 });
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(secondPage.ledger.getOpSyncRecord('A', 'watched')?.state).toBe('success');
    });

    it('旧影片网络未完成时可持久登记新星级，但必须等待旧请求再提交新意图', async () => {
        const firstPage = await createContext(); const secondPage = await createContext();
        local.set('A', { status: 'hasWatch', score: 2 });
        firstPage.ledger.upsertOpSync({ ...target('A')[0], kind: 'watched', score: 2 });
        const releases: Array<() => void> = [];
        api.post.mockImplementation((id, kind, score) => {
            const { promise, resolve } = Promise.withResolvers<void>();
            releases.push(() => { server.set(id, { kind, score }); resolve(); });
            return promise;
        });
        const first = firstPage.queue.drainBatchRatings(target('A'));
        await vi.advanceTimersByTimeAsync(0);
        expect(api.post).toHaveBeenCalledExactlyOnceWith('A', 'watched', 2);
        local.set('A', { status: 'hasWatch', score: 5 });
        await secondPage.queue.enqueueBatchPush(target('A'), 'watched', 5);
        const second = secondPage.queue.drainBatchRatings(target('A'));
        await vi.advanceTimersByTimeAsync(0);
        expect(firstPage.ledger.getOpSyncRecord('A', 'watched')).toMatchObject({ score: 5, state: 'pending' });
        expect(api.post).toHaveBeenCalledTimes(1);
        releases[0]();
        await vi.advanceTimersByTimeAsync(0);
        expect(api.post).toHaveBeenCalledTimes(2);
        expect(api.post).toHaveBeenLastCalledWith('A', 'watched', 5);
        releases[1]();
        await vi.runAllTimersAsync();
        await Promise.all([first, second]);
        expect(server.get('A')).toEqual({ kind: 'watched', score: 5 });
        expect(firstPage.ledger.getOpSyncRecord('A', 'watched')).toMatchObject({ score: 5, state: 'success' });
        expect(api.post).toHaveBeenCalledTimes(2);
    });
});
