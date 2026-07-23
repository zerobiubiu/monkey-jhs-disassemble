/**
 * 清单阅读进度插件 —— 排序、筛选与工具栏层。
 *
 * 覆盖清单列表页工具栏的构建/刷新、10 种排序（含稳定 tiebreaker）、
 * 阅读状态与评分筛选（协同安全显隐）、筛选统计与芯片渲染。
 * 函数以插件实例为首参，复用其排序/筛选状态字段与 supervisor。
 */
import type { ListReadingStatusPlugin } from '../list-reading-status-plugin';
import { LRS_HIDDEN_ATTR, LRS_ORDER_ATTR, type ListMeta, type FilterStats } from './lrs-types';
import {
    SORT_KEY,
    FILTER_READ_KEY,
    FILTER_RATING_KEY,
    LOG_PREFIX,
    getRating,
    getLastUri,
    isRead
} from './lrs-storage';

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

/** 持久化阅读状态筛选。对应原 L808-811。 */
export function saveFilterReadState(plugin: ListReadingStatusPlugin, v: string): void {
    plugin.filterReadStatus = v;
    GM_setValue(FILTER_READ_KEY, v);
}

/** 持久化评分筛选芯片集合。对应原 L817-820。 */
export function saveFilterRatingState(plugin: ListReadingStatusPlugin, set: Set<string>): void {
    plugin.filterRatingChips = set;
    GM_setValue(FILTER_RATING_KEY, JSON.stringify([...set]));
}

/** 从 li 提取排序/筛选所需的元数据。对应原 L827-847。 */
export function getListMeta(_plugin: ListReadingStatusPlugin, li: Element): ListMeta {
    const listId = (li as HTMLElement).id || '';
    const titleEl = li.querySelector("a[href*='/lists/']");
    const title = titleEl ? titleEl.textContent!.trim() : '';
    const metaTxt = li.querySelector('.meta')?.textContent ?? '';
    const moviesMatch = metaTxt.match(/([\d,]+)\s*部影片/);
    const clicksMatch = metaTxt.match(/點擊了\s*([\d,]+)/);
    return {
        listId,
        title,
        movies: moviesMatch ? parseInt(moviesMatch[1].replace(/,/g, '')) : 0,
        clicks: clicksMatch ? parseInt(clicksMatch[1].replace(/,/g, '')) : 0,
        rating: getRating(listId),
        visited: getLastUri(listId)?.timestamp ?? 0,
        order: parseInt(li.getAttribute(LRS_ORDER_ATTR) || '0') || 0
    };
}

/** 为 li 分配原始顺序索引。对应原 L853-857。 */
export function ensureLiOrder(plugin: ListReadingStatusPlugin, li: Element): void {
    if (!li.hasAttribute(LRS_ORDER_ATTR)) {
        li.setAttribute(LRS_ORDER_ATTR, String(plugin.orderCounter++));
    }
}

/** 比较两个 li（按 currentSort），相同则按原始顺序 tiebreaker。对应原 L865-902。 */
export function compareLi(plugin: ListReadingStatusPlugin, a: Element, b: Element): number {
    const ma = getListMeta(plugin, a);
    const mb = getListMeta(plugin, b);
    let cmp = 0;
    switch (plugin.currentSort) {
        case 'rating-desc': cmp = mb.rating - ma.rating; break;
        case 'rating-asc': cmp = ma.rating - mb.rating; break;
        case 'movies-desc': cmp = mb.movies - ma.movies; break;
        case 'movies-asc': cmp = ma.movies - mb.movies; break;
        case 'clicks-desc': cmp = mb.clicks - ma.clicks; break;
        case 'clicks-asc': cmp = ma.clicks - mb.clicks; break;
        case 'visited-desc': cmp = mb.visited - ma.visited; break;
        case 'visited-asc': cmp = ma.visited - mb.visited; break;
        case 'title-asc': cmp = ma.title.localeCompare(mb.title, 'zh'); break;
        default: cmp = 0;
    }
    if (cmp === 0) cmp = ma.order - mb.order;
    return cmp;
}

/** 应用排序：按 currentSort 重排 #lists > ul 下的 li。对应原 L908-924。 */
export function applySort(plugin: ListReadingStatusPlugin): void {
    if (plugin.currentSort === 'default') return;
    const ul = document.querySelector('#lists > ul');
    if (!ul) return;
    const lis = [...ul.querySelectorAll(':scope > li')] as HTMLElement[];
    if (lis.length < 2) return;
    lis.forEach((li) => ensureLiOrder(plugin, li));
    lis.sort((a, b) => compareLi(plugin, a, b));
    const sortedIds = lis.map((li) => li.id).join(',');
    const currentIds = [...ul.querySelectorAll(':scope > li')].map((li) => (li as HTMLElement).id).join(',');
    if (sortedIds === currentIds) return;
    const frag = document.createDocumentFragment();
    lis.forEach((li) => frag.appendChild(li));
    ul.appendChild(frag);
}

/** 判断 li 是否匹配当前筛选条件。对应原 L931-957。 */
export function matchesFilter(plugin: ListReadingStatusPlugin, li: Element): boolean {
    const listId = (li as HTMLElement).id;
    if (!listId) return true;

    if (plugin.filterReadStatus !== 'all') {
        const read = isRead(listId);
        if (plugin.filterReadStatus === 'read' && !read) return false;
        if (plugin.filterReadStatus === 'unread' && read) return false;
    }

    if (plugin.filterRatingChips.size > 0) {
        const rating = getRating(listId);
        let match = false;
        if (plugin.filterRatingChips.has('rated') && rating > 0) match = true;
        if (plugin.filterRatingChips.has('unrated') && rating === 0) match = true;
        for (let i = 1; i <= 5; i++) {
            if (plugin.filterRatingChips.has(`rating-${i}`) && rating === i) {
                match = true;
                break;
            }
        }
        if (!match) return false;
    }
    return true;
}

/** 应用筛选：显示/隐藏 li（协同安全 data-lrs-hidden）。对应原 L964-995。 */
export function applyFilter(plugin: ListReadingStatusPlugin): void {
    const ul = document.querySelector('#lists > ul');
    if (!ul) return;
    const lis = ul.querySelectorAll(':scope > li');

    if (plugin.filterReadStatus === 'all' && plugin.filterRatingChips.size === 0) {
        lis.forEach((li: Element) => {
            const htmlLi = li as HTMLElement;
            if (htmlLi.hasAttribute(LRS_HIDDEN_ATTR)) {
                htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
                htmlLi.style.display = '';
            }
        });
        return;
    }

    lis.forEach((li: Element) => {
        const htmlLi = li as HTMLElement;
        const hiddenByOther =
            htmlLi.style.display === 'none' &&
            !htmlLi.hasAttribute(LRS_HIDDEN_ATTR);
        if (hiddenByOther) return;

        if (matchesFilter(plugin, htmlLi)) {
            htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
            htmlLi.style.display = '';
        } else {
            htmlLi.setAttribute(LRS_HIDDEN_ATTR, '');
            htmlLi.style.display = 'none';
        }
    });
}

/** 应用排序与筛选（顺序：先排序后筛选）。对应原 L1000-1009。 */
export function applySortAndFilter(plugin: ListReadingStatusPlugin): void {
    if (plugin.isToolbarProcessing) return;
    plugin.isToolbarProcessing = true;
    try {
        applySort(plugin);
        applyFilter(plugin);
    } finally {
        plugin.isToolbarProcessing = false;
    }
}

/** 统计各筛选分类的清单数。对应原 L1015-1039。 */
export function countFilterStats(): FilterStats {
    const stats: FilterStats = {
        read: 0,
        unread: 0,
        rated: 0,
        unrated: 0,
        stars: [0, 0, 0, 0, 0]
    };
    const ul = document.querySelector('#lists > ul');
    if (!ul) return stats;
    ul.querySelectorAll(':scope > li').forEach((li: Element) => {
        const id = (li as HTMLElement).id;
        if (!id) return;
        if (isRead(id)) stats.read++;
        else stats.unread++;
        const r = getRating(id);
        if (r > 0) {
            stats.rated++;
            if (r >= 1 && r <= 5) stats.stars[r - 1]++;
        } else {
            stats.unrated++;
        }
    });
    return stats;
}

/** 创建单个筛选芯片。对应原 L1048-1091。 */
export function createFilterChip(
    plugin: ListReadingStatusPlugin,
    label: string,
    value: string,
    count: number
): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = 'list-filter-chip';
    chip.dataset.value = value;
    const labelText = document.createElement('span');
    labelText.textContent = label;
    chip.appendChild(labelText);
    const countSpan = document.createElement('span');
    countSpan.className = 'chip-count';
    countSpan.textContent = String(count);
    chip.appendChild(countSpan);

    plugin.supervisor.addEventListener(chip, 'click', () => {
        if (value === 'read' || value === 'unread') {
            const wasActive = chip.classList.contains('active');
            document
                .querySelectorAll(
                    ".list-filter-chip[data-value='read'], .list-filter-chip[data-value='unread']"
                )
                .forEach((c: Element) => c.classList.remove('active'));
            if (!wasActive) {
                chip.classList.add('active');
                saveFilterReadState(plugin, value);
            } else {
                saveFilterReadState(plugin, 'all');
            }
        } else {
            chip.classList.toggle('active');
            const next = new Set(plugin.filterRatingChips);
            if (chip.classList.contains('active')) {
                next.add(value);
            } else {
                next.delete(value);
            }
            saveFilterRatingState(plugin, next);
        }
        applySortAndFilter(plugin);
    });

    return chip;
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

    (toolbar as any)._readHost = readChipsHost;
    (toolbar as any)._ratingHost = ratingChipsHost;
    (toolbar as any)._sortSelect = sortSelect;

    refreshChips(plugin, toolbar);
    console.log(`${LOG_PREFIX} 排序与筛选工具栏已挂载`);
    return toolbar;
}

/** 刷新筛选芯片。对应原 L1212-1260。 */
export function refreshChips(plugin: ListReadingStatusPlugin, toolbar: HTMLElement): void {
    const stats = countFilterStats();

    const readHost: HTMLElement | undefined = (toolbar as any)._readHost;
    if (readHost) {
        readHost.innerHTML = '';
        const readChip = createFilterChip(plugin, '已读完', 'read', stats.read);
        if (plugin.filterReadStatus === 'read') readChip.classList.add('active');
        readHost.appendChild(readChip);
        const unreadChip = createFilterChip(plugin, '未读完', 'unread', stats.unread);
        if (plugin.filterReadStatus === 'unread') unreadChip.classList.add('active');
        readHost.appendChild(unreadChip);
    }

    const ratingHost: HTMLElement | undefined = (toolbar as any)._ratingHost;
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
    const sortSelect: HTMLSelectElement | undefined = (toolbar as any)._sortSelect;
    if (sortSelect) sortSelect.value = plugin.currentSort;
    refreshChips(plugin, toolbar);
}
