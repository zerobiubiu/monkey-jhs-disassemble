/**
 * MissAV 端 JavDB 归属清单本地 IndexedDB 存储层。
 *
 * 寄生在同域 `MissAV-CarStatus` 数据库的 `vlt_cars` 与 `sync_meta` 仓库中：
 * - `sync_meta[vlt_inventory]`：清单元数据数组（`MissavVltListMeta[]`）
 * - `sync_meta[vlt_lists_revision]`：已应用单调修订号（防旧快照回退）
 * - `vlt_cars[carNum]`：`{ carNum, listIds }`（按 `normalizeCarNum(..., 'path')` 索引，
 *   列表页/iframe 查询仅读本页涉及的 12~60 个主键，零常驻全表内存）
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import { withExclusiveLock } from '../../core/sync';

import {
    MISSAV_DB_META_STORE,
    MISSAV_DB_VLT_CARS_STORE,
    MISSAV_VLT_INVENTORY_META_KEY,
    MISSAV_VLT_REV_META_KEY,
    MISSAV_VLT_SYNC_LOCK_NAME
} from './car-status-config';
import { openLocalDB } from './car-status-db';
import type { MissavVltListMeta, MissavVltSnapshot } from './vlt-sync-protocol';

interface StoredVltCarRecord {
    carNum: string;
    listIds: string[];
}

interface StoredVltInventoryMeta {
    key: string;
    lists: MissavVltListMeta[];
}

interface StoredVltRevisionMeta {
    key: string;
    revision: number;
}

/** 读取本地已应用的 JavDB 清单修订号；未同步过返回 -1。 */
export async function readMissavVltRevision(): Promise<number> {
    const db = await openLocalDB();
    try {
        return await new Promise<number>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readonly');
            const req = tx.objectStore(MISSAV_DB_META_STORE).get(MISSAV_VLT_REV_META_KEY);
            req.onsuccess = () => {
                const value = req.result as Partial<StoredVltRevisionMeta> | undefined;
                if (typeof value?.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0) {
                    resolve(value.revision);
                } else {
                    resolve(-1);
                }
            };
            req.onerror = () => reject(req.error || new Error('读取清单修订号失败'));
        });
    } finally {
        db.close();
    }
}

/** 清除本地 JavDB 清单修订号水位线（强制重新同步用）。 */
export async function clearMissavVltRevision(): Promise<void> {
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readwrite');
            tx.objectStore(MISSAV_DB_META_STORE).delete(MISSAV_VLT_REV_META_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('清理清单修订号失败'));
            tx.onabort = () => reject(tx.error || new Error('清理清单修订号事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 在跨标签页锁内按修订号门控替换本地 JavDB 归属清单数据：
 * 先分批 upsert 所有新关联记录，再删除快照之外的旧番号，最后更新清单元数据与修订号。
 */
export async function replaceMissavVltData(
    snapshot: MissavVltSnapshot,
    revision: number
): Promise<{ applied: boolean; listCount: number; movieCount: number }> {
    return withExclusiveLock(MISSAV_VLT_SYNC_LOCK_NAME, async () => {
        const currentRev = await readMissavVltRevision();
        if (revision <= currentRev) {
            return { applied: false, listCount: snapshot.lists.length, movieCount: 0 };
        }

        const entries: StoredVltCarRecord[] = [];
        const incomingKeys = new Set<string>();
        for (const [carNum, indices] of Object.entries(snapshot.byCarNum)) {
            const normalized = normalizeCarNum(carNum, 'path');
            if (!normalized) continue;
            const listIds: string[] = [];
            for (const idx of indices) {
                const list = snapshot.lists[idx];
                if (list) listIds.push(list.id);
            }
            if (listIds.length === 0) continue;
            incomingKeys.add(normalized);
            entries.push({ carNum: normalized, listIds });
        }

        const BATCH_SIZE = 3000;
        const db = await openLocalDB();
        try {
            // 1) 分批写入新关联记录
            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE);
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(MISSAV_DB_VLT_CARS_STORE, 'readwrite');
                    const store = tx.objectStore(MISSAV_DB_VLT_CARS_STORE);
                    for (const rec of batch) {
                        store.put(rec);
                    }
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error || new Error('写入归属清单批次失败'));
                    tx.onabort = () => reject(tx.error || new Error('写入归属清单批次中止'));
                });
            }

            // 2) 删除快照外旧番号 + 同步更新清单元数据与修订号（同事务提交）
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([MISSAV_DB_VLT_CARS_STORE, MISSAV_DB_META_STORE], 'readwrite');
                const carStore = tx.objectStore(MISSAV_DB_VLT_CARS_STORE);
                const metaStore = tx.objectStore(MISSAV_DB_META_STORE);

                const cursorReq = carStore.openCursor();
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (!cursor) {
                        const invMeta: StoredVltInventoryMeta = {
                            key: MISSAV_VLT_INVENTORY_META_KEY,
                            lists: snapshot.lists
                        };
                        const revMeta: StoredVltRevisionMeta = {
                            key: MISSAV_VLT_REV_META_KEY,
                            revision
                        };
                        metaStore.put(invMeta);
                        metaStore.put(revMeta);
                        return;
                    }
                    const key = String(cursor.primaryKey);
                    if (!incomingKeys.has(key)) {
                        cursor.delete();
                    }
                    cursor.continue();
                };
                cursorReq.onerror = () => reject(cursorReq.error || new Error('清理过期归属清单游标失败'));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('提交归属清单对账事务失败'));
                tx.onabort = () => reject(tx.error || new Error('提交归属清单对账事务中止'));
            });
        } finally {
            db.close();
        }

        return { applied: true, listCount: snapshot.lists.length, movieCount: entries.length };
    });
}

/**
 * 批量查询一组番号在本地同步缓存中的 JavDB 归属清单。
 *
 * @param carNums 原始或已归一化番号数组
 * @returns 归一化番号（`normalizeCarNum(..., 'path')`）→ 清单元数据数组
 */
export async function queryMissavVltLists(
    carNums: string[]
): Promise<Map<string, MissavVltListMeta[]>> {
    const normalized = Array.from(
        new Set(carNums.map((cn) => normalizeCarNum(cn, 'path')).filter(Boolean))
    );
    if (normalized.length === 0) return new Map();

    const db = await openLocalDB();
    try {
        return await new Promise<Map<string, MissavVltListMeta[]>>((resolve) => {
            const tx = db.transaction([MISSAV_DB_META_STORE, MISSAV_DB_VLT_CARS_STORE], 'readonly');
            const metaStore = tx.objectStore(MISSAV_DB_META_STORE);
            const carStore = tx.objectStore(MISSAV_DB_VLT_CARS_STORE);

            let listsById = new Map<string, MissavVltListMeta>();
            const rawMatches = new Map<string, string[]>();

            const invReq = metaStore.get(MISSAV_VLT_INVENTORY_META_KEY);
            invReq.onsuccess = () => {
                const value = invReq.result as Partial<StoredVltInventoryMeta> | undefined;
                if (Array.isArray(value?.lists)) {
                    listsById = new Map(value.lists.map((item) => [item.id, item]));
                }
            };

            for (const carNum of normalized) {
                const req = carStore.get(carNum);
                req.onsuccess = () => {
                    const rec = req.result as Partial<StoredVltCarRecord> | undefined;
                    if (rec && Array.isArray(rec.listIds) && rec.listIds.length > 0) {
                        rawMatches.set(carNum, rec.listIds);
                    }
                };
            }

            tx.oncomplete = () => {
                const result = new Map<string, MissavVltListMeta[]>();
                for (const [carNum, listIds] of rawMatches) {
                    const resolved: MissavVltListMeta[] = [];
                    for (const id of listIds) {
                        const meta = listsById.get(id);
                        if (meta) resolved.push(meta);
                    }
                    if (resolved.length > 0) result.set(carNum, resolved);
                }
                resolve(result);
            };
            tx.onerror = () => resolve(new Map());
            tx.onabort = () => resolve(new Map());
        });
    } finally {
        db.close();
    }
}
