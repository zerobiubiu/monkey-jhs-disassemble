/**
 * MovieError —— 弹窗内加载失败提示块（React 函数组件，JSX）。
 *
 * 提取自 fc2-plugin.tsx handleMovieDetail/handleMagnets 与
 * fc2-by-123av-plugin.tsx loadData 中的错误模板字符串
 * `<div class="movie-error">加载失败: ${err.message}</div>`，三处共用。
 *
 * 保留原 class 原样不动；错误文案经 jsxToString escapeText 转义
 * （原模板为裸插值，jQuery .html() 解析后 DOM 文本一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供调用方
 * `$('.movie-info-container').html(jsxToString(<MovieError message={...} />))`
 * 等 .html() 场景消费。
 */

/** MovieError 的属性。 */
export interface MovieErrorProps {
    /** 错误信息（拼接在「加载失败: 」之后）。 */
    message: string;
}

/**
 * 渲染加载失败提示块的 JSX。
 * @param props.message 错误信息
 * @returns movie-error div JSX，经 jsxToString 转 HTML 字符串后供 .html() 消费。
 */
export function MovieError({ message }: MovieErrorProps) {
    return <div className="movie-error">加载失败: {message}</div>;
}
