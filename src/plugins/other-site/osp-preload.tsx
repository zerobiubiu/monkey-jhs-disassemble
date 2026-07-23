/**
 * 列表页预加载编排 —— 从 other-site-plugin.tsx 拆出的方法组。
 *
 * 包含：预加载队列遍历（preloadListPage）、去重包装（preloadSite）、
 * 实际请求-解析-写缓存（doPreloadSite）、状态徽标渲染（updatePreloadStatus）、
 * 深度跟踪徽标同步（syncAllBadges）、可预加载站点筛选（getPreloadableSites）、
 * 瀑布流 observer（startPreloadObserver）。
 */
import { YES } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { OtherSitePlugin } from '../other-site-plugin';
import { getEnabledSites } from './osp-enabled-sites';
import { ensureFilterBar, refreshFilterBar } from './osp-filter-bar';
import { evictStaleCache, isCacheEntryValid } from './osp-helpers';
import type { SiteConfig, SiteResult } from './osp-types';

import {
    PRELOAD_STATUS_MAP,
    PreloadStatusBar,
    PreloadStatusBadge
} from '../../components/misc/preload-status-badge';
import type { PreloadStatus } from '../../components/misc/preload-status-badge';

/** 预加载日志前缀。 */
export const PRELOAD_LOG = '[OtherSite 预加载]';

/**
 * 列表页预加载：遍历 .movie-list .item 提取番号，对无缓存的番号
 * 串行限流请求 missav/supjav 搜索页并写入 jhs_other_site 缓存。
 *
 * 纯缓存预热，不渲染任何按钮。详情页打开时 handleSite 查缓存命中，
 * 直接回填按钮，不发请求。
 *
 * 优化策略：
 * - 跳过已缓存的番号（避免重复请求）
 * - 跳过被 jhs 屏蔽的 item（data-hide，减少不必要请求）
 * - AsyncTaskQueue 限流（并发数由设置 preloadConcurrency 控制，默认 1 串行）
 *
 * @returns Promise<void>；无显式抛出
 */
export async function preloadListPage(plugin: OtherSitePlugin): Promise<void> {
    if ((await storageManager.getSetting('enableLoadOtherSite', YES)) !== YES) {
        console.log(`${PRELOAD_LOG} 已禁用，跳过预加载`);
        return;
    }
    const listPagePlugin = plugin.getBean('ListPagePlugin');
    if (!listPagePlugin) {
        console.log(`${PRELOAD_LOG} ListPagePlugin 未就绪，跳过`);
        return;
    }

    const enabledSiteIds = getEnabledSites(plugin);
    const $items = $('.movie-list .item');
    if ($items.length === 0) {
        console.log(`${PRELOAD_LOG} 无 .item，跳过`);
        return;
    }

    // 统计缓存情况
    const storageKey = 'jhs_other_site';
    let cache: Record<string, unknown> = {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) cache = JSON.parse(raw);
    } catch { /* 缓存损坏，回退空对象 */ }
    let cachedCount = 0;
    let skippedHiddenCount = 0;
    let preloadCount = 0;

    $items.each((_index: number, itemEl: HTMLElement) => {
        const $item = $(itemEl);
        // 跳过被 jhs 屏蔽的卡片
        if ($item.attr('data-hide') === YES) {
            skippedHiddenCount++;
            return;
        }

        let carNum: string;
        try {
            carNum = listPagePlugin.findCarNumAndHref($item).carNum;
        } catch {
            return; // 提取番号失败，跳过
        }
        if (!carNum) return;

        // 遍历启用的站点，无缓存的入队预加载
        for (const siteConfig of plugin.siteConfigs) {
            if (!enabledSiteIds.includes(siteConfig.id)) continue;
            if (siteConfig.condition && siteConfig.condition(siteConfig.sourceCarNum) === false)
                continue;
            // 本轮已被 Cloudflare 拦截的站点跳过
            if (plugin.blockedSiteIds.has(siteConfig.id)) continue;
            // 有 initUrl 的站点（如 SupJav）直接显示黄色，不需要预加载
            if (siteConfig.initUrl) continue;

            const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
            // 已缓存且在有效期内则跳过
            if (isCacheEntryValid(cache[cacheKey], plugin.preloadCacheTTLDays)) {
                cachedCount++;
                continue;
            }

            // 入队串行限流预加载（先标记排队中，徽标实时反映队列状态）
            updatePreloadStatus(plugin, $item, siteConfig.id, 'queued');
            plugin.preloadQueue.addTask(async () => {
                // 二次检查：队列执行期间可能已被标记拦截
                if (plugin.blockedSiteIds.has(siteConfig.id)) {
                    updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
                    return;
                }
                updatePreloadStatus(plugin, $item, siteConfig.id, 'requesting');
                await preloadSite(plugin, carNum, siteConfig, $item);
            });
            preloadCount++;
        }
    });

    console.log(
        `${PRELOAD_LOG} ${$items.length} 个 item（屏蔽 ${skippedHiddenCount}）| ` +
            `已缓存 ${cachedCount} | 入队 ${preloadCount} 个任务` +
            (plugin.blockedSiteIds.size > 0
                ? ` | 被拦截站点: ${[...plugin.blockedSiteIds].map((id) => id.replace('Btn', '')).join(', ')}`
                : '')
    );
}

/**
 * 单站点缓存预热（去重包装）：同一 carNum+siteId 并发调用只发一次请求。
 *
 * @param carNum 番号
 * @param siteConfig 站点配置
 * @param $item 列表页 .item 的 jQuery 对象，用于实时更新预加载状态徽标
 * @returns Promise<void>；无显式抛出
 */
async function preloadSite(
    plugin: OtherSitePlugin,
    carNum: string,
    siteConfig: SiteConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    $item: any
): Promise<void> {
    const dedupeKey = `${carNum}_${siteConfig.id}`;
    const existing = plugin.inflightPreloads.get(dedupeKey);
    if (existing) {
        return existing; // 已有相同请求在进行中，复用
    }
    const promise = doPreloadSite(plugin, carNum, siteConfig, $item);
    plugin.inflightPreloads.set(dedupeKey, promise);
    try {
        await promise;
    } finally {
        plugin.inflightPreloads.delete(dedupeKey);
    }
}

/**
 * 单站点缓存预热实际逻辑：请求搜索页 → 解析详情链接 → 写缓存。
 *
 * 与 handleSite 的区别：不操作详情页按钮 DOM，只写缓存；但会实时更新
 * 列表页 item 内的预加载状态徽标（成功匹配 / 匹配失败）。
 * 复用 handleSite 的搜索-解析-缓存流程，但全部在 try-catch 中静默执行。
 *
 * @param carNum 番号
 * @param siteConfig 站点配置
 * @param $item 列表页 .item 的 jQuery 对象，用于实时更新预加载状态徽标
 * @returns Promise<void>；无显式抛出
 */
async function doPreloadSite(
    plugin: OtherSitePlugin,
    carNum: string,
    siteConfig: SiteConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    $item: any
): Promise<void> {
    try {
        const baseUrl = await siteConfig.getBaseUrl();
        const searchUrl = siteConfig.searchPath(baseUrl, carNum);
        const htmlContent = await gmHttp.get(searchUrl, undefined, siteConfig.headers, true);
        const $dom = utils.htmlTo$dom(String(htmlContent));
        const detailHrefs: string[] = [];
        $dom.find(siteConfig.itemSelector).each((_index: number, element: HTMLElement) => {
            const itemEl = $(element);
            if (
                !siteConfig
                    .findCarNumOrTitle(itemEl)
                    .toLowerCase()
                    .includes(carNum.toLowerCase())
            ) {
                return;
            }
            let href = siteConfig.getDetailPageHref(itemEl, baseUrl, carNum);
            if (!href) return;
            if (!href.includes('http')) {
                href = baseUrl + (href.startsWith('/') ? href : '/' + href);
            }
            detailHrefs.push(href);
        });

        let resultData: SiteResult | null = null;
        if (detailHrefs.length === 1) {
            resultData = { type: 'single', url: detailHrefs[0] };
        } else if (detailHrefs.length > 1) {
            resultData = { type: 'multiple', url: searchUrl };
        }
        // 未命中（detailHrefs.length === 0）不缓存，与 handleSite 一致

        if (resultData) {
            updatePreloadStatus(plugin, $item, siteConfig.id, 'success');
            const storageKey = 'jhs_other_site';
            let cache: Record<string, unknown> = {};
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) cache = JSON.parse(raw);
            } catch { /* 缓存损坏，回退空对象 */ }
            const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
            cache[cacheKey] = { ...resultData, ts: Date.now() };
            evictStaleCache(cache);
            localStorage.setItem(storageKey, JSON.stringify(cache));
            console.log(
                `${PRELOAD_LOG} ✓ ${carNum} ${siteConfig.id.replace('Btn', '')} ${resultData.type === 'single' ? '命中' : '多结果'}`
            );
        } else {
            updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
            console.log(
                `${PRELOAD_LOG} ✗ ${carNum} ${siteConfig.id.replace('Btn', '')} 未命中`
            );
        }
    } catch (error: unknown) {
        const siteName = siteConfig.id.replace('Btn', '');
        const errorMsg = String(error);
        // Cloudflare 拦截（403 + "Just a moment..."）：标记该站点，跳过本轮剩余任务
        if (errorMsg.includes('Just a moment') || errorMsg.includes('403')) {
            plugin.blockedSiteIds.add(siteConfig.id);
            updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
            console.warn(
                `${PRELOAD_LOG} ⚠ ${siteName} 被 Cloudflare 拦截，跳过本轮剩余任务`
            );
            return;
        }
        // 其他错误静默处理（不影用户，下次打开详情页会重试）
        updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
        console.warn(
            `${PRELOAD_LOG} ✗ ${carNum} ${siteName} 失败: ${errorMsg.slice(0, 60)}`
        );
    }
}

/**
 * 更新（或创建）某 .item 内某站点的预加载状态徽标，实时反映预加载进度。
 *
 * 状态条 `.jhs-preload-status-bar` 注入到 `.video-title` 之后（.item > a.box 内），
 * 与 VideoListsTag 的 `.jhs-vlt-tags-display`（.meta afterend）位置不冲突。
 * 每站点一个 `.jhs-preload-status` 徽标，按 `data-site-id` 定位。
 *
 * 已存在徽标 → jQuery 直接改 `.jhs-ps-badge` 的 class 与 text（不重建 DOM，
 * 避免布局抖动；class 全量覆盖以切换状态色，`::before` 脉冲点随 class 增减）；
 * 不存在 → 经 jsxToString 注入 PreloadStatusBar/PreloadStatusBadge 初始 HTML。
 *
 * 幂等：重复调用同一状态不产生多余 DOM；observer 回调重入也安全
 * （类名前缀 jhs-preload-status-* 不匹配任何现有 observer 谓词）。
 *
 * @param $item .item 的 jQuery 对象。
 * @param siteId 站点 id（如 "missAvBtn"）。
 * @param status 预加载状态（queued / requesting / success / failed）。
 */
function updatePreloadStatus(
    plugin: OtherSitePlugin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    $item: any,
    siteId: string,
    status: PreloadStatus
): void {
    if (!plugin.preloadStatusEnabled) return;
    const $videoTitle = $item.find('.video-title').first();
    if ($videoTitle.length === 0) return;
    if ($item.find('.jhs-preload-status-bar').length === 0) {
        $videoTitle.after(jsxToString(<PreloadStatusBar />));
    }
    const $bar = $item.find('.jhs-preload-status-bar');
    const $badge = $bar.find(`[data-site-id="${siteId}"]`);
    if ($badge.length === 0) {
        $bar.append(
            jsxToString(
                <PreloadStatusBadge
                    siteId={siteId}
                    siteName={siteId.replace('Btn', '')}
                    status={status}
                />
            )
        );
        return;
    }
    const { cls, text } = PRELOAD_STATUS_MAP[status];
    $badge.find('.jhs-ps-badge').attr('class', `jhs-ps-badge ${cls}`).text(text);
    // 实时刷新筛选栏计数（防抖合并频繁的状态变更）
    refreshFilterBar(plugin);
}

/**
 * 返回需预加载的站点配置（已启用且无 initUrl——initUrl 站点如 SupJav
 * 详情页直接显示黄色、列表页不预加载，不产生徽标）。
 */
function getPreloadableSites(plugin: OtherSitePlugin): SiteConfig[] {
    const enabled = getEnabledSites(plugin);
    return plugin.siteConfigs.filter((s) => enabled.includes(s.id) && !s.initUrl);
}

/**
 * 深度跟踪：扫描所有 .movie-list .item，为每个可预加载站点补全徽标——
 * 已缓存（jhs_other_site 有 carNum_siteId 键 = missav 曾命中）→「成功匹配」
 * 徽标；未缓存且无徽标 →「排队中」徽标。在 handle() 初始加载与
 * startPreloadObserver 回调（流式加载新 item）中调用，使所有 item 始终
 * 可见其预加载状态，消除「只有失败的显示、其他状态不显示」的空窗。
 *
 * 幂等：已显示「成功匹配」不重复写；已有徽标且非成功的不覆盖（避免降级
 * 正在请求/已失败的态——已缓存项不会进入请求流程，故仅无徽标或陈旧
 * 排队态会被纠正为成功）；被屏蔽（data-hide）/番号提取失败（跳过）。
 */
export function syncAllBadges(plugin: OtherSitePlugin): void {
    if (!plugin.preloadStatusEnabled) return;
    const listPagePlugin = plugin.getBean('ListPagePlugin');
    if (!listPagePlugin) return;
    const sites = getPreloadableSites(plugin);
    if (sites.length === 0) return;
    let cache: Record<string, unknown> = {};
    try {
        const raw = localStorage.getItem('jhs_other_site');
        if (raw) cache = JSON.parse(raw);
    } catch { /* 缓存损坏，回退空对象 */ }
    $('.movie-list .item').each((_index: number, el: HTMLElement) => {
        const $item = $(el);
        if ($item.attr('data-hide') === YES) return;
        let carNum: string;
        try {
            carNum = listPagePlugin.findCarNumAndHref($item).carNum;
        } catch {
            return;
        }
        if (!carNum) return;
        for (const site of sites) {
            const cacheKey = carNum + '_' + site.id.replace('Btn', '');
            if (isCacheEntryValid(cache[cacheKey], plugin.preloadCacheTTLDays)) {
                // 已缓存 = 曾命中 → 显示「成功匹配」（无徽标或陈旧排队态才纠正）
                const $badge = $item.find(`[data-site-id="${site.id}"] .jhs-ps-badge`);
                if (!$badge.length || !$badge.hasClass('jhs-ps-success')) {
                    updatePreloadStatus(plugin, $item, site.id, 'success');
                }
            } else if (!$item.find(`[data-site-id="${site.id}"]`).length) {
                // 未缓存且无徽标 → 预填「排队中」（等 preloadListPage 入队转「请求中」）
                updatePreloadStatus(plugin, $item, site.id, 'queued');
            }
        }
    });
}

/**
 * 监听 .movie-list 子元素变化（AutoPage 瀑布流 append 新页 / PageSort 重排），
 * 同步徽标与筛选栏，并防抖后执行完整预加载。
 *
 * 与瀑布流的联动：
 * - AutoPagePlugin（.movie-list 瀑布流）：loadNextPage 往 .movie-list append
 *   新 item → 触发本 observer → 立即 syncAllBadges（为新 item 预填「排队中」
 *   徽标，消除流式加载徽标延迟）+ refreshFilterBar → 防抖后 preloadListPage
 *   入队并逐站点请求
 * - ListWaterfallPlugin（#lists > ul 瀑布流）：操作的是 #lists > ul 不是
 *   .movie-list，不触发本 observer
 * - PageSortPlugin 重排：移动 .item 节点（徽标随节点保留），触发本 observer
 *   → refreshFilterBar 重计芯片计数（徽标无需重建）
 *
 * observer 配置为 `{ childList: true }`（subtree 默认 false），仅响应
 * .movie-list 直接子节点（.item）的增删/重排，不响应 item 内部 DOM 变化
 * （如 updatePreloadStatus 注入徽标），不会自我循环触发。
 */
export function startPreloadObserver(plugin: OtherSitePlugin): void {
    const containerEl = document.querySelector('.movie-list');
    if (!containerEl) return;

    plugin.supervisor.observe(containerEl, () => {
        // 立即为新出现的未缓存 item 预填「排队中」徽标（深度融合跟踪：不等防抖）
        syncAllBadges(plugin);
        // 确保筛选栏存在且紧随其他筛选栏（status-tag-filter 可能晚于本插件挂载）
        ensureFilterBar(plugin);
        // 实时刷新筛选栏计数
        refreshFilterBar(plugin);
        // 防抖后执行完整预加载（入队 + 逐站点请求）
        clearTimeout(plugin.preloadDebounce);
        plugin.preloadDebounce = plugin.supervisor.setTimeout(() => {
            preloadListPage(plugin).then();
        }, plugin.preloadDebounceMs);
    }, { childList: true });
}
