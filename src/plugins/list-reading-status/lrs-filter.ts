/**
 * 清单阅读进度插件 —— 筛选层。
 *
 * 覆盖阅读状态与评分筛选（协同安全显隐）、筛选统计、芯片渲染与交互、
 * 排序+筛选联合应用、筛选状态持久化。函数以插件实例为首参，复用其筛选状态字段与 supervisor。
 */
import type { ListReadingStatusPlugin } from '../list-reading-status-plugin';
import { LRS_HIDDEN_ATTR, type FilterStats } from './lrs-types';
import { FILTER_READ_KEY, FILTER_RATING_KEY, getRating, isRead } from './lrs-storage';
import { applySort } from './lrs-sort';

/** 持久化阅读状态筛选。对应原 L808-811。 */
export function saveFilterReadState(plugin: ListReadingStatusPlugin, v: string): void {
    plugin.filterReadStatus = v;
    GM_setValue(FILTER_READ_KEY, v);
}

/** 持久化评分筛选芯片集合。对应原 L817-820。 */
export function saveFilterRatingState(plugin: ListReadingStatusPlugin, set: Set<string>): void {
    plugin.filterRatingChips = set;
    GM_setValue(FILTER_RATING_KEY, JSON.stringify([...set]));
}

/** 判断 li 是否匹配当前筛选条件。对应原 L931-957。 */
export function matchesFilter(plugin: ListReadingStatusPlugin, li: Element): boolean {
    const listId = (li as HTMLElement).id;
    if (!listId) return true;

    if (plugin.filterReadStatus !== 'all') {
        const read = isRead(listId);
        if (plugin.filterReadStatus === 'read' && !read) return false;
        if (plugin.filterReadStatus === 'unread' && read) return false;
    }

    if (plugin.filterRatingChips.size > 0) {
        const rating = getRating(listId);
        let match = false;
        if (plugin.filterRatingChips.has('rated') && rating > 0) match = true;
        if (plugin.filterRatingChips.has('unrated') && rating === 0) match = true;
        for (let i = 1; i <= 5; i++) {
            if (plugin.filterRatingChips.has(`rating-${i}`) && rating === i) {
                match = true;
                break;
            }
        }
        if (!match) return false;
    }
    return true;
}

/** 应用筛选：显示/隐藏 li（协同安全 data-lrs-hidden）。对应原 L964-995。 */
export function applyFilter(plugin: ListReadingStatusPlugin): void {
    const ul = document.querySelector('#lists > ul');
    if (!ul) return;
    const lis = ul.querySelectorAll(':scope > li');

    if (plugin.filterReadStatus === 'all' && plugin.filterRatingChips.size === 0) {
        lis.forEach((li: Element) => {
            const htmlLi = li as HTMLElement;
            if (htmlLi.hasAttribute(LRS_HIDDEN_ATTR)) {
                htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
                htmlLi.style.display = '';
            }
        });
        return;
    }

    lis.forEach((li: Element) => {
        const htmlLi = li as HTMLElement;
        const hiddenByOther =
            htmlLi.style.display === 'none' &&
            !htmlLi.hasAttribute(LRS_HIDDEN_ATTR);
        if (hiddenByOther) return;

        if (matchesFilter(plugin, htmlLi)) {
            htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
            htmlLi.style.display = '';
        } else {
            htmlLi.setAttribute(LRS_HIDDEN_ATTR, '');
            htmlLi.style.display = 'none';
        }
    });
}

/** 应用排序与筛选（顺序：先排序后筛选）。对应原 L1000-1009。 */
export function applySortAndFilter(plugin: ListReadingStatusPlugin): void {
    if (plugin.isToolbarProcessing) return;
    plugin.isToolbarProcessing = true;
    try {
        applySort(plugin);
        applyFilter(plugin);
    } finally {
        plugin.isToolbarProcessing = false;
    }
}

/** 统计各筛选分类的清单数。对应原 L1015-1039。 */
export function countFilterStats(): FilterStats {
    const stats: FilterStats = {
        read: 0,
        unread: 0,
        rated: 0,
        unrated: 0,
        stars: [0, 0, 0, 0, 0]
    };
    const ul = document.querySelector('#lists > ul');
    if (!ul) return stats;
    ul.querySelectorAll(':scope > li').forEach((li: Element) => {
        const id = (li as HTMLElement).id;
        if (!id) return;
        if (isRead(id)) stats.read++;
        else stats.unread++;
        const r = getRating(id);
        if (r > 0) {
            stats.rated++;
            if (r >= 1 && r <= 5) stats.stars[r - 1]++;
        } else {
            stats.unrated++;
        }
    });
    return stats;
}

/** 创建单个筛选芯片。对应原 L1048-1091。 */
export function createFilterChip(
    plugin: ListReadingStatusPlugin,
    label: string,
    value: string,
    count: number
): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = 'list-filter-chip';
    chip.dataset.value = value;
    const labelText = document.createElement('span');
    labelText.textContent = label;
    chip.appendChild(labelText);
    const countSpan = document.createElement('span');
    countSpan.className = 'chip-count';
    countSpan.textContent = String(count);
    chip.appendChild(countSpan);

    plugin.supervisor.addEventListener(chip, 'click', () => {
        if (value === 'read' || value === 'unread') {
            const wasActive = chip.classList.contains('active');
            document
                .querySelectorAll(
                    ".list-filter-chip[data-value='read'], .list-filter-chip[data-value='unread']"
                )
                .forEach((c: Element) => c.classList.remove('active'));
            if (!wasActive) {
                chip.classList.add('active');
                saveFilterReadState(plugin, value);
            } else {
                saveFilterReadState(plugin, 'all');
            }
        } else {
            chip.classList.toggle('active');
            const next = new Set(plugin.filterRatingChips);
            if (chip.classList.contains('active')) {
                next.add(value);
            } else {
                next.delete(value);
            }
            saveFilterRatingState(plugin, next);
        }
        applySortAndFilter(plugin);
    });

    return chip;
}
