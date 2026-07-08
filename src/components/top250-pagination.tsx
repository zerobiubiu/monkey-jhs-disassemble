/**
 * Top250Pagination —— Top250 分页栏（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 renderPagination（L107-116）：固定 5 页，
 * 当前页高亮 is-current，首页隐藏上一页（do-hide），第 5 页隐藏下一页（do-hide）。
 * 由 `this.contentBox.append(html)` 消费。
 *
 * 保留原 `<nav class="pagination">` 结构、pagination-previous/next/list 类、
 * data-page、do-hide 原样不动；page 通过 prop 注入。页码列表用
 * Array.from 循环生成（等价于原 listHtml for 循环拼接，DOM 渲染等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 renderPagination 中
 * `this.contentBox.append()` 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `this.contentBox.append(jsxToString(<Top250Pagination page={page} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** Top250Pagination 的属性。 */
export interface Top250PaginationProps {
    /** 当前页码（1-5）。 */
    page: number;
}

/**
 * 渲染 Top250 分页栏的 JSX。
 * @param props.page 当前页码
 * @returns nav.pagination JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function Top250Pagination({ page }: Top250PaginationProps) {
    const hasMore = page >= 5;
    return (
        <nav className="pagination">
            <a className={`pagination-previous ${page <= 1 ? 'do-hide' : ''}`} data-page={page - 1}>
                上一页
            </a>
            <a className={`pagination-next ${hasMore ? 'do-hide' : ''}`} data-page={page + 1}>
                下一页
            </a>
            <ul className="pagination-list">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((i) => (
                    <li key={i}>
                        <a
                            className={`pagination-link ${page === i ? 'is-current' : ''}`}
                            data-page={i}
                        >
                            {i}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
