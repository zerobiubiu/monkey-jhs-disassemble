/**
 * HistorySourceCell —— 鉴定记录表格"来源"列 formatter（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData columns formatter
 * （L568-587）：依 url 含 javdb/javbus/123av 返回带颜色的 `<span>`，否则返回
 * 灰色 url span。与 doc/12 blacklist formatter 组件化一致。
 *
 * 保留原 HTML 结构、内联 style 值（`color:<color>`，经 CSSProperties 对象还原为
 * `color:<color>` 字符串，值原样保留）零偏差。原模板无 `\n`/缩进，输出与原
 * HTML 字符串完全一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 来源列 formatter
 * `return jsxToString(<HistorySourceCell text={...} color={...} />)` 消费。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原 Tabulator formatter 字符串返回
 * 行为一致。
 */

/** HistorySourceCell 的属性。 */
export interface HistorySourceCellProps {
    /** 显示文本（"Javdb"/"JavBus"/"123Av" 或原始 url）。 */
    text: string;
    /** 文字色（如 "#d34f9e"）。 */
    color: string;
}

/**
 * 渲染来源列单元格的 JSX。
 * @param props.text 显示文本
 * @param props.color 文字色
 * @returns `<span style="color:...">text</span>` 的 React 元素，经 jsxToString
 *          转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function HistorySourceCell({ text, color }: HistorySourceCellProps) {
    return <span style={{ color }}>{text}</span>;
}
