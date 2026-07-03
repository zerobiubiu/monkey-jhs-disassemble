/**
 * Gfriends 头像加载模块（提取自 archetype/jhs.user.js L10886-11034）
 *
 * 从 Gfriends 仓库加载 Filetree.json 并缓存到 IndexedDB，按演员名查询头像 URL。
 * - FiletreeDb（原 lt）：IndexedDB 封装，objectStore `filetreeStore`、db `GfriendsAvatarDB`
 * - 内存缓存（原 ct/dt）：模块内非导出状态
 * - parseFiletree（原 ht）：解析 Filetree.json 为「演员名→头像URL 列表」索引
 * - loadGfriends（原 gt）：按演员名查询头像 URL 列表
 *
 * 依赖（已由 src/types/globals.d.ts 声明为 any）：
 * - show / clog / loading：运行时全局
 *
 * 资源常量来自 src/resources/gfriends：
 * - GFRIENDS_SOURCES / GFRIENDS_CDN_INDEX_KEY：CDN 源列表与 localStorage 索引键
 * - FILETREE_STORE / FILETREE_DATA_KEY / GFRIENDS_DB_NAME：IndexedDB 配置
 *
 * 仅 JS→TS 转换与命名优化，控制流与原脚本保持一致。
 */

import {
    FILETREE_DATA_KEY,
    FILETREE_STORE,
    GFRIENDS_CDN_INDEX_KEY,
    GFRIENDS_DB_NAME,
    GFRIENDS_SOURCES,
} from "../resources/gfriends";

/** Gfriends Filetree.json 数据结构 */
export interface FiletreeData {
    Content: Record<string, Record<string, string>>;
}

/** 解析后的头像索引：演员名（小写）→ 头像 URL 列表 */
export type FiletreeIndex = Record<string, string[]>;

/**
 * IndexedDB 封装（原 lt）
 *
 * 使用 objectStore `filetreeStore`、数据库 `GfriendsAvatarDB`，
 * 提供 open/get/set，用于缓存 Filetree.json 数据。
 */
class FiletreeDb {
    private db: IDBDatabase | null = null;

    /** 打开数据库（已打开则返回缓存实例） */
    async open(): Promise<IDBDatabase> {
        if (this.db) {
            return this.db;
        }
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(GFRIENDS_DB_NAME, 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                this.db = database;
                if (!database.objectStoreNames.contains(FILETREE_STORE)) {
                    database.createObjectStore(FILETREE_STORE);
                }
            };
            request.onsuccess = () => {
                const database = request.result;
                this.db = database;
                resolve(database);
            };
            request.onerror = () => {
                console.error("IndexedDB open error:", request.error);
                reject(new Error("Failed to open IndexedDB"));
            };
        });
    }

    /** 读取指定键的值（不存在或出错时返回 null） */
    async get<T = unknown>(key: string): Promise<T | null> {
        const db = await this.open();
        return new Promise<T | null>((resolve) => {
            const request = db
                .transaction([FILETREE_STORE], "readonly")
                .objectStore(FILETREE_STORE)
                .get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => resolve(null);
        });
    }

    /** 写入键值对 */
    async set(key: string, value: unknown): Promise<void> {
        const db = await this.open();
        return new Promise<void>((resolve, reject) => {
            const request = db
                .transaction([FILETREE_STORE], "readwrite")
                .objectStore(FILETREE_STORE)
                .put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error("IndexedDB set error:", request.error);
                reject(new Error("Failed to write to IndexedDB"));
            };
        });
    }
}

/** IndexedDB 封装单例（原 lt） */
export const filetreeDb = new FiletreeDb();

/** 内存缓存：Filetree.json 原始数据（原 ct） */
let cachedFiletreeRaw: FiletreeData | null = null;

/** 内存缓存：解析后的头像索引（原 dt） */
let cachedFiletreeParsed: FiletreeIndex | null = null;

/**
 * 清除内存中的头像数据缓存（原 ct/dt 置空）
 *
 * 重置 cachedFiletreeRaw 与 cachedFiletreeParsed，使下次调用 loadGfriends 时
 * 重新从 IndexedDB 或远程 CDN 载入。CDN 源切换后必须调用，否则仍使用旧源数据。
 * 注意：仅清除内存缓存，IndexedDB 缓存需由调用方另行清理。
 */
export function clearCache(): void {
    cachedFiletreeRaw = null;
    cachedFiletreeParsed = null;
}

/** getCurrentCdnSource 返回的当前 CDN 源信息 */
export interface CurrentCdnSource {
    /** Filetree.json 的完整 URL */
    json: string;
    /** Content 目录的基址 URL */
    base: string;
    /** 当前源在 GFRIENDS_SOURCES 中的索引 */
    index: number;
}

/**
 * 获取当前选定的 CDN 源
 *
 * 从 localStorage 读取索引（原 at），越界时回退到第一项，
 * 返回对应源的 { json, base, index }（原 at/it/st 的运行时等价）。
 *
 * 导出供外部模块（如 NewVideoPlugin）读取当前 CDN 源，避免直接访问模块私有状态。
 * 切换源后只需更新 localStorage（GFRIENDS_CDN_INDEX_KEY），下次调用即返回新源。
 *
 * @returns 当前 CDN 源信息：json（Filetree.json URL）、base（Content 基址）、index（源索引）
 */
export function getCurrentCdnSource(): CurrentCdnSource {
    const rawIndex = parseInt(
        localStorage.getItem(GFRIENDS_CDN_INDEX_KEY) || "0",
        10,
    );
    const index =
        rawIndex >= 0 && rawIndex < GFRIENDS_SOURCES.length ? rawIndex : 0;
    const source = GFRIENDS_SOURCES[index];
    return { json: source.json, base: source.base, index };
}

/**
 * 解析 Filetree.json 为头像索引（原 ht，L10939-10973）
 *
 * 遍历 Content 中每个文件夹/文件名，提取演员名（去掉 .jpg 后缀与 AI-Fix- 前缀），
 * 拼接 CDN 基址生成完整头像 URL，按演员名（小写）分组去重。
 *
 * @param data Filetree.json 数据（含 Content 字段）
 * @returns 演员名（小写）→ 头像 URL 列表；数据无效时返回 null
 */
export function parseFiletree(data: FiletreeData | null): FiletreeIndex | null {
    if (!data || !data.Content) {
        return null;
    }
    const result: FiletreeIndex = {};
    const content = data.Content;
    const baseUrl = getCurrentCdnSource().base;
    for (const folderKey in content) {
        const encodedFolder = encodeURIComponent(folderKey);
        const folder = content[folderKey];
        for (const fileName in folder) {
            let namePart = fileName.replace(/\.jpg$/i, "").split("-")[0];
            if (namePart.startsWith("AI-Fix-")) {
                namePart = namePart.substring(7);
            }
            const normalizedName = namePart.toLowerCase().trim();
            if (normalizedName.length > 0) {
                const urlPath = folder[fileName];
                const queryIndex = urlPath.indexOf("?");
                let encodedPath: string;
                let queryString = "";
                if (queryIndex > -1) {
                    encodedPath = encodeURIComponent(
                        urlPath.substring(0, queryIndex),
                    );
                    queryString = urlPath.substring(queryIndex);
                } else {
                    encodedPath = encodeURIComponent(urlPath);
                }
                const fullUrl = `${baseUrl}${encodedFolder}/${encodedPath}${queryString}`;
                if (!result[normalizedName]) {
                    result[normalizedName] = [];
                }
                if (!result[normalizedName].includes(fullUrl)) {
                    result[normalizedName].push(fullUrl);
                }
            }
        }
    }
    return result;
}

/**
 * 确保头像数据源已载入内存缓存（原 gt 内部 IIFE，L10977-11012）
 *
 * 优先使用内存缓存，其次读取 IndexedDB 缓存，最后从远程 CDN 拉取并写入缓存。
 */
async function ensureFiletreeLoaded(): Promise<void> {
    if (cachedFiletreeRaw && cachedFiletreeParsed) {
        return;
    }
    let idbData: FiletreeData | null = null;
    try {
        idbData = await filetreeDb.get<FiletreeData>(FILETREE_DATA_KEY);
    } catch (error) {
        console.error("读取 IndexedDB 失败:", error);
    }
    if (idbData && idbData.Content) {
        cachedFiletreeRaw = idbData;
        cachedFiletreeParsed = parseFiletree(idbData);
        if (cachedFiletreeParsed) {
            return;
        }
    }
    show.info("正在载入头像数据源...");
    const response = await fetch(getCurrentCdnSource().json);
    if (!response.ok) {
        throw new Error(`请求头像源失败: ${response.status}`);
    }
    const filetree = (await response.json()) as FiletreeData;
    if (filetree && filetree.Content) {
        cachedFiletreeRaw = filetree;
        cachedFiletreeParsed = parseFiletree(filetree);
        try {
            await filetreeDb.set(FILETREE_DATA_KEY, filetree);
            clog.debug("载入头像数据源并写入缓存成功!");
        } catch (error) {
            clog.error(error);
            show.error("头像数据源写入缓存失败，可能磁盘已满或其他权限问题。");
        }
        return;
    }
    console.log(filetree);
    throw new Error("解析头像数据源失败");
}

/**
 * 按演员名查询头像 URL 列表（原 gt，L10974-11034）
 *
 * 自动加载并缓存 Filetree.json，将演员名标准化（小写、去空白）后查表，
 * 汇总所有匹配的头像 URL（去重）。加载失败时返回空数组。
 *
 * @param actressNames 演员名列表
 * @returns 去重后的头像 URL 列表
 */
export async function loadGfriends(actressNames: string[]): Promise<string[]> {
    const loadingHandle = loading();
    try {
        await ensureFiletreeLoaded();
    } catch (error) {
        show.error(error);
        return [];
    } finally {
        loadingHandle.close();
    }
    const filetreeIndex = cachedFiletreeParsed;
    if (!filetreeIndex) {
        return [];
    }
    const urlSet = new Set<string>();
    const normalizedNames = actressNames
        .map((name) => name.toLowerCase().trim())
        .filter((name) => name.length > 0);
    if (normalizedNames.length === 0) {
        return [];
    }
    for (const name of normalizedNames) {
        const urls = filetreeIndex[name];
        if (urls) {
            urls.forEach((url) => urlSet.add(url));
        }
    }
    return Array.from(urlSet);
}
