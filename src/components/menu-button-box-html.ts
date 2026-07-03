/**
 * MenuButtonBoxHtml —— 列表页顶部菜单按钮组 HTML 字符串组件。
 *
 * 提取自 src/plugins/list-page-button-plugin.ts 的 createMenuBtn：
 *   - JavDb 站（L135-137 的 containerEl.append）：两行按钮组（打开待鉴定/
 *     已收藏 + 演员页/标签页黑名单按钮 + 新作品检测/演员黑名单/排序切换）
 *   - JavBus 站（L155-157 的 .prepend）：单行按钮组（打开待鉴定/已收藏 +
 *     明星页黑名单+一键屏蔽 或 演员黑名单）
 *
 * 与同目录 menu-button-box.tsx（JSX 示范组件，孤立可用，不被 main.tsx 引入）
 * 内容等价，但本组件返回 HTML 字符串（模板拼接），遵循 doc/06 统一规定：
 * 不用 JSX、不用 renderToStaticMarkup（避免 react-dom/server 打包致产物膨胀）。
 *
 * 保留原 HTML 结构、CSS 类名（menu-btn main-tab-btn）、id（waitCheckBtn /
 * waitDownBtn / addBlacklistBtn / filterAllVideo / newVideoBtn / blacklistBtn /
 * sort-toggle-btn / newVideoCount）、data-tip 提示文案、内联 style（含
 * `!important`）、\n 转义与缩进、尾随空格原样不动，与原模板字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 createMenuBtn 中
 * `.append(html)` / `.prepend(html)` 消费：
 *   `containerEl.append(MenuButtonBoxHtml({ site: "javdb", ... }))`
 *   `$(".masonry").parent().prepend(MenuButtonBoxHtml({ site: "javbus", ... }))`
 * 调用方依站点/页面类型传入 actorsPage/tagsPage/advancedSearch/
 * searchOrUserPage/starPage 等布尔与 blacklistLabel/blacklistColor/sortLabel
 * 等动态值，组件内部按 site 分支拼装对应模板。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 jQuery `.append(htmlString)` 行为一致。
 */

/** 站点变体：javdb 两行布局 / javbus 单行布局。 */
export type MenuButtonSite = "javdb" | "javbus";

/** MenuButtonBoxHtml 的属性。 */
export interface MenuButtonBoxHtmlProps {
    /** 站点变体：javdb 两行 / javbus 单行。 */
    site: MenuButtonSite;
    /** 黑名单按钮文案（已加入时切「已加入黑名单」），默认「加入黑名单」。 */
    blacklistLabel?: string;
    /** 黑名单按钮底色（已加入时切 #885d5d），默认 #d22020。 */
    blacklistColor?: string;
    // —— JavDb 专用 ——
    /** JavDb 演员页（/actors/）：渲染 addBlacklistBtn + filterAllVideo。 */
    actorsPage?: boolean;
    /** JavDb 标签页（/tags）：渲染 addBlacklistBtn。 */
    tagsPage?: boolean;
    /** JavDb 高级搜索页（advanced_search）：关闭 flex-grow、隐藏 sort-toggle。 */
    advancedSearch?: boolean;
    /** JavDb 搜索/用户页：隐藏 sort-toggle。 */
    searchOrUserPage?: boolean;
    /** 排序方式文案（如「当前排序方式: 默认」），默认「当前排序方式: 默认」。 */
    sortLabel?: string;
    /** 新作品数量（#newVideoCount 初始值），默认 0。 */
    newVideoCount?: number | string;
    // —— JavBus 专用 ——
    /** JavBus 明星页（/star/）：渲染 addBlacklistBtn + filterAllVideo，否则渲染 blacklistBtn。 */
    starPage?: boolean;
}

const BLACKLIST_DEFAULT_LABEL = "加入黑名单";
const BLACKLIST_DEFAULT_COLOR = "#d22020";
/** 原 data-tip 文案（演员页与标签页均沿用此句，忠实保留）。 */
const BLACKLIST_TIP = "将演员加入黑名单, 后续有作品更新也会纳入屏蔽中";
const FILTER_ALL_TIP = "一键屏蔽已选分类的视频列表至鉴定记录中";
const SORT_DEFAULT_LABEL = "当前排序方式: 默认";

/**
 * 渲染列表页菜单按钮组的 HTML 字符串。
 * @param props.site 站点变体
 * @param props.blacklistLabel 黑名单按钮文案（默认「加入黑名单」）
 * @param props.blacklistColor 黑名单按钮底色（默认 #d22020）
 * @param props.actorsPage JavDb 演员页（渲染黑名单+一键屏蔽）
 * @param props.tagsPage JavDb 标签页（渲染黑名单）
 * @param props.advancedSearch JavDb 高级搜索页（关 flex-grow、隐 sort-toggle）
 * @param props.searchOrUserPage JavDb 搜索/用户页（隐 sort-toggle）
 * @param props.sortLabel 排序方式文案
 * @param props.newVideoCount 新作品数量
 * @param props.starPage JavBus 明星页（渲染黑名单+一键屏蔽，否则演员黑名单）
 * @returns 菜单按钮组 HTML，供 `.append()` / `.prepend()` 消费。
 */
export function MenuButtonBoxHtml({
    site,
    blacklistLabel = BLACKLIST_DEFAULT_LABEL,
    blacklistColor = BLACKLIST_DEFAULT_COLOR,
    actorsPage = false,
    tagsPage = false,
    advancedSearch = false,
    searchOrUserPage = false,
    sortLabel = SORT_DEFAULT_LABEL,
    newVideoCount = 0,
    starPage = false,
}: MenuButtonBoxHtmlProps): string {
    if (site === "javbus") {
        return `\n                <div style="margin: 10px; display: flex;">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    <a id="waitDownBtn" class="menu-btn main-tab-btn" style="background-color:#2caac0 !important;"><span>打开已收藏</span></a>\n                    \n                    ${starPage ? `    \n                        <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${blacklistColor} !important;" data-tip="${BLACKLIST_TIP}"><span>${blacklistLabel}</span></a>\n                        <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="${FILTER_ALL_TIP}"><span>一键屏蔽所有作品</span></a>\n                    ` : '<a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>'}\n                </div>\n            `;
    }
    const flexGrowStyle = advancedSearch ? "" : "flex-grow:1;";
    return `\n                <div style="display: flex;align-items: center; ${flexGrowStyle} ">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    <a id="waitDownBtn" class="menu-btn main-tab-btn" style="background-color:#2caac0 !important;"><span>打开已收藏</span></a>\n                    ${actorsPage ? `\n                     <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${blacklistColor} !important;" data-tip="${BLACKLIST_TIP}"><span>${blacklistLabel}</span></a>\n                     <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;margin-right: 30px!important;" data-tip="${FILTER_ALL_TIP}"><span>一键屏蔽所有作品</span></a>\n                    ` : ""}\n                    ${tagsPage ? `\n                      <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${blacklistColor} !important;" data-tip="${BLACKLIST_TIP}"><span>${blacklistLabel}</span></a>\n                    ` : ""}\n                </div>\n                <div style="display: flex;align-items: center;">\n                    <a id="newVideoBtn" class="menu-btn main-tab-btn" style="background-color:#2c6cc0 !important;"><span>新作品检测 (<span id="newVideoCount">${newVideoCount}</span>)</span></a>\n                    <a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>\n                    ${searchOrUserPage || advancedSearch ? "" : `<a id="sort-toggle-btn" class="menu-btn main-tab-btn" style="background-color:#8783ab !important;"> ${sortLabel} </a>`}\n                </div>\n            `;
}
