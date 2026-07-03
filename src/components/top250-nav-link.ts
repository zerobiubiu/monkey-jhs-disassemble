/**
 * Top250NavLink —— 导航栏"猜你喜歡"替换为 Top250 入口 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 handle（L71-73）：原
 * `$('.main-tabs ul li:contains("猜你喜歡")').html('<a href="/rankings/top"><span>Top250</span></a>')`，
 * 将"猜你喜歡" tab 内容替换为 Top250 链接。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染 Top250 导航入口的 HTML 字符串。
 * @returns nav link HTML，供 `.html()` 消费。
 */
export function Top250NavLink(): string {
    return '<a href="/rankings/top"><span>Top250</span></a>';
}
