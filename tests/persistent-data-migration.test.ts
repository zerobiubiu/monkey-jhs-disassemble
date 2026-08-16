import { beforeEach, describe, expect, it } from 'vitest';

import {
    PersistentDataStore,
    type PersistentDataBackend,
    type PersistentDataMeta,
    type PersistentDataRecord
} from '../src/core/storage/persistent-data-store';
import { migratePersistentData } from '../src/core/storage/persistent-data-migration';

class FakeBackend implements PersistentDataBackend {
    records = new Map<string, PersistentDataRecord>();
    meta = new Map<string, PersistentDataMeta>();
    failWrites = false;
    putRecordsCalls = 0;

    async loadRecords(): Promise<PersistentDataRecord[]> {
        return [...this.records.values()];
    }

    async putRecords(records: PersistentDataRecord[]): Promise<void> {
        this.putRecordsCalls++;
        if (this.failWrites) throw new Error('write failed');
        for (const record of records) this.records.set(record.id, structuredClone(record));
    }

    async putRecord(record: PersistentDataRecord): Promise<void> {
        await this.putRecords([record]);
    }

    async deleteRecord(id: string): Promise<void> {
        if (this.failWrites) throw new Error('delete failed');
        this.records.delete(id);
    }

    async loadMeta(key: string): Promise<PersistentDataMeta | null> {
        return this.meta.get(key) ?? null;
    }

    async saveMeta(meta: PersistentDataMeta): Promise<void> {
        if (this.failWrites) throw new Error('meta write failed');
        this.meta.set(meta.key, structuredClone(meta));
    }
}

class FakeLegacyStorage {
    private values = new Map<string, string>();

    seed(key: string, value: unknown): void {
        this.values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    get length(): number {
        return this.values.size;
    }

    key(index: number): string | null {
        return [...this.values.keys()][index] ?? null;
    }

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    has(key: string): boolean {
        return this.values.has(key);
    }
}

describe('PersistentDataStore', () => {
    let backend: FakeBackend;
    let store: PersistentDataStore;

    beforeEach(async () => {
        backend = new FakeBackend();
        store = new PersistentDataStore(backend);
        await store.initialize();
    });

    it('stores entries by namespace without collapsing them into one JSON value', async () => {
        await store.set('translate', 'ABC-001', '中文标题');
        await store.set('translate', 'ABC-002', '另一个标题');

        expect(store.get('translate', 'ABC-001')).toBe('中文标题');
        expect(store.getNamespace('translate')).toEqual({
            'ABC-001': '中文标题',
            'ABC-002': '另一个标题'
        });
        expect(backend.records.size).toBe(2);
    });

    it('updates the in-memory value before the backend write resolves', async () => {
        backend.failWrites = true;

        await expect(store.set('translate', 'ABC-001', '标题')).rejects.toThrow('write failed');
        expect(store.get('translate', 'ABC-001')).toBe('标题');
    });
});

describe('migratePersistentData', () => {
    it('copies legacy maps, journals, and prefixes before deleting verified source keys', async () => {
        const backend = new FakeBackend();
        const store = new PersistentDataStore(backend);
        await store.initialize();
        const legacy = new FakeLegacyStorage();
        legacy.seed('jhs_translate', { 'ABC-001': '标题' });
        legacy.seed('jhs:sync_session_v1', { phase: 'execute', queueDone: 2 });
        legacy.seed('jdb:vlt-pending-server-sync:123:abc', { version: 1, videoId: 'v1' });

        const result = await migratePersistentData(store, legacy);

        expect(result.phase).toBe('complete');
        expect(store.get('translate', 'ABC-001')).toBe('标题');
        expect(store.get('syncSession', 'current')).toEqual({ phase: 'execute', queueDone: 2 });
        expect(store.get('vltPending', '123:abc')).toEqual({ version: 1, videoId: 'v1' });
        expect(legacy.has('jhs_translate')).toBe(false);
        expect(legacy.has('jhs:sync_session_v1')).toBe(false);
        expect(legacy.has('jdb:vlt-pending-server-sync:123:abc')).toBe(false);
        expect(backend.putRecordsCalls).toBe(1);
    });

    it('keeps malformed journal sources instead of deleting them', async () => {
        const backend = new FakeBackend();
        const store = new PersistentDataStore(backend);
        await store.initialize();
        const legacy = new FakeLegacyStorage();
        legacy.seed('jhs:sync_session_v1', null);

        await expect(migratePersistentData(store, legacy)).rejects.toThrow('不是对象');
        expect(legacy.has('jhs:sync_session_v1')).toBe(true);
    });

    it('keeps legacy keys when destination writes fail', async () => {
        const backend = new FakeBackend();
        const store = new PersistentDataStore(backend);
        await store.initialize();
        const legacy = new FakeLegacyStorage();
        legacy.seed('jhs_translate', { 'ABC-001': '标题' });
        backend.failWrites = true;

        await expect(migratePersistentData(store, legacy)).rejects.toThrow('write failed');
        expect(legacy.has('jhs_translate')).toBe(true);
    });
});
