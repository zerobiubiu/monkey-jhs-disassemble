/**
 * 列表页预加载编排 —— 从 other-site-plugin.tsx 拆出的方法组。
 *
 * 包含：预加载队列遍历（preloadListPage）、去重包装（preloadSite）、
 * 实际请求-解析-写缓存（doPreloadSite）、状态徽标渲染（updatePreloadStatus）、
 * 深度跟踪徽标同步（syncAllBadges）、可预加载站点筛选（getPreloadableSites）、
 * 瀑布流 observer（startPreloadObserver）。
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION, YES } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';
import { readPersistentMap, replacePersistentMap } from '../../core/storage/persistent-data-store';
import { siteSelector } from '../../core/util/site/selectors';

import type { OtherSitePlugin } from '../other-site-plugin';
import { getEnabledSites } from './osp-enabled-sites';
import { refreshFilterBar } from './osp-filter-bar';
import { getItemPreloadStatus, isCacheEntryValid } from './osp-helpers';
import { orderItemsByPreloadPriority } from './osp-preload-order';
import type { SiteConfig, SiteResult } from './osp-types';
import { refreshPreloadQueuePanel } from './osp-preload-panel';
import { findPreloadItemsByCarNum, findRelatedPreloadItems } from './osp-preload-items';
import { observePreloadLists, syncPreloadBadges } from './osp-preload-observer';

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
    const $items = $(siteSelector('preloadItem'));
    if ($items.length === 0) {
        console.log(`${PRELOAD_LOG} 无 .item，跳过`);
        return;
    }

    // 统计缓存情况
    const storageKey = 'jhs_other_site';
    const cache: Record<string, unknown> = readPersistentMap<unknown>('otherSite', storageKey);
    let cachedCount = 0;
    let skippedHiddenCount = 0;
    let preloadCount = 0;

    // 带状态标签（已读/已收藏）的卡片**降为最低优先级**：排在队列末尾（需求 doc/25）。
    // 判定以 car_list 为准 —— 比 DOM 标签可靠（标签可能尚未补渲染/尚未渲染）。
    const statedCarNums = new Set<string>();
    try {
        for (const car of await storageManager.getCarList()) {
            if (car.status !== FAVORITE_ACTION && car.status !== HAS_WATCH_ACTION) continue;
            if (car.carNum) statedCarNums.add(car.carNum.trim().toLowerCase());
        }
    } catch (error: unknown) {
        console.log(`${PRELOAD_LOG} 读取 car_list 失败，跳过优先级降级:`, error);
    }
    const allItems = $items.toArray() as HTMLElement[];
    const orderedItems = orderItemsByPreloadPriority(
        allItems,
        statedCarNums,
        (item: HTMLElement): string => {
            try {
                return listPagePlugin.findCarNumAndHref($(item)).carNum || '';
            } catch {
                return ''; // 番号提取失败 → 按常规优先级处理
            }
        }
    );
    if (orderedItems !== allItems) {
        console.log(`${PRELOAD_LOG} 预加载优先级：带状态标签（已读/已收藏）的卡片已排到队尾`);
    }

    $(orderedItems).each((_index: number, itemEl: HTMLElement) => {
        // 设置/评分读取期间可能关掉推荐面板；排队前按当前可见范围重新判定。
        if (!itemEl.isConnected || !itemEl.matches(siteSelector('preloadItem'))) return;
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

            // 入队串行限流预加载（标记排队中 → 入队；面板/徽标实时反映队列状态）
            enqueuePreloadTask(plugin, carNum, siteConfig, itemEl);
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
 * 入队一个预加载任务（列表页首轮与面板「重试」共用，避免重复实现）。
 *
 * 同时写入任务注册表（供请求列表面板展示）并把卡片徽标置为「排队中」；
 * 任务闭包内自检取消标记（用户可能在出队前或出队后瞬间取消）。
 *
 * @param plugin OtherSitePlugin 实例
 * @param carNum 番号
 * @param siteConfig 站点配置
 * @param itemEl 列表卡片元素；重试时卡片可能已不在页面（翻页/重排）→ 传 null，只预热缓存
 * @returns 任务键（`${carNum}_${siteId}`）
 */
export function enqueuePreloadTask(
    plugin: OtherSitePlugin,
    carNum: string,
    siteConfig: SiteConfig,
    itemEl: HTMLElement | null
): string {
    const key = `${carNum}_${siteConfig.id}`;
    if (itemEl?.matches(siteSelector('weeklyRecommendItem')) &&
        (!itemEl.isConnected || !itemEl.matches(siteSelector('preloadItem')))) return key;
    const active = plugin.preloadTasks.get(key);
    if (active?.status === 'queued' || active?.status === 'requesting' ||
        plugin.preloadQueue.getTasks().some((task) => task.key === key) || plugin.inflightPreloads.has(key)) {
        if (itemEl) updatePreloadStatus(plugin, $(itemEl), siteConfig.id,
            active?.status === 'requesting' ? 'requesting' : 'queued');
        return key;
    }
    plugin.preloadTasks.upsert(key, carNum, siteConfig.id, siteConfig.id.replace('Btn', ''));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    const $item: any = itemEl ? $(itemEl) : null;
    if ($item) updatePreloadStatus(plugin, $item, siteConfig.id, 'queued');
    refreshPreloadQueuePanel(plugin);

    plugin.preloadQueue.addTask(async (handle) => {
        if (handle.isCancelled()) {
            plugin.preloadTasks.setStatus(key, 'cancelled');
            refreshPreloadQueuePanel(plugin);
            return;
        }
        // 推荐排队后关闭时只跳过尚未开始的独占任务，同番号主列表任务仍可执行。
        if (itemEl?.matches(siteSelector('weeklyRecommendItem')) &&
            !findPreloadItemsByCarNum(plugin, carNum).some((item) => item.isConnected && item.matches(siteSelector('preloadItem')))) {
            plugin.preloadTasks.setStatus(key, 'cancelled');
            clearPreloadStatus(plugin, $item, siteConfig.id);
            refreshPreloadQueuePanel(plugin);
            return;
        }
        // 二次检查：队列执行期间可能已被标记拦截
        if (plugin.blockedSiteIds.has(siteConfig.id)) {
            plugin.preloadTasks.setStatus(key, 'failed');
            if ($item) updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
            refreshPreloadQueuePanel(plugin);
            return;
        }
        plugin.preloadTasks.setStatus(key, 'requesting');
        if ($item) updatePreloadStatus(plugin, $item, siteConfig.id, 'requesting');
        refreshPreloadQueuePanel(plugin);
        await preloadSite(plugin, carNum, siteConfig, $item);
        // 结果（成功/失败）已由 doPreloadSite 写入徽标，据此同步注册表：
        // 成功不留存（徽标已显示「成功匹配」），失败/无徽标宿主则留存供面板重试。
        const badge = itemEl ? getItemPreloadStatus(itemEl) : '';
        if (badge === 'success' || !itemEl) {
            plugin.preloadTasks.remove(key);
        } else {
            plugin.preloadTasks.setStatus(key, 'failed');
        }
        refreshPreloadQueuePanel(plugin);
    }, key);
    return key;
}

/**
 * 重试一条失败/已取消的预加载任务（请求列表面板动作）。
 *
 * @param plugin OtherSitePlugin 实例
 * @param key 任务键
 * @returns 是否找到记录并入队
 */
export function retryPreloadTask(plugin: OtherSitePlugin, key: string): boolean {
    const record = plugin.preloadTasks.get(key);
    if (!record) return false;
    const siteConfig = plugin.siteConfigs.find((config) => config.id === record.siteId);
    if (!siteConfig) return false;
    const item = findListItemByCarNum(plugin, record.carNum);
    if (item?.matches(siteSelector('weeklyRecommendItem')) && !item.matches(siteSelector('preloadItem'))) return false;
    enqueuePreloadTask(plugin, record.carNum, siteConfig, item);
    return true;
}

/**
 * 取消一条在队/在途的预加载任务（请求列表面板动作）。
 *
 * 排队中的直接出队；在途的只能置取消标记（fetch 无法中断，由任务闭包自检后提前退出）。
 * 同时清掉卡片上的待处理徽标 —— 否则筛选栏计数会永远残留「排队中」。
 *
 * @param plugin OtherSitePlugin 实例
 * @param key 任务键
 * @returns 是否找到并取消（键不存在时为 false）
 */
export function cancelPreloadTask(plugin: OtherSitePlugin, key: string): boolean {
    const cancelled = plugin.preloadQueue.cancel(key);
    const record = plugin.preloadTasks.get(key);
    if (record) {
        plugin.preloadTasks.setStatus(key, 'cancelled');
        const itemEl = findListItemByCarNum(plugin, record.carNum);
        if (itemEl) clearPreloadStatus(plugin, $(itemEl), record.siteId);
    }
    refreshPreloadQueuePanel(plugin);
    return cancelled;
}

/**
 * 按番号定位当前页的列表卡片（重试/取消时用于找回徽标宿主）。
 *
 * @param plugin OtherSitePlugin 实例
 * @param carNum 番号
 * @returns 命中的 `.item` 元素；已翻页/被重排而找不到时返回 null
 */
function findListItemByCarNum(plugin: OtherSitePlugin, carNum: string): HTMLElement | null {
    return findPreloadItemsByCarNum(plugin, carNum)[0] ?? null;
}

/**
 * 清除某站点在卡片上的预加载徽标（取消任务后调用，避免残留「排队中」计数）。
 *
 * @param plugin OtherSitePlugin 实例
 * @param $item 卡片 jQuery 对象
 * @param siteId 站点 id
 */
export function clearPreloadStatus(plugin: OtherSitePlugin, $item: unknown, siteId: string): void {
    findRelatedPreloadItems(plugin, $item as JQuery<HTMLElement>)
        .find(`.jhs-preload-status[data-site-id="${siteId}"]`).remove();
    refreshFilterBar(plugin);
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
        const htmlContent = await gmHttp.get(
            searchUrl,
            undefined,
            siteConfig.headers,
            true
        );
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
            if (!href) {
                throw new Error('解析href失败');
            }
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
            const cache: Record<string, unknown> = readPersistentMap<unknown>('otherSite', storageKey);
            const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
            cache[cacheKey] = { ...resultData, ts: Date.now() };
            replacePersistentMap('otherSite', storageKey, cache);
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
        // 域名失效（被重定向）
        if (errorMsg.includes('重定向')) {
            updatePreloadStatus(plugin, $item, siteConfig.id, 'failed');
            console.warn(
                `${PRELOAD_LOG} ⚠ ${siteName} 域名失效（被重定向）: ${errorMsg.slice(0, 60)}`
            );
            return;
        }
        // 其他错误静默处理（不影响用户，下次打开详情页会重试）
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
export function updatePreloadStatus(
    plugin: OtherSitePlugin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    $item: any,
    siteId: string,
    status: PreloadStatus
): void {
    const items = findRelatedPreloadItems(plugin, $item as JQuery<HTMLElement>);
    items?.each((_index: number, element: HTMLElement) => {
        renderPreloadStatus(plugin, $(element), siteId, status);
    });
}

/** 同一个任务可供主列表与推荐共享，每张展示卡片独立保留徽标节点。 */
function renderPreloadStatus(
    plugin: OtherSitePlugin, $item: JQuery<HTMLElement>, siteId: string, status: PreloadStatus
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

/** 为当前可预加载卡片补齐徽标，展示层实现独立于网络编排。 */
export function syncAllBadges(plugin: OtherSitePlugin): void {
    syncPreloadBadges(plugin, updatePreloadStatus);
}

/** 保持既有单参数 API，观察器通过回调接入编排，避免模块运行时循环依赖。 */
export function startPreloadObserver(plugin: OtherSitePlugin): void {
    observePreloadLists(plugin, () => syncAllBadges(plugin), () => preloadListPage(plugin));
}
