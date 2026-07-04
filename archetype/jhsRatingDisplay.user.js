// ==UserScript==
// @name         JHS 评分显示
// @version      2.0
// @description  从 jhs IndexedDB 读取已看番号，在卡片上显示个人评分（首屏缓存优先 → 悬停懒加载），实时同步刷新
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      javdb.com
// ==/UserScript==

(function () {
    "use strict";

    /* =========================================================================
     * 1. 配置常量
     * ========================================================================= */
    const CONFIG = {
        DEBUG_MODE: false,

        // jhs IndexedDB
        IDB_NAME: "JAV-JHS",
        IDB_STORE: "appData",
        CAR_LIST_KEY: "car_list",

        // 评分缓存（localStorage + 寄生 jhs IndexedDB，永久不过期）
        RATING_CACHE_KEY: "jdb:rating_cache_v2",
        IDB_RATING_KEY: "jhsRatingDisplay_data",

        // 卡片选择器
        ITEM_SELECTOR:
            ".movie-list .item, .is-user-page .column.is-one-quarter",

        // 请求控制
        HOVER_DELAY: 500, // 悬停延迟 ms
        FETCH_CONCURRENCY: 3, // 并发上限
        FETCH_TIMEOUT: 8000, // 请求超时 ms
        FETCH_RETRY: 1, // 重试次数
    };

    /* =========================================================================
     * 2. 工具库
     * ========================================================================= */
    const Utils = {
        parser: new DOMParser(),

        log(action, ...args) {
            if (CONFIG.DEBUG_MODE) {
                console.log(
                    `%c[JHS-Rating][${action}]`,
                    "color:#fff;background:#ffc107;padding:2px 4px;border-radius:2px;",
                    ...args,
                );
            }
        },

        debounce(fn, wait) {
            let t;
            return function (...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        createLimiter(max) {
            let active = 0;
            const queue = [];
            const runNext = () => {
                if (active >= max || queue.length === 0) return;
                active++;
                const job = queue.shift();
                Promise.resolve()
                    .then(job.fn)
                    .then(job.resolve)
                    .catch(job.reject)
                    .finally(() => {
                        active--;
                        runNext();
                    });
            };
            return {
                run(fn) {
                    return new Promise((resolve, reject) => {
                        queue.push({ fn, resolve, reject });
                        runNext();
                    });
                },
            };
        },

        getSafeUrl(url, base = window.location.origin) {
            if (!url) return "";
            try {
                if (url.startsWith("http")) return url;
                if (url.startsWith("//")) return "https:" + url;
                return new URL(url, base).href;
            } catch (e) {
                return url;
            }
        },

        normalizeCode(raw) {
            if (!raw) return "";
            return raw.trim().toUpperCase().replace(/\s+/g, "-");
        },

        /**
         * 从卡片提取番号（优先 .video-title strong，回退 meta 文本）
         */
        getCode(item) {
            if (item.dataset.code) return item.dataset.code;
            const raw =
                item.querySelector(".video-title strong")?.textContent || "";
            const code = this.normalizeCode(raw);
            if (code) item.dataset.code = code;
            return code;
        },

        /**
         * 从卡片提取详情页锚点
         */
        getAnchor(item) {
            return item?.querySelector("a.box, .box a");
        },
    };

    /* =========================================================================
     * 3. jhs IndexedDB 读取
     * ========================================================================= */
    const JhsDB = {
        open() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(CONFIG.IDB_NAME);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },

        async getAllCarList() {
            try {
                const db = await this.open();
                return new Promise((resolve) => {
                    try {
                        const tx = db.transaction(CONFIG.IDB_STORE, "readonly");
                        const store = tx.objectStore(CONFIG.IDB_STORE);
                        const req = store.get(CONFIG.CAR_LIST_KEY);
                        req.onsuccess = () => resolve(req.result || []);
                        req.onerror = () => resolve([]);
                    } catch (e) {
                        resolve([]);
                    }
                });
            } catch (e) {
                Utils.log("IDB_ERROR", e);
                return [];
            }
        },

        /**
         * 构建"已看"番号集合
         */
        async buildWatchedMap() {
            const list = await this.getAllCarList();
            const map = new Map();
            list.forEach((item) => {
                if (item && item.status === "hasWatch" && item.carNum) {
                    map.set(Utils.normalizeCode(item.carNum), item);
                }
            });
            Utils.log("WATCHED_MAP", `${map.size} 项`);
            return map;
        },
    };

    /* =========================================================================
     * 4. 评分缓存（localStorage，永久不过期）
     * ========================================================================= */
    const RatingCache = {
        /** @type {{[code: string]: {rating: number, updatedAt: number}}} */
        _data: {},

        /**
         * 加载缓存：localStorage 优先 → IndexedDB 恢复兜底
         */
        async load() {
            try {
                const raw = localStorage.getItem(CONFIG.RATING_CACHE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed === "object" && parsed !== null) {
                        this._data = parsed;
                        Utils.log(
                            "CACHE",
                            `localStorage: ${Object.keys(parsed).length} 条`,
                        );
                        return;
                    }
                }
            } catch (e) {
                /* ignore */
            }

            // localStorage 为空 → 从 IndexedDB 恢复
            try {
                const db = await JhsDB.open();
                const idbData = await new Promise((resolve) => {
                    try {
                        const tx = db.transaction(CONFIG.IDB_STORE, "readonly");
                        const store = tx.objectStore(CONFIG.IDB_STORE);
                        const req = store.get(CONFIG.IDB_RATING_KEY);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve(null);
                    } catch (e) {
                        resolve(null);
                    }
                });
                if (idbData && typeof idbData === "object") {
                    this._data = idbData;
                    // 恢复到 localStorage
                    this.saveToLS();
                    Utils.log(
                        "CACHE",
                        `IndexedDB 恢复: ${Object.keys(idbData).length} 条`,
                    );
                    return;
                }
            } catch (e) {
                Utils.log("CACHE_IDB_LOAD_ERROR", e);
            }

            this._data = {};
        },

        /** 写入 localStorage */
        saveToLS() {
            try {
                localStorage.setItem(
                    CONFIG.RATING_CACHE_KEY,
                    JSON.stringify(this._data),
                );
            } catch (e) {
                Utils.log("CACHE_SAVE_ERROR", e);
            }
        },

        /** 写入 localStorage 并同步到 IndexedDB */
        save() {
            this.saveToLS();
            this._syncToIdb();
        },

        /** 异步同步到 jhs IndexedDB（不阻塞主流程） */
        async _syncToIdb() {
            try {
                const db = await JhsDB.open();
                const tx = db.transaction(CONFIG.IDB_STORE, "readwrite");
                const store = tx.objectStore(CONFIG.IDB_STORE);
                store.put(this._data, CONFIG.IDB_RATING_KEY);
            } catch (e) {
                Utils.log("IDB_SYNC_ERROR", e);
            }
        },

        get(code) {
            return this._data[code] || null;
        },

        /** 返回 true 表示写入成功 */
        set(code, rating) {
            const existed = this._data[code];
            if (existed && existed.rating === rating) return false;
            this._data[code] = { rating, updatedAt: Date.now() };
            this.save();
            return true;
        },

        clear() {
            this._data = {};
            localStorage.removeItem(CONFIG.RATING_CACHE_KEY);
            // 异步清除 IndexedDB
            JhsDB.open().then((db) => {
                try {
                    const tx = db.transaction(CONFIG.IDB_STORE, "readwrite");
                    tx.objectStore(CONFIG.IDB_STORE).delete(
                        CONFIG.IDB_RATING_KEY,
                    );
                } catch (e) {
                    /* ignore */
                }
            });
        },

        size() {
            return Object.keys(this._data).length;
        },
    };

    /* =========================================================================
     * 5. 网络层
     * ========================================================================= */
    const Net = {
        limiter: Utils.createLimiter(CONFIG.FETCH_CONCURRENCY),

        async request(url, retries = CONFIG.FETCH_RETRY) {
            for (let i = 0; i <= retries; i++) {
                try {
                    return await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: "GET",
                            url,
                            timeout: CONFIG.FETCH_TIMEOUT,
                            headers: { "X-Requested-With": "XMLHttpRequest" },
                            onload: resolve,
                            onerror: reject,
                            ontimeout: reject,
                            onabort: reject,
                        });
                    });
                } catch (e) {
                    if (i === retries) throw e;
                    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
                }
            }
        },
    };

    /* =========================================================================
     * 6. 评分解析与抓取
     * ========================================================================= */

    /**
     * 从详情页 DOM 解析个人评分
     */
    function parseRating(doc) {
        if (!doc.querySelector(".review-title .tag.is-success.is-light"))
            return null;
        const chk = doc.querySelector(
            'input[name="video_review[score]"][checked], .rating-star input:checked',
        );
        if (!chk) return null;
        const v = parseInt(chk.value, 10);
        return v >= 1 && v <= 5 ? v : null;
    }

    /**
     * 懒加载评分（限流 + 缓存优先）
     */
    async function fetchRating(item) {
        if (
            item.dataset.jhsrdFetching === "true" ||
            item.dataset.jhsrdLoaded === "true"
        )
            return;
        const anchor = Utils.getAnchor(item);
        if (!anchor) return;
        const code = Utils.getCode(item);
        if (!code) return;

        item.dataset.jhsrdFetching = "true";
        try {
            const url = Utils.getSafeUrl(anchor.href);
            const res = await Net.limiter.run(() => Net.request(url));
            if (res.status !== 200) {
                item.dataset.jhsrdLoaded = "true";
                return;
            }
            const doc = Utils.parser.parseFromString(
                res.responseText,
                "text/html",
            );
            const rating = parseRating(doc);
            if (rating !== null) {
                RatingCache.set(code, rating);
                Renderer.showRating(item, rating);
            } else {
                // 已看但不评分：保持占位，不标 loaded（下次悬停可重试）
            }
            item.dataset.jhsrdLoaded = "true";
        } catch (e) {
            Utils.log("FETCH_ERROR", code, e);
        } finally {
            delete item.dataset.jhsrdFetching;
        }
    }

    /* =========================================================================
     * 7. 渲染层
     * ========================================================================= */
    const Renderer = {
        /**
         * 隐藏卡片封面上默认的评分 span（避免双显示）
         */
        hideNativeBadge(cover) {
            // JavDB 新版 UI 封面上可能有一个评分/序号的 span
            const spans = cover.querySelectorAll(":scope > span");
            spans.forEach((s) => {
                if (s.classList.length === 0 || s.className === "score") {
                    s.style.display = "none";
                }
            });
        },

        /**
         * 显示"已看"占位标签（绿色，无分值）
         */
        showPlaceholder(item) {
            const cover = item.querySelector(".cover");
            if (!cover) return;
            if (cover.querySelector(".jhs-user-rating")) return;

            this.hideNativeBadge(cover);

            const el = document.createElement("div");
            el.className = "jhs-user-rating is-placeholder";
            el.textContent = "已看";
            el.title = "已看（悬停加载评分）";
            cover.appendChild(el);
        },

        /**
         * 替换为评分标签（金色 ★ N）；若元素不存在则自行创建
         */
        showRating(item, rating) {
            const cover = item.querySelector(".cover");
            if (!cover) return;

            let el = cover.querySelector(".jhs-user-rating");
            // 缓存命中时元素尚未创建，自行创建
            if (!el) {
                this.hideNativeBadge(cover);
                el = document.createElement("div");
                el.className = "jhs-user-rating";
                cover.appendChild(el);
            }

            // 重置 className 后设置正确状态
            el.className = "jhs-user-rating";
            el.innerHTML = "";

            if (rating && rating >= 1 && rating <= 5) {
                el.classList.add("is-rated");
                el.innerHTML = `<span class="jhs-rd-icon">★</span><span class="jhs-rd-num">${rating}</span>`;
                el.title = `已看 · ${rating}/5 星`;
            } else {
                el.classList.add("is-placeholder");
                el.textContent = "已看";
                el.title = "已看（未评分）";
            }
        },

        /** 移除单个卡片的标签 */
        removeFrom(item) {
            const el = item?.querySelector(".jhs-user-rating");
            if (el) el.remove();
            // 恢复被隐藏的原生 span
            const cover = item?.querySelector(".cover");
            if (cover) {
                cover.querySelectorAll(":scope > span").forEach((s) => {
                    if (
                        s.style.display === "none" &&
                        (s.classList.length === 0 || s.className === "score")
                    ) {
                        s.style.display = "";
                    }
                });
            }
        },
    };

    /* =========================================================================
     * 8. 主流程
     * ========================================================================= */
    const Core = {
        /** 已看番号集合 */
        watchedMap: new Map(),

        injectStyles() {
            GM_addStyle(`
                .jhs-user-rating {
                    position: absolute;
                    bottom: 6px;
                    right: 6px;
                    z-index: 5;
                    pointer-events: auto;
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1;
                    padding: 5px 10px;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.1) inset;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
                    color: #fff;
                    white-space: nowrap;
                    opacity: 0.95;
                    transition: transform 0.25s ease, opacity 0.2s ease, background 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    letter-spacing: 0.5px;
                }

                /* 占位（绿色） */
                .jhs-user-rating.is-placeholder {
                    background: linear-gradient(145deg, #48c78e, #2fb972);
                }

                /* 已评分（金色） */
                .jhs-user-rating.is-rated {
                    background: linear-gradient(145deg, #ffc107, #f57c00);
                }

                .jhs-rd-icon {
                    font-size: 14px;
                    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
                }

                .jhs-rd-num {
                    font-size: 14px;
                    font-weight: 900;
                }

                .jhs-user-rating:hover {
                    transform: scale(1.1);
                    opacity: 1;
                }

                /* 加载中 */
                .jhs-user-rating.is-loading {
                    animation: jhs-rd-pulse 1s infinite;
                    pointer-events: none;
                }

                @keyframes jhs-rd-pulse {
                    0%, 100% { opacity: 0.55; }
                    50% { opacity: 1; }
                }

                /* Toast */
                .jhs-rd-toast {
                    position: fixed;
                    left: 50%;
                    transform: translateX(-50%);
                    bottom: 2.5rem;
                    background: rgba(0, 0, 0, 0.88);
                    color: #fff;
                    padding: 0.5rem 0.9rem;
                    border-radius: 0.5rem;
                    z-index: 20000;
                    font-size: 0.85rem;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
                    animation: jhs-rd-toast-in 0.22s;
                    pointer-events: none;
                }

                @keyframes jhs-rd-toast-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `);
        },

        toast(msg) {
            document.querySelector(".jhs-rd-toast")?.remove();
            const div = document.createElement("div");
            div.className = "jhs-rd-toast";
            div.textContent = msg;
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 2500);
        },

        /**
         * 处理单个卡片——核心入口
         * - 命中已看集合 → 有缓存直接显示分值，无缓存显示占位
         * - 未命中 → 不处理
         */
        processItem(item) {
            if (!item || item.dataset.jhsrdProcessed === "true") return;
            item.dataset.jhsrdProcessed = "true";

            const code = Utils.getCode(item);
            if (!code) return;

            if (!this.watchedMap.has(code)) {
                // 不在已看列表 → 确保旧标签被移除
                Renderer.removeFrom(item);
                return;
            }

            // 缓存优先
            const cached = RatingCache.get(code);
            if (cached) {
                Renderer.showRating(item, cached.rating);
                item.dataset.jhsrdLoaded = "true";
                // 标记为「来自缓存」——init 后会清除 loaded 让首次悬停验证
                item.dataset.jhsrdFromCache = "true";
            } else {
                Renderer.showPlaceholder(item);
            }
        },

        /** 重新处理所有卡片（不清缓存） */
        refreshAll() {
            document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
                Renderer.removeFrom(item);
                item.dataset.jhsrdProcessed = "false";
                delete item.dataset.jhsrdLoaded;
                delete item.dataset.jhsrdFetching;
                delete item.dataset.jhsrdFromCache;
                this.processItem(item);
            });
        },

        /**
         * 清空当前页面所有卡片的评分缓存
         */
        clearPageCache() {
            const codes = new Set();
            document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
                const code = Utils.getCode(item);
                if (code) codes.add(code);
            });

            let cleared = 0;
            codes.forEach((code) => {
                if (RatingCache._data[code]) {
                    delete RatingCache._data[code];
                    cleared++;
                }
            });

            if (cleared > 0) RatingCache.save();

            // 重新处理当前页所有卡片
            document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
                Renderer.removeFrom(item);
                delete item.dataset.jhsrdLoaded;
                delete item.dataset.jhsrdFromCache;
                item.dataset.jhsrdProcessed = "false";
                this.processItem(item);
            });

            this.toast(
                `已清除 ${cleared} 个评分缓存，当前页 ${codes.size} 张卡片`,
            );
        },

        /**
         * 全量加载当前页面所有未评分的占位卡片
         */
        loadAll() {
            const targets = [];
            document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
                if (
                    item.dataset.jhsrdFetching !== "true" &&
                    item.dataset.jhsrdLoaded !== "true"
                ) {
                    targets.push(item);
                }
            });

            if (targets.length === 0) {
                this.toast("当前页面所有卡片已加载评分");
                return;
            }

            this.toast(`开始加载 ${targets.length} 个评分...`);
            targets.forEach((item) => {
                const tag = item.querySelector(".jhs-user-rating");
                if (tag) tag.classList.add("is-loading");
                fetchRating(item).finally(() => {
                    if (tag) tag.classList.remove("is-loading");
                });
            });
        },

        /**
         * 清除指定番号缓存并重处理对应卡片（用于 jhs 同步后实时刷新）。
         * 根据 status/op 直接更新 watchedMap，无需重读整个 car_list：
         *   - hasWatch + add → 加入 watchedMap
         *   - favorite + add / 任意 remove → 移出 watchedMap
         * 遍历所有卡片用 Utils.getCode 匹配番号。
         */
        _invalidateCards(code, status, op) {
            // 直接用广播信息更新 watchedMap 快照
            if (status === "hasWatch" && op === "add") {
                if (!this.watchedMap.has(code)) {
                    this.watchedMap.set(code, {
                        carNum: code,
                        status: "hasWatch",
                    });
                }
            } else {
                this.watchedMap.delete(code);
            }
            // 清评分缓存 + 重处理卡片
            delete RatingCache._data[code];
            RatingCache.save();
            document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
                if (Utils.getCode(item) === code) {
                    Renderer.removeFrom(item);
                    delete item.dataset.jhsrdLoaded;
                    delete item.dataset.jhsrdFromCache;
                    item.dataset.jhsrdProcessed = "false";
                    this.processItem(item);
                }
            });
            this._dirty = true;
            const cur = localStorage.getItem("jdb:want-watched-sync");
            if (cur) localStorage.setItem("jhsrd:last-sync-digest", cur);
        },

        async init() {
            await RatingCache.load();
            this.injectStyles();

            // ---- 启动时检测 jhs 同步事件（解决同一标签页页面导航后缓存失效） -------
            const syncVal = localStorage.getItem("jdb:want-watched-sync");
            const lastDigest = localStorage.getItem("jhsrd:last-sync-digest");
            if (syncVal && syncVal !== lastDigest) {
                Utils.log("INIT_SYNC", "jhs 有新的同步事件，全量清空评分缓存");
                RatingCache.clear();
                this._dirty = true;
                localStorage.setItem("jhsrd:last-sync-digest", syncVal);
            }

            this.watchedMap = await JhsDB.buildWatchedMap();

            // 首屏处理
            document
                .querySelectorAll(CONFIG.ITEM_SELECTOR)
                .forEach((i) => this.processItem(i));

            // 评分修改不触发 jhs 广播——对缓存命中的项取消 loaded，
            // 首次悬停自动重新抓取以验证评分是否变化
            document
                .querySelectorAll(".jhs-user-rating.is-rated")
                .forEach((el) => {
                    const item = el.closest(CONFIG.ITEM_SELECTOR);
                    if (item && item.dataset.jhsrdFromCache === "true") {
                        delete item.dataset.jhsrdLoaded;
                        delete item.dataset.jhsrdFromCache;
                    }
                });

            // ---- MutationObserver：实时刷新（监听 jhs 异步注入 status-tag 及新卡片） ----
            const pending = new Set();
            const flushPending = Utils.debounce(() => {
                pending.forEach((i) => this.processItem(i));
                pending.clear();
            }, 150);

            new MutationObserver((muts) => {
                for (const m of muts) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType !== 1) continue;
                        if (n.matches?.(CONFIG.ITEM_SELECTOR)) pending.add(n);
                        const found = n.querySelectorAll?.(
                            CONFIG.ITEM_SELECTOR,
                        );
                        if (found && found.length)
                            found.forEach((t) => pending.add(t));
                    }

                    // status-tag 变动（jhs 异步注入后卡片状态变化）→ 刷新
                    if (m.target.closest?.(".tags.has-addons")) {
                        const item = m.target.closest?.(CONFIG.ITEM_SELECTOR);
                        if (item) {
                            item.dataset.jhsrdProcessed = "false";
                            this.processItem(item);
                        }
                    }
                }
                flushPending();
            }).observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class"],
            });

            // ---- 悬停整个 .item 500ms → 懒加载评分 ----
            let hoverTimer = null;
            let hoveredItem = null;

            document.body.addEventListener("pointerover", (e) => {
                const item = e.target.closest?.(CONFIG.ITEM_SELECTOR);
                if (!item || item === hoveredItem) return;
                hoveredItem = item;

                // 如果已加载过，跳过
                if (item.dataset.jhsrdLoaded === "true") return;
                // 仅处理有占位标签、尚未加载的
                const tag = item.querySelector(
                    ".jhs-user-rating.is-placeholder",
                );
                if (!tag) return;

                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => {
                    if (hoveredItem !== item) return;
                    tag.classList.add("is-loading");
                    fetchRating(item).finally(() => {
                        tag.classList.remove("is-loading");
                    });
                }, CONFIG.HOVER_DELAY);
            });

            document.body.addEventListener("pointerout", (e) => {
                const item = e.target.closest?.(CONFIG.ITEM_SELECTOR);
                if (!item || item !== hoveredItem) return;
                hoveredItem = null;
                clearTimeout(hoverTimer);
                // 移除 loading 状态
                const tag = item.querySelector(".jhs-user-rating.is-loading");
                if (tag) tag.classList.remove("is-loading");
            });

            // ---- 菜单 ----------------
            GM_registerMenuCommand("全量加载当前页评分", () => {
                this.loadAll();
            });

            GM_registerMenuCommand("清空当前页评分缓存", () => {
                this.clearPageCache();
            });

            GM_registerMenuCommand("清空所有评分缓存", () => {
                RatingCache.clear();
                this.refreshAll();
                this.toast("所有评分缓存已清空");
            });

            GM_registerMenuCommand("刷新已看列表", async () => {
                this.watchedMap = await JhsDB.buildWatchedMap();
                this.refreshAll();
                this.toast(
                    `已看: ${this.watchedMap.size} 项 · 缓存: ${RatingCache.size()} 条`,
                );
            });

            // ---- 实时刷新：同标签页 jhs CustomEvent ----------------
            document.addEventListener(
                "jdb:want-watched-sync",
                (e) => {
                    const { carNum, status, op } = e.detail || {};
                    if (!carNum || !status || !op) return;
                    const code = Utils.normalizeCode(carNum);
                    Utils.log("SYNC_EVENT", code, status, op);
                    this._invalidateCards(code, status, op);
                },
                { passive: true },
            );

            // ---- 实时刷新：跨标签页 localStorage 事件 ----------------
            window.addEventListener("storage", (e) => {
                if (e.key === "jdb:want-watched-sync" && e.newValue) {
                    try {
                        const payload = JSON.parse(e.newValue);
                        if (
                            payload &&
                            payload.carNum &&
                            payload.status &&
                            payload.op
                        ) {
                            const code = Utils.normalizeCode(payload.carNum);
                            Utils.log(
                                "STORAGE_SYNC",
                                "跨标签页精确刷新",
                                code,
                                payload.status,
                                payload.op,
                            );
                            this._invalidateCards(
                                code,
                                payload.status,
                                payload.op,
                            );
                        }
                    } catch (_) {
                        this._dirty = true;
                    }
                }
            });

            // ---- 实时刷新：页面重新可见时兜底 -------------------------
            document.addEventListener(
                "visibilitychange",
                () => {
                    if (document.hidden) return;
                    // 跨标签页修改评分后切回 → 标记为待验证
                    document
                        .querySelectorAll(".jhs-user-rating.is-rated")
                        .forEach((el) => {
                            const item = el.closest(CONFIG.ITEM_SELECTOR);
                            if (item) item.dataset.jhsrdLoaded = "false";
                        });
                    if (this._dirty) {
                        this._dirty = false;
                        this.refreshAll();
                    }
                },
                { passive: true },
            );

            Utils.log(
                "INIT",
                `已看 ${this.watchedMap.size} · 缓存 ${RatingCache.size()}`,
            );
        },
    };

    /* =========================================================================
     * 9. 入口
     * ========================================================================= */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => Core.init());
    } else {
        Core.init();
    }
})();
