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
 * - 内联 CSS/HTML（含 Tabulator 列配置、layer 弹窗 content、设置表单 HTML、
 *   帮助文档 HTML、回到顶部 CSS/SVG）原样保留，仅替换模板插值变量名。
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

    /** 注入设置面板 CSS（容器宽度/列数 + 设置项/开关/侧栏/面板等样式）。对应原 L9469-9482。 */
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
        return `\n            <style>\n                ${cssText}\n                .nav-btn::after {\n                    content:none !important;\n                }\n                \n                #cache-data-display pre {\n                    font-family: Consolas, Monaco, 'Andale Mono', monospace;\n                    white-space: pre-wrap;\n                    word-wrap: break-word;\n                    line-height: 1.5;\n                    color: #333;\n                    border: 1px solid #ddd;\n                }\n                \n                .cache-item {\n                    transition: all 0.2s ease;\n                }\n                .cache-item:hover {\n                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n                    transform: translateY(-2px);\n                }\n\n                .tooltip-icon {\n                    display: inline-block;\n                    width: 16px;\n                    height: 16px;\n                    line-height: 16px;\n                    text-align: center;\n                    border-radius: 50%;\n                    background-color: #ccc;\n                    color: white;\n                    font-size: 12px;\n                    margin-right: 5px;\n                    cursor: help;\n                }\n                .setting-item {\n                    display: flex;\n                    align-items: baseline;\n                    justify-content: space-between;\n                    margin-bottom: 3px;\n                    padding: 3px;\n                    /*border: 1px solid #ddd;\n                    border-radius: 5px;*/\n                }\n                .simple-setting .setting-item{\n                    align-items:center;\n                }\n                .setting-label {\n                    font-size: 14px;\n                    min-width: 160px;\n                    font-weight: bold;\n                    margin-right: 10px;\n                }\n                .form-content{\n                    max-width: 160px;\n                    min-width: 160px;\n                }\n                .form-content * {\n                    width: 100%;\n                    padding: 5px;\n                    margin-right: 10px;\n                    text-align: center;\n                }\n                \n                .keyword-label {\n                    display: inline-flex;\n                    align-items: center;\n                    padding: 4px 8px;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    position: relative;\n                    margin-left: 8px;\n                    margin-bottom: 5px;\n                }\n                .keyword-remove {\n                    margin-left: 6px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1;\n                }\n                .keyword-input {\n                    padding: 6px 12px;\n                    border: 1px solid #ccc;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    float:right;\n                }\n                .add-tag-btn {\n                    padding: 6px 12px;\n                    background-color: #e2e8f0;\n                    color: #334155;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 14px;\n                    margin-left: 8px;\n                    float:right;\n                }\n                .add-tag-btn:hover {\n                    background-color: #cbd5e1;\n                }\n                .tag-box {\n                    margin-top:15px;\n                }\n                \n                \n                #saveBtn,#moreBtn,#helpBtn,#clean-all {\n                    padding: 8px 20px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 16px;\n                    margin-top: 10px;\n                }\n                #saveBtn:hover {\n                    background-color: #45a049;\n                }\n                #moreBtn {\n                    background-color: #5cb85c;\n                    color: white;\n                }\n                #moreBtn:hover {\n                    background-color: #4cae4c;\n                }\n                #helpBtn {\n                    background-color: #e67e22;\n                    color: white;\n                }\n                #helpBtn:hover {\n                    background-color: #d35400;\n                }\n                .simple-setting, .mini-simple-setting {\n                    display: none;\n                    background: rgba(255,255,255,1); \n                    position: absolute;\n                    top: ${isJavdbSite ? "35px" : "25px"};\n                    right: ${isJavdbSite ? "-300%" : "0"};\n                    z-index: 1000;\n                    border: 1px solid #ddd;\n                    border-radius: 4px;\n                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n                    padding: 0;\n                    margin-top: 5px; /* 稍微拉开一点距离 */\n                    color: #333;\n                }\n                \n                .mini-switch {\n                  appearance: none;\n                  -webkit-appearance: none;\n                  width: 40px;\n                  height: 20px;\n                  background: #e0e0e0;\n                  border-radius: 20px;\n                  position: relative;\n                  cursor: pointer;\n                  outline: none;\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked {\n                  background: #4CAF50;\n                }\n                \n                .mini-switch::before {\n                  content: "";\n                  position: absolute;\n                  width: 16px;\n                  height: 16px;\n                  border-radius: 50%;\n                  background: white;\n                  top: 2px;\n                  left: 2px;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked::before {\n                  left: calc(100% - 18px);\n                }\n                \n                .side-menu-item {\n                    padding: 12px 12px;\n                    cursor: pointer;\n                    color: #333;\n                    border-left: 3px solid transparent;\n                    transition: all 0.2s;\n                    display: flex;\n                    gap: 5px;\n                }\n                \n                .side-menu-item .icon {\n                     height: 24px; \n                     width: 24px;\n                }\n                \n                .side-menu-item:hover {\n                    background-color: #e9e9e9;\n                }\n                \n                .side-menu-item.active {\n                    background-color: #e0e0e0;\n                    border-left: 3px solid #5d87c2;\n                    font-weight: bold;\n                }\n                \n                .content-panel {\n                    display: none;\n                    margin-top:20px;\n                    padding: 0 10px 10px 0;\n                    height: 100%;\n                    overflow-x: hidden;\n                    overflow-y: auto;\n                }\n                \n                .content-panel.active {\n                    display: block;\n                }\n                \n                input[type="checkbox"]:disabled {\n                    opacity: 0.6; \n                    cursor: default !important;\n                }\n            </style>\n        `;
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
                '<div class="navbar-item has-dropdown is-hoverable setting-box" style="position:relative;">\n                    <a id="setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-right:15px !important;">\n                        设置\n                    </a>\n                    <div class="simple-setting"></div>\n                </div>',
            );
            utils.loopDetector(
                () => $("#miniHistoryBtn").length > 0,
                () => {
                    $(".miniHistoryBtnBox").before(
                        '\n                    <div class="navbar-item mini-setting-box" style="position:relative;margin-left: auto;">\n                        <a id="mini-setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-left:0 !important;padding-right:0 !important;">\n                            设置\n                        </a>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                ',
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
                            '\n                    <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                        <div class="setting-box">\n                            <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                <span>设置</span>\n                            </a>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ',
                        );
                },
                1,
                10000,
                false,
            );
            if ((window as any).isDetailPage) {
                $("h3").before(
                    '\n                    <div class="container-fluid" style="margin-top:20px">\n                        <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                            <div class="setting-box">\n                                <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                    <span>设置</span>\n                                </a>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ',
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
        utils.insertStyle(`
            #jhs-back-to-top {
                position: fixed;
                bottom: 40px;
                right: 40px;
                width: 44px;
                height: 44px;
                background-color: rgba(30, 30, 30, 0.9);
                backdrop-filter: blur(4px);
                color: #e0e0e0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transform: translateY(20px) scale(0.9);
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.05);
                user-select: none;
            }
            #jhs-back-to-top:hover {
                background-color: #ff8400;
                color: #fff;
                transform: translateY(0) scale(1);
                box-shadow: 0 8px 20px rgba(255, 132, 0, 0.3);
                border-color: #ff8400;
            }
            #jhs-back-to-top.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
            }
            #jhs-back-to-top svg {
                width: 22px;
                height: 22px;
                fill: currentColor;
                stroke: currentColor;
                stroke-width: 0;
            }
        `);
        // 使用 SVG 图标替换纯文本
        const svgIcon = `<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z"></path></svg>`;
        const btn = $(
            `<div id="jhs-back-to-top" title="回到顶部">${svgIcon}</div>`,
        );
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
            .map(
                (item) =>
                    `\n            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">\n                <div style="font-weight: bold; margin-bottom: 8px;">${item.text}</div>\n                <div style="display: flex; gap: 8px;">\n                    <a class="menu-btn clean-btn" data-key="${item.key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${item.title}">\n                        <span>清理</span>\n                    </a>\n                    <a class="menu-btn view-btn" data-key="${item.key}" style="background-color:#b2bec0; flex:1; text-align:center;" >\n                        <span>查看</span>\n                    </a>\n                </div>\n            </div>\n        `,
            )
            .join("");
        let qualityOptionsHtml = "";
        VIDEO_QUALITY_LIST.forEach((option) => {
            if (option.canSelect) {
                qualityOptionsHtml += `<option value="${option.quality}">${option.text}</option>`;
            }
        });
        const dialogHtml = `\n            <div style="display: flex; height: 100%;">\n                <div style="width: 140px; flex-shrink: 0; padding: 15px 0; background: #f5f5f5; border-right: 1px solid #ddd;">\n                    <div class="side-menu-item ${panelName === "backup-panel" ? "active" : ""}" data-panel="backup-panel">💾 数据备份</div>\n                    <div class="side-menu-item ${panelName === "base-panel" ? "active" : ""}" data-panel="base-panel">⚙️ 基础配置</div>\n                    <div class="side-menu-item ${panelName === "filter-panel" ? "active" : ""}" data-panel="filter-panel">🚫 屏蔽配置</div>\n                    <div class="side-menu-item ${panelName === "domain-panel" ? "active" : ""}" data-panel="domain-panel" title="第三方视频资源域名配置">🌐 外部网站</div>\n                    <div class="side-menu-item ${panelName === "hotkey-panel" ? "active" : ""}" data-panel="hotkey-panel">⌨️ 快捷键配置</div>\n                    <div class="side-menu-item ${panelName === "cache-panel" ? "active" : ""}" data-panel="cache-panel">🧹 清理缓存</div>\n                    </div>\n        \n                <div style="flex: 1; display: flex; flex-direction: column; height: 100%; ">\n                    <div style="flex: 1; margin: 0 10px; padding-bottom: 20px;overflow: hidden">\n                    \n                        \x3c!-- 备份面板 --\x3e\n                        <div id="backup-panel" class="content-panel" style="display: ${panelName === "backup-panel" ? "block" : "none"};">\n                            <div style="margin-bottom: 20px">\n                                <a id="importBtn" class="menu-btn" style="background-color:#d25a88"><span>导入数据</span></a>\n                                <a id="exportBtn" class="menu-btn" style="background-color:#85d0a3"><span>导出数据</span></a>\n                                </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">WebDav备份</span>\n                                <div>\n                                    <a id="webdavBackupListBtn" class="menu-btn" style="background-color:#5d87c2"><span>查看备份</span></a>\n                                    <a id="webdavBackupBtn" class="menu-btn" style="background-color:#64bb69"><span>备份数据</span></a>\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">服务地址:</span>\n                                <div class="form-content">\n                                    <input id="webDavUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">用户名:</span>\n                                <div class="form-content">\n                                    <input id="webDavUsername">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">密码:</span>\n                                <div class="form-content">\n                                    <input id="webDavPassword">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \n                        \x3c!-- 基础设置面板 --\x3e\n                        <div id="base-panel" class="content-panel" style="display: ${panelName === "base-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">打开待鉴定|已收藏 窗口数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="waitCheckCount" min="1" max="20" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">已鉴定标签展示位置:</span>\n                                <div class="form-content">\n                                    <select id="tagPosition">\n                                        <option value="rightTop">右上</option>\n                                        <option value="leftTop">左上</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    鉴定补录演员信息 <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            \n\n                            <div class="setting-item">\n                                <span class="setting-label">预览视频默认画质:</span>\n                                <div class="form-content">\n                                    <select id="videoQuality">\n                                        ${qualityOptionsHtml}\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">评论区条数:</span>\n                                <div class="form-content">\n                                    <select id="reviewCount">\n                                        <option value="10">10条</option>\n                                        <option value="20">20条</option>\n                                        <option value="30">30条</option>\n                                        <option value="40">40条</option>\n                                        <option value="50">50条</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${isJavdbSite ? "" : "do-hide"}">\n                                <span class="setting-label">\n                                    高亮已收藏演员 <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${isJavdbSite ? "" : "do-hide"}">\n                                <span id="highlightedTagLabel" class="setting-label">\n                                    分类标签|高亮演员-边框样式:\n                                </span>\n                                <div class="form-content" style="display: flex; align-items: center;">\n                                    <input type="number" id="highlightedTagNumber" min="0" max="20">\n                                    <input type="color" id="highlightedTagColor">\n                                </div>\n                            </div>\n\n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求超时时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpTimeout" min="1000" max="10000" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求失败重试次数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpRetryCount" min="0" max="10" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    启用控制台日志:\n                                </span>\n                                <div class="form-content">\n                                    <select id="enableClog">\n                                        <option value="no">禁用</option>\n                                        <option value="yes">开启</option>\n                                    </select>\n                                </div>\n                            </div>\n\n                            <div class="setting-item">\n                                <span class="setting-label">日志最大行数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="clogMsgCount" min="100" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        <div id="domain-panel" class="content-panel" style="display: ${panelName === "domain-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - MissAv:</span>\n                                <div class="form-content">\n                                    <input id="missAvUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - SupJav:</span>\n                                <div class="form-content">\n                                    <input id="supJavUrl">\n                                </div>\n                            </div>           \n                        </div>\n                         \n                         \x3c!-- 快捷键 --\x3e\n                        <div id="hotkey-panel" class="content-panel" style="display: ${panelName === "hotkey-panel" ? "block" : "none"};">\n                            <p style="color: #666; font-size: 0.9em;">修改后, 刷新页面生效</p>\n                            <div class="setting-item">\n                                <span class="setting-label">${BLOCK_TEXT}:</span>\n                                <div class="form-content">\n                                    <input id="filterHotKey" placeholder="录入快捷键" data-default-hotkey="a">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${FAVORITE_TEXT}:</span>\n                                <div class="form-content">\n                                    <input id="favoriteHotKey" placeholder="录入快捷键" data-default-hotkey="s">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${WATCHED_TEXT}:</span>\n                                <div class="form-content">\n                                    <input id="hasWatchHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">⏩ 快进:</span>\n                                <div class="form-content">\n                                    <input id="speedVideoHotKey" placeholder="录入快捷键" data-default-hotkey="z">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">▲ 折叠:</span>\n                                <div class="form-content">\n                                    <input id="foldCategoryHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">💻 控制台:</span>\n                                <div class="form-content">\n                                    <input id="clogHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    <span data-tip="列表页,鼠标放置图片上时可使用快捷键">❓ </span> 对视频列表页启用快捷键:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableImageHotKey" class="mini-switch">\n                                </div>\n                            </div>\n\n                        </div>\n                        \n                        \x3c!-- 屏蔽设置面板 --\x3e\n                        <div id="filter-panel" class="content-panel" style="display: ${panelName === "filter-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">\n                                     启用划词屏蔽 <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">❓ </span>\n                                </span>\n                                <div style="display: flex">\n                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="reviewKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">评论区屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="filterKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">视频标题屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                        </div>\n                        <div id="cache-panel" class="content-panel" style="display: ${panelName === "cache-panel" ? "block" : "none"};">\n                            <h1 style="text-align:center;font-size: 20px;font-weight: bold">以下操作, 不会对核心数据造成影响</h1>\n                            <br/>               \n                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">\n                                ${cacheItemsHtml}\n                            </div>    \n                            <div id="cache-data-display" style="margin-top: 20px; display: none;">\n                                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;"></pre>\n                            </div>\n                        </div>                        \n                        </div><div style="flex-shrink: 0; padding: 15px 20px; text-align: right; border-top: 1px solid #eee; background: white;">   \n                        <button id="saveBtn">保存设置</button>\n                        <button id="clean-all" style="display: none">♾️ 清理全部缓存</button>\n                    </div>\n                </div>\n            </div>\n        `;
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
        return `\n             <div class="jhs-scrollbar" style="margin-top:20px;max-height:90vh; overflow-y:auto;">\n                <div style="margin: 0 10px;">\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            显示已鉴定内容:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽单番号: </span><input type="checkbox" id="showFilterItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽演员: </span><input type="checkbox" id="showFilterActorItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽关键词: </span><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">收藏: </span><input type="checkbox" id="showFavoriteItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已观看: </span><input type="checkbox" id="showHasWatchItem" class="mini-switch"><br/>\n                        </div>\n                    </div>\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">❓ </span> 显示所有:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <input type="checkbox" id="showAllItem" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="点击封面的打开方式,弹窗|新窗口">❓ </span>弹窗方式打开页面:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                             <input type="checkbox" id="dialogOpenDetail" class="mini-switch">\n                        </div>\n                    </div>      \n                    \n                    <div class="setting-item">\n                        <span class="setting-label">鉴定后立即关闭页面:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="needClosePage" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                             <span data-tip="使用瀑布流模式, 排序方式将调整为默认">❓ </span>瀑布流模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="autoPage" class="mini-switch">\n                        </div>\n                    </div>\n       \n                    <div class="setting-item">\n                        <span class="setting-label">启用标题翻译:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="translateTitle" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">启用悬浮大图:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="hoverBigImg" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                                        \n                    <div class="setting-item">\n                        <span class="setting-label">启用115视频匹配: </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enable115Match" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    ${isJavdbSite ? '\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页是否展示女优年龄、三围等信息">❓ </span>加载女优信息:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadActressInfo" class="mini-switch">\n                        </div>\n                    </div>' : ""}\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页第三方资源检测,如missAv,123AV">❓ </span>加载第三方视频资源:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadOtherSite" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页图片区首列位置加载长缩略图">❓ </span>加载长缩略图:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadScreenShot" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                     <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页解析更多更高画质的预览视频">❓ </span>更高画质预览视频:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadPreviewVideo" class="mini-switch">\n                        </div>\n                    </div>\n\n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="列数6以上,建议开启竖图">❓ </span>竖图模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableVerticalModel" class="mini-switch">\n                        </div>\n                    </div>\n                                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面列数: <span id="showContainerColumns"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerColumns" min="2" max="10" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面宽度: <span id="showContainerWidth"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerWidth" min="0" max="30" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                </div>\n                <div style="padding: 0 20px 15px; text-align: right; border-top: 1px solid #eee;">   \n                    <button id="helpBtn" style="float:left;">常见问题</button>\n                    <button id="moreBtn">更多设置</button>\n                </div>\n            </div>\n        `;
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
                    '\n<style>\n    .help-container {\n        font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;\n        color: #333;\n        padding: 15px;\n        max-height: 100%;\n        overflow-y: auto;\n    }\n    \n    .help-section {\n        margin-bottom: 25px;\n    }\n    \n    .help-section summary {\n        font-size: 18px;\n        color: #3498db;\n        margin-bottom: 12px;\n        cursor: pointer;\n    }\n    \n    .help-content {\n        background-color: #f9f9f9;\n        border-radius: 5px;\n        padding: 15px;\n        border-left: 4px solid #3498db;\n    }\n    \n    .help-content p {\n        line-height: 1.6;\n        margin-bottom: 10px;\n    }\n    .help-section img {\n        max-width: 100%;\n        height: auto;\n        border: 1px solid #ddd;\n        border-radius: 4px;\n        box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n    }\n\n</style>\n\n<div class="help-container">\n    <h1 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">使用说明</h1>\n    \n    <details class="help-section">\n        <summary>1. 无法查看预览视频，提示分流?</summary>\n        <div class="help-content">\n            <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>\n            <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>\n            <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>\n            <p><a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">Clash Verge分流规则设置 </a> (如果你是别的代理软件，自行搜索如何分流)</p>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>2. 如何屏蔽某一系列的番号?</summary>\n        <div class="help-content">\n            <p>方法一：设置中-添加视频标题关键词，如: VENX-</p>\n            <p>方法二：进入详情页，选中标题文字，右键可加入</p>\n            <img src="https://i.imgur.com/lVnhK5A.png" alt="进入详情页，选中标题，进行右键"/>\n        </div>\n    </details>\n\n    <details class="help-section">\n        <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>\n        <div class="help-content">\n            <p>屏蔽演员前，先筛选分类，再点屏蔽</p>\n            <img src="https://imgur.com/Ue7eCAi.png" alt="屏蔽演员前，先筛选分类，再点屏蔽"/>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>4. 如何多浏览器同时登录115网盘?</summary>\n        <div class="help-content">\n            <p>① 访问115登录页, 选择JHS-扫码面板, 并扫码登录</p>\n            <img src="https://imgur.com/XbaisWD.png" alt=""/>\n        </div>\n        <div class="help-content">\n            <p>② 进入网盘后, 右下角悬浮按钮, 复制Cookie</p>\n            <img src="https://imgur.com/GvzJ2Gy.png" alt=""/>\n        </div>\n        <div class="help-content">\n            <p>③ 打开另一个浏览器(需装JHS脚本), 进入登录页面, 选择JHS-扫码面板, 输入Cookie并回车</p>\n            <img src="https://imgur.com/FX08qdO.png" alt=""/>\n        </div>\n    </details>\n</div>\n',
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
            const verticalCss = `\n                .cover {\n                    min-height: 350px !important;\n                    overflow: hidden !important;\n                    padding-top: 142% !important;\n                }\n                \n                .cover img {\n                    object-fit: cover !important;\n                    object-position: ${objectPosition};\n                }\n                \n                /* bus的 */\n                .masonry .movie-box img {\n                    min-height: 500px !important;\n                    object-fit: cover !important;\n                    object-position: top right;\n                }\n            `;
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(verticalCss)
                .appendTo("head");
        } else {
            const horizontalCss =
                "\n                .cover {\n                    min-height:auto !important;\n                    padding-top: 67% !important;\n                }\n                .cover img {\n                    object-fit: contain !important;\n                    object-position: 50% 50% !important\n                }\n                \n                /* bus的 */\n                 .masonry .movie-box img {\n                    min-height:auto !important;\n                    object-fit: contain !important;\n                    object-position: top;\n                }\n            ";
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(horizontalCss)
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
                `\n                <a class="keyword-label" data-keyword="${keyword}" style="background-color: ${bgColor}; color: ${textColor}" href="/video_codes/${keyword.replace("-", "")}" target="_blank">\n                    ${keyword}\n                    <span class="keyword-remove">×</span>\n                </a>\n            `,
            );
        } else {
            $label = $(
                `\n                <div class="keyword-label" data-keyword="${keyword}" style="background-color: ${bgColor}; color: ${textColor}">\n                    ${keyword}\n                    <span class="keyword-remove">×</span>\n                </div>\n            `,
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
            content:
                '\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            ',
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
