/**
 * ReviewError —— 评论区获取失败 + 重试 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 fetchAndDisplayReviews（L171-173）：
 * 原 `container.append('<div style="...">获取评论失败 <a id="retryFetchReviews">重试</a></div>')`。
 * 由 `container.append(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染评论区获取失败 + 重试的 HTML 字符串。
 * @returns 失败提示 HTML，供 `.append()` 消费。
 */
export function ReviewError(): string {
    return '\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取评论失败\n                    <a id="retryFetchReviews" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            ';
}
