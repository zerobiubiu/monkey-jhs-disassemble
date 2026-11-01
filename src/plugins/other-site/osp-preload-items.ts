import { siteQuery } from '../../core/util/site/selectors';

import type { OtherSitePlugin } from '../other-site-plugin';

/** 找出同番号的全部展示卡片，供任务去重后同步主列表与推荐徽标。 */
export function findPreloadItemsByCarNum(plugin: OtherSitePlugin, carNum: string): HTMLElement[] {
    const listPagePlugin = plugin.getBean('ListPagePlugin');
    if (!listPagePlugin) return [];
    const target = carNum.trim().toLowerCase();
    return Array.from(siteQuery('displayItem')).filter((element) => {
        try {
            const num = listPagePlugin.findCarNumAndHref($(element)).carNum || '';
            return num.trim().toLowerCase() === target;
        } catch {
            return false;
        }
    }) as HTMLElement[];
}

/** 从任意一张卡片定位同番号展示集合，无法取番号时保留原宿主。 */
export function findRelatedPreloadItems(plugin: OtherSitePlugin, item: JQuery<HTMLElement>): JQuery<HTMLElement> {
    const listPagePlugin = plugin.getBean('ListPagePlugin');
    if (listPagePlugin && item?.length) {
        try {
            const carNum = listPagePlugin.findCarNumAndHref(item.first()).carNum;
            const matching = findPreloadItemsByCarNum(plugin, carNum);
            if (matching.length) return $(matching);
        } catch { /* 无法取番号时仍处理原任务卡片。 */ }
    }
    return item || $();
}
