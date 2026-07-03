/**
 * BlacklistPaginationCounter —— 黑名单表格分页计数器 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L392，
 * 原 archetype/jhs.user.js L7603 的 paginationCounter 返回值）：
 * 渲染"演员: N &nbsp;&nbsp;&nbsp;番号总数: M"统计文案 + 空的
 * `<span id="checkBlacklistMsg">` 占位（供定时检测任务回调填充检测信息）。
 *
 * 保留原 HTML 结构、`<span id>` / style（margin-left: 10px）、`&nbsp;`
 * 实体（JSX 中解码为 U+00A0 字符，DOM 渲染等价）、末尾两个空格原样不动，
 * 与原模板零偏差。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 中 Tabulator
 * paginationCounter 回调消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<BlacklistPaginationCounter actorCount={...} currentCarCount={...} />)`
 * currentCarCount 由 getTableData 聚合后挂到 this.currentCarCount，调用方
 * 读取实例字段以 props 传入，组件保持纯模板。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始回调返回值行为一致。
 */

/** BlacklistPaginationCounter 的属性。 */
export interface BlacklistPaginationCounterProps {
    /** 当前页演员数（Tabulator paginationCounter 第 4 参 actorCount）。 */
    actorCount: number;
    /** 当前黑名单涉及的番号总数（getTableData 聚合到 this.currentCarCount）。 */
    currentCarCount: number;
}

/**
 * 渲染黑名单表格分页计数器的 JSX。
 * @param props.actorCount 当前页演员数
 * @param props.currentCarCount 番号总数
 * @returns 统计文案 + checkBlacklistMsg 占位 span 的 JSX，经 jsxToString 转 HTML 字符串后供 paginationCounter 返回。
 */
export function BlacklistPaginationCounter({
    actorCount,
    currentCarCount,
}: BlacklistPaginationCounterProps) {
    return (
        <>
            演员: {actorCount} &nbsp;&nbsp;&nbsp;番号总数: {currentCarCount}{"  "}
            <span
                id="checkBlacklistMsg"
                style={{ marginLeft: "10px" }}
            ></span>
        </>
    );
}
