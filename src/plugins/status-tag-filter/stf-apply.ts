/**
 * 筛选应用 —— 从 status-tag-filter-plugin.ts 拆出的 applyFilter 方法。
 *
 * 根据当前包含/排除芯片维护 `data-status-tag-hidden` 标记。协同安全：被 jhs 或其他脚本
 * 隐藏的卡片不纳入管理（doc/48 增强：检查 data-hide 属性）。
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

import { JHS_HIDE_ATTR, NO_TAG_VALUE, STATUS_TAG_SELECTOR } from './stf-collect';
import { getItemCarNum, getScore, parseScoreChipValue } from './stf-score';

/** 标记本脚本隐藏的卡片（与 jhs 的 data-hide 区分，协同安全设计）。 */
const HIDDEN_ATTR = 'data-status-tag-hidden';

/**
 * 应用状态/星级筛选：根据当前包含与排除芯片显示/隐藏 .item 元素。
 *
 * 规则：
 * - 无任何包含/排除芯片：仅恢复本脚本隐藏的卡片（不触碰其他脚本已隐藏的）
 * - 命中任意排除芯片（状态标签 / 无状态标签 / 星级）→ 隐藏
 * - 存在包含芯片时，命中任一包含芯片即显示（OR）
 */
export function applyFilter(scope?: FilterScope): void {
    const selections = readFilterSelections(
        queryFilterControls('.status-tag-filter-chip', scope),
        'active'
    );

    if (!hasActiveSelections(selections)) {
        queryFilterItems(scope, scope ? '' : `[${HIDDEN_ATTR}]`).forEach((item: Element) => {
            const htmlItem = item as HTMLElement;
            htmlItem.removeAttribute(HIDDEN_ATTR);
            reconcileFilterVisibility(htmlItem);
        });
        return;
    }

    queryFilterItems(scope).forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        const hiddenByJhs = htmlItem.hasAttribute(JHS_HIDE_ATTR);
        if (!scope && (hiddenByJhs || isHiddenByUnknownScript(htmlItem))) return;

        const itemStatusTags = new Set<string>();
        item.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
            const text = el.textContent?.trim() || '';
            if (text) itemStatusTags.add(text);
        });

        let cachedScore: number | null | undefined;
        const getItemScore = (): number | null => {
            if (cachedScore === undefined) {
                cachedScore = getScore(getItemCarNum(item));
            }
            return cachedScore;
        };

        const shouldShow = matchesIncludeExclude(selections, (values) => {
            for (const value of values) {
                if (value === NO_TAG_VALUE) {
                    if (itemStatusTags.size === 0) return true;
                    continue;
                }
                const score = parseScoreChipValue(value);
                if (score !== null) {
                    if (getItemScore() === score) return true;
                    continue;
                }
                if (itemStatusTags.has(value)) return true;
            }
            return false;
        });

        htmlItem.toggleAttribute(HIDDEN_ATTR, !shouldShow);
        reconcileFilterVisibility(htmlItem);
    });
}
