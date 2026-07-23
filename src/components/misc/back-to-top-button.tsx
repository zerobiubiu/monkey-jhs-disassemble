/**
 * BackToTopButton —— 回到顶部悬浮按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 addBackToTopBtn（L257-260）：原
 * `$(`<div id="jhs-back-to-top" title="回到顶部">${svgIcon}</div>`)` 创建，
 * 内嵌向上箭头 SVG。由 `$("body").append(btn)` 消费。CSS 由调用方 utils.insertStyle
 * 注入（#jhs-back-to-top 样式），本组件仅产出按钮 HTML。
 *
 * 保留原 id/title/SVG（viewBox/path d）原样不动。SVG 在 JSX 中为原生元素，
 * `viewBox` 已是 camelCase（JSX 合法），`path` 自闭合由 jsxToString 还原为
 * `<path ...></path>`（与原 `</path>` 闭合一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 addBackToTopBtn 中 `$()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串：
 *   `const btn = $(jsxToString(<BackToTopButton />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 jQuery `$(htmlString)` 行为一致。
 */

/**
 * 渲染回到顶部悬浮按钮的 JSX。
 * @returns back-to-top 按钮 JSX（含内嵌向上箭头 SVG），经 jsxToString 转 HTML
 *          字符串后供 `$(html)` 创建后 `.append()` 消费。
 */
export function BackToTopButton() {
    return (
        <div id="jhs-back-to-top" title="回到顶部">
            <svg viewBox="0 0 24 24">
                <path d="M12 4l-8 8h6v8h4v-8h6z" />
            </svg>
        </div>
    );
}
