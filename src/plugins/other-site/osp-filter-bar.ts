import type { FilterScope } from '../../types/filter-scope';

import {
    bindFilterBarInteraction,
    collectChipStates,
    hasActiveSelections,
    initFilterChip,
    matchesIncludeExclude,
    readFilterSelections
} from '../../core/util/site/filter-chips';
import {
    isHiddenByUnknownScript,
    mountScopedFilterBar,
    queryFilterControls,
    queryFilterItems,
    reconcileFilterVisibility
} from '../../core/util/site/filter-scope';
import { FILTER_BAR_PRIORITY, ensureFilterStack } from '../../core/util/site/list-mount';
import { siteSelector } from '../../core/util/site/selectors';

import type { OtherSitePlugin } from '../other-site-plugin';
import { getItemPreloadStatus } from './osp-helpers';
import { PRELOAD_QUEUE_TOGGLE_EVENT } from '../list-page/lp-batch';
import { togglePreloadQueuePanel } from './osp-preload-panel';

/**
 * 筛选栏芯片定义（固定 4 档：排队中/请求中/成功匹配/匹配失败）。
 */
export const PRELOAD_CHIPS: { value: string; label: string }[] = [
    { value: 'queued', label: '排队中' },
    { value: 'requesting', label: '请求中' },
    { value: 'success', label: '成功匹配' },
    { value: 'failed', label: '匹配失败' }
];

/** 本插件隐藏卡片使用的属性（与其他筛选插件协同安全，各占一属性）。 */
export const PRELOAD_HIDDEN_ATTR = 'data-preload-hidden';

/**
 * 其他筛选/隐藏插件使用的隐藏属性集合。本插件 collectPreloadCounts 跳过带这些属性的卡片，
 * 计数只反映实际可见卡片。
 */
export const OTHER_HIDDEN_ATTRS = [
    'data-hide',
    'data-lrs-hidden',
    'data-status-tag-hidden',
    'data-video-lists-tag-hidden',
    'data-site-tag-hidden'
];

const CHIP_SELECTOR = '.preload-filter-chip';
const INCLUDE_CLASS = 'active';

/** 每个 DOM 筛选栏保留自己的刷新闭包，不共享选中状态或防抖计时器。 */
const barRefreshers = new WeakMap<Element, { plugin: OtherSitePlugin; refresh: () => void }>();
const queueToggleBound = new WeakSet<OtherSitePlugin>();

/**
 * 初始化预加载筛选栏：立即尝试挂载，挂载目标未就绪则用 observer 重试。
 */
export function initFilterBar(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    if (tryBuildFilterBar(plugin)) return;
    let retries = 0;
    plugin.filterBarObserver = plugin.supervisor.observe(document.body, () => {
        if (queryFilterControls('.preload-filter-bar').length) {
            plugin.filterBarObserver?.disconnect();
            plugin.filterBarObserver = null;
            return;
        }
        if (tryBuildFilterBar(plugin) || ++retries > 50) {
            plugin.filterBarObserver?.disconnect();
            plugin.filterBarObserver = null;
        }
    }, { childList: true, subtree: true });
    plugin.supervisor.setTimeout(() => {
        plugin.filterBarObserver?.disconnect();
        plugin.filterBarObserver = null;
    }, 10000);
}

/** 尝试构建筛选栏（若已存在或无挂载目标则跳过）。@returns 是否已就绪。 */
function tryBuildFilterBar(plugin: OtherSitePlugin): boolean {
    if (queryFilterControls('.preload-filter-bar').length) return true;
    if (!ensureFilterStack()) return false;
    buildFilterBar(plugin);
    return true;
}

/**
 * 构建预加载筛选栏并按优先级入栈。
 * 接入共享三态交互（左键包含 / 右键排除 / 双击单选本栏 / 空白区双击清空）。
 */
export function buildFilterBar(plugin: OtherSitePlugin, scope?: FilterScope): HTMLElement | null {
    if (!plugin.preloadStatusEnabled || (scope && !plugin.preloadFilterReady)) return null;
    const existing = queryFilterControls<HTMLElement>('.preload-filter-bar', scope)[0];
    if (existing) return existing;
    const bar = document.createElement('div');
    bar.className = 'preload-filter-bar';

    const label = document.createElement('span');
    label.className = 'preload-filter-label';
    label.textContent = '预加载:';
    bar.appendChild(label);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'preload-filter-chips';
    bar.appendChild(chipsContainer);

    // 「请求列表」入口已移至左侧常驻竖排选择组（doc/33）：经自定义事件开关面板
    if (!scope && !queueToggleBound.has(plugin)) {
        plugin.supervisor.addEventListener(document, PRELOAD_QUEUE_TOGGLE_EVENT, () => {
            togglePreloadQueuePanel(plugin);
        });
        queueToggleBound.add(plugin);
    }

    const refreshChips = (): void => {
        const savedStates = collectChipStates(chipsContainer, CHIP_SELECTOR, INCLUDE_CLASS);
        chipsContainer.innerHTML = '';
        const counts = collectPreloadCounts(scope);
        for (const chip of PRELOAD_CHIPS) {
            const el = document.createElement('span');
            el.className = 'preload-filter-chip';
            el.dataset.value = chip.value;
            const dot = document.createElement('span');
            dot.className = 'pf-dot';
            el.appendChild(dot);
            el.appendChild(document.createTextNode(`${chip.label} ${counts[chip.value] ?? 0}`));
            initFilterChip(el, {
                includeClass: INCLUDE_CLASS,
                initialState: savedStates.get(chip.value) ?? 'none'
            });
            chipsContainer.appendChild(el);
        }
    };

    bindFilterBarInteraction(bar, {
        chipSelector: CHIP_SELECTOR,
        includeClass: INCLUDE_CLASS,
        onChange: () => applyPreloadFilter(scope),
        onRefresh: refreshChips
    });

    refreshChips();

    // 按优先级入栈：顺序由 FILTER_BAR_PRIORITY 决定（doc/50），不再各自找邻接栏
    if (!mountScopedFilterBar(bar, FILTER_BAR_PRIORITY.preload, scope)) return null;
    barRefreshers.set(bar, { plugin, refresh: refreshChips });
    return bar;
}

/**
 * 收集各预加载状态的卡片计数（排除被其他筛选/隐藏插件屏蔽的卡片）。
 */
function collectPreloadCounts(scope?: FilterScope): Record<string, number> {
    const counts: Record<string, number> = {
        queued: 0,
        requesting: 0,
        success: 0,
        failed: 0
    };
    const items = scope ? queryFilterItems(scope) : document.querySelectorAll(siteSelector('listItem'));
    items.forEach((item: Element) => {
        if (OTHER_HIDDEN_ATTRS.some((a) => item.hasAttribute(a))) return;
        const st = getItemPreloadStatus(item);
        if (st in counts) counts[st]++;
    });
    return counts;
}

/**
 * 应用预加载筛选：按包含/排除芯片维护 `data-preload-hidden` 属性并走多栏交集显隐。
 */
function applyPreloadFilter(scope?: FilterScope): void {
    const selections = readFilterSelections(
        queryFilterControls(CHIP_SELECTOR, scope),
        INCLUDE_CLASS
    );
    const HIDDEN = PRELOAD_HIDDEN_ATTR;
    const hasFilter = hasActiveSelections(selections);

    if (scope) {
        // 各栏始终独立计算自身标记，再按标记交集显示，不能因其他栏先隐藏而漏算。
        queryFilterItems<HTMLElement>(scope).forEach((item) => {
            const shouldShow =
                !hasFilter ||
                matchesIncludeExclude(selections, (values) =>
                    values.has(getItemPreloadStatus(item))
                );
            item.toggleAttribute(HIDDEN, !shouldShow);
            reconcileFilterVisibility(item);
        });
        return;
    }

    if (!hasFilter) {
        document.querySelectorAll(`${siteSelector('filterItem')}[${HIDDEN}]`).forEach((item: Element) => {
            const el = item as HTMLElement;
            el.removeAttribute(HIDDEN);
            reconcileFilterVisibility(el);
        });
        return;
    }

    document.querySelectorAll(siteSelector('listItem')).forEach((item: Element) => {
        const el = item as HTMLElement;
        // 协同安全：基础屏蔽与未知外部脚本隐藏的卡片不纳入管理；其他已知筛选栏由标记交集协调
        if (el.hasAttribute('data-hide') || isHiddenByUnknownScript(el)) return;
        const st = getItemPreloadStatus(el);
        const shouldShow = matchesIncludeExclude(selections, (values) => values.has(st));
        el.toggleAttribute(HIDDEN, !shouldShow);
        reconcileFilterVisibility(el);
    });
}

/**
 * 刷新筛选栏：重建芯片（保留包含/排除状态）+ 重新应用筛选。150ms 防抖。
 */
export function refreshFilterBar(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    clearTimeout(plugin.filterRefreshDebounce);
    plugin.filterRefreshDebounce = plugin.supervisor.setTimeout(() => {
        const bar = queryFilterControls('.preload-filter-bar')[0];
        const refresher = bar && barRefreshers.get(bar);
        if (refresher) {
            refresher.refresh();
            applyPreloadFilter();
        }
    }, 150);
}

/** 立即刷新指定浮层筛选栏；不占用主页面预加载筛选的防抖计时器。 */
export function refreshScopedPreloadFilter(scope: FilterScope): void {
    const bar = queryFilterControls('.preload-filter-bar', scope)[0];
    const refresher = bar && barRefreshers.get(bar);
    if (!refresher?.plugin.preloadFilterReady || !refresher.plugin.preloadStatusEnabled) return;
    refresher.refresh();
    applyPreloadFilter(scope);
}

/**
 * 确保筛选栏存在（流式加载/重排时由 observer 调用）。
 */
export function ensureFilterBar(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    if (!queryFilterControls('.preload-filter-bar').length) {
        tryBuildFilterBar(plugin);
    }
    if (queryFilterControls('.preload-filter-bar').length) refreshFilterBar(plugin);
}
