/**
 * 清单阅读进度插件 —— 工具栏层（状态持久化 + 工具栏构建/刷新）。
 *
 * 已提取模块：
 *   - lrs-sort.ts：getListMeta + ensureLiOrder + compareLi + applySort
 *   - lrs-filter.ts：saveFilterReadState + saveFilterRatingState + matchesFilter + applyFilter + applySortAndFilter + countFilterStats + createFilterChip
 *
 * 本文件保留：loadToolbarState + saveSortState + buildToolbar + refreshChips + tryBuildToolbar + restoreToolbarUI。
 * applySortAndFilter / saveFilterReadState / saveFilterRatingState 从 lrs-filter 再导出，保持外部导入路径不变。
 */
import type { ListReadingStatusPlugin } from '../list-reading-status-plugin';
import {
    SORT_KEY,
    FILTER_READ_KEY,
    FILTER_RATING_KEY,
    LOG_PREFIX
} from './lrs-storage';
import {
    applySortAndFilter,
    saveFilterReadState,
    saveFilterRatingState,
    countFilterStats,
    createFilterChip
} from './lrs-filter';

/** 再导出，保持 list-reading-status-plugin.ts 的导入路径不变。 */
export { applySortAndFilter, saveFilterReadState, saveFilterRatingState } from './lrs-filter';

/** 从 GM 存储加载排序与筛选状态。对应原 L779-793。 */
export function loadToolbarState(plugin: ListReadingStatusPlugin): void {
    const s = GM_getValue(SORT_KEY);
    if (s) plugin.currentSort = s;
    const r = GM_getValue(FILTER_READ_KEY);
    if (r === 'read' || r === 'unread') plugin.filterReadStatus = r;
    const rc = GM_getValue(FILTER_RATING_KEY);
    if (rc) {
        try {
            const arr = JSON.parse(rc);
            if (Array.isArray(arr)) plugin.filterRatingChips = new Set(arr);
        } catch {
            plugin.filterRatingChips = new Set();
        }
    }
}

/** 持久化排序状态。对应原 L799-802。 */
export function saveSortState(plugin: ListReadingStatusPlugin, v: string): void {
    plugin.currentSort = v;
    GM_setValue(SORT_KEY, v);
}

/** 工具栏元素扩展属性（buildToolbar 挂载，refreshChips/restoreToolbarUI 读取）。 */
interface ToolbarWithHosts extends HTMLElement {
    _readHost?: HTMLElement;
    _ratingHost?: HTMLElement;
    _sortSelect?: HTMLSelectElement;
}

/** 构建/刷新工具栏：挂载到 #lists 之前。对应原 L1097-1206。 */
export function buildToolbar(plugin: ListReadingStatusPlugin): HTMLElement | null {
    if (plugin.isDetailPage) return null;
    const lists = document.querySelector('#lists');
    if (!lists) return null;
    if (document.querySelector('.list-toolbar')) {
        return document.querySelector('.list-toolbar') as HTMLElement;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'list-toolbar';

    // 排序组
    const sortGroup = document.createElement('div');
    sortGroup.className = 'list-toolbar-group';
    const sortLabel = document.createElement('span');
    sortLabel.className = 'list-toolbar-label';
    sortLabel.textContent = '排序:';
    const sortSelect = document.createElement('select');
    sortSelect.className = 'list-sort-select';
    const sortOptions: [string, string][] = [
        ['default', '默认'],
        ['rating-desc', '评分 ↓'],
        ['rating-asc', '评分 ↑'],
        ['movies-desc', '影片数 ↓'],
        ['movies-asc', '影片数 ↑'],
        ['clicks-desc', '点击数 ↓'],
        ['clicks-asc', '点击数 ↑'],
        ['visited-desc', '最近访问 ↓'],
        ['visited-asc', '最久访问 ↓'],
        ['title-asc', '标题 A-Z']
    ];
    sortOptions.forEach(([val, txt]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = txt;
        if (val === plugin.currentSort) opt.selected = true;
        sortSelect.appendChild(opt);
    });
    plugin.supervisor.addEventListener(sortSelect, 'change', () => {
        saveSortState(plugin, sortSelect.value);
        applySortAndFilter(plugin);
    });
    sortGroup.appendChild(sortLabel);
    sortGroup.appendChild(sortSelect);
    toolbar.appendChild(sortGroup);

    const div1 = document.createElement('div');
    div1.className = 'list-filter-divider';
    toolbar.appendChild(div1);

    // 阅读状态筛选组
    const readGroup = document.createElement('div');
    readGroup.className = 'list-toolbar-group';
    const readLabel = document.createElement('span');
    readLabel.className = 'list-toolbar-label';
    readLabel.textContent = '阅读:';
    readGroup.appendChild(readLabel);
    const readChipsHost = document.createElement('div');
    readGroup.appendChild(readChipsHost);
    toolbar.appendChild(readGroup);

    const div2 = document.createElement('div');
    div2.className = 'list-filter-divider';
    toolbar.appendChild(div2);

    // 评分筛选组
    const ratingGroup = document.createElement('div');
    ratingGroup.className = 'list-toolbar-group';
    const ratingLabel = document.createElement('span');
    ratingLabel.className = 'list-toolbar-label';
    ratingLabel.textContent = '评分:';
    ratingGroup.appendChild(ratingLabel);
    const ratingChipsHost = document.createElement('div');
    ratingGroup.appendChild(ratingChipsHost);
    toolbar.appendChild(ratingGroup);

    // 重置按钮
    const reset = document.createElement('a');
    reset.className = 'list-toolbar-reset';
    reset.textContent = '重置筛选';
    plugin.supervisor.addEventListener(reset, 'click', (e: Event) => {
        e.preventDefault();
        saveSortState(plugin, 'default');
        saveFilterReadState(plugin, 'all');
        saveFilterRatingState(plugin, new Set());
        sortSelect.value = 'default';
        toolbar
            .querySelectorAll('.list-filter-chip.active')
            .forEach((c: Element) => c.classList.remove('active'));
        applySortAndFilter(plugin);
    });
    toolbar.appendChild(reset);

    lists.insertAdjacentElement('beforebegin', toolbar);

    (toolbar as ToolbarWithHosts)._readHost = readChipsHost;
    (toolbar as ToolbarWithHosts)._ratingHost = ratingChipsHost;
    (toolbar as ToolbarWithHosts)._sortSelect = sortSelect;

    refreshChips(plugin, toolbar);
    console.log(`${LOG_PREFIX} 排序与筛选工具栏已挂载`);
    return toolbar;
}

/** 刷新筛选芯片。对应原 L1212-1260。 */
export function refreshChips(plugin: ListReadingStatusPlugin, toolbar: HTMLElement): void {
    const stats = countFilterStats();

    const readHost: HTMLElement | undefined = (toolbar as ToolbarWithHosts)._readHost;
    if (readHost) {
        readHost.innerHTML = '';
        const readChip = createFilterChip(plugin, '已读完', 'read', stats.read);
        if (plugin.filterReadStatus === 'read') readChip.classList.add('active');
        readHost.appendChild(readChip);
        const unreadChip = createFilterChip(plugin, '未读完', 'unread', stats.unread);
        if (plugin.filterReadStatus === 'unread') unreadChip.classList.add('active');
        readHost.appendChild(unreadChip);
    }

    const ratingHost: HTMLElement | undefined = (toolbar as ToolbarWithHosts)._ratingHost;
    if (ratingHost) {
        ratingHost.innerHTML = '';
        const ratedChip = createFilterChip(plugin, '有评分', 'rated', stats.rated);
        if (plugin.filterRatingChips.has('rated')) ratedChip.classList.add('active');
        ratingHost.appendChild(ratedChip);
        const unratedChip = createFilterChip(plugin, '无评分', 'unrated', stats.unrated);
        if (plugin.filterRatingChips.has('unrated')) unratedChip.classList.add('active');
        ratingHost.appendChild(unratedChip);
        for (let i = 1; i <= 5; i++) {
            const starChip = createFilterChip(plugin, `${i}星`, `rating-${i}`, stats.stars[i - 1]);
            if (plugin.filterRatingChips.has(`rating-${i}`)) starChip.classList.add('active');
            ratingHost.appendChild(starChip);
        }
    }
}

/** 尝试构建工具栏并应用排序筛选。对应原 L1266-1273。 */
export function tryBuildToolbar(plugin: ListReadingStatusPlugin): boolean {
    if (plugin.isDetailPage) return false;
    const toolbar = buildToolbar(plugin);
    if (!toolbar) return false;
    refreshChips(plugin, toolbar);
    applySortAndFilter(plugin);
    return true;
}

/** 从持久化状态恢复工具栏 UI。对应原 L1278-1283。 */
export function restoreToolbarUI(plugin: ListReadingStatusPlugin): void {
    const toolbar = document.querySelector('.list-toolbar') as HTMLElement | null;
    if (!toolbar) return;
    const sortSelect: HTMLSelectElement | undefined = (toolbar as ToolbarWithHosts)._sortSelect;
    if (sortSelect) sortSelect.value = plugin.currentSort;
    refreshChips(plugin, toolbar);
}
