/**
 * BackToTopButton —— 回到顶部悬浮按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 addBackToTopBtn（L257-260）：原
 * `$(\`<div id="jhs-back-to-top" title="回到顶部">${svgIcon}</div>\`)` 创建，
 * 内嵌向上箭头 SVG。由 `$("body").append(btn)` 消费。CSS 由调用方 utils.insertStyle
 * 注入（#jhs-back-to-top 样式），本组件仅产出按钮 HTML。
 *
 * 保留原 id/title/SVG（viewBox/path d）原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染回到顶部悬浮按钮的 HTML 字符串。
 * @returns back-to-top 按钮 HTML，供 `$(html)` 创建后 `.append()` 消费。
 */
export function BackToTopButton(): string {
    const svgIcon = `<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z"></path></svg>`;
    return `<div id="jhs-back-to-top" title="回到顶部">${svgIcon}</div>`;
}
