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
class HistoryPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "tableObj", null);
    }
    getName() {
        return "HistoryPlugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 下拉菜单容器（相对定位） */\n                .sub-btns {\n                    position: relative;\n                    display: inline-block;\n                }\n                \n                /* 下拉菜单内容（默认隐藏） */\n                .sub-btns-menu {\n                    display: none;\n                    position: absolute;\n                    right: 80px;\n                    top:-10px;\n                    background: white;\n                    padding:10px;\n                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);\n                    z-index: 100;\n                    border-radius: 4px;\n                    overflow: hidden;\n                }\n                \n                \n                /* 点击后显示菜单（JS 控制） */\n                .sub-btns-menu.show {\n                    display: flex !important;\n                    flex-direction: column;\n                }\n                \n                .table-link-param {\n                    cursor: pointer;\n                }\n            </style\n        ";
    }
    handleResize() {
        if ($(".navbar-search").is(":hidden")) {
            $(".historyBtnBox").show();
            $(".miniHistoryBtnBox").hide();
        } else {
            $(".historyBtnBox").hide();
            $(".miniHistoryBtnBox").show();
        }
    }
    handle() {
        if (r) {
            $(".navbar-end").prepend(
                '<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <a id="historyBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-right:15px !important;">\n                        鉴定记录\n                    </a>\n                </div>',
            );
            $(".navbar-search")
                .css("margin-left", "0")
                .before(
                    '\n                <div class="navbar-item miniHistoryBtnBox">\n                    <a id="miniHistoryBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-left:0 !important;padding-right:0 !important;">\n                        鉴定记录\n                    </a>\n                </div>\n            ',
                );
            this.handleResize();
            $(window).resize(() => {
                this.handleResize();
            });
            $("#historyBtn,#miniHistoryBtn").on("click", (e) =>
                this.openHistory(),
            );
        }
        if (l) {
            utils.loopDetector(
                () => $("#setting-btn").length,
                () => {
                    $("#top-right-box").append(
                        '\n                    <a id="historyBtn" class="menu-btn main-tab-btn" style="background-color:#b68625 !important;">\n                        鉴定记录\n                    </a>\n               ',
                    );
                    $("#historyBtn,#miniHistoryBtn").on("click", (e) =>
                        this.openHistory(),
                    );
                },
                1,
                10000,
                false,
            );
        }
        this.bindClick();
    }
    openHistory() {
        let e = `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div id="filterBox" style="display: flex;gap: 5px;">\n                    <select id="dataType" style="text-align: center;min-width: 150px;">\n                        <option value="all" selected>所有</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" style="padding: 4px 5px;">\n                    <a id="clearSearchbtn" class="a-info" style="margin-left: 0">重置</a>\n                </div>\n                <div id="allSelectBox" style="margin-top: 8px;display: none">\n                    <a class="menu-btn multiple-history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                    <a class="menu-btn multiple-history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                    <a class="menu-btn multiple-history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                    <a class="menu-btn multiple-history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px); overflow-x:hidden;"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "鉴定记录",
            content: e,
            scrollbar: false,
            shadeClose: true,
            area: utils.getResponsiveArea(["70%", "90%"]),
            anim: -1,
            success: async (e) => {
                await this.loadTableData();
                $(".layui-layer-content")
                    .on("click", "#clearSearchbtn", async (e) => {
                        $("#searchCarNum").val("");
                        $("#dataType").val("all");
                        await this.reloadTable();
                        $("#allSelectBox").hide();
                    })
                    .on("focusout keydown", "#searchCarNum", async (e) => {
                        if (e.type === "focusout" || e.key === "Enter") {
                            if (e.key === "Enter") {
                                e.preventDefault();
                            }
                            if (e.type === "keydown" && e.key !== "Enter") {
                                return;
                            }
                            await this.reloadTable();
                        }
                    })
                    .on("click", ".table-link-param", async (e) => {
                        let t = $(e.currentTarget);
                        $("#searchCarNum").val(t.text());
                        await this.reloadTable();
                    })
                    .on("change", "#dataType", async () => {
                        await this.reloadTable();
                    });
            },
            end: () => {
                if (this.tableObj) {
                    this.tableObj.destroy();
                    this.tableObj = null;
                }
                window.refresh();
            },
        });
    }
    async reloadTable() {
        this.tableObj.deselectRow();
        this.tableObj.setPage(1);
    }
    bindClick() {
        document.addEventListener("click", function (e) {
            if (e.target.closest(".sub-btns-toggle")) {
                const t = e.target
                    .closest(".sub-btns")
                    .querySelector(".sub-btns-menu");
                document
                    .querySelectorAll(".sub-btns-menu.show")
                    .forEach((e) => {
                        if (e !== t) {
                            e.classList.remove("show");
                        }
                    });
                t.classList.toggle("show");
            } else {
                document
                    .querySelectorAll(".sub-btns-menu.show")
                    .forEach((e) => {
                        e.classList.remove("show");
                    });
            }
        });
        $(document).on(
            "click",
            ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasWatchBtn, .history-detailBtn",
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                const t = $(e.currentTarget);
                const n = t.closest(".action-btns");
                const a = n.attr("data-car-num");
                const i = n.attr("data-href");
                const s = async (e) => {
                    await storageManager.saveCar({
                        carNum: a,
                        url: i,
                        names: null,
                        actionType: e,
                    });
                    window.refresh();
                    await this.reloadTable();
                };
                if (t.hasClass("history-filterBtn")) {
                    utils.q(e, `是否屏蔽${a}?`, () => s(d));
                } else if (t.hasClass("history-favoriteBtn")) {
                    s(h).then();
                } else if (t.hasClass("history-hasWatchBtn")) {
                    s(p).then();
                } else if (t.hasClass("history-deleteBtn")) {
                    this.handleDelete(e, a);
                } else if (t.hasClass("history-detailBtn")) {
                    this.handleClickDetail(e, {
                        carNum: a,
                        url: i,
                    }).then();
                }
            },
        );
        $(document).on(
            "click",
            ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasWatchBtn",
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                const t = $(e.currentTarget);
                let n = this.tableObj.getSelectedData();
                let a = "";
                let i = "";
                if (t.hasClass("multiple-history-filterBtn")) {
                    a = "屏蔽";
                    i = d;
                } else if (t.hasClass("multiple-history-favoriteBtn")) {
                    a = "收藏";
                    i = h;
                } else if (t.hasClass("multiple-history-hasWatchBtn")) {
                    a = "已观看";
                    i = p;
                } else if (t.hasClass("multiple-history-deleteBtn")) {
                    a = "移除";
                    i = "delete";
                }
                utils.q(
                    e,
                    `当前已勾选${n.length}条数据, 是否全标记为 ${a}?`,
                    async () => {
                        let e = loading();
                        try {
                            if (i === "delete") {
                                const e = n.map((e) => e.carNum);
                                const t =
                                    await storageManager.batchRemoveCars(e);
                                if (t > 0) {
                                    show.ok(`已成功删除 ${t} 个番号`);
                                } else if (t === false) {
                                    show.error(
                                        "提供的番号中没有一个存在于列表中。",
                                    );
                                }
                            } else {
                                const e = JSON.parse(JSON.stringify(n));
                                e.forEach((e) => {
                                    e.actionType = i;
                                });
                                await storageManager.saveCarList(e);
                                show.ok("操作成功");
                            }
                            this.tableObj.deselectRow();
                            this.reloadTable().then();
                        } catch (t) {
                            console.error(t);
                        } finally {
                            e.close();
                        }
                    },
                );
            },
        );
    }
    async getDataList(e, t, n) {
        let a = await storageManager.getCarList();
        this.allCount = a.length;
        this.filterCount = 0;
        this.favoriteCount = 0;
        this.hasWatchCount = 0;
        a.forEach((e) => {
            switch (e.status) {
                case d:
                    this.filterCount++;
                    break;
                case h:
                    this.favoriteCount++;
                    break;
                case p:
                    this.hasWatchCount++;
            }
        });
        $('#dataType option[value="all"]').text(`所有 (${this.allCount})`);
        $('#dataType option[value="filter"]').text(
            `${u} (${this.filterCount})`,
        );
        $('#dataType option[value="favorite"]').text(
            `${b} (${this.favoriteCount})`,
        );
        $('#dataType option[value="hasWatch"]').text(
            `${k} (${this.hasWatchCount})`,
        );
        const i = $("#dataType").val();
        let s = i === "all" ? a : a.filter((e) => e.status === i);
        const o = $("#searchCarNum").val().trim();
        if (o) {
            let e = o
                .toLowerCase()
                .replace("-c", "")
                .replace("-uc", "")
                .replace("-4k", "");
            s = s.filter((t) => {
                const n = t.carNum.toLowerCase().includes(e);
                const a = (t.names ? t.names : "").toLowerCase().includes(e);
                return n || a;
            });
        }
        if (n && n.length > 0) {
            const e = n[0];
            const t = e.field;
            const a = e.dir;
            s.sort((e, n) => {
                const i = e[t];
                const s = n[t];
                const o = i == null || i === "";
                const r = s == null || s === "";
                if (o && !r) {
                    return 1;
                } else if (!o && r) {
                    return -1;
                } else if (o && r) {
                    return 0;
                } else if (i < s) {
                    if (a === "asc") {
                        return -1;
                    } else {
                        return 1;
                    }
                } else if (i > s) {
                    if (a === "asc") {
                        return 1;
                    } else {
                        return -1;
                    }
                } else {
                    return 0;
                }
            });
        }
        const r = s.length;
        const l = Math.ceil(r / t);
        const c = (e - 1) * t;
        const m = c + t;
        s = s.slice(c, m);
        return {
            maxPage: l,
            dataList: s,
            totalCount: r,
        };
    }
    async loadTableData() {
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: true,
            pagination: true,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: false,
            ajaxRequestFunc: async (e, t, n) => {
                const a = n.page;
                const i = n.size;
                const s = n.sort;
                return await this.getDataList(a, i, s);
            },
            dataReceiveParams: {
                last_page: "maxPage",
                last_row: "totalCount",
                data: "dataList",
            },
            paginationSize: 50,
            paginationSizeSelector: [50, 100, 1000, 99999],
            paginationCounter: (e, t, n, a, i) => `共 ${a} 条记录`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: true,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center",
            },
            selectableRowsPersistence: false,
            index: "carNum",
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "center",
                    headerSort: false,
                    responsive: 0,
                    width: 40,
                    titleFormatterParams: {
                        rowRange: "active",
                    },
                    cellClick: (e, t) => {
                        t.getRow().toggleSelect();
                    },
                },
                {
                    title: "番号",
                    field: "carNum",
                    width: 120,
                    sorter: "string",
                    responsive: 0,
                    formatter: (e, t, n) => {
                        const a = e.getData().carNum;
                        const i = a.indexOf("-");
                        if (i === -1) {
                            return a;
                        }
                        return `<a class="table-link-param">${a.substring(0, i + 1)}</a>${a.substring(i + 1)}`;
                    },
                },
                {
                    title: "演员",
                    field: "names",
                    minWidth: 200,
                    sorter: "string",
                    responsive: 5,
                    headerSort: true,
                    formatter: (e, t, n) =>
                        (e.getData().names || "")
                            .split(" ")
                            .filter((e) => e.trim() !== "")
                            .map((e) => `<a class="table-link-param">${e}</a>`)
                            .join(" "),
                },
                {
                    title: "创建时间",
                    field: "createDate",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "修改时间",
                    field: "updateDate",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "发行时间",
                    field: "publishTime",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "来源",
                    field: "url",
                    width: 80,
                    sorter: "string",
                    responsive: 5,
                    hozAlign: "left",
                    formatter: (e, t, n) => {
                        let a = e.getData().url;
                        if (a) {
                            if (a.includes("javdb")) {
                                return '<span style="color:#d34f9e">Javdb</span>';
                            } else if (a.includes("javbus")) {
                                return '<span style="color:#eaa813">JavBus</span>';
                            } else if (a.includes("123av")) {
                                return '<span style="color:#eaa813">123Av</span>';
                            } else {
                                return `<span style="color:#050505">${a}</span>`;
                            }
                        } else {
                            return "";
                        }
                    },
                },
                {
                    title: "状态",
                    field: "status",
                    width: 100,
                    sorter: "string",
                    responsive: 1,
                    headerSort: false,
                    formatter: (e, t, n) => {
                        const a = e.getData().status;
                        let i = "";
                        let s = "";
                        switch (a) {
                            case "filter":
                                i = f;
                                s = m;
                                break;
                            case "favorite":
                                i = w;
                                s = v;
                                break;
                            case "hasWatch":
                                i = S;
                                s = k;
                                break;
                            default:
                                s = a;
                        }
                        return `<span style="color:${i}">${s}</span>`;
                    },
                },
                {
                    title: "备注",
                    field: "remark",
                    width: 100,
                    sorter: "string",
                    responsive: 6,
                },
                {
                    title: "操作",
                    sorter: "string",
                    minWidth: 150,
                    cssClass: "action-cell-dropdown",
                    responsive: 0,
                    headerSort: false,
                    formatter: (e, t, n) => {
                        const a = e.getData();
                        n(() => {
                            var t;
                            if (
                                (t = e
                                    .getElement()
                                    .querySelector(".history-editBtn")) != null
                            ) {
                                t.addEventListener("click", (e) => {
                                    this.editRecord(a);
                                });
                            }
                        });
                        return `\n                            <div class="action-btns" style="display: flex; gap: 5px;justify-content:center" data-car-num="${a.carNum}" data-href="${a.url ? a.url : ""}">\n                                <div class="sub-btns">\n                                    <a class="menu-btn sub-btns-toggle" style="background-color:#c59d36; color:white; margin-bottom: 5px;">\n                                        <span>✏️ 变更</span>\n                                    </a>\n                                    <div class="sub-btns-menu">\n                                        <a class="menu-btn history-editBtn" style="background-color:#007bff; color:white; margin-bottom: 5px;"> <span>✏️ 编辑</span> </a>\n                                        <a class="menu-btn history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                                        <a class="menu-btn history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                                        <a class="menu-btn history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                                        <a class="menu-btn history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                                    </div>\n                                </div>\n                                \n                                <a class="menu-btn history-detailBtn" style="background-color:#3397de; color:white; margin-bottom: 5px;"> <span>📄 详情页</span> </a>\n                                \n                            </div>\n                        `;
                    },
                },
            ],
            initialSort: [
                {
                    column: "updateDate",
                    dir: "desc",
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
        this.tableObj.on("rowSelectionChanged", (e, t, n, a) => {
            const i = $("#allSelectBox");
            const s = $("#filterBox");
            if (e && e.length > 0) {
                s.hide();
                i.show();
            } else {
                s.show();
                i.hide();
            }
        });
        this.tableObj.on("rowDblClick", function (e, t) {
            t.toggleSelect();
        });
        this.tableObj.on("tableBuilt", async () => {});
    }
    handleDelete(e, t) {
        utils.q(e, `是否移除${t}?`, async () => {
            await storageManager.removeCar(t);
            this.getBean("ListPagePlugin").showCarNumBox(t);
            this.reloadTable(null).then();
        });
    }
    async handleClickDetail(e, t) {
        if (r) {
            if (t.carNum.includes("FC2-")) {
                const e = this.parseMovieId(t.url);
                this.getBean("Fc2Plugin")?.openFc2Dialog(e, t.carNum, t.url);
            } else {
                if (!t.url) {
                    window.open("/search?q=" + t.carNum, "_blank");
                    return;
                }
                utils.openPage(t.url, t.carNum, false, e);
            }
        }
        if (l) {
            let n = t.url;
            if (n.includes("javdb")) {
                if (t.carNum.includes("FC2-")) {
                    const e = this.parseMovieId(n);
                    await this.getBean("Fc2Plugin")?.openFc2Page(
                        e,
                        t.carNum,
                        n,
                    );
                } else {
                    window.open(n, "_blank");
                }
            } else {
                utils.openPage(t.url, t.carNum, false, e);
            }
        }
    }
    async editRecord(e) {
        const t = e.carNum;
        const n = e.names || "";
        const a = e.url || "";
        const i = e.status;
        const s = e.remark || "";
        const o =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;";
        const r =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;";
        const l = [
            {
                value: d,
                text: m,
            },
            {
                value: h,
                text: v,
            },
            {
                value: p,
                text: k,
            },
        ];
        console.log(l);
        const c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">番号:</label>\n                    <input type="text" id="edit-carNum" value="${t}" style="${r} background-color: #f0f0f0;" readonly>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" style="${o}">${n}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">状态:</label>\n                    <select id="edit-status" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${i === "" ? "selected" : ""}>-- 请选择 --</option>\n                        ${l.map((e) => `\n                            <option value="${e.value}" ${i === e.value ? "selected" : ""}>${e.text}</option>\n                        `).join("")}\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">链接:</label>\n                    <input type="text" id="edit-url" value="${a}" style="${r}">\n                </div>\n                \n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                    <textarea id="edit-remark" style="${o}">${s}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑记录: ${t}`,
            area: ["500px", "650px"],
            content: c,
            btn: ["保存", "取消"],
            success: (e, t) => {
                const n = (e) => {
                    e.css("height", "auto");
                    e.css("height", e[0].scrollHeight + 15 + "px");
                };
                const a = $("#edit-names");
                a.on("input", function () {
                    n($(this));
                });
                n(a);
                const i = $("#edit-remark");
                i.on("input", function () {
                    n($(this));
                });
                n(i);
            },
            yes: async (t) => {
                const n = $("#edit-names").val().trim();
                const a = $("#edit-status").val();
                const i = $("#edit-url").val().trim();
                const s = $("#edit-remark").val().trim();
                const o = {
                    ...e,
                    names: n,
                    actionType: a,
                    url: i,
                    remark: s,
                };
                await storageManager.updateCarInfo(o);
                this.tableObj.setData();
                layer.close(t);
            },
        });
    }
}
class BlacklistPlugin extends BasePlugin {
    getName() {
        return "BlacklistPlugin";
    }
    async addBlacklist(e) {
        let t = {
            clientX: e.clientX,
            clientY: e.clientY + 80,
        };
        const n = $("#addBlacklistBtn span").text().includes("已加入");
        let a;
        let i;
        if (o.includes("/tags")) {
            const e = new URL(o);
            e.searchParams.delete("page");
            const t = $("#jhs-check-tag").text().trim();
            a = {
                starId: "no-" + t,
                name: "虚拟演员-" + t,
                allName: ["虚拟演员"],
                role: "虚拟演员",
                movieType: t,
                blacklistUrl: e.toString(),
            };
            i = `是否将分类 <span style="color: #f40">${t}</span> 加入到黑名单中?`;
            if (n) {
                i = `分类 <span style="color: #f40">${t}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
            }
        } else {
            a = this.getActressPageInfo();
            i = `是否将该演员 <span style="color: #f40">${a.name}</span> 加入到黑名单中?`;
            if (n) {
                i = `演员 <span style="color: #f40">${a.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
            }
        }
        const {
            starId: s,
            name: r,
            allName: c,
            role: d,
            movieType: h,
            blacklistUrl: g,
        } = a;
        if (o.includes("page") && !o.includes("page=1")) {
            i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
        }
        if (l) {
            const e = o.split("/star/")[1].split("/");
            if (e.length > 1) {
                if (parseInt(e[1]) > 1) {
                    i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
                }
            }
        }
        utils.q(t, i, async () => {
            navigator.locks
                .request(
                    "checkNewActressActorFilterCar",
                    {
                        ifAvailable: true,
                    },
                    async (e) => {
                        clog.debug("获取锁", e);
                        if (e) {
                            this.loadObj = loading();
                            try {
                                await storageManager.addBlacklistItem({
                                    starId: s,
                                    name: r,
                                    allName: c,
                                    role: d,
                                    movieType: h,
                                    url: g,
                                });
                                await this.filterActorVideo(r, s);
                                const e = show.ok(
                                    `屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`,
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            e.closeShow();
                                            window.location.href =
                                                this.lastPageLink;
                                        },
                                    },
                                );
                            } catch (t) {
                                clog.error(t);
                                const e = show.error(
                                    "发生错误, 是否填转到解析失败的那一页? (点击并跳转)",
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            e.closeShow();
                                            window.location.href =
                                                this.nextPageLink;
                                        },
                                    },
                                );
                            } finally {
                                this.loadObj.close();
                            }
                        } else {
                            show.error(
                                "当前有定时任务在后台执行中, 无法发起此操作",
                            );
                        }
                    },
                )
                .catch((e) => {
                    console.error("锁任务出现错误:", e);
                    clog.error("锁任务出现错误:", e);
                });
        });
    }
    async resetBtnTip() {
        this.checkBlacklist_ruleTime = await storageManager.getSetting(
            "checkBlacklist_ruleTime",
            8760,
        );
    }
    async openBlacklistDialog() {
        let n = `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div style="display: flex;justify-content: space-between;">\n                    <div style="display: flex; gap:5px">\n                    </div>\n                    <div style="display: flex; gap:5px">\n                        <select id="dataType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>所有</option>\n                            <option value="actor">男演员</option>\n                            <option value="actress">女演员</option>\n                        </select>\n                        <select id="statusType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>--检测状态--</option>\n                            <option value="normal">正常检测</option>\n                            <option value="stop">停止检测</option>\n                        </select>\n                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" style="text-align: center;min-width: 150px; ${r ? "" : "display: none;"}">\n                            <option value="" selected>--屏蔽类型--</option>\n                            <option value="hasT">按所选分类屏蔽</option>\n                            <option value="noT">未筛选分类</option>\n                        </select>\n                        <input id="searchValue" type="text" placeholder="搜索演员" style="padding: 4px 5px;">\n                        <a id="cleanQueryBtn" class="a-info" style="margin-left: 0">重置</a>\n                    </div>\n\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px);"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "演员黑名单",
            content: n,
            scrollbar: false,
            area: utils.getResponsiveArea(["80%", "90%"]),
            anim: -1,
            success: async (t) => {
                await this.loadTableData();
                $(".layui-layer-content")
                    .on("click", "#cleanQueryBtn", async (e) => {
                        $("#searchValue").val("");
                        $("#dataType").val("");
                        $("#statusType").val("");
                        await this.reloadTable();
                    })
                    .on("focusout keydown", "#searchValue", async (e) => {
                        if (e.type === "focusout" || e.key === "Enter") {
                            if (e.key === "Enter") {
                                e.preventDefault();
                            }
                            if (e.type === "keydown" && e.key !== "Enter") {
                                return;
                            }
                            $("#dataType").val("");
                            await this.reloadTable();
                        }
                    })
                    .on("change", "#dataType", async () => {
                        $("#searchValue").val("");
                        await this.reloadTable();
                    })
                    .on("change", "#statusType", async () => {
                        await this.reloadTable();
                    })
                    .on("change", "#urlType", async () => {
                        await this.reloadTable();
                    })
                    .on("click", ".open-url", (e) => {
                        e.preventDefault();
                        const t = $(e.currentTarget);
                        const n = t.attr("data-url");
                        const a = t.attr("data-name");
                        utils.openPage(n, a, true, e);
                    });
            },
            end: () => {
                if (this.tableObj) {
                    this.tableObj.destroy();
                    this.tableObj = null;
                }
                window.refresh();
            },
        });
    }
    async reloadTable() {
        if (!this.tableObj) {
            return;
        }
        const e = await this.getTableData();
        this.tableObj.setData(e);
    }
    async getTableData() {
        const t = await storageManager.getBlacklist();
        const n = await storageManager.getBlacklistCarList();
        const a = $("#searchValue").val();
        const i = $("#statusType").val();
        const s = $("#dataType");
        const o = s.val();
        const r = $("#urlType").val();
        const l = t.length;
        let c = 0;
        let d = 0;
        const h = t
            .map((t) => {
                if (t.role === B) {
                    c++;
                } else if (t.role === P) {
                    d++;
                }
                let n = false;
                if (t.lastPublishTime) {
                    n = !utils.isUnnecessaryCheck(
                        t.lastPublishTime,
                        this.checkBlacklist_ruleTime,
                    );
                }
                return {
                    ...t,
                    isUnCheck: n,
                };
            })
            .filter(
                (e) =>
                    (!a || !!e.name.includes(a)) &&
                    (i !== "normal" || !e.isUnCheck) &&
                    (i !== "stop" || !!e.isUnCheck) &&
                    (o
                        ? e.role === o
                        : (r !== "hasT" || !!e.url.includes("t=")) &&
                          (r !== "noT" || !e.url.includes("t="))),
            );
        s.html(
            `\n            <option value="">所有 (${l})</option>\n            <option value="actor">男演员 (${c})</option>\n            <option value="actress">女演员 (${d})</option>\n        `,
        );
        s.val(o);
        const g = new Map();
        for (const m of n) {
            const e = m.starId;
            if (!g.has(e)) {
                g.set(e, []);
            }
            g.get(e).push(m);
        }
        const p = h.map((e) => {
            const t = e.starId;
            const n = g.get(t) || [];
            return {
                ...e,
                carList: n,
                count: n.length,
            };
        });
        this.currentCarCount = p.reduce((e, t) => e + (t.count || 0), 0);
        return p;
    }
    async loadTableData() {
        this.checkBlacklist_ruleTime =
            (await storageManager.getSetting("checkBlacklist_ruleTime")) ||
            8760;
        const e = await this.getTableData();
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: true,
            data: e,
            pagination: true,
            paginationMode: "local",
            paginationSize: 20,
            paginationSizeSelector: [20, 50, 100, 1000, 99999],
            paginationCounter: (e, t, n, a, i) =>
                `演员: ${a} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" style="margin-left: 10px"></span>`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: true,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center",
            },
            index: "starId",
            columns: [
                {
                    title: "演员",
                    field: "name",
                    sorter: "string",
                    minWidth: 100,
                    responsive: 0,
                    headerSort: false,
                    formatter: (e, t, n) => {
                        const a = e.getData();
                        return `<a class="open-url" data-url="${a.url}" href="${a.url}" data-name="${a.name}" target="_blank">${a.name}</a>`;
                    },
                },
                {
                    title: "性别角色",
                    field: "role",
                    sorter: "string",
                    width: 120,
                    responsive: 5,
                    formatter: (e, t, n) => {
                        const a = e.getData().role;
                        let i = a;
                        if (a === B) {
                            i = "男演员";
                        } else if (a === P) {
                            i = "女演员";
                        }
                        return i;
                    },
                },
                {
                    title: "影视类别",
                    field: "movieType",
                    sorter: "string",
                    width: 120,
                    responsive: 5,
                    formatter: (e, t, n) => {
                        const a = e.getData().movieType;
                        let i = a;
                        if (a === D) {
                            i = "有码";
                        } else if (a === A) {
                            i = "无码";
                        }
                        return i;
                    },
                },
                {
                    title: "屏蔽类型",
                    field: "url",
                    sorter: "string",
                    minWidth: 120,
                    responsive: 4,
                    visible: r,
                    formatter: (e, t, n) => {
                        let a = e.getData().url.includes("t=");
                        return `<span style="${a ? "color:#cc4444" : ""}">${a ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
                    },
                },
                {
                    title: "番号数量",
                    field: "count",
                    sorter: "number",
                    width: 170,
                    responsive: 1,
                },
                {
                    title: "创建时间",
                    field: "createTime",
                    sorter: "string",
                    width: 170,
                    responsive: 5,
                },
                {
                    title: "最后发行时间",
                    field: "lastPublishTime",
                    sorter: "string",
                    width: 170,
                    responsive: 1,
                },
                {
                    title: "状态",
                    field: "isUnCheck",
                    sorter: "string",
                    width: 120,
                    responsive: 1,
                    formatter: (e, t, n) => {
                        let a = "";
                        let i = "正常检测";
                        if (e.getData().isUnCheck) {
                            a = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`;
                            i = "停止检测";
                        }
                        return `<span data-tip="${a}" style="${a ? "color: #cc4444;" : ""}">${i}</span>`;
                    },
                },
                {
                    title: "操作",
                    sorter: "string",
                    cssClass: "action-cell-dropdown",
                    minWidth: 150,
                    responsive: 0,
                    headerSort: false,
                    formatter: (e, t, n) => {
                        const a = e.getData();
                        n(() => {
                            var t;
                            var n;
                            if (
                                (t = e
                                    .getElement()
                                    .querySelector(".delete-btn")) != null
                            ) {
                                t.addEventListener("click", (e) => {
                                    const t = a.name;
                                    const n = a.starId;
                                    if (t) {
                                        if (n) {
                                            utils.q(
                                                e,
                                                `是否移除对 ${t} 的屏蔽?`,
                                                async () => {
                                                    await storageManager.removeBlacklistCarList(
                                                        n,
                                                    );
                                                    await storageManager.deleteBlacklistItem(
                                                        n,
                                                    );
                                                    show.info("操作成功");
                                                    this.reloadTable().then();
                                                },
                                            );
                                        } else {
                                            show.error("获取starId失败");
                                        }
                                    } else {
                                        show.error("获取名称失败");
                                    }
                                });
                            }
                            if (
                                (n = e
                                    .getElement()
                                    .querySelector(".keyword-btn")) != null
                            ) {
                                n.addEventListener("click", (e) => {
                                    const t = a.carList.reduce((e, t) => {
                                        const n = t.carNum.split("-")[0] + "-";
                                        e[n] = (e[n] || 0) + 1;
                                        return e;
                                    }, {});
                                    const n = Object.entries(t)
                                        .map(([e, t]) => ({
                                            prefix: e,
                                            count: t,
                                        }))
                                        .sort((e, t) => t.count - e.count);
                                    console.log(n);
                                });
                            }
                        });
                        return '\n                           <!-- <a class="a-normal keyword-btn"> <span>提取屏蔽词</span> </a>-->\n                            <a class="a-danger delete-btn"> <span>✂️ 删除</span> </a>\n                        ';
                    },
                },
            ],
            initialSort: [
                {
                    column: "createTime",
                    dir: "desc",
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
    }
    getCurrentStarUrl() {
        let e = window.location.href.replace(
            /([&?])sort_type=[^&]+(&|$)/,
            "$1",
        );
        e = e.replace(/[&?]$/, "");
        e = e.replace(/\?&/, "?");
        let t = e;
        t = t.replace(/([&?])page=\d+(&|$)/, "$1");
        t = t.replace(/[&?]$/, "");
        t = t.replace(/\?&/, "?");
        t = t.replace(/\/(\d+)(?:\/(\d+))?(\?|$)/, (e, t, n, a) =>
            n !== undefined ? `/${t}${a}` : e,
        );
        return t;
    }
    parseUrlId(e) {
        if (!e) {
            throw new Error("url未传入");
        }
        return new URL(e).pathname
            .split("/")
            .filter((e) => e.trim() !== "")
            .pop();
    }
    async filterAllVideo(e, t) {
        let n;
        let a;
        if (t) {
            if (l && t.find(".avatar-box").length > 0) {
                t.find(".avatar-box").parent().remove();
            }
            n = t.find(this.getSelector().requestDomItemSelector);
            a = t.find(this.getSelector().nextPageSelector).attr("href");
        } else {
            n = $(this.getSelector().itemSelector);
            a = $(this.getSelector().nextPageSelector).attr("href");
        }
        if (a && n.length === 0) {
            show.error("解析列表失败");
            throw new Error("解析列表失败");
        }
        for (const s of n) {
            const t = $(s);
            const {
                carNum: n,
                url: a,
                publishTime: o,
            } = this.getBean("ListPagePlugin").findCarNumAndHref(t);
            if (a && n) {
                try {
                    if (await storageManager.getCar(n)) {
                        continue;
                    }
                    await storageManager.saveCar({
                        carNum: n,
                        url: a,
                        names: e,
                        actionType: d,
                        publishTime: o,
                    });
                    clog.log("屏蔽演员番号", e, n);
                } catch (i) {
                    console.error(`保存失败 [${n}]:`, i);
                }
            }
        }
        if (a) {
            show.info("请不要关闭窗口, 正在解析下一页:" + a);
            await new Promise((e) => setTimeout(e, 500));
            const t = await gmHttp.get(a);
            const n = new DOMParser();
            const i = $(n.parseFromString(t, "text/html"));
            await this.filterAllVideo(e, i);
        } else {
            show.ok("执行结束!");
            window.refresh();
        }
    }
    async filterActorVideo(e, t, n) {
        let { nextPageLink: a } = await this.parseAndSaveFilterInfo(n, e, t);
        this.nextPageLink = a;
        if (a) {
            let n;
            this.lastPageLink = a;
            show.info("请不要关闭窗口, 正在解析下一页:" + a);
            const i = utils.getUrlParam(a, "page") || 0;
            const s = this.getBean("Beyond60Plugin");
            if (r && s && i > 60) {
                let {
                    html: e,
                    nextUrl: t,
                    hasMore: i,
                } = await s.handleBeyond60(a);
                let o = `\n                    <div class ='movie-list'>${e}</div>\n                    ${t ? `<a class="pagination-next" href="${t}"></a>` : ""}\n                `;
                n = utils.htmlTo$dom(o);
            } else {
                clog.log("正在请求下一页内容:", a);
                const e = await gmHttp.get(a);
                n = utils.htmlTo$dom(e);
            }
            await this.filterActorVideo(e, t, n);
        } else {
            show.ok("执行结束!");
            window.refresh();
        }
    }
    async parseAndSaveFilterInfo(e, t, n) {
        let a;
        let i;
        if (e) {
            let t = false;
            let n = T;
            if (e.text().includes(I)) {
                t = true;
                n = I;
            }
            if (t && e.find(".avatar-box").length > 0) {
                e.find(".avatar-box").parent().remove();
            }
            a = e.find(this.getSelector(n).requestDomItemSelector);
            i = e.find(this.getSelector(n).nextPageSelector).attr("href");
        } else {
            a = $(this.getSelector().itemSelector);
            i = $(this.getSelector().nextPageSelector).attr("href");
        }
        if (i && a.length === 0) {
            return {
                nextPageLink: null,
                lastPublishTime: null,
            };
        }
        let s = [];
        let o = null;
        for (const l of a) {
            const e = $(l);
            const {
                carNum: a,
                url: i,
                publishTime: r,
            } = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            o ||= r;
            if (i && a) {
                s.push({
                    carNum: a,
                    url: i,
                    names: t,
                    actionType: d,
                    starId: n,
                    publishTime: r,
                });
            }
        }
        try {
            await storageManager.batchSaveBlacklistCarList(s);
        } catch (r) {
            clog.error("保存失败:", r);
            console.error("保存失败:", r);
        }
        return {
            nextPageLink: i,
            lastPublishTime: o,
        };
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
class AutoPagePlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "preloadDistance", 500);
        i(this, "currentPage", this.getInitialPageNumber());
        i(this, "pageItems", []);
    }
    getName() {
        return "AutoPagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .jhs-scroll {\n                    text-align: center;\n                    padding-top: 20px;\n                    font-size: 14px;\n                }\n                .jhs-scroll.waterfall-loading { color: #000; }\n                .jhs-scroll.waterfall-error { color: #f44336; cursor: pointer; }\n                .jhs-scroll.waterfall-no-more { color: #4CAF50; }\n            </style>\n        ";
    }
    async handle() {
        this.waterfall().then();
    }
    getInitialPageNumber() {
        if (l) {
            const e = o.match(/\/(page|star\/[^/]+)\/(\d+)/);
            if (e) {
                return parseInt(e[2], 10);
            } else {
                return 1;
            }
        }
        if (r) {
            const e = o.match(/[?&]page=(\d+)/);
            if (e) {
                return parseInt(e[1], 10);
            } else {
                return 1;
            }
        }
        return 1;
    }
    async waterfall() {
        if (await this.shouldDisablePaging()) {
            return;
        }
        const e = this.getSelector();
        this.container = document.querySelector(e.boxSelector);
        if (!this.container) {
            console.error("没有找到容器节点,停止瀑布流!");
            return;
        }
        this.loader = document.createElement("div");
        this.loader.className = "jhs-scroll";
        this.container.parentNode.insertBefore(
            this.loader,
            this.container.nextSibling,
        );
        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href,
        });
        this.loader.addEventListener("click", () => {
            if (this.loader.classList.contains("waterfall-error")) {
                this.loadNextPage().then();
            }
        });
        window.addEventListener("scroll", () => {
            this.checkLoad();
            this.checkScrollPosition();
        });
        const t = document.querySelector(e.nextPageSelector);
        this.nextUrl = t == null ? undefined : t.href;
        this.hasMore = !!this.nextUrl;
        setTimeout(() => {
            this.checkLoad();
        }, 1000);
        if (!this.hasMore) {
            this.setState("waterfall-no-more", "已经到底了");
        }
    }
    async loadNextPage() {
        var e;
        if ((await storageManager.getSetting("autoPage", _)) === C) {
            this.setState("waterfall-loading", "");
            return;
        }
        if (this.isLoading || !this.nextUrl) {
            return;
        }
        this.isLoading = true;
        this.setState("waterfall-loading", "加载中...");
        const t = this.getSelector();
        try {
            const n = utils.getUrlParam(this.nextUrl, "page");
            let a = 60;
            if (o.includes("c11")) {
                a = 30;
            }
            if ((r && n > a) || o.includes("month")) {
                const e = this.getBean("Beyond60Plugin");
                if (e) {
                    const {
                        html: t,
                        nextUrl: a,
                        hasMore: i,
                    } = await e.handleBeyond60(this.nextUrl);
                    if (t) {
                        const e = this.container.scrollHeight;
                        this.pageItems.push({
                            page: this.currentPage + 1,
                            top: e,
                            url: this.nextUrl,
                        });
                        $(".movie-list").append(t);
                    }
                    this.hasMore = i;
                    this.nextUrl = a;
                    const s = e.createPagination(n, i);
                    $(".pagination").html(s);
                    this.setState("waterfall-loading", "");
                    if (!this.hasMore) {
                        this.setState("waterfall-no-more", "已经到底了");
                    }
                    return;
                }
            }
            const i = await gmHttp.get(this.nextUrl);
            clog.log("请求下一页内容:", this.nextUrl);
            const s = utils.htmlTo$dom(i);
            if (l && s.find(".avatar-box").length > 0) {
                s.find(".avatar-box").parent().remove();
            }
            let c = s.find(this.getSelector().requestDomItemSelector);
            const d = this.getBoxCarInfoList();
            const h = this.getBoxCarInfoList(c);
            if (this.checkDuplicateCarNumbers(d, h)) {
                this.nextUrl = null;
                this.hasMore = false;
                this.setState(
                    "waterfall-error",
                    "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流",
                );
                return;
            }
            const g = this.container.scrollHeight;
            this.pageItems.push({
                page: this.currentPage + 1,
                top: g,
                url: this.nextUrl,
            });
            const p = this.getBean("ListPagePlugin");
            let m = s.find(this.getSelector().coverImgSelector);
            p.replaceHdImg(m);
            $(this.getSelector().boxSelector).append(c);
            this.nextUrl =
                (e = s.find(t.nextPageSelector)) == null
                    ? undefined
                    : e.attr("href");
            this.hasMore = !!this.nextUrl;
            let u = s.find(".pagination");
            $(".pagination").replaceWith(u);
            this.setState("waterfall-loading", "");
            if (!this.hasMore) {
                this.setState("waterfall-no-more", "已经到底了");
            }
        } catch (n) {
            clog.error("加载失败:", n);
            this.setState("waterfall-error", "加载失败，点击重试");
        } finally {
            this.isLoading = false;
        }
    }
    checkScrollPosition() {
        const e = window.scrollY;
        for (let t = this.pageItems.length - 1; t >= 0; t--) {
            const n = this.pageItems[t];
            if (e >= n.top) {
                if (this.currentPage !== n.page) {
                    this.currentPage = n.page;
                    this.updatePageUrl(n.url);
                }
                break;
            }
        }
    }
    checkLoad() {
        if (!this.loader) {
            return;
        }
        if (
            this.loader.getBoundingClientRect().top <
            window.innerHeight + this.preloadDistance
        ) {
            this.loadNextPage().then();
        }
    }
    async shouldDisablePaging() {
        if (!window.isListPage) {
            return true;
        }
        await storageManager.getSetting("autoPage", _);
        return [
            "search?q",
            "handlePlayback=1",
            "handleTop=1",
            "/want_watch_videos",
            "/watched_videos",
            "/advanced_search?type=100",
        ].some((e) => o.includes(e));
    }
    updatePageUrl_old(e) {
        window.history.pushState({}, "", e);
        if (l) {
            const t = e.match(/\/(page|star\/.*?)\/(\d+)/);
            const n = t ? parseInt(t[2], 10) : null;
            document.title = document.title.replace(/第\d+頁/, "第" + n + "頁");
        }
    }
    updatePageUrl(e) {
        window.history.replaceState({}, "", e);
        if (l) {
            document.title = document.title.replace(
                /第\d+頁/,
                `第${this.currentPage}頁`,
            );
        }
    }
    setState(e, t) {
        this.loader.className = `jhs-scroll ${e}`;
        this.loader.textContent = t;
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
class SettingPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "folderName", "JHS-数据备份");
        i(this, "cacheItems", [
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
        ]);
    }
    getName() {
        return "SettingPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        let t = (e == null ? undefined : e.containerWidth) ?? "100";
        let n =
            utils.isMobile() && window.innerWidth < 1000
                ? 1
                : ((e == null ? undefined : e.containerColumns) ?? 5);
        this.applyImageMode().then();
        let a = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${t}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${n}, minmax(0, 1fr));\n            }\n        `;
        if (l) {
            a = `\n                .container-fluid .row{\n                    max-width: 1000px !important;\n                    min-width: ${t}%;\n                    margin: auto auto;\n                }\n                \n                .container {\n                    max-width: 1000px !important;\n                    min-width: 80%;\n                    margin: auto auto;\n                }\n                \n                .masonry {\n                    grid-template-columns: repeat(${n}, minmax(0, 1fr));\n                }\n            `;
        }
        return `\n            <style>\n                ${a}\n                .nav-btn::after {\n                    content:none !important;\n                }\n                \n                #cache-data-display pre {\n                    font-family: Consolas, Monaco, 'Andale Mono', monospace;\n                    white-space: pre-wrap;\n                    word-wrap: break-word;\n                    line-height: 1.5;\n                    color: #333;\n                    border: 1px solid #ddd;\n                }\n                \n                .cache-item {\n                    transition: all 0.2s ease;\n                }\n                .cache-item:hover {\n                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n                    transform: translateY(-2px);\n                }\n\n                .tooltip-icon {\n                    display: inline-block;\n                    width: 16px;\n                    height: 16px;\n                    line-height: 16px;\n                    text-align: center;\n                    border-radius: 50%;\n                    background-color: #ccc;\n                    color: white;\n                    font-size: 12px;\n                    margin-right: 5px;\n                    cursor: help;\n                }\n                .setting-item {\n                    display: flex;\n                    align-items: baseline;\n                    justify-content: space-between;\n                    margin-bottom: 3px;\n                    padding: 3px;\n                    /*border: 1px solid #ddd;\n                    border-radius: 5px;*/\n                }\n                .simple-setting .setting-item{\n                    align-items:center;\n                }\n                .setting-label {\n                    font-size: 14px;\n                    min-width: 160px;\n                    font-weight: bold;\n                    margin-right: 10px;\n                }\n                .form-content{\n                    max-width: 160px;\n                    min-width: 160px;\n                }\n                .form-content * {\n                    width: 100%;\n                    padding: 5px;\n                    margin-right: 10px;\n                    text-align: center;\n                }\n                \n                .keyword-label {\n                    display: inline-flex;\n                    align-items: center;\n                    padding: 4px 8px;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    position: relative;\n                    margin-left: 8px;\n                    margin-bottom: 5px;\n                }\n                .keyword-remove {\n                    margin-left: 6px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1;\n                }\n                .keyword-input {\n                    padding: 6px 12px;\n                    border: 1px solid #ccc;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    float:right;\n                }\n                .add-tag-btn {\n                    padding: 6px 12px;\n                    background-color: #e2e8f0;\n                    color: #334155;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 14px;\n                    margin-left: 8px;\n                    float:right;\n                }\n                .add-tag-btn:hover {\n                    background-color: #cbd5e1;\n                }\n                .tag-box {\n                    margin-top:15px;\n                }\n                \n                \n                #saveBtn,#moreBtn,#helpBtn,#clean-all {\n                    padding: 8px 20px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 16px;\n                    margin-top: 10px;\n                }\n                #saveBtn:hover {\n                    background-color: #45a049;\n                }\n                #moreBtn {\n                    background-color: #5cb85c;\n                    color: white;\n                }\n                #moreBtn:hover {\n                    background-color: #4cae4c;\n                }\n                #helpBtn {\n                    background-color: #e67e22;\n                    color: white;\n                }\n                #helpBtn:hover {\n                    background-color: #d35400;\n                }\n                .simple-setting, .mini-simple-setting {\n                    display: none;\n                    background: rgba(255,255,255,1); \n                    position: absolute;\n                    top: ${r ? "35px" : "25px"};\n                    right: ${r ? "-300%" : "0"};\n                    z-index: 1000;\n                    border: 1px solid #ddd;\n                    border-radius: 4px;\n                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n                    padding: 0;\n                    margin-top: 5px; /* 稍微拉开一点距离 */\n                    color: #333;\n                }\n                \n                .mini-switch {\n                  appearance: none;\n                  -webkit-appearance: none;\n                  width: 40px;\n                  height: 20px;\n                  background: #e0e0e0;\n                  border-radius: 20px;\n                  position: relative;\n                  cursor: pointer;\n                  outline: none;\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked {\n                  background: #4CAF50;\n                }\n                \n                .mini-switch::before {\n                  content: "";\n                  position: absolute;\n                  width: 16px;\n                  height: 16px;\n                  border-radius: 50%;\n                  background: white;\n                  top: 2px;\n                  left: 2px;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked::before {\n                  left: calc(100% - 18px);\n                }\n                \n                .side-menu-item {\n                    padding: 12px 12px;\n                    cursor: pointer;\n                    color: #333;\n                    border-left: 3px solid transparent;\n                    transition: all 0.2s;\n                    display: flex;\n                    gap: 5px;\n                }\n                \n                .side-menu-item .icon {\n                     height: 24px; \n                     width: 24px;\n                }\n                \n                .side-menu-item:hover {\n                    background-color: #e9e9e9;\n                }\n                \n                .side-menu-item.active {\n                    background-color: #e0e0e0;\n                    border-left: 3px solid #5d87c2;\n                    font-weight: bold;\n                }\n                \n                .content-panel {\n                    display: none;\n                    margin-top:20px;\n                    padding: 0 10px 10px 0;\n                    height: 100%;\n                    overflow-x: hidden;\n                    overflow-y: auto;\n                }\n                \n                .content-panel.active {\n                    display: block;\n                }\n                \n                input[type="checkbox"]:disabled {\n                    opacity: 0.6; \n                    cursor: default !important;\n                }\n            </style>\n        `;
    }
    async handle() {
        if ((await storageManager.getSetting("enableClog", _)) === _) {
            clog.show();
        }
        if (r) {
            let e = function () {
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
                    e();
                },
            );
            $(window).resize(e);
        }
        if (l) {
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
            if (isDetailPage) {
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
    addBackToTopBtn() {
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
    async openSettingDialog(e = "backup-panel", t) {
        const n = this.cacheItems
            .map(
                (e) =>
                    `\n            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">\n                <div style="font-weight: bold; margin-bottom: 8px;">${e.text}</div>\n                <div style="display: flex; gap: 8px;">\n                    <a class="menu-btn clean-btn" data-key="${e.key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${e.title}">\n                        <span>清理</span>\n                    </a>\n                    <a class="menu-btn view-btn" data-key="${e.key}" style="background-color:#b2bec0; flex:1; text-align:center;" >\n                        <span>查看</span>\n                    </a>\n                </div>\n            </div>\n        `,
            )
            .join("");
        let a = "";
        L.forEach((e) => {
            if (e.canSelect) {
                a += `<option value="${e.quality}">${e.text}</option>`;
            }
        });
        let s = `\n            <div style="display: flex; height: 100%;">\n                <div style="width: 140px; flex-shrink: 0; padding: 15px 0; background: #f5f5f5; border-right: 1px solid #ddd;">\n                    <div class="side-menu-item ${e === "backup-panel" ? "active" : ""}" data-panel="backup-panel">💾 数据备份</div>\n                    <div class="side-menu-item ${e === "base-panel" ? "active" : ""}" data-panel="base-panel">⚙️ 基础配置</div>\n                    <div class="side-menu-item ${e === "filter-panel" ? "active" : ""}" data-panel="filter-panel">🚫 屏蔽配置</div>\n                    <div class="side-menu-item ${e === "domain-panel" ? "active" : ""}" data-panel="domain-panel" title="第三方视频资源域名配置">🌐 外部网站</div>\n                    <div class="side-menu-item ${e === "hotkey-panel" ? "active" : ""}" data-panel="hotkey-panel">⌨️ 快捷键配置</div>\n                    <div class="side-menu-item ${e === "cache-panel" ? "active" : ""}" data-panel="cache-panel">🧹 清理缓存</div>\n                    </div>\n        \n                <div style="flex: 1; display: flex; flex-direction: column; height: 100%; ">\n                    <div style="flex: 1; margin: 0 10px; padding-bottom: 20px;overflow: hidden">\n                    \n                        \x3c!-- 备份面板 --\x3e\n                        <div id="backup-panel" class="content-panel" style="display: ${e === "backup-panel" ? "block" : "none"};">\n                            <div style="margin-bottom: 20px">\n                                <a id="importBtn" class="menu-btn" style="background-color:#d25a88"><span>导入数据</span></a>\n                                <a id="exportBtn" class="menu-btn" style="background-color:#85d0a3"><span>导出数据</span></a>\n                                </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">WebDav备份</span>\n                                <div>\n                                    <a id="webdavBackupListBtn" class="menu-btn" style="background-color:#5d87c2"><span>查看备份</span></a>\n                                    <a id="webdavBackupBtn" class="menu-btn" style="background-color:#64bb69"><span>备份数据</span></a>\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">服务地址:</span>\n                                <div class="form-content">\n                                    <input id="webDavUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">用户名:</span>\n                                <div class="form-content">\n                                    <input id="webDavUsername">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">密码:</span>\n                                <div class="form-content">\n                                    <input id="webDavPassword">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \n                        \x3c!-- 基础设置面板 --\x3e\n                        <div id="base-panel" class="content-panel" style="display: ${e === "base-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">打开待鉴定|已收藏 窗口数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="waitCheckCount" min="1" max="20" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">已鉴定标签展示位置:</span>\n                                <div class="form-content">\n                                    <select id="tagPosition">\n                                        <option value="rightTop">右上</option>\n                                        <option value="leftTop">左上</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    鉴定补录演员信息 <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            \n\n                            <div class="setting-item">\n                                <span class="setting-label">预览视频默认画质:</span>\n                                <div class="form-content">\n                                    <select id="videoQuality">\n                                        ${a}\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">评论区条数:</span>\n                                <div class="form-content">\n                                    <select id="reviewCount">\n                                        <option value="10">10条</option>\n                                        <option value="20">20条</option>\n                                        <option value="30">30条</option>\n                                        <option value="40">40条</option>\n                                        <option value="50">50条</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span class="setting-label">\n                                    高亮已收藏演员 <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span id="highlightedTagLabel" class="setting-label">\n                                    分类标签|高亮演员-边框样式:\n                                </span>\n                                <div class="form-content" style="display: flex; align-items: center;">\n                                    <input type="number" id="highlightedTagNumber" min="0" max="20">\n                                    <input type="color" id="highlightedTagColor">\n                                </div>\n                            </div>\n\n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求超时时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpTimeout" min="1000" max="10000" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求失败重试次数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpRetryCount" min="0" max="10" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    启用控制台日志:\n                                </span>\n                                <div class="form-content">\n                                    <select id="enableClog">\n                                        <option value="no">禁用</option>\n                                        <option value="yes">开启</option>\n                                    </select>\n                                </div>\n                            </div>\n\n                            <div class="setting-item">\n                                <span class="setting-label">日志最大行数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="clogMsgCount" min="100" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        <div id="domain-panel" class="content-panel" style="display: ${e === "domain-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - MissAv:</span>\n                                <div class="form-content">\n                                    <input id="missAvUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - SupJav:</span>\n                                <div class="form-content">\n                                    <input id="supJavUrl">\n                                </div>\n                            </div>           \n                        </div>\n                         \n                         \x3c!-- 快捷键 --\x3e\n                        <div id="hotkey-panel" class="content-panel" style="display: ${e === "hotkey-panel" ? "block" : "none"};">\n                            <p style="color: #666; font-size: 0.9em;">修改后, 刷新页面生效</p>\n                            <div class="setting-item">\n                                <span class="setting-label">${m}:</span>\n                                <div class="form-content">\n                                    <input id="filterHotKey" placeholder="录入快捷键" data-default-hotkey="a">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${v}:</span>\n                                <div class="form-content">\n                                    <input id="favoriteHotKey" placeholder="录入快捷键" data-default-hotkey="s">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${k}:</span>\n                                <div class="form-content">\n                                    <input id="hasWatchHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">⏩ 快进:</span>\n                                <div class="form-content">\n                                    <input id="speedVideoHotKey" placeholder="录入快捷键" data-default-hotkey="z">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">▲ 折叠:</span>\n                                <div class="form-content">\n                                    <input id="foldCategoryHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">💻 控制台:</span>\n                                <div class="form-content">\n                                    <input id="clogHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    <span data-tip="列表页,鼠标放置图片上时可使用快捷键">❓ </span> 对视频列表页启用快捷键:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableImageHotKey" class="mini-switch">\n                                </div>\n                            </div>\n\n                        </div>\n                        \n                        \x3c!-- 屏蔽设置面板 --\x3e\n                        <div id="filter-panel" class="content-panel" style="display: ${e === "filter-panel" ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">\n                                     启用划词屏蔽 <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">❓ </span>\n                                </span>\n                                <div style="display: flex">\n                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="reviewKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">评论区屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="filterKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">视频标题屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                        </div>\n                        <div id="cache-panel" class="content-panel" style="display: ${e === "cache-panel" ? "block" : "none"};">\n                            <h1 style="text-align:center;font-size: 20px;font-weight: bold">以下操作, 不会对核心数据造成影响</h1>\n                            <br/>               \n                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">\n                                ${n}\n                            </div>    \n                            <div id="cache-data-display" style="margin-top: 20px; display: none;">\n                                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;"></pre>\n                            </div>\n                        </div>                        \n                        </div><div style="flex-shrink: 0; padding: 15px 20px; text-align: right; border-top: 1px solid #eee; background: white;">   \n                        <button id="saveBtn">保存设置</button>\n                        <button id="clean-all" style="display: none">♾️ 清理全部缓存</button>\n                    </div>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getResponsiveArea(["55%", "90%"]),
            scrollbar: false,
            success: (e, n) => {
                $(e).find(".layui-layer-content").css("position", "relative");
                this.loadForm();
                this.bindClick();
                utils.setupEscClose(n);
                if (t) {
                    t();
                }
            },
        });
    }
    simpleSetting() {
        return `\n             <div class="jhs-scrollbar" style="margin-top:20px;max-height:90vh; overflow-y:auto;">\n                <div style="margin: 0 10px;">\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            显示已鉴定内容:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽单番号: </span><input type="checkbox" id="showFilterItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽演员: </span><input type="checkbox" id="showFilterActorItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽关键词: </span><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">收藏: </span><input type="checkbox" id="showFavoriteItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已观看: </span><input type="checkbox" id="showHasWatchItem" class="mini-switch"><br/>\n                        </div>\n                    </div>\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">❓ </span> 显示所有:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <input type="checkbox" id="showAllItem" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="点击封面的打开方式,弹窗|新窗口">❓ </span>弹窗方式打开页面:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                             <input type="checkbox" id="dialogOpenDetail" class="mini-switch">\n                        </div>\n                    </div>      \n                    \n                    <div class="setting-item">\n                        <span class="setting-label">鉴定后立即关闭页面:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="needClosePage" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                             <span data-tip="使用瀑布流模式, 排序方式将调整为默认">❓ </span>瀑布流模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="autoPage" class="mini-switch">\n                        </div>\n                    </div>\n       \n                    <div class="setting-item">\n                        <span class="setting-label">启用标题翻译:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="translateTitle" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">启用悬浮大图:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="hoverBigImg" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                                        \n                    <div class="setting-item">\n                        <span class="setting-label">启用115视频匹配: </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enable115Match" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    ${r ? '\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页是否展示女优年龄、三围等信息">❓ </span>加载女优信息:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadActressInfo" class="mini-switch">\n                        </div>\n                    </div>' : ""}\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页第三方资源检测,如missAv,123AV">❓ </span>加载第三方视频资源:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadOtherSite" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页图片区首列位置加载长缩略图">❓ </span>加载长缩略图:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadScreenShot" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                     <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页解析更多更高画质的预览视频">❓ </span>更高画质预览视频:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadPreviewVideo" class="mini-switch">\n                        </div>\n                    </div>\n\n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="列数6以上,建议开启竖图">❓ </span>竖图模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableVerticalModel" class="mini-switch">\n                        </div>\n                    </div>\n                                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面列数: <span id="showContainerColumns"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerColumns" min="2" max="10" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面宽度: <span id="showContainerWidth"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerWidth" min="0" max="30" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                </div>\n                <div style="padding: 0 20px 15px; text-align: right; border-top: 1px solid #eee;">   \n                    <button id="helpBtn" style="float:left;">常见问题</button>\n                    <button id="moreBtn">更多设置</button>\n                </div>\n            </div>\n        `;
    }
    async loadForm() {
        let e = await storageManager.getSetting();
        $("#videoQuality").val(e.videoQuality);
        $("#reviewCount").val(e.reviewCount || 20);
        $("#tagPosition").val(e.tagPosition || "rightTop");
        $("#waitCheckCount").val(e.waitCheckCount || 5);
        const t = e.highlightedTagNumber || 1;
        const n = e.highlightedTagColor || "#ce2222";
        $("#highlightedTagNumber").val(e.highlightedTagNumber || 1);
        $("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222");
        $("#highlightedTagLabel").css("border", `${t}px solid ${n}`);
        $("#enableClog").val(e.enableClog || _);
        $("#clogMsgCount").val(e.clogMsgCount || 2000);
        $("#httpTimeout").val(e.httpTimeout || 5000);
        $("#httpRetryCount").val(e.httpRetryCount || 3);
        $("#webDavUrl").val(e.webDavUrl || "");
        $("#webDavUsername").val(e.webDavUsername || "");
        $("#webDavPassword").val(e.webDavPassword || "");
        $("#enableTitleSelectFilter").prop(
            "checked",
            !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _,
        );
        $("#enableFavoriteActresses").prop(
            "checked",
            !e.enableFavoriteActresses || e.enableFavoriteActresses === _,
        );
        $("#enableSaveActressCarInfo").prop(
            "checked",
            !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _,
        );
        const a = this.getBean("OtherSitePlugin");
        const i = await a.getMissAvUrl();
        const h = await a.getSupJavUrl();
        $("#missAvUrl").val(i);
        $("#supJavUrl").val(h);
        let g = await storageManager.getReviewFilterKeywordList();
        let p = await storageManager.getTitleFilterKeyword();
        if (g) {
            g.forEach((e) => {
                this.addLabelTag("#reviewKeywordContainer", e);
            });
        }
        if (p) {
            p.forEach((e) => {
                this.addLabelTag("#filterKeywordContainer", e);
            });
        }
        ["#reviewKeywordContainer", "#filterKeywordContainer"].forEach((e) => {
            $(`${e} .add-tag-btn`).on("click", (t) => this.addKeyword(t, e));
            $(`${e} .keyword-input`).on("keypress", (t) => {
                if (t.key === "Enter") {
                    this.addKeyword(t, e);
                }
            });
        });
        $("#hotkey-panel [id]")
            .map((e, t) => t.id)
            .get()
            .forEach((t) => {
                const n = $(`#${t}`);
                const a =
                    e[t] !== undefined
                        ? e[t]
                        : n.attr("data-default-hotkey") || "";
                n.val(a)
                    .on("input", (e) => {
                        let t = $(e.target).val();
                        if (
                            /[\u4e00-\u9fa5]/.test(t) ||
                            /^Shift[a-zA-Z0-9]+$/.test(t)
                        ) {
                            $(e.target).val("");
                            show.error(
                                "非法输入：不能输入中文或输入法转换错误",
                            );
                        }
                    })
                    .on("keydown", (e) => this.handleHotkeyInput(e, n));
            });
        $("#enableImageHotKey").prop(
            "checked",
            !!e.enableImageHotKey && e.enableImageHotKey === _,
        );
    }
    handleHotkeyInput(e, t) {
        e.preventDefault();
        const n = this.parseHotkey(e);
        if (n !== "") {
            if (this.isDuplicateHotkey(n, t.attr("id"))) {
                show.error("该快捷键已被其他功能使用！");
            } else {
                t.val(n);
            }
        } else {
            t.val("");
        }
    }
    parseHotkey(e) {
        if (e.key === "Backspace" || e.key === "Process") {
            return "";
        }
        const t = [];
        if (e.ctrlKey) {
            t.push("Ctrl");
        }
        if (e.shiftKey) {
            t.push("Shift");
        }
        if (e.altKey) {
            t.push("Alt");
        }
        if (e.metaKey) {
            t.push("Cmd");
        }
        const n =
            {
                " ": "Space",
                Control: "Ctrl",
                Meta: "Cmd",
                ArrowUp: "Up",
                ArrowDown: "Down",
                ArrowLeft: "Left",
                ArrowRight: "Right",
            }[e.key] || (e.key.length > 1 ? e.key.replace("Arrow", "") : e.key);
        if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
            t.push(n);
        }
        if (t.length > 0) {
            return t.join("+");
        } else {
            return "";
        }
    }
    isDuplicateHotkey(e, t) {
        let n = false;
        $("#hotkey-panel [id]").each((a, i) => {
            if (i.id !== t && e && e === $(i).val()) {
                n = true;
                return false;
            }
        });
        return n;
    }
    async initSimpleSettingForm() {
        let e = await storageManager.getSetting();
        $("#containerColumns").val(e.containerColumns || 5);
        $("#showContainerColumns").text(e.containerColumns || 5);
        $("#containerWidth").val((e.containerWidth || 100) - 70);
        $("#showContainerWidth").text((e.containerWidth || 100) + "%");
        $("#dialogOpenDetail").prop(
            "checked",
            !e.dialogOpenDetail || e.dialogOpenDetail === _,
        );
        $("#needClosePage").prop(
            "checked",
            !e.needClosePage || e.needClosePage === _,
        );
        $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _);
        $("#translateTitle").prop(
            "checked",
            !e.translateTitle || e.translateTitle === _,
        );
        $("#enableLoadActressInfo").prop(
            "checked",
            !e.enableLoadActressInfo || e.enableLoadActressInfo === _,
        );
        $("#enableLoadOtherSite").prop(
            "checked",
            !e.enableLoadOtherSite || e.enableLoadOtherSite === _,
        );
        $("#containerColumns").on("input", async (e) => {
            let t = $("#containerColumns").val();
            $("#showContainerColumns").text(t);
            if (r) {
                document.querySelector(
                    ".movie-list",
                ).style.gridTemplateColumns = `repeat(${t}, minmax(0, 1fr))`;
            }
            if (l) {
                document.querySelector(".masonry").style.gridTemplateColumns =
                    `repeat(${t}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem("containerColumns", t);
            this.applyImageMode();
        });
        $("#containerWidth").on("input", async (e) => {
            let t = parseInt($(e.target).val());
            const n = t + 70 + "%";
            $("#showContainerWidth").text(n);
            if (r) {
                document.querySelector("section .container").style.minWidth = n;
            }
            if (l) {
                document.querySelector(".container-fluid .row").style.minWidth =
                    n;
            }
            storageManager.saveSettingItem("containerWidth", t + 70);
        });
        $("#dialogOpenDetail").on("change", (e) => {
            let t = $("#dialogOpenDetail").is(":checked") ? _ : C;
            storageManager.saveSettingItem("dialogOpenDetail", t);
        });
        $("#showFilterItem").prop(
            "checked",
            !!e.showFilterItem && e.showFilterItem === _,
        );
        $("#showFilterActorItem").prop(
            "checked",
            !!e.showFilterActorItem && e.showFilterActorItem === _,
        );
        $("#showFilterKeywordItem").prop(
            "checked",
            !!e.showFilterKeywordItem && e.showFilterKeywordItem === _,
        );
        $("#showFavoriteItem").prop(
            "checked",
            !e.showFavoriteItem || e.showFavoriteItem === _,
        );
        $("#showHasWatchItem").prop(
            "checked",
            !e.showHasWatchItem || e.showHasWatchItem === _,
        );
        $("#showFilterItem").on("change", async (e) => {
            let t = $("#showFilterItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterItem", t);
            window.refresh();
        });
        $("#showFilterActorItem").on("change", async (e) => {
            let t = $("#showFilterActorItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterActorItem", t);
            window.refresh();
        });
        $("#showFilterKeywordItem").on("change", async (e) => {
            let t = $("#showFilterKeywordItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterKeywordItem", t);
            window.refresh();
        });
        $("#showFavoriteItem").on("change", async (e) => {
            let t = $("#showFavoriteItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFavoriteItem", t);
            window.refresh();
        });
        $("#showHasWatchItem").on("change", async (e) => {
            let t = $("#showHasWatchItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showHasWatchItem", t);
            window.refresh();
        });
        const t = $(
            "#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasWatchItem",
        );
        const n = () => {
            const e = $("#showAllItem").is(":checked");
            t.prop("disabled", e);
            if (e) {
                t.attr("data-tip", "请先关闭显示所有才可点击");
            } else {
                t.removeAttr("data-tip");
            }
        };
        $("#showAllItem").prop(
            "checked",
            !!e.showAllItem && e.showAllItem === _,
        );
        $("#showAllItem").on("change", async (e) => {
            let t = $("#showAllItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showAllItem", t);
            n();
            window.refresh();
        });
        n();
        $("#needClosePage").on("change", async (e) => {
            await storageManager.saveSettingItem(
                "needClosePage",
                $("#needClosePage").is(":checked") ? _ : C,
            );
            window.refresh();
        });
        $("#autoPage").on("change", async (e) => {
            const t = $("#autoPage").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("autoPage", t);
            if (t === _) {
                $("#sort-toggle-btn").hide();
            } else {
                $("#sort-toggle-btn").show();
            }
        });
        $("#translateTitle").on("change", async (e) => {
            const t = $("#translateTitle").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("translateTitle", t);
            if (t === _) {
                await this.getBean("ListPagePlugin").doFilter();
            } else {
                await this.getBean("ListPagePlugin").revertTranslation();
                $(".translated-title").remove();
            }
        });
        $("#hoverBigImg").prop(
            "checked",
            !!e.hoverBigImg && e.hoverBigImg === _,
        );
        $("#hoverBigImg").on("change", async (e) => {
            const t = $("#hoverBigImg").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("hoverBigImg", t);
            if (t === _) {
                window.imageHoverPreviewObj = new ImagePreview({
                    selector: this.getSelector().coverImgSelector,
                });
            } else if (window.imageHoverPreviewObj) {
                window.imageHoverPreviewObj.destroy();
            }
        });
        $("#enableLoadActressInfo").on("change", async (e) => {
            const t = $("#enableLoadActressInfo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadActressInfo", t);
            if (t === _) {
                this.getBean("ActressInfoPlugin").loadActressInfo();
            } else {
                $(".actress-info").remove();
            }
        });
        $("#enableLoadOtherSite").on("change", async (e) => {
            const t = $("#enableLoadOtherSite").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadOtherSite", t);
            if (t === _) {
                this.getBean("OtherSitePlugin").loadOtherSite().then();
            } else {
                $("#otherSiteBox").remove();
            }
        });
        $("#enableLoadScreenShot").prop(
            "checked",
            !e.enableLoadScreenShot || e.enableLoadScreenShot === _,
        );
        $("#enableLoadScreenShot").on("change", async (e) => {
            const t = $("#enableLoadScreenShot").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadScreenShot", t);
            if (t !== _) {
                $(".screen-container").remove();
            }
        });
        $("#enableLoadPreviewVideo").prop(
            "checked",
            !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _,
        );
        $("#enableLoadPreviewVideo").on("change", async (e) => {
            const t = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadPreviewVideo", t);
        });
        $("#enable115Match").prop(
            "checked",
            !!e.enable115Match && e.enable115Match === _,
        );
        $("#enable115Match").on("change", async (e) => {
            const t = $("#enable115Match").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enable115Match", t);
        });
        $("#enableVerticalModel").prop(
            "checked",
            !!e.enableVerticalModel && e.enableVerticalModel === _,
        );
        $("#enableVerticalModel").on("change", async (e) => {
            const t = $("#enableVerticalModel").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableVerticalModel", t);
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
    async applyImageMode() {
        $("#verticalImgStyle").remove();
        if ((await storageManager.getSetting("enableVerticalModel", C)) === _) {
            let e = "100% 50% !important";
            if (window.location.href.includes("/advanced_search?type=100")) {
                e = "50% 50% !important";
            }
            const t = `\n                .cover {\n                    min-height: 350px !important;\n                    overflow: hidden !important;\n                    padding-top: 142% !important;\n                }\n                \n                .cover img {\n                    object-fit: cover !important;\n                    object-position: ${e};\n                }\n                \n                /* bus的 */\n                .masonry .movie-box img {\n                    min-height: 500px !important;\n                    object-fit: cover !important;\n                    object-position: top right;\n                }\n            `;
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(t)
                .appendTo("head");
        } else {
            const e =
                "\n                .cover {\n                    min-height:auto !important;\n                    padding-top: 67% !important;\n                }\n                .cover img {\n                    object-fit: contain !important;\n                    object-position: 50% 50% !important\n                }\n                \n                /* bus的 */\n                 .masonry .movie-box img {\n                    min-height:auto !important;\n                    object-fit: contain !important;\n                    object-position: top;\n                }\n            ";
            $("<style>")
                .attr("id", "verticalImgStyle")
                .text(e)
                .appendTo("head");
        }
    }
    bindClick() {
        $(".side-menu-item").on("click", function () {
            $(".side-menu-item").removeClass("active");
            $(this).addClass("active");
            $(".content-panel").hide();
            const e = $(this).data("panel");
            $("#" + e).show();
            if (e === "cache-panel") {
                $("#saveBtn").hide();
                $("#clean-all").show();
            } else {
                $("#saveBtn").show();
                $("#clean-all").hide();
            }
        });
        $("#importBtn").on("click", (e) => this.importData(e));
        $("#exportBtn").on("click", (e) => this.exportData(e));
        $("#webdavBackupBtn").on("click", (e) => this.backupDataByWebDav(e));
        $("#webdavBackupListBtn").on("click", (e) =>
            this.backupListBtnByWebDav(e),
        );
        $("#saveBtn").on("click", () => this.saveForm());
        $(".clean-btn").on("click", (e) => {
            const t = $(e.currentTarget).data("key");
            const n = this.cacheItems.find((e) => e.key === t);
            localStorage.removeItem(t);
            show.ok(`${n.text} 清理成功`);
            $("#cache-data-display").hide();
            if (t === "jhs_dmm_video") {
                localStorage.removeItem("jhs_other_site_dmm");
            }
        });
        $("#clean-all").on("click", () => {
            this.cacheItems.forEach((e) => localStorage.removeItem(e.key));
            show.ok("全部缓存已清理");
            $("#cache-data-display").hide();
            localStorage.removeItem("jhs_other_site_dmm");
        });
        $(".view-btn").on("click", (e) => {
            const t = $(e.currentTarget).data("key");
            const n = localStorage.getItem(t);
            const a = $("#cache-data-display");
            const i = a.find("pre");
            a.show();
            if (n) {
                try {
                    const e = JSON.parse(n);
                    i.text(JSON.stringify(e, null, 2));
                } catch {
                    i.text(n);
                }
            } else {
                i.text("无数据");
            }
        });
        const e = $("#highlightedTagNumber");
        const t = $("#highlightedTagColor");
        const n = $("#highlightedTagLabel");
        function a() {
            const a = e.val();
            const i = t.val();
            n.css("border", `${a}px solid ${i}`);
        }
        e.on("input", a);
        t.on("input", a);
    }
    async saveForm() {
        let e = await storageManager.getSetting();
        e.videoQuality = $("#videoQuality").val();
        e.reviewCount = $("#reviewCount").val();
        e.tagPosition = $("#tagPosition").val();
        e.waitCheckCount = $("#waitCheckCount").val();
        e.highlightedTagNumber = $("#highlightedTagNumber").val();
        e.highlightedTagColor = $("#highlightedTagColor").val();
        e.httpTimeout = $("#httpTimeout").val();
        e.httpRetryCount = $("#httpRetryCount").val();
        e.enableClog = $("#enableClog").val();
        if (e.enableClog === _) {
            clog.show();
        } else {
            clog.hide();
        }
        e.clogMsgCount = $("#clogMsgCount").val();
        e.webDavUrl = $("#webDavUrl").val();
        e.webDavUsername = $("#webDavUsername").val();
        e.webDavPassword = $("#webDavPassword").val();
        e.missAvUrl = $("#missAvUrl").val().replace(/\/$/, "");
        e.supJavUrl = $("#supJavUrl").val().replace(/\/$/, "");
        e.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(":checked")
            ? _
            : C;
        e.enableFavoriteActresses = $("#enableFavoriteActresses").is(":checked")
            ? _
            : C;
        e.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(
            ":checked",
        )
            ? _
            : C;
        $("#hotkey-panel [id]")
            .map((e, t) => t.id)
            .get()
            .forEach((t) => {
                e[t] = $(`#${t}`).val();
            });
        e.enableImageHotKey = $("#enableImageHotKey").is(":checked") ? _ : C;
        await storageManager.saveSetting(e);
        let t = [];
        $("#reviewKeywordContainer .keyword-label")
            .toArray()
            .forEach((e) => {
                let n = $(e)
                    .text()
                    .replace("×", "")
                    .replace(/[\r\n]+/g, " ")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                t.push(n);
            });
        await storageManager.saveReviewFilterKeyword(t);
        let n = [];
        $("#filterKeywordContainer .keyword-label")
            .toArray()
            .forEach((e) => {
                let t = $(e)
                    .text()
                    .replace("×", "")
                    .replace(/[\r\n]+/g, " ")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                n.push(t);
            });
        await storageManager.saveTitleFilterKeyword(n);
        show.ok("保存成功");
        window.refresh();
        const a = this.getBean("NewVideoPlugin");
        if (a) {
            a.resetBtnTip();
        }
        this.getBean("BlacklistPlugin").resetBtnTip();
        this.getBean("BlacklistPlugin").reloadTable();
    }
    addLabelTag(e, t) {
        const n = $(`${e} .tag-box`);
        let a;
        let i = "#cbd5e1";
        let s = "#333";
        if (/^[a-z]{2,}-/i.test(t) && r) {
            s = "#3477ad";
            a = $(
                `\n                <a class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}" href="/video_codes/${t.replace("-", "")}" target="_blank">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </a>\n            `,
            );
        } else {
            a = $(
                `\n                <div class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </div>\n            `,
            );
        }
        a.find(".keyword-remove").click((e) => {
            e.stopPropagation();
            e.preventDefault();
            const t = $(e.currentTarget);
            const n = t
                .closest(".keyword-label")
                .attr("data-keyword")
                .split(" ")[0];
            utils.q(e, `是否移除屏蔽词  ${n}?`, async () => {
                t.parent().remove();
            });
        });
        n.append(a);
    }
    addKeyword(e, t) {
        let n = $(`${t} .keyword-input`);
        const a = n.val().trim();
        if (a) {
            this.addLabelTag(t, a);
            n.val("");
        }
    }
    importData() {
        try {
            const e = document.createElement("input");
            e.type = "file";
            e.accept = ".json";
            e.onchange = (e) => {
                const t = e.target.files[0];
                if (!t) {
                    return;
                }
                const n = new FileReader();
                n.onload = (e) => {
                    try {
                        const t = e.target.result.toString();
                        const n = JSON.parse(t);
                        layer.confirm(
                            "确定是否要覆盖导入？",
                            {
                                icon: 3,
                                title: "确认覆盖",
                                btn: ["确定", "取消"],
                            },
                            async function (e) {
                                await storageManager.importData(n);
                                show.ok("数据导入成功");
                                layer.close(e);
                                location.reload();
                            },
                        );
                    } catch (t) {
                        console.error(t);
                        show.error("导入失败：文件内容不是有效的JSON格式 " + t);
                    }
                };
                n.onerror = () => {
                    show.error("读取文件时出错");
                };
                n.readAsText(t);
            };
            document.body.appendChild(e);
            e.click();
            setTimeout(() => document.body.removeChild(e), 1000);
        } catch (e) {
            console.error(e);
            show.error("导入数据时出错: " + e.message);
        }
    }
    async backupDataByWebDav(e) {
        const t = await storageManager.getSetting();
        const n = t.webDavUrl;
        if (!n) {
            show.error("请填写webDav服务地址并保存后, 再试此功能");
            return;
        }
        const a = t.webDavUsername;
        if (!a) {
            show.error("请填写webDav用户名并保存后, 再试此功能");
            return;
        }
        const i = t.webDavPassword;
        if (!i) {
            show.error("请填写webDav密码并保存后, 再试此功能");
            return;
        }
        let s = utils.getNowStr("_", "_") + ".json";
        let o = JSON.stringify(await storageManager.exportData());
        o = Me(o);
        let r = loading();
        try {
            const e = new De(n, a, i);
            await e.backup(this.folderName, s, o);
            show.ok("备份完成");
        } catch (l) {
            console.error(l);
            show.error(l.toString());
        } finally {
            r.close();
        }
    }
    async backupListBtnByWebDav(e) {
        const t = await storageManager.getSetting();
        const n = t.webDavUrl;
        if (!n) {
            show.error("请填写webDav服务地址并保存后, 再试此功能");
            return;
        }
        const a = t.webDavUsername;
        if (!a) {
            show.error("请填写webDav用户名并保存后, 再试此功能");
            return;
        }
        const i = t.webDavPassword;
        if (!i) {
            show.error("请填写webDav密码并保存后, 再试此功能");
            return;
        }
        let s = loading();
        try {
            const e = new De(n, a, i);
            const t = await e.getBackupList(this.folderName);
            this.openFileListDialog(t, e, "WebDav");
        } catch (o) {
            console.error(o);
            show.error(`发生错误: ${o ? o.message : o}`);
        } finally {
            s.close();
        }
    }
    openFileListDialog(e, t, n) {
        layer.open({
            type: 1,
            title: n + "备份文件",
            content:
                '\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            ',
            area: ["800px", "70%"],
            anim: -1,
            success: (a) => {
                const i = new Tabulator("#table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: true,
                    data: e,
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
                            formatter: (e, t, n) => {
                                const a = ["B", "KB", "MB", "GB", "TB", "PB"];
                                let i = 0;
                                let s = e.getData().size;
                                while (s >= 1024 && i < a.length - 1) {
                                    s /= 1024;
                                    i++;
                                }
                                return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${a[i]}`;
                            },
                        },
                        {
                            title: "备份日期",
                            field: "createTime",
                            responsive: 2,
                            headerSort: false,
                            formatter: (e, t, n) => {
                                const a = e.getData();
                                return `${utils.getNowStr("-", ":", a.createTime)}`;
                            },
                        },
                        {
                            title: "操作",
                            minWidth: 250,
                            responsive: 0,
                            headerSort: false,
                            formatter: (e, a, s) => {
                                const o = e.getData();
                                s(() => {
                                    const a = e
                                        .getElement()
                                        .querySelector(".a-danger");
                                    const s = e
                                        .getElement()
                                        .querySelector(".a-primary");
                                    const r = e
                                        .getElement()
                                        .querySelector(".a-success");
                                    if (a) {
                                        a.addEventListener("click", (e) => {
                                            layer.confirm(
                                                `是否删除 ${o.name} ?`,
                                                {
                                                    icon: 3,
                                                    title: "提示",
                                                    btn: ["确定", "取消"],
                                                },
                                                async (e) => {
                                                    layer.close(e);
                                                    let a = loading();
                                                    try {
                                                        await t.deleteFile(
                                                            o.fileId,
                                                        );
                                                        let e =
                                                            await t.getBackupList(
                                                                this.folderName,
                                                            );
                                                        i.replaceData(e);
                                                        layer.alert("删除成功");
                                                    } catch (s) {
                                                        console.error(s);
                                                        show.error(
                                                            `发生错误: ${s ? s.message : s}`,
                                                        );
                                                    } finally {
                                                        a.close();
                                                    }
                                                },
                                            );
                                        });
                                    }
                                    if (s) {
                                        s.addEventListener(
                                            "click",
                                            async (e) => {
                                                let a = loading();
                                                try {
                                                    const e = Ne(
                                                        await t.getFileContent(
                                                            o.fileId,
                                                        ),
                                                    );
                                                    utils.download(e, o.name);
                                                } catch (i) {
                                                    clog.error(i);
                                                    show.error(
                                                        "下载失败: " + i,
                                                    );
                                                } finally {
                                                    a.close();
                                                }
                                            },
                                        );
                                    }
                                    if (r) {
                                        r.addEventListener(
                                            "click",
                                            async (e) => {
                                                layer.confirm(
                                                    `是否将该云备份数据 ${o.name} 导入?`,
                                                    {
                                                        icon: 3,
                                                        title: "提示",
                                                        btn: ["确定", "取消"],
                                                    },
                                                    async (e) => {
                                                        layer.close(e);
                                                        let a = loading();
                                                        try {
                                                            let e =
                                                                await t.getFileContent(
                                                                    o.fileId,
                                                                );
                                                            show.info(
                                                                "解密文件内容...",
                                                            );
                                                            e = Ne(e);
                                                            show.info(
                                                                "解密完成, 开始导入...",
                                                            );
                                                            const a =
                                                                JSON.parse(e);
                                                            await storageManager.importData(
                                                                a,
                                                            );
                                                            show.ok(
                                                                "导入成功!",
                                                            );
                                                            window.location.reload();
                                                        } catch (i) {
                                                            console.error(i);
                                                            show.error(i);
                                                        } finally {
                                                            a.close();
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
    async exportData(e) {
        try {
            const e = JSON.stringify(await storageManager.exportData());
            const t = `${utils.getNowStr("_", "_")}.json`;
            utils.download(e, t);
            show.ok("数据导出成功");
        } catch (t) {
            console.error(t);
            show.error("导出数据时出错: " + t.message);
        }
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
class WantAndWatchedVideosPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "type", null);
    }
    getName() {
        return "WantAndWatchedVideosPlugin";
    }
    async handle() {
        if (window.location.href.includes("/want_watch_videos")) {
            $("h3").append(
                '<a class="a-primary" id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>',
            );
            $("h3").append(
                '<span style="margin-left:8px;color:#888;font-size:12px;">（JHS 现已在详情页自动同步"想看"，本页按钮仅用于初始补录）</span>',
            );
            $("#wantWatchBtn").on("click", (e) => {
                this.type = h;
                this.importWantWatchVideos(
                    e,
                    "是否将 想看的影片 导入到 JHS-收藏?",
                );
            });
        }
        if (window.location.href.includes("/watched_videos")) {
            $("h3").append(
                '<a class="a-success" id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>',
            );
            $("h3").append(
                '<span style="margin-left:8px;color:#888;font-size:12px;">（JHS 现已在详情页自动同步"看過"，本页按钮仅用于初始补录）</span>',
            );
            $("#wantWatchBtn").on("click", (e) => {
                this.type = p;
                this.importWantWatchVideos(
                    e,
                    "是否将 看过的影片 导入到 JHS-已观看?",
                );
            });
        }
    }
    importWantWatchVideos(e, t) {
        utils.q(
            null,
            `${t} <br/> <span style='color: #f40'>执行此功能前请记得备份数据</span>`,
            async () => {
                let e = loading();
                try {
                    await this.parseMovieList();
                } catch (t) {
                    console.error(t);
                } finally {
                    e.close();
                }
            },
        );
    }
    async parseMovieList(e) {
        let t;
        let n;
        if (e) {
            t = e.find(this.getSelector().itemSelector);
            n = e.find(".pagination-next").attr("href");
        } else {
            t = $(this.getSelector().itemSelector);
            n = $(".pagination-next").attr("href");
        }
        for (const i of t) {
            const e = $(i);
            const t = e.find("a").attr("href");
            const n = e.find(".video-title strong").text().trim();
            const s = e.find(".meta").text().trim();
            if (t && n) {
                try {
                    if (await storageManager.getCar(n)) {
                        show.info(`${n} 已存在, 跳过`);
                        continue;
                    }
                    await storageManager.saveCar({
                        carNum: n,
                        url: t,
                        names: null,
                        actionType: this.type,
                        publishTime: s,
                    });
                } catch (a) {
                    console.error(`保存失败 [${n}]:`, a);
                }
            }
        }
        if (n) {
            show.info("发现下一页，正在解析:", n);
            await new Promise((e) => setTimeout(e, 1000));
            $.ajax({
                url: n,
                method: "GET",
                success: (e) => {
                    const t = new DOMParser();
                    const n = $(t.parseFromString(e, "text/html"));
                    this.parseMovieList(n);
                },
                error: function (e) {
                    console.error(e);
                    show.error("加载下一页失败:" + e.message);
                },
            });
        } else {
            show.ok("导入结束!");
            window.refresh();
        }
    }
}
class FavoriteActressesPlugin extends BasePlugin {
    getName() {
        return "FavoriteActressesPlugin";
    }
    async handle() {
        this.bindEvent();
        await this.highlightActress();
        this.replaceActressAvatar();
    }
    async highlightActress() {
        if (!isDetailPage) {
            return;
        }
        if (
            (await storageManager.getSetting("enableFavoriteActresses", _)) !==
            _
        ) {
            return;
        }
        const e = await storageManager.getFavoriteActressList();
        if (!e || e.length === 0) {
            return;
        }
        const t = new Set();
        e.forEach((e) => {
            if (e.starId) {
                t.add(String(e.starId).trim());
            }
        });
        if (t.size !== 0) {
            $(".female")
                .prev()
                .each((e, n) => {
                    const a = $(n);
                    const i = a.attr("href");
                    let s = null;
                    if (i) {
                        const e = (i.endsWith("/") ? i.slice(0, -1) : i).split(
                            "/",
                        );
                        const t = e[e.length - 1];
                        if (t) {
                            s = t.trim();
                        }
                    }
                    let o = false;
                    if (s) {
                        o = t.has(s);
                    }
                    if (o) {
                        a.addClass("highlighted");
                        a.attr(
                            "title",
                            "高亮已收藏演员, 可在设置-基础配置中关闭",
                        );
                    }
                });
        }
    }
    async removeActorFromStorage(e) {
        if (await storageManager.removeFavoriteActress(e)) {
            clog.log("移除演员成功");
        }
    }
    bindEvent() {
        const e = /\/actors\/(\w+)\/(collect|uncollect)/;
        $(document).on(
            "confirm:complete",
            'a[href*="/actors/"][href*="/uncollect"]',
            async (t) => {
                const [n] = t.detail;
                if (!n) {
                    return;
                }
                const a = $(t.currentTarget).attr("href").match(e);
                const i = a ? a[1] : null;
                if (i) {
                    await this.removeActorFromStorage(i);
                }
            },
        );
        $("#button-collect-actor").click(async (t) => {
            const n = $("#button-collect-actor").attr("href").match(e);
            const a = n ? n[1] : null;
            let i = [];
            let s = $(".actor-section-name");
            if (s.length) {
                s.text()
                    .trim()
                    .split(",")
                    .forEach((e) => {
                        i.push(e.trim());
                    });
            }
            let o = $(".section-meta:not(:contains('影片'))");
            if (o.length) {
                o.text()
                    .trim()
                    .split(",")
                    .forEach((e) => {
                        i.push(e.trim());
                    });
            }
            if (!i) {
                clog.error("获取演员名称失败");
                return;
            }
            const r = i[0];
            if (!a) {
                clog.error("无法获取演员ID进行收藏操作。");
                return;
            }
            const l = (
                $(".avatar").first().css("background-image") || ""
            ).replace(/^url\(["']?|["']?\)$/g, "");
            const c = {
                starId: a,
                name: r,
                allName: i,
                avatar: l,
            };
            if ((await storageManager.addFavoriteActressList([c])) === 1) {
                clog.log(`收藏演员成功: ${r} (ID: ${a})`);
            } else {
                clog.log(`收藏演员失败: ${r} (ID: ${a})`);
            }
        });
        $("#button-uncollect-actor").click(async (t) => {
            const n = $("#button-uncollect-actor").attr("href").match(e);
            const a = n ? n[1] : null;
            if (a) {
                await this.removeActorFromStorage(a);
            } else {
                clog.error("无法获取演员ID进行取消收藏操作。");
            }
        });
    }
    async replaceActressAvatar() {
        const e = this.getActressId();
        if (!e) {
            return;
        }
        const t = (await storageManager.getFavoriteActressList()).find(
            (t) => t.starId === e,
        );
        if (t && t.avatar) {
            const e = `url('${t.avatar}')`;
            let n = $(".avatar").first();
            if (n.length === 0) {
                const e =
                    '<div class="column actor-avatar"> <div class="image"> <span class="avatar"></span> </div> </div>';
                $(".section-columns").prepend(e);
                n = $(".avatar").first();
            }
            if (n.length === 0) {
                return;
            }
            if (
                n.css("background-image").trim().toLowerCase() !==
                e.trim().toLowerCase()
            ) {
                n.css("background-image", e);
                n.css("background-size", "cover");
                n.css("background-position", "top center");
                n.css("background-repeat", "no-repeat");
            }
        }
    }
}
let at = parseInt(localStorage.getItem(nt) || "0", 10);
if (at >= tt.length || at < 0) {
    at = 0;
}
let it = tt[at].json;
let st = tt[at].base;
const lt = {
    db: null,
    async open() {
        if (this.db) {
            return this.db;
        } else {
            return new Promise((e, t) => {
                const n = indexedDB.open("GfriendsAvatarDB", 1);
                n.onupgradeneeded = (e) => {
                    this.db = e.target.result;
                    if (!this.db.objectStoreNames.contains(ot)) {
                        this.db.createObjectStore(ot);
                    }
                };
                n.onsuccess = (t) => {
                    this.db = t.target.result;
                    e(this.db);
                };
                n.onerror = (e) => {
                    console.error("IndexedDB open error:", e.target.errorCode);
                    t(new Error("Failed to open IndexedDB"));
                };
            });
        }
    },
    async get(e) {
        await this.open();
        return new Promise((t) => {
            const n = this.db
                .transaction([ot], "readonly")
                .objectStore(ot)
                .get(e);
            n.onsuccess = () => t(n.result);
            n.onerror = () => t(null);
        });
    },
    async set(e, t) {
        await this.open();
        return new Promise((n, a) => {
            const i = this.db
                .transaction([ot], "readwrite")
                .objectStore(ot)
                .put(t, e);
            i.onsuccess = () => n();
            i.onerror = (e) => {
                console.error("IndexedDB set error:", e.target.errorCode);
                a(new Error("Failed to write to IndexedDB"));
            };
        });
    },
};
let ct = null;
let dt = null;
function ht(e) {
    if (!e || !e.Content) {
        return null;
    }
    const t = {};
    const n = e.Content;
    for (const a in n) {
        const e = encodeURIComponent(a);
        for (const i in n[a]) {
            let s = i.replace(/\.jpg$/i, "").split("-")[0];
            if (s.startsWith("AI-Fix-")) {
                s = s.substring(7);
            }
            const o = s.toLowerCase().trim();
            if (o.length > 0) {
                const s = n[a][i];
                const r = s.indexOf("?");
                let l;
                let c = "";
                if (r > -1) {
                    l = encodeURIComponent(s.substring(0, r));
                    c = s.substring(r);
                } else {
                    l = encodeURIComponent(s);
                }
                const d = `${st}${e}/${l}${c}`;
                t[o] ||= [];
                if (!t[o].includes(d)) {
                    t[o].push(d);
                }
            }
        }
    }
    return t;
}
async function gt(e) {
    let t = loading();
    try {
        await (async function () {
            if (ct && dt) {
                return ct;
            }
            let e = null;
            try {
                e = await lt.get(rt);
            } catch (a) {
                console.error("读取 IndexedDB 失败:", a);
            }
            if (e && e.Content && ((ct = e), (dt = ht(e)), dt)) {
                return ct;
            }
            show.info("正在载入头像数据源...");
            const t = await fetch(it);
            if (!t.ok) {
                throw new Error(`请求头像源失败: ${t.status}`);
            }
            const n = await t.json();
            if (n && n.Content) {
                ct = n;
                dt = ht(n);
                try {
                    await lt.set(rt, n);
                    clog.debug("载入头像数据源并写入缓存成功!");
                } catch (a) {
                    clog.error(a);
                    show.error(
                        "头像数据源写入缓存失败，可能磁盘已满或其他权限问题。",
                    );
                }
                return ct;
            }
            console.log(n);
            throw new Error("解析头像数据源失败");
        })();
    } catch (i) {
        show.error(i);
        return [];
    } finally {
        t.close();
    }
    if (!dt) {
        return [];
    }
    const n = new Set();
    const a = e.map((e) => e.toLowerCase().trim()).filter((e) => e.length > 0);
    if (a.length === 0) {
        return [];
    }
    for (const s of a) {
        const e = dt[s];
        if (e) {
            e.forEach((e) => n.add(e));
        }
    }
    return Array.from(n);
}
class NewVideoPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "currentPage", 1);
        i(this, "pageSize", 30);
    }
    getName() {
        return "NewVideoPlugin";
    }
    async initCss() {
        return "\n            <style>\n                #actress-card-container {\n                    display: grid;\n                    grid-template-columns: repeat(auto-fill, minmax(243px, 1fr)); /* 响应式3-5列 */\n                    gap: 20px;\n                    padding-bottom: 20px;\n                    padding-right: 10px;\n                    background: #f9f9f9;\n                    border-radius: 5px;\n                    overflow-y: auto;\n                }\n                .actress-card {\n                    background: #fff;\n                    border: 1px solid #e0e0e0;\n                    border-radius: 8px;\n                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);\n                    padding: 15px;\n                    text-align: center;\n                    display: flex;\n                    flex-direction: column;\n                    justify-content: space-between;\n                    position: relative;\n                    overflow: hidden;\n                }\n                .actress-card:hover {\n                    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);\n                }\n                .actress-card-name {\n                    font-size: 1.2em;\n                    font-weight: bold;\n                    color: #007bff;\n                    margin-top: 10px;\n                }\n                .actress-card-allname {\n                    font-size: 0.9em;\n                    color: #999;\n                    margin-top: 5px;\n                    height: 30px; /* 保证高度一致性 */\n                    overflow: hidden;\n                    white-space: nowrap;      /* 防止文字换行 */\n                    text-overflow: ellipsis;  /* 当文本溢出时，显示省略号 */\n                }\n                .actress-card-avatar {\n                    width: 100px;\n                    height: 100px;\n                    border-radius: 50%;\n                    object-fit: contain;\n                    margin: 0 auto;\n                    border: 4px solid #f0f0f0;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n                }\n                \n                .card-tag {\n                    position: absolute;\n                    top: 15px; /* 调整标签距离顶部的距离 */\n                    right: -50px; /* 调整标签距离右侧的距离，负值让它移到外面一点 */\n                    \n                    width: 150px; /* 标签的宽度，影响斜角长度 */\n                    padding: 5px 0; /* 上下内边距 */\n                    text-align: center;\n                    \n                    background-color: #ff4757; /* 标签颜色 */\n                    color: white; /* 文字颜色 */\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10; /* 确保标签在其他内容之上 */\n                \n                    /* 3. 核心：旋转标签，使其倾斜 */\n                    transform: rotate(45deg); /* 45度斜角 */\n                    \n                    /* 可选：添加一些阴影或边框效果 */\n                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);\n                }\n                \n                .card-new-count-tag {\n                    position: absolute;\n                    top: 5px;\n                    text-align: center;\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10;\n                }\n                \n                #actress-pagination {\n                    padding-top: 10px;\n                    text-align: center;\n                    border-top: 1px solid #ddd;\n                }\n                @media (max-width: 600px) {\n                    .page-number-btn {\n                        display: none !important;\n                    }\n                }\n                \n                \n                .card-btn {\n                    width: 44px;\n                    height: 44px;\n                    border-radius: 50%;\n                    display: flex;\n                    justify-content: center;\n                    align-items: center;\n                    text-decoration: none;\n                    border: none;\n                    cursor: pointer;\n                    background: linear-gradient(145deg, #e0e0e0 0%, #f7f7f7 100%);\n                    box-shadow: 8px 8px 16px rgba(0, 0, 0, 0.08),\n                                -8px -8px 16px rgba(255, 255, 255, 1.0);\n                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);\n                }\n                \n                .card-btn svg,\n                .card-btn svg path {\n                    transition: fill 0.3s ease;\n                }\n                \n                .card-btn:hover {\n                    box-shadow: inset 5px 5px 10px rgba(0, 0, 0, 0.1),\n                                inset -5px -5px 10px rgba(255, 255, 255, 0.9);\n                    transform: scale(0.97);\n                    background: #e0e0e0;\n                }\n                \n                .btn-check-actress svg path {\n                    fill: #4CAF50;\n                }\n                .btn-check-actress:hover svg path {\n                    fill: #388E3C;\n                }\n                \n                .btn-edit-actress svg path {\n                    fill: #FFC107;\n                }\n                .btn-edit-actress:hover svg path {\n                    fill: #FFB300;\n                }\n                \n                .btn-delete-actress svg path {\n                    fill: #F44336;\n                }\n                .btn-delete-actress:hover svg path {\n                    fill: #D32F2F;\n                }\n            </style>\n        ";
    }
    async handle() {
        await this.showNewVideoCount();
    }
    async showNewVideoCount() {
        const e = (await storageManager.getFavoriteActressList()).reduce(
            (e, t) => {
                var n;
                return (
                    e +
                    (((n = t.newVideoList) == null ? undefined : n.length) ?? 0)
                );
            },
            0,
        );
        $("#newVideoCount").text(`${e}`);
    }
    async resetBtnTip() {}
    async openDialog() {
        let o = `\n            <div class="newVideoToolBox" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; padding:10px">\n                <div style="margin-bottom: 15px;display: flex; justify-content: space-between;">\n                    <div>\n                        <span id="checkNewVideoMsg"></span>\n                    </div>\n                    <div style="display: flex; align-items: flex-start;">\n                        <select id="paramActressType" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="all" selected>所有</option>\n                            <option value="uncensored">无码</option>\n                            <option value="censored">有码</option>\n                            <option value="">未知</option>\n                        </select>\n                        \n                        <a class="a-normal" id="reLoad">${this.refreshSvg} &nbsp;&nbsp; 刷新</a>\n                    </div>\n\n                </div>\n                <div id="actress-card-container" class="jhs-scrollbar"></div>\n                <div id="actress-pagination"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: '<span style="padding: 0 10px;" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测 ❓</span>',
            content: o,
            scrollbar: false,
            area: utils.getResponsiveArea(["80%", "90%"]),
            anim: -1,
            success: async (e, t) => {
                this.loadData();
                this.bindClick();
                utils.setupEscClose(t);
            },
        });
    }
    bindClick() {
        $("#reLoad").on("click", (e) => {
            this.loadData();
            $("#checkNewVideoMsg").text("");
        });
        $("#paramActressType").on("change", (e) => {
            this.loadData();
        });
    }
    loadData() {
        this.currentPage = 1;
        this.renderActressCards().then();
    }
    async renderActressCards() {
        const e = $("#actress-card-container");
        if (!e.length) {
            return;
        }
        let t = await storageManager.getFavoriteActressList();
        const n = $("#paramActressType").val();
        if (n !== "all") {
            t = t.filter((e) => e.actressType === n);
        }
        const a = utils.genericSort(t, [
            {
                key: (e) => {
                    var t;
                    return (
                        ((t = e.newVideoList) == null ? undefined : t.length) ??
                        0
                    );
                },
                order: "desc",
            },
            {
                key: "lastPublishTime",
                order: "desc",
            },
        ]);
        const i = a.length;
        const s = Math.ceil(i / this.pageSize);
        const o = (this.currentPage - 1) * this.pageSize;
        const r = o + this.pageSize;
        const l = a.slice(o, r);
        const c = await this.getBean("OtherSitePlugin").getJavDbUrl();
        const h =
            (await storageManager.getSetting("checkNewVideo_ruleTime")) || 8760;
        const g = l
            .map((e) => {
                var t;
                var n;
                const a = Array.isArray(e.allName) ? e.allName.join("，") : "";
                if (Array.isArray(e.newVideoList)) {
                    e.newVideoList.join("，");
                }
                const i = `${c}/actors/${e.starId}?t=d`;
                let s = false;
                if (e.lastPublishTime) {
                    s = !utils.isUnnecessaryCheck(e.lastPublishTime, h);
                }
                let o = "未知";
                let r = "#9E9E9E";
                if (e.actressType === A) {
                    o = "无码";
                    r = "#4CAF50";
                } else if (e.actressType === D) {
                    o = "有码";
                    r = "#FF9800";
                }
                let l = "";
                if (s) {
                    l =
                        "background: linear-gradient(145deg, #e0e0e0 0%, #cabdbd 100%);box-shadow: none";
                }
                return `\n                <div class="actress-card" data-starId="${e.starId}" style="${s ? "background: #d4cece;" : ""} min-height: 370px;">\n                    <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                        <img src="${e.avatar || "https://c0.jdbstatic.com/images/actor_unknow.jpg"}" alt="${a}" class="actress-card-avatar">\n                    </a>\n\n                    <div>\n                        <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                            <div class="actress-card-name">${e.name}</div>\n                        </a>\n                        <div class="actress-card-allname" title="${a}">${a}</div>\n                    </div>\n                    \n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>上次检测: ${e.lastCheckTime || ""}</span>\n                    </div>\n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>最后发行作品: ${e.lastPublishTime || ""}</span>\n                    </div>\n\n                    <div style="font-size: 0.7em; color: #cc4444; margin-top: 5px; min-height: 18px">\n                         <span>${s ? "停更" + h / 24 / 365 + "年以上, 下轮任务不再进行检测" : ""}</span>\n                    </div>\n                    \n                    <div style="font-size: 0.8em; margin-top: 5px; color: #3765c5; min-height: 10px">\n                         <span>${e.remark || ""}</span>\n                    </div>\n                    \n                    <div style="margin-top: 10px;display: flex; justify-content:center; gap: 10px;">\n                        <a title="编辑" class="card-btn btn-edit-actress" style="${l}" data-starId="${e.starId}">${this.editSvg}</a>\n                        <a title="取消收藏" class="card-btn btn-delete-actress" style="${l}" data-starId="${e.starId}">${this.deleteSvg}</a>\n                    </div>\n                    \n                    <div class="card-tag" style="background-color:${r}">${o}</div>\n                    <div class="card-new-count-tag" data-tip="最新作品数量: ${((t = e.newVideoList) == null ? undefined : t.length) || 0}">🔔 ${((n = e.newVideoList) == null ? undefined : n.length) || 0}</div>\n                </div>\n            `;
            })
            .join("");
        e.html(g);
        $(".btn-delete-actress")
            .off("click")
            .on("click", (e) => {
                e.preventDefault();
                const t = $(e.currentTarget).attr("data-starId");
                const n = a.find((e) => e.starId === t);
                utils.q(e, `是否取消收藏 ${n.name}?`, async () => {
                    let e = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${t}/uncollect`;
                    const n = document.querySelector(
                        "meta[name=csrf-token]",
                    ).content;
                    const a = await gmHttp.post(e, null, {
                        "x-csrf-token": n,
                    });
                    if (a.includes("removeClass")) {
                        await storageManager.removeFavoriteActress(t);
                        this.loadData();
                    } else {
                        show.error("移除失败");
                        clog.error("移除失败,返回值:", a);
                    }
                });
            });
        $(".btn-edit-actress")
            .off("click")
            .on("click", (e) => {
                e.preventDefault();
                const t = $(e.currentTarget).attr("data-starId");
                const n = a.find((e) => e.starId === t);
                if (n) {
                    this.editActress(n);
                } else {
                    show.error(`未找到 starId 为 ${t} 的女优记录。`);
                }
            });
        this.renderPagination(i, s);
        show.ok("加载完成");
    }
    async editActress(e) {
        const t = e.name;
        const n = e.avatar;
        const a = e.remark || "";
        const i = Array.isArray(e.allName) ? e.allName.join("，") : "";
        const s = Array.isArray(e.newVideoList)
            ? e.newVideoList.join("，")
            : "";
        const o = e.starId;
        const r =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;";
        const l = e.actressType || "";
        const c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px; text-align: center;">\n                    <img id="edit-avatar-preview" src="${n}" alt="Avatar Preview" \n                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid #ddd;">\n                    <div style="text-align: left">\n                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${n}" \n                               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                       <div style="display: flex; gap: 5px; margin-top: 5px;">\n                            <button type="button" id="search-avatar-btn" \n                                style="flex-grow: 1; padding: 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                style="width: 100px; padding: 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${t}" \n                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" style="${r}">${i}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员类别:</label>\n                    <select id="actressType" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${l === "" ? "selected" : ""}>未知</option>\n                        <option value="censored" ${l === "censored" ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${l === "uncensored" ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" style="${r}">${s}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                   <textarea id="edit-remark" style="${r}">${a}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑女优: ${t} (${o})`,
            area: ["500px", "750px"],
            content: c,
            btn: ["保存", "取消"],
            success: (e, t) => {
                const n = (e) => {
                    e.css("height", "auto");
                    e.css("height", e[0].scrollHeight + 15 + "px");
                };
                $("#edit-actress-avatar").on("input", function () {
                    const e = $(this).val();
                    $("#edit-avatar-preview").attr("src", e);
                });
                const a = $("#edit-actress-allname");
                a.on("input", function () {
                    n($(this));
                });
                n(a);
                const i = $("#edit-actress-newvideolist");
                i.on("input", function () {
                    n($(this));
                });
                n(i);
                $("#search-avatar-btn").on("click", async () => {
                    await this.searchAvatar();
                });
                $("#select-cdn-btn").on("click", async () => {
                    await (async function () {
                        const e = at;
                        const t = tt
                            .map(
                                (t, n) =>
                                    `\n        <div style="margin-bottom: 10px;">\n            <input type="radio" id="cdn-${n}" name="cdn-source" value="${n}" ${n === e ? "checked" : ""} style="margin-right: 10px;">\n            <label for="cdn-${n}">${t.name} ${t.json.includes("jsdelivr") ? "(推荐)" : ""}</label>\n        </div>\n    `,
                            )
                            .join("");
                        const n = `\n        <div style="padding: 20px;">\n            <p style="margin-bottom: 15px; font-weight: bold; color: #333;">请选择头像数据源 (当前: ${tt[e].name}):</p>\n            ${t}\n            <p style="margin-top: 20px; color: #555; font-size: 12px;">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>\n        </div>\n    `;
                        layer.open({
                            type: 1,
                            title: "选择 CDN 源",
                            area: ["400px", "auto"],
                            content: n,
                            btn: ["确定", "取消"],
                            success: (e, t) => {
                                utils.setupEscClose(t);
                            },
                            yes: async (e) => {
                                const t = $(
                                    'input[name="cdn-source"]:checked',
                                ).val();
                                const n = parseInt(t, 10);
                                if (n !== at) {
                                    at = n;
                                    localStorage.setItem(nt, n.toString());
                                    it = tt[n].json;
                                    st = tt[n].base;
                                    ct = null;
                                    dt = null;
                                    try {
                                        await lt.set(rt, null);
                                    } catch (a) {
                                        clog.error(
                                            "清除 IndexedDB 缓存失败:",
                                            a,
                                        );
                                    }
                                    show.ok(`CDN 源已切换为: ${tt[n].name}`);
                                    layer.close(e);
                                } else {
                                    layer.close(e);
                                }
                            },
                        });
                    })();
                });
                utils.setupEscClose(t);
            },
            yes: async (t) => {
                const n = $("#edit-actress-avatar").val().trim();
                const a = $("#edit-actress-name").val().trim();
                const i = $("#edit-actress-allname").val().trim();
                const s = $("#edit-actress-newvideolist").val().trim();
                const o = $("#edit-remark").val().trim();
                const r = $("#actressType").val();
                if (!a) {
                    show.error("主名称不能为空");
                    return false;
                }
                const l = i
                    .split(/[\uff0c,]/)
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0);
                const c = s
                    .split(/[\uff0c,]/)
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0);
                e.avatar = n;
                e.name = a;
                e.allName = l;
                e.newVideoList = c;
                e.actressType = r;
                e.remark = o;
                if (await storageManager.updateFavoriteActress(e)) {
                    show.error("修改失败");
                } else {
                    this.renderActressCards().then();
                    show.ok(`女优 ${a} 信息已更新`);
                    layer.close(t);
                }
            },
        });
    }
    renderPagination(e, t) {
        const n = this.currentPage;
        let a = "";
        const i = $("#actress-pagination");
        if (t === 0) {
            a = '<span style="color: #666;">共 0 条记录</span>';
            i.html(a);
            return;
        }
        if (n > 1 && t > 5) {
            a +=
                '<button class="pagination-btn" data-page="1" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">首页</button>';
        }
        if (n > 1) {
            a += `<button class="pagination-btn" data-page="${n - 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        let s = Math.max(1, n - Math.floor(2.5));
        let o = Math.min(t, s + 5 - 1);
        if (o - s < 4) {
            s = Math.max(1, o - 5 + 1);
        }
        for (let r = s; r <= o; r++) {
            a += `<button class="pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}" style="padding: 8px 12px; margin: 0 3px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; ${r === n ? "background: #007bff; color: white; border-color: #007bff;" : ""}">${r}</button>`;
        }
        if (n < t) {
            a += `<button class="pagination-btn" data-page="${n + 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        if (n < t && t > 5) {
            a += `<button class="pagination-btn" data-page="${t}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">尾页</button>`;
        }
        a += `<span style="margin-left: 20px; color: #666;">共 ${e} 条记录 (第 ${n}/${t} 页)</span>`;
        i.html(a);
        $(".pagination-btn")
            .off("click")
            .on("click", (e) => {
                if ($(e.currentTarget).is("[disabled]")) {
                    return;
                }
                const n = parseInt($(e.currentTarget).data("page"));
                if (n >= 1 && n <= t && n !== this.currentPage) {
                    this.currentPage = n;
                    this.renderActressCards();
                }
            });
    }
    async searchAvatar() {
        const e = $("#edit-actress-name");
        const t = $("#edit-actress-allname");
        const n = e.val().trim();
        const a = t
            .val()
            .trim()
            .split(/[\uff0c,]/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
        if (n) {
            a.unshift(n);
        }
        if (a.length === 0) {
            show.error("请先填写女优主名称或别名进行搜索。");
            return;
        }
        const i = loading("正在搜索头像...");
        let s = [];
        try {
            s = await gt(a);
        } catch (c) {
            show.error(`头像数据加载或搜索失败: ${c.message || c}`);
            return;
        } finally {
            i.close();
        }
        if (s.length === 0) {
            show.error(`未找到与 '${a.join("、")}' 相关的头像。请检查名称。`);
            return;
        }
        const o = s
            .map(
                (e, t) =>
                    `\n        <div id="wrapper-${t}" class="gfriends-image-item-wrapper">\n            <img alt="" src="${e}" data-url="${e}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${t}" >\n            <div class="gfriends-size-tag" data-size-for="wrapper-${t}">...</div> \n        </div>\n    `,
            )
            .join("");
        const r = `\n        <style>\n            /* 保持上一个回答的美化样式 */\n            #gfriends-image-list-container { padding: 15px; height: 100%; box-sizing: border-box; background-color: #f8f9fa; }\n            #gfriends-prompt { color: #555; font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 10px; }\n            #gfriends-image-list { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }\n            .gfriends-image-item-wrapper {\n                width: 160px; height: 225px; /* 增加高度以容纳尺寸标签 */\n                overflow: hidden; border-radius: 6px;\n                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;\n                cursor: pointer; position: relative; \n                padding-bottom: 25px; /* 为尺寸标签留出空间 */\n            }\n            .gfriends-selectable-img {\n                width: 100%; height: 200px; /* 固定图片高度 */\n                object-fit: cover; border: 3px solid transparent; \n                border-radius: 6px; transition: border 0.2s ease;\n            }\n            .gfriends-image-item-wrapper:hover {\n                transform: translateY(-4px) scale(1.02);\n                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);\n            }\n            .gfriends-selectable-img.is-selected {\n                border-color: #ff6347;\n                box-shadow: 0 0 0 3px #ff6347;\n            }\n            /* 新增：尺寸标签样式 */\n            .gfriends-size-tag {\n                position: absolute;\n                bottom: 0; /* 定位到图片容器底部 */\n                left: 0;\n                right: 0;\n                height: 25px;\n                line-height: 25px;\n                text-align: center;\n                background-color: rgba(0, 0, 0, 0.7); /* 半透明背景 */\n                color: #fff;\n                font-size: 11px;\n                font-weight: bold;\n                border-bottom-left-radius: 6px;\n                border-bottom-right-radius: 6px;\n                user-select: none;\n            }\n        </style>\n        \n        <div id="gfriends-image-list-container">\n            <p id="gfriends-prompt" style="text-align: center; font-size: 15px; margin-bottom: 15px;">\n                点击图片即可选择（初始共 ${s.length} 张）\n            </p>\n            <div style="overflow-y: auto; height: calc(100% - 40px);">\n                <div id="gfriends-image-list">\n                    ${o}\n                </div>\n            </div>\n        </div>\n    `;
        let l = 0;
        layer.open({
            type: 1,
            title: `选择女优头像 (${s.length} 张)`,
            area: utils.getResponsiveArea(["900px", "85%"]),
            content: r,
            btn: ["关闭"],
            success: (e, t) => {
                const n = $(e);
                const a = n.find(".gfriends-selectable-img");
                const i = n.find("#gfriends-prompt");
                a.each(function () {
                    const e = $(this);
                    const a = e.data("wrapper-id");
                    const o = n.find(`#${a}`);
                    const r = n.find(
                        `.gfriends-size-tag[data-size-for="${a}"]`,
                    );
                    e.on("load", function () {
                        const e = this.naturalWidth;
                        const t = this.naturalHeight;
                        r.text(`${e} x ${t}`);
                    });
                    e.on("error", function () {
                        o.remove();
                        l++;
                        const e = s.length - l;
                        i.text(
                            `点击图片即可选择（已移除 ${l} 张错误图片，剩余 ${e} 张）`,
                        );
                        if (e === 0) {
                            show.error(
                                "所有搜索到的头像链接均已失效，无法选择。",
                            );
                            layer.close(t);
                        }
                    });
                    if (this.complete) {
                        if (this.naturalWidth > 0) {
                            e.trigger("load");
                        } else {
                            e.trigger("error");
                        }
                    }
                });
                a.on("click", function () {
                    const e = $(this);
                    const n = e.data("url");
                    $("#edit-actress-avatar").val(n);
                    $("#edit-avatar-preview").attr("src", n);
                    a.removeClass("is-selected");
                    e.addClass("is-selected");
                    setTimeout(() => {
                        layer.close(t);
                    }, 150);
                });
                utils.setupEscClose(t);
            },
        });
    }
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
