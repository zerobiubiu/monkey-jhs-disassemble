/**
 * HistoryStatusCell —— 鉴定记录表格"状态"列 formatter（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData columns formatter
 * （L596-621）：依 status（filter/favorite/hasWatch）返回带状态色的 `<span>`，
 * 默认返回原 status 文本。与 doc/12 blacklist formatter 组件化一致。
 *
 * 保留原 HTML 结构、内联 style 值（`color:<color>`，经 CSSProperties 对象还原为
 * `color:<color>` 字符串，值原样保留）零偏差。原模板无 `\n`/缩进，输出与原
 * HTML 字符串完全一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 状态列 formatter
 * `return jsxToString(<HistoryStatusCell text={...} color={...} />)` 消费。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原 Tabulator formatter 字符串返回
 * 行为一致。
 */

/** HistoryStatusCell 的属性。 */
export interface HistoryStatusCellProps {
    /** 显示文本（屏蔽/收藏/已观看 或原始 status）。 */
    text: string;
    /** 文字色（如 BLOCK_COLOR）。 */
    color: string;
}

/**
 * 渲染状态列单元格的 JSX。
 * @param props.text 显示文本
 * @param props.color 文字色
 * @returns `<span style="color:...">text</span>` 的 React 元素，经 jsxToString
 *          转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function HistoryStatusCell({
    text,
    color,
}: HistoryStatusCellProps) {
    return <span style={{ color }}>{text}</span>;
}
