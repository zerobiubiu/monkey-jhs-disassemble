/**
 * ListPanel —— 详情页清单平铺面板（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 _ensureListPanel
 * （L693-695 的 insertAdjacentHTML，原 archetype/jhs.user.js L5637-5681）：
 * 一个空的 .jhs-list-panel 容器 div，插入到 #otherSiteBox 之后；其内容由
 * _initListPanel 的 MutationObserver 从 #modal-save-list 的 listContainer
 * 克隆同步而来（跳过「预设清单」）。
 *
 * 保留原 class（jhs-list-panel）。原实现用 insertAdjacentHTML 注入空 div
 * 容器，行为等价（同样产出空 div，由后续 sync 填充）。
 *
 * 视觉样式（flex-wrap/gap/background 等）由 rating-bar.css 的
 * .jhs-list-panel 规则提供，组件只产出空容器契约。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 _ensureListPanel 中
 * `otherSite.insertAdjacentHTML("afterend", jsxToString(<ListPanel />))` 消费。
 * 无动态值，无 props。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString`（src/core/jsx-to-string，仅类型依赖
 * react，零运行时依赖，不引入 react-dom/server）渲染为 HTML 字符串。
 */

/**
 * 渲染清单平铺面板空容器的 JSX。
 * @returns `<div class="jhs-list-panel"></div>` 对应的 JSX，经 jsxToString 转
 *          HTML 字符串后供 insertAdjacentHTML 消费。
 */
export function ListPanel() {
    return <div className="jhs-list-panel" />;
}
