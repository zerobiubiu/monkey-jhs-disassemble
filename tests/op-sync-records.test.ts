/**
 * op-sync-records 单测（doc/38）。
 *
 * 覆盖：登记 / 状态流转 / 查询过滤 / 计数 / 容量淘汰 / 终态清理 / 取消 / 删除，
 * 以及坏数据容错与「通过注入存储落盘」。存储用内存替身，模块本身不碰 GM / DOM。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    OP_SYNC_CAPACITY,
    cancelOpSyncRecord,
    clearOpSyncTerminal,
    getOpSyncRecord,
    listOpSyncRecords,
    removeOpSyncRecord,
    resetOpSyncForTest,
    setOpSyncState,
    setOpSyncStorageForTest,
    summarizeOpSync,
    upsertOpSync,
    type OpSyncRecord
} from '../src/plugins/setting/jhs-sync/op-sync-records';

/** 内存存储替身：可观测写入、可注入脏数据。 */
function createStorageStub() {
    let data: OpSyncRecord[] | null = null;
    let writes = 0;
    return {
        read: (): OpSyncRecord[] | null => data,
        write: (records: OpSyncRecord[]): void => {
            data = records;
            writes++;
        },
        getWrites: (): number => writes,
        setRaw: (value: unknown): void => {
            data = value as OpSyncRecord[];
        }
    };
}

let storage: ReturnType<typeof createStorageStub>;

beforeEach(() => {
    storage = createStorageStub();
    setOpSyncStorageForTest(storage);
    resetOpSyncForTest();
});

describe('op-sync-records 登记与状态流转', () => {
    it('登记新记录为 pending，并填充默认字段', () => {
        const record = upsertOpSync({
            carNum: 'ABC-001',
            url: '/v/abc1',
            kind: 'watched',
            score: 3,
            origin: 'detail',
            now: 1000
        });

        expect(record).toMatchObject({
            carNum: 'ABC-001',
            kind: 'watched',
            score: 3,
            state: 'pending',
            attempts: 0,
            error: '',
            origin: 'detail',
            enqueuedAt: 1000,
            updatedAt: 1000
        });
        expect(getOpSyncRecord('ABC-001', 'watched')?.state).toBe('pending');
    });

    it('同番号同操作重复登记时重置状态与尝试次数，但保留首次入队时间', () => {
        upsertOpSync({ carNum: 'ABC-001', url: '/v/abc1', kind: 'watched', score: 3, now: 1000 });
        setOpSyncState('ABC-001', 'watched', 'failed', { error: 'HTTP 500', attempts: 2, now: 2000 });

        const again = upsertOpSync({
            carNum: 'ABC-001',
            url: '/v/abc1',
            kind: 'watched',
            score: 5,
            now: 3000
        });

        expect(again.state).toBe('pending');
        expect(again.attempts).toBe(0);
        expect(again.error).toBe('');
        expect(again.score).toBe(5);
        expect(again.enqueuedAt).toBe(1000);
        expect(again.updatedAt).toBe(3000);
        expect(listOpSyncRecords()).toHaveLength(1);
    });

    it('同番号不同操作是两条独立记录', () => {
        upsertOpSync({ carNum: 'ABC-001', url: '/v/abc1', kind: 'favorite' });
        upsertOpSync({ carNum: 'ABC-001', url: '/v/abc1', kind: 'filter' });

        expect(listOpSyncRecords()).toHaveLength(2);
        expect(getOpSyncRecord('ABC-001', 'favorite')).not.toBeNull();
        expect(getOpSyncRecord('ABC-001', 'filter')).not.toBeNull();
    });

    it('setOpSyncState 更新状态/原因/尝试次数；记录不存在时返回 null', () => {
        upsertOpSync({ carNum: 'ABC-001', url: '/v/abc1', kind: 'watched' });

        const updated = setOpSyncState('ABC-001', 'watched', 'failed', {
            error: '缺少 videoId',
            attempts: 2,
            now: 5000
        });

        expect(updated).toMatchObject({ state: 'failed', error: '缺少 videoId', attempts: 2, updatedAt: 5000 });
        expect(setOpSyncState('NOPE-000', 'watched', 'success')).toBeNull();
    });
});

describe('op-sync-records 查询与计数', () => {
    it('列表按最近更新倒序，并支持状态过滤与条数限制', () => {
        upsertOpSync({ carNum: 'A-1', url: '/v/a1', kind: 'favorite', now: 100 });
        upsertOpSync({ carNum: 'A-2', url: '/v/a2', kind: 'favorite', now: 200 });
        upsertOpSync({ carNum: 'A-3', url: '/v/a3', kind: 'favorite', now: 300 });
        setOpSyncState('A-2', 'favorite', 'failed', { error: 'x', now: 400 });

        expect(listOpSyncRecords().map((r) => r.carNum)).toEqual(['A-2', 'A-3', 'A-1']);
        expect(listOpSyncRecords({ states: ['failed'] }).map((r) => r.carNum)).toEqual(['A-2']);
        expect(listOpSyncRecords({ states: ['pending'], limit: 1 }).map((r) => r.carNum)).toEqual(['A-3']);
    });

    it('摘要按状态计数', () => {
        upsertOpSync({ carNum: 'A-1', url: '/v/a1', kind: 'favorite' });
        upsertOpSync({ carNum: 'A-2', url: '/v/a2', kind: 'favorite' });
        setOpSyncState('A-2', 'favorite', 'success');
        upsertOpSync({ carNum: 'A-3', url: '/v/a3', kind: 'favorite' });
        setOpSyncState('A-3', 'favorite', 'failed', { error: 'boom' });

        expect(summarizeOpSync()).toEqual({
            pending: 1,
            running: 0,
            success: 1,
            failed: 1,
            cancelled: 0
        });
    });
});

describe('op-sync-records 清理与容量', () => {
    it('清除终态记录时保留 pending / running', () => {
        upsertOpSync({ carNum: 'P-1', url: '/v/p1', kind: 'favorite' });
        upsertOpSync({ carNum: 'S-1', url: '/v/s1', kind: 'favorite' });
        setOpSyncState('S-1', 'favorite', 'success');
        upsertOpSync({ carNum: 'F-1', url: '/v/f1', kind: 'favorite' });
        setOpSyncState('F-1', 'favorite', 'failed', { error: 'x' });

        expect(clearOpSyncTerminal()).toBe(2);
        expect(listOpSyncRecords().map((r) => r.carNum)).toEqual(['P-1']);
    });

    it('取消记录置 cancelled 且保留记录本身（本地状态不回滚由调用方保证）', () => {
        upsertOpSync({ carNum: 'A-1', url: '/v/a1', kind: 'watched', score: 4 });

        expect(cancelOpSyncRecord('A-1', 'watched')).toBe(true);
        const record = getOpSyncRecord('A-1', 'watched');
        expect(record?.state).toBe('cancelled');
        expect(record?.score).toBe(4);
        expect(cancelOpSyncRecord('NOPE', 'watched')).toBe(false);
    });

    it('删除单条记录', () => {
        upsertOpSync({ carNum: 'A-1', url: '/v/a1', kind: 'favorite' });

        expect(removeOpSyncRecord('A-1', 'favorite')).toBe(true);
        expect(removeOpSyncRecord('A-1', 'favorite')).toBe(false);
        expect(listOpSyncRecords()).toHaveLength(0);
    });

    it('超过容量上限时优先淘汰最旧的终态记录，待推送记录保留', () => {
        for (let i = 0; i < OP_SYNC_CAPACITY; i++) {
            upsertOpSync({ carNum: `T-${i}`, url: `/v/t${i}`, kind: 'favorite', now: 1000 + i });
            setOpSyncState(`T-${i}`, 'favorite', 'success', { now: 1000 + i });
        }
        // 再加一条 pending：触发淘汰，且 pending 不会被淘汰
        upsertOpSync({ carNum: 'P-NEW', url: '/v/pnew', kind: 'favorite', now: 99999 });

        const rows = listOpSyncRecords();
        expect(rows.length).toBeLessThanOrEqual(OP_SYNC_CAPACITY);
        expect(rows.some((r) => r.carNum === 'P-NEW')).toBe(true);
        // 最旧的成功记录（T-0）应已被淘汰
        expect(rows.some((r) => r.carNum === 'T-0')).toBe(false);
    });
});

describe('op-sync-records 耐久性与容错', () => {
    it('每次变更都写回注入的存储，重新读盘可复原', () => {
        upsertOpSync({ carNum: 'A-1', url: '/v/a1', kind: 'favorite' });
        setOpSyncState('A-1', 'favorite', 'success');
        const writesBefore = storage.getWrites();
        expect(writesBefore).toBeGreaterThanOrEqual(2);

        resetOpSyncForTest(); // 清缓存 → 重新从存储读
        expect(getOpSyncRecord('A-1', 'favorite')?.state).toBe('success');
    });

    it('存储中的坏数据被忽略，不抛错', () => {
        storage.setRaw([null, 42, { carNum: 'OK-1', kind: 'favorite', state: 'pending' }, { foo: 'bar' }]);

        expect(listOpSyncRecords().map((r) => r.carNum)).toEqual(['OK-1']);
        expect(() => summarizeOpSync()).not.toThrow();
    });
});