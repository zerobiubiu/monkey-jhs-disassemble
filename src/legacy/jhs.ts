// @ts-nocheck
/**
 * 鉴黄师 用户脚本 - 过渡载体（legacy）
 *
 * 本文件由 archetype/jhs.user.js 原样迁入，作为渐进式重构的起点。
 * - @ts-nocheck：原脚本为混淆 JS，暂跳过类型检查以保证打包通过。
 * - 后续将逐步把各模块（CSS / 常量 / 资源 / core / plugins / components）
 *   从本文件提取为正式 TS 模块，本文件随之缩减直至废弃。
 * - 在逻辑、执行顺序、副作用上与原始脚本保持一致。
 */

import {
    currentHref as o,
    isJavdbSite as r,
    isJavbusSite as l,
    isSearchOrUserPage as c,
    JAVDB as T,
    JAVBUS as I,
    ACTOR as B,
    ACTRESS as P,
    CENSORED as D,
    UNCENSORED as A,
} from "../constants/site";
import {
    FILTER_ACTION as d,
    FAVORITE_ACTION as h,
    HAS_WATCH_ACTION as p,
    BLOCK_TEXT as m,
    BLOCKED_TEXT as u,
    BLOCK_COLOR as f,
    FAVORITE_TEXT as v,
    FAVORITED_TEXT as b,
    FAVORITE_COLOR as w,
    WATCHED_TEXT as k,
    WATCHED_COLOR as S,
    NO as C,
    YES as _,
} from "../constants/status";
import { VIDEO_QUALITY_LIST as L } from "../constants/video-quality";
import loadingCssRaw from "../styles/loading.css?raw";
import javbusMasonryCssRaw from "../styles/javbus-masonry.css?raw";
import javdbSiteCssRaw from "../styles/javdb-site.css?raw";
import commonToolbarCssRaw from "../styles/common-toolbar.css?raw";
import aNormalButtonsCssRaw from "../styles/a-normal-buttons.css?raw";
import { Hotkey as ie } from "../core/hotkey";
import {
    loadGfriends as gt,
    parseFiletree as ht,
    filetreeDb as lt,
} from "../core/gfriends";
import { WebDavClient as De } from "../core/webdav";
import { createLoading } from "../core/loading";
import { show } from "../core/toast";
import { ImagePreview } from "../core/image-preview";
import { VIEWER_CONFIG } from "../core/viewer";
import { Logger } from "../core/logger";
import { StorageManager } from "../core/storage-manager";
import { CommonUtil } from "../core/common-util";
import { GmHttp } from "../core/gm-http";
import {
    API_BASE as U,
    reBuildSignature as O,
    fetchMovieReviews as R,
    fetchMovieDetail as V,
    fetchRelatedCollections as K,
    fetchPlaybackRanking as W,
    fetchTopMovies as q,
} from "../constants/api";
import { BasePlugin } from "../plugins/base-plugin";
import { PluginManager } from "../plugins/plugin-manager";
import { DetailPagePlugin } from "../plugins/detail-page-plugin";
import { FilterTitleKeywordPlugin } from "../plugins/filter-title-keyword-plugin";
import { HighlightMagnetPlugin } from "../plugins/highlight-magnet-plugin";
import { FoldCategoryPlugin } from "../plugins/fold-category-plugin";
import { ActressInfoPlugin } from "../plugins/actress-info-plugin";
import { HitShowPlugin } from "../plugins/hit-show-plugin";
import { Top250Plugin } from "../plugins/top250-plugin";
import { NavBarPlugin } from "../plugins/nav-bar-plugin";
import { OtherSitePlugin } from "../plugins/other-site-plugin";
import { ReviewPlugin } from "../plugins/review-plugin";
import { ListPageButtonPlugin } from "../plugins/list-page-button-plugin";
import { AutoPagePlugin } from "../plugins/auto-page-plugin";
import { BlacklistPlugin } from "../plugins/blacklist-plugin";
import { WantAndWatchedVideosPlugin } from "../plugins/want-and-watched-videos-plugin";
import { FavoriteActressesPlugin } from "../plugins/favorite-actresses-plugin";
import { NewVideoPlugin } from "../plugins/new-video-plugin";
import { HistoryPlugin } from "../plugins/history-plugin";
import { SettingPlugin } from "../plugins/setting-plugin";
import { DetailPageButtonPlugin } from "../plugins/detail-page-button-plugin";
import { ListPagePlugin } from "../plugins/list-page-plugin";
import { PreviewVideoPlugin } from "../plugins/preview-video-plugin";

var e;
var t;
var n = Object.defineProperty;
var a = (e) => {
    throw TypeError(e);
};
var i = (e, t, a) =>
    ((e, t, a) =>
        t in e
            ? n(e, t, {
                  enumerable: true,
                  configurable: true,
                  writable: true,
                  value: a,
              })
            : (e[t] = a))(e, typeof t != "symbol" ? t + "" : t, a);
var s = (e, t, n) => {
    ((e, t, n) => {
        if (!t.has(e)) {
            a("Cannot " + n);
        }
    })(e, t, "access private method");
    return n;
};
let M = "";
if (window.location.href.includes("hideNav=1")) {
    M =
        "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    ";
}
const N = javbusMasonryCssRaw.replace("/*__HIDENAV__*/", M);
let j = "";
if (window.location.href.includes("hideNav=1")) {
    j =
        "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ";
}
const E = javdbSiteCssRaw.replace("/*__HIDENAV2__*/", j);
function generateScrollbarCss() {
    const e = [
        ".jhs-scrollbar",
        ".content-panel",
        ".tabulator-tableholder",
        ".has-navbar-fixed-top",
        ".layui-layer-content",
    ];
    const t = (e, t) => e.map((e) => `${e}${t}`).join(",");
    const n = "::-webkit-scrollbar-track";
    const a = "::-webkit-scrollbar-thumb";
    const i = "::-webkit-scrollbar-thumb:hover";
    return `\n    ${t(e, "::-webkit-scrollbar")}{width:6px;height:6px;}\n    ${t(e, n)}{background:#f1f1f1;border-radius:10px;}\n    ${t(e, a)}{background:#888;border-radius:10px;}\n    ${t(e, i)}{background:#555;}\n    `
        .trim()
        .replace(/\n/g, "");
}
const F = commonToolbarCssRaw.replace(
    "/*__SCROLLBAR__*/",
    generateScrollbarCss(),
);
function H(e) {
    if (e) {
        if (e.includes("<style>")) {
            document.head.insertAdjacentHTML("beforeend", e);
        } else {
            const t = document.createElement("style");
            t.textContent = e;
            document.head.appendChild(t);
        }
    }
}
if (l) {
    H(N);
}
if (r) {
    H(E);
}
H(aNormalButtonsCssRaw);
H(F);
e = new WeakSet();
t = async function (e, t, n) {
    let a;
    if (Array.isArray(e)) {
        a = [...e];
    } else {
        a = (await this.forage.getItem(t)) || [];
        if (a.includes(e)) {
            const t = `${e} ${n}已存在`;
            show.error(t);
            throw new Error(t);
        }
        a.push(e);
    }
    await this.forage.setItem(t, a);
    return a;
};

unsafeWindow.utils = window.utils = new CommonUtil();
unsafeWindow.gmHttp = window.gmHttp = new GmHttp();
unsafeWindow.storageManager = window.storageManager = new StorageManager();
unsafeWindow.gt = window.gt = gt;
unsafeWindow.lt = window.lt = lt;
unsafeWindow.De = window.De = De;
const G = new BroadcastChannel("channel-refresh");
window.refresh = function () {
    G.postMessage({
        type: "refresh",
    });
};
window.cleanCache_filter_actor_actress_car_list = function () {
    G.postMessage({
        type: "cleanCache_filter_actor_actress_car_list",
    });
};
window.clean_cacheSettingObj = function () {
    G.postMessage({
        type: "clean_cacheSettingObj",
    });
};
document.head.insertAdjacentHTML(
    "beforeend",
    "<style>" + loadingCssRaw + "</style>",
);
unsafeWindow.loading = window.loading = createLoading;
unsafeWindow.show = window.show = show;
(function () {
    function e(e = 10) {
        setTimeout(() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }, e);
    }
    document.head.insertAdjacentHTML(
        "beforeend",
        "\n        <style>\n            .viewer-canvas {\n                overflow: auto !important;\n            }\n            \n            .viewer-close {\n                background: rgba(255,0,0,0.6) !important;\n            }\n            .viewer-close:hover {\n                background: rgba(255,0,0,0.8) !important;\n            }\n        </style>\n    ",
    );
    window.showImageViewer = function (t, n = "") {
        let a = null;
        let i = false;
        if (typeof t == "string" || t instanceof String) {
            a = $('<div class="temporary-container" style="display:none;">')
                .append(`<img src="${t}" alt="${n}">`)
                .appendTo("body");
            i = true;
        } else {
            a = $(t);
        }
        const viewerRef = { current: null };
        const s = VIEWER_CONFIG({
            container: a,
            isTemporary: i,
            resetOverflow: e,
            viewerRef,
        });
        viewerRef.current = new Viewer(a[0], s);
        viewerRef.current.show();
    };
})();
(async function () {
    document.head.insertAdjacentHTML(
        "beforeend",
        "\n        <style>\n            .console-logger-container {\n                position: fixed;\n                bottom: 0;\n                right: 0;\n                z-index: 99999999;\n                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n                display: flex;\n                flex-direction: column; \n                align-items: flex-end;\n                width: fit-content;\n            }\n\n            .console-logger-toggle {\n                width: 40px;\n                height: 30px;\n                background: #2c3e50;\n                border-radius: 120px 10px 0 0;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                cursor: pointer;\n                box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);\n                transition: all 0.3s ease;\n                color: white;\n                font-size: 16px;\n            }\n\n            .console-logger-toggle:hover {\n                background: #34495e;\n            }\n\n            .console-logger-toggle::after {\n                content: '▼';\n                transition: transform 0.3s ease;\n            }\n\n            .console-logger-toggle.collapsed::after {\n                content: '▲';\n            }\n\n            .console-logger-window {\n                width: 400px;\n                height: 400px;\n                background: white;\n                border-radius: 10px 0 10px 10px;\n                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);\n                display: flex;\n                flex-direction: column;\n                overflow: hidden;\n                transform: translateY(0);\n                opacity: 1;\n                /* 简化过渡属性 */\n                transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease;\n            }\n\n            .console-logger-window.maximized {\n                width: 600px !important;\n                height: 85vh !important;\n                border-radius: 10px 0 0 10px; /* 调整圆角以匹配右下角 */\n            }\n\n            .console-logger-window.collapsed {\n                height: 0 !important;\n                min-height: 0 !important; \n                opacity: 0;\n            }\n\n            .console-logger-header {\n                background: #2c3e50;\n                color: white;\n                padding: 12px 15px;\n                display: flex;\n                justify-content: space-between;\n                align-items: center;\n                flex-shrink: 0;\n            }\n\n            .console-logger-title {\n                font-weight: 600;\n                font-size: 16px;\n            }\n\n            .console-logger-controls {\n                display: flex;\n                gap: 10px;\n            }\n\n            .console-logger-controls button {\n                background: transparent;\n                border: 1px solid rgba(255, 255, 255, 0.3);\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n            }\n\n            .console-logger-controls button:hover {\n                background: rgba(255, 255, 255, 0.1);\n            }\n\n            /* 新增的按钮样式 */\n            .console-logger-maximize-toggle {\n                line-height: 1;\n                font-size: 14px !important; /* 使箭头看起来更大 */\n                padding: 5px 8px !important;\n            }\n            .console-logger-maximize-toggle::before {\n                content: '⇱'; /* Unicode symbol for maximized */\n            }\n            .console-logger-maximize-toggle.active::before {\n                content: '⇲'; /* Unicode symbol for minimized */\n            }\n\n\n            .console-logger-filters {\n                display: flex;\n                align-items: center;\n                gap: 5px;\n                padding: 10px;\n                background: #f8f9fa;\n                border-bottom: 1px solid #e9ecef;\n                flex-shrink: 0;\n                overflow-x: hidden; \n            }\n\n            /* 新增: 过滤器按钮组的容器，负责滚动 */\n            .console-logger-filter-group {\n                display: flex;\n                gap: 5px;\n                overflow-x: auto; /* 允许过滤器按钮滚动 */\n                flex-grow: 1; /* 占据剩余空间 */\n                padding-right: 10px; /* 避免滚动条影响按钮 */\n            }\n\n            .console-logger-filter {\n                padding: 5px 10px;\n                font-size: 12px;\n                border-radius: 15px;\n                background: #ecf0f1;\n                color: #7f8c8d;\n                border: 1px solid #ddd;\n                cursor: pointer;\n                transition: all 0.3s;\n                white-space: nowrap;\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-filter.active {\n                background: #3498db;\n                color: white;\n                border-color: #3498db;\n            }\n\n            /* 新增: 滚动到底部按钮的样式 (位于 filtersContainer 内部右侧) */\n            .console-logger-scroll-to-bottom {\n                background: #3498db;\n                border: none;\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n                line-height: 1;\n                height: fit-content;\n                white-space: nowrap;\n                margin-left: auto; /* 将按钮推到最右侧 */\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-scroll-to-bottom:hover {\n                background: #2980b9;\n            }\n\n\n            .console-logger-content {\n                flex: 1;\n                overflow-y: auto;\n                padding: 10px;\n                background: #ffffff;\n                word-wrap: break-word;\n                text-align: left;\n            }\n\n            .console-logger-entry {\n                padding: 8px 10px;\n                margin-bottom: 3px;\n                border-radius: 4px;\n                font-size: 12px;\n                line-height: 1.4;\n                /*animation: consoleFadeIn 0.3s ease;*/\n                border-left: 3px solid transparent;\n            }\n\n            @keyframes consoleFadeIn {\n                from { opacity: 0; transform: translateY(5px); }\n                to { opacity: 1; transform: translateY(0); }\n            }\n\n            .console-logger-timestamp {\n                color: #7f8c8d;\n                font-size: 11px;\n                margin-right: 2px;\n            }\n\n            @media (max-width: 768px) {\n                .console-logger-container {\n                    right: 10px;\n                    bottom: 10px;\n                }\n\n                .console-logger-window {\n                    width: calc(100vw - 20px);\n                    height: 300px;\n                }\n            }\n            \n            .console-logger-message[data-type=\"json\"] {\n                white-space: pre-wrap; \n            }\n        </style>\n    ",
    );
    try {
        if (
            unsafeWindow.parent.clog &&
            typeof unsafeWindow.parent.clog.log == "function"
        ) {
            window.clog = unsafeWindow.clog = unsafeWindow.parent.clog;
        } else {
            window.clog = unsafeWindow.clog = new Logger();
        }
    } catch (r) {
        console.error("创建日志控制台出现异常", r);
        window.clog = unsafeWindow.clog = new Logger();
    }
    (function () {
        const e = window.clog || console;
        window.addEventListener("error", function (t) {
            const n = t.filename;
            const a = t.message;
            if (!n.includes("javdb") && !n.includes("javbus")) {
                e.error(`[全局 Error 异常捕获] ${a} 来源: ${n}`);
            }
        });
        window.addEventListener("unhandledrejection", function (t) {
            const n = t.reason;
            const a = (n == null ? undefined : n.message) ?? "";
            if (a.includes("play()")) {
                return;
            }
            if (a.includes("The element has no supported sources")) {
                show.error("播放失败, 请检查是否已对节点分流?");
                e.error("播放失败, 请检查是否已对节点分流?");
                return;
            }
            if (a.includes("<span>1005</span>") && a.includes("fc2ppvdb")) {
                return;
            }
            const i = `[全局 Promise 异常捕获] ${n.message || n}`;
            e.error(i, n);
            t.preventDefault();
        });
    })();
    document.addEventListener("mousedown", (e) => {
        const t = window.clog;
        if (!t.isInitialized || !t.container) {
            return;
        }
        const n = e.target;
        const a = [
            ".console-logger-container",
            ".layui-layer-shade",
            ".loading-container",
        ].join(",");
        if (n.closest(a)) {
            t.highZIndex();
        } else {
            t.lowZIndex();
        }
    });
})();
(function () {
    function e(e, t, n) {
        const a = (function (e) {
            const t = document.createElement("div");
            t.classList.add("js-tooltip");
            const n = document.createElement("div");
            n.innerHTML = e;
            t.appendChild(n);
            document.body.appendChild(t);
            return t;
        })(t);
        a.style.display = "block";
        const i = e.getBoundingClientRect();
        const s = a.getBoundingClientRect();
        a.style.display = "none";
        const o = window.innerWidth;
        const r = window.innerHeight;
        let l;
        let c;
        let d = n;
        const h = (e) => e >= 8 && e + s.height <= r - 8;
        const g = (e) => e >= 8 && e + s.width <= o - 8;
        const p = i.left + i.width / 2 - s.width / 2;
        const m = i.top + i.height / 2 - s.height / 2;
        switch (n) {
            case "top":
                c = i.top - s.height - 0;
                if (c < 8 && h(i.bottom + 0)) {
                    c = i.bottom + 0;
                    d = "bottom";
                }
                break;
            case "bottom":
                c = i.bottom + 0;
                if (c + s.height > r - 8 && h(i.top - s.height - 0)) {
                    c = i.top - s.height - 0;
                    d = "top";
                }
                break;
            case "left":
                l = i.left - s.width - 0;
                if (l < 8 && g(i.right + 0)) {
                    l = i.right + 0;
                    d = "right";
                }
                break;
            case "right":
                l = i.right + 0;
                if (l + s.width > o - 8 && g(i.left - s.width - 0)) {
                    l = i.left - s.width - 0;
                    d = "left";
                }
        }
        const u = d === "left" || d === "right";
        if (d === "top" || d === "bottom") {
            l = p;
            if (l < 8) {
                l = 8;
            } else if (l + s.width > o - 8) {
                l = o - s.width - 8;
            }
        } else if (u) {
            c = m;
            if (c < 8) {
                c = 8;
            } else if (c + s.height > r - 8) {
                c = r - s.height - 8;
            }
        }
        a.style.left = `${l}px`;
        a.style.top = `${c}px`;
        a.classList.add("is-active");
        e.tooltipElement = a;
    }
    document.head.insertAdjacentHTML(
        "beforeend",
        "\n        <style>\n            .js-tooltip {\n                /* 通用样式 */\n                position: fixed;\n                padding: 8px 12px; \n                border-radius: 6px; \n                white-space: normal;\n                max-width: 600px; \n                \n                pointer-events: none;\n                font-size: 14px;\n                line-height: 1.5;\n                z-index: 9999999999;\n                \n                background: #F0FDF4; \n                color: #166534;      \n                border: none; \n                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3); \n                \n                display: none; \n            }\n            .js-tooltip.is-active {\n                display: block !important;\n            }\n\n        </style>\n    ",
    );
    const t =
        "[data-tip-top], [data-tip-bottom], [data-tip-left], [data-tip-right], [data-tip]";
    document.addEventListener("mouseover", (n) => {
        const a = n.target.closest(t);
        if (a && !a.tooltipElement) {
            let t;
            let n = "top";
            if (a.hasAttribute("data-tip-bottom")) {
                t = a.getAttribute("data-tip-bottom");
                n = "bottom";
            } else if (a.hasAttribute("data-tip-left")) {
                t = a.getAttribute("data-tip-left");
                n = "left";
            } else if (a.hasAttribute("data-tip-right")) {
                t = a.getAttribute("data-tip-right");
                n = "right";
            } else if (a.hasAttribute("data-tip-top")) {
                t = a.getAttribute("data-tip-top");
                n = "top";
            } else if (a.hasAttribute("data-tip")) {
                t = a.getAttribute("data-tip");
                n = "top";
            }
            if (!t) {
                return;
            }
            a.hoverTimeout = setTimeout(() => {
                if (a.matches(":hover") && !a.tooltipElement) {
                    e(a, t, n);
                }
            }, 50);
        }
    });
    document.addEventListener("mouseout", (e) => {
        const n = e.target.closest(t);
        var a;
        if (n) {
            if (n.hoverTimeout) {
                clearTimeout(n.hoverTimeout);
                n.hoverTimeout = null;
            }
            if (!n.contains(e.relatedTarget)) {
                if (n.tooltipElement) {
                    if ((a = n.tooltipElement) && a.parentNode) {
                        a.remove();
                    }
                    n.tooltipElement = null;
                }
            }
        }
    });
})();
let se = ie;
document.addEventListener("keydown", (e) => {
    se.handleKeydown(e);
});
document.addEventListener("keyup", (e) => {
    se.handleKeyup(e);
});

const me = "jhs_appAuthorization";
class ve {
    constructor() {
        this.queue = Promise.resolve();
    }
    addTask(e) {
        this.queue = this.queue
            .then(() => e())
            .catch((e) => {
                clog.error("执行异步队列任务失败:", e);
            });
    }
    async waitAllFinished() {
        return this.queue;
    }
}
const Le = "x7k9p3";
function Me(e) {
    return (Le + e + Le)
        .split("")
        .map((e) => {
            const t = e.codePointAt(0);
            return String.fromCodePoint(t + 5);
        })
        .join("");
}
function Ne(e) {
    return e
        .split("")
        .map((e) => {
            const t = e.codePointAt(0);
            return String.fromCodePoint(t - 5);
        })
        .join("")
        .slice(Le.length, -Le.length);
}
const ut = layer.close;
layer.close = function (e) {
    const t = ut.call(this, e);
    (function (e = 10) {
        setTimeout(() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }, e);
    })();
    return t;
};
const ft = layer.open;
layer.open = function (e) {
    const t = (e = e || {}).success;
    e.success = function (e, n) {
        if (typeof t == "function") {
            t.call(this, e, n);
        }
        utils.setupEscClose(n);
    };
    return ft.call(this, e);
};
utils.importResource(
    "https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css",
);
utils.importResource(
    "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css",
);
utils.importResource(
    "https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css",
);
utils.importResource(
    "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css",
);
const vt = (function () {
    const e = new PluginManager();
    unsafeWindow.pluginManager = e;
    if (r) {
        e.register(ListPagePlugin);
        e.register(AutoPagePlugin);
        e.register(FoldCategoryPlugin);
        e.register(ListPageButtonPlugin);
        e.register(HistoryPlugin);
        e.register(SettingPlugin);
        e.register(NavBarPlugin);
        e.register(HitShowPlugin);
        e.register(Top250Plugin);
        e.register(DetailPagePlugin);
        e.register(ReviewPlugin);
        e.register(DetailPageButtonPlugin);
        e.register(HighlightMagnetPlugin);
        e.register(PreviewVideoPlugin);
        e.register(FilterTitleKeywordPlugin);
        e.register(ActressInfoPlugin);
        e.register(OtherSitePlugin);
        e.register(WantAndWatchedVideosPlugin);
        e.register(BlacklistPlugin);
        e.register(FavoriteActressesPlugin);
        e.register(NewVideoPlugin);
    }
    return e;
})();
vt.processCss().then();
(async function () {
    window.isDetailPage = (function () {
        let e = window.location.href;
        if (r) {
            return e.split("?")[0].includes("/v/");
        } else {
            return !!l && $("#magnet-table").length > 0;
        }
    })();
    window.isListPage = (function () {
        let e = window.location.href;
        if (r) {
            return $(".movie-list").length > 0 || e.includes("advanced_search");
        } else {
            return !!l && $(".masonry > div .item").length > 0;
        }
    })();
    window.isFc2Page = (function () {
        let e = window.location.href;
        return (
            e.includes("advanced_search?type=3") ||
            e.includes("advanced_search?type=100")
        );
    })();
    await storageManager.merge_table_name();
    await storageManager.clean_no_url_blacklist();
    await storageManager.async_merge_other();
    await storageManager.merge_blacklist();
    await storageManager.merge_favoriteActress();
    await storageManager.merge_tow_car_list_table();
    if (r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie)) {
        show.error("请切换到中文语言下才可正常使用本脚本", {
            duration: -1,
        });
    }
    vt.processPlugins().then();
})();
