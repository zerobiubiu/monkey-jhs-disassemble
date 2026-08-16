/**
 * 评分缓存与已看列表 —— 对应 archetype/jhsRatingDisplay.user.js L136-302
 * （`JhsDB` + `RatingCache`）。
 *
 * 评分缓存采用 localStorage 主存 + jhs IndexedDB 寄生备份的双写策略
 * （永久不过期）：localStorage 为空时从 IDB 恢复，写入时同步双写。
 *
 * 已看列表（buildWatchedMap）原脚本通过 JhsDB 直接打开 `JAV-JHS/appData`
 * 读取 `car_list`；本工程 storageManager 的 localforage 实例正指向同一
 * IDB 库/仓库/键，故复用 storageManager.getCarList() 避免重复开连接。
 * 控制流（过滤 status === 'hasWatch'，构建 Map）与原脚本一致。
 *
 * 寄生 IDB 读写（`jhsRatingDisplay_data` 键）保留原生 indexedDB API：
 * storageManager.forage 为 private 无法访问，且原脚本即用原生 API。
 */
import { HAS_WATCH_ACTION } from '../../constants/status';
import { RATING_CONFIG } from './rating-config';
import { RatingUtils } from './rating-utils';

/** jhs car_list 中的已看记录（字段宽松，至少含 carNum/status）。 */
interface WatchedCarItem {
    carNum?: string;
    status?: string;
    [key: string]: unknown;
}

/** 单条评分缓存条目。 */
export interface RatingEntry {
    rating: number;
    updatedAt: number;
}

/** 评分缓存数据形状：番号 → 条目。 */
type RatingData = Record<string, RatingEntry>;

/* =========================================================================
 * JhsDB：jhs IndexedDB 原生访问（仅用于评分缓存寄生读写）
 * ========================================================================= */

/** 打开 jhs IndexedDB（JAV-JHS），返回 IDBDatabase。对应原 L137-143。 */
function openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(RATING_CONFIG.IDB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * 构建已看番号集合（status === 'hasWatch'）。对应原 L168-178。
 * 数据源复用 storageManager.getCarList()（同库同键，避免重复开 IDB 连接）。
 * @returns Map<规范化番号, 原始记录>
 */
async function buildWatchedMap(): Promise<Map<string, WatchedCarItem>> {
    const list: WatchedCarItem[] = await storageManager.getCarList();
    const map = new Map<string, WatchedCarItem>();
    list.forEach((item) => {
        if (item && item.status === HAS_WATCH_ACTION && item.carNum) {
            map.set(RatingUtils.normalizeCode(item.carNum), item);
        }
    });
    RatingUtils.log('WATCHED_MAP', `${map.size} 项`);
    return map;
}

/* =========================================================================
 * RatingCache：评分缓存（localStorage 主存 + IDB 寄生备份）
 * ========================================================================= */

/** 评分缓存模块（保持原对象字面量风格的有状态单例）。 */
export const RatingCache = {
    /** 内存缓存（localStorage / IDB 加载后的镜像） */
    _data: {} as RatingData,

    /**
     * 加载缓存：合并旧 localStorage 与已有 IndexedDB 寄生副本。
     * 校验写入 IndexedDB 成功后删除旧 localStorage 副本。
     */
    async load(): Promise<void> {
        let legacyData: RatingData | null = null;
        try {
            const raw = localStorage.getItem(RATING_CONFIG.RATING_CACHE_KEY);
            if (raw) {
                const parsed: unknown = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    legacyData = parsed as RatingData;
                }
            }
        } catch {
            /* 损坏的旧缓存交由 IDB 副本恢复 */
        }

        let idbData: RatingData | null = null;
        try {
            const db = await openIdb();
            idbData = await new Promise<RatingData | null>((resolve) => {
                try {
                    const tx = db.transaction(RATING_CONFIG.IDB_STORE, 'readonly');
                    const req = tx.objectStore(RATING_CONFIG.IDB_STORE).get(RATING_CONFIG.IDB_RATING_KEY);
                    req.onsuccess = () => resolve((req.result as RatingData) ?? null);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
        } catch (error) {
            RatingUtils.log('CACHE_IDB_LOAD_ERROR', error);
        }

        if (legacyData || idbData) {
            const merged: RatingData = { ...(idbData ?? {}) };
            for (const [code, legacyEntry] of Object.entries(legacyData ?? {})) {
                const idbEntry = merged[code];
                if (!idbEntry || legacyEntry.updatedAt >= idbEntry.updatedAt) {
                    merged[code] = legacyEntry;
                }
            }
            this._data = merged;
            if (idbData || legacyData) {
                const synced = await this._syncToIdb();
                if (synced) localStorage.removeItem(RATING_CONFIG.RATING_CACHE_KEY);
            }
            RatingUtils.log('CACHE', `IndexedDB: ${Object.keys(merged).length} 条`);
            return;
        }

        this._data = {};
    },

    /** 写入 IndexedDB；失败时保留旧 localStorage 兼容副本。 */
    save(): void {
        void this._syncToIdb();
    },

    /** 异步同步到 jhs IndexedDB。返回值表示是否提交成功。 */
    async _syncToIdb(): Promise<boolean> {
        try {
            const db = await openIdb();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(RATING_CONFIG.IDB_STORE, 'readwrite');
                tx.objectStore(RATING_CONFIG.IDB_STORE).put(this._data, RATING_CONFIG.IDB_RATING_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
            localStorage.removeItem(RATING_CONFIG.RATING_CACHE_KEY);
            return true;
        } catch (error) {
            RatingUtils.log('IDB_SYNC_ERROR', error);
            return false;
        }
    },

    /**
     * 读取番号对应的评分条目。对应原 L270-272。
     * @returns 命中条目或 null
     */
    get(code: string): RatingEntry | null {
        return this._data[code] || null;
    },

    /**
     * 写入评分条目（rating 无变化时跳过）。对应原 L275-281。
     * @returns true 表示写入成功，false 表示评分未变化已跳过
     */
    set(code: string, rating: number): boolean {
        const existed = this._data[code];
        if (existed && existed.rating === rating) return false;
        this._data[code] = { rating, updatedAt: Date.now() };
        this.save();
        return true;
    },

    /** 清空缓存：localStorage 删除 + IDB 异步删除。对应原 L283-297。 */
    clear(): void {
        this._data = {};
        localStorage.removeItem(RATING_CONFIG.RATING_CACHE_KEY);
        // 异步清除 IndexedDB
        openIdb()
            .then((db) => {
                try {
                    const tx = db.transaction(RATING_CONFIG.IDB_STORE, 'readwrite');
                    tx.objectStore(RATING_CONFIG.IDB_STORE).delete(
                        RATING_CONFIG.IDB_RATING_KEY
                    );
                } catch {
                    /* ignore */
                }
            })
            .catch(() => {
                /* ignore */
            });
    },

    /** 返回缓存条目数。对应原 L299-301。 */
    size(): number {
        return Object.keys(this._data).length;
    }
};

/** 已看列表构建函数导出（供 rating-display-plugin 的 Core 使用）。 */
export { buildWatchedMap };
