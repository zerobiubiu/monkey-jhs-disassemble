/**
 * 瀑布流翻页抓取 —— 从 auto-page-plugin.ts 拆出的 loadNextPage 方法。
 *
 * 抓取并追加下一页：JavDb 站超过 60 页（c11 类目 30 页）或月度页时走
 * Beyond60Plugin；否则 gmHttp 抓取并校验重复番号后追加。
 */
import { currentHref, isJavdbSite } from '../../constants/site';

import type { BasePlugin } from '../base-plugin';
import type { AutoPagePlugin } from '../auto-page-plugin';

/**
 * 抓取并追加下一页。JavDb 站超过 60 页（c11 类目 30 页）或月度页时走
 * Beyond60Plugin；否则 gmHttp 抓取并校验重复番号后追加。对应原 L9145-9236。
 *
 * @param plugin AutoPagePlugin 实例
 * @returns Promise<void>；抓取失败时切换错误态，不抛出
 */
export async function loadNextPage(plugin: AutoPagePlugin): Promise<void> {
    if (!plugin.pagination.canLoad || !plugin.nextUrl) {
        return;
    }
    plugin.pagination.startLoading();
    plugin.setState('waterfall-loading', '加载中...');
    const selectorConfig = plugin.getSelector();
    try {
        const pageNum = utils.getUrlParam(plugin.nextUrl, 'page');
        let maxPage = 60;
        if (currentHref.includes('c11')) {
            maxPage = 30;
        }
        if ((isJavdbSite && Number(pageNum) > maxPage) || currentHref.includes('month')) {
            // Beyond60Plugin 从未注册（忠实死路径），类型仅为编译通过
            const beyond60Plugin = plugin.getBean('Beyond60Plugin') as (BasePlugin & {
                handleBeyond60(url: string): Promise<{ html: string; nextUrl: string; hasMore: boolean }>;
                createPagination(pageNum: number, hasMore: boolean): string;
            }) | undefined;
            if (beyond60Plugin) {
                const {
                    html,
                    nextUrl: beyondNextUrl,
                    hasMore: beyondHasMore
                } = await beyond60Plugin.handleBeyond60(plugin.nextUrl);
                if (html) {
                    const scrollHeight = plugin.container!.scrollHeight;
                    plugin.pageItems.push({
                        page: plugin.currentPage + 1,
                        top: scrollHeight,
                        url: plugin.nextUrl
                    });
                    $('.movie-list').append(html);
                }
                plugin.pagination.loadSuccess(beyondHasMore);
                plugin.nextUrl = beyondNextUrl;
                const paginationHtml = beyond60Plugin.createPagination(Number(pageNum), beyondHasMore);
                $('.pagination').html(paginationHtml);
                // 成功且仍可翻页时退出 loading，允许 click 模式下次触底重新显示按钮。
                plugin.setState('', '');
                if (!plugin.pagination.hasMore) {
                    plugin.setState('waterfall-no-more', '已经到底了');
                }
                return;
            }
        }
        const responseHtml = await gmHttp.get(plugin.nextUrl);
        clog.log('请求下一页内容:', plugin.nextUrl);
        const $dom = utils.htmlTo$dom(String(responseHtml));
        const items = $dom.find(plugin.getSelector().requestDomItemSelector);
        const existingList = plugin.getBoxCarInfoList();
        const newList = plugin.getBoxCarInfoList(items);
        if (plugin.checkDuplicateCarNumbers(existingList, newList)) {
            plugin.nextUrl = null;
            plugin.pagination.loadError();
            plugin.setState(
                'waterfall-error',
                '翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流'
            );
            return;
        }
        const scrollHeight = plugin.container!.scrollHeight;
        plugin.pageItems.push({
            page: plugin.currentPage + 1,
            top: scrollHeight,
            url: plugin.nextUrl
        });
        const listPagePlugin = plugin.getBean('ListPagePlugin');
        const coverImgs = $dom.find(plugin.getSelector().coverImgSelector);
        listPagePlugin.replaceHdImg(coverImgs);
        $(plugin.getSelector().boxSelector).append(items);
        const nextLinkEl = $dom.find(selectorConfig.nextPageSelector);
        plugin.nextUrl = nextLinkEl == null ? undefined : nextLinkEl.attr('href');
        plugin.pagination.loadSuccess(!!plugin.nextUrl);
        const paginationEl = $dom.find('.pagination');
        $('.pagination').replaceWith(paginationEl);
        // 成功后回到空闲态；否则 waterfall-loading 会永久阻断后续 checkLoad。
        plugin.setState('', '');
        if (!plugin.pagination.hasMore) {
            plugin.setState('waterfall-no-more', '已经到底了');
        }
    } catch (err) {
        clog.error('加载失败:', err);
        plugin.pagination.loadError();
        plugin.setState('waterfall-error', '加载失败，点击重试');
    } finally {
        // 点按钮模式：本页加载完若仍在底部，再次显示「点击加载下一页」
        if (plugin.loadMode === 'click' && plugin.pagination.hasMore && plugin.nextUrl) {
            plugin.checkLoad();
        }
    }
}
