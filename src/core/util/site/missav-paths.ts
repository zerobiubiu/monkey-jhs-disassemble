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
    const last = path.split('/').pop() || '';
    // 至少两段含连字符的番号/编号（mkmp-745 / fc2-ppv-4955762 / abc-123-456）
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(last);
}