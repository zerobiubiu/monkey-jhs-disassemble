/**
 * SiteResultTag —— 第三方站点"多结果"角标 HTML 字符串组件。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 handleSite（L196/L223/L280）与
 * src/plugins/preview-video-plugin.ts 的 _searchContentIds（L250）：多处
 * `buttonEl.append('<span class="site-tag" style="top:-15px">多结果</span>')`，
 * 标注搜索命中多条结果。无动态值，固定文案。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染"多结果"角标的 HTML 字符串。
 * @returns site-tag span HTML，供 `.append()` 消费。
 */
export function SiteResultTag(): string {
    return '<span class="site-tag" style="top:-15px">多结果</span>';
}
