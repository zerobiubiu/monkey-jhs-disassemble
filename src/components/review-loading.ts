/**
 * ReviewLoading —— 评论区加载中提示 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 fetchAndDisplayReviews（L151-153）：
 * 原 `container.append('<div id="reviewsLoading" style="...">获取评论中...</div>')`。
 * 由 `container.append(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染评论区加载中提示的 HTML 字符串。
 * @returns reviewsLoading HTML，供 `.append()` 消费。
 */
export function ReviewLoading(): string {
    return '<div id="reviewsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取评论中...</div>';
}
