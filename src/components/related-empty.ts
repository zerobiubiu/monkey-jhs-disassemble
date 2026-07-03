/**
 * RelatedEmpty —— 相关清单区无清单提示 HTML 字符串组件。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div>无清单</div>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewEmpty（doc/13 已提取），
 * 文案为原版"无清单"。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染相关清单区无清单提示的 HTML 字符串。
 * @returns 无清单 HTML，供 `.append()` 消费。
 */
export function RelatedEmpty(): string {
    return '<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无清单</div>';
}
