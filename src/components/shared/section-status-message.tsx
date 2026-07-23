/**
 * SectionStatusMessage —— 通用区块状态提示（加载中 / 空态）（React 函数组件，JSX）。
 *
 * 合并 ReviewLoading / RelatedLoading / ReviewEmpty / RelatedEmpty：
 * 白底内边距提示条，文案与可选 DOM id 由调用方注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `.append()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionStatusMessage 的属性。 */
export interface SectionStatusMessageProps {
    /** 提示文案（如 "获取评论中..." / "无清单"）。 */
    text: string;
    /** 可选 DOM id（如 "reviewsLoading" / "relatedLoading"），空态可省略。 */
    id?: string;
}

/**
 * 渲染区块状态提示的 JSX。
 * @returns 状态提示 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function SectionStatusMessage({ text, id }: SectionStatusMessageProps) {
    return (
        <div
            id={id}
            style={{
                marginTop: '15px',
                backgroundColor: '#ffffff',
                padding: '10px',
                marginLeft: '-10px'
            }}
        >
            {text}
        </div>
    );
}
