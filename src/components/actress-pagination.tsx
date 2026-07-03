/**
 * ActressPagination —— 收藏女优分页栏（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 renderPagination（L469-500）：原方法
 * 依 currentPage/totalPages/totalCount 拼接首页/上一页/页码(最多5个)/下一页/尾页
 * 按钮 + 记录数文本，由 `$pagination.html(paginationHtml)` 消费。rangeStart/rangeEnd
 * 的窗口计算逻辑（Math.max/min 与回填）原样保留在组件内。
 *
 * 保留原按钮类名（pagination-btn / page-number-btn / active）、data-page、
 * 内联 style（经 CSSProperties 对象还原为 kebab-case CSS 字符串，值原样保留；
 * 页码按钮的激活态样式用 `{...PAGE_BTN_BASE_STYLE, ...(pageNum === page ? ACTIVE_STYLE : null)}`
 * 合并，等价于原 `${pageNum === page ? "background: #007bff; color: white; border-color: #007bff;" : ""}`
 * 拼接）、记录数 `<span>` 文案原样不动；totalCount/totalPages/page 通过 prop 注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素，Fragment 包裹多按钮 + 记录数 span）。
 * 供 renderPagination 中 `$pagination.html()` 消费时，需先用 `jsxToString`
 * （来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `$pagination.html(jsxToString(<ActressPagination totalCount={...} totalPages={...} page={...} />))`
 * Fragment 透明拼接 children，输出与原字符串拼接等价（紧凑化空白差异，DOM 渲染等价）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */
import type { CSSProperties } from "react";

/** ActressPagination 的属性。 */
export interface ActressPaginationProps {
    /** 记录总数。 */
    totalCount: number;
    /** 总页数（0 时仅渲染"共 0 条记录"）。 */
    totalPages: number;
    /** 当前页码。 */
    page: number;
}

/** 首页/上一页/下一页/尾页按钮的统一样式（原内联 style 对象化）。 */
const NAV_BTN_STYLE: CSSProperties = {
    padding: "8px 12px",
    margin: "0 5px",
    background: "#f0f0f0",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
};

/** 页码按钮的基础样式（原 `padding: 8px 12px; margin: 0 3px; ...`）。 */
const PAGE_BTN_BASE_STYLE: CSSProperties = {
    padding: "8px 12px",
    margin: "0 3px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
};

/** 页码按钮激活态附加样式（原 `background: #007bff; color: white; border-color: #007bff;`）。 */
const ACTIVE_STYLE: CSSProperties = {
    background: "#007bff",
    color: "white",
    borderColor: "#007bff",
};

/**
 * 渲染收藏女优分页栏的 JSX。
 * @param props.totalCount 记录总数
 * @param props.totalPages 总页数（0 时仅渲染"共 0 条记录"）
 * @param props.page 当前页码
 * @returns 分页栏 JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function ActressPagination({
    totalCount,
    totalPages,
    page,
}: ActressPaginationProps) {
    if (totalPages === 0) {
        return <span style={{ color: "#666" }}>共 0 条记录</span>;
    }
    let rangeStart: number = Math.max(1, page - Math.floor(2.5));
    let rangeEnd: number = Math.min(totalPages, rangeStart + 5 - 1);
    if (rangeEnd - rangeStart < 4) {
        rangeStart = Math.max(1, rangeEnd - 5 + 1);
    }
    return (
        <>
            {page > 1 && totalPages > 5 && (
                <button
                    className="pagination-btn"
                    data-page={1}
                    style={NAV_BTN_STYLE}
                >
                    首页
                </button>
            )}
            {page > 1 && (
                <button
                    className="pagination-btn"
                    data-page={page - 1}
                    style={NAV_BTN_STYLE}
                >
                    上一页
                </button>
            )}
            {Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => {
                const pageNum = rangeStart + i;
                return (
                    <button
                        key={pageNum}
                        className={`pagination-btn page-number-btn ${pageNum === page ? "active" : ""}`}
                        data-page={pageNum}
                        style={{
                            ...PAGE_BTN_BASE_STYLE,
                            ...(pageNum === page ? ACTIVE_STYLE : null),
                        }}
                    >
                        {pageNum}
                    </button>
                );
            })}
            {page < totalPages && (
                <button
                    className="pagination-btn"
                    data-page={page + 1}
                    style={NAV_BTN_STYLE}
                >
                    下一页
                </button>
            )}
            {page < totalPages && totalPages > 5 && (
                <button
                    className="pagination-btn"
                    data-page={totalPages}
                    style={NAV_BTN_STYLE}
                >
                    尾页
                </button>
            )}
            <span style={{ marginLeft: "20px", color: "#666" }}>
                共 {totalCount} 条记录 (第 {page}/{totalPages} 页)
            </span>
        </>
    );
}
