/**
 * HistoryNavButton —— 鉴定记录导航入口 HTML 字符串组件。
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
 * 保留原 HTML 结构、id、class、内联 style（#aade66 文字色、#b68625 背景）
 * 与 \n 转义、缩进，零偏差。三处文案均为硬编码「鉴定记录」，无动态值，
 * 仅以 variant 选择模板。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 handle 中
 * $(".navbar-end").prepend(...) / $(".navbar-search").before(...) /
 * $("#top-right-box").append(...) 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：不用 JSX、
 * 不用 renderToStaticMarkup。
 */

/** HistoryNavButton 的变体。 */
export type HistoryNavButtonVariant = "desktop" | "mini" | "javbus";

/** HistoryNavButton 的属性。 */
export interface HistoryNavButtonProps {
    /** 入口变体（desktop=JavDb 桌面 / mini=JavDb 迷你 / javbus=JavBus 顶栏）。 */
    variant: HistoryNavButtonVariant;
}

/**
 * 渲染鉴定记录导航入口的 HTML 字符串。
 * @param props.variant 入口变体。
 * @returns 对应变体的入口 HTML，供 jQuery .prepend()/.before()/.append() 消费。
 */
export function HistoryNavButton({ variant }: HistoryNavButtonProps): string {
    switch (variant) {
        case "desktop":
            return `<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <a id="historyBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-right:15px !important;">\n                        鉴定记录\n                    </a>\n                </div>`;
        case "mini":
            return `\n                <div class="navbar-item miniHistoryBtnBox">\n                    <a id="miniHistoryBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-left:0 !important;padding-right:0 !important;">\n                        鉴定记录\n                    </a>\n                </div>\n            `;
        case "javbus":
            return `\n                    <a id="historyBtn" class="menu-btn main-tab-btn" style="background-color:#b68625 !important;">\n                        鉴定记录\n                    </a>\n               `;
        default:
            return "";
    }
}
