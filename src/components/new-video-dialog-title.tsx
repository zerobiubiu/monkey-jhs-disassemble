/**
 * NewVideoDialogTitle —— 新作品检测弹窗标题（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 openDialog（L143）：layer.open 的
 * title 字段含 `<span data-tip="...">新作品检测 ❓</span>`，由 layer 作为标题 HTML
 * 渲染。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openDialog 中 layer.open title
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `layer.open({ title: jsxToString(<NewVideoDialogTitle />), ... })`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染新作品检测弹窗标题的 JSX。
 * @returns 标题 span JSX，经 jsxToString 转 HTML 字符串后供 layer.open title 消费。
 */
export function NewVideoDialogTitle() {
    return (
        <span
            style={{ padding: "0 10px" }}
            data-tip="数据来源: 女优页面首页,含磁链分类"
        >
            新作品检测 ❓
        </span>
    );
}
