/**
 * IndexedDB 数据层核心 —— 连接 + 事务 + 基础 CRUD。
 *
 * 提取自 vlt-db.ts：
 * - openDb / withState：连接与单事务读写
 * - sync / queryMoviesLists / check / getAllInventory / deleteList / renameList：基础 CRUD
 *
 * movies / inventory / movie_inventory / meta 四个逻辑对象存放在同一个 object store
 * 的四个 key 中。所有会改变关联关系的操作均在同一个 readwrite transaction 内完成，
 * 避免多标签页同时勾选时出现"后写覆盖先写"的丢失更新。
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

/** 同步结果（对应原服务器 /api/sync/movies_lists 响应）。 */
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

/** 服务端完整清单快照。仅在抓取和校验全部分页后用于对账。 */
export interface ListReconcileSnapshot {
    listId: string;
    name: string;
    url: string;
    expectedCount: number;
    movies: MovieRecord[];
}

/** 开始抓取清单前保存的本地版本守卫。 */
export interface ListReconcileGuard {
    epoch: number;
    revision: number;
    fingerprint: string;
}

/** 当前清单的本地状态，用于判断是否需要抓取服务端清单。 */
export interface ListReconcileState {
    inventory: InventoryRecord | null;
    actualCount: number;
    hasDesignation: boolean | null;
    guard: ListReconcileGuard;
}

/** 完整清单对账结果。 */
export type ListReconcileResult =
    | { status: 'applied'; added: number; removed: number; count: number }
    | { status: 'conflict' };

export interface VltMeta {
    version?: number;
    exportedAt?: string;
    importedAt?: string;
    source?: string;
    epoch: number;
    listRevisions: Record<string, number>;
}

export interface VltState {
    movies: Record<string, MovieRecord>;
    inventory: Record<string, InventoryRecord>;
    movieInventory: Record<string, boolean>;
    meta: VltMeta;
}

export interface SyncOptions {
    /** JavDB 已明确返回 success=true；本地不得反过来拒绝已发生的服务端写入。 */
    serverConfirmed?: boolean;
}

/** JHS IndexedDB 库名/仓库名（与 storageManager 同库，寄生备份）。 */
const DB_NAME = 'JAV-JHS';
const STORE_NAME = 'appData';

/** 清单条目上限（与 JavDB 当前上限一致）。 */
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

/** 数据键名。 */
const KEYS = {
    MOVIES: 'vlt_movies',
    INVENTORY: 'vlt_inventory',
    MOVIE_INVENTORY: 'vlt_movie_inventory',
    META: 'vlt_meta'
} as const;

export function randomBootstrapStyle(): { name: string; bg: string; text: string } {
    return BOOTSTRAP_COLORS[Math.floor(Math.random() * BOOTSTRAP_COLORS.length)];
}

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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已中止'));
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 事务失败'));
    });
}

function normalizeMeta(value: Partial<VltMeta> | undefined): VltMeta {
    return {
        ...value,
        epoch: Number.isFinite(Number(value?.epoch)) ? Number(value?.epoch) : 0,
        listRevisions: value?.listRevisions ? { ...value.listRevisions } : {}
    };
}

export function associationDesignations(
    movieInventory: Record<string, boolean>,
    listId: string
): string[] {
    const suffix = `::${listId}`;
    return Object.keys(movieInventory)
        .filter((key) => movieInventory[key] && key.endsWith(suffix))
        .map((key) => key.slice(0, -suffix.length));
}

export function listFingerprint(movieInventory: Record<string, boolean>, listId: string): string {
    return associationDesignations(movieInventory, listId).sort().join('\u001f');
}

export function bumpListRevision(meta: VltMeta, listId: string): void {
    meta.listRevisions[listId] = (meta.listRevisions[listId] || 0) + 1;
}

/**
 * 在单个 IndexedDB transaction 中读取四个逻辑对象，并可同步修改后一次性写回。
 * readwrite transaction 会被 IndexedDB 按 object store 串行化，避免跨标签页覆盖。
 */
export async function withState<T>(
    mode: IDBTransactionMode,
    callback: (state: VltState) => T
): Promise<T> {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, mode);
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);

    try {
        const [moviesValue, inventoryValue, movieInventoryValue, metaValue] = await Promise.all([
            requestResult(store.get(KEYS.MOVIES)),
            requestResult(store.get(KEYS.INVENTORY)),
            requestResult(store.get(KEYS.MOVIE_INVENTORY)),
            requestResult(store.get(KEYS.META))
        ]);

        const state: VltState = {
            movies: (moviesValue as Record<string, MovieRecord> | undefined) || {},
            inventory: (inventoryValue as Record<string, InventoryRecord> | undefined) || {},
            movieInventory:
                (movieInventoryValue as Record<string, boolean> | undefined) || {},
            meta: normalizeMeta(metaValue as Partial<VltMeta> | undefined)
        };
        const result = callback(state);

        if (mode === 'readwrite') {
            store.put(state.movies, KEYS.MOVIES);
            store.put(state.inventory, KEYS.INVENTORY);
            store.put(state.movieInventory, KEYS.MOVIE_INVENTORY);
            store.put(state.meta, KEYS.META);
        }

        await done;
        return result;
    } catch (error) {
        try {
            transaction.abort();
        } catch {}
        await done.catch(() => {});
        throw error;
    } finally {
        db.close();
    }
}

export function validateSnapshot(snapshot: ListReconcileSnapshot): void {
    if (!snapshot.listId || !snapshot.name || !snapshot.url) {
        throw new Error('服务端清单快照缺少 listId/name/url');
    }
    if (!Number.isInteger(snapshot.expectedCount) || snapshot.expectedCount < 0) {
        throw new Error('服务端清单快照数量无效');
    }
    if (snapshot.movies.length !== snapshot.expectedCount) {
        throw new Error(
            `服务端清单快照不完整：期望 ${snapshot.expectedCount}，实际 ${snapshot.movies.length}`
        );
    }
    const designations = new Set<string>();
    for (const movie of snapshot.movies) {
        if (!movie.designation || !movie.href) {
            throw new Error('服务端清单快照包含空番号或空链接');
        }
        if (designations.has(movie.designation)) {
            throw new Error(`服务端清单快照包含重复番号：${movie.designation}`);
        }
        designations.add(movie.designation);
    }
}

/**
 * 影片 upsert + 清单 upsert + 关联 add/remove，全部在一个事务中提交。
 */
export async function sync(
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
    list: { url?: string; name: string },
    action: 'add' | 'remove',
    options: SyncOptions = {}
): Promise<SyncResult> {
    return withState('readwrite', (state) => {
        const { movies, inventory, movieInventory, meta } = state;
        const movieExisted = !!movies[designation];
        const score = movie.score != null ? Number(movie.score) : null;
        const previousMovie = movies[designation];
        movies[designation] = {
            designation,
            href: movie.href,
            title: movie.title ?? null,
            coverSrc: movie.cover_src ?? null,
            score: Number.isFinite(score) ? score : null,
            releaseDate: movie.release_date ?? null,
            createdAt: previousMovie?.createdAt ?? new Date().toISOString(),
            series: movie.series ?? null,
            code: movie.code ?? null
        };

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

        const assocKey = `${designation}::${listId}`;
        const actualCount = associationDesignations(movieInventory, listId).length;
        inventory[listId].count = actualCount;
        let association: SyncResult['association'];

        if (action === 'add') {
            if (movieInventory[assocKey]) {
                association = 'existed';
            } else if (actualCount >= MAX_COUNT && !options.serverConfirmed) {
                association = 'limit_exceeded';
            } else {
                movieInventory[assocKey] = true;
                inventory[listId].count = actualCount + 1;
                association = 'created';
            }
        } else if (movieInventory[assocKey]) {
            delete movieInventory[assocKey];
            inventory[listId].count = Math.max(0, actualCount - 1);
            association = 'deleted';
        } else {
            association = 'unchanged';
        }

        bumpListRevision(meta, listId);
        return {
            movie: movieExisted ? 'existed' : 'created',
            list: listExisted ? 'existed' : 'created',
            association
        };
    });
}

/** 批量查询番号所属的清单列表。 */
export async function queryMoviesLists(designations: string[]): Promise<
    Record<
        string,
        {
            name: string;
            url: string | null;
            style: { name: string; bg: string; text: string } | null;
        }[]
    >
> {
    return withState('readonly', (state) => {
        const result: Record<
            string,
            {
                name: string;
                url: string | null;
                style: { name: string; bg: string; text: string } | null;
            }[]
        > = {};
        for (const designation of designations) result[designation] = [];

        for (const key of Object.keys(state.movieInventory)) {
            if (!state.movieInventory[key]) continue;
            const separator = key.indexOf('::');
            if (separator < 0) continue;
            const designation = key.slice(0, separator);
            if (result[designation] === undefined) continue;
            const listId = key.slice(separator + 2);
            const list = state.inventory[listId];
            if (!list) continue;
            result[designation].push({ name: list.name, url: list.url, style: list.style });
        }
        return result;
    });
}

/** 检查影片/清单/关联是否存在。 */
export async function check(
    designation: string,
    listId: string
): Promise<{ movie: boolean; inventory: boolean; movieInventory: boolean }> {
    return withState('readonly', (state) => ({
        movie: !!state.movies[designation],
        inventory: !!state.inventory[listId],
        movieInventory: !!state.movieInventory[`${designation}::${listId}`]
    }));
}

/** 获取全部清单。 */
export async function getAllInventory(): Promise<Record<string, InventoryRecord>> {
    return withState('readonly', (state) => state.inventory);
}

/** 删除清单和其全部关联；不删除影片记录。 */
export async function deleteList(listId: string): Promise<{ inventory: boolean; associations: number }> {
    return withState('readwrite', (state) => {
        const inventoryDeleted = !!state.inventory[listId];
        delete state.inventory[listId];
        const suffix = `::${listId}`;
        let associations = 0;
        for (const key of Object.keys(state.movieInventory)) {
            if (!key.endsWith(suffix)) continue;
            delete state.movieInventory[key];
            associations++;
        }
        bumpListRevision(state.meta, listId);
        return { inventory: inventoryDeleted, associations };
    });
}

/** 重命名清单，不改变关联。 */
export async function renameList(listId: string, newName: string): Promise<boolean> {
    return withState('readwrite', (state) => {
        if (!state.inventory[listId]) return false;
        state.inventory[listId].name = newName;
        bumpListRevision(state.meta, listId);
        return true;
    });
}
