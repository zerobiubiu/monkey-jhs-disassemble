/**
 * Top250YearButton —— Top250 年份按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 toolBar（L242-243）循环体：当前年→2008
 * 每年一个 `<a class="button is-small">`，typeValue 等于该年时高亮 is-info，
 * href 指向 handleType=year&type_value=<year>。由调用方循环拼接为 yearButtonsHtml。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** Top250YearButton 的属性。 */
export interface Top250YearButtonProps {
    /** 年份。 */
    year: number;
    /** 当前分类值（等于 year.toString() 时高亮 is-info）。 */
    typeValue: string;
    /** 中字过滤值，拼入 href。 */
    hasCnsub: string;
}

/**
 * 渲染单个 Top250 年份按钮的 HTML 字符串。
 * @returns 年份按钮 HTML，供循环拼接。
 */
export function Top250YearButton({
    year,
    typeValue,
    hasCnsub,
}: Top250YearButtonProps): string {
    return `\n                <a style="padding:18px 18px !important;" \n                   class="button is-small ${typeValue === year.toString() ? "is-info" : ""}" \n                   href="/advanced_search?handleTop=1&handleType=year&type_value=${year}&has_cnsub=${hasCnsub}">\n                  ${year}\n                </a>\n            `;
}
