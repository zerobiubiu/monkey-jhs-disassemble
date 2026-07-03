/**
 * ListPanel —— 详情页清单平铺面板 HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 _ensureListPanel
 * （L693-695 的 createElement+insertAdjacentElement，原 archetype/jhs.user.js
 * L5637-5681）：一个空的 .jhs-list-panel 容器 div，插入到 #otherSiteBox
 * 之后；其内容由 _initListPanel 的 MutationObserver 从 #modal-save-list
 * 的 listContainer 克隆同步而来（跳过「預設清單」）。
 *
 * 保留原 class（jhs-list-panel）。原实现用 document.createElement("div")
 * + insertAdjacentElement，转换为返回 HTML 字符串 + insertAdjacentHTML，
 * 行为等价（同样产出空 div 容器，由后续 sync 填充）。
 *
 * 视觉样式（flex-wrap/gap/background 等）由 rating-bar.css 的
 * .jhs-list-panel 规则提供，组件只产出空容器契约。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串。无动态值，无 props。
 * 供 _ensureListPanel 中 `otherSite.insertAdjacentHTML("afterend", ListPanel())`
 * 消费。
 */

/**
 * 渲染清单平铺面板的空容器 HTML 字符串。
 * @returns `<div class="jhs-list-panel"></div>`，供 insertAdjacentHTML 消费。
 */
export function ListPanel(): string {
    return '<div class="jhs-list-panel"></div>';
}
