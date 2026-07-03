/**
 * Top250ErrorMessage —— Top250 拉取失败提示 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 handleTop（L191 / L213）：失败时
 * `movieListEl.html("<h3>...</h3>")` 显示错误信息。两条路径：
 *   - 后端返回失败（successFlag !== 1）：`<h3>${message}</h3>`（动态文案）
 *   - 重试 3 次均异常：`<h3>无法加载数据，请稍后再试。</h3>`（固定文案）
 * 由 `movieListEl.html(html)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染后端返回失败提示的 HTML 字符串。
 * @param message 后端返回的失败文案
 * @returns `<h3>${message}</h3>`，供 `.html()` 消费。
 */
export function Top250ErrorMessage(message: string): string {
    return `<h3>${message}</h3>`;
}

/**
 * 渲染重试耗尽提示的 HTML 字符串（固定文案）。
 * @returns `<h3>无法加载数据，请稍后再试。</h3>`，供 `.html()` 消费。
 */
export function Top250LoadError(): string {
    return "<h3>无法加载数据，请稍后再试。</h3>";
}
