/**
 * HistoryDialog —— 鉴定记录弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/history-plugin.ts 的 openHistory（L133，
 * 原 archetype/jhs.user.js L6497 的 layer.open content）：
 * 筛选区（dataType 下拉 + searchCarNum 搜索框 + 重置链接）+
 * 批量操作区（allSelectBox，含移除/已观看/收藏/屏蔽按钮）+
 * 表格容器（table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（filterBox/dataType/searchCarNum/clearSearchbtn/
 * allSelectBox/table-container）、类名（menu-btn/a-info/multiple-history-*）、
 * 内联 style 原样不动；\n 转义与缩进、闭合标签缺漏亦原样保留，与原
 * content 字符串零偏差。状态下拉选项文案与批量按钮的背景色/文案通过
 * props 注入（对应原 BLOCKED_TEXT/FAVORITED_TEXT/WATCHED_TEXT/
 * WATCHED_COLOR/FAVORITE_COLOR/FAVORITE_TEXT/BLOCK_COLOR/BLOCK_TEXT）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 openHistory 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: HistoryDialog({ ... }), ... })`
 * 事件绑定（筛选/搜索/重置/表格链接点击/dataType 变更）与 Tabulator
 * 初始化仍由 openHistory 的 success 回调持有，组件只负责静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本面板含动态值（状态文案/颜色），故用 props。
 */

/** HistoryDialog 的属性。 */
interface HistoryDialogProps {
    /** 屏蔽状态下拉选项文案（原 BLOCKED_TEXT），用于 <option value="filter">。 */
    blockedText: string;
    /** 收藏状态下拉选项文案（原 FAVORITED_TEXT），用于 <option value="favorite">。 */
    favoritedText: string;
    /** 已观看状态下拉选项文案 / 已观看按钮文案（原 WATCHED_TEXT）。 */
    watchedText: string;
    /** 已观看按钮背景色（原 WATCHED_COLOR），用于 allSelectBox 内 hasWatchBtn。 */
    watchedColor: string;
    /** 收藏按钮背景色（原 FAVORITE_COLOR），用于 allSelectBox 内 favoriteBtn。 */
    favoriteColor: string;
    /** 收藏按钮文案（原 FAVORITE_TEXT），用于 allSelectBox 内 favoriteBtn。 */
    favoriteText: string;
    /** 屏蔽按钮背景色（原 BLOCK_COLOR），用于 allSelectBox 内 filterBtn。 */
    blockColor: string;
    /** 屏蔽按钮文案（原 BLOCK_TEXT），用于 allSelectBox 内 filterBtn。 */
    blockText: string;
}

/**
 * 渲染鉴定记录弹窗的 HTML 字符串。
 * @param props.blockedText 屏蔽状态下拉选项文案。
 * @param props.favoritedText 收藏状态下拉选项文案。
 * @param props.watchedText 已观看状态下拉选项文案 / 已观看按钮文案。
 * @param props.watchedColor 已观看按钮背景色。
 * @param props.favoriteColor 收藏按钮背景色。
 * @param props.favoriteText 收藏按钮文案。
 * @param props.blockColor 屏蔽按钮背景色。
 * @param props.blockText 屏蔽按钮文案。
 * @returns 鉴定记录弹窗 HTML（筛选区 + 批量操作区 + 表格容器），
 *          供 layer.open({ content }) 直接消费。
 */
export function HistoryDialog({
    blockedText,
    favoritedText,
    watchedText,
    watchedColor,
    favoriteColor,
    favoriteText,
    blockColor,
    blockText,
}: HistoryDialogProps): string {
    return `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div id="filterBox" style="display: flex;gap: 5px;">\n                    <select id="dataType" style="text-align: center;min-width: 150px;">\n                        <option value="all" selected>所有</option>\n                        <option value="filter">${blockedText}</option>\n                        <option value="favorite">${favoritedText}</option>\n                        <option value="hasWatch">${watchedText}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" style="padding: 4px 5px;">\n                    <a id="clearSearchbtn" class="a-info" style="margin-left: 0">重置</a>\n                </div>\n                <div id="allSelectBox" style="margin-top: 8px;display: none">\n                    <a class="menu-btn multiple-history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                    <a class="menu-btn multiple-history-hasWatchBtn" style="background-color:${watchedColor};margin-bottom: 5px">${watchedText}</a>\n                    <a class="menu-btn multiple-history-favoriteBtn" style="background-color:${favoriteColor};margin-bottom: 5px">${favoriteText}</a>\n                    <a class="menu-btn multiple-history-filterBtn" style="background-color:${blockColor};margin-bottom: 5px">${blockText}</a>\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px); overflow-x:hidden;"></div>\n            </div>\n        `;
}
