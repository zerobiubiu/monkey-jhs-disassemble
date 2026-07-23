/**
 * 清单阅读进度插件 —— UI 渲染层。
 *
 * 构建并注入/刷新阅读进度下拉框、星级评分组件、最后访问链接，
 * 覆盖清单列表项（li）与清单详情页标题（h2）两处挂载点。
 * 函数以插件实例为首参，复用其 supervisor 生命周期管理与防重入标志。
 */
import type { ListReadingStatusPlugin } from '../list-reading-status-plugin';
import { STAR_PATH } from './lrs-types';
import { getRating, setRating, isRead, markAsRead, markAsUnread, getLastUri, saveLastUri } from './lrs-storage';

/** 更新下拉框的数据状态属性。对应原 L510-512。 */
export function updateSelectAppearance(select: HTMLSelectElement): void {
    select.setAttribute('data-status', select.value);
}

/** 更新星级评分的外观（填充/清空星星）。对应原 L519-528。 */
export function renderStars(starsEl: HTMLElement, rating: number): void {
    const svgs = starsEl.querySelectorAll('.list-rating-star');
    svgs.forEach((svg: Element, i: number) => {
        if (i < rating) {
            svg.classList.add('filled');
        } else {
            svg.classList.remove('filled');
        }
    });
}

/** 创建星级评分组件（SVG 五角星）。对应原 L538-582。 */
export function createStarWidget(plugin: ListReadingStatusPlugin, listId: string): HTMLElement {
    const container = document.createElement('span');
    container.className = 'list-rating-stars';
    container.title = '评分 1-5 星，再次点击取消评分';

    const currentRating = getRating(listId);
    const NS = 'http://www.w3.org/2000/svg';

    for (let i = 1; i <= 5; i++) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.classList.add('list-rating-star');
        (svg as SVGElement).dataset.rating = String(i);

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', STAR_PATH);
        svg.appendChild(path);

        if (i <= currentRating) {
            svg.classList.add('filled');
        }

        plugin.supervisor.addEventListener(svg, 'click', (e: Event) => {
            e.stopPropagation();
            const clicked = parseInt((svg as SVGElement).dataset.rating || '0');
            const current = getRating(listId);
            const newRating = clicked === current ? 0 : clicked;
            setRating(listId, newRating);
            renderStars(container, newRating);
        });

        plugin.supervisor.addEventListener(svg, 'mouseenter', () => {
            renderStars(container, parseInt((svg as SVGElement).dataset.rating || '0'));
        });

        container.appendChild(svg);
    }

    plugin.supervisor.addEventListener(container, 'mouseleave', () => {
        renderStars(container, getRating(listId));
    });

    return container;
}

/** 创建阅读进度下拉框元素。对应原 L589-619。 */
export function createDropdown(plugin: ListReadingStatusPlugin, listId: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'list-reading-dropdown';

    const optionUnread = document.createElement('option');
    optionUnread.value = 'unread';
    optionUnread.textContent = '未读完';

    const optionRead = document.createElement('option');
    optionRead.value = 'read';
    optionRead.textContent = '已读完';

    select.appendChild(optionUnread);
    select.appendChild(optionRead);

    select.value = isRead(listId) ? 'read' : 'unread';
    updateSelectAppearance(select);

    plugin.supervisor.addEventListener(select, 'change', () => {
        if (select.value === 'read') {
            markAsRead(listId);
        } else {
            markAsUnread(listId);
        }
        updateSelectAppearance(select);
    });

    return select;
}

/** 为单个 li 元素注入/更新阅读进度下拉框和星级评分。对应原 L625-673。 */
export function ensureWidgets(plugin: ListReadingStatusPlugin, li: Element): void {
    const listId = (li as HTMLElement).id;
    if (!listId) return;

    const container = li.querySelector(':scope > div');
    if (!container) return;

    // 下拉框：更新或创建
    let select = container.querySelector('.list-reading-dropdown') as HTMLSelectElement | null;
    if (select) {
        select.value = isRead(listId) ? 'read' : 'unread';
        updateSelectAppearance(select);
    } else {
        select = createDropdown(plugin, listId);
        container.prepend(select);
    }

    // 星级评分：更新或创建
    let stars = container.querySelector('.list-rating-stars') as HTMLElement | null;
    if (stars) {
        renderStars(stars, getRating(listId));
    } else {
        stars = createStarWidget(plugin, listId);
        container.prepend(stars);
    }

    // 最后访问链接
    let uriLink = container.querySelector('.list-last-uri-link') as HTMLAnchorElement | null;
    const lastUri = getLastUri(listId);
    if (lastUri) {
        if (!uriLink) {
            uriLink = document.createElement('a');
            uriLink.className = 'list-last-uri-link';
            const d = new Date(lastUri.timestamp);
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            const search = lastUri.path.includes('?')
                ? ' ' + lastUri.path.slice(lastUri.path.indexOf('?') + 1)
                : '';
            uriLink.textContent = `继续浏览 →${search} (${dateStr})`;
            container.appendChild(uriLink);
        }
        uriLink.href = lastUri.path;
    } else {
        if (uriLink) uriLink.remove();
    }
}

/** 在清单详情页标题中注入/更新阅读进度下拉框和星级评分。对应原 L680-725。 */
export function ensureHeaderWidgets(plugin: ListReadingStatusPlugin): void {
    if (plugin.isProcessing) return;
    plugin.isProcessing = true;

    const m = location.pathname.match(/\/lists\/([^/]+)$/);
    if (!m) {
        plugin.isProcessing = false;
        return;
    }
    const listId = 'list-' + m[1];

    saveLastUri(listId);

    const h2 = document.querySelector(
        'body > section > div > div.columns.is-mobile.section-columns > div > h2'
    ) as HTMLElement | null;
    if (!h2) {
        plugin.isProcessing = false;
        return;
    }

    let select = h2.querySelector('.list-reading-dropdown') as HTMLSelectElement | null;
    if (select) {
        select.value = isRead(listId) ? 'read' : 'unread';
        updateSelectAppearance(select);
    } else {
        select = createDropdown(plugin, listId);
        h2.prepend(select);
    }

    let stars = h2.querySelector('.list-rating-stars') as HTMLElement | null;
    if (stars) {
        renderStars(stars, getRating(listId));
    } else {
        stars = createStarWidget(plugin, listId);
        h2.prepend(stars);
    }

    Promise.resolve().then(() => {
        plugin.isProcessing = false;
    });
}

/** 遍历 #lists > ul 下的所有 li 并注入/更新下拉框和星级评分。对应原 L731-753。 */
export function processAllItems(plugin: ListReadingStatusPlugin): boolean {
    if (plugin.isProcessing) return false;
    plugin.isProcessing = true;

    const ul = document.querySelector('#lists > ul');
    if (!ul) {
        plugin.isProcessing = false;
        return false;
    }

    const items = ul.querySelectorAll(':scope > li');
    items.forEach((li: Element) => ensureWidgets(plugin, li));

    plugin.applySortAndFilter();

    Promise.resolve().then(() => {
        plugin.isProcessing = false;
    });

    return items.length > 0;
}
