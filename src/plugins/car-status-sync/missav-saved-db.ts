/**
 * MissAV 原生收藏状态本地 IndexedDB 存储层。
 *
 * 使用同域 `MissAV-CarStatus` 数据库中的 `missav_saved` 仓库（主键为规范化小写 `slug`，
 * 例如 `royd-380-uncensored-leak` 或 `fns-260`），保证 MissAV 同番号不同版本
 * （有码 / 无码流出 / 中文字幕）各自拥有精确独立的收藏状态，不会互相串扰。
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import { withExclusiveLock } from '../../core/sync';
import { extractMissavSlug } from '../../core/util/site/missav-paths';

import {
    MISSAV_DB_META_STORE,
    MISSAV_DB_SAVED_STORE,
    MISSAV_SAVED_LOCK_NAME,
    MISSAV_SAVED_META_KEY
} from './car-status-config';
import { openLocalDB } from './car-status-db';

/** 单条 MissAV 原生收藏输入项。 */
export interface MissavSavedItemInput {
    slug: string;
    carNum?: string;
}

/** 存储在 IndexedDB 中的 MissAV 收藏记录。 */
export interface StoredMissavSavedRecord {
    slug: string;
    carNum: string;
    savedAt: number;
}

/** MissAV 原生收藏同步元数据。 */
export interface MissavSavedMeta {
    key: string;
    count: number;
    lastFullSyncAt: number | null;
    updatedAt: number;
}

/** 批量写入或更新 MissAV 已收藏视频 slug。 */
export async function upsertMissavSaved(items: MissavSavedItemInput[]): Promise<number> {
    const dedup = new Map<string, StoredMissavSavedRecord>();
    const now = Date.now();
    for (const item of items) {
        const slug = extractMissavSlug(item.slug);
        if (!slug) continue;
        dedup.set(slug, {
            slug,
            carNum: item.carNum ? normalizeCarNum(item.carNum, 'path') : normalizeCarNum(slug, 'path'),
            savedAt: now
        });
    }
    if (dedup.size === 0) return 0;

    return withExclusiveLock(MISSAV_SAVED_LOCK_NAME, async () => {
        const db = await openLocalDB();
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([MISSAV_DB_SAVED_STORE, MISSAV_DB_META_STORE], 'readwrite');
                const store = tx.objectStore(MISSAV_DB_SAVED_STORE);
                const metaStore = tx.objectStore(MISSAV_DB_META_STORE);

                for (const rec of dedup.values()) {
                    store.put(rec);
                }
                const countReq = store.count();
                const metaReq = metaStore.get(MISSAV_SAVED_META_KEY);
                let totalCount = dedup.size;
                let prevMeta: Partial<MissavSavedMeta> | undefined;
                countReq.onsuccess = () => {
                    totalCount = countReq.result;
                };
                metaReq.onsuccess = () => {
                    prevMeta = metaReq.result as Partial<MissavSavedMeta> | undefined;
                    metaStore.put({
                        key: MISSAV_SAVED_META_KEY,
                        count: totalCount,
                        lastFullSyncAt: typeof prevMeta?.lastFullSyncAt === 'number' ? prevMeta.lastFullSyncAt : null,
                        updatedAt: Date.now()
                    } satisfies MissavSavedMeta);
                };

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('写入 MissAV 收藏失败'));
                tx.onabort = () => reject(tx.error || new Error('写入 MissAV 收藏事务中止'));
            });
            return dedup.size;
        } finally {
            db.close();
        }
    });
}

/** 批量删除取消收藏的 MissAV slug。 */
export async function deleteMissavSaved(slugs: string[]): Promise<number> {
    const normalized = Array.from(new Set(slugs.map((s) => extractMissavSlug(s)).filter(Boolean)));
    if (normalized.length === 0) return 0;

    return withExclusiveLock(MISSAV_SAVED_LOCK_NAME, async () => {
        const db = await openLocalDB();
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([MISSAV_DB_SAVED_STORE, MISSAV_DB_META_STORE], 'readwrite');
                const store = tx.objectStore(MISSAV_DB_SAVED_STORE);
                const metaStore = tx.objectStore(MISSAV_DB_META_STORE);

                for (const slug of normalized) {
                    store.delete(slug);
                }
                const countReq = store.count();
                const metaReq = metaStore.get(MISSAV_SAVED_META_KEY);
                let totalCount = 0;
                countReq.onsuccess = () => {
                    totalCount = countReq.result;
                };
                metaReq.onsuccess = () => {
                    const prevMeta = metaReq.result as Partial<MissavSavedMeta> | undefined;
                    metaStore.put({
                        key: MISSAV_SAVED_META_KEY,
                        count: totalCount,
                        lastFullSyncAt: typeof prevMeta?.lastFullSyncAt === 'number' ? prevMeta.lastFullSyncAt : null,
                        updatedAt: Date.now()
                    } satisfies MissavSavedMeta);
                };

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('删除 MissAV 收藏失败'));
                tx.onabort = () => reject(tx.error || new Error('删除 MissAV 收藏事务中止'));
            });
            return normalized.length;
        } finally {
            db.close();
        }
    });
}

/**
 * 全量对账替换本地 MissAV 收藏集合（先写全部新条目，再游标移除不在新集合中的旧条目）。
 */
export async function replaceMissavSaved(
    items: MissavSavedItemInput[]
): Promise<{ written: number; deleted: number }> {
    const dedup = new Map<string, StoredMissavSavedRecord>();
    const now = Date.now();
    for (const item of items) {
        const slug = extractMissavSlug(item.slug);
        if (!slug) continue;
        dedup.set(slug, {
            slug,
            carNum: item.carNum ? normalizeCarNum(item.carNum, 'path') : normalizeCarNum(slug, 'path'),
            savedAt: now
        });
    }

    return withExclusiveLock(MISSAV_SAVED_LOCK_NAME, async () => {
        const db = await openLocalDB();
        try {
            let deleted = 0;
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([MISSAV_DB_SAVED_STORE, MISSAV_DB_META_STORE], 'readwrite');
                const store = tx.objectStore(MISSAV_DB_SAVED_STORE);
                const metaStore = tx.objectStore(MISSAV_DB_META_STORE);

                for (const rec of dedup.values()) {
                    store.put(rec);
                }

                const cursorReq = store.openCursor();
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (!cursor) {
                        metaStore.put({
                            key: MISSAV_SAVED_META_KEY,
                            count: dedup.size,
                            lastFullSyncAt: now,
                            updatedAt: now
                        } satisfies MissavSavedMeta);
                        return;
                    }
                    const key = String(cursor.primaryKey);
                    if (!dedup.has(key)) {
                        cursor.delete();
                        deleted++;
                    }
                    cursor.continue();
                };
                cursorReq.onerror = () => reject(cursorReq.error || new Error('对账 MissAV 收藏游标失败'));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('对账 MissAV 收藏事务失败'));
                tx.onabort = () => reject(tx.error || new Error('对账 MissAV 收藏事务中止'));
            });
            return { written: dedup.size, deleted };
        } finally {
            db.close();
        }
    });
}

/** 批量查询一组 slug 中哪些已被 MissAV 原生收藏。 */
export async function queryMissavSaved(slugs: string[]): Promise<Set<string>> {
    const normalized = Array.from(new Set(slugs.map((s) => extractMissavSlug(s)).filter(Boolean)));
    if (normalized.length === 0) return new Set();

    const db = await openLocalDB();
    try {
        return await new Promise<Set<string>>((resolve) => {
            const tx = db.transaction(MISSAV_DB_SAVED_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_SAVED_STORE);
            const matched = new Set<string>();

            for (const slug of normalized) {
                const req = store.get(slug);
                req.onsuccess = () => {
                    if (req.result) matched.add(slug);
                };
            }

            tx.oncomplete = () => resolve(matched);
            tx.onerror = () => resolve(new Set());
            tx.onabort = () => resolve(new Set());
        });
    } finally {
        db.close();
    }
}

/** 读取 MissAV 原生收藏同步元数据（上次全量同步时间与条数）。 */
export async function readMissavSavedMeta(): Promise<MissavSavedMeta | null> {
    const db = await openLocalDB();
    try {
        return await new Promise<MissavSavedMeta | null>((resolve) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readonly');
            const req = tx.objectStore(MISSAV_DB_META_STORE).get(MISSAV_SAVED_META_KEY);
            req.onsuccess = () => {
                const value = req.result as Partial<MissavSavedMeta> | undefined;
                if (value && value.key === MISSAV_SAVED_META_KEY && typeof value.count === 'number') {
                    resolve({
                        key: MISSAV_SAVED_META_KEY,
                        count: value.count,
                        lastFullSyncAt: typeof value.lastFullSyncAt === 'number' ? value.lastFullSyncAt : null,
                        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0
                    });
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    } finally {
        db.close();
    }
}
