/**
 * ReviewEnd —— 评论区全部已加载提示 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 fetchAndDisplayReviews（L218-220）：
 * 原 `footer.html('<div style="...">已加载全部评论</div>')`（评论数不足一页时）。
 * 由 `footer.html(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染评论区全部已加载提示的 HTML 字符串。
 * @returns 已加载全部评论 HTML，供 `.html()` 消费。
 */
export function ReviewEnd(): string {
    return '<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>';
}
