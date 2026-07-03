/**
 * MovieListWrapper —— 超过 60 页合并请求结果的外层包装 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 filterActorVideo（L758，
 * 原 archetype/jhs.user.js L7878 的 wrapperHtml）：
 * Beyond60Plugin 返回的合并 HTML 片段需包装进 `<div class='movie-list'>`
 * 并在末尾追加 `<a class="pagination-next" href="nextUrl">` 占位（供
 * 下一轮 parseAndSaveFilterInfo 的 nextPageSelector 命中），再由
 * utils.htmlTo$dom 转为 DOM 交给递归调用。nextUrl 为空时不追加占位 a。
 *
 * 保留原 HTML 结构、类名（movie-list / pagination-next）、`class =` 号
 * 两侧空格（原脚本如此）、`\n` 转义与缩进原样不动，与原模板零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 filterActorVideo 中
 * `utils.htmlTo$dom(MovieListWrapper({...}))` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始模板拼接行为一致。
 */

/** MovieListWrapper 的属性。 */
export interface MovieListWrapperProps {
    /** Beyond60Plugin 合并返回的列表 HTML 片段（填入 movie-list div）。 */
    html: string;
    /** 下一页 URL（非空时追加 pagination-next 占位 a；空字符串时不追加）。 */
    nextUrl: string;
}

/**
 * 渲染 movie-list 外层包装的 HTML 字符串。
 * @param props.html Beyond60 合并返回的列表 HTML 片段
 * @param props.nextUrl 下一页 URL（空字符串时不追加占位 a）
 * @returns `<div class='movie-list'>html</div>` + 可选 pagination-next a，供 htmlTo$dom 消费。
 */
export function MovieListWrapper({
    html,
    nextUrl,
}: MovieListWrapperProps): string {
    return `\n                    <div class ='movie-list'>${html}</div>\n                    ${nextUrl ? `<a class="pagination-next" href="${nextUrl}"></a>` : ""}\n                `;
}
