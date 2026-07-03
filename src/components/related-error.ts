/**
 * RelatedError —— 相关清单区获取失败 + 重试 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：失败提示 + `<a id="retryFetchRelateds">重试</a>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewError（doc/13 已提取），
 * 文案为原版"获取清单失败"，重试按钮 ID 沿用原版 retryFetchRelateds。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关清单区获取失败 + 重试的 HTML 字符串。
 * @returns 失败提示 HTML，供 `.append()` 消费。
 */
export function RelatedError(): string {
    return '\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取清单失败\n                    <a id="retryFetchRelateds" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            ';
}
