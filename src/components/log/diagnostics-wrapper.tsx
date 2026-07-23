/**
 * DiagnosticsWrapper —— 插件诊断弹窗内容包装容器（React 函数组件，JSX）。
 *
 * 提取自 src/core/plugin-diagnostics.tsx 的 registerDiagnosticsMenu（L41）：
 * layer.open content 的 `` `<div style="padding:15px">${renderDiagnosticsHtml(...)}</div>` ``。
 * 内层诊断表格已是 renderDiagnosticsHtml 输出的 HTML 字符串，经
 * dangerouslySetInnerHTML 原样注入（jsxToString 对 dangerouslySetInnerHTML
 * 取 __html 原始输出，不转义），保持表格 HTML 完整。
 *
 * 保留原内联 padding（经 style 对象还原为 `padding:15px`，DOM 等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 layer.open content 消费时，
 * 需先用 `jsxToString`（来自 ./jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串：
 *   `content: jsxToString(<DiagnosticsWrapper html={renderDiagnosticsHtml(...)} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** DiagnosticsWrapper 的属性。 */
export interface DiagnosticsWrapperProps {
    /** 内层诊断表格 HTML（renderDiagnosticsHtml 输出），原样注入不转义。 */
    html: string;
}

/**
 * 渲染诊断弹窗包装容器的 JSX。
 * @param props.html 内层诊断表格 HTML，经 dangerouslySetInnerHTML 原样注入
 * @returns `<div style="padding:15px">表格HTML</div>` 的 React 元素，经
 *          jsxToString 转 HTML 字符串后供 layer.open content 消费。
 */
export function DiagnosticsWrapper({ html }: DiagnosticsWrapperProps) {
    return <div style={{ padding: '15px' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
