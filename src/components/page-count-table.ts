/**
 * PageCountTable —— 列表页过滤统计表格 HTML 字符串组件。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 filterMovieList（L565-568 的
 * clog.log 内容）：以 4 列 HTML 表格汇总本轮过滤的耗时（读取/组装/处理/总耗）
 * 与计数（屏蔽单番号/收藏/屏蔽演员/屏蔽关键词/已观看/待鉴定/总数），输出到
 * 控制台日志（clog.log，非 DOM 操作，但属 HTML 字符串模板拼接，按统一规定提取）。
 *
 * 保留原 HTML 结构、类名（countTable）、内联 style（border-collapse:collapse /
 * width:100% / padding:3px / border:1px solid #ccc / font-weight:bold）、
 * <strong> 加粗、\n 转义与缩进、尾随空格与空行原样不动，与原模板零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 filterMovieList 中
 * `clog.log(PageCountTable({ ... }))` 消费。各时间/计数字段由调用方从
 * utils.time() 返回值与 this.currentPageXxxCount 实例字段传入。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义。
 */

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
 * 渲染列表页过滤统计表格的 HTML 字符串。
 * @param props 各时间与计数字段
 * @returns countTable 表格 HTML，供 clog.log 消费。
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
    totalCount,
}: PageCountTableProps): string {
    return `\n            <table class="countTable" style='border-collapse: collapse; width: 100%'>\n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${readDataTime}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${assembleDataTime}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${processPageTime}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${totalTime}</td>\n                </tr>\n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽单番号</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${filterCount}</strong></td>\n                     <td style='padding: 3px; border: 1px solid #ccc;'>收藏</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${favoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽演员</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${actorFilterCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽关键词</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${keywordFilterCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>已观看</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${hasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>待鉴定</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${waitCheckCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                </tr>\n        \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>总数</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${totalCount}</strong></td>\n                </tr>\n            </table>\n        `;
}
