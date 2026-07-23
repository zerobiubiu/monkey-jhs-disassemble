/**
 * SubtitleLine —— 字幕预览单行（行号 + 文本）（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 previewSubtitle
 * （L1510，原 archetype/jhs.user.js L6447 字幕逐行拼接）：
 * `<span style="color:#AAA;">${paddedNum}. </span>${line}\n`，将 padStart
 * 到 numWidth 的行号渲染为浅灰色 span，后接字幕正文行 + 换行；
 * 多行拼接成完整 output 后注入 SubtitlePreviewDialog 容器（white-space:pre-wrap
 * 下 `\n` 渲染为换行）。
 *
 * 保留原 HTML 结构、内联 style（color:#AAA）、行号前导空格（padStart 产物）、
 * `. ` 分隔与尾部 `\n`（以 `{"\n"}` 文本节点保留，jsxToString 不转义空白）。
 * paddedNum / line 通过 props 注入；不在此处做 padStart，调用方 previewSubtitle
 * 仍持有 numWidth 计算与逐行拼接逻辑。
 *
 * 行为变化（DOM 等价）：原模板字符串拼接不转义 line；JSX 模式下 jsxToString
 * 对文本节点转义 `&` `<` `>`，DOM 文本内容一致，且避免字幕正文含 HTML
 * 特殊字符时的注入风险（与 doc/17 §4 一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 previewSubtitle 中
 * `output += jsxToString(<SubtitleLine paddedNum={paddedNum} line={line} />)`
 * 逐行拼接消费。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，
 * 零运行时依赖，不引入 react-dom/server）。
 */

/** SubtitleLine 的属性。 */
export interface SubtitleLineProps {
    /** 已 padStart 到 numWidth 的行号字符串（如 "  1" / " 12" / "123"）。 */
    paddedNum: string;
    /** 字幕单行文本（已 split("\n") 切出的原始行，可能含 HTML 特殊字符）。 */
    line: string;
}

/**
 * 渲染字幕预览单行的 JSX。
 * @param props.paddedNum 已对齐宽度的行号字符串。
 * @param props.line      字幕单行文本。
 * @returns Fragment：浅灰行号 span + 行文本 + `\n`，经 jsxToString 转 HTML
 *          字符串后供 previewSubtitle 逐行拼接 output 后整体注入预览容器。
 */
export function SubtitleLine({ paddedNum, line }: SubtitleLineProps) {
    return (
        <>
            <span style={{ color: '#AAA' }}>{`${paddedNum}. `}</span>
            {line}
            {'\n'}
        </>
    );
}
