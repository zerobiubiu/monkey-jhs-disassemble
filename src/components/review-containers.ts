/**
 * ReviewContainers —— 评论区容器与页脚空容器 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 showReview（L135-136）：原两行
 * `target.append('<div id="reviewsContainer"></div>')` 与
 * `target.append('<div id="reviewsFooter"></div>')`。合并为一次 append 等价
 *（DOM 产出两个相邻兄弟 div，顺序一致）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染评论区容器 + 页脚空容器的 HTML 字符串。
 * @returns 两个 div 拼接的 HTML，供 `.append()` 消费。
 */
export function ReviewContainers(): string {
    return '<div id="reviewsContainer"></div><div id="reviewsFooter"></div>';
}
