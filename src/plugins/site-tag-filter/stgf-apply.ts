/**
 * 站点原生卡片标签筛选应用 —— 按当前包含/排除芯片维护 `data-site-tag-hidden` 标记。
 *
 * - 无包含也无排除芯片：移除本筛选器标记并按多栏交集恢复显隐（不恢复基础屏蔽或其他栏隐藏）。
 * - 命中任意排除芯片（原生标签 / 无标签）→ 隐藏；存在包含芯片时命中任一即显示（OR）。
 * - 协同安全：通过 `reconcileFilterVisibility` 与清单/状态/预加载栏精确组成交集。
 */
import type { FilterScope } from '../../types/filter-scope';

import {
    hasActiveSelections,
    matchesIncludeExclude,
    readFilterSelections
} from '../../core/util/site/filter-chips';
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
    const selections = readFilterSelections(
        queryFilterControls('.jhs-site-tag-filter-chip', scope),
        'active'
    );

    if (!hasActiveSelections(selections)) {
        queryFilterItems(scope, `[${SITE_TAG_HIDDEN_ATTR}]`).forEach((item: Element) => {
            item.removeAttribute(SITE_TAG_HIDDEN_ATTR);
            reconcileFilterVisibility(item);
        });
        return;
    }

    queryFilterItems(scope).forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        if (!scope && (htmlItem.hasAttribute(JHS_HIDE_ATTR) || isHiddenByUnknownScript(htmlItem))) {
            return;
        }

        const itemTags = getItemNativeTags(item);
        const shouldShow = matchesIncludeExclude(selections, (values) => {
            if (values.has(SITE_TAG_NO_TAG_VALUE) && itemTags.size === 0) return true;
            for (const value of values) {
                if (value !== SITE_TAG_NO_TAG_VALUE && itemTags.has(value)) return true;
            }
            return false;
        });

        htmlItem.toggleAttribute(SITE_TAG_HIDDEN_ATTR, !shouldShow);
        reconcileFilterVisibility(htmlItem);
    });
}
