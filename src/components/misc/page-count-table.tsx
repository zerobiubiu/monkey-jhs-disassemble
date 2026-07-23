/**
 * PageCountTable —— 列表页过滤统计表格（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 filterMovieList（L565-568 的
 * clog.log 内容）：以 4 列 HTML 表格汇总本轮过滤的耗时（读取/组装/处理/总耗）
 * 与计数（屏蔽单番号/收藏/屏蔽演员/屏蔽关键词/已观看/待鉴定/总数），输出到
 * 控制台日志（clog.log，非 DOM 操作，但属 HTML 字符串模板拼接，按统一规定提取）。
 *
 * 保留原 HTML 结构、类名（countTable）、内联 style 值零偏差
 * （border-collapse:collapse / width:100% / padding:3px /
 * border:1px solid #ccc / font-weight:bold，经 CSSProperties 对象还原为
 * kebab-case CSS 字符串，值原样保留）、<strong> 加粗。原模板中的 `\n`
 * 转义与缩进、空行、尾随空格由 jsxToString 紧凑输出丢失（clog 日志变为
 * 单行紧凑形式，可读性略降但功能等价，与示范风格一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 filterMovieList 中
 * `clog.log(jsxToString(<PageCountTable {...} />))` 消费。各时间/计数字段
 * 由调用方从 utils.time() 返回值与 this.currentPageXxxCount 实例字段传入。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义。
 */
import type { CSSProperties } from 'react';

/** PageCountTable 的属性。 */
export interface PageCountTableProps {
    /** 读取数据耗时（utils.time("读取数据耗时") 返回值）。 */
    readDataTime: string;
    /** 组装数据耗时（utils.time("组装数据耗时") 返回值）。 */
    assembleDataTime: string;
    /** 处理页面耗时（utils.time("处理页面耗时") 返回值）。 */
    processPageTime: string;
    /** 累计耗费时间（utils.time("累计耗费时间") 返回值）。 */
    totalTime: string;
    /** 屏蔽单番号数量（currentPageFilterCount）。 */
    filterCount: number;
    /** 收藏数量（currentPageFavoriteCount）。 */
    favoriteCount: number;
    /** 屏蔽演员数量（currentPageActorFilterCount）。 */
    actorFilterCount: number;
    /** 屏蔽关键词数量（currentPageKeywordFilterCount）。 */
    keywordFilterCount: number;
    /** 已观看数量（currentPageHasWatchCount）。 */
    hasWatchCount: number;
    /** 待鉴定数量（currentPageWaitCheckCount）。 */
    waitCheckCount: number;
    /** 总数（currentPageTotalCount）。 */
    totalCount: number;
}

/**
 * 渲染列表页过滤统计表格的 JSX。
 * @param props 各时间与计数字段
 * @returns countTable 表格 React 元素，经 jsxToString 转 HTML 字符串后供
 *          clog.log 消费。
 */
export function PageCountTable({
    readDataTime,
    assembleDataTime,
    processPageTime,
    totalTime,
    filterCount,
    favoriteCount,
    actorFilterCount,
    keywordFilterCount,
    hasWatchCount,
    waitCheckCount,
    totalCount
}: PageCountTableProps) {
    const tableStyle: CSSProperties = {
        borderCollapse: 'collapse',
        width: '100%'
    };
    const tdStyle: CSSProperties = {
        padding: '3px',
        border: '1px solid #ccc'
    };
    const tdBoldStyle: CSSProperties = {
        padding: '3px',
        border: '1px solid #ccc',
        fontWeight: 'bold'
    };
    return (
        <table className="countTable" style={tableStyle}>
            <tr>
                <td colSpan={2} style={tdStyle}>
                    {readDataTime}
                </td>
                <td colSpan={2} style={tdStyle}>
                    {assembleDataTime}
                </td>
            </tr>
            <tr>
                <td colSpan={2} style={tdStyle}>
                    {processPageTime}
                </td>
                <td colSpan={2} style={tdStyle}>
                    {totalTime}
                </td>
            </tr>
            <tr>
                <td style={tdBoldStyle}>项目</td>
                <td style={tdBoldStyle}>数量</td>
                <td style={tdBoldStyle}>项目</td>
                <td style={tdBoldStyle}>数量</td>
            </tr>
            <tr>
                <td style={tdStyle}>屏蔽单番号</td>
                <td style={tdStyle}>
                    <strong>{filterCount}</strong>
                </td>
                <td style={tdStyle}>收藏</td>
                <td style={tdStyle}>
                    <strong>{favoriteCount}</strong>
                </td>
            </tr>
            <tr>
                <td style={tdStyle}>屏蔽演员</td>
                <td style={tdStyle}>
                    <strong>{actorFilterCount}</strong>
                </td>
                <td style={tdStyle}>屏蔽关键词</td>
                <td style={tdStyle}>
                    <strong>{keywordFilterCount}</strong>
                </td>
            </tr>
            <tr>
                <td style={tdStyle}>已观看</td>
                <td style={tdStyle}>
                    <strong>{hasWatchCount}</strong>
                </td>
                <td style={tdStyle}>待鉴定</td>
                <td style={tdStyle}>
                    <strong>{waitCheckCount}</strong>
                </td>
            </tr>
            <tr>
                <td style={tdStyle}>
                    <strong>总数</strong>
                </td>
                <td style={tdStyle}>
                    <strong>{totalCount}</strong>
                </td>
            </tr>
        </table>
    );
}
