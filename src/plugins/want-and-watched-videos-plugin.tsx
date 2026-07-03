/**
 * 想看/已观看影片导入插件 WantAndWatchedVideosPlugin —— 对应原脚本 archetype/jhs.user.js L10585-10695。
 *
 * 在 javdb 的「想看(/want_watch_videos)」与「已观看(/watched_videos)」列表页注入
 * 「导入至 JHS」按钮，点击后弹出确认对话框（提示先备份数据），随后遍历当前页影片条目，
 * 逐条调用 storageManager.saveCar 写入 JHS 本地库（已存在的番号跳过），并自动 ajax 翻页
 * 递归解析后续页面直到无下一页，最后调用 refresh() 刷新窗口。
 *
 * 动作类型常量 h（"favorite"）/ p（"hasWatch"）改由 ../constants/status 引入
 * （FAVORITE_ACTION / HAS_WATCH_ACTION）；$ / utils / storageManager / show / loading /
 * refresh 已由 ../types/globals.d.ts 声明（$ 为 any，故 jQuery 链式结果均为 any）。
 * 单字母局部变量（原 e/t/n/s/i/a）已语义化：
 *   clickEvent / confirmMessage / loadingOverlay / error / rootEl / itemElements /
 *   nextPageHref / rawItem / $item / href / carNum / metaText / responseHtml /
 *   domParser / $parsedDom / request。
 * 原构造函数 i(this,"type",null)（Object.defineProperty，[[Define]] 语义）改为 class 字段
 * （useDefineForClassFields:true，语义一致）；内联 HTML 已提取为组件
 * （WantWatchedImportButton / WantWatchedHintSpan）。
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string 标注意图，不做窄化。
 * importWantWatchVideos 的首参（原 jQuery 点击事件 e）在内部被 let e = loading() 遮蔽、
 * 从未使用，按 TS 惯例加下划线前缀 _clickEvent 以豁免 noUnusedParameters，签名保持不变。
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from "../constants/status";
import { BasePlugin } from "./base-plugin";
import { WantWatchedHintSpan } from "../components/want-watched-hint-span";
import { WantWatchedImportButton } from "../components/want-watched-import-button";
import { jsxToString } from "../core/jsx-to-string";

export class WantAndWatchedVideosPlugin extends BasePlugin {
    /** 当前导入动作类型（"favorite" 或 "hasWatch"），由按钮点击时设定。对应原 L10588。 */
    type: string | null = null;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L10590-10592。 */
    getName(): string {
        return "WantAndWatchedVideosPlugin";
    }

    /**
     * 主处理入口：识别「想看」/「已观看」列表页并注入导入按钮与提示文案。
     * 对应原 L10593-10624。
     * 无参数，返回 Promise<void>，不抛异常；按钮点击触发 importWantWatchVideos。
     */
    async handle(): Promise<void> {
        if (window.location.href.includes("/want_watch_videos")) {
            $("h3").append(
                jsxToString(<WantWatchedImportButton variant="want" />),
            );
            $("h3").append(jsxToString(<WantWatchedHintSpan variant="want" />));
            $("#wantWatchBtn").on("click", (clickEvent: any) => {
                this.type = FAVORITE_ACTION;
                this.importWantWatchVideos(
                    clickEvent,
                    "是否将 想看的影片 导入到 JHS-收藏?",
                );
            });
        }
        if (window.location.href.includes("/watched_videos")) {
            $("h3").append(
                jsxToString(<WantWatchedImportButton variant="watched" />),
            );
            $("h3").append(
                jsxToString(<WantWatchedHintSpan variant="watched" />),
            );
            $("#wantWatchBtn").on("click", (clickEvent: any) => {
                this.type = HAS_WATCH_ACTION;
                this.importWantWatchVideos(
                    clickEvent,
                    "是否将 看过的影片 导入到 JHS-已观看?",
                );
            });
        }
    }

    /**
     * 弹出确认对话框，确认后执行导入流程：显示 loading 蒙层，调用 parseMovieList 解析
     * 列表并逐条写入 JHS 库，无论成功失败均关闭蒙层。对应原 L10625-10640。
     * @param _clickEvent jQuery 点击事件（原签名保留，内部未使用，仅占位以维持调用约定）。
     * @param confirmMessage 确认对话框正文（带备份数据警告）。
     * 无返回值；不抛异常（parseMovieList 的异常被 try/catch 兜底）。
     */
    importWantWatchVideos(_clickEvent: any, confirmMessage: string): void {
        utils.q(
            null,
            `${confirmMessage} <br/> <span style='color: #f40'>执行此功能前请记得备份数据</span>`,
            async () => {
                const loadingOverlay = loading();
                try {
                    await this.parseMovieList();
                } catch (error) {
                    console.error(error);
                } finally {
                    loadingOverlay.close();
                }
            },
        );
    }

    /**
     * 解析影片列表页：遍历条目提取番号/链接/发布时间，已存在的番号跳过，否则写入 JHS 库；
     * 发现下一页时延迟 1s 后 ajax 拉取并递归解析，无下一页时提示结束并刷新窗口。
     * 对应原 L10641-10694。
     * @param rootEl 可选，jQuery 包裹的已解析 DOM（递归翻页时传入下一页解析结果）；
     *               省略时直接从当前文档查询。
     * @returns Promise<void>；单条保存异常仅 console.error 并继续下一条，不向上抛出。
     */
    async parseMovieList(rootEl?: any): Promise<void> {
        let itemElements: any;
        let nextPageHref: string;
        if (rootEl) {
            itemElements = rootEl.find(this.getSelector().itemSelector);
            nextPageHref = rootEl.find(".pagination-next").attr("href");
        } else {
            itemElements = $(this.getSelector().itemSelector);
            nextPageHref = $(".pagination-next").attr("href");
        }
        for (const rawItem of itemElements) {
            const $item = $(rawItem);
            const href: string = $item.find("a").attr("href");
            const carNum: string = $item
                .find(".video-title strong")
                .text()
                .trim();
            const metaText: string = $item.find(".meta").text().trim();
            if (href && carNum) {
                try {
                    if (await storageManager.getCar(carNum)) {
                        show.info(`${carNum} 已存在, 跳过`);
                        continue;
                    }
                    await storageManager.saveCar({
                        carNum: carNum,
                        url: href,
                        names: null,
                        actionType: this.type,
                        publishTime: metaText,
                    });
                } catch (error) {
                    console.error(`保存失败 [${carNum}]:`, error);
                }
            }
        }
        if (nextPageHref) {
            show.info("发现下一页，正在解析:", nextPageHref);
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            $.ajax({
                url: nextPageHref,
                method: "GET",
                success: (responseHtml: any) => {
                    const domParser = new DOMParser();
                    const $parsedDom = $(
                        domParser.parseFromString(responseHtml, "text/html"),
                    );
                    this.parseMovieList($parsedDom);
                },
                error: function (request: any) {
                    console.error(request);
                    show.error("加载下一页失败:" + request.message);
                },
            });
        } else {
            show.ok("导入结束!");
            refresh();
        }
    }
}
