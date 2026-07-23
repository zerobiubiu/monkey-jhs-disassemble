/**
 * 详情页清单面板服务端分页抓取与数据聚合。
 * 从 dpb-list-panel.tsx 提取，逻辑与原实现一致。
 */
import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import type { DetailListPanelElement } from './dpb-list-panel';

const LIST_PANEL_PAGE_TIMEOUT_MS = 10000;
const LIST_PANEL_MAX_PAGES = 50;

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
