/**
 * OtherSiteBox —— 详情页第三方站点按钮容器 HTML 字符串组件。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 loadOtherSite（L132-143）：原模板
 * 拼接 `<div id="otherSiteBox" class="panel-block">` 内含站点按钮（由 siteConfigs
 * map 生成），由 `.append(boxHtml)` 消费（同时追加到 .movie-panel-info 与
 * .container .info）。站点按钮由调用方循环调用 OtherSiteBtn 拼接后以
 * siteButtonsHtml prop 注入。
 *
 * 保留原 id/类名、内联 style（isJavdbSite 决定 margin-top）、user-select:none、
 * \n 转义原样不动；siteButtonsHtml / isJavdbSite 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** OtherSiteBox 的属性。 */
export interface OtherSiteBoxProps {
    /** 预拼接的站点按钮 HTML（由调用方循环 OtherSiteBtn 生成）。 */
    siteButtonsHtml: string;
    /** 是否 JavDb 站点（决定 margin-top 数值）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染第三方站点按钮容器的 HTML 字符串。
 * @returns otherSiteBox HTML，供 `.append()` 消费。
 */
export function OtherSiteBox({
    siteButtonsHtml,
    isJavdbSite,
}: OtherSiteBoxProps): string {
    return `\n            <div id="otherSiteBox" class="panel-block" style="${isJavdbSite ? "margin-top:8px;font-size:13px" : "margin-top:10px;font-size:13px"}; user-select: none; ">\n                <div style="display: flex;gap: 5px;flex-wrap: wrap">\n                    ${siteButtonsHtml}\n                </div>\n            </div>\n        `;
}
