/**
 * 列表页按钮插件 ListPageButtonPlugin —— 对应原脚本 archetype/jhs.user.js L7952-8207。
 *
 * 在列表页（window.isListPage）渲染顶部工具按钮组（打开待鉴定/打开已收藏/
 * 加入黑名单/一键屏蔽所有作品/新作品检测/演员黑名单/排序切换），并绑定其点击
 * 行为：批量打开待鉴定与已收藏影片（FC2 番号走 Fc2Plugin，其余直接 window.open
 * 并附加 autoPlay=1）、调用 BlacklistPlugin 加入黑名单/一键屏蔽、调用
 * NewVideoPlugin 打开新作品弹窗；另提供列表项排序（按评价人数/时间/默认序，
 * 依 localStorage 的 jhs_sortMethod）。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/r/l/d 等）已语义化；顶层站点/状态常量
 * o/r/l/c/_/h/u/b/k 改由 ../constants 引入（currentHref/isJavdbSite/
 * isJavbusSite/isSearchOrUserPage/YES/FAVORITE_ACTION/BLOCKED_TEXT/
 * FAVORITED_TEXT/WATCHED_TEXT）。
 *
 * 注意：原顶层常量 y（"📥️ 已下载"）所对应的「已下载」状态 UI 已在原脚本历史中
 * 删除（见 archetype/doc/08-remove-hasdown-ui.md、09-remove-hasdown-constants.md），
 * 但其引用在 openWaitCheck 的跳过标签列表 [u,b,y,k] 中残留未清。为保留原逻辑
 * 控制流，此处以本地常量 HAS_DOWN_TEXT 还原其值；该标签现已无 DOM 节点可匹配，
 * 属无害死代码，可后续清理。
 *
 * $ / utils / storageManager / show / clog / loading 已由 ../types/globals.d.ts
 * 声明为 any；内联 CSS/HTML 模板字符串原样保留（仅替换 ${} 插值变量名）。
 */
import {
    currentHref,
    isJavdbSite,
    isJavbusSite,
    isSearchOrUserPage,
} from "../constants/site";
import {
    BLOCKED_TEXT,
    FAVORITED_TEXT,
    WATCHED_TEXT,
    FAVORITE_ACTION,
    YES,
} from "../constants/status";
import { BasePlugin } from "./base-plugin";
import { MenuButtonBoxHtml } from "../components/menu-button-box-html";

/** 「已下载」状态标签文本（原顶层常量 y；已下载功能删除后残留引用的还原值）。 */
const HAS_DOWN_TEXT = "📥️ 已下载";

export class ListPageButtonPlugin extends BasePlugin {
    /** 一键屏蔽时的 loading 遮罩句柄（原 this.loadObj，运行时动态赋值）。 */
    loadObj: { close: () => void } | null = null;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L7953-7955。 */
    getName(): string {
        return "ListPageButtonPlugin";
    }

    /**
     * 列表页主处理：创建按钮组 + 绑定事件 + 依 autoPage 设置决定是否排序。
     * 对应原 L7956-7967。仅当 window.isListPage 时执行。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if (!(window as any).isListPage) {
            return;
        }
        await this.createMenuBtn();
        this.bindEvent();
        if ((await storageManager.getSetting("autoPage")) === YES) {
            $("#sort-toggle-btn").hide();
        } else {
            this.sortItems().then();
        }
    }

    /**
     * 创建列表页按钮组：JavDb 站（isJavdbSite）与 JavBus 站（isJavbusSite）各
     * 渲染一套模板；演员页/标签页/高级搜索页分别定制按钮与文案，已加入黑名单时
     * 切换文案与配色。对应原 L7968-8043。
     *
     * @returns Promise<void>；无显式抛出
     */
    async createMenuBtn(): Promise<void> {
        if (isJavdbSite) {
            const isActorsPage = currentHref.includes("/actors/");
            let containerEl = $(".main-tabs, .tabs");
            let blacklistLabel = "加入黑名单";
            let blacklistColor = "#d22020";
            let tagBlacklistEntry: any = null;
            if (isActorsPage) {
                containerEl = $(".toolbar, .section-addition").filter(":last");
                const blacklist = await storageManager.getBlacklist();
                const actressInfo = this.getActressPageInfo();
                if (
                    blacklist.find(
                        (entry: any) => entry.starId === actressInfo.starId,
                    )
                ) {
                    blacklistLabel = "已加入黑名单";
                    blacklistColor = "#885d5d";
                }
            } else if (currentHref.includes("/tags")) {
                utils.loopDetector(
                    () => $("#jhs-check-tag").text().trim(),
                    async () => {
                        const addBlacklistBtnEl = $("#addBlacklistBtn");
                        addBlacklistBtnEl.attr(
                            "data-tip",
                            "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中",
                        );
                        const tagName = $("#jhs-check-tag").text().trim();
                        if (!tagName) {
                            return;
                        }
                        const tagStarId = "no-" + tagName;
                        const blacklist = await storageManager.getBlacklist();
                        tagBlacklistEntry = blacklist.find(
                            (entry: any) => entry.starId === tagStarId,
                        );
                        if (tagBlacklistEntry) {
                            addBlacklistBtnEl.css("backgroundColor", "#885d5d");
                            $("#addBlacklistBtn span").text("已加入黑名单");
                        }
                    },
                );
            }
            const isAdvancedSearch = currentHref.includes("advanced_search");
            if (isAdvancedSearch) {
                containerEl = $("h2.section-title");
            }
            const sortMethod = localStorage.getItem("jhs_sortMethod");
            const sortLabel =
                "当前排序方式: " +
                (sortMethod === "rateCount"
                    ? "评价人数"
                    : sortMethod === "date"
                      ? "时间"
                      : "默认");
            containerEl.append(
                MenuButtonBoxHtml({
                    site: "javdb",
                    blacklistLabel,
                    blacklistColor,
                    actorsPage: isActorsPage,
                    tagsPage: currentHref.includes("/tags"),
                    advancedSearch: isAdvancedSearch,
                    searchOrUserPage: isSearchOrUserPage,
                    sortLabel,
                }),
            );
        }
        if (isJavbusSite) {
            const isStarPage = currentHref.includes("/star/");
            let blacklistLabel = "加入黑名单";
            let blacklistColor = "#d22020";
            if (isStarPage) {
                const blacklist = await storageManager.getBlacklist();
                const actressInfo = this.getActressPageInfo();
                if (
                    blacklist.find(
                        (entry: any) => entry.starId === actressInfo.starId,
                    )
                ) {
                    blacklistLabel = "已加入黑名单";
                    blacklistColor = "#885d5d";
                }
            }
            $(".masonry")
                .parent()
                .prepend(
                    MenuButtonBoxHtml({
                        site: "javbus",
                        blacklistLabel,
                        blacklistColor,
                        starPage: isStarPage,
                    }),
                );
        }
    }

    /**
     * 绑定按钮点击事件：待鉴定/已收藏批量打开、新作品检测、演员黑名单、排序切换、
     * 加入黑名单、一键屏蔽。对应原 L8044-8104。无参数，无返回值。
     */
    bindEvent(): void {
        $("#waitCheckBtn").on("click", () => {
            this.openWaitCheck().then();
        });
        $("#waitDownBtn").on("click", () => {
            this.openFavorite().then();
        });
        $("#newVideoBtn").on("click", () => {
            this.getBean("NewVideoPlugin").openDialog();
        });
        $("#blacklistBtn").on("click", () => {
            this.getBean("BlacklistPlugin").openBlacklistDialog();
        });
        $("#sort-toggle-btn").on("click", (event: any) => {
            const currentMethod = localStorage.getItem("jhs_sortMethod");
            const nextMethod: string =
                currentMethod && currentMethod !== "default"
                    ? currentMethod === "rateCount"
                        ? "date"
                        : "default"
                    : "rateCount";
            const methodLabels: Record<string, string> = {
                default: "默认",
                rateCount: "评价人数",
                date: "时间",
            };
            $(event.target).text(`当前排序方式: ${methodLabels[nextMethod]}`);
            localStorage.setItem("jhs_sortMethod", nextMethod);
            this.sortItems().then();
        });
        const blacklistPlugin = this.getBean("BlacklistPlugin");
        $("#addBlacklistBtn").on("click", async (event: any) => {
            await blacklistPlugin.addBlacklist(event);
        });
        $("#filterAllVideo").on("click", async (event: any) => {
            const position = {
                clientX: event.clientX,
                clientY: event.clientY + 80,
            };
            const nameEl = isJavdbSite
                ? $(".actor-section-name")
                : $(".avatar-box .photo-info .pb10");
            if (nameEl.length === 0) {
                show.error("获取演员名称失败");
                return;
            }
            const actressName = nameEl.text().trim().split(",")[0];
            utils.q(position, "一键屏蔽视频列表?", async () => {
                this.loadObj = loading();
                try {
                    await blacklistPlugin.filterAllVideo(actressName);
                    (window as any).refresh();
                } catch (err: any) {
                    console.error(err);
                } finally {
                    this.loadObj?.close();
                }
            });
        });
    }

    /**
     * 列表项排序：依 localStorage 的 jhs_sortMethod（default/rateCount/date）对
     * .movie-list .item 重排；搜索/用户页、高级搜索页、autoPage 开启时跳过。
     * 对应原 L8105-8157。
     *
     * @returns Promise<void>；无显式抛出
     */
    async sortItems(): Promise<void> {
        if (
            currentHref.includes("handle") ||
            currentHref.includes("advanced_search")
        ) {
            return;
        }
        const autoPage = await storageManager.getSetting("autoPage");
        if (isSearchOrUserPage || autoPage === YES) {
            return;
        }
        const sortMethod = localStorage.getItem("jhs_sortMethod");
        if (!sortMethod) {
            return;
        }
        $(".movie-list .item").each((index: number, element: any) => {
            if (!$(element).attr("data-original-index")) {
                $(element).attr("data-original-index", index);
            }
        });
        const listEl = $(".movie-list");
        const itemEls = $(".item", listEl);
        if (sortMethod === "default") {
            itemEls
                .sort(
                    (itemA: any, itemB: any) =>
                        $(itemA).data("original-index") -
                        $(itemB).data("original-index"),
                )
                .appendTo(listEl);
        } else {
            const items = itemEls.get();
            items.sort((itemA: any, itemB: any) => {
                if (sortMethod === "rateCount") {
                    const getRateCount = (el: any): number => {
                        const match = $(el)
                            .find(".score .value")
                            .text()
                            .match(/由(\d+)人/);
                        if (match) {
                            return parseFloat(match[1]);
                        } else {
                            return 0;
                        }
                    };
                    return getRateCount(itemB) - getRateCount(itemA);
                } else {
                    // 原 return new Date(t)；Date-Date 隐式 valueOf 减法在 TS 下不合法，
                    // 改返回 .getTime()（数值结果等价）。
                    const getDate = (el: any): number => {
                        const dateStr = $(el).find(".meta").text().trim();
                        return new Date(dateStr).getTime();
                    };
                    return getDate(itemB) - getDate(itemA);
                }
            });
            listEl.empty().append(items);
        }
    }

    /**
     * 批量打开待鉴定影片：遍历可见列表项，跳过已含屏蔽/已收藏/已下载/已观看
     * 标签的项，按 waitCheckCount 上限依次打开（FC2 番号走 Fc2Plugin，其余
     * window.open 并附加 autoPlay=1）。对应原 L8158-8185。
     *
     * @returns Promise<void>；无显式抛出
     */
    async openWaitCheck(): Promise<void> {
        const selectorConfig = this.getSelector();
        const maxCount = await storageManager.getSetting("waitCheckCount", 5);
        const skipTags = [
            BLOCKED_TEXT,
            FAVORITED_TEXT,
            HAS_DOWN_TEXT,
            WATCHED_TEXT,
        ];
        let openedCount = 0;
        $(`${selectorConfig.itemSelector}:visible`).each(
            (_index: number, element: any) => {
                if (openedCount >= maxCount) {
                    return false;
                }
                const itemEl = $(element);
                if (
                    skipTags.some(
                        (tagText: string) =>
                            itemEl.find(`span.tag:contains('${tagText}')`)
                                .length > 0,
                    )
                ) {
                    return;
                }
                const { carNum, aHref } =
                    this.getBean("ListPagePlugin").findCarNumAndHref(itemEl);
                if (carNum.includes("FC2-")) {
                    const movieId = this.parseMovieId(aHref);
                    this.getBean("Fc2Plugin")?.openFc2Page(
                        movieId,
                        carNum,
                        aHref,
                    );
                } else {
                    const url =
                        aHref +
                        (aHref.includes("?") ? "&autoPlay=1" : "?autoPlay=1");
                    window.open(url);
                }
                openedCount++;
            },
        );
        if (openedCount === 0) {
            show.info("没有需鉴定的视频");
        }
    }

    /**
     * 批量打开已收藏影片：取收藏列表（status=favorite），按 createDate 倒序，
     * 依 waitCheckCount 上限依次打开（FC2 番号走 Fc2Plugin，其余 window.open）。
     * 对应原 L8186-8206。
     *
     * @returns Promise<void>；无显式抛出
     */
    async openFavorite(): Promise<void> {
        const maxCount = await storageManager.getSetting("waitCheckCount", 5);
        const favoriteList = (await storageManager.getCarList())
            .filter((item: any) => item.status === FAVORITE_ACTION)
            .sort((a: any, b: any) => b.createDate - a.createDate);
        for (let i = 0; i < maxCount; i++) {
            if (i >= favoriteList.length) {
                return;
            }
            const carInfo = favoriteList[i];
            const carNum = carInfo.carNum;
            const url = carInfo.url;
            if (carNum.includes("FC2-")) {
                const movieId = this.parseMovieId(url);
                await this.getBean("Fc2Plugin")?.openFc2Page(
                    movieId,
                    carNum,
                    url,
                );
            } else {
                window.open(url);
            }
            clog.debug("打开已收藏", carNum, url);
        }
    }
}
