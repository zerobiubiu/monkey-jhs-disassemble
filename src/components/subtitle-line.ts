/**
 * SubtitleLine —— 字幕预览单行（行号 + 文本）HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 previewSubtitle
 * （L1510，原 archetype/jhs.user.js L6447 字幕逐行拼接）：
 * `<span style="color:#AAA;">${paddedNum}. </span>${line}\n`，将 padStart
 * 到 numWidth 的行号渲染为浅灰色 span，后接字幕正文行 + 换行；
 * 多行拼接成完整 output 后注入 SubtitlePreviewDialog 容器。
 *
 * 保留原 HTML 结构、内联 style（color:#AAA）、`\n` 字面量原样不动，
 * 与原模板字符串零偏差。paddedNum / line 通过 props 注入；不在此处做
 * padStart，调用方 previewSubtitle 仍持有 numWidth 计算与逐行拼接逻辑。
 *
 * 渲染方式：普通函数返回 HTML 字符串（模板拼接）。供 previewSubtitle
 * 中 `output += SubtitleLine({ paddedNum, line })` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始模板拼接行为一致。
 */

/** SubtitleLine 的属性。 */
export interface SubtitleLineProps {
    /** 已 padStart 到 numWidth 的行号字符串（如 "  1" / " 12" / "123"）。 */
    paddedNum: string;
    /** 字幕单行文本（已 split("\n") 切出的原始行，可能含 HTML 特殊字符）。 */
    line: string;
}

/**
 * 渲染字幕预览单行的 HTML 字符串。
 * @param props.paddedNum 已对齐宽度的行号字符串。
 * @param props.line      字幕单行文本。
 * @returns `<span style="color:#AAA;">paddedNum. </span>line\n`，
 *          供 previewSubtitle 逐行拼接 output 后整体注入预览容器。
 */
export function SubtitleLine({ paddedNum, line }: SubtitleLineProps): string {
    return `<span style="color:#AAA;">${paddedNum}. </span>${line}\n`;
}
