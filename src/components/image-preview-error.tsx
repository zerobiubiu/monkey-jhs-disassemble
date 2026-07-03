/**
 * ImagePreviewError —— 悬浮大图预览失败提示（React 函数组件，JSX）。
 *
 * 提取自 src/core/image-preview.ts 的 handleMouseEnter（L121-122）：原
 * `preview.innerHTML = '<div style="padding:10px;color:#f00;">图片加载失败</div>'`，
 * 图片 onerror 时填充。
 *
 * 保留原内联 style（对象化，值原样保留）与文案原样不动。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleMouseEnter 中
 * `preview.innerHTML = ...` 消费时，需先用 `jsxToString`（来自 ./jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `preview.innerHTML = jsxToString(<ImagePreviewError />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */
import type { CSSProperties } from "react";

/** 失败提示 div 的内联 style（padding/color），与原版一致。 */
const errorStyle: CSSProperties = {
    padding: "10px",
    color: "#f00",
};

/**
 * 渲染悬浮预览失败提示的 JSX。
 * @returns 失败提示 JSX，经 jsxToString 转 HTML 字符串后供 `preview.innerHTML` 消费。
 */
export function ImagePreviewError() {
    return <div style={errorStyle}>图片加载失败</div>;
}
