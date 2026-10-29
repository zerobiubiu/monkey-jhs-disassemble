/**
 * JavDB 大型持久数据存储。
 *
 * 大型缓存和恢复日志从 JavDB Origin 的 localStorage 迁移到独立 IndexedDB，
 * 不触碰现有的 JAV-JHS/appData 或 MissAV-CarStatus 数据库。
 */

import {
    IndexedDbBackend,
    type PersistentDataBackend,
    type PersistentDataMeta,
    type PersistentDataRecord
} from './persistent-data-backend';
import { backupValuesEqual } from './backup-restore';

export {
    PERSISTENT_DATA_DB_NAME,
    PERSISTENT_DATA_DB_VERSION,
    PERSISTENT_DATA_RECORD_STORE,
    PERSISTENT_DATA_META_STORE
} from './persistent-data-backend';
export type {
    PersistentDataBackend,
    PersistentDataMeta,
    PersistentDataRecord
} from './persistent-data-backend';

export type PersistentNamespace =
    | 'translate'
    | 'dmmVideo'
    | 'otherSite'
    | 'otherSiteDmm'
    | 'screenShot'
    | 'actressInfo'
    | 'scoreInfo'
    | 'visitHistory'
    | 'externalVisit'
    | 'syncSession'
    | 'vltPending'
    | 'carSyncIntent'
    | 'reflowJournal'
    | 'reflowRollback';

export const PERSISTENT_DATA_NAMESPACES: readonly PersistentNamespace[] = [
    'translate',
    'dmmVideo',
    'otherSite',
    'otherSiteDmm',
    'screenShot',
    'actressInfo',
    'scoreInfo',
    'visitHistory',
    'externalVisit',
    'syncSession',
    'vltPending',
    'carSyncIntent',
    'reflowJournal',
    'reflowRollback'
];

const LEGACY_KEY_NAMESPACES: Readonly<Record<string, PersistentNamespace>> = {
    jhs_translate: 'translate',
    jhs_dmm_video: 'dmmVideo',
    jhs_other_site: 'otherSite',
    jhs_other_site_dmm: 'otherSiteDmm',
    jhs_screenShot: 'screenShot',
    jhs_actress_info: 'actressInfo',
    jhs_score_info: 'scoreInfo',
    jhs_visit_history: 'visitHistory'
};

export function getPersistentNamespaceForLegacyKey(key: string): PersistentNamespace | undefined {
    return LEGACY_KEY_NAMESPACES[key];
}

function recordId(namespace: string, entryKey: string): string {
    return `${namespace}\u0000${entryKey}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reportPersistenceError(error: unknown): void {
    const logger = typeof window !== 'undefined' && window.clog ? window.clog : null;
    if (logger) {
        logger.error('持久数据写入 IndexedDB 失败', error);
    } else {
        console.error('持久数据写入 IndexedDB 失败', error);
    }
}

export class PersistentDataStore {
    private readonly records = new Map<string, PersistentDataRecord>();
    private writeQueue: Promise<void> = Promise.resolve();
    private initialized = false;
    private active = false;

    constructor(private readonly backend: PersistentDataBackend = new IndexedDbBackend()) {}

    async initialize(): Promise<void> {
        this.records.clear();
        for (const record of await this.backend.loadRecords()) {
            this.records.set(record.id, record);
        }
        this.initialized = true;
        this.active = false;
    }

    get isInitialized(): boolean {
        return this.initialized;
    }

    get isActive(): boolean {
        return this.active;
    }

    activate(): void {
        this.assertInitialized();
        this.active = true;
    }

    deactivate(): void {
        this.active = false;
    }

    get<T>(namespace: string, entryKey: string): T | undefined {
        this.assertInitialized();
        return this.records.get(recordId(namespace, entryKey))?.value as T | undefined;
    }

    getNamespace<T>(namespace: string): Record<string, T> {
        this.assertInitialized();
        const result = Object.create(null) as Record<string, T>;
        for (const record of this.records.values()) {
            if (record.namespace === namespace) {
                Object.defineProperty(result, record.entryKey, {
                    configurable: true,
                    enumerable: true,
                    value: record.value as T,
                    writable: true
                });
            }
        }
        return result;
    }

    async set<T>(namespace: string, entryKey: string, value: T): Promise<void> {
        await this.setMany([{ namespace, entryKey, value }]);
    }

    async setMany<T>(
        entries: readonly { namespace: string; entryKey: string; value: T }[]
    ): Promise<void> {
        this.assertInitialized();
        const records = entries.map((entry) => ({
            id: recordId(entry.namespace, entry.entryKey),
            namespace: entry.namespace,
            entryKey: entry.entryKey,
            value: entry.value
        }));
        for (const record of records) this.records.set(record.id, record);
        await this.enqueueWrite(() => this.backend.putRecords(records));
    }

    async delete(namespace: string, entryKey: string): Promise<void> {
        this.assertInitialized();
        const id = recordId(namespace, entryKey);
        this.records.delete(id);
        await this.enqueueWrite(() => this.backend.deleteRecord(id));
    }

    async replaceNamespace<T>(namespace: string, values: Record<string, T>): Promise<void> {
        this.assertInitialized();
        const oldRecords = [...this.records.values()].filter((record) => record.namespace === namespace);
        const nextRecords = Object.entries(values).map(([entryKey, value]) => ({
            id: recordId(namespace, entryKey),
            namespace,
            entryKey,
            value
        }));

        // 先更新镜像，调用方不会在异步后端写入期间读到混合的新旧 namespace。
        for (const record of oldRecords) this.records.delete(record.id);
        for (const record of nextRecords) this.records.set(record.id, record);

        await this.enqueueWrite(async () => {
            for (const record of nextRecords) await this.backend.putRecord(record);
            for (const record of oldRecords) {
                if (!this.records.has(record.id)) await this.backend.deleteRecord(record.id);
            }
        });
    }

    async clearNamespace(namespace: string): Promise<void> {
        await this.replaceNamespace(namespace, {});
    }

    exportNamespaces(namespaces: readonly PersistentNamespace[]): Record<string, Record<string, unknown>> {
        this.assertInitialized();
        const result: Record<string, Record<string, unknown>> = {};
        for (const namespace of namespaces) {
            result[namespace] = this.getNamespace<unknown>(namespace);
        }
        return result;
    }


    /** 从持久后端回读而非读取内存镜像，确保恢复内容已真正落盘。 */
    async verifyNamespaces(expected: Record<string, Record<string, unknown>>): Promise<void> {
        await this.flush();
        const records = await this.backend.loadRecords();
        for (const [namespace, values] of Object.entries(expected)) {
            const actual: Record<string, unknown> = Object.create(null);
            for (const record of records) {
                if (record.namespace === namespace) actual[record.entryKey] = record.value;
            }
            if (!backupValuesEqual(actual, values)) {
                throw new Error(`持久数据恢复校验失败：${namespace}`);
            }
        }
    }

    async getMeta<T extends PersistentDataMeta>(key: string): Promise<T | null> {
        return (await this.backend.loadMeta(key)) as T | null;
    }

    async setMeta(meta: PersistentDataMeta): Promise<void> {
        await this.backend.saveMeta(meta);
    }

    async flush(): Promise<void> {
        await this.writeQueue;
    }

    private enqueueWrite(task: () => Promise<void>): Promise<void> {
        const operation = this.writeQueue.then(task);
        this.writeQueue = operation.catch(() => undefined);
        return operation;
    }

    private assertInitialized(): void {
        if (!this.initialized) throw new Error('持久数据存储尚未初始化');
    }
}

export const persistentDataStore = new PersistentDataStore();

/** 等待当前页已发起的持久数据写入后再执行备份。 */
export async function flushPersistentData(): Promise<void> {
    if (persistentDataStore.isActive) await persistentDataStore.flush();
}

/** 读取已迁移 namespace；迁移未激活时返回 localStorage 的兼容副本。 */
export function readPersistentMap<T>(namespace: PersistentNamespace, legacyKey: string): Record<string, T> {
    if (persistentDataStore.isActive) return persistentDataStore.getNamespace<T>(namespace);
    try {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) return {};
        const value: unknown = JSON.parse(raw);
        return isRecord(value) ? (value as Record<string, T>) : {};
    } catch {
        return {};
    }
}

/** 写入一个大型缓存条目；迁移未激活时保留旧 localStorage 兼容路径。 */
export function writePersistentEntry<T>(
    namespace: PersistentNamespace,
    legacyKey: string,
    entryKey: string,
    value: T
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.set(namespace, entryKey, value).catch(reportPersistenceError);
        return;
    }
    try {
        const cache = readPersistentMap<T>(namespace, legacyKey);
        cache[entryKey] = value;
        localStorage.setItem(legacyKey, JSON.stringify(cache));
    } catch (error) {
        reportPersistenceError(error);
    }
}

/** 替换一个 namespace；用于访问记录等需要淘汰旧条目的缓存。 */
export function replacePersistentMap<T>(
    namespace: PersistentNamespace,
    legacyKey: string,
    values: Record<string, T>
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.replaceNamespace(namespace, values).catch(reportPersistenceError);
        return;
    }
    try {
        localStorage.setItem(legacyKey, JSON.stringify(values));
    } catch (error) {
        reportPersistenceError(error);
    }
}

/** 读取单条恢复数据；迁移未激活时解析旧 key。 */
export function readPersistentValue<T>(
    namespace: PersistentNamespace,
    entryKey: string,
    legacyKey: string
): T | null {
    if (persistentDataStore.isActive) return persistentDataStore.get<T>(namespace, entryKey) ?? null;
    try {
        const raw = localStorage.getItem(legacyKey);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

/** 写入单条恢复数据；迁移未激活时保留旧 key。 */
export function writePersistentValue<T>(
    namespace: PersistentNamespace,
    entryKey: string,
    legacyKey: string,
    value: T
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.set(namespace, entryKey, value).catch(reportPersistenceError);
        return;
    }
    try {
        localStorage.setItem(legacyKey, JSON.stringify(value));
    } catch (error) {
        reportPersistenceError(error);
    }
}

/** 写入单条恢复数据并等待 IndexedDB 提交；用于不可丢失的操作前恢复日志。 */
export async function writePersistentValueAndWait<T>(
    namespace: PersistentNamespace,
    entryKey: string,
    legacyKey: string,
    value: T
): Promise<void> {
    if (persistentDataStore.isActive) {
        await persistentDataStore.set(namespace, entryKey, value);
        return;
    }
    localStorage.setItem(legacyKey, JSON.stringify(value));
}

/** 删除单条恢复数据。 */
export function removePersistentValue(
    namespace: PersistentNamespace,
    entryKey: string,
    legacyKey: string
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.delete(namespace, entryKey).catch(reportPersistenceError);
        return;
    }
    try {
        localStorage.removeItem(legacyKey);
    } catch (error) {
        reportPersistenceError(error);
    }
}


/** 读取按前缀拆分的旧版条目。 */
export function readPersistentPrefix<T>(
    namespace: PersistentNamespace,
    legacyPrefix: string
): Record<string, T> {
    if (persistentDataStore.isActive) return persistentDataStore.getNamespace<T>(namespace);
    const result: Record<string, T> = {};
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith(legacyPrefix)) continue;
            try {
                const raw = localStorage.getItem(key);
                if (raw !== null && raw !== '') {
                    result[key.slice(legacyPrefix.length)] = JSON.parse(raw) as T;
                }
            } catch {
                /* 单条损坏数据不阻断其他日志读取 */
            }
        }
    } catch {
        /* localStorage 不可用 */
    }
    return result;
}

/** 清理按前缀拆分的旧版条目。 */
export function clearPersistentPrefix(
    namespace: PersistentNamespace,
    legacyPrefix: string
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.clearNamespace(namespace).catch(reportPersistenceError);
    }
    try {
        const keys: string[] = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(legacyPrefix)) keys.push(key);
        }
        for (const key of keys) localStorage.removeItem(key);
    } catch (error) {
        reportPersistenceError(error);
    }
}

/** 清理整个 namespace 及其兼容 localStorage key。 */
export function clearPersistentNamespace(
    namespace: PersistentNamespace,
    legacyKey: string
): void {
    if (persistentDataStore.isActive) {
        void persistentDataStore.clearNamespace(namespace).catch(reportPersistenceError);
    }
    try {
        localStorage.removeItem(legacyKey);
    } catch (error) {
        reportPersistenceError(error);
    }
}
