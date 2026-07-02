/**
 * 折叠分类插件 FoldCategoryPlugin —— 对应原脚本 archetype/jhs.user.js L4016-4138。
 *
 * 在列表页（非高级搜索）提供两项能力：
 *   1. 标签高亮：hover 标签出现 ★ 按钮，点击切换该标签的高亮收藏状态（持久化到
 *      storageManager），并以边框样式标记已高亮标签；
 *   2. 折叠分类区：在分类工具条追加"折叠/展开"按钮，依 localStorage 的
 *      jhs_foldCategory（YES/NO）控制分类区显隐，按钮文案/图标随之切换，
 *      并可显示快捷键提示。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r）已语义化：
 *   settings / tagEl / btnEl / cloneEl / tagName / highlightedTags / isFolded /
 *   label / iconClass / nextLabel / nextIconClass / hotkey / tagsEl /
 *   selectedTagsText / sectionTitleEl / foldBtnEl / expandEl / event。
 * 顶层常量 o / _ / C 改由 ../constants 引入（currentHref / YES / NO）。
 * 运行时挂载到 window 的 isListPage，以此处 (window as any).isListPage 访问，
 * 保持原逻辑并满足 strict 类型检查。
 * $ / utils / storageManager 已由 ../types/globals.d.ts 声明为 any；
 * jQuery hover / click / .map 回调需依赖 this 指向触发元素，故保留 function 形式
 * 并以 (this: any) 显式标注，满足 noImplicitThis。内联 CSS/HTML 字符串原样保留。
 */
import { currentHref } from "../constants/site";
import { YES, NO } from "../constants/status";
import { BasePlugin } from "./base-plugin";

export class FoldCategoryPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L4017-4019。 */
    getName(): string {
        return "FoldCategoryPlugin";
    }

    /**
     * 注入标签高亮所需 CSS：高亮按钮悬浮态、已高亮标签边框（颜色/粗细可由
     * 设置项 highlightedTagColor / highlightedTagNumber 定制）。
     * 对应原 L4020-4023。
     *
     * @returns 含 <style> 的 CSS 片段字符串
     */
    async initCss(): Promise<string> {
        const settings = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: 999;\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: #FF5722;\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${settings.highlightedTagNumber || 1}px solid ${settings.highlightedTagColor || "#ce2222"};\n                }\n            </style>\n        `;
    }

    /**
     * 列表页主处理：高亮标签 + 轮询等待按钮就绪后创建折叠按钮 + 展开所有折叠的
     * 分类组。对应原 L4024-4044。
     * 仅当 window.isListPage 且当前 URL 不含 "advanced_search" 时执行。
     *
     * @returns Promise<void>；无显式抛出，子任务异常由各自内部消化
     */
    async handle(): Promise<void> {
        if ((window as any).isListPage) {
            if (!currentHref.includes("advanced_search")) {
                this.highlightTag();
                utils.loopDetector(
                    () => $("#waitCheckBtn").length,
                    () => {
                        this.createFoldBtn();
                    },
                    1,
                    10000,
                    true,
                );
                $("#tags .tag-category .tag-expand").each(
                    (_index: number, expandEl: any) => {
                        if ($(expandEl).parent().hasClass("collapse")) {
                            expandEl.click();
                        }
                    },
                );
            }
        }
    }

    /**
     * 标签高亮：加载已高亮标签并打标记，hover 显示 ★ 按钮，点击 ★ 切换该标签的
     * 高亮收藏状态（增删 storageManager 高亮列表并同步 DOM 类名）。
     * 对应原 L4045-4092。无参数，无返回值；内部以 async IIFE 触发持久化读取，
     * hover/click 事件回调为 fire-and-forget。
     */
    highlightTag(): void {
        (async () => {
            const highlightedTags = await storageManager.getHighlightedTags();
            if (highlightedTags) {
                highlightedTags.forEach((tagName: any) => {
                    $(`#tags a.tag:contains(${tagName})`).addClass(
                        "highlighted",
                    );
                    $(`.tags a.tag:contains(${tagName})`).addClass(
                        "highlighted",
                    );
                });
            }
        })().then();
        $("#tags a.tag, .tags a.tag").hover(
            function (this: any) {
                const tagEl = $(this);
                const btnEl = $(
                    '<button class="highlight-btn" title="高亮显示">★</button>',
                );
                tagEl.append(btnEl);
                btnEl.fadeIn(0);
            },
            function (this: any) {
                $(this)
                    .find(".highlight-btn")
                    .fadeOut(0, function (this: any) {
                        $(this).remove();
                    });
            },
        );
        $(document).on(
            "click",
            ".highlight-btn",
            async function (this: any, event: any) {
                event.stopPropagation();
                event.preventDefault();
                const tagEl = $(this).closest("a.tag");
                const cloneEl = tagEl.clone();
                cloneEl.find(".highlight-btn").remove();
                const tagName = cloneEl
                    .text()
                    .trim()
                    .replace(/\s*\(\d+\)$/, "");
                let highlightedTags = await storageManager.getHighlightedTags();
                if (highlightedTags.includes(tagName)) {
                    highlightedTags = highlightedTags.filter(
                        (item: any) => item !== tagName,
                    );
                    tagEl.removeClass("highlighted");
                } else {
                    highlightedTags.push(tagName);
                    tagEl.addClass("highlighted");
                }
                await storageManager.setHighlightedTags(highlightedTags);
            },
        );
    }

    /**
     * 创建折叠分类按钮：读取已选分类、在工具条/标题区追加按钮，依 localStorage
     * 的 jhs_foldCategory（YES/NO）初始化折叠态与文案/图标，并绑定点击切换。
     * 对应原 L4093-4137。
     *
     * @returns Promise<void>；若无已选分类或目标容器则提前 return，不抛出异常
     */
    async createFoldBtn(): Promise<void> {
        const hotkey = await storageManager.getSetting("foldCategoryHotKey");
        let tagsEl = $("#tags");
        let selectedTagsText = $("#tags dl div.tag.is-info")
            .map(function (this: any) {
                return $(this).text().replaceAll("\n", "").replaceAll(" ", "");
            })
            .get()
            .join(" ");
        if (!selectedTagsText) {
            return;
        }
        $(".tabs").append(
            `\n            <div style="display: flex;align-items: center;flex-grow:1;justify-content: flex-end;">\n                <div>已选分类: <span id="jhs-check-tag">${selectedTagsText}</span></div>\n                <a class="menu-btn  main-tab-btn" id="foldCategoryBtn" style="background-color:#d23e60 !important;">\n                    <span></span>\n                    ${hotkey ? ` (${hotkey})` : ""}\n                    <i style="margin-left: 10px"></i>\n                </a>\n\n            </div>\n        `,
        );
        let sectionTitleEl = $("h2.section-title");
        if (sectionTitleEl.length > 0) {
            sectionTitleEl.append(
                '\n                <div id="foldCategoryBtn">\n                    <a class="menu-btn" style="background-color:#d23e60 !important;margin-left: 20px;border-bottom:none !important;border-radius:3px;">\n                        <span></span>\n                        <i style="margin-left: 10px"></i>\n                    </a>\n                </div>\n            ',
            );
            tagsEl = $("section > div > div.box");
        }
        if (!tagsEl) {
            return;
        }
        const foldBtnEl = $("#foldCategoryBtn");
        let isFolded: boolean =
            localStorage.getItem("jhs_foldCategory") === YES;
        let [label, iconClass] = isFolded
            ? ["展开", "icon-angle-double-down"]
            : ["折叠", "icon-angle-double-up"];
        foldBtnEl
            .find("span")
            .text(label)
            .end()
            .find("i")
            .attr("class", iconClass);
        if (!window.location.href.includes("noFold=1")) {
            tagsEl[isFolded ? "hide" : "show"]();
        }
        foldBtnEl.on("click", async (event: any) => {
            event.preventDefault();
            isFolded = !isFolded;
            localStorage.setItem("jhs_foldCategory", isFolded ? YES : NO);
            const [nextLabel, nextIconClass] = isFolded
                ? ["展开", "icon-angle-double-down"]
                : ["折叠", "icon-angle-double-up"];
            foldBtnEl
                .find("span")
                .text(nextLabel)
                .end()
                .find("i")
                .attr("class", nextIconClass);
            tagsEl[isFolded ? "hide" : "show"]();
        });
    }
}
