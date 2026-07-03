/**
 * ActressPagination —— 收藏女优分页栏 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 renderPagination（L469-500）：原方法
 * 依 currentPage/totalPages/totalCount 拼接首页/上一页/页码(最多5个)/下一页/尾页
 * 按钮 + 记录数文本，由 `$pagination.html(paginationHtml)` 消费。rangeStart/rangeEnd
 * 的窗口计算逻辑（Math.max/min 与回填）原样保留在组件内。
 *
 * 保留原按钮类名（pagination-btn / page-number-btn / active）、data-page、
 * 内联 style、记录数 `<span>` 文案与 \n 转义原样不动；totalCount/totalPages/page
 * 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** ActressPagination 的属性。 */
export interface ActressPaginationProps {
    /** 记录总数。 */
    totalCount: number;
    /** 总页数（0 时仅渲染"共 0 条记录"）。 */
    totalPages: number;
    /** 当前页码。 */
    page: number;
}

/**
 * 渲染收藏女优分页栏的 HTML 字符串。
 * @returns 分页栏 HTML，供 `.html()` 消费。
 */
export function ActressPagination({
    totalCount,
    totalPages,
    page,
}: ActressPaginationProps): string {
    if (totalPages === 0) {
        return '<span style="color: #666;">共 0 条记录</span>';
    }
    let paginationHtml = "";
    if (page > 1 && totalPages > 5) {
        paginationHtml +=
            '<button class="pagination-btn" data-page="1" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">首页</button>';
    }
    if (page > 1) {
        paginationHtml += `<button class="pagination-btn" data-page="${page - 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">上一页</button>`;
    }
    let rangeStart: number = Math.max(1, page - Math.floor(2.5));
    let rangeEnd: number = Math.min(totalPages, rangeStart + 5 - 1);
    if (rangeEnd - rangeStart < 4) {
        rangeStart = Math.max(1, rangeEnd - 5 + 1);
    }
    for (let pageNum = rangeStart; pageNum <= rangeEnd; pageNum++) {
        paginationHtml += `<button class="pagination-btn page-number-btn ${pageNum === page ? "active" : ""}" data-page="${pageNum}" style="padding: 8px 12px; margin: 0 3px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; ${pageNum === page ? "background: #007bff; color: white; border-color: #007bff;" : ""}">${pageNum}</button>`;
    }
    if (page < totalPages) {
        paginationHtml += `<button class="pagination-btn" data-page="${page + 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">下一页</button>`;
    }
    if (page < totalPages && totalPages > 5) {
        paginationHtml += `<button class="pagination-btn" data-page="${totalPages}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">尾页</button>`;
    }
    paginationHtml += `<span style="margin-left: 20px; color: #666;">共 ${totalCount} 条记录 (第 ${page}/${totalPages} 页)</span>`;
    return paginationHtml;
}
