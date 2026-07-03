/**
 * RelatedContainers —— 相关合集区容器与页脚空容器 HTML 字符串组件。
 *
 * 为 RelatedPlugin.showRelated 提供：`<div id="relatedsContainer"></div>` 与
 * `<div id="relatedsFooter"></div>` 两个相邻 div，由 `target.append(html)` 消费。
 * 结构对称 ReviewContainers（doc/13 已提取）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关合集区容器 + 页脚空容器的 HTML 字符串。
 * @returns 两个 div 拼接的 HTML，供 `.append()` 消费。
 */
export function RelatedContainers(): string {
    return '<div id="relatedsContainer"></div><div id="relatedsFooter"></div>';
}
