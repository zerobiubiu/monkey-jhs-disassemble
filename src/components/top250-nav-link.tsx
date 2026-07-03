/**
 * Top250NavLink —— 导航栏"猜你喜歡"替换为 Top250 入口（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 handle（L71-73）：原
 * `$('.main-tabs ul li:contains("猜你喜歡")').html('<a href="/rankings/top"><span>Top250</span></a>')`，
 * 将"猜你喜歡" tab 内容替换为 Top250 链接。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handle 中 `.html()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$('.main-tabs ...').html(jsxToString(<Top250NavLink />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染 Top250 导航入口的 JSX。
 * @returns nav link JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function Top250NavLink() {
    return (
        <a href="/rankings/top">
            <span>Top250</span>
        </a>
    );
}
