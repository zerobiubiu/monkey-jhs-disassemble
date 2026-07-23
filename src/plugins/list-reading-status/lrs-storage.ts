/**
 * 清单阅读进度插件 —— 数据持久化层。
 *
 * 包含 GM_setValue/getValue 读写（阅读状态/评分/最近访问）与
 * jhs IndexedDB 寄生备份（写入 + 逐字段合并恢复）。
 * 模块级纯函数，不依赖插件实例状态。
 */

/** 日志前缀。 */
export const LOG_PREFIX = '[listReadingStatus]';

/** 阅读状态持久化键（GM_setValue/getValue）。 */
export const STORAGE_KEY = 'jdb:list-reading-status';
/** 评分持久化键。 */
export const RATING_STORAGE_KEY = 'jdb:list-rating';
/** 最近访问记录持久化键。 */
export const LAST_URI_KEY = 'jdb:list-last-uri';
/** 排序状态持久化键。 */
export const SORT_KEY = 'jdb:list-sort';
/** 阅读状态筛选持久化键。 */
export const FILTER_READ_KEY = 'jdb:list-filter-read';
/** 评分筛选持久化键。 */
export const FILTER_RATING_KEY = 'jdb:list-filter-rating';

/** jhs IndexedDB 库名（寄生备份）。 */
const JHS_DB_NAME = 'JAV-JHS';
/** jhs IndexedDB 仓库名。 */
const JHS_STORE_NAME = 'appData';
/** 本插件寄生备份键名。 */
const BACKUP_KEY = 'listReadingStatus_data';

// ---------- 数据层 ----------

/** 获取评分映射表。对应原 L34-42。 */
export function getRatingMap(): Record<string, number> {
    const raw = GM_getValue(RATING_STORAGE_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 持久化评分映射表（同步到 IndexedDB）。对应原 L48-51。 */
export function saveRatingMap(map: Record<string, number>): void {
    GM_setValue(RATING_STORAGE_KEY, JSON.stringify(map));
    syncToIndexedDB();
}

/** 设置清单评分。对应原 L58-67。 */
export function setRating(listId: string, rating: number): void {
    const map = getRatingMap();
    if (rating > 0) {
        map[listId] = rating;
    } else {
        delete map[listId];
    }
    saveRatingMap(map);
    console.log(`${LOG_PREFIX} 评分 ${listId}: ${rating || '清除'}`);
}

/** 获取清单评分。对应原 L74-76。 */
export function getRating(listId: string): number {
    return getRatingMap()[listId] || 0;
}

/** 获取最近访问记录映射表。对应原 L86-94。 */
export function getLastUriMap(): Record<string, { path: string; timestamp: number }> {
    const raw = GM_getValue(LAST_URI_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 保存当前页面 URI 作为清单的最后访问记录。对应原 L100-108。 */
export function saveLastUri(listId: string): void {
    const map = getLastUriMap();
    map[listId] = {
        path: location.pathname + location.search,
        timestamp: Date.now()
    };
    GM_setValue(LAST_URI_KEY, JSON.stringify(map));
    syncToIndexedDB();
}

/** 获取清单的最后访问 URI。对应原 L115-117。 */
export function getLastUri(listId: string): { path: string; timestamp: number } | null {
    return getLastUriMap()[listId] || null;
}

/** 获取已标记为"已读完"的清单 ID 集合。对应原 L453-462。 */
export function getReadSet(): Set<string> {
    const raw = GM_getValue(STORAGE_KEY);
    if (!raw) return new Set();
    try {
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

/** 持久化已读完的清单 ID 集合。对应原 L468-471。 */
export function saveReadSet(readSet: Set<string>): void {
    GM_setValue(STORAGE_KEY, JSON.stringify([...readSet]));
    syncToIndexedDB();
}

/** 将某个清单标记为已读完。对应原 L477-482。 */
export function markAsRead(listId: string): void {
    const readSet = getReadSet();
    readSet.add(listId);
    saveReadSet(readSet);
    console.log(`${LOG_PREFIX} 已标记已读完: ${listId}`);
}

/** 将某个清单取消已读完标记。对应原 L488-493。 */
export function markAsUnread(listId: string): void {
    const readSet = getReadSet();
    readSet.delete(listId);
    saveReadSet(readSet);
    console.log(`${LOG_PREFIX} 已取消标记: ${listId}`);
}

/** 判断某个清单是否已读完。对应原 L500-502。 */
export function isRead(listId: string): boolean {
    return getReadSet().has(listId);
}

// ---------- IndexedDB 备份 ----------

/** 打开 jhs 的 IndexedDB。对应原 L129-141。 */
function openJhsDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(JHS_DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(JHS_STORE_NAME)) {
                db.createObjectStore(JHS_STORE_NAME);
            }
        };
    });
}

/** 将当前阅读状态和评分写入 IndexedDB（寄生到 jhs 备份通道）。对应原 L146-166。 */
export function syncToIndexedDB(): void {
    try {
        const data = {
            readingStatus: [...getReadSet()],
            ratings: getRatingMap(),
            lastUris: getLastUriMap(),
            _updatedAt: new Date().toISOString()
        };
        openJhsDB()
            .then((db) => {
                const tx = db.transaction(JHS_STORE_NAME, 'readwrite');
                const store = tx.objectStore(JHS_STORE_NAME);
                store.put(data, BACKUP_KEY);
                tx.oncomplete = () => db.close();
                tx.onerror = () => db.close();
            })
            .catch(() => {});
    } catch {
        // 静默失败，IndexedDB 不可用不影响核心功能
    }
}

/** IndexedDB 备份数据结构。 */
interface BackupData {
    readingStatus?: string[];
    ratings?: Record<string, number>;
    lastUris?: Record<string, { path: string; timestamp: number }>;
    _updatedAt?: string;
}

/** 从 IndexedDB 合并恢复数据（逐字段合并策略）。对应原 L183-259。 */
export async function restoreFromIndexedDB(): Promise<boolean> {
    try {
        const db = await openJhsDB();
        const tx = db.transaction(JHS_STORE_NAME, 'readonly');
        const store = tx.objectStore(JHS_STORE_NAME);
        const data = await new Promise<BackupData | undefined>((resolve, reject) => {
            const req = store.get(BACKUP_KEY);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
        });
        db.close();

        if (!data || !data.readingStatus) return false;

        let restored = false;

        // 1. readingStatus：取并集（已读完状态合并）
        const localReadSet = getReadSet();
        const cloudRead = Array.isArray(data.readingStatus) ? data.readingStatus : [];
        const mergedRead = new Set([...localReadSet, ...cloudRead]);
        if (mergedRead.size > localReadSet.size) {
            GM_setValue(STORAGE_KEY, JSON.stringify([...mergedRead]));
            restored = true;
        }

        // 2. ratings：云端补缺（本地优先，避免覆盖本地新评分）
        const localRatings = getRatingMap();
        const cloudRatings =
            data.ratings && typeof data.ratings === 'object' ? data.ratings : {};
        let ratingChanged = false;
        for (const [id, rating] of Object.entries(cloudRatings)) {
            if (!(id in localRatings)) {
                localRatings[id] = rating as number;
                ratingChanged = true;
            }
        }
        if (ratingChanged) {
            GM_setValue(RATING_STORAGE_KEY, JSON.stringify(localRatings));
            restored = true;
        }

        // 3. lastUris：按 timestamp 取更大者（保留更晚的访问记录）
        const localLastUris = getLastUriMap();
        const cloudLastUris =
            data.lastUris && typeof data.lastUris === 'object' ? data.lastUris : {};
        let lastUriChanged = false;
        for (const [id, uri] of Object.entries(cloudLastUris)) {
            const local = localLastUris[id];
            const cloudUri = uri as { path: string; timestamp: number };
            if (
                !local ||
                (cloudUri.timestamp && cloudUri.timestamp > (local.timestamp || 0))
            ) {
                localLastUris[id] = cloudUri;
                lastUriChanged = true;
            }
        }
        if (lastUriChanged) {
            GM_setValue(LAST_URI_KEY, JSON.stringify(localLastUris));
            restored = true;
        }

        if (restored) {
            console.log(
                `${LOG_PREFIX} 已从云端合并恢复数据 (更新于 ${data._updatedAt || '未知'})`
            );
        }
        return restored;
    } catch {
        return false;
    }
}
