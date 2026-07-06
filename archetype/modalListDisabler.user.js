// ==UserScript==
// @name         JavDB 清单模态框禁用指定列表
// @version      1.0
// @description  监听「保存到清单」模态框出现后，自动禁用指定编号的清单项（默认 501）
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @run-at       document-end
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    "use strict";

    const LOG_PREFIX = "[modalListDisabler]";

    // ---------- 配置 ----------
    /** 目标清单编号（匹配 label 中 `(数字)` 格式的编号） */
    const TARGET_LIST_ID = 501;

    /** 模态框容器选择器 */
    const CONTAINER_SELECTOR =
        "#modal-save-list > div.modal-card.fixed-height-600 > section > div > div:nth-child(1)";

    // ---------- 核心逻辑 ----------

    /**
     * 遍历容器子元素，对未选中状态的目标复选框执行禁用
     * 仅当复选框处于未选中态（!checked）时才禁用，
     * 已选中态不干预，保留用户取消勾选的能力。
     * @param {HTMLElement} container - 清单列表容器
     * @returns {boolean} 是否找到并处理了目标项
     */
    function disableTargetItem(container) {
        let found = false;
        for (const child of container.children) {
            const span = child.querySelector("label > span");
            if (!span) continue;
            const match = span.innerHTML.match(/\((\d+)\)/);
            if (match && parseInt(match[1], 10) === TARGET_LIST_ID) {
                const input = child.querySelector("label > input");
                // 仅未选中态才禁用：阻止用户勾选目标清单
                if (input && !input.disabled && !input.checked) {
                    input.disabled = true;
                    console.log(`${LOG_PREFIX} 已禁用清单 #${TARGET_LIST_ID}`);
                }
                found = true;
            }
        }
        return found;
    }

    /**
     * 尝试查找容器并执行禁用逻辑
     * @returns {boolean} 是否成功找到容器并执行
     */
    function tryDisable() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) return false;
        return disableTargetItem(container);
    }

    // ---------- 监听 ----------

    // 页面初始尝试（模态框可能在脚本执行前已存在）
    tryDisable();

    // MutationObserver：模态框动态插入 + 内容异步加载
    const observer = new MutationObserver(() => {
        tryDisable();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
