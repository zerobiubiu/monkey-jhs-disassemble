/**
 * 标签筛选栏模块 —— 筛选栏构建、筛选模式、芯片管理、标签统计。
 *
 * 筛选执行与标签统计已拆分至 vlt-filter-apply.ts：
 * - applyFilter / collectAllUniqueTags / collectTagCounts / countNoTagItems
 *
 * 本文件保留 UI 构建：
 * - buildFilterBar / buildFilterModeDropdown / createFilterChip / refreshChips / updateFilterBar
 */
import type { VltTags } from './vlt-tags';
import {
    applyFilter,
    collectAllUniqueTags,
    collectTagCounts,
    countNoTagItems,
    FILTER_MODES,
    TAG_HIDDEN_ATTR
} from './vlt-filter-apply';

export { applyFilter, collectAllUniqueTags, collectTagCounts, countNoTagItems, FILTER_MODES, TAG_HIDDEN_ATTR };

/** DOM 扩展：筛选模式下拉菜单挂载 updateModeUI 闭包。 */
interface FilterModeDropdownEl extends HTMLDetailsElement {
    _updateModeUI?: () => void;
}

/** DOM 扩展：筛选栏挂载模式下拉引用和 refreshChips 闭包。 */
interface FilterBarEl extends HTMLDivElement {
    _modeDropdown?: FilterModeDropdownEl;
    _refreshChips?: () => void;
}

/** 筛选模式配置（label + group 用于下拉菜单渲染）。 */
const FILTER_MODE_CONFIG: { value: string; label: string; group: 'include' | 'exclude' }[] = [
    { value: FILTER_MODES.CONTAINS_ANY, label: '包含任意一个', group: 'include' },
    { value: FILTER_MODES.CONTAINS_ALL, label: '全都包含', group: 'include' },
    { value: FILTER_MODES.EXCLUDES_ALL, label: '不包含以下标签', group: 'exclude' },
    { value: FILTER_MODES.EXCLUDES_ANY, label: '不包含以下任意一个', group: 'exclude' }
];

/**
 * 构建筛选模式下拉菜单（对应原 L814-911）。
 * 使用 <details> 原生行为实现点击外部自动关闭。
 *
 * updateModeUI 闭包挂在 details._updateModeUI 上，供外部刷新模式 UI。
 *
 * @param plugin VltTags 实例
 * @returns FilterModeDropdownEl 下拉菜单元素
 */
export function buildFilterModeDropdown(plugin: VltTags): FilterModeDropdownEl {
    const details = document.createElement('details') as FilterModeDropdownEl;
    details.className = 'jhs-vlt-filter-mode-dropdown';

    const summary = document.createElement('summary');
    summary.className = 'jhs-vlt-filter-mode-summary';

    // 模式指示圆点
    const indicator = document.createElement('span');
    indicator.className = 'jhs-vlt-filter-mode-indicator';
    summary.appendChild(indicator);

    // 当前模式文本
    const modeText = document.createElement('span');
    modeText.className = 'jhs-vlt-filter-mode-text';
    summary.appendChild(modeText);

    // 下拉箭头
    const arrow = document.createElement('span');
    arrow.className = 'jhs-vlt-filter-mode-arrow';
    arrow.textContent = '\u25BC';
    summary.appendChild(arrow);

    details.appendChild(summary);

    // 下拉面板
    const panel = document.createElement('div');
    panel.className = 'jhs-vlt-filter-mode-panel';

    /** 根据 currentFilterMode 刷新按钮与菜单状态 */
    const updateModeUI = (): void => {
        const config =
            FILTER_MODE_CONFIG.find((m) => m.value === plugin.currentFilterMode) ||
            FILTER_MODE_CONFIG[0];

        // 更新按钮文本
        modeText.textContent = config.label;

        // 更新按钮圆点
        indicator.className = 'jhs-vlt-filter-mode-indicator jhs-vlt-' + config.group;

        // 更新菜单选中状态
        panel.querySelectorAll('.jhs-vlt-filter-mode-item').forEach((el: Element) => {
            el.classList.toggle(
                'jhs-vlt-selected',
                (el as HTMLElement).dataset.mode === plugin.currentFilterMode
            );
        });
    };

    // 构建菜单项
    let lastGroup: 'include' | 'exclude' | null = null;
    FILTER_MODE_CONFIG.forEach((mode) => {
        // 组间插入分隔线
        if (lastGroup && lastGroup !== mode.group) {
            const separator = document.createElement('div');
            separator.className = 'jhs-vlt-filter-mode-separator';
            panel.appendChild(separator);
        }
        lastGroup = mode.group;

        const item = document.createElement('div');
        item.className = 'jhs-vlt-filter-mode-item';
        if (mode.group === 'exclude') {
            item.classList.add('jhs-vlt-exclude');
        }
        item.dataset.mode = mode.value;

        // 圆点
        const dot = document.createElement('span');
        dot.className = 'jhs-vlt-filter-mode-indicator jhs-vlt-' + mode.group;
        item.appendChild(dot);

        // 文本
        const text = document.createElement('span');
        text.textContent = mode.label;
        item.appendChild(text);

        item.addEventListener('click', () => {
            plugin.currentFilterMode = mode.value;
            updateModeUI();
            details.open = false;
            applyFilter(plugin);
        });

        panel.appendChild(item);
    });

    details.appendChild(panel);

    // 保存 updateModeUI 引用（与原脚本一致，挂在 DOM 元素上）
    details._updateModeUI = updateModeUI;

    // 初始刷新
    updateModeUI();

    return details;
}

/**
 * 创建单个筛选芯片（对应原 L1019-1034）。
 *
 * @param plugin VltTags 实例
 * @param labelText 芯片文本
 * @param value 芯片值（标签名或 'no-tag'）
 * @param opts 选项（isNoTag/count）
 * @returns 芯片 span 元素
 */
export function createFilterChip(
    plugin: VltTags,
    labelText: string,
    value: string,
    opts: { isNoTag?: boolean; count?: number } = {}
): HTMLSpanElement {
    const { isNoTag = false, count } = opts;
    const chip = document.createElement('span');
    chip.className = 'jhs-vlt-filter-chip';
    if (isNoTag) chip.classList.add('jhs-vlt-no-tag');
    chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
    chip.dataset.value = value;

    chip.addEventListener('click', () => {
        chip.classList.toggle('jhs-vlt-active');
        applyFilter(plugin);
    });

    return chip;
}

/**
 * 刷新芯片列表（对应原 L982-1011），保留当前选中状态。
 *
 * @param plugin VltTags 实例
 * @param chipsContainer 芯片容器元素
 */
export function refreshChips(plugin: VltTags, chipsContainer: HTMLElement): void {
    // 保存当前选中状态
    const activeValues = new Set(
        Array.from(chipsContainer.querySelectorAll('.jhs-vlt-filter-chip.jhs-vlt-active')).map(
            (c: Element) => (c as HTMLElement).dataset.value || ''
        )
    );

    chipsContainer.innerHTML = '';
    const allCounts = collectTagCounts();

    // "无标签" 芯片（带计数）
    const noCount = countNoTagItems();
    const noTagChip = createFilterChip(plugin, '无标签', 'no-tag', {
        isNoTag: true,
        count: noCount
    });
    if (activeValues.has('no-tag')) noTagChip.classList.add('jhs-vlt-active');
    chipsContainer.appendChild(noTagChip);

    // 各标签芯片（带计数）—— 用 collectAllUniqueTags 获取去重排序的标签名
    const sortedTags = collectAllUniqueTags();
    sortedTags.forEach((tagName: string) => {
        const chip = createFilterChip(plugin, tagName, tagName, {
            count: allCounts[tagName]
        });
        if (activeValues.has(tagName)) chip.classList.add('jhs-vlt-active');
        chipsContainer.appendChild(chip);
    });
}

/**
 * 构建筛选器 UI（对应原 L918-1043）。
 *
 * - 演员页面：插入到 div.actor-tags.tags 之后
 * - 其他页面：插入到 div.tabs.is-boxed 之后
 *
 * 内含 refreshChips（刷新芯片列表，保留已激活状态）和 createFilterChip
 * （创建单个芯片）。refreshChips 挂在 filterBar._refreshChips 上，
 * 供 updateFilterBar 后续调用。
 *
 * @param plugin VltTags 实例
 */
export function buildFilterBar(plugin: VltTags): void {
    if (document.querySelector('.jhs-vlt-filter-bar')) return;

    // 根据页面类型选择挂载目标
    const isActorPage = /^\/actors\//.test(window.location.pathname);
    const mountTarget = isActorPage
        ? document.querySelector('body > section > div > div.actor-tags.tags')
        : document.querySelector('body > section > div > div.tabs.is-boxed');
    if (!mountTarget) return;

    const filterBar = document.createElement('div') as FilterBarEl;
    filterBar.className = 'jhs-vlt-filter-bar';

    const label = document.createElement('span');
    label.className = 'jhs-vlt-filter-label';
    label.textContent = '筛选:';
    filterBar.appendChild(label);

    // ── 筛选模式下拉 ──
    const modeDropdown = buildFilterModeDropdown(plugin);
    filterBar.appendChild(modeDropdown);
    filterBar._modeDropdown = modeDropdown;

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'jhs-vlt-filter-chips';
    filterBar.appendChild(chipsContainer);

    // ── 自动刷新开关 ──
    const toggleWrapper = document.createElement('label');
    toggleWrapper.className = 'jhs-vlt-auto-refresh-toggle';
    toggleWrapper.title = '监听清单操作，自动刷新标签';

    const switchSpan = document.createElement('span');
    switchSpan.className = 'jhs-vlt-auto-refresh-switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = plugin.autoRefreshEnabled;
    const slider = document.createElement('span');
    slider.className = 'jhs-vlt-auto-refresh-slider';
    switchSpan.appendChild(checkbox);
    switchSpan.appendChild(slider);

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = '自动刷新';

    toggleWrapper.appendChild(switchSpan);
    toggleWrapper.appendChild(toggleLabel);
    filterBar.appendChild(toggleWrapper);

    checkbox.addEventListener('change', () => {
        plugin.autoRefreshEnabled = checkbox.checked;
        plugin.saveAutoRefreshState(plugin.autoRefreshEnabled);
        if (plugin.autoRefreshEnabled) {
            console.log('[视频清单标签] 自动刷新已开启');
        } else {
            console.log('[视频清单标签] 自动刷新已关闭');
        }
    });

    // 绑定 refreshChips 闭包（捕获 chipsContainer）
    const boundRefreshChips = (): void => refreshChips(plugin, chipsContainer);

    boundRefreshChips();

    // 作为挂载目标的兄弟元素插入到它之后
    mountTarget.insertAdjacentElement('afterend', filterBar);

    // 保存 refreshChips 引用以便后续更新（与原脚本一致，挂在 DOM 元素上）
    filterBar._refreshChips = boundRefreshChips;
}

/**
 * 更新筛选栏芯片（对应原 L1048-1054）。
 * 新卡片加载后调用，重新生成芯片列表并重新应用筛选。
 *
 * @param plugin VltTags 实例
 */
export function updateFilterBar(plugin: VltTags): void {
    const filterBar = document.querySelector('.jhs-vlt-filter-bar') as FilterBarEl | null;
    if (filterBar && filterBar._refreshChips) {
        filterBar._refreshChips();
        applyFilter(plugin);
    }
}
