/**
 * RelatedContainers —— 相关清单区容器与页脚空容器 HTML 字符串组件。
 *
 * 为 RelatedPlugin.showRelated 提供：`<div id="relatedContainer"></div>` 与
 * `<div id="relatedFooter"></div>` 两个相邻 div，由 `target.append(html)` 消费。
 * 结构对称 ReviewContainers（doc/13 已提取），DOM ID 沿用原版单数 related 命名。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关清单区容器 + 页脚空容器的 HTML 字符串。
 * @returns 两个 div 拼接的 HTML，供 `.append()` 消费。
 */
export function RelatedContainers(): string {
    return '<div id="relatedContainer"></div><div id="relatedFooter"></div>';
}
