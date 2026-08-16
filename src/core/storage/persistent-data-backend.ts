/**
 * JAV-JHS-PersistentData 的 IndexedDB 后端与公共记录类型。
 *
 * 该文件只负责数据库连接和事务，不包含迁移策略或业务 namespace 逻辑。
 */

export const PERSISTENT_DATA_DB_NAME = 'JAV-JHS-PersistentData';
export const PERSISTENT_DATA_DB_VERSION = 1;
export const PERSISTENT_DATA_RECORD_STORE = 'records';
export const PERSISTENT_DATA_META_STORE = 'meta';

export interface PersistentDataRecord {
    id: string;
    namespace: string;
    entryKey: string;
    value: unknown;
}
export interface PersistentDataMeta {
    key: string;
    [property: string]: unknown;
}

export interface PersistentDataBackend {
    loadRecords(): Promise<PersistentDataRecord[]>;
    putRecords(records: PersistentDataRecord[]): Promise<void>;
    putRecord(record: PersistentDataRecord): Promise<void>;
    deleteRecord(id: string): Promise<void>;
    loadMeta(key: string): Promise<PersistentDataMeta | null>;
    saveMeta(meta: PersistentDataMeta): Promise<void>;
}

export class IndexedDbBackend implements PersistentDataBackend {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private open(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;
        if (typeof indexedDB === 'undefined') {
            return Promise.reject(new Error('当前环境不支持 IndexedDB'));
        }

        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(PERSISTENT_DATA_DB_NAME, PERSISTENT_DATA_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(PERSISTENT_DATA_RECORD_STORE)) {
                    const store = db.createObjectStore(PERSISTENT_DATA_RECORD_STORE, {
                        keyPath: 'id'
                    });
                    store.createIndex('namespace', 'namespace', { unique: false });
                }
                if (!db.objectStoreNames.contains(PERSISTENT_DATA_META_STORE)) {
                    db.createObjectStore(PERSISTENT_DATA_META_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => db.close();
                resolve(db);
            };
            request.onerror = () => reject(request.error ?? new Error('打开持久数据数据库失败'));
            request.onblocked = () => reject(new Error('持久数据数据库升级被其他标签页阻塞'));
        });
        return this.dbPromise;
    }

    async loadRecords(): Promise<PersistentDataRecord[]> {
        const db = await this.open();
        return await new Promise<PersistentDataRecord[]>((resolve, reject) => {
            const tx = db.transaction(PERSISTENT_DATA_RECORD_STORE, 'readonly');
            const request = tx.objectStore(PERSISTENT_DATA_RECORD_STORE).getAll();
            request.onsuccess = () => resolve(request.result as PersistentDataRecord[]);
            request.onerror = () => reject(request.error ?? new Error('读取持久数据失败'));
        });
    }

    async putRecords(records: PersistentDataRecord[]): Promise<void> {
        if (records.length === 0) return;
        const db = await this.open();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(PERSISTENT_DATA_RECORD_STORE, 'readwrite');
            const objectStore = tx.objectStore(PERSISTENT_DATA_RECORD_STORE);
            for (const record of records) objectStore.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('写入持久数据失败'));
            tx.onabort = () => reject(tx.error ?? new Error('写入持久数据事务中止'));
        });
    }

    async putRecord(record: PersistentDataRecord): Promise<void> {
        await this.putRecords([record]);
    }

    async deleteRecord(id: string): Promise<void> {
        const db = await this.open();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(PERSISTENT_DATA_RECORD_STORE, 'readwrite');
            tx.objectStore(PERSISTENT_DATA_RECORD_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('删除持久数据失败'));
            tx.onabort = () => reject(tx.error ?? new Error('删除持久数据事务中止'));
        });
    }

    async loadMeta(key: string): Promise<PersistentDataMeta | null> {
        const db = await this.open();
        return await new Promise<PersistentDataMeta | null>((resolve, reject) => {
            const tx = db.transaction(PERSISTENT_DATA_META_STORE, 'readonly');
            const request = tx.objectStore(PERSISTENT_DATA_META_STORE).get(key);
            request.onsuccess = () => resolve((request.result as PersistentDataMeta | undefined) ?? null);
            request.onerror = () => reject(request.error ?? new Error('读取持久数据状态失败'));
        });
    }

    async saveMeta(meta: PersistentDataMeta): Promise<void> {
        const db = await this.open();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(PERSISTENT_DATA_META_STORE, 'readwrite');
            tx.objectStore(PERSISTENT_DATA_META_STORE).put(meta);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('写入持久数据状态失败'));
            tx.onabort = () => reject(tx.error ?? new Error('写入持久数据状态事务中止'));
        });
    }
}
