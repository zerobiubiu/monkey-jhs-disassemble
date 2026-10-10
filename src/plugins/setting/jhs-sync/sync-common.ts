/**
 * JHS ↔ JavDB 双向同步 —— 共享工具函数（doc/214）。
 *
 * 提供 CSRF 读取、同源抓取、videoId 提取、JavDB 评价 API（想看/已看）、
 * 评分缓存读取等基础设施，供 sync-engine 复用。
 */

import { RatingCache } from '../../rating-display/rating-cache';

import { getCsrfToken } from '../../../core/util/site/csrf';
import { siteSelector } from '../../../core/util/site/selectors';

/** 抓取 want/watched 列表的最大页数保护。 */
export const SYNC_PAGE_LIMIT = 200;

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

/**
 * 从影片详情页 HTML 中提取评价记录 id（reviewId）。
 *
 * 与详情页 getReviewId() 用同一注册表选择器（detailReviewDelete），
 * 但面向**拉取到的 HTML 文本**，因此批量场景（列表页无法直接拿到 reviewId）可复用。
 *
 * @param html 详情页 HTML
 * @returns reviewId；未找到（服务器上本无评价）返回 null
 */
export function findReviewIdInHtml(html: string): string | null {
    if (!html) return null;
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const del = doc.querySelector(siteSelector('detailReviewDelete'));
        return del?.getAttribute('href')?.match(/\/reviews\/(\d+)/)?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * 删除 JavDB 上的评价记录（列表页批量「取消已读」的服务端对应操作）。
 *
 * 注意：这是**破坏性远端操作** —— 会一并移除服务器上该影片的评价正文。
 * 仅在有明确用户意图时调用（本项目当前仅用于批量「取消已读」，且使用者确认不写评价正文）。
 *
 * @param videoId JavDB 影片 ID
 * @param reviewId 评价记录 ID
 */
export async function deleteReview(videoId: string, reviewId: string): Promise<void> {
    const token = getCsrfToken();
    if (!token) throw new Error('无法获取 CSRF token');
    const res = await fetch(`/v/${videoId}/reviews/${reviewId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': token
        },
        body: `authenticity_token=${encodeURIComponent(token)}&_method=delete`,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
