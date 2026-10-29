// @vitest-environment jsdom
/** 主数据恢复回归：替身保留 localforage 提前退出语义，不能再用忽略返回值的遍历。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageManager } from '../../src/core/storage-manager';
import { backupValuesEqual, restoreBackupEntries } from '../../src/core/storage/backup-restore';
import type { BackupRestoreStore } from '../../src/types/backup-restore';

class Store implements BackupRestoreStore {
    data = new Map<string, unknown>();
    async keys() { return [...this.data.keys()]; }
    async getItem(key: string) { return this.data.has(key) ? structuredClone(this.data.get(key)) : null; }
    async setItem(key: string, value: unknown) { this.data.set(key, structuredClone(value)); return value; }
    async removeItem(key: string) { this.data.delete(key); }
    async clear() { this.data.clear(); }
    async dropInstance() {}
    async iterate(callback: (value: unknown, key: string) => unknown) {
        for (const key of [...this.data.keys()].sort()) {
            const result = callback(await this.getItem(key), key);
            if (result !== undefined) return await result;
        }
    }
}

const backup = {
    __jhs_schema_version: 6,
    __meta: { backupTime: 'test' },
    car_list: [{ carNum: 'NEW-001', score: 5 }],
    blacklist: [{ starId: 'actor-1' }],
    favorite_actresses: [{ starId: 'favorite-1' }],
    setting: { flag: true }
};

beforeEach(() => {
    StorageManager.__resetForTesting();
    vi.stubGlobal('localforage', { INDEXEDDB: 'idb', createInstance: () => new Store() });
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); StorageManager.__resetForTesting(); });

describe('主数据恢复与校验', () => {
    it('真实提前退出语义的替身能够暴露旧遍历缺陷', async () => {
        const store = new Store();
        for (const [key, value] of Object.entries(backup)) await store.setItem(key, value);
        const visited: string[] = [];
        await store.iterate((_value, key) => { visited.push(key); return Promise.resolve(); });
        expect(visited).toEqual(['__jhs_schema_version']);
    });

    it('全部六键落库，保留备份未涉及的键', async () => {
        const store = new Store();
        await store.setItem('unrelated', 'keep');
        expect(await restoreBackupEntries(store, backup)).toBe(6);
        for (const [key, value] of Object.entries(backup)) expect(await store.getItem(key)).toEqual(value);
        expect(await store.getItem('unrelated')).toBe('keep');
    });

    it('单键、空数组、null 值正确恢复', async () => {
        const store = new Store();
        await restoreBackupEntries(store, { car_list: [] });
        await restoreBackupEntries(store, { optional: null });
        expect(await store.getItem('car_list')).toEqual([]);
        expect(store.data.has('optional')).toBe(true);
        expect(await store.getItem('optional')).toBeNull();
    });

    it('空备份不伪装成成功', async () => {
        await expect(restoreBackupEntries(new Store(), {})).rejects.toThrow(/为空/);
    });

    it('后续键写入失败时恢复已改动旧值并移除本次新键', async () => {
        const store = new Store();
        await store.setItem('a', 'old');
        const write = store.setItem.bind(store);
        let failed = false;
        vi.spyOn(store, 'setItem').mockImplementation(async (key, value) => {
            if (key === 'c' && !failed) { failed = true; throw new Error('写入失败'); }
            return write(key, value);
        });
        await expect(restoreBackupEntries(store, { a: 'new', b: 'added', c: 'fail' })).rejects.toThrow('写入失败');
        expect(Object.fromEntries(store.data)).toEqual({ a: 'old' });
    });

    it('静默丢写必须由回读校验拦截并补偿', async () => {
        const store = new Store();
        await store.setItem('a', 'old');
        const write = store.setItem.bind(store);
        vi.spyOn(store, 'setItem').mockImplementation((key, value) =>
            value === 'lost' ? Promise.resolve(value) : write(key, value));
        await expect(restoreBackupEntries(store, { a: 'new', b: 'lost' })).rejects.toThrow(/校验失败.*b/);
        expect(Object.fromEntries(store.data)).toEqual({ a: 'old' });
    });

    it('已落盘后拒绝的当前键也必须补偿', async () => {
        const store = new Store();
        const write = store.setItem.bind(store);
        vi.spyOn(store, 'setItem').mockImplementation(async (key, value) => {
            await write(key, value);
            if (value === 'new') throw new Error('提交后异常');
            return value;
        });
        await expect(restoreBackupEntries(store, { a: 'new' })).rejects.toThrow('提交后异常');
        expect(await store.keys()).toEqual([]);
    });

    it('补偿也失败时明确说明不能宣称完整恢复', async () => {
        const store = new Store();
        await store.setItem('a', 'old');
        vi.spyOn(store, 'setItem').mockRejectedValue(new Error('存储不可用'));
        await expect(restoreBackupEntries(store, { a: 'new' })).rejects.toThrow(/回滚未完成.*a/);
    });

    it('StorageManager 真正调用全量恢复，不需要暂存遍历', async () => {
        const store = new Store();
        const manager = new StorageManager(store);
        await manager.importData(backup);
        expect(await manager.exportData()).toEqual(backup);
    });

    it('迁移未完成不能视为恢复成功', async () => {
        const manager = new StorageManager(new Store());
        vi.spyOn(manager, 'runMigrations').mockResolvedValue();
        await expect(manager.importData({ car_list: [] })).rejects.toThrow(/迁移未完成/);
    });

    it('失败后缓存失效，不展示旧内存状态作为验证结果', async () => {
        const store = new Store();
        const manager = new StorageManager(store);
        manager.cacheSettingObj = { old: true };
        manager.cacheCarList = [];
        vi.spyOn(store, 'setItem').mockRejectedValue(new Error('不可写'));
        await expect(manager.importData(backup)).rejects.toThrow();
        expect(manager.cacheSettingObj).toBeNull();
        expect(manager.cacheCarList).toBeNull();
    });
});

describe('JSON 值比较', () => {
    it('对象键顺序不同仍相等', () => {
        expect(backupValuesEqual({ a: [1, { b: 2 }], c: null }, { c: null, a: [1, { b: 2 }] })).toBe(true);
    });
    it.each([[1, '1'], [[1, 2], [2, 1]], [{ a: 1 }, { b: 1 }], [null, {}]])('不混淆不同值 %j / %j', (a, b) => {
        expect(backupValuesEqual(a, b)).toBe(false);
    });
});
