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
    GFRIENDS_SOURCES as tt,
    GFRIENDS_CDN_INDEX_KEY as nt,
    FILETREE_STORE as ot,
    FILETREE_DATA_KEY as rt,
} from "../resources/gfriends";
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
const selectAvailableVideoQuality = (e, t) => {
    if (!e || e.length === 0) {
        return null;
    }
    const n = new Set(e);
    if (n.has(t)) {
        return t;
    }
    const a = L.map((e) => e.quality).reverse();
    for (const i of a) {
        if (n.has(i)) {
            return i;
        }
    }
    return e[0];
};
const DMM_VIDEO_CACHE_KEY = "jhs_dmm_video";
class DmmPreviewVideoResolver {
    constructor(e, t = true) {
        this.carNum = e;
        this.showErrorMessages = t;
    }
    _checkCache() {
        const e = localStorage.getItem(DMM_VIDEO_CACHE_KEY)
            ? JSON.parse(localStorage.getItem(DMM_VIDEO_CACHE_KEY))
            : {};
        if (e[this.carNum]) {
            clog.debug("缓存中存在预览视频信息", e[this.carNum]);
            return e[this.carNum];
        } else {
            return null;
        }
    }
    _updateCache(e) {
        const t = localStorage.getItem(DMM_VIDEO_CACHE_KEY)
            ? JSON.parse(localStorage.getItem(DMM_VIDEO_CACHE_KEY))
            : {};
        t[this.carNum] = e;
        clog.debug("成功解析出预览视频并已缓存:", e);
        localStorage.setItem(DMM_VIDEO_CACHE_KEY, JSON.stringify(t));
    }
    async _searchContentIds() {
        const e = this.carNum;
        const t = e.replace(/-/g, "");
        const n = [
            {
                keyword: e.replace("-", "00"),
                name: "00-替换关键词",
            },
            {
                keyword: e,
                name: "原始番号关键词",
            },
            {
                keyword: t,
                name: "无连字符关键词",
            },
        ];
        const a = e.toLowerCase();
        for (const o of n) {
            const { keyword: e, name: n } = o;
            const i = e.toLowerCase();
            clog.debug(`--- 尝试使用 ${n} (${e}) 进行 API 搜索 ---`);
            const r = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams(
                {
                    api_id: "UrwskPfkqQ0DuVry2gYL",
                    affiliate_id: "10278-996",
                    output: "json",
                    site: "FANZA",
                    sort: "match",
                    keyword: e,
                },
            ).toString()}`;
            let l;
            try {
                l = await gmHttp.get(r);
            } catch (s) {
                clog.error(`API 请求失败，跳过 ${n}:`, s);
                continue;
            }
            if (!l || !l.result || !l.result.result_count) {
                clog.debug("API 返回无结果，尝试下一个关键词。");
                continue;
            }
            const c = [];
            for (const s of l.result.items) {
                if (c.length >= 2) {
                    break;
                }
                const e = s.content_id || "";
                const o = s.maker_product || "";
                if (
                    e.includes(i.replace("-", "")) ||
                    a === o.toLowerCase() ||
                    e.includes(t.toLowerCase())
                ) {
                    c.push({
                        serviceCode: s.service_code,
                        floorCode: s.floor_code,
                        contentId: e,
                        pageUrl: s.URL,
                    });
                    clog.debug(`[${n}] cid|makerProduct 匹配成功:`, e, o);
                }
            }
            if (c.length > 0) {
                clog.debug(`--- 成功通过 ${n} 找到 Content IDs ---`);
                const t = $("#fanzaBtn");
                let a = `https://www.dmm.co.jp/search/=/searchstr=${e}`;
                let i = "single";
                if (c.length > 1) {
                    t.attr("href", a);
                    t.append(
                        '<span class="site-tag" style="top:-15px">多结果</span>',
                    );
                    t.css("backgroundColor", "#7bc73b");
                    i = "multiple";
                } else {
                    a = c[0].pageUrl;
                    t.attr("href", a);
                    t.css("backgroundColor", "#7bc73b");
                }
                const s = "jhs_other_site_dmm";
                const o = localStorage.getItem(s)
                    ? JSON.parse(localStorage.getItem(s))
                    : {};
                o[this.carNum] = {
                    type: i,
                    url: a,
                };
                localStorage.setItem(s, JSON.stringify(o));
                return c;
            }
            clog.debug(
                `[${n}] API 返回结果数 ${l.result.result_count}，但无精确匹配的 Content ID。`,
            );
        }
        clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
        const i = $("#fanzaBtn");
        i.attr(
            "href",
            `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`,
        );
        i.attr("title", "未查询到, 点击前往搜索页");
        i.css("backgroundColor", "#de3333");
        return null;
    }
    async _extractTrailerLinks({ contentId: e, serviceCode: t, floorCode: n }) {
        const a = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${e}/mtype=AhRVShI_/service=${t}/floor=${n}/mode=/`;
        const i = await gmHttp.get(a, null, {
            "accept-language": "ja-JP,ja;q=0.9",
            Cookie: "age_check_done=1",
        });
        if (typeof i != "string") {
            clog.error(i);
            throw new Error("解析播放页内容失败, 非文本内容");
        }
        if (i.includes("このサービスはお住まいの地域からは")) {
            throw new Error("节点不可用，请将DMM域名分流到日本ip");
        }
        const s = i.match(/const\s+args\s+=\s+(.*);/);
        if (!s) {
            throw new Error("未在脚本中找到 const args = ... 变量");
        }
        let o;
        try {
            ({ bitrates: o } = JSON.parse(s[1]));
        } catch (d) {
            throw new Error(`解析播放器脚本 JSON 失败: ${d.message}`);
        }
        const r = {};
        const l = L.map((e) => e.quality).join("|");
        const c = new RegExp(`(${l})\\.mp4$`);
        if (!Array.isArray(o)) {
            clog.error("解析画质链接失败: bitrates 字段不是一个数组或不存在");
            throw new Error(
                "解析画质链接失败: bitrates 字段不是一个数组或不存在",
            );
        }
        clog.debug("原始数据返回:", o);
        for (const h of o) {
            const e = h == null ? undefined : h.src;
            if (!e || typeof e != "string" || !e.endsWith(".mp4")) {
                continue;
            }
            const t = e.match(c);
            let n = "";
            if (t && t[1]) {
                n = t[1];
            }
            if (n && !r[n]) {
                r[n] = e;
            }
        }
        if (Object.keys(r).length === 0) {
            throw new Error("未找到匹配要求的预览画质视频");
        }
        return r;
    }
    async fetchVideo() {
        const e = this._checkCache();
        if (e) {
            return e;
        }
        let t;
        try {
            const e = this.carNum.toLowerCase();
            if (
                e.startsWith("heyzo") ||
                /^(n\d+|\d+(-\d+)*)$/.test(e) ||
                /^n\d+$/.test(e)
            ) {
                throw new Error("无码番号类型, 取消dmm解析");
            }
            if (this.carNum.includes("VR-")) {
                throw new Error("VR类型, 取消dmm解析");
            }
            t = await this._searchContentIds();
        } catch (n) {
            clog.error("DMM API 搜索失败:", n);
            const e = $("#fanzaBtn");
            e.attr(
                "href",
                `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`,
            );
            e.attr("title", "未查询到, 点击前往搜索页");
            e.css("backgroundColor", "#de3333");
            return null;
        }
        if (!t || t.length === 0) {
            return null;
        }
        try {
            const e = await Promise.any(
                t.map((e) => this._extractTrailerLinks(e)),
            );
            this._updateCache(e);
            return e;
        } catch (a) {
            const e = a.errors || [a];
            if (e.some((e) => e.message.includes("节点不可用"))) {
                if (this.showErrorMessages) {
                    show.error("节点不可用，请将DMM域名分流到日本ip");
                }
            } else {
                const t = e[0].message || e[0];
                clog.error(`解析失败: ${t}`, e);
                if (this.showErrorMessages) {
                    show.error(`解析失败: ${t}`);
                }
            }
            const t = $("#fanzaBtn");
            t.attr(
                "href",
                `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`,
            );
            t.attr("title", "未查询到, 点击前往搜索页");
            t.css("backgroundColor", "#de3333");
            return null;
        }
    }
}
const fetchDmmPreviewVideo = async (e, t = true) =>
    new DmmPreviewVideoResolver(e, t).fetchVideo();
class PreviewVideoPlugin extends BasePlugin {
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return "\n            .video-control-btn {\n                min-width:120px;\n                padding: 7px 12px;\n                font-size: 12px;\n                background: rgba(0,0,0,0.7);\n                color: white;\n                border: none;\n                border-radius: 4px;\n                cursor: pointer;\n            }\n            .video-control-btn.active {\n                background-color: #1890ff;\n                color: white;\n                font-weight: bold;\n                border: 2px solid #096dd9;\n            }\n        ";
    }
    async handle() {
        if (!isDetailPage) {
            return;
        }
        let e = await storageManager.getSetting();
        this.filterHotKey = e.filterHotKey;
        this.favoriteHotKey = e.favoriteHotKey;
        this.speedVideoHotKey = e.speedVideoHotKey;
        let t = $(".preview-video-container");
        t.on("click", (e) => {
            utils.loopDetector(
                () => $(".fancybox-content #preview-video").length > 0,
                () => {
                    this.handleVideo().then();
                },
            );
        });
        if (
            (await storageManager.getSetting("enableLoadPreviewVideo", _)) ===
                _ &&
            !o.includes("autoPlay=1")
        ) {
            this.initDmm().then();
        }
        let n = window.location.href;
        if (n.includes("gallery-1") || n.includes("gallery-2")) {
            utils.loopDetector(
                () => $(".fancybox-content #preview-video").length > 0,
                () => {
                    if ($(".fancybox-content #preview-video").length > 0) {
                        this.handleVideo().then();
                    }
                },
            );
        }
        if (n.includes("autoPlay=1") && t.length > 0) {
            t[0].click();
        }
    }
    async initDmm() {
        try {
            const e = await fetchDmmPreviewVideo(
                this.getPageInfo().carNum,
                false,
            );
            if (!e) {
                return;
            }
            let t = await storageManager.getSetting("videoQuality");
            clog.debug("解析其它画质预览视频", "设置-期望画质", t);
            const n = e[selectAvailableVideoQuality(Object.keys(e), t)];
            clog.log("切换其它画质预览视频: ", n);
            const a = $("#preview-video");
            const i = a.length ? a[0] : null;
            const s = !i || utils.isHidden(a);
            if (a.length) {
                if (i) {
                    const e = i.currentTime;
                    a.attr("src", n);
                    if (!s) {
                        clog.debug("播放器已手动打开, 变更进度条");
                        i.currentTime = e;
                        i.play();
                    }
                }
            } else {
                clog.debug("JavDB没有视频播放元素, 开始创建...");
                const e = $(".column-video-cover img").attr("src");
                $(".preview-images").prepend(
                    `\n                    <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                        <span>預告片</span>\n                        <img src="${e}" class="video-cover" style="width: 150px; height: auto;" alt="">\n                    </a>\n                `,
                );
                $(".preview-video-container").on("click", (e) => {
                    utils.loopDetector(
                        () => $(".fancybox-content #preview-video").length > 0,
                        async () => {
                            await this.handleVideo();
                        },
                    );
                });
            }
        } catch (e) {
            clog.error("预加载dmm失败:", e);
        }
    }
    async handleVideo() {
        if (
            (await storageManager.getSetting("enableLoadPreviewVideo", _)) === C
        ) {
            return;
        }
        const e = $("#preview-video");
        if (!e.length) {
            return;
        }
        const t = e.parent();
        t.css("position", "relative");
        const n = e[0];
        const a = localStorage.getItem("jhs_videoMuted");
        if (a) {
            n.muted = a === "yes";
        }
        n.addEventListener("volumechange", function () {
            localStorage.setItem("jhs_videoMuted", n.muted ? "yes" : "no");
        });
        n.play();
        let i = this.getPageInfo().carNum;
        const s = await fetchDmmPreviewVideo(i);
        let o = $("<div></div>").attr("id", "video-bottom-toolbar").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "flex-wrap": "wrap",
        });
        let r = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
        });
        let l = null;
        if (s) {
            let t = await storageManager.getSetting("videoQuality");
            l = selectAvailableVideoQuality(Object.keys(s), t);
            let a = s[l];
            if (e.attr("src") !== a) {
                e.attr("src", a);
                n.load();
                n.play();
            }
            L.forEach((e) => {
                let t = s[e.quality];
                if (t) {
                    const n = l === e.quality;
                    let a = $(
                        `\n                    <button class="video-control-btn${n ? " active" : ""}" \n                            id="${e.id}" \n                            data-quality="${e.quality}"\n                            data-video-src="${t}"\n                            style="min-width: 40px; border: 1px solid #ccc; background-color: ${n ? "#007bff" : "#fff"}; color: ${n ? "white" : "black"};">\n                        ${e.text}\n                    </button>\n                `,
                    );
                    r.append(a);
                }
            });
        }
        o.append(r);
        let c = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "margin-left": "auto",
        });
        let d = $(
            `<button class="menu-btn" id="video-filterBtn" style="min-width: 120px; background-color:#de3333;">屏蔽 ${this.filterHotKey ? "(" + this.filterHotKey + ")" : ""}</button>`,
        );
        c.append(d);
        let h = $(
            `<button class="menu-btn" id="video-favoriteBtn" style="min-width: 120px; background-color:#25b1dc;">收藏 ${this.favoriteHotKey ? "(" + this.favoriteHotKey + ")" : ""}</button>`,
        );
        c.append(h);
        let g = $(
            `<button class="menu-btn" id="speed-btn" style="min-width: 120px; background-color:#76b45d;">快进 ${this.speedVideoHotKey ? "(" + this.speedVideoHotKey + ")" : ""}</button>`,
        );
        c.append(g);
        o.append(c);
        t.append(o);
        o.on("click", ".video-control-btn", async (t) => {
            const a = $(t.currentTarget);
            const i = a.data("video-src");
            if (!a.hasClass("active")) {
                try {
                    const t = n.currentTime;
                    e.attr("src", i);
                    n.load();
                    n.currentTime = t;
                    await n.play();
                    o.find(".video-control-btn").removeClass("active").css({
                        "background-color": "#fff",
                        color: "black",
                    });
                    a.addClass("active").css({
                        "background-color": "#007bff",
                        color: "white",
                    });
                } catch (s) {
                    console.error("切换画质失败:", s);
                }
            }
        });
        $("#speed-btn").on("click", () => {
            this.getBean("DetailPageButtonPlugin").speedVideo();
        });
        utils.rightClick(document.body, "#speed-btn", (e) => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        });
        $("#video-filterBtn").on("click", (e) => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        });
        $("#video-favoriteBtn").on("click", (e) => {
            this.getBean("DetailPageButtonPlugin").favoriteOne(e);
        });
    }
}
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
class ListPagePlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "currentPageFilterCount", 0);
        i(this, "currentPageFavoriteCount", 0);
        i(this, "currentPageHasWatchCount", 0);
        i(this, "currentPageKeywordFilterCount", 0);
        i(this, "currentPageActorFilterCount", 0);
        i(this, "currentPageWaitCheckCount", 0);
        i(this, "currentPageTotalCount", 0);
        i(
            this,
            "cache",
            localStorage.getItem("jhs_translate")
                ? JSON.parse(localStorage.getItem("jhs_translate"))
                : {},
        );
        i(this, "writeQueue", Promise.resolve());
    }
    getName() {
        return "ListPagePlugin";
    }
    async handle() {
        new BroadcastChannel("channel-refresh").addEventListener(
            "message",
            async (e) => {
                let t = e.data.type;
                if (t === "refresh") {
                    await this.doFilter();
                    const e = this.getBean("HistoryPlugin");
                    if (e.tableObj) {
                        e.tableObj.setData();
                    }
                    const t = this.getBean("NewVideoPlugin");
                    if (t) {
                        t.showNewVideoCount().then();
                        t.loadData();
                    }
                } else if (t === "cleanCache_filter_actor_actress_car_list") {
                    storageManager.cache_filter_actor_actress_car_list &&= null;
                } else if (
                    t === "clean_cacheSettingObj" &&
                    storageManager.cacheSettingObj
                ) {
                    storageManager.cacheSettingObj = null;
                }
            },
        );
        this.cleanRepeatId();
        this.replaceHdImg();
        this.addJumpPageControl();
        this.fixBusTitleBox();
        await this.doFilter();
        this.bindClick().then();
        this.bindListPageHotKey().then();
        this.rememberTagExpand();
        $(this.getSelector().itemSelector + " a").attr("target", "_blank");
        this.checkDom();
        // 列表页挂载"想看/观看"同步监听器，刷新本页 .item 卡片 status-tag
        this.getBean("DetailPageButtonPlugin").setupWantWatchedSyncListener();
    }
    rememberTagExpand() {
        if (!window.location.href.includes("actors")) {
            return;
        }
        const e = $(".tag-expand");
        if (e.length === 0) {
            return;
        }
        const t = "jhs_tag_expand";
        const n = localStorage.getItem(t) === "true";
        const a = $(".actor-tags .content");
        if (n && a.hasClass("collapse")) {
            e[0].click();
        }
        e.on("click", function () {
            const e = !a.hasClass("collapse");
            console.log("触发");
            localStorage.setItem(t, e.toString());
        });
    }
    checkDom() {
        if (!window.isListPage) {
            return;
        }
        const e = this.getSelector();
        const t = document.querySelector(e.boxSelector);
        if (!t) {
            console.error("没有找到容器节点!");
            return;
        }
        const n = new MutationObserver(async (e) => {
            n.disconnect();
            try {
                this.replaceHdImg();
                this.addJumpPageControl();
                this.fixBusTitleBox();
                await this.doFilter();
                await this.getBean("ListPageButtonPlugin").sortItems();
                $(this.getSelector().itemSelector + " a").attr(
                    "target",
                    "_blank",
                );
                this.getBean("AutoPagePlugin").checkLoad();
            } finally {
                n.observe(t, a);
            }
        });
        const a = {
            childList: true,
            subtree: false,
        };
        n.observe(t, a);
    }
    fixBusTitleBox() {
        if (!l) {
            return;
        }
        $(this.getSelector().itemSelector)
            .toArray()
            .forEach((e) => {
                var t;
                let n = $(e);
                if (n.find(".avatar-box").length > 0) {
                    return;
                }
                const a =
                    ((t = n.find("img").attr("title")) == null
                        ? undefined
                        : t.trim()) || "";
                n.find(".photo-info span:first")
                    .contents()
                    .first()
                    .wrap(`<span class="video-title" title="${a}">${a}</span>`);
                n.find("br").remove();
            });
    }
    cleanRepeatId() {
        if (!l) {
            return;
        }
        $("#waterfall_h").removeAttr("id").attr("id", "no-page");
        const e = $('[id="waterfall"]');
        if (e.length !== 0) {
            e.each(function () {
                const e = $(this);
                if (!e.hasClass("masonry")) {
                    e.children().insertAfter(e);
                    e.remove();
                }
            });
        }
    }
    async doFilter() {
        if (!window.isListPage) {
            return;
        }
        let e = $(this.getSelector().itemSelector).toArray();
        if (e.length) {
            await this.filterMovieList(e);
        }
    }

    /**
     * 增量刷新某个视频卡片的 JHS status-tag。
     * 用于跨 iframe / 跨标签页“想看 / 观看”同步后立刻反映到 series 列表上。
     * 走与 filterMovieList 同源数据（IndexedDB），保证状态真实。
     * @param {Element} item jQuery 化的 .item 元素
     * @param {string} carNum 番号
     */
    async renderItemStatusTag(item, carNum) {
        try {
            const t = $(item);
            const n = await storageManager.getCar(carNum);
            const a = n ? n.status : "";
            // 移除旧 status-tag
            t.find(".status-tag").remove();
            // 根据 JHS 状态决定新 tag
            let N = null;
            if (a === h) N = Te.IS_FAVORITE;
            else if (a === p) N = Te.IS_HAS_WATCH;
            else if (a === d) N = Te.IS_FILTERED;
            if (!N || !N.text) return;
            // 与 filterMovieList 中保持一致的注入逻辑
            const s =
                (await storageManager.getSetting()).tagPosition || "rightTop";
            const E =
                s === "rightTop" ? "right: 0; top:5px;" : "left: 0; top:5px;";
            const e = `<span class="tag is-success status-tag" data-tip="${N.reasonType}" title="" style="margin-right: 5px; border-radius:10px; position:absolute;\n                        z-index:10; background-color: ${N.color} !important; ${E}">\n                        ${N.text}\n                    </span>`;
            const r = t.find(".tags");
            if (r.length) {
                r.append(e);
                return;
            }
            const i = t.find(".item-tag");
            if (i.length) {
                i.append(e);
                return;
            }
            t.find(".photo-info > span > div").append(e);
        } catch (e) {
            console.error("[JHS-想看/观看] renderItemStatusTag 失败", e);
        }
    }

    async filterMovieList(e) {
        utils.time("累计耗费时间");
        utils.time("读取数据耗时");
        const [t, n, a, i, s] = await Promise.all([
            storageManager.getCarList(),
            storageManager.getTitleFilterKeyword(),
            storageManager.getBlacklist(),
            storageManager.getBlacklistCarList(),
            storageManager.getSetting(),
        ]);
        const o = utils.time("读取数据耗时");
        const m = t.reduce(
            (e, t) => {
                const n = t.status;
                if (e.hasOwnProperty(n)) {
                    e[n].add(t.carNum);
                }
                return e;
            },
            {
                [d]: new Set(),
                [h]: new Set(),
                [g]: new Set(),
                [p]: new Set(),
            },
        );
        utils.time("组装数据耗时");
        const u = new Map(a.map((e) => [e.starId, e.role]));
        const { actorCarNumToNameMap: f, actressCarNumToNameMap: v } = i.reduce(
            (e, t) => {
                const n = u.get(t.starId);
                if (!n) {
                    clog.error("黑名单数据源丢失演员信息", t);
                    return e;
                }
                const a =
                    n === B ? e.actorCarNumToNameMap : e.actressCarNumToNameMap;
                if (!a.has(t.carNum)) {
                    a.set(t.carNum, t.names);
                }
                return e;
            },
            {
                actorCarNumToNameMap: new Map(),
                actressCarNumToNameMap: new Map(),
            },
        );
        const b = utils.time("组装数据耗时");
        const w = (s == null ? undefined : s.showFilterItem) ?? C;
        const y = (s == null ? undefined : s.showFilterActorItem) ?? C;
        const x = (s == null ? undefined : s.showFilterKeywordItem) ?? C;
        const k = (s == null ? undefined : s.showFavoriteItem) ?? _;
        const T = (s == null ? undefined : s.showHasWatchItem) ?? _;
        const I = (s == null ? undefined : s.showAllItem) ?? C;
        const P = (s == null ? undefined : s.tagPosition) || "rightTop";
        this.currentPageFilterCount = 0;
        this.currentPageFavoriteCount = 0;
        this.currentPageHasWatchCount = 0;
        this.currentPageKeywordFilterCount = 0;
        this.currentPageActorFilterCount = 0;
        this.currentPageWaitCheckCount = 0;
        this.currentPageTotalCount = 0;
        utils.time("处理页面耗时");
        await Promise.all(
            e.map(async (e) => {
                let t = $(e);
                if (l && t.find(".avatar-box").length > 0) {
                    return;
                }
                const { carNum: a, title: i } = this.findCarNumAndHref(t);
                const { filter: s, favorite: o, hasWatch: h } = m;
                const g = o.has(a);
                const u = h.has(a);
                const b = s.has(a);
                const B = f.has(a);
                const D = v.has(a);
                const A = B || D;
                const L = n.find((e) => i.includes(e) || a.startsWith(e));
                const M = !!L;
                if (!c) {
                    let e =
                        (k === C && g) ||
                        (T === C && u) ||
                        (w === C && b && !g && !u) ||
                        (y === C && A) ||
                        (x === C && M);
                    const n = t.attr("data-hide") === _;
                    if (I === _) {
                        e = false;
                    }
                    if (e && !n) {
                        t.hide().attr("data-hide", _);
                    } else if (!e && n) {
                        t.show().removeAttr("data-hide");
                    }
                }
                let N = Te.IS_WAIT_CHECK;
                let j = null;
                if (b) {
                    N = Te.IS_FILTERED;
                } else if (g) {
                    N = Te.IS_FAVORITE;
                } else if (u) {
                    N = Te.IS_HAS_WATCH;
                } else if (M) {
                    N = Te.IS_KEYWORD_FILTER;
                    j = L || "未知";
                } else if (B) {
                    N = Te.IS_ACTOR_FILTER;
                    j = f.get(a) || "";
                } else if (D) {
                    N = Te.IS_ACTRESS_FILTER;
                    j = v.get(a) || "";
                }
                j ||= N.reasonType;
                if (N.isCounted) {
                    this[N.countKey]++;
                }
                this.currentPageTotalCount++;
                t.find(".status-tag").remove();
                const E =
                    P === "rightTop"
                        ? "right: 0; top:5px;"
                        : "left: 0; top:5px;";
                if (N.text) {
                    const e = r
                        ? `<span class="tag is-success status-tag" data-tip="${j}" title=""\n                        style="margin-right: 5px; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${N.color} !important; ${E}">\n                        ${N.text}\n                    </span>`
                        : `<a class="a-primary status-tag" data-tip="${j}"  title=""\n                        style="margin-right: 5px; padding: 0 5px; color: #fff !important; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${N.color} !important; ${E}">\n                        <span class="tag" style="color:#fff !important;">${N.text}</span>\n                    </a>`;
                    if (r) {
                        t.find(".tags").append(e);
                    }
                    if (l) {
                        const n = t.find(".item-tag");
                        if (n.length) {
                            n.append(e);
                        } else {
                            t.find(".photo-info > span > div").append(e);
                        }
                    }
                }
                await this.translate(t);
            }),
        );
        const D = utils.time("处理页面耗时");
        const A = utils.time("累计耗费时间");
        $("#waitDownBtn span").text(`打开已收藏 (${m.favorite.size})`);
        clog.log(
            `\n            <table class="countTable" style='border-collapse: collapse; width: 100%'>\n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${o}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${b}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${D}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${A}</td>\n                </tr>\n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽单番号</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageFilterCount}</strong></td>\n                     <td style='padding: 3px; border: 1px solid #ccc;'>收藏</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageFavoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽演员</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageActorFilterCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽关键词</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageKeywordFilterCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>已观看</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageHasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>待鉴定</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageWaitCheckCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                </tr>\n        \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>总数</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageTotalCount}</strong></td>\n                </tr>\n            </table>\n        `,
        );
    }
    async bindClick() {
        let e = this.getSelector();
        $(e.boxSelector).on("click", ".item img", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if ($(e.target).closest("div.meta-buttons").length) {
                return;
            }
            const t = $(e.target).closest(".item");
            const { carNum: n, aHref: a } = this.findCarNumAndHref(t);
            let i = await storageManager.getSetting("dialogOpenDetail", _);
            if (n.includes("FC2-")) {
                let e = this.parseMovieId(a);
                this.getBean("Fc2Plugin")?.openFc2Dialog(e, n, a);
            } else if (i === _) {
                utils.openPage(a, n, true, e);
                this.$currentImage = null;
            } else {
                window.open(a);
            }
        });
        $(e.boxSelector).on("click", ".item video", async (e) => {
            const t = e.currentTarget;
            if (t.paused) {
                t.play().catch((e) => console.error("播放失败:", e));
            } else {
                t.pause();
            }
            e.preventDefault();
            e.stopPropagation();
        });
        $(e.boxSelector).on("click", ".item .video-title", async (e) => {
            if ($(e.target).closest('[class^="jhs-match-"]').length) {
                return;
            }
            const t = $(e.currentTarget).closest(".item");
            const { carNum: n, aHref: a } = this.findCarNumAndHref(t);
            if (n.includes("FC2-")) {
                e.preventDefault();
                let t = this.parseMovieId(a);
                this.getBean("Fc2Plugin")?.openFc2Dialog(t, n, a);
            }
        });
        $(e.boxSelector).on(
            "contextmenu",
            ".item img, .item video",
            async (e) => {
                e.preventDefault();
                const t = $(e.target).closest(".item");
                const {
                    carNum: n,
                    url: a,
                    publishTime: i,
                } = this.findCarNumAndHref(t);
                let s = r
                    ? $(".actor-section-name")
                    : $(".avatar-box .photo-info .pb10");
                let o = "";
                if (s.length) {
                    o = s.text().trim().split(",")[0].replace("(無碼)", "");
                }
                utils.q(e, `是否屏蔽番号 ${n}?`, async () => {
                    setTimeout(async () => {
                        o ||= await this.parseActressName(a);
                        await storageManager.saveCar({
                            carNum: n,
                            url: a,
                            names: o,
                            actionType: d,
                            publishTime: i,
                        });
                        window.refresh();
                        show.ok("操作成功");
                    });
                });
            },
        );
    }
    async parseActressName(e) {
        let t = null;
        if (
            (await storageManager.getSetting("enableSaveActressCarInfo", C)) ===
            _
        ) {
            clog.debug("鉴定补录演员信息-已启用, 开始解析详情页");
            clog.debug("开始解析演员详情页", e);
            const n = await gmHttp.get(e);
            const a = utils.htmlTo$dom(n);
            if (r) {
                t = a
                    .find(".female")
                    .prev()
                    .map((e, t) => $(t).text())
                    .get()
                    .join(" ");
            } else if (l) {
                t = a
                    .find('span[onmouseover*="star_"] a')
                    .map((e, t) => $(t).text())
                    .get()
                    .join(" ");
            }
            clog.debug("解析到名称:", t);
        }
        return t;
    }
    async bindListPageHotKey() {
        this.$currentImage = null;
        $(document)
            .on("mouseenter", this.getSelector().coverImgSelector, (e) => {
                this.$currentImage = $(e.currentTarget);
            })
            .on("mouseleave", this.getSelector().coverImgSelector, () => {
                this.$currentImage = null;
            });
        let e = await storageManager.getSetting();
        this.filterHotKey = e.filterHotKey;
        this.favoriteHotKey = e.favoriteHotKey;
        this.hasWatchHotKey = e.hasWatchHotKey;
        this.enableImageHotKey = e.enableImageHotKey || C;
        this.clogHotKey = e.clogHotKey;
        this.foldCategoryHotKey = e.foldCategoryHotKey;
        if (this.enableImageHotKey === C) {
            return;
        }
        const t = async (e, t) => {
            setTimeout(async () => {
                let n = await this.parseActressName(e.url);
                await storageManager.saveCar({
                    carNum: e.carNum,
                    url: e.url,
                    names: n,
                    actionType: t,
                    publishTime: e.publishTime,
                });
                window.refresh();
                show.ok("操作成功");
            });
        };
        const n = {};
        if (this.filterHotKey) {
            n[this.filterHotKey] = (e) => {
                t(e, d);
            };
        }
        if (this.favoriteHotKey) {
            n[this.favoriteHotKey] = (e) => {
                t(e, h);
            };
        }
        if (this.hasWatchHotKey) {
            n[this.hasWatchHotKey] = (e) => {
                t(e, p);
            };
        }
        if (this.clogHotKey) {
            se.registerHotkey(this.clogHotKey, (e) => {
                clog.toggleExpandCollapsed();
            });
        }
        if (this.foldCategoryHotKey) {
            se.registerHotkey(this.foldCategoryHotKey, (e) => {
                const t = $("#foldCategoryBtn");
                if (t.length) {
                    t[0].click();
                }
            });
        }
        const a = (e, t) => {
            se.registerHotkey(e, (e) => {
                const n = document.activeElement;
                if (
                    n.tagName !== "INPUT" &&
                    n.tagName !== "TEXTAREA" &&
                    !n.isContentEditable &&
                    this.$currentImage
                ) {
                    const e = this.$currentImage.closest(".item");
                    const n = this.findCarNumAndHref(e);
                    t(n);
                }
            });
        };
        Object.entries(n).forEach(([e, t]) => {
            a(e, t);
        });
    }
    findCarNumAndHref(e) {
        var t;
        var n;
        let a;
        let i;
        let s;
        let o = e.find("a");
        let r = o.attr("href");
        let l = e.find(".video-title");
        if (l.length > 0) {
            let t = l.find("strong");
            if (t.length > 0) {
                a = t.text().trim();
            }
            i = o.attr("title")
                ? o.attr("title").trim()
                : a
                  ? l.text().replace(a, "").trim()
                  : l.text().trim();
            s = e.find(".meta").text().trim();
        }
        if (!a) {
            let o = e.find("img");
            if (r && o.length > 0) {
                i =
                    ((t = o.attr("title")) == null ? undefined : t.trim()) ||
                    ((n = o.attr("data-title")) == null ? undefined : n.trim());
            }
            const l = (e) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e);
            s = e
                .find("date")
                .map((e, t) => $(t).text().trim())
                .get()
                .find(l);
            a = e
                .find("date")
                .map((e, t) => $(t).text().trim())
                .get()
                .find((e) => !l(e));
        }
        if (!a) {
            const e = "提取番号信息失败";
            show.error(e);
            throw new Error(e);
        }
        return {
            carNum: a,
            aHref: r,
            url: r,
            title: i,
            publishTime: s,
        };
    }
    showCarNumBox(e) {
        const t = $(".movie-list .item")
            .toArray()
            .find((t) => $(t).find(".video-title strong").text() === e);
        if (t) {
            const n = $(t);
            if (n.attr("data-hide") === `${e}-hide`) {
                n.show();
                n.removeAttr("data-hide");
            }
        }
    }
    replaceHdImg(e) {
        if (e && typeof e.jquery == "string") {
            e = e.toArray();
        }
        e ||= document.querySelectorAll(this.getSelector().coverImgSelector);
        if (r) {
            e.forEach((e) => {
                e.src = e.src.replace("thumbs", "covers");
                e.title = "";
            });
        }
        if (l) {
            const t = /\/(imgs|pics)\/(thumb|thumbs)\//;
            const n = /(\.jpg|\.jpeg|\.png)$/i;
            const a = (e) => {
                if (e.src && t.test(e.src) && e.dataset.hdReplaced !== "true") {
                    e.src = e.src.replace(t, "/$1/cover/").replace(n, "_b$1");
                    e.dataset.hdReplaced = "true";
                    e.dataset.title = e.title;
                    e.title = "";
                }
            };
            const i = /ps(\.jpg|\.jpeg|\.png)$/i;
            const s = (e) => {
                if (e.src && i.test(e.src) && e.dataset.hdReplaced !== "true") {
                    e.src = e.src.replace(i, "pl$1");
                    e.dataset.hdReplaced = "true";
                    e.dataset.title = e.title;
                    e.title = "";
                }
            };
            e.forEach((e) => {
                a(e);
                s(e);
            });
        }
        storageManager.getSetting("hoverBigImg", C).then((e) => {
            if (e === _) {
                if (window.imageHoverPreviewObj) {
                    window.imageHoverPreviewObj.bindEvents();
                } else {
                    window.imageHoverPreviewObj = new ImagePreview({
                        selector: this.getSelector().coverImgSelector,
                    });
                }
            }
        });
    }
    async translate(e) {
        if ((await storageManager.getSetting("translateTitle", _)) !== _) {
            return;
        }
        let t;
        let n;
        let a = e.find(".video-title");
        if (r) {
            t = a
                .contents()
                .filter(
                    (e, t) => t.nodeType === 3 && t.textContent.trim() !== "",
                )
                .text()
                .trim();
            n = e.find(".video-title strong").text().trim();
        } else {
            t = e.find("img").attr("data-title").trim();
            n = e
                .find("a")
                .attr("href")
                .split("/")
                .filter(Boolean)
                .pop()
                .trim();
        }
        if (this.cache[n]) {
            let e = this;
            a.contents().each(function () {
                if (this.nodeType === 3 && this.textContent.trim() !== "") {
                    this.textContent = " " + e.cache[n] + " ";
                }
            });
            a.attr("title", e.cache[n]);
            return;
        }
        _e(t)
            .then((e) => {
                if (r) {
                    a.contents().each(function () {
                        if (
                            this.nodeType === 3 &&
                            this.textContent.trim() !== "" &&
                            !this.textContent.includes(n)
                        ) {
                            this.textContent = " " + e + " ";
                        }
                    });
                    a.attr("title", e);
                } else {
                    a.text(e);
                }
                this.writeQueue = this.writeQueue.then(() => {
                    this.cache[n] = e;
                    localStorage.setItem(
                        "jhs_translate",
                        JSON.stringify(this.cache),
                    );
                });
            })
            .catch((e) => {
                console.error("翻译失败:", e);
            });
    }
    async revertTranslation() {
        $(this.getSelector().itemSelector)
            .toArray()
            .forEach((e) => {
                let t = $(e);
                const n =
                    t.find(".box").attr("title") ||
                    t.find(".video-title").attr("title") ||
                    t.find("img").attr("data-title");
                let a;
                if (r) {
                    a = t.find(".video-title strong").text().trim();
                }
                const i = t.find(".video-title");
                i.contents().each(function () {
                    if (
                        this.nodeType === 3 &&
                        this.textContent.trim() !== "" &&
                        !this.textContent.includes(a)
                    ) {
                        this.textContent = " " + n + " ";
                    }
                });
                i.removeAttr("title");
            });
    }
    addJumpPageControl() {
        const e = "gemini-jump-page-control";
        if ($("#" + e).length > 0) {
            return;
        }
        if ($(".pagination-link.is-current").length === 0) {
            return;
        }
        const t = utils.getUrlParam(o, "page") || 1;
        const n = $("<input>", {
            type: "number",
            id: "jumpPageInput",
            placeholder: "页码",
            min: "1",
            style: "width: 60px; margin-left: 10px; padding: 10px; border: 1px solid #ccc; font-size: 14px;",
            value: t + 1,
        });
        const a = $("<button>", {
            text: "跳转",
            style: "margin-left: 5px; padding: 9px 8px; cursor: pointer; border: 1px solid #ccc; background-color: #f0f0f0; font-size: 14px;",
        });
        const i = $("<li>", {
            id: e,
        })
            .append(n)
            .append(a);
        $(".pagination-list").append(i);
        const s = () => {
            const e = parseInt(n.val(), 10);
            if (isNaN(e) || e < 1) {
                n.focus();
                return;
            }
            const t = new URL(window.location.href);
            t.searchParams.set("page", e.toString());
            window.location.href = t.toString();
        };
        a.on("click", s);
        n.on("keypress", function (e) {
            if (e.which === 13) {
                s();
                e.preventDefault();
            }
        });
    }
}
class De {
    constructor(e, t, n) {
        this.davUrl = e.endsWith("/") ? e : e + "/";
        this.username = t;
        this.password = n;
        this.folderName = null;
    }
    _getAuthHeaders() {
        return {
            Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
            Depth: "1",
        };
    }
    _sendRequest(e, t, n = {}, a) {
        return new Promise((i, s) => {
            const o = this.davUrl + t;
            const r = {
                ...this._getAuthHeaders(),
                ...n,
            };
            GM_xmlhttpRequest({
                method: e,
                url: o,
                headers: r,
                data: a,
                onload: (e) => {
                    if (e.status >= 200 && e.status < 300) {
                        i(e);
                    } else {
                        console.error(e);
                        s(new Error(`请求失败 ${e.status}: ${e.statusText}`));
                    }
                },
                onerror: (e) => {
                    console.error("请求WebDav发生错误:", e);
                    s(
                        new Error(
                            "请求WebDav失败, 请检查服务是否启动, 凭证是否正确",
                        ),
                    );
                },
            });
        });
    }
    async backup(e, t, n) {
        await this._sendRequest("MKCOL", e);
        const a = e + "/" + t;
        await this._sendRequest(
            "PUT",
            a,
            {
                "Content-Type": "text/plain",
            },
            n,
        );
    }
    async getFileList(e) {
        var t;
        var n;
        var a;
        const i = (
            await this._sendRequest(
                "PROPFIND",
                e,
                {
                    "Content-Type": "application/xml",
                },
                '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            ',
            )
        ).responseText;
        const s = new DOMParser()
            .parseFromString(i, "text/xml")
            .getElementsByTagNameNS("DAV:", "response");
        const o = [];
        for (let r = 0; r < s.length; r++) {
            if (r === 0) {
                continue;
            }
            let e = s[r];
            console.log(e);
            const i = e.getElementsByTagNameNS("DAV:", "displayname")[0]
                .textContent;
            const l =
                ((t = e.getElementsByTagNameNS(
                    "DAV:",
                    "getcontentlength",
                )[0]) == null
                    ? undefined
                    : t.textContent) || "0";
            const c =
                ((n = e.getElementsByTagNameNS("DAV:", "creationdate")[0]) ==
                null
                    ? undefined
                    : n.textContent) ||
                ((a = e.getElementsByTagNameNS("DAV:", "getlastmodified")[0]) ==
                null
                    ? undefined
                    : a.textContent) ||
                "";
            if (l !== "0") {
                o.push({
                    fileId: i,
                    name: i,
                    size: Number(l),
                    createTime: c,
                });
            }
        }
        o.reverse();
        return o;
    }
    async deleteFile(e) {
        let t = this.folderName + "/" + encodeURI(e);
        await this._sendRequest("DELETE", t, {
            "Cache-Control": "no-cache",
        });
    }
    async getBackupList(e) {
        this.folderName = e;
        await this._sendRequest("MKCOL", e);
        return this.getFileList(e);
    }
    async getFileContent(e) {
        let t = this.folderName + "/" + e;
        return (
            await this._sendRequest("GET", t, {
                Accept: "application/octet-stream",
            })
        ).responseText;
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
