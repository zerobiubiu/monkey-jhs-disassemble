// @vitest-environment jsdom
/** 附加存储恢复不能吞掉写入错误或只校验内存镜像。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBackupExtras, stripBackupExtras } from '../../src/core/backup-extra-storage';
import { PersistentDataStore } from '../../src/core/storage/persistent-data-store';
import type { PersistentDataBackend, PersistentDataRecord } from '../../src/core/storage/persistent-data-backend';

const persistent = vi.hoisted(() => ({
    isInitialized: true, isActive: true,
    replaceNamespace: vi.fn(async () => undefined),
    verifyNamespaces: vi.fn(async () => undefined)
}));
vi.mock('../../src/core/storage/persistent-data-store', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(), persistentDataStore: persistent
}));
let gm: Map<string, unknown>;
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    gm = new Map();
    persistent.isInitialized = true;
    persistent.isActive = true;
    vi.stubGlobal('clog', { warn: vi.fn(), error: vi.fn() });
    vi.stubGlobal('GM_setValue', vi.fn((key: string, value: unknown) => gm.set(key, structuredClone(value))));
    vi.stubGlobal('GM_getValue', vi.fn((key: string, fallback: unknown) => gm.has(key) ? structuredClone(gm.get(key)) : fallback));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('附加数据校验', () => {
    it('合法 localStorage 和 GM 值写入并回读', async () => {
        await applyBackupExtras({ ls: { jhs_sortMethod: 'score' }, gm: { 'jdb:list-rating': { a: 5 } } });
        expect(localStorage.getItem('jhs_sortMethod')).toBe('score');
        expect(gm.get('jdb:list-rating')).toEqual({ a: 5 });
    });
    it('允许恢复空偏好值', async () => {
        await applyBackupExtras({ ls: { jhs_sortMethod: '' } });
        expect(localStorage.getItem('jhs_sortMethod')).toBe('');
    });
    it('localStorage 写入异常不能被吞掉', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('配额不足'); });
        await expect(applyBackupExtras({ ls: { jhs_sortMethod: 'score' } })).rejects.toThrow('配额不足');
    });
    it('localStorage 静默丢写不能显示成功', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
        await expect(applyBackupExtras({ ls: { jhs_sortMethod: 'score' } })).rejects.toThrow(/恢复校验失败/);
    });
    it('GM 写入异常不能被吞掉', async () => {
        vi.mocked(GM_setValue).mockImplementation(() => { throw new Error('GM 不可写'); });
        await expect(applyBackupExtras({ gm: { 'jdb:list-rating': { a: 5 } } })).rejects.toThrow('GM 不可写');
    });
    it('GM 静默丢写必须由回读拦截', async () => {
        vi.mocked(GM_setValue).mockImplementation(() => {});
        await expect(applyBackupExtras({ gm: { 'jdb:list-rating': { a: 5 } } })).rejects.toThrow(/GM.*校验失败/);
    });
    it('旧访问记录恢复到持久数据并要求磁盘校验', async () => {
        await applyBackupExtras({ ls: { jhs_visit_history: '{"/v/a":123}' } });
        expect(persistent.replaceNamespace).toHaveBeenCalledWith('visitHistory', { '/v/a': 123 });
        expect(persistent.verifyNamespaces).toHaveBeenCalledWith({ visitHistory: { '/v/a': 123 } });
    });
    it('新版 namespace 优先，旧副本不能反向覆盖', async () => {
        await applyBackupExtras({
            persistent: { visitHistory: { '/v/new': 2 } },
            ls: { jhs_visit_history: '{"/v/old":1}' }
        });
        expect(persistent.replaceNamespace).toHaveBeenCalledExactlyOnceWith('visitHistory', { '/v/new': 2 });
        expect(localStorage.getItem('jhs_visit_history')).toBeNull();
    });
    it('旧格式错误不能吞掉后伪装成功', async () => {
        await expect(applyBackupExtras({ ls: { jhs_visit_history: 'broken' } })).rejects.toThrow();
    });
    it('未启用新持久存储时兼容旧 localStorage', async () => {
        persistent.isActive = false;
        await applyBackupExtras({ ls: { jhs_visit_history: '{"/v/a":1}' } });
        expect(JSON.parse(localStorage.getItem('jhs_visit_history')!)).toEqual({ '/v/a': 1 });
    });
    it('新持久数据无法落库时明确失败', async () => {
        persistent.isActive = false;
        await expect(applyBackupExtras({ persistent: { visitHistory: {} } })).rejects.toThrow(/存储不可用/);
    });
    it('保持既有白名单，不写入任意 GM 或 localStorage 键', async () => {
        await applyBackupExtras({ ls: { password: 'no' }, gm: { token: 'no' } });
        expect(localStorage.getItem('password')).toBeNull();
        expect(gm.size).toBe(0);
    });
    it.each(['__localStorage', '__gmStorage', '__persistentData'])('%s 为数组时在主库写入前拒绝', (key) => {
        expect(() => stripBackupExtras({ [key]: [] })).toThrow(/必须是对象/);
    });
    it('持久 namespace 为空值时在主库写入前拒绝', () => {
        expect(() => stripBackupExtras({ __persistentData: { visitHistory: null } })).toThrow();
    });
});

describe('PersistentDataStore 从后端校验', () => {
    function backend(): PersistentDataBackend & { records: PersistentDataRecord[] } {
        const store = {
            records: [] as PersistentDataRecord[],
            async loadRecords() { return structuredClone(this.records); },
            async putRecords(records: PersistentDataRecord[]) { for (const record of records) await this.putRecord(record); },
            async putRecord(record: PersistentDataRecord) {
                this.records = this.records.filter((item) => item.id !== record.id);
                this.records.push(structuredClone(record));
            },
            async deleteRecord(id: string) { this.records = this.records.filter((record) => record.id !== id); },
            async loadMeta() { return null; }, async saveMeta() {}
        };
        return store;
    }
    it('内存和后端相同才通过校验', async () => {
        const disk = backend();
        const store = new PersistentDataStore(disk);
        await store.initialize();
        await store.replaceNamespace('visitHistory', { a: 1 });
        await expect(store.verifyNamespaces({ visitHistory: { a: 1 } })).resolves.toBeUndefined();
    });
    it('即使内存正确，后端丢写仍必须报错', async () => {
        const disk = backend();
        const store = new PersistentDataStore(disk);
        await store.initialize();
        vi.spyOn(disk, 'putRecord').mockResolvedValue();
        await store.replaceNamespace('visitHistory', { a: 1 });
        expect(store.getNamespace('visitHistory')).toEqual({ a: 1 });
        await expect(store.verifyNamespaces({ visitHistory: { a: 1 } })).rejects.toThrow(/持久数据恢复校验失败/);
    });
    it('空 namespace 必须确认旧记录已删除', async () => {
        const disk = backend();
        const store = new PersistentDataStore(disk);
        await store.initialize();
        await store.replaceNamespace('visitHistory', { a: 1 });
        await store.replaceNamespace('visitHistory', {});
        await expect(store.verifyNamespaces({ visitHistory: {} })).resolves.toBeUndefined();
    });
});
