/**
 * 标签筛选应用逻辑 —— 三态（包含/排除）筛选执行 + 标签统计。
 *
 * 提取自 vlt-filter-bar.ts：
 * - applyFilter：按芯片三态应用筛选（左键包含 OR / 右键排除 NOR / 同栏混选为包含且不命中排除）
 * - collectAllUniqueTags：收集所有唯一标签名
 * - collectTagCounts：收集标签计数
 * - countNoTagItems：计算无标签卡片数
 */
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
import type { FilterScope } from '../../types/filter-scope';

import type { VltTags } from './vlt-tags';

/** 标记本脚本隐藏的卡片（与其他脚本的 hidden 属性区分，协同安全设计）。 */
export const TAG_HIDDEN_ATTR = 'data-video-lists-tag-hidden';

/** 收集页面上所有唯一的标签名称（排除占位符）。 */
export function collectAllUniqueTags(scope?: FilterScope): string[] {
    return Object.keys(collectTagCounts(scope)).sort();
}

/** 收集每个标签的出现次数（排除占位符）。 */
export function collectTagCounts(scope?: FilterScope): Record<string, number> {
    const counts: Record<string, number> = {};
    const tags = new Set<Element>();
    queryFilterItems(scope).forEach((item) => {
        item.querySelectorAll(".jhs-vlt-tag-link:not([style*='pointer-events: none'])").forEach((el) => tags.add(el));
    });
    tags.forEach((el) => {
        const name = el.textContent?.trim() || '';
        if (name && name !== '\u2014') {
            counts[name] = (counts[name] || 0) + 1;
        }
    });
    return counts;
}

/** 计算无标签的卡片数（排除占位符，仅有占位符的卡片计为无标签）。 */
export function countNoTagItems(scope?: FilterScope): number {
    let count = 0;
    queryFilterItems(scope).forEach((item: Element) => {
        const links = item.querySelectorAll(
            ".jhs-vlt-tag-link:not([style*='pointer-events: none'])"
        );
        if (links.length === 0) count++;
    });
    return count;
}

/**
 * 应用当前清单标签筛选。
 *
 * 规则：
 * - 无包含也无排除条件：仅恢复本脚本隐藏的卡片，同时尊重其他筛选栏与基础屏蔽的交集标记；
 * - 命中任意排除项（含「无标签」排除）→ 隐藏；
 * - 存在包含项时，命中任一包含项（含「无标签」包含）才显示。
 */
export function applyFilter(plugin: VltTags): void {
    const scope = plugin.filterScope;
    const selections = readFilterSelections(
        queryFilterControls('.jhs-vlt-filter-chip', scope),
        'jhs-vlt-active'
    );

    if (!hasActiveSelections(selections)) {
        queryFilterItems(scope, `[${TAG_HIDDEN_ATTR}]`).forEach((item: Element) => {
            (item as HTMLElement).removeAttribute(TAG_HIDDEN_ATTR);
            reconcileFilterVisibility(item);
        });
        return;
    }

    queryFilterItems(scope).forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        // 协同安全：基础屏蔽与未知外部脚本隐藏的卡片不纳入管理；已知筛选栏走交集标记
        if (!scope && (htmlItem.hasAttribute('data-hide') || isHiddenByUnknownScript(htmlItem))) return;

        const tagLinks = item.querySelectorAll(
            ".jhs-vlt-tag-link:not([style*='pointer-events: none'])"
        );
        const itemTagNames = new Set(
            Array.from(tagLinks).map((el: Element) => el.textContent?.trim() || '')
        );

        const shouldShow = matchesIncludeExclude(selections, (values) => {
            if (values.has('no-tag') && itemTagNames.size === 0) return true;
            for (const value of values) {
                if (value !== 'no-tag' && itemTagNames.has(value)) return true;
            }
            return false;
        });

        htmlItem.toggleAttribute(TAG_HIDDEN_ATTR, !shouldShow);
        reconcileFilterVisibility(htmlItem);
    });
}
