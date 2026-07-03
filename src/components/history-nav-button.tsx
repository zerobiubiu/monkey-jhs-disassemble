/**
 * HistoryNavButton —— 鉴定记录导航入口（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 handle（L95/L100/L115）：
 * 三处「鉴定记录」入口按钮，按站点/位置分为三个变体——
 *   - desktop：JavDb 导航栏桌面入口（navbar-end prepend），
 *     div.historyBtnBox（has-sub-btns is-hoverable）内 a#historyBtn
 *   - mini：JavDb 导航栏迷你入口（navbar-search before），
 *     div.miniHistoryBtnBox 内 a#miniHistoryBtn
 *   - javbus：JavBus 顶栏入口（top-right-box append），
 *     a#historyBtn.menu-btn.main-tab-btn（黄色背景）
 *
 * 保留原 HTML 结构、id、class、内联 style 值（#aade66 文字色、#b68625 背景、
 * `!important` 以字符串值形式写入 CSSProperties，jsxToString 原样输出）零
 * 偏差。三处文案均为硬编码「鉴定记录」，无动态值，仅以 variant 选择模板。
 * 原模板中的 `\n` 转义与缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handle 中
 * `$(".navbar-end").prepend(jsxToString(<HistoryNavButton variant="desktop" />))`
 * / `.before(jsxToString(<HistoryNavButton variant="mini" />))` /
 * `$("#top-right-box").append(jsxToString(<HistoryNavButton variant="javbus" />))`
 * 消费。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** HistoryNavButton 的变体。 */
export type HistoryNavButtonVariant = "desktop" | "mini" | "javbus";

/** HistoryNavButton 的属性。 */
export interface HistoryNavButtonProps {
    /** 入口变体（desktop=JavDb 桌面 / mini=JavDb 迷你 / javbus=JavBus 顶栏）。 */
    variant: HistoryNavButtonVariant;
}

/**
 * 渲染鉴定记录导航入口的 JSX。
 * @param props.variant 入口变体。
 * @returns 对应变体的入口 React 元素，经 jsxToString 转 HTML 字符串后供
 *          jQuery .prepend()/.before()/.append() 消费。
 */
export function HistoryNavButton({ variant }: HistoryNavButtonProps) {
    switch (variant) {
        case "desktop":
            return (
                <div className="navbar-item has-sub-btns is-hoverable historyBtnBox">
                    <a
                        id="historyBtn"
                        className="navbar-link nav-btn"
                        style={{
                            color: "#aade66 !important",
                            paddingRight: "15px !important",
                        }}
                    >
                        鉴定记录
                    </a>
                </div>
            );
        case "mini":
            return (
                <div className="navbar-item miniHistoryBtnBox">
                    <a
                        id="miniHistoryBtn"
                        className="navbar-link nav-btn"
                        style={{
                            color: "#aade66 !important",
                            paddingLeft: "0 !important",
                            paddingRight: "0 !important",
                        }}
                    >
                        鉴定记录
                    </a>
                </div>
            );
        case "javbus":
            return (
                <a
                    id="historyBtn"
                    className="menu-btn main-tab-btn"
                    style={{ backgroundColor: "#b68625 !important" }}
                >
                    鉴定记录
                </a>
            );
        default:
            return null;
    }
}
