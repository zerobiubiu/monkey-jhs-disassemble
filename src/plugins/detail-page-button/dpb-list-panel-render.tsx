/**
 * 详情页清单面板条目渲染与加载/错误态展示。
 * 从 dpb-list-panel.tsx 提取，逻辑与原实现一致。
 */
import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import { ListPanelSkeletonSpan } from '../../components/dpb/list-panel-skeleton-span';

import type { DetailListEntry, DetailListPanelElement } from './dpb-list-panel';

/** 将 JavDB 原始 p.control 克隆整理为名称、数量分列的整行可点击选项。 */
export function createListPanelEntry(plugin: DetailPageButtonPlugin, source: Element): DetailListEntry | null {
    const element = source.cloneNode(true) as HTMLElement;
    const label = (element.matches('label') ? element : element.querySelector('label')) as
        | HTMLLabelElement
        | null;
    const input = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const originalCount = label?.querySelector('span') || null;
    const listId = input?.dataset.listId || '';
    if (!label || !input || !listId) return null;
    input.removeAttribute('id');
    input.removeAttribute('name');
    input.removeAttribute('data-action');
    label.removeAttribute('for');

    const name =
        Array.from(label.childNodes)
            .filter((node) => node !== input && node !== originalCount)
            .map((node) => node.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim() || '未命名清单';
    const countMatch = originalCount?.textContent?.match(/\d+/);
    const count = countMatch ? Number(countMatch[0]) : null;
    const nameElement = document.createElement('span');
    nameElement.className = 'jhs-list-item__name';
    nameElement.textContent = name;
    nameElement.title = name;
    const countElement = document.createElement('span');
    countElement.className = 'jhs-list-item__count';
    countElement.textContent = count === null ? '—' : String(count);
    countElement.title = count === null ? '影片数量未知' : `清单内 ${count} 部影片`;
    countElement.setAttribute(
        'aria-label',
        count === null ? '影片数量未知' : `${count} 部影片`
    );
    const statusElement = document.createElement('span');
    statusElement.className = 'jhs-list-item__status';
    statusElement.setAttribute('aria-live', 'polite');
    statusElement.setAttribute('aria-atomic', 'true');
    statusElement.hidden = true;

    element.classList.add('jhs-list-item');
    element.dataset.listId = listId;
    element.dataset.listName = name;
    label.classList.add('jhs-list-item__label');
    label.replaceChildren(input, nameElement, countElement, statusElement);
    plugin._updateListPanelEntryState(input);
    return { element };
}

/** 恢复初始骨架，用于用户点击重试。 */
export function showListPanelLoading(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement): void {
    const items = panel.querySelector('.jhs-list-panel__items');
    const summary = panel.querySelector('.jhs-list-panel__summary');
    const empty = panel.querySelector('.jhs-list-panel__empty') as HTMLElement | null;
    const search = panel.querySelector('.jhs-list-panel__search') as HTMLInputElement | null;
    const sort = panel.querySelector('.jhs-list-panel__sort-select') as HTMLSelectElement | null;
    const clear = panel.querySelector('.jhs-list-panel__search-clear') as HTMLElement | null;
    plugin._clearListPanelNotice(panel);
    if (summary) summary.textContent = '正在读取…';
    if (empty) empty.hidden = true;
    if (search) search.disabled = true;
    if (sort) sort.disabled = true;
    if (clear) clear.hidden = true;
    if (items) {
        if (items.getAttribute('aria-busy') === 'true' && items.firstElementChild) return;
        items.setAttribute('aria-busy', 'true');
        items.innerHTML = Array.from(
            { length: 4 },
            () => jsxToString(<ListPanelSkeletonSpan />)
        ).join('');
    }
}

/** 展示可重试错误态，避免初始化失败时面板静默消失。 */
export function showListPanelError(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement, message: string): void {
    const items = panel.querySelector('.jhs-list-panel__items');
    const summary = panel.querySelector('.jhs-list-panel__summary');
    const search = panel.querySelector('.jhs-list-panel__search') as HTMLInputElement | null;
    const sort = panel.querySelector('.jhs-list-panel__sort-select') as HTMLSelectElement | null;
    const clear = panel.querySelector('.jhs-list-panel__search-clear') as HTMLElement | null;
    plugin._clearListPanelNotice(panel);
    if (summary) summary.textContent = '读取失败';
    if (search) search.disabled = true;
    if (sort) sort.disabled = true;
    if (clear) clear.hidden = true;
    if (!items) return;
    items.setAttribute('aria-busy', 'false');
    items.replaceChildren();
    const state = document.createElement('div');
    state.className = 'jhs-list-panel__error';
    state.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'jhs-list-panel__retry';
    retry.dataset.listPanelRetry = 'true';
    retry.textContent = '重新加载';
    state.append(text, retry);
    items.appendChild(state);
}
