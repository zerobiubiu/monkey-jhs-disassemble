// @vitest-environment jsdom
/** 真实组合执行器、评价准备和账本接线；网站适配与网络排空使用隔离替身。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HAS_WATCH_ACTION } from '../src/constants/status';
import { StorageManager } from '../src/core/storage-manager';
import type { CarRecord } from '../src/core/storage/car-list-ops';
import { readBatchListJobs } from '../src/plugins/list-page/batch-lists/journal';
import { recoverBatchListJobs, startBatchListJob } from '../src/plugins/list-page/batch-lists/service';
import { applyBatchListItem } from '../src/plugins/list-page/batch-lists/site';
import { drainBatchRatings } from '../src/plugins/list-page/lp-batch-sync';
import {
    getOpSyncRecord, listOpSyncRecords, setOpSyncState, setOpSyncStorageForTest, upsertOpSync,
    type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

vi.mock('../src/plugins/list-page/lp-batch-sync', () => ({ drainBatchRatings: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/site', () => ({ applyBatchListItem: vi.fn() }));

const origin = 'https://javdb.com';
const item = { carNum: 'TEST-001', videoId: 'v1', url: `${origin}/v/v1` };
const list = { id: 'L1', name: '清单一', url: `${origin}/lists/L1` };
let rows: OpSyncRecord[];
let forage: FakeForage;
let sm: StorageManager;

/** 每次读取和提交均复制，模拟 IndexedDB 的隔离快照。 */
class FakeForage {
    readonly data = new Map<string, unknown>();
    readonly getItem = vi.fn(async (key: string): Promise<unknown> => structuredClone(this.data.get(key) ?? null));
    readonly setItem = vi.fn(async (key: string, value: unknown): Promise<void> => {
        this.data.set(key, structuredClone(value));
    });
    async removeItem(key: string): Promise<void> { this.data.delete(key); }
}

function localCar(): CarRecord | undefined {
    return (forage.data.get('car_list') as CarRecord[]).find((car) => car.carNum === item.carNum);
}

function localWrites(): number {
    return forage.setItem.mock.calls.filter(([key]) => key === 'car_list').length;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    vi.clearAllMocks();
    rows = [];
    forage = new FakeForage();
    forage.data.set('car_list', [{ carNum: item.carNum, url: item.url, status: '', score: 0 }]);
    const gm = new Map<string, unknown>();
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => gm.get(key) ?? fallback);
    vi.stubGlobal('GM_setValue', (key: string, value: unknown) => { gm.set(key, value); });
    vi.stubGlobal('window', { location: { origin } });
    const tails = new Map<string, Promise<unknown>>();
    vi.stubGlobal('navigator', { locks: {
        request: (name: string, _options: unknown, task: () => Promise<unknown>) => {
            const run = (tails.get(name) ?? Promise.resolve()).then(task);
            tails.set(name, run.catch(() => undefined));
            return run;
        }
    } });
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    vi.stubGlobal('utils', { getNowStr: () => new Date().toISOString(), copyObj: structuredClone });
    vi.stubGlobal('show', { ok: vi.fn(), info: vi.fn(), error: vi.fn() });
    vi.stubGlobal('Toastify', () => ({ showToast: vi.fn() }));
    StorageManager.__resetForTesting();
    sm = new StorageManager(forage);
    vi.spyOn(sm, 'removeNewVideoList').mockResolvedValue(undefined);
    vi.stubGlobal('storageManager', sm);
    setOpSyncStorageForTest({ read: () => structuredClone(rows), write: (next) => { rows = structuredClone(next); } });
    vi.mocked(applyBatchListItem).mockReset().mockResolvedValue(undefined);
    vi.mocked(drainBatchRatings).mockReset().mockImplementation(async (targets, notify) => {
        const ids = new Set(targets.map((target) => target.url.match(/\/v\/([^/?#]+)/)?.[1]));
        const pending = listOpSyncRecords({ states: ['pending', 'running', 'failed'] })
            .filter((record) => ids.has(record.url.match(/\/v\/([^/?#]+)/)?.[1]));
        for (const record of pending) setOpSyncState(record.carNum, record.kind, 'success', {
            expectedRevision: record.revision, error: ''
        });
        notify?.(pending.length, pending.length, 0);
        return { total: pending.length, succeeded: pending.length, failed: 0 };
    });
});

afterEach(() => {
    setOpSyncStorageForTest(null);
    StorageManager.__resetForTesting();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function interruptAfterLocalCommit(): void {
    sm.setCarListChangeCallback(vi.fn().mockImplementationOnce(() => {
        throw new Error('本地已提交，账本登记前中断');
    }));
}

describe('评价与清单的真实组合恢复', () => {
    it('同毫秒先后预写的两个组合保持顺序，后来五星不会被较早组合的本地变化取消', async () => {
        let release!: () => void;
        const held = navigator.locks.request('jhs:batch-lists:' + origin, { mode: 'exclusive' }, async () => {
            await new Promise<void>((resolve) => { release = resolve; });
        });
        await vi.advanceTimersByTimeAsync(0);
        const first = startBatchListJob([item], [list], true, vi.fn(), undefined, { kind: 'watched', score: 4 });
        const second = startBatchListJob([item], [list], true, vi.fn(), undefined, { kind: 'watched', score: 5 });
        await vi.advanceTimersByTimeAsync(0);
        const jobs = readBatchListJobs();
        expect(jobs).toHaveLength(2);
        expect(jobs[1].items[0].rating!.requestedAt).toBeGreaterThan(jobs[0].items[0].rating!.requestedAt);
        release();
        await Promise.all([held, first, second]);
        expect(localCar()?.score).toBe(5);
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ score: 5, state: 'success' });
        expect(readBatchListJobs()[1].items[0].rating?.phase).toBe('success');
    });

    it('本地已提交但登记前中断，恢复相同身份且不重写本地，仍补网站账本及清单', async () => {
        interruptAfterLocalCommit();
        expect(await startBatchListJob([item], [list], true, vi.fn(), undefined, { kind: 'watched', score: 4 }))
            .toMatchObject({ failed: 1, pending: 1, succeeded: 0 });
        const intent = readBatchListJobs()[0].items[0].rating!;
        expect(intent.phase).toBe('applying');
        expect(localCar()).toMatchObject({ status: HAS_WATCH_ACTION, score: 4 });
        expect(rows).toEqual([]);
        expect(applyBatchListItem).not.toHaveBeenCalled();

        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(localWrites()).toBe(1);
        expect(readBatchListJobs()[0]).toMatchObject({ ratingsComplete: true,
            items: [{ rating: { revision: intent.revision, requestedAt: intent.requestedAt, phase: 'success' } }] });
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: intent.revision, state: 'success' });
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).not.toBe(true);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
    });

    it('旧组合恢复遇到后来评分时不覆盖或重新登记旧评分，仍完成独立清单', async () => {
        interruptAfterLocalCommit();
        expect(await startBatchListJob([item], [list], true, vi.fn(), undefined, { kind: 'watched', score: 4 }))
            .toMatchObject({ failed: 1, pending: 1, succeeded: 0 });
        const originalRevision = readBatchListJobs()[0].items[0].rating!.revision;
        vi.setSystemTime(Date.now() + 1000);
        await sm.saveCar({ ...item, actionType: HAS_WATCH_ACTION, score: 5 });
        const newer = upsertOpSync({ ...item, kind: 'watched', score: 5, origin: 'detail' });
        setOpSyncState(item.carNum, 'watched', 'success', { expectedRevision: newer.revision });

        expect(await recoverBatchListJobs(vi.fn(), true)).toMatchObject({ succeeded: 1, pending: 0 });
        expect(localCar()?.score).toBe(5);
        expect(localWrites()).toBe(2);
        expect(readBatchListJobs()[0].items[0].rating).toMatchObject({ revision: originalRevision, phase: 'superseded' });
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: newer.revision, score: 5, state: 'success' });
        expect(rows).toHaveLength(1);
        expect(applyBatchListItem).toHaveBeenCalledTimes(1);
    });

    it('组合本地写入与后来详情评价共用真实存储锁，最终保留后来评分', async () => {
        let release!: () => void;
        forage.setItem.mockImplementationOnce(async (key: string, value: unknown) => {
            await new Promise<void>((resolve) => { release = resolve; });
            forage.data.set(key, structuredClone(value));
        });
        const running = startBatchListJob([item], [list], true, vi.fn(), undefined, { kind: 'watched', score: 4 });
        await vi.advanceTimersByTimeAsync(0);
        expect(localWrites()).toBe(1);
        // 真实 saveCar 使用同一写锁；它必须等旧写提交后才读取并写入新评分。
        vi.setSystemTime(Date.now() + 1000);
        let laterFinished = false;
        let newer!: OpSyncRecord;
        const later = sm.saveCar({ ...item, actionType: HAS_WATCH_ACTION, score: 5 }).then(() => {
            newer = upsertOpSync({ ...item, kind: 'watched', score: 5, origin: 'detail' });
            setOpSyncState(item.carNum, 'watched', 'success', { expectedRevision: newer.revision });
            laterFinished = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(laterFinished).toBe(false);
        expect(localCar()?.score).toBe(0);
        release();
        await Promise.all([running, later]);
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: newer.revision, score: 5, state: 'success' });
        expect(localCar()?.score).toBe(5);
        expect(localWrites()).toBe(2);
    });

    it('单独清单不创建新评价，只补目标既有账本且不接管无关失败', async () => {
        const target = upsertOpSync({ ...item, kind: 'watched', score: 2 });
        const unrelated = upsertOpSync({ carNum: 'OTHER-002', url: `${origin}/v/other`, kind: 'watched', score: 3 });
        setOpSyncState(unrelated.carNum, unrelated.kind, 'failed', { expectedRevision: unrelated.revision, error: '原有失败' });

        expect(await startBatchListJob([item], [list], true, vi.fn())).toMatchObject({ succeeded: 1, pending: 0 });
        expect(localWrites()).toBe(0);
        expect(readBatchListJobs()[0].rating).toBeUndefined();
        expect(rows).toHaveLength(2);
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: target.revision, score: 2, state: 'success' });
        expect(getOpSyncRecord(unrelated.carNum, unrelated.kind)).toMatchObject({ revision: unrelated.revision, state: 'failed', error: '原有失败' });
    });
});
