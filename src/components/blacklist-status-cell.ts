/**
 * BlacklistStatusCell —— 黑名单表格"状态"列单元格 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L513，
 * 原 archetype/jhs.user.js L7670 的状态列 formatter 返回值）：
 * 根据是否停更渲染 `<span data-tip="..." style="...">状态文案</span>`，
 * 停更时 data-tip 填写停更说明、style 加红色（color: #cc4444;）。
 *
 * 保留原 HTML 结构、data-tip 属性、`<span style>` 内联色（注意停更用
 * `color: #cc4444;` 有尾分号）、文案原样不动，与原模板零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 loadTableData 中 Tabulator
 * 状态列 formatter `return BlacklistStatusCell({...})` 消费。
 * tipText/statusText 的计算（依赖 this.checkBlacklist_ruleTime）仍由
 * 调用方完成后以 props 传入，组件保持纯模板。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 formatter 返回值行为一致。
 */

/** BlacklistStatusCell 的属性。 */
export interface BlacklistStatusCellProps {
    /** 悬停提示（停更说明；正常检测时为空字符串）。 */
    tipText: string;
    /** 状态文案（"正常检测" 或 "停止检测"）。 */
    statusText: string;
}

/**
 * 渲染黑名单表格"状态"列单元格的 HTML 字符串。
 * @param props.tipText 悬停提示（停更说明，正常时为空）
 * @param props.statusText 状态文案
 * @returns `<span data-tip="..." style="...">statusText</span>`，供 Tabulator formatter 返回。
 */
export function BlacklistStatusCell({
    tipText,
    statusText,
}: BlacklistStatusCellProps): string {
    return `<span data-tip="${tipText}" style="${tipText ? "color: #cc4444;" : ""}">${statusText}</span>`;
}
