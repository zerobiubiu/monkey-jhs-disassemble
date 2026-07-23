/**
 * ReviewStarIcon —— 评论评分星标图标（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/review-plugin.tsx L195 的 fill('<i class="icon-star"></i>')。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。消费时先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）
 * 转为 HTML 字符串：
 *   `Array(score).fill(jsxToString(<ReviewStarIcon />)).join('')`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染单个星标图标的 JSX。
 * @returns `<i class="icon-star"></i>` 的 React 元素
 */
export function ReviewStarIcon() {
    return <i className="icon-star"></i>;
}
