/**
 * ReviewLinkContent —— 评论区正文中 ed2k/磁力/HTTP 链接转可点击 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 displayReviews（L249-256）正则 replace
 * 回调：将评论正文内的 ed2k/磁力/HTTP 链接替换为带样式的 `<span>`+115离线下载按钮
 * 或 `<a>` 链接。ed2k → span+button；magnet → a+button；http(s) → a；其余原样返回。
 *
 * 保留原 class（button is-info down-115 / a-primary）、data-magnet、target、rel、
 * 内联 style、\n 转义原样不动；match 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** ReviewLinkContent 的属性。 */
export interface ReviewLinkContentProps {
    /** 正则匹配到的链接原文（ed2k://... / magnet:?... / http(s)://...）。 */
    match: string;
}

/**
 * 依链接类型渲染带样式的可点击 HTML（或原样返回非链接 match）。
 * @param props.match 链接原文
 * @returns 替换 HTML 字符串，供正则 replace 回调返回。
 */
export function ReviewLinkContent({ match }: ReviewLinkContentProps): string {
    if (match.startsWith("ed2k://")) {
        return `\n                            <span style="word-break: break-all;background: #e0f2fe;color: #0369a1;">${match}</span>\n                            <button class="button is-info down-115" data-magnet="${match}" style="font-size: 11px">115离线下载</button>\n                        `;
    }
    if (match.startsWith("magnet:")) {
        return `\n                            <a href="${match}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${match}</a>\n                            <button class="button is-info down-115" data-magnet="${match}" style="font-size: 11px">115离线下载</button>\n                        `;
    }
    if (match.startsWith("http://") || match.startsWith("https://")) {
        return `\n                            <a href="${match}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${match}</a>\n                        `;
    }
    return match;
}
