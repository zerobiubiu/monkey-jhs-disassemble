import type { OtherSitePlugin } from '../other-site-plugin';
import { getItemPreloadStatus } from './osp-helpers';

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
        if (document.querySelector('.preload-filter-bar')) {
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
    if (document.querySelector('.preload-filter-bar')) return true;
    const target = findFilterMountTarget();
    if (!target) return false;
    buildFilterBar(plugin, target);
    return true;
}

/**
 * 按优先级查找筛选栏挂载参考元素（镜像 StatusTagFilterPlugin.findMountTarget，
 * 但优先紧随 .status-tag-filter-bar）：
 * .status-tag-filter-bar → .jhs-vlt-filter-bar → .tabs.is-boxed / .actor-tags.tags
 * → section/div 首子元素回退。挂载方向：高优先级 afterend，回退 beforebegin。
 */
function findFilterMountTarget(): Element | null {
    const stf = document.querySelector('.status-tag-filter-bar');
    if (stf) return stf;
    const vlt = document.querySelector('.jhs-vlt-filter-bar');
    if (vlt) return vlt;
    const isActorPage = /^\/actors\//.test(window.location.pathname);
    if (isActorPage) {
        const actorTags = document.querySelector('body > section > div > div.actor-tags.tags');
        if (actorTags) return actorTags;
    } else {
        const tabsBoxed = document.querySelector('body > section > div > div.tabs.is-boxed');
        if (tabsBoxed) return tabsBoxed;
    }
    const section = document.querySelector('body > section > div > div');
    if (section && section.firstElementChild) {
        if (
            !section.firstElementChild.matches(
                '.preload-filter-bar, .status-tag-filter-bar, .jhs-vlt-filter-bar'
            )
        ) {
            return section.firstElementChild;
        }
    }
    const container = document.querySelector('body > section > div');
    if (container && container.firstElementChild) {
        if (
            !container.firstElementChild.matches(
                '.preload-filter-bar, .status-tag-filter-bar, .jhs-vlt-filter-bar'
            )
        ) {
            return container.firstElementChild;
        }
    }
    return null;
}

/**
 * 构建筛选栏 DOM 并插入挂载参考元素之后。芯片文本含实时计数，
 * refreshChips 保留已激活状态。点击芯片 toggle active + applyPreloadFilter。
 */
function buildFilterBar(_plugin: OtherSitePlugin, mountTarget: Element): void {
    const bar = document.createElement('div');
    bar.className = 'preload-filter-bar';

    const label = document.createElement('span');
    label.className = 'preload-filter-label';
    label.textContent = '预加载:';
    bar.appendChild(label);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'preload-filter-chips';
    bar.appendChild(chipsContainer);

    const refreshChips = (): void => {
        const activeValues = new Set(
            Array.from(chipsContainer.querySelectorAll('.preload-filter-chip.active')).map(
                (c: Element) => (c as HTMLElement).dataset.value || ''
            )
        );
        chipsContainer.innerHTML = '';
        const counts = collectPreloadCounts();
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
                applyPreloadFilter();
            });
            chipsContainer.appendChild(el);
        }
    };

    refreshChips();

    if (
        mountTarget.matches(
            '.status-tag-filter-bar, .jhs-vlt-filter-bar, .actor-tags.tags, .tabs.is-boxed'
        )
    ) {
        mountTarget.insertAdjacentElement('afterend', bar);
    } else {
        mountTarget.insertAdjacentElement('beforebegin', bar);
    }

    (bar as any)._refreshChips = refreshChips;
}

/**
 * 收集各预加载状态的卡片计数（排除被其他筛选/隐藏插件屏蔽的卡片，
 * 计数只反映实际可见卡片，与 StatusTagFilterPlugin 一致）。
 */
function collectPreloadCounts(): Record<string, number> {
    const counts: Record<string, number> = {
        queued: 0,
        requesting: 0,
        success: 0,
        failed: 0
    };
    document.querySelectorAll('.movie-list .item').forEach((item: Element) => {
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
function applyPreloadFilter(): void {
    const activeChips = document.querySelectorAll('.preload-filter-chip.active');
    const selected = new Set(
        Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
    );
    const HIDDEN = PRELOAD_HIDDEN_ATTR;

    if (selected.size === 0) {
        document.querySelectorAll(`.item[${HIDDEN}]`).forEach((item: Element) => {
            const el = item as HTMLElement;
            if (OTHER_HIDDEN_ATTRS.some((a) => el.hasAttribute(a))) return;
            el.removeAttribute(HIDDEN);
            el.style.display = '';
        });
        return;
    }

    document.querySelectorAll('.movie-list .item').forEach((item: Element) => {
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
        const bar = document.querySelector('.preload-filter-bar');
        if (bar && (bar as any)._refreshChips) {
            (bar as any)._refreshChips();
            applyPreloadFilter();
        }
    }, 150);
}

/**
 * 确保筛选栏存在且紧随其他筛选栏。流式加载/重排时由 observer 调用：
 * - 栏缺失 → 构建
 * - .status-tag-filter-bar 晚于本插件挂载 → 将本栏移至其后，保持「放在一块」
 */
export function ensureFilterBar(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    if (!document.querySelector('.preload-filter-bar')) {
        tryBuildFilterBar(plugin);
    }
    const bar = document.querySelector('.preload-filter-bar');
    if (!bar) return;
    const stf = document.querySelector('.status-tag-filter-bar');
    if (stf && bar.previousElementSibling !== stf) {
        stf.insertAdjacentElement('afterend', bar);
        refreshFilterBar(plugin);
        return;
    }
    const vlt = document.querySelector('.jhs-vlt-filter-bar');
    if (!stf && vlt && bar.previousElementSibling !== vlt) {
        vlt.insertAdjacentElement('afterend', bar);
        refreshFilterBar(plugin);
    }
}
