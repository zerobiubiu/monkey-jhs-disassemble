/**
 * ReviewLoadMore —— 评论区加载更多按钮 + 全部已加载占位（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.fetchAndDisplayReviews 提供：`<button id="loadMoreReviews">加载更多评论</button>`
 * 与 `<div id="reviewsEnd">已加载全部评论</div>`，由 `footer.html(html)` 消费。
 * 按钮 ID 沿用原版 loadMoreReviews，占位 DOM ID 沿用原版 reviewsEnd，
 * 文案为原版"加载更多评论" / "已加载全部评论"。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayReviews 中
 * `footer.html()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `footer.html(jsxToString(<ReviewLoadMore />))`
 * Fragment 透明拼接 button + div，输出与原模板拼接零偏差（紧凑化空白差异，
 * DOM 渲染等价）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染加载更多按钮 + 全部已加载占位的 JSX。
 * @returns loadMoreReviews + reviewsEnd JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function ReviewLoadMore() {
    return (
        <>
            <button
                id="loadMoreReviews"
                style={{
                    width: "100%",
                    backgroundColor: "#e1f5fe",
                    border: "none",
                    padding: "10px",
                    marginTop: "10px",
                    cursor: "pointer",
                    color: "#0277bd",
                    fontWeight: "bold",
                    borderRadius: "4px",
                }}
            >
                加载更多评论
            </button>
            <div
                id="reviewsEnd"
                style={{
                    display: "none",
                    textAlign: "center",
                    padding: "10px",
                    color: "#666",
                    marginTop: "10px",
                }}
            >
                已加载全部评论
            </div>
        </>
    );
}
