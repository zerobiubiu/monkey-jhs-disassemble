/**
 * TemporaryImageContainer —— 图片查看器临时容器 React 组件。
 *
 * 提取自 src/main.tsx 的 showImageViewer（原 L184-186）：
 *   $('<div class="temporary-container" style="display:none;">')
 *     .append(`<img src="${t}" alt="${n}">`)
 *
 * 保留原 HTML 结构与 CSS 类名（temporary-container）、内联 style（display:none）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。
 * 供 showImageViewer 中 $() 消费时，用
 *   `renderToStaticMarkup(<TemporaryImageContainer src={t} alt={n} />)`
 *   （来自 react-dom/server）转换为 HTML 字符串后传入 $()。
 */
import type { CSSProperties } from "react";

export interface TemporaryImageContainerProps {
    /** 图片地址（对应原 showImageViewer 参数 t，已通过 typeof string 校验）。 */
    src: string;
    /** 图片 alt 文本（对应原 showImageViewer 参数 n，默认空串）。 */
    alt?: string;
}

/** 临时容器内联样式：初始隐藏，待 Viewer.show() 触发显示。 */
const CONTAINER_STYLE: CSSProperties = {
    display: "none",
};

/**
 * 图片查看器临时容器：包裹 <img> 于隐藏 div，供 Viewer 初始化读取后展示。
 * @param props.src 图片地址
 * @param props.alt 图片 alt 文本（缺省为空串）
 */
export function TemporaryImageContainer({
    src,
    alt = "",
}: TemporaryImageContainerProps) {
    return (
        <div className="temporary-container" style={CONTAINER_STYLE}>
            <img src={src} alt={alt} />
        </div>
    );
}
