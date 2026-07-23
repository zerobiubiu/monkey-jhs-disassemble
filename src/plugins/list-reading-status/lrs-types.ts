/**
 * 清单阅读进度插件 —— 共享类型与常量。
 */

/** SVG 五角星路径。 */
export const STAR_PATH =
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

/** 本脚本隐藏标记（协同安全：与 statusTagFilter 的 data-status-tag-hidden 等互不干扰）。 */
export const LRS_HIDDEN_ATTR = 'data-lrs-hidden';
/** 原始顺序索引（排序 tiebreaker，保证排序稳定）。 */
export const LRS_ORDER_ATTR = 'data-lrs-order';

/** li 元数据（排序/筛选用）。 */
export interface ListMeta {
    listId: string;
    title: string;
    movies: number;
    clicks: number;
    rating: number;
    visited: number;
    order: number;
}

/** 筛选统计。 */
export interface FilterStats {
    read: number;
    unread: number;
    rated: number;
    unrated: number;
    stars: number[];
}
