/**
 * 评分抓取网络层 —— 对应 archetype/jhsRatingDisplay.user.js L307-390
 * （`Net` + `parseRating` + `fetchRating`）。
 *
 * 通过 GM_xmlhttpRequest 抓取详情页 HTML，DOMParser 解析后提取个人评分
 * （1-5 星 input[checked]）。带并发限流（FETCH_CONCURRENCY）与重试
 * （FETCH_RETRY），缓存优先（命中则直接渲染，不重复请求）。
 *
 * 不复用 src/core/gm-http.ts 的 gmRequest：后者对非 2xx reject 且自动
 * JSON.parse，而评分抓取需要原始 HTML 文本 + 仅按 status===200 判定，
 * 语义不匹配；直接使用全局 GM_xmlhttpRequest 与原脚本零偏差。
 */
import { RATING_CONFIG } from './rating-config';
import { RatingCache } from './rating-cache';
import { RatingRenderer } from './rating-renderer';
import { RatingUtils } from './rating-utils';

/** GM_xmlhttpRequest 响应形状（仅用到的字段）。 */
interface GmResponse {
    status: number;
    responseText: string;
}

/** 并发限流器实例（最大 FETCH_CONCURRENCY 并发）。原 Net.limiter。 */
const limiter = RatingUtils.createLimiter(RATING_CONFIG.FETCH_CONCURRENCY);

/**
 * GM_xmlhttpRequest GET 请求（带超时与重试）。对应原 L310-330。
 * @param url     目标 URL
 * @param retries 重试次数（不含首次），默认 FETCH_RETRY
 * @returns 原始响应对象（含 status / responseText）
 * @throws 重试耗尽后抛出最后一次错误
 */
async function request(
    url: string,
    retries: number = RATING_CONFIG.FETCH_RETRY
): Promise<GmResponse> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await new Promise<GmResponse>((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout: RATING_CONFIG.FETCH_TIMEOUT,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    onload: resolve,
                    onerror: reject,
                    ontimeout: reject,
                    onabort: reject
                });
            });
        } catch (err) {
            if (i === retries) throw err;
            await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
        }
    }
    // 不可达（循环必 return 或 throw），满足 TS 返回类型
    throw new Error('unreachable');
}

/** 网络层导出（保持原 Net 命名空间风格）。 */
export const RatingNet = { limiter, request };

/**
 * 从详情页 DOM 解析个人评分。对应原 L340-349。
 * 判定条件：存在 `.review-title .tag.is-success.is-light`（已评分标记），
 * 且 `input[name="video_review[score]"][checked]` 或 `.rating-star input:checked`
 * 存在且值在 1-5 范围内。
 * @param doc DOMParser 解析的详情页 Document
 * @returns 评分值（1-5）；未评分或解析失败返回 null
 */
function parseRating(doc: Document): number | null {
    if (!doc.querySelector('.review-title .tag.is-success.is-light')) return null;
    const chk = doc.querySelector(
        'input[name="video_review[score]"][checked], .rating-star input:checked'
    ) as HTMLInputElement | null;
    if (!chk) return null;
    const ratingValue = parseInt(chk.value, 10);
    return ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
}

/**
 * 懒加载评分（限流 + 缓存优先）。对应原 L354-390。
 *
 * 去重：dataset.jhsrdFetching / jhsrdLoaded 标记，避免并发或重复抓取。
 * 流程：取锚点 → 取番号 → 限流请求详情页 → DOMParser 解析 → parseRating
 * → 命中评分则 RatingCache.set + RatingRenderer.showRating；
 *   未命中（已看但不评分）保持占位，不标 loaded（下次悬停可重试）。
 *
 * @param item 列表页卡片元素
 */
export async function fetchRating(item: HTMLElement): Promise<void> {
    if (item.dataset.jhsrdFetching === 'true' || item.dataset.jhsrdLoaded === 'true') return;
    const anchor = RatingUtils.getAnchor(item);
    if (!anchor) return;
    const code = RatingUtils.getCode(item);
    if (!code) return;

    item.dataset.jhsrdFetching = 'true';
    try {
        const url = RatingUtils.getSafeUrl((anchor as HTMLAnchorElement).href);
        const res = await limiter.run(() => request(url));
        if (res.status !== 200) {
            item.dataset.jhsrdLoaded = 'true';
            return;
        }
        const doc = RatingUtils.parser.parseFromString(res.responseText, 'text/html');
        const rating = parseRating(doc);
        if (rating !== null) {
            RatingCache.set(code, rating);
            RatingRenderer.showRating(item, rating);
        } else {
            // 已看但不评分：保持占位，不标 loaded（下次悬停可重试）
        }
        item.dataset.jhsrdLoaded = 'true';
    } catch (err) {
        RatingUtils.log('FETCH_ERROR', code, err);
    } finally {
        delete item.dataset.jhsrdFetching;
    }
}
