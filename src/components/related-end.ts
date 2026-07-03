/**
 * RelatedEnd —— 相关合集区全部已加载提示 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div>已加载全部相关合集</div>`
 * （合集数不足一页时）。由 `footer.html(html)` 消费。结构对称 ReviewEnd（doc/13 已提取）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关合集区全部已加载提示的 HTML 字符串。
 * @returns 已加载全部相关合集 HTML，供 `.html()` 消费。
 */
export function RelatedEnd(): string {
    return '<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部相关合集</div>';
}
