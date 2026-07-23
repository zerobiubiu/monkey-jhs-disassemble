/**
 * SectionEndMessage —— 通用区块全部已加载提示（React 函数组件，JSX）。
 *
 * 合并 ReviewEnd / RelatedEnd：居中灰色提示条，文案由调用方注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `.html()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionEndMessage 的属性。 */
export interface SectionEndMessageProps {
    /** 提示文案（如 "已加载全部评论" / "已加载全部清单"）。 */
    text: string;
}

/**
 * 渲染区块全部已加载提示的 JSX。
 * @returns 已加载提示 JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function SectionEndMessage({ text }: SectionEndMessageProps) {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: '10px',
                color: '#666',
                marginTop: '10px'
            }}
        >
            {text}
        </div>
    );
}
