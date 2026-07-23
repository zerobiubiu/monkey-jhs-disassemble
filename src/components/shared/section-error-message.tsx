/**
 * SectionErrorMessage —— 通用区块获取失败 + 重试（React 函数组件，JSX）。
 *
 * 合并 ReviewError / RelatedError：失败提示 + 重试链接，
 * 文案、重试按钮 ID、链接色由调用方注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `.append()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionErrorMessage 的属性。 */
export interface SectionErrorMessageProps {
    /** 失败提示文案（如 "获取评论失败" / "获取清单失败"）。 */
    text: string;
    /** 重试按钮 DOM id（如 "retryFetchReviews" / "retryFetchRelateds"）。 */
    retryId: string;
    /** 重试链接色（如 "#1890ff" / "#1897ff"）。 */
    linkColor: string;
}

/**
 * 渲染区块获取失败 + 重试的 JSX。
 * @returns 失败提示 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function SectionErrorMessage({ text, retryId, linkColor }: SectionErrorMessageProps) {
    return (
        <div
            style={{
                marginTop: '15px',
                backgroundColor: '#ffffff',
                padding: '10px',
                marginLeft: '-10px'
            }}
        >
            {text}
            <a
                id={retryId}
                href="javascript:;"
                style={{
                    marginLeft: '10px',
                    color: linkColor,
                    textDecoration: 'none'
                }}
            >
                重试
            </a>
        </div>
    );
}
