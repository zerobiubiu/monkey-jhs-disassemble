/**
 * RelatedLoading —— 相关合集区加载中提示 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div id="relatedsLoading">获取相关合集中...</div>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewLoading（doc/13 已提取）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关合集区加载中提示的 HTML 字符串。
 * @returns relatedsLoading HTML，供 `.append()` 消费。
 */
export function RelatedLoading(): string {
    return '<div id="relatedsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取相关合集中...</div>';
}
