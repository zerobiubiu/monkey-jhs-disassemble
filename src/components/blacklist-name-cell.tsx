/**
 * BlacklistNameCell —— 黑名单表格"演员"列单元格 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L414，
 * 原 archetype/jhs.user.js L7589 的演员列 formatter 返回值）：
 * 将演员名渲染为可点击外链 `<a class="open-url">`，携带 data-url/
 * href/data-name/target 属性，供 success 回调内 `.open-url` 选择器
 * 绑定点击跳转逻辑。
 *
 * 保留原 HTML 结构、类名（open-url）、data-url/href/data-name/target
 * 属性原样不动，与原模板零偏差。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 中 Tabulator
 * 演员列 formatter 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<BlacklistNameCell url={...} name={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 formatter 返回值行为一致。
 */

/** BlacklistNameCell 的属性。 */
export interface BlacklistNameCellProps {
    /** 演员黑名单 URL（同时写入 data-url 与 href）。 */
    url: string;
    /** 演员名（同时写入 data-name 与 `<a>` 文本）。 */
    name: string;
}

/**
 * 渲染黑名单表格"演员"列单元格的 JSX。
 * @param props.url 演员黑名单 URL
 * @param props.name 演员名
 * @returns `<a class="open-url" ...>name</a>` JSX，经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function BlacklistNameCell({ url, name }: BlacklistNameCellProps) {
    return (
        <a className="open-url" data-url={url} href={url} data-name={name} target="_blank">
            {name}
        </a>
    );
}
