/**
 * RankingContainers —— 热播/Top250 榜单页工具栏容器 + 影片列表容器（React 函数组件，JSX）。
 *
 * 为 HitShowPlugin.hookPage 与 Top250Plugin.hookPage 提供：先后 append
 * `<div class="tool-box" style="margin-top: 10px"></div>` 与
 * `<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>`
 * 两个空容器。合并为一次 append 等价（DOM 产出两个相邻兄弟 div，顺序一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 hookPage 中
 * `this.contentBox.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `this.contentBox.append(jsxToString(<RankingContainers />))`
 * Fragment 透明拼接 children，输出 `<div class="tool-box" style="margin-top:10px"></div><div class="movie-list h cols-4 vcols-8" style="margin-top:10px"></div>`。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原 `.append(htmlString)` 一致。
 */

/**
 * 渲染榜单页 tool-box + movie-list 两个空容器的 JSX。
 * @returns 两个 div 拼接的 JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RankingContainers() {
    return (
        <>
            <div className="tool-box" style={{ marginTop: "10px" }}></div>
            <div
                className="movie-list h cols-4 vcols-8"
                style={{ marginTop: "10px" }}
            ></div>
        </>
    );
}
