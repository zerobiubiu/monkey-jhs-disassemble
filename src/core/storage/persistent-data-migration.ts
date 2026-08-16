/**
 * JavDB 大型 localStorage 数据迁移。
 *
 * 迁移过程先复制并校验，再删除旧副本；未知 key 不在自动清理范围内。
 */

import {
    type PersistentDataMeta,
    type PersistentDataStore,
    type PersistentNamespace
} from './persistent-data-store';

const MIGRATION_META_KEY = 'persistent-data-v1';
const SINGLE_ENTRY_KEY = 'current';

interface LegacyStorage {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    removeItem(key: string): void;
}

interface MigrationState extends PersistentDataMeta {
    key: typeof MIGRATION_META_KEY;
    phase: 'copying' | 'verified' | 'cleanup-pending' | 'complete';
    sourceKeys: string[];
    updatedAt: number;
}

export interface PersistentMigrationResult {
    phase: MigrationState['phase'];
    migratedKeys: string[];
    removedKeys: string[];
    retainedKeys: string[];
}

interface PendingEntry {
    namespace: PersistentNamespace;
    entryKey: string;
    value: unknown;
    sourceKey: string;
}

interface MapSpec {
    legacyKey: string;
    namespace: PersistentNamespace;
}

interface SingleSpec {
    legacyKey: string;
    namespace: PersistentNamespace;
}

interface PrefixSpec {
    prefix: string;
    namespace: PersistentNamespace;
}

const MAP_SPECS: readonly MapSpec[] = [
    { legacyKey: 'jhs_translate', namespace: 'translate' },
    { legacyKey: 'jhs_dmm_video', namespace: 'dmmVideo' },
    { legacyKey: 'jhs_other_site', namespace: 'otherSite' },
    { legacyKey: 'jhs_other_site_dmm', namespace: 'otherSiteDmm' },
    { legacyKey: 'jhs_screenShot', namespace: 'screenShot' },
    { legacyKey: 'jhs_actress_info', namespace: 'actressInfo' },
    { legacyKey: 'jhs_score_info', namespace: 'scoreInfo' },
    { legacyKey: 'jhs_visit_history', namespace: 'visitHistory' }
];

const SINGLE_SPECS: readonly SingleSpec[] = [
    { legacyKey: 'jhs:sync_session_v1', namespace: 'syncSession' },
    { legacyKey: 'jhs:reflow:journal', namespace: 'reflowJournal' }
];

const PREFIX_SPECS: readonly PrefixSpec[] = [
    { prefix: 'jdb:vlt-pending-server-sync:', namespace: 'vltPending' },
    { prefix: 'jhs:car-sync-intent:', namespace: 'carSyncIntent' },
    { prefix: 'jhs:reflow:rollback:', namespace: 'reflowRollback' }
];

function getStorageKeys(storage: LegacyStorage): string[] {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key) keys.push(key);
    }
    return keys;
}

function parseJson(raw: string, sourceKey: string): unknown {
    try {
        return JSON.parse(raw);
    } catch (error) {
        // eslint-disable-next-line preserve-caught-error -- 迁移错误需保持稳定的用户可见提示
        throw new Error(
            `无法解析旧版持久数据 ${sourceKey}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isObject(value)) return value;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) sorted[key] = stableValue(value[key]);
    return sorted;
}

function stableJson(value: unknown): string {
    return JSON.stringify(stableValue(value));
}

function collectEntries(storage: LegacyStorage): PendingEntry[] {
    const entries: PendingEntry[] = [];

    for (const spec of MAP_SPECS) {
        const raw = storage.getItem(spec.legacyKey);
        if (raw === null || raw === '') continue;
        const value = parseJson(raw, spec.legacyKey);
        if (!isObject(value)) {
            throw new Error(`旧版持久数据 ${spec.legacyKey} 不是对象，已停止迁移`);
        }
        for (const [entryKey, entryValue] of Object.entries(value)) {
            entries.push({
                namespace: spec.namespace,
                entryKey,
                value: entryValue,
                sourceKey: spec.legacyKey
            });
        }
    }

    for (const spec of SINGLE_SPECS) {
        const raw = storage.getItem(spec.legacyKey);
        if (raw === null || raw === '') continue;
        const value = parseJson(raw, spec.legacyKey);
        if (!isObject(value)) {
            throw new Error(`旧版持久数据 ${spec.legacyKey} 不是对象，已停止迁移`);
        }
        entries.push({
            namespace: spec.namespace,
            entryKey: SINGLE_ENTRY_KEY,
            value,
            sourceKey: spec.legacyKey
        });
    }

    const allKeys = getStorageKeys(storage);
    for (const spec of PREFIX_SPECS) {
        for (const sourceKey of allKeys) {
            if (!sourceKey.startsWith(spec.prefix)) continue;
            const raw = storage.getItem(sourceKey);
            if (raw === null || raw === '') continue;
            const value = parseJson(raw, sourceKey);
            const validValue =
                spec.namespace === 'reflowRollback' ? Array.isArray(value) : isObject(value);
            if (!validValue) {
                throw new Error(`旧版持久数据 ${sourceKey} 格式无效，已停止迁移`);
            }
            entries.push({
                namespace: spec.namespace,
                entryKey: sourceKey.slice(spec.prefix.length),
                value,
                sourceKey
            });
        }
    }

    return entries;
}

function sourceKeysFor(entries: PendingEntry[]): string[] {
    return [...new Set(entries.map((entry) => entry.sourceKey))].sort();
}

function verifyEntries(store: PersistentDataStore, entries: PendingEntry[]): void {
    const expected = new Map<string, PendingEntry>();
    for (const entry of entries) {
        expected.set(`${entry.namespace}\u0000${entry.entryKey}`, entry);
    }

    const namespaces = new Set(entries.map((entry) => entry.namespace));
    for (const namespace of namespaces) {
        const actual = store.getNamespace(namespace);
        const expectedEntries = [...expected.values()].filter((entry) => entry.namespace === namespace);
        if (Object.keys(actual).length !== expectedEntries.length) {
            throw new Error(`持久数据校验失败：${namespace} 记录数量不一致`);
        }
        for (const entry of expectedEntries) {
            if (stableJson(actual[entry.entryKey]) !== stableJson(entry.value)) {
                throw new Error(`持久数据校验失败：${namespace}/${entry.entryKey}`);
            }
        }
    }
}

function buildState(
    phase: MigrationState['phase'],
    sourceKeys: string[]
): MigrationState {
    return {
        key: MIGRATION_META_KEY,
        phase,
        sourceKeys,
        updatedAt: Date.now()
    };
}

/**
 * 执行 JavDB localStorage → IndexedDB 迁移。
 * @param store 已初始化的新持久数据存储
 * @param storage 旧版 localStorage，测试时可注入替身
 */
export async function migratePersistentData(
    store: PersistentDataStore,
    storage: LegacyStorage = localStorage
): Promise<PersistentMigrationResult> {
    const entries = collectEntries(storage);
    const sourceKeys = sourceKeysFor(entries);
    const previous = await store.getMeta<MigrationState>(MIGRATION_META_KEY);

    if (entries.length === 0 && previous?.phase === 'complete') {
        store.activate();
        return { phase: 'complete', migratedKeys: [], removedKeys: [], retainedKeys: [] };
    }

    await store.setMeta(buildState('copying', sourceKeys));
    // 一次 IndexedDB 事务写入全部迁移记录，避免逐条事务让启动阶段长时间阻塞。
    await store.setMany(entries);
    verifyEntries(store, entries);
    await store.setMeta(buildState('verified', sourceKeys));
    store.activate();

    const removedKeys: string[] = [];
    const retainedKeys: string[] = [];
    for (const sourceKey of sourceKeys) {
        try {
            storage.removeItem(sourceKey);
            removedKeys.push(sourceKey);
        } catch {
            retainedKeys.push(sourceKey);
        }
    }

    const phase: MigrationState['phase'] = retainedKeys.length === 0 ? 'complete' : 'cleanup-pending';
    await store.setMeta(buildState(phase, sourceKeys));
    return { phase, migratedKeys: sourceKeys, removedKeys, retainedKeys };
}

export const PERSISTENT_MIGRATION_META_KEY = MIGRATION_META_KEY;
