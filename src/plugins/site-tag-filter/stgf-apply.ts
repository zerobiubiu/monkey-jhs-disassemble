/**
 * 站点原生卡片标签筛选应用 —— 按当前激活芯片维护 `data-site-tag-hidden` 标记。
 *
 * - 无激活芯片：移除本筛选器标记并按多栏交集恢复显隐（不恢复基础屏蔽或其他栏隐藏）。
 * - 激活芯片：OR 逻辑，命中任一选中原生标签或「无标签」即保留显示。
 * - 协同安全：通过 `reconcileFilterVisibility` 与清单/状态/预加载栏精确组成交集。
 */
import type { FilterScope } from '../../types/filter-scope';

import {
    isHiddenByUnknownScript,
    queryFilterControls,
    queryFilterItems,
    reconcileFilterVisibility
} from '../../core/util/site/filter-scope';

import {
    getItemNativeTags,
    SITE_TAG_HIDDEN_ATTR,
    SITE_TAG_NO_TAG_VALUE
} from './stgf-collect';

const JHS_HIDE_ATTR = 'data-hide';

/**
 * 应用当前原生标签筛选到指定作用域（默认为主列表）。
 *
 * @param scope 可选：独立筛选作用域（如首页推荐浮层）
 */
export function applySiteTagFilter(scope?: FilterScope): void {
    const activeChips = queryFilterControls('.jhs-site-tag-filter-chip.active', scope);
    const selectedValues = new Set(
        Array.from(activeChips, (chip: Element) => (chip as HTMLElement).dataset.value ?? '').filter(Boolean)
    );

    if (selectedValues.size === 0) {
        queryFilterItems(scope, `[${SITE_TAG_HIDDEN_ATTR}]`).forEach((item: Element) => {
            item.removeAttribute(SITE_TAG_HIDDEN_ATTR);
            reconcileFilterVisibility(item);
        });
        return;
    }

    const showNoTag = selectedValues.has(SITE_TAG_NO_TAG_VALUE);
    const selectedTags = new Set([...selectedValues].filter((value) => value !== SITE_TAG_NO_TAG_VALUE));

    queryFilterItems(scope).forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        if (!scope && (htmlItem.hasAttribute(JHS_HIDE_ATTR) || isHiddenByUnknownScript(htmlItem))) {
            return;
        }

        const itemTags = getItemNativeTags(item);
        const tagMatch = selectedTags.size > 0 && [...selectedTags].some((tag) => itemTags.has(tag));
        const noTagMatch = showNoTag && itemTags.size === 0;
        const shouldShow = tagMatch || noTagMatch;

        htmlItem.toggleAttribute(SITE_TAG_HIDDEN_ATTR, !shouldShow);
        reconcileFilterVisibility(htmlItem);
    });
}
