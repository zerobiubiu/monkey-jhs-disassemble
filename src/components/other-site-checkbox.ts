/**
 * OtherSiteCheckbox —— 第三方站点启用复选框 HTML 字符串组件。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 renderSettingsArea（L400-403）map
 * 回调：每个站点产出 `<div>` 含 checkbox + label，由 checkboxContainer.innerHTML
 * 拼接消费。isJavdbSite 决定 align-items（center / flex-start）。
 *
 * 保留原 id/data-site-id/checked/label/内联 style 原样不动；
 * siteConfig.id / isEnabled / isJavdbSite 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** OtherSiteCheckbox 的属性。 */
export interface OtherSiteCheckboxProps {
    /** 站点 id（checkbox id = "checkbox-<id>"，label 显示名去 "Btn" 后缀）。 */
    id: string;
    /** 是否启用（checked 属性）。 */
    isEnabled: boolean;
    /** 是否 JavDb 站点（决定 align-items）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染单个站点启用复选框的 HTML 字符串。
 * @returns checkbox div HTML，供 innerHTML 拼接。
 */
export function OtherSiteCheckbox({
    id,
    isEnabled,
    isJavdbSite,
}: OtherSiteCheckboxProps): string {
    return `\n                <div style="margin-right: 15px; display: flex; align-items: ${isJavdbSite ? "center" : "flex-start"};">\n                    <input type="checkbox" id="checkbox-${id}" data-site-id="${id}" ${isEnabled ? "checked" : ""} style="margin-right: 8px; cursor: pointer;">\n                    <label for="checkbox-${id}" style="color: #333; font-weight: 500; cursor: pointer;">${id.replace("Btn", "")}</label>\n                </div>\n            `;
}
