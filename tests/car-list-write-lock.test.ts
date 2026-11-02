// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import { featureFlags } from '../src/core/feature-flags';
import { StorageManager } from '../src/core/storage-manager';
import { storageRevision } from '../src/core/storage-revision';
import { saveCarListGuarded, type CarRecord } from '../src/core/storage/car-list-ops';

const CAR_LIST_KEY = 'car_list';
const WRITE_LOCK = 'jhs:car-list-write';
const NOW = '2026-11-02 12:00:00';

/** 同一 IndexedDB 后端的两个客户端；读写都复制，避免对象引用掩盖丢失更新。 */
class FakeForage {
    readonly reads: string[] = [];
    readonly writes: string[] = [];
    beforeSet?: (key: string) => Promise<void>;

    constructor(private readonly disk: Map<string, unknown>) {}

    async getItem(key: string): Promise<unknown> {
        this.reads.push(key);
        return structuredClone(this.disk.get(key) ?? null);
    }

    async setItem(key: string, value: unknown): Promise<void> {
        this.writes.push(key);
        await this.beforeSet?.(key);
        this.disk.set(key, structuredClone(value));
    }
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
}

function car(carNum: string, score = 1): CarRecord {
    return {
        carNum, url: `https://javdb.com/v/${carNum}`, status: HAS_WATCH_ACTION,
        score, names: '原演员', remark: '用户备注', starId: 'actor-1',
        createDate: '2026-01-01 00:00:00', updateDate: '2026-01-02 00:00:00', publishTime: '2025-12-01'
    };
}

function createClient(disk: Map<string, unknown>) {
    StorageManager.__resetForTesting();
    const forage = new FakeForage(disk);
    const sm = new StorageManager(forage);
    const callback = vi.fn();
    sm.setCarListChangeCallback(callback);
    return { sm, forage, callback };
}

function blockCarWrite(forage: FakeForage) {
    const entered = deferred(); const release = deferred();
    forage.beforeSet = async (key) => {
        if (key === CAR_LIST_KEY) { entered.resolve(); await release.promise; }
    };
    return { entered: entered.promise, release: release.resolve };
}

let disk: Map<string, unknown>;
let lockNames: string[];
let lockDepth: number;
let maximumDepth: number;

beforeEach(() => {
    disk = new Map([[CAR_LIST_KEY, [car('A')]]]);
    lockNames = []; lockDepth = 0; maximumDepth = 0;
    const chains = new Map<string, Promise<void>>();
    vi.stubGlobal('navigator', { locks: {
        request: <T>(name: string, _options: unknown, task: () => Promise<T>): Promise<T> => {
            lockNames.push(name);
            const run = (chains.get(name) ?? Promise.resolve()).then(async () => {
                lockDepth++;
                maximumDepth = Math.max(maximumDepth, lockDepth);
                try { return await task(); } finally { lockDepth--; }
            });
            chains.set(name, run.then(() => {}, () => {}));
            return run;
        }
    } });
    vi.stubGlobal('utils', { getNowStr: () => NOW, copyObj: (value: unknown) => structuredClone(value) });
    vi.stubGlobal('show', { ok: vi.fn(), error: vi.fn(), info: vi.fn() });
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    vi.stubGlobal('Toastify', () => ({ showToast: vi.fn() }));
    featureFlags.caseInsensitiveCarNum = true;
    featureFlags.storageCacheDeepCopy = true;
});
afterEach(() => {
    StorageManager.__resetForTesting();
    vi.unstubAllGlobals();
});

const operations: Array<{ name: string; run: (sm: StorageManager) => Promise<unknown> }> = [
    { name: 'saveCar', run: (sm) => sm.saveCar({ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 5 }) },
    { name: 'updateCarInfo', run: (sm) => sm.updateCarInfo({ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, names: '新演员' }) },
    { name: 'saveCarList', run: (sm) => sm.saveCarList([{ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 5 }]) },
    { name: 'removeCar', run: (sm) => sm.removeCar('A') },
    { name: 'clearCarWatchStatus', run: (sm) => sm.clearCarWatchStatus(['A']) },
    { name: 'batchRemoveCars', run: (sm) => sm.batchRemoveCars(['A']) }
];

describe('car_list 六个公开读改写入口共用写锁', () => {
    it.each(operations)('$name 与另一个实例在途写入串行，不读取旧快照覆盖已写入新视频', async ({ run }) => {
        const first = createClient(disk); const second = createClient(disk);
        second.sm.cacheCarList = [car('A')];
        const blocked = blockCarWrite(first.forage);
        const revision = storageRevision.current;
        const writing = first.sm.saveCar({ carNum: 'NEW', url: '/v/NEW', actionType: HAS_WATCH_ACTION, score: 4 });
        await blocked.entered;
        const competing = run(second.sm);
        await Promise.resolve(); await Promise.resolve();
        expect(second.forage.reads).toEqual([]);
        expect(second.forage.writes).toEqual([]);
        expect(second.callback).not.toHaveBeenCalled();
        blocked.release();
        await Promise.all([writing, competing]);
        expect((disk.get(CAR_LIST_KEY) as CarRecord[]).find((row) => row.carNum === 'NEW')).toMatchObject({ score: 4 });
        expect(lockNames).toEqual([WRITE_LOCK, WRITE_LOCK]);
        expect(maximumDepth).toBe(1);
        expect(first.callback).toHaveBeenCalledTimes(1);
        expect(second.callback).toHaveBeenCalledTimes(1);
        expect(storageRevision.current - revision).toBe(2);
    });

    it.each(['removeCar', 'batchRemoveCars', 'clearCarWatchStatus'] as const)('%s 不使用旧缓存，不丢新视频或覆盖最新收藏状态', async (method) => {
        const { sm, forage, callback } = createClient(disk);
        sm.cacheCarList = [car('A', 1)];
        disk.set(CAR_LIST_KEY, [{ ...car('A', 5), status: FAVORITE_ACTION }, car('NEW', 3)]);
        const revision = storageRevision.current;
        if (method === 'removeCar') await sm.removeCar('A');
        else await sm[method](['A']);
        const rows = disk.get(CAR_LIST_KEY) as CarRecord[];
        expect(rows.find((row) => row.carNum === 'NEW')).toMatchObject({ score: 3 });
        if (method === 'clearCarWatchStatus') {
            expect(rows.find((row) => row.carNum === 'A')).toMatchObject({ score: 5, status: FAVORITE_ACTION });
            expect(forage.writes).toHaveLength(0);
            expect(callback).not.toHaveBeenCalled();
            expect(storageRevision.current).toBe(revision);
        } else {
            expect(rows.find((row) => row.carNum === 'A')).toBeUndefined();
            expect(callback).toHaveBeenCalledWith({ action: 'delete', deletes: ['A'] });
        }
        expect(forage.reads).toEqual([CAR_LIST_KEY]);
    });
});

describe('saveCarListGuarded 的原子判定与提交', () => {
    it('等待另一实例最新5星写入后才运行guard，拒绝旧2星且没有额外副作用', async () => {
        const first = createClient(disk); const second = createClient(disk);
        second.sm.cacheCarList = [car('A', 1)];
        const blocked = blockCarWrite(first.forage);
        const revision = storageRevision.current;
        const writing = first.sm.saveCar({ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 5 });
        await blocked.entered;
        const guard = vi.fn((rows: readonly CarRecord[]) => rows.find((row) => row.carNum === 'A')?.score === 1);
        const guarded = saveCarListGuarded(second.sm, [{ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 2 }], guard);
        await Promise.resolve();
        expect(guard).not.toHaveBeenCalled();
        blocked.release();
        await writing;
        expect(await guarded).toBe(false);
        expect(guard).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ score: 5 })]));
        expect(second.forage.writes).toHaveLength(0);
        expect(second.callback).not.toHaveBeenCalled();
        expect(storageRevision.current - revision).toBe(1);
        expect((disk.get(CAR_LIST_KEY) as CarRecord[])[0].score).toBe(5);
    });

    it('guard接受后的整次提交仍持有同一锁，后来的快捷5星最后落库', async () => {
        const first = createClient(disk); const second = createClient(disk);
        const blocked = blockCarWrite(first.forage);
        const guarded = saveCarListGuarded(first.sm, [{ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 2 }], () => true);
        await blocked.entered;
        const newer = second.sm.saveCar({ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 5 });
        await Promise.resolve();
        expect(second.forage.reads).toHaveLength(0);
        blocked.release();
        expect(await guarded).toBe(true);
        await newer;
        expect((disk.get(CAR_LIST_KEY) as CarRecord[])[0].score).toBe(5);
        expect(lockNames).toEqual([WRITE_LOCK, WRITE_LOCK]);
        expect(maximumDepth).toBe(1);
    });

    it('接受后复用批量保存契约：保留metadata，只通知受影响的完整记录且仅递增一次', async () => {
        disk.set(CAR_LIST_KEY, [car('A'), car('B', 3)]);
        const { sm, forage, callback } = createClient(disk);
        const revision = storageRevision.current;
        expect(await saveCarListGuarded(sm, [{
            carNum: 'a', url: 'https://javdb.com/v/A', actionType: HAS_WATCH_ACTION, score: 5, names: ' 新演员 '
        }], () => true)).toBe(true);
        const rows = disk.get(CAR_LIST_KEY) as CarRecord[];
        expect(rows[0]).toMatchObject({
            carNum: 'A', score: 5, status: HAS_WATCH_ACTION, names: '新演员', remark: '用户备注', starId: 'actor-1',
            createDate: '2026-01-01 00:00:00', publishTime: '2025-12-01', updateDate: NOW
        });
        expect(rows[1]).toEqual(car('B', 3));
        expect(forage.reads).toEqual([CAR_LIST_KEY]);
        expect(forage.writes).toEqual([CAR_LIST_KEY]);
        expect(callback).toHaveBeenCalledExactlyOnceWith({ action: 'upsert', upserts: [rows[0]] });
        expect(sm.cacheCarList).toEqual(rows);
        expect(storageRevision.current - revision).toBe(1);
    });

    it.each([true, false])('空inputs仍读取最新数据并运行guard=%s，不写DB/回调/修订号', async (accepted) => {
        const { sm, forage, callback } = createClient(disk);
        sm.cacheCarList = [car('A', 1)];
        disk.set(CAR_LIST_KEY, [car('A', 5)]);
        const revision = storageRevision.current;
        const guard = vi.fn((rows: readonly CarRecord[]) => {
            expect(rows[0].score).toBe(5);
            return accepted;
        });
        expect(await saveCarListGuarded(sm, [], guard)).toBe(accepted);
        expect(guard).toHaveBeenCalledTimes(1);
        expect(forage.reads).toEqual([CAR_LIST_KEY]);
        expect(forage.writes).toHaveLength(0);
        expect(callback).not.toHaveBeenCalled();
        expect(storageRevision.current).toBe(revision);
        expect(lockNames).toEqual([WRITE_LOCK]);
    });

    it('原saveCarList空数组继续抛错', async () => {
        const { sm, forage } = createClient(disk);
        await expect(sm.saveCarList([])).rejects.toThrow('记录列表为空');
        expect(forage.writes).toHaveLength(0);
    });

    it('guard抛错不提交，写锁释放后其他公开写入仍可继续', async () => {
        const { sm, forage, callback } = createClient(disk);
        const revision = storageRevision.current;
        await expect(saveCarListGuarded(sm, [{ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 2 }], () => {
            throw new Error('本地基线无法确认');
        })).rejects.toThrow('本地基线无法确认');
        expect(forage.writes).toHaveLength(0);
        expect(callback).not.toHaveBeenCalled();
        expect(storageRevision.current).toBe(revision);
        await sm.saveCarList([{ carNum: 'A', url: '/v/A', actionType: HAS_WATCH_ACTION, score: 5 }]);
        expect((disk.get(CAR_LIST_KEY) as CarRecord[])[0].score).toBe(5);
    });
});
