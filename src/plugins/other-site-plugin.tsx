/**
 * 第三方站点跳转插件 OtherSitePlugin —— 对应原脚本 archetype/jhs.user.js L4846-5117。
 *
 * 在影片详情页为 MissAv / SupJav 等第三方站点生成跳转按钮：按番号在目标站点搜索，
 * 解析搜索结果页提取详情页链接，命中则直链并缓存（localStorage jhs_other_site），
 * 多结果标注"多结果"标签，未命中则回退搜索页；支持 Cloudflare/重定向/404 等异常分类提示。
 * 设置区可勾选启用站点（localStorage jhs_enabled_sites），勾选变更即时显隐并重新探测。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/d/h/g/p）已语义化：
 *   carNum / sourceCarNum / buttonEl / boxHtml / siteConfig / enabledSiteIds /
 *   storageKey / cache / cacheKey / cachedResult / baseUrl / searchUrl / htmlContent /
 *   $dom / detailHrefs / tagHtml / resultData / errorMsg / siteName / now / detailHref /
 *   itemEl / dmmStorageKey / dmmCachedResult / settingsArea / event / siteId / checkedSiteIds /
 *   checkboxContainer / isEnabled / checkbox。
 * 站点标志 r 改由 ../constants/site 引入（isJavdbSite）；
 * 布尔标识 _ 改由 ../constants/status 引入（YES）；
 * 运行时挂载到 window 的 isDetailPage，以此处 (window as any).isDetailPage 访问，
 * 保持原逻辑并满足 strict 类型检查。
 * 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 改为 class 字段（useDefineForClassFields:true，语义一致）；
 * 异步任务队列类 ve（L4831-4845）已提取为 ../core/async-task-queue 的 AsyncTaskQueue，
 * 本文件以 import 方式复用；
 * $ / utils / storageManager / clog / gmHttp 已由 ../types/globals.d.ts 声明为 any；
 * jQuery .each 回调按本仓库既有约定改写为 (_index, element) 箭头形式，规避 noImplicitThis；
 * 内联 HTML 已提取为组件（OtherSiteBox / OtherSiteBtn / OtherSiteCheckbox / SiteResultTag）。
 */
import { isJavdbSite } from '../constants/site';
import { YES } from '../constants/status';
import { AsyncTaskQueue } from '../core/async-task-queue';
import { jsxToString } from '../core/jsx-to-string';
import { BasePlugin } from './base-plugin';
import { OtherSiteBox } from '../components/other-site-box';
import { OtherSiteBtn } from '../components/other-site-btn';
import { OtherSiteCheckbox } from '../components/other-site-checkbox';
import { SiteResultTag } from '../components/site-result-tag';
import otherSiteCssRaw from '../styles/other-site-plugin.css?raw';

/** 第三方站点搜索结果缓存条目（localStorage jhs_other_site 的值结构）。 */
interface SiteResult {
    type: 'single' | 'multiple';
    url: string;
}

/** 第三方站点探测配置。 */
interface SiteConfig {
    id: string;
    getBaseUrl: () => Promise<string>;
    itemSelector: string;
    searchPath: (baseUrl: string, carNum: string) => string;
    getDetailPageHref: (item: any, baseUrl: string, carNum: string) => string;
    findCarNumOrTitle: (item: any) => string;
    sourceCarNum?: any;
    condition?: (sourceCarNum: any) => boolean;
    initUrl?: (carNum: string) => string;
    noHandle?: boolean;
    headers?: any;
}

export class OtherSitePlugin extends BasePlugin {
    /** 命中（单/多结果）背景色。对应原 L4849。 */
    okBackgroundColor = '#7bc73b';
    /** 未查询到背景色。对应原 L4850。 */
    errorBackgroundColor = '#de3333';
    /** Cloudflare 安全检查等告警背景色。对应原 L4851。 */
    warnBackgroundColor = '#d7a80c';
    /** 域名失效（重定向）背景色。对应原 L4852。 */
    domainErrorBackgroundColor = '#d7780c';
    /** 第三方站点探测配置表。对应原 L4853-4870。 */
    siteConfigs: SiteConfig[] = [
        {
            id: 'missAvBtn',
            getBaseUrl: async () => await this.getMissAvUrl(),
            itemSelector: '.text-secondary',
            searchPath: (baseUrl: string, carNum: string) => `${baseUrl}/search/${carNum}`,
            getDetailPageHref: (item: any) => item.attr('href'),
            findCarNumOrTitle: (item: any) => item.text()
        },
        {
            id: 'supJavBtn',
            getBaseUrl: async () => await this.getSupJavUrl(),
            itemSelector: '.posts post',
            searchPath: (baseUrl: string, carNum: string) => `${baseUrl}/?s=${carNum}`,
            getDetailPageHref: (item: any) => item.attr('href'),
            findCarNumOrTitle: (item: any) => item.attr('title'),
            // SupJav 全站 Cloudflare 拦截严重，解析不可靠。
            // 设 initUrl 后 handleSite 直接显示黄色（warn 状态）+ 搜索页链接，
            // 跳过所有请求（预加载 + 详情页加载均不发请求）。
            initUrl: (carNum: string) => `https://supjav.com/?s=${carNum}`
        }
    ];
    /** storageManager.getSetting() 全量设置缓存，配合 lastFetchTime 做 TTL 复用。对应原 L4871。 */
    settingCache: any = null;
    /** 上次拉取全量设置的时间戳。对应原 L4872。 */
    lastFetchTime = 0;
    /** 设置缓存有效期（毫秒）。对应原 L4873。 */
    CACHE_DURATION = 10000;
    /** 列表页预加载限流队列（串行执行，避免洪水请求触发 Cloudflare 封禁）。 */
    private preloadQueue: AsyncTaskQueue = new AsyncTaskQueue();
    /** 列表页新 item 监听（autoPage 瀑布流 append 新页时触发预加载）。 */
    private preloadObserver: MutationObserver | null = null;
    /** 新 item 预加载防抖计时器。 */
    private preloadDebounce: ReturnType<typeof setTimeout> | null = null;
    /** 预加载日志前缀。 */
    private static readonly PRELOAD_LOG = '[OtherSite 预加载]';
    /**
     * 预加载中被 Cloudflare 拦截的站点 ID 集合。
     * 一旦某站点返回 "Just a moment..."（403），本轮预加载跳过该站点剩余任务，
     * 避免逐个失败刷屏 + 浪费请求。下次页面加载时重试（集合在 handle() 入口重置）。
     */
    private blockedSiteIds: Set<string> = new Set();

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4875-4877。 */
    getName(): string {
        return 'OtherSitePlugin';
    }

    /**
     * 注入站点按钮样式。对应原 L4878-4880。
     * 无参数，返回 Promise<string>（CSS 文本）。
     */
    async initCss(): Promise<string> {
        return otherSiteCssRaw;
    }

    /**
     * 入口：详情页渲染跳转按钮，列表页预加载缓存。
     * 对应原 L4881-4885（详情页分支），列表页预加载为新增功能。
     *
     * - 详情页（isDetailPage）：调用 loadOtherSite 渲染按钮 + 探测链接
     * - 有 .movie-list 的页面（排除 /users/* 清单列表页）：调用 preloadListPage
     *   遍历 item 预加载缓存，并监听瀑布流新 item
     *
     * 不依赖 window.isListPage 判断，而是直接检测 .movie-list 是否存在，
     * 这样 /lists/xxx 清单详情页（有 .movie-list）也能预加载，
     * 而 /users/* 清单列表页（容器是 #lists > ul，无 .movie-list）自动排除。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 每次页面加载重置 Cloudflare 拦截标记，重新尝试
        this.blockedSiteIds.clear();
        if ((window as any).isDetailPage) {
            this.loadOtherSite().then();
        } else if (document.querySelector('.movie-list')) {
            // 有 .movie-list 的页面（列表页/清单详情页/搜索页等）才预加载
            // /users/* 清单列表页无 .movie-list（容器是 #lists > ul），自动排除
            this.preloadListPage().then();
            this.startPreloadObserver();
        }
    }

    /**
     * 渲染第三方站点跳转按钮组并逐站点探测详情链接。对应原 L4886-4915。
     * @param carNum 番号，缺省时取当前详情页 getPageInfo().carNum。
     * @param sourceCarNum 源番号（写入各 siteConfig.sourceCarNum 供 condition 判定），缺省为 undefined。
     * 设置项 enableLoadOtherSite !== YES 时直接返回；按钮 HTML 同时追加到
     * .movie-panel-info 与 .container .info；各站点探测为串行 await（Promise.all 内），
     * 完成后渲染设置区与事件监听。返回 Promise<void>。
     */
    async loadOtherSite(carNum?: string, sourceCarNum?: any): Promise<void> {
        if ((await storageManager.getSetting('enableLoadOtherSite', YES)) !== YES) {
            return;
        }
        carNum ||= this.getPageInfo().carNum ?? '';
        const enabledSiteIds = this.getEnabledSites();
        const siteButtonsHtml = this.siteConfigs
            .map((siteConfig) => {
                siteConfig.sourceCarNum = sourceCarNum;
                if (
                    siteConfig.condition &&
                    siteConfig.condition(siteConfig.sourceCarNum) === false
                ) {
                    return '';
                }
                return jsxToString(
                    <OtherSiteBtn
                        id={siteConfig.id}
                        enabled={enabledSiteIds.includes(siteConfig.id)}
                    />
                );
            })
            .join('');
        const boxHtml = jsxToString(
            <OtherSiteBox siteButtonsHtml={siteButtonsHtml} isJavdbSite={isJavdbSite} />
        );
        $('.movie-panel-info').append(boxHtml);
        $('.container .info').append(boxHtml);
        await Promise.all(
            this.siteConfigs.map(async (siteConfig) => {
                if (
                    !siteConfig.condition ||
                    siteConfig.condition(siteConfig.sourceCarNum) !== false
                ) {
                    await this.handleSite(carNum, siteConfig);
                }
            })
        );
        this.renderSettingsArea();
        this.setupEventListeners();
    }

    /**
     * 单站点探测：查缓存 → 请求搜索页 → 解析详情链接 → 更新按钮与缓存。
     * 对应原 L4916-5051。
     * @param carNum 番号。
     * @param siteConfig 站点配置。
     * noHandle 站点读 jhs_other_site_dmm 缓存直接回填；其余站点走完整搜索-解析-缓存流程，
     * 异常按 Just a moment / 重定向 / 404 / 其它分类着色与提示。返回 Promise<void>。
     */
    async handleSite(carNum: string, siteConfig: SiteConfig): Promise<void> {
        const buttonEl = $(`#${siteConfig.id}`);
        if (siteConfig.initUrl) {
            buttonEl.attr('href', siteConfig.initUrl(carNum));
            buttonEl.css('backgroundColor', this.warnBackgroundColor);
        }
        if (siteConfig.noHandle && siteConfig.noHandle === true) {
            const dmmStorageKey = 'jhs_other_site_dmm';
            const dmmCache: any = localStorage.getItem(dmmStorageKey)
                ? JSON.parse(localStorage.getItem(dmmStorageKey) as string)
                : {};
            const dmmCachedResult: any = dmmCache[carNum];
            if (dmmCachedResult) {
                if (dmmCachedResult.type === 'single') {
                    buttonEl.attr('href', dmmCachedResult.url);
                    buttonEl.css('backgroundColor', this.okBackgroundColor);
                } else if (dmmCachedResult.type === 'multiple') {
                    buttonEl.attr('href', dmmCachedResult.url);
                    buttonEl.append(jsxToString(<SiteResultTag />));
                    buttonEl.css('backgroundColor', this.okBackgroundColor);
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
                const cache: any = localStorage.getItem(storageKey)
                    ? JSON.parse(localStorage.getItem(storageKey) as string)
                    : {};
                const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
                const cachedResult: any = cache[cacheKey];
                if (cachedResult) {
                    if (cachedResult.type === 'single') {
                        buttonEl.attr('href', cachedResult.url);
                        buttonEl.css('backgroundColor', this.okBackgroundColor);
                    } else if (cachedResult.type === 'multiple') {
                        buttonEl.attr('href', cachedResult.url);
                        buttonEl.append(jsxToString(<SiteResultTag />));
                        buttonEl.css('backgroundColor', this.okBackgroundColor);
                    }
                    return;
                }
                const baseUrl = await siteConfig.getBaseUrl();
                const searchUrl = siteConfig.searchPath(baseUrl, carNum);
                buttonEl.attr('href', searchUrl);
                const htmlContent = await gmHttp.get(searchUrl, null, siteConfig.headers, true);
                const $dom = utils.htmlTo$dom(htmlContent);
                const detailHrefs: string[] = [];
                $dom.find(siteConfig.itemSelector).each((_index: number, element: any) => {
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
                    buttonEl.css('backgroundColor', this.okBackgroundColor);
                    resultData = {
                        type: 'single',
                        url: detailHref
                    };
                } else if (detailHrefs.length > 1) {
                    buttonEl.attr('href', searchUrl);
                    tagHtml += jsxToString(<SiteResultTag />);
                    buttonEl.css('backgroundColor', this.okBackgroundColor);
                    resultData = {
                        type: 'multiple',
                        url: searchUrl
                    };
                } else {
                    buttonEl.attr('href', searchUrl);
                    buttonEl.attr('title', '未查询到, 点击前往搜索页');
                    buttonEl.css('backgroundColor', this.errorBackgroundColor);
                }
                if (resultData) {
                    new AsyncTaskQueue().addTask(() => {
                        const cache: any = localStorage.getItem(storageKey)
                            ? JSON.parse(localStorage.getItem(storageKey) as string)
                            : {};
                        cache[cacheKey] = resultData;
                        localStorage.setItem(storageKey, JSON.stringify(cache));
                    });
                }
                if (tagHtml) {
                    buttonEl.append(tagHtml);
                }
            } catch (error: any) {
                const errorMsg = String(error);
                const siteName = siteConfig.id.replace('Btn', '');
                if (errorMsg.includes('Just a moment')) {
                    buttonEl.attr('title', '请求失败：Cloudflare 安全检查。');
                    buttonEl.css('backgroundColor', this.warnBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${siteName} 需Cloudflare安全检查`);
                } else if (errorMsg.includes('重定向')) {
                    buttonEl.attr('title', '域名失效');
                    buttonEl.css('backgroundColor', this.domainErrorBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${siteName} 域名被重定向`);
                } else if (errorMsg.includes('404 Page Not Found')) {
                    buttonEl.attr('title', '未查询到, 点击前往搜索页');
                    buttonEl.css('backgroundColor', this.errorBackgroundColor);
                } else {
                    console.error(error);
                    buttonEl.attr('title', '请求失败。');
                    buttonEl.css('backgroundColor', this.errorBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${siteName}`);
                }
            }
        }
    }

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
     * - AsyncTaskQueue 串行限流（一个接一个，避免洪水请求触发 Cloudflare）
     *
     * @returns Promise<void>；无显式抛出
     */
    async preloadListPage(): Promise<void> {
        if ((await storageManager.getSetting('enableLoadOtherSite', YES)) !== YES) {
            console.log(`${OtherSitePlugin.PRELOAD_LOG} 已禁用，跳过预加载`);
            return;
        }
        const listPagePlugin = this.getBean('ListPagePlugin');
        if (!listPagePlugin) {
            console.log(`${OtherSitePlugin.PRELOAD_LOG} ListPagePlugin 未就绪，跳过`);
            return;
        }

        const enabledSiteIds = this.getEnabledSites();
        const $items = $('.movie-list .item');
        if ($items.length === 0) {
            console.log(`${OtherSitePlugin.PRELOAD_LOG} 无 .item，跳过`);
            return;
        }

        // 统计缓存情况
        const storageKey = 'jhs_other_site';
        const cache: any = localStorage.getItem(storageKey)
            ? JSON.parse(localStorage.getItem(storageKey) as string)
            : {};
        let cachedCount = 0;
        let skippedHiddenCount = 0;
        let preloadCount = 0;

        $items.each((_index: number, itemEl: any) => {
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
            for (const siteConfig of this.siteConfigs) {
                if (!enabledSiteIds.includes(siteConfig.id)) continue;
                if (siteConfig.condition && siteConfig.condition(siteConfig.sourceCarNum) === false)
                    continue;
                // 本轮已被 Cloudflare 拦截的站点跳过
                if (this.blockedSiteIds.has(siteConfig.id)) continue;
                // 有 initUrl 的站点（如 SupJav）直接显示黄色，不需要预加载
                if (siteConfig.initUrl) continue;

                const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
                // 已缓存则跳过
                if (cache[cacheKey]) {
                    cachedCount++;
                    continue;
                }

                // 入队串行限流预加载
                this.preloadQueue.addTask(async () => {
                    // 二次检查：队列执行期间可能已被标记拦截
                    if (this.blockedSiteIds.has(siteConfig.id)) return;
                    await this.preloadSite(carNum, siteConfig);
                });
                preloadCount++;
            }
        });

        console.log(
            `${OtherSitePlugin.PRELOAD_LOG} ${$items.length} 个 item（屏蔽 ${skippedHiddenCount}）| ` +
                `已缓存 ${cachedCount} | 入队 ${preloadCount} 个任务` +
                (this.blockedSiteIds.size > 0
                    ? ` | 被拦截站点: ${[...this.blockedSiteIds].map((id) => id.replace('Btn', '')).join(', ')}`
                    : '')
        );
    }

    /**
     * 单站点缓存预热：请求搜索页 → 解析详情链接 → 写缓存。
     *
     * 与 handleSite 的区别：不操作按钮 DOM，只写缓存。
     * 复用 handleSite 的搜索-解析-缓存流程，但全部在 try-catch 中静默执行。
     *
     * @param carNum 番号
     * @param siteConfig 站点配置
     * @returns Promise<void>；无显式抛出
     */
    private async preloadSite(carNum: string, siteConfig: SiteConfig): Promise<void> {
        try {
            const baseUrl = await siteConfig.getBaseUrl();
            const searchUrl = siteConfig.searchPath(baseUrl, carNum);
            const htmlContent = await gmHttp.get(searchUrl, null, siteConfig.headers, true);
            const $dom = utils.htmlTo$dom(htmlContent);
            const detailHrefs: string[] = [];
            $dom.find(siteConfig.itemSelector).each((_index: number, element: any) => {
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
                const storageKey = 'jhs_other_site';
                const cache: any = localStorage.getItem(storageKey)
                    ? JSON.parse(localStorage.getItem(storageKey) as string)
                    : {};
                const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
                cache[cacheKey] = resultData;
                localStorage.setItem(storageKey, JSON.stringify(cache));
                console.log(
                    `${OtherSitePlugin.PRELOAD_LOG} ✓ ${carNum} ${siteConfig.id.replace('Btn', '')} ${resultData.type === 'single' ? '命中' : '多结果'}`
                );
            } else {
                console.log(
                    `${OtherSitePlugin.PRELOAD_LOG} ✗ ${carNum} ${siteConfig.id.replace('Btn', '')} 未命中`
                );
            }
        } catch (error: any) {
            const siteName = siteConfig.id.replace('Btn', '');
            const errorMsg = String(error);
            // Cloudflare 拦截（403 + "Just a moment..."）：标记该站点，跳过本轮剩余任务
            if (errorMsg.includes('Just a moment') || errorMsg.includes('403')) {
                this.blockedSiteIds.add(siteConfig.id);
                console.warn(
                    `${OtherSitePlugin.PRELOAD_LOG} ⚠ ${siteName} 被 Cloudflare 拦截，跳过本轮剩余任务`
                );
                return;
            }
            // 其他错误静默处理（不影用户，下次打开详情页会重试）
            console.warn(
                `${OtherSitePlugin.PRELOAD_LOG} ✗ ${carNum} ${siteName} 失败: ${errorMsg.slice(0, 60)}`
            );
        }
    }

    /**
     * 监听 .movie-list 子元素变化（AutoPage 瀑布流 append 新页），
     * 防抖后对新 item 预加载缓存。
     *
     * 与瀑布流的联动：
     * - AutoPagePlugin（.movie-list 瀑布流）：loadNextPage 往 .movie-list append
     *   新 item → 触发本 observer → 500ms 防抖 → preloadListPage（跳过已缓存）
     * - ListWaterfallPlugin（#lists > ul 瀑布流）：操作的是 #lists > ul 不是
     *   .movie-list，不触发本 observer（且 /users/* 清单列表页无 .movie-list）
     *
     * 只读不写 DOM，不会与 ListPagePlugin.checkDom 的 MutationObserver 互相触发。
     */
    private startPreloadObserver(): void {
        const containerEl = document.querySelector('.movie-list');
        if (!containerEl) return;

        this.preloadObserver = new MutationObserver(() => {
            if (this.preloadDebounce) clearTimeout(this.preloadDebounce);
            this.preloadDebounce = setTimeout(() => {
                this.preloadListPage().then();
            }, 500); // 500ms 防抖，等 autoPage append + ListPagePlugin doFilter 完成
        });
        this.preloadObserver.observe(containerEl, { childList: true });
    }

    /**
     * 带 TTL 的全量设置缓存读取。对应原 L5052-5062。
     * 缓存过期（CACHE_DURATION 毫秒）或首次读取时重新调用 storageManager.getSetting()。
     * 无参数，返回 Promise<any>（设置对象）。
     */
    async getSettingCache(): Promise<any> {
        const now = Date.now();
        if (!this.settingCache || now - this.lastFetchTime > this.CACHE_DURATION) {
            this.settingCache = await storageManager.getSetting();
            this.lastFetchTime = now;
        }
        return this.settingCache;
    }

    /**
     * MissAv 站点基础地址（优先取设置项 missAvUrl，缺省 https://missav.live）。
     * 对应原 L5063-5067。无参数，返回 Promise<string>。
     */
    async getMissAvUrl(): Promise<string> {
        return (await this.getSettingCache()).missAvUrl || 'https://missav.live';
    }

    /**
     * JavDb 站点基础地址（优先取设置项 javDbUrl，缺省 https://javdb.com）。
     * 对应原 L5068-5070。无参数，返回 Promise<string>。
     */
    async getJavDbUrl(): Promise<string> {
        return (await this.getSettingCache()).javDbUrl || 'https://javdb.com';
    }

    /**
     * SupJav 站点基础地址（优先取设置项 supJavUrl，缺省 https://supjav.com）。
     * 对应原 L5071-5073。无参数，返回 Promise<string>。
     */
    async getSupJavUrl(): Promise<string> {
        return (await this.getSettingCache()).supJavUrl || 'https://supjav.com';
    }

    /**
     * 读取已启用的站点 ID 列表。对应原 L5074-5081。
     * localStorage jhs_enabled_sites 存在则解析返回，否则返回全部 siteConfigs 的 id。
     * 无参数，返回 string[]。
     */
    getEnabledSites(): string[] {
        const stored = localStorage.getItem('jhs_enabled_sites');
        if (stored) {
            return JSON.parse(stored) as string[];
        } else {
            return this.siteConfigs.map((siteConfig) => siteConfig.id);
        }
    }

    /**
     * 持久化已启用的站点 ID 列表。对应原 L5082-5084。
     * @param siteIds 站点 ID 数组。
     */
    saveEnabledSites(siteIds: string[]): void {
        localStorage.setItem('jhs_enabled_sites', JSON.stringify(siteIds));
    }

    /**
     * 渲染站点启用设置区复选框。对应原 L5085-5096。
     * 依据 getEnabledSites() 标记各 siteConfig 对应复选框的勾选状态。
     * 无参数，无返回值；#siteCheckboxes 不存在时静默跳过。
     */
    renderSettingsArea(): void {
        const enabledSiteIds = this.getEnabledSites();
        const checkboxContainer = document.getElementById('siteCheckboxes');
        if (checkboxContainer) {
            checkboxContainer.innerHTML = this.siteConfigs
                .map((siteConfig) => {
                    const isEnabled = enabledSiteIds.includes(siteConfig.id);
                    return jsxToString(
                        <OtherSiteCheckbox
                            id={siteConfig.id}
                            isEnabled={isEnabled}
                            isJavdbSite={isJavdbSite}
                        />
                    );
                })
                .join('');
        }
    }

    /**
     * 绑定设置区复选框变更事件：勾选则显示按钮并即时探测，取消则隐藏，
     * 变更后持久化启用列表。对应原 L5097-5116。
     * 无参数，无返回值；#settingsArea 不存在时静默跳过。
     */
    setupEventListeners(): void {
        const settingsArea = document.getElementById('settingsArea');
        settingsArea?.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.type === 'checkbox') {
                const siteId = target.getAttribute('data-site-id');
                if (target.checked) {
                    $(`#${siteId}`).show();
                    const carNum = this.getPageInfo().carNum ?? '';
                    const siteConfig = this.siteConfigs.find((config) => config.id === siteId)!;
                    this.handleSite(carNum, siteConfig).then();
                } else {
                    $(`#${siteId}`).hide();
                }
                const checkedSiteIds: string[] = Array.from(
                    settingsArea!.querySelectorAll('input[type="checkbox"]:checked')
                ).map((checkbox: Element) => checkbox.getAttribute('data-site-id') as string);
                this.saveEnabledSites(checkedSiteIds);
            }
        });
    }
}
