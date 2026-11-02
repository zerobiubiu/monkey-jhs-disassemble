// @vitest-environment jsdom
/** 真实自动补推与清单写事务在最新明确意图面前必须服从，不能反向重放旧关联。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListReconcileSnapshot, MovieRecord } from '../src/plugins/video-lists-tag/vlt-db';
import type { VltState } from '../src/plugins/video-lists-tag/db/vlt-db-core';
import { isCurrentListIntent, publishListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';

let local: VltState;
let fetched: ListReconcileSnapshot;
let lockHook: (() => void) | null;
let beforeWrite: (() => void) | null;
let post: ReturnType<typeof vi.fn>;
let queue: ReturnType<typeof vi.fn>;
let reconcile: typeof import('../src/plugins/video-lists-tag/vlt-reconcile');
let database: typeof import('../src/plugins/video-lists-tag/vlt-db');

vi.mock('../src/plugins/video-lists-tag/db/vlt-db-core', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    withState: vi.fn(async (mode: string, task: (state: VltState) => unknown) => {
        if (mode === 'readwrite') beforeWrite?.();
        return task(local);
    })
}));
vi.mock('../src/plugins/video-lists-tag/server/vlt-reconcile-snapshot', () => ({
    fetchCompleteListSnapshot: vi.fn(async () => structuredClone(fetched))
}));
vi.mock('../src/plugins/video-lists-tag/server/vlt-server-api', () => ({
    postJavdbListMutation: (...args: unknown[]) => post(...args)
}));
vi.mock('../src/plugins/video-lists-tag/vlt-lock-queue', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    enqueueAssociationTask: (...args: unknown[]) => queue(...args)
}));
vi.mock('../src/plugins/video-lists-tag/vlt-toast', () => ({ showToast: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-helpers', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    getMovieInfo: vi.fn(() => ({ designation: 'TEST-001', info: { href: 'https://javdb.com/v/v1' } })),
    setListDisplayedCount: vi.fn()
}));

const movie = (id = 'v1', designation = 'TEST-001'): MovieRecord => ({
    designation, href: `https://javdb.com/v/${id}`, title: '', coverSrc: '', score: 0,
    releaseDate: '', createdAt: '', series: 'TEST', code: '001'
});

beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    document.body.innerHTML = '<div id="modal-save-list"><label><input type="checkbox" data-list-id="L1" data-action="change->list#listCheckboxChanged" value="v1">清单一<span>(0)</span></label></div>';
    // jsdom 的 location 无法直接替换 origin，意图记录按其真实 origin 隔离即可。
    window.history.replaceState({}, '', '/v/v1');
    const values = new Map<string, unknown>();
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => values.get(key) ?? fallback);
    vi.stubGlobal('GM_setValue', (key: string, value: unknown) => { values.set(key, value); });
    vi.stubGlobal('clog', { error: vi.fn(), warn: vi.fn(), log: vi.fn() });
    local = {
        movies: { 'TEST-001': movie() },
        inventory: { L1: { listId: 'L1', name: '清单一', url: '/lists/L1', count: 1, style: null } },
        movieInventory: { 'TEST-001::L1': true },
        meta: { epoch: 0, listRevisions: {} }
    };
    fetched = { listId: 'L1', name: '清单一', url: '/lists/L1', expectedCount: 0, movies: [] };
    lockHook = null;
    beforeWrite = null;
    post = vi.fn(async () => ({ kind: 'confirmed', message: 'ok' }));
    queue = vi.fn(async (_key: string, task: () => Promise<void>) => { lockHook?.(); await task(); });
    reconcile = await import('../src/plugins/video-lists-tag/vlt-reconcile');
    database = await import('../src/plugins/video-lists-tag/vlt-db');
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function runAutomatic(): Promise<void> {
    reconcile.setAutoReconcileDelay(1);
    reconcile.setupAutomaticListReconciliation('TEST-001');
    await vi.advanceTimersByTimeAsync(2);
}

describe('旧本地快照自动补推', () => {
    it('逻辑组占位不允许旧本地关联自动补推加入', async () => {
        publishListIntent('v1', 'L1', 'group-placeholder', Date.now(), true, { supersedeOnly: true });
        await runAutomatic();
        expect(post).not.toHaveBeenCalled();
    });
    it('最新意图是移出时，真实自动检查不会把旧本地关联补推为加入', async () => {
        publishListIntent('v1', 'L1', 'remove-new', Date.now(), false, { explicit: true });
        await runAutomatic();
        expect(queue).toHaveBeenCalledWith('video:v1::L1', expect.any(Function));
        expect(post).not.toHaveBeenCalled();
        expect(local.movieInventory['TEST-001::L1']).toBe(true); // 预写未冒充正式成功
        expect(isCurrentListIntent('v1', 'L1', 'remove-new')).toBe(true);
    });

    it('进入关联锁之前产生新移出意图，锁内重读会阻止旧补推', async () => {
        lockHook = () => publishListIntent('v1', 'L1', 'remove-in-other-tab', Date.now(), false, { explicit: true });
        await runAutomatic();
        expect(post).not.toHaveBeenCalled();
    });

    it('进入关联锁前本地关联已经删除，也不能补推旧 DOM 快照', async () => {
        lockHook = () => { delete local.movieInventory['TEST-001::L1']; };
        await runAutomatic();
        expect(post).not.toHaveBeenCalled();
    });

    it('没有相反明确意图且锁内仍有关联，保留既有补推行为', async () => {
        await runAutomatic();
        expect(post).toHaveBeenCalledWith('v1', 'L1', true);
    });
});

describe('完整快照在真实写事务回调内遵守最新意图', () => {
    it('尚未选定实体的逻辑组占位不表达目标状态，不阻挡真实快照校准', async () => {
        publishListIntent('v1', 'L1', 'group-placeholder', Date.now(), true, { supersedeOnly: true });
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(true);
        expect(local.movieInventory).toEqual({});
    });
    it('快照含片但最新意图是移出，拒绝全量回写', async () => {
        local.movieInventory = {};
        fetched.movies = [movie()]; fetched.expectedCount = 1;
        publishListIntent('v1', 'L1', 'remove', Date.now(), false, { explicit: true });
        const before = structuredClone(local);
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(false);
        expect(local).toEqual(before);
    });

    it('快照无片但最新意图要加入，以本地成员并集发现相反意图并拒绝删除', async () => {
        publishListIntent('v1', 'L1', 'add', Date.now(), true, { explicit: true });
        const before = structuredClone(local);
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(false);
        expect(local).toEqual(before);
    });

    it('等待 IDB 事务时出现相反新意图，事务内同步 guard 阻止写入', async () => {
        fetched.movies = [movie()]; fetched.expectedCount = 1;
        beforeWrite = () => publishListIntent('v1', 'L1', 'remove-late', Date.now(), false, { explicit: true });
        const before = structuredClone(local);
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(false);
        expect(local).toEqual(before);
    });

    it('同一清单其他视频的相反意图也受保护，不限当前详情页影片', async () => {
        fetched.movies = [movie(), movie('v2', 'OTHER-002')]; fetched.expectedCount = 2;
        publishListIntent('v2', 'L1', 'other-remove', Date.now(), false, { explicit: true });
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(false);
        expect(local.movieInventory['OTHER-002::L1']).toBeUndefined();
    });

    it('权威与快照一致时正常回写；guard 可选兼容既有调用', async () => {
        publishListIntent('v1', 'L1', 'remove', Date.now(), false, { explicit: true });
        expect(await reconcile.reconcileListWithJavdb('L1', { quiet: true })).toBe(true);
        expect(local.movieInventory).toEqual({});
        const state = await database.VltDb.getListReconcileState('L1');
        expect(await database.VltDb.reconcileListSnapshot(fetched, state.guard)).toMatchObject({ status: 'applied', count: 0 });
    });
});
