/**
 * ScreenShotImage —— 截图墙缩略图（React 函数组件，JSX）。
 *
 * 提取自 screenshot-plugin.tsx addImg 的模板字符串
 * `<img src="${imgUrl}" alt="${title}" loading="lazy" style="width: 100%;">`。
 *
 * 保留原属性/内联 style 语义原样不动；src/alt 经 jsxToString
 * sanitizeUrl/escapeAttr 处理（https 图床地址原样通过）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 addImg 中
 * `$('.screen-container').html(jsxToString(<ScreenShotImage ... />))` 消费。
 */
import type { CSSProperties } from 'react';

/** ScreenShotImage 的属性。 */
export interface ScreenShotImageProps {
    /** 缩略图 URL（javstore.net 长图地址）。 */
    src: string;
    /** 图片 alt 文案（如「缩略图」）。 */
    alt: string;
}

/** 缩略图内联样式：撑满容器宽度。 */
const fullWidthStyle: CSSProperties = { width: '100%' };

/**
 * 渲染截图墙缩略图的 JSX。
 * @param props.src 缩略图 URL
 * @param props.alt 图片 alt 文案
 * @returns img JSX，经 jsxToString 转 HTML 字符串后供 .html() 消费。
 */
export function ScreenShotImage({ src, alt }: ScreenShotImageProps) {
    return <img src={src} alt={alt} loading="lazy" style={fullWidthStyle} />;
}
