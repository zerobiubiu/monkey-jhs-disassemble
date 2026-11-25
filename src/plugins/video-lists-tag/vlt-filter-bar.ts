/**
 * 标签筛选栏模块 —— 筛选栏构建、三态芯片管理与动态刷新。
 *
 * 筛选执行与标签统计已拆分至 vlt-filter-apply.ts；
 * 交互手势（左键包含 / 右键排除 / 双击单选 / 空白双击清空）由 `core/util/site/filter-chips.ts` 统一托管。
 * 已移除筛选模式下拉与自动刷新开关（自动刷新永久生效）。
 */
import {
    bindFilterBarInteraction,
    collectChipStates,
    getChipState,
    initFilterChip,
    type ChipFilterState
} from '../../core/util/site/filter-chips';
import { queryFilterControls, mountScopedFilterBar } from '../../core/util/site/filter-scope';
import { FILTER_BAR_PRIORITY, ensureFilterStack } from '../../core/util/site/list-mount';

import type { VltTags } from './vlt-tags';
import {
    applyFilter,
    collectAllUniqueTags,
    collectTagCounts,
    countNoTagItems,
    TAG_HIDDEN_ATTR
} from './vlt-filter-apply';

export { applyFilter, collectAllUniqueTags, collectTagCounts, countNoTagItems, TAG_HIDDEN_ATTR };

const CHIP_SELECTOR = '.jhs-vlt-filter-chip';
const INCLUDE_CLASS = 'jhs-vlt-active';

/** DOM 扩展：筛选栏挂载 refreshChips 闭包。 */
interface FilterBarEl extends HTMLDivElement {
    _refreshChips?: () => void;
}

/**
 * 创建单个筛选芯片。
 *
 * @param labelText 芯片文本
 * @param value 芯片值（标签名或 'no-tag'）
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
    chip.className = 'jhs-vlt-filter-chip';
    if (isNoTag) chip.classList.add('jhs-vlt-no-tag');
    chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
    chip.dataset.value = value;
    if (count !== undefined) chip.dataset.count = String(count);
    initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
    return chip;
}

/**
 * 刷新芯片列表，保留当前包含与排除状态。
 *
 * @param plugin VltTags 实例
 * @param chipsContainer 芯片容器元素
 */
export function refreshChips(plugin: VltTags, chipsContainer: HTMLElement): void {
    const savedStates = collectChipStates(chipsContainer, CHIP_SELECTOR, INCLUDE_CLASS);

    chipsContainer.innerHTML = '';
    const allCounts = collectTagCounts(plugin.filterScope);

    // "无标签" 芯片（带计数）
    const noCount = countNoTagItems(plugin.filterScope);
    const noTagChip = createFilterChip('无标签', 'no-tag', {
        isNoTag: true,
        count: noCount,
        state: savedStates.get('no-tag') ?? 'none'
    });
    chipsContainer.appendChild(noTagChip);

    // 各标签芯片（带计数），已激活/已排除的零计数标签继续保留直到取消
    const sortedTags = [...new Set(
        [...collectAllUniqueTags(plugin.filterScope), ...savedStates.keys()].filter((value) => value !== 'no-tag')
    )].sort();
    sortedTags.forEach((tagName: string) => {
        const chip = createFilterChip(tagName, tagName, {
            count: allCounts[tagName] ?? 0,
            state: savedStates.get(tagName) ?? 'none'
        });
        chipsContainer.appendChild(chip);
    });
}

/**
 * 构建清单标签筛选栏并按优先级入栈。
 *
 * @param plugin VltTags 实例
 */
export function buildFilterBar(plugin: VltTags): void {
    if (queryFilterControls('.jhs-vlt-filter-bar', plugin.filterScope).length) return;

    // 入栈（顺序权威=优先级，doc/50）：无可用锚点时不建栏
    if (!plugin.filterScope && !ensureFilterStack()) return;

    const filterBar = document.createElement('div') as FilterBarEl;
    filterBar.className = 'jhs-vlt-filter-bar';

    const label = document.createElement('span');
    label.className = 'jhs-vlt-filter-label';
    label.textContent = '筛选:';
    filterBar.appendChild(label);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'jhs-vlt-filter-chips';
    filterBar.appendChild(chipsContainer);

    const boundRefreshChips = (): void => refreshChips(plugin, chipsContainer);

    bindFilterBarInteraction(filterBar, {
        chipSelector: CHIP_SELECTOR,
        includeClass: INCLUDE_CLASS,
        onChange: () => {
            applyFilter(plugin);
            const hasInactiveZeroTag = Array.from(
                chipsContainer.querySelectorAll<HTMLElement>(`${CHIP_SELECTOR}[data-count="0"]`)
            ).some(
                (el) =>
                    el.dataset.value !== 'no-tag' &&
                    getChipState(el, INCLUDE_CLASS) === 'none'
            );
            if (hasInactiveZeroTag) boundRefreshChips();
        },
        onRefresh: boundRefreshChips
    });

    boundRefreshChips();

    // 按优先级入栈：顺序与挂载先后无关（doc/50）
    mountScopedFilterBar(filterBar, FILTER_BAR_PRIORITY.vlt, plugin.filterScope);

    filterBar._refreshChips = boundRefreshChips;
}

/**
 * 更新筛选栏芯片并重新应用筛选。
 *
 * @param plugin VltTags 实例
 */
export function updateFilterBar(plugin: VltTags): void {
    const filterBar = queryFilterControls<FilterBarEl>('.jhs-vlt-filter-bar', plugin.filterScope)[0];
    if (filterBar && filterBar._refreshChips) {
        filterBar._refreshChips();
        applyFilter(plugin);
    }
}
