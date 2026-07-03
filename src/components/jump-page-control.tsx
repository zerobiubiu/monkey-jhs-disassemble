/**
 * JumpPageControl —— 列表页分页栏"跳转到指定页"控件（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 addJumpPageControl（L1031-1045）：
 * 原 jQuery 链式 `$("<input>", {...})` + `$("<button>", {...})` +
 * `$("<li>", { id }).append()` 创建元素，转换为 JSX 组件 + `$(html)` 创建，
 * 行为等价（同样产出 #jumpPageInput input + 跳转 button 包裹在
 * #gemini-jump-page-control li 内，挂到 .pagination-list 末尾）。
 *
 * 保留原属性（type/id/placeholder/min/value/style/text）、内联 style 值
 * （width:60px / margin-left:10px / padding:10px / border / font-size:14px /
 * padding:9px 8px / cursor:pointer / background-color:#f0f0f0）与按钮文案
 * 「跳转」，与原 jQuery 创建参数语义零偏差（CSSProperties 对象经
 * jsxToString 还原为 kebab-case CSS 字符串，值原样保留；input 作为 void
 * tag 由 jsxToString 输出自闭合 `<input ... />`，与原 `<input ...>` 在
 * jQuery DOM 构建上等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 addJumpPageControl 中
 * `$(jsxToString(<JumpPageControl controlId={controlId} value={currentPage + 1} />))`
 * 创建后 `.append()` 到 .pagination-list；调用方再从生成 DOM 中
 * `#jumpPageInput` / `button` 取出 jQuery 对象绑定 click/keypress。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 jQuery
 * `$("<input>", { value })` 行为一致（value 数字转字符串渲染）。
 */
import type { CSSProperties } from "react";

/** JumpPageControl 的属性。 */
export interface JumpPageControlProps {
    /** li 的 id（原 controlId = "gemini-jump-page-control"，用于去重判断）。 */
    controlId: string;
    /** input 的初始 value（原 currentPage + 1，即默认跳转目标页）。 */
    value: number | string;
}

/**
 * 渲染跳页控件（li > input + button）的 JSX。
 * @param props.controlId li 的 id
 * @param props.value input 初始值（默认跳转目标页）
 * @returns `<li id="..."><input .../><button ...>跳转</button></li>` 的
 *          React 元素，经 jsxToString 转 HTML 字符串后供 `$(html)` 消费。
 */
export function JumpPageControl({ controlId, value }: JumpPageControlProps) {
    const inputStyle: CSSProperties = {
        width: "60px",
        marginLeft: "10px",
        padding: "10px",
        border: "1px solid #ccc",
        fontSize: "14px",
    };
    const buttonStyle: CSSProperties = {
        marginLeft: "5px",
        padding: "9px 8px",
        cursor: "pointer",
        border: "1px solid #ccc",
        backgroundColor: "#f0f0f0",
        fontSize: "14px",
    };
    return (
        <li id={controlId}>
            <input
                type="number"
                id="jumpPageInput"
                placeholder="页码"
                min="1"
                style={inputStyle}
                value={value}
            />
            <button style={buttonStyle}>跳转</button>
        </li>
    );
}
