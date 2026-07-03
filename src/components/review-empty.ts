/**
 * ReviewEmpty —— 评论区无评论提示 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 fetchAndDisplayReviews（L181-183）：
 * 原 `container.append('<div style="...">无评论</div>')`。由 `container.append(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染评论区无评论提示的 HTML 字符串。
 * @returns 无评论 HTML，供 `.append()` 消费。
 */
export function ReviewEmpty(): string {
    return '<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无评论</div>';
}
