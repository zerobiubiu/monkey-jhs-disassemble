/** 增强榜单分页；原站榜单不使用此组件。 */
export interface Top250PaginationProps {
    /** 当前页码（1-5）。 */
    page: number;
    /** 当前查询串；翻页保留分类、年份和字幕筛选。 */
    search: string;
}

export function Top250Pagination({ page, search }: Top250PaginationProps) {
    const params = new URLSearchParams(search);
    const pageHref = (target: number) => {
        params.set('page', String(target));
        return '?' + params.toString();
    };
    const lastPage = 5;
    return (
        <nav className="pagination jhs-top250-pages">
            <a
                className={`pagination-previous ${page <= 1 ? 'do-hide' : ''}`}
                href={page > 1 ? pageHref(page - 1) : undefined}
            >
                上一頁
            </a>
            <a
                className={`pagination-next ${page >= lastPage ? 'do-hide' : ''}`}
                href={page < lastPage ? pageHref(page + 1) : undefined}
            >
                下一頁
            </a>
            <ul className="pagination-list">
                {Array.from({ length: lastPage }, (_, i) => i + 1).map((i) => (
                    <li key={i}>
                        <a
                            className={`pagination-link ${page === i ? 'is-current' : ''}`}
                            href={pageHref(i)}
                            aria-current={page === i ? 'page' : undefined}
                        >
                            {i}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
