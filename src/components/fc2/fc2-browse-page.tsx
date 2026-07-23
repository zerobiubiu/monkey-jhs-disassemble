/**
 * Fc2BrowsePage —— 123Av FC2 浏览页骨架（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-by-123av-plugin.ts 的 hookPage（L97-117 的
 * `$box.html(...)` 模板）：标题 + 搜索框/搜索按钮/排序下拉（8 个 option）+
 * 列表容器 + 分页容器。
 *
 * 保留原 id（fc2-123av-keyword / fc2-123av-search / fc2-123av-sort /
 * fc2-123av-list / fc2-123av-pagination）、class、内联 style、option value/文案
 * 原样不动。搜索框 value 由 keyword prop 注入（原模板
 * `value="${this.keyword || ''}"`——keyword 来自 URL 参数，仅此处预填，
 * handleQuery 不再回填输入框，故须以 prop 保留该行为）。排序下拉的选中项
 * 仍由 hookPage 在注入后 `$("#fc2-123av-sort").val(this.sortVal)` 设置，
 * 组件不做 selected 动态化。原模板中的换行缩进由 jsxToString 紧凑输出丢失，
 * 对 DOM 构建/CSS 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 hookPage 中 `$box.html(...)` 消费：
 *   `$box.html(jsxToString(<Fc2BrowsePage keyword={this.keyword ?? undefined} />))`
 * 搜索/排序事件绑定与列表/分页渲染仍由 hookPage / handleQuery /
 * renderPagination 持有，组件只负责静态骨架 + 关键词预填。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString`（src/core/jsx-to-string，仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）渲染为 HTML 字符串。style 对象经 styleToCss 还原为 CSS
 * 声明（冒号后无空格、无尾分号，与原模板 CSS 等价），与原 jQuery
 * `.html(htmlString)` 行为一致。
 */
import type { CSSProperties } from 'react';

/** Fc2BrowsePage 的属性。 */
export interface Fc2BrowsePageProps {
    /** 搜索框预填关键词（来自 URL 参数，原模板 `this.keyword || ''`）。 */
    keyword?: string;
}

/** 外层容器内联样式：底部 15px 间距。 */
const wrapperStyle: CSSProperties = { marginBottom: '15px' };

/** 搜索行容器内联样式：flex + 8px 间距 + 换行 + 底部 10px 间距。 */
const searchRowStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '10px'
};

/** 搜索框内联样式：最大宽度 280px。 */
const keywordInputStyle: CSSProperties = { maxWidth: '280px' };

/** 排序下拉内联样式：高度 2.5em（对齐输入框）。 */
const sortSelectStyle: CSSProperties = { height: '2.5em' };

/** 分页容器内联样式：顶部 15px 间距 + 居中。 */
const paginationStyle: CSSProperties = { marginTop: '15px', textAlign: 'center' };

/**
 * 渲染 123Av FC2 浏览页骨架的 JSX。
 * @param props.keyword 搜索框预填关键词（缺省为空串）
 * @returns 浏览页 JSX（标题 + 搜索行 + 列表容器 + 分页容器），经 jsxToString
 *          转 HTML 字符串后供 `$box.html()` 消费。
 */
export function Fc2BrowsePage({ keyword }: Fc2BrowsePageProps) {
    return (
        <div style={wrapperStyle}>
            <h2 className="title is-4">123Av FC2 浏览</h2>
            <div style={searchRowStyle}>
                <input
                    id="fc2-123av-keyword"
                    className="input"
                    style={keywordInputStyle}
                    placeholder="搜索关键词"
                    value={keyword || ''}
                />
                <button id="fc2-123av-search" className="button is-info">
                    搜索
                </button>
                <select id="fc2-123av-sort" className="select" style={sortSelectStyle}>
                    <option value="release_date">发布日期</option>
                    <option value="recent_update">最近更新</option>
                    <option value="trending">热门</option>
                    <option value="most_viewed_today">今天最多观看</option>
                    <option value="most_viewed_week">本周最多观看</option>
                    <option value="most_viewed_month">本月最多观看</option>
                    <option value="most_viewed">最多观看</option>
                    <option value="most_favourited">最受欢迎</option>
                </select>
            </div>
            <div id="fc2-123av-list" className="movie-list h cols-4 vcols-8"></div>
            <div id="fc2-123av-pagination" style={paginationStyle}></div>
        </div>
    );
}
