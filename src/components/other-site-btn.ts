/**
 * OtherSiteBtn —— 详情页第三方站点按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 loadOtherSite（L141）map 回调：
 * 每个站点产出 `<a target="_blank" class="site-btn">` 含 `<span>` 站点名
 * （id 去掉 "Btn" 后缀），未启用时 display:none。由调用方循环拼接为
 * siteButtonsHtml 后注入 OtherSiteBox。
 *
 * 保留原 target/class/style/id/\<span> 结构原样不动；id / enabled 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** OtherSiteBtn 的属性。 */
export interface OtherSiteBtnProps {
    /** 站点 id（如 "missAvBtn"，按钮 id 与显示名去 "Btn" 后缀）。 */
    id: string;
    /** 是否启用（未启用时 display:none）。 */
    enabled: boolean;
}

/**
 * 渲染单个第三方站点按钮的 HTML 字符串。
 * @returns site-btn HTML，供循环拼接。
 */
export function OtherSiteBtn({ id, enabled }: OtherSiteBtnProps): string {
    return `<a target="_blank" class="site-btn" style="${enabled ? "" : "display:none"}" id="${id}"><span>${id.replace("Btn", "")}</span></a>`;
}
