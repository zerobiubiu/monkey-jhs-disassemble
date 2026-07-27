/**
 * JHS ↔ JavDB 双向同步 —— 共享类型与工具函数（doc/213）。
 *
 * 提供 CSRF 读取、同源抓取、videoId↔carNum 映射、限速 sleep、
 * JavDB 评价 API（想看/已看）等基础设施，供各方向同步模块复用。
 */
import { isJavdbSite } from '../../../constants/site';

/** 抓取 want/watched 列表的最大页数保护。 */
export const SYNC_PAGE_LIMIT = 200;

/** 同步中止信号。 */
export interface SyncSignal {
    aborted: boolean;
}

/** 同步选项（各方向共用）。 */
export interface SyncOptions {
    /** 每步间隔（ms，限速）。 */
    interval: number;
    /** 中止信号。 */
    signal: SyncSignal;
    /** 进度回调。 */
    onProgress: (message: string) => void;
}

/** 单条同步明细（报告用）。 */
export interface SyncEntry {
    carNum: string;
    videoId: string;
    /** 额外信息（如评分）。 */
    extra?: string;
}

/** 冲突条目（脚本与 JavDB 状态不一致）。 */
export interface ConflictEntry {
    carNum: string;
    videoId: string;
    /** 脚本侧状态描述。 */
    jhsStatus: string;
    /** JavDB 侧状态描述。 */
    javdbStatus: string;
}

/** 各方向同步结果（统一结构）。 */
export interface SyncResult {
    /** 方向标签（如 "JHS→JavDB 想看"）。 */
    direction: string;
    /** 本次成功同步数。 */
    synced: number;
    /** 失败数。 */
    failed: number;
    /** 失败明细（番号+原因）。 */
    failedList: string[];
    /** 已存在（跳过）数。 */
    skipped: number;
    /** 冲突条目（不自动处理，仅报告）。 */
    conflicts: ConflictEntry[];
    /** 成功同步的番号列表（增量报告）。 */
    syncedList: string[];
    /** 是否被中止。 */
    aborted: boolean;
}

/** 全量双向同步汇总结果。 */
export interface FullSyncResult {
    results: SyncResult[];
    aborted: boolean;
}

/** 读取 CSRF token（meta[name=csrf-token]）。 */
export function getCsrfToken(): string | null {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta ? meta.content : null;
}

/** 从番号记录的 url 提取 JavDB videoId（/v/{id}）。 */
export function extractVideoId(url: string | undefined): string | null {
    if (!url) return null;
    const m = url.match(/\/v\/([^/?#]+)/);
    return m ? m[1] : null;
}

/** 同源抓取页面 HTML。 */
export async function fetchPageHtml(url: string): Promise<string> {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

/**
 * 抓取 /users/want_watch_videos 或 /users/watched_videos 全部页，
 * 返回 videoId → carNum 映射（增强版，同时提取番号）。
 */
export async function fetchVideoMap(startPath: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let url: string | null = startPath;
    const visited = new Set<string>();
    for (let page = 0; url && page < SYNC_PAGE_LIMIT; page++) {
        const absUrl = new URL(url, window.location.origin).href;
        if (visited.has(absUrl)) break;
        visited.add(absUrl);
        const html = await fetchPageHtml(absUrl);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('.movie-list .item').forEach((item) => {
            const a = item.querySelector('a[href*="/v/"]');
            const strong = item.querySelector('.video-title strong');
            if (!a) return;
            const m = (a.getAttribute('href') || '').match(/\/v\/([^/?#]+)/);
            if (!m) return;
            const videoId = m[1];
            const carNum = strong ? (strong.textContent || '').trim() : '';
            map.set(videoId, carNum);
        });
        const next = doc.querySelector('a.pagination-next');
        url = next ? next.getAttribute('href') : null;
    }
    return map;
}

/** 限速 sleep。 */
export const syncSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 将单个影片设为 JavDB 想看（POST /v/{id}/reviews/want_to_watch）。 */
export async function postWantToWatch(videoId: string): Promise<void> {
    const token = getCsrfToken();
    if (!token) throw new Error('无法获取 CSRF token');
    const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': token
        },
        body: `authenticity_token=${encodeURIComponent(token)}`,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/**
 * 将单个影片设为 JavDB 已看（POST /v/{id}/reviews）。
 * @param videoId JavDB 影片 ID
 * @param score 评分 0-5（0 表示不评分）
 */
export async function postWatched(videoId: string, score: number = 0): Promise<void> {
    const token = getCsrfToken();
    if (!token) throw new Error('无法获取 CSRF token');
    const tokenParam = `authenticity_token=${encodeURIComponent(token)}`;
    const body = `${tokenParam}&video_review[status]=watched&video_review[score]=${score}&video_review[content]=`;
    const res = await fetch(`/v/${videoId}/reviews`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': token
        },
        body,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** 读取 localStorage 评分缓存（jdb:rating_cache_v2），返回 carNum→score 映射。 */
export function readRatingCacheMap(): Map<string, number> {
    const map = new Map<string, number>();
    try {
        const raw = localStorage.getItem('jdb:rating_cache_v2');
        if (!raw) return map;
        const obj = JSON.parse(raw) as Record<string, { rating?: number }>;
        for (const [code, entry] of Object.entries(obj)) {
            if (entry && typeof entry.rating === 'number' && entry.rating > 0) {
                map.set(code, entry.rating);
            }
        }
    } catch {
        // 缓存损坏时静默忽略
    }
    return map;
}

/** 创建空同步结果。 */
export function createEmptyResult(direction: string): SyncResult {
    return {
        direction,
        synced: 0,
        failed: 0,
        failedList: [],
        skipped: 0,
        conflicts: [],
        syncedList: [],
        aborted: false
    };
}

/** 检查是否在 JavDB 站点，否则 toast 提示并返回 false。 */
export function ensureJavdbSite(): boolean {
    if (!isJavdbSite) {
        show.error('请在 JavDB 站点下执行此同步');
        return false;
    }
    return true;
}
