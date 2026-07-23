/**
 * SectionLoadMore —— 通用区块加载更多按钮 + 全部已加载占位（React 函数组件，JSX）。
 *
 * 合并 ReviewLoadMore / RelatedLoadMore：加载更多按钮 + 隐藏的结束占位 div，
 * 按钮 ID、占位 ID、文案由调用方注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `.html()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionLoadMore 的属性。 */
export interface SectionLoadMoreProps {
    /** 加载更多按钮 DOM id（如 "loadMoreReviews" / "loadMoreRelateds"）。 */
    loadMoreId: string;
    /** 全部已加载占位 DOM id（如 "reviewsEnd" / "relatedEnd"）。 */
    endId: string;
    /** 按钮文案（如 "加载更多评论" / "加载更多清单"）。 */
    text: string;
    /** 占位文案（如 "已加载全部评论" / "已加载全部清单"）。 */
    endText: string;
}

/**
 * 渲染加载更多按钮 + 全部已加载占位的 JSX。
 * @returns button + div JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function SectionLoadMore({ loadMoreId, endId, text, endText }: SectionLoadMoreProps) {
    return (
        <>
            <button
                id={loadMoreId}
                style={{
                    width: '100%',
                    backgroundColor: '#e1f5fe',
                    border: 'none',
                    padding: '10px',
                    marginTop: '10px',
                    cursor: 'pointer',
                    color: '#0277bd',
                    fontWeight: 'bold',
                    borderRadius: '4px'
                }}
            >
                {text}
            </button>
            <div
                id={endId}
                style={{
                    display: 'none',
                    textAlign: 'center',
                    padding: '10px',
                    color: '#666',
                    marginTop: '10px'
                }}
            >
                {endText}
            </div>
        </>
    );
}
