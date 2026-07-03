/**
 * HistoryStatusCell —— 鉴定记录表格"状态"列 formatter HTML 字符串组件。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData columns formatter
 * （L596-621）：依 status（filter/favorite/hasWatch）返回带状态色的 `<span>`，
 * 默认返回原 status 文本。与 doc/12 blacklist formatter 组件化一致。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** HistoryStatusCell 的属性。 */
export interface HistoryStatusCellProps {
    /** 显示文本（屏蔽/收藏/已观看 或原始 status）。 */
    text: string;
    /** 文字色（如 BLOCK_COLOR）。 */
    color: string;
}

/**
 * 渲染状态列单元格的 HTML 字符串。
 * @returns `<span style="color:...">text</span>`，供 Tabulator formatter 返回。
 */
export function HistoryStatusCell({ text, color }: HistoryStatusCellProps): string {
    return `<span style="color:${color}">${text}</span>`;
}
