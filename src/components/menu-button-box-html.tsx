/**
 * MenuButtonBoxHtml —— 列表页顶部菜单按钮组（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-page-button-plugin.ts 的 createMenuBtn：
 *   - JavDb 站（L135-137 的 containerEl.append）：两行按钮组（打开待鉴定/
 *     已收藏 + 演员页/标签页黑名单按钮 + 新作品检测/演员黑名单/排序切换）
 *
 * 保留原 HTML 结构、CSS 类名（menu-btn main-tab-btn）、id（waitCheckBtn /
 * waitDownBtn / addBlacklistBtn / filterAllVideo / newVideoBtn / blacklistBtn /
 * sort-toggle-btn / newVideoCount）、data-tip 提示文案、内联 style 值（含
 * `!important`，以字符串值形式写入 CSSProperties，jsxToString 原样输出）
 * 语义零偏差。原模板中的 `\n` 转义与缩进、尾随空格由 jsxToString 紧凑
 * 输出丢失（DOM/CSS 渲染等价，与示范风格一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createMenuBtn 中
 * `.append(html)` 消费：
 *   `containerEl.append(jsxToString(<MenuButtonBoxHtml ... />))`
 * 调用方依页面类型传入 actorsPage/tagsPage/advancedSearch/
 * searchOrUserPage 等布尔与 blacklistLabel/blacklistColor/sortLabel
 * 等动态值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 jQuery
 * `.append(htmlString)` 行为一致。
 */
import type { CSSProperties } from 'react';

/** MenuButtonBoxHtml 的属性。 */
export interface MenuButtonBoxHtmlProps {
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
}

const BLACKLIST_DEFAULT_LABEL = '加入黑名单';
const BLACKLIST_DEFAULT_COLOR = '#d22020';
/** 原 data-tip 文案（演员页与标签页均沿用此句，忠实保留）。 */
const BLACKLIST_TIP = '将演员加入黑名单, 后续有作品更新也会纳入屏蔽中';
const FILTER_ALL_TIP = '一键屏蔽已选分类的视频列表至鉴定记录中';
const SORT_DEFAULT_LABEL = '当前排序方式: 默认';

/**
 * 构造通用菜单按钮内联样式（background-color !important）。
 * @param backgroundColor 背景色字面量
 */
function menuBtnStyle(backgroundColor: string): CSSProperties {
    return { backgroundColor: `${backgroundColor} !important` };
}

/**
 * 渲染列表页菜单按钮组的 JSX。
 * @param props.blacklistLabel 黑名单按钮文案（默认「加入黑名单」）
 * @param props.blacklistColor 黑名单按钮底色（默认 #d22020）
 * @param props.actorsPage JavDb 演员页（渲染黑名单+一键屏蔽）
 * @param props.tagsPage JavDb 标签页（渲染黑名单）
 * @param props.advancedSearch JavDb 高级搜索页（关 flex-grow、隐 sort-toggle）
 * @param props.searchOrUserPage JavDb 搜索/用户页（隐 sort-toggle）
 * @param props.sortLabel 排序方式文案
 * @param props.newVideoCount 新作品数量
 * @returns 菜单按钮组 React 元素，经 jsxToString 转 HTML 字符串后供
 *          `.append()` 消费。
 */
export function MenuButtonBoxHtml({
    blacklistLabel = BLACKLIST_DEFAULT_LABEL,
    blacklistColor = BLACKLIST_DEFAULT_COLOR,
    actorsPage = false,
    tagsPage = false,
    advancedSearch = false,
    searchOrUserPage = false,
    sortLabel = SORT_DEFAULT_LABEL,
    newVideoCount = 0
}: MenuButtonBoxHtmlProps) {
    const showSortToggle = !searchOrUserPage && !advancedSearch;
    return (
        <>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexGrow: advancedSearch ? undefined : 1
                }}
            >
                <a
                    id="waitCheckBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle('#56c938')}
                >
                    <span>打开待鉴定</span>
                </a>
                <a
                    id="waitDownBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle('#2caac0')}
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
                                backgroundColor: '#e8ab39 !important',
                                marginRight: '30px!important'
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <a
                    id="newVideoBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle('#2c6cc0')}
                >
                    <span>
                        {'新作品检测 ('}
                        <span id="newVideoCount">{newVideoCount}</span>
                        {')'}
                    </span>
                </a>
                <a
                    id="blacklistBtn"
                    className="menu-btn main-tab-btn"
                    style={menuBtnStyle('#34393f')}
                >
                    <span>演员黑名单</span>
                </a>
                {showSortToggle && (
                    <a
                        id="sort-toggle-btn"
                        className="menu-btn main-tab-btn"
                        style={menuBtnStyle('#8783ab')}
                    >
                        {` ${sortLabel} `}
                    </a>
                )}
            </div>
        </>
    );
}
