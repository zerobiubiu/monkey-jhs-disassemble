/** 组合评价本地准备、稳定入账与回执交接；不访问网站、不启动后台队列。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import type { BatchListJob, BatchListItem } from '../src/types/batch-lists';
import { captureBatchRating, finishBatchRatings, prepareBatchRatings } from '../src/plugins/list-page/batch-lists/ratings';
import {
    clearOpSyncTerminal, ensureOpSync, getOpSyncRecord, listOpSyncRecords, releaseRetainedOpSync,
    removeOpSyncRecord, setOpSyncState, setOpSyncStorageForTest, upsertOpSync, withStrictOpSyncPersistenceSync,
    type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

vi.mock('../src/plugins/setting/jhs-sync/sync-common', () => ({
    extractVideoId: (url: string | undefined) => url?.match(/\/v\/([^/?#]+)/)?.[1] ?? null
}));
vi.mock('../src/core/storage/car-list-ops', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    saveCarListGuarded: (...args: unknown[]) => guarded(...args)
}));
vi.mock('../src/plugins/list-page/batch-lists/journal', () => ({
    readBatchListJobs: () => structuredClone(persistedJobs)
}));

const item: BatchListItem = { carNum: 'TEST-001', videoId: 'v1', url: 'https://javdb.com/v/v1', names: '演员' };
let disk: unknown;
let failWrite: boolean;
let cars: Map<string, { carNum: string; url: string; status: string; score: number }>;
let getCar: ReturnType<typeof vi.fn>;
let saveLocal: ReturnType<typeof vi.fn>;
let writes: number;
let guarded: ReturnType<typeof vi.fn>;
let beforeGuard: (() => void) | undefined;
let persistedJobs: BatchListJob[];

function updateLocal(inputs: Array<{ carNum: string; url?: string; actionType?: string; score?: number }>): void {
    for (const input of inputs) {
        const previous = cars.get(input.carNum) || { carNum: input.carNum, url: input.url || '', status: '', score: 0 };
        cars.set(input.carNum, { ...previous, status: input.actionType || previous.status, score: input.score ?? previous.score });
    }
}

async function jobFor(kind: 'favorite' | 'watched' = 'watched', score = 5): Promise<BatchListJob> {
    return {
        version: 2, id: 'job', origin: 'https://javdb.com', lists: [{ id: 'L1', name: '清单', url: '/lists/L1' }],
        rating: { kind, score }, desiredChecked: true, createdAt: 1000, updatedAt: 1000,
        attempts: 0, retryAt: 1000, ratingsComplete: false,
        items: [{
            ...item, state: 'pending', error: '', operations: [{ listId: 'L1', state: 'pending', error: '' }], ratingsComplete: false,
            rating: await captureBatchRating(item, 'job:v1', 1000)
        }]
    };
}

function history(index: number, retained = false): OpSyncRecord {
    return {
        carNum: `OLD-${index}`, url: `/v/old${index}`, kind: 'favorite', score: 0, origin: 'list',
        revision: `old:${index}`, requestedAt: index + 1, state: 'success', attempts: 0,
        error: '', enqueuedAt: index + 1, updatedAt: index + 1, ...(retained ? { retained: true } : {})
    };
}

beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    disk = null; failWrite = false; writes = 0;
    persistedJobs = [];
    setOpSyncStorageForTest({
        read: () => structuredClone(disk) as OpSyncRecord[] | null,
        write: (records) => {
            if (failWrite) throw new Error('账本写入失败');
            disk = structuredClone(records); writes++;
        }
    });
    cars = new Map([[item.carNum, { carNum: item.carNum, url: item.url, status: '', score: 0 }]]);
    getCar = vi.fn(async (carNum: string) => structuredClone(cars.get(carNum)));
    saveLocal = vi.fn(async (inputs) => { updateLocal(inputs); });
    beforeGuard = undefined;
    guarded = vi.fn(async (_storage, inputs, guard) => {
        beforeGuard?.();
        if (!guard(structuredClone([...cars.values()]))) return false;
        if (inputs.length) await saveLocal(inputs);
        return true;
    });
    vi.stubGlobal('storageManager', { clearCarListCache: vi.fn(), getCar, saveCarList: saveLocal, getSetting: vi.fn(async () => 'no') });
    vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name, _options, task) => task()) } });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('本地准备不得访问网站'); }));
});

afterEach(() => {
    vi.useRealTimers(); vi.unstubAllGlobals(); setOpSyncStorageForTest(null);
});

describe('完整预写前的只读捕获', () => {
    it('捕获本地前值和严格意图基线，不写本地或账本', async () => {
        const intent = await captureBatchRating(item, 'stable', 5000);
        expect(intent).toEqual({ revision: 'stable', requestedAt: 5001, baseline: '[]', before: { status: '', score: 0 }, phase: 'pending' });
        expect(saveLocal).not.toHaveBeenCalled(); expect(writes).toBe(0);
    });

    it('首次await之前固定同批时间与基线，慢本地读取不会把后续评分当成原基线', async () => {
        let resolve!: (value: unknown) => void;
        getCar.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        const capture = captureBatchRating(item, 'stable', 1000);
        vi.setSystemTime(5000);
        upsertOpSync({ ...item, kind: 'watched', score: 2 });
        resolve(cars.get(item.carNum));
        const intent = await capture;
        expect(intent.baseline).toBe('[]'); expect(intent.requestedAt).toBe(1001);
    });

    it('损坏账本拒绝捕获，不能当作没有旧评价', async () => {
        disk = [{ carNum: 'broken', kind: 'watched', state: 'success' }];
        await expect(captureBatchRating(item, 'stable')).rejects.toThrow('账本损坏');
        expect(saveLocal).not.toHaveBeenCalled();
    });
});

describe('组合评价本地准备与稳定账本', () => {
    it('逐影片准备只修改传入目标，其他视频评价保持原样直到取得自己的槽位', async () => {
        const job = await jobFor();
        const other = { carNum: 'TEST-002', videoId: 'v2', url: '/v/v2' };
        cars.set(other.carNum, { ...other, status: '', score: 0 });
        job.items.push({
            ...other, state: 'pending', error: '', operations: [{ listId: 'L1', state: 'pending', error: '' }], ratingsComplete: false,
            rating: await captureBatchRating(other, 'job:v2', 1000)
        });
        await prepareBatchRatings(job, vi.fn(), undefined, [job.items[0]]);
        expect(job.items.map((row) => row.rating?.phase)).toEqual(['registered', 'pending']);
        expect(cars.get(other.carNum)?.status).toBe('');
        expect(getOpSyncRecord(other.carNum, 'watched')).toBeNull();
        await prepareBatchRatings(job, vi.fn(), undefined, [job.items[1]]);
        expect(job.items.map((row) => row.rating?.phase)).toEqual(['registered', 'registered']);
        expect(listOpSyncRecords()).toHaveLength(2);
    });

    it('同毫秒同时捕获的两组合任务按预写保留顺序执行，后点五星可覆盖已知前序二星', async () => {
        const first = await jobFor('watched', 2);
        const second = await jobFor('watched', 5);
        first.id = 'first'; first.items[0].rating!.revision = 'first:v1'; first.items[0].rating!.requestedAt = 1002;
        second.id = 'second'; second.items[0].rating!.revision = 'second:v1'; second.items[0].rating!.requestedAt = 1003;
        persistedJobs = structuredClone([first, second]);
        await prepareBatchRatings(first, vi.fn());
        await prepareBatchRatings(second, vi.fn());
        expect(first.items[0].rating?.phase).toBe('registered');
        expect(second.items[0].rating?.phase).toBe('registered');
        expect(cars.get(item.carNum)?.score).toBe(5);
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: 'second:v1', requestedAt: 1003, score: 5 });
    });

    it('已知前序收藏也可由后点五星覆盖，不能只按本地最初前值判断过期', async () => {
        const first = await jobFor('favorite', 0); const second = await jobFor('watched', 5);
        first.items[0].rating!.revision = 'first:v1'; first.items[0].rating!.requestedAt = 1002;
        second.items[0].rating!.revision = 'second:v1'; second.items[0].rating!.requestedAt = 1003;
        persistedJobs = structuredClone([first, second]);
        await prepareBatchRatings(first, vi.fn()); await prepareBatchRatings(second, vi.fn());
        expect(second.items[0].rating?.phase).toBe('registered');
        expect(cars.get(item.carNum)).toMatchObject({ status: HAS_WATCH_ACTION, score: 5 });
    });

    it('未知详情评分即使逻辑时间低于本job保留号，也不能伪装成合法前序', async () => {
        const job = await jobFor(); job.items[0].rating!.requestedAt = 5000;
        cars.set(item.carNum, { carNum: item.carNum, url: item.url, status: HAS_WATCH_ACTION, score: 3 });
        upsertOpSync({ ...item, kind: 'watched', score: 3, origin: 'detail' });
        await prepareBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('superseded');
        expect(cars.get(item.carNum)?.score).toBe(3); expect(saveLocal).not.toHaveBeenCalled();
    });
    it('旧任务等待实际本地写锁时出现新评价，事务前guard拒绝旧写入与入账', async () => {
        const job = await jobFor();
        let later: OpSyncRecord | undefined;
        beforeGuard = () => {
            beforeGuard = undefined;
            cars.set(item.carNum, { carNum: item.carNum, url: item.url, status: HAS_WATCH_ACTION, score: 2 });
            later = upsertOpSync({ ...item, kind: 'watched', score: 2 });
        };
        await prepareBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('superseded');
        expect(cars.get(item.carNum)?.score).toBe(2);
        expect(getOpSyncRecord(item.carNum, 'watched')?.revision).toBe(later?.revision);
        expect(saveLocal).not.toHaveBeenCalled();
    });
    it('先保存applying，再改本地并严格入账；明确组合同步不受原autoServerSync关闭影响', async () => {
        const job = await jobFor();
        const phases: string[] = [];
        await prepareBatchRatings(job, async () => {
            phases.push(job.items[0].rating!.phase);
            if (job.items[0].rating!.phase === 'applying') expect(saveLocal).not.toHaveBeenCalled();
        });
        expect(phases).toEqual(['applying', 'registered']);
        expect(cars.get(item.carNum)).toMatchObject({ status: HAS_WATCH_ACTION, score: 5 });
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: 'job:v1', requestedAt: 1001, state: 'pending', retained: true });
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([0, 5])('已读%d星复用既有计划并持久化准确星级', async (score) => {
        const job = await jobFor('watched', score); await prepareBatchRatings(job, vi.fn());
        expect(saveLocal).toHaveBeenCalledWith([expect.objectContaining({ actionType: HAS_WATCH_ACTION, score })]);
    });

    it('收藏不重写原星级，已有收藏也登记网站确认责任', async () => {
        cars.set(item.carNum, { carNum: item.carNum, url: item.url, status: FAVORITE_ACTION, score: 4 });
        const job = await jobFor('favorite', 0); await prepareBatchRatings(job, vi.fn());
        expect(saveLocal).not.toHaveBeenCalled();
        expect(cars.get(item.carNum)?.score).toBe(4);
        expect(getOpSyncRecord(item.carNum, 'favorite')).toMatchObject({ revision: 'job:v1', state: 'pending' });
    });

    it('缺少评价配置时保持原清单流程不变', async () => {
        const job = await jobFor(); delete job.rating;
        const persist = vi.fn(); await prepareBatchRatings(job, persist); await finishBatchRatings(job, persist);
        expect(persist).not.toHaveBeenCalled(); expect(saveLocal).not.toHaveBeenCalled(); expect(writes).toBe(0);
    });

    it('applying预写失败时不改本地、不登记账本', async () => {
        const job = await jobFor();
        await expect(prepareBatchRatings(job, async () => { throw new Error('任务预写失败'); })).rejects.toThrow('任务预写失败');
        expect(saveLocal).not.toHaveBeenCalled(); expect(writes).toBe(0);
    });

    it('本地完成后账本写失败，恢复只补稳定入账，不重复改评分', async () => {
        const job = await jobFor(); failWrite = true;
        await expect(prepareBatchRatings(job, vi.fn())).rejects.toThrow('账本写入失败');
        expect(job.items[0].rating?.phase).toBe('applying');
        expect(cars.get(item.carNum)?.score).toBe(5);
        failWrite = false; await prepareBatchRatings(job, vi.fn());
        expect(saveLocal).toHaveBeenCalledTimes(1);
        expect(getOpSyncRecord(item.carNum, 'watched')?.revision).toBe('job:v1');
    });

    it('已入账身份恢复不生成新revision，不清空失败次数', async () => {
        const job = await jobFor(); await prepareBatchRatings(job, vi.fn());
        setOpSyncState(item.carNum, 'watched', 'failed', { attempts: 2, expectedRevision: 'job:v1' });
        const before = getOpSyncRecord(item.carNum, 'watched');
        await prepareBatchRatings(job, vi.fn());
        expect(getOpSyncRecord(item.carNum, 'watched')).toEqual(before);
        expect(saveLocal).toHaveBeenCalledTimes(1);
    });

    it('后来同类型或其他类型评价均使旧组合评价失效，不覆盖本地或新账本', async () => {
        const job = await jobFor();
        cars.set(item.carNum, { carNum: item.carNum, url: item.url, status: FAVORITE_ACTION, score: 2 });
        const later = upsertOpSync({ ...item, kind: 'favorite', score: 0 });
        await prepareBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('superseded');
        expect(saveLocal).not.toHaveBeenCalled(); expect(getOpSyncRecord(item.carNum, 'favorite')?.revision).toBe(later.revision);
    });

    it('只有本地前值变化也拒绝旧恢复；applying日志等待期间的新评价同样受保护', async () => {
        const job = await jobFor();
        await prepareBatchRatings(job, async () => {
            if (job.items[0].rating?.phase === 'applying') {
                cars.set(item.carNum, { carNum: item.carNum, url: item.url, status: HAS_WATCH_ACTION, score: 3 });
                upsertOpSync({ ...item, kind: 'watched', score: 3 });
            }
        });
        expect(job.items[0].rating?.phase).toBe('superseded'); expect(saveLocal).not.toHaveBeenCalled();
        expect(cars.get(item.carNum)?.score).toBe(3);
    });

    it('旧同步记录进度变化不构成新评价，不误判superseded', async () => {
        const old = upsertOpSync({ ...item, kind: 'favorite', now: 500 });
        const job = await jobFor();
        setOpSyncState(item.carNum, 'favorite', 'success', { expectedRevision: old.revision });
        await prepareBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('registered');
    });

    it('清单项被后续list-only替代，不取消独立评价准备', async () => {
        const job = await jobFor(); job.items[0].state = 'superseded';
        await prepareBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('registered');
        expect(cars.get(item.carNum)?.score).toBe(5);
    });

    it('停止阻止尚未开始的本地写；已经落库的当前评价仍完成稳定入账', async () => {
        const job = await jobFor(); const controller = new AbortController();
        getCar.mockImplementationOnce(async () => cars.get(item.carNum)).mockImplementationOnce(async () => {
            controller.abort(); return cars.get(item.carNum);
        });
        await prepareBatchRatings(job, vi.fn(), controller.signal);
        expect(saveLocal).not.toHaveBeenCalled(); expect(writes).toBe(0);
        const running = new AbortController();
        saveLocal.mockImplementationOnce(async (inputs) => { updateLocal(inputs); running.abort(); });
        await prepareBatchRatings(job, vi.fn(), running.signal);
        expect(job.items[0].rating?.phase).toBe('registered');
        expect(getOpSyncRecord(item.carNum, 'watched')?.revision).toBe('job:v1');
    });

    it('前项入账造成后项旧成功历史被淘汰，不应误取消后项评价', async () => {
        disk = Array.from({ length: 400 }, (_, index) => history(index));
        const other = { carNum: 'OLD-0', videoId: 'old0', url: '/v/old0' };
        cars.set(other.carNum, { ...other, status: FAVORITE_ACTION, score: 0 });
        const job = await jobFor();
        job.items.push({
            ...other, state: 'pending', error: '', operations: [{ listId: 'L1', state: 'pending', error: '' }], ratingsComplete: false,
            rating: await captureBatchRating(other, 'job:old0', 1000)
        });
        await prepareBatchRatings(job, vi.fn());
        expect(job.items.map((row) => row.rating?.phase)).toEqual(['registered', 'registered']);
        expect(getOpSyncRecord(other.carNum, 'watched')?.revision).toBe('job:old0');
    });
});

describe('严格回执向组合日志交接', () => {
    it('逐影片回执只交接传入目标，不提前结束或释放另一个视频的恢复证据', async () => {
        const job = await jobFor();
        const other = { carNum: 'TEST-002', videoId: 'v2', url: '/v/v2' };
        cars.set(other.carNum, { ...other, status: '', score: 0 });
        job.items.push({
            ...other, state: 'pending', error: '', operations: [{ listId: 'L1', state: 'pending', error: '' }], ratingsComplete: false,
            rating: await captureBatchRating(other, 'job:v2', 1000)
        });
        await prepareBatchRatings(job, vi.fn());
        for (const target of job.items) setOpSyncState(target.carNum, 'watched', 'success', { expectedRevision: target.rating!.revision });
        await finishBatchRatings(job, vi.fn(), [job.items[0]]);
        expect(job.items.map((row) => row.rating?.phase)).toEqual(['success', 'registered']);
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBeUndefined();
        expect(getOpSyncRecord(other.carNum, 'watched')?.retained).toBe(true);
        await finishBatchRatings(job, vi.fn(), [job.items[1]]);
        expect(job.items[1].rating?.phase).toBe('success');
        expect(getOpSyncRecord(other.carNum, 'watched')?.retained).toBeUndefined();
    });

    it('网站成功先写入任务日志，再释放retained；未确认记录保持registered', async () => {
        const job = await jobFor(); await prepareBatchRatings(job, vi.fn());
        await finishBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('registered');
        setOpSyncState(item.carNum, 'watched', 'success', { expectedRevision: 'job:v1' });
        await finishBatchRatings(job, async () => {
            expect(job.items[0].rating?.phase).toBe('success');
            expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBe(true);
        });
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBeUndefined();
    });

    it('任务日志写失败不释放成功证据；释放失败可按已持久success幂等重试', async () => {
        const job = await jobFor(); await prepareBatchRatings(job, vi.fn());
        setOpSyncState(item.carNum, 'watched', 'success', { expectedRevision: 'job:v1' });
        await expect(finishBatchRatings(job, async () => { throw new Error('任务写失败'); })).rejects.toThrow('任务写失败');
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBe(true);
        await expect(finishBatchRatings(job, async () => { failWrite = true; })).rejects.toThrow('账本写入失败');
        failWrite = false; await finishBatchRatings(job, vi.fn());
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBeUndefined();
    });

    it('较新评价替代own回执时只结束旧组合责任，不修改新记录', async () => {
        const job = await jobFor(); await prepareBatchRatings(job, vi.fn());
        const later = upsertOpSync({ ...item, kind: 'watched', score: 2 });
        await finishBatchRatings(job, vi.fn());
        expect(job.items[0].rating?.phase).toBe('superseded');
        expect(getOpSyncRecord(item.carNum, 'watched')).toMatchObject({ revision: later.revision, score: 2, state: 'pending' });
    });

    it('超过400项的own成功记录在交接前不被容量或手动清理淘汰', async () => {
        disk = Array.from({ length: 401 }, (_, index) => history(index, true));
        const job = await jobFor();
        job.items = (disk as OpSyncRecord[]).map((record) => ({
            carNum: record.carNum, videoId: record.url.split('/').pop()!, url: record.url, state: 'pending', error: '',
            operations: [{ listId: 'L1', state: 'pending', error: '' }], ratingsComplete: false,
            rating: { revision: record.revision!, requestedAt: record.requestedAt!, baseline: '[]', before: { status: '', score: 0 }, phase: 'registered' }
        }));
        job.rating = { kind: 'favorite', score: 0 };
        expect(clearOpSyncTerminal()).toBe(0);
        expect(removeOpSyncRecord('OLD-0', 'favorite')).toBe(false);
        await finishBatchRatings(job, async () => {
            expect(job.items.every((row) => row.rating?.phase === 'success')).toBe(true);
            expect(listOpSyncRecords()).toHaveLength(401);
        });
        expect(job.items.every((row) => row.rating?.phase === 'success')).toBe(true);
        expect(listOpSyncRecords().every((row) => !row.retained)).toBe(true);
    });
});

describe('稳定账本ensure接口', () => {
    it('同revision重复ensure保留状态和尝试次数，旧requestedAt不覆盖新评价', () => {
        const input = { ...item, kind: 'watched' as const, score: 5, revision: 'stable', requestedAt: 1001 };
        withStrictOpSyncPersistenceSync(() => ensureOpSync(input));
        setOpSyncState(item.carNum, 'watched', 'failed', { attempts: 2, expectedRevision: 'stable' });
        const before = getOpSyncRecord(item.carNum, 'watched');
        expect(withStrictOpSyncPersistenceSync(() => ensureOpSync(input))).toEqual(before);
        upsertOpSync({ ...item, kind: 'favorite' });
        expect(withStrictOpSyncPersistenceSync(() => ensureOpSync(input))).toBeNull();
        releaseRetainedOpSync({ carNum: item.carNum, kind: 'watched', revision: 'wrong' });
        expect(getOpSyncRecord(item.carNum, 'watched')?.retained).toBe(true);
    });
});
