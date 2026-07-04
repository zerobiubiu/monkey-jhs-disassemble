/**
 * SubtitlePreviewDialog —— 字幕预览弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 previewSubtitle
 * （L1542-1547，原 archetype/jhs.user.js L6425 的 layer.open content）：
 * 一个深色背景（#1E1E1E）、白色等宽字体（Consolas,Monaco,monospace）、
 * `white-space:pre-wrap;overflow:auto;height:100%;` 的预览容器，内联注入
 * 已格式化的字幕内容（每行带 `#AAA` 色行号 span 的 HTML 字符串）。
 *
 * 保留原 HTML 结构、内联 style 原样不动；外层 div 为固定模板，动态的
 * 字幕正文（previewSubtitle 内由 `lines.forEach` 拼接的 `output`/
 * `htmlContent`，已是 HTML 字符串）通过 props.content 经
 * `dangerouslySetInnerHTML={{ __html: content }}` 原始注入（jsxToString
 * 取 __html 作为 inner HTML 不转义，与原 `<div ...>${htmlContent}</div>`
 * 模板插值行为一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 previewSubtitle 中
 * layer.open({ content }) 消费：
 *   `content: jsxToString(<SubtitlePreviewDialog content={htmlContent} />)`
 * 下载按钮（btn/btn1 → utils.download）、标题与区域尺寸仍由 previewSubtitle
 * 持有，组件只负责静态结构 + 动态正文注入。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，
 * 零运行时依赖，不引入 react-dom/server）。本容器含动态值（字幕正文），
 * 故用 props + dangerouslySetInnerHTML。
 */

/** SubtitlePreviewDialog 的属性。 */
interface SubtitlePreviewDialogProps {
    /** 字幕格式化后的 HTML 正文（每行带行号 span 的预拼接字符串），注入外层预览容器内部。 */
    content: string;
}

/**
 * 渲染字幕预览弹窗的 JSX。
 * @param props.content 字幕格式化后的 HTML 正文（带行号 span 的预拼接字符串）。
 * @returns 字幕预览容器 JSX（深色等宽字体容器 + 经 dangerouslySetInnerHTML
 *          注入的 content），经 jsxToString 转 HTML 字符串后供
 *          layer.open({ content }) 直接消费。
 */
export function SubtitlePreviewDialog({ content }: SubtitlePreviewDialogProps) {
    return (
        <div
            style={{
                padding: '15px 5px',
                background: '#1E1E1E',
                color: '#FFF',
                fontFamily: 'Consolas,Monaco,monospace',
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
                height: '100%'
            }}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}
