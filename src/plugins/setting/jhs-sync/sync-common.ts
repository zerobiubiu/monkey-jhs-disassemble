/**
 * JHS ↔ JavDB 双向同步 —— 共享工具函数（doc/214）。
 *
 * 提供 CSRF 读取、同源抓取、videoId 提取、JavDB 评价 API（想看/已看）、
 * 评分缓存读取等基础设施，供 sync-engine 复用。
 */

import { RatingCache } from '../../rating-display/rating-cache';

/** 抓取 want/watched 列表的最大页数保护。 */
export const SYNC_PAGE_LIMIT = 200;

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

/** 读取 IndexedDB 评分缓存，返回 carNum→score 映射。 */
export async function readRatingCacheMap(): Promise<Map<string, number>> {
    await RatingCache.load();
    const map = new Map<string, number>();
    for (const [code, entry] of Object.entries(RatingCache._data)) {
        if (entry && typeof entry.rating === 'number' && entry.rating > 0) {
            map.set(code, entry.rating);
        }
    }
    return map;
}
