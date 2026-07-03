/**
 * HistoryActionButtons —— 鉴定记录表格行操作按钮组 HTML 字符串组件。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData（L616 操作列
 * formatter）：行内操作区——
 *   - sub-btns 下拉：变更按钮（sub-btns-toggle，黄色）+ 子菜单
 *     （编辑 history-editBtn 蓝 / 移除 history-deleteBtn 灰 /
 *      已观看 history-hasWatchBtn / 收藏 history-favoriteBtn / 屏蔽 history-filterBtn）
 *   - 详情页按钮 history-detailBtn（蓝色）
 * 外层 div.action-btns 带 data-car-num / data-href 数据属性。
 *
 * 保留原 HTML 结构、id/class、内联 style 与 \n 转义、缩进、闭合标签，零偏差。
 * 番号/链接通过 data-* 属性注入；已观看/收藏/屏蔽三按钮的背景色与文案通过
 * props 注入（对应原 WATCHED_COLOR/TEXT、FAVORITE_COLOR/TEXT、BLOCK_COLOR/TEXT）。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 loadTableData 操作列 formatter
 * 直接 return。编辑按钮的 click 绑定（onRendered 回调内 addEventListener）
 * 仍由 formatter 持有，组件只负责静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：不用 JSX、
 * 不用 renderToStaticMarkup。
 */

/** HistoryActionButtons 的属性。 */
export interface HistoryActionButtonsProps {
    /** 行记录番号（写入 data-car-num）。 */
    carNum: string;
    /** 行记录来源链接（写入 data-href，空字符串表示无链接）。 */
    url: string;
    /** 已观看按钮背景色（原 WATCHED_COLOR）。 */
    watchedColor: string;
    /** 已观看按钮文案（原 WATCHED_TEXT）。 */
    watchedText: string;
    /** 收藏按钮背景色（原 FAVORITE_COLOR）。 */
    favoriteColor: string;
    /** 收藏按钮文案（原 FAVORITE_TEXT）。 */
    favoriteText: string;
    /** 屏蔽按钮背景色（原 BLOCK_COLOR）。 */
    blockColor: string;
    /** 屏蔽按钮文案（原 BLOCK_TEXT）。 */
    blockText: string;
}

/**
 * 渲染鉴定记录表格行操作按钮组的 HTML 字符串。
 * @param props.carNum 行记录番号。
 * @param props.url 行记录来源链接（空串表示无）。
 * @param props.watchedColor 已观看按钮背景色。
 * @param props.watchedText 已观看按钮文案。
 * @param props.favoriteColor 收藏按钮背景色。
 * @param props.favoriteText 收藏按钮文案。
 * @param props.blockColor 屏蔽按钮背景色。
 * @param props.blockText 屏蔽按钮文案。
 * @returns 操作按钮组 HTML，供 Tabulator formatter return。
 */
export function HistoryActionButtons({
    carNum,
    url,
    watchedColor,
    watchedText,
    favoriteColor,
    favoriteText,
    blockColor,
    blockText,
}: HistoryActionButtonsProps): string {
    return `\n                            <div class="action-btns" style="display: flex; gap: 5px;justify-content:center" data-car-num="${carNum}" data-href="${url}">\n                                <div class="sub-btns">\n                                    <a class="menu-btn sub-btns-toggle" style="background-color:#c59d36; color:white; margin-bottom: 5px;">\n                                        <span>✏️ 变更</span>\n                                    </a>\n                                    <div class="sub-btns-menu">\n                                        <a class="menu-btn history-editBtn" style="background-color:#007bff; color:white; margin-bottom: 5px;"> <span>✏️ 编辑</span> </a>\n                                        <a class="menu-btn history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                                        <a class="menu-btn history-hasWatchBtn" style="background-color:${watchedColor};margin-bottom: 5px">${watchedText}</a>\n                                        <a class="menu-btn history-favoriteBtn" style="background-color:${favoriteColor};margin-bottom: 5px">${favoriteText}</a>\n                                        <a class="menu-btn history-filterBtn" style="background-color:${blockColor};margin-bottom: 5px">${blockText}</a>\n                                    </div>\n                                </div>\n                                \n                                <a class="menu-btn history-detailBtn" style="background-color:#3397de; color:white; margin-bottom: 5px;"> <span>📄 详情页</span> </a>\n                                \n                            </div>\n                        `;
}
