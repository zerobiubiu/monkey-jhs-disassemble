/**
 * ReviewLinkContent —— 评论区正文中 ed2k/磁力/HTTP 链接转可点击（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.displayReviews 的正则 replace 回调提供：将评论正文内的
 * ed2k/磁力/HTTP 链接替换为带样式的 `<span>`+115离线下载按钮或 `<a>` 链接。
 * ed2k → span+button；magnet → a+button；http(s) → a；其余原样返回 match 文本。
 *
 * 保留原 class（button is-info down-115 / a-primary）、data-magnet、target、rel、
 * 内联 style、文案原样不动；match 通过 prop 注入。链接作为属性值（href /
 * data-magnet）不转义（jsxToString 不转义属性值，与原模板拼接一致）；作为
 * 文本子节点（{match}）时 jsxToString 转义 `&`/`<`/`>`，浏览器解析后与原模板
 * 未转义插入 DOM 等价。原模板 `\n` 缩进空白以 `{" "}` 保留单空格，DOM 等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 displayReviews 的 replace 回调
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `(match) => jsxToString(<ReviewLinkContent match={match} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** ReviewLinkContent 的属性。 */
export interface ReviewLinkContentProps {
    /** 正则匹配到的链接原文（ed2k://... / magnet:?... / http(s)://...）。 */
    match: string;
}

/**
 * 依链接类型渲染带样式的可点击 JSX（或原样返回非链接 match 文本）。
 * @param props.match 链接原文
 * @returns 替换 JSX（Fragment 或字符串），经 jsxToString 转 HTML 字符串后供正则 replace 回调返回。
 */
export function ReviewLinkContent({ match }: ReviewLinkContentProps) {
    if (match.startsWith('ed2k://')) {
        return (
            <>
                {' '}
                <span
                    style={{
                        wordBreak: 'break-all',
                        background: '#e0f2fe',
                        color: '#0369a1'
                    }}
                >
                    {match}
                </span>{' '}
                <button
                    className="button is-info down-115"
                    data-magnet={match}
                    style={{ fontSize: '11px' }}
                >
                    115离线下载
                </button>{' '}
            </>
        );
    }
    if (match.startsWith('magnet:')) {
        return (
            <>
                {' '}
                <a
                    href={match}
                    className="a-primary"
                    style={{
                        padding: 0,
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {match}
                </a>{' '}
                <button
                    className="button is-info down-115"
                    data-magnet={match}
                    style={{ fontSize: '11px' }}
                >
                    115离线下载
                </button>{' '}
            </>
        );
    }
    if (match.startsWith('http://') || match.startsWith('https://')) {
        return (
            <>
                {' '}
                <a
                    href={match}
                    className="a-primary"
                    style={{
                        padding: 0,
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {match}
                </a>{' '}
            </>
        );
    }
    return match;
}
