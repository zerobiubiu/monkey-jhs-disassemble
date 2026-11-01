import { YES } from '../../constants/status';

import { readPersistentMap } from '../../core/storage/persistent-data-store';
import { siteSelector } from '../../core/util/site/selectors';

import type { OtherSitePlugin } from '../other-site-plugin';
import { getEnabledSites } from './osp-enabled-sites';
import { ensureFilterBar, refreshFilterBar } from './osp-filter-bar';
import { isCacheEntryValid } from './osp-helpers';

import type { PreloadStatus } from '../../components/misc/preload-status-badge';

/** 预加载展示层只接收渲染回调，不反向依赖请求编排模块。 */
export function syncPreloadBadges(
    plugin: OtherSitePlugin,
    render: (plugin: OtherSitePlugin, item: JQuery<HTMLElement>, siteId: string, status: PreloadStatus) => void
): void {
    if (!plugin.preloadStatusEnabled) return;
    const listPagePlugin = plugin.getBean('ListPagePlugin');
    if (!listPagePlugin) return;
    const enabled = getEnabledSites(plugin);
    const sites = plugin.siteConfigs.filter((site) => enabled.includes(site.id) && !site.initUrl);
    if (sites.length === 0) return;
    const cache = readPersistentMap<unknown>('otherSite', 'jhs_other_site');
    $(siteSelector('preloadItem')).each((_index: number, element: HTMLElement) => {
        const item = $(element);
        if (item.attr('data-hide') === YES) return;
        let carNum: string;
        try {
            carNum = listPagePlugin.findCarNumAndHref(item).carNum;
        } catch {
            return;
        }
        if (!carNum) return;
        for (const site of sites) {
            const key = carNum + '_' + site.id.replace('Btn', '');
            if (isCacheEntryValid(cache[key], plugin.preloadCacheTTLDays)) {
                const badge = item.find(`[data-site-id="${site.id}"] .jhs-ps-badge`);
                if (!badge.length || !badge.hasClass('jhs-ps-success')) render(plugin, item, site.id, 'success');
            } else if (!item.find(`[data-site-id="${site.id}"]`).length) {
                // 已在执行的同番号任务优先显示执行态，不在重开面板时退回排队态。
                const active = plugin.preloadTasks.get(`${carNum}_${site.id}`);
                render(plugin, item, site.id, active?.status === 'requesting' ? 'requesting' : 'queued');
            }
        }
    });
}

/** 主列表仅观察直接子项；推荐只响应卡片增删，忽略其内部徽标变化。 */
export function observePreloadLists(
    plugin: OtherSitePlugin,
    syncBadges: () => void,
    preload: () => Promise<void>
): void {
    const schedule = (): void => {
        syncBadges();
        ensureFilterBar(plugin);
        refreshFilterBar(plugin);
        clearTimeout(plugin.preloadDebounce);
        plugin.preloadDebounce = plugin.supervisor.setTimeout(() => {
            preload().catch((error: unknown) => clog.error('预加载调度失败:', error));
        }, plugin.preloadDebounceMs);
    };
    const container = document.querySelector(siteSelector('list'));
    if (container) plugin.supervisor.observe(container, schedule, { childList: true });

    plugin.supervisor.observe(document.body, (mutations) => {
        // 未打开的推荐不进入调度，也不为隐藏推荐创建徽标。
        if (!Array.from(document.querySelectorAll(siteSelector('weeklyRecommendItem')))
            .some((item) => item.matches(siteSelector('preloadItem')))) return;
        const changed = mutations.some((mutation) => {
            const inRecommend = mutation.target instanceof Element &&
                !!mutation.target.closest(siteSelector('weeklyRecommend'));
            return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
                if (!(node instanceof Element)) return false;
                const hasCards = node.matches(siteSelector('parsedItem')) ||
                    !!node.querySelector(siteSelector('parsedItem'));
                const hasRecommend = node.matches(siteSelector('weeklyRecommend')) ||
                    !!node.querySelector(siteSelector('weeklyRecommend'));
                return hasCards && (inRecommend || hasRecommend);
            });
        });
        if (changed) schedule();
    }, { childList: true, subtree: true });
}
