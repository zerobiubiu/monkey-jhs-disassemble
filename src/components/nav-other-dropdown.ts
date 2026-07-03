/**
 * NavOtherDropdown —— 导航栏"其它"下拉菜单 HTML 字符串组件。
 *
 * 提取自 src/plugins/nav-bar-plugin.ts 的 mergeNav（L151-153）：原字符串注入
 * 导航栏"反饍"链接之后，合并"反饍/ThePornDude"入口到"其它"下拉
 * （navbar-item has-dropdown is-hoverable）。由 `.after(html)` 消费。
 *
 * 保留原 `<div class="navbar-item has-dropdown is-hoverable">` 结构、
 * navbar-link/navbar-dropdown/navbar-item 类、href、target、rel、\n 转义原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染导航栏"其它"下拉菜单的 HTML 字符串。
 * @returns 其它下拉 HTML，供 `.after()` 消费。
 */
export function NavOtherDropdown(): string {
    return '\n            <div class="navbar-item has-dropdown is-hoverable">\n                <a class="navbar-link">其它</a>\n                <div class="navbar-dropdown is-boxed">\n                  <a class="navbar-item" href="/feedbacks/new" target="_blank" >反饍</a>\n                  <a class="navbar-item" rel="nofollow noopener" target="_blank" href="https://theporndude.com/zh">ThePornDude</a>\n                </div>\n              </div>\n        ';
}
