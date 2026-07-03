/**
 * NavOtherDropdown —— 导航栏"其它"下拉菜单（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/nav-bar-plugin.ts 的 mergeNav（L151-153）：原字符串注入
 * 导航栏"反饍"链接之后，合并"反饍/ThePornDude"入口到"其它"下拉
 * （navbar-item has-dropdown is-hoverable）。由 `.after(html)` 消费。
 *
 * 保留原 `<div class="navbar-item has-dropdown is-hoverable">` 结构、
 * navbar-link/navbar-dropdown/navbar-item 类、href、target、rel 原样不动。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 mergeNav 中 `.after()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$('a.navbar-link...').parent().after(jsxToString(<NavOtherDropdown />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染导航栏"其它"下拉菜单的 JSX。
 * @returns 其它下拉 JSX，经 jsxToString 转 HTML 字符串后供 `.after()` 消费。
 */
export function NavOtherDropdown() {
    return (
        <div className="navbar-item has-dropdown is-hoverable">
            <a className="navbar-link">其它</a>
            <div className="navbar-dropdown is-boxed">
                <a
                    className="navbar-item"
                    href="/feedbacks/new"
                    target="_blank"
                >
                    反饍
                </a>
                <a
                    className="navbar-item"
                    rel="nofollow noopener"
                    target="_blank"
                    href="https://theporndude.com/zh"
                >
                    ThePornDude
                </a>
            </div>
        </div>
    );
}
