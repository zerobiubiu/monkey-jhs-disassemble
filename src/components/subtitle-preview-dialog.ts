/**
 * SubtitlePreviewDialog —— 字幕预览弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 previewSubtitle
 * （L1542-1547，原 archetype/jhs.user.js L6425 的 layer.open content）：
 * 一个深色背景（#1E1E1E）、白色等宽字体（Consolas,Monaco,monospace）、
 * `white-space:pre-wrap;overflow:auto;height:100%;` 的预览容器，内联注入
 * 已格式化的字幕内容（每行带 `#AAA` 色行号 span 的 HTML 字符串）。
 *
 * 保留原 HTML 结构、内联 style 原样不动；外层 div 为固定模板，动态的
 * 字幕正文（previewSubtitle 内由 `lines.forEach` 拼接的 `output`/
 * `htmlContent`）通过 props.content 注入，与原
 * `<div ...>${htmlContent}</div>` 行为一致。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 previewSubtitle 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: SubtitlePreviewDialog({ content: htmlContent }), ... })`
 * 下载按钮（btn/btn1 → utils.download）、标题与区域尺寸仍由 previewSubtitle
 * 持有，组件只负责静态结构 + 动态正文插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本容器含动态值（字幕正文），故用 props。
 */

/** SubtitlePreviewDialog 的属性。 */
interface SubtitlePreviewDialogProps {
    /** 字幕格式化后的 HTML 正文（每行带行号 span，预拼接字符串），注入外层预览容器内部。 */
    content: string;
}

/**
 * 渲染字幕预览弹窗的 HTML 字符串。
 * @param props.content 字幕格式化后的 HTML 正文（带行号 span 的预拼接字符串）。
 * @returns 字幕预览容器 HTML（深色等宽字体容器 + 注入的 content），供
 *          layer.open({ content }) 直接消费。
 */
export function SubtitlePreviewDialog({
    content,
}: SubtitlePreviewDialogProps): string {
    return `<div style="padding:15px 5px;background:#1E1E1E;color:#FFF;font-family:Consolas,Monaco,monospace;white-space:pre-wrap;overflow:auto;height:100%;">${content}</div>`;
}
