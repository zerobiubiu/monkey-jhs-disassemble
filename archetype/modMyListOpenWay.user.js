// ==UserScript==
// @name         修改我的清单打开方式
// @version      1.0
// @description  修改Javdb的我的清单的打开方式
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/users/lists*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    "use strict";
    const last = location.pathname.split("/").filter(Boolean).at(-1);

    const ul = document.querySelector("#lists > ul");
    const lis = ul.children;

    const isListsPage = last === "lists";
    const page = Number(new URLSearchParams(location.search).get("page")) || 1;

    // 第一项是"所有清单"入口，仅在首页隐藏
    if (isListsPage && page < 2) {
        lis[0].style.display = "none";
    }

    for (let i = (isListsPage && page < 2) ? 1 : 0; i < lis.length; i++) {
        const a = lis[i].querySelector("div.column.is-10 > a");
        a.target = "_blank";

        if (isListsPage) {
            const id = new URL(a.href).searchParams.get("id");
            a.href = `/lists/${id}`;
        }
    }
})();
