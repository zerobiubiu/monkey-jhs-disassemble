import type { FilterScope } from '../../../types/filter-scope';

import { mountFilterBar } from './list-mount';
import { siteSelector } from './selectors';

/** 默认只查主页面控件，避免浮层的 active 芯片或筛选栏串入主流。 */
export function queryFilterControls<T extends Element = HTMLElement>(selector: string, scope?: FilterScope): NodeListOf<T> {
    return (scope?.root ?? document).querySelectorAll<T>(
        scope ? selector : `${selector}:not([data-jhs-filter-scope], [data-jhs-filter-scope] *)`
    );
}

const HIDDEN_ATTRIBUTES = [
    'data-hide', 'data-lrs-hidden', 'data-status-tag-hidden', 'data-video-lists-tag-hidden', 'data-preload-hidden'
];

/** 已知隐藏标记的合并结果，供同一区域的多栏筛选组成交集。 */
export function hasFilterHiddenMarker(item: Element): boolean {
    return HIDDEN_ATTRIBUTES.some((attribute) => item.hasAttribute(attribute));
}

/** 每栏只维护自己的标记，最终显隐不能清除另一栏或基础屏蔽的决定。 */
export function reconcileFilterVisibility(item: Element): void {
    (item as HTMLElement).style.display = hasFilterHiddenMarker(item) ? 'none' : '';
}

/** 卡片查询共用一处范围规则，默认继续使用主列表筛选范围。 */
export function queryFilterItems<T extends Element = HTMLElement>(scope?: FilterScope, suffix = ''): NodeListOf<T> {
    return (scope?.root ?? document).querySelectorAll<T>(`${scope?.itemSelector ?? siteSelector('filterItem')}${suffix}`);
}

/** 保留主页面顺序权威，浮层中的三栏也按相同优先级排列。 */
export function mountScopedFilterBar(bar: HTMLElement, priority: number, scope?: FilterScope): boolean {
    if (!scope) return mountFilterBar(bar, priority);
    bar.dataset.jhsFilterScope ||= 'local';
    bar.dataset.jhsFilterPriority = String(priority);
    const next = Array.from(scope.mount.children).find(
        (child) => Number((child as HTMLElement).dataset.jhsFilterPriority ?? 0) > priority
    );
    scope.mount.insertBefore(bar, next ?? null);
    return true;
}
