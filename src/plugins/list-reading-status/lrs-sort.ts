/**
 * 清单阅读进度插件 —— 排序层。
 *
 * 覆盖 li 元数据提取、原始顺序索引分配、10 种排序比较（含稳定 tiebreaker）、
 * 应用排序（重排 DOM）。函数以插件实例为首参，复用其排序状态字段。
 */
import type { ListReadingStatusPlugin } from '../list-reading-status-plugin';
import { LRS_ORDER_ATTR, type ListMeta } from './lrs-types';
import { getRating, getLastUri } from './lrs-storage';

/** 从 li 提取排序/筛选所需的元数据。对应原 L827-847。 */
export function getListMeta(_plugin: ListReadingStatusPlugin, li: Element): ListMeta {
    const listId = (li as HTMLElement).id || '';
    const titleEl = li.querySelector("a[href*='/lists/']");
    const title = titleEl ? titleEl.textContent!.trim() : '';
    const metaTxt = li.querySelector('.meta')?.textContent ?? '';
    const moviesMatch = metaTxt.match(/([\d,]+)\s*部影片/);
    const clicksMatch = metaTxt.match(/點擊了\s*([\d,]+)/);
    return {
        listId,
        title,
        movies: moviesMatch ? parseInt(moviesMatch[1].replace(/,/g, '')) : 0,
        clicks: clicksMatch ? parseInt(clicksMatch[1].replace(/,/g, '')) : 0,
        rating: getRating(listId),
        visited: getLastUri(listId)?.timestamp ?? 0,
        order: parseInt(li.getAttribute(LRS_ORDER_ATTR) || '0') || 0
    };
}

/** 为 li 分配原始顺序索引。对应原 L853-857。 */
export function ensureLiOrder(plugin: ListReadingStatusPlugin, li: Element): void {
    if (!li.hasAttribute(LRS_ORDER_ATTR)) {
        li.setAttribute(LRS_ORDER_ATTR, String(plugin.orderCounter++));
    }
}

/** 比较两个 li（按 currentSort），相同则按原始顺序 tiebreaker。对应原 L865-902。 */
export function compareLi(plugin: ListReadingStatusPlugin, a: Element, b: Element): number {
    const ma = getListMeta(plugin, a);
    const mb = getListMeta(plugin, b);
    let cmp = 0;
    switch (plugin.currentSort) {
        case 'rating-desc': cmp = mb.rating - ma.rating; break;
        case 'rating-asc': cmp = ma.rating - mb.rating; break;
        case 'movies-desc': cmp = mb.movies - ma.movies; break;
        case 'movies-asc': cmp = ma.movies - mb.movies; break;
        case 'clicks-desc': cmp = mb.clicks - ma.clicks; break;
        case 'clicks-asc': cmp = ma.clicks - mb.clicks; break;
        case 'visited-desc': cmp = mb.visited - ma.visited; break;
        case 'visited-asc': cmp = ma.visited - mb.visited; break;
        case 'title-asc': cmp = ma.title.localeCompare(mb.title, 'zh'); break;
        default: cmp = 0;
    }
    if (cmp === 0) cmp = ma.order - mb.order;
    return cmp;
}

/** 应用排序：按 currentSort 重排 #lists > ul 下的 li。对应原 L908-924。 */
export function applySort(plugin: ListReadingStatusPlugin): void {
    if (plugin.currentSort === 'default') return;
    const ul = document.querySelector('#lists > ul');
    if (!ul) return;
    const lis = [...ul.querySelectorAll(':scope > li')] as HTMLElement[];
    if (lis.length < 2) return;
    lis.forEach((li) => ensureLiOrder(plugin, li));
    lis.sort((a, b) => compareLi(plugin, a, b));
    const sortedIds = lis.map((li) => li.id).join(',');
    const currentIds = [...ul.querySelectorAll(':scope > li')].map((li) => (li as HTMLElement).id).join(',');
    if (sortedIds === currentIds) return;
    const frag = document.createDocumentFragment();
    lis.forEach((li) => frag.appendChild(li));
    ul.appendChild(frag);
}
