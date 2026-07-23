/**
 * TableLinkParam —— 鉴定记录表格番号/演员列可点击片段（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.tsx 的 loadTableData columns formatter：
 *   - 番号列（L474）：`<a class="table-link-param">${carNum 前缀}</a>` + 剩余部分；
 *   - 演员列（L488）：每个演员名渲染为 `<a class="table-link-param">${part}</a>`，
 *     以空格 join。
 * 点击行为由表格容器的事件委托按 `.table-link-param` 选择器处理，组件仅负责
 * 静态 HTML。
 *
 * 保留原 class（table-link-param）与无 href 的 `<a>` 结构原样不动；text 经
 * jsxToString 文本转义保护（与原模板直接插值在良构数据下输出一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 Tabulator 列 formatter 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串
 * 渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `return jsxToString(<TableLinkParam text={...} />) + suffix`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** TableLinkParam 的属性。 */
export interface TableLinkParamProps {
    /** 链接文本（番号前缀或演员名）。 */
    text: string;
}

/**
 * 渲染单个 `.table-link-param` 链接的 JSX。
 * @param props.text 链接文本
 * @returns `<a class="table-link-param">text</a>` 的 React 元素，经 jsxToString
 *          转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function TableLinkParam({ text }: TableLinkParamProps) {
    return <a className="table-link-param">{text}</a>;
}
