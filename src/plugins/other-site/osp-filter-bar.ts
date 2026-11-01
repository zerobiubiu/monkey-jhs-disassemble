import type { FilterScope } from '../../types/filter-scope';

import {
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
 * 筛选栏芯片定义（固定 5 档：排队中/请求中/成功匹配/匹配失败/已缓存）。
 * 'cached' 表示无徽标的卡片（已缓存或无需预加载）。
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
 * 其他筛选/隐藏插件使用的隐藏属性集合。本插件 applyPreloadFilter /
 * collectPreloadCounts 遇到带这些属性的卡片一律跳过（不纳入管理、不计入计数），
 * 与 StatusTagFilterPlugin（data-status-tag-hidden）、VideoListsTagPlugin
 * （data-video-lists-tag-hidden）、ListReadingStatusPlugin（data-lrs-hidden）、
 * jhs ListPagePlugin（data-hide）协同共存，互不干扰。
 */
export const OTHER_HIDDEN_ATTRS = [
    'data-hide',
    'data-lrs-hidden',
    'data-status-tag-hidden',
    'data-video-lists-tag-hidden'
];

/** 每个 DOM 筛选栏保留自己的刷新闭包，不共享选中状态或防抖计时器。 */
const barRefreshers = new WeakMap<Element, { plugin: OtherSitePlugin; refresh: () => void }>();
const queueToggleBound = new WeakSet<OtherSitePlugin>();

/**
 * 初始化预加载筛选栏：立即尝试挂载，挂载目标未就绪则用 observer 重试
 * （镜像 StatusTagFilterPlugin 的 tryBuild + observer 模式）。
 * 与 .status-tag-filter-bar / .jhs-vlt-filter-bar 等其他筛选栏同行挂载。
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
 * 构建筛选栏 DOM 并插入挂载参考元素之后。芯片文本含实时计数，
 * refreshChips 保留已激活状态。点击芯片 toggle active + applyPreloadFilter。
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
        const activeValues = new Set(
            Array.from(chipsContainer.querySelectorAll('.preload-filter-chip.active')).map(
                (c: Element) => (c as HTMLElement).dataset.value || ''
            )
        );
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
            if (activeValues.has(chip.value)) el.classList.add('active');
            el.addEventListener('click', () => {
                el.classList.toggle('active');
                applyPreloadFilter(scope);
            });
            chipsContainer.appendChild(el);
        }
    };

    refreshChips();

    // 按优先级入栈：顺序由 FILTER_BAR_PRIORITY 决定（doc/50），不再各自找邻接栏
    if (!mountScopedFilterBar(bar, FILTER_BAR_PRIORITY.preload, scope)) return null;
    barRefreshers.set(bar, { plugin, refresh: refreshChips });
    return bar;
}

/**
 * 收集各预加载状态的卡片计数（排除被其他筛选/隐藏插件屏蔽的卡片，
 * 计数只反映实际可见卡片，与 StatusTagFilterPlugin 一致）。
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
 * 应用筛选：按当前激活芯片显示/隐藏 .item。协同安全——被其他插件隐藏的卡片
 * 不纳入管理（不恢复、不重复隐藏），本插件专用 data-preload-hidden 属性。
 * OR 逻辑：命中任一选中状态即显示；无激活芯片则恢复本插件隐藏的卡片。
 */
function applyPreloadFilter(scope?: FilterScope): void {
    const activeChips = queryFilterControls('.preload-filter-chip.active', scope);
    const selected = new Set(
        Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
    );
    const HIDDEN = PRELOAD_HIDDEN_ATTR;

    if (scope) {
        // 各栏始终独立计算自身标记，再按标记交集显示，不能因其他栏先隐藏而漏算。
        queryFilterItems<HTMLElement>(scope).forEach((item) => {
            const matches = selected.size === 0 || selected.has(getItemPreloadStatus(item));
            item.toggleAttribute(HIDDEN, !matches);
            reconcileFilterVisibility(item);
        });
        return;
    }

    if (selected.size === 0) {
        document.querySelectorAll(`${siteSelector('filterItem')}[${HIDDEN}]`).forEach((item: Element) => {
            const el = item as HTMLElement;
            if (OTHER_HIDDEN_ATTRS.some((a) => el.hasAttribute(a))) return;
            el.removeAttribute(HIDDEN);
            el.style.display = '';
        });
        return;
    }

    document.querySelectorAll(siteSelector('listItem')).forEach((item: Element) => {
        const el = item as HTMLElement;
        // 协同安全：被其他插件隐藏的卡片不管理
        if (OTHER_HIDDEN_ATTRS.some((a) => el.hasAttribute(a))) return;
        if (el.style.display === 'none' && !el.hasAttribute(HIDDEN)) return;
        const st = getItemPreloadStatus(el);
        if (selected.has(st)) {
            el.removeAttribute(HIDDEN);
            el.style.display = '';
        } else {
            el.setAttribute(HIDDEN, '');
            el.style.display = 'none';
        }
    });
}

/**
 * 刷新筛选栏：重建芯片（保留激活状态）+ 重新应用筛选。150ms 防抖，
 * 合并频繁的状态变更（每条预加载完成都会触发）。
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
 * 确保筛选栏存在（流式加载/重排时由 observer 调用）：栏缺失 → 构建，
 * 顺序由 jhs-filter-stack 的优先级保证，无需再搬动位置（doc/50）
 */
export function ensureFilterBar(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    if (!queryFilterControls('.preload-filter-bar').length) {
        tryBuildFilterBar(plugin);
    }
    // 顺序由 jhs-filter-stack 保证；此处只需确保芯片与当前页面同步
    if (queryFilterControls('.preload-filter-bar').length) refreshFilterBar(plugin);
}
