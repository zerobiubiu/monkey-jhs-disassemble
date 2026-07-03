/**
 * BlacklistUrlTypeCell —— 黑名单表格"屏蔽类型"列单元格 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L472，
 * 原 archetype/jhs.user.js L7627 的屏蔽类型列 formatter 返回值）：
 * 根据 url 是否含 "t=" 判定是"按所选分类屏蔽"还是"未筛选分类"，
 * 按所选分类时 `<span>` 加红色（color:#cc4444）。
 *
 * 保留原 HTML 结构、`<span style>` 内联色（注意按所选分类用 `color:#cc4444`
 * 无尾分号无尾空格，未筛选分类为空字符串）、文案原样不动，与原模板零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 loadTableData 中 Tabulator
 * 屏蔽类型列 formatter `return BlacklistUrlTypeCell({ hasTag })` 消费。
 * hasTag 的判定（`url.includes("t=")`）仍由调用方完成，组件保持纯模板。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 formatter 返回值行为一致。
 */

/** BlacklistUrlTypeCell 的属性。 */
export interface BlacklistUrlTypeCellProps {
    /** URL 是否含 "t="（true=按所选分类屏蔽，false=未筛选分类）。 */
    hasTag: boolean;
}

/**
 * 渲染黑名单表格"屏蔽类型"列单元格的 HTML 字符串。
 * @param props.hasTag URL 是否含 "t="
 * @returns `<span style="...">文案</span>`，供 Tabulator formatter 返回。
 */
export function BlacklistUrlTypeCell({ hasTag }: BlacklistUrlTypeCellProps): string {
    return `<span style="${hasTag ? "color:#cc4444" : ""}">${hasTag ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
}
