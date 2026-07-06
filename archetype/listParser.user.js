// ==UserScript==
// @name         清单解析器
// @version      1.0
// @description  唤醒清单页面解析器
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/lists/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    "use strict";

    const SPAN_SELECTOR =
        "div.columns.is-mobile.section-columns span.actor-section-name";

    function insertWakeButton() {
        const span = document.querySelector(SPAN_SELECTOR);
        if (!span) return false;

        // 防止重复插入
        if (document.getElementById("lists-protocol-wake-btn")) return true;

        const btn = document.createElement("button");
        btn.id = "lists-protocol-wake-btn";
        btn.type = "button";
        btn.textContent = "唤醒解析器";
        // 内联还原 Bootstrap btn btn-sm btn-primary 风格（页面无 Bootstrap CSS）
        btn.style.marginLeft = "8px";
        btn.style.verticalAlign = "middle";
        btn.style.display = "inline-block";
        btn.style.fontWeight = "400";
        btn.style.lineHeight = "1.5";
        btn.style.textAlign = "center";
        btn.style.whiteSpace = "nowrap";
        btn.style.userSelect = "none";
        btn.style.border = "1px solid #0d6efd";
        btn.style.padding = "0.25rem 0.5rem";
        btn.style.fontSize = "0.875rem";
        btn.style.borderRadius = "0.25rem";
        btn.style.backgroundColor = "#0d6efd";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.style.transition =
            "color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out";
        btn.addEventListener("mouseenter", () => {
            btn.style.backgroundColor = "#0b5ed7";
            btn.style.borderColor = "#0a58ca";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.backgroundColor = "#0d6efd";
            btn.style.borderColor = "#0d6efd";
        });

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            // 完整 URL（origin + pathname），去除查询参数和 hash
            const fullUrl = location.origin + location.pathname;
            const protocolUrl = "lists://?url=" + encodeURIComponent(fullUrl);
            // 通过 location 跳转唤醒自定义协议
            location.href = protocolUrl;
        });

        // 插入到 actor-section-name 后，这通常在 <h2> 的第一行，保持内联显示
        span.insertAdjacentElement("afterend", btn);
        return true;
    }

    function waitForAndInsert(retries = 50, interval = 200) {
        let attempts = 0;
        const id = setInterval(() => {
            if (insertWakeButton() || ++attempts >= retries) clearInterval(id);
        }, interval);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => waitForAndInsert());
    } else {
        waitForAndInsert();
    }
})();
