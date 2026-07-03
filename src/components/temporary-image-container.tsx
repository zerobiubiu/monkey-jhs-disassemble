/**
 * TemporaryImageContainer —— 图片查看器临时容器（返回 HTML 字符串）。
 *
 * 提取自 src/main.tsx 的 showImageViewer（原 L184-186）：
 *   $('<div class="temporary-container" style="display:none;">')
 *     .append(`<img src="${t}" alt="${n}">`)
 *
 * 保留原 HTML 结构与 CSS 类名（temporary-container）、内联 style（display:none）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 showImageViewer 中 $() 直接消费：
 *   `$(TemporaryImageContainer({ src: t, alt: n }))`
 *
 * 统一规定：HTML→组件转换一律返回 HTML 字符串，不用 JSX、不用
 * renderToStaticMarkup（避免引入 react-dom/server 导致产物膨胀）。
 * 属性值不做转义，与原始 jQuery `.append(htmlString)` 行为一致。
 */

export interface TemporaryImageContainerProps {
    /** 图片地址（对应原 showImageViewer 参数 t，已通过 typeof string 校验）。 */
    src: string;
    /** 图片 alt 文本（对应原 showImageViewer 参数 n，默认空串）。 */
    alt?: string;
}

/**
 * 图片查看器临时容器：返回包裹 <img> 的隐藏 div HTML 字符串，供 Viewer 初始化读取后展示。
 * @param props.src 图片地址
 * @param props.alt 图片 alt 文本（缺省为空串）
 * @returns HTML 字符串 `<div class="temporary-container" style="display:none;"><img ...></div>`
 */
export function TemporaryImageContainer({
    src,
    alt = "",
}: TemporaryImageContainerProps): string {
    return `<div class="temporary-container" style="display:none;"><img src="${src}" alt="${alt}"></div>`;
}
