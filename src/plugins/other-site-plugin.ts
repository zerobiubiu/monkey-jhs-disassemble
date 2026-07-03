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
 * 内联 CSS/HTML 原样保留。
 */
import { isJavdbSite } from "../constants/site";
import { YES } from "../constants/status";
import { AsyncTaskQueue } from "../core/async-task-queue";
import { BasePlugin } from "./base-plugin";
import otherSiteCssRaw from "../styles/other-site-plugin.css?raw";

/** 第三方站点搜索结果缓存条目（localStorage jhs_other_site 的值结构）。 */
interface SiteResult {
    type: "single" | "multiple";
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
    okBackgroundColor = "#7bc73b";
    /** 未查询到背景色。对应原 L4850。 */
    errorBackgroundColor = "#de3333";
    /** Cloudflare 安全检查等告警背景色。对应原 L4851。 */
    warnBackgroundColor = "#d7a80c";
    /** 域名失效（重定向）背景色。对应原 L4852。 */
    domainErrorBackgroundColor = "#d7780c";
    /** 第三方站点探测配置表。对应原 L4853-4870。 */
    siteConfigs: SiteConfig[] = [
        {
            id: "missAvBtn",
            getBaseUrl: async () => await this.getMissAvUrl(),
            itemSelector: ".text-secondary",
            searchPath: (baseUrl: string, carNum: string) =>
                `${baseUrl}/search/${carNum}`,
            getDetailPageHref: (item: any) => item.attr("href"),
            findCarNumOrTitle: (item: any) => item.text(),
        },
        {
            id: "supJavBtn",
            getBaseUrl: async () => await this.getSupJavUrl(),
            itemSelector: ".posts post",
            searchPath: (baseUrl: string, carNum: string) =>
                `${baseUrl}/?s=${carNum}`,
            getDetailPageHref: (item: any) => item.attr("href"),
            findCarNumOrTitle: (item: any) => item.attr("title"),
        },
    ];
    /** storageManager.getSetting() 全量设置缓存，配合 lastFetchTime 做 TTL 复用。对应原 L4871。 */
    settingCache: any = null;
    /** 上次拉取全量设置的时间戳。对应原 L4872。 */
    lastFetchTime = 0;
    /** 设置缓存有效期（毫秒）。对应原 L4873。 */
    CACHE_DURATION = 10000;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4875-4877。 */
    getName(): string {
        return "OtherSitePlugin";
    }

    /**
     * 注入站点按钮样式。对应原 L4878-4880。
     * 无参数，返回 Promise<string>（CSS 文本）。
     */
    async initCss(): Promise<string> {
        return otherSiteCssRaw;
    }

    /**
     * 详情页入口：触发的第三方站点跳转按钮渲染。对应原 L4881-4885。
     * 仅当 window.isDetailPage 为真时执行；无参数，返回 Promise<void>，
     * loadOtherSite 为 fire-and-forget 不向上抛出。
     */
    async handle(): Promise<void> {
        if ((window as any).isDetailPage) {
            this.loadOtherSite().then();
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
        if (
            (await storageManager.getSetting("enableLoadOtherSite", YES)) !==
            YES
        ) {
            return;
        }
        carNum ||= this.getPageInfo().carNum ?? "";
        const enabledSiteIds = this.getEnabledSites();
        const boxHtml = `\n            <div id="otherSiteBox" class="panel-block" style="${isJavdbSite ? "margin-top:8px;font-size:13px" : "margin-top:10px;font-size:13px"}; user-select: none; ">\n                <div style="display: flex;gap: 5px;flex-wrap: wrap">\n                    ${this.siteConfigs
            .map((siteConfig) => {
                siteConfig.sourceCarNum = sourceCarNum;
                if (
                    siteConfig.condition &&
                    siteConfig.condition(siteConfig.sourceCarNum) === false
                ) {
                    return "";
                }
                return `<a target="_blank" class="site-btn" style="${enabledSiteIds.includes(siteConfig.id) ? "" : "display:none"}" id="${siteConfig.id}"><span>${siteConfig.id.replace("Btn", "")}</span></a>`;
            })
            .join("")}\n                </div>\n            </div>\n        `;
        $(".movie-panel-info").append(boxHtml);
        $(".container .info").append(boxHtml);
        await Promise.all(
            this.siteConfigs.map(async (siteConfig) => {
                if (
                    !siteConfig.condition ||
                    siteConfig.condition(siteConfig.sourceCarNum) !== false
                ) {
                    await this.handleSite(carNum, siteConfig);
                }
            }),
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
            buttonEl.attr("href", siteConfig.initUrl(carNum));
            buttonEl.css("backgroundColor", this.warnBackgroundColor);
        }
        if (siteConfig.noHandle && siteConfig.noHandle === true) {
            const dmmStorageKey = "jhs_other_site_dmm";
            const dmmCache: any = localStorage.getItem(dmmStorageKey)
                ? JSON.parse(localStorage.getItem(dmmStorageKey) as string)
                : {};
            const dmmCachedResult: any = dmmCache[carNum];
            if (dmmCachedResult) {
                if (dmmCachedResult.type === "single") {
                    buttonEl.attr("href", dmmCachedResult.url);
                    buttonEl.css("backgroundColor", this.okBackgroundColor);
                } else if (dmmCachedResult.type === "multiple") {
                    buttonEl.attr("href", dmmCachedResult.url);
                    buttonEl.append(
                        '<span class="site-tag" style="top:-15px">多结果</span>',
                    );
                    buttonEl.css("backgroundColor", this.okBackgroundColor);
                }
            }
        } else {
            try {
                if (buttonEl.attr("href")) {
                    return;
                }
                if (utils.isHidden(buttonEl)) {
                    return;
                }
                const storageKey = "jhs_other_site";
                const cache: any = localStorage.getItem(storageKey)
                    ? JSON.parse(localStorage.getItem(storageKey) as string)
                    : {};
                const cacheKey =
                    carNum + "_" + siteConfig.id.replace("Btn", "");
                const cachedResult: any = cache[cacheKey];
                if (cachedResult) {
                    if (cachedResult.type === "single") {
                        buttonEl.attr("href", cachedResult.url);
                        buttonEl.css("backgroundColor", this.okBackgroundColor);
                    } else if (cachedResult.type === "multiple") {
                        buttonEl.attr("href", cachedResult.url);
                        buttonEl.append(
                            '<span class="site-tag" style="top:-15px">多结果</span>',
                        );
                        buttonEl.css("backgroundColor", this.okBackgroundColor);
                    }
                    return;
                }
                const baseUrl = await siteConfig.getBaseUrl();
                const searchUrl = siteConfig.searchPath(baseUrl, carNum);
                buttonEl.attr("href", searchUrl);
                const htmlContent = await gmHttp.get(
                    searchUrl,
                    null,
                    siteConfig.headers,
                    true,
                );
                const $dom = utils.htmlTo$dom(htmlContent);
                const detailHrefs: string[] = [];
                $dom.find(siteConfig.itemSelector).each(
                    (_index: number, element: any) => {
                        const itemEl = $(element);
                        if (
                            !siteConfig
                                .findCarNumOrTitle(itemEl)
                                .toLowerCase()
                                .includes(carNum.toLowerCase())
                        ) {
                            return;
                        }
                        let href = siteConfig.getDetailPageHref(
                            itemEl,
                            baseUrl,
                            carNum,
                        );
                        if (!href) {
                            throw new Error("解析href失败");
                        }
                        if (!href.includes("http")) {
                            href =
                                baseUrl +
                                (href.startsWith("/") ? href : "/" + href);
                        }
                        detailHrefs.push(href);
                    },
                );
                let tagHtml = "";
                let resultData: SiteResult | null = null;
                if (detailHrefs.length === 1) {
                    const detailHref = detailHrefs[0];
                    buttonEl.attr("href", detailHref);
                    buttonEl.css("backgroundColor", this.okBackgroundColor);
                    resultData = {
                        type: "single",
                        url: detailHref,
                    };
                } else if (detailHrefs.length > 1) {
                    buttonEl.attr("href", searchUrl);
                    tagHtml +=
                        '<span class="site-tag" style="top:-15px">多结果</span>';
                    buttonEl.css("backgroundColor", this.okBackgroundColor);
                    resultData = {
                        type: "multiple",
                        url: searchUrl,
                    };
                } else {
                    buttonEl.attr("href", searchUrl);
                    buttonEl.attr("title", "未查询到, 点击前往搜索页");
                    buttonEl.css("backgroundColor", this.errorBackgroundColor);
                }
                if (resultData) {
                    new AsyncTaskQueue().addTask(() => {
                        const cache: any = localStorage.getItem(storageKey)
                            ? JSON.parse(
                                  localStorage.getItem(storageKey) as string,
                              )
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
                const siteName = siteConfig.id.replace("Btn", "");
                if (errorMsg.includes("Just a moment")) {
                    buttonEl.attr("title", "请求失败：Cloudflare 安全检查。");
                    buttonEl.css("backgroundColor", this.warnBackgroundColor);
                    clog.warn(
                        `检测第三方资源失败, ${siteName} 需Cloudflare安全检查`,
                    );
                } else if (errorMsg.includes("重定向")) {
                    buttonEl.attr("title", "域名失效");
                    buttonEl.css(
                        "backgroundColor",
                        this.domainErrorBackgroundColor,
                    );
                    clog.warn(`检测第三方资源失败, ${siteName} 域名被重定向`);
                } else if (errorMsg.includes("404 Page Not Found")) {
                    buttonEl.attr("title", "未查询到, 点击前往搜索页");
                    buttonEl.css("backgroundColor", this.errorBackgroundColor);
                } else {
                    console.error(error);
                    buttonEl.attr("title", "请求失败。");
                    buttonEl.css("backgroundColor", this.errorBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${siteName}`);
                }
            }
        }
    }

    /**
     * 带 TTL 的全量设置缓存读取。对应原 L5052-5062。
     * 缓存过期（CACHE_DURATION 毫秒）或首次读取时重新调用 storageManager.getSetting()。
     * 无参数，返回 Promise<any>（设置对象）。
     */
    async getSettingCache(): Promise<any> {
        const now = Date.now();
        if (
            !this.settingCache ||
            now - this.lastFetchTime > this.CACHE_DURATION
        ) {
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
        return (
            (await this.getSettingCache()).missAvUrl || "https://missav.live"
        );
    }

    /**
     * JavDb 站点基础地址（优先取设置项 javDbUrl，缺省 https://javdb.com）。
     * 对应原 L5068-5070。无参数，返回 Promise<string>。
     */
    async getJavDbUrl(): Promise<string> {
        return (await this.getSettingCache()).javDbUrl || "https://javdb.com";
    }

    /**
     * SupJav 站点基础地址（优先取设置项 supJavUrl，缺省 https://supjav.com）。
     * 对应原 L5071-5073。无参数，返回 Promise<string>。
     */
    async getSupJavUrl(): Promise<string> {
        return (await this.getSettingCache()).supJavUrl || "https://supjav.com";
    }

    /**
     * 读取已启用的站点 ID 列表。对应原 L5074-5081。
     * localStorage jhs_enabled_sites 存在则解析返回，否则返回全部 siteConfigs 的 id。
     * 无参数，返回 string[]。
     */
    getEnabledSites(): string[] {
        const stored = localStorage.getItem("jhs_enabled_sites");
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
        localStorage.setItem("jhs_enabled_sites", JSON.stringify(siteIds));
    }

    /**
     * 渲染站点启用设置区复选框。对应原 L5085-5096。
     * 依据 getEnabledSites() 标记各 siteConfig 对应复选框的勾选状态。
     * 无参数，无返回值；#siteCheckboxes 不存在时静默跳过。
     */
    renderSettingsArea(): void {
        const enabledSiteIds = this.getEnabledSites();
        const checkboxContainer = document.getElementById("siteCheckboxes");
        if (checkboxContainer) {
            checkboxContainer.innerHTML = this.siteConfigs
                .map((siteConfig) => {
                    const isEnabled = enabledSiteIds.includes(siteConfig.id);
                    return `\n                <div style="margin-right: 15px; display: flex; align-items: ${isJavdbSite ? "center" : "flex-start"};">\n                    <input type="checkbox" id="checkbox-${siteConfig.id}" data-site-id="${siteConfig.id}" ${isEnabled ? "checked" : ""} style="margin-right: 8px; cursor: pointer;">\n                    <label for="checkbox-${siteConfig.id}" style="color: #333; font-weight: 500; cursor: pointer;">${siteConfig.id.replace("Btn", "")}</label>\n                </div>\n            `;
                })
                .join("");
        }
    }

    /**
     * 绑定设置区复选框变更事件：勾选则显示按钮并即时探测，取消则隐藏，
     * 变更后持久化启用列表。对应原 L5097-5116。
     * 无参数，无返回值；#settingsArea 不存在时静默跳过。
     */
    setupEventListeners(): void {
        const settingsArea = document.getElementById("settingsArea");
        settingsArea?.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.type === "checkbox") {
                const siteId = target.getAttribute("data-site-id");
                if (target.checked) {
                    $(`#${siteId}`).show();
                    const carNum = this.getPageInfo().carNum ?? "";
                    const siteConfig = this.siteConfigs.find(
                        (config) => config.id === siteId,
                    )!;
                    this.handleSite(carNum, siteConfig).then();
                } else {
                    $(`#${siteId}`).hide();
                }
                const checkedSiteIds: string[] = Array.from(
                    settingsArea!.querySelectorAll(
                        'input[type="checkbox"]:checked',
                    ),
                ).map(
                    (checkbox: Element) =>
                        checkbox.getAttribute("data-site-id") as string,
                );
                this.saveEnabledSites(checkedSiteIds);
            }
        });
    }
}
