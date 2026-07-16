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
import {
    PRELOAD_STATUS_MAP,
    PreloadStatusBar,
    PreloadStatusBadge
} from '../components/preload-status-badge';
import type { PreloadStatus } from '../components/preload-status-badge';
import otherSiteCssRaw from '../styles/other-site-plugin.css?raw';
import preloadStatusCssRaw from '../styles/preload-status-badge.css?raw';

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
    initUrl?: (carNum: string) => Promise<string> | string;
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
            // 基址取设置项 supJavUrl，缺省 https://supjav.com（与 missAv 一致）。
            initUrl: async (carNum: string) => `${await this.getSupJavUrl()}/?s=${carNum}`
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
    /** 筛选栏构建重试 observer（挂载目标未就绪时等待，构建后断开）。 */
    private filterBarObserver: MutationObserver | null = null;
    /** 筛选栏计数刷新防抖计时器。 */
    private filterRefreshDebounce: ReturnType<typeof setTimeout> | null = null;
    /** 是否显示预加载状态徽标与筛选栏（设置项 enablePreloadStatus，缺省开启）。 */
    private preloadStatusEnabled = true;
    /** 预加载防抖延迟毫秒（设置项 preloadDebounce，缺省 300）。 */
    private preloadDebounceMs = 300;
    /** 预加载缓存有效期天数（设置项 preloadCacheTTL，0=永不过期，缺省 0）。 */
    private preloadCacheTTLDays = 0;
    /**
     * 筛选栏芯片定义（固定 5 档：排队中/请求中/成功匹配/匹配失败/已缓存）。
     * 'cached' 表示无徽标的卡片（已缓存或无需预加载）。
     */
    private static readonly PRELOAD_CHIPS: { value: string; label: string }[] = [
        { value: 'queued', label: '排队中' },
        { value: 'requesting', label: '请求中' },
        { value: 'success', label: '成功匹配' },
        { value: 'failed', label: '匹配失败' }
    ];
    /** 本插件隐藏卡片使用的属性（与其他筛选插件协同安全，各占一属性）。 */
    private static readonly PRELOAD_HIDDEN_ATTR = 'data-preload-hidden';
    /**
     * 其他筛选/隐藏插件使用的隐藏属性集合。本插件 applyPreloadFilter /
     * collectPreloadCounts 遇到带这些属性的卡片一律跳过（不纳入管理、不计入计数），
     * 与 StatusTagFilterPlugin（data-status-tag-hidden）、VideoListsTagPlugin
     * （data-video-lists-tag-hidden）、ListReadingStatusPlugin（data-lrs-hidden）、
     * jhs ListPagePlugin（data-hide）协同共存，互不干扰。
     */
    private static readonly OTHER_HIDDEN_ATTRS = [
        'data-hide',
        'data-lrs-hidden',
        'data-status-tag-hidden',
        'data-video-lists-tag-hidden'
    ];

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4875-4877。 */
    getName(): string {
        return 'OtherSitePlugin';
    }

    /**
     * 注入站点按钮样式。对应原 L4878-4880。
     * 无参数，返回 Promise<string>（CSS 文本）。
     */
    async initCss(): Promise<string> {
        return `${otherSiteCssRaw}\n${preloadStatusCssRaw}`;
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
        // 外部网站预加载总开关：关闭则不渲染详情页按钮、不预加载、不挂筛选栏
        if ((await storageManager.getSetting('enableLoadOtherSite', YES)) !== YES) {
            return;
        }
        if ((window as any).isDetailPage) {
            this.loadOtherSite().then();
        } else if (document.querySelector('.movie-list')) {
            // 有 .movie-list 的页面（列表页/清单详情页/搜索页等）才预加载 + 挂筛选栏
            // /users/* 清单列表页无 .movie-list（容器是 #lists > ul），自动排除
            // 列表页预加载开关（enablePreload，缺省开启）；关闭则不预加载、不显示 UI
            // （详情页按钮仍受上方 enableLoadOtherSite 总开关控制）
            if ((await storageManager.getSetting('enablePreload', YES)) !== YES) {
                return;
            }
            this.preloadStatusEnabled =
                (await storageManager.getSetting('enablePreloadStatus', YES)) === YES;
            const debounceRaw = await storageManager.getSetting('preloadDebounce', 300);
            this.preloadDebounceMs =
                typeof debounceRaw === 'number' ? debounceRaw : Number(debounceRaw);
            if (isNaN(this.preloadDebounceMs) || this.preloadDebounceMs < 0) {
                this.preloadDebounceMs = 300;
            }
            this.preloadCacheTTLDays =
                Number(await storageManager.getSetting('preloadCacheTTL', 0)) || 0;
            // 立即为所有 item 创建徽标（已缓存→成功匹配，未缓存→排队中），消除空窗
            this.syncAllBadges();
            this.preloadListPage().then();
            this.startPreloadObserver();
            this.initFilterBar();
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
            buttonEl.attr('href', await siteConfig.initUrl(carNum));
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
                if (this.isCacheEntryValid(cachedResult)) {
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
                        cache[cacheKey] = { ...resultData, ts: Date.now() };
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
                // 已缓存且在有效期内则跳过
                if (this.isCacheEntryValid(cache[cacheKey])) {
                    cachedCount++;
                    continue;
                }

                // 入队串行限流预加载（先标记排队中，徽标实时反映队列状态）
                this.updatePreloadStatus($item, siteConfig.id, 'queued');
                this.preloadQueue.addTask(async () => {
                    // 二次检查：队列执行期间可能已被标记拦截
                    if (this.blockedSiteIds.has(siteConfig.id)) {
                        this.updatePreloadStatus($item, siteConfig.id, 'failed');
                        return;
                    }
                    this.updatePreloadStatus($item, siteConfig.id, 'requesting');
                    await this.preloadSite(carNum, siteConfig, $item);
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
     * 与 handleSite 的区别：不操作详情页按钮 DOM，只写缓存；但会实时更新
     * 列表页 item 内的预加载状态徽标（成功匹配 / 匹配失败）。
     * 复用 handleSite 的搜索-解析-缓存流程，但全部在 try-catch 中静默执行。
     *
     * @param carNum 番号
     * @param siteConfig 站点配置
     * @param $item 列表页 .item 的 jQuery 对象，用于实时更新预加载状态徽标
     * @returns Promise<void>；无显式抛出
     */
    private async preloadSite(carNum: string, siteConfig: SiteConfig, $item: any): Promise<void> {
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
                this.updatePreloadStatus($item, siteConfig.id, 'success');
                const storageKey = 'jhs_other_site';
                const cache: any = localStorage.getItem(storageKey)
                    ? JSON.parse(localStorage.getItem(storageKey) as string)
                    : {};
                const cacheKey = carNum + '_' + siteConfig.id.replace('Btn', '');
                cache[cacheKey] = { ...resultData, ts: Date.now() };
                localStorage.setItem(storageKey, JSON.stringify(cache));
                console.log(
                    `${OtherSitePlugin.PRELOAD_LOG} ✓ ${carNum} ${siteConfig.id.replace('Btn', '')} ${resultData.type === 'single' ? '命中' : '多结果'}`
                );
            } else {
                this.updatePreloadStatus($item, siteConfig.id, 'failed');
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
                this.updatePreloadStatus($item, siteConfig.id, 'failed');
                console.warn(
                    `${OtherSitePlugin.PRELOAD_LOG} ⚠ ${siteName} 被 Cloudflare 拦截，跳过本轮剩余任务`
                );
                return;
            }
            // 其他错误静默处理（不影用户，下次打开详情页会重试）
            this.updatePreloadStatus($item, siteConfig.id, 'failed');
            console.warn(
                `${OtherSitePlugin.PRELOAD_LOG} ✗ ${carNum} ${siteName} 失败: ${errorMsg.slice(0, 60)}`
            );
        }
    }

    /**
     * 更新（或创建）某 .item 内某站点的预加载状态徽标，实时反映预加载进度。
     *
     * 状态条 `.jhs-preload-status-bar` 注入到 `.video-title` 之后（.item > a.box 内），
     * 与 VideoListsTag 的 `.custom-tags-display`（.meta afterend）位置不冲突。
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
    private updatePreloadStatus($item: any, siteId: string, status: PreloadStatus): void {
        if (!this.preloadStatusEnabled) return;
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
        this.refreshFilterBar();
    }

    /**
     * 返回需预加载的站点配置（已启用且无 initUrl——initUrl 站点如 SupJav
     * 详情页直接显示黄色、列表页不预加载，不产生徽标）。
     */
    private getPreloadableSites(): SiteConfig[] {
        const enabled = this.getEnabledSites();
        return this.siteConfigs.filter((s) => enabled.includes(s.id) && !s.initUrl);
    }

    /**
     * 判断预加载缓存条目是否仍在有效期内（配合设置项 preloadCacheTTL）。
     * - entry 缺失 → 无效
     * - TTL=0（永不过期）→ 有效
     * - 旧条目无 ts（向后兼容）→ 有效
     * - 有 ts 且未过期 → 有效；已过期 → 无效（触发重新预加载）
     */
    private isCacheEntryValid(entry: any): boolean {
        if (!entry) return false;
        if (!this.preloadCacheTTLDays) return true;
        if (!entry.ts) return true;
        return Date.now() - entry.ts < this.preloadCacheTTLDays * 86400000;
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
    private syncAllBadges(): void {
        if (!this.preloadStatusEnabled) return;
        const listPagePlugin = this.getBean('ListPagePlugin');
        if (!listPagePlugin) return;
        const sites = this.getPreloadableSites();
        if (sites.length === 0) return;
        const cache: any = localStorage.getItem('jhs_other_site')
            ? JSON.parse(localStorage.getItem('jhs_other_site') as string)
            : {};
        $('.movie-list .item').each((_index: number, el: any) => {
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
                if (this.isCacheEntryValid(cache[cacheKey])) {
                    // 已缓存 = 曾命中 → 显示「成功匹配」（无徽标或陈旧排队态才纠正）
                    const $badge = $item.find(`[data-site-id="${site.id}"] .jhs-ps-badge`);
                    if (!$badge.length || !$badge.hasClass('jhs-ps-success')) {
                        this.updatePreloadStatus($item, site.id, 'success');
                    }
                } else if (!$item.find(`[data-site-id="${site.id}"]`).length) {
                    // 未缓存且无徽标 → 预填「排队中」（等 preloadListPage 入队转「请求中」）
                    this.updatePreloadStatus($item, site.id, 'queued');
                }
            }
        });
    }

    /**
     * 读取单个 .item 的预加载状态（供筛选计数/过滤用）。
     * @returns 状态值（queued/requesting/success/failed）；无徽标返回 'none'。
     */
    private getItemPreloadStatus(item: Element): string {
        const badge = item.querySelector('.jhs-preload-status .jhs-ps-badge');
        if (!badge) return 'none';
        for (const key of ['queued', 'requesting', 'success', 'failed']) {
            if (badge.classList.contains(`jhs-ps-${key}`)) return key;
        }
        return 'none';
    }

    // ===================== 预加载筛选栏 =====================

    /**
     * 初始化预加载筛选栏：立即尝试挂载，挂载目标未就绪则用 observer 重试
     * （镜像 StatusTagFilterPlugin 的 tryBuild + observer 模式）。
     * 与 .status-tag-filter-bar / .tag-filter-bar 等其他筛选栏同行挂载。
     */
    private initFilterBar(): void {
        if (!this.preloadStatusEnabled) return;
        if (this.tryBuildFilterBar()) return;
        let retries = 0;
        this.filterBarObserver = new MutationObserver(() => {
            if (document.querySelector('.preload-filter-bar')) {
                this.filterBarObserver?.disconnect();
                this.filterBarObserver = null;
                return;
            }
            if (this.tryBuildFilterBar() || ++retries > 50) {
                this.filterBarObserver?.disconnect();
                this.filterBarObserver = null;
            }
        });
        this.filterBarObserver.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            this.filterBarObserver?.disconnect();
            this.filterBarObserver = null;
        }, 10000);
    }

    /** 尝试构建筛选栏（若已存在或无挂载目标则跳过）。@returns 是否已就绪。 */
    private tryBuildFilterBar(): boolean {
        if (document.querySelector('.preload-filter-bar')) return true;
        const target = this.findFilterMountTarget();
        if (!target) return false;
        this.buildFilterBar(target);
        return true;
    }

    /**
     * 按优先级查找筛选栏挂载参考元素（镜像 StatusTagFilterPlugin.findMountTarget，
     * 但优先紧随 .status-tag-filter-bar）：
     * .status-tag-filter-bar → .tag-filter-bar → .tabs.is-boxed / .actor-tags.tags
     * → section/div 首子元素回退。挂载方向：高优先级 afterend，回退 beforebegin。
     */
    private findFilterMountTarget(): Element | null {
        const stf = document.querySelector('.status-tag-filter-bar');
        if (stf) return stf;
        const vlt = document.querySelector('.tag-filter-bar');
        if (vlt) return vlt;
        const isActorPage = /^\/actors\//.test(window.location.pathname);
        if (isActorPage) {
            const actorTags = document.querySelector('body > section > div > div.actor-tags.tags');
            if (actorTags) return actorTags;
        } else {
            const tabsBoxed = document.querySelector('body > section > div > div.tabs.is-boxed');
            if (tabsBoxed) return tabsBoxed;
        }
        const section = document.querySelector('body > section > div > div');
        if (section && section.firstElementChild) {
            if (
                !section.firstElementChild.matches(
                    '.preload-filter-bar, .status-tag-filter-bar, .tag-filter-bar'
                )
            ) {
                return section.firstElementChild;
            }
        }
        const container = document.querySelector('body > section > div');
        if (container && container.firstElementChild) {
            if (
                !container.firstElementChild.matches(
                    '.preload-filter-bar, .status-tag-filter-bar, .tag-filter-bar'
                )
            ) {
                return container.firstElementChild;
            }
        }
        return null;
    }

    /**
     * 构建筛选栏 DOM 并插入挂载参考元素之后。芯片文本含实时计数，
     * refreshChips 保留已激活状态。点击芯片 toggle active + applyPreloadFilter。
     */
    private buildFilterBar(mountTarget: Element): void {
        const bar = document.createElement('div');
        bar.className = 'preload-filter-bar';

        const label = document.createElement('span');
        label.className = 'preload-filter-label';
        label.textContent = '预加载:';
        bar.appendChild(label);

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'preload-filter-chips';
        bar.appendChild(chipsContainer);

        const refreshChips = (): void => {
            const activeValues = new Set(
                Array.from(chipsContainer.querySelectorAll('.preload-filter-chip.active')).map(
                    (c: Element) => (c as HTMLElement).dataset.value || ''
                )
            );
            chipsContainer.innerHTML = '';
            const counts = this.collectPreloadCounts();
            for (const chip of OtherSitePlugin.PRELOAD_CHIPS) {
                const el = document.createElement('span');
                el.className = 'preload-filter-chip';
                el.dataset.value = chip.value;
                const dot = document.createElement('span');
                dot.className = 'pf-dot';
                el.appendChild(dot);
                el.appendChild(document.createTextNode(`${chip.label} ${counts[chip.value] ?? 0}`));
                if (activeValues.has(chip.value)) el.classList.add('active');
                el.addEventListener('click', () => {
                    el.classList.toggle('active');
                    this.applyPreloadFilter();
                });
                chipsContainer.appendChild(el);
            }
        };

        refreshChips();

        if (
            mountTarget.matches(
                '.status-tag-filter-bar, .tag-filter-bar, .actor-tags.tags, .tabs.is-boxed'
            )
        ) {
            mountTarget.insertAdjacentElement('afterend', bar);
        } else {
            mountTarget.insertAdjacentElement('beforebegin', bar);
        }

        (bar as any)._refreshChips = refreshChips;
    }

    /**
     * 收集各预加载状态的卡片计数（排除被其他筛选/隐藏插件屏蔽的卡片，
     * 计数只反映实际可见卡片，与 StatusTagFilterPlugin 一致）。
     */
    private collectPreloadCounts(): Record<string, number> {
        const counts: Record<string, number> = {
            queued: 0,
            requesting: 0,
            success: 0,
            failed: 0
        };
        document.querySelectorAll('.movie-list .item').forEach((item: Element) => {
            if (OtherSitePlugin.OTHER_HIDDEN_ATTRS.some((a) => item.hasAttribute(a))) return;
            const st = this.getItemPreloadStatus(item);
            if (st in counts) counts[st]++;
        });
        return counts;
    }

    /**
     * 应用筛选：按当前激活芯片显示/隐藏 .item。协同安全——被其他插件隐藏的卡片
     * 不纳入管理（不恢复、不重复隐藏），本插件专用 data-preload-hidden 属性。
     * OR 逻辑：命中任一选中状态即显示；无激活芯片则恢复本插件隐藏的卡片。
     */
    private applyPreloadFilter(): void {
        const activeChips = document.querySelectorAll('.preload-filter-chip.active');
        const selected = new Set(
            Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
        );
        const HIDDEN = OtherSitePlugin.PRELOAD_HIDDEN_ATTR;

        if (selected.size === 0) {
            document.querySelectorAll(`.item[${HIDDEN}]`).forEach((item: Element) => {
                const el = item as HTMLElement;
                if (OtherSitePlugin.OTHER_HIDDEN_ATTRS.some((a) => el.hasAttribute(a))) return;
                el.removeAttribute(HIDDEN);
                el.style.display = '';
            });
            return;
        }

        document.querySelectorAll('.movie-list .item').forEach((item: Element) => {
            const el = item as HTMLElement;
            // 协同安全：被其他插件隐藏的卡片不管理
            if (OtherSitePlugin.OTHER_HIDDEN_ATTRS.some((a) => el.hasAttribute(a))) return;
            if (el.style.display === 'none' && !el.hasAttribute(HIDDEN)) return;
            const st = this.getItemPreloadStatus(el);
            if (selected.has(st)) {
                el.removeAttribute(HIDDEN);
                el.style.display = '';
            } else {
                el.setAttribute(HIDDEN, '');
                el.style.display = 'none';
            }
        });
    }

    /**
     * 刷新筛选栏：重建芯片（保留激活状态）+ 重新应用筛选。150ms 防抖，
     * 合并频繁的状态变更（每条预加载完成都会触发）。
     */
    private refreshFilterBar(): void {
        if (!this.preloadStatusEnabled) return;
        if (this.filterRefreshDebounce) clearTimeout(this.filterRefreshDebounce);
        this.filterRefreshDebounce = setTimeout(() => {
            const bar = document.querySelector('.preload-filter-bar');
            if (bar && (bar as any)._refreshChips) {
                (bar as any)._refreshChips();
                this.applyPreloadFilter();
            }
        }, 150);
    }

    /**
     * 确保筛选栏存在且紧随其他筛选栏。流式加载/重排时由 observer 调用：
     * - 栏缺失 → 构建
     * - .status-tag-filter-bar 晚于本插件挂载 → 将本栏移至其后，保持「放在一块」
     */
    private ensureFilterBar(): void {
        if (!this.preloadStatusEnabled) return;
        if (!document.querySelector('.preload-filter-bar')) {
            this.tryBuildFilterBar();
        }
        const bar = document.querySelector('.preload-filter-bar');
        if (!bar) return;
        const stf = document.querySelector('.status-tag-filter-bar');
        if (stf && bar.previousElementSibling !== stf) {
            stf.insertAdjacentElement('afterend', bar);
            this.refreshFilterBar();
            return;
        }
        const vlt = document.querySelector('.tag-filter-bar');
        if (!stf && vlt && bar.previousElementSibling !== vlt) {
            vlt.insertAdjacentElement('afterend', bar);
            this.refreshFilterBar();
        }
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
    private startPreloadObserver(): void {
        const containerEl = document.querySelector('.movie-list');
        if (!containerEl) return;

        this.preloadObserver = new MutationObserver(() => {
            // 立即为新出现的未缓存 item 预填「排队中」徽标（深度融合跟踪：不等防抖）
            this.syncAllBadges();
            // 确保筛选栏存在且紧随其他筛选栏（status-tag-filter 可能晚于本插件挂载）
            this.ensureFilterBar();
            // 实时刷新筛选栏计数
            this.refreshFilterBar();
            // 防抖后执行完整预加载（入队 + 逐站点请求）
            if (this.preloadDebounce) clearTimeout(this.preloadDebounce);
            this.preloadDebounce = setTimeout(() => {
                this.preloadListPage().then();
            }, this.preloadDebounceMs);
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
