/**
 * 演员信息插件 ActressInfoPlugin —— 对应原脚本 archetype/jhs.user.js L4139-4326。
 *
 * 在影片详情页与演员主页从日文维基百科抓取演员身高/体重/三围/罩杯/生日/年龄
 * 等信息并渲染到页面；查询结果按演员名缓存到 localStorage（jhs_actress_info），
 * 详情页逐名查询并各自渲染，演员主页按名次顺序查询到首条即止并回填所有别名。
 *
 * 单字母局部变量（原 e/t/n/a/i/o/r/s/l）已语义化：
 *   actressNames / storageKey / rawCache / cache / info / html / segment /
 *   names / nameSectionEl / metaEl / actressName / responseHtml / domParser /
 *   $parsed / birthday / age / height / weight / url。
 * 布尔标识 _ 改由 ../constants/status 引入（YES，对应原 "yes" 默认值）；
 * $ / gmHttp / storageManager 已由 ../types/globals.d.ts 声明为 any。
 * 原构造函数 i(this,"apiUrl",...)（Object.defineProperty，[[Define]] 语义）
 * 改为 class 字段（useDefineForClassFields:true，语义一致）；内联 CSS 原样保留，
 * 内联 HTML 已提取为组件 src/components/actress-info-detail-segment.ts
 * （ActressInfoDetailSegment + ActressWikiInfo 类型）与
 * src/components/actress-info-star-page-html.ts（ActressInfoStarPageHtml），
 * handleDetailPage 的 segment / handleStarPage 的 html 改为调用组件函数。
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string 标注意图，不做窄化。
 */
import { YES } from "../constants/status";
import { BasePlugin } from "./base-plugin";
import actressInfoCssRaw from "../styles/actress-info-plugin.css?raw";
import {
    ActressInfoDetailSegment,
    type ActressWikiInfo,
} from "../components/actress-info-detail-segment";
import { ActressInfoStarPageHtml } from "../components/actress-info-star-page-html";

/** 演员信息缓存：演员名 → 维基详情（localStorage jhs_actress_info 的解析结构） */
type ActressInfoCache = Record<string, ActressWikiInfo | undefined>;

export class ActressInfoPlugin extends BasePlugin {
    /** 日文维基百科页面 URL 前缀，拼接演员名得到详情页地址。对应原 L4142。 */
    apiUrl: string = "https://ja.wikipedia.org/wiki/";

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4144-4146。 */
    getName(): string {
        return "ActressInfoPlugin";
    }

    /**
     * 主处理入口：当设置项 enableLoadActressInfo === YES 时触发演员信息加载。
     * 对应原 L4147-4156。
     * 无参数，返回 Promise<void>，不会抛出异常（loadActressInfo 内部为 fire-and-forget）。
     */
    async handle(): Promise<void> {
        if (
            (await storageManager.getSetting("enableLoadActressInfo", YES)) ===
            YES
        ) {
            this.loadActressInfo();
        }
    }

    /**
     * 并发触发详情页与演员主页两条处理分支（均 fire-and-forget，不 await）。
     * 对应原 L4157-4160。
     * 无参数，无返回值；原 `.then()` 空回调保留以维持 fire-and-forget 语义。
     */
    loadActressInfo(): void {
        this.handleDetailPage().then();
        this.handleStarPage().then();
    }

    /**
     * 注入演员信息标签的 CSS 样式。对应原 L4161-4163。
     * 无参数，返回 Promise<string>（内联 `<style>` 文本，原样保留）。
     */
    async initCss(): Promise<string> {
        return actressInfoCssRaw;
    }

    /**
     * 详情页处理：从 `.female` 前置节点提取演员名列表，逐名查询维基并渲染信息标签到
     * "演員" 标题之后；查询结果缓存到 localStorage（jhs_actress_info）。
     * 对应原 L4164-4202。
     * 无参数，返回 Promise<void>；遇查询异常仅 console.error 并跳过当前演员，
     * 不向上抛出。已在页面渲染过 `.actress-info` 或无演员名时直接短路返回。
     */
    async handleDetailPage(): Promise<void> {
        if ($(".actress-info").length > 0) {
            return;
        }
        const actressNames: string[] = $(".female")
            .prev()
            .map((_index: number, element: any) => $(element).text().trim())
            .get();
        if (!actressNames.length) {
            return;
        }
        const storageKey = "jhs_actress_info";
        const rawCache: string | null = localStorage.getItem(storageKey);
        const cache: ActressInfoCache = rawCache ? JSON.parse(rawCache) : {};
        let info: ActressWikiInfo | null | undefined = null;
        let html = "";
        for (const actressName of actressNames) {
            info = cache[actressName];
            if (!info) {
                try {
                    info = await this.searchInfo(actressName);
                    if (info) {
                        cache[actressName] = info;
                    }
                } catch {
                    console.error("该名称查询失败,尝试其它名称");
                }
            }
            const segment: string = ActressInfoDetailSegment({
                actressName,
                info,
                wikiApiUrl: this.apiUrl,
            });
            html += segment;
        }
        $('strong:contains("演員")').parent().after(html);
        localStorage.setItem(storageKey, JSON.stringify(cache));
    }

    /**
     * 演员主页处理：从 `.actor-section-name` 与不含"影片"的 `.section-meta` 提取演员名
     * 列表，按顺序查询维基，命中首条即止并将结果回填至所有别名；渲染信息块到
     * 名称区父节点之后，结果缓存到 localStorage（jhs_actress_info）。
     * 对应原 L4203-4261。
     * 无参数，返回 Promise<void>；遇查询异常仅 console.error 并继续尝试下一名称，
     * 不向上抛出。已在页面渲染过 `.actress-info` 或无演员名时直接短路返回。
     */
    async handleStarPage(): Promise<void> {
        if ($(".actress-info").length > 0) {
            return;
        }
        let names: string[] = [];
        const nameSectionEl = $(".actor-section-name");
        if (nameSectionEl.length) {
            nameSectionEl
                .text()
                .trim()
                .split(",")
                .forEach((name: string) => {
                    names.push(name.trim());
                });
        }
        const metaEl = $(".section-meta:not(:contains('影片'))");
        if (metaEl.length) {
            metaEl
                .text()
                .trim()
                .split(",")
                .forEach((name: string) => {
                    names.push(name.trim());
                });
        }
        if (!names.length) {
            return;
        }
        const storageKey = "jhs_actress_info";
        const rawCache: string | null = localStorage.getItem(storageKey);
        const cache: ActressInfoCache = rawCache ? JSON.parse(rawCache) : {};
        let info: ActressWikiInfo | null | undefined = null;
        for (const actressName of names) {
            info = cache[actressName];
            if (info) {
                break;
            }
            try {
                info = await this.searchInfo(actressName);
            } catch {
                console.error("该名称查询失败,尝试其它名称");
            }
            if (info) {
                break;
            }
        }
        if (info) {
            names.forEach((actressName: string) => {
                cache[actressName] = info!;
            });
        }
        const html: string = ActressInfoStarPageHtml({ info });
        nameSectionEl.parent().append(html);
        localStorage.setItem(storageKey, JSON.stringify(cache));
    }

    /**
     * 查询单个演员的维基百科详情：拉取页面 HTML，解析出生日/年龄/身高/体重/三围/罩杯。
     * 对应原 L4262-4325。
     * @param actressName 演员名（"三上悠亞" 会被规范化为 "三上悠亜"）。
     * @returns 演员维基详情（各字段为字符串，未知字段为空串）。
     * @throws 当 gmHttp.get 失败或选择器解析越界（如体重单元格无 "/" 分隔）时抛出，
     *          由调用方 try/catch 兜底。
     */
    async searchInfo(actressName: string): Promise<ActressWikiInfo> {
        if (actressName === "三上悠亞") {
            actressName = "三上悠亜";
        }
        const url = this.apiUrl + actressName;
        const responseHtml: string = await gmHttp.get(url);
        const domParser = new DOMParser();
        const $parsed = $(domParser.parseFromString(responseHtml, "text/html"));
        const birthday: string = $parsed
            .find('a[title="誕生日"]')
            .parent()
            .parent()
            .find("td")
            .text()
            .trim();
        const age: string = $parsed
            .find("th:contains('現年齢')")
            .parent()
            .find("td")
            .text()
            .trim()
            ? parseInt(
                  $parsed
                      .find("th:contains('現年齢')")
                      .parent()
                      .find("td")
                      .text()
                      .trim(),
              ) + "岁"
            : "";
        const height: string =
            $parsed
                .find('tr:has(a[title="身長"]) td')
                .text()
                .trim()
                .split(" ")[0] + "cm";
        let weight: string = $parsed
            .find('tr:has(a[title="体重"]) td')
            .text()
            .trim()
            .split("/")[1]
            .trim();
        if (weight === "― kg") {
            weight = "";
        }
        return {
            birthday,
            age,
            height,
            weight,
            threeSizeText: $parsed
                .find('a[title="スリーサイズ"]')
                .closest("tr")
                .find("td")
                .text()
                .replace("cm", "")
                .trim(),
            braSize: $parsed
                .find('th:contains("ブラサイズ")')
                .next("td")
                .contents()
                .first()
                .text()
                .trim(),
            url,
        };
    }
}
