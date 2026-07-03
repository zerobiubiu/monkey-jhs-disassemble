/**
 * ReviewLoadMore —— 评论区加载更多按钮 + 全部已加载占位 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 fetchAndDisplayReviews（L189-191）：
 * 原 `footer.html('<button id="loadMoreReviews">加载更多评论</button><div id="reviewsEnd">已加载全部评论</div>')`。
 * 由 `footer.html(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染加载更多按钮 + 全部已加载占位的 HTML 字符串。
 * @returns loadMoreReviews + reviewsEnd HTML，供 `.html()` 消费。
 */
export function ReviewLoadMore(): string {
    return '\n                <button id="loadMoreReviews" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多评论\n                </button>\n                <div id="reviewsEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>\n            ';
}
