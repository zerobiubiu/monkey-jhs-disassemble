/**
 * ListPanelSkeletonSpan —— 清单平铺面板加载骨架占位 span（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.tsx 的 _showListPanelLoading
 * （L1127）：`Array.from({ length: 4 }, () => '<span class="jhs-list-panel__skeleton"
 * aria-hidden="true"></span>').join('')` 写入 `.jhs-list-panel__items` 的
 * innerHTML，以 4 个骨架 span 占位加载态。
 *
 * 保留原 class（jhs-list-panel__skeleton）与 aria-hidden="true" 属性原样不动；
 * 原空标签体 `<span ...></span>` 经 jsxToString 输出为 `<span ...></span>`
 * （非 void 标签保留闭合标签），DOM 等价。无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 _showListPanelLoading 中
 * `items.innerHTML = ...` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `items.innerHTML = Array.from({ length: 4 }, () => jsxToString(<ListPanelSkeletonSpan />)).join('')`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染单个骨架占位 span 的 JSX。
 * @returns `<span class="jhs-list-panel__skeleton" aria-hidden="true"></span>`
 *          的 React 元素，经 jsxToString 转 HTML 字符串后供 innerHTML 消费。
 */
export function ListPanelSkeletonSpan() {
    return <span className="jhs-list-panel__skeleton" aria-hidden="true"></span>;
}
