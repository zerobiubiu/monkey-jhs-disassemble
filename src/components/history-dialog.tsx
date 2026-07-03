/**
 * HistoryDialog —— 鉴定记录弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 openHistory（L133，
 * 原 archetype/jhs.user.js L6497 的 layer.open content）：
 * 筛选区（dataType 下拉 + searchCarNum 搜索框 + 重置链接）+
 * 批量操作区（allSelectBox，含移除/已观看/收藏/屏蔽按钮）+
 * 表格容器（table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（filterBox/dataType/searchCarNum/clearSearchbtn/
 * allSelectBox/table-container）、类名（menu-btn/a-info/multiple-history-*）、
 * 内联 style 值（padding/height/overflow/display/gap/text-align/min-width/
 * margin-top/margin-left/calc 等，经 CSSProperties 对象还原为 kebab-case CSS
 * 字符串，值原样保留）、`<option selected>`（jsxToString 输出裸 `selected`
 * 属性）零偏差。状态下拉选项文案与批量按钮的背景色/文案通过 props 注入
 * （对应原 BLOCKED_TEXT/FAVORITED_TEXT/WATCHED_TEXT/WATCHED_COLOR/
 * FAVORITE_COLOR/FAVORITE_TEXT/BLOCK_COLOR/BLOCK_TEXT）。原模板中的 `\n`
 * 转义与缩进、闭合标签缺漏由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openHistory 中
 * `layer.open({ content: jsxToString(<HistoryDialog {...} />), ... })` 直接消费。
 * 事件绑定（筛选/搜索/重置/表格链接点击/dataType 变更）与 Tabulator 初始化
 * 仍由 openHistory 的 success 回调持有，组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。本面板含动态值（状态文案/颜色），故用 props。属性值
 * 不做转义，与原 layer.open content 字符串拼接行为一致。
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
 * 渲染鉴定记录弹窗的 JSX。
 * @param props.blockedText 屏蔽状态下拉选项文案。
 * @param props.favoritedText 收藏状态下拉选项文案。
 * @param props.watchedText 已观看状态下拉选项文案 / 已观看按钮文案。
 * @param props.watchedColor 已观看按钮背景色。
 * @param props.favoriteColor 收藏按钮背景色。
 * @param props.favoriteText 收藏按钮文案。
 * @param props.blockColor 屏蔽按钮背景色。
 * @param props.blockText 屏蔽按钮文案。
 * @returns 鉴定记录弹窗 React 元素（筛选区 + 批量操作区 + 表格容器），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 直接消费。
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
}: HistoryDialogProps) {
    return (
        <div
            style={{
                padding: "10px 20px",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <div id="filterBox" style={{ display: "flex", gap: "5px" }}>
                <select
                    id="dataType"
                    style={{
                        textAlign: "center",
                        minWidth: "150px",
                    }}
                >
                    <option value="all" selected={true}>
                        所有
                    </option>
                    <option value="filter">{blockedText}</option>
                    <option value="favorite">{favoritedText}</option>
                    <option value="hasWatch">{watchedText}</option>
                </select>
                <input
                    id="searchCarNum"
                    type="text"
                    placeholder="搜索番号|演员"
                    style={{ padding: "4px 5px" }}
                />
                <a
                    id="clearSearchbtn"
                    className="a-info"
                    style={{ marginLeft: "0" }}
                >
                    重置
                </a>
            </div>
            <div
                id="allSelectBox"
                style={{ marginTop: "8px", display: "none" }}
            >
                <a
                    className="menu-btn multiple-history-deleteBtn"
                    style={{
                        backgroundColor: "#8c8080",
                        color: "white",
                        marginBottom: "5px",
                    }}
                >
                    <span>✂️ 移除</span>
                </a>
                <a
                    className="menu-btn multiple-history-hasWatchBtn"
                    style={{
                        backgroundColor: watchedColor,
                        marginBottom: "5px",
                    }}
                >
                    {watchedText}
                </a>
                <a
                    className="menu-btn multiple-history-favoriteBtn"
                    style={{
                        backgroundColor: favoriteColor,
                        marginBottom: "5px",
                    }}
                >
                    {favoriteText}
                </a>
                <a
                    className="menu-btn multiple-history-filterBtn"
                    style={{
                        backgroundColor: blockColor,
                        marginBottom: "5px",
                    }}
                >
                    {blockText}
                </a>
            </div>
            <div
                id="table-container"
                style={{
                    height: "calc(100% - 50px)",
                    overflowX: "hidden",
                }}
            ></div>
        </div>
    );
}
