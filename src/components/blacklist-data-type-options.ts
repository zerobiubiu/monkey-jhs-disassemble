/**
 * BlacklistDataTypeOptions —— 黑名单弹层性别下拉选项 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 getTableData（L339-341，
 * 原 archetype/jhs.user.js L7544 的 `$dataTypeSelect.html(...)`）：
 * 根据当前黑名单总数/男演员数/女演员数渲染三个 `<option>`（所有/男演员/
 * 女演员），带各自计数。供 `#dataType` select 在每次拉取数据后刷新选项。
 *
 * 保留原 HTML 结构、`<option value>` 属性、文案（含全角括号）、`\n` 转义与
 * 缩进原样不动，与原模板字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 getTableData 中
 * `$dataTypeSelect.html(BlacklistDataTypeOptions({...}))` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 jQuery `.html(htmlString)` 行为一致。
 */

/** BlacklistDataTypeOptions 的属性。 */
export interface BlacklistDataTypeOptionsProps {
    /** 黑名单总条数（"所有"选项计数）。 */
    totalCount: number;
    /** 男演员条数（"男演员"选项计数）。 */
    actorCount: number;
    /** 女演员条数（"女演员"选项计数）。 */
    actressCount: number;
}

/**
 * 渲染性别下拉选项的 HTML 字符串。
 * @param props.totalCount 黑名单总条数
 * @param props.actorCount 男演员条数
 * @param props.actressCount 女演员条数
 * @returns 三个 `<option>`（所有/男演员/女演员）HTML，供 .html() 消费。
 */
export function BlacklistDataTypeOptions({
    totalCount,
    actorCount,
    actressCount,
}: BlacklistDataTypeOptionsProps): string {
    return `\n            <option value="">所有 (${totalCount})</option>\n            <option value="actor">男演员 (${actorCount})</option>\n            <option value="actress">女演员 (${actressCount})</option>\n        `;
}
