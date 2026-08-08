/**
 * MissAV 列表页瀑布流 —— 下一页抓取模块。
 *
 * fetchNextPage：GM_xmlhttpRequest 抓取下一页 HTML → DOMParser 解析 →
 * 提取缩略图 → 番号去重检查 → 追加到容器 → 更新 nextUrl 与分页状态机。
 * 与 list-waterfall/lw-fetch.ts 的 loadNextPage 模式一致，但选择器与去重
 * 策略换用 map-selectors.ts（番号去重）。
 */
import type { MissavAutoPagePlugin } from './missav-auto-page-plugin';
import { collectCarNums, extractThumbs, findNextUrl } from './map-selectors';

/**
 * 发起 GM_xmlhttpRequest GET 请求。参考 list-waterfall/lw-fetch.ts 的 gmGet。
 *
 * @param url 请求 URL
 * @returns Promise<string> responseText；非 2xx / 网络错误 / 超时均 reject
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
 * 加载下一页：抓取 HTML → 解析 → 去重 → 追加缩略图 → 更新 nextUrl。
 *
 * @param plugin MissavAutoPagePlugin 实例
 * @returns Promise<void>；抓取失败时切换错误态，不抛出
 */
export async function fetchNextPage(plugin: MissavAutoPagePlugin): Promise<void> {
    if (!plugin.pagination.canLoad || !plugin.nextUrl) return;
    plugin.pagination.startLoading();
    plugin.setLoader('loading', '加载中...');
    try {
        const html = await gmGet(plugin.nextUrl);
        const doc = new DOMParser().parseFromString(String(html), 'text/html');
        const thumbs = extractThumbs(doc);
        if (thumbs.length === 0) throw new Error('下一页无缩略图');
        const carNums = collectCarNums(thumbs);
        // 去重检查：若下一页第一个番号已加载过，视为重复数据，停止瀑布流
        if (carNums.length > 0 && plugin.loadedCarNums.has(carNums[0])) {
            plugin.nextUrl = null;
            plugin.pagination.loadSuccess(false);
            plugin.setLoader('no-more', '已经到底了');
            return;
        }
        carNums.forEach((c) => c && plugin.loadedCarNums.add(c));
        const fragment = document.createDocumentFragment();
        thumbs.forEach((t) => fragment.appendChild(t));
        plugin.container!.appendChild(fragment);
        const next = findNextUrl(doc);
        plugin.nextUrl = next;
        plugin.pagination.loadSuccess(!!next);
        plugin.setLoader('', '');
        if (!plugin.nextUrl) plugin.setLoader('no-more', '已经到底了');
    } catch (err) {
        clog.error('[MissAV 瀑布流] 加载失败:', err);
        plugin.pagination.loadError();
        plugin.setLoader('error', '加载失败，点击重试');
    }
}