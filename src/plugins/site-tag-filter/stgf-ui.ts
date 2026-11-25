/**
 * 站点原生卡片标签筛选栏 UI —— 按页面实际内容实时渲染芯片，无预设标签。
 *
 * - 空态克制：当前页面不存在任何原生标签且无已选/已排除芯片时，不挂载空栏。
 * - 动态保活：页面追加新卡片或标签变化时刷新芯片并保留包含与排除状态；计数归零时
 *   仍保留零计数芯片以便取消，取消后再自动清理过期芯片或空栏。
 * - 三态交互（左键包含 / 右键排除 / 双击单选本栏 / 空白区双击清空）由 `filter-chips.ts` 托管。
 */
import type { FilterScope } from '../../types/filter-scope';

import {
    bindFilterBarInteraction,
    collectChipStates,
    getChipState,
    initFilterChip,
    type ChipFilterState
} from '../../core/util/site/filter-chips';
import { mountScopedFilterBar, queryFilterControls } from '../../core/util/site/filter-scope';
import { FILTER_BAR_PRIORITY, ensureFilterStack } from '../../core/util/site/list-mount';

import { applySiteTagFilter } from './stgf-apply';
import {
    collectSiteTagCounts,
    countNoSiteTagItems,
    SITE_TAG_NO_TAG_VALUE
} from './stgf-collect';

const CHIP_SELECTOR = '.jhs-site-tag-filter-chip';
const INCLUDE_CLASS = 'active';

/** 筛选栏 DOM 扩展：挂载实时刷新闭包。 */
export interface SiteTagFilterBar extends HTMLDivElement {
    _refreshChips: () => void;
}

/**
 * 创建单个原生标签筛选芯片按钮。
 *
 * @param labelText 芯片显示文案
 * @param value 芯片语义值（标签文本或 'no-tag'）
 * @param opts 展示与三态选项
 */
export function createSiteTagChip(
    labelText: string,
    value: string,
    opts: { isNoTag?: boolean; count: number; state?: ChipFilterState }
): HTMLButtonElement {
    const { isNoTag = false, count, state = 'none' } = opts;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'jhs-site-tag-filter-chip';
    if (isNoTag) chip.classList.add('is-no-tag');
    chip.dataset.value = value;
    chip.dataset.count = String(count);
    chip.textContent = `${labelText} ${count}`;
    initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
    return chip;
}

/**
 * 构建并按优先级挂载原生标签筛选栏。
 * 若当前范围不存在任何原生标签，则不创建空栏并返回 undefined。
 *
 * @param scope 可选：独立筛选作用域；省略时挂入主列表 `jhs-filter-stack`
 */
export function buildSiteTagFilterBar(scope?: FilterScope): SiteTagFilterBar | undefined {
    const existing = queryFilterControls<SiteTagFilterBar>('.jhs-site-tag-filter-bar', scope)[0];
    if (existing) return existing;

    const initialCounts = collectSiteTagCounts(scope);
    if (Object.keys(initialCounts).length === 0) return undefined;
    if (!scope && !ensureFilterStack()) return undefined;

    const filterBar = document.createElement('div') as SiteTagFilterBar;
    filterBar.className = 'jhs-site-tag-filter-bar';
    if (scope) filterBar.dataset.jhsFilterScope = 'site-tag';

    const label = document.createElement('span');
    label.className = 'jhs-site-tag-filter-label';
    label.textContent = '标签:';
    filterBar.appendChild(label);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'jhs-site-tag-filter-chips';
    chipsContainer.setAttribute('role', 'group');
    chipsContainer.setAttribute('aria-label', '影片原生标签筛选');
    filterBar.appendChild(chipsContainer);

    const refreshChips = (): void => {
        const savedStates = collectChipStates(chipsContainer, CHIP_SELECTOR, INCLUDE_CLASS);

        const allCounts = collectSiteTagCounts(scope);
        const noCount = countNoSiteTagItems(scope);
        const tagNames = new Set(Object.keys(allCounts));
        savedStates.forEach((_state, value) => {
            if (value !== SITE_TAG_NO_TAG_VALUE) tagNames.add(value);
        });

        // 既无实时原生标签、又无已选/已排除筛选时，移除空栏避免占空位
        if (tagNames.size === 0 && savedStates.size === 0) {
            chipsContainer.replaceChildren();
            filterBar.remove();
            return;
        }

        const fragment = document.createDocumentFragment();
        const showNoTagChip = noCount > 0 || savedStates.has(SITE_TAG_NO_TAG_VALUE);
        if (showNoTagChip) {
            fragment.appendChild(
                createSiteTagChip('无标签', SITE_TAG_NO_TAG_VALUE, {
                    isNoTag: true,
                    count: noCount,
                    state: savedStates.get(SITE_TAG_NO_TAG_VALUE) ?? 'none'
                })
            );
        }

        const sortedTags = Array.from(tagNames).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        sortedTags.forEach((tagName) => {
            fragment.appendChild(
                createSiteTagChip(tagName, tagName, {
                    count: allCounts[tagName] ?? 0,
                    state: savedStates.get(tagName) ?? 'none'
                })
            );
        });

        chipsContainer.replaceChildren(fragment);
    };

    bindFilterBarInteraction(filterBar, {
        chipSelector: CHIP_SELECTOR,
        includeClass: INCLUDE_CLASS,
        onChange: () => {
            applySiteTagFilter(scope);
            const hasInactiveZero = Array.from(
                chipsContainer.querySelectorAll<HTMLElement>(`${CHIP_SELECTOR}[data-count="0"]`)
            ).some((el) => getChipState(el, INCLUDE_CLASS) === 'none');
            if (hasInactiveZero) refreshChips();
        },
        onRefresh: refreshChips
    });

    refreshChips();
    if (!mountScopedFilterBar(filterBar, FILTER_BAR_PRIORITY.siteTag, scope)) return undefined;
    filterBar._refreshChips = refreshChips;
    return filterBar;
}

/**
 * 实时刷新原生标签筛选栏：已挂载则更新芯片并重算筛选；未挂载时若页面已出现原生标签则立即挂载。
 *
 * @param scope 可选：独立筛选作用域
 */
export function refreshSiteTagFilterBar(scope?: FilterScope): void {
    const filterBar = queryFilterControls<SiteTagFilterBar>('.jhs-site-tag-filter-bar', scope)[0];
    if (filterBar?._refreshChips) {
        filterBar._refreshChips();
        applySiteTagFilter(scope);
        return;
    }
    buildSiteTagFilterBar(scope);
}
