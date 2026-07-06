// ==UserScript==
// @name         视频清单标签
// @version      1.1
// @description  给视频预览属于那个清单
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    "use strict";

    console.log("[视频清单标签] 脚本已加载 v2 (精准刷新模式)");

    // ---------- 样式（Bootstrap Badge Pill 风格） ----------
    GM_addStyle(`
        .custom-tags-display {
            margin: 5px 0;
            padding: 6px;
            white-space: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 2px;
        }
        .custom-tags-display::-webkit-scrollbar {
            display: none;
        }
        .custom-tag-link {
            display: inline-block;
            padding: 0.35em 0.65em;
            margin-right: 6px;
            font-size: 0.75em;
            font-weight: 700;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 50rem;
            text-decoration: none;
            color: #fff;
            transition: filter 0.15s ease, transform 0.15s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .custom-tag-link:hover {
            filter: brightness(0.92);
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
        }
        .custom-tag-link.light-bg {
            color: #212529;  /* 浅色背景用深色文字 */
        }

        /* ---------- 标签筛选器 ---------- */
        .tag-filter-bar {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 8px 0 12px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .tag-filter-label {
            flex-shrink: 0;
            font-size: 0.8em;
            font-weight: 600;
            color: #6c757d;
            line-height: 1.8;
            margin-right: 4px;
        }
        .tag-filter-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .tag-filter-chip {
            display: inline-block;
            padding: 0.25em 0.7em;
            font-size: 0.75em;
            font-weight: 600;
            line-height: 1.5;
            border-radius: 50rem;
            cursor: pointer;
            user-select: none;
            border: 1.5px solid #dee2e6;
            background: #fff;
            color: #495057;
            transition: all 0.15s ease;
        }
        .tag-filter-chip:hover {
            border-color: #adb5bd;
            background: #f8f9fa;
        }
        .tag-filter-chip.active {
            background: #0d6efd;
            border-color: #0d6efd;
            color: #fff;
        }
        .tag-filter-chip.no-tag {
            border-style: dashed;
            color: #6c757d;
        }
        .tag-filter-chip.no-tag.active {
            background: #6c757d;
            border-color: #6c757d;
            border-style: solid;
            color: #fff;
        }

        /* ---------- 自动刷新开关 ---------- */
        .auto-refresh-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: auto;
            flex-shrink: 0;
            font-size: 0.78em;
            color: #6c757d;
            user-select: none;
        }
        .auto-refresh-switch {
            position: relative;
            width: 36px;
            height: 20px;
            flex-shrink: 0;
        }
        .auto-refresh-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .auto-refresh-slider {
            position: absolute;
            inset: 0;
            background: #ced4da;
            border-radius: 50rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        .auto-refresh-slider::before {
            content: "";
            position: absolute;
            left: 2px;
            top: 2px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff;
            transition: transform 0.2s;
        }
        .auto-refresh-switch input:checked + .auto-refresh-slider {
            background: #198754;
        }
        .auto-refresh-switch input:checked + .auto-refresh-slider::before {
            transform: translateX(16px);
        }

        /* ---------- 筛选模式下拉 ---------- */
        .filter-mode-dropdown {
            position: relative;
            display: inline-block;
            flex-shrink: 0;
        }
        .filter-mode-summary {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.25em 0.7em;
            font-size: 0.75em;
            font-weight: 600;
            line-height: 1.5;
            border-radius: 50rem;
            cursor: pointer;
            user-select: none;
            border: 1.5px solid #dee2e6;
            background: #fff;
            color: #495057;
            transition: all 0.15s ease;
            list-style: none;
        }
        .filter-mode-summary::-webkit-details-marker {
            display: none;
        }
        .filter-mode-summary:hover {
            border-color: #adb5bd;
            background: #f8f9fa;
        }
        .filter-mode-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .filter-mode-indicator.include {
            background: #0d6efd;
            box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.2);
        }
        .filter-mode-indicator.exclude {
            background: #dc3545;
            box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
        }
        .filter-mode-arrow {
            font-size: 0.7em;
            color: #adb5bd;
            transition: transform 0.2s;
        }
        .filter-mode-dropdown[open] .filter-mode-arrow {
            transform: rotate(180deg);
        }
        .filter-mode-panel {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            min-width: 190px;
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            padding: 4px 0;
            z-index: 1000;
            animation: filterModeIn 0.15s ease;
        }
        @keyframes filterModeIn {
            from {
                opacity: 0;
                transform: translateY(-4px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .filter-mode-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            font-size: 0.78em;
            font-weight: 500;
            color: #495057;
            cursor: pointer;
            transition: background 0.1s;
            white-space: nowrap;
        }
        .filter-mode-item:hover {
            background: #f8f9fa;
        }
        .filter-mode-item.selected {
            background: rgba(13, 110, 253, 0.08);
            color: #0d6efd;
            font-weight: 600;
        }
        .filter-mode-item.exclude.selected {
            background: rgba(220, 53, 69, 0.08);
            color: #dc3545;
        }
        .filter-mode-item .filter-mode-indicator {
            flex-shrink: 0;
        }
        .filter-mode-separator {
            height: 1px;
            margin: 4px 8px;
            background: #e9ecef;
        }
    `);

    // ---------- Bootstrap 标准颜色调色板 ----------
    const bootstrapColors = [
        { name: "primary", bg: "#0d6efd", text: "#fff" },
        { name: "secondary", bg: "#6c757d", text: "#fff" },
        { name: "success", bg: "#198754", text: "#fff" },
        { name: "danger", bg: "#dc3545", text: "#fff" },
        { name: "warning", bg: "#ffc107", text: "#212529" },
        { name: "info", bg: "#0dcaf0", text: "#212529" },
        { name: "dark", bg: "#212529", text: "#fff" },
    ];

    function getRandomBootstrapColor() {
        const color =
            bootstrapColors[Math.floor(Math.random() * bootstrapColors.length)];
        return {
            bg: color.bg,
            text: color.text,
            isLight: color.text !== "#fff", // 标记是否浅色背景
        };
    }

    // ---------- 标签数据（从 API 动态获取） ----------
    let mockTags = null;

    // ---------- 自动刷新（跨标签页联动） ----------
    const AUTO_REFRESH_KEY = "jdb:auto-refresh-enabled";
    const LAST_SYNC_KEY = "jdb:last-sync";
    let autoRefreshEnabled = true;

    // ---------- 筛选模式 ----------
    const FILTER_MODES = {
        CONTAINS_ANY: "contains-any", // 包含任意一个（默认）
        CONTAINS_ALL: "contains-all", // 全都包含
        EXCLUDES_ALL: "excludes-all", // 不包含以下标签
        EXCLUDES_ANY: "excludes-any", // 不包含以下任意一个
    };

    const FILTER_MODE_CONFIG = [
        {
            value: FILTER_MODES.CONTAINS_ANY,
            label: "包含任意一个",
            group: "include",
        },
        {
            value: FILTER_MODES.CONTAINS_ALL,
            label: "全都包含",
            group: "include",
        },
        {
            value: FILTER_MODES.EXCLUDES_ALL,
            label: "不包含以下标签",
            group: "exclude",
        },
        {
            value: FILTER_MODES.EXCLUDES_ANY,
            label: "不包含以下任意一个",
            group: "exclude",
        },
    ];

    let currentFilterMode = FILTER_MODES.CONTAINS_ANY;

    /** 从 GM 存储加载自动刷新开关状态 */
    function loadAutoRefreshState() {
        try {
            const val = GM_getValue(AUTO_REFRESH_KEY);
            if (val === undefined) {
                autoRefreshEnabled = true;
                console.log("[视频清单标签] 自动刷新: 未设置过 → 默认开启");
            } else {
                autoRefreshEnabled = val === true || val === "true";
                console.log(
                    `[视频清单标签] 自动刷新: 存储值 = ${autoRefreshEnabled} (原始=${JSON.stringify(val)})`,
                );
            }
        } catch (e) {
            autoRefreshEnabled = true;
            console.warn("[视频清单标签] 自动刷新: 读取异常 → 默认开启", e);
        }
    }

    /** 保存自动刷新开关状态 */
    function saveAutoRefreshState(enabled) {
        try {
            GM_setValue(AUTO_REFRESH_KEY, enabled);
        } catch (_) {}
    }

    /** 重新拉取标签并刷新所有卡片 */
    async function refreshAllTags() {
        const items = document.querySelectorAll(".item");
        const lists = Array.from(items)
            .map((item) => {
                const strong = item.querySelector(
                    "a > div.video-title > strong",
                );
                return strong ? strong.innerHTML : null;
            })
            .filter(Boolean);
        if (lists.length === 0) return;

        console.log(`[视频清单标签] 开始刷新，共 ${lists.length} 个番号`);
        try {
            await fetchTags(lists);
        } catch (err) {
            console.error(
                `自动刷新标签数据失败（${lists.length} 个番号）:`,
                err,
            );
            return;
        }

        // 移除旧标签容器
        document
            .querySelectorAll(".custom-tags-display")
            .forEach((el) => el.remove());

        // 重新渲染
        document.querySelectorAll(".item").forEach(addTagDisplay);

        // 更新筛选栏
        updateFilterBar();

        console.log("[视频清单标签] 自动刷新完成");
    }

    /**
     * 精准刷新单个番号的标签
     * - 仅当番号在当前页面时才处理
     * - 拉取单个番号的标签，合并到 mockTags
     * - 与旧数据对比，未变化则跳过 DOM 更新
     * @param {string} designation 要刷新的番号
     */
    async function refreshDesignation(designation) {
        console.log(`[视频清单标签] refreshDesignation: ${designation}`);

        // 找到页面上匹配该番号的卡片
        const allItems = document.querySelectorAll(".item");
        const targetItem = Array.from(allItems).find((item) => {
            const strong = item.querySelector("a > div.video-title > strong");
            return strong && strong.innerHTML === designation;
        });
        if (!targetItem) {
            console.log(
                `[视频清单标签] ${designation} 不在当前页面 (共 ${allItems.length} 张卡片)`,
            );
            return;
        }

        // 保存旧标签数据用于比对
        const oldTags = mockTags ? mockTags[designation] || [] : null;

        // 增量拉取单个番号
        try {
            await fetchAndMergeTags([designation]);
        } catch (err) {
            console.error(`[视频清单标签] 刷新 ${designation} 失败:`, err);
            return;
        }

        // 比对新旧数据，未变化则跳过 DOM 更新
        const newTags = mockTags[designation] || [];
        if (tagsEqual(oldTags, newTags)) {
            console.log(
                `[视频清单标签] ${designation} 标签未变化，跳过 DOM 更新 (${newTags.length} 个标签)`,
            );
            return;
        }

        // 移除旧容器，渲染新数据
        const oldContainer = targetItem.querySelector(".custom-tags-display");
        if (oldContainer) oldContainer.remove();
        addTagDisplay(targetItem);

        // 标签集合变化时刷新筛选栏
        updateFilterBar();

        console.log(
            `[视频清单标签] ${designation} 标签已更新 (${oldTags ? oldTags.length : 0} → ${newTags.length})`,
        );
    }

    /**
     * 比对两个标签数组是否等价
     * 用于精准刷新时跳过未变化的 DOM 更新
     * @param {Array|null} a
     * @param {Array} b
     * @returns {boolean}
     */
    function tagsEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }

    /**
     * 向服务端请求番号对应的标签列表（全量替换 mockTags）
     * @param {string[]} lists - 当前页面所有番号数组
     * @returns {Promise<void>} 请求完成后更新全局 mockTags
     */
    function fetchTags(lists) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://jls.zerobiubiu.top/api/movies_lists",
                headers: {
                    "Content-Type": "application/json",
                },
                data: JSON.stringify({ lists: lists }),
                onload: function (response) {
                    if (response.status === 200) {
                        try {
                            mockTags = JSON.parse(response.responseText);
                            resolve();
                        } catch (e) {
                            reject(new Error("JSON 解析失败: " + e.message));
                        }
                    } else {
                        // 尝试从响应体中提取服务端错误信息
                        let detail = "";
                        try {
                            const errBody = JSON.parse(response.responseText);
                            detail =
                                errBody.error ||
                                errBody.detail ||
                                errBody.message ||
                                "";
                        } catch (_) {
                            // 响应体不是 JSON，截取前 200 字符
                            const raw = (response.responseText || "").trim();
                            if (raw) detail = raw.substring(0, 200);
                        }
                        const msg = detail
                            ? `HTTP ${response.status}: ${detail}`
                            : `HTTP 错误, 状态码: ${response.status}`;
                        reject(new Error(msg));
                    }
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }

    /**
     * 请求指定番号的标签并合并到现有 mockTags（用于流式增量更新）
     * @param {string[]} lists - 新增的番号数组
     * @returns {Promise<void>}
     */
    function fetchAndMergeTags(lists) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://jls.zerobiubiu.top/api/movies_lists",
                headers: {
                    "Content-Type": "application/json",
                },
                data: JSON.stringify({ lists: lists }),
                onload: function (response) {
                    if (response.status === 200) {
                        try {
                            const newTags = JSON.parse(response.responseText);
                            // 合并到现有数据：首次初始化 或 增量追加
                            if (!mockTags) {
                                mockTags = newTags;
                            } else {
                                Object.assign(mockTags, newTags);
                            }
                            resolve();
                        } catch (e) {
                            reject(new Error("JSON 解析失败: " + e.message));
                        }
                    } else {
                        // 尝试从响应体中提取服务端错误信息
                        let detail = "";
                        try {
                            const errBody = JSON.parse(response.responseText);
                            detail =
                                errBody.error ||
                                errBody.detail ||
                                errBody.message ||
                                "";
                        } catch (_) {
                            // 响应体不是 JSON，截取前 200 字符
                            const raw = (response.responseText || "").trim();
                            if (raw) detail = raw.substring(0, 200);
                        }
                        const msg = detail
                            ? `HTTP ${response.status}: ${detail}`
                            : `HTTP 错误, 状态码: ${response.status}`;
                        reject(new Error(msg));
                    }
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }

    // ---------- 给单个卡片添加标签 ----------
    function addTagDisplay(item) {
        if (item.querySelector(".custom-tags-display")) return;

        const strongEl = item.querySelector("a > div.video-title > strong");
        if (!strongEl) return;
        const designation = strongEl.innerHTML;

        // 标签数据尚未加载时跳过（等待 API 返回后再渲染）
        if (!mockTags) return;

        const meta = item.querySelector(".meta");
        if (!meta) return;

        const container = document.createElement("div");
        container.className = "custom-tags-display";

        const tags = mockTags[designation];
        if (tags && tags.length > 0) {
            tags.forEach((tag) => {
                // url 为 null 时渲染为 <span>，否则渲染为可点击的 <a>
                const hasUrl = tag.url && tag.url.trim();
                const el = document.createElement(hasUrl ? "a" : "span");
                el.className = "custom-tag-link";
                if (hasUrl) {
                    el.href = tag.url;
                    el.target = "_blank";
                    el.rel = "noopener noreferrer";
                }
                el.textContent = tag.name;

                // 优先使用接口返回的 style；缺失时回退随机配色
                const style = tag.style;
                if (style && style.bg && style.text) {
                    el.style.backgroundColor = style.bg;
                    el.style.color = style.text;
                    if (style.text !== "#fff") {
                        el.classList.add("light-bg");
                    }
                } else {
                    const color = getRandomBootstrapColor();
                    el.style.backgroundColor = color.bg;
                    el.style.color = color.text;
                    if (color.isLight) {
                        el.classList.add("light-bg");
                    }
                }

                container.appendChild(el);
            });
        } else {
            // 无标签时放置一个不可点击的占位 <a>，保证容器有内容支撑 UI 平齐
            const placeholder = document.createElement("span");
            placeholder.className = "custom-tag-link";
            placeholder.textContent = "\u2014"; // em-dash 占位
            placeholder.style.backgroundColor = "#e9ecef";
            placeholder.style.color = "#6c757d";
            placeholder.style.pointerEvents = "none";
            placeholder.style.userSelect = "none";
            container.appendChild(placeholder);
        }

        // 鼠标滚轮横向滚动，触达边界时交还页面纵向滚动
        container.addEventListener(
            "wheel",
            function (e) {
                if (e.deltaY !== 0) {
                    const atStart = this.scrollLeft <= 0 && e.deltaY < 0;
                    const atEnd =
                        this.scrollLeft + this.clientWidth >=
                            this.scrollWidth - 1 && e.deltaY > 0;
                    if (!atStart && !atEnd) {
                        e.preventDefault();
                        this.scrollLeft += e.deltaY;
                    }
                }
            },
            { passive: false },
        );

        meta.insertAdjacentElement("afterend", container);
    }

    // ---------- 标签筛选器 ----------

    /**
     * 收集页面上所有唯一的标签名称（排除占位符）
     * @returns {string[]} 去重排序后的标签名数组
     */
    function collectAllUniqueTags() {
        const tagNames = new Set();
        document
            .querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])",
            )
            .forEach((el) => {
                const name = el.textContent.trim();
                if (name && name !== "\u2014") {
                    tagNames.add(name);
                }
            });
        return [...tagNames].sort();
    }

    /** 收集每个标签的出现次数 */
    function collectTagCounts() {
        const counts = {};
        document
            .querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])",
            )
            .forEach((el) => {
                const name = el.textContent.trim();
                if (name && name !== "\u2014") {
                    counts[name] = (counts[name] || 0) + 1;
                }
            });
        return counts;
    }

    /** 计算无标签的卡片数 */
    function countNoTagItems() {
        let count = 0;
        document.querySelectorAll(".item").forEach((item) => {
            const links = item.querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])",
            );
            if (links.length === 0) count++;
        });
        return count;
    }

    const TAG_HIDDEN_ATTR = "data-video-lists-tag-hidden";

    /**
     * 应用当前筛选
     * 支持 4 种模式：包含任意 / 全都包含 / 不包含以下标签 / 不包含以下任意一个
     */
    function applyFilter() {
        const activeChips = document.querySelectorAll(
            ".tag-filter-chip.active",
        );
        const selectedValues = new Set(
            Array.from(activeChips).map((c) => c.dataset.value),
        );

        // 无筛选时：仅恢复本脚本隐藏的卡片
        if (selectedValues.size === 0) {
            document
                .querySelectorAll(`.item[${TAG_HIDDEN_ATTR}]`)
                .forEach((item) => {
                    item.removeAttribute(TAG_HIDDEN_ATTR);
                    item.style.display = "";
                });
            return;
        }

        const showNoTag = selectedValues.has("no-tag");
        const selectedTags = new Set(
            [...selectedValues].filter((v) => v !== "no-tag"),
        );

        document.querySelectorAll(".item").forEach((item) => {
            // 协同安全：已被其他脚本隐藏的卡片不纳入管理
            const hiddenByOther =
                item.style.display === "none" &&
                !item.hasAttribute(TAG_HIDDEN_ATTR);
            if (hiddenByOther) return;

            const tagLinks = item.querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])",
            );
            const itemTagNames = new Set(
                Array.from(tagLinks).map((el) => el.textContent.trim()),
            );

            let tagMatch = false;

            if (selectedTags.size > 0) {
                switch (currentFilterMode) {
                    case FILTER_MODES.CONTAINS_ANY:
                        // 包含任意一个：命中任一标签即显示
                        tagMatch = [...selectedTags].some((t) =>
                            itemTagNames.has(t),
                        );
                        break;

                    case FILTER_MODES.CONTAINS_ALL:
                        // 全都包含：命中全部标签才显示
                        tagMatch = [...selectedTags].every((t) =>
                            itemTagNames.has(t),
                        );
                        break;

                    case FILTER_MODES.EXCLUDES_ALL:
                        // 不包含以下标签：一个都不包含才显示
                        tagMatch = ![...selectedTags].some((t) =>
                            itemTagNames.has(t),
                        );
                        break;

                    case FILTER_MODES.EXCLUDES_ANY:
                        // 不包含以下任意一个：至少缺少一个才显示
                        tagMatch = ![...selectedTags].every((t) =>
                            itemTagNames.has(t),
                        );
                        break;

                    default:
                        tagMatch = [...selectedTags].some((t) =>
                            itemTagNames.has(t),
                        );
                }
            }

            // 无标签条件独立判断，与标签匹配用 OR 连接
            const noTagMatch = showNoTag && itemTagNames.size === 0;

            const shouldShow = tagMatch || noTagMatch;

            if (shouldShow) {
                item.removeAttribute(TAG_HIDDEN_ATTR);
                item.style.display = "";
            } else {
                item.setAttribute(TAG_HIDDEN_ATTR, "");
                item.style.display = "none";
            }
        });
    }

    /**
     * 构建筛选模式下拉菜单
     * 使用 <details> 原生行为实现点击外部自动关闭
     * @returns {HTMLDetailsElement}
     */
    function buildFilterModeDropdown() {
        const details = document.createElement("details");
        details.className = "filter-mode-dropdown";

        const summary = document.createElement("summary");
        summary.className = "filter-mode-summary";

        // 模式指示圆点
        const indicator = document.createElement("span");
        indicator.className = "filter-mode-indicator";
        summary.appendChild(indicator);

        // 当前模式文本
        const modeText = document.createElement("span");
        modeText.className = "filter-mode-text";
        summary.appendChild(modeText);

        // 下拉箭头
        const arrow = document.createElement("span");
        arrow.className = "filter-mode-arrow";
        arrow.textContent = "\u25BC";
        summary.appendChild(arrow);

        details.appendChild(summary);

        // 下拉面板
        const panel = document.createElement("div");
        panel.className = "filter-mode-panel";

        // 构建菜单项
        let lastGroup = null;
        FILTER_MODE_CONFIG.forEach((mode) => {
            // 组间插入分隔线
            if (lastGroup && lastGroup !== mode.group) {
                const separator = document.createElement("div");
                separator.className = "filter-mode-separator";
                panel.appendChild(separator);
            }
            lastGroup = mode.group;

            const item = document.createElement("div");
            item.className = "filter-mode-item";
            if (mode.group === "exclude") {
                item.classList.add("exclude");
            }
            item.dataset.mode = mode.value;

            // 圆点
            const dot = document.createElement("span");
            dot.className = "filter-mode-indicator " + mode.group;
            item.appendChild(dot);

            // 文本
            const text = document.createElement("span");
            text.textContent = mode.label;
            item.appendChild(text);

            item.addEventListener("click", () => {
                currentFilterMode = mode.value;
                updateModeUI();
                details.open = false;
                applyFilter();
            });

            panel.appendChild(item);
        });

        details.appendChild(panel);

        /** 根据 currentFilterMode 刷新按钮与菜单状态 */
        function updateModeUI() {
            const config =
                FILTER_MODE_CONFIG.find((m) => m.value === currentFilterMode) ||
                FILTER_MODE_CONFIG[0];

            // 更新按钮文本
            modeText.textContent = config.label;

            // 更新按钮圆点
            indicator.className = "filter-mode-indicator " + config.group;

            // 更新菜单选中状态
            panel.querySelectorAll(".filter-mode-item").forEach((el) => {
                el.classList.toggle(
                    "selected",
                    el.dataset.mode === currentFilterMode,
                );
            });
        }

        // 保存 updateModeUI 引用
        details._updateModeUI = updateModeUI;

        // 初始刷新
        updateModeUI();

        return details;
    }

    /**
     * 构建筛选器 UI
     * - 演员页面：插入到 div.actor-tags.tags 之后
     * - 其他页面：插入到 div.tabs.is-boxed 之后
     */
    function buildFilterBar() {
        if (document.querySelector(".tag-filter-bar")) return;

        // 根据页面类型选择挂载目标
        const isActorPage = /^\/actors\//.test(window.location.pathname);
        const mountTarget = isActorPage
            ? document.querySelector(
                  "body > section > div > div.actor-tags.tags",
              )
            : document.querySelector(
                  "body > section > div > div.tabs.is-boxed",
              );
        if (!mountTarget) return;

        const filterBar = document.createElement("div");
        filterBar.className = "tag-filter-bar";

        const label = document.createElement("span");
        label.className = "tag-filter-label";
        label.textContent = "\u7B5B\u9009:"; // 筛选:
        filterBar.appendChild(label);

        // ── 筛选模式下拉 ──
        const modeDropdown = buildFilterModeDropdown();
        filterBar.appendChild(modeDropdown);
        filterBar._modeDropdown = modeDropdown;

        const chipsContainer = document.createElement("div");
        chipsContainer.className = "tag-filter-chips";
        filterBar.appendChild(chipsContainer);

        // ── 自动刷新开关 ──
        const toggleWrapper = document.createElement("label");
        toggleWrapper.className = "auto-refresh-toggle";
        toggleWrapper.title = "监听清单操作，自动刷新标签";

        const switchSpan = document.createElement("span");
        switchSpan.className = "auto-refresh-switch";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = autoRefreshEnabled;
        const slider = document.createElement("span");
        slider.className = "auto-refresh-slider";
        switchSpan.appendChild(checkbox);
        switchSpan.appendChild(slider);

        const toggleLabel = document.createElement("span");
        toggleLabel.textContent = "\u81EA\u52A8\u5237\u65B0"; // 自动刷新

        toggleWrapper.appendChild(switchSpan);
        toggleWrapper.appendChild(toggleLabel);
        filterBar.appendChild(toggleWrapper);

        checkbox.addEventListener("change", () => {
            autoRefreshEnabled = checkbox.checked;
            saveAutoRefreshState(autoRefreshEnabled);
            if (autoRefreshEnabled) {
                console.log("[视频清单标签] 自动刷新已开启");
            } else {
                console.log("[视频清单标签] 自动刷新已关闭");
            }
        });

        /** 刷新芯片列表 */
        function refreshChips() {
            // 保存当前选中状态
            const activeValues = new Set(
                Array.from(
                    chipsContainer.querySelectorAll(".tag-filter-chip.active"),
                ).map((c) => c.dataset.value),
            );

            chipsContainer.innerHTML = "";
            const allCounts = collectTagCounts();

            // "无标签" 芯片（带计数）
            const noCount = countNoTagItems();
            const noTagChip = createFilterChip("\u65E0\u6807\u7B7E", "no-tag", {
                isNoTag: true,
                count: noCount,
            });
            if (activeValues.has("no-tag")) noTagChip.classList.add("active");
            chipsContainer.appendChild(noTagChip);

            // 各标签芯片（带计数）
            const sortedTags = Object.keys(allCounts).sort();
            sortedTags.forEach((tagName) => {
                const chip = createFilterChip(tagName, tagName, {
                    count: allCounts[tagName],
                });
                if (activeValues.has(tagName)) chip.classList.add("active");
                chipsContainer.appendChild(chip);
            });
        }

        /**
         * 创建单个筛选芯片
         * @param {string} labelText - 芯片文本
         * @param {string} value - 芯片值
         * @param {{ isNoTag?: boolean, count?: number }} opts - 选项
         */
        function createFilterChip(labelText, value, opts = {}) {
            const { isNoTag = false, count } = opts;
            const chip = document.createElement("span");
            chip.className = "tag-filter-chip";
            if (isNoTag) chip.classList.add("no-tag");
            chip.textContent =
                count !== undefined ? `${labelText} ${count}` : labelText;
            chip.dataset.value = value;

            chip.addEventListener("click", () => {
                chip.classList.toggle("active");
                applyFilter();
            });

            return chip;
        }

        refreshChips();

        // 作为挂载目标的兄弟元素插入到它之后
        mountTarget.insertAdjacentElement("afterend", filterBar);

        // 保存 refreshChips 引用以便后续更新
        filterBar._refreshChips = refreshChips;
    }

    /**
     * 更新筛选器选项（新卡片加载后调用）
     */
    function updateFilterBar() {
        const filterBar = document.querySelector(".tag-filter-bar");
        if (filterBar && filterBar._refreshChips) {
            filterBar._refreshChips();
            applyFilter();
        }
    }

    // ---------- 初始化：收集番号 → 请求标签 → 渲染 ----------
    async function initExistingItems() {
        const items = document.querySelectorAll(".item");
        if (items.length === 0) return;

        // 收集所有番号
        const lists = Array.from(items)
            .map((item) => {
                const strong = item.querySelector(
                    "a > div.video-title > strong",
                );
                return strong ? strong.innerHTML : null;
            })
            .filter(Boolean);

        if (lists.length === 0) return;

        // 请求标签数据
        try {
            await fetchTags(lists);
            console.log(
                `[视频清单标签] 初始化加载完成: ${lists.length} 个番号, ${Object.keys(mockTags || {}).length} 个有标签`,
            );
        } catch (err) {
            console.error("获取标签数据失败:", err);
            mockTags = {}; // 失败时设空对象，避免后续报错
            return;
        }

        // 为每个卡片添加标签
        items.forEach(addTagDisplay);

        // 构建标签筛选器
        buildFilterBar();
    }

    // ---------- 流式增量标签获取 ----------

    /** 待处理的流式新增卡片队列 */
    let pendingNewItems = [];
    /** 防抖定时器 */
    let debounceTimer = null;
    /** 防抖间隔（毫秒），累积在此期间内的新增卡片统一请求 */
    const DEBOUNCE_MS = 300;

    /**
     * 处理流式新增的视频卡片：收集番号 → 请求标签 → 合并 → 重新渲染
     * 采用防抖策略，将短时间内的多次新增合并为一次 API 请求
     * @param {Element[]} items - 新增的 .item 元素数组
     */
    async function handleNewItems(items) {
        // 立即用已有数据渲染（mockTags 中已存在的番号直接展示，未命中的展示占位符）
        items.forEach(addTagDisplay);

        // 追加到待处理队列
        pendingNewItems.push(...items);

        // 清除上一次定时器，重新计时
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(async () => {
            // 取出当前批次并清空队列
            const itemsToRefresh = [...pendingNewItems];
            pendingNewItems = [];
            debounceTimer = null;

            // 收集这些卡片中 mockTags 尚未覆盖的番号
            const uncachedCodes = [];
            const seen = new Set();
            for (const item of itemsToRefresh) {
                const strong = item.querySelector(
                    "a > div.video-title > strong",
                );
                if (!strong) continue;
                const code = strong.innerHTML;
                if (!code || seen.has(code)) continue;
                // 只请求 mockTags 中缺失的番号
                if (!mockTags || !(code in mockTags)) {
                    uncachedCodes.push(code);
                    seen.add(code);
                }
            }

            if (uncachedCodes.length === 0) {
                updateFilterBar();
                return;
            }

            try {
                await fetchAndMergeTags(uncachedCodes);
            } catch (err) {
                console.error("[视频清单标签] 获取新增标签数据失败:", err);
                return;
            }

            // 移除旧占位容器，用完整数据重新渲染这些卡片
            itemsToRefresh.forEach((item) => {
                const oldContainer = item.querySelector(".custom-tags-display");
                if (oldContainer) oldContainer.remove();
                addTagDisplay(item);
            });

            updateFilterBar();
            console.log(
                `[视频清单标签] 已为 ${uncachedCodes.length} 个新番号获取标签`,
            );
        }, DEBOUNCE_MS);
    }

    const observer = new MutationObserver((mutations) => {
        const newItems = [];
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.(".item")) {
                        newItems.push(node);
                    }
                    node.querySelectorAll?.(".item").forEach((el) => {
                        newItems.push(el);
                    });
                }
            }
        }
        if (newItems.length > 0) {
            handleNewItems(newItems);
        }
    });

    function startObserving() {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** 设置跨脚本跨标签页联动监听 */
    function setupAutoRefreshListener() {
        let lastRefreshTime = 0;
        const DEBOUNCE_MS = 500; // 500ms 内不重复刷新

        // 服务器返回的「未变更」类 association —— 标签不会变化，跳过刷新
        const NO_CHANGE_ASSOCS = new Set([
            "existed",
            "limit_exceeded",
            "unchanged",
        ]);

        /** 处理同步通知，必要时刷新标签 */
        function handleSyncNotify(payload) {
            if (!autoRefreshEnabled) {
                console.log(
                    "[视频清单标签] 收到同步事件但自动刷新已关闭，跳过",
                );
                return;
            }
            if (!payload || !payload.designation) {
                console.warn(
                    "[视频清单标签] 收到同步事件但无 designation:",
                    payload,
                );
                return;
            }
            if (NO_CHANGE_ASSOCS.has(payload.association)) {
                console.log(
                    `[视频清单标签] association=${payload.association} 不影响标签，跳过`,
                );
                return;
            }

            const now = Date.now();
            if (now - lastRefreshTime < DEBOUNCE_MS) {
                console.log(
                    `[视频清单标签] 距上次刷新 ${now - lastRefreshTime}ms < ${DEBOUNCE_MS}ms，防抖跳过`,
                );
                return;
            }
            lastRefreshTime = now;

            console.log("[视频清单标签] 收到同步事件 → 精准刷新", payload);
            refreshDesignation(payload.designation);
        }

        // 1) 跨脚本同页面（CustomEvent）
        document.addEventListener("jdb:sync-complete", (e) => {
            console.log("[视频清单标签] [CustomEvent] 收到 jdb:sync-complete");
            handleSyncNotify(e.detail);
        });

        // 2) 跨脚本跨标签页（localStorage storage 事件，只在其他标签页触发）
        window.addEventListener("storage", (e) => {
            if (e.key !== LAST_SYNC_KEY) {
                return;
            }
            console.log(
                `[视频清单标签] [storage] key=${e.key} newValue=${e.newValue ? "<set>" : "<empty>"}`,
            );
            if (!e.newValue) return;
            let payload;
            try {
                payload = JSON.parse(e.newValue);
            } catch (_) {
                return;
            }
            handleSyncNotify(payload);
        });

        // 3) 同脚本跨标签页（GM 原生通道，兜底）
        GM_addValueChangeListener(
            LAST_SYNC_KEY,
            (name, oldValue, newValue, remote) => {
                console.log(
                    `[视频清单标签] [GM_addValueChangeListener] remote=${remote} newValue=${newValue ? "<set>" : "<empty>"}`,
                );
                if (!newValue) return;
                let payload;
                try {
                    payload = JSON.parse(newValue);
                } catch (_) {
                    return;
                }
                handleSyncNotify(payload);
            },
        );

        console.log(
            "[视频清单标签] 自动刷新监听已就绪 (autoRefreshEnabled=" +
                autoRefreshEnabled +
                ")",
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", async () => {
            loadAutoRefreshState();
            await initExistingItems();
            startObserving();
            setupAutoRefreshListener();
        });
    } else {
        loadAutoRefreshState();
        initExistingItems().then(() => {
            startObserving();
            setupAutoRefreshListener();
        });
    }
})();
