/**
 * IndexedDB 数据层 —— 寄生 JAV-JHS/appData 仓库。
 *
 * 替代原远程服务器 API（POST /api/sync/movies_lists 等），将 movies/inventory/
 * movie_inventory 三张表的数据存储在本地 IndexedDB 的 JAV-JHS/appData 仓库中，
 * 通过 WebDav 备份随 jhs 主数据库一起备份恢复。
 *
 * 数据结构（与 PostgreSQL 表结构一一对应）：
 * - key "vlt_movies": { [designation]: MovieRecord }
 * - key "vlt_inventory": { [listId]: InventoryRecord }
 * - key "vlt_movie_inventory": { [designation::listId]: true }
 * - key "vlt_meta": { version, exportedAt, importedAt }
 *
 * 与服务器端逻辑的等价映射（见 archetype/javdb-lists-server-src/index.ts）：
 * - movie upsert（ON CONFLICT DO UPDATE，created_at 仅首次写入）
 * - list upsert（ON CONFLICT DO NOTHING，已存在不更新）
 * - association add（count < 501 检查 + 复合主键防重复）
 * - association remove（DELETE）
 * - count 维护（服务器用触发器，此处手动 ±1）
 * - count CHECK 约束（服务器用 CHECK count<=501，此处代码检查）
 */

/** 影片记录（对应 PostgreSQL movies 表）。 */
export interface MovieRecord {
    designation: string;
    href: string;
    title: string | null;
    coverSrc: string | null;
    score: number | null;
    releaseDate: string | null;
    createdAt: string | null;
    series: string | null;
    code: string | null;
}

/** 清单记录（对应 PostgreSQL inventory 表）。 */
export interface InventoryRecord {
    listId: string;
    name: string;
    url: string | null;
    count: number;
    style: { name: string; bg: string; text: string } | null;
}

/** 同步结果（对应服务器 /api/sync/movies_lists 响应）。 */
export interface SyncResult {
    movie: 'created' | 'existed';
    list: 'created' | 'existed';
    association: 'created' | 'existed' | 'deleted' | 'unchanged' | 'limit_exceeded';
}

/** 导入数据结构（迁移工具输出的 JSON 格式）。 */
export interface MigrationData {
    _version: number;
    _exportedAt: string;
    _source: string;
    movies: Record<string, MovieRecord>;
    inventory: Record<string, InventoryRecord>;
    movieInventory: Record<string, boolean>;
}

/** JHS IndexedDB 库名/仓库名（与 storageManager 同库，寄生备份）。 */
const DB_NAME = 'JAV-JHS';
const STORE_NAME = 'appData';

/** 清单条目上限（与 PostgreSQL CHECK 约束一致）。 */
const MAX_COUNT = 501;

/** Bootstrap 标准配色池（与服务器 randomBootstrapStyle 一致）。 */
const BOOTSTRAP_COLORS = [
    { name: 'primary', bg: '#0d6efd', text: '#fff' },
    { name: 'secondary', bg: '#6c757d', text: '#fff' },
    { name: 'success', bg: '#198754', text: '#fff' },
    { name: 'danger', bg: '#dc3545', text: '#fff' },
    { name: 'warning', bg: '#ffc107', text: '#212529' },
    { name: 'info', bg: '#0dcaf0', text: '#212529' },
    { name: 'dark', bg: '#212529', text: '#fff' }
];

/** 随机选取 Bootstrap 配色（对应服务器 randomBootstrapStyle）。 */
function randomBootstrapStyle(): { name: string; bg: string; text: string } {
    return BOOTSTRAP_COLORS[Math.floor(Math.random() * BOOTSTRAP_COLORS.length)];
}

/** 数据键名。 */
const KEYS = {
    MOVIES: 'vlt_movies',
    INVENTORY: 'vlt_inventory',
    MOVIE_INVENTORY: 'vlt_movie_inventory',
    META: 'vlt_meta'
} as const;

/**
 * 打开 JHS IndexedDB。
 * 与 doc/25 rating-cache.ts 的 openIdb 模式一致：寄生 JAV-JHS/appData。
 */
function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * 读取一个键的值（Promise 包装）。
 * @param db IDBDatabase 实例
 * @param key 键名
 * @returns 键值（可能为 undefined）
 */
function dbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

/**
 * 写入一个键值（Promise 包装）。
 * @param db IDBDatabase 实例
 * @param key 键名
 * @param value 键值
 */
function dbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * VLT 数据库操作类。
 *
 * 所有方法对应原远程服务器 API 端点，用本地 IndexedDB 操作等价替换。
 * count 维护（原 PostgreSQL 触发器）在 addAssociation/removeAssociation 中手动执行。
 */
export class VltDb {
    /**
     * 聚合同步：影片 upsert + 清单 upsert + 关联 add/remove。
     * 对应服务器 POST /api/sync/movies_lists 的 CTE 语句。
     *
     * @param designation 影片番号
     * @param listId 清单 ID
     * @param movie 影片信息
     * @param list 清单信息
     * @param action "add" | "remove"
     * @returns SyncResult { movie, list, association }
     */
    static async sync(
        designation: string,
        listId: string,
        movie: {
            href: string;
            title?: string;
            cover_src?: string;
            score?: number;
            release_date?: string;
            series?: string;
            code?: string;
        },
        list: {
            url?: string;
            name: string;
        },
        action: 'add' | 'remove'
    ): Promise<SyncResult> {
        const db = await openDb();
        try {
            // 1. 读取当前数据
            const movies = (await dbGet<Record<string, MovieRecord>>(db, KEYS.MOVIES)) || {};
            const inventory =
                (await dbGet<Record<string, InventoryRecord>>(db, KEYS.INVENTORY)) || {};
            const mi = (await dbGet<Record<string, boolean>>(db, KEYS.MOVIE_INVENTORY)) || {};

            // 2. movie upsert（ON CONFLICT DO UPDATE，created_at 仅首次写入）
            const movieExisted = !!movies[designation];
            const score = movie.score != null ? Number(movie.score) : null;
            if (movieExisted) {
                // 更新（不覆盖 createdAt）
                movies[designation] = {
                    ...movies[designation],
                    href: movie.href,
                    title: movie.title ?? null,
                    coverSrc: movie.cover_src ?? null,
                    score,
                    releaseDate: movie.release_date ?? null,
                    series: movie.series ?? null,
                    code: movie.code ?? null
                };
            } else {
                // 新建
                movies[designation] = {
                    designation,
                    href: movie.href,
                    title: movie.title ?? null,
                    coverSrc: movie.cover_src ?? null,
                    score,
                    releaseDate: movie.release_date ?? null,
                    createdAt: new Date().toISOString(),
                    series: movie.series ?? null,
                    code: movie.code ?? null
                };
            }
            const movieStatus: 'created' | 'existed' = movieExisted ? 'existed' : 'created';

            // 3. list upsert（ON CONFLICT DO NOTHING，已存在不更新）
            const listExisted = !!inventory[listId];
            if (!listExisted) {
                inventory[listId] = {
                    listId,
                    name: list.name,
                    url: list.url ?? null,
                    count: 0,
                    style: randomBootstrapStyle()
                };
            }
            const listStatus: 'created' | 'existed' = listExisted ? 'existed' : 'created';

            // 4. association add/remove
            const assocKey = `${designation}::${listId}`;
            let associationStatus: SyncResult['association'];

            if (action === 'add') {
                if (mi[assocKey]) {
                    // 关联已存在
                    associationStatus = 'existed';
                } else {
                    // 检查 count < 501
                    const currentCount = inventory[listId]?.count ?? 0;
                    if (currentCount >= MAX_COUNT) {
                        associationStatus = 'limit_exceeded';
                    } else {
                        // 插入关联 + count +1（触发器等价）
                        mi[assocKey] = true;
                        inventory[listId].count = currentCount + 1;
                        associationStatus = 'created';
                    }
                }
            } else {
                // action === 'remove'
                if (mi[assocKey]) {
                    // 删除关联 + count -1（触发器等价）
                    delete mi[assocKey];
                    if (inventory[listId]) {
                        inventory[listId].count = Math.max(0, inventory[listId].count - 1);
                    }
                    associationStatus = 'deleted';
                } else {
                    associationStatus = 'unchanged';
                }
            }

            // 5. 写回（仅当有变更时）
            // 注意：即使 association 是 existed/unchanged/limit_exceeded，
            // movie/list 的 upsert 仍需写回（与服务器 CTE 一致——CTE 总是执行 upsert）
            await dbPut(db, KEYS.MOVIES, movies);
            await dbPut(db, KEYS.INVENTORY, inventory);
            await dbPut(db, KEYS.MOVIE_INVENTORY, mi);

            return { movie: movieStatus, list: listStatus, association: associationStatus };
        } finally {
            db.close();
        }
    }

    /**
     * 批量查询番号所属的清单列表。
     * 对应服务器 POST /api/movies_lists。
     *
     * @param designations 番号数组
     * @returns { [designation]: [{ name, url, style }] }
     */
    static async queryMoviesLists(
        designations: string[]
    ): Promise<
        Record<
            string,
            {
                name: string;
                url: string | null;
                style: { name: string; bg: string; text: string } | null;
            }[]
        >
    > {
        const db = await openDb();
        try {
            const inventory =
                (await dbGet<Record<string, InventoryRecord>>(db, KEYS.INVENTORY)) || {};
            const mi = (await dbGet<Record<string, boolean>>(db, KEYS.MOVIE_INVENTORY)) || {};

            // 反查：遍历 movie_inventory，找到每个 designation 关联的 listId
            const result: Record<
                string,
                {
                    name: string;
                    url: string | null;
                    style: { name: string; bg: string; text: string } | null;
                }[]
            > = {};

            // 初始化所有 designation 为空数组
            for (const des of designations) {
                result[des] = [];
            }

            // 遍历 movie_inventory 的键（格式 "designation::listId"）
            for (const key of Object.keys(mi)) {
                const sepIdx = key.indexOf('::');
                if (sepIdx < 0) continue;
                const des = key.substring(0, sepIdx);
                const lid = key.substring(sepIdx + 2);
                if (result[des] !== undefined) {
                    const inv = inventory[lid];
                    if (inv) {
                        result[des].push({
                            name: inv.name,
                            url: inv.url,
                            style: inv.style
                        });
                    }
                }
            }

            return result;
        } finally {
            db.close();
        }
    }

    /**
     * 检查影片/清单/关联是否存在。
     * 对应服务器 POST /api/check/movies_lists。
     */
    static async check(
        designation: string,
        listId: string
    ): Promise<{ movie: boolean; inventory: boolean; movieInventory: boolean }> {
        const db = await openDb();
        try {
            const movies = (await dbGet<Record<string, MovieRecord>>(db, KEYS.MOVIES)) || {};
            const inventory =
                (await dbGet<Record<string, InventoryRecord>>(db, KEYS.INVENTORY)) || {};
            const mi = (await dbGet<Record<string, boolean>>(db, KEYS.MOVIE_INVENTORY)) || {};
            return {
                movie: !!movies[designation],
                inventory: !!inventory[listId],
                movieInventory: !!mi[`${designation}::${listId}`]
            };
        } finally {
            db.close();
        }
    }

    /**
     * 导入迁移数据（从 PostgreSQL 导出的 JSON）。
     * @param data 迁移数据
     * @returns 导入统计
     */
    static async importData(
        data: MigrationData
    ): Promise<{ movies: number; inventory: number; movieInventory: number }> {
        const db = await openDb();
        try {
            await dbPut(db, KEYS.MOVIES, data.movies);
            await dbPut(db, KEYS.INVENTORY, data.inventory);
            await dbPut(db, KEYS.MOVIE_INVENTORY, data.movieInventory);
            await dbPut(db, KEYS.META, {
                version: data._version,
                exportedAt: data._exportedAt,
                importedAt: new Date().toISOString(),
                source: data._source
            });
            return {
                movies: Object.keys(data.movies).length,
                inventory: Object.keys(data.inventory).length,
                movieInventory: Object.keys(data.movieInventory).length
            };
        } finally {
            db.close();
        }
    }

    /**
     * 检查是否已导入数据（meta 键是否存在）。
     */
    static async isImported(): Promise<boolean> {
        const db = await openDb();
        try {
            const meta = await dbGet<{ importedAt: string }>(db, KEYS.META);
            return !!meta?.importedAt;
        } finally {
            db.close();
        }
    }

    /**
     * 获取全部清单（用于标签显示时反查清单信息）。
     */
    static async getAllInventory(): Promise<Record<string, InventoryRecord>> {
        const db = await openDb();
        try {
            return (await dbGet<Record<string, InventoryRecord>>(db, KEYS.INVENTORY)) || {};
        } finally {
            db.close();
        }
    }

    /**
     * 导出全量数据为 MigrationData 格式（与导入格式一致，可逆向导入）。
     */
    static async exportData(): Promise<MigrationData> {
        const db = await openDb();
        try {
            const movies = (await dbGet<Record<string, MovieRecord>>(db, KEYS.MOVIES)) || {};
            const inventory =
                (await dbGet<Record<string, InventoryRecord>>(db, KEYS.INVENTORY)) || {};
            const mi = (await dbGet<Record<string, boolean>>(db, KEYS.MOVIE_INVENTORY)) || {};
            const meta = await dbGet<{ version: number; exportedAt: string; source: string }>(
                db,
                KEYS.META
            );
            return {
                _version: meta?.version ?? 1,
                _exportedAt: meta?.exportedAt ?? new Date().toISOString(),
                _source: 'IndexedDB (local export)',
                movies,
                inventory,
                movieInventory: mi
            };
        } finally {
            db.close();
        }
    }
}
