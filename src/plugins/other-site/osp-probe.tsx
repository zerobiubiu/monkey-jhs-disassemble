/**
 * 单站点探测 —— 从 other-site-plugin.tsx 拆出的网络 + 缓存 + DOM 方法。
 *
 * probeSite 对应原 handleSite 方法体（原 L4916-5051）：查缓存 → 请求搜索页 →
 * 解析详情链接 → 更新按钮与缓存。noHandle 站点读 jhs_other_site_dmm 缓存直接回填；
 * 其余站点走完整搜索-解析-缓存流程，异常按 Just a moment / 重定向 / 404 / 其它分类着色与提示。
 */
import { AsyncTaskQueue } from '../../core/async-task-queue';
import { jsxToString } from '../../core/jsx-to-string';

import type { OtherSitePlugin } from '../other-site-plugin';
import { evictStaleCache, isCacheEntryValid } from './osp-helpers';
import type { SiteConfig, SiteResult } from './osp-types';

import { SiteResultTag } from '../../components/other-site/site-result-tag';

/**
 * 单站点探测：查缓存 → 请求搜索页 → 解析详情链接 → 更新按钮与缓存。
 * 对应原 L4916-5051。
 * @param plugin OtherSitePlugin 实例（提供颜色配置 / 缓存 TTL 等协作状态）。
 * @param carNum 番号。
 * @param siteConfig 站点配置。
 * noHandle 站点读 jhs_other_site_dmm 缓存直接回填；其余站点走完整搜索-解析-缓存流程，
 * 异常按 Just a moment / 重定向 / 404 / 其它分类着色与提示。返回 Promise<void>。
 */
export async function probeSite(
    plugin: OtherSitePlugin,
    carNum: string,
    siteConfig: SiteConfig
): Promise<void> {
    const buttonEl = $(`#${siteConfig.id}`);
    if (siteConfig.initUrl) {
        buttonEl.attr('href', await siteConfig.initUrl(carNum));
        buttonEl.css('backgroundColor', plugin.warnBackgroundColor);
    }
    if (siteConfig.noHandle && siteConfig.noHandle === true) {
        const dmmStorageKey = 'jhs_other_site_dmm';
        let dmmCache: Record<string, unknown> = {};
        try {
            const raw = localStorage.getItem(dmmStorageKey);
            if (raw) dmmCache = JSON.parse(raw);
        } catch { /* 缓存损坏，回退空对象 */ }
        const dmmCachedResult = dmmCache[carNum] as { type?: string; url?: string };
        if (dmmCachedResult) {
            if (dmmCachedResult.type === 'single') {
                buttonEl.attr('href', dmmCachedResult.url);
                buttonEl.css('backgroundColor', plugin.okBackgroundColor);
            } else if (dmmCachedResult.type === 'multiple') {
                buttonEl.attr('href', dmmCachedResult.url);
                buttonEl.append(jsxToString(<SiteResultTag />));
                buttonEl.css('backgroundColor', plugin.okBackgroundColor);
            }
        }
    } else {
        try {
            if (buttonEl.attr('href')) {
                return;
            }
            if (utils.isHidden(buttonEl)) {
                return;
            }
            const storageKey = 'jhs_other_site';
            let cache: Record<string, unknown> = {};
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) cache = JSON.parse(raw);
            } catch { /* 缓存损坏，回退空对象 */ }
            const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
            const cachedResult = cache[cacheKey] as { type?: string; url?: string };
            if (isCacheEntryValid(cachedResult, plugin.preloadCacheTTLDays)) {
                if (cachedResult.type === 'single') {
                    buttonEl.attr('href', cachedResult.url);
                    buttonEl.css('backgroundColor', plugin.okBackgroundColor);
                } else if (cachedResult.type === 'multiple') {
                    buttonEl.attr('href', cachedResult.url);
                    buttonEl.append(jsxToString(<SiteResultTag />));
                    buttonEl.css('backgroundColor', plugin.okBackgroundColor);
                }
                return;
            }
            const baseUrl = await siteConfig.getBaseUrl();
            const searchUrl = siteConfig.searchPath(baseUrl, carNum);
            buttonEl.attr('href', searchUrl);
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
                if (!href) {
                    throw new Error('解析href失败');
                }
                if (!href.includes('http')) {
                    href = baseUrl + (href.startsWith('/') ? href : '/' + href);
                }
                detailHrefs.push(href);
            });
            let tagHtml = '';
            let resultData: SiteResult | null = null;
            if (detailHrefs.length === 1) {
                const detailHref = detailHrefs[0];
                buttonEl.attr('href', detailHref);
                buttonEl.css('backgroundColor', plugin.okBackgroundColor);
                resultData = {
                    type: 'single',
                    url: detailHref
                };
            } else if (detailHrefs.length > 1) {
                buttonEl.attr('href', searchUrl);
                tagHtml += jsxToString(<SiteResultTag />);
                buttonEl.css('backgroundColor', plugin.okBackgroundColor);
                resultData = {
                    type: 'multiple',
                    url: searchUrl
                };
            } else {
                buttonEl.attr('href', searchUrl);
                buttonEl.attr('title', '未查询到, 点击前往搜索页');
                buttonEl.css('backgroundColor', plugin.errorBackgroundColor);
            }
            if (resultData) {
                new AsyncTaskQueue().addTask(() => {
                    let cache: Record<string, unknown> = {};
                    try {
                        const raw = localStorage.getItem(storageKey);
                        if (raw) cache = JSON.parse(raw);
                    } catch { /* 缓存损坏，回退空对象 */ }
                    cache[cacheKey] = { ...resultData, ts: Date.now() };
                    evictStaleCache(cache);
                    localStorage.setItem(storageKey, JSON.stringify(cache));
                });
            }
            if (tagHtml) {
                buttonEl.append(tagHtml);
            }
        } catch (error: unknown) {
            const errorMsg = String(error);
            const siteName = siteConfig.id.replace('Btn', '');
            if (errorMsg.includes('Just a moment')) {
                buttonEl.attr('title', '请求失败：Cloudflare 安全检查。');
                buttonEl.css('backgroundColor', plugin.warnBackgroundColor);
                clog.warn(`检测第三方资源失败, ${siteName} 需Cloudflare安全检查`);
            } else if (errorMsg.includes('重定向')) {
                buttonEl.attr('title', '域名失效');
                buttonEl.css('backgroundColor', plugin.domainErrorBackgroundColor);
                clog.warn(`检测第三方资源失败, ${siteName} 域名被重定向`);
            } else if (errorMsg.includes('404 Page Not Found')) {
                buttonEl.attr('title', '未查询到, 点击前往搜索页');
                buttonEl.css('backgroundColor', plugin.errorBackgroundColor);
            } else {
                clog.error(error);
                buttonEl.attr('title', '请求失败。');
                buttonEl.css('backgroundColor', plugin.errorBackgroundColor);
                clog.warn(`检测第三方资源失败, ${siteName}`);
            }
        }
    }
}
