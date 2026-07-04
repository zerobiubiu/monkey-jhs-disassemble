/**
 * BlacklistUrlTypeCell —— 黑名单表格"屏蔽类型"列单元格 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L472，
 * 原 archetype/jhs.user.js L7627 的屏蔽类型列 formatter 返回值）：
 * 根据 url 是否含 "t=" 判定是"按所选分类屏蔽"还是"未筛选分类"，
 * 按所选分类时 `<span>` 加红色（color:#cc4444）。
 *
 * 保留原 HTML 结构、`<span style>` 内联色（注意按所选分类用 `color:#cc4444`
 * 无尾分号无尾空格，未筛选分类为空字符串）、文案原样不动，与原模板零偏差。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 中 Tabulator
 * 屏蔽类型列 formatter 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<BlacklistUrlTypeCell hasTag={hasTag} />)`
 * hasTag 的判定（`url.includes("t=")`）仍由调用方完成，组件保持纯模板。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 formatter 返回值行为一致。
 */

/** BlacklistUrlTypeCell 的属性。 */
export interface BlacklistUrlTypeCellProps {
    /** URL 是否含 "t="（true=按所选分类屏蔽，false=未筛选分类）。 */
    hasTag: boolean;
}

/**
 * 渲染黑名单表格"屏蔽类型"列单元格的 JSX。
 * @param props.hasTag URL 是否含 "t="
 * @returns `<span style="...">文案</span>` JSX，经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function BlacklistUrlTypeCell({ hasTag }: BlacklistUrlTypeCellProps) {
    return (
        <span style={{ color: hasTag ? '#cc4444' : undefined }}>
            {hasTag ? '按所选分类屏蔽' : '未筛选分类'}
        </span>
    );
}
