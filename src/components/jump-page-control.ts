/**
 * JumpPageControl —— 列表页分页栏"跳转到指定页"控件 HTML 字符串组件。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 addJumpPageControl（L1031-1045）：
 * 原 jQuery 链式 `$("<input>", {...})` + `$("<button>", {...})` +
 * `$("<li>", { id }).append()` 创建元素，转换为返回 HTML 字符串 + `$(html)`
 * 创建，行为等价（同样产出 #jumpPageInput input + 跳转 button 包裹在
 * #gemini-jump-page-control li 内，挂到 .pagination-list 末尾）。
 *
 * 保留原属性（type/id/placeholder/min/value/style/text）、内联 style
 * （width:60px / margin-left:10px / padding:10px / border / font-size:14px /
 * padding:9px 8px / cursor:pointer / background-color:#f0f0f0）与按钮文案「跳转」，
 * 与原 jQuery 创建参数零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 addJumpPageControl 中
 * `$(JumpPageControl({ controlId, value }))` 创建后 `.append()` 到
 * .pagination-list；调用方再从生成 DOM 中 `#jumpPageInput` / `button`
 * 取出 jQuery 对象绑定 click/keypress。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 jQuery `$("<input>", { value })` 行为一致（value 数字转字符串渲染）。
 */

/** JumpPageControl 的属性。 */
export interface JumpPageControlProps {
    /** li 的 id（原 controlId = "gemini-jump-page-control"，用于去重判断）。 */
    controlId: string;
    /** input 的初始 value（原 currentPage + 1，即默认跳转目标页）。 */
    value: number | string;
}

/**
 * 渲染跳页控件（li > input + button）的 HTML 字符串。
 * @param props.controlId li 的 id
 * @param props.value input 初始值（默认跳转目标页）
 * @returns `<li id="..."><input .../><button ...>跳转</button></li>`，供 `$(html)` 消费。
 */
export function JumpPageControl({ controlId, value }: JumpPageControlProps): string {
    return `<li id="${controlId}"><input type="number" id="jumpPageInput" placeholder="页码" min="1" style="width: 60px; margin-left: 10px; padding: 10px; border: 1px solid #ccc; font-size: 14px;" value="${value}"><button style="margin-left: 5px; padding: 9px 8px; cursor: pointer; border: 1px solid #ccc; background-color: #f0f0f0; font-size: 14px;">跳转</button></li>`;
}
