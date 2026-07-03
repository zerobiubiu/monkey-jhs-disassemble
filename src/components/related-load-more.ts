/**
 * RelatedLoadMore —— 相关合集区加载更多按钮 + 全部已加载占位 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<button id="loadMoreRelateds">加载更多相关合集</button>`
 * 与 `<div id="relatedsEnd">已加载全部相关合集</div>`，由 `footer.html(html)` 消费。
 * 结构对称 ReviewLoadMore（doc/13 已提取）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染加载更多按钮 + 全部已加载占位的 HTML 字符串。
 * @returns loadMoreRelateds + relatedsEnd HTML，供 `.html()` 消费。
 */
export function RelatedLoadMore(): string {
    return '\n                <button id="loadMoreRelateds" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多相关合集\n                </button>\n                <div id="relatedsEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部相关合集</div>\n            ';
}
