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
class DetailPageButtonPlugin extends BasePlugin {
    getName() {
        return "DetailPageButtonPlugin";
    }
    constructor() {
        super();
        this.answerCount = 1;
    }
    async handle() {
        let e = await storageManager.getSetting();
        this.filterHotKey = e.filterHotKey;
        this.favoriteHotKey = e.favoriteHotKey;
        this.hasWatchHotKey = e.hasWatchHotKey;
        this.speedVideoHotKey = e.speedVideoHotKey;
        this.bindHotkey().then();
        this.hideVideoControls();
        if (window.isDetailPage) {
            this.createMenuBtn();
            this.hookWantAndWatchedButtons();
            this.addQuickActionButtons();
            this.setupWantWatchedSyncListener();
        }
    }
    async createMenuBtn() {
        const e = this.getPageInfo();
        const t = e.carNum;
        const n = `\n            <div style="margin: 10px auto; display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;gap: 20px;">\n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="filterBtn" class="menu-btn" style="width: 120px; background-color:${f}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${m}</span>\n                    </a>\n                    <a id="favoriteBtn" class="menu-btn" style="width: 120px; background-color:${w}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${v}</span>\n                    </a>\n                    <a id="hasWatchBtn" class="menu-btn" style="width: 120px; background-color:${S}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${k}</span>\n                    </a>\n                </div>\n        \n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="enable-magnets-filter" class="menu-btn" style="width: 140px; background-color: #c2bd4c; color: white; text-align: center; padding: 8px 0;">\n                        <span id="magnets-span">关闭磁力过滤</span>\n                    </a>\n                    <a id="xunLeiSubtitleBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to left, #375f7c, #2196F3); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (迅雷)</span>\n                    </a>\n                    <a id="search-subtitle-btn" class="menu-btn" style="width: 160px; background: linear-gradient(to bottom, #8d5656, rgb(196,159,91)); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (SubTitleCat)</span>\n                    </a>\n                </div>\n            </div>\n        `;
        if (r) {
            $(".tabs").after(n);
        }
        if (l) {
            $("#mag-submit-show").before(n);
        }
        $("#favoriteBtn").on("click", () => this.favoriteOne());
        $("#filterBtn").on("click", (e) => this.filterOne(e));
        $("#hasWatchBtn").on("click", async () => this.hasWatchOne());
        const a = this.getBean("HighlightMagnetPlugin");
        const i = await storageManager.getSetting("enableMagnetsFilter", _);
        $("#magnets-span").text(i === _ ? "关闭磁力过滤" : "开启磁力过滤");
        if (i === _) {
            a.doFilterMagnet();
        }
        $("#enable-magnets-filter").on("click", (e) => {
            let t = $("#magnets-span");
            if (t.text() === "关闭磁力过滤") {
                a.showAll();
                t.text("开启磁力过滤");
                storageManager.saveSettingItem("enableMagnetsFilter", C);
            } else {
                a.doFilterMagnet();
                t.text("关闭磁力过滤");
                storageManager.saveSettingItem("enableMagnetsFilter", _);
            }
        });
        $("#search-subtitle-btn").on("click", (e) =>
            utils.openPage(
                `https://subtitlecat.com/index.php?search=${t}`,
                t,
                false,
                e,
            ),
        );
        $("#xunLeiSubtitleBtn").on("click", () => this.searchXunLeiSubtitle(t));
        this.showStatus(t).then();
    }
    async showStatus(e) {
        const t = $("#filterBtn span");
        const n = $("#favoriteBtn span");
        const i = $("#hasWatchBtn span");
        const s = (e) => (e ? `(${e})` : "");
        t.text(`${m} ${s(this.filterHotKey)}`);
        n.text(`${v} ${s(this.favoriteHotKey)}`);
        i.text(`${k} ${s(this.hasWatchHotKey)}`);
        const o = await storageManager.getCar(e);
        if (o) {
            switch (o.status) {
                case d:
                    t.text(`${u} ${s(this.filterHotKey)}`);
                    break;
                case h:
                    n.text(`${b} ${s(this.favoriteHotKey)}`);
                    break;
                case p:
                    i.text(`🔍 已标记观看 ${s(this.hasWatchHotKey)}`);
            }
        }
    }

    // ----------------------------------------------------------------
    //  视频详情页“想看 / 看過”自动同步到 JHS
    // ----------------------------------------------------------------
    // 原理：JavDB 原生按钮（"想看" form / "看過" modal / "刪除" 链接）触发后，
    // 都会通过 ajax 整体替换 `.review-buttons` 容器内的 innerHTML：
    //   - 点"想看"：server 返回 JS 设置 `container.innerHTML = "<... 我想看這部影片 tag ...>"`
    //   - 点"看過"提交：同上，但 tag 变 is-success + 出现修改/删除按钮
    //   - 点"刪除"：回到初始状态（出现想看 form / 看過 按钮）
    // 我们用 MutationObserver 监听 .review-buttons 容器的子树变化，比对
    // 上一次与当前的"想看/已观看"状态，按差异自动同步到 JHS IndexedDB，
    // 并通过 CustomEvent + localStorage + GM_setValue 三重通道广播。
    hookWantAndWatchedButtons() {
        if (!r) return;
        if (this._wantWatchedObserved) return;
        const e = this;
        // 等待 .review-buttons 出现
        const ensure = () => {
            const t = document.querySelector(
                "body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons",
            );
            if (!t) {
                setTimeout(ensure, 200);
                return;
            }
            if (t.__jhsObserved) return;
            t.__jhsObserved = true;
            e._wantWatchedObserved = true;
            // 记录初始状态
            e._lastWantState = e.detectWantWatchedState(t);
            const n = new MutationObserver(() => {
                if (e._wantWatchedSyncing) return;
                // 防抖：连续多次变化合并
                clearTimeout(e._wantWatchedDebounce);
                e._wantWatchedDebounce = setTimeout(() => {
                    e._wantWatchedSyncing = true;
                    try {
                        const a = e.detectWantWatchedState(t);
                        const n = e._lastWantState || {
                            want: false,
                            watched: false,
                        };
                        if (a.want !== n.want) {
                            if (a.want) e.onWantAdded();
                            else e.onWantRemoved();
                        }
                        if (a.watched !== n.watched) {
                            if (a.watched) e.onWatchedAdded();
                            else e.onWatchedRemoved();
                        }
                        e._lastWantState = a;
                    } finally {
                        e._wantWatchedSyncing = false;
                    }
                }, 150);
            });
            n.observe(t, { childList: true, subtree: true });
        };
        ensure();
    }

    /**
     * 从 .review-buttons DOM 推断当前 JavDB 的"想看"和"已观看"状态。
     * @param {HTMLElement} container .review-buttons 容器
     * @returns {{want: boolean, watched: boolean}}
     */
    detectWantWatchedState(container) {
        // is-info is-light tag = 我想看
        // is-success is-light tag = 我看過
        // 它们的 parent a[href] 指向 /users/want_watch_videos 或 /users/watched_videos
        const t = container.querySelector(
            "a[href='/users/want_watch_videos'] .tag.is-info.is-light",
        );
        const n = container.querySelector(
            "a[href='/users/watched_videos'] .tag.is-success.is-light",
        );
        return {
            want: !!t,
            watched: !!n,
        };
    }

    /**
     * 检测到"想看"被勾选时的处理。
     */
    async onWantAdded() {
        const e = this.getPageInfo();
        try {
            // 避免重复写入同状态导致 _saveSingleCar 抛错
            const t = await storageManager.getCar(e.carNum);
            if (t && t.status === h) {
                // 已为 favorite，不重复写
            } else {
                await storageManager.saveCar({
                    carNum: e.carNum,
                    url: e.url,
                    names: e.actress,
                    actionType: h,
                    publishTime: e.publishTime,
                });
                this.broadcastWantWatchedSync({
                    carNum: e.carNum,
                    status: h,
                    op: "add",
                });
                show.ok(`${e.carNum} 已收藏`);
            }
        } catch (e) {
            console.error("[JHS-想看自动同步] 写入失败", e);
        }
        this.showStatus(e.carNum).then();
    }

    /**
     * 检测到"想看"被取消时的处理。
     */
    async onWantRemoved() {
        const e = this.getPageInfo();
        try {
            const removed = await this.removeCarIfStatus(e.carNum, h);
            if (removed) {
                this.broadcastWantWatchedSync({
                    carNum: e.carNum,
                    status: h,
                    op: "remove",
                });
                show.ok(`${e.carNum} 已取消收藏`);
            }
        } catch (e) {
            console.error("[JHS-想看自动同步] 移除失败", e);
        }
        this.showStatus(e.carNum).then();
    }

    /**
     * 检测到"已观看"被勾选时的处理。
     */
    async onWatchedAdded() {
        const e = this.getPageInfo();
        try {
            const t = await storageManager.getCar(e.carNum);
            if (t && t.status === p) {
                // 已为 hasWatch，不重复写
            } else {
                await storageManager.saveCar({
                    carNum: e.carNum,
                    url: e.url,
                    names: e.actress,
                    actionType: p,
                    publishTime: e.publishTime,
                });
                this.broadcastWantWatchedSync({
                    carNum: e.carNum,
                    status: p,
                    op: "add",
                });
                show.ok(`${e.carNum} 已标记看过`);
            }
        } catch (e) {
            console.error("[JHS-观看自动同步] 写入失败", e);
        }
        this.showStatus(e.carNum).then();
    }

    /**
     * 检测到"已观看"被取消时的处理。
     */
    async onWatchedRemoved() {
        const e = this.getPageInfo();
        try {
            const removed = await this.removeCarIfStatus(e.carNum, p);
            if (removed) {
                this.broadcastWantWatchedSync({
                    carNum: e.carNum,
                    status: p,
                    op: "remove",
                });
                show.ok(`${e.carNum} 已取消看过`);
            }
        } catch (e) {
            console.error("[JHS-观看自动同步] 移除失败", e);
        }
        this.showStatus(e.carNum).then();
    }

    /**
     * 仅当 JHS 中该番号状态为目标 status 时，移除 JHS 记录。
     * @param {string} carNum 番号
     * @param {string} status 目标状态（h=想看 / p=已观看）
     * @returns {Promise<boolean>} 是否执行了移除
     */
    async removeCarIfStatus(carNum, status) {
        const e = await storageManager.getCar(carNum);
        if (!e) return false;
        if (e.status !== status) return false;
        return await storageManager.removeCar(carNum);
    }

    /**
     * 广播“想看/观看”状态变更，供其他标签页/脚本接收。
     * @param {{carNum:string,status:string,op:'add'|'remove'}} payload 变更载荷
     */
    broadcastWantWatchedSync(payload) {
        try {
            const t = JSON.stringify({ ...payload, time: Date.now() });
            // 1) GM 原生通道（跨标签页）
            try {
                GM_setValue("jdb:want-watched-sync", t);
            } catch (_) {}
            // 2) localStorage（跨脚本同源）
            try {
                localStorage.setItem("jdb:want-watched-sync", t);
            } catch (_) {}
            // 3) CustomEvent（跨脚本同页面）
            try {
                document.dispatchEvent(
                    new CustomEvent("jdb:want-watched-sync", {
                        detail: payload,
                    }),
                );
            } catch (_) {}
        } catch (e) {
            console.error("[JHS-想看/观看同步] 广播失败", e);
        }
    }

    /**
     * 接收来自其他标签页/脚本的“想看/观看”状态变更，
     * 同步刷新本页菜单状态（详情页）+ 列表页/series 页中匹配视频卡片的 status-tag。
     */
    setupWantWatchedSyncListener() {
        if (!r) return;
        if (this._wantWatchedListenerInstalled) return;
        this._wantWatchedListenerInstalled = true;
        const e = this;
        const t = (n) => {
            const a =
                (n && n.detail) ||
                (() => {
                    try {
                        return JSON.parse(n);
                    } catch (_) {
                        return null;
                    }
                })();
            if (!a || !a.carNum) return;

            // 1) 详情页：刷新 JHS 菜单按钮文案
            try {
                const i = e.getPageInfo().carNum;
                if (i && a.carNum === i) {
                    e.showStatus(i).then(() => {});
                }
            } catch (_) {}

            // 2) 列表页/series 页：刷新匹配卡片的 status-tag
            e.refreshItemStatusTag(a.carNum);
        };
        // 1) 同页面 CustomEvent
        document.addEventListener("jdb:want-watched-sync", (n) => t(n.detail));
        // 2) localStorage（跨标签页 / 跨 iframe）
        window.addEventListener("storage", (n) => {
            if (n.key !== "jdb:want-watched-sync" || !n.newValue) return;
            t(n.newValue);
        });
        // 3) GM 通道
        try {
            GM_addValueChangeListener("jdb:want-watched-sync", (n, a, i) => {
                if (!i) return;
                t(i);
            });
        } catch (_) {}
    }

    /**
     * 跨页/跨 iframe 同步：刷新当前页所有匹配 carNum 的视频卡片 status-tag。
     * 走 ListPagePlugin.filterMovieList 同样的渲染逻辑（取自 IndexedDB 真值），
     * 避免依赖本地缓存，确保 iframe 内操作后立刻反映到父页 series 列表上。
     * @param {string} carNum 要刷新的番号
     */
    refreshItemStatusTag(carNum) {
        try {
            const e = this.getSelector();
            const t = e.itemSelector;
            const n = document.querySelectorAll(t);
            for (const a of n) {
                const i = a.querySelector("a > div.video-title > strong");
                if (!i || i.innerHTML !== carNum) continue;
                // 找到匹配的卡片，交给 ListPagePlugin 重跑单卡片
                const s = this.getBean("ListPagePlugin");
                if (!s) continue;
                s.renderItemStatusTag(a, carNum);
            }
        } catch (e) {
            console.error("[JHS-想看/观看] 刷新列表项 status-tag 失败", e);
        }
    }

    /**
     * 在详情页注入星星评分组件（5星 + 已读 + 收藏）。
     * 组件在 .review-buttons 内部的 .column 上方，会被 Rails ajax 的 innerHTML 替换销毁，
     * 因此用 MutationObserver 监听 .review-buttons 变化，销毁后自动重建。
     */
    addQuickActionButtons() {
        if (!window.isDetailPage) return;
        if (this._quickActionAdded) return;
        this._quickActionAdded = true;
        const self = this;
        this._injectRatingStyles();
        const ensure = () => {
            const nav = document.querySelector(
                "body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav",
            );
            if (!nav) {
                setTimeout(ensure, 400);
                return;
            }
            // 构建组件（如果不存在）
            self._buildRatingBar(nav);
            self._syncRatingBar();
            // 清单面板独立等待 #otherSiteBox 出现（OtherSitePlugin 异步注入）
            self._ensureListPanel(nav);
            // 监听 .review-buttons 变化（Rails ajax 替换 innerHTML 会销毁组件 → 重建 + 状态刷新）
            const rb = nav.querySelector(".review-buttons");
            if (rb && !rb.__jhsRatingObserved) {
                rb.__jhsRatingObserved = true;
                new MutationObserver(() => {
                    if (self._wantWatchedSyncing) return;
                    clearTimeout(self._ratingSyncDebounce);
                    self._ratingSyncDebounce = setTimeout(() => {
                        self._buildRatingBar(nav);
                        self._syncRatingBar();
                    }, 200);
                }).observe(rb, { childList: true, subtree: true });
            }
        };
        ensure();
    }

    /**
     * 构建星星评分组件 DOM 并插入 .column 上方（如已存在则跳过）。
     * @param {HTMLElement} nav nav 容器
     */
    _buildRatingBar(nav) {
        const column = nav.querySelector(
            "div.review-buttons > div:nth-child(1) > div > div",
        );
        if (!column) return;
        if (column.querySelector(".jhs-rating-bar")) return; // 已存在
        const self = this;
        const bar = document.createElement("div");
        bar.className = "jhs-rating-bar";
        bar.innerHTML =
            '<div class="jhs-stars" data-score="0">' +
            [1, 2, 3, 4, 5]
                .map(
                    (n) =>
                        '<span class="jhs-star" data-score="' +
                        n +
                        '">★</span>',
                )
                .join("") +
            "</div>" +
            '<div class="jhs-rating-actions">' +
            '<button class="jhs-fav-btn" type="button" title="设为想看（收藏）">♥ 收藏</button>' +
            '<button class="jhs-read-btn" type="button" title="设为已观看（0星）">已读</button>' +
            "</div>";
        const starsEl = bar.querySelector(".jhs-stars");
        const stars = bar.querySelectorAll(".jhs-star");
        const readBtn = bar.querySelector(".jhs-read-btn");
        const favBtn = bar.querySelector(".jhs-fav-btn");
        // hover 预览
        starsEl.addEventListener("pointerover", (e) => {
            const star = e.target.closest(".jhs-star");
            if (!star) return;
            const score = +star.dataset.score;
            stars.forEach((s, i) =>
                s.classList.toggle("is-preview", i < score),
            );
        });
        starsEl.addEventListener("pointerleave", () =>
            stars.forEach((s) => s.classList.remove("is-preview")),
        );
        // 点击星星 → 已观看 + N星
        stars.forEach((star) => {
            star.addEventListener("click", async (e) => {
                e.preventDefault();
                const score = +star.dataset.score;
                star.classList.add("is-popping");
                setTimeout(() => star.classList.remove("is-popping"), 300);
                self._setRatingBusy(true);
                try {
                    await self.quickSetHasWatch(score);
                } finally {
                    self._setRatingBusy(false);
                    self.showStatus(self.getPageInfo().carNum).then();
                }
            });
        });
        // 已读 → 已观看 + 0星
        readBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            readBtn.classList.add("is-popping");
            setTimeout(() => readBtn.classList.remove("is-popping"), 300);
            self._setRatingBusy(true);
            try {
                await self.quickSetHasWatch(0);
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum).then();
            }
        });
        // 收藏 → 想看
        favBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            favBtn.classList.add("is-popping");
            setTimeout(() => favBtn.classList.remove("is-popping"), 300);
            self._setRatingBusy(true);
            try {
                await self.quickConvertToFav();
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum).then();
            }
        });
        column.insertBefore(bar, column.firstChild);
    }

    /**
     * 轮询等待 #otherSiteBox 出现后创建清单面板、初始化、绑定事件代理。
     * @param {HTMLElement} nav nav 容器
     */
    _ensureListPanel(nav) {
        if (this._listPanelEnsured) return;
        const otherSite = nav.querySelector("#otherSiteBox");
        if (!otherSite) {
            setTimeout(() => this._ensureListPanel(nav), 400);
            return;
        }
        this._listPanelEnsured = true;
        const self = this;
        // 创建清单面板
        if (!nav.querySelector(".jhs-list-panel")) {
            const listPanel = document.createElement("div");
            listPanel.className = "jhs-list-panel";
            otherSite.insertAdjacentElement("afterend", listPanel);
        }
        // 初始化（触发 ajax 加载 + 克隆同步）
        self._initListPanel();
        // 事件代理：平铺面板 checkbox change → 同步到 modal 内 checkbox 触发 Stimulus
        const listPanel = nav.querySelector(".jhs-list-panel");
        if (listPanel && !listPanel.__jhsListClickBound) {
            listPanel.__jhsListClickBound = true;
            listPanel.addEventListener("change", (e) => {
                if (e.target.type !== "checkbox") return;
                const modal = document.querySelector("#modal-save-list");
                const listContainer = modal?.querySelector(
                    '[data-list-target="listContainer"]',
                );
                if (!listContainer) return;
                const panels = Array.from(
                    listPanel.querySelectorAll('input[type="checkbox"]'),
                );
                const idx = panels.indexOf(e.target);
                const modalCheckboxes = listContainer.querySelectorAll(
                    'input[type="checkbox"]',
                );
                const target = modalCheckboxes[idx];
                if (target) {
                    target.checked = e.target.checked;
                    target.dispatchEvent(
                        new Event("change", { bubbles: true }),
                    );
                }
            });
        }
    }

    /**
     * 初始化清单平铺面板：程序化触发 save-list-button 打开 modal（CSS 隐藏），
     * 监听 listContainer 内容变化并克隆到 .jhs-list-panel；
     * 用户在平铺面板勾选时同步到 modal 内 checkbox 触发 Stimulus ajax。
     */
    _initListPanel() {
        if (this._listPanelIniting) return;
        this._listPanelIniting = true;
        const self = this;
        const ensure = () => {
            const btn = document.querySelector("#save-list-button");
            const modal = document.querySelector("#modal-save-list");
            if (!btn || !modal) {
                setTimeout(ensure, 400);
                return;
            }
            const listContainer = modal.querySelector(
                '[data-list-target="listContainer"]',
            );
            if (!listContainer) return;
            // 程序化触发 ajax 加载清单
            if (!self._listAjaxTriggered) {
                self._listAjaxTriggered = true;
                btn.click();
            }
            // 监听 listContainer 内容变化 → 克隆到平铺面板
            if (!listContainer.__jhsListObserved) {
                listContainer.__jhsListObserved = true;
                const sync = () => {
                    const panel = document.querySelector(".jhs-list-panel");
                    if (!panel) return;
                    panel.innerHTML = "";
                    Array.from(listContainer.children).forEach((child) => {
                        // 跳过「預設清單」
                        if (child.textContent.includes("預設清單")) return;
                        const clone = child.cloneNode(true);
                        panel.appendChild(clone);
                    });
                };
                new MutationObserver(sync).observe(listContainer, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ["checked", "disabled"],
                });
                // 初始同步
                setTimeout(sync, 500);
            }
        };
        ensure();
    }

    /**
     * 注入星星评分组件的 CSS 样式。
     */
    _injectRatingStyles() {
        if (document.getElementById("jhs-rating-styles")) return;
        const style = document.createElement("style");
        style.id = "jhs-rating-styles";
        style.textContent = `
/* 隐藏 review-buttons 内第二个 panel-block（下載/訂正磁力按钮） */
.review-buttons > .panel-block ~ .panel-block{display:none!important}
/* 隐藏 review-buttons 后紧跟的 panel-block（N人想看/看過统计） */
.review-buttons + .panel-block{display:none!important}
/* 隐藏原生评价状态标签和按钮（星星组件已替代） */
.review-buttons .review-title{display:none!important}
.review-buttons .buttons.are-small.review-buttons{display:none!important}
/* 永久隐藏清单 modal（DOM 保留供 Stimulus ajax 操作） */
#modal-save-list{display:none!important}
/* 星星评分组件 */
.jhs-rating-bar{display:flex;flex-direction:column;gap:6px;margin:4px 0 12px;user-select:none}
.jhs-stars{display:inline-flex;gap:6px;align-items:center}
.jhs-star{font-size:26px;line-height:1.2;padding:2px 4px;cursor:pointer;color:#d0d0d0;transition:color .15s,transform .15s}
.jhs-star:hover{transform:scale(1.15)}
.jhs-star.is-preview{color:#f5b301}
.jhs-star.is-active{color:#f5b301}
.jhs-star.is-active:hover{color:#ffce3a}
.jhs-star.is-popping{animation:jhs-star-pop .3s ease}
@keyframes jhs-star-pop{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}
.jhs-stars.is-disabled .jhs-star{cursor:default;opacity:.4;pointer-events:none}
.jhs-rating-actions{display:flex;gap:8px;align-items:center}
.jhs-read-btn,.jhs-fav-btn{border:1px solid #dbdbdb;border-radius:6px;padding:5px 16px;font-size:14px;background:#fff;cursor:pointer;transition:all .15s;white-space:nowrap}
.jhs-read-btn:hover,.jhs-fav-btn:hover{border-color:#b5b5b5;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.jhs-read-btn.is-active{background:#48c774;border-color:#48c774;color:#fff}
.jhs-fav-btn.is-active{background:#3273dc;border-color:#3273dc;color:#fff}
.jhs-read-btn.is-popping,.jhs-fav-btn.is-popping{animation:jhs-star-pop .3s ease}
.jhs-rating-bar.is-busy{pointer-events:none;opacity:.6}
/* 清单平铺面板（位于 #otherSiteBox 下方） */
.jhs-list-panel{display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0;padding:8px 12px;background:#fafafa;border-radius:6px;min-height:36px}
.jhs-list-panel:empty{display:none}
.jhs-list-panel .control{margin:0}
.jhs-list-panel .checkbox{display:inline-flex;align-items:center;gap:4px;font-size:13px;cursor:pointer}
.jhs-list-panel .checkbox input{margin:0}
        `;
        document.head.appendChild(style);
    }

    /**
     * 从 javdb 原生 DOM 检测当前评价状态，同步星星组件显示。
     * 状态：want（想看）/ watched+N（已观看 N 星）/ none（未评价）
     */
    _syncRatingBar() {
        let bar = document.querySelector(".jhs-rating-bar");
        // 组件被 Rails ajax innerHTML 替换销毁 → 重建
        if (!bar) {
            const nav = document.querySelector(
                "body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav",
            );
            if (nav) this._buildRatingBar(nav);
            bar = document.querySelector(".jhs-rating-bar");
        }
        if (!bar) return;
        const rb = document.querySelector(".review-buttons");
        if (!rb) return;
        const want = !!rb.querySelector(
            "a[href='/users/want_watch_videos'] .tag.is-info.is-light",
        );
        const watched = !!rb.querySelector(
            "a[href='/users/watched_videos'] .tag.is-success.is-light",
        );
        const checked = rb.querySelector(
            'input[name="video_review[score]"][checked]',
        );
        const score = checked ? +checked.value : 0;

        const stars = bar.querySelectorAll(".jhs-star");
        const starsEl = bar.querySelector(".jhs-stars");
        const readBtn = bar.querySelector(".jhs-read-btn");
        const favBtn = bar.querySelector(".jhs-fav-btn");

        if (want) {
            // 想看：星星禁用全灰，收藏高亮
            stars.forEach((s) => s.classList.remove("is-active"));
            starsEl.classList.add("is-disabled");
            readBtn.classList.remove("is-active");
            favBtn.classList.add("is-active");
        } else if (watched) {
            // 已观看：前 N 星高亮，已读看 N 是否 0
            stars.forEach((s, i) => s.classList.toggle("is-active", i < score));
            starsEl.classList.remove("is-disabled");
            readBtn.classList.toggle("is-active", score === 0);
            favBtn.classList.remove("is-active");
        } else {
            // 未评价
            stars.forEach((s) => s.classList.remove("is-active"));
            starsEl.classList.remove("is-disabled");
            readBtn.classList.remove("is-active");
            favBtn.classList.remove("is-active");
        }
    }

    /**
     * 设置评分组件忙碌状态（操作期间禁用交互）。
     */
    _setRatingBusy(busy) {
        const bar = document.querySelector(".jhs-rating-bar");
        if (bar) bar.classList.toggle("is-busy", busy);
    }

    /**
     * 一键设为已观看并设置评鉴分数。
     * @param {number} score 评分 0-5
     */
    async quickSetHasWatch(score) {
        const e = this.getPageInfo();
        if (!e.carNum) return;
        // ---- JHS 端更新 ----
        try {
            const t = await storageManager.getCar(e.carNum);
            if (t && t.status === h) {
                await storageManager.removeCar(e.carNum);
            }
            if (t && t.status === p && t.score === score) {
                show.ok(e.carNum + " 评分未变化");
                return;
            }
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: p,
                publishTime: e.publishTime,
                score: score,
            });
            this.broadcastWantWatchedSync({
                carNum: e.carNum,
                status: p,
                op: "add",
            });
            show.ok(
                e.carNum +
                    " \u5df2\u6807\u8bb0\u770b\u8fc7 " +
                    (score > 0 ? "\u2605" + score : ""),
            );
        } catch (e) {
            console.error("[JHS-快键] 设为已观看失败", e);
            show.error("操作失败: " + e.message);
            return;
        }
        // 串行化 javdb 原生端操作，避免连续点击并发冲突；
        // _wantWatchedSyncing 期间阻断 MutationObserver，完成后立即释放
        this._reviewChain = (this._reviewChain || Promise.resolve())
            .then(async () => {
                this._wantWatchedSyncing = true;
                try {
                    await this._triggerJavdbReview(score);
                    this._syncRatingBar();
                } finally {
                    this._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    }
    /**
     * 获取 javdb 的 CSRF token。
     * @returns {string|null}
     */
    _getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : null;
    }

    /**
     * 从当前 URL 提取 videoId（如 /v/Ebqv9 → Ebqv9）。
     * @returns {string|null}
     */
    _getVideoId() {
        return location.pathname.match(/\/v\/([^/]+)/)?.[1] || null;
    }

    /**
     * 从 .review-buttons 的删除链接提取当前 reviewId。
     * @returns {string|null}
     */
    _getReviewId() {
        const del = document.querySelector(
            ".review-buttons a[data-method='delete'][href*='/reviews/']",
        );
        if (!del) return null;
        return del.getAttribute("href")?.match(/\/reviews\/(\d+)/)?.[1] || null;
    }

    /**
     * 在页面主上下文执行 javdb Rails 返回的 JS（text/javascript）。
     * Rails 返回的 JS 会自行替换 .review-buttons 的 innerHTML 并重绑定 UJS 事件
     *（data-remote / data-target modal / data-confirm 等），保证后续原生按钮
     *（修改 / 刪除 / 看過 modal）可正常点击。用 <script> 标签注入而非 eval，
     * 确保在 Tampermonkey 沙箱中也运行于页面主上下文。
     * @param {string} jsText Rails 返回的 JS 源码
     */
    _execRailsJs(jsText) {
        try {
            const script = document.createElement("script");
            script.textContent = jsText;
            document.head.appendChild(script);
            script.remove();
        } catch (e) {
            console.error("[JHS-快键] 执行 Rails JS 失败", e);
        }
    }

    /**
     * 通过 javdb 原生评价 API 设置状态（已观看/想看），替代不可靠的 DOM form 操作。
     * 原方案通过 click 删除链接 + 找 form 提交，但 javdb "看過" 走 modal 而非直接 form，
     * 误提交"想看" form 导致状态错误。改用 POST /v/{videoId}/reviews 系列 API。
     * @param {'watched'|'wanted'} action 目标状态
     * @param {number} score 评分 0-5（仅 watched 有效）
     */
    async _javdbReviewApi(action, score = 0) {
        const token = this._getCsrfToken();
        if (!token) throw new Error("无法获取 CSRF token");
        const videoId = this._getVideoId();
        if (!videoId) throw new Error("无法获取 videoId");
        const reviewId = this._getReviewId();

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRF-Token": token,
        };
        const tokenParam = `authenticity_token=${encodeURIComponent(token)}`;

        if (action === "watched") {
            // 有 reviewId → PATCH 改状态；无 → POST 新建
            const url = reviewId
                ? `/v/${videoId}/reviews/${reviewId}`
                : `/v/${videoId}/reviews`;
            const methodParam = reviewId ? "&_method=patch" : "";
            const body = `${tokenParam}${methodParam}&video_review[status]=watched&video_review[score]=${score}&video_review[content]=`;
            const res = await fetch(url, {
                method: "POST",
                headers,
                body,
                credentials: "same-origin",
            });
            if (!res.ok) throw new Error(`设为已观看失败: HTTP ${res.status}`);
            // 执行 Rails 返回的 JS：更新 DOM + 重绑定 UJS 事件
            this._execRailsJs(await res.text());
        } else if (action === "wanted") {
            // 想看与已评价互斥：已有 review 先删除再建想看
            if (reviewId) {
                const delRes = await fetch(
                    `/v/${videoId}/reviews/${reviewId}`,
                    {
                        method: "POST",
                        headers,
                        body: `${tokenParam}&_method=delete`,
                        credentials: "same-origin",
                    },
                );
                if (!delRes.ok)
                    throw new Error(`删除旧评价失败: HTTP ${delRes.status}`);
                this._execRailsJs(await delRes.text());
            }
            const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, {
                method: "POST",
                headers,
                body: tokenParam,
                credentials: "same-origin",
            });
            if (!res.ok) throw new Error(`设为想看失败: HTTP ${res.status}`);
            this._execRailsJs(await res.text());
        }

        // 同步 _lastWantState 防止 MutationObserver 误触发
        const rb = document.querySelector(".review-buttons");
        if (rb && this._wantWatchedObserved) {
            this._lastWantState = this.detectWantWatchedState(rb);
        }
    }

    /**
     * 一键设为已观看并设置评鉴分数（javdb 原生端）。
     * @param {number} score 评分 0-5
     */
    async _triggerJavdbReview(score) {
        await this._javdbReviewApi("watched", score);
    }
    _waitForDomChange(selector, ms) {
        return new Promise((resolve) => {
            const start = Date.now();
            const el = document.querySelector(selector);
            if (!el) {
                resolve(null);
                return;
            }
            const before = el.innerHTML;
            const check = () => {
                const cur = document.querySelector(selector);
                if (!cur) {
                    resolve(null);
                    return;
                }
                if (cur.innerHTML !== before) {
                    resolve(cur);
                    return;
                }
                if (Date.now() - start > ms) {
                    resolve(cur);
                    return;
                }
                setTimeout(check, 200);
            };
            setTimeout(check, 200);
        });
    }
    _waitForEl(fn, ms) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                const el = fn();
                if (el) {
                    resolve(el);
                    return;
                }
                if (Date.now() - start > ms) {
                    resolve(null);
                    return;
                }
                setTimeout(check, 150);
            };
            check();
        });
    }
    async quickConvertToFav() {
        const e = this.getPageInfo();
        if (!e.carNum) return;
        try {
            const t = await storageManager.getCar(e.carNum);
            if (t && t.status === h) {
                show.ok(e.carNum + " 已是已收藏");
                return;
            }
            if (t) await storageManager.removeCar(e.carNum);
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: h,
                publishTime: e.publishTime,
            });
            this.broadcastWantWatchedSync({
                carNum: e.carNum,
                status: h,
                op: "add",
            });
            show.ok(e.carNum + " \u5df2\u8f6c\u4e3a\u6536\u85cf");
        } catch (e) {
            console.error("[JHS-快键] 转为已收藏失败", e);
            show.error("操作失败: " + e.message);
            return;
        }
        this._reviewChain = (this._reviewChain || Promise.resolve())
            .then(async () => {
                this._wantWatchedSyncing = true;
                try {
                    await this._triggerJavdbWant();
                    this._syncRatingBar();
                } finally {
                    this._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    }
    /**
     * 将当前影片在 javdb 原生端设为"想看"（通过 API，替代 DOM form 操作）。
     */
    async _triggerJavdbWant() {
        await this._javdbReviewApi("wanted");
    }
    async favoriteOne() {
        let e = this.getPageInfo();
        await storageManager.saveCar({
            carNum: e.carNum,
            url: e.url,
            names: e.actress,
            actionType: h,
            publishTime: e.publishTime,
        });
        this.showStatus(e.carNum).then();
        window.refresh();
        utils.closePage();
    }
    async hasWatchOne() {
        let e = this.getPageInfo();
        await storageManager.saveCar({
            carNum: e.carNum,
            url: e.url,
            names: e.actress,
            actionType: p,
            publishTime: e.publishTime,
        });
        this.showStatus(e.carNum).then();
        window.refresh();
        utils.closePage();
    }
    searchXunLeiSubtitle(e) {
        let t = loading();
        gmHttp
            .get(
                `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${e}`,
            )
            .then((t) => {
                let n = t.data;
                if (n && n.length !== 0) {
                    layer.open({
                        type: 1,
                        title: "迅雷字幕",
                        content:
                            '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="xunlei-table-container" style="height: 100%;padding-bottom: 20px"></div>\n                    </div>\n                ',
                        scrollbar: false,
                        area: utils.getResponsiveArea(["60%", "70%"]),
                        anim: -1,
                        success: (t, a) => {
                            new Tabulator("#xunlei-table-container", {
                                layout: "fitColumns",
                                placeholder: "暂无数据",
                                virtualDom: true,
                                data: n,
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
                                        headerSort: false,
                                        responsive: 0,
                                    },
                                    {
                                        title: "类型",
                                        field: "ext",
                                        headerSort: false,
                                        responsive: 0,
                                    },
                                    {
                                        title: "操作",
                                        responsive: 0,
                                        headerSort: false,
                                        formatter: (t, n, a) => {
                                            const i = t.getData();
                                            a(() => {
                                                const n = t
                                                    .getElement()
                                                    .querySelector(
                                                        ".a-primary",
                                                    );
                                                const a = t
                                                    .getElement()
                                                    .querySelector(
                                                        ".a-success",
                                                    );
                                                if (n) {
                                                    n.addEventListener(
                                                        "click",
                                                        async (t) => {
                                                            let n = i.url;
                                                            let a =
                                                                e + "." + i.ext;
                                                            this.previewSubtitle(
                                                                n,
                                                                a,
                                                            );
                                                        },
                                                    );
                                                }
                                                if (a) {
                                                    a.addEventListener(
                                                        "click",
                                                        async (t) => {
                                                            let n = i.url;
                                                            let a =
                                                                e + "." + i.ext;
                                                            let s =
                                                                await gmHttp.get(
                                                                    n,
                                                                );
                                                            utils.download(
                                                                s,
                                                                a,
                                                            );
                                                        },
                                                    );
                                                }
                                            });
                                            return '\n                                        <a class="a-primary">预览</a>\n                                        <a class="a-success">下载</a>\n                                    ';
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
                            utils.setupEscClose(a);
                        },
                    });
                } else {
                    show.error("迅雷中找不到相关字幕!");
                }
            })
            .catch((e) => {
                console.error(e);
                show.error(e);
            })
            .finally(() => {
                t.close();
            });
    }
    async filterOne(e, t) {
        if (e) {
            e.preventDefault();
        }
        let n = this.getPageInfo();
        if (t) {
            await storageManager.saveCar({
                carNum: n.carNum,
                url: n.url,
                names: n.actress,
                actionType: d,
                publishTime: n.publishTime,
            });
            this.showStatus(n.carNum).then();
            window.refresh();
            utils.closePage();
            layer.closeAll();
            this.answerCount = 1;
        } else {
            utils.q(
                e,
                `是否屏蔽${n.carNum}?`,
                async () => {
                    await storageManager.saveCar({
                        carNum: n.carNum,
                        url: n.url,
                        names: n.actress,
                        actionType: d,
                        publishTime: n.publishTime,
                    });
                    this.showStatus(n.carNum).then();
                    window.refresh();
                    utils.closePage();
                },
                () => {
                    this.answerCount = 1;
                },
            );
        }
    }
    speedVideo() {
        if ($("#preview-video").is(":visible")) {
            const e = document.getElementById("preview-video");
            if (e) {
                e.muted = false;
                e.controls = false;
                if (e.currentTime + 5 < e.duration) {
                    e.currentTime += 5;
                } else {
                    show.info("预览视频结束, 已回到开头");
                    e.currentTime = 1;
                }
            }
            return;
        }
        const e = $('iframe[id^="layui-layer-iframe"]');
        if (e.length > 0) {
            e[0].contentWindow.postMessage("speedVideo", "*");
            return;
        }
        let t = $(".preview-video-container");
        if (t.length > 0) {
            t[0].click();
            const e = document.getElementById("preview-video");
            if (e) {
                e.currentTime += 5;
                e.muted = false;
            }
        } else {
            $("#javTrailersBtn").click();
        }
    }
    hideVideoControls() {
        $(document).on("mouseenter", "#preview-video", function () {
            $(this).prop("controls", true);
        });
    }
    async bindHotkey() {
        const e = {};
        if (this.filterHotKey) {
            e[this.filterHotKey] = () => {
                if (this.answerCount >= 2) {
                    this.filterOne(null, true);
                } else {
                    this.filterOne(null);
                }
                this.answerCount++;
            };
        }
        if (this.favoriteHotKey) {
            e[this.favoriteHotKey] = () => this.favoriteOne(null);
        }
        if (this.hasWatchHotKey) {
            e[this.hasWatchHotKey] = () => this.hasWatchOne();
        }
        if (this.speedVideoHotKey) {
            e[this.speedVideoHotKey] = () => this.speedVideo();
        }
        const t = (e, t) => {
            se.registerHotkey(e, (n) => {
                const a = document.activeElement;
                if (
                    a.tagName !== "INPUT" &&
                    a.tagName !== "TEXTAREA" &&
                    !a.isContentEditable
                ) {
                    if (window.isDetailPage) {
                        t();
                    } else {
                        ((e) => {
                            const t = $(".layui-layer-content iframe");
                            if (t.length !== 0) {
                                t[0].contentWindow.postMessage(e, "*");
                            }
                        })(e);
                    }
                }
            });
        };
        if (window.isDetailPage) {
            window.addEventListener("message", (t) => {
                if (e[t.data]) {
                    e[t.data]();
                }
            });
        }
        Object.entries(e).forEach(([e, n]) => {
            t(e, n);
        });
    }
    async previewSubtitle(e, t) {
        if (!e) {
            console.error("未提供文件URL");
            return;
        }
        const n = e.split(".").pop().toLowerCase();
        if (n === "ass" || n === "srt") {
            try {
                let a = await gmHttp.get(e);
                let i = "字幕预览";
                if (n === "ass") {
                    i = "ASS字幕预览 - " + t;
                } else if (n === "srt") {
                    i = "SRT字幕预览 - " + t;
                }
                const s = a.split("\n");
                let o = "";
                const r = String(s.length).length;
                s.forEach((e, t) => {
                    const n = String(t + 1).padStart(r, " ");
                    o += `<span style="color:#AAA;">${n}. </span>${e}\n`;
                });
                const l = o;
                layer.open({
                    type: 1,
                    title: i,
                    area: ["80%", "80%"],
                    scrollbar: false,
                    content: `<div style="padding:15px 5px;background:#1E1E1E;color:#FFF;font-family:Consolas,Monaco,monospace;white-space:pre-wrap;overflow:auto;height:100%;">${l}</div>`,
                    btn: ["下载", "关闭"],
                    btn1: function (e, n, i) {
                        utils.download(a, t);
                        return false;
                    },
                });
            } catch (a) {
                show.error(`预览失败: ${a.message}`);
                console.error("预览字幕文件出错:", a);
            }
        } else {
            show.error("仅支持预览ASS和SRT字幕文件");
        }
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
