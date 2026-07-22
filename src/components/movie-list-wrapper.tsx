/**
 * MovieListWrapper —— 超过 60 页合并请求结果的外层包装 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 filterActorVideo（L758，
 * 原 archetype/jhs.user.js L7878 的 wrapperHtml）：
 * Beyond60Plugin 返回的合并 HTML 片段需包装进 `<div class='movie-list'>`
 * 并在末尾追加 `<a class="pagination-next" href="nextUrl">` 占位（供
 * 下一轮 parseAndSaveFilterInfo 的 nextPageSelector 命中），再由
 * utils.htmlTo$dom 转为 DOM 交给递归调用。nextUrl 为空时不追加占位 a。
 *
 * 保留原 HTML 结构、类名（movie-list / pagination-next），
 * 与原模板零偏差。
 *
 * 注：html prop 为 Beyond60Plugin 合并返回的原始 HTML 片段（含标签），
 * 需以 React 的 `dangerouslySetInnerHTML={{ __html: html }}` 注入 div，
 * jsxToString 取 __html 作为原始 inner HTML 输出（不转义），
 * 与原模板拼接 `${html}` 行为一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 filterActorVideo 中
 * `utils.htmlTo$dom(...)` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `utils.htmlTo$dom(jsxToString(<MovieListWrapper html={html} nextUrl={nextUrl} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。普通属性统一转义；受信列表片段仍按上文
 * 所述通过 dangerouslySetInnerHTML 注入（doc/129）。
 */

/** MovieListWrapper 的属性。 */
export interface MovieListWrapperProps {
    /** Beyond60Plugin 合并返回的列表 HTML 片段（填入 movie-list div）。 */
    html: string;
    /** 下一页 URL（非空时追加 pagination-next 占位 a；空字符串时不追加）。 */
    nextUrl: string;
}

/**
 * 渲染 movie-list 外层包装的 JSX。
 * @param props.html Beyond60 合并返回的列表 HTML 片段
 * @param props.nextUrl 下一页 URL（空字符串时不追加占位 a）
 * @returns `<div class="movie-list">html</div>` + 可选 pagination-next a 的 JSX，
 *          经 jsxToString 转 HTML 字符串后供 htmlTo$dom 消费。
 */
export function MovieListWrapper({ html, nextUrl }: MovieListWrapperProps) {
    return (
        <>
            <div className="movie-list" dangerouslySetInnerHTML={{ __html: html }} />
            {nextUrl ? (
                <a className="pagination-next" href={nextUrl} rel="noopener noreferrer" />
            ) : null}
        </>
    );
}
