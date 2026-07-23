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
 * 运行时挂载到 window 的 isDetailPage，以此处 window.isDetailPage 访问，
 * 保持原逻辑并满足 strict 类型检查。
 * 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 改为 class 字段（useDefineForClassFields:true，语义一致）；
 * 异步任务队列类 ve（L4831-4845）已提取为 ../core/async-task-queue 的 AsyncTaskQueue，
 * 本文件以 import 方式复用；
 * $ / utils / storageManager / clog / gmHttp 已由 ../types/globals.d.ts 声明为 any；
 * jQuery .each 回调按本仓库既有约定改写为 (_index, element) 箭头形式，规避 noImplicitThis；
 * 内联 HTML 已提取为组件（OtherSiteBox / OtherSiteBtn / OtherSiteCheckbox / SiteResultTag）。
 *
 * 方法组已拆分至 ./other-site/ 子目录：
 *   osp-types.ts      — SiteResult / SiteConfig 接口
 *   osp-helpers.ts    — 纯工具函数（evictStaleCache / isCacheEntryValid / getItemPreloadStatus）
 *   osp-enabled-sites.ts — 启用站点持久化（getEnabledSites / saveEnabledSites）
 *   osp-filter-bar.ts — 预加载筛选栏（initFilterBar / refreshFilterBar / ensureFilterBar）
 *   osp-preload.tsx   — 列表页预加载编排（preloadListPage / syncAllBadges / startPreloadObserver）
 * 本类保留同名薄委托方法，内部调用点与运行时 getBean 表面（getMissAvUrl / getSupJavUrl /
 * getEnabledSites / saveEnabledSites 等）签名不变。
 */
import { isJavdbSite } from '../constants/site';
import { YES } from '../constants/status';

import { AsyncTaskQueue } from '../core/async-task-queue';
import { TaskSupervisor } from '../core/task-supervisor';
import { jsxToString } from '../core/jsx-to-string';
import type { PageType } from '../core/page-context';

import { BasePlugin } from './base-plugin';
import { getEnabledSites, saveEnabledSites } from './other-site/osp-enabled-sites';
import { initFilterBar } from './other-site/osp-filter-bar';
import {
    preloadListPage,
    startPreloadObserver,
    syncAllBadges
} from './other-site/osp-preload';
import { probeSite } from './other-site/osp-probe';
import type { SiteConfig } from './other-site/osp-types';

import { OtherSiteBox } from '../components/other-site/other-site-box';
import { OtherSiteBtn } from '../components/other-site/other-site-btn';
import { OtherSiteCheckbox } from '../components/other-site/other-site-checkbox';

import otherSiteCssRaw from '../styles/other-site-plugin.css?raw';
import preloadStatusCssRaw from '../styles/preload-status-badge.css?raw';

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
            getDetailPageHref: (item) => item.attr('href'),
            findCarNumOrTitle: (item) => item.text()
        },
        {
            id: 'supJavBtn',
            getBaseUrl: async () => await this.getSupJavUrl(),
            itemSelector: '.posts post',
            searchPath: (baseUrl: string, carNum: string) => `${baseUrl}/?s=${carNum}`,
            getDetailPageHref: (item) => item.attr('href'),
            findCarNumOrTitle: (item) => item.attr('title'),
            // SupJav 全站 Cloudflare 拦截严重，解析不可靠。
            // 设 initUrl 后 handleSite 直接显示黄色（warn 状态）+ 搜索页链接，
            // 跳过所有请求（预加载 + 详情页加载均不发请求）。
            // 基址取设置项 supJavUrl，缺省 https://supjav.com（与 missAv 一致）。
            initUrl: async (carNum: string) => `${await this.getSupJavUrl()}/?s=${carNum}`
        }
    ];
    /** storageManager.getSetting() 全量设置缓存，配合 lastFetchTime 做 TTL 复用。对应原 L4871。 */
    settingCache: Record<string, unknown> | null = null;
    /** 上次拉取全量设置的时间戳。对应原 L4872。 */
    lastFetchTime = 0;
    /** 设置缓存有效期（毫秒）。对应原 L4873。 */
    CACHE_DURATION = 10000;
    /** 列表页预加载限流队列（串行执行，避免洪水请求触发 Cloudflare 封禁）。 */
    preloadQueue: AsyncTaskQueue = new AsyncTaskQueue();
    /** 统一生命周期管理器（定时器/Observer/事件监听）。 */
    supervisor = new TaskSupervisor();
    /** 新 item 预加载防抖计时器。 */
    preloadDebounce = 0;
    /**
     * 预加载中被 Cloudflare 拦截的站点 ID 集合。
     * 一旦某站点返回 "Just a moment..."（403），本轮预加载跳过该站点剩余任务，
     * 避免逐个失败刷屏 + 浪费请求。下次页面加载时重试（集合在 handle() 入口重置）。
     */
    blockedSiteIds: Set<string> = new Set();
    /** 筛选栏构建重试 observer（挂载目标未就绪时等待，构建后断开）。 */
    filterBarObserver: MutationObserver | null = null;
    /** 筛选栏计数刷新防抖计时器。 */
    filterRefreshDebounce = 0;
    /** 是否显示预加载状态徽标与筛选栏（设置项 enablePreloadStatus，缺省开启）。 */
    preloadStatusEnabled = true;
    /** 预加载防抖延迟毫秒（设置项 preloadDebounce，缺省 300）。 */
    preloadDebounceMs = 300;
    /** 预加载并发数（设置项 preloadConcurrency，缺省 1=串行）。 */
    preloadConcurrency = 1;
    /** 预加载缓存有效期天数（设置项 preloadCacheTTL，0=永不过期，缺省 0）。 */
    preloadCacheTTLDays = 0;
    /** 进行中的预加载请求（keyed 去重：同一 carNum_siteId 只允许一个请求）。 */
    inflightPreloads = new Map<string, Promise<void>>();

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4875-4877。 */
    getName(): string {
        return 'OtherSitePlugin';
    }

    /** 详情页 + 列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail', 'list'];
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
        if (window.isDetailPage) {
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
            const concRaw = await storageManager.getSetting('preloadConcurrency', 1);
            let conc = typeof concRaw === 'number' ? concRaw : Number(concRaw);
            if (isNaN(conc) || conc < 1) conc = 1;
            if (conc > 10) conc = 10;
            this.preloadConcurrency = Math.floor(conc);
            this.preloadQueue.setConcurrency(this.preloadConcurrency);
            this.preloadCacheTTLDays =
                Number(await storageManager.getSetting('preloadCacheTTL', 0)) || 0;
            // 立即为所有 item 创建徽标（已缓存→成功匹配，未缓存→排队中），消除空窗
            syncAllBadges(this);
            preloadListPage(this).then();
            startPreloadObserver(this);
            initFilterBar(this);
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
    async loadOtherSite(carNum?: string, sourceCarNum?: string): Promise<void> {
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
        return probeSite(this, carNum, siteConfig);
    }

    /**
     * 带 TTL 的全量设置缓存读取。对应原 L5052-5062。
     * 缓存过期（CACHE_DURATION 毫秒）或首次读取时重新调用 storageManager.getSetting()。
     * 无参数，返回 Promise<Record<string, unknown>>（设置对象）。
     */
    async getSettingCache(): Promise<Record<string, unknown>> {
        const now = Date.now();
        if (!this.settingCache || now - this.lastFetchTime > this.CACHE_DURATION) {
            this.settingCache = await storageManager.getSetting();
            this.lastFetchTime = now;
        }
        return this.settingCache!;
    }

    /**
     * MissAv 站点基础地址（优先取设置项 missAvUrl，缺省 https://missav.live）。
     * 对应原 L5063-5067。无参数，返回 Promise<string>。
     */
    async getMissAvUrl(): Promise<string> {
        return ((await this.getSettingCache()).missAvUrl as string) || 'https://missav.live';
    }

    /**
     * JavDb 站点基础地址（优先取设置项 javDbUrl，缺省 https://javdb.com）。
     * 对应原 L5068-5070。无参数，返回 Promise<string>。
     */
    async getJavDbUrl(): Promise<string> {
        return ((await this.getSettingCache()).javDbUrl as string) || 'https://javdb.com';
    }

    /**
     * SupJav 站点基础地址（优先取设置项 supJavUrl，缺省 https://supjav.com）。
     * 对应原 L5071-5073。无参数，返回 Promise<string>。
     */
    async getSupJavUrl(): Promise<string> {
        return ((await this.getSettingCache()).supJavUrl as string) || 'https://supjav.com';
    }

    /**
     * 读取已启用的站点 ID 列表。对应原 L5074-5081。
     * localStorage jhs_enabled_sites 存在则解析返回，否则返回全部 siteConfigs 的 id。
     * 无参数，返回 string[]。
     */
    getEnabledSites(): string[] {
        return getEnabledSites(this);
    }

    /**
     * 持久化已启用的站点 ID 列表。对应原 L5082-5084。
     * @param siteIds 站点 ID 数组。
     */
    saveEnabledSites(siteIds: string[]): void {
        saveEnabledSites(siteIds);
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
        if (settingsArea) {
            this.supervisor.addEventListener(settingsArea, 'change', (event: Event) => {
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
                        settingsArea.querySelectorAll('input[type="checkbox"]:checked')
                    ).map((checkbox: Element) => checkbox.getAttribute('data-site-id') as string);
                    this.saveEnabledSites(checkedSiteIds);
                }
            });
        }
    }

    /** 销毁插件：中止所有由 supervisor 管理的资源。 */
    destroy(): void {
        this.supervisor.abort();
    }
}
