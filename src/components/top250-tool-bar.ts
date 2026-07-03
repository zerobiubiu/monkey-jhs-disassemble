/**
 * Top250ToolBar —— Top250 榜单分类/年份/中字切换工具栏 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 toolBar（L241-246）：原模板拼接
 * `<div class="button-group">` 内含两组 conditionBox：分类按钮（全部/有码/无码/
 * 欧美/Fc2 + 含中字磁鏈/无字幕/重置）与年份按钮（当前年→2008），由
 * `this.contentBox.append(html)` 消费。年份按钮由调用方循环调用
 * Top250YearButton 拼接后以 yearButtonsHtml prop 注入。
 *
 * 保留原 HTML 结构、类名、内联 style、href、data-cnsub-value、\n 转义原样不动；
 * handleType / typeValue / hasCnsub / yearButtonsHtml 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** Top250ToolBar 的属性。 */
export interface Top250ToolBarProps {
    /** 当前分类类型（"all"/"video_type"/"year"）。 */
    handleType: string;
    /** 当前分类值（"0".."3" 或年份字符串）。 */
    typeValue: string;
    /** 中字过滤值（"1"含中字/"0"无字幕/""重置）。 */
    hasCnsub: string;
    /** 预拼接的年份按钮 HTML（由调用方循环 Top250YearButton 生成）。 */
    yearButtonsHtml: string;
}

/**
 * 渲染 Top250 分类/年份/中字切换工具栏的 HTML 字符串。
 * @returns button-group HTML，供 `.append()` 消费。
 */
export function Top250ToolBar({
    handleType,
    typeValue,
    hasCnsub,
    yearButtonsHtml,
}: Top250ToolBarProps): string {
    return `\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox" style="margin-bottom: 0!important;">\n                    <a style="padding:18px 18px !important;" class="button is-small ${handleType === "all" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${hasCnsub}">全部</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${typeValue === "0" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${hasCnsub}">有码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${typeValue === "1" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${hasCnsub}">无码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${typeValue === "2" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${hasCnsub}">欧美</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${typeValue === "3" ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${hasCnsub}">Fc2</a>\n                    \n                    <a style="padding:18px 18px !important;margin-left: 50px" class="button is-small ${hasCnsub === "1" ? "is-info" : ""}" data-cnsub-value="1">含中字磁鏈</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${hasCnsub === "0" ? "is-info" : ""}" data-cnsub-value="0">无字幕</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-cnsub-value="">重置</a>\n                </div>\n                \n                <div class="buttons has-addons" id="conditionBox">\n                    ${yearButtonsHtml}\n                </div>\n            </div>\n        `;
}
