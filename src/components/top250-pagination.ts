/**
 * Top250Pagination —— Top250 分页栏 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 renderPagination（L107-116）：固定 5 页，
 * 当前页高亮 is-current，首页隐藏上一頁（do-hide），第 5 页隐藏下一頁（do-hide）。
 * 由 `this.contentBox.append(html)` 消费。
 *
 * 保留原 `<nav class="pagination">` 结构、pagination-previous/next/list 类、
 * data-page、do-hide、\n 转义原样不动；page 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** Top250Pagination 的属性。 */
export interface Top250PaginationProps {
    /** 当前页码（1-5）。 */
    page: number;
}

/**
 * 渲染 Top250 分页栏的 HTML 字符串。
 * @param props.page 当前页码
 * @returns nav.pagination HTML，供 `.append()` 消费。
 */
export function Top250Pagination({ page }: Top250PaginationProps): string {
    const hasMore = page >= 5;
    let listHtml = "";
    for (let i = 1; i <= 5; i++) {
        listHtml += `<li><a class="pagination-link ${page === i ? "is-current" : ""}" data-page="${i}">${i}</a></li>`;
    }
    return `\n                <nav class="pagination">\n                    <a class="pagination-previous ${page <= 1 ? "do-hide" : ""}" data-page="${page - 1}">上一頁</a>\n                    <a class="pagination-next ${hasMore ? "do-hide" : ""}" data-page="${page + 1}">下一頁</a>\n                    \n                    <ul class="pagination-list">\n                        ${listHtml}\n                    </ul>\n                </nav>\n            `;
}
