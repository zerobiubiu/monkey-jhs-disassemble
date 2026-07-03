/**
 * Top250ErrorMessage —— Top250 拉取失败提示（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 handleTop（L191 / L213）：失败时
 * `movieListEl.html("<h3>...</h3>")` 显示错误信息。两条路径：
 *   - 后端返回失败（successFlag !== 1）：`<h3>${message}</h3>`（动态文案）
 *   - 重试 3 次均异常：`<h3>无法加载数据，请稍后再试。</h3>`（固定文案）
 * 由 `movieListEl.html(html)` 消费。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleTop 中 `.html()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `movieListEl.html(jsxToString(<Top250ErrorMessage message={message} />))`
 *   `movieListEl.html(jsxToString(<Top250LoadError />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** Top250ErrorMessage 的属性。 */
export interface Top250ErrorMessageProps {
    /** 后端返回的失败文案。 */
    message: string;
}

/**
 * 渲染后端返回失败提示的 JSX。
 * @param props.message 后端返回的失败文案
 * @returns `<h3>{message}</h3>` JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function Top250ErrorMessage({ message }: Top250ErrorMessageProps) {
    return <h3>{message}</h3>;
}

/**
 * 渲染重试耗尽提示的 JSX（固定文案）。
 * @returns `<h3>无法加载数据，请稍后再试。</h3>` JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function Top250LoadError() {
    return <h3>无法加载数据，请稍后再试。</h3>;
}
