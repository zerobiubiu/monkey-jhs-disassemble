/**
 * ReviewLoading —— 评论区加载中提示（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.fetchAndDisplayReviews 提供：`<div id="reviewsLoading">获取评论中...</div>`，
 * 由 `container.append(html)` 消费。DOM ID 沿用原版 reviewsLoading，文案为原版"获取评论中..."。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayReviews 中
 * `container.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<ReviewLoading />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染评论区加载中提示的 JSX。
 * @returns reviewsLoading JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ReviewLoading() {
    return (
        <div
            id="reviewsLoading"
            style={{
                marginTop: "15px",
                backgroundColor: "#ffffff",
                padding: "10px",
                marginLeft: "-10px",
            }}
        >
            获取评论中...
        </div>
    );
}
