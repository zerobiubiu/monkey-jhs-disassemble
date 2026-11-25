/**
 * MissAV 路径判定 —— 站点级路径事实的**共享实现**（doc/47）。
 *
 * 背景：`isVideoDetailPath` 原住在 `plugins/missav-status-filter/mstf-collect.ts`，
 * 而 `plugins/missav-auto-page` 也要用它 → 形成一条跨插件内部 import。
 * 该函数只依赖 pathname（无 DOM、无状态、无插件概念），属站点级共享事实，
 * 归入 `core/util/site/`，供两个 missav 插件共同引用。
 *
 * 与 DOM 判定 `isVideoPage()`（`#sprite-plyr`，在 car-status-sync/missav-renderer）
 * **不可互相替代**：DOM 版在 handle 执行时（document-idle）可能因播放器延迟渲染
 * 误判 false，URL 版无时序问题但泛化更宽（只看末段形态）。
 */

/**
 * 判断 URL 是否为 MissAV 视频详情页（pathname 末段为番号，如 `/cn/mkmp-745`）。
 *
 * 搜索页（`/search/`）末段可能是番号，但搜索页需要筛选器，故排除。
 *
 * @param path pathname（如 `/cn/mkmp-745`、`/cn/new`、`/cn/search/mkmp-745`）
 * @returns 是否为视频详情页
 */
export function isVideoDetailPath(path: string): boolean {
    if (path.includes('/search/')) return false;
    const last = path.split('/').filter(Boolean).pop() || '';
    // 至少两段含连字符的番号/编号（mkmp-745 / fc2-ppv-4955762 / abc-123-456）
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(last);
}

/**
 * 提取 MissAV 视频条目的规范化 slug（保留变体后缀，如 `royd-380-uncensored-leak`）。
 *
 * 与 `normalizeCarNum(..., 'path')` 的区别：
 * - `normalizeCarNum(..., 'path')` 用于匹配 JavDB 番号（去变体后缀、大写）；
 * - `extractMissavSlug` 用于区分 MissAV 同一番号的不同视频条目（有码 / 无码流出 / 中文字幕），
 *   作为 MissAV 原生收藏状态的精确主键。
 *
 * @param raw 卡片 `a[alt]`、链接 `href` 或页面 `location.pathname`
 * @returns 小写 slug；无法提取时返回空串
 */
export function extractMissavSlug(raw: string | null | undefined): string {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    let pathname: string;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            pathname = new URL(trimmed).pathname;
        } catch {
            pathname = trimmed;
        }
    } else {
        pathname = trimmed.split(/[?#]/, 1)[0] || '';
    }
    const last = pathname.split('/').filter(Boolean).pop() || '';
    return last.trim().toLowerCase();
}

/** MissAV 语言前缀段（实测 `/cn/saved`、`/en/saved`、`/ja/saved` 等）。 */
const MISSAV_LANG_SEGMENT = /^(cn|en|ja|ko|ms|th|de|fr|vi|id|zh|tw)$/i;

/**
 * 判定路径是否为 MissAV「我的影片收藏」页面（兼容 `/cn/saved`、`/saved`、`/dm123/cn/saved`）。
 *
 * @param path pathname（如 `/cn/saved`）
 * @returns 是否收藏页
 */
export function isMissavSavedPage(path: string): boolean {
    const clean = (path || '').split(/[?#]/, 1)[0] || '';
    const segments = clean.split('/').filter(Boolean);
    if (segments.length === 0) return false;
    return segments[segments.length - 1].toLowerCase() === 'saved';
}

/**
 * 基于当前站点 origin 与 pathname 语言前缀构造 MissAV 收藏页绝对 URL。
 *
 * @param origin 当前站点 origin（如 `https://missav.ws`）
 * @param pathname 当前页面 pathname（如 `/dm539/cn/new` → 识别 `/cn`）
 * @returns 收藏页绝对 URL（如 `https://missav.ws/cn/saved`）
 */
export function buildMissavSavedUrl(origin: string, pathname: string): string {
    const base = origin.replace(/\/+$/, '');
    const segments = (pathname || '').split(/[?#]/, 1)[0].split('/').filter(Boolean);
    const lang = segments.find((seg) => MISSAV_LANG_SEGMENT.test(seg))?.toLowerCase() ?? 'cn';
    return `${base}/${lang}/saved`;
}