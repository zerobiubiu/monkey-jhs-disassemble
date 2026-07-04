// ==UserScript==
// @name         Javdb 键盘翻页
// @version      1.0
// @description  对 Javdb 的内容使用左右方向键来翻页
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @exclude      https://javdb*.com/v/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    'use strict';

    // ✏️ 根据页面实际情况修改这两行选择器：
    const SELECTOR_LEFT = "body > section > div > nav > a.pagination-previous";
    const SELECTOR_RIGHT = "body > section > div > nav > a.pagination-next";

    // 当焦点在输入框/编辑器时不拦截方向键
    function isTyping() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        const editable = el.isContentEditable;
        return editable ||
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT';
    }

    function safeClick(a) {
        if (!a) return false;
        // 优先用原生 click
        if (typeof a.click === 'function') {
            a.click();
            return true;
        }
        // 兜底派发 MouseEvent（注意 isTrusted 无法伪造）
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        return a.dispatchEvent(evt);
    }

    // 避免长按方向键连发：需要按下再抬起才接受下一次
    let lockLeft = false;
    let lockRight = false;

    window.addEventListener('keydown', (e) => {
        if (isTyping()) return;
        if (e.key === 'ArrowLeft' && !lockLeft) {
            const a = document.querySelector(SELECTOR_LEFT) || null;
            if (a) {
                e.preventDefault();
                safeClick(a);
                lockLeft = true;
            }
        } else if (e.key === 'ArrowRight' && !lockRight) {
            const a = document.querySelector(SELECTOR_RIGHT) || null;
            if (a) {
                e.preventDefault();
                safeClick(a);
                lockRight = true;
            }
        }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft') lockLeft = false;
        if (e.key === 'ArrowRight') lockRight = false;
    });
})();
