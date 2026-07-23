/**
 * 详情页清单平铺面板功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import { ListPanel } from '../../components/dpb/list-panel';
import { ListPanelSkeletonSpan } from '../../components/dpb/list-panel-skeleton-span';

type DetailListSort = 'name-desc' | 'name-asc';

export interface DetailListPanelElement extends HTMLElement {
    __jhsListControlsBound?: boolean;
    __jhsRefresh?: () => void;
    __jhsNotice?: string;
    __jhsNoticeTimer?: number;
}

export interface DetailListEntry {
    element: HTMLElement;
}

const DETAIL_LIST_COLLATOR = new Intl.Collator('zh-CN', {
    numeric: true,
    sensitivity: 'base'
});
const LIST_PANEL_INIT_TIMEOUT_MS = 10000;
const LIST_PANEL_PAGE_TIMEOUT_MS = 10000;
const LIST_PANEL_MAX_PAGES = 50;

/**
 * 轮询等待 #otherSiteBox 出现后创建清单面板、初始化并绑定交互。
 * 对应原 L5637-5681，展示顺序只作用于克隆面板，服务端映射始终按 listId。
 * @param nav nav 容器
 */
export function ensureListPanel(plugin: DetailPageButtonPlugin, nav: HTMLElement): void {
    if (plugin._listPanelEnsured) return;
    const otherSite = nav.querySelector('#otherSiteBox') as HTMLElement | null;
    if (!otherSite) {
        setTimeout(() => plugin._ensureListPanel(nav), 400);
        return;
    }
    plugin._listPanelEnsured = true;
    if (!nav.querySelector('.jhs-list-panel')) {
        otherSite.insertAdjacentHTML('afterend', jsxToString(<ListPanel />));
    }
    const listPanel = nav.querySelector('.jhs-list-panel') as DetailListPanelElement | null;
    if (!listPanel) return;
    plugin._bindListPanelControls(listPanel);
    listPanel.__jhsRefresh = () => plugin._scheduleListPanelSync(0);
    plugin._initListPanel();
}

/** 绑定搜索、排序、重试与 checkbox 委托；面板重绘不会销毁这些控件。 */
export function bindListPanelControls(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement): void {
    if (panel.__jhsListControlsBound) return;
    panel.__jhsListControlsBound = true;

    const search = panel.querySelector('.jhs-list-panel__search') as HTMLInputElement | null;
    const sort = panel.querySelector('.jhs-list-panel__sort-select') as HTMLSelectElement | null;
    const clear = panel.querySelector(
        '.jhs-list-panel__search-clear'
    ) as HTMLButtonElement | null;

    search?.addEventListener('input', () => plugin._applyListPanelView(panel));
    sort?.addEventListener('change', () => plugin._applyListPanelView(panel));
    clear?.addEventListener('click', () => {
        if (!search) return;
        search.value = '';
        search.focus();
        plugin._applyListPanelView(panel);
    });

    panel.addEventListener('click', (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest('[data-list-panel-retry]')) return;
        plugin._listPanelIniting = false;
        plugin._showListPanelLoading(panel);
        plugin._initListPanel(true);
    });

    panel.addEventListener('change', (event: Event) => {
        const displayInput = event.target;
        if (!(displayInput instanceof HTMLInputElement) || displayInput.type !== 'checkbox') {
            return;
        }
        plugin._forwardListPanelChange(panel, displayInput);
    });
}

/** 将展示 checkbox 按 data-list-id 映射到隐藏 modal 的权威 checkbox。 */
export function forwardListPanelChange(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement, displayInput: HTMLInputElement): void {
    const checkedBeforeMutation = !displayInput.checked;
    const listId = displayInput.dataset.listId;
    const listContainer = document.querySelector(
        '#modal-save-list [data-list-target="listContainer"]'
    );
    const sourceInput = listId
        ? ((Array.from(
              listContainer?.querySelectorAll<HTMLInputElement>(
                  'input[type="checkbox"][data-list-id]'
              ) || []
          ).find((input) => input.dataset.listId === listId) as HTMLInputElement | undefined) ??
          null)
        : null;

    if (!sourceInput || sourceInput.disabled) {
        displayInput.checked = checkedBeforeMutation;
        plugin._applyListPanelView(panel);
        const message = '清单状态已变化，已恢复原选择，请稍后重试';
        plugin._showListPanelNotice(panel, message);
        show.error(message, { duration: 3000 });
        plugin._scheduleListPanelSync(80);
        return;
    }

    sourceInput.checked = displayInput.checked;
    sourceInput.dispatchEvent(new Event('change', { bubbles: true }));
    plugin._applyListPanelView(panel);
}

/**
 * 初始化清单面板：触发原生 ajax，并观察稳定的 modal 外壳。即使 JavDB 替换
 * listContainer，重绘时也会重新读取最新节点。
 */
export function initListPanel(plugin: DetailPageButtonPlugin, forceReload = false): void {
    if (plugin._listPanelIniting) return;
    plugin._listPanelIniting = true;
    const startedAt = Date.now();
    const ensure = () => {
        const btn = document.querySelector('#save-list-button') as HTMLElement | null;
        const modal = document.querySelector('#modal-save-list') as HTMLElement | null;
        const panel = document.querySelector('.jhs-list-panel') as DetailListPanelElement | null;
        if (!panel) return;
        if (!btn || !modal) {
            if (Date.now() - startedAt >= LIST_PANEL_INIT_TIMEOUT_MS) {
                plugin._listPanelIniting = false;
                plugin._showListPanelError(panel, '清单加载失败，请重试');
                return;
            }
            setTimeout(ensure, 400);
            return;
        }

        if (!plugin._listPanelObserver) {
            plugin._listPanelObserver = new MutationObserver((mutations) => {
                const removedListEntries = mutations.some(
                    (mutation) =>
                        mutation.type === 'childList' &&
                        Array.from(mutation.removedNodes).some(
                            (node) =>
                                node instanceof Element &&
                                (node.matches('input[data-list-id]') ||
                                    Boolean(node.querySelector('input[data-list-id]')))
                        )
                );
                if (removedListEntries) {
                    plugin._listPanelPaginationGeneration++;
                    const currentContainer = document.querySelector(
                        '#modal-save-list [data-list-target="listContainer"]'
                    ) as HTMLElement | null;
                    if (currentContainer) delete currentContainer.dataset.jhsPagesStatus;
                }
                const onlyInputStateChanged = mutations.every(
                    (mutation) =>
                        mutation.type === 'attributes' &&
                        mutation.target instanceof HTMLInputElement
                );
                if (onlyInputStateChanged) {
                    for (const mutation of mutations) {
                        plugin._syncListPanelInputState(mutation.target as HTMLInputElement);
                    }
                    const currentPanel = document.querySelector(
                        '.jhs-list-panel'
                    ) as DetailListPanelElement | null;
                    if (currentPanel) plugin._applyListPanelView(currentPanel);
                    return;
                }
                plugin._scheduleListPanelSync();
            });
            plugin._listPanelObserver.observe(modal, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['checked', 'disabled']
            });
        }

        plugin._startListPanelLoadTimeout(panel);

        if (forceReload && plugin._listAjaxTriggered) {
            btn.click();
            setTimeout(() => btn.click(), 200);
        } else if (!plugin._listAjaxTriggered) {
            plugin._listAjaxTriggered = true;
            btn.click();
        }
        setTimeout(() => plugin._scheduleListPanelSync(0), 500);
    };
    ensure();
}

/** 属性变更只原位同步对应选项，避免请求 busy 状态切换时重建列表并丢失焦点。 */
export function syncListPanelInputState(plugin: DetailPageButtonPlugin, sourceInput: HTMLInputElement): void {
    const listId = sourceInput.dataset.listId;
    if (!listId) return;
    const displayInput = (Array.from(
        document.querySelectorAll<HTMLInputElement>(
            '.jhs-list-panel input[type="checkbox"][data-list-id]'
        )
    ).find((input) => input.dataset.listId === listId) || null) as HTMLInputElement | null;
    if (!displayInput) return;
    displayInput.checked = sourceInput.checked;
    displayInput.disabled = sourceInput.disabled;
    if (sourceInput.dataset.vltWasDisabled !== undefined) {
        displayInput.dataset.vltWasDisabled = sourceInput.dataset.vltWasDisabled;
        displayInput.setAttribute('aria-busy', 'true');
    } else {
        delete displayInput.dataset.vltWasDisabled;
        displayInput.removeAttribute('aria-busy');
    }
    plugin._updateListPanelEntryState(displayInput);
}

/** 同步展示条目的禁用原因，使用真实状态文字而不是仅依赖 hover title。 */
export function updateListPanelEntryState(input: HTMLInputElement): void {
    const label = input.closest('.jhs-list-item__label') as HTMLLabelElement | null;
    const status = label?.querySelector('.jhs-list-item__status') as HTMLElement | null;
    if (!label || !status) return;

    const countText = label.querySelector('.jhs-list-item__count')?.textContent || '';
    const countMatch = countText.match(/\d+/);
    const count = countMatch ? Number(countMatch[0]) : null;
    const busy = input.dataset.vltWasDisabled !== undefined;
    const state = busy
        ? 'busy'
        : input.disabled && count !== null && count >= 501 && !input.checked
          ? 'full'
          : input.disabled
            ? 'unavailable'
            : null;

    label.removeAttribute('title');
    status.hidden = state === null;
    if (state === null) {
        status.textContent = '';
        delete status.dataset.state;
    } else {
        status.dataset.state = state;
        status.textContent =
            state === 'busy' ? '同步中' : state === 'full' ? '已满' : '不可用';
    }
}

/** 合并连续 DOM 变化，避免 Stimulus 批量更新时反复清空清单和丢失焦点。 */
export function scheduleListPanelSync(plugin: DetailPageButtonPlugin, delay = 48): void {
    if (plugin._listPanelSyncTimer !== null) {
        window.clearTimeout(plugin._listPanelSyncTimer);
    }
    plugin._listPanelSyncTimer = window.setTimeout(() => {
        plugin._listPanelSyncTimer = null;
        plugin._renderListPanel();
    }, delay);
}

/** 从当前 modal 构建展示副本，统一完成过滤预设、名称自然排序和汇总刷新。 */
export function renderListPanel(plugin: DetailPageButtonPlugin): void {
    const panel = document.querySelector('.jhs-list-panel') as DetailListPanelElement | null;
    const listContainer = document.querySelector(
        '#modal-save-list [data-list-target="listContainer"]'
    );
    const itemsContainer = panel?.querySelector('.jhs-list-panel__items') as HTMLElement | null;
    if (!panel || !itemsContainer) return;
    if (!plugin._isListContainerLoaded(listContainer)) {
        plugin._showListPanelLoading(panel);
        plugin._startListPanelLoadTimeout(panel);
        return;
    }
    const nativeContainer = listContainer as HTMLElement;
    const pagesStatus = nativeContainer.dataset.jhsPagesStatus;
    if (!pagesStatus || pagesStatus === 'loading') {
        plugin._showListPanelLoading(panel);
        plugin._loadAllListPages(panel, nativeContainer);
        return;
    }
    panel.dataset.listCoverage = pagesStatus;

    const activeElement = document.activeElement;
    const activeListId =
        activeElement instanceof HTMLInputElement && itemsContainer.contains(activeElement)
            ? activeElement.dataset.listId
            : undefined;

    const entries = Array.from(listContainer.children)
        .filter((child) => !/[预預][设設]清[单單]/.test(child.textContent || ''))
        .map((child) => plugin._createListPanelEntry(child))
        .filter((entry): entry is DetailListEntry => entry !== null);

    itemsContainer.replaceChildren(...entries.map((entry) => entry.element));
    itemsContainer.setAttribute('aria-busy', 'false');
    plugin._clearListPanelLoadTimeout();
    plugin._listPanelIniting = false;
    const search = panel.querySelector('.jhs-list-panel__search') as HTMLInputElement | null;
    const sort = panel.querySelector('.jhs-list-panel__sort-select') as HTMLSelectElement | null;
    if (search) search.disabled = false;
    if (sort) sort.disabled = false;
    plugin._applyListPanelView(panel);

    if (activeListId) {
        const restoredInput = Array.from(
            itemsContainer.querySelectorAll<HTMLInputElement>(
                'input[type="checkbox"][data-list-id]'
            )
        ).find((input) => input.dataset.listId === activeListId);
        restoredInput?.focus({ preventScroll: true });
    }
}

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

/** 应用当前名称升降序与搜索条件，仅重排展示副本，不触碰 modal 源顺序。 */
export function applyListPanelView(panel: DetailListPanelElement): void {
    const itemsContainer = panel.querySelector('.jhs-list-panel__items') as HTMLElement | null;
    const sortSelect = panel.querySelector(
        '.jhs-list-panel__sort-select'
    ) as HTMLSelectElement | null;
    const searchInput = panel.querySelector(
        '.jhs-list-panel__search'
    ) as HTMLInputElement | null;
    const clearButton = panel.querySelector(
        '.jhs-list-panel__search-clear'
    ) as HTMLButtonElement | null;
    const summary = panel.querySelector('.jhs-list-panel__summary');
    const empty = panel.querySelector('.jhs-list-panel__empty') as HTMLElement | null;
    if (!itemsContainer || !sortSelect || !searchInput || !summary || !empty) return;

    const sort: DetailListSort = sortSelect.value === 'name-asc' ? 'name-asc' : 'name-desc';
    if (sortSelect.value !== sort) sortSelect.value = sort;
    const direction = sort === 'name-asc' ? 1 : -1;
    const items = Array.from(
        itemsContainer.querySelectorAll<HTMLElement>('.jhs-list-item')
    );
    items.sort((left, right) => {
        const nameResult = DETAIL_LIST_COLLATOR.compare(
            left.dataset.listName || '',
            right.dataset.listName || ''
        );
        if (nameResult !== 0) return nameResult * direction;
        return DETAIL_LIST_COLLATOR.compare(
            left.dataset.listId || '',
            right.dataset.listId || ''
        );
    });
    itemsContainer.append(...items);

    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    let selectedCount = 0;
    for (const item of items) {
        const input = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (input?.checked) selectedCount++;
        const visible = !query || (item.dataset.listName || '').toLocaleLowerCase().includes(query);
        item.hidden = !visible;
        if (visible) visibleCount++;
    }

    if (clearButton) clearButton.hidden = query.length === 0;
    const coverageSuffix = panel.dataset.listCoverage === 'partial' ? ' · 部分清单' : '';
    const summaryText = query
        ? `已加入 ${selectedCount} · 显示 ${visibleCount}/${items.length}${coverageSuffix}`
        : `已加入 ${selectedCount} / ${items.length}${coverageSuffix}`;
    summary.textContent = panel.__jhsNotice || summaryText;
    summary.classList.toggle('is-error', Boolean(panel.__jhsNotice));
    empty.hidden = visibleCount > 0;
    empty.textContent =
        items.length === 0
            ? '还没有自建清单，可在下方创建。'
            : `没有找到"${searchInput.value.trim()}"`;
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

/** 原生容器至少出现一个带 listId 的 checkbox 后，才视为 Ajax 已完成。 */
export function isListContainerLoaded(container: Element | null): container is Element {
    return Boolean(container?.querySelector('input[type="checkbox"][data-list-id]'));
}

/** 为初次载入及后续容器替换统一提供错误态与重试入口。 */
export function startListPanelLoadTimeout(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement): void {
    if (plugin._listPanelLoadTimer !== null) return;
    plugin._listPanelLoadTimer = window.setTimeout(() => {
        plugin._listPanelLoadTimer = null;
        const container = document.querySelector(
            '#modal-save-list [data-list-target="listContainer"]'
        );
        if (plugin._isListContainerLoaded(container)) return;
        plugin._listPanelIniting = false;
        plugin._showListPanelError(panel, '清单内容未能载入，请重试');
    }, LIST_PANEL_INIT_TIMEOUT_MS);
}

export function clearListPanelLoadTimeout(plugin: DetailPageButtonPlugin): void {
    if (plugin._listPanelLoadTimer === null) return;
    window.clearTimeout(plugin._listPanelLoadTimer);
    plugin._listPanelLoadTimer = null;
}

/**
 * 聚合清单接口的全部页，并把缺失原生条目补进隐藏 modal。展示层随后仍只按
 * data-list-id 映射到 modal checkbox，分页不会引入第二套写入链路。
 */
export function loadAllListPages(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement, container: HTMLElement): void {
    if (plugin._listPanelPaginationPromise) return;
    const videoId = window.location.pathname.match(/\/v\/([^/?#]+)/)?.[1];
    if (!videoId) {
        container.dataset.jhsPagesStatus = 'complete';
        plugin._scheduleListPanelSync(0);
        return;
    }

    container.dataset.jhsPagesStatus = 'loading';
    const generation = plugin._listPanelPaginationGeneration;
    plugin._listPanelPaginationPromise = plugin._fetchAllListPageEntries(videoId)
        .then((fetchedEntries) => {
            const currentContainer = document.querySelector(
                '#modal-save-list [data-list-target="listContainer"]'
            ) as HTMLElement | null;
            if (!currentContainer) throw new Error('原生清单容器已移除');
            if (
                generation !== plugin._listPanelPaginationGeneration ||
                currentContainer !== container
            ) {
                return;
            }

            const existingIds = new Set(
                Array.from(
                    currentContainer.querySelectorAll<HTMLInputElement>(
                        'input[type="checkbox"][data-list-id]'
                    )
                ).map((input) => input.dataset.listId)
            );
            const fragment = document.createDocumentFragment();
            for (const entry of fetchedEntries) {
                const input = entry.querySelector<HTMLInputElement>(
                    'input[type="checkbox"][data-list-id]'
                );
                const listId = input?.dataset.listId;
                if (!listId || existingIds.has(listId)) continue;
                existingIds.add(listId);
                fragment.appendChild(document.importNode(entry, true));
            }
            currentContainer.dataset.jhsPagesStatus = 'complete';
            currentContainer.appendChild(fragment);
        })
        .catch((error) => {
            if (generation !== plugin._listPanelPaginationGeneration) return;
            const currentContainer = document.querySelector(
                '#modal-save-list [data-list-target="listContainer"]'
            ) as HTMLElement | null;
            if (currentContainer) currentContainer.dataset.jhsPagesStatus = 'partial';
            console.warn('详情页清单分页聚合失败，将显示当前已加载内容', error);
            plugin._showListPanelNotice(panel, '部分清单未载入，排序与搜索仅覆盖已显示项');
        })
        .finally(() => {
            plugin._listPanelPaginationPromise = null;
            plugin._scheduleListPanelSync(0);
        });
}

/** 顺着接口返回的 rel=next 串行读取，限制页数、域名、路径与单页超时。 */
export async function fetchAllListPageEntries(videoId: string): Promise<Element[]> {
    const entries: Element[] = [];
    const visited = new Set<string>();
    let url: URL | null = new URL('/users/simple_lists', window.location.origin);
    url.searchParams.set('vid', videoId);

    while (url) {
        if (visited.size >= LIST_PANEL_MAX_PAGES) {
            throw new Error(`清单分页超过 ${LIST_PANEL_MAX_PAGES} 页`);
        }
        if (visited.has(url.href)) throw new Error('清单分页出现循环');
        visited.add(url.href);

        const payload = await (async () => {
            const controller = new AbortController();
            const timeout = window.setTimeout(
                () => controller.abort(),
                LIST_PANEL_PAGE_TIMEOUT_MS
            );
            try {
                const response = await fetch(url.href, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error(`清单分页请求失败：HTTP ${response.status}`);
                }
                return (await response.json()) as { lists?: unknown; page?: unknown };
            } finally {
                window.clearTimeout(timeout);
            }
        })();
        if (typeof payload.lists !== 'string') throw new Error('清单分页响应格式异常');
        const listDocument = new DOMParser().parseFromString(payload.lists, 'text/html');
        for (const child of Array.from(listDocument.body.children)) {
            if (child.querySelector('input[type="checkbox"][data-list-id]')) {
                entries.push(child);
            }
        }

        const pageHtml = typeof payload.page === 'string' ? payload.page : '';
        const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
        const nextHref = pageDocument.querySelector('a[rel="next"]')?.getAttribute('href');
        if (!nextHref) {
            url = null;
            continue;
        }
        const nextUrl: URL = new URL(nextHref, url.href);
        if (
            nextUrl.origin !== window.location.origin ||
            nextUrl.pathname !== '/users/simple_lists'
        ) {
            throw new Error('清单下一页地址异常');
        }
        nextUrl.searchParams.set('vid', videoId);
        url = nextUrl;
    }
    return entries;
}

/** 在 aria-live 汇总区保留关键回滚提示，避免只依赖短暂 toast。 */
export function showListPanelNotice(plugin: DetailPageButtonPlugin, panel: DetailListPanelElement, message: string): void {
    if (panel.__jhsNoticeTimer !== undefined) {
        window.clearTimeout(panel.__jhsNoticeTimer);
    }
    panel.__jhsNotice = message;
    plugin._applyListPanelView(panel);
    panel.__jhsNoticeTimer = window.setTimeout(() => {
        delete panel.__jhsNotice;
        delete panel.__jhsNoticeTimer;
        plugin._applyListPanelView(panel);
    }, 3000);
}

export function clearListPanelNotice(panel: DetailListPanelElement): void {
    if (panel.__jhsNoticeTimer !== undefined) {
        window.clearTimeout(panel.__jhsNoticeTimer);
    }
    delete panel.__jhsNotice;
    delete panel.__jhsNoticeTimer;
    panel.querySelector('.jhs-list-panel__summary')?.classList.remove('is-error');
}
