/**
 * ImagePreviewError —— 悬浮大图预览失败提示 HTML 字符串组件。
 *
 * 提取自 src/core/image-preview.ts 的 handleMouseEnter（L121-122）：原
 * `preview.innerHTML = '<div style="padding:10px;color:#f00;">图片加载失败</div>'`，
 * 图片 onerror 时填充。
 *
 * 保留原内联 style 与文案原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染悬浮预览失败提示的 HTML 字符串。
 * @returns 失败提示 HTML，供 `preview.innerHTML = html` 消费。
 */
export function ImagePreviewError(): string {
    return '<div style="padding:10px;color:#f00;">图片加载失败</div>';
}
