/**
 * RankingContainers —— 热播/Top250 榜单页工具栏容器 + 影片列表容器 HTML 字符串组件。
 *
 * 提取自 src/plugins/hit-show-plugin.ts 的 hookPage（L61-66）与
 * src/plugins/top250-plugin.ts 的 hookPage（L90-95）：两处均先后 append
 * `<div class="tool-box" style="margin-top: 10px"></div>` 与
 * `<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>`
 * 两个空容器。合并为一次 append 等价（DOM 产出两个相邻兄弟 div，顺序一致）。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 `this.contentBox.append(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义，与原 `.append(htmlString)` 一致。
 */

/**
 * 渲染榜单页 tool-box + movie-list 两个空容器的 HTML 字符串。
 * @returns 两个 div 拼接的 HTML，供 `.append()` 消费。
 */
export function RankingContainers(): string {
    return '<div class="tool-box" style="margin-top: 10px"></div><div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>';
}
