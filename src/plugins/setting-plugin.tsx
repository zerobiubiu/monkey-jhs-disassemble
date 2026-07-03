/**
 * 设置插件 SettingPlugin —— 对应原脚本 archetype/jhs.user.js L9429-10564。
 *
 * 全局设置入口：注入设置按钮（JavDb 顶栏下拉 / JavBus 顶部菜单 / 详情页 h3 前），
 * 悬浮显示简化设置面板（显示已鉴定/收藏/已观看、弹窗打开、瀑布流、翻译、悬浮大图、
 * 115 匹配、女优信息、第三方资源、长缩略图、更高画质预览、竖图模式、页面列数/宽度），
 * 点击打开完整设置弹层（数据备份 / 基础配置 / 屏蔽配置 / 外部网站 / 快捷键 / 清理缓存）；
 * 提供本地导入导出、WebDav 云备份/查看/下载/导入、缓存清理与查看、回到顶部按钮。
 *
 * JS→TS 改造要点：
 * - 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/d/h/g/p 等）已语义化命名。
 * - 站点布尔 r/l 改由 ../constants/site 引入（isJavdbSite/isJavbusSite）；
 *   状态文本 m/v/k 与布尔标识 _/C 改由 ../constants/status 引入
 *   （BLOCK_TEXT/FAVORITE_TEXT/WATCHED_TEXT/YES/NO）；
 *   画质列表 L 改由 ../constants/video-quality 引入（VIDEO_QUALITY_LIST）。
 * - 原顶层 ImageHoverPreview 改用 ../core/image-preview 的 ImagePreview（同名重构）。
 * - window.isDetailPage 为运行时挂载全局，以 (window as any).isDetailPage 访问；
 *   window.refresh() 以全局 refresh() 调用（src/types/globals.d.ts 已声明）；
 *   window.imageHoverPreviewObj 以 (window as any).imageHoverPreviewObj 访问。
 * - WebDav 加密/解密/客户端（原 Me/Ne/De）尚未从 legacy 导出，暂以
 *   (window as any).Me / .Ne / .De 访问，后续提取 core/webdav 后替换。
 * - 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 *   改为 class 字段语法（useDefineForClassFields:true，语义一致）。
 * - $ / layer / utils / storageManager / show / clog / Tabulator / loading 已由
 *   ../types/globals.d.ts 声明为 any；jQuery .each 回调按本仓库既有约定改写为
 *   (_index, element) 箭头形式，规避 noImplicitThis；
 *   .side-menu-item 点击保留 function(this: any) 以维持 $(this) 语义。
 * - any 类型 callee（$/layer/Tabulator/utils/gmHttp 等）的回调参数显式标注 : any
 *   以规避 noImplicitAny；未使用的回调参数加 _ 前缀豁免 noUnusedParameters。
 * - catch (e) → catch (err: any)（strict useUnknownInCatchVariables）。
 * - 内联 HTML/CSS 已提取为组件/CSS：设置挂载容器/回到顶部按钮/关键词标签/简化设置面板/
 *   缓存项/画质选项 → 组件，回到顶部 CSS 与竖图/横图 CSS → src/styles/*.css + ?raw。
 *   layer 弹窗 content 由 SettingDialog/HelpDialog/BackupFileDialog 组件返回 JSX，
 *   经 jsxToString 转为 HTML 字符串（doc/21）。
 * - 控制流（分支、try/catch/finally、fire-and-forget .then()、loopDetector、
 *   requestAnimationFrame 滚动监听、FileReader 异步链）与原脚本一致。
 */
import { isJavdbSite, isJavbusSite } from "../constants/site";
import {
    BLOCK_TEXT,
    FAVORITE_TEXT,
    WATCHED_TEXT,
    YES,
    NO,
} from "../constants/status";
import { VIDEO_QUALITY_LIST } from "../constants/video-quality";
import { BasePlugin } from "./base-plugin";
import { ImagePreview } from "../core/image-preview";
import settingCssRaw from "../styles/setting-plugin.css?raw";
import helpDialogCssRaw from "../styles/help-dialog.css?raw";
import backToTopCssRaw from "../styles/back-to-top-button.css?raw";
import verticalImgCssRaw from "../styles/setting-image-mode-vertical.css?raw";
import horizontalImgCssRaw from "../styles/setting-image-mode-horizontal.css?raw";
import { jsxToString } from "../core/jsx-to-string";
import { SettingDialog } from "../components/setting-dialog";
import { HelpDialog } from "../components/help-dialog";
import { BackupFileDialog } from "../components/backup-file-dialog";
import { BackToTopButton } from "../components/back-to-top-button";
import { CacheItemHtml } from "../components/cache-item-html";
import { KeywordLabel } from "../components/keyword-label";
import { SettingMountBox } from "../components/setting-mount-box";
import { SimpleSettingPanel } from "../components/simple-setting-panel";
import { VideoQualityOption } from "../components/video-quality-option";

/** 缓存项配置（localStorage 键 + 展示文本 + 说明）。 */
interface CacheItem {
    key: string;
    text: string;
    title: string;
}

export class SettingPlugin extends BasePlugin {
    /** WebDav 备份目录名。对应原 L9432。 */
    folderName = "JHS-数据备份";

    /** 可清理的缓存项清单。对应原 L9433-9464。 */
    cacheItems: CacheItem[] = [
        {
            key: "jhs_dmm_video",
            text: "🎥 预览视频缓存",
            title: "预览视频缓存",
        },
        {
            key: "jhs_other_site",
            text: "🌍 第三方站点缓存",
            title: "第三方站点资源检测结果, 如missav,123Av等",
        },
        {
            key: "jhs_screenShot",
            text: "🖼️ 缩略图缓存",
            title: "缩略图缓存",
        },
        {
            key: "jhs_translate",
            text: "🆎 标题翻译",
            title: "标题翻译",
        },
        {
            key: "jhs_actress_info",
            text: "👩 演员信息",
            title: "演员的年龄三围等数据信息",
        },
        {
            key: "jhs_score_info",
            text: "⭐ Top250|热播 评分数据",
            title: "Top250及热播的评分数据",
        },
    ];

    /** 返回插件名，供 PluginManager 注册去重。对应原 L9466-9468。 */
    getName(): string {
        return "SettingPlugin";
    }

    /** 注入设置面板 CSS（容器宽度/列数 + 设置项/开关/侧栏/面板等样式）。对应原 L9469-9482。
     *  帮助弹窗 help-* 样式不在 initCss 注入，改由 helpBtn 点击时在 layer.open
     *  content 中拼接 help-dialog.css（原 L10040 content 内 <style> 块 + HTML），
     *  与原脚本 content 字符级一致。 */
    async initCss(): Promise<string> {
        const settings = await storageManager.getSetting();
        const containerWidth =
            (settings == null ? undefined : settings.containerWidth) ?? "100";
        const containerColumns =
            utils.isMobile() && window.innerWidth < 1000
                ? 1
                : ((settings == null ? undefined : settings.containerColumns) ??
                  5);
        this.applyImageMode().then();
        let cssText = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${containerWidth}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));\n            }\n        `;
        if (isJavbusSite) {
            cssText = `\n                .container-fluid .row{\n                    max-width: 1000px !important;\n                    min-width: ${containerWidth}%;\n                    margin: auto auto;\n                }\n                \n                .container {\n                    max-width: 1000px !important;\n                    min-width: 80%;\n                    margin: auto auto;\n                }\n                \n                .masonry {\n                    grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));\n                }\n            `;
        }
        return settingCssRaw
            .replace("__CSS_TEXT__", cssText)
            .replace("__SIMPLE_SETTING_TOP__", isJavdbSite ? "35px" : "25px")
            .replace("__SIMPLE_SETTING_RIGHT__", isJavdbSite ? "-300%" : "0");
    }

    /** 挂载设置按钮入口（顶栏/顶栏迷你/详情页 h3 前）并绑定悬浮/点击。对应原 L9483-9558。 */
    async handle(): Promise<void> {
        if ((await storageManager.getSetting("enableClog", YES)) === YES) {
            clog.show();
        }
        if (isJavdbSite) {
            const toggleSettingBox = function () {
                if ($(".navbar-search").is(":hidden")) {
                    $(".mini-setting-box").hide();
                    $(".setting-box").show();
                } else {
                    $(".mini-setting-box").show();
                    $(".setting-box").hide();
                }
            };
            $("#navbar-menu-user .navbar-end").prepend(
                jsxToString(<SettingMountBox variant="navbar" />),
            );
            utils.loopDetector(
                () => $("#miniHistoryBtn").length > 0,
                () => {
                    $(".miniHistoryBtnBox").before(
                        jsxToString(<SettingMountBox variant="mini" />),
                    );
                    toggleSettingBox();
                },
            );
            $(window).resize(toggleSettingBox);
        }
        if (isJavbusSite) {
            utils.loopDetector(
                () => $("#waitCheckBtn").length,
                () => {
                    $("#waitCheckBtn")
                        .parent()
                        .append(
                            jsxToString(<SettingMountBox variant="topright" />),
                        );
                },
                1,
                10000,
                false,
            );
            if ((window as any).isDetailPage) {
                $("h3").before(
                    jsxToString(<SettingMountBox variant="containerfluid" />),
                );
            }
        }
        $(".main-nav, .container-fluid").on(
            "click",
            "#setting-btn, #mini-setting-btn",
            () => {
                clog.lowZIndex();
                this.openSettingDialog();
            },
        );
        $(".main-nav, .container-fluid")
            .on("mouseenter", ".setting-box", () => {
                $(".simple-setting").html(this.simpleSetting()).show();
                this.initSimpleSettingForm().then();
                clog.lowZIndex();
            })
            .on("mouseleave", ".setting-box", () => {
                $(".simple-setting").html("").hide();
            });
        $(".main-nav, .container-fluid")
            .on("mouseenter", ".mini-setting-box", () => {
                $(".mini-simple-setting").html(this.simpleSetting()).show();
                this.initSimpleSettingForm().then();
                clog.lowZIndex();
            })
            .on("mouseleave", ".mini-setting-box", () => {
                $(".mini-simple-setting").html("").hide();
            });
        this.addBackToTopBtn();
    }

    /** 挂载"回到顶部"悬浮按钮并绑定滚动显隐/点击平滑滚动。对应原 L9559-9629。 */
    addBackToTopBtn(): void {
        utils.insertStyle(backToTopCssRaw);
        const btn = $(jsxToString(<BackToTopButton />));
        $("body").append(btn);
        btn.on("click", () => {
            utils.smoothScrollToTop(500); // 稍微放慢一点滚动速度，更有质感
        });

        // 使用 requestAnimationFrame 优化滚动监听
        let ticking = false;
        $(window).on("scroll", () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if ($(window).scrollTop() > 300) {
                        btn.addClass("show");
                    } else {
                        btn.removeClass("show");
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    /** 打开完整设置弹层（侧栏 + 各面板）。对应原 L9630-9660。 */
    async openSettingDialog(
        panelName: string = "backup-panel",
        callback?: () => void,
    ): Promise<void> {
        const cacheItemsHtml = this.cacheItems
            .map((item) =>
                jsxToString(
                    <CacheItemHtml
                        text={item.text}
                        cacheKey={item.key}
                        title={item.title}
                    />,
                ),
            )
            .join("");
        let qualityOptionsHtml = "";
        VIDEO_QUALITY_LIST.forEach((option) => {
            if (option.canSelect) {
                qualityOptionsHtml += jsxToString(
                    <VideoQualityOption
                        quality={option.quality}
                        text={option.text}
                    />,
                );
            }
        });
        const dialogHtml = jsxToString(
            <SettingDialog
                panelName={panelName}
                cacheItemsHtml={cacheItemsHtml}
                qualityOptionsHtml={qualityOptionsHtml}
                isJavdbSite={isJavdbSite}
                blockText={BLOCK_TEXT}
                favoriteText={FAVORITE_TEXT}
                watchedText={WATCHED_TEXT}
            />,
        );
        layer.open({
            type: 1,
            title: "设置",
            content: dialogHtml,
            area: utils.getResponsiveArea(["55%", "90%"]),
            scrollbar: false,
            success: (layerEl: any, layerIndex: any) => {
                $(layerEl)
                    .find(".layui-layer-content")
                    .css("position", "relative");
                this.loadForm();
                this.bindClick();
                utils.setupEscClose(layerIndex);
                if (callback) {
                    callback();
                }
            },
        });
    }

    /** 生成简化设置面板 HTML（悬浮下拉显示的精简版）。对应原 L9661-9663。 */
    simpleSetting(): string {
        return jsxToString(<SimpleSettingPanel isJavdbSite={isJavdbSite} />);
    }

    /** 从 storageManager 加载设置并回填到设置表单各输入项。对应原 L9664-9747。 */
    async loadForm(): Promise<void> {
        const settings = await storageManager.getSetting();
        $("#videoQuality").val(settings.videoQuality);
        $("#reviewCount").val(settings.reviewCount || 20);
        $("#tagPosition").val(settings.tagPosition || "rightTop");
        $("#waitCheckCount").val(settings.waitCheckCount || 5);
        const tagNumber = settings.highlightedTagNumber || 1;
        const tagColor = settings.highlightedTagColor || "#ce2222";
        $("#highlightedTagNumber").val(settings.highlightedTagNumber || 1);
        $("#highlightedTagColor").val(
            settings.highlightedTagColor || "#ce2222",
        );
        $("#highlightedTagLabel").css(
            "border",
            `${tagNumber}px solid ${tagColor}`,
        );
        $("#enableClog").val(settings.enableClog || YES);
        $("#clogMsgCount").val(settings.clogMsgCount || 2000);
        $("#httpTimeout").val(settings.httpTimeout || 5000);
        $("#httpRetryCount").val(settings.httpRetryCount || 3);
        $("#webDavUrl").val(settings.webDavUrl || "");
        $("#webDavUsername").val(settings.webDavUsername || "");
        $("#webDavPassword").val(settings.webDavPassword || "");
        $("#enableTitleSelectFilter").prop(
            "checked",
            !settings.enableTitleSelectFilter ||
                settings.enableTitleSelectFilter === YES,
        );
        $("#enableFavoriteActresses").prop(
            "checked",
            !settings.enableFavoriteActresses ||
                settings.enableFavoriteActresses === YES,
        );
        $("#enableSaveActressCarInfo").prop(
            "checked",
            !!settings.enableSaveActressCarInfo &&
                settings.enableSaveActressCarInfo === YES,
        );
        const otherSitePlugin = this.getBean("OtherSitePlugin");
        const missAvUrl = await otherSitePlugin.getMissAvUrl();
        const supJavUrl = await otherSitePlugin.getSupJavUrl();
        $("#missAvUrl").val(missAvUrl);
        $("#supJavUrl").val(supJavUrl);
        const reviewFilterKeywordList =
            await storageManager.getReviewFilterKeywordList();
        const titleFilterKeyword = await storageManager.getTitleFilterKeyword();
        if (reviewFilterKeywordList) {
            reviewFilterKeywordList.forEach((keyword: string) => {
                this.addLabelTag("#reviewKeywordContainer", keyword);
            });
        }
        if (titleFilterKeyword) {
            titleFilterKeyword.forEach((keyword: string) => {
                this.addLabelTag("#filterKeywordContainer", keyword);
            });
        }
        ["#reviewKeywordContainer", "#filterKeywordContainer"].forEach(
            (containerSelector: string) => {
                $(`${containerSelector} .add-tag-btn`).on("click", () =>
                    this.addKeyword(containerSelector),
                );
                $(`${containerSelector} .keyword-input`).on(
                    "keypress",
                    (event: any) => {
                        if (event.key === "Enter") {
                            this.addKeyword(containerSelector);
                        }
                    },
                );
            },
        );
        $("#hotkey-panel [id]")
            .map((_index: number, element: any) => element.id)
            .get()
            .forEach((inputId: string) => {
                const $input = $(`#${inputId}`);
                const hotkeyValue =
                    settings[inputId] !== undefined
                        ? settings[inputId]
                        : $input.attr("data-default-hotkey") || "";
                $input
                    .val(hotkeyValue)
                    .on("input", (event: any) => {
                        const value = $(event.target).val();
                        if (
                            /[\u4e00-\u9fa5]/.test(value) ||
                            /^Shift[a-zA-Z0-9]+$/.test(value)
                        ) {
                            $(event.target).val("");
                            show.error(
                                "非法输入：不能输入中文或输入法转换错误",
                            );
                        }
                    })
                    .on("keydown", (event: any) =>
                        this.handleHotkeyInput(event, $input),
                    );
            });
        $("#enableImageHotKey").prop(
            "checked",
            !!settings.enableImageHotKey && settings.enableImageHotKey === YES,
        );
    }

    /** 快捷键输入框 keydown 处理：解析按键并查重。对应原 L9748-9760。 */
    handleHotkeyInput(event: any, $input: any): void {
        event.preventDefault();
        const hotkeyString = this.parseHotkey(event);
        if (hotkeyString !== "") {
            if (this.isDuplicateHotkey(hotkeyString, $input.attr("id"))) {
                show.error("该快捷键已被其他功能使用！");
            } else {
                $input.val(hotkeyString);
            }
        } else {
            $input.val("");
        }
    }

    /** 将 KeyboardEvent 解析为快捷键字符串（如 "Ctrl+Shift+A"）。对应原 L9761-9796。 */
    parseHotkey(event: any): string {
        if (event.key === "Backspace" || event.key === "Process") {
            return "";
        }
        const parts: string[] = [];
        if (event.ctrlKey) {
            parts.push("Ctrl");
        }
        if (event.shiftKey) {
            parts.push("Shift");
        }
        if (event.altKey) {
            parts.push("Alt");
        }
        if (event.metaKey) {
            parts.push("Cmd");
        }
        const keyName =
            (
                {
                    " ": "Space",
                    Control: "Ctrl",
                    Meta: "Cmd",
                    ArrowUp: "Up",
                    ArrowDown: "Down",
                    ArrowLeft: "Left",
                    ArrowRight: "Right",
                } as Record<string, string>
            )[event.key as string] ||
            (event.key.length > 1 ? event.key.replace("Arrow", "") : event.key);
        if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
            parts.push(keyName);
        }
        if (parts.length > 0) {
            return parts.join("+");
        } else {
            return "";
        }
    }

    /** 检查快捷键字符串是否已被其他输入框占用。对应原 L9797-9806。 */
    isDuplicateHotkey(hotkeyString: string, inputId: string): boolean {
        let isDuplicate = false;
        $("#hotkey-panel [id]").each((_index: number, element: any) => {
            if (
                element.id !== inputId &&
                hotkeyString &&
                hotkeyString === $(element).val()
            ) {
                isDuplicate = true;
                return false;
            }
        });
        return isDuplicate;
    }

    /** 初始化简化设置面板表单（回填值 + 绑定即时生效的 change/input 事件）。对应原 L9807-10044。 */
    async initSimpleSettingForm(): Promise<void> {
        const settings = await storageManager.getSetting();
        $("#containerColumns").val(settings.containerColumns || 5);
        $("#showContainerColumns").text(settings.containerColumns || 5);
        $("#containerWidth").val((settings.containerWidth || 100) - 70);
        $("#showContainerWidth").text((settings.containerWidth || 100) + "%");
        $("#dialogOpenDetail").prop(
            "checked",
            !settings.dialogOpenDetail || settings.dialogOpenDetail === YES,
        );
        $("#needClosePage").prop(
            "checked",
            !settings.needClosePage || settings.needClosePage === YES,
        );
        $("#autoPage").prop(
            "checked",
            !settings.autoPage || settings.autoPage === YES,
        );
        $("#translateTitle").prop(
            "checked",
            !settings.translateTitle || settings.translateTitle === YES,
        );
        $("#enableLoadActressInfo").prop(
            "checked",
            !settings.enableLoadActressInfo ||
                settings.enableLoadActressInfo === YES,
        );
        $("#enableLoadOtherSite").prop(
            "checked",
            !settings.enableLoadOtherSite ||
                settings.enableLoadOtherSite === YES,
        );
        $("#containerColumns").on("input", async () => {
            const columns = $("#containerColumns").val();
            $("#showContainerColumns").text(columns);
            if (isJavdbSite) {
                (
                    document.querySelector(".movie-list") as any
                ).style.gridTemplateColumns =
                    `repeat(${columns}, minmax(0, 1fr))`;
            }
            if (isJavbusSite) {
                (
                    document.querySelector(".masonry") as any
                ).style.gridTemplateColumns =
                    `repeat(${columns}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem("containerColumns", columns);
            this.applyImageMode();
        });
        $("#containerWidth").on("input", async (event: any) => {
            const rangeValue = parseInt($(event.target).val());
            const widthPercent = rangeValue + 70 + "%";
            $("#showContainerWidth").text(widthPercent);
            if (isJavdbSite) {
                (
                    document.querySelector("section .container") as any
                ).style.minWidth = widthPercent;
            }
            if (isJavbusSite) {
                (
                    document.querySelector(".container-fluid .row") as any
                ).style.minWidth = widthPercent;
            }
            storageManager.saveSettingItem("containerWidth", rangeValue + 70);
        });
        $("#dialogOpenDetail").on("change", () => {
            const value = $("#dialogOpenDetail").is(":checked") ? YES : NO;
            storageManager.saveSettingItem("dialogOpenDetail", value);
        });
        $("#showFilterItem").prop(
            "checked",
            !!settings.showFilterItem && settings.showFilterItem === YES,
        );
        $("#showFilterActorItem").prop(
            "checked",
            !!settings.showFilterActorItem &&
                settings.showFilterActorItem === YES,
        );
        $("#showFilterKeywordItem").prop(
            "checked",
            !!settings.showFilterKeywordItem &&
                settings.showFilterKeywordItem === YES,
        );
        $("#showFavoriteItem").prop(
            "checked",
            !settings.showFavoriteItem || settings.showFavoriteItem === YES,
        );
        $("#showHasWatchItem").prop(
            "checked",
            !settings.showHasWatchItem || settings.showHasWatchItem === YES,
        );
        $("#showFilterItem").on("change", async () => {
            const value = $("#showFilterItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("showFilterItem", value);
            refresh();
        });
        $("#showFilterActorItem").on("change", async () => {
            const value = $("#showFilterActorItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("showFilterActorItem", value);
            refresh();
        });
        $("#showFilterKeywordItem").on("change", async () => {
            const value = $("#showFilterKeywordItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem(
                "showFilterKeywordItem",
                value,
            );
            refresh();
        });
        $("#showFavoriteItem").on("change", async () => {
            const value = $("#showFavoriteItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("showFavoriteItem", value);
            refresh();
        });
        $("#showHasWatchItem").on("change", async () => {
            const value = $("#showHasWatchItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("showHasWatchItem", value);
            refresh();
        });
        const $filterCheckboxes = $(
            "#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasWatchItem",
        );
        const updateDisabledState = () => {
            const isChecked = $("#showAllItem").is(":checked");
            $filterCheckboxes.prop("disabled", isChecked);
            if (isChecked) {
                $filterCheckboxes.attr("data-tip", "请先关闭显示所有才可点击");
            } else {
                $filterCheckboxes.removeAttr("data-tip");
            }
        };
        $("#showAllItem").prop(
            "checked",
            !!settings.showAllItem && settings.showAllItem === YES,
        );
        $("#showAllItem").on("change", async () => {
            const value = $("#showAllItem").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("showAllItem", value);
            updateDisabledState();
            refresh();
        });
        updateDisabledState();
        $("#needClosePage").on("change", async () => {
            await storageManager.saveSettingItem(
                "needClosePage",
                $("#needClosePage").is(":checked") ? YES : NO,
            );
            refresh();
        });
        $("#autoPage").on("change", async () => {
            const value = $("#autoPage").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("autoPage", value);
            if (value === YES) {
                $("#sort-toggle-btn").hide();
            } else {
                $("#sort-toggle-btn").show();
            }
        });
        $("#translateTitle").on("change", async () => {
            const value = $("#translateTitle").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("translateTitle", value);
            if (value === YES) {
                await this.getBean("ListPagePlugin").doFilter();
            } else {
                await this.getBean("ListPagePlugin").revertTranslation();
                $(".translated-title").remove();
            }
        });
        $("#hoverBigImg").prop(
            "checked",
            !!settings.hoverBigImg && settings.hoverBigImg === YES,
        );
        $("#hoverBigImg").on("change", async () => {
            const value = $("#hoverBigImg").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("hoverBigImg", value);
            if (value === YES) {
                (window as any).imageHoverPreviewObj = new ImagePreview({
                    selector: this.getSelector().coverImgSelector,
                });
            } else if ((window as any).imageHoverPreviewObj) {
                (window as any).imageHoverPreviewObj.destroy();
            }
        });
        $("#enableLoadActressInfo").on("change", async () => {
            const value = $("#enableLoadActressInfo").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem(
                "enableLoadActressInfo",
                value,
            );
            if (value === YES) {
                this.getBean("ActressInfoPlugin").loadActressInfo();
            } else {
                $(".actress-info").remove();
            }
        });
        $("#enableLoadOtherSite").on("change", async () => {
            const value = $("#enableLoadOtherSite").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("enableLoadOtherSite", value);
            if (value === YES) {
                this.getBean("OtherSitePlugin").loadOtherSite().then();
            } else {
                $("#otherSiteBox").remove();
            }
        });
        $("#enableLoadScreenShot").prop(
            "checked",
            !settings.enableLoadScreenShot ||
                settings.enableLoadScreenShot === YES,
        );
        $("#enableLoadScreenShot").on("change", async () => {
            const value = $("#enableLoadScreenShot").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("enableLoadScreenShot", value);
            if (value !== YES) {
                $(".screen-container").remove();
            }
        });
        $("#enableLoadPreviewVideo").prop(
            "checked",
            !settings.enableLoadPreviewVideo ||
                settings.enableLoadPreviewVideo === YES,
        );
        $("#enableLoadPreviewVideo").on("change", async () => {
            const value = $("#enableLoadPreviewVideo").is(":checked")
                ? YES
                : NO;
            await storageManager.saveSettingItem(
                "enableLoadPreviewVideo",
                value,
            );
        });
        $("#enable115Match").prop(
            "checked",
            !!settings.enable115Match && settings.enable115Match === YES,
        );
        $("#enable115Match").on("change", async () => {
            const value = $("#enable115Match").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("enable115Match", value);
        });
        $("#enableVerticalModel").prop(
            "checked",
            !!settings.enableVerticalModel &&
                settings.enableVerticalModel === YES,
        );
        $("#enableVerticalModel").on("change", async () => {
            const value = $("#enableVerticalModel").is(":checked") ? YES : NO;
            await storageManager.saveSettingItem("enableVerticalModel", value);
            this.applyImageMode();
        });
        $("#moreBtn").on("click", () => {
            $(".simple-setting").html("").hide();
            this.openSettingDialog("base-panel");
        });
        $("#helpBtn").on("click", () => {
            layer.open({
                type: 1,
                title: "",
                shadeClose: true,
                scrollbar: false,
                content:
                    "<style>" +
                    helpDialogCssRaw +
                    "</style>" +
                    jsxToString(<HelpDialog />),
                area: utils.getResponsiveArea(["50%", "90%"]),
            });
        });
    }

    /** 按 enableVerticalModel 设置切换竖图/横图 CSS。对应原 L10045-10065。 */
    async applyImageMode(): Promise<void> {
        $("#verticalImgStyle").remove();
        if (
            (await storageManager.getSetting("enableVerticalModel", NO)) === YES
        ) {
            let objectPosition = "100% 50% !important";
            if (window.location.href.includes("/advanced_search?type=100")) {
                objectPosition = "50% 50% !important";
            }
            const verticalCss = verticalImgCssRaw.replace(
                "100% 50% !important; /*__OBJECT_POSITION__*/",
                `${objectPosition}; /*__OBJECT_POSITION__*/`,
            );
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(verticalCss)
                .appendTo("head");
        } else {
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(horizontalImgCssRaw)
                .appendTo("head");
        }
    }

    /** 绑定设置弹层内各按钮/输入的点击/输入事件。对应原 L10066-10131。 */
    bindClick(): void {
        $(".side-menu-item").on("click", function (this: any) {
            $(".side-menu-item").removeClass("active");
            $(this).addClass("active");
            $(".content-panel").hide();
            const panelName = $(this).data("panel");
            $("#" + panelName).show();
            if (panelName === "cache-panel") {
                $("#saveBtn").hide();
                $("#clean-all").show();
            } else {
                $("#saveBtn").show();
                $("#clean-all").hide();
            }
        });
        $("#importBtn").on("click", () => this.importData());
        $("#exportBtn").on("click", () => this.exportData());
        $("#webdavBackupBtn").on("click", () => this.backupDataByWebDav());
        $("#webdavBackupListBtn").on("click", () =>
            this.backupListBtnByWebDav(),
        );
        $("#saveBtn").on("click", () => this.saveForm());
        $(".clean-btn").on("click", (event: any) => {
            const cacheKey = $(event.currentTarget).data("key");
            const cacheItem = this.cacheItems.find(
                (item) => item.key === cacheKey,
            )!;
            localStorage.removeItem(cacheKey);
            show.ok(`${cacheItem.text} 清理成功`);
            $("#cache-data-display").hide();
            if (cacheKey === "jhs_dmm_video") {
                localStorage.removeItem("jhs_other_site_dmm");
            }
        });
        $("#clean-all").on("click", () => {
            this.cacheItems.forEach((item) =>
                localStorage.removeItem(item.key),
            );
            show.ok("全部缓存已清理");
            $("#cache-data-display").hide();
            localStorage.removeItem("jhs_other_site_dmm");
        });
        $(".view-btn").on("click", (event: any) => {
            const cacheKey = $(event.currentTarget).data("key");
            const cachedData = localStorage.getItem(cacheKey);
            const $display = $("#cache-data-display");
            const $pre = $display.find("pre");
            $display.show();
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    $pre.text(JSON.stringify(parsed, null, 2));
                } catch {
                    $pre.text(cachedData);
                }
            } else {
                $pre.text("无数据");
            }
        });
        const $tagNumber = $("#highlightedTagNumber");
        const $tagColor = $("#highlightedTagColor");
        const $tagLabel = $("#highlightedTagLabel");
        function updateBorder(): void {
            const number = $tagNumber.val();
            const color = $tagColor.val();
            $tagLabel.css("border", `${number}px solid ${color}`);
        }
        $tagNumber.on("input", updateBorder);
        $tagColor.on("input", updateBorder);
    }

    /** 保存设置表单到 storageManager 并刷新页面/相关插件。对应原 L10132-10207。 */
    async saveForm(): Promise<void> {
        const settings = await storageManager.getSetting();
        settings.videoQuality = $("#videoQuality").val();
        settings.reviewCount = $("#reviewCount").val();
        settings.tagPosition = $("#tagPosition").val();
        settings.waitCheckCount = $("#waitCheckCount").val();
        settings.highlightedTagNumber = $("#highlightedTagNumber").val();
        settings.highlightedTagColor = $("#highlightedTagColor").val();
        settings.httpTimeout = $("#httpTimeout").val();
        settings.httpRetryCount = $("#httpRetryCount").val();
        settings.enableClog = $("#enableClog").val();
        if (settings.enableClog === YES) {
            clog.show();
        } else {
            clog.hide();
        }
        settings.clogMsgCount = $("#clogMsgCount").val();
        settings.webDavUrl = $("#webDavUrl").val();
        settings.webDavUsername = $("#webDavUsername").val();
        settings.webDavPassword = $("#webDavPassword").val();
        settings.missAvUrl = $("#missAvUrl").val().replace(/\/$/, "");
        settings.supJavUrl = $("#supJavUrl").val().replace(/\/$/, "");
        settings.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(
            ":checked",
        )
            ? YES
            : NO;
        settings.enableFavoriteActresses = $("#enableFavoriteActresses").is(
            ":checked",
        )
            ? YES
            : NO;
        settings.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(
            ":checked",
        )
            ? YES
            : NO;
        $("#hotkey-panel [id]")
            .map((_index: number, element: any) => element.id)
            .get()
            .forEach((inputId: string) => {
                settings[inputId] = $(`#${inputId}`).val();
            });
        settings.enableImageHotKey = $("#enableImageHotKey").is(":checked")
            ? YES
            : NO;
        await storageManager.saveSetting(settings);
        const reviewKeywordList: string[] = [];
        $("#reviewKeywordContainer .keyword-label")
            .toArray()
            .forEach((label: any) => {
                const keyword = $(label)
                    .text()
                    .replace("×", "")
                    .replace(/[\r\n]+/g, " ")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                reviewKeywordList.push(keyword);
            });
        await storageManager.saveReviewFilterKeyword(reviewKeywordList);
        const titleFilterKeywordList: string[] = [];
        $("#filterKeywordContainer .keyword-label")
            .toArray()
            .forEach((label: any) => {
                const keyword = $(label)
                    .text()
                    .replace("×", "")
                    .replace(/[\r\n]+/g, " ")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                titleFilterKeywordList.push(keyword);
            });
        await storageManager.saveTitleFilterKeyword(titleFilterKeywordList);
        show.ok("保存成功");
        refresh();
        const newVideoPlugin = this.getBean("NewVideoPlugin");
        if (newVideoPlugin) {
            newVideoPlugin.resetBtnTip();
        }
        this.getBean("BlacklistPlugin").resetBtnTip();
        this.getBean("BlacklistPlugin").reloadTable();
    }

    /** 在关键词容器内添加一个关键词标签（带删除按钮）。对应原 L10208-10236。 */
    addLabelTag(containerSelector: string, keyword: string): void {
        const $tagBox = $(`${containerSelector} .tag-box`);
        let $label: any;
        const bgColor = "#cbd5e1";
        let textColor = "#333";
        if (/^[a-z]{2,}-/i.test(keyword) && isJavdbSite) {
            textColor = "#3477ad";
            $label = $(
                jsxToString(
                    <KeywordLabel
                        keyword={keyword}
                        bgColor={bgColor}
                        textColor={textColor}
                        variant="link"
                        href={`/video_codes/${keyword.replace("-", "")}`}
                    />,
                ),
            );
        } else {
            $label = $(
                jsxToString(
                    <KeywordLabel
                        keyword={keyword}
                        bgColor={bgColor}
                        textColor={textColor}
                        variant="div"
                    />,
                ),
            );
        }
        $label.find(".keyword-remove").click((event: any) => {
            event.stopPropagation();
            event.preventDefault();
            const $removeBtn = $(event.currentTarget);
            const removeKeyword = $removeBtn
                .closest(".keyword-label")
                .attr("data-keyword")
                .split(" ")[0];
            utils.q(event, `是否移除屏蔽词  ${removeKeyword}?`, async () => {
                $removeBtn.parent().remove();
            });
        });
        $tagBox.append($label);
    }

    /** 从输入框读取关键词并添加为标签。对应原 L10237-10244。 */
    addKeyword(containerSelector: string): void {
        const $input = $(`${containerSelector} .keyword-input`);
        const keyword = $input.val().trim();
        if (keyword) {
            this.addLabelTag(containerSelector, keyword);
            $input.val("");
        }
    }

    /** 从本地 JSON 文件导入数据（覆盖确认 + reload）。对应原 L10245-10291。 */
    importData(): void {
        try {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json";
            fileInput.onchange = (event: any) => {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = (loadEvent: any) => {
                    try {
                        const resultText = loadEvent.target.result.toString();
                        const parsedData = JSON.parse(resultText);
                        layer.confirm(
                            "确定是否要覆盖导入？",
                            {
                                icon: 3,
                                title: "确认覆盖",
                                btn: ["确定", "取消"],
                            },
                            async (layerIndex: any) => {
                                await storageManager.importData(parsedData);
                                show.ok("数据导入成功");
                                layer.close(layerIndex);
                                location.reload();
                            },
                        );
                    } catch (err: any) {
                        console.error(err);
                        show.error(
                            "导入失败：文件内容不是有效的JSON格式 " + err,
                        );
                    }
                };
                reader.onerror = () => {
                    show.error("读取文件时出错");
                };
                reader.readAsText(file);
            };
            document.body.appendChild(fileInput);
            fileInput.click();
            setTimeout(() => document.body.removeChild(fileInput), 1000);
        } catch (err: any) {
            console.error(err);
            show.error("导入数据时出错: " + err.message);
        }
    }

    /** 通过 WebDav 备份数据（加密后上传）。对应原 L10292-10323。 */
    async backupDataByWebDav(): Promise<void> {
        const settings = await storageManager.getSetting();
        const webDavUrl = settings.webDavUrl;
        if (!webDavUrl) {
            show.error("请填写webDav服务地址并保存后, 再试此功能");
            return;
        }
        const webDavUsername = settings.webDavUsername;
        if (!webDavUsername) {
            show.error("请填写webDav用户名并保存后, 再试此功能");
            return;
        }
        const webDavPassword = settings.webDavPassword;
        if (!webDavPassword) {
            show.error("请填写webDav密码并保存后, 再试此功能");
            return;
        }
        const fileName = utils.getNowStr("_", "_") + ".json";
        let exportText = JSON.stringify(await storageManager.exportData());
        exportText = (window as any).Me(exportText);
        const loadingHandle = loading();
        try {
            const webdavClient = new (window as any).De(
                webDavUrl,
                webDavUsername,
                webDavPassword,
            );
            await webdavClient.backup(this.folderName, fileName, exportText);
            show.ok("备份完成");
        } catch (err: any) {
            console.error(err);
            show.error(err.toString());
        } finally {
            loadingHandle.close();
        }
    }

    /** 通过 WebDav 查看备份文件列表。对应原 L10324-10352。 */
    async backupListBtnByWebDav(): Promise<void> {
        const settings = await storageManager.getSetting();
        const webDavUrl = settings.webDavUrl;
        if (!webDavUrl) {
            show.error("请填写webDav服务地址并保存后, 再试此功能");
            return;
        }
        const webDavUsername = settings.webDavUsername;
        if (!webDavUsername) {
            show.error("请填写webDav用户名并保存后, 再试此功能");
            return;
        }
        const webDavPassword = settings.webDavPassword;
        if (!webDavPassword) {
            show.error("请填写webDav密码并保存后, 再试此功能");
            return;
        }
        const loadingHandle = loading();
        try {
            const webdavClient = new (window as any).De(
                webDavUrl,
                webDavUsername,
                webDavPassword,
            );
            const backupList = await webdavClient.getBackupList(
                this.folderName,
            );
            this.openFileListDialog(backupList, webdavClient, "WebDav");
        } catch (err: any) {
            console.error(err);
            show.error(`发生错误: ${err ? err.message : err}`);
        } finally {
            loadingHandle.close();
        }
    }

    /** 打开备份文件列表弹层（Tabulator 表格，含删除/下载/导入操作）。对应原 L10353-10552。 */
    openFileListDialog(
        backupList: any,
        webdavClient: any,
        titlePrefix: string,
    ): void {
        layer.open({
            type: 1,
            title: titlePrefix + "备份文件",
            content: jsxToString(<BackupFileDialog />),
            area: ["800px", "70%"],
            anim: -1,
            success: () => {
                const table = new Tabulator("#table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: true,
                    data: backupList,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: true,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center",
                    },
                    columns: [
                        {
                            title: "文件名",
                            field: "name",
                            width: 200,
                            headerSort: false,
                            responsive: 0,
                        },
                        {
                            title: "文件大小",
                            field: "size",
                            responsive: 1,
                            headerSort: false,
                            formatter: (
                                cell: any,
                                _params: any,
                                _onRendered: any,
                            ) => {
                                const units = [
                                    "B",
                                    "KB",
                                    "MB",
                                    "GB",
                                    "TB",
                                    "PB",
                                ];
                                let unitIndex = 0;
                                let size = cell.getData().size;
                                while (
                                    size >= 1024 &&
                                    unitIndex < units.length - 1
                                ) {
                                    size /= 1024;
                                    unitIndex++;
                                }
                                return `${size % 1 == 0 ? size.toFixed(0) : size.toFixed(2)} ${units[unitIndex]}`;
                            },
                        },
                        {
                            title: "备份日期",
                            field: "createTime",
                            responsive: 2,
                            headerSort: false,
                            formatter: (
                                cell: any,
                                _params: any,
                                _onRendered: any,
                            ) => {
                                const data = cell.getData();
                                return `${utils.getNowStr("-", ":", data.createTime)}`;
                            },
                        },
                        {
                            title: "操作",
                            minWidth: 250,
                            responsive: 0,
                            headerSort: false,
                            formatter: (
                                cell: any,
                                _params: any,
                                onRendered: any,
                            ) => {
                                const rowData = cell.getData();
                                onRendered(() => {
                                    const $dangerBtn = cell
                                        .getElement()
                                        .querySelector(".a-danger");
                                    const $primaryBtn = cell
                                        .getElement()
                                        .querySelector(".a-primary");
                                    const $successBtn = cell
                                        .getElement()
                                        .querySelector(".a-success");
                                    if ($dangerBtn) {
                                        $dangerBtn.addEventListener(
                                            "click",
                                            (_event: any) => {
                                                layer.confirm(
                                                    `是否删除 ${rowData.name} ?`,
                                                    {
                                                        icon: 3,
                                                        title: "提示",
                                                        btn: ["确定", "取消"],
                                                    },
                                                    async (layerIndex: any) => {
                                                        layer.close(layerIndex);
                                                        let loadingHandle =
                                                            loading();
                                                        try {
                                                            await webdavClient.deleteFile(
                                                                rowData.fileId,
                                                            );
                                                            let newList =
                                                                await webdavClient.getBackupList(
                                                                    this
                                                                        .folderName,
                                                                );
                                                            table.replaceData(
                                                                newList,
                                                            );
                                                            layer.alert(
                                                                "删除成功",
                                                            );
                                                        } catch (err: any) {
                                                            console.error(err);
                                                            show.error(
                                                                `发生错误: ${err ? err.message : err}`,
                                                            );
                                                        } finally {
                                                            loadingHandle.close();
                                                        }
                                                    },
                                                );
                                            },
                                        );
                                    }
                                    if ($primaryBtn) {
                                        $primaryBtn.addEventListener(
                                            "click",
                                            async (_event: any) => {
                                                let loadingHandle = loading();
                                                try {
                                                    const decrypted = (
                                                        window as any
                                                    ).Ne(
                                                        await webdavClient.getFileContent(
                                                            rowData.fileId,
                                                        ),
                                                    );
                                                    utils.download(
                                                        decrypted,
                                                        rowData.name,
                                                    );
                                                } catch (err: any) {
                                                    clog.error(err);
                                                    show.error(
                                                        "下载失败: " + err,
                                                    );
                                                } finally {
                                                    loadingHandle.close();
                                                }
                                            },
                                        );
                                    }
                                    if ($successBtn) {
                                        $successBtn.addEventListener(
                                            "click",
                                            (_event: any) => {
                                                layer.confirm(
                                                    `是否将该云备份数据 ${rowData.name} 导入?`,
                                                    {
                                                        icon: 3,
                                                        title: "提示",
                                                        btn: ["确定", "取消"],
                                                    },
                                                    async (layerIndex: any) => {
                                                        layer.close(layerIndex);
                                                        let loadingHandle =
                                                            loading();
                                                        try {
                                                            let fileContent =
                                                                await webdavClient.getFileContent(
                                                                    rowData.fileId,
                                                                );
                                                            show.info(
                                                                "解密文件内容...",
                                                            );
                                                            fileContent = (
                                                                window as any
                                                            ).Ne(fileContent);
                                                            show.info(
                                                                "解密完成, 开始导入...",
                                                            );
                                                            const parsedData =
                                                                JSON.parse(
                                                                    fileContent,
                                                                );
                                                            await storageManager.importData(
                                                                parsedData,
                                                            );
                                                            show.ok(
                                                                "导入成功!",
                                                            );
                                                            window.location.reload();
                                                        } catch (err: any) {
                                                            console.error(err);
                                                            show.error(err);
                                                        } finally {
                                                            loadingHandle.close();
                                                        }
                                                    },
                                                );
                                            },
                                        );
                                    }
                                });
                                return '\n                                    <a class="a-danger">删除</a>\n                                    <a class="a-primary">下载</a>\n                                    <a class="a-success">导入</a>\n                                ';
                            },
                        },
                    ],
                    locale: "zh-cn",
                    langs: {
                        "zh-cn": {
                            pagination: {
                                first: "首页",
                                first_title: "首页",
                                last: "尾页",
                                last_title: "尾页",
                                prev: "上一页",
                                prev_title: "上一页",
                                next: "下一页",
                                next_title: "下一页",
                                all: "所有",
                                page_size: "每页行数",
                            },
                        },
                    },
                });
            },
        });
    }

    /** 导出本地 JSON 数据文件。对应原 L10553-10563。 */
    async exportData(): Promise<void> {
        try {
            const exportText = JSON.stringify(
                await storageManager.exportData(),
            );
            const fileName = `${utils.getNowStr("_", "_")}.json`;
            utils.download(exportText, fileName);
            show.ok("数据导出成功");
        } catch (err: any) {
            console.error(err);
            show.error("导出数据时出错: " + err.message);
        }
    }
}
