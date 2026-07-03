/**
 * MenuButtonBox —— 列表页顶部菜单按钮组 React 组件（示范，孤立可用，不被 main.tsx 引入）。
 *
 * 提取自 src/plugins/list-page-button-plugin.ts 的 createMenuBtn（L78-159）：
 *   - JavDb 站：两行按钮组（打开待鉴定/已收藏 + 演员页/标签页黑名单按钮 +
 *     新作品检测/演员黑名单/排序切换）
 *   - JavBus 站：单行按钮组（打开待鉴定/已收藏 + 明星页黑名单+一键屏蔽
 *     或 演员黑名单）
 *
 * 保留原 HTML 结构与 CSS 类名（menu-btn main-tab-btn）、id（waitCheckBtn /
 * waitDownBtn / addBlacklistBtn / filterAllVideo / newVideoBtn / blacklistBtn /
 * sort-toggle-btn / newVideoCount）、data-tip 提示文案、内联 style（含 `!important`，
 * React 19 以字符串保留）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。
 * 如需供 layer/jQuery 字符串消费，可用
 *   `renderToStaticMarkup(<MenuButtonBox {...props} />)`（来自 react-dom/server）
 * 转换后 `.append()` / `.prepend()`。
 */
import type { CSSProperties } from "react";

/** 站点变体：javdb 两行布局 / javbus 单行布局。 */
export type MenuButtonSite = "javdb" | "javbus";

export interface MenuButtonBoxProps {
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
    /** 排序方式文案（如「当前排序方式: 默认」）。 */
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
 * 构造通用菜单按钮内联样式（background-color !important）。
 * @param backgroundColor 背景色字面量
 */
function menuBtnStyle(backgroundColor: string): CSSProperties {
    return { backgroundColor: `${backgroundColor} !important` };
}

/**
 * 渲染列表页菜单按钮组。
 * - site="javbus"：单行，依 starPage 条件渲染 黑名单+一键屏蔽 或 演员黑名单。
 * - site="javdb"：两行，依 actorsPage/tagsPage/advancedSearch/searchOrUserPage
 *   条件渲染黑名单/一键屏蔽/排序切换按钮。
 * 类名、id、data-tip、内联样式与原 createMenuBtn 的 HTML 模板一致。
 */
export function MenuButtonBox({
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
}: MenuButtonBoxProps) {
    if (site === "javbus") {
        return (
            <div style={{ margin: "10px", display: "flex" }}>
                <a
                    id="waitCheckBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#56c938")}
                >
                    <span>打开待鉴定</span>
                </a>
                <a
                    id="waitDownBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#2caac0")}
                >
                    <span>打开已收藏</span>
                </a>
                {starPage ? (
                    <>
                        <a
                            id="addBlacklistBtn"
                            className="menu-btn main-tab-btn"
                            style={menuBtnStyle(blacklistColor)}
                            data-tip={BLACKLIST_TIP}
                        >
                            <span>{blacklistLabel}</span>
                        </a>
                        <a
                            id="filterAllVideo"
                            className="menu-btn main-tab-btn"
                            style={menuBtnStyle("#e8ab39")}
                            data-tip={FILTER_ALL_TIP}
                        >
                            <span>一键屏蔽所有作品</span>
                        </a>
                    </>
                ) : (
                    <a
                        id="blacklistBtn"
                        className="menu-btn main-tab-btn"
                        style={menuBtnStyle("#34393f")}
                    >
                        <span>演员黑名单</span>
                    </a>
                )}
            </div>
        );
    }

    const showSortToggle = !searchOrUserPage && !advancedSearch;
    return (
        <>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexGrow: advancedSearch ? undefined : 1,
                }}
            >
                <a
                    id="waitCheckBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#56c938")}
                >
                    <span>打开待鉴定</span>
                </a>
                <a
                    id="waitDownBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#2caac0")}
                >
                    <span>打开已收藏</span>
                </a>
                {actorsPage && (
                    <>
                        <a
                            id="addBlacklistBtn"
                            className="menu-btn main-tab-btn"
                            style={menuBtnStyle(blacklistColor)}
                            data-tip={BLACKLIST_TIP}
                        >
                            <span>{blacklistLabel}</span>
                        </a>
                        <a
                            id="filterAllVideo"
                            className="menu-btn main-tab-btn"
                            style={{
                                backgroundColor: "#e8ab39 !important",
                                marginRight: "30px !important",
                            }}
                            data-tip={FILTER_ALL_TIP}
                        >
                            <span>一键屏蔽所有作品</span>
                        </a>
                    </>
                )}
                {tagsPage && (
                    <a
                        id="addBlacklistBtn"
                        className="menu-btn main-tab-btn"
                        style={menuBtnStyle(blacklistColor)}
                        data-tip={BLACKLIST_TIP}
                    >
                        <span>{blacklistLabel}</span>
                    </a>
                )}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                <a
                    id="newVideoBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#2c6cc0")}
                >
                    <span>
                        {"新作品检测 ("}
                        <span id="newVideoCount">{newVideoCount}</span>
                        {")"}
                    </span>
                </a>
                <a
                    id="blacklistBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle("#34393f")}
                >
                    <span>演员黑名单</span>
                </a>
                {showSortToggle && (
                    <a
                        id="sort-toggle-btn"
                        className="menu-btn main-tab-btn"
                        style={menuBtnStyle("#8783ab")}
                    >
                        {` ${sortLabel} `}
                    </a>
                )}
            </div>
        </>
    );
}
