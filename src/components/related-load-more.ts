/**
 * RelatedLoadMore —— 相关清单区加载更多按钮 + 全部已加载占位 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<button id="loadMoreRelateds">加载更多清单</button>`
 * 与 `<div id="relatedEnd">已加载全部清单</div>`，由 `footer.html(html)` 消费。
 * 结构对称 ReviewLoadMore（doc/13 已提取），按钮 ID 沿用原版 loadMoreRelateds，
 * 占位 DOM ID 沿用原版单数 related 命名（relatedEnd），文案为原版"加载更多清单" /
 * "已加载全部清单"。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染加载更多按钮 + 全部已加载占位的 HTML 字符串。
 * @returns loadMoreRelateds + relatedEnd HTML，供 `.html()` 消费。
 */
export function RelatedLoadMore(): string {
    return '\n                <button id="loadMoreRelateds" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多清单\n                </button>\n                <div id="relatedEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>\n            ';
}
