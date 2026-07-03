/**
 * Top250YearButton —— Top250 年份按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 toolBar（L242-243）循环体：当前年→2008
 * 每年一个 `<a class="button is-small">`，typeValue 等于该年时高亮 is-info，
 * href 指向 handleType=year&type_value=<year>。由调用方循环拼接为 yearButtonsHtml。
 *
 * 保留原 class（button is-small + is-info）、href（含 & 用表达式保留，避免 JSX
 * 实体解码）、内联 style（padding:18px 18px !important，!important 写值里）
 * 原样不动；year / typeValue / hasCnsub 通过 prop 注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 toolBar 循环拼接 yearButtonsHtml
 * 时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串再拼接：
 *   `yearButtonsHtml += jsxToString(<Top250YearButton year={year} typeValue={typeValue} hasCnsub={...} />)`
 * 拼接结果作为 yearButtonsHtml prop 注入 Top250ToolBar（经 dangerouslySetInnerHTML）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
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
 * 渲染单个 Top250 年份按钮的 JSX。
 * @returns 年份按钮 JSX，经 jsxToString 转 HTML 字符串后供循环拼接。
 */
export function Top250YearButton({
    year,
    typeValue,
    hasCnsub,
}: Top250YearButtonProps) {
    return (
        <a
            style={{ padding: "18px 18px !important" }}
            className={`button is-small ${typeValue === year.toString() ? "is-info" : ""}`}
            href={`/advanced_search?handleTop=1&handleType=year&type_value=${year}&has_cnsub=${hasCnsub}`}
        >
            {year}
        </a>
    );
}
