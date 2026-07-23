/**
 * TemporaryImageContainer —— 图片查看器临时容器（React 函数组件，JSX）。
 *
 * 提取自 src/main.tsx 的 showImageViewer（原 L184-186）：
 *   $('<div class="temporary-container" style="display:none;">')
 *     .append(`<img src="${t}" alt="${n}">`)
 *
 * 保留原 HTML 结构与 CSS 类名（temporary-container）、内联 style（display:none）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。
 * 供 showImageViewer 中 $() 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `$(jsxToString(<TemporaryImageContainer src={t} alt={n} />))`
 *
 * 注：本组件为 JSX 模式验证试点，反转 doc/06 对该组件的"返回 HTML
 * 字符串"规定。doc/06 因 react-dom/server 致 +452 kB 膨胀而禁用 JSX；
 * 本组件改用自定义 jsxToString（仅类型依赖 react，零运行时依赖），
 * 评估轻量方案是否可接受（详见 doc/16-jsx-to-string.md）。
 */
import type { CSSProperties } from 'react';

export interface TemporaryImageContainerProps {
    /** 图片地址（对应原 showImageViewer 参数 t，已通过 typeof string 校验）。 */
    src: string;
    /** 图片 alt 文本（对应原 showImageViewer 参数 n，默认空串）。 */
    alt?: string;
}

/**
 * 图片查看器临时容器：返回包裹 <img> 的隐藏 div JSX，供 Viewer 初始化读取后展示。
 * @param props.src 图片地址
 * @param props.alt 图片 alt 文本（缺省为空串）
 * @returns React 元素 `<div class="temporary-container" style="display:none;"><img .../></div>`
 */
export function TemporaryImageContainer({ src, alt = '' }: TemporaryImageContainerProps) {
    const style: CSSProperties = { display: 'none' };
    return (
        <div className="temporary-container" style={style}>
            <img src={src} alt={alt} />
        </div>
    );
}
