// ==UserScript==
// @name         Javdb 内容排序
// @version      1.0
// @description  对 Javdb 的单页内容排序
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @require      https://cdn.jsdelivr.net/npm/jquery@4.0.0/dist/jquery.min.js
// @run-at       document-end
// ==/UserScript==

(function ($) {
    "use strict";

    // 注入排序按钮选中态样式（一次性，避免 JS 手动操作 inline style）
    function injectSortStyles() {
        const style = document.createElement("style");
        style.textContent = `
            .button.is-small.selected-method,
            .button.is-small.selected-method:hover {
                background-color: rgb(25, 135, 84) !important;
                border-color: transparent !important;
                color: #fff !important;
            }
        `;
        document.head.appendChild(style);
    }
    injectSortStyles();

    // 排序比较函数（番号对比）
    function compareItems($itemA, $itemB) {
        const getStrongText = ($item) => {
            const $strong = $item.find("a > div.video-title > strong");
            return $strong.length ? $strong.text().trim() : "";
        };
        const textA = getStrongText($itemA);
        const textB = getStrongText($itemB);
        return textA.localeCompare(textB);
    }

    // 从 item 节点提取评分（a > div.score > span 中的浮点数）
    function getScore($item) {
        const $span = $item.find("a > div.score > span");
        if (!$span.length) return 0;
        const text = $span.text().trim();
        const match = text.match(/(\d+\.\d+)/);
        if (!match) return 0;
        return parseFloat(match[1]) || 0;
    }

    function newOption(text) {
        return $("<span>", {
            text: text,
            class: "button is-small",
        });
    }

    function createSortSelector() {
        const LOG = "[pageSort]";

        // 查找工具栏容器
        const $toolbar = $("body > section > div > div.toolbar");
        if (!$toolbar.length) {
            console.warn(`${LOG} 未找到工具栏 .toolbar，跳过排序选择器注入`);
            return;
        }

        // 查找视频列表容器
        const $container = $(
            "body > section > div > div.movie-list.h.cols-4.vcols-8",
        );
        if (!$container.length) {
            console.warn(
                `${LOG} 未找到视频列表容器 .movie-list，跳过排序选择器注入`,
            );
            return;
        }

        // 获取全部视频节点
        const $items = $container.children(".item");
        if ($items.length === 0) {
            console.warn(`${LOG} 视频列表为空，跳过排序选择器注入`);
            return;
        }

        // 给每个节点打上原始位置标记（用于恢复原始顺序）
        $items.each(function (i) {
            this.setAttribute("data-sort-original-index", i);
        });

        // --- 排序配置表（单一数据源：按钮文本 + 排序函数） ---
        // 新增排序方式只需在此数组追加一条，按钮和排序逻辑自动同步
        const SORT_CONFIGS = [
            {
                label: "按照名称升序",
                sortFn: (items) => items.sort((a, b) => compareItems($(a), $(b))),
                implemented: true,
            },
            {
                label: "按照名称降序",
                sortFn: (items) => items.sort((a, b) => compareItems($(b), $(a))),
                implemented: true,
            },
            {
                label: "按照评分升序",
                sortFn: (items) => items.sort((a, b) => getScore($(a)) - getScore($(b))),
                implemented: true,
            },
            {
                label: "按照评分降序",
                sortFn: (items) => items.sort((a, b) => getScore($(b)) - getScore($(a))),
                implemented: true,
            },
        ];

        // --- 排序状态 ---
        let activeSort = null; // 当前激活的排序方式（null = 原始顺序）
        let isApplyingSort = false; // 守卫：防止排序守卫自己触发自己
        let sortGuardRetries = 0; // 安全计数器，防止极端情况死循环
        const MAX_GUARD_RETRIES = 5;

        /**
         * 执行排序（统一的排序入口）
         * @param {string|null} sortMethod - 排序方式，null 表示恢复原始
         */
        function applySort(sortMethod) {
            if (isApplyingSort) return;
            isApplyingSort = true;

            // 重新查询当前 DOM 中的节点（防止节点被替换后引用失效）
            const currentItems = $container.children(".item").get();
            if (currentItems.length === 0) {
                isApplyingSort = false;
                return;
            }

            if (sortMethod === null) {
                // 恢复原始顺序（无需查配置表）
                currentItems.sort((a, b) => {
                    const ai = parseInt(a.getAttribute("data-sort-original-index")) || 0;
                    const bi = parseInt(b.getAttribute("data-sort-original-index")) || 0;
                    return ai - bi;
                });
                $container.append(currentItems);
                console.log(`${LOG} 已恢复原始顺序`);
            } else {
                // 从配置表查找对应的排序函数
                const config = SORT_CONFIGS.find((c) => c.label === sortMethod);
                if (!config) {
                    console.warn(`${LOG} 未识别的排序选项: ${sortMethod}`);
                    isApplyingSort = false;
                    return;
                }
                if (!config.implemented || !config.sortFn) {
                    console.log(`${LOG} ${sortMethod} - 待实现`);
                    isApplyingSort = false;
                    return;
                }
                config.sortFn(currentItems);
                $container.append(currentItems);
                console.log(`${LOG} 已${sortMethod}排列 ${currentItems.length} 个影片`);
            }

            // 关键：清空 append 产生的 mutation 记录，防止微任务触发守卫误判
            sortGuard.takeRecords();

            isApplyingSort = false;
        }

        // --- 排序守卫：监听页面是否把顺序改了回来 ---
        const sortGuard = new MutationObserver(() => {
            if (activeSort && !isApplyingSort) {
                if (sortGuardRetries >= MAX_GUARD_RETRIES) {
                    console.warn(`${LOG} 排序守卫重试已达上限 (${MAX_GUARD_RETRIES})，放弃自动恢复`);
                    return;
                }
                sortGuardRetries++;
                console.log(`${LOG} 检测到 DOM 顺序被外部修改，重新应用排序 (${sortGuardRetries}/${MAX_GUARD_RETRIES})`);
                applySort(activeSort);
            }
        });
        sortGuard.observe($container[0], { childList: true });

        // --- 构建排序按钮组 ---
        const $buttonGroup = $("<div>", {
            css: {
                display: "inline-block",
                marginBottom: ".1rem",
                lineHeight: "2.2rem",
                marginRight: ".4rem",
                marginLeft: "auto",
            },
        });

        const $buttons = $("<div>", {
            class: "buttons has-addons",
        });

        $buttonGroup.append($buttons);
        $toolbar.append($buttonGroup);

        // 从配置表遍历创建排序选项按钮
        SORT_CONFIGS.forEach((config) => {
            $buttons.append(newOption(config.label));
        });

        // 事件委托：处理排序按钮点击
        $buttons.on("click", ".button.is-small", function (e) {
            // 阻止事件冒泡，防止页面自身处理器干扰
            e.preventDefault();
            e.stopPropagation();

            const $this = $(this);
            const isActive = $this.hasClass("selected-method");

            // 用户手动操作，重置守卫重试计数器
            sortGuardRetries = 0;

            if (isActive) {
                // 再次点击已选中项：取消选中并恢复原始顺序
                $this.removeClass("selected-method");
                activeSort = null;
                applySort(null);
            } else {
                // 移除其他按钮的选中状态
                $this.siblings(".selected-method").removeClass("selected-method");

                // 设置当前按钮为选中态
                $this.addClass("selected-method");

                const method = $this.text();
                activeSort = method;
                applySort(method);
            }
        });

        console.log(`${LOG} 排序选择器已注入，共 ${$items.length} 个影片`);
    }

    // 等待页面容器出现后注入排序选择器
    function waitForContainer() {
        const LOG = "[pageSort]";
        console.log(`${LOG} 等待页面容器加载...`);

        const observer = new MutationObserver((_mutations, obs) => {
            const $container = $("body > section > div");
            if ($container.length) {
                obs.disconnect();
                console.log(`${LOG} 页面容器已就绪，开始注入排序选择器`);
                createSortSelector();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 启动
    waitForContainer();
})(jQuery);
