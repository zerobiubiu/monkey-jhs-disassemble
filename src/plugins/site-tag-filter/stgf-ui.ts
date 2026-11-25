/**
 * 站点原生卡片标签筛选栏 UI —— 按页面实际内容实时渲染芯片，无预设标签。
 *
 * - 空态克制：当前页面不存在任何原生标签且无已激活芯片时，不挂载空栏。
 * - 动态保活：页面追加新卡片或标签变化时刷新芯片并保留已激活状态；已选中标签计数归零时
 *   仍保留零计数芯片以便取消，取消后再自动清理过期芯片或空栏。
 */
import type { FilterScope } from '../../types/filter-scope';

import { mountScopedFilterBar, queryFilterControls } from '../../core/util/site/filter-scope';
import { FILTER_BAR_PRIORITY, ensureFilterStack } from '../../core/util/site/list-mount';

import { applySiteTagFilter } from './stgf-apply';
import {
    collectSiteTagCounts,
    countNoSiteTagItems,
    SITE_TAG_NO_TAG_VALUE
} from './stgf-collect';

/** 筛选栏 DOM 扩展：挂载实时刷新闭包。 */
export interface SiteTagFilterBar extends HTMLDivElement {
    _refreshChips: () => void;
}

/**
 * 创建单个原生标签筛选芯片按钮。
 *
 * @param labelText 芯片显示文案
 * @param value 芯片语义值（标签文本或 'no-tag'）
 * @param opts 展示与交互选项
 * @param scope 可选：独立筛选作用域
 */
export function createSiteTagChip(
    labelText: string,
    value: string,
    opts: { isNoTag?: boolean; count: number; active?: boolean; onDeactivateZero?: () => void },
    scope?: FilterScope
): HTMLButtonElement {
    const { isNoTag = false, count, active = false, onDeactivateZero } = opts;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'jhs-site-tag-filter-chip';
    if (isNoTag) chip.classList.add('is-no-tag');
    if (active) chip.classList.add('active');
    chip.dataset.value = value;
    chip.dataset.count = String(count);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    chip.textContent = `${labelText} ${count}`;

    chip.addEventListener('click', () => {
        const nextActive = chip.classList.toggle('active');
        chip.setAttribute('aria-pressed', nextActive ? 'true' : 'false');
        applySiteTagFilter(scope);
        // 取消已归零的残留芯片后，触发一次清理刷新（移除过期的 0 计数芯片或空栏）
        if (!nextActive && Number(chip.dataset.count) === 0) {
            onDeactivateZero?.();
        }
    });

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
        const activeValues = new Set(
            Array.from(
                chipsContainer.querySelectorAll('.jhs-site-tag-filter-chip.active'),
                (chip: Element) => (chip as HTMLElement).dataset.value ?? ''
            ).filter(Boolean)
        );

        const allCounts = collectSiteTagCounts(scope);
        const noCount = countNoSiteTagItems(scope);
        const tagNames = new Set(Object.keys(allCounts));
        activeValues.forEach((value) => {
            if (value !== SITE_TAG_NO_TAG_VALUE) tagNames.add(value);
        });

        // 既无实时原生标签、又无已激活筛选时，移除空栏避免占空位
        if (tagNames.size === 0 && activeValues.size === 0) {
            chipsContainer.replaceChildren();
            filterBar.remove();
            return;
        }

        const fragment = document.createDocumentFragment();
        const showNoTagChip = noCount > 0 || activeValues.has(SITE_TAG_NO_TAG_VALUE);
        if (showNoTagChip) {
            fragment.appendChild(
                createSiteTagChip(
                    '无标签',
                    SITE_TAG_NO_TAG_VALUE,
                    {
                        isNoTag: true,
                        count: noCount,
                        active: activeValues.has(SITE_TAG_NO_TAG_VALUE),
                        onDeactivateZero: refreshChips
                    },
                    scope
                )
            );
        }

        const sortedTags = Array.from(tagNames).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        sortedTags.forEach((tagName) => {
            fragment.appendChild(
                createSiteTagChip(
                    tagName,
                    tagName,
                    {
                        count: allCounts[tagName] ?? 0,
                        active: activeValues.has(tagName),
                        onDeactivateZero: refreshChips
                    },
                    scope
                )
            );
        });

        chipsContainer.replaceChildren(fragment);
    };

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
