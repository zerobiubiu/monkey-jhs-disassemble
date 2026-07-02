/**
 * Gfriends 头像数据源资源清单（原 tt / nt / ot / rt）
 *
 * 用于演员头像替换功能：从 Gfriends 仓库加载 Filetree.json 并缓存到 IndexedDB。
 * - GFRIENDS_SOURCES（原 tt）：CDN 源列表，运行时按 localStorage 索引选择当前源
 * - GFRIENDS_CDN_INDEX_KEY（原 nt）：localStorage 中当前源索引的键名
 * - FILETREE_STORE（原 ot）：IndexedDB objectStore 名
 * - FILETREE_DATA_KEY（原 rt）：IndexedDB 中存储 Filetree 的键名
 * - GFRIENDS_DB_NAME：IndexedDB 数据库名（原 lt.open 中硬编码）
 */

export interface GfriendsSource {
    name: string;
    json: string;
    base: string;
}

/** 原 tt */
export const GFRIENDS_SOURCES: GfriendsSource[] = [
    {
        name: 'jsDelivr (全球CDN)',
        json: 'https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json',
        base: 'https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/',
    },
    {
        name: 'GitHub Raw (备用)',
        json: 'https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json',
        base: 'https://raw.githubusercontent.com/gfriends/gfriends/master/Content/',
    },
];

/** 原 nt */
export const GFRIENDS_CDN_INDEX_KEY = 'jhs_img_cdn_index';

/** IndexedDB 数据库名（原 lt.open 中硬编码） */
export const GFRIENDS_DB_NAME = 'GfriendsAvatarDB';

/** 原 ot */
export const FILETREE_STORE = 'filetreeStore';

/** 原 rt */
export const FILETREE_DATA_KEY = 'filetree_data';
