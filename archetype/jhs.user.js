// ==UserScript==
// @name         鉴黄师
// @version      1.0
// @description  Jav-鉴黄师 收藏、屏蔽; 屏蔽标签、屏蔽演员、同步收藏演员、新作品检测; 免VIP查看热播、Top250排行榜、Fc2ppv、可查看所有评论信息、相关清单; 支持云盘备份; 以图识图; 字幕搜索; JavDb|JavBus
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @match        https://javdb.com/*
// @include      https://javdb*.com/*
// @require      https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js
// @require      https://cdn.jsdelivr.net/npm/blueimp-md5@2.19.0/js/md5.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.js
// @require      https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
// @connect      xunlei.com
// @connect      missav.live
// @connect      javdb.com
// @connect      supjav.com
// @connect      adult.contents.fc2.com
// @connect      fc2ppvdb.com
// @connect      127.0.0.1
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

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
const o = window.location.href;
const r = o.includes("javdb");
const l =
    o.includes("javbus") ||
    o.includes("seejav") ||
    o.includes("bus") ||
    o.includes("javsee") ||
    $("title").text().trim().startsWith("JavBus - AV");
const c =
    o.includes("/search?q") || o.includes("/search/") || o.includes("/users/");
const d = "filter";
const h = "favorite";
const p = "hasWatch";
const m = "🚫 屏蔽";
const u = "🚫 已屏蔽";
const f = "#de3333";
const v = "⭐ 收藏";
const b = "⭐ 已收藏";
const w = "#25b1dc";
const k = "🔍 已观看";
const S = "#d7a80c";
const C = "no";
const _ = "yes";
const T = "javdb";
const I = "javbus";
const B = "actor";
const P = "actress";
const D = "censored";
const A = "uncensored";
const L = [
    {
        id: "video-mhb",
        quality: "dmb_w",
        text: "旧视频源-中画质宽版 (404p)",
        canSelect: false,
    },
    {
        id: "video-mhb",
        quality: "sm_s",
        text: "旧视频源-低画质 (240p)",
        canSelect: false,
    },
    {
        id: "video-mhb",
        quality: "dm_s",
        text: "旧视频源-中画质 (360p)",
        canSelect: false,
    },
    {
        id: "video-mhb",
        quality: "dmb_s",
        text: "旧视频源-中画质 (480p)",
        canSelect: false,
    },
    {
        id: "video-mhb",
        quality: "mhb_w",
        text: "旧视频源-高画质宽版 (404p)",
        canSelect: false,
    },
    {
        id: "video-mmb",
        quality: "mmb",
        text: "中画质 (432p)",
        canSelect: true,
    },
    {
        id: "video-mhb",
        quality: "mhb",
        text: "高画质 (576p)",
        canSelect: true,
    },
    {
        id: "video-hmb",
        quality: "hmb",
        text: "HD (720p)",
        canSelect: true,
    },
    {
        id: "video-hhb",
        quality: "hhb",
        text: "FullHD (1080p)",
        canSelect: true,
    },
    {
        id: "video-hhbs",
        quality: "hhbs",
        text: "FullHD (1080p60fps)",
        canSelect: true,
    },
    {
        id: "video-4k",
        quality: "4k",
        text: "4K (2160p)",
        canSelect: true,
    },
    {
        id: "video-4ks",
        quality: "4ks",
        text: "4K (2160p60fps)",
        canSelect: true,
    },
];
let M = "";
if (window.location.href.includes("hideNav=1")) {
    M =
        "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    ";
}
const N = `\n<style>\n    .top-bar {\n        z-index: 12345689 !important;\n    }\n    \n    ${M}\n\n    .masonry {\n        height: 100% !important;\n        width: 100% !important;\n        padding: 0 15px !important;\n    }\n    .masonry {\n        display: grid;\n        column-gap: 10px; /* 列间距*/\n        row-gap: 10px; /* 行间距 */\n        grid-template-columns: repeat(4, minmax(0, 1fr));\n        align-items: start;\n    }\n    .masonry .item {\n        /*position: initial !important;*/\n        top: initial !important;\n        left: initial !important;\n        float: none !important;\n        background-color:#c4b1b1;\n        position: relative !important;\n    }\n    \n    .masonry .item:hover {\n        box-shadow: 0 .5em 1em -.125em rgba(10, 10, 10, .1), 0 0 0 1px #485fc7;\n    }\n    .masonry .movie-box{\n        width: 100% !important;\n        height: 100% !important;\n        margin: 0 !important;\n        overflow: inherit !important;\n    }\n    .masonry .movie-box .photo-frame {\n        /*height: 70% !important;*/\n        height:auto !important;\n        margin: 0 !important;\n        position:relative; /* 方便预览视频定位*/\n    }\n    .masonry .movie-box img {\n        max-height: 500px;\n        height: 100% !important;\n        object-fit: contain;\n        object-position: top;\n    }\n    .masonry .movie-box img:hover {\n      transform: scale(1.04);\n      transition: transform 0.3s;\n    }\n    .masonry .photo-info{\n        /*height: 30% !important;*/\n    }\n    .masonry .photo-info span {\n      display: inline-block; /* 或者 block */\n      max-width: 100%;      /* 根据父容器限制宽度 */\n      white-space: nowrap;  /* 禁止换行 */\n      overflow: hidden;     /* 隐藏溢出内容 */\n      text-overflow: ellipsis; /* 显示省略号 */\n    }\n    \n    /* 无码页面的样式 */\n    .photo-frame .mheyzo,\n    .photo-frame .mcaribbeancom2{\n        margin-left: 0 !important;\n    }\n    .avatar-box{\n        width: 100% !important;\n        display: flex !important;\n        margin:0 !important;\n    }\n    .avatar-box .photo-info{\n        display: flex;\n        justify-content: center;\n        align-items: center;\n        gap: 30px;\n        flex-direction: row;\n        background-color:#fff !important;\n    }\n    \n    footer{\n        display: none!important;\n    }\n    \n        \n    .video-title {\n        white-space: normal !important;\n        height: 75px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box !important; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n\n    \n</style>\n`;
let j = "";
if (window.location.href.includes("hideNav=1")) {
    j =
        "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ";
}
const E = `\n<style>\n    ${j}\n    \n    .navbar {\n        z-index: 12345679 !important;\n        padding: 0 0;\n    }\n    \n    .navbar-link:not(.is-arrowless) {\n        padding-right: 33px;\n    }\n    \n    .sub-header,\n    /*#search-bar-container, !*搜索框*!*/\n    #footer,\n    /*.search-recent-keywords, !*搜索框底部热搜词条*!*/\n    .app-desktop-banner,\n    div[data-controller="movie-tab"] .tabs,\n    h3.main-title,\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3), /* 相关清单*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2), /* 短评按钮*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1), /*磁力面板 按钮*/\n    .top-meta,\n    .float-buttons {\n        display: none !important;\n    }\n    \n    div.tabs.no-bottom,\n    .tabs ul {\n        border-bottom: none !important;\n    }\n    \n    \n    /* 视频列表项 相对相对 方便标签绝对定位*/\n    .movie-list .item {\n        position: relative !important;\n    }\n    \n    .video-title {\n        white-space: normal !important;\n        height: 80px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n    \n    /* 列表页顶部分类自适应 */\n    .main-tabs, .tabs {\n        overflow-x:hidden;\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n    \n    .main-tabs ul, .tabs ul {\n        flex-wrap: wrap;\n        flex-grow: 0;\n    }\n    \n    \n    /* 二级工具栏 大小封面,可播放,含磁链...*/\n    .toolbar {\n        display: flex;\n    }\n\n</style>\n`;
const F = `\n<style>\n    /* 全局通用样式 */\n    .fr-btn {\n        float: right;\n        margin-left: 4px !important;\n    }\n    \n    .menu-box {\n        position: fixed;\n        right: 10px;\n        top: 50%;\n        transform: translateY(-50%);\n        display: flex;\n        flex-direction: column;\n        z-index: 1000;\n        gap: 6px;\n    }\n    \n    .menu-btn {\n        display: inline-block;\n        min-width: 80px;\n        padding: 7px 12px;\n        border-radius: 4px;\n        color: white !important;\n        text-decoration: none;\n        font-weight: bold;\n        font-size: 12px;\n        text-align: center;\n        cursor: pointer;\n        transition: all 0.3s ease;\n        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);\n        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);\n        border: none;\n        line-height: 1.3;\n        margin: 0;\n    }\n    \n    .menu-btn:hover {\n        transform: translateY(-1px);\n        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);\n        opacity: 0.9;\n    }\n    \n    .menu-btn:active {\n        transform: translateY(0);\n        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n    }\n    \n    .do-hide {\n        display: none !important;\n    }\n    \n    .main-tab-btn {\n        border-bottom:none !important; \n        border-radius:3px !important; \n        height: 30px; \n        margin-left: 5px !important; \n    }\n\n    .jhs-icon {\n        width: 16px;\n        height: 16px;\n    }\n    \n    .tool-box .jhs-icon {\n        width: 1.5rem;\n        height: 1.5rem; \n    }\n     \n    \n    /*表格内按钮溢出,防止被隐藏*/\n    .tabulator .tabulator-row .action-cell-dropdown {\n        overflow: visible !important;\n    }\n    /* 去除行内鼠标小手*/\n    .tabulator .tabulator-row.tabulator-selectable:hover {\n        cursor: default !important;\n    }\n    \n    /* 排序小箭头颜色 */\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-arrow {\n        border-bottom-color: #337ab7 !important;\n    }\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-arrow {\n        border-top-color: #337ab7 !important;\n    }\n    \n    /* 针对折叠行的容器或内容进行样式修改 */\n    .tabulator-responsive-collapse {\n        border-top: none !important;\n    }\n    \n    .tabulator-responsive-collapse table{\n        margin-left: 50px !important;\n    }\n    \n    .tabulator-cell {\n        height:auto !important;\n    }\n    \n    /* 列允许换行,去除省略号 */\n    .tabulator .tabulator-cell {\n        white-space: normal !important; \n        text-overflow: clip !important; \n    }\n    \n    .tabulator-tableholder {\n        overflow-x: hidden !important;\n    }\n\n    ${(function () {
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
})()}\n</style>\n`;
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
H(
    "\n<style>\n    .a-normal, /* 白色 */\n    .a-primary, /* 浅蓝色 */\n    .a-success, /* 浅绿色 */\n    .a-danger, /* 浅粉色 */\n    .a-warning, /* 浅橙色 */\n    .a-info /* 灰色 */\n    {\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        padding: 6px 14px;\n        margin-right: 10px;\n        border-radius: 6px;\n        text-decoration: none;\n        font-size: 13px;\n        font-weight: 500;\n        transition: all 0.2s ease;\n        cursor: pointer;\n        border: 1px solid rgba(0, 0, 0, 0.08);\n        white-space: nowrap;\n    }\n    \n    .a-primary {\n        background: #e0f2fe;\n        color: #0369a1;\n        border-color: #bae6fd;\n    }\n    \n    .a-primary:hover {\n        background: #bae6fd;\n    }\n    \n    .a-success {\n        background: #dcfce7;\n        color: #166534;\n        border-color: #bbf7d0;\n    }\n    \n    .a-success:hover {\n        background: #bbf7d0;\n    }\n    \n    .a-danger {\n        background: #fee2e2;\n        color: #b91c1c;\n        border-color: #fecaca;\n    }\n    \n    .a-danger:hover {\n        background: #fecaca;\n    }\n    \n    .a-warning {\n        background: #ffedd5;\n        color: #9a3412;\n        border-color: #fed7aa;\n    }\n    \n    .a-warning:hover {\n        background: #fed7aa;\n    }\n    \n    .a-info {\n        background: #e2e8f0;\n        color: #334155;\n        border-color: #cbd5e1;\n    }\n    \n    .a-info:hover {\n        background: #cbd5e1;\n    }\n    \n    .a-normal {\n        background: transparent;\n        color: #64748b;\n        border-color: #cbd5e1;\n    }\n    \n    .a-normal:hover {\n        background: #f8fafc;\n    }\n</style>\n",
);
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
let z = class n {
    constructor() {
        var t;
        var s;
        var o;
        t = this;
        if ((s = e).has(t)) {
            a("Cannot add the same private member more than once");
        } else if (s instanceof WeakSet) {
            s.add(t);
        } else {
            s.set(t, o);
        }
        i(this, "car_list_key", "car_list");
        i(this, "filter_keyword_title_key", "filter_keyword_title");
        i(this, "filter_keyword_review_key", "filter_keyword_review");
        i(this, "setting_key", "setting");
        i(this, "blacklist_key", "blacklist");
        i(this, "blacklist_car_list_key", "blacklist_car_list");
        i(this, "favorite_actresses_key", "favorite_actresses");
        i(this, "highlighted_tags_key", "highlighted_tags");
        i(
            this,
            "forage",
            localforage.createInstance({
                driver: localforage.INDEXEDDB,
                name: "JAV-JHS",
                version: 1,
                storeName: "appData",
            }),
        );
        i(this, "cache_filter_actor_actress_car_list", null);
        i(this, "cacheSettingObj", null);
        if (n.instance) {
            throw new Error("StorageManager已被实例化过了!");
        }
        n.instance = this;
    }
    async getCarList() {
        return (await this.forage.getItem(this.car_list_key)) || [];
    }
    async getCar(e) {
        return (await this.getCarList()).find((t) => t.carNum === e);
    }
    _saveSingleCar(e, t) {
        let {
            carNum: n,
            url: a,
            names: i,
            actionType: s,
            publishTime: o,
            starId: r,
            score: c,
        } = e;
        if (!n) {
            show.error("番号为空!");
            throw new Error("番号为空!");
        }
        if (!a) {
            show.error("url为空!");
            throw new Error("url为空!");
        }
        if (!a.includes("http")) {
            a = window.location.origin + a;
        }
        i &&= i.trim();
        let l = t.find((e) => e.carNum === n);
        if (l) {
            if (i) {
                l.names = i;
            }
            if (a) {
                l.url = a;
            }
            if (o) {
                l.publishTime = o;
            }
            if (c !== undefined) {
                l.score = c;
            }
            l.updateDate = utils.getNowStr();
        } else {
            let e = utils.getNowStr();
            l = {
                carNum: n,
                url: a,
                names: i,
                status: "",
                createDate: e,
                updateDate: e,
                publishTime: o,
            };
            if (r) {
                l.starId = r;
            }
            if (c !== undefined) {
                l.score = c;
            }
            t.push(l);
        }
        switch (s) {
            case d:
                if (l.status === d) {
                    const e = `${n} 已在屏蔽列表中`;
                    show.error(e);
                    throw new Error(e);
                }
                l.status = d;
                break;
            case h:
                if (l.status === h) {
                    const e = `${n} 已在收藏列表中`;
                    show.error(e);
                    throw new Error(e);
                }
                l.status = h;
                break;
            case p:
                l.status = p;
                break;
            default:
                const e = "actionType错误, 请联系作者更正: " + s;
                show.error(e);
                throw new Error(e);
        }
    }
    async saveCar(e) {
        const t = (await this.forage.getItem(this.car_list_key)) || [];
        this._saveSingleCar(e, t);
        await this.forage.setItem(this.car_list_key, t);
        await this.removeNewVideoList([e.carNum]);
    }
    async updateCarInfo(e) {
        let {
            carNum: t,
            url: n,
            names: a,
            actionType: i,
            publishTime: s,
            remark: o,
        } = e;
        if (!t) {
            show.error("番号为空!");
            throw new Error("番号为空!");
        }
        if (!n) {
            show.error("url为空!");
            throw new Error("url为空!");
        }
        a &&= a.trim();
        const r = (await this.forage.getItem(this.car_list_key)) || [];
        let l = r.find((e) => e.carNum === t);
        if (!l) {
            const e = "数据不存在: " + t;
            show.error(e);
            throw new Error(e);
        }
        l.names = a;
        l.url = n;
        l.remark = o;
        l.updateDate = utils.getNowStr();
        switch (i) {
            case h:
                l.status = h;
                break;
            case p:
                l.status = p;
                break;
            default:
                const e = "actionType错误, 请联系作者更正: " + i;
                show.error(e);
                throw new Error(e);
        }
        await this.forage.setItem(this.car_list_key, r);
    }
    async saveCarList(e) {
        if (!e || !Array.isArray(e) || e.length === 0) {
            show.error("记录列表为空!");
            throw new Error("记录列表为空!");
        }
        const t = (await this.forage.getItem(this.car_list_key)) || [];
        for (const a of e) {
            try {
                this._saveSingleCar(a, t);
            } catch (n) {
                throw n;
            }
        }
        await this.forage.setItem(this.car_list_key, t);
    }
    async removeNewVideoList(e) {
        const t = await this.getFavoriteActressList();
        let n = false;
        const a = t.map((t) => {
            if (!t.newVideoList || !Array.isArray(t.newVideoList)) {
                return t;
            }
            const a = t.newVideoList.filter((a) => {
                const i = e.includes(a);
                if (i) {
                    clog.log("移除关联女优新作品", t.name, a);
                    n = true;
                }
                return !i;
            });
            return {
                ...t,
                newVideoList: a,
            };
        });
        if (n) {
            await this.forage.setItem(this.favorite_actresses_key, a);
        }
    }
    async removeCar(e) {
        const t = await this.getCarList();
        const n = t.length;
        const a = t.filter((t) => t.carNum !== e);
        if (a.length === n) {
            show.error(`${e} 不存在`);
            return false;
        } else {
            await this.forage.setItem(this.car_list_key, a);
            return true;
        }
    }
    async batchRemoveCars(e) {
        const t = await this.getCarList();
        const n = t.length;
        const a = new Set(e);
        const i = t.filter((e) => !a.has(e.carNum));
        const s = n - i.length;
        return s !== 0 && (await this.forage.setItem(this.car_list_key, i), s);
    }
    async getBlacklist() {
        return (await this.forage.getItem(this.blacklist_key)) || [];
    }
    async addBlacklistItem(e) {
        let {
            starId: t,
            name: n,
            allName: a,
            role: i,
            movieType: s,
            url: o,
        } = e;
        if (!t) {
            throw new Error("缺失starId");
        }
        if (!n) {
            throw new Error("缺失name");
        }
        if (!i) {
            throw new Error("缺失role");
        }
        const r = await this.getBlacklist();
        const l = r.find((e) => e.starId === t);
        if (l) {
            l.url = o;
            l.role = i;
            l.movieType = s;
            clog.log("更新黑名单演员信息", l);
        } else {
            const e = {
                starId: t,
                name: n,
                allName: a || [n],
                createTime: utils.getNowStr(),
                role: i,
                movieType: s,
                url: o,
            };
            r.push(e);
            clog.log("增加黑名单演员信息", e);
        }
        await this.forage.setItem(this.blacklist_key, r);
    }
    async updateBlacklistItem(e) {
        if (!e || !e.starId) {
            throw new Error("参数不全");
        }
        const t = await this.getBlacklist();
        const n = t.find((t) => t.starId === e.starId);
        if (!n) {
            throw new Error(`未找到黑名单演员信息:${e.name} ${e.starId}`);
        }
        if (e.checkTime) {
            n.checkTime = e.checkTime;
        }
        if (e.lastPublishTime) {
            n.lastPublishTime = e.lastPublishTime;
        }
        await this.forage.setItem(this.blacklist_key, t);
    }
    async deleteBlacklistItem(e) {
        const t = await this.getBlacklist();
        const n = t.filter((t) => t.starId !== e);
        if (t.length !== n.length) {
            await this.forage.setItem(this.blacklist_key, n);
        }
    }
    async getBlacklistCarList() {
        if (
            !this.cache_filter_actor_actress_car_list ||
            !(this.cache_filter_actor_actress_car_list.length > 0)
        ) {
            this.cache_filter_actor_actress_car_list =
                (await this.forage.getItem(this.blacklist_car_list_key)) || [];
        }
        return this.cache_filter_actor_actress_car_list;
    }
    async batchSaveBlacklistCarList(e) {
        const t = await this.getBlacklistCarList();
        const n = JSON.parse(JSON.stringify(t));
        let a = false;
        let i = [];
        for (const s of e) {
            if (!n.find((e) => e.carNum === s.carNum)) {
                this._saveSingleCar(s, n);
                clog.log(
                    `屏蔽演员番号: <span style="color: #f40">${s.names} ${s.carNum}</span>`,
                );
                a = true;
                i.push(s.carNum);
            }
        }
        if (a) {
            await this.forage.setItem(this.blacklist_car_list_key, n);
            await this.removeNewVideoList(i);
            window.cleanCache_filter_actor_actress_car_list();
        }
    }
    async removeBlacklistCarList(e) {
        const t = await this.getBlacklistCarList();
        const n = t.filter((t) => t.starId !== e);
        if (n.length !== t.length) {
            await this.forage.setItem(this.blacklist_car_list_key, n);
            window.cleanCache_filter_actor_actress_car_list();
        }
    }
    async getFavoriteActressList() {
        return (await this.forage.getItem(this.favorite_actresses_key)) || [];
    }
    async addFavoriteActressList(e) {
        const t = await this.getFavoriteActressList();
        let n = 0;
        for (const a of e) {
            let {
                starId: e,
                name: i,
                allName: s,
                avatar: o,
                lastCheckTime: r,
                lastPublishTime: l,
                actressType: c,
            } = a;
            if (!e) {
                throw new Error("缺失starId");
            }
            if (!i) {
                throw new Error("缺失name");
            }
            s ||= [i];
            const d = "(無碼)";
            if (!c) {
                c = i.includes(d) || s.some((e) => e.includes(d)) ? A : D;
            }
            i = i.replace(d, "");
            s = s.map((e) => e.replace(d, ""));
            let h = t.find((t) => t.starId === e);
            if (h) {
                if (!h.avatar || !h.avatar.includes("https")) {
                    if (o) {
                        clog.log(o);
                        h.avatar = o;
                        clog.log(
                            `<span style="color: #f40">补全女优头像: ${i}</span>`,
                        );
                        n++;
                    }
                }
                if (!h.actressType && c) {
                    h.actressType = c;
                    clog.log(
                        `<span style="color: #f40">补全女优类别: ${i} ${c}</span>`,
                    );
                    n++;
                }
                if (h.name.includes(d)) {
                    h.name = i;
                    h.allName = s;
                    clog.log(
                        `<span style="color: #f40">更正女优名字: ${i} ${s}</span>`,
                    );
                    n++;
                }
                continue;
            }
            const g = utils.getNowStr();
            t.push({
                starId: e,
                name: i,
                allName: s,
                avatar: o,
                lastCheckTime: r,
                lastPublishTime: l,
                createDate: g,
                updateDate: g,
                actressType: c,
            });
            clog.log(
                `<span style="color: #f40">同步JavDB已收藏的演员: ${i}</span>`,
            );
            n++;
        }
        if (n > 0) {
            await this.forage.setItem(this.favorite_actresses_key, t);
        } else {
            clog.log("信息已记录, 无需要进行同步收藏的演员");
        }
        return n;
    }
    async removeFavoriteActress(e) {
        const t = await this.getFavoriteActressList();
        const n = t.length;
        const a = t.filter((t) => t.starId !== e);
        if (a.length === n) {
            clog.error(`移除演员失败, ${e} 不存在`);
            return false;
        } else {
            await this.forage.setItem(this.favorite_actresses_key, a);
            return true;
        }
    }
    async updateFavoriteActress(e) {
        const t = await this.getFavoriteActressList();
        const {
            starId: n,
            name: a,
            allName: i,
            avatar: s,
            lastCheckTime: o,
            newVideoList: r,
            lastPublishTime: l,
            actressType: c,
            remark: d,
        } = e;
        if (!n) {
            throw new Error("缺失starId");
        }
        let h = t.find((e) => e.starId === n);
        if (!h) {
            clog.error("未找到演员信息", n, a);
            return false;
        }
        if (a) {
            h.name = a;
        }
        if (i) {
            h.allName = i;
        }
        if (s) {
            h.avatar = s;
        }
        if (c != null) {
            h.actressType = c;
        }
        if (o) {
            h.lastCheckTime = o;
        }
        if (r) {
            h.newVideoList = r;
        }
        if (l) {
            h.lastPublishTime = l;
        }
        if (d) {
            h.remark = d;
        }
        h.updateDate = utils.getNowStr();
        await this.forage.setItem(this.favorite_actresses_key, t);
    }
    async getHighlightedTags() {
        return (await this.forage.getItem(this.highlighted_tags_key)) || [];
    }
    async setHighlightedTags(e) {
        return await this.forage.setItem(this.highlighted_tags_key, e);
    }
    async saveTitleFilterKeyword(n) {
        await s(this, e, t).call(
            this,
            n,
            this.filter_keyword_title_key,
            "标题关键词",
        );
        if (Array.isArray(n)) {
            return null;
        }
        const a = await this.getFavoriteActressList();
        let i = false;
        const o = a.map((e) => {
            if (!e.newVideoList || !Array.isArray(e.newVideoList)) {
                return e;
            }
            const t = e.newVideoList.filter((t) => {
                const a = t.startsWith(n);
                if (a) {
                    clog.log("移除关联女优新作品", e.name, t);
                    i = true;
                }
                return !a;
            });
            return {
                ...e,
                newVideoList: t,
            };
        });
        if (i) {
            await this.forage.setItem(this.favorite_actresses_key, o);
        }
    }
    async getTitleFilterKeyword() {
        return (await this.forage.getItem(this.filter_keyword_title_key)) || [];
    }
    async getReviewFilterKeywordList() {
        return (
            (await this.forage.getItem(this.filter_keyword_review_key)) || []
        );
    }
    async saveReviewFilterKeyword(n) {
        return s(this, e, t).call(
            this,
            n,
            this.filter_keyword_review_key,
            "评论关键词",
        );
    }
    async getSetting(e = null, t) {
        this.cacheSettingObj ||=
            (await this.forage.getItem(this.setting_key)) || {};
        let n = this.cacheSettingObj;
        if (e === null) {
            return n;
        }
        const a = n[e];
        if (a) {
            if (a === "true" || a === "false") {
                return a.toLowerCase() === "true";
            } else if (
                typeof a != "string" ||
                a.trim() === "" ||
                isNaN(Number(a))
            ) {
                return a;
            } else {
                return Number(a);
            }
        } else {
            return t;
        }
    }
    async saveSetting(e) {
        if (e) {
            await this.forage.setItem(this.setting_key, e);
            window.clean_cacheSettingObj();
        } else {
            show.error("设置对象为空");
        }
    }
    async saveSettingItem(e, t) {
        if (!e) {
            show.error("key 不能为空");
            return;
        }
        let n = await this.getSetting();
        n[e] = t;
        await this.saveSetting(n);
        window.clean_cacheSettingObj();
    }
    async importData(e) {
        await this.forage.clear();
        const t = [];
        for (const n in e) {
            const a = e[n];
            const i = this.forage.setItem(n, a);
            t.push(i);
        }
        await Promise.all(t);
    }
    async exportData() {
        const e = {};
        await this.forage.iterate((t, n) => {
            e[n] = t;
        });
        if (Object.keys(e).length === 0) {
            throw new Error("没有可导出的数据");
        }
        return e;
    }
    async merge_table_name() {
        let e = "filter_actor_actress_info_list";
        let t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.blacklist_key, t);
        }
        await this.forage.removeItem(e);
        e = "favorite_actresses_info_list";
        t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.favorite_actresses_key, t);
        }
        await this.forage.removeItem(e);
        e = "car_list_filter_actor_actress";
        t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.blacklist_car_list_key, t);
        }
        await this.forage.removeItem(e);
        e = "title_filter_keyword";
        t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.filter_keyword_title_key, t);
        }
        await this.forage.removeItem(e);
        e = "review_filter_keyword";
        t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.filter_keyword_review_key, t);
        }
        await this.forage.removeItem(e);
        e = "highlightedTags";
        t = (await this.forage.getItem(e)) || [];
        if (t && t.length > 0) {
            console.log("更正", e);
            await this.forage.setItem(this.highlighted_tags_key, t);
        }
        await this.forage.removeItem(e);
    }
    async clean_no_url_blacklist() {
        const [e, t] = await Promise.all([
            this.getBlacklistCarList(),
            this.getBlacklist(),
        ]);
        if (e.length && !e[0].actress) {
            return;
        }
        const n = new Set(t.map((e) => e.name));
        const a = e.filter((e) => !e.actress || n.has(e.actress));
        if (e.length !== a.length) {
            clog.debug("清理 blacklistCarList 前", e.length);
            clog.debug("清理 blacklistCarList 后", a.length);
            await this.forage.setItem(this.blacklist_car_list_key, a);
            this.cache_filter_actor_actress_car_list = null;
        }
        const i = new Set(a.map((e) => e.actress));
        let s = t.filter((e) => i.has(e.name));
        s = s.map((e) => {
            const { key: t, recordTime: n, ...a } = e;
            const i = a;
            if (n !== undefined) {
                i.createTime = n;
            }
            return i;
        });
        if (
            t.length !== s.length ||
            t.some((e) => "key" in e || "recordTime" in e)
        ) {
            clog.debug("清理 Blacklist 前", t.length);
            clog.debug("清理 Blacklist 后", s.length);
            await this.forage.setItem(this.blacklist_key, s);
        }
    }
    async async_merge_other() {
        const e = await this.getSetting();
        let t = false;
        const n = [
            "enableCheckFilterActorActress",
            "checkIntervalTime_filterActorActress",
            "checkIntervalTime_ruleTime",
            "checkIntervalTime_newVideo",
            "checkIntervalTime_favoriteActress",
            "checkFilterTime",
            "checkFilterConcurrencyCount",
            "checkFilterSleep",
            "enableCheckBlacklist",
            "checkBlacklist_intervalTime",
            "checkBlacklist_ruleTime",
            "enableCheckFavoriteActress",
            "checkFavoriteActress_IntervalTime",
            "enableCheckNewVideo",
            "checkNewVideo_intervalTime",
            "checkNewVideo_ruleTime",
            "checkConcurrencyCount",
            "checkRequestSleep",
        ];
        for (const a of n) {
            if (Object.prototype.hasOwnProperty.call(e, a)) {
                delete e[a];
                t = true;
            }
        }
        if (e.downPath115) {
            delete e.downPath115;
            t = true;
        }
        if (t) {
            await this.saveSetting(e);
            clog.debug("配置数据已更正");
        }
    }
    async merge_blacklist() {
        const e = await this.getBlacklist();
        if (!e || e.length === 0) {
            return;
        }
        let t = false;
        const n = e.map((e) => {
            let n = false;
            if (Object.prototype.hasOwnProperty.call(e, "isActor") && !e.role) {
                e.role = e.isActor ? B : P;
                delete e.isActor;
                n = true;
            }
            if (!e.starId && e.url) {
                try {
                    const t = new URL(e.url).pathname;
                    const a = t
                        .split("/")
                        .filter((e) => e.trim() !== "")
                        .pop();
                    if (e.starId !== a) {
                        e.starId = a;
                        n = true;
                    }
                } catch (a) {
                    clog.error("提取url-starId发生错误", e.url, a);
                }
            }
            if (!e.allName) {
                e.allName = e.name ? [e.name] : [];
                n = true;
            }
            if (!e.movieType) {
                e.movieType = D;
                n = true;
            }
            if (!e.url && e.url.includes("sort_type")) {
                const t = new URL(e.url);
                t.searchParams.delete("sort_type");
                e.url = t.toString();
                clog.debug("去除黑名单地址sort_type参数");
            }
            if (n) {
                t = true;
            }
            return e;
        });
        if (t) {
            clog.debug("更正 Blacklist 数据结构");
            await this.forage.setItem(this.blacklist_key, n);
        }
        const a = await this.getBlacklistCarList();
        t = false;
        const i = a.map((n) => {
            if (!n.starId) {
                let a = e.find((e) => e.name === n.actress);
                if (a) {
                    n.starId = a.starId;
                }
                t = true;
            }
            if (n.type) {
                delete n.type;
                t = true;
            }
            return n;
        });
        if (t) {
            clog.debug("更正 blacklistCarList 数据结构");
            await this.forage.setItem(this.blacklist_car_list_key, i);
        }
    }
    async merge_favoriteActress() {
        const e = await this.getFavoriteActressList();
        if (!e || e.length === 0) {
            return;
        }
        let t = false;
        const n = e.map((e) => {
            let n = false;
            if (e.dbId) {
                e.starId = e.dbId;
                delete e.dbId;
                n = true;
            }
            if (n) {
                t = true;
            }
            return e;
        });
        if (t) {
            clog.debug("更正 favoriteActressesInfoList 数据结构");
            await this.forage.setItem(this.favorite_actresses_key, n);
        }
    }
    async merge_tow_car_list_table() {
        const e = await this.getBlacklistCarList();
        const t = await this.getCarList();
        let n = false;
        const a = e.map((e) => {
            let t = false;
            if (e.actress !== undefined) {
                e.names = e.actress;
                delete e.actress;
                t = true;
            }
            if (t) {
                n = true;
            }
            return e;
        });
        if (n) {
            clog.debug("更正 blacklistCarList 数据结构 actress->names");
            await this.forage.setItem(this.blacklist_car_list_key, a);
        }
        n = false;
        const i = t.map((e) => {
            let t = false;
            if (e.actress !== undefined) {
                e.names = e.actress;
                delete e.actress;
                t = true;
            }
            if (t) {
                n = true;
            }
            return e;
        });
        if (n) {
            clog.debug("更正 carList 数据结构 actress->names");
            await this.forage.setItem(this.car_list_key, i);
        }
    }
};
const U = "https://jdforrepam.com/api";
function O() {
    const e = "jhs_review_ts";
    const t = "jhs_review_sign";
    const n = Math.floor(Date.now() / 1000);
    if (n - (localStorage.getItem(e) || 0) <= 20) {
        return localStorage.getItem(t);
    }
    const a = `${n}.lpw6vgqzsp.${md5(`${n}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    localStorage.setItem(e, n);
    localStorage.setItem(t, a);
    return a;
}
const R = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/movies/${e}/reviews`;
    let i = {
        jdSignature: await O(),
    };
    return (
        await gmHttp.get(
            a,
            {
                page: t,
                sort_by: "hotly",
                limit: n,
            },
            i,
        )
    ).data.reviews;
};
const V = async (e) => {
    let t = `${U}/v4/movies/${e}`;
    let n = {
        jdSignature: await O(),
    };
    const a = await gmHttp.get(t, null, n);
    if (!a.data) {
        show.error("获取视频详情失败: " + a.message);
        throw new Error(a.message);
    }
    const i = a.data.movie;
    const s = i.preview_images;
    const o = [];
    s.forEach((e) => {
        o.push(
            e.large_url.replace(
                "https://tp-iu.cmastd.com/rhe951l4q",
                "https://c0.jdbstatic.com",
            ),
        );
    });
    return {
        movieId: i.id,
        actors: i.actors,
        duration: i.duration,
        title: i.origin_title,
        carNum: i.number,
        score: i.score,
        releaseDate: i.release_date,
        watchedCount: i.watched_count,
        imgList: o,
    };
};
const K = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/lists/related?movie_id=${e}&page=${t}&limit=${n}`;
    let i = {
        jdSignature: await O(),
    };
    const s = await gmHttp.get(a, null, i);
    const o = [];
    s.data.lists.forEach((e) => {
        o.push({
            relatedId: e.id,
            name: e.name,
            movieCount: e.movies_count,
            collectionCount: e.collections_count,
            viewCount: e.views_count,
            createTime: utils.formatDate(e.created_at),
        });
    });
    return o;
};
const W = async (e = "daily", t = "high_score") => {
    let n = `${U}/v1/rankings/playback?period=${e}&filter_by=${t}`;
    let a = {
        jdSignature: await O(),
    };
    return (await gmHttp.get(n, null, a)).data.movies;
};
const q = async (e = "all", t = "", n = 1, a = 40) => {
    let i = `${U}/v1/movies/top?start_rank=1&type=${e}&type_value=${t}&ignore_watched=false&page=${n}&limit=${a}`;
    let s = {
        "user-agent": "Dart/3.5 (dart:io)",
        "accept-language": "zh-TW",
        host: "jdforrepam.com",
        authorization: "Bearer " + localStorage.getItem("jhs_appAuthorization"),
        jdsignature: await O(),
    };
    return await gmHttp.get(i, null, s);
};
class J {
    constructor() {
        i(this, "intervalContainer", {});
        i(this, "mimeTypes", {
            txt: "text/plain",
            html: "text/html",
            css: "text/css",
            csv: "text/csv",
            json: "application/json",
            xml: "application/xml",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            zip: "application/zip",
            rar: "application/x-rar-compressed",
            "7z": "application/x-7z-compressed",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            webm: "video/webm",
            ogg: "audio/ogg",
        });
        i(this, "timers", new Map());
        i(this, "insertStyle", (e) => {
            if (e) {
                if (e.indexOf("<style>") === -1) {
                    e = "<style>" + e + "</style>";
                }
                $("head").append(e);
            }
        });
        i(this, "layerIndexStack", []);
        J.instance ||= this;
        return J.instance;
    }
    importResource(e) {
        let t;
        if (e.indexOf("css") >= 0) {
            t = document.createElement("link");
            t.setAttribute("rel", "stylesheet");
            t.href = e;
        } else {
            t = document.createElement("script");
            t.setAttribute("type", "text/javascript");
            t.src = e;
        }
        document.documentElement.appendChild(t);
    }
    openPage(e, t, n, a) {
        n = n ?? true;
        if (a && (a.ctrlKey || a.metaKey)) {
            GM_openInTab(e.includes("http") ? e : window.location.origin + e, {
                insert: 0,
            });
            return;
        }
        let i = e;
        if (!e.includes("/actors/") && !e.includes("/star/")) {
            i = e.includes("?") ? `${e}&hideNav=1` : `${e}?hideNav=1`;
        }
        layer.open({
            type: 2,
            title: t,
            content: i,
            scrollbar: false,
            shadeClose: n,
            area: this.getResponsiveArea(["85%", "90%"]),
            isOutAnim: false,
            anim: -1,
            success: (e, t) => {
                this.setupEscClose(t);
            },
        });
    }
    _handleGlobalEscKey(e) {
        if (e.key !== "Escape" && e.keyCode !== 27) {
            return;
        }
        if (this.layerIndexStack.length === 0) {
            return;
        }
        const t = this.layerIndexStack[this.layerIndexStack.length - 1];
        const n = $(`#layui-layer${t}`);
        let a = false;
        if (n.find(".viewer-container").length > 0) {
            a = true;
        } else {
            const e = n.find(`#layui-layer-iframe${t}`)[0];
            if (e && e.contentDocument) {
                try {
                    if (
                        $(e.contentDocument).find(".viewer-container").length >
                        0
                    ) {
                        a = true;
                    }
                } catch (i) {
                    clog.warn("无法检查跨域 iframe 内的 .viewer-container");
                }
            }
        }
        if (!a) {
            this.layerIndexStack.pop();
            layer.close(t);
        }
    }
    setupEscClose(e) {
        var t;
        if (!this._boundHandler) {
            this._boundHandler = this._handleGlobalEscKey.bind(this);
            $(document).off("keydown.globalLayerEsc");
            $(document).on("keydown.globalLayerEsc", this._boundHandler);
        }
        if (this.layerIndexStack.indexOf(e) === -1) {
            this.layerIndexStack.push(e);
        }
        const n = $(`#layui-layer-iframe${e}`);
        const a = `keydown.layerEsc${e}`;
        try {
            const e = (t = n[0]) == null ? undefined : t.contentDocument;
            if (e) {
                if (n.attr("data-esc-bound") === "yes") {
                    return;
                }
                $(e).off(a);
                $(e).on(a, this._boundHandler);
                n.attr("data-esc-bound", "yes");
            }
        } catch (i) {
            clog.error("iframe监听失败 (跨域或未加载完毕):", i);
        }
    }
    closePage() {
        storageManager.getSetting("needClosePage", "yes").then((e) => {
            if (e !== "yes") {
                return;
            }
            parent.document.documentElement.style.overflow = "auto";
            [".layui-layer-shade", ".layui-layer-move", ".layui-layer"].forEach(
                function (e) {
                    const t = parent.document.querySelectorAll(e);
                    if (t.length > 0) {
                        const e = t.length > 1 ? t[t.length - 1] : t[0];
                        e.parentNode.removeChild(e);
                    }
                },
            );
            window.close();
        });
    }
    loopDetector(e, t, n = 20, a = 10000, i = true) {
        const s = Math.random();
        const o = new Date().getTime();
        const r = (e) => {
            clearInterval(this.intervalContainer[s]);
            if (e && t) {
                t();
            }
            delete this.intervalContainer[s];
        };
        this.intervalContainer[s] = setInterval(() => {
            const t = new Date().getTime() - o;
            if (e()) {
                r(true);
            } else if (t >= a) {
                r(i);
            }
        }, n);
    }
    rightClick(e, t, n) {
        let a;
        if (typeof e == "string") {
            a = document.querySelector(e);
        } else if (e instanceof HTMLElement) {
            a = e;
        }
        if (!a) {
            console.warn(
                "rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。",
            );
            a = document.body;
        }
        if (typeof t == "string" && t.trim() !== "") {
            a.addEventListener("contextmenu", (e) => {
                const a = e.target.closest(t);
                if (a) {
                    n(e, a);
                }
            });
        } else {
            console.error("rightClick(), 必须提供有效的 targetSelector。");
        }
    }
    q(e, t, n, a) {
        let i;
        let s;
        if (e) {
            i = e.clientX - 130;
            s = e.clientY - 120;
        } else {
            i = window.innerWidth / 2 - 120;
            s = window.innerHeight / 2 - 120;
        }
        let o = layer.confirm(
            t,
            {
                offset: [s, i],
                title: "提示",
                btn: ["确定", "取消"],
                shade: 0,
                zIndex: 999999991,
            },
            function () {
                if (n) {
                    n();
                }
                layer.close(o);
            },
            function () {
                if (a) {
                    a();
                }
            },
        );
    }
    getNowStr(e = "-", t = ":", n = null) {
        let a;
        a = n ? new Date(n) : new Date();
        const i = a.getFullYear();
        const s = String(a.getMonth() + 1).padStart(2, "0");
        const o = String(a.getDate()).padStart(2, "0");
        const r = String(a.getHours()).padStart(2, "0");
        const l = String(a.getMinutes()).padStart(2, "0");
        const c = String(a.getSeconds()).padStart(2, "0");
        return `${[i, s, o].join(e)} ${[r, l, c].join(t)}`;
    }
    formatDate(e, t = "-", n = ":") {
        let a;
        if (e instanceof Date) {
            a = e;
        } else {
            if (typeof e != "string") {
                throw new Error(
                    "Invalid date input: must be Date object or date string",
                );
            }
            a = new Date(e);
            if (isNaN(a.getTime())) {
                throw new Error("Invalid date string");
            }
        }
        const i = a.getFullYear();
        const s = String(a.getMonth() + 1).padStart(2, "0");
        const o = String(a.getDate()).padStart(2, "0");
        const r = String(a.getHours()).padStart(2, "0");
        const l = String(a.getMinutes()).padStart(2, "0");
        const c = String(a.getSeconds()).padStart(2, "0");
        return `${[i, s, o].join(t)} ${[r, l, c].join(n)}`;
    }
    getHourDifference(e, t) {
        const n = e.getTime();
        const a = t.getTime();
        const i = Math.abs(a - n) / 3600000;
        return Math.floor(i);
    }
    isUnnecessaryCheck(e, t) {
        if (!t) {
            throw new Error("未传入checkIntervalTime");
        }
        t = parseInt(t);
        return this.getHourDifference(new Date(e), new Date()) < t;
    }
    download(e, t) {
        show.info("开始请求下载...");
        const n = t.split(".").pop().toLowerCase();
        let a;
        let i = this.mimeTypes[n] || "application/octet-stream";
        if (e instanceof Blob) {
            a = e;
        } else if (e instanceof ArrayBuffer || ArrayBuffer.isView(e)) {
            a = new Blob([e], {
                type: i,
            });
        } else if (typeof e == "string" && e.startsWith("data:")) {
            const t = atob(e.split(",")[1]);
            const n = new ArrayBuffer(t.length);
            const s = new Uint8Array(n);
            for (let e = 0; e < t.length; e++) {
                s[e] = t.charCodeAt(e);
            }
            a = new Blob([s], {
                type: i,
            });
        } else {
            a = new Blob([e], {
                type: i,
            });
        }
        const s = URL.createObjectURL(a);
        const o = document.createElement("a");
        o.href = s;
        o.download = t;
        document.body.appendChild(o);
        o.click();
        setTimeout(() => {
            document.body.removeChild(o);
            URL.revokeObjectURL(s);
        }, 100);
    }
    smoothScrollToTop(e = 500) {
        return new Promise((t) => {
            const n = performance.now();
            const a = window.pageYOffset;
            window.requestAnimationFrame(function i(s) {
                const o = s - n;
                const r = Math.min(o / e, 1);
                const l =
                    r < 0.5 ? r * 4 * r * r : 1 - Math.pow(r * -2 + 2, 3) / 2;
                window.scrollTo(0, a * (1 - l));
                if (r < 1) {
                    window.requestAnimationFrame(i);
                } else {
                    t();
                }
            });
        });
    }
    simpleId() {
        return crypto.randomUUID().replace("-", "");
    }
    isUrl(e) {
        try {
            new URL(e);
            return true;
        } catch (t) {
            return false;
        }
    }
    setHrefParam(e, t) {
        const n = new URL(window.location.href);
        n.searchParams.set(e, t);
        window.history.pushState({}, "", n.toString());
    }
    getUrlParam(e, t) {
        const n = e.split("?")[1];
        if (!n) {
            return null;
        }
        const a = new RegExp(`(?:^|&)${t}=([^&]*)`);
        const i = n.match(a);
        let s = "";
        if (i && i[1]) {
            s = decodeURIComponent(i[1].replace(/\+/g, " "));
        }
        if (s) {
            if (s === "true" || s === "false") {
                return s.toLowerCase() === "true";
            } else if (
                typeof s != "string" ||
                s.trim() === "" ||
                isNaN(Number(s))
            ) {
                return s;
            } else {
                return Number(s);
            }
        } else {
            return s;
        }
    }
    reBuildSignature() {
        return O();
    }
    getResponsiveArea(e) {
        const t = window.innerWidth;
        if (t >= 1200) {
            return e || this.getDefaultArea();
        } else if (t >= 768) {
            return ["70%", "90%"];
        } else {
            return ["95%", "95%"];
        }
    }
    getDefaultArea() {
        return ["85%", "90%"];
    }
    isMobile() {
        const e = navigator.userAgent.toLowerCase();
        return [
            "iphone",
            "ipod",
            "ipad",
            "android",
            "blackberry",
            "windows phone",
            "nokia",
            "webos",
            "opera mini",
            "mobile",
            "mobi",
            "tablet",
        ].some((t) => e.includes(t));
    }
    copyToClipboard(e, t) {
        navigator.clipboard
            .writeText(t)
            .then(() => show.info(`${e}已复制到剪切板, ${t}`))
            .catch((e) => console.error("复制失败: ", e));
    }
    htmlTo$dom(e) {
        const t = new DOMParser();
        return $(t.parseFromString(e, "text/html"));
    }
    addCookie(e, t = {}) {
        const {
            maxAge: n = 604800,
            path: a = "/",
            domain: i = "",
            secure: s = false,
            sameSite: o = "Lax",
        } = t;
        e.split(";").forEach((e) => {
            const t = e.trim();
            if (t) {
                const e = t.split("=");
                if (e.length >= 2 && e[0].trim()) {
                    let t = [`${e[0].trim()}=${e.slice(1).join("=")}`];
                    if (n > 0) {
                        t.push(`max-age=${n}`);
                    }
                    t.push(`path=${a}`);
                    if (i) {
                        t.push(`domain=${i}`);
                    }
                    if (s) {
                        t.push("Secure");
                    }
                    if (o) {
                        t.push(`SameSite=${o}`);
                    }
                    console.log("document.cookie = '" + t.join("; ") + "'");
                    document.cookie = t.join("; ");
                }
            }
        });
    }
    isHidden(e) {
        const t = e.jquery ? e[0] : e;
        return (
            !t ||
            (t.offsetWidth <= 0 && t.offsetHeight <= 0) ||
            window.getComputedStyle(t).display === "none"
        );
    }
    time(e = "default", t = "s", n = 2) {
        if (this.timers.has(e)) {
            const t = this.timers.get(e);
            const n = performance.now() - t.startTime;
            let a;
            let i;
            if (t.unit === "s") {
                a = (n / 1000).toFixed(t.precision);
                i = "秒";
            } else {
                a = n.toFixed(t.precision);
                i = "毫秒";
            }
            this.timers.delete(e);
            return `${e}: ${a}${i}`;
        }
        this.timers.set(e, {
            startTime: performance.now(),
            unit: t,
            precision: n,
        });
    }
    sleep(e = 1000) {
        return new Promise((t) => setTimeout(t, e));
    }
    genericSort(e, t, n = true) {
        if (!Array.isArray(e) || e.length === 0) {
            return [];
        }
        if (!Array.isArray(t) || t.length === 0) {
            return [...e];
        }
        const a = [...e];
        const i = (e) => {
            if (e instanceof Date) {
                return e;
            }
            if (typeof e == "string") {
                const t = new Date(e);
                if (!isNaN(t.getTime())) {
                    return t;
                }
            }
            return e;
        };
        return a.sort((e, a) => {
            for (const s of t) {
                const { key: t, order: o = "asc" } = s;
                let r = e;
                let l = a;
                if (t != null) {
                    if (typeof t == "function") {
                        r = t(e);
                        l = t(a);
                    } else {
                        r = e && typeof e == "object" ? e[t] : undefined;
                        l = a && typeof a == "object" ? a[t] : undefined;
                    }
                }
                const c = i(r);
                const d = i(l);
                let h = 0;
                const g = r == null;
                const p = l == null;
                if (g && p) {
                    return 0;
                }
                if (g) {
                    if (n) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
                if (p) {
                    if (n) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
                h =
                    c instanceof Date && d instanceof Date
                        ? c.getTime() - d.getTime()
                        : typeof r == "number" && typeof l == "number"
                          ? r - l
                          : typeof r == "string" && typeof l == "string"
                            ? r.localeCompare(l)
                            : String(r).localeCompare(String(l));
                if (o === "desc") {
                    h *= -1;
                }
                if (h !== 0) {
                    return h;
                }
            }
            return 0;
        });
    }
    async retry(e, t = 3) {
        let n = 0;
        while (n < t) {
            try {
                const t = await e();
                if (n > 0) {
                    clog.debug(`[重试] 请求成功，共发起 ${n + 1} 次。`);
                }
                return t;
            } catch (a) {
                const e = String(a);
                if (
                    e.includes("Just a moment") ||
                    e.includes("重定向") ||
                    e.toLowerCase().includes("404 not found")
                ) {
                    throw a;
                }
                n++;
                if (n === t) {
                    clog.debug(`[重试] 达到最大重试次数 (${t})，最终失败：`, a);
                    throw a;
                }
                clog.debug(
                    `[重试] 请求失败，准备第 ${n + 1} 次重试, 错误信息: ${e}`,
                );
            }
        }
    }
}
unsafeWindow.utils = window.utils = new J();
unsafeWindow.gmHttp = window.gmHttp = new (class {
    async get(e, t = {}, n = {}, a) {
        return this.gmRequest("GET", e, null, t, n, a);
    }
    post(e, t = {}, n = {}) {
        n = {
            "Content-Type": "application/json",
            ...n,
        };
        let a = JSON.stringify(t);
        return this.gmRequest("POST", e, a, null, n);
    }
    postForm(e, t = {}, n = {}) {
        n ||= {};
        n["Content-Type"] ||= "application/x-www-form-urlencoded";
        let a = "";
        if (t && Object.keys(t).length > 0) {
            a = Object.entries(t)
                .map(([e, t]) => `${e}=${t}`)
                .join("&");
        }
        return this.gmRequest("POST", e, a, null, n);
    }
    postFileFormData(e, t = {}, n = {}) {
        n ||= {};
        const a = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
        n["Content-Type"] = `multipart/form-data; boundary=${a}`;
        let i = "";
        if (t && Object.keys(t).length > 0) {
            i = Object.entries(t)
                .map(
                    ([e, t]) =>
                        `--${a}\r\nContent-Disposition: form-data; name="${e}"\r\n\r\n${t}\r\n`,
                )
                .join("");
        }
        i += `--${a}--`;
        return this.gmRequest("POST", e, i, null, n);
    }
    async downloadFileInChunks(e, t = {}, n, a) {
        if (!n) {
            throw new Error("请提供文件名 (filename) 用于保存。");
        }
        const i = await storageManager.getSetting("httpTimeout", 5000);
        const s = await storageManager.getSetting("httpRetryCount", 3);
        let o;
        let r;
        clog.log(`[${n}] 正在获取文件大小...`);
        try {
            const a = await utils.retry(
                () =>
                    new Promise((n, a) => {
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: e,
                            headers: {
                                ...t,
                                Range: "bytes=0-0",
                            },
                            timeout: i,
                            onload: n,
                            onerror: (e) =>
                                a(new Error("网络错误：无法获取文件大小")),
                            ontimeout: () => a(new Error("超时：获取文件大小")),
                        });
                    }),
                s,
            );
            if (a.status !== 206 && a.status !== 200) {
                throw new Error(`请求文件大小失败，状态码: ${a.status}`);
            }
            {
                const e = a.responseHeaders.match(
                    /content-range:\s*bytes\s*\d+-\d+\/(\d+)/i,
                );
                const t = a.responseHeaders.match(/content-type:\s*([^\s;]+)/i);
                if (e && e[1]) {
                    o = parseInt(e[1], 10);
                } else {
                    if (
                        !a.responseHeaders.match(/content-length:\s*(\d+)/i) ||
                        a.status !== 200
                    ) {
                        throw new Error(
                            "无法从响应头中获取文件总大小，服务器可能不支持 Range 请求。",
                        );
                    }
                    {
                        const e = a.responseHeaders.match(
                            /content-length:\s*(\d+)/i,
                        );
                        o = parseInt(e[1], 10);
                        clog.warn(
                            `[${n}] 服务器返回 200 状态码，可能不支持 Range 请求。将尝试完整下载。`,
                        );
                    }
                }
                if (t && t[1]) {
                    r = t[1];
                }
                clog.log(
                    `[${n}] 文件总大小：${(o / 1024 / 1024).toFixed(2)} MB, MIME 类型: ${r || "未知"}`,
                );
            }
        } catch (u) {
            clog.error(`[${n}] 获取文件大小失败:`, u.message);
            throw u;
        }
        if (!o || o <= 0) {
            throw new Error("获取到的文件大小无效或服务器拒绝提供大小信息。");
        }
        const l = 1048576;
        const c = Math.ceil(o / l);
        const d = [];
        const h = new Array(c);
        clog.log(
            `[${n}] 文件将被分为 ${c} 块进行下载 (每块约 ${(1).toFixed(2)} MB)`,
        );
        for (let f = 0; f < c; f++) {
            const a = f * l;
            const r = `bytes=${a}-${Math.min(a + l - 1, o - 1)}`;
            const g = await utils.retry(
                () =>
                    new Promise((a, s) => {
                        const o = {
                            ...t,
                            Range: r,
                            Accept: "application/octet-stream",
                        };
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: e,
                            headers: o,
                            timeout: i,
                            responseType: "arraybuffer",
                            onload: (e) => {
                                if (e.status === 206 || e.status === 200) {
                                    if (e.response instanceof ArrayBuffer) {
                                        h[f] = e.response;
                                        clog.log(
                                            `[${n}] 成功下载第 ${f + 1}/${c} 块 (${r})`,
                                        );
                                        a();
                                    } else {
                                        s(
                                            new Error(
                                                `第 ${f + 1} 块响应不是 ArrayBuffer。`,
                                            ),
                                        );
                                    }
                                } else {
                                    s(
                                        new Error(
                                            `第 ${f + 1} 块请求失败，状态码: ${e.status}`,
                                        ),
                                    );
                                }
                            },
                            onerror: (e) =>
                                s(
                                    new Error(
                                        `第 ${f + 1} 块网络错误: ${e.error}`,
                                    ),
                                ),
                            ontimeout: () =>
                                s(new Error(`第 ${f + 1} 块超时。`)),
                        });
                    }),
                s,
            );
            d.push(g);
        }
        try {
            await Promise.all(d);
            clog.log(`[${n}] 所有分块下载完成，开始合并...`);
        } catch (u) {
            clog.error(`[${n}] 分块下载过程中发生错误:`, u.message);
            throw u;
        }
        const g = new Blob(h);
        if (g.size !== o) {
            clog.warn(
                `[${n}] 警告：合并后的 Blob 大小 (${g.size}) 与预期文件大小 (${o}) 不匹配！`,
            );
        }
        const p = await g.text();
        let m;
        m = a ? a(p) : p;
        utils.download(m, n);
        clog.log(`[${n}] 文件合并完成，已触发浏览器下载。`);
    }
    async gmRequest(e, t, n = {}, a = {}, i = {}, s = false) {
        if (a && Object.keys(a).length) {
            const e = new URLSearchParams(a).toString();
            t += (t.includes("?") ? "&" : "?") + e;
        }
        const o = await storageManager.getSetting("httpTimeout", 5000);
        const r = await storageManager.getSetting("httpRetryCount", 3);
        n ||= undefined;
        return await utils.retry(
            () =>
                new Promise((a, r) => {
                    GM_xmlhttpRequest({
                        method: e,
                        url: t,
                        headers: i,
                        timeout: o,
                        data: n,
                        onload: (e) => {
                            try {
                                if (s && e.finalUrl !== t) {
                                    r("请求被重定向了,URL是:" + e.finalUrl);
                                }
                                if (e.status >= 200 && e.status < 300) {
                                    if (e.responseText) {
                                        try {
                                            a(JSON.parse(e.responseText));
                                        } catch (n) {
                                            a(e.responseText);
                                        }
                                    } else {
                                        a(e.responseText || e);
                                    }
                                } else {
                                    clog.error("请求失败,状态码:", e.status, t);
                                    if (e.responseText) {
                                        try {
                                            const t = JSON.parse(
                                                e.responseText,
                                            );
                                            r(t);
                                        } catch {
                                            r(
                                                new Error(
                                                    e.responseText ||
                                                        `请求发生错误 ${e.status}`,
                                                ),
                                            );
                                        }
                                    } else {
                                        r(
                                            new Error(
                                                `请求发生错误 ${e.status}`,
                                            ),
                                        );
                                    }
                                }
                            } catch (n) {
                                r(n);
                            }
                        },
                        onerror: (e) => {
                            clog.error("网络错误:", t);
                            r(new Error(e.error || "网络错误"));
                        },
                        ontimeout: () => {
                            r(new Error("请求超时: " + t));
                        },
                    });
                }),
            r,
        );
    }
})();
unsafeWindow.storageManager = window.storageManager = new z();
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
    '\n        <style>\n            .loading-container {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: flex;\n                justify-content: center;\n                align-items: center;\n                background-color: rgba(0, 0, 0, 0.1);\n                z-index: 99999999;\n            }\n    \n            .loading-animation {\n                position: relative;\n                width: 60px;\n                height: 12px;\n                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);\n                border-radius: 6px;\n                animation: loading-animate 1.8s ease-in-out infinite;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before,\n            .loading-animation:after {\n                position: absolute;\n                display: block;\n                content: "";\n                animation: loading-animate 1.8s ease-in-out infinite;\n                height: 12px;\n                border-radius: 6px;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before {\n                top: -20px;\n                left: 10px;\n                width: 40px;\n                background: linear-gradient(90deg, #ff758c 0%, #ff7eb3 100%);\n            }\n    \n            .loading-animation:after {\n                bottom: -20px;\n                width: 35px;\n                background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 100%);\n            }\n    \n            @keyframes loading-animate {\n                0% {\n                    transform: translateX(40px);\n                }\n                50% {\n                    transform: translateX(-30px);\n                }\n                100% {\n                    transform: translateX(40px);\n                }\n            }\n        </style>\n    ',
);
unsafeWindow.loading = window.loading = function () {
    const e = document.createElement("div");
    e.className = "loading-container";
    const t = document.createElement("div");
    t.className = "loading-animation";
    e.appendChild(t);
    document.body.appendChild(e);
    return {
        close: () => {
            if (e && e.parentNode) {
                e.parentNode.removeChild(e);
            }
        },
    };
};
(function () {
    const e = (e, t, n, a, i) => {
        let s;
        if (typeof n == "object") {
            s = n;
        } else {
            s = typeof a == "object" ? a : i || {};
            s.gravity = n || "top";
            s.position = typeof a == "string" ? a : "center";
        }
        if (!s.gravity || s.gravity === "center") {
            s.offset = {
                y: "calc(50vh - 150px)",
            };
        }
        const o = "#60A5FA";
        const r = "#93C5FD";
        const l = "#10B981";
        const c = "#6EE7B7";
        const d = "#EF4444";
        const h = "#FCA5A5";
        const g = {
            borderRadius: "12px",
            color: "white",
            padding: "12px 16px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            minWidth: "150px",
            textAlign: "center",
            zIndex: 999999999,
        };
        const p = {
            text: e,
            duration: 1000,
            close: false,
            gravity: "top",
            position: "center",
            style: {
                info: {
                    ...g,
                    background: `linear-gradient(to right, ${o}, ${r})`,
                },
                success: {
                    ...g,
                    background: `linear-gradient(to right, ${l}, ${c})`,
                },
                error: {
                    ...g,
                    background: `linear-gradient(to right, ${d}, ${h})`,
                },
            }[t],
            stopOnFocus: true,
            oldestFirst: false,
            ...s,
        };
        if (p.duration === -1) {
            p.close = true;
        }
        const m = Toastify(p);
        m.showToast();
        m.closeShow = () => {
            m.toastElement.remove();
        };
        return m;
    };
    unsafeWindow.show = window.show = {
        ok: (t, n = "center", a, i) => e(t, "success", n, a, i),
        error: (t, n = "center", a, i) => e(t, "error", n, a, i),
        info: (t, n = "center", a, i) => e(t, "info", n, a, i),
    };
})();
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
        const s = {
            zIndex: 999999990,
            navbar: false,
            zoomOnWheel: false,
            zoomRatio: 0.1,
            toggleOnDblclick: false,
            toolbar: {
                zoomIn: 1,
                zoomOut: 1,
                reset: 1,
                rotateLeft: 0,
                rotateRight: 0,
                flipHorizontal: 0,
                flipVertical: 0,
            },
            title: false,
            keyboard: false,
            viewed() {
                o.zoomTo(1.4);
                let e = (o.viewerData.width - o.imageData.width) / 2;
                o.moveTo(e, 0);
            },
            shown() {
                if (i) {
                    a.remove();
                }
                document.documentElement.style.overflow = "hidden";
                document.body.style.overflow = "hidden";
                o.handleKeydown = function (t) {
                    if (t.key === "Escape" || t.key === " ") {
                        t.preventDefault();
                        t.stopPropagation();
                        o.destroy();
                        document.removeEventListener(
                            "keydown",
                            o.handleKeydown,
                        );
                        document.documentElement.style.overflow = "";
                        document.body.style.overflow = "";
                        e();
                    }
                };
                document.addEventListener("keydown", o.handleKeydown);
            },
            hidden() {
                if (o && o.handleKeydown) {
                    document.removeEventListener("keydown", o.handleKeydown);
                }
                o.destroy();
                document.documentElement.style.overflow = "";
                document.body.style.overflow = "";
                e();
            },
        };
        const o = new Viewer(a[0], s);
        o.show();
    };
})();
window.ImageHoverPreview = class {
    constructor(e = {}) {
        this.config = {
            selector: ".hover-preview",
            dataAttribute: "data-full",
            maxWidth: 1000,
            maxHeight: 1000,
            offsetX: 20,
            offsetY: 20,
            zIndex: 9999999999,
            transition: 0.2,
            autoAdjustPosition: true,
            ...e,
        };
        this.preview = null;
        this.currentTarget = null;
        this.timer = null;
        this.imgElement = null;
        this.boundElements = new WeakSet();
        this.init();
    }
    init() {
        this.injectStyles();
        this.createPreviewElement();
        this.bindEvents();
    }
    injectStyles() {
        const e = `\n                <style>\n                    .image-hover-preview {\n                        position: fixed;\n                        display: none;\n                        z-index: ${this.config.zIndex};\n                        border-radius: 4px;\n                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n                        overflow: hidden;\n                        pointer-events: none;\n                        opacity: 0;\n                        transition: opacity ${this.config.transition}s ease;\n                        background-color: #fff;\n                    }\n                    \n                    .image-hover-preview.active {\n                        opacity: 1;\n                    }\n                    \n                    .image-hover-preview img {\n                        max-width: ${this.config.maxWidth}px;\n                        max-height: ${this.config.maxHeight}px;\n                        display: block;\n                        object-fit: contain;\n                    }\n                    \n                    .image-hover-preview::after {\n                        content: '';\n                        position: absolute;\n                        top: 0;\n                        left: 0;\n                        right: 0;\n                        bottom: 0;\n                        background: rgba(0, 0, 0, 0.03);\n                        pointer-events: none;\n                    }\n                    \n                    .image-hover-preview.loading::before {\n                        content: '加载中...';\n                        position: absolute;\n                        top: 50%;\n                        left: 50%;\n                        transform: translate(-50%, -50%);\n                        color: #666;\n                        font-size: 14px;\n                    }\n                </style>\n            `;
        document.head.insertAdjacentHTML("beforeend", e);
    }
    createPreviewElement() {
        this.preview = document.createElement("div");
        this.preview.className = "image-hover-preview";
        document.body.appendChild(this.preview);
    }
    bindEvents() {
        document.querySelectorAll(this.config.selector).forEach((e) => {
            if (!this.boundElements.has(e)) {
                e.addEventListener("mouseenter", (e) =>
                    this.handleMouseEnter(e),
                );
                e.addEventListener("mouseleave", (e) =>
                    this.handleMouseLeave(e),
                );
                e.addEventListener("mousemove", (e) => this.handleMouseMove(e));
                this.boundElements.add(e);
            }
        });
    }
    handleMouseEnter(e) {
        clearTimeout(this.timer);
        this.currentTarget = e.currentTarget;
        const t =
            this.currentTarget.getAttribute(this.config.dataAttribute) ||
            this.currentTarget.src;
        if (!t) {
            return;
        }
        this.preview.innerHTML = "";
        this.preview.classList.add("loading");
        this.preview.style.display = "block";
        this.preview.classList.remove("active");
        const n = new Image();
        n.onload = () => {
            this.preview.classList.remove("loading");
            this.preview.innerHTML = `<img src="${t}" alt="预览图">`;
            this.imgElement = this.preview.querySelector("img");
            const { width: a, height: i } = this.calculateImageSize(n);
            this.preview.style.width = `${a}px`;
            this.preview.style.height = `${i}px`;
            this.preview.offsetHeight;
            this.preview.classList.add("active");
            this.handleMouseMove(e);
        };
        n.onerror = () => {
            this.preview.classList.remove("loading");
            this.preview.innerHTML =
                '<div style="padding:10px;color:#f00;">图片加载失败</div>';
        };
        n.src = t;
    }
    calculateImageSize(e) {
        let t = e.naturalWidth;
        let n = e.naturalHeight;
        if (t > this.config.maxWidth || n > this.config.maxHeight) {
            const e = Math.min(
                this.config.maxWidth / t,
                this.config.maxHeight / n,
            );
            t *= e;
            n *= e;
        }
        return {
            width: t,
            height: n,
        };
    }
    handleMouseMove(e) {
        if (!this.currentTarget || !this.preview.classList.contains("active")) {
            return;
        }
        let { offsetX: t, offsetY: n } = this.config;
        let a = e.clientX + t;
        let i = e.clientY + n;
        if (this.config.autoAdjustPosition) {
            const s = this.preview.offsetWidth;
            const o = this.preview.offsetHeight;
            if (a + s > window.innerWidth) {
                a = e.clientX - s - t;
            }
            if (i + o > window.innerHeight) {
                i = e.clientY - o - n;
            }
            a = Math.max(0, a);
            i = Math.max(0, i);
        }
        this.preview.style.left = `${a}px`;
        this.preview.style.top = `${i}px`;
    }
    handleMouseLeave() {
        this.preview.classList.remove("active");
        this.preview.style.display = "none";
        this.currentTarget = null;
        this.imgElement = null;
    }
    destroy() {
        document.querySelectorAll(this.config.selector).forEach((e) => {
            if (this.boundElements.has(e)) {
                e.removeEventListener("mouseenter", this.handleMouseEnter);
                e.removeEventListener("mouseleave", this.handleMouseLeave);
                e.removeEventListener("mousemove", this.handleMouseMove);
                this.boundElements.delete(e);
            }
        });
        if (this.preview && this.preview.parentNode) {
            this.preview.parentNode.removeChild(this.preview);
        }
    }
};
(async function () {
    document.head.insertAdjacentHTML(
        "beforeend",
        "\n        <style>\n            .console-logger-container {\n                position: fixed;\n                bottom: 0;\n                right: 0;\n                z-index: 99999999;\n                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n                display: flex;\n                flex-direction: column; \n                align-items: flex-end;\n                width: fit-content;\n            }\n\n            .console-logger-toggle {\n                width: 40px;\n                height: 30px;\n                background: #2c3e50;\n                border-radius: 120px 10px 0 0;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                cursor: pointer;\n                box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);\n                transition: all 0.3s ease;\n                color: white;\n                font-size: 16px;\n            }\n\n            .console-logger-toggle:hover {\n                background: #34495e;\n            }\n\n            .console-logger-toggle::after {\n                content: '▼';\n                transition: transform 0.3s ease;\n            }\n\n            .console-logger-toggle.collapsed::after {\n                content: '▲';\n            }\n\n            .console-logger-window {\n                width: 400px;\n                height: 400px;\n                background: white;\n                border-radius: 10px 0 10px 10px;\n                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);\n                display: flex;\n                flex-direction: column;\n                overflow: hidden;\n                transform: translateY(0);\n                opacity: 1;\n                /* 简化过渡属性 */\n                transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease;\n            }\n\n            .console-logger-window.maximized {\n                width: 600px !important;\n                height: 85vh !important;\n                border-radius: 10px 0 0 10px; /* 调整圆角以匹配右下角 */\n            }\n\n            .console-logger-window.collapsed {\n                height: 0 !important;\n                min-height: 0 !important; \n                opacity: 0;\n            }\n\n            .console-logger-header {\n                background: #2c3e50;\n                color: white;\n                padding: 12px 15px;\n                display: flex;\n                justify-content: space-between;\n                align-items: center;\n                flex-shrink: 0;\n            }\n\n            .console-logger-title {\n                font-weight: 600;\n                font-size: 16px;\n            }\n\n            .console-logger-controls {\n                display: flex;\n                gap: 10px;\n            }\n\n            .console-logger-controls button {\n                background: transparent;\n                border: 1px solid rgba(255, 255, 255, 0.3);\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n            }\n\n            .console-logger-controls button:hover {\n                background: rgba(255, 255, 255, 0.1);\n            }\n\n            /* 新增的按钮样式 */\n            .console-logger-maximize-toggle {\n                line-height: 1;\n                font-size: 14px !important; /* 使箭头看起来更大 */\n                padding: 5px 8px !important;\n            }\n            .console-logger-maximize-toggle::before {\n                content: '⇱'; /* Unicode symbol for maximized */\n            }\n            .console-logger-maximize-toggle.active::before {\n                content: '⇲'; /* Unicode symbol for minimized */\n            }\n\n\n            .console-logger-filters {\n                display: flex;\n                align-items: center;\n                gap: 5px;\n                padding: 10px;\n                background: #f8f9fa;\n                border-bottom: 1px solid #e9ecef;\n                flex-shrink: 0;\n                overflow-x: hidden; \n            }\n\n            /* 新增: 过滤器按钮组的容器，负责滚动 */\n            .console-logger-filter-group {\n                display: flex;\n                gap: 5px;\n                overflow-x: auto; /* 允许过滤器按钮滚动 */\n                flex-grow: 1; /* 占据剩余空间 */\n                padding-right: 10px; /* 避免滚动条影响按钮 */\n            }\n\n            .console-logger-filter {\n                padding: 5px 10px;\n                font-size: 12px;\n                border-radius: 15px;\n                background: #ecf0f1;\n                color: #7f8c8d;\n                border: 1px solid #ddd;\n                cursor: pointer;\n                transition: all 0.3s;\n                white-space: nowrap;\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-filter.active {\n                background: #3498db;\n                color: white;\n                border-color: #3498db;\n            }\n\n            /* 新增: 滚动到底部按钮的样式 (位于 filtersContainer 内部右侧) */\n            .console-logger-scroll-to-bottom {\n                background: #3498db;\n                border: none;\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n                line-height: 1;\n                height: fit-content;\n                white-space: nowrap;\n                margin-left: auto; /* 将按钮推到最右侧 */\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-scroll-to-bottom:hover {\n                background: #2980b9;\n            }\n\n\n            .console-logger-content {\n                flex: 1;\n                overflow-y: auto;\n                padding: 10px;\n                background: #ffffff;\n                word-wrap: break-word;\n                text-align: left;\n            }\n\n            .console-logger-entry {\n                padding: 8px 10px;\n                margin-bottom: 3px;\n                border-radius: 4px;\n                font-size: 12px;\n                line-height: 1.4;\n                /*animation: consoleFadeIn 0.3s ease;*/\n                border-left: 3px solid transparent;\n            }\n\n            @keyframes consoleFadeIn {\n                from { opacity: 0; transform: translateY(5px); }\n                to { opacity: 1; transform: translateY(0); }\n            }\n\n            .console-logger-timestamp {\n                color: #7f8c8d;\n                font-size: 11px;\n                margin-right: 2px;\n            }\n\n            @media (max-width: 768px) {\n                .console-logger-container {\n                    right: 10px;\n                    bottom: 10px;\n                }\n\n                .console-logger-window {\n                    width: calc(100vw - 20px);\n                    height: 300px;\n                }\n            }\n            \n            .console-logger-message[data-type=\"json\"] {\n                white-space: pre-wrap; \n            }\n        </style>\n    ",
    );
    const e = {
        base: {
            label: "信息",
            background: "#e8f4fd",
            borderLeftColor: "#3498db",
        },
        warn: {
            label: "警告",
            background: "#fef9e7",
            borderLeftColor: "#f39c12",
        },
        error: {
            label: "错误",
            background: "#fdedec",
            borderLeftColor: "#e74c3c",
        },
        debug: {
            label: "调试",
            background: "#f4f6f6",
            borderLeftColor: "#95a5a6",
        },
    };
    const t = {
        base: ["base", "warn", "error"],
        warn: ["warn"],
        error: ["error"],
        debug: ["base", "warn", "error", "debug"],
    };
    const n = await storageManager.getSetting("clogMsgCount", 2000);
    const a = "jhs_clog_maximize";
    const i = "jhs_clog_expand";
    const s = "jhs_clog_filter";
    class o {
        constructor() {
            const t = localStorage.getItem(s);
            this.currentFilter = t && e[t] ? t : "base";
            this.logs = [];
            this.isInitialized = false;
            this.userScrolledUp = false;
        }
        tryInitialize() {
            return (
                document.readyState !== "loading" &&
                (this.isInitialized ||
                    (this.init(), (this.isInitialized = true)),
                true)
            );
        }
        init() {
            this.createContainer();
            this.bindEvents();
            this.checkInitialMaximizeState();
            this.checkInitialCollapseState();
        }
        createContainer() {
            this.container = document.createElement("div");
            this.container.className = "console-logger-container";
            this.container.style.display = "none";
            this.toggleBtn = document.createElement("div");
            this.toggleBtn.className = "console-logger-toggle collapsed";
            this.container.appendChild(this.toggleBtn);
            this.window = document.createElement("div");
            this.window.className = "console-logger-window collapsed";
            const t = document.createElement("div");
            t.className = "console-logger-header";
            const n = document.createElement("div");
            n.className = "console-logger-title";
            n.textContent = "JHS V3.3.2";
            const a = document.createElement("div");
            a.className = "console-logger-controls";
            this.maximizeBtn = document.createElement("button");
            this.maximizeBtn.textContent = "";
            this.maximizeBtn.classList.add("console-logger-maximize-toggle");
            a.appendChild(this.maximizeBtn);
            const i = document.createElement("button");
            i.textContent = "清空";
            i.addEventListener("click", () => this.clear());
            a.appendChild(i);
            t.appendChild(n);
            t.appendChild(a);
            this.filtersContainer = document.createElement("div");
            this.filtersContainer.className = "console-logger-filters";
            this.filterButtonGroup = document.createElement("div");
            this.filterButtonGroup.className = "console-logger-filter-group";
            this.filtersContainer.appendChild(this.filterButtonGroup);
            this.scrollToBottomBtn = document.createElement("button");
            this.scrollToBottomBtn.className =
                "console-logger-scroll-to-bottom";
            this.scrollToBottomBtn.textContent = "到底部";
            this.filtersContainer.appendChild(this.scrollToBottomBtn);
            this.content = document.createElement("div");
            this.content.className = "console-logger-content jhs-scrollbar";
            this.window.appendChild(t);
            this.window.appendChild(this.filtersContainer);
            this.window.appendChild(this.content);
            this.container.appendChild(this.window);
            document.body.appendChild(this.container);
            Object.keys(e).forEach((t) => {
                const n = document.createElement("div");
                n.className = "console-logger-filter";
                if (t === this.currentFilter) {
                    n.classList.add("active");
                }
                n.textContent = e[t].label;
                n.dataset.type = t;
                n.addEventListener("click", () => this.setFilter(t));
                this.filterButtonGroup.appendChild(n);
            });
        }
        bindEvents() {
            this.toggleBtn.addEventListener("click", () => {
                this.toggleExpandCollapsed();
            });
            this.maximizeBtn.addEventListener("click", () =>
                this.toggleMaximize(),
            );
            this.scrollToBottomBtn.addEventListener("click", () => {
                this.content.scrollTop = this.content.scrollHeight;
                this.userScrolledUp = false;
            });
            this.content.addEventListener("scroll", () => {
                const e =
                    this.content.scrollHeight - this.content.clientHeight <=
                    this.content.scrollTop + 5;
                this.userScrolledUp = !e;
            });
            this.content.addEventListener(
                "wheel",
                (e) => {
                    const t = this.content.scrollTop === 0;
                    const n =
                        this.content.scrollHeight - this.content.clientHeight <=
                        this.content.scrollTop + 1;
                    if ((t && e.deltaY < 0) || (n && e.deltaY > 0)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                },
                {
                    passive: false,
                },
            );
        }
        toggleExpandCollapsed() {
            const e = this.window.classList.toggle("collapsed");
            this.toggleBtn.classList.toggle("collapsed");
            if (e) {
                localStorage.setItem(i, "no");
            } else {
                localStorage.setItem(i, "yes");
                this.reRenderAllLogs();
            }
        }
        checkInitialCollapseState() {
            const e = localStorage.getItem(i);
            if (e && e !== "no") {
                this.window.classList.toggle("collapsed");
                this.toggleBtn.classList.toggle("collapsed");
                setTimeout(() => {
                    this.content.scrollTop = this.content.scrollHeight;
                }, 0);
            } else {
                this.window.classList.add("collapsed");
                this.toggleBtn.classList.add("collapsed");
            }
        }
        checkInitialMaximizeState() {
            if (localStorage.getItem(a) === "maximized") {
                this.window.classList.add("maximized");
                this.maximizeBtn.classList.add("active");
            }
        }
        toggleMaximize() {
            const e = this.window.classList.toggle("maximized");
            this.maximizeBtn.classList.toggle("active", e);
            if (e) {
                localStorage.setItem(a, "maximized");
            } else {
                localStorage.setItem(a, "minimized");
            }
            if (!this.window.classList.contains("collapsed")) {
                this.content.scrollTop = this.content.scrollHeight;
            }
        }
        addLog(t, a = "base", ...i) {
            const s = this.tryInitialize();
            let o;
            let r = [];
            if (e[a]) {
                o = a;
                r = i;
            } else {
                o = "base";
                r = [a, ...i];
            }
            o = e[o] ? o : "base";
            const l = [t, ...r];
            let c = "msg";
            const d = [];
            l.forEach((e) => {
                if (Object.prototype.toString.call(e) === "[object Error]") {
                    d.push(String(e));
                } else if (typeof e == "object" && e !== null) {
                    try {
                        d.push("<br/>" + JSON.stringify(e, null, 2));
                        c = "json";
                    } catch (t) {
                        d.push(String(e));
                        c = "msg";
                    }
                } else {
                    d.push(String(e));
                }
            });
            let h = d.join("  ");
            h = h.replace(
                /(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi,
                (e) => {
                    const t = e.startsWith("http") || e.startsWith("ftp");
                    const n = e.startsWith("//");
                    const a = e.startsWith("www.");
                    let i = e;
                    if (n) {
                        i = `http:${e}`;
                    } else if (!t && a) {
                        i = `http://${e}`;
                    }
                    return `<a href="${i}" target="_blank">${e}</a>`;
                },
            );
            const g = {
                message: h,
                messageType: c,
                type: o,
                timestamp: new Date(),
                id: Date.now() + Math.random(),
            };
            this.logs.push(g);
            if (this.logs.length > n) {
                const e = this.logs[0];
                if (s) {
                    const t = this.content.querySelector(
                        `.console-logger-entry[data-id="${e.id}"]`,
                    );
                    if (t) {
                        this.logs.shift();
                        this.content.removeChild(t);
                    }
                }
            }
            if (s) {
                this.renderLog(g);
            }
        }
        log(...e) {
            const [t, ...n] = e;
            setTimeout(() => {
                this.addLog(t, "base", ...n);
            }, 0);
        }
        error(...e) {
            const [t, ...n] = e;
            console.error(...e);
            setTimeout(() => {
                this.addLog(t, "error", ...n);
            }, 0);
        }
        warn(...e) {
            const [t, ...n] = e;
            setTimeout(() => {
                this.addLog(t, "warn", ...n);
            }, 0);
        }
        debug(...e) {
            const [t, ...n] = e;
            setTimeout(() => {
                this.addLog(t, "debug", ...n);
            }, 0);
        }
        renderLog(e) {
            if (this.container.style.display === "none") {
                return;
            }
            if (this.window.classList.contains("collapsed")) {
                return;
            }
            if (!(t[this.currentFilter] || []).includes(e.type)) {
                return;
            }
            const n = this._createLogElement(e);
            this.content.appendChild(n);
            if (
                !this.window.classList.contains("collapsed") &&
                !this.userScrolledUp
            ) {
                this.content.scrollTop = this.content.scrollHeight;
            }
        }
        reRenderAllLogs() {
            if (this.container.style.display !== "none") {
                if (!this.window.classList.contains("collapsed")) {
                    setTimeout(() => {
                        this.content.innerHTML = "";
                        if (this.logs.length === 0) {
                            return;
                        }
                        const e = t[this.currentFilter] || [];
                        const n = document.createDocumentFragment();
                        this.logs.forEach((t) => {
                            if (e.includes(t.type)) {
                                const e = this._createLogElement(t);
                                n.appendChild(e);
                            }
                        });
                        this.content.appendChild(n);
                        this.content.scrollTop = this.content.scrollHeight;
                    }, 0);
                }
            }
        }
        _createLogElement(t) {
            const n = document.createElement("div");
            n.className = "console-logger-entry";
            n.dataset.type = t.type;
            n.dataset.id = t.id;
            const a = e[t.type] || e.base;
            n.style.borderLeft = "3px solid " + a.borderLeftColor;
            n.style.background = a.background;
            const i = (
                t.timestamp instanceof Date
                    ? t.timestamp
                    : new Date(t.timestamp)
            )
                .toTimeString()
                .split(" ")[0];
            n.innerHTML = `\n                <span class="console-logger-timestamp">[${i}]</span>\n                <span class="console-logger-message" data-type="${t.messageType}">${t.message}</span>\n            `;
            return n;
        }
        setFilter(e) {
            if (this.currentFilter === e) {
                return;
            }
            this.currentFilter = e;
            localStorage.setItem(s, e);
            this.filterButtonGroup
                .querySelectorAll(".console-logger-filter")
                .forEach((t) => {
                    if (t.dataset.type === e) {
                        t.classList.add("active");
                    } else {
                        t.classList.remove("active");
                    }
                });
            this.reRenderAllLogs();
        }
        clear() {
            this.logs = [];
            this.content.innerHTML = "";
        }
        show() {
            if (
                (this.isInitialized && this.container) ||
                (this.tryInitialize() && this.container)
            ) {
                this.container.style.display = "";
                this.reRenderAllLogs();
            }
        }
        hide() {
            if (this.isInitialized && this.container) {
                this.container.style.display = "none";
            }
        }
        lowZIndex() {
            if (this.isInitialized && this.container) {
                this.container.style.zIndex = "12345678";
            }
        }
        highZIndex() {
            if (this.isInitialized && this.container) {
                this.container.style.zIndex = "999999999";
            }
        }
    }
    try {
        if (
            unsafeWindow.parent.clog &&
            typeof unsafeWindow.parent.clog.log == "function"
        ) {
            window.clog = unsafeWindow.clog = unsafeWindow.parent.clog;
        } else {
            window.clog = unsafeWindow.clog = new o();
        }
    } catch (r) {
        console.error("创建日志控制台出现异常", r);
        window.clog = unsafeWindow.clog = new o();
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
class PluginManager {
    constructor() {
        this.plugins = new Map();
    }
    register(e) {
        if (typeof e != "function") {
            throw new Error("插件必须是一个类");
        }
        const t = new e();
        t.pluginManager = this;
        const n = t.getName();
        if (this.plugins.has(n)) {
            throw new Error(`插件"${name}"已注册`);
        }
        this.plugins.set(n, t);
    }
    getBean(e) {
        return this.plugins.get(e);
    }
    async processCss() {
        const e = (
            await Promise.allSettled(
                Array.from(this.plugins).map(async ([e, t]) => {
                    try {
                        if (typeof t.initCss == "function") {
                            const n = await t.initCss();
                            if (n) {
                                utils.insertStyle(n);
                            }
                            return {
                                name: e,
                                status: "fulfilled",
                            };
                        }
                        return {
                            name: e,
                            status: "skipped",
                        };
                    } catch (n) {
                        console.error(`插件 ${e} 加载 CSS 失败`, n);
                        return {
                            name: e,
                            status: "rejected",
                            error: n,
                        };
                    }
                }),
            )
        ).filter((e) => e.status === "rejected");
        if (e.length) {
            console.error(
                "以下插件的 CSS 加载失败：",
                e.map((e) => e.value.name),
            );
        }
    }
    async processPlugins() {
        const e = (
            await Promise.allSettled(
                Array.from(this.plugins).map(async ([e, t]) => {
                    try {
                        if (typeof t.handle == "function") {
                            await t.handle();
                            return {
                                name: e,
                                status: "fulfilled",
                            };
                        }
                    } catch (n) {
                        clog.error(`插件 ${e} 执行失败`, n);
                        return {
                            name: e,
                            status: "rejected",
                            error: n,
                        };
                    }
                }),
            )
        ).filter((e) => e.status === "rejected");
        if (e.length) {
            console.error(
                "以下插件执行失败：",
                e.map((e) => e.value.name),
            );
        }
    }
}
class BasePlugin {
    constructor() {
        i(this, "pluginManager", null);
        i(
            this,
            "settingSvg",
            '<svg t="1760926954860" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4947" width="200" height="200"><path d="M511.099222 365.825763c-80.7786 0-146.26579 65.482515-146.26579 146.259556 0 80.7786 65.48719 146.259556 146.26579 146.259556 80.777041 0 146.259556-65.480957 146.259556-146.259556C657.358779 431.308278 591.876263 365.825763 511.099222 365.825763L511.099222 365.825763zM511.099222 585.215097c-40.391637 0-73.136012-32.742816-73.136012-73.129778 0-40.391637 32.742816-73.129778 73.136012-73.129778 40.386962 0 73.129778 32.738141 73.129778 73.129778C584.229 552.472281 551.486184 585.215097 511.099222 585.215097L511.099222 585.215097zM511.099222 585.215097M900.893017 568.24369l-26.451395-15.268032c3.065451-27.021784 3.138697-54.472139 0.077922-81.822754l26.373473-15.225955c69.953678-40.391637 93.920921-129.844512 53.533959-199.799749-40.390079-69.95212-129.839837-93.925596-199.799749-53.533959l-26.373473 15.225955c-22.153219-16.330888-45.963059-29.99217-70.896534-40.843585l0-30.545416c0-80.777041-65.48719-146.259556-146.26579-146.259556-80.7786 0-146.259556 65.482515-146.259556 146.259556l0 30.515806c-12.377127 5.421811-24.587501 11.55583-36.562551 18.473743-11.97505 6.917913-23.396854 14.420242-34.277879 22.432179l-26.431136-15.258682c-69.958353-40.391637-159.406553-16.424395-199.79819 53.533959C27.378272 326.082437 51.343956 415.535311 121.299193 455.922273l26.449837 15.275825c-3.063892 27.020226-3.137139 54.465905-0.077922 81.822754l-26.373473 15.224397c-69.953678 40.391637-93.920921 129.841395-53.533959 199.799749 40.391637 69.95212 129.839837 93.920921 199.79819 53.533959l26.375032-15.224397c22.153219 16.32933 45.963059 29.984378 70.896534 40.843585l0 30.537624c0 80.7786 65.48719 146.26579 146.26579 146.26579 80.777041 0 146.259556-65.48719 146.259556-146.26579l0-30.515806c12.377127-5.415577 24.587501-11.55583 36.567226-18.467509 11.97505-6.917913 23.398412-14.420242 34.277879-22.432179l26.423343 15.258682c69.959912 40.391637 159.408111 16.418162 199.799749-53.533959C994.813938 698.085085 970.848254 608.635327 900.893017 568.24369L900.893017 568.24369zM891.096666 731.474653c-20.198936 34.982294-64.923035 46.962019-99.900654 26.770875l-63.331869-36.567226 0 0 0 0-7.988562-4.611422c-18.134004 18.450366-39.024886 34.787489-62.516805 48.353705-23.49971 13.559983-48.091888 23.482568-73.129778 29.964118l0 9.222846 0 0 0 65.828489 0 7.301289c0 40.391637-32.742816 73.136012-73.136012 73.136012-40.386962 0-73.129778-32.742816-73.129778-73.136012l0-7.402588 0-65.72719 0 0 0-9.300768c-50.682014-13.090892-97.855981-39.682547-135.652816-78.232109l-7.983886 4.606747 0 0-63.331869 36.567226c-34.977618 20.191144-79.706394 8.206743-99.900654-26.770875-20.192702-34.977618-8.206743-79.701718 26.770875-99.899095l6.341291-3.657657 0 0 64.972905-37.516316c-14.487254-52.005129-13.929333-106.151555 0.073247-156.593569l-8.057133-4.650384 0 0-63.331869-36.567226c-34.982294-20.192702-46.963578-64.923035-26.770875-99.900654 20.192702-34.97606 64.923035-46.962019 99.900654-26.763083l6.324148 3.649866 0 0 64.996282 37.528784c18.132445-18.450366 39.024886-34.790606 62.516805-48.353705 23.493477-13.559983 48.085654-23.485685 73.129778-29.964118l0-9.229079L437.960093 153.739276l0-7.309082c0-40.385404 32.742816-73.129778 73.129778-73.129778 40.391637 0 73.129778 32.744375 73.129778 73.129778l0 7.404147 0 65.72719 0 9.307001c50.686689 13.086217 97.862215 39.684106 135.657491 78.232109l48.487732-27.997368 22.828023-13.176607c34.977618-20.192702 79.701718-8.212977 99.89442 26.763083 20.198936 34.982294 8.212977 79.706394-26.764641 99.900654l-30.822819 17.79738-32.50905 18.769847 0 0 0 0-7.983886 4.605189c14.488813 52.009805 13.929333 106.159347-0.077922 156.599803l64.979139 37.511641 0 0 6.414537 3.701294C899.303409 651.772936 911.289368 696.498594 891.096666 731.474653L891.096666 731.474653zM891.096666 731.474653M197.330785 324.240361c-1.932465 3.232203-3.824411 6.497135-5.649343 9.785442L197.330785 324.240361 197.330785 324.240361zM197.330785 324.240361M830.515443 690.133926l-5.655577 9.804144C826.793889 696.699632 828.685835 693.433143 830.515443 690.133926L830.515443 690.133926zM830.515443 690.133926M505.297151 146.430195l11.304921 0C512.835324 146.369416 509.067017 146.374091 505.297151 146.430195L505.297151 146.430195zM505.297151 146.430195M516.898176 877.740444l-11.31583 0C509.350653 877.796547 513.125193 877.796547 516.898176 877.740444L516.898176 877.740444zM516.898176 877.740444" fill="#272636" p-id="4948"></path></svg>',
        );
        i(
            this,
            "editSvg",
            '<svg t="1760920692801" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3545" width="200" height="200"><path d="M1013.929675 128.26571a143.759824 143.759824 0 0 1 10.44409 53.858738 84.576649 84.576649 0 0 1-5.836403 30.308339 92.870485 92.870485 0 0 1-18.635533 29.284408 1314.726599 1314.726599 0 0 1-24.983901 24.574329c-7.372299 7.06512-13.82306 13.311095-19.249891 18.737926-6.143582 6.143582-12.082378 11.672806-17.406817 16.382886L720.266444 82.598415c9.317766-8.601015 20.478607-18.942712 33.277737-31.02509s23.448006-21.604931 31.946628-28.67005a102.085858 102.085858 0 0 1 68.193763-22.731255c11.263234 0.307179 22.116896 2.047861 32.560985 5.222045 10.546483 3.071791 19.659463 6.655547 27.441334 10.546483 16.280493 8.601015 34.301667 23.550399 54.063524 45.052936 19.864249 21.502538 35.120812 43.82422 46.076867 67.272226z m-907.20231 570.943576l32.560986-33.38013c17.099637-17.509209 38.397389-39.216533 64.098041-64.917186l84.986221-85.395793 94.303987-94.815953 250.350976-251.477299L850.817567 389.163169 600.46659 640.640468l-93.177663 94.815953c-31.02509 30.410732-58.978389 58.364031-83.859898 83.655111-24.779115 25.29108-45.360116 46.17926-61.743001 62.562146a504.797674 504.797674 0 0 1-55.804206 50.274981c-10.239304 7.884264-20.581 14.130239-31.537055 18.737926a507.152714 507.152714 0 0 1-47.715156 19.86425 1609.311367 1609.311367 0 0 1-131.063087 42.185931c-20.478607 5.426831-35.837563 8.908194-45.974474 10.546483-20.88818 2.35504-34.813633-0.819144-41.981145-9.42016-6.860333-8.601015-8.805801-22.93604-5.73401-43.312254a396.261054 396.261054 0 0 1 11.058448-47.305584c5.836403-20.683394 12.082378-42.185931 18.635532-64.40522 6.553154-22.219289 13.003916-42.697897 19.249891-61.435822 6.143582-18.635533 11.263234-31.537055 15.15417-38.602176 4.607687-10.853662 9.829732-20.785787 15.666135-29.796373a192.49891 192.49891 0 0 1 25.086294-29.796374z" fill="#FF9500" p-id="3546"></path></svg>',
        );
        i(
            this,
            "deleteSvg",
            '<svg t="1760921450746" class="jhs-icon icon" viewBox="0 0 1194 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4530" width="200" height="200"><path d="M761.086847 36.028779s309.754321-147.538628 424.952209 231.50509c2.047962 6.570546 71.337359 253.862013-220.838618 415.139055-12.970429 7.167869-267.515096 145.746661-370.339877 341.327076 0 0-90.963666-205.649563-393.379455-351.566888-6.399883-3.071944-304.549083-156.583796-163.751664-487.2444 3.669266-8.533177 163.666333-336.20717 466.423449-99.411511l24.575549 27.391498L387.931021 324.279495l237.648977 159.570408-109.139333 145.746661L625.579998 849.069874l-30.719437-205.820227 166.226286-169.81022-216.486698-168.103585L761.086847 36.028779z" fill="#F4382E" p-id="4531"></path></svg>',
        );
        i(
            this,
            "checkSvg",
            '<svg t="1760921633527" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5603" width="200" height="200"><path d="M924.928 544A413.76 413.76 0 0 1 544 924.736v3.264h-64v-3.2A413.696 413.696 0 0 1 99.072 544H96v-64h3.072A413.696 413.696 0 0 1 480 99.2V96h64v3.2a413.76 413.76 0 0 1 380.928 380.8h3.072v64h-3.072z m-64-64A350.016 350.016 0 0 0 544 163.2V288h-64V163.2A350.016 350.016 0 0 0 163.072 480H288v64H163.072A350.016 350.016 0 0 0 480 860.8V736h64v124.8a350.016 350.016 0 0 0 316.928-316.8H736v-64h124.928zM512 544a32 32 0 1 1 32-32 32 32 0 0 1-32 32z" fill="#333333" p-id="5604"></path></svg>',
        );
        i(
            this,
            "actressSvg",
            '<svg t="1760926744637" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1948" width="200" height="200"><path d="M265.950168 668.467036V209.809493A209.809493 209.809493 0 0 1 475.759661 0h40.949536A209.809493 209.809493 0 0 1 726.564189 209.809493v440.435" p-id="1949"></path><path d="M916.558657 825.861124a193.463804 193.463804 0 0 0-137.442564-155.83573l-186.001889-45.795231-10.487631-124.293214H424.106373L412.231008 624.025416l-170.623063 44.44162a193.452429 193.452429 0 0 0-133.666108 154.698244L76.410695 1023.192384h871.189985z" fill="#FFE7D9" p-id="1950"></path><path d="M668.472724 265.682859c68.431223-29.187919 96.140409 100.349111 5.20969 151.774902z" fill="#FFCFB5" p-id="1951"></path><path d="M676.378259 334.421203c1.137487-99.814492-38.674561-172.158671-38.674561-172.15867l-59.740822 11.920865a493.805894 493.805894 0 0 1-80.761583 9.099896 493.669396 493.669396 0 0 1-80.761583-9.099896l-59.683948-11.88674s-39.812048 72.344179-38.776934 172.15867l-1.080613 92.05683c5.209691 56.271486 92.4777 121.381247 195.022161 119.163147 61.196805 0.034125 165.59537-51.573665 165.59537-119.197272z" fill="#FFE7D9" p-id="1952"></path><path d="M322.198905 274.703131c-68.419848-29.187919-96.140409 100.349111-5.209691 151.774902z" fill="#FFCFB5" p-id="1953"></path><path d="M297.390311 812.461526H742.034014a38.458438 38.458438 0 0 1 38.458438 38.458439V1020.325917H258.931873V850.90859a38.458438 38.458438 0 0 1 38.458438-38.447064z" fill="#FFD527" p-id="1954"></path><path d="M690.539973 92.284327c-20.645391 84.287793-275.613121 235.323328-424.589805 117.525166l104.955934-95.548915 139.399042-64.529643z" p-id="1955"></path><path d="M285.321573 383.708519h33.624119v177.118114h-33.624119zM675.855015 383.708519h33.624118v177.118114h-33.624118z" fill="#FFD527" p-id="1956"></path></svg>',
        );
        i(
            this,
            "newSvg",
            '<svg t="1760926857487" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3954" width="200" height="200"><path d="M508.330667 733.994667c-11.008-7.338667-13.44-17.109333-7.338667-29.333334 28.117333-37.888 41.557333-98.986667 40.341333-183.317333v-165.013333c0-14.656 7.338667-23.210667 21.994667-25.664 37.888-1.216 82.496-5.504 133.845333-12.842667 13.44-2.432 21.376 3.072 23.829334 16.512 1.216 12.224-4.266667 19.562667-16.512 21.994667a1787.093333 1787.093333 0 0 1-113.664 11.008c-6.101333 0-9.173333 3.669333-9.173334 10.986666v84.330667h135.68c12.224 1.237333 18.944 7.957333 20.16 20.181333-1.216 10.986667-7.936 17.109333-20.16 18.346667h-36.672v223.658667c-1.216 12.202667-7.936 18.944-20.16 20.16-11.008-1.216-17.109333-7.957333-18.346666-20.16V501.162667h-60.48v18.346666c1.216 92.885333-13.44 161.92-44.010667 207.146667-6.101333 12.224-15.893333 14.677333-29.333333 7.338667z m-131.989334-282.325334c-1.237333 0-2.453333 0.618667-3.669333 1.834667h45.824a522.666667 522.666667 0 0 0 16.512-31.168c7.317333-12.224 12.224-20.778667 14.656-25.664 6.122667-11.008 15.274667-14.677333 27.52-11.008 9.770667 6.122667 12.202667 14.058667 7.317333 23.829333-4.906667 9.792-13.44 24.448-25.664 44.010667h49.493334c9.770667 1.216 15.274667 6.72 16.512 16.490667-1.237333 11.008-6.741333 17.109333-16.512 18.346666h-82.496a12.437333 12.437333 0 0 1 3.669333 9.173334v38.485333h69.653333c9.792 1.216 15.296 6.72 16.512 16.490667-1.216 11.008-6.72 17.130667-16.512 18.346666h-69.653333v108.16c0 34.218667-15.274667 51.946667-45.845333 53.162667h-16.490667a195.157333 195.157333 0 0 1-20.16 1.834667c-12.224 0-19.562667-6.72-22.016-20.16 1.237333-12.224 7.338667-18.944 18.346667-20.16 2.432 0 6.101333 0.597333 10.986666 1.834666h11.008c15.893333 0 23.829333-8.554667 23.829334-25.685333v-98.986667H314.026667c-11.008-1.216-17.109333-7.338667-18.346667-18.346666 1.237333-9.770667 7.338667-15.274667 18.346667-16.490667h75.157333V497.493333c0-3.669333 1.216-6.72 3.669333-9.173333h-89.813333c-11.029333-1.216-17.130667-7.317333-18.346667-18.325333 1.216-9.770667 7.317333-15.274667 18.346667-16.490667h56.810667c-3.669333-1.216-6.72-4.266667-9.173334-9.173333-1.216-1.216-3.050667-4.266667-5.482666-9.173334a758.336 758.336 0 0 0-14.677334-23.829333c-4.885333-9.770667-3.050667-17.706667 5.504-23.829333 11.008-3.669333 19.562667-1.216 25.664 7.338666 2.453333 2.432 6.122667 7.338667 11.008 14.656 6.101333 8.554667 9.770667 14.08 10.986667 16.512 4.906667 9.770667 2.453333 18.346667-7.317333 25.664z m-60.501333-71.509333c-9.792-1.216-15.274667-7.317333-16.512-18.346667 1.237333-9.749333 6.72-15.253333 16.512-16.490666h75.157333c-3.669333-12.202667-7.338667-21.973333-10.986666-29.333334-1.237333-12.202667 3.648-19.541333 14.656-21.973333 12.224-2.453333 21.397333 1.216 27.52 10.986667 0 1.216 0.597333 3.669333 1.813333 7.338666 4.906667 15.872 9.173333 26.88 12.842667 32.981334h60.48c11.008 1.237333 17.130667 6.741333 18.346666 16.512-1.216 11.008-7.338667 17.109333-18.346666 18.346666h-181.482667z m-14.677333 311.68c-8.533333-6.122667-10.986667-14.08-7.338667-23.829333a1659.648 1659.648 0 0 0 33.002667-66.005334c4.906667-9.792 12.224-12.842667 22.016-9.173333 9.770667 4.906667 13.44 12.224 10.986666 21.994667-3.669333 6.122667-9.173333 17.728-16.490666 34.837333-8.554667 15.893333-14.677333 27.52-18.346667 34.837333-4.885333 8.554667-12.821333 11.008-23.829333 7.338667z m201.664-25.664c-9.770667 4.885333-18.346667 2.432-25.664-7.338667a1138.56 1138.56 0 0 1-27.498667-44.010666c-4.885333-8.533333-3.050667-16.490667 5.504-23.829334 9.770667-3.669333 18.346667-1.216 25.664 7.338667l14.677333 21.994667c6.101333 9.770667 10.389333 17.109333 12.821334 21.994666 4.906667 8.554667 3.050667 16.512-5.504 23.850667z" fill="#333333" p-id="3955"></path><path d="M675.328 117.717333A425.429333 425.429333 0 0 0 512 85.333333C276.352 85.333333 85.333333 276.352 85.333333 512s191.018667 426.666667 426.666667 426.666667 426.666667-191.018667 426.666667-426.666667c0-56.746667-11.093333-112-32.384-163.328a21.333333 21.333333 0 0 0-39.402667 16.341333A382.762667 382.762667 0 0 1 896 512c0 212.074667-171.925333 384-384 384S128 724.074667 128 512 299.925333 128 512 128c51.114667 0 100.8 9.984 146.986667 29.12a21.333333 21.333333 0 0 0 16.341333-39.402667z" fill="#333333" p-id="3956"></path></svg>',
        );
        i(
            this,
            "refreshSvg",
            '<svg t="1760926993643" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5942" width="200" height="200"><path d="M511.966722 0a511.966722 511.966722 0 1 0 179.828311 32.445891l-22.46254 59.964102A447.970882 447.970882 0 1 1 511.966722 63.99584a31.99792 31.99792 0 0 0 0-63.99584z" fill="#333333" p-id="5943"></path><path d="M649.2378 9.151405A30.909991 30.909991 0 0 1 671.316364 0h193.267438a31.99792 31.99792 0 0 1 31.357962 31.99792c0 17.662852-13.759106 31.99792-31.357962 31.99792H703.954243v160.629559a31.99792 31.99792 0 0 1-31.99792 31.357962 31.485953 31.485953 0 0 1-31.99792-31.357962V31.357962c0-8.511447 3.647763-16.318939 9.343392-21.950573z" fill="#333333" p-id="5944"></path></svg>',
        );
        i(
            this,
            "blacklistSvg",
            '<svg t="1761386375897" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1936" width="200" height="200"><path d="M513.199827 65.667605c-246.537999 0-446.399933 199.861934-446.399933 446.399933 0 246.553349 199.861934 446.399933 446.399933 446.399933 246.553349 0 446.399933-199.846584 446.399933-446.399933C959.599759 265.529539 759.753175 65.667605 513.199827 65.667605zM513.199827 894.697075c-211.320916 0-382.629537-171.322947-382.629537-382.628514 0-94.183056 34.029024-180.417069 90.461291-247.080352l165.389818 165.389818c4.320399 39.651069 26.816762 73.840752 58.981323 94.068446-72.189136 27.369348-123.517151 97.156784-123.517151 178.936345l337.541643 0 100.846826 100.846826C693.608709 860.664981 607.375719 894.697075 513.199827 894.697075zM805.362956 759.14175 697.264982 651.0448c-16.556071-58.332547-60.10082-105.306394-116.275213-126.601396 35.888372-22.570042 59.752896-62.511729 59.752896-108.032482 0-70.436212-57.108672-127.542838-127.542838-127.542838-48.218188 0-90.184999 26.765597-111.865787 66.245773L266.120498 219.900316c66.663282-56.432267 152.897296-90.461291 247.079328-90.461291 211.304544 0 382.628514 171.308621 382.628514 382.629537C895.82834 606.244454 861.796246 692.476421 805.362956 759.14175z" fill="#272636" p-id="1937"></path></svg>',
        );
    }
    getName() {
        throw new Error(`${this.constructor.name} 未显示getName()`);
    }
    getBean(e) {
        return this.pluginManager.getBean(e);
    }
    async initCss() {
        return "";
    }
    async handle() {}
    getPageInfo() {
        let e;
        let t;
        let n;
        let a;
        let i;
        let s = window.location.href;
        if (r) {
            e = $('a[title="複製番號"]').attr("data-clipboard-text");
            t = s.split("?")[0].split("#")[0];
            n = $(".female")
                .prev()
                .map((e, t) => $(t).text())
                .get()
                .join(" ");
            a = $(".male")
                .prev()
                .map((e, t) => $(t).text())
                .get()
                .join(" ");
            i = $('strong:contains("日期:")')
                .parent(".panel-block")
                .find(".value")
                .text()
                .trim();
        }
        if (l) {
            t = s.split("?")[0];
            e = t
                .split("/")
                .filter(Boolean)
                .pop()
                .replace(/_\d{4}-\d{2}-\d{2}$/, "");
            n = $('span[onmouseover*="star_"] a')
                .map((e, t) => $(t).text())
                .get()
                .join(" ");
            a = "";
            i = $('span.header:contains("發行日期:")')
                .parent("p")
                .text()
                .trim()
                .replace("發行日期:", "")
                .trim();
        }
        return {
            carNum: e,
            url: t,
            actress: n,
            actors: a,
            publishTime: i,
        };
    }
    getActressId() {
        const e = o.match(/\/actors\/([^/?]+)/);
        if (e && e.length > 1) {
            return e[1];
        } else {
            return null;
        }
    }
    getActressPageInfo() {
        let e = window.location.href;
        if (!e.includes("/actors/") && !e.includes("/star/")) {
            throw new Error("接口调用错误, 非演员详情页");
        }
        let t = [];
        let n = r
            ? $(".actor-section-name")
            : $(".avatar-box .photo-info .pb10");
        if (n.length) {
            n.text()
                .trim()
                .split(",")
                .forEach((e) => {
                    t.push(e.trim());
                });
        }
        let a = $(".section-meta:not(:contains('影片'))");
        if (a.length) {
            a.text()
                .trim()
                .split(",")
                .forEach((e) => {
                    t.push(e.trim());
                });
        }
        let i = $(".section-meta:contains('男優')").length > 0 ? B : P;
        let s = D;
        if (t.some((e) => e.includes("無碼"))) {
            s = A;
        }
        if (e.includes("uncensored")) {
            s = A;
        }
        let o = null;
        let c = null;
        const d = new URL(e);
        if (r) {
            c = d.pathname
                .split("/")
                .filter((e) => e.trim() !== "")
                .pop();
            const e = d.searchParams;
            e.delete("sort_type");
            e.delete("page");
            o = d.toString();
        } else if (l) {
            const t = "/star/";
            const n = e.split(t);
            if (n.length < 2) {
                throw new Error("提取演员url失败");
            }
            const a = n[0];
            c = n[1].split("/")[0];
            o = a + t + c;
        }
        return {
            starId: c,
            name: t[0],
            allName: t,
            role: i,
            movieType: s,
            blacklistUrl: o,
        };
    }
    getSelector(e) {
        const t = e || T;
        const n = {
            javdb: {
                boxSelector: ".movie-list",
                itemSelector: ".movie-list .item",
                coverImgSelector: ".cover img",
                requestDomItemSelector: ".movie-list .item",
                nextPageSelector: ".pagination-next",
            },
        };
        if (!t || !n[t]) {
            throw new Error("类型错误: 无法确定选择器类型 (JavDb)");
        }
        return n[t];
    }
    parseMovieId(e) {
        return e.split("/").pop().split(/[?#]/)[0];
    }
    getBoxCarInfo(e) {
        var t;
        var n;
        var a;
        const i = e.find("a");
        const s = i.attr("href");
        let o = null;
        let r = null;
        let l = null;
        const c = e.find(".video-title");
        if (c.length > 0) {
            const n = c.find("strong");
            if (n.length > 0) {
                o = n.text().trim();
            }
            r = (t = i.attr("title")) == null ? undefined : t.trim();
            if (!r) {
                const e = c.text().trim();
                r = o && e.includes(o) ? e.replace(o, "").trim() : e;
            }
            l = e.find(".meta").text().trim();
        }
        if (!o) {
            const t = e.find("img");
            if (t.length > 0) {
                r =
                    ((n = t.attr("title")) == null ? undefined : n.trim()) ||
                    ((a = t.attr("data-title")) == null ? undefined : a.trim());
            }
            const i = e
                .find("date")
                .map((e, t) => $(t).text().trim())
                .get();
            const s = (e) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e);
            l = i.find(s) || null;
            o = i.find((e) => !s(e)) || null;
        }
        if (!o) {
            const t = "提取番号信息失败: carNum 为空";
            console.error(
                "Error in getBoxCarInfo:",
                t,
                "Box Element:",
                e.get(0),
            );
            show.error(t);
            throw new Error(t);
        }
        return {
            carNum: o,
            url: s || "",
            title: r || "",
            publishTime: l || "",
        };
    }
    getBoxCarInfoList(e = null) {
        e ||= $(this.getSelector().itemSelector);
        if (e.length === 0) {
            clog.error("获取当前列表页所有item的番号信息失败!");
            return [];
        }
        const t = [];
        e.each((e, n) => {
            const a = $(n);
            try {
                const e = this.getBoxCarInfo(a);
                t.push(e);
            } catch (i) {
                clog.error(
                    "[getBoxCarInfoList] 提取单个 boxCar 信息失败:",
                    i.message,
                    "元素索引:",
                    e,
                );
            }
        });
        return t;
    }
    checkDuplicateCarNumbers(e, t) {
        if (!e || e.length === 0 || !t || t.length === 0) {
            return false;
        }
        const n = new Set(e.map((e) => e.carNum).filter((e) => e));
        if (n.size === 0) {
            return false;
        }
        let a = 0;
        for (let i = 0; i < t.length; i++) {
            const e = t[i] ? t[i].carNum : null;
            if (e && n.has(e)) {
                a++;
                if (a >= 2) {
                    clog.warn(
                        "警告: 检测到连续番号信息重复, 该类别可能已被限制页码。",
                    );
                    return true;
                }
            } else {
                a = 0;
            }
        }
        return false;
    }
}
class DetailPagePlugin extends BasePlugin {
    getName() {
        return "DetailPagePlugin";
    }
    constructor() {
        super();
    }
    handle() {
        if (window.isDetailPage) {
            $(".video-meta-panel a").each(function () {
                const e = $(this).attr("href");
                if (
                    e &&
                    (e.startsWith("http://") ||
                        e.startsWith("https://") ||
                        e.startsWith("/"))
                ) {
                    $(this).attr("target", "_blank");
                }
            });
            this.handleFancyBox();
        }
    }
    handleFancyBox() {
        document.addEventListener("click", function (e) {
            if (e.target.closest(".fancybox-button--thumbs")) {
                const e = !$(".fancybox-thumbs").is(":hidden");
                localStorage.setItem("jhs_fancyboxThumbs", e.toString());
                unsafeWindow.$.fancybox.defaults.thumbs.autoStart = e;
            }
        });
        if (unsafeWindow.$.fancybox !== undefined) {
            const e = localStorage.getItem("jhs_fancyboxThumbs");
            unsafeWindow.$.fancybox.defaults.thumbs.autoStart = e === "true";
        }
    }
}
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
const ie = class e {
    constructor() {
        if (new.target === e) {
            throw new Error("HotkeyManager cannot be instantiated.");
        }
    }
    static registerHotkey(e, t, n = null) {
        if (Array.isArray(e)) {
            let a = [];
            e.forEach((e) => {
                if (!this.isHotkeyFormat(e)) {
                    throw new Error("快捷键格式错误");
                }
                let i = this.recordHotkey(e, t, n);
                a.push(i);
            });
            return a;
        }
        if (!this.isHotkeyFormat(e)) {
            throw new Error("快捷键格式错误");
        }
        return this.recordHotkey(e, t, n);
    }
    static recordHotkey(e, t, n) {
        let a = Math.random().toString(36).substr(2);
        this.registerHotKeyMap.set(a, {
            hotkeyString: e,
            callback: t,
            keyupCallback: n,
        });
        return a;
    }
    static unregisterHotkey(e) {
        if (this.registerHotKeyMap.has(e)) {
            this.registerHotKeyMap.delete(e);
        }
    }
    static isHotkeyFormat(e) {
        return e
            .toLowerCase()
            .split("+")
            .map((e) => e.trim())
            .every(
                (e) => ["ctrl", "shift", "alt"].includes(e) || e.length === 1,
            );
    }
    static judgeHotkey(e, t) {
        const n = e
            .toLowerCase()
            .split("+")
            .map((e) => e.trim());
        const a = n.includes("ctrl");
        const i = n.includes("shift");
        const s = n.includes("alt");
        const o = n.find((e) => e !== "ctrl" && e !== "shift" && e !== "alt");
        return (
            (this.isMac ? t.metaKey : t.ctrlKey) === a &&
            t.shiftKey === i &&
            t.altKey === s &&
            t.key.toLowerCase() === o
        );
    }
};
i(ie, "isMac", navigator.platform.indexOf("Mac") === 0);
i(ie, "registerHotKeyMap", new Map());
i(ie, "handleKeydown", (e) => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString;
        let a = n.callback;
        if (ie.judgeHotkey(t, e)) {
            a(e);
        }
    }
});
i(ie, "handleKeyup", (e) => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString;
        let a = n.keyupCallback;
        if (a && ie.judgeHotkey(t, e)) {
            a(e);
        }
    }
});
let se = ie;
document.addEventListener("keydown", (e) => {
    se.handleKeydown(e);
});
document.addEventListener("keyup", (e) => {
    se.handleKeyup(e);
});
class Fc2Plugin extends BasePlugin {
    getName() {
        return "Fc2Plugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 弹层样式 */\n                .movie-detail-layer .layui-layer-title {\n                    font-size: 18px;\n                    color: #333;\n                    background: #f8f8f8;\n                }\n                \n                \n                /* 容器样式 */\n                .movie-detail-container {\n                    margin: 40px;\n                    height: 100%;\n                    background: #fff;\n                }\n                \n                .movie-poster-container {\n                    flex: 0 0 60%;\n                    padding: 15px;\n                }\n                \n                .right-box {\n                    flex: 1;\n                    padding: 20px;\n                    overflow-y: auto;\n                }\n                \n                /* 预告片iframe */\n                .movie-trailer {\n                    width: 100%;\n                    height: 100%;\n                    min-height: 400px;\n                    background: #000;\n                    border-radius: 4px;\n                }\n                \n                /* 电影信息样式 */\n                .movie-title {\n                    font-size: 24px;\n                    margin-bottom: 15px;\n                    color: #333;\n                }\n                \n                .movie-meta {\n                    margin-bottom: 20px;\n                    color: #666;\n                }\n                \n                .movie-meta span {\n                    margin-right: 15px;\n                }\n                \n                /* 演员列表 */\n                .actor-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 8px;\n                    margin-top: 10px;\n                }\n                \n                .actor-tag {\n                    padding: 4px 12px;\n                    background: #f0f0f0;\n                    border-radius: 15px;\n                    font-size: 12px;\n                    color: #555;\n                }\n                \n                /* 图片列表 */\n                .image-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 10px;\n                }\n                \n                .movie-image-thumb {\n                    width: 120px;\n                    height: 80px;\n                    object-fit: cover;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    transition: transform 0.3s;\n                }\n                \n                .movie-image-thumb:hover {\n                    transform: scale(1.05);\n                }\n                \n                /* 加载中和错误状态 */\n                .search-loading, .movie-error {\n                    padding: 40px;\n                    text-align: center;\n                    color: #999;\n                }\n                \n                .movie-error {\n                    color: #f56c6c;\n                }\n                \n                .fancybox-container{\n                    z-index:99999999\n                 }\n                 \n                 \n                 /* 错误提示样式 */\n                .movie-not-found, .movie-error {\n                    text-align: center;\n                    padding: 30px;\n                    color: #666;\n                }\n                \n                .movie-not-found h3, .movie-error h3 {\n                    color: #f56c6c;\n                    margin: 15px 0;\n                }\n                \n                .icon-warning, .icon-error {\n                    font-size: 50px;\n                    color: #e6a23c;\n                }\n                \n                .icon-error {\n                    color: #f56c6c;\n                }\n                \n                .fc2-movie-panel-info .panel-block {\n                    padding: 0 !important;\n                }\n            </style>\n        ";
    }
    handle() {
        let e = "/advanced_search?type=3&score_min=0&d=1";
        $('.navbar-item:contains("FC2")').attr("href", e);
        $('.tabs a:contains("FC2")').attr("href", e);
        if (o.includes("advanced_search?type=3")) {
            $("h2.section-title").contents().first().replaceWith("Fc2PPV");
            $(".section .container > .box").remove();
        }
        if (o.includes("collection_codes?movieId")) {
            $("section").html("");
            const e = new URLSearchParams(window.location.search);
            let t = e.get("movieId");
            let n = e.get("carNum");
            let a = e.get("url");
            if (t && n && a) {
                this.openFc2Dialog(t, n, a);
            }
        }
    }
    openFc2Dialog(e, t, n) {
        let a = t.replace("FC2-", "");
        if (n.includes("123av")) {
            this.getBean("Fc2By123AvPlugin")?.open123AvFc2Dialog(t, n);
            return;
        }
        let i = `\n            <div class="movie-detail-container">\n                \x3c!--<div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>--\x3e\n               \x3c!-- <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    <div class="movie-panel-info fc2-movie-panel-info" style="margin-top:20px"><strong>第三方资源: </strong></div>\n                    \n                    <div style="margin: 30px 0">\n                        <a id="filterBtn" class="menu-btn" style="background-color:${f}"><span>${m}</span></a>\n                        <a id="favoriteBtn" class="menu-btn" style="background-color:${w}"><span>${v}</span></a>\n                        <a id="hasWatchBtn" class="menu-btn" style="background-color:${S};"><span>${k}</span></a>\n                        \n                        <a id="search-subtitle-btn" class="menu-btn fr-btn" style="background:linear-gradient(to bottom, #8d5656, rgb(196,159,91))">\n                            <span>字幕 (SubTitleCat)</span>\n                        </a>\n                        <a id="xunLeiSubtitleBtn" class="menu-btn fr-btn" style="background:linear-gradient(to left, #375f7c, #2196F3)">\n                            <span>字幕 (迅雷)</span>\n                        </a>\n                    </div>\n                    <div class="message video-panel" style="margin-top:20px">\n                        <div id="magnets-content" class="magnet-links" style="margin: 0 0.75rem">\n                            <div class="search-loading">加载中...</div>\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" style="display: none"></span>\n                \x3c!--</div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: t,
            content: i,
            area: utils.getResponsiveArea(["70%", "90%"]),
            skin: "movie-detail-layer",
            scrollbar: false,
            success: (i, s) => {
                this.loadData(e, t);
                $("#favoriteBtn").on("click", async (e) => {
                    const a = $("#data-actress").text();
                    const i = $("#data-releaseDate").text();
                    await storageManager.saveCar({
                        carNum: t,
                        url: n,
                        names: a,
                        actionType: h,
                        publishTime: i,
                    });
                    window.refresh();
                    layer.closeAll();
                });
                $("#filterBtn").on("click", (e) => {
                    utils.q(e, `是否屏蔽${t}?`, async () => {
                        const e = $("#data-actress").text();
                        const a = $("#data-releaseDate").text();
                        await storageManager.saveCar({
                            carNum: t,
                            url: n,
                            names: e,
                            actionType: d,
                            publishTime: a,
                        });
                        window.refresh();
                        layer.closeAll();
                        if (
                            window.location.href.includes(
                                "collection_codes?movieId",
                            )
                        ) {
                            utils.closePage();
                        }
                    });
                });
                $("#hasWatchBtn").on("click", async (e) => {
                    const a = $("#data-actress").text();
                    const i = $("#data-releaseDate").text();
                    await storageManager.saveCar({
                        carNum: t,
                        url: n,
                        names: a,
                        actionType: p,
                        publishTime: i,
                    });
                    window.refresh();
                    layer.closeAll();
                });
                $("#search-subtitle-btn").on("click", (e) =>
                    utils.openPage(
                        `https://subtitlecat.com/index.php?search=${t}`,
                        t,
                        false,
                        e,
                    ),
                );
                $("#xunLeiSubtitleBtn").on("click", () =>
                    this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(
                        t,
                    ),
                );
                this.getBean("OtherSitePlugin").loadOtherSite(a, t).then();
                utils.setupEscClose(s);
            },
            end() {
                if (window.location.href.includes("collection_codes?movieId")) {
                    utils.closePage();
                }
            },
        });
    }
    loadData(e, t) {
        let n = t.replace("FC2-", "");
        this.handleMovieDetail(e);
        this.handleLongImg(n);
        this.handleMagnets(e);
        this.getBean("ReviewPlugin")
            .showReview(e, $("#reviews-content"))
            .then();
        this.getBean("RelatedPlugin")
            .showRelated($("#related-content"), e)
            .then();
    }
    handleMovieDetail(e) {
        V(e)
            .then((e) => {
                const t = e.actors || [];
                const n = e.imgList || [];
                let a = "";
                if (t.length > 0) {
                    let e = "";
                    for (let n = 0; n < t.length; n++) {
                        let i = t[n];
                        a += `<span class="actor-tag"><a href="/actors/${i.id}" target="_blank">${i.name}</a></span>`;
                        if (i.gender === 0) {
                            e += i.name + " ";
                        }
                    }
                    $("#data-actress").text(e);
                } else {
                    a = '<span class="no-data">暂无演员信息</span>';
                }
                let i = "";
                i =
                    Array.isArray(n) && n.length > 0
                        ? n
                              .map(
                                  (e, t) =>
                                      `\n                <a href="${e}" data-fancybox="movie-gallery" data-caption="剧照 ${t + 1}">\n                    <img src="${e}" class="movie-image-thumb"  alt=""/>\n                </a>\n            `,
                              )
                              .join("")
                        : '<div class="no-data">暂无剧照</div>';
                $(".movie-info-container").html(
                    `\n                <h3 class="movie-title"><strong class="current-title">${e.title || "无标题"}</strong></h3>\n                <div class="movie-meta">\n                    <span><strong>番号: </strong>${e.carNum || "未知"}</span>\n                    <span><strong>年份: </strong>${e.releaseDate || "未知"}</span>\n                    <span><strong>评分: </strong>${e.score || "无"}</span>\n                    <span><strong>时长: </strong>${e.duration + " m" || "无"}</span>\n                </div>\n                <div class="movie-meta">\n                    <span>\n                        <strong>站点: </strong>\n                        <a href="https://fc2ppvdb.com/articles/${e.carNum.replace("FC2-", "")}" target="_blank">fc2ppvdb</a>\n                        <a style="margin-left: 5px;" href="https://adult.contents.fc2.com/article/${e.carNum.replace("FC2-", "")}/" target="_blank">fc2电子市场</a>\n                    </span>\n                </div>\n                <div class="movie-actors">\n                    <div class="actor-list"><strong>主演: </strong>${a}</div>\n                </div>\n                <div class="movie-gallery" style="margin-top:10px">\n                    <strong>剧照: </strong>\n                    <div class="image-list">${i}</div>\n                </div>\n                <div id="data-releaseDate" style="display: none">${e.releaseDate || ""}</div>\n            `,
                );
                this.getBean("TranslatePlugin")
                    ?.translate(e.carNum, false)
                    ?.then();
            })
            .catch((e) => {
                console.error(e);
                $(".movie-info-container").html(
                    `\n                <div class="movie-error">加载失败: ${e.message}</div>\n            `,
                );
            });
    }
    handleLongImg(e) {
        utils.loopDetector(
            () => $(".movie-gallery .image-list").length > 0,
            async () => {
                const t = this.getBean("ScreenShotPlugin");
                if (!t) {
                    return;
                }
                $(".movie-gallery .image-list").prepend(
                    ' <a class="tile-item screen-container" style="overflow:hidden;max-height: 150px;max-width:150px; text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> ',
                );
                const n = await t.getScreenshot(e);
                if (n) {
                    await t.addImg("缩略图", n);
                }
            },
        );
    }
    handleMagnets(e) {
        (async (e) => {
            let t = `${U}/v1/movies/${e}/magnets`;
            let n = {
                jdSignature: await O(),
            };
            return (await gmHttp.get(t, null, n)).data.magnets;
        })(e)
            .then((e) => {
                let t = "";
                if (e.length > 0) {
                    for (let n = 0; n < e.length; n++) {
                        let a = e[n];
                        let i = "";
                        if (n % 2 == 0) {
                            i = "odd";
                        }
                        t += `\n                        <div class="item columns is-desktop ${i}">\n                            <div class="magnet-name column is-four-fifths">\n                                <a href="magnet:?xt=urn:btih:${a.hash}" title="右鍵點擊並選擇「複製鏈接地址」">\n                                    <span class="name">${a.name}</span>\n                                    <br>\n                                    <span class="meta">\n                                        ${(a.size / 1024).toFixed(2)}GB, ${a.files_count}個文件 \n                                     </span>\n                                    <br>\n                                    <div class="tags">\n                                        ${a.hd ? '<span class="tag is-primary is-small is-light">高清</span>' : ""}\n                                        ${a.cnsub ? '<span class="tag is-warning is-small is-light">字幕</span>' : ""}\n                                    </div>\n                                </a>\n                            </div>\n                            <div class="buttons column">\n                                <button class="button is-info is-small copy-to-clipboard" data-clipboard-text="magnet:?xt=urn:btih:${a.hash}" type="button">&nbsp;複製&nbsp;</button>\n                            </div>\n                            <div class="date column"><span class="time">${a.created_at}</span></div>\n                        </div>\n                    `;
                    }
                } else {
                    t = '<span class="no-data">暂无磁力信息</span>';
                }
                $("#magnets-content").html(t);
            })
            .catch((e) => {
                console.error(e);
                $("#magnets-content").html(
                    `\n                <div class="movie-error">加载失败: ${e.message}</div>\n            `,
                );
            });
    }
    async openFc2Page(e, t, n) {
        const a = this.getBean("OtherSitePlugin");
        let i = await a.getJavDbUrl();
        window.open(
            `${i}/users/collection_codes?movieId=${e}&carNum=${t}&url=${n}`,
        );
    }
}
class HighlightMagnetPlugin extends BasePlugin {
    getName() {
        return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
        this.handleDb();
        this.handleBus();
    }
    handleDb() {
        if (!r) {
            return;
        }
        let e = $("#magnets-content .name");
        if (e.length === 0) {
            return;
        }
        const t = ["4k", "-c", "-u", "-uc"];
        let n = false;
        e.each((e, a) => {
            const i = $(a);
            const s = i.text().toLowerCase();
            const o = t.some((e) => s.includes(e));
            i.parent().parent().parent().addClass("magnet-row");
            if (s.includes("4k")) {
                i.css("color", "#f40");
            }
            if (o) {
                n = true;
                i.parent().parent().parent().addClass("high-quality");
            }
        });
        if (n) {
            $("#magnets-content .magnet-row").not(".high-quality").hide();
        } else {
            $("#enable-magnets-filter").addClass("do-hide");
        }
    }
    handleBus() {
        if (l && isDetailPage) {
            utils.loopDetector(
                () => $("#magnet-table td a").length > 0,
                () => {
                    const e = $("#magnet-table tr");
                    const t = ["4k", "-c", "-u", "-uc"];
                    let n = false;
                    e.each((e, a) => {
                        const i = $(a);
                        const s = i.find("td:first-child");
                        const o = s.find("a:first-child");
                        const r = s.find("a:nth-child(2)");
                        const l = o.text().toLowerCase();
                        if (l.includes("4k")) {
                            o.css("color", "#f40");
                        }
                        if (
                            t.some((e) => l.includes(e)) ||
                            (r.length && r.text().includes("字幕"))
                        ) {
                            n = true;
                            i.addClass("high-quality");
                        }
                    });
                    if (n) {
                        e.each((e, t) => {
                            const n = $(t);
                            if (!n.hasClass("high-quality")) {
                                n.hide();
                            }
                        });
                    } else {
                        $("#enable-magnets-filter").addClass("do-hide");
                    }
                },
            );
        }
    }
    showAll() {
        if (r) {
            $("#magnets-content .item")
                .toArray()
                .forEach((e) => $(e).show());
        }
        if (l) {
            $("#magnet-table tr")
                .toArray()
                .forEach((e) => $(e).show());
        }
    }
}
class FoldCategoryPlugin extends BasePlugin {
    getName() {
        return "FoldCategoryPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: 999;\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: #FF5722;\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${e.highlightedTagNumber || 1}px solid ${e.highlightedTagColor || "#ce2222"};\n                }\n            </style>\n        `;
    }
    async handle() {
        if (window.isListPage) {
            if (!o.includes("advanced_search")) {
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
                $("#tags .tag-category .tag-expand").each((e, t) => {
                    if ($(t).parent().hasClass("collapse")) {
                        t.click();
                    }
                });
            }
        }
    }
    highlightTag() {
        (async () => {
            const e = await storageManager.getHighlightedTags();
            if (e) {
                e.forEach((e) => {
                    $(`#tags a.tag:contains(${e})`).addClass("highlighted");
                    $(`.tags a.tag:contains(${e})`).addClass("highlighted");
                });
            }
        })().then();
        $("#tags a.tag, .tags a.tag").hover(
            function () {
                const e = $(this);
                const t = $(
                    '<button class="highlight-btn" title="高亮显示">★</button>',
                );
                e.append(t);
                t.fadeIn(0);
            },
            function () {
                $(this)
                    .find(".highlight-btn")
                    .fadeOut(0, function () {
                        $(this).remove();
                    });
            },
        );
        $(document).on("click", ".highlight-btn", async function (e) {
            e.stopPropagation();
            e.preventDefault();
            const t = $(this).closest("a.tag");
            const n = t.clone();
            n.find(".highlight-btn").remove();
            const a = n
                .text()
                .trim()
                .replace(/\s*\(\d+\)$/, "");
            let i = await storageManager.getHighlightedTags();
            if (i.includes(a)) {
                i = i.filter((e) => e !== a);
                t.removeClass("highlighted");
            } else {
                i.push(a);
                t.addClass("highlighted");
            }
            await storageManager.setHighlightedTags(i);
        });
    }
    async createFoldBtn() {
        const e = await storageManager.getSetting("foldCategoryHotKey");
        let t = $("#tags");
        let n = $("#tags dl div.tag.is-info")
            .map(function () {
                return $(this).text().replaceAll("\n", "").replaceAll(" ", "");
            })
            .get()
            .join(" ");
        if (!n) {
            return;
        }
        $(".tabs").append(
            `\n            <div style="display: flex;align-items: center;flex-grow:1;justify-content: flex-end;">\n                <div>已选分类: <span id="jhs-check-tag">${n}</span></div>\n                <a class="menu-btn  main-tab-btn" id="foldCategoryBtn" style="background-color:#d23e60 !important;">\n                    <span></span>\n                    ${e ? ` (${e})` : ""}\n                    <i style="margin-left: 10px"></i>\n                </a>\n\n            </div>\n        `,
        );
        let a = $("h2.section-title");
        if (a.length > 0) {
            a.append(
                '\n                <div id="foldCategoryBtn">\n                    <a class="menu-btn" style="background-color:#d23e60 !important;margin-left: 20px;border-bottom:none !important;border-radius:3px;">\n                        <span></span>\n                        <i style="margin-left: 10px"></i>\n                    </a>\n                </div>\n            ',
            );
            t = $("section > div > div.box");
        }
        if (!t) {
            return;
        }
        let i = $("#foldCategoryBtn");
        let s = localStorage.getItem("jhs_foldCategory") === _;
        let [o, r] = s
            ? ["展开", "icon-angle-double-down"]
            : ["折叠", "icon-angle-double-up"];
        i.find("span").text(o).end().find("i").attr("class", r);
        if (!window.location.href.includes("noFold=1")) {
            t[s ? "hide" : "show"]();
        }
        i.on("click", async (e) => {
            e.preventDefault();
            s = !s;
            localStorage.setItem("jhs_foldCategory", s ? _ : C);
            const [n, a] = s
                ? ["展开", "icon-angle-double-down"]
                : ["折叠", "icon-angle-double-up"];
            i.find("span").text(n).end().find("i").attr("class", a);
            t[s ? "hide" : "show"]();
        });
    }
}
class ActressInfoPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "apiUrl", "https://ja.wikipedia.org/wiki/");
    }
    getName() {
        return "ActressInfoPlugin";
    }
    async handle() {
        if (
            (await storageManager.getSetting(
                "enableLoadActressInfo",
                "yes",
            )) === "yes"
        ) {
            this.loadActressInfo();
        }
    }
    loadActressInfo() {
        this.handleDetailPage().then();
        this.handleStarPage().then();
    }
    async initCss() {
        return "\n            <style>\n                .info-tag {\n                    background-color: #ecf5ff;\n                    display: inline-block;\n                    height: 32px;\n                    padding: 0 10px;\n                    line-height: 30px;\n                    font-size: 12px;\n                    color: #409eff;\n                    border: 1px solid #d9ecff;\n                    border-radius: 4px;\n                    box-sizing: border-box;\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    async handleDetailPage() {
        if ($(".actress-info").length > 0) {
            return;
        }
        let e = $(".female")
            .prev()
            .map((e, t) => $(t).text().trim())
            .get();
        if (!e.length) {
            return;
        }
        const t = "jhs_actress_info";
        const n = localStorage.getItem(t)
            ? JSON.parse(localStorage.getItem(t))
            : {};
        let a = null;
        let i = "";
        for (let o = 0; o < e.length; o++) {
            let t = e[o];
            a = n[t];
            if (!a) {
                try {
                    a = await this.searchInfo(t);
                    if (a) {
                        n[t] = a;
                    }
                } catch (s) {
                    console.error("该名称查询失败,尝试其它名称");
                }
            }
            let r = "";
            r = a
                ? `\n                    <div class="panel-block actress-info">\n                        <strong>${t}:</strong>\n                        <a href="${a.url}" style="margin-left: 5px" target="_blank">\n                            <span class="info-tag">${a.birthday} ${a.age}</span>\n                            <span class="info-tag">${a.height} ${a.weight}</span>\n                            <span class="info-tag">${a.threeSizeText} ${a.braSize}</span>\n                        </a>\n                    </div>\n                `
                : `<div class="panel-block actress-info"><a href="${this.apiUrl + t}" target="_blank"><strong>${t}:</strong></a></div> `;
            i += r;
        }
        $('strong:contains("演員")').parent().after(i);
        localStorage.setItem(t, JSON.stringify(n));
    }
    async handleStarPage() {
        if ($(".actress-info").length > 0) {
            return;
        }
        let e = [];
        let t = $(".actor-section-name");
        if (t.length) {
            t.text()
                .trim()
                .split(",")
                .forEach((t) => {
                    e.push(t.trim());
                });
        }
        let n = $(".section-meta:not(:contains('影片'))");
        if (n.length) {
            n.text()
                .trim()
                .split(",")
                .forEach((t) => {
                    e.push(t.trim());
                });
        }
        if (!e.length) {
            return;
        }
        const a = "jhs_actress_info";
        const i = localStorage.getItem(a)
            ? JSON.parse(localStorage.getItem(a))
            : {};
        let s = null;
        for (let l = 0; l < e.length; l++) {
            let t = e[l];
            s = i[t];
            if (s) {
                break;
            }
            try {
                s = await this.searchInfo(t);
            } catch (r) {
                console.error("该名称查询失败,尝试其它名称");
            }
            if (s) {
                break;
            }
        }
        if (s) {
            e.forEach((e) => {
                i[e] = s;
            });
        }
        let o =
            '<div class="actress-info" style="font-size: 17px; font-weight: normal; margin-top: 5px;">无此相关演员信息</div>';
        if (s) {
            o = `\n                <a class="actress-info" href="${s.url}" target="_blank">\n                    <div style="font-size: 17px; font-weight: normal; margin-top: 5px;">\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">出生日期: ${s.birthday}</span>\n                            <span style="width: 200px;">年龄: ${s.age}</span>\n                            <span style="width: 200px;">身高: ${s.height}</span>\n                        </div>\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">体重: ${s.weight}</span>\n                            <span style="width: 200px;">三围: ${s.threeSizeText}</span>\n                            <span style="width: 200px;">罩杯: ${s.braSize}</span>\n                        </div>\n                    </div>\n                </a>\n            `;
        }
        t.parent().append(o);
        localStorage.setItem(a, JSON.stringify(i));
    }
    async searchInfo(e) {
        if (e === "三上悠亞") {
            e = "三上悠亜";
        }
        let t = this.apiUrl + e;
        const n = await gmHttp.get(t);
        const a = new DOMParser();
        const i = $(a.parseFromString(n, "text/html"));
        let s = i
            .find('a[title="誕生日"]')
            .parent()
            .parent()
            .find("td")
            .text()
            .trim();
        let o = i
            .find("th:contains('現年齢')")
            .parent()
            .find("td")
            .text()
            .trim()
            ? parseInt(
                  i
                      .find("th:contains('現年齢')")
                      .parent()
                      .find("td")
                      .text()
                      .trim(),
              ) + "岁"
            : "";
        let r =
            i.find('tr:has(a[title="身長"]) td').text().trim().split(" ")[0] +
            "cm";
        let l = i
            .find('tr:has(a[title="体重"]) td')
            .text()
            .trim()
            .split("/")[1]
            .trim();
        if (l === "― kg") {
            l = "";
        }
        return {
            birthday: s,
            age: o,
            height: r,
            weight: l,
            threeSizeText: i
                .find('a[title="スリーサイズ"]')
                .closest("tr")
                .find("td")
                .text()
                .replace("cm", "")
                .trim(),
            braSize: i
                .find('th:contains("ブラサイズ")')
                .next("td")
                .contents()
                .first()
                .text()
                .trim(),
            url: t,
        };
    }
}

class HitShowPlugin extends BasePlugin {
    constructor() {
        super();
        i(this, "$contentBox", $(".section .container"));
    }
    getName() {
        return "HitShowPlugin";
    }
    handle() {
        $('a[href*="rankings/playback"]').on("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href =
                "/advanced_search?handlePlayback=1&period=daily";
        });
        this.handlePlayback().then();
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("热播");
        e.css("marginBottom", "0");
        $(".empty-message").remove();
        $(".section .container .box").remove();
        $("#sort-toggle-btn").remove();
        this.$contentBox.append(
            '<div class="tool-box" style="margin-top: 10px"></div>',
        );
        this.$contentBox.append(
            '<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>',
        );
    }
    async handlePlayback() {
        if (!window.location.href.includes("handlePlayback=1")) {
            return;
        }
        let e = new URLSearchParams(window.location.search).get("period");
        this.toolBar(e);
        this.hookPage();
        let t = $(".movie-list");
        t.html("");
        let n = loading();
        let a = false;
        for (let s = 1; s <= 3 && !a; s++) {
            try {
                const n = await W(e);
                let i = this.markDataListHtml(n);
                t.html(i);
                this.loadScore(n);
                a = true;
            } catch (i) {
                if (s < 3) {
                    clog.error(`获取热播数据失败 (第 ${s} 次重试)`, i);
                    await new Promise((e) => setTimeout(e, 1000));
                } else {
                    clog.error("所有重试尝试均失败，无法获取数据。", i);
                }
            } finally {
                if (a || s === 3) {
                    n.close();
                }
            }
        }
    }
    toolBar(e) {
        let t = `\n            <div class="button-group" style="margin-top:18px">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small ${e === "daily" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${e === "weekly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${e === "monthly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n                </div>\n            </div>\n        `;
        this.$contentBox.append(t);
    }
    getStarRating(e) {
        let t = "";
        const n = Math.floor(e);
        for (let a = 0; a < n; a++) {
            t += '<i class="icon-star"></i>';
        }
        for (let a = 0; a < 5 - n; a++) {
            t += '<i class="icon-star gray"></i>';
        }
        return t;
    }
    loadScore(e) {
        if (e.length === 0) {
            return;
        }
        (async () => {
            let t = "jhs_score_info";
            for (const a of e) {
                try {
                    const e = a.id;
                    if (!$(`#score_${e}`).length) {
                        return;
                    }
                    if ($(`#${e}`).is(":hidden")) {
                        continue;
                    }
                    const n = localStorage.getItem(t)
                        ? JSON.parse(localStorage.getItem(t))
                        : {};
                    const i = n[e];
                    if (i) {
                        this.appendScoreHtml(e, i);
                        continue;
                    }
                    while (!document.hasFocus()) {
                        await new Promise((e) => setTimeout(e, 500));
                    }
                    const s = await V(e);
                    let o = s.score;
                    let r = s.watchedCount;
                    let l = `\n                        <span class="value">\n                            <span class="score-stars">${this.getStarRating(o)}</span> \n                            &nbsp; ${o}分，由${r}人評價\n                        </span>\n                    `;
                    this.appendScoreHtml(e, l);
                    n[e] = l;
                    localStorage.setItem(t, JSON.stringify(n));
                    await new Promise((e) => setTimeout(e, 500));
                } catch (n) {
                    clog.error(
                        `🚨 解析评分数据失败 | 编号: ${a.number}\n`,
                        `错误详情: ${n.message}\n`,
                        n.stack ? `调用栈:\n${n.stack}` : "",
                    );
                }
            }
        })();
    }
    appendScoreHtml(e, t) {
        let n = $(`#score_${e}`);
        if (n.length && n.html().trim() === "") {
            n.slideUp(0, function () {
                $(this).html(t).slideDown(500);
            });
        }
    }
    markDataListHtml(e) {
        let t = "";
        e.forEach((e) => {
            t += `\n                <div class="item" id="${e.id}">\n                    <a href="/v/${e.id}" class="box" title="${e.origin_title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.cover_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${e.number}</strong> ${e.origin_title}</div>\n                        <div class="score" id="score_${e.id}">\n                        </div>\n                        <div class="meta">\n                            ${e.release_date}\n                        </div>\n                        <div class="tags has-addons">\n                           ${e.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : e.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${e.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        });
        return t;
    }
}
const me = "jhs_appAuthorization";
class Top250Plugin extends BasePlugin {
    constructor() {
        super();
        i(this, "has_cnsub", "");
        i(this, "$contentBox", $(".section .container"));
        i(this, "movies", []);
    }
    getName() {
        return "TOP250Plugin";
    }
    handle() {
        $('.main-tabs ul li:contains("猜你喜歡")').html(
            '<a href="/rankings/top"><span>Top250</span></a>',
        );
        $('a[href*="rankings/top"]').on("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const t = $(e.target);
            const n = (t.is("a") ? t : t.closest("a")).attr("href");
            let a = n.includes("?") ? n.split("?")[1] : n;
            const i = new URLSearchParams(a);
            this.checkLogin(e, i);
        });
        this.handleTop().then();
    }
    hookPage() {
        $("h2.section-title").contents().first().replaceWith("Top250");
        $(".empty-message").remove();
        $(".section .container .box").remove();
        $("#sort-toggle-btn").remove();
        this.$contentBox.append(
            '<div class="tool-box" style="margin-top: 10px"></div>',
        );
        this.$contentBox.append(
            '<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>',
        );
        this.renderPagination();
    }
    renderPagination() {
        const e = new URLSearchParams(window.location.search);
        let t = parseInt(e.get("page")) || 1;
        this.$contentBox.append(
            ((e) => {
                const t = e >= 5;
                let n = "";
                for (let a = 1; a <= 5; a++) {
                    n += `<li><a class="pagination-link ${e === a ? "is-current" : ""}" data-page="${a}">${a}</a></li>`;
                }
                return `\n                <nav class="pagination">\n                    <a class="pagination-previous ${e <= 1 ? "do-hide" : ""}" data-page="${e - 1}">上一頁</a>\n                    <a class="pagination-next ${t ? "do-hide" : ""}" data-page="${e + 1}">下一頁</a>\n                    \n                    <ul class="pagination-list">\n                        ${n}\n                    </ul>\n                </nav>\n            `;
            })(t),
        );
        this.$contentBox.on(
            "click",
            ".pagination-link, .pagination-previous, .pagination-next",
            (t) => {
                t.preventDefault();
                const n = parseInt($(t.currentTarget).data("page"));
                if (!isNaN(n) && n > 0) {
                    ((t) => {
                        e.set("page", t);
                        window.history.pushState({}, "", "?" + e.toString());
                        window.location.reload();
                    })(n);
                }
            },
        );
    }
    async handleTop() {
        if (!window.location.href.includes("handleTop=1")) {
            return;
        }
        const e = new URLSearchParams(window.location.search);
        let t = e.get("handleType") || "all";
        let n = e.get("type_value") || "";
        this.has_cnsub = e.get("has_cnsub") || "";
        let a = e.get("page") || 1;
        this.toolBar(t, n, a);
        this.hookPage();
        let i = $(".movie-list");
        i.html("");
        let s = loading();
        let o = false;
        for (let l = 1; l <= 3 && !o; l++) {
            try {
                const e = await q(t, n, a, 50);
                let r = e.success;
                let l = e.message;
                let c = e.action;
                if (r === 1) {
                    let t = e.data.movies;
                    if (t.length === 0) {
                        show.error("无数据");
                        s.close();
                        return;
                    }
                    this.movies = t;
                    const n = t.filter((e) =>
                        this.has_cnsub === "1"
                            ? e.has_cnsub
                            : this.has_cnsub !== "0" || !e.has_cnsub,
                    );
                    const a = this.getBean("HitShowPlugin");
                    let r = a.markDataListHtml(n);
                    i.html(r);
                    a.loadScore(n);
                    o = true;
                } else {
                    console.error(e);
                    i.html(`<h3>${l}</h3>`);
                    show.error(l);
                    if (c === "JWTVerificationError") {
                        await localStorage.removeItem(me);
                        await this.checkLogin(
                            null,
                            new URLSearchParams(window.location.search),
                        );
                    }
                    o = true;
                }
            } catch (r) {
                if (l < 3) {
                    clog.error(`获取Top数据失败 (第 ${l} 次重试):`, r);
                    await new Promise((e) => setTimeout(e, 1000));
                } else {
                    clog.error("所有重试尝试均失败，无法获取Top数据。", r);
                    i.html("<h3>无法加载数据，请稍后再试。</h3>");
                }
            } finally {
                if (o || l === 3) {
                    s.close();
                }
            }
        }
    }
    toolBar(e, t, n) {
        if (n.toString() === "5") {
            $(".pagination-next").remove();
        }
        $(".pagination-ellipsis").closest("li").remove();
        $(".pagination-list li a").each(function () {
            if (parseInt($(this).text()) > 5) {
                $(this).closest("li").remove();
            }
        });
        let a = "";
        for (let s = new Date().getFullYear(); s >= 2008; s--) {
            a += `\n                <a style="padding:18px 18px !important;" \n                   class="button is-small ${t === s.toString() ? "is-info" : ""}" \n                   href="/advanced_search?handleTop=1&handleType=year&type_value=${s}&has_cnsub=${this.has_cnsub}">\n                  ${s}\n                </a>\n            `;
        }
        let i = `\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox" style="margin-bottom: 0!important;">\n                    <a style="padding:18px 18px !important;" class="button is-small ${e === "all" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${this.has_cnsub}">全部</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${t === "0" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${this.has_cnsub}">有码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${t === "1" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${this.has_cnsub}">无码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${t === "2" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${this.has_cnsub}">欧美</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${t === "3" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${this.has_cnsub}">Fc2</a>\n                    \n                    <a style="padding:18px 18px !important;margin-left: 50px" class="button is-small ${this.has_cnsub === "1" ? "is-info" : ""}" data-cnsub-value="1">含中字磁鏈</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${this.has_cnsub === "0" ? "is-info" : ""}" data-cnsub-value="0">无字幕</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-cnsub-value="">重置</a>\n                </div>\n                \n                <div class="buttons has-addons" id="conditionBox">\n                    ${a}\n                </div>\n            </div>\n        `;
        this.$contentBox.append(i);
        $("a[data-cnsub-value]").on("click", (e) => {
            const t = $(e.currentTarget).data("cnsub-value");
            this.has_cnsub = t.toString();
            $("a[data-cnsub-value]").removeClass("is-info");
            $(e.currentTarget).addClass("is-info");
            $(".toolbar a.button")
                .not("[data-cnsub-value]")
                .each((e, n) => {
                    const a = $(n);
                    const i = new URL(a.attr("href"), window.location.origin);
                    i.searchParams.set("has_cnsub", t);
                    a.attr("href", i.toString());
                });
            const n = this.movies.filter((e) =>
                this.has_cnsub === "1"
                    ? e.has_cnsub
                    : this.has_cnsub !== "0" || !e.has_cnsub,
            );
            const a = this.getBean("HitShowPlugin");
            let i = a.markDataListHtml(n);
            $(".movie-list").html(i);
            a.loadScore(n);
        });
    }
    async checkLogin(e, t) {
        if (!localStorage.getItem(me)) {
            show.error("该类别依赖移动端接口，请先完成登录");
            this.openLoginDialog();
            return;
        }
        let n = "all";
        let a = "";
        let i = t.get("t") || "";
        if (/^y\d+$/.test(i)) {
            n = "year";
            a = i.substring(1);
        } else if (i !== "") {
            n = "video_type";
            a = i;
        }
        let s = `/advanced_search?handleTop=1&handleType=${n}&type_value=${a}`;
        if (e && (e.ctrlKey || e.metaKey)) {
            GM_openInTab(window.location.origin + s, {
                insert: 0,
            });
        } else {
            window.location.href = s;
        }
    }
    openLoginDialog() {
        layer.open({
            type: 1,
            title: "JavDB",
            closeBtn: 1,
            area: ["360px", "auto"],
            shadeClose: false,
            content:
                '\n                <div style="padding: 30px; font-family: \'Helvetica Neue\', Arial, sans-serif;">\n                    <div style="margin-bottom: 25px;">\n                        <input type="text" id="username" name="username" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="用户名 | 邮箱"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <div style="margin-bottom: 15px;">\n                        <input type="password" id="password" name="password" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="密码"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <button id="loginBtn" \n                            style="width: 100%; padding: 12px; background: #4a8bfc; color: white; \n                                   border: none; border-radius: 4px; font-size: 15px; cursor: pointer;\n                                   transition: background 0.3s;"\n                            onmouseover="this.style.background=\'#3a7be0\'"\n                            onmouseout="this.style.background=\'#4a8bfc\'">\n                        登录\n                    </button>\n                </div>\n            ',
            success: (e, t) => {
                $("#loginBtn").click(function () {
                    const e = $("#username").val();
                    const n = $("#password").val();
                    if (!e || !n) {
                        show.error("请输入用户名和密码");
                        return;
                    }
                    let a = loading();
                    (async (e, t) => {
                        let n = `${U}/v1/sessions?username=${encodeURIComponent(e)}&password=${encodeURIComponent(t)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`;
                        let a = {
                            "user-agent": "Dart/3.5 (dart:io)",
                            "accept-language": "zh-TW",
                            "content-type":
                                "multipart/form-data; boundary=--dio-boundary-2210433284",
                            jdsignature: await O(),
                        };
                        return await gmHttp.post(n, null, a);
                    })(e, n)
                        .then(async (e) => {
                            let n = e.success;
                            if (n === 0) {
                                show.error(e.message);
                            } else {
                                if (n !== 1) {
                                    clog.error("登录失败", e);
                                    throw new Error(e.message);
                                }
                                {
                                    let n = e.data.token;
                                    await localStorage.setItem(me, n);
                                    show.ok("登录成功");
                                    layer.close(t);
                                    window.location.href =
                                        "/advanced_search?handleTop=1&period=daily";
                                }
                            }
                        })
                        .catch((e) => {
                            clog.error("登录异常:", e);
                            show.error(e.message);
                        })
                        .finally(() => {
                            a.close();
                        });
                });
            },
        });
    }
}
class NavBarPlugin extends BasePlugin {
    getName() {
        return "NavBarPlugin";
    }
    async initCss() {
        return "\n            .highlight-red {\n    /* 核心要求：高亮红色文本 */\n    color: red !important; \n    \n    /* 建议：增加字体加粗，效果更明显 */\n    font-weight: bold;\n    \n    /* 建议：增加背景色，效果更突出 */\n    /* background-color: yellow; */ \n}\n        ";
    }
    handle() {
        this.margeNav();
        this.hookSearch();
        this.hookOldSearch();
        this.toggleOtherNavItem();
        $(window).resize(this.toggleOtherNavItem);
        if (window.location.href.includes("/search")) {
            const e = new URLSearchParams(window.location.search);
            let t = e.get("q");
            let n = e.get("f");
            $("#search-keyword").val(t);
            if (n) {
                $("#search-type").val(n);
            }
            if (t) {
                this.highlightKeyword(t);
            }
        }
    }
    highlightKeyword(e) {
        const t = e.trim();
        if (!t) {
            return;
        }
        const n = t.toLowerCase();
        $(".video-title strong, .actor-box strong").each(function () {
            const e = $(this);
            if (e.text().toLowerCase().includes(n)) {
                e.addClass("highlight-red");
            }
        });
    }
    hookSearch() {
        $("#navbar-menu-hero").after(
            '\n            <div class="navbar-menu" id="search-box">\n                <div class="navbar-start" style="display: flex; align-items: center; gap: 5px;">\n                    <select id="search-type" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; background-color: #333; color: #eee; font-size: 14px; outline: none;">\n                        <option value="all">影片</option>\n                        <option value="actor">演員</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">導演</option>\n                        <option value="code">番號</option>\n                        <option value="list">清單</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="輸入影片番號，演員名等關鍵字進行檢索" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; flex-grow: 1; font-size: 14px; background-color: #333; color: #eee; outline: none;">\n                    <a href="/advanced_search?noFold=1" title="進階檢索" style="padding: 6px 12px; background-color: #444; border-radius: 4px; text-decoration: none; color: #ddd; font-size: 14px; border: 1px solid #555;"><span>...</span></a>\n                    <a id="search-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">檢索</a>\n                </div>\n            </div>\n        ',
        );
        $("#search-keyword")
            .on("paste", (e) => {
                const t = e.originalEvent.clipboardData.items;
                for (let n = 0; n < t.length; n++) {
                    if (t[n].type.indexOf("image") !== -1) {
                        return;
                    }
                }
                setTimeout(() => {
                    $("#search-btn").click();
                }, 0);
            })
            .on("keypress", (e) => {
                if (e.key === "Enter") {
                    setTimeout(() => {
                        $("#search-btn").click();
                    }, 0);
                }
            });
        $("#search-btn").on("click", (e) => {
            let t = $("#search-keyword").val();
            let n = $("#search-type option:selected").val();
            if (t !== "") {
                if (window.location.href.includes("/search")) {
                    window.location.href = "/search?q=" + t + "&f=" + n;
                } else {
                    window.open("/search?q=" + t + "&f=" + n);
                }
            }
        });
    }
    hookOldSearch() {
        const e = document.querySelector(".search-image");
        if (!e) {
            return;
        }
        const t = e.cloneNode(true);
        e.parentNode.replaceChild(t, e);
        $("#button-search-image").attr("data-tooltip", "以图识图");
    }
    margeNav() {
        $('a[href*="/feedbacks/new"]').remove();
        $('a[href*="theporndude.com"]').remove();
        $('a.navbar-link[href="/makers"]')
            .parent()
            .after(
                '\n            <div class="navbar-item has-dropdown is-hoverable">\n                <a class="navbar-link">其它</a>\n                <div class="navbar-dropdown is-boxed">\n                  <a class="navbar-item" href="/feedbacks/new" target="_blank" >反饋</a>\n                  <a class="navbar-item" rel="nofollow noopener" target="_blank" href="https://theporndude.com/zh">ThePornDude</a>\n                </div>\n              </div>\n        ',
            );
    }
    toggleOtherNavItem() {
        let e = $("#search-box");
        let t = $("#search-bar-container");
        if ($(window).width() < 1600 && $(window).width() > 1023) {
            e.hide();
            t.show();
        }
        if ($(window).width() > 1600) {
            e.show();
            t.hide();
        }
    }
}
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
class OtherSitePlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "okBackgroundColor", "#7bc73b");
        i(this, "errorBackgroundColor", "#de3333");
        i(this, "warnBackgroundColor", "#d7a80c");
        i(this, "domainErrorBackgroundColor", "#d7780c");
        i(this, "siteConfigs", [
            {
                id: "missAvBtn",
                getBaseUrl: async () => await this.getMissAvUrl(),
                itemSelector: ".text-secondary",
                searchPath: (e, t) => `${e}/search/${t}`,
                getDetailPageHref: (e) => e.attr("href"),
                findCarNumOrTitle: (e) => e.text(),
            },
            {
                id: "supJavBtn",
                getBaseUrl: async () => await this.getSupJavUrl(),
                itemSelector: ".posts post",
                searchPath: (e, t) => `${e}/?s=${t}`,
                getDetailPageHref: (e, t, n) => e.attr("href"),
                findCarNumOrTitle: (e) => e.attr("title"),
            },
        ]);
        i(this, "settingCache", null);
        i(this, "lastFetchTime", 0);
        i(this, "CACHE_DURATION", 10000);
    }
    getName() {
        return "OtherSitePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .site-btn {\n                    position: relative !important;\n                    min-width: 80px;\n                    display: inline-block;\n                    padding: 5px 10px;\n                    color: white !important;\n                    background-color:#938585;\n                    text-decoration: none;\n                    border-radius: 4px;\n                    text-align: center;\n                    margin-bottom: 5px;\n                }\n                .site-btn:hover {\n                    color: white;\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .site-tag {\n                    position: absolute; \n                    top: -15px; \n                    right: 0; \n                    background-color: #ffc107; \n                    color: #333; \n                    font-size: 12px; \n                    padding: 2px 6px; \n                    border-radius: 4px;\n                }\n            </style>\n        ";
    }
    async handle() {
        if (isDetailPage) {
            this.loadOtherSite().then();
        }
    }
    async loadOtherSite(e, t) {
        if (
            (await storageManager.getSetting("enableLoadOtherSite", "yes")) !==
            "yes"
        ) {
            return;
        }
        e ||= this.getPageInfo().carNum;
        const n = this.getEnabledSites();
        const a = `\n            <div id="otherSiteBox" class="panel-block" style="${r ? "margin-top:8px;font-size:13px" : "margin-top:10px;font-size:13px"}; user-select: none; ">\n                <div style="display: flex;gap: 5px;flex-wrap: wrap">\n                    ${this.siteConfigs
            .map((e) => {
                e.sourceCarNum = t;
                if (e.condition && e.condition(e.sourceCarNum) === false) {
                    return "";
                }
                return `<a target="_blank" class="site-btn" style="${n.includes(e.id) ? "" : "display:none"}" id="${e.id}"><span>${e.id.replace("Btn", "")}</span></a>`;
            })
            .join("")}\n                </div>\n            </div>\n        `;
        $(".movie-panel-info").append(a);
        $(".container .info").append(a);
        await Promise.all(
            this.siteConfigs.map(async (t) => {
                if (!t.condition || t.condition(t.sourceCarNum) !== false) {
                    await this.handleSite(e, t);
                }
            }),
        );
        this.renderSettingsArea();
        this.setupEventListeners();
    }
    async handleSite(e, t) {
        const n = $(`#${t.id}`);
        if (t.initUrl) {
            n.attr("href", t.initUrl(e));
            n.css("backgroundColor", this.warnBackgroundColor);
        }
        if (t.noHandle && t.noHandle === true) {
            const t = "jhs_other_site_dmm";
            const a = (
                localStorage.getItem(t)
                    ? JSON.parse(localStorage.getItem(t))
                    : {}
            )[e];
            if (a) {
                if (a.type === "single") {
                    n.attr("href", a.url);
                    n.css("backgroundColor", this.okBackgroundColor);
                } else if (a.type === "multiple") {
                    n.attr("href", a.url);
                    n.append(
                        '<span class="site-tag" style="top:-15px">多结果</span>',
                    );
                    n.css("backgroundColor", this.okBackgroundColor);
                }
            }
        } else {
            try {
                if (n.attr("href")) {
                    return;
                }
                if (utils.isHidden(n)) {
                    return;
                }
                const a = "jhs_other_site";
                const i = localStorage.getItem(a)
                    ? JSON.parse(localStorage.getItem(a))
                    : {};
                const s = e + "_" + t.id.replace("Btn", "");
                const o = i[s];
                if (o) {
                    if (o.type === "single") {
                        n.attr("href", o.url);
                        n.css("backgroundColor", this.okBackgroundColor);
                    } else if (o.type === "multiple") {
                        n.attr("href", o.url);
                        n.append(
                            '<span class="site-tag" style="top:-15px">多结果</span>',
                        );
                        n.css("backgroundColor", this.okBackgroundColor);
                    }
                    return;
                }
                const r = await t.getBaseUrl();
                const l = t.searchPath(r, e);
                n.attr("href", l);
                const c = await gmHttp.get(l, null, t.headers, true);
                const d = utils.htmlTo$dom(c);
                const h = [];
                d.find(t.itemSelector).each((n, a) => {
                    const i = $(a);
                    if (
                        !t
                            .findCarNumOrTitle(i)
                            .toLowerCase()
                            .includes(e.toLowerCase())
                    ) {
                        return;
                    }
                    let s = t.getDetailPageHref(i, r, e);
                    if (!s) {
                        throw new Error("解析href失败");
                    }
                    if (!s.includes("http")) {
                        s = r + (s.startsWith("/") ? s : "/" + s);
                    }
                    h.push(s);
                });
                let g = "";
                let p = null;
                if (h.length === 1) {
                    let e = h[0];
                    n.attr("href", e);
                    n.css("backgroundColor", this.okBackgroundColor);
                    p = {
                        type: "single",
                        url: e,
                    };
                } else if (h.length > 1) {
                    n.attr("href", l);
                    g +=
                        '<span class="site-tag" style="top:-15px">多结果</span>';
                    n.css("backgroundColor", this.okBackgroundColor);
                    p = {
                        type: "multiple",
                        url: l,
                    };
                } else {
                    n.attr("href", l);
                    n.attr("title", "未查询到, 点击前往搜索页");
                    n.css("backgroundColor", this.errorBackgroundColor);
                }
                if (p) {
                    new ve().addTask(() => {
                        const e = localStorage.getItem(a)
                            ? JSON.parse(localStorage.getItem(a))
                            : {};
                        e[s] = p;
                        localStorage.setItem(a, JSON.stringify(e));
                    });
                }
                if (g) {
                    n.append(g);
                }
            } catch (a) {
                const e = String(a);
                const i = t.id.replace("Btn", "");
                if (e.includes("Just a moment")) {
                    n.attr("title", "请求失败：Cloudflare 安全检查。");
                    n.css("backgroundColor", this.warnBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${i} 需Cloudflare安全检查`);
                } else if (e.includes("重定向")) {
                    n.attr("title", "域名失效");
                    n.css("backgroundColor", this.domainErrorBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${i} 域名被重定向`);
                } else if (e.includes("404 Page Not Found")) {
                    n.attr("title", "未查询到, 点击前往搜索页");
                    n.css("backgroundColor", this.errorBackgroundColor);
                } else {
                    console.error(a);
                    n.attr("title", "请求失败。");
                    n.css("backgroundColor", this.errorBackgroundColor);
                    clog.warn(`检测第三方资源失败, ${i}`);
                }
            }
        }
    }
    async getSettingCache() {
        const e = Date.now();
        if (
            !this.settingCache ||
            e - this.lastFetchTime > this.CACHE_DURATION
        ) {
            this.settingCache = await storageManager.getSetting();
            this.lastFetchTime = e;
        }
        return this.settingCache;
    }
    async getMissAvUrl() {
        return (
            (await this.getSettingCache()).missAvUrl || "https://missav.live"
        );
    }
    async getJavDbUrl() {
        return (await this.getSettingCache()).javDbUrl || "https://javdb.com";
    }
    async getSupJavUrl() {
        return (await this.getSettingCache()).supJavUrl || "https://supjav.com";
    }
    getEnabledSites() {
        const e = localStorage.getItem("jhs_enabled_sites");
        if (e) {
            return JSON.parse(e);
        } else {
            return this.siteConfigs.map((e) => e.id);
        }
    }
    saveEnabledSites(e) {
        localStorage.setItem("jhs_enabled_sites", JSON.stringify(e));
    }
    renderSettingsArea() {
        const e = this.getEnabledSites();
        const t = document.getElementById("siteCheckboxes");
        if (t) {
            t.innerHTML = this.siteConfigs
                .map((t) => {
                    const n = e.includes(t.id);
                    return `\n                <div style="margin-right: 15px; display: flex; align-items: ${r ? "center" : "flex-start"};">\n                    <input type="checkbox" id="checkbox-${t.id}" data-site-id="${t.id}" ${n ? "checked" : ""} style="margin-right: 8px; cursor: pointer;">\n                    <label for="checkbox-${t.id}" style="color: #333; font-weight: 500; cursor: pointer;">${t.id.replace("Btn", "")}</label>\n                </div>\n            `;
                })
                .join("");
        }
    }
    setupEventListeners() {
        const e = document.getElementById("settingsArea");
        e?.addEventListener("change", (t) => {
            if (t.target.type === "checkbox") {
                const n = t.target.getAttribute("data-site-id");
                if (t.target.checked) {
                    $(`#${n}`).show();
                    const e = this.getPageInfo().carNum;
                    const t = this.siteConfigs.find((e) => e.id === n);
                    this.handleSite(e, t).then();
                } else {
                    $(`#${n}`).hide();
                }
                const a = Array.from(
                    e.querySelectorAll('input[type="checkbox"]:checked'),
                ).map((e) => e.getAttribute("data-site-id"));
                this.saveEnabledSites(a);
            }
        });
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
class ReviewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "floorIndex", 1);
        i(this, "isInit", false);
    }
    getName() {
        return "ReviewPlugin";
    }
    async handle() {
        if (window.isDetailPage) {
            if (r) {
                const e = this.parseMovieId(window.location.href);
                await this.showReview(e);
                await this.getBean("RelatedPlugin").showRelated(
                    $("#magnets-content"),
                    e,
                );
            }
            if (l) {
                let e = this.getPageInfo().carNum;
                const t = await (async (e) => {
                    let t = `${U}/v2/search`;
                    let n = {
                        "user-agent": "Dart/3.5 (dart:io)",
                        "accept-language": "zh-TW",
                        host: "jdforrepam.com",
                        jdsignature: await O(),
                    };
                    let a = {
                        q: e,
                        page: 1,
                        type: "movie",
                        limit: 1,
                        movie_type: "all",
                        from_recent: "false",
                        movie_filter_by: "all",
                        movie_sort_by: "relevance",
                    };
                    return (await gmHttp.get(t, a, n)).data.movies;
                })(e);
                let n = null;
                for (let a = 0; a < t.length; a++) {
                    let i = t[a];
                    if (i.number.toLowerCase() === e.toLowerCase()) {
                        n = i.id;
                        break;
                    }
                }
                if (!n) {
                    return;
                }
                this.showReview(n, $("#sample-waterfall")).then();
            }
        }
    }
    async showReview(e, t) {
        const n = await storageManager.getSetting("enableLoadReview", _);
        const a = t || $("#magnets-content");
        a.append(
            `\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;" data-tip="想要发表评论? 滑上去, 点击上面的按钮-看过">❓ 评论区</span>\n                <a id="reviewsFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `,
        );
        $("#reviewsFold").on("click", (t) => {
            t.preventDefault();
            t.stopPropagation();
            const n = $("#reviewsFold .toggle-text");
            const a = $("#reviewsFold .toggle-icon");
            const i = n.text() === "展开";
            n.text(i ? "折叠" : "展开");
            a.text(i ? "▲" : "▼");
            if (i) {
                $("#reviewsContainer").show();
                $("#reviewsFooter").show();
                if (!this.isInit) {
                    this.fetchAndDisplayReviews(e);
                    this.isInit = true;
                }
                storageManager.saveSettingItem("enableLoadReview", _);
            } else {
                $("#reviewsContainer").hide();
                $("#reviewsFooter").hide();
                storageManager.saveSettingItem("enableLoadReview", C);
            }
        });
        a.append('<div id="reviewsContainer"></div>');
        a.append('<div id="reviewsFooter"></div>');
        if (n === _) {
            await this.fetchAndDisplayReviews(e);
        }
    }
    async fetchAndDisplayReviews(e) {
        const t = $("#reviewsContainer");
        const n = $("#reviewsFooter");
        t.append(
            '<div id="reviewsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取评论中...</div>',
        );
        const a = await storageManager.getSetting("reviewCount", 20);
        let i = null;
        try {
            i = await R(e, 1, a);
        } catch (o) {
            if (o.toString().includes("簽名已過期")) {
                show.error("生成签名失败, 请检查系统时间及时区是否正确!");
            }
            clog.error("获取评论失败:", o);
            console.error("获取评论失败:", o);
        } finally {
            $("#reviewsLoading").remove();
        }
        if (!i) {
            t.append(
                '\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取评论失败\n                    <a id="retryFetchReviews" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            ',
            );
            $("#retryFetchReviews").on("click", async () => {
                $("#retryFetchReviews").parent().remove();
                await this.fetchAndDisplayReviews(e);
            });
            return;
        }
        if (i.length === 0) {
            t.append(
                '<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无评论</div>',
            );
            return;
        }
        const s = await storageManager.getReviewFilterKeywordList();
        this.displayReviews(i, t, s);
        if (i.length === a) {
            n.html(
                '\n                <button id="loadMoreReviews" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多评论\n                </button>\n                <div id="reviewsEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>\n            ',
            );
            let i = 1;
            let r = $("#loadMoreReviews");
            r.on("click", async () => {
                let n;
                r.text("加载中...").prop("disabled", true);
                i++;
                try {
                    n = await R(e, i, a);
                } catch (o) {
                    console.error("加载更多评论失败:", o);
                } finally {
                    r.text("加载失败, 请点击重试").prop("disabled", false);
                }
                if (n) {
                    this.displayReviews(n, t, s);
                    if (n.length < a) {
                        r.remove();
                        $("#reviewsEnd").show();
                    } else {
                        r.text("加载更多评论").prop("disabled", false);
                    }
                }
            });
        } else {
            n.html(
                '<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>',
            );
        }
    }
    displayReviews(e, t, n) {
        if (e.length) {
            e.forEach((e) => {
                if (n.some((t) => e.content.includes(t))) {
                    return;
                }
                const a = Array(e.score)
                    .fill('<i class="icon-star"></i>')
                    .join("");
                const i = e.content.replace(
                    /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+/g,
                    (e) =>
                        e.startsWith("ed2k://")
                            ? `\n                            <span style="word-break: break-all;background: #e0f2fe;color: #0369a1;">${e}</span>\n                            <button class="button is-info down-115" data-magnet="${e}" style="font-size: 11px">115离线下载</button>\n                        `
                            : e.startsWith("magnet:")
                              ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n                            <button class="button is-info down-115" data-magnet="${e}" style="font-size: 11px">115离线下载</button>\n                        `
                              : e.startsWith("http://") ||
                                  e.startsWith("https://")
                                ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n                        `
                                : e,
                );
                const s = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}楼</span>\n                    ${e.username} &nbsp;&nbsp; <span class="score-stars">${a}</span> \n                    <span class="time">${utils.formatDate(e.created_at)}</span> \n                    &nbsp;&nbsp; 点赞:${e.likes_count}\n                    <p class="review-content" style="margin-top: 5px;"> ${i} </p>\n                </div>\n            `;
                t.append(s);
            });
            this.rightClickFilter();
        }
    }
    async rightClickFilter() {
        if (
            (await storageManager.getSetting("enableTitleSelectFilter", _)) ===
            _
        ) {
            utils.rightClick(document.body, ".review-content", async (e) => {
                const t = window.getSelection().toString();
                if (t) {
                    e.preventDefault();
                    await utils.q(
                        e,
                        `是否将 '${t}' 加入评论区关键词?`,
                        async () => {
                            await storageManager.saveReviewFilterKeyword(t);
                            show.ok("操作成功, 刷新页面后生效");
                        },
                    );
                }
            });
        }
    }
}
class FilterTitleKeywordPlugin extends BasePlugin {
    getName() {
        return "FilterTitleKeywordPlugin";
    }
    async handle() {
        if (!isDetailPage && !isFc2Page) {
            return;
        }
        if (
            (await storageManager.getSetting("enableTitleSelectFilter", _)) !==
            _
        ) {
            return;
        }
        let e;
        if (r) {
            e = ".title strong, .current-title";
        } else if (l) {
            e = "h3";
        }
        utils.rightClick(document.body, e, (e) => {
            const t = window.getSelection().toString();
            if (t) {
                e.preventDefault();
                let n = {
                    clientX: e.clientX,
                    clientY: e.clientY + 80,
                };
                utils.q(n, `是否屏蔽标题关键词 ${t}?`, async () => {
                    await storageManager.saveTitleFilterKeyword(t);
                    window.refresh();
                    utils.closePage();
                });
            }
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
class ListPageButtonPlugin extends BasePlugin {
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        if (!window.isListPage) {
            return;
        }
        await this.createMenuBtn();
        this.bindEvent();
        if ((await storageManager.getSetting("autoPage")) === _) {
            $("#sort-toggle-btn").hide();
        } else {
            this.sortItems().then();
        }
    }
    async createMenuBtn() {
        if (r) {
            const e = o.includes("/actors/");
            let t = $(".main-tabs, .tabs");
            let n = "加入黑名单";
            let a = "#d22020";
            let i = "";
            let s = null;
            if (e) {
                t = $(".toolbar, .section-addition").filter(":last");
                const e = await storageManager.getBlacklist();
                const i = this.getActressPageInfo();
                if (e.find((e) => e.starId === i.starId)) {
                    n = "已加入黑名单";
                    a = "#885d5d";
                }
            } else if (o.includes("/tags")) {
                utils.loopDetector(
                    () => $("#jhs-check-tag").text().trim(),
                    async () => {
                        const e = $("#addBlacklistBtn");
                        e.attr(
                            "data-tip",
                            "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中",
                        );
                        const t = $("#jhs-check-tag").text().trim();
                        if (!t) {
                            return;
                        }
                        const n = "no-" + t;
                        const a = await storageManager.getBlacklist();
                        s = a.find((e) => e.starId === n);
                        if (s) {
                            e.css("backgroundColor", "#885d5d");
                            $("#addBlacklistBtn span").text("已加入黑名单");
                        }
                    },
                );
            }
            const r = o.includes("advanced_search");
            if (r) {
                t = $("h2.section-title");
            } else {
                i = "flex-grow:1;";
            }
            const l = localStorage.getItem("jhs_sortMethod");
            const d =
                "当前排序方式: " +
                (l === "rateCount"
                    ? "评价人数"
                    : l === "date"
                      ? "时间"
                      : "默认");
            t.append(
                `\n                <div style="display: flex;align-items: center; ${i} ">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    <a id="waitDownBtn" class="menu-btn main-tab-btn" style="background-color:#2caac0 !important;"><span>打开已收藏</span></a>\n                    ${e ? `\n                     <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                     <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;margin-right: 30px!important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                    ` : ""}\n                    ${o.includes("/tags") ? `\n                      <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                    ` : ""}\n                </div>\n                <div style="display: flex;align-items: center;">\n                    <a id="newVideoBtn" class="menu-btn main-tab-btn" style="background-color:#2c6cc0 !important;"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></a>\n                    <a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>\n                    ${c || r ? "" : `<a id="sort-toggle-btn" class="menu-btn main-tab-btn" style="background-color:#8783ab !important;"> ${d} </a>`}\n                </div>\n            `,
            );
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单";
            let n = "#d22020";
            if (e) {
                const e = await storageManager.getBlacklist();
                const a = this.getActressPageInfo();
                if (e.find((e) => e.starId === a.starId)) {
                    t = "已加入黑名单";
                    n = "#885d5d";
                }
            }
            $(".masonry")
                .parent()
                .prepend(
                    `\n                <div style="margin: 10px; display: flex;">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    <a id="waitDownBtn" class="menu-btn main-tab-btn" style="background-color:#2caac0 !important;"><span>打开已收藏</span></a>\n                    \n                    ${e ? `    \n                        <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${n} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></a>\n                        <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                    ` : '<a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>'}\n                </div>\n            `,
                );
        }
    }
    bindEvent() {
        $("#waitCheckBtn").on("click", (e) => {
            this.openWaitCheck(e).then();
        });
        $("#waitDownBtn").on("click", (e) => {
            this.openFavorite(e).then();
        });
        $("#newVideoBtn").on("click", (e) => {
            this.getBean("NewVideoPlugin").openDialog();
        });
        $("#blacklistBtn").on("click", (e) => {
            this.getBean("BlacklistPlugin").openBlacklistDialog();
        });
        $("#sort-toggle-btn").on("click", (e) => {
            const t = localStorage.getItem("jhs_sortMethod");
            let n;
            n =
                t && t !== "default"
                    ? t === "rateCount"
                        ? "date"
                        : "default"
                    : "rateCount";
            const a = {
                default: "默认",
                rateCount: "评价人数",
                date: "时间",
            }[n];
            $(e.target).text(`当前排序方式: ${a}`);
            localStorage.setItem("jhs_sortMethod", n);
            this.sortItems().then();
        });
        const e = this.getBean("BlacklistPlugin");
        $("#addBlacklistBtn").on("click", async (t) => {
            await e.addBlacklist(t);
        });
        $("#filterAllVideo").on("click", async (t) => {
            let n = {
                clientX: t.clientX,
                clientY: t.clientY + 80,
            };
            let a = r
                ? $(".actor-section-name")
                : $(".avatar-box .photo-info .pb10");
            if (a.length === 0) {
                show.error("获取演员名称失败");
                return;
            }
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键屏蔽视频列表?", async () => {
                this.loadObj = loading();
                try {
                    await e.filterAllVideo(i);
                    window.refresh();
                } catch (t) {
                    console.error(t);
                } finally {
                    this.loadObj.close();
                }
            });
        });
    }
    async sortItems() {
        if (o.includes("handle") || o.includes("advanced_search")) {
            return;
        }
        const e = await storageManager.getSetting("autoPage");
        if (c || e === _) {
            return;
        }
        const t = localStorage.getItem("jhs_sortMethod");
        if (!t) {
            return;
        }
        $(".movie-list .item").each(function (e) {
            if (!$(this).attr("data-original-index")) {
                $(this).attr("data-original-index", e);
            }
        });
        const n = $(".movie-list");
        const a = $(".item", n);
        if (t === "default") {
            a.sort(function (e, t) {
                return (
                    $(e).data("original-index") - $(t).data("original-index")
                );
            }).appendTo(n);
        } else {
            const e = a.get();
            e.sort(function (e, n) {
                if (t === "rateCount") {
                    const t = (e) => {
                        const t = $(e)
                            .find(".score .value")
                            .text()
                            .match(/由(\d+)人/);
                        if (t) {
                            return parseFloat(t[1]);
                        } else {
                            return 0;
                        }
                    };
                    return t(n) - t(e);
                }
                {
                    const t = (e) => {
                        const t = $(e).find(".meta").text().trim();
                        return new Date(t);
                    };
                    return t(n) - t(e);
                }
            });
            n.empty().append(e);
        }
    }
    async openWaitCheck() {
        let e = this.getSelector();
        const t = await storageManager.getSetting("waitCheckCount", 5);
        const n = [u, b, y, k];
        let a = 0;
        $(`${e.itemSelector}:visible`).each((e, i) => {
            if (a >= t) {
                return false;
            }
            const s = $(i);
            if (n.some((e) => s.find(`span.tag:contains('${e}')`).length > 0)) {
                return;
            }
            const { carNum: o, aHref: r } =
                this.getBean("ListPagePlugin").findCarNumAndHref(s);
            if (o.includes("FC2-")) {
                const e = this.parseMovieId(r);
                this.getBean("Fc2Plugin")?.openFc2Page(e, o, r);
            } else {
                let e = r + (r.includes("?") ? "&autoPlay=1" : "?autoPlay=1");
                window.open(e);
            }
            a++;
        });
        if (a === 0) {
            show.info("没有需鉴定的视频");
        }
    }
    async openFavorite() {
        let e = await storageManager.getSetting("waitCheckCount", 5);
        const t = (await storageManager.getCarList())
            .filter((e) => e.status === h)
            .sort((e, t) => t.createDate - e.createDate);
        for (let n = 0; n < e; n++) {
            if (n >= t.length) {
                return;
            }
            let e = t[n];
            let a = e.carNum;
            let i = e.url;
            if (a.includes("FC2-")) {
                const e = this.parseMovieId(i);
                await this.getBean("Fc2Plugin")?.openFc2Page(e, a, i);
            } else {
                window.open(i);
            }
            clog.debug("打开已收藏", a, i);
        }
    }
}
const _e = async (e, t = "ja", n = "zh-CN") => {
    if (!e) {
        throw new Error("翻译文本不能为空");
    }
    const a =
        "https://translate-pa.googleapis.com/v1/translate?" +
        new URLSearchParams({
            "params.client": "gtx",
            dataTypes: "TRANSLATION",
            key: "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA",
            "query.sourceLanguage": t,
            "query.targetLanguage": n,
            "query.text": e,
        });
    const i = await fetch(a);
    if (!i.ok) {
        throw new Error(`${i.status} ${i.statusText}`);
    }
    return (await i.json()).translation;
};
const Te = {
    IS_FILTERED: {
        text: u,
        color: f,
        reasonType: "单番号屏蔽",
        isCounted: true,
        countKey: "currentPageFilterCount",
    },
    IS_FAVORITE: {
        text: b,
        color: w,
        reasonType: "",
        isCounted: true,
        countKey: "currentPageFavoriteCount",
    },
    IS_HAS_WATCH: {
        text: k,
        color: S,
        reasonType: "",
        isCounted: true,
        countKey: "currentPageHasWatchCount",
    },
    IS_KEYWORD_FILTER: {
        text: "❌ 关键词屏蔽",
        color: "#de3333",
        reasonType: "",
        isCounted: true,
        countKey: "currentPageKeywordFilterCount",
    },
    IS_ACTOR_FILTER: {
        text: "♂️ 男演员屏蔽",
        color: "#b22222",
        reasonType: "",
        isCounted: true,
        countKey: "currentPageActorFilterCount",
    },
    IS_ACTRESS_FILTER: {
        text: "♀️ 女演员屏蔽",
        color: "#cd5c5c",
        reasonType: "",
        isCounted: true,
        countKey: "currentPageActorFilterCount",
    },
    IS_WAIT_CHECK: {
        text: "",
        color: "",
        reasonType: "",
        isCounted: true,
        countKey: "currentPageWaitCheckCount",
    },
};
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
                    window.imageHoverPreviewObj = new ImageHoverPreview({
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
                window.imageHoverPreviewObj = new ImageHoverPreview({
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
class RelatedPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        i(this, "floorIndex", 1);
        i(this, "isInit", false);
    }
    getName() {
        return "RelatedPlugin";
    }
    async showRelated(e, t) {
        const n = await storageManager.getSetting("enableLoadRelated", C);
        const a = e;
        if (t) {
            a.append(
                `\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;">相关清单</span>\n                <a id="relatedFold" style="margin-left: 8px; color: #1897ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `,
            );
            $("#relatedFold").on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const n = $("#relatedFold .toggle-text");
                const a = $("#relatedFold .toggle-icon");
                const i = n.text() === "展开";
                n.text(i ? "折叠" : "展开");
                a.text(i ? "▲" : "▼");
                if (i) {
                    $("#relatedContainer").show();
                    $("#relatedFooter").show();
                    if (!this.isInit) {
                        this.fetchAndDisplayRelateds(t);
                        this.isInit = true;
                    }
                    storageManager.saveSettingItem("enableLoadRelated", _);
                } else {
                    $("#relatedContainer").hide();
                    $("#relatedFooter").hide();
                    storageManager.saveSettingItem("enableLoadRelated", C);
                }
            });
            a.append('<div id="relatedContainer"></div>');
            a.append('<div id="relatedFooter"></div>');
            if (n === _) {
                await this.fetchAndDisplayRelateds(t);
            }
        } else {
            show.error("未传入movieId");
        }
    }
    async fetchAndDisplayRelateds(e) {
        const t = $("#relatedContainer");
        const n = $("#relatedFooter");
        t.append(
            '<div id="relatedLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取清单中...</div>',
        );
        let a = null;
        try {
            a = await K(e, 1, 20);
        } catch (i) {
            console.error("获取清单失败:", i);
        } finally {
            $("#relatedLoading").remove();
        }
        if (!a) {
            t.append(
                '\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取清单失败\n                    <a id="retryFetchRelateds" href="javascript:;" style="margin-left: 10px; color: #1897ff; text-decoration: none;">重试</a>\n                </div>\n            ',
            );
            $("#retryFetchRelateds").on("click", async () => {
                $("#retryFetchRelateds").parent().remove();
                await this.fetchAndDisplayRelateds(e);
            });
            return;
        }
        if (a.length !== 0) {
            this.displayRelateds(a, t);
            if (a.length === 20) {
                n.html(
                    '\n                <button id="loadMoreRelateds" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多清单\n                </button>\n                <div id="relatedEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>\n            ',
                );
                let a = 1;
                let s = $("#loadMoreRelateds");
                s.on("click", async () => {
                    let n;
                    s.text("加载中...").prop("disabled", true);
                    a++;
                    try {
                        n = await K(e, a, 20);
                    } catch (i) {
                        console.error("加载更多清单失败:", i);
                    } finally {
                        s.text("加载失败, 请点击重试").prop("disabled", false);
                    }
                    if (n) {
                        this.displayRelateds(n, t);
                        if (n.length < 20) {
                            s.remove();
                            $("#relatedEnd").show();
                        } else {
                            s.text("加载更多清单").prop("disabled", false);
                        }
                    }
                });
            } else {
                n.html(
                    '<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>',
                );
            }
        } else {
            t.append(
                '<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无清单</div>',
            );
        }
    }
    displayRelateds(e, t) {
        if (e.length) {
            e.forEach((e) => {
                let n = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                   <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}</span>\n                   <span style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;">创建时间: ${e.createTime}</span>\n                   <p><a href="/lists/${e.relatedId}" target="_blank" style="color:#2e8abb">${e.name}</a></p>\n                   <p style="margin-top: 5px;">视频个数: ${e.movieCount}</p>\n                   <p style="margin-top: 5px;">收藏次数: ${e.collectionCount} 被查看次数: ${e.viewCount}</p>\n                </div>\n            `;
                t.append(n);
            });
        }
    }
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
const tt = [
    {
        name: "jsDelivr (全球CDN)",
        json: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json",
        base: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/",
    },
    {
        name: "GitHub Raw (备用)",
        json: "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json",
        base: "https://raw.githubusercontent.com/gfriends/gfriends/master/Content/",
    },
];
const nt = "jhs_img_cdn_index";
let at = parseInt(localStorage.getItem(nt) || "0", 10);
if (at >= tt.length || at < 0) {
    at = 0;
}
let it = tt[at].json;
let st = tt[at].base;
const ot = "filetreeStore";
const rt = "filetree_data";
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
        e.register(Fc2Plugin);
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
        e.register(RelatedPlugin);
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
