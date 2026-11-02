import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    OP_SYNC_GM_KEY, getOpSyncRecord, listOpSyncRecords, setOpSyncState,
    setOpSyncStorageForTest, upsertOpSync, withStrictOpSyncPersistence, withStrictOpSyncPersistenceSync, type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

let raw: unknown;
let read: ReturnType<typeof vi.fn>;
let write: ReturnType<typeof vi.fn>;

beforeEach(() => {
    raw = null;
    read = vi.fn(() => raw);
    write = vi.fn((_key: string, value: unknown) => { raw = value; });
    vi.stubGlobal('GM_getValue', read);
    vi.stubGlobal('GM_setValue', write);
    setOpSyncStorageForTest(null);
});
afterEach(() => {
    vi.unstubAllGlobals();
    setOpSyncStorageForTest(null);
});

describe('清单前置评价同步的严格持久化作用域', () => {
    it('同步临界区失败后立即恢复宽松模式，不影响后续无关后台任务', () => {
        read.mockImplementation(() => { throw new Error('GM 读取故障'); });
        expect(() => withStrictOpSyncPersistenceSync(() => listOpSyncRecords())).toThrow('GM 读取故障');
        expect(listOpSyncRecords()).toEqual([]);
    });

    it('默认模式沿用坏账本降级，严格模式不能将损坏内容当空账本', async () => {
        raw = '{broken';
        expect(listOpSyncRecords()).toEqual([]);
        await expect(withStrictOpSyncPersistence(async () => listOpSyncRecords())).rejects.toThrow();
        expect(listOpSyncRecords()).toEqual([]);
    });

    it.each([
        { bad: null },
        { bad: { data: [] } },
        { bad: [null] },
        { bad: [{ carNum: 'A', kind: 'watched', state: 'pending' }] }
    ])('严格模式拒绝无效账本结构：$bad', async ({ bad }) => {
        raw = JSON.stringify(bad);
        await expect(withStrictOpSyncPersistence(async () => listOpSyncRecords())).rejects.toThrow('账本');
    });

    it('严格模式传播 GM 读取错误，finally 后恢复原模式', async () => {
        read.mockImplementation(() => { throw new Error('GM 读取故障'); });
        await expect(withStrictOpSyncPersistence(async () => listOpSyncRecords())).rejects.toThrow('GM 读取故障');
        expect(listOpSyncRecords()).toEqual([]);
    });

    it('严格模式传播 GM 写入错误，finally 后恢复原模式', async () => {
        write.mockImplementation(() => { throw new Error('GM 写入故障'); });
        await expect(withStrictOpSyncPersistence(async () => {
            upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'watched', score: 4 });
        })).rejects.toThrow('GM 写入故障');
        expect(() => upsertOpSync({ carNum: 'B', url: '/v/B', kind: 'favorite' })).not.toThrow();
    });

    it('写入未报错却未实际落盘时，回读比对阻止虚假成功', async () => {
        upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'watched', score: 4 });
        write.mockImplementation(() => {});
        await expect(withStrictOpSyncPersistence(async () => {
            setOpSyncState('A', 'watched', 'success');
        })).rejects.toThrow('回读不一致');
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('pending');
    });

    it('成功写入后确实读取相同 GM 键并保留状态', async () => {
        await withStrictOpSyncPersistence(async () => {
            upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'watched', score: 4 });
            setOpSyncState('A', 'watched', 'success');
        });
        expect(write).toHaveBeenCalledWith(OP_SYNC_GM_KEY, expect.any(String));
        expect(read).toHaveBeenCalledWith(OP_SYNC_GM_KEY, null);
        expect(getOpSyncRecord('A', 'watched')?.state).toBe('success');
    });

    it('嵌套作用域退出仍保持外层严格校验，全部退出后才恢复', async () => {
        await withStrictOpSyncPersistence(async () => {
            await withStrictOpSyncPersistence(async () => listOpSyncRecords());
            read.mockImplementation(() => { throw new Error('外层仍严格'); });
            expect(() => listOpSyncRecords()).toThrow('外层仍严格');
        });
        expect(listOpSyncRecords()).toEqual([]);
    });

    it('注入存储亦执行写后回读，覆盖静默丢失的状态更新', async () => {
        let disk: OpSyncRecord[] | null = null;
        let drop = false;
        setOpSyncStorageForTest({
            read: () => structuredClone(disk),
            write: (records) => { if (!drop) disk = structuredClone(records); }
        });
        upsertOpSync({ carNum: 'A', url: '/v/A', kind: 'watched', score: 4 });
        drop = true;
        await expect(withStrictOpSyncPersistence(async () => {
            setOpSyncState('A', 'watched', 'success');
        })).rejects.toThrow('回读不一致');
    });
});
