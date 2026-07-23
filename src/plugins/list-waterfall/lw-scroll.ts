/**
 * 清单瀑布流滚动控制 —— 从 list-waterfall-plugin.ts 拆出的滚动相关方法。
 *
 * checkLoad：loader 距视口底部 PRELOAD_DISTANCE 时触发加载下一页。
 * updateCurrentPageFromScroll：滚动时同步内部页码（不改地址栏）。
 */
import type { ListWaterfallPlugin } from '../list-waterfall-plugin';
import { loadNextPage } from './lw-fetch';

/** 预加载距离：loader 距视口底部多少像素时触发加载下一页。 */
const PRELOAD_DISTANCE = 800;

/**
 * 检查是否需要触发加载（loader 接近视口底部时）。对应原 L432-438。
 */
export function checkLoad(plugin: ListWaterfallPlugin): void {
    if (!plugin.loader || !plugin.hasMore) return;
    const rect = plugin.loader.getBoundingClientRect();
    if (rect.top < window.innerHeight + PRELOAD_DISTANCE) {
        loadNextPage(plugin);
    }
}

/**
 * 根据滚动位置更新当前页码与地址栏 URL（replaceState）。对应原 L443-456。
 */
export function updateCurrentPageFromScroll(plugin: ListWaterfallPlugin): void {
    const y = window.scrollY;
    for (let i = plugin.pageItems.length - 1; i >= 0; i--) {
        const item = plugin.pageItems[i];
        if (y >= item.top) {
            if (plugin.currentPage !== item.page) {
                plugin.currentPage = item.page;
                // 不修改地址栏，保持进入清单页时的原始 URL
            }
            break;
        }
    }
}
