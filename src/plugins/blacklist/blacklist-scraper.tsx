/**
 * 演员黑名单递归抓取（提取自 blacklist-plugin.tsx）。
 *
 * filterAllVideo + filterActorVideo + parseAndSaveFilterInfo：递归遍历演员/分类
 * 作品列表页，将番号写入鉴定记录或黑名单番号列表；JavDb 站点超过 60 页时走
 * Beyond60Plugin 合并请求。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 BlacklistPlugin（运行期擦除）。
 */
import { JAVDB, isJavdbSite } from '../../constants/site';
import { FILTER_ACTION } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';
import { failWithToast } from '../../core/toast';
import type { CarSaveInput } from '../../core/storage-manager';

import type { BasePlugin } from '../base-plugin';
import type { BlacklistPlugin } from '../blacklist-plugin';

import { MovieListWrapper } from '../../components/movie/movie-list-wrapper';

/**
 * 递归遍历演员作品列表页，将每个番号写入鉴定记录（屏蔽动作）。
 * 对应原 L7812-7865。
 *
 * @param plugin BlacklistPlugin 实例（取选择器、getBean ListPagePlugin）
 * @param names 演员名（写入 saveCar.names）
 * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
 */
export async function filterAllVideo(
    plugin: BlacklistPlugin,
    names: string,
    $dom?: JQuery
): Promise<void> {
    let items: JQuery;
    let nextPageHref: string | undefined;
    if ($dom) {
        items = $dom.find(plugin.getSelector().requestDomItemSelector);
        nextPageHref = $dom.find(plugin.getSelector().nextPageSelector).attr('href');
    } else {
        items = $(plugin.getSelector().itemSelector);
        nextPageHref = $(plugin.getSelector().nextPageSelector).attr('href');
    }
    if (nextPageHref && items.length === 0) {
        failWithToast('解析列表失败');
    }
    for (const itemEl of items) {
        const $item = $(itemEl);
        const { carNum, url, publishTime } =
            plugin.getBean('ListPagePlugin').findCarNumAndHref($item);
        if (url && carNum) {
            try {
                if (await storageManager.getCar(carNum)) {
                    continue;
                }
                await storageManager.saveCar({
                    carNum,
                    url,
                    names,
                    actionType: FILTER_ACTION,
                    publishTime
                });
                clog.log('屏蔽演员番号', names, carNum);
            } catch (error: unknown) {
                clog.error(`保存失败 [${carNum}]:`, error);
            }
        }
    }
    if (nextPageHref) {
        show.info('请不要关闭窗口, 正在解析下一页:' + nextPageHref);
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        const pageHtml = await gmHttp.get(nextPageHref);
        const domParser = new DOMParser();
        const $parsed = $(domParser.parseFromString(String(pageHtml), 'text/html'));
        await filterAllVideo(plugin, names, $parsed);
    } else {
        show.ok('执行结束!');
        refresh();
    }
}

/**
 * 递归抓取演员番号并批量写入黑名单番号列表（用于 addBlacklist 后的屏蔽）。
 * JavDb 站点页码超过 60 时改走 Beyond60Plugin 合并请求。对应原 L7866-7893。
 *
 * @param plugin BlacklistPlugin 实例（读写 nextPageLink/lastPageLink、getBean）
 * @param name 演员名
 * @param starId 演员 starId
 * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
 */
export async function filterActorVideo(
    plugin: BlacklistPlugin,
    name: string,
    starId: string | null,
    $dom?: JQuery
): Promise<void> {
    const { nextPageLink } = await parseAndSaveFilterInfo(plugin, $dom, name, starId);
    plugin.nextPageLink = nextPageLink;
    if (nextPageLink) {
        let nextDom: JQuery;
        plugin.lastPageLink = nextPageLink;
        show.info('请不要关闭窗口, 正在解析下一页:' + nextPageLink);
        const pageNum = utils.getUrlParam(nextPageLink, 'page') || 0;
        // Beyond60Plugin 从未注册（忠实死路径），类型仅为编译通过
        const beyond60Plugin = plugin.getBean('Beyond60Plugin') as (BasePlugin & {
            handleBeyond60(url: string): Promise<{ html: string; nextUrl: string; hasMore: boolean }>;
        }) | undefined;
        if (isJavdbSite && beyond60Plugin && Number(pageNum) > 60) {
            const {
                html,
                nextUrl,
                hasMore: _hasMore
            } = await beyond60Plugin.handleBeyond60(nextPageLink);
            const wrapperHtml = jsxToString(<MovieListWrapper html={html} nextUrl={nextUrl} />);
            nextDom = utils.htmlTo$dom(wrapperHtml);
        } else {
            clog.log('正在请求下一页内容:', nextPageLink);
            const pageHtml = await gmHttp.get(nextPageLink);
            nextDom = utils.htmlTo$dom(String(pageHtml));
        }
        await filterActorVideo(plugin, name, starId, nextDom);
    } else {
        show.ok('执行结束!');
        refresh();
    }
}

/**
 * 解析一页 DOM 中的番号列表并批量保存到黑名单番号列表，返回下一页链接与
 * 首条发行时间。对应原 L7894-7950。
 *
 * @param plugin BlacklistPlugin 实例（取选择器、getBean ListPagePlugin）
 * @param $dom 已解析页 DOM；缺省时从当前页选择器取
 * @param names 演员名（写入 carList.names）
 * @param starId 演员 starId（写入 carList.starId）
 * @returns nextPageLink 下一页 href（无则为 undefined）；lastPublishTime 首条发行时间
 */
export async function parseAndSaveFilterInfo(
    plugin: BlacklistPlugin,
    $dom: JQuery | undefined,
    names: string,
    starId: string | null
): Promise<{ nextPageLink: string | undefined; lastPublishTime: string | null }> {
    let items: JQuery;
    let nextPageHref: string | undefined;
    if ($dom) {
        const siteType = JAVDB;
        items = $dom.find(plugin.getSelector(siteType).requestDomItemSelector);
        nextPageHref = $dom.find(plugin.getSelector(siteType).nextPageSelector).attr('href');
    } else {
        items = $(plugin.getSelector().itemSelector);
        nextPageHref = $(plugin.getSelector().nextPageSelector).attr('href');
    }
    if (nextPageHref && items.length === 0) {
        return {
            nextPageLink: undefined,
            lastPublishTime: null
        };
    }
    const carList: CarSaveInput[] = [];
    let lastPublishTime: string | null = null;
    for (const itemEl of items) {
        const $item = $(itemEl);
        const { carNum, url, publishTime } =
            plugin.getBean('ListPagePlugin').findCarNumAndHref($item);
        lastPublishTime ||= publishTime;
        if (url && carNum) {
            carList.push({
                carNum,
                url,
                names,
                actionType: FILTER_ACTION,
                starId: starId ?? undefined,
                publishTime
            });
        }
    }
    try {
        await storageManager.batchSaveBlacklistCarList(carList);
    } catch (error: unknown) {
        clog.error('保存失败:', error);
    }
    return {
        nextPageLink: nextPageHref,
        lastPublishTime
    };
}
