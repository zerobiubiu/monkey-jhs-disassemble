/**
 * 筛选栏 UI —— 从 status-tag-filter-plugin.ts 拆出的 UI 构建方法。
 *
 * 接入 `core/util/site/filter-chips.ts` 共享三态交互（左键包含 / 右键排除 /
 * 双击单选本栏 / 空白区双击清空）。
 */
import {
    bindFilterBarInteraction,
    collectChipStates,
    getChipState,
    initFilterChip,
    type ChipFilterState
} from '../../core/util/site/filter-chips';
import {
    FILTER_BAR_PRIORITY,
    applyListMountPoint,
    type ListMountPoint
} from '../../core/util/site/list-mount';
import { mountScopedFilterBar, queryFilterControls } from '../../core/util/site/filter-scope';

import type { FilterScope } from '../../types/filter-scope';

import { collectStatusTagCounts, countNoStatusItems, NO_TAG_VALUE } from './stf-collect';
import { applyFilter } from './stf-apply';
import {
    SCORE_VALUE_PREFIX,
    countWatchedByScore,
    formatScoreLabel,
    visibleScoreChips
} from './stf-score';

/** 日志前缀。 */
export const LOG = '[状态标签筛选]';

const CHIP_SELECTOR = '.status-tag-filter-chip';
const INCLUDE_CLASS = 'active';

/** 协调器持有各自筛选栏引用，只刷新对应范围的芯片。 */
export interface StatusFilterBar extends HTMLDivElement {
    _refreshChips: () => void;
}

/**
 * 创建单个状态筛选芯片。
 *
 * @param labelText 芯片文本
 * @param value 芯片值（标签文本、星级键或 'no-tag'）
 * @param opts 选项（isNoTag/count/state）
 * @returns 芯片 span 元素
 */
export function createFilterChip(
    labelText: string,
    value: string,
    opts: { isNoTag?: boolean; count?: number; state?: ChipFilterState } = {}
): HTMLSpanElement {
    const { isNoTag = false, count, state = 'none' } = opts;
    const chip = document.createElement('span');
    chip.className = 'status-tag-filter-chip';
    if (isNoTag) chip.classList.add('no-status');
    chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
    chip.dataset.value = value;
    if (count !== undefined) chip.dataset.count = String(count);
    initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
    return chip;
}

/**
 * 构建状态筛选栏并按优先级挂载。
 * 内部定义 refreshChips（收集 status-tag 与星级并重建芯片，保留包含/排除状态）。
 *
 * @param mount 可选：直挂点（超时兜底用）；缺省则按优先级入栈（doc/50）
 * @param scope 可选：推荐等独立卡片区域；省略时只操作主页面筛选栏
 */
export function doBuild(mount?: ListMountPoint, scope?: FilterScope): StatusFilterBar | undefined {
    const existing = queryFilterControls<StatusFilterBar>('.status-tag-filter-bar', scope)[0];
    if (existing) return existing;

    const filterBar = document.createElement('div') as StatusFilterBar;
    filterBar.className = 'status-tag-filter-bar';
    if (scope) filterBar.dataset.jhsFilterScope = 'status';

    const label = document.createElement('span');
    label.className = 'status-tag-filter-label';
    label.textContent = '\u72B6\u6001:'; // 状态:
    filterBar.appendChild(label);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'status-tag-filter-chips';
    filterBar.appendChild(chipsContainer);

    const refreshChips = (): void => {
        const savedStates = collectChipStates(chipsContainer, CHIP_SELECTOR, INCLUDE_CLASS);
        const selectedKeys = new Set(savedStates.keys());

        chipsContainer.innerHTML = '';

        // "无状态标签" 芯片（始终在第一位，带计数）
        const noCount = countNoStatusItems(scope);
        const noTagChip = createFilterChip('无状态标签', NO_TAG_VALUE, {
            isNoTag: true,
            count: noCount,
            state: savedStates.get(NO_TAG_VALUE) ?? 'none'
        });
        chipsContainer.appendChild(noTagChip);

        // 各状态标签芯片（根据页面实际内容动态生成，带计数）
        const allCounts = collectStatusTagCounts(scope);
        const tagNames = new Set(Object.keys(allCounts));
        if (scope) {
            selectedKeys.forEach((value) => {
                if (value !== NO_TAG_VALUE && !value.startsWith(SCORE_VALUE_PREFIX)) tagNames.add(value);
            });
        }
        const sortedTags = Array.from(tagNames).sort();
        sortedTags.forEach((tagName: string) => {
            const chip = createFilterChip(tagName, tagName, {
                count: allCounts[tagName] ?? 0,
                state: savedStates.get(tagName) ?? 'none'
            });
            chipsContainer.appendChild(chip);
        });

        // 已读星级芯片（doc/24）：保留有计数或处于包含/排除态的档位
        const scoreCounts = countWatchedByScore(scope);
        visibleScoreChips(scoreCounts, selectedKeys).forEach((score: number) => {
            const value = `${SCORE_VALUE_PREFIX}${score}`;
            const chip = createFilterChip(formatScoreLabel(score), value, {
                count: scoreCounts[score] ?? 0,
                state: savedStates.get(value) ?? 'none'
            });
            chip.classList.add('score-chip');
            chipsContainer.appendChild(chip);
        });
    };

    bindFilterBarInteraction(filterBar, {
        chipSelector: CHIP_SELECTOR,
        includeClass: INCLUDE_CLASS,
        onChange: () => {
            applyFilter(scope);
            const hasInactiveZeroChip = Array.from(
                chipsContainer.querySelectorAll<HTMLElement>(`${CHIP_SELECTOR}[data-count="0"]`)
            ).some(
                (el) =>
                    el.dataset.value !== NO_TAG_VALUE &&
                    getChipState(el, INCLUDE_CLASS) === 'none'
            );
            if (hasInactiveZeroChip) refreshChips();
        },
        onRefresh: refreshChips
    });

    refreshChips();

    // 入栈（顺序权威=优先级）；无锚点时的超时兜底才走直挂
    if (scope) mountScopedFilterBar(filterBar, FILTER_BAR_PRIORITY.status, scope);
    else if (mount) applyListMountPoint(mount, filterBar);
    else if (!mountScopedFilterBar(filterBar, FILTER_BAR_PRIORITY.status)) return undefined;

    filterBar._refreshChips = refreshChips;

    console.log(`${LOG} 筛选栏已挂载`);
    return filterBar;
}
