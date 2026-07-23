/**
 * ColoredTextCell —— 通用带色文本单元格（React 函数组件，JSX）。
 *
 * 合并 HistorySourceCell / HistoryStatusCell：渲染
 * `<span style="color:...">text</span>`，供 Tabulator formatter 返回。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 formatter 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** ColoredTextCell 的属性。 */
export interface ColoredTextCellProps {
    /** 显示文本。 */
    text: string;
    /** 文字色（如 "#d34f9e"）。 */
    color: string;
}

/**
 * 渲染带色文本单元格的 JSX。
 * @returns `<span style="color:...">text</span>` 的 React 元素。
 */
export function ColoredTextCell({ text, color }: ColoredTextCellProps) {
    return <span style={{ color }}>{text}</span>;
}
