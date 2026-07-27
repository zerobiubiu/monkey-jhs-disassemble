/**
 * 编号清单整理数据层（doc/202，期1 只读）：/users/lists 组发现 + /lists/{id} 影片枚举。
 *
 * 全部用页面内原生 fetch（same-origin，继承浏览器登录态与 Cloudflare 通行态），
 * 仅 GET 读取，不写任何数据。分页跟随全站通用 a.pagination-next。
 */
import { isMergeExcluded, parseListName } from '../detail-page-button/dpb-list-merge';
import type { ListMergeConfig } from '../detail-page-button/dpb-list-merge';

import type { DiscoveredList, ReflowGroup, ReflowList } from './lr-types';

/** 最大翻页保护，防异常无限加载。 */
const MAX_PAGES = 200;

/**
 * 原生 fetch 读取文本（same-origin）。
 * @param url 目标 URL
 * @returns 响应文本
 * @throws 非 2xx 时抛出 Error
 */
export async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
}

/** 取下一页绝对 URL（全站 a.pagination-next），无则 null。 */
function absoluteNextUrl(doc: Document, baseUrl: string): string | null {
    const next = doc.querySelector('a.pagination-next') as HTMLAnchorElement | null;
    const href = next?.getAttribute('href');
    if (!href) return null;
    return new URL(href, baseUrl).href;
}

/**
 * 从清单链接 href 提取清单 ID。
 *
 * 原始 JavDB `/users/lists` 页的清单标题链接 href 为 `?id=xxx` 查询参形式
 * （如 `/users/list_detail?id=xxx`），`/lists/xxx` 是客户端改写后的短地址
 * （见 modMyListOpenWay）。故优先取 `?id=` 参，同时兼容 `/lists/xxx` 路径形式。
 *
 * @param href 链接 href（相对或绝对）
 * @returns 清单 ID；无法解析时返回 null
 */
function extractListId(href: string): string | null {
    const pathMatch = href.match(/\/lists\/([^/?#]+)/);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
    try {
        const id = new URL(href, window.location.origin).searchParams.get('id');
        return id || null;
    } catch {
        return null;
    }
}

/** 当前清单详情页的清单 ID（非 /lists/{id} 返回 null）。 */
export function getCurrentListId(): string | null {
    return window.location.pathname.match(/\/lists\/([^/?#]+)/)?.[1] ?? null;
}

/**
 * 抓取 /users/lists 全部清单（分页）。
 * @returns 清单列表（listId / 名称 / 数量）
 */
export async function fetchAllUserLists(): Promise<DiscoveredList[]> {
    const lists: DiscoveredList[] = [];
    const seenIds = new Set<string>();
    let url: string | null = new URL('/users/lists', window.location.origin).href;
    const visited = new Set<string>();

    for (let page = 0; url && page < MAX_PAGES; page++) {
        if (visited.has(url)) break;
        visited.add(url);
        const html = await fetchText(url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('#lists > ul > li');
        items.forEach((li) => {
            // 标题链接：div.column.is-10 > a（modMyListOpenWay / list-waterfall 验证），
            // 其原始 href 为 ?id=xxx 形式，非 /lists/xxx
            const anchor = (li.querySelector('div.column.is-10 > a') ||
                li.querySelector('a')) as HTMLAnchorElement | null;
            if (!anchor) return;
            const listId = extractListId(anchor.getAttribute('href') || '');
            if (!listId || listId === 'users' || listId === 'new' || seenIds.has(listId)) return;
            seenIds.add(listId);
            const text = (anchor.textContent || '').trim();
            const countMatch = text.match(/\((\d+)\)\s*$/);
            const count = countMatch ? Number(countMatch[1]) : null;
            const name = text.replace(/\s*\(\d+\)\s*$/, '').trim();
            if (name) lists.push({ listId, name, count });
        });
        url = absoluteNextUrl(doc, url);
    }
    return lists;
}

/**
 * 从全部清单中发现当前清单所属编号组。
 *
 * 规则与 doc/200 合并一致：当前清单名可解析出 base+num 且未被排除时成组；
 * 同 base 的序号清单 + 裸名（完整名 == base，num=0）一并纳入，按序号升序。
 *
 * @param currentListId 当前清单 ID
 * @param allLists /users/lists 全部清单
 * @param config 合并配置（复用 listMergePattern / listMergeExcludeNames）
 * @returns 编号组；当前清单非编号组成员时返回 null
 */
export function discoverGroup(
    currentListId: string,
    allLists: DiscoveredList[],
    config: ListMergeConfig
): ReflowGroup | null {
    const current = allLists.find((l) => l.listId === currentListId);
    if (!current) return null;
    const parsed = parseListName(current.name, config.pattern);
    if (!parsed || isMergeExcluded(current.name, parsed.base, config)) return null;
    const base = parsed.base;

    const members: ReflowList[] = [];
    for (const list of allLists) {
        if (list.listId === currentListId) {
            members.push({ listId: list.listId, name: list.name, num: parsed.num, count: list.count });
            continue;
        }
        const p = parseListName(list.name, config.pattern);
        if (p && p.base === base && !isMergeExcluded(list.name, p.base, config)) {
            members.push({ listId: list.listId, name: list.name, num: p.num, count: list.count });
        } else if (list.name.trim() === base && !isMergeExcluded(list.name, null, config)) {
            members.push({ listId: list.listId, name: list.name, num: 0, count: list.count });
        }
    }
    members.sort((a, b) => (a.num !== b.num ? a.num - b.num : a.listId < b.listId ? -1 : 1));
    return { base, members };
}

/**
 * 枚举某清单内全部影片 ID（分页去重）。
 * @param listId 清单 ID
 * @returns 影片 ID 列表（页序；顺序不参与规划）
 */
export async function enumerateListVideos(listId: string): Promise<string[]> {
    const videoIds: string[] = [];
    const seen = new Set<string>();
    let url: string | null = new URL(`/lists/${listId}`, window.location.origin).href;
    const visited = new Set<string>();

    for (let page = 0; url && page < MAX_PAGES; page++) {
        if (visited.has(url)) break;
        visited.add(url);
        const html = await fetchText(url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.movie-list .item');
        items.forEach((item) => {
            const anchor = item.querySelector('a[href*="/v/"]') as HTMLAnchorElement | null;
            const href = anchor?.getAttribute('href') || '';
            const matched = href.match(/\/v\/([^/?#]+)/);
            if (!matched) return;
            const videoId = matched[1];
            if (!seen.has(videoId)) {
                seen.add(videoId);
                videoIds.push(videoId);
            }
        });
        url = absoluteNextUrl(doc, url);
    }
    return videoIds;
}
