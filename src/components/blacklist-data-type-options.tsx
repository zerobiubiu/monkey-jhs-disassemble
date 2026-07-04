/**
 * BlacklistDataTypeOptions —— 黑名单弹层性别下拉选项 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 getTableData（L339-341，
 * 原 archetype/jhs.user.js L7544 的 `$dataTypeSelect.html(...)`）：
 * 根据当前黑名单总数/男演员数/女演员数渲染三个 `<option>`（所有/男演员/
 * 女演员），带各自计数。供 `#dataType` select 在每次拉取数据后刷新选项。
 *
 * 保留原 HTML 结构、`<option value>` 属性、文案（含全角括号）原样不动，
 * 与原模板零偏差（JSX 紧凑输出丢失 option 间 \n 空白，DOM 渲染等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 getTableData 中
 * `$dataTypeSelect.html(...)` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `$dataTypeSelect.html(jsxToString(<BlacklistDataTypeOptions {...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，
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
 * 渲染性别下拉选项的 JSX。
 * @param props.totalCount 黑名单总条数
 * @param props.actorCount 男演员条数
 * @param props.actressCount 女演员条数
 * @returns 三个 `<option>`（所有/男演员/女演员）JSX，经 jsxToString 转 HTML 字符串后供 .html() 消费。
 */
export function BlacklistDataTypeOptions({
    totalCount,
    actorCount,
    actressCount
}: BlacklistDataTypeOptionsProps) {
    return (
        <>
            <option value="">所有 ({totalCount})</option>
            <option value="actor">男演员 ({actorCount})</option>
            <option value="actress">女演员 ({actressCount})</option>
        </>
    );
}
