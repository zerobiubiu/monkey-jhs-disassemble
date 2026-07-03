/**
 * NewVideoDialogTitle —— 新作品检测弹窗标题 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 openDialog（L143）：layer.open 的
 * title 字段含 `<span data-tip="...">新作品检测 ❓</span>`，由 layer 作为标题 HTML
 * 渲染。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染新作品检测弹窗标题的 HTML 字符串。
 * @returns 标题 span HTML，供 layer.open title 消费。
 */
export function NewVideoDialogTitle(): string {
    return '<span style="padding: 0 10px;" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测 ❓</span>';
}
