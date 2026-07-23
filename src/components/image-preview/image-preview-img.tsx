/**
 * ImagePreviewImg —— 悬浮大图预览成功时填充的 `<img>`（React 函数组件，JSX）。
 *
 * 提取自 src/core/image-preview.ts 的 handleMouseEnter（L109）：原
 * `preview.innerHTML = \`<img src="${imgSrc}" alt="预览图">\``，图片 onload 后填充。
 *
 * 保留原 alt 文案原样不动；src 通过 prop 注入。img 为 void element，
 * jsxToString 输出自闭合 `<img ... />`，与浏览器 innerHTML 解析等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleMouseEnter 中
 * `preview.innerHTML = ...` 消费时，需先用 `jsxToString`（来自 ./jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `preview.innerHTML = jsxToString(<ImagePreviewImg src={imgSrc} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** ImagePreviewImg 的属性。 */
export interface ImagePreviewImgProps {
    /** 图片源地址。 */
    src: string;
}

/**
 * 渲染悬浮预览 `<img>` 的 JSX。
 * @param props.src 图片源地址
 * @returns img JSX，经 jsxToString 转 HTML 字符串后供 `preview.innerHTML` 消费。
 */
export function ImagePreviewImg({ src }: ImagePreviewImgProps) {
    return <img src={src} alt="预览图" />;
}
