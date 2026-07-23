/**
 * BlacklistStatusCell —— 黑名单表格"状态"列单元格 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L513，
 * 原 archetype/jhs.user.js L7670 的状态列 formatter 返回值）：
 * 根据是否停更渲染 `<span data-tip="..." style="...">状态文案</span>`，
 * 停更时 data-tip 填写停更说明、style 加红色（color: #cc4444;）。
 *
 * 保留原 HTML 结构、data-tip 属性、`<span style>` 内联色（注意停更用
 * `color: #cc4444;` 有尾分号）、文案原样不动，与原模板零偏差。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 中 Tabulator
 * 状态列 formatter 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<BlacklistStatusCell tipText={...} statusText={...} />)`
 * tipText/statusText 的计算（依赖 this.checkBlacklist_ruleTime）仍由
 * 调用方完成后以 props 传入，组件保持纯模板。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 formatter 返回值行为一致。
 */

/** BlacklistStatusCell 的属性。 */
export interface BlacklistStatusCellProps {
    /** 悬停提示（停更说明；正常检测时为空字符串）。 */
    tipText: string;
    /** 状态文案（"正常检测" 或 "停止检测"）。 */
    statusText: string;
}

/**
 * 渲染黑名单表格"状态"列单元格的 JSX。
 * @param props.tipText 悬停提示（停更说明，正常时为空）
 * @param props.statusText 状态文案
 * @returns `<span data-tip="..." style="...">statusText</span>` JSX，经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function BlacklistStatusCell({ tipText, statusText }: BlacklistStatusCellProps) {
    return (
        <span data-tip={tipText} style={{ color: tipText ? '#cc4444' : undefined }}>
            {statusText}
        </span>
    );
}
