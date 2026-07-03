/**
 * HistorySourceCell —— 鉴定记录表格"来源"列 formatter HTML 字符串组件。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData columns formatter
 * （L568-587）：依 url 含 javdb/javbus/123av 返回带颜色的 `<span>`，否则返回
 * 灰色 url span。与 doc/12 blacklist formatter 组件化一致。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** HistorySourceCell 的属性。 */
export interface HistorySourceCellProps {
    /** 显示文本（"Javdb"/"JavBus"/"123Av" 或原始 url）。 */
    text: string;
    /** 文字色（如 "#d34f9e"）。 */
    color: string;
}

/**
 * 渲染来源列单元格的 HTML 字符串。
 * @returns `<span style="color:...">text</span>`，供 Tabulator formatter 返回。
 */
export function HistorySourceCell({ text, color }: HistorySourceCellProps): string {
    return `<span style="color:${color}">${text}</span>`;
}
