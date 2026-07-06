// ==UserScript==
// @name         JavDB 清单阅读进度
// @version      1.5
// @description  为我的清单页面和清单详情页添加阅读进度下拉框和星级评分（1-5星），数据双向实时同步，寄生 jhs IndexedDB 实现跨浏览器备份恢复；清单列表页提供排序与筛选工具栏
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/users/favorite_lists*
// @include      https://javdb*.com/users/lists*
// @include      https://javdb*.com/lists/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    const LOG_PREFIX = "[listReadingStatus]";
    const STORAGE_KEY = "jdb:list-reading-status";
    const RATING_STORAGE_KEY = "jdb:list-rating";

    // 防重入标志：防止 DOM 修改触发的 MutationObserver 回调导致无限循环
    let isProcessing = false;

    /**
     * 获取评分映射表
     * @returns {Object<string, number>} listId → 评分(1-5)
     */
    function getRatingMap() {
        const raw = GM_getValue(RATING_STORAGE_KEY);
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    /**
     * 持久化评分映射表
     * @param {Object<string, number>} map
     */
    function saveRatingMap(map) {
        GM_setValue(RATING_STORAGE_KEY, JSON.stringify(map));
        syncToIndexedDB();
    }

    /**
     * 设置清单评分
     * @param {string} listId
     * @param {number} rating - 1-5，0 表示清除评分
     */
    function setRating(listId, rating) {
        const map = getRatingMap();
        if (rating > 0) {
            map[listId] = rating;
        } else {
            delete map[listId];
        }
        saveRatingMap(map);
        console.log(`${LOG_PREFIX} 评分 ${listId}: ${rating || "清除"}`);
    }

    /**
     * 获取清单评分
     * @param {string} listId
     * @returns {number} 1-5，0 表示未评分
     */
    function getRating(listId) {
        return getRatingMap()[listId] || 0;
    }

    // ---------- 清单最近访问记录 ----------

    const LAST_URI_KEY = "jdb:list-last-uri";

    /**
     * 获取最近访问记录映射表
     * @returns {Object<string, {path:string, timestamp:number}>}
     */
    function getLastUriMap() {
        const raw = GM_getValue(LAST_URI_KEY);
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    /**
     * 保存当前页面 URI 作为清单的最后访问记录
     * @param {string} listId
     */
    function saveLastUri(listId) {
        const map = getLastUriMap();
        map[listId] = {
            path: location.pathname + location.search,
            timestamp: Date.now(),
        };
        GM_setValue(LAST_URI_KEY, JSON.stringify(map));
        syncToIndexedDB();
    }

    /**
     * 获取清单的最后访问 URI
     * @param {string} listId
     * @returns {{path:string, timestamp:number}|null}
     */
    function getLastUri(listId) {
        return getLastUriMap()[listId] || null;
    }

    // ---------- 云端备份（寄生 jhs 的 IndexedDB：换浏览器后可随 jhs 备份恢复）----------

    const JHS_DB_NAME = "JAV-JHS";
    const JHS_STORE_NAME = "appData";
    const BACKUP_KEY = "listReadingStatus_data";

    /**
     * 打开 jhs 的 IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    function openJhsDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(JHS_DB_NAME);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(JHS_STORE_NAME)) {
                    db.createObjectStore(JHS_STORE_NAME);
                }
            };
        });
    }

    /**
     * 将当前阅读状态和评分写入 IndexedDB（寄生到 jhs 备份通道）
     */
    function syncToIndexedDB() {
        try {
            const data = {
                readingStatus: [...getReadSet()],
                ratings: getRatingMap(),
                lastUris: getLastUriMap(),
                _updatedAt: new Date().toISOString(),
            };
            openJhsDB()
                .then((db) => {
                    const tx = db.transaction(JHS_STORE_NAME, "readwrite");
                    const store = tx.objectStore(JHS_STORE_NAME);
                    store.put(data, BACKUP_KEY);
                    tx.oncomplete = () => db.close();
                    tx.onerror = () => db.close();
                })
                .catch(() => {});
        } catch {
            // 静默失败，IndexedDB 不可用不影响核心功能
        }
    }

    /**
     * 从 IndexedDB 合并恢复数据
     *
     * 采用逐字段合并策略，而非「全有或全无」短路：
     * - readingStatus：本地与云端取并集（已读完状态不应被覆盖）
     * - ratings：云端补缺，本地已有的评分保留（本地优先，避免覆盖新评分）
     * - lastUris：按 timestamp 取更大者（保留更晚的访问记录）
     *
     * 换浏览器从 jhs 备份恢复后，本地已有的数据不会丢失，
     * 云端有而本地缺失的条目也能逐项补齐。不再因为本地存在任意一条数据
     * 就整体跳过恢复，否则会导致「IndexedDB 里 list-xxx 评分=5，
     * 但页面始终显示 0 星」这类问题。
     *
     * @returns {Promise<boolean>} 是否合并了新数据
     */
    async function restoreFromIndexedDB() {
        try {
            const db = await openJhsDB();
            const tx = db.transaction(JHS_STORE_NAME, "readonly");
            const store = tx.objectStore(JHS_STORE_NAME);
            const data = await new Promise((resolve, reject) => {
                const req = store.get(BACKUP_KEY);
                req.onsuccess = () => resolve(req.result);
                req.onerror = reject;
            });
            db.close();

            if (!data || !data.readingStatus) return false;

            let restored = false;

            // 1. readingStatus：取并集（已读完状态合并）
            const localReadSet = getReadSet();
            const cloudRead = Array.isArray(data.readingStatus)
                ? data.readingStatus
                : [];
            const mergedRead = new Set([...localReadSet, ...cloudRead]);
            if (mergedRead.size > localReadSet.size) {
                GM_setValue(STORAGE_KEY, JSON.stringify([...mergedRead]));
                restored = true;
            }

            // 2. ratings：云端补缺（本地优先，避免覆盖本地新评分）
            const localRatings = getRatingMap();
            const cloudRatings =
                data.ratings && typeof data.ratings === "object"
                    ? data.ratings
                    : {};
            let ratingChanged = false;
            for (const [id, rating] of Object.entries(cloudRatings)) {
                if (!(id in localRatings)) {
                    localRatings[id] = rating;
                    ratingChanged = true;
                }
            }
            if (ratingChanged) {
                GM_setValue(RATING_STORAGE_KEY, JSON.stringify(localRatings));
                restored = true;
            }

            // 3. lastUris：按 timestamp 取更大者（保留更晚的访问记录）
            const localLastUris = getLastUriMap();
            const cloudLastUris =
                data.lastUris && typeof data.lastUris === "object"
                    ? data.lastUris
                    : {};
            let lastUriChanged = false;
            for (const [id, uri] of Object.entries(cloudLastUris)) {
                const local = localLastUris[id];
                if (
                    !local ||
                    (uri.timestamp && uri.timestamp > (local.timestamp || 0))
                ) {
                    localLastUris[id] = uri;
                    lastUriChanged = true;
                }
            }
            if (lastUriChanged) {
                GM_setValue(LAST_URI_KEY, JSON.stringify(localLastUris));
                restored = true;
            }

            if (restored) {
                console.log(
                    `${LOG_PREFIX} 已从云端合并恢复数据 (更新于 ${data._updatedAt || "未知"})`,
                );
            }
            return restored;
        } catch {
            return false;
        }
    }

    // ---------- 样式 ----------

    GM_addStyle(`
        .list-reading-dropdown {
            appearance: none;
            -webkit-appearance: none;
            display: inline-flex;
            align-items: center;
            height: 24px;
            padding: 0 24px 0 10px;
            font-size: 0.72rem;
            font-weight: 600;
            line-height: 22px;
            border-radius: 50rem;
            cursor: pointer;
            user-select: none;
            border: 1.5px solid #ced4da;
            color: #6c757d;
            background-color: #fff;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236c757d'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 10px 6px;
            transition: all 0.2s ease;
            margin-right: 6px;
            vertical-align: middle;
        }
        .list-reading-dropdown:hover {
            border-color: #adb5bd;
            background-color: #f8f9fa;
        }
        /* 已读完状态 */
        .list-reading-dropdown[data-status="read"] {
            color: #fff;
            background-color: #198754;
            border-color: #198754;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23fff'/%3E%3C/svg%3E");
        }
        .list-reading-dropdown[data-status="read"]:hover {
            background-color: #157347;
            border-color: #157347;
        }
    `);

    GM_addStyle(`
        .list-rating-stars {
            display: inline-flex;
            gap: 2px;
            cursor: pointer;
            user-select: none;
            margin-right: 10px;
            vertical-align: middle;
            align-items: center;
        }
        .list-rating-star {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                        filter 0.2s ease;
        }
        .list-rating-star path {
            fill: #cbd5e1;
            stroke: #94a3b8;
            stroke-width: 0.6;
            transition: fill 0.2s ease, stroke 0.2s ease;
        }
        .list-rating-star.filled path {
            fill: #f59e0b;
            stroke: #d97706;
        }
        .list-rating-star:hover {
            transform: scale(1.25);
        }
        .list-rating-star.filled:hover {
            filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.45));
        }
        .list-last-uri-link {
            font-size: 0.72rem;
            color: #485fc7;
            margin-left: 8px;
            text-decoration: none;
            transition: color 0.15s ease;
        }
        .list-last-uri-link:hover {
            color: #363636;
            text-decoration: underline;
        }
    `);

    // ---------- 排序与筛选样式 ----------

    GM_addStyle(`
        .list-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px 16px;
            padding: 10px 0;
            margin-bottom: 6px;
            border-bottom: 1px solid #e9ecef;
            font-size: 0.82rem;
        }
        .list-toolbar-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .list-toolbar-label {
            font-weight: 600;
            color: #6c757d;
            flex-shrink: 0;
        }
        .list-sort-select {
            appearance: none;
            -webkit-appearance: none;
            height: 26px;
            padding: 0 22px 0 10px;
            font-size: 0.78rem;
            font-weight: 600;
            border: 1.5px solid #ced4da;
            border-radius: 50rem;
            color: #495057;
            background-color: #fff;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236c757d'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 10px 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .list-sort-select:hover {
            border-color: #adb5bd;
            background-color: #f8f9fa;
        }
        .list-filter-chip {
            display: inline-flex;
            align-items: center;
            padding: 2px 10px;
            font-size: 0.76rem;
            font-weight: 600;
            border: 1.5px solid #dee2e6;
            border-radius: 50rem;
            color: #6c757d;
            background-color: #fff;
            cursor: pointer;
            user-select: none;
            transition: all 0.15s ease;
            line-height: 1.4;
        }
        .list-filter-chip:hover {
            border-color: #adb5bd;
            background-color: #f8f9fa;
        }
        .list-filter-chip.active {
            color: #fff;
            background-color: #485fc7;
            border-color: #485fc7;
        }
        .list-filter-chip .chip-count {
            margin-left: 4px;
            opacity: 0.85;
            font-weight: 700;
        }
        .list-filter-divider {
            width: 1px;
            height: 18px;
            background: #dee2e6;
            margin: 0 4px;
            flex-shrink: 0;
        }
        .list-toolbar-reset {
            font-size: 0.74rem;
            color: #adb5bd;
            cursor: pointer;
            text-decoration: none;
            margin-left: auto;
            transition: color 0.15s ease;
        }
        .list-toolbar-reset:hover {
            color: #6c757d;
            text-decoration: underline;
        }
    `);

    // ---------- 数据层 ----------

    /**
     * 获取已标记为"已读完"的清单 ID 集合
     * @returns {Set<string>} 已读完的清单 ID 集合
     */
    function getReadSet() {
        const raw = GM_getValue(STORAGE_KEY);
        if (!raw) return new Set();
        try {
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr : []);
        } catch {
            return new Set();
        }
    }

    /**
     * 持久化已读完的清单 ID 集合
     * @param {Set<string>} readSet
     */
    function saveReadSet(readSet) {
        GM_setValue(STORAGE_KEY, JSON.stringify([...readSet]));
        syncToIndexedDB();
    }

    /**
     * 将某个清单标记为已读完
     * @param {string} listId
     */
    function markAsRead(listId) {
        const readSet = getReadSet();
        readSet.add(listId);
        saveReadSet(readSet);
        console.log(`${LOG_PREFIX} 已标记已读完: ${listId}`);
    }

    /**
     * 将某个清单取消已读完标记
     * @param {string} listId
     */
    function markAsUnread(listId) {
        const readSet = getReadSet();
        readSet.delete(listId);
        saveReadSet(readSet);
        console.log(`${LOG_PREFIX} 已取消标记: ${listId}`);
    }

    /**
     * 判断某个清单是否已读完
     * @param {string} listId
     * @returns {boolean}
     */
    function isRead(listId) {
        return getReadSet().has(listId);
    }

    // ---------- UI 层 ----------

    /**
     * 更新下拉框的数据状态属性，触发 CSS 样式切换
     * @param {HTMLSelectElement} select
     */
    function updateSelectAppearance(select) {
        select.setAttribute("data-status", select.value);
    }

    /**
     * 更新星级评分的外观（填充/清空星星）
     * @param {HTMLElement} starsEl - .list-rating-stars 容器
     * @param {number} rating - 当前评分 0-5
     */
    function renderStars(starsEl, rating) {
        const svgs = starsEl.querySelectorAll(".list-rating-star");
        svgs.forEach((svg, i) => {
            if (i < rating) {
                svg.classList.add("filled");
            } else {
                svg.classList.remove("filled");
            }
        });
    }

    const STAR_PATH =
        "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

    /**
     * 创建星级评分组件（SVG 五角星）
     * @param {string} listId - 清单 ID
     * @returns {HTMLElement} .list-rating-stars 容器
     */
    function createStarWidget(listId) {
        const container = document.createElement("span");
        container.className = "list-rating-stars";
        container.title = "评分 1-5 星，再次点击取消评分";

        const currentRating = getRating(listId);
        const NS = "http://www.w3.org/2000/svg";

        for (let i = 1; i <= 5; i++) {
            const svg = document.createElementNS(NS, "svg");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.classList.add("list-rating-star");
            svg.dataset.rating = i;

            const path = document.createElementNS(NS, "path");
            path.setAttribute("d", STAR_PATH);
            svg.appendChild(path);

            if (i <= currentRating) {
                svg.classList.add("filled");
            }

            svg.addEventListener("click", (e) => {
                e.stopPropagation();
                const clicked = parseInt(svg.dataset.rating);
                const current = getRating(listId);
                // 点击已选中的星则取消评分
                const newRating = clicked === current ? 0 : clicked;
                setRating(listId, newRating);
                renderStars(container, newRating);
            });

            svg.addEventListener("mouseenter", () => {
                renderStars(container, parseInt(svg.dataset.rating));
            });

            container.appendChild(svg);
        }

        container.addEventListener("mouseleave", () => {
            renderStars(container, getRating(listId));
        });

        return container;
    }

    /**
     * 创建阅读进度下拉框元素
     * @param {string} listId - 清单 ID
     * @returns {HTMLSelectElement}
     */
    function createDropdown(listId) {
        const select = document.createElement("select");
        select.className = "list-reading-dropdown";

        const optionUnread = document.createElement("option");
        optionUnread.value = "unread";
        optionUnread.textContent = "未读完";

        const optionRead = document.createElement("option");
        optionRead.value = "read";
        optionRead.textContent = "已读完";

        select.appendChild(optionUnread);
        select.appendChild(optionRead);

        // 设置当前状态
        select.value = isRead(listId) ? "read" : "unread";
        updateSelectAppearance(select);

        // 监听变更
        select.addEventListener("change", () => {
            if (select.value === "read") {
                markAsRead(listId);
            } else {
                markAsUnread(listId);
            }
            updateSelectAppearance(select);
        });

        return select;
    }

    /**
     * 为单个 li 元素注入/更新阅读进度下拉框和星级评分
     * @param {HTMLElement} li - 清单项 li 元素
     */
    function ensureWidgets(li) {
        const listId = li.id;
        if (!listId) return;

        // 查找 li 下的第一个 div 容器
        const container = li.querySelector(":scope > div");
        if (!container) return;

        // 下拉框：更新或创建
        let select = container.querySelector(".list-reading-dropdown");
        if (select) {
            select.value = isRead(listId) ? "read" : "unread";
            updateSelectAppearance(select);
        } else {
            select = createDropdown(listId);
            container.prepend(select);
        }

        // 星级评分：更新或创建
        let stars = container.querySelector(".list-rating-stars");
        if (stars) {
            renderStars(stars, getRating(listId));
        } else {
            stars = createStarWidget(listId);
            container.prepend(stars);
        }

        // 最后访问链接：若有记录则在 div 尾部显示「继续浏览 →」
        let uriLink = container.querySelector(".list-last-uri-link");
        const lastUri = getLastUri(listId);
        if (lastUri) {
            if (!uriLink) {
                uriLink = document.createElement("a");
                uriLink.className = "list-last-uri-link";
                const d = new Date(lastUri.timestamp);
                const pad = (n) => String(n).padStart(2, "0");
                const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                const search = lastUri.path.includes("?")
                    ? " " + lastUri.path.slice(lastUri.path.indexOf("?") + 1)
                    : "";
                uriLink.textContent = `继续浏览 →${search} (${dateStr})`;
                " (" + dateStr + ")";
                container.appendChild(uriLink);
            }
            uriLink.href = lastUri.path;
        } else {
            if (uriLink) uriLink.remove();
        }
    }

    /**
     * 在清单详情页标题中注入/更新阅读进度下拉框和星级评分
     * 从 URL 提取清单 ID（/lists/27nKN → list-27nKN），
     * 挂载到 h2 标题元素的首位
     */
    function ensureHeaderWidgets() {
        if (isProcessing) return;
        isProcessing = true;

        const m = location.pathname.match(/\/lists\/([^/]+)$/);
        if (!m) {
            isProcessing = false;
            return;
        }
        const listId = "list-" + m[1];

        // 保存清单的最后访问 URI（用于收藏清单页的「继续浏览」链接）
        saveLastUri(listId);

        const h2 = document.querySelector(
            "body > section > div > div.columns.is-mobile.section-columns > div > h2",
        );
        if (!h2) {
            isProcessing = false;
            return;
        }

        // 下拉框：更新或创建
        let select = h2.querySelector(".list-reading-dropdown");
        if (select) {
            select.value = isRead(listId) ? "read" : "unread";
            updateSelectAppearance(select);
        } else {
            select = createDropdown(listId);
            h2.prepend(select);
        }

        // 星级评分：更新或创建
        let stars = h2.querySelector(".list-rating-stars");
        if (stars) {
            renderStars(stars, getRating(listId));
        } else {
            stars = createStarWidget(listId);
            h2.prepend(stars);
        }

        // 延迟复位：等本轮 MutationObserver 微任务执行完毕后再释放
        Promise.resolve().then(() => {
            isProcessing = false;
        });
    }

    /**
     * 遍历 #lists > ul 下的所有 li 并注入/更新下拉框和星级评分
     * @returns {boolean} 是否成功找到容器并执行
     */
    function processAllItems() {
        if (isProcessing) return;
        isProcessing = true;

        const ul = document.querySelector("#lists > ul");
        if (!ul) {
            isProcessing = false;
            return false;
        }

        const items = ul.querySelectorAll(":scope > li");
        items.forEach((li) => ensureWidgets(li));

        // 应用排序与筛选（在 isProcessing 守卫内重排，避免触发 observer 循环）
        applySortAndFilter();

        // 延迟复位：等本轮 MutationObserver 微任务执行完毕后再释放
        Promise.resolve().then(() => {
            isProcessing = false;
        });

        return items.length > 0;
    }

    // ---------- 排序与筛选层 ----------

    // 排序/筛选状态持久化 key
    const SORT_KEY = "jdb:list-sort";
    const FILTER_READ_KEY = "jdb:list-filter-read";
    const FILTER_RATING_KEY = "jdb:list-filter-rating";

    // 本脚本隐藏标记（协同安全：与 statusTagFilter 的 data-status-tag-hidden 等互不干扰）
    const LRS_HIDDEN_ATTR = "data-lrs-hidden";
    // 原始顺序索引（排序 tiebreaker，保证排序稳定）
    const LRS_ORDER_ATTR = "data-lrs-order";
    let orderCounter = 0;

    // 当前排序与筛选状态
    let currentSort = "default"; // default | rating-desc | rating-asc | movies-desc | movies-asc | clicks-desc | clicks-asc | visited-desc | visited-asc | title-asc
    let filterReadStatus = "all"; // all | read | unread
    let filterRatingChips = new Set(); // rated | unrated | rating-1..rating-5

    // 工具栏防重入标志：避免排序重排触发 MutationObserver 循环
    let isToolbarProcessing = false;

    /**
     * 从 GM 存储加载排序与筛选状态
     */
    function loadToolbarState() {
        const s = GM_getValue(SORT_KEY);
        if (s) currentSort = s;
        const r = GM_getValue(FILTER_READ_KEY);
        if (r === "read" || r === "unread") filterReadStatus = r;
        const rc = GM_getValue(FILTER_RATING_KEY);
        if (rc) {
            try {
                const arr = JSON.parse(rc);
                if (Array.isArray(arr)) filterRatingChips = new Set(arr);
            } catch {
                filterRatingChips = new Set();
            }
        }
    }

    /**
     * 持久化排序状态
     * @param {string} v
     */
    function saveSortState(v) {
        currentSort = v;
        GM_setValue(SORT_KEY, v);
    }

    /**
     * 持久化阅读状态筛选
     * @param {string} v
     */
    function saveFilterReadState(v) {
        filterReadStatus = v;
        GM_setValue(FILTER_READ_KEY, v);
    }

    /**
     * 持久化评分筛选芯片集合
     * @param {Set<string>} set
     */
    function saveFilterRatingState(set) {
        filterRatingChips = set;
        GM_setValue(FILTER_RATING_KEY, JSON.stringify([...set]));
    }

    /**
     * 从 li 提取排序/筛选所需的元数据
     * @param {HTMLElement} li
     * @returns {{listId:string,title:string,movies:number,clicks:number,rating:number,visited:number,order:number}}
     */
    function getListMeta(li) {
        const listId = li.id || "";
        const titleEl = li.querySelector("a[href*='/lists/']");
        const title = titleEl ? titleEl.textContent.trim() : "";
        const metaTxt = li.querySelector(".meta")?.textContent ?? "";
        const moviesMatch = metaTxt.match(/([\d,]+)\s*部影片/);
        const clicksMatch = metaTxt.match(/點擊了\s*([\d,]+)/);
        return {
            listId,
            title,
            movies: moviesMatch
                ? parseInt(moviesMatch[1].replace(/,/g, ""))
                : 0,
            clicks: clicksMatch
                ? parseInt(clicksMatch[1].replace(/,/g, ""))
                : 0,
            rating: getRating(listId),
            visited: getLastUri(listId)?.timestamp ?? 0,
            order: parseInt(li.getAttribute(LRS_ORDER_ATTR) || "0") || 0,
        };
    }

    /**
     * 为 li 分配原始顺序索引（首次访问时），用于排序稳定 tiebreaker
     * @param {HTMLElement} li
     */
    function ensureLiOrder(li) {
        if (!li.hasAttribute(LRS_ORDER_ATTR)) {
            li.setAttribute(LRS_ORDER_ATTR, String(orderCounter++));
        }
    }

    /**
     * 比较两个 li（按 currentSort），相同则按原始顺序 tiebreaker
     * @param {HTMLElement} a
     * @param {HTMLElement} b
     * @returns {number}
     */
    function compareLi(a, b) {
        const ma = getListMeta(a);
        const mb = getListMeta(b);
        let cmp = 0;
        switch (currentSort) {
            case "rating-desc":
                cmp = mb.rating - ma.rating;
                break;
            case "rating-asc":
                cmp = ma.rating - mb.rating;
                break;
            case "movies-desc":
                cmp = mb.movies - ma.movies;
                break;
            case "movies-asc":
                cmp = ma.movies - mb.movies;
                break;
            case "clicks-desc":
                cmp = mb.clicks - ma.clicks;
                break;
            case "clicks-asc":
                cmp = ma.clicks - mb.clicks;
                break;
            case "visited-desc":
                cmp = mb.visited - ma.visited;
                break;
            case "visited-asc":
                cmp = ma.visited - mb.visited;
                break;
            case "title-asc":
                cmp = ma.title.localeCompare(mb.title, "zh");
                break;
            default:
                cmp = 0;
        }
        if (cmp === 0) cmp = ma.order - mb.order;
        return cmp;
    }

    /**
     * 应用排序：按 currentSort 重排 #lists > ul 下的 li
     * 在 isProcessing 守卫内调用，避免重排触发 MutationObserver 循环
     */
    function applySort() {
        if (currentSort === "default") return;
        const ul = document.querySelector("#lists > ul");
        if (!ul) return;
        const lis = [...ul.querySelectorAll(":scope > li")];
        if (lis.length < 2) return;
        lis.forEach(ensureLiOrder);
        lis.sort(compareLi);
        // 仅在顺序实际变化时才重排，避免无变化 appendChild 触发 MutationObserver 循环
        const sortedIds = lis.map((li) => li.id).join(",");
        const currentIds = [...ul.querySelectorAll(":scope > li")].map((li) => li.id).join(",");
        if (sortedIds === currentIds) return;
        // 用 DocumentFragment 批量重排，减少回流
        const frag = document.createDocumentFragment();
        lis.forEach((li) => frag.appendChild(li));
        ul.appendChild(frag);
    }

    /**
     * 判断 li 是否匹配当前筛选条件
     * @param {HTMLElement} li
     * @returns {boolean}
     */
    function matchesFilter(li) {
        const listId = li.id;
        if (!listId) return true;

        // 阅读状态筛选（单选互斥）
        if (filterReadStatus !== "all") {
            const read = isRead(listId);
            if (filterReadStatus === "read" && !read) return false;
            if (filterReadStatus === "unread" && read) return false;
        }

        // 评分筛选（多选 OR）
        if (filterRatingChips.size > 0) {
            const rating = getRating(listId);
            let match = false;
            if (filterRatingChips.has("rated") && rating > 0) match = true;
            if (filterRatingChips.has("unrated") && rating === 0) match = true;
            for (let i = 1; i <= 5; i++) {
                if (filterRatingChips.has(`rating-${i}`) && rating === i) {
                    match = true;
                    break;
                }
            }
            if (!match) return false;
        }
        return true;
    }

    /**
     * 应用筛选：显示/隐藏 li
     * 协同安全：用 data-lrs-hidden 标记本脚本隐藏项，清空筛选时只恢复本脚本隐藏的，
     * 不触碰其他脚本（jhs 关键词屏蔽、statusTagFilter 等）已隐藏的卡片
     */
    function applyFilter() {
        const ul = document.querySelector("#lists > ul");
        if (!ul) return;
        const lis = ul.querySelectorAll(":scope > li");

        // 无任何筛选：仅恢复本脚本隐藏的卡片，不清除其他脚本的隐藏
        if (filterReadStatus === "all" && filterRatingChips.size === 0) {
            lis.forEach((li) => {
                if (li.hasAttribute(LRS_HIDDEN_ATTR)) {
                    li.removeAttribute(LRS_HIDDEN_ATTR);
                    li.style.display = "";
                }
            });
            return;
        }

        lis.forEach((li) => {
            // 协同安全：已被其他脚本隐藏的卡片不纳入管理
            const hiddenByOther =
                li.style.display === "none" &&
                !li.hasAttribute(LRS_HIDDEN_ATTR);
            if (hiddenByOther) return;

            if (matchesFilter(li)) {
                li.removeAttribute(LRS_HIDDEN_ATTR);
                li.style.display = "";
            } else {
                li.setAttribute(LRS_HIDDEN_ATTR, "");
                li.style.display = "none";
            }
        });
    }

    /**
     * 应用排序与筛选（顺序：先排序后筛选）
     */
    function applySortAndFilter() {
        if (isToolbarProcessing) return;
        isToolbarProcessing = true;
        try {
            applySort();
            applyFilter();
        } finally {
            isToolbarProcessing = false;
        }
    }

    /**
     * 统计各筛选分类的清单数
     * @returns {{read:number,unread:number,rated:number,unrated:number,stars:number[]}}
     */
    function countFilterStats() {
        const stats = {
            read: 0,
            unread: 0,
            rated: 0,
            unrated: 0,
            stars: [0, 0, 0, 0, 0],
        };
        const ul = document.querySelector("#lists > ul");
        if (!ul) return stats;
        ul.querySelectorAll(":scope > li").forEach((li) => {
            const id = li.id;
            if (!id) return;
            if (isRead(id)) stats.read++;
            else stats.unread++;
            const r = getRating(id);
            if (r > 0) {
                stats.rated++;
                if (r >= 1 && r <= 5) stats.stars[r - 1]++;
            } else {
                stats.unrated++;
            }
        });
        return stats;
    }

    /**
     * 创建单个筛选芯片
     * @param {string} label
     * @param {string} value
     * @param {number} count
     * @returns {HTMLSpanElement}
     */
    function createFilterChip(label, value, count) {
        const chip = document.createElement("span");
        chip.className = "list-filter-chip";
        chip.dataset.value = value;
        const labelText = document.createElement("span");
        labelText.textContent = label;
        chip.appendChild(labelText);
        const countSpan = document.createElement("span");
        countSpan.className = "chip-count";
        countSpan.textContent = count;
        chip.appendChild(countSpan);

        chip.addEventListener("click", () => {
            // 阅读状态芯片：单选互斥
            if (value === "read" || value === "unread") {
                const wasActive = chip.classList.contains("active");
                // 清除同组激活
                document
                    .querySelectorAll(
                        ".list-filter-chip[data-value='read'], .list-filter-chip[data-value='unread']",
                    )
                    .forEach((c) => c.classList.remove("active"));
                if (!wasActive) {
                    chip.classList.add("active");
                    saveFilterReadState(value);
                } else {
                    saveFilterReadState("all");
                }
            } else {
                // 评分芯片：多选 toggle
                chip.classList.toggle("active");
                const next = new Set(filterRatingChips);
                if (chip.classList.contains("active")) {
                    next.add(value);
                } else {
                    next.delete(value);
                }
                saveFilterRatingState(next);
            }
            applySortAndFilter();
        });

        return chip;
    }

    /**
     * 构建/刷新工具栏：挂载到 #lists 之前
     * @returns {HTMLElement|null} 工具栏元素
     */
    function buildToolbar() {
        if (isDetailPage) return null;
        const lists = document.querySelector("#lists");
        if (!lists) return null;
        if (document.querySelector(".list-toolbar")) {
            return document.querySelector(".list-toolbar");
        }

        const toolbar = document.createElement("div");
        toolbar.className = "list-toolbar";

        // 排序组
        const sortGroup = document.createElement("div");
        sortGroup.className = "list-toolbar-group";
        const sortLabel = document.createElement("span");
        sortLabel.className = "list-toolbar-label";
        sortLabel.textContent = "排序:";
        const sortSelect = document.createElement("select");
        sortSelect.className = "list-sort-select";
        const sortOptions = [
            ["default", "默认"],
            ["rating-desc", "评分 ↓"],
            ["rating-asc", "评分 ↑"],
            ["movies-desc", "影片数 ↓"],
            ["movies-asc", "影片数 ↑"],
            ["clicks-desc", "点击数 ↓"],
            ["clicks-asc", "点击数 ↑"],
            ["visited-desc", "最近访问 ↓"],
            ["visited-asc", "最久访问 ↓"],
            ["title-asc", "标题 A-Z"],
        ];
        sortOptions.forEach(([val, txt]) => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = txt;
            if (val === currentSort) opt.selected = true;
            sortSelect.appendChild(opt);
        });
        sortSelect.addEventListener("change", () => {
            saveSortState(sortSelect.value);
            applySortAndFilter();
        });
        sortGroup.appendChild(sortLabel);
        sortGroup.appendChild(sortSelect);
        toolbar.appendChild(sortGroup);

        // 分隔符
        const div1 = document.createElement("div");
        div1.className = "list-filter-divider";
        toolbar.appendChild(div1);

        // 阅读状态筛选组
        const readGroup = document.createElement("div");
        readGroup.className = "list-toolbar-group";
        const readLabel = document.createElement("span");
        readLabel.className = "list-toolbar-label";
        readLabel.textContent = "阅读:";
        readGroup.appendChild(readLabel);
        const readChipsHost = document.createElement("div");
        readGroup.appendChild(readChipsHost);
        toolbar.appendChild(readGroup);

        // 分隔符
        const div2 = document.createElement("div");
        div2.className = "list-filter-divider";
        toolbar.appendChild(div2);

        // 评分筛选组
        const ratingGroup = document.createElement("div");
        ratingGroup.className = "list-toolbar-group";
        const ratingLabel = document.createElement("span");
        ratingLabel.className = "list-toolbar-label";
        ratingLabel.textContent = "评分:";
        ratingGroup.appendChild(ratingLabel);
        const ratingChipsHost = document.createElement("div");
        ratingGroup.appendChild(ratingChipsHost);
        toolbar.appendChild(ratingGroup);

        // 重置按钮
        const reset = document.createElement("a");
        reset.className = "list-toolbar-reset";
        reset.textContent = "重置筛选";
        reset.addEventListener("click", (e) => {
            e.preventDefault();
            saveSortState("default");
            saveFilterReadState("all");
            saveFilterRatingState(new Set());
            // 同步 UI
            sortSelect.value = "default";
            toolbar
                .querySelectorAll(".list-filter-chip.active")
                .forEach((c) => c.classList.remove("active"));
            applySortAndFilter();
        });
        toolbar.appendChild(reset);

        // 插入到 #lists 之前
        lists.insertAdjacentElement("beforebegin", toolbar);

        // 保存芯片宿主引用，供 refreshChips 使用
        toolbar._readHost = readChipsHost;
        toolbar._ratingHost = ratingChipsHost;
        toolbar._sortSelect = sortSelect;

        // 初始构建芯片
        refreshChips(toolbar);

        console.log(`${LOG_PREFIX} 排序与筛选工具栏已挂载`);
        return toolbar;
    }

    /**
     * 刷新筛选芯片：重建阅读状态与评分芯片，保留当前激活状态，更新计数
     * @param {HTMLElement} toolbar
     */
    function refreshChips(toolbar) {
        if (!toolbar) return;
        const stats = countFilterStats();

        // 阅读状态芯片
        const readHost = toolbar._readHost;
        if (readHost) {
            readHost.innerHTML = "";
            const readChip = createFilterChip("已读完", "read", stats.read);
            if (filterReadStatus === "read") readChip.classList.add("active");
            readHost.appendChild(readChip);
            const unreadChip = createFilterChip(
                "未读完",
                "unread",
                stats.unread,
            );
            if (filterReadStatus === "unread")
                unreadChip.classList.add("active");
            readHost.appendChild(unreadChip);
        }

        // 评分芯片
        const ratingHost = toolbar._ratingHost;
        if (ratingHost) {
            ratingHost.innerHTML = "";
            const ratedChip = createFilterChip("有评分", "rated", stats.rated);
            if (filterRatingChips.has("rated"))
                ratedChip.classList.add("active");
            ratingHost.appendChild(ratedChip);
            const unratedChip = createFilterChip(
                "无评分",
                "unrated",
                stats.unrated,
            );
            if (filterRatingChips.has("unrated"))
                unratedChip.classList.add("active");
            ratingHost.appendChild(unratedChip);
            for (let i = 1; i <= 5; i++) {
                const starChip = createFilterChip(
                    `${i}星`,
                    `rating-${i}`,
                    stats.stars[i - 1],
                );
                if (filterRatingChips.has(`rating-${i}`))
                    starChip.classList.add("active");
                ratingHost.appendChild(starChip);
            }
        }
    }

    /**
     * 尝试构建工具栏并应用排序筛选（清单列表页）
     * @returns {boolean} 是否成功构建
     */
    function tryBuildToolbar() {
        if (isDetailPage) return false;
        const toolbar = buildToolbar();
        if (!toolbar) return false;
        refreshChips(toolbar);
        applySortAndFilter();
        return true;
    }

    /**
     * 从持久化状态恢复工具栏 UI（芯片激活态、排序下拉框选中态）
     */
    function restoreToolbarUI() {
        const toolbar = document.querySelector(".list-toolbar");
        if (!toolbar) return;
        if (toolbar._sortSelect) toolbar._sortSelect.value = currentSort;
        refreshChips(toolbar);
    }
    // ---------- 入口 ----------

    // 页面类型检测：清单详情页（/lists/{id}） vs 我的清单页（/users/favorite_lists）
    const isDetailPage = /\/lists\/[^/]+$/.test(location.pathname);

    // 加载排序/筛选持久化状态
    loadToolbarState();

    // 页面初始注入
    if (isDetailPage) {
        ensureHeaderWidgets();
    } else {
        processAllItems();
        tryBuildToolbar();
    }

    // 尝试从 jhs IndexedDB 恢复备份（换浏览器部署后可从 jhs 备份找回评分和阅读进度）
    // 恢复完成后手动刷新 UI，不依赖 GM_addValueChangeListener 的触发时机
    restoreFromIndexedDB().then((restored) => {
        if (restored) {
            if (isDetailPage) {
                ensureHeaderWidgets();
            } else {
                processAllItems();
                const tb = document.querySelector(".list-toolbar");
                if (tb) refreshChips(tb);
            }
        }
    });

    // MutationObserver：监听动态加载（如分页切换、listWaterfall 追加），带防重入守卫
    let lastLiCount = -1;
    const observer = new MutationObserver(() => {
        if (isProcessing) return;
        if (isDetailPage) {
            ensureHeaderWidgets();
        } else {
            processAllItems();
            // 仅在 li 数量变化时刷新芯片计数，避免每次重排都重建芯片触发循环
            const ul = document.querySelector("#lists > ul");
            const cnt = ul ? ul.querySelectorAll(":scope > li").length : 0;
            if (cnt !== lastLiCount) {
                lastLiCount = cnt;
                const tb = document.querySelector(".list-toolbar");
                if (tb) refreshChips(tb);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 跨标签页实时同步：监听阅读状态和评分的存储变更
    if (typeof GM_addValueChangeListener !== "undefined") {
        // 清单列表页刷新工具栏芯片计数的辅助
        const refreshListToolbar = () => {
            if (isDetailPage) return;
            const tb = document.querySelector(".list-toolbar");
            if (tb) refreshChips(tb);
        };
        // 阅读状态变更
        GM_addValueChangeListener(STORAGE_KEY, () => {
            if (isDetailPage) {
                ensureHeaderWidgets();
            } else {
                processAllItems();
                refreshListToolbar();
            }
        });
        // 评分变更
        GM_addValueChangeListener(RATING_STORAGE_KEY, () => {
            if (isDetailPage) {
                ensureHeaderWidgets();
            } else {
                processAllItems();
                refreshListToolbar();
            }
        });
        // 排序状态变更（跨标签页同步）
        GM_addValueChangeListener(SORT_KEY, () => {
            const v = GM_getValue(SORT_KEY);
            if (v) currentSort = v;
            if (isDetailPage) return;
            restoreToolbarUI();
            applySortAndFilter();
        });
        // 阅读状态筛选变更
        GM_addValueChangeListener(FILTER_READ_KEY, () => {
            const v = GM_getValue(FILTER_READ_KEY);
            if (v === "read" || v === "unread") filterReadStatus = v;
            else filterReadStatus = "all";
            if (isDetailPage) return;
            restoreToolbarUI();
            applySortAndFilter();
        });
        // 评分筛选变更
        GM_addValueChangeListener(FILTER_RATING_KEY, () => {
            const rc = GM_getValue(FILTER_RATING_KEY);
            try {
                const arr = JSON.parse(rc);
                filterRatingChips = new Set(Array.isArray(arr) ? arr : []);
            } catch {
                filterRatingChips = new Set();
            }
            if (isDetailPage) return;
            restoreToolbarUI();
            applySortAndFilter();
        });
    }
})();
