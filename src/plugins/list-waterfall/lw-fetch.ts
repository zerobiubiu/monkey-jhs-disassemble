/**
 * 清单瀑布流翻页抓取 —— 从 list-waterfall-plugin.ts 拆出的 loadNextPage 方法
 * 及其依赖的纯工具函数（gmGet / findNextUrl / toAbsolute / rewriteItemLinks）。
 *
 * loadNextPage：GM_xmlhttpRequest 抓取下一页 HTML → DOMParser 解析 →
 * 提取 li → 去重 → append → 链接重写 → 替换分页 nav → 记录 pageItems。
 */
import type { ListWaterfallPlugin } from '../list-waterfall-plugin';

/** 日志前缀。 */
export const LOG_PREFIX = '[listWaterfall]';

/** 最大页数保护，防止异常情况无限加载。 */
const MAX_PAGES = 200;

/** 选择器配置。 */
export const SEL = {
    /** 清单列表容器 */
    box: '#lists > ul',
    /** 单个清单项 */
    item: '#lists > ul > li',
    /** 下一页链接（JavDB 全站通用） */
    nextLink: 'a.pagination-next',
    /** 分页 nav 容器 */
    paginationNav: 'nav.pagination',
    /** 清单项内的主链接（清单标题） */
    itemLink: 'div.column.is-10 > a'
};

/**
 * 在文档/节点中查找下一页链接 href。对应原 L180-183。
 *
 * @param doc Document 或 Element
 * @returns 下一页 href（相对或绝对），无则 null
 */
export function findNextUrl(doc: Document | Element): string | null {
    const a = doc.querySelector(SEL.nextLink) as HTMLAnchorElement | null;
    return a ? a.getAttribute('href') : null;
}

/**
 * 将相对 href 转为绝对 URL。对应原 L190-192。
 *
 * @param href 相对或绝对 href
 * @returns 绝对 URL
 */
export function toAbsolute(href: string): string {
    return new URL(href, location.href).href;
}

/**
 * 对新追加的 li 应用链接重写（与 ModMyListOpenWay 行为保持一致）。对应原 L201-213。
 * - 设置 target="_blank"（新窗口打开）
 * - /users/list_detail?id=xxx → /lists/xxx（短地址）
 * - /lists/xxx 保持不变
 *
 * @param container 含新 li 的容器节点
 */
function rewriteItemLinks(container: Element): void {
    container.querySelectorAll(SEL.itemLink).forEach((a: Element) => {
        const anchor = a as HTMLAnchorElement;
        anchor.target = '_blank';
        const href = anchor.getAttribute('href') || '';
        // 已是 /lists/xxx 短地址，无需重写
        if (/^\/lists\/[^/]+$/.test(href)) return;
        // /users/list_detail?id=xxx → /lists/xxx
        const m = href.match(/[?&]id=([^&]+)/);
        if (m) {
            anchor.href = `/lists/${m[1]}`;
        }
    });
}

/**
 * 发起 GM_xmlhttpRequest GET 请求。对应原 L220-237。
 *
 * @param url 请求 URL
 * @returns Promise<string> responseText
 */
function gmGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 30000,
            onload: (resp: { status: number; responseText: string }) => {
                if (resp.status >= 200 && resp.status < 300) {
                    resolve(resp.responseText);
                } else {
                    reject(new Error(`HTTP ${resp.status}`));
                }
            },
            onerror: () => reject(new Error('network error')),
            ontimeout: () => reject(new Error('timeout'))
        });
    });
}

/**
 * 设置状态条样式与文本。对应原 L463-467。
 *
 * @param plugin ListWaterfallPlugin 实例
 * @param cls 状态类名：loading/error/no-more/空
 * @param text 显示文本
 */
export function setState(plugin: ListWaterfallPlugin, cls: string, text: string): void {
    if (!plugin.loader) return;
    plugin.loader.className = `jdb-wf-loader ${cls}`.trim();
    plugin.loader.textContent = text;
}

/**
 * 加载下一页：请求 HTML → 解析 → 追加 li → 更新分页。对应原 L339-427。
 *
 * @param plugin ListWaterfallPlugin 实例
 * @returns Promise<void>；抓取失败时切换错误态，不抛出
 */
export async function loadNextPage(plugin: ListWaterfallPlugin): Promise<void> {
    if (plugin.isLoading || !plugin.nextUrl || !plugin.hasMore) return;
    if (plugin.currentPage >= MAX_PAGES) {
        setState(plugin, 'no-more', `已达最大页数 ${MAX_PAGES}，停止加载`);
        plugin.hasMore = false;
        return;
    }
    plugin.isLoading = true;
    setState(plugin, 'loading', '加载中...');

    try {
        const html = await gmGet(plugin.nextUrl);
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const remoteUl = doc.querySelector(SEL.box);
        if (!remoteUl) {
            throw new Error('下一页未找到列表容器');
        }

        // 抽取下一页所有 li
        const newLis = Array.from(remoteUl.children).filter(
            (li: Element) => li.tagName === 'LI'
        );

        // 去重检查：若下一页第一个 li 的 id 已存在于当前页，视为重复，停止
        if (
            newLis.length > 0 &&
            (newLis[0] as HTMLElement).id &&
            plugin.loadedIds.has((newLis[0] as HTMLElement).id)
        ) {
            plugin.hasMore = false;
            plugin.nextUrl = null;
            setState(plugin, 'no-more', '已经到底了');
            console.log(`${LOG_PREFIX} 检测到重复数据，停止瀑布流`);
            return;
        }

        // 记录追加前的容器高度，用于 pageItems 滚动定位
        const topBefore = plugin.container!.scrollHeight;

        // 追加新 li 到当前容器
        const fragment = document.createDocumentFragment();
        newLis.forEach((li: Element) => {
            if (li.id) plugin.loadedIds.add(li.id);
            fragment.appendChild(li);
        });
        plugin.container!.appendChild(fragment);

        // 对新追加的 li 应用链接重写（target=_blank + 短地址）
        rewriteItemLinks(plugin.container!);

        // 记录本页滚动定位
        plugin.currentPage += 1;
        plugin.pageItems.push({
            page: plugin.currentPage,
            top: topBefore,
            url: plugin.nextUrl
        });

        // 更新下一页链接
        const nextHref = findNextUrl(doc);
        plugin.nextUrl = nextHref ? toAbsolute(nextHref) : null;
        plugin.hasMore = !!plugin.nextUrl;

        // 替换页面上的分页 nav（保持与当前页同步）
        const remoteNav = doc.querySelector(SEL.paginationNav);
        if (remoteNav) {
            const currentNav = document.querySelector(SEL.paginationNav);
            if (currentNav) {
                currentNav.replaceWith(remoteNav);
            }
        }

        setState(plugin, '', '');
        if (!plugin.hasMore) {
            setState(plugin, 'no-more', '已经到底了');
        }
        console.log(
            `${LOG_PREFIX} 已加载第 ${plugin.currentPage} 页，追加 ${newLis.length} 项`
        );
    } catch (err) {
        clog.error(`${LOG_PREFIX} 加载失败:`, err);
        setState(plugin, 'error', '加载失败，点击重试');
    } finally {
        plugin.isLoading = false;
    }
}
