/**
 * ImagePreviewImg —— 悬浮大图预览成功时填充的 `<img>` HTML 字符串组件。
 *
 * 提取自 src/core/image-preview.ts 的 handleMouseEnter（L109）：原
 * `preview.innerHTML = \`<img src="${imgSrc}" alt="预览图">\``，图片 onload 后填充。
 *
 * 保留原 alt 文案原样不动；src 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** ImagePreviewImg 的属性。 */
export interface ImagePreviewImgProps {
    /** 图片源地址。 */
    src: string;
}

/**
 * 渲染悬浮预览 `<img>` 的 HTML 字符串。
 * @returns img HTML，供 `preview.innerHTML = html` 消费。
 */
export function ImagePreviewImg({ src }: ImagePreviewImgProps): string {
    return `<img src="${src}" alt="预览图">`;
}
