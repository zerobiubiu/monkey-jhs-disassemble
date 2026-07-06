// ==UserScript==
// @name         JavDB 状态标签筛选
// @version      1.0
// @description  根据页面上 status-tag 文本内容动态生成筛选芯片，过滤显示视频卡片
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @grant        GM_addStyle
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    "use strict";

    // ---------- 样式（与 videoListsTag 筛选栏风格一致） ----------
    GM_addStyle(`
        .status-tag-filter-bar {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 8px 0 12px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .status-tag-filter-label {
            flex-shrink: 0;
            font-size: 0.8em;
            font-weight: 600;
            color: #6c757d;
            line-height: 1.8;
            margin-right: 4px;
        }
        .status-tag-filter-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .status-tag-filter-chip {
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
        .status-tag-filter-chip:hover {
            border-color: #adb5bd;
            background: #f8f9fa;
        }
        .status-tag-filter-chip.active {
            background: #198754;
            border-color: #198754;
            color: #fff;
        }
        .status-tag-filter-chip.no-status {
            border-style: dashed;
            color: #6c757d;
        }
        .status-tag-filter-chip.no-status.active {
            background: #6c757d;
            border-color: #6c757d;
            border-style: solid;
            color: #fff;
        }
    `);

    /**
     * 收集每个 status-tag 文本的出现次数
     * @returns {{ [tagText: string]: number }} 标签→计数映射
     */
    function collectStatusTagCounts() {
        const counts = {};
        document
            .querySelectorAll(
                ".item .tags.has-addons .tag.is-success.status-tag",
            )
            .forEach((el) => {
                const text = el.textContent.trim();
                if (text) {
                    counts[text] = (counts[text] || 0) + 1;
                }
            });
        return counts;
    }

    /**
     * 计算无状态标签的卡片数
     * @returns {number}
     */
    function countNoStatusItems() {
        let count = 0;
        document.querySelectorAll(".item").forEach((item) => {
            if (
                !item.querySelector(
                    ".tags.has-addons .tag.is-success.status-tag",
                )
            ) {
                count++;
            }
        });
        return count;
    }

    /** 标记本脚本隐藏的卡片 */
    const HIDDEN_ATTR = "data-status-tag-hidden";

    /**
     * 应用筛选：根据当前激活的芯片显示/隐藏 .item 元素
     * - 无激活芯片：仅恢复本脚本隐藏的卡片（不触碰其他脚本已隐藏的）
     * - 激活"无状态标签"芯片：仅显示无任何状态标签的项
     * - 激活其他芯片：OR 逻辑，命中任一选中标签即显示
     * - 多芯片同时激活时 OR 叠加
     * - 协同安全：被其他脚本隐藏的卡片（已 display:none 且无本脚本标记）不纳入管理
     */
    function applyFilter() {
        const activeChips = document.querySelectorAll(
            ".status-tag-filter-chip.active",
        );
        const selectedValues = new Set(
            Array.from(activeChips).map((c) => c.dataset.value),
        );

        // 无筛选时：仅恢复本脚本隐藏的卡片，不清除其他脚本的隐藏
        if (selectedValues.size === 0) {
            document
                .querySelectorAll(`.item[${HIDDEN_ATTR}]`)
                .forEach((item) => {
                    item.removeAttribute(HIDDEN_ATTR);
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
                !item.hasAttribute(HIDDEN_ATTR);
            if (hiddenByOther) return;

            // 收集当前卡片内所有 status-tag 的文本
            const itemStatusTags = new Set();
            item.querySelectorAll(
                ".tags.has-addons .tag.is-success.status-tag",
            ).forEach((el) => {
                const text = el.textContent.trim();
                if (text) itemStatusTags.add(text);
            });

            // 标签匹配：命中任一选定标签即显示（OR 逻辑）
            let tagMatch = false;
            if (selectedTags.size > 0) {
                tagMatch = [...selectedTags].some((t) => itemStatusTags.has(t));
            }

            // 无标签条件独立判断，与标签匹配用 OR 连接
            const noTagMatch = showNoTag && itemStatusTags.size === 0;

            const shouldShow = tagMatch || noTagMatch;

            if (shouldShow) {
                item.removeAttribute(HIDDEN_ATTR);
                item.style.display = "";
            } else {
                item.setAttribute(HIDDEN_ATTR, "");
                item.style.display = "none";
            }
        });
    }

    /**
     * 创建单个筛选芯片
     * @param {string} labelText - 芯片文本
     * @param {string} value - 芯片值（标签文本或 'no-tag'）
     * @param {{ isNoTag?: boolean, count?: number }} opts - 选项
     * @returns {HTMLSpanElement} 芯片元素
     */
    function createFilterChip(labelText, value, opts = {}) {
        const { isNoTag = false, count } = opts;
        const chip = document.createElement("span");
        chip.className = "status-tag-filter-chip";
        if (isNoTag) chip.classList.add("no-status");
        // 芯片文本：标签名 + 计数（如 "⭐ 已收藏 12"）
        chip.textContent =
            count !== undefined ? `${labelText} ${count}` : labelText;
        chip.dataset.value = value;

        chip.addEventListener("click", () => {
            chip.classList.toggle("active");
            applyFilter();
        });

        return chip;
    }

    /**
     * 构建筛选栏并插入到挂载目标之后
     * @param {Element} mountTarget - 挂载参考元素
     */
    function doBuild(mountTarget) {
        if (document.querySelector(".status-tag-filter-bar")) return;

        const filterBar = document.createElement("div");
        filterBar.className = "status-tag-filter-bar";

        // 标签
        const label = document.createElement("span");
        label.className = "status-tag-filter-label";
        label.textContent = "\u72B6\u6001:"; // 状态:
        filterBar.appendChild(label);

        // 芯片容器
        const chipsContainer = document.createElement("div");
        chipsContainer.className = "status-tag-filter-chips";
        filterBar.appendChild(chipsContainer);

        /**
         * 刷新芯片列表：收集当前页面所有 status-tag 文本并重建芯片
         * 保留当前已激活的芯片状态
         */
        function refreshChips() {
            // 保存当前选中状态
            const activeValues = new Set(
                Array.from(
                    chipsContainer.querySelectorAll(
                        ".status-tag-filter-chip.active",
                    ),
                ).map((c) => c.dataset.value),
            );

            chipsContainer.innerHTML = "";

            // "无状态标签" 芯片（始终在第一位，带计数）
            const noCount = countNoStatusItems();
            const noTagChip = createFilterChip("无状态标签", "no-tag", {
                isNoTag: true,
                count: noCount,
            });
            if (activeValues.has("no-tag")) noTagChip.classList.add("active");
            chipsContainer.appendChild(noTagChip);

            // 各状态标签芯片（根据页面实际内容动态生成，带计数）
            const allCounts = collectStatusTagCounts();
            const sortedTags = Object.keys(allCounts).sort();
            sortedTags.forEach((tagName) => {
                const chip = createFilterChip(tagName, tagName, {
                    count: allCounts[tagName],
                });
                if (activeValues.has(tagName)) chip.classList.add("active");
                chipsContainer.appendChild(chip);
            });
        }

        // 初始构建芯片
        refreshChips();

        // 插入到 DOM
        if (
            mountTarget.matches(
                ".tag-filter-bar, .actor-tags.tags, .tabs.is-boxed",
            )
        ) {
            mountTarget.insertAdjacentElement("afterend", filterBar);
        } else {
            mountTarget.insertAdjacentElement("beforebegin", filterBar);
        }

        // 保存 refreshChips 引用以便后续更新
        filterBar._refreshChips = refreshChips;

        console.log("[状态标签筛选] 筛选栏已挂载");
    }

    /**
     * 按优先级依次查找可用的挂载目标
     * @returns {Element|null}
     */
    function findMountTarget() {
        // 1) 优先挂在 videoListsTag 的 .tag-filter-bar 之后
        const tagFilterBar = document.querySelector(".tag-filter-bar");
        if (tagFilterBar) return tagFilterBar;

        // 2) 挂在页面默认 tabs 容器之后
        const isActorPage = /^\/actors\//.test(window.location.pathname);
        if (isActorPage) {
            const actorTags = document.querySelector(
                "body > section > div > div.actor-tags.tags",
            );
            if (actorTags) return actorTags;
        } else {
            const tabsBoxed = document.querySelector(
                "body > section > div > div.tabs.is-boxed",
            );
            if (tabsBoxed) return tabsBoxed;
        }

        // 3) 回退：挂在 section 容器的第一个子元素之前
        const section = document.querySelector("body > section > div > div");
        if (section && section.firstElementChild) {
            if (
                !section.firstElementChild.matches(
                    ".tag-filter-bar, .status-tag-filter-bar",
                )
            ) {
                return section.firstElementChild;
            }
        }

        // 4) 最终回退：挂在 body > section > div 的第一个子元素之前
        const container = document.querySelector("body > section > div");
        if (container && container.firstElementChild) {
            if (
                !container.firstElementChild.matches(
                    ".tag-filter-bar, .status-tag-filter-bar",
                )
            ) {
                return container.firstElementChild;
            }
        }

        return null;
    }

    /**
     * 尝试构建筛选栏
     * @returns {boolean} 是否成功构建
     */
    function tryBuild() {
        if (document.querySelector(".status-tag-filter-bar")) return true;

        const mountTarget = findMountTarget();
        if (!mountTarget) return false;

        doBuild(mountTarget);
        return true;
    }

    /**
     * 刷新筛选器：更新芯片列表并重新应用筛选
     */
    function updateFilterBar() {
        const filterBar = document.querySelector(".status-tag-filter-bar");
        if (filterBar && filterBar._refreshChips) {
            filterBar._refreshChips();
            applyFilter();
        }
    }

    // MutationObserver：监听新增 .item 及 status-tag 注入（jhs 异步添加）
    let observerDebounce = null;
    const observer = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (
                    node.matches?.(".item") ||
                    node.querySelectorAll?.(".item").length > 0 ||
                    node.matches?.(".tag.is-success.status-tag") ||
                    node.querySelectorAll?.(".tag.is-success.status-tag")
                        .length > 0
                ) {
                    shouldRefresh = true;
                    break;
                }
            }
            if (shouldRefresh) break;
        }

        if (shouldRefresh) {
            if (observerDebounce) clearTimeout(observerDebounce);
            observerDebounce = setTimeout(() => {
                updateFilterBar();
            }, 150);
        }
    });

    function startObserving() {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ---------- 初始化 ----------
    function init() {
        console.log(
            "[状态标签筛选] 初始化, pathname:",
            window.location.pathname,
        );

        if (!document.body) {
            console.warn("[状态标签筛选] document.body 不存在，延后初始化");
            setTimeout(init, 100);
            return;
        }

        // 首次尝试构建筛选栏
        if (tryBuild()) {
            startObserving();
            return;
        }

        console.log(
            "[状态标签筛选] 未找到挂载目标，开始 MutationObserver 等待",
        );

        // 若挂载目标尚未渲染，通过防抖 MutationObserver 持续等待 DOM 变化
        let mountDebounce = null;
        const mountObserver = new MutationObserver(() => {
            if (mountDebounce) clearTimeout(mountDebounce);
            mountDebounce = setTimeout(() => {
                if (tryBuild()) {
                    console.log("[状态标签筛选] MutationObserver 挂载成功");
                    mountObserver.disconnect();
                    startObserving();
                    if (mountTimeout) clearTimeout(mountTimeout);
                }
            }, 100);
        });
        mountObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // 超时兜底（10 秒后强制结束等待，用最终回退位置强行挂载）
        const mountTimeout = setTimeout(() => {
            mountObserver.disconnect();
            if (!document.querySelector(".status-tag-filter-bar")) {
                const fallback =
                    findMountTarget() || document.body.firstElementChild;
                if (fallback) {
                    doBuild(fallback);
                    startObserving();
                    console.warn("[状态标签筛选] 通过最终回退挂载", fallback);
                } else {
                    console.warn("[状态标签筛选] 超时后仍无挂载目标");
                }
            }
        }, 10000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
