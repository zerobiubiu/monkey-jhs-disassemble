/**
 * ListPanel —— 详情页清单平铺面板（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 _ensureListPanel
 * （L693-695 的 insertAdjacentHTML，原 archetype/jhs.user.js L5637-5681）：
 * 一个带标题、汇总、搜索、排序和列表区域的 .jhs-list-panel 容器，插入到
 * #otherSiteBox 之后；条目由 _initListPanel 的 MutationObserver 从
 * #modal-save-list 的 listContainer 克隆同步而来（跳过「预设清单」）。
 *
 * 保留原 class（jhs-list-panel），供 VideoListsTagPlugin 的同步、删除和新增
 * 清单逻辑继续定位；动态内容只写入 .jhs-list-panel__items，不销毁工具栏状态。
 *
 * 视觉样式由 rating-bar.css 的 .jhs-list-panel 规则提供，组件只产出稳定外壳，
 * 不持有业务状态。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 _ensureListPanel 中
 * `otherSite.insertAdjacentHTML("afterend", jsxToString(<ListPanel />))` 消费。
 * 无动态值，无 props。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString`（src/core/jsx-to-string，仅类型依赖
 * react，零运行时依赖，不引入 react-dom/server）渲染为 HTML 字符串。
 */

/**
 * 渲染详情页清单面板外壳。
 * @returns 带加载骨架的 JSX，经 jsxToString 转 HTML 字符串后供
 *          insertAdjacentHTML 消费。
 */
export function ListPanel() {
    return (
        <section className="jhs-list-panel" aria-labelledby="jhs-list-panel-title">
            <header className="jhs-list-panel__header">
                <div className="jhs-list-panel__heading">
                    <h3 id="jhs-list-panel-title" className="jhs-list-panel__title">
                        加入清单
                    </h3>
                    <span className="jhs-list-panel__summary" aria-live="polite">
                        正在读取…
                    </span>
                </div>
                <label className="jhs-list-panel__sort">
                    <span>排序</span>
                    <select
                        className="jhs-list-panel__sort-select"
                        aria-label="清单排序"
                        disabled
                    >
                        <option value="name-desc">名称降序</option>
                        <option value="name-asc">名称升序</option>
                    </select>
                </label>
            </header>

            <div className="jhs-list-panel__search-wrap">
                <span className="jhs-list-panel__search-icon" aria-hidden="true">
                    ⌕
                </span>
                <input
                    className="jhs-list-panel__search"
                    type="search"
                    placeholder="搜索清单"
                    aria-label="搜索清单"
                    autoComplete="off"
                    disabled
                />
                <button
                    className="jhs-list-panel__search-clear"
                    type="button"
                    aria-label="清空清单搜索"
                    title="清空搜索"
                    hidden
                >
                    ×
                </button>
            </div>

            <div
                className="jhs-list-panel__items"
                role="group"
                aria-label="清单列表"
                aria-busy="true"
            >
                <span className="jhs-list-panel__skeleton" aria-hidden="true" />
                <span className="jhs-list-panel__skeleton" aria-hidden="true" />
                <span className="jhs-list-panel__skeleton" aria-hidden="true" />
                <span className="jhs-list-panel__skeleton" aria-hidden="true" />
            </div>
            <p className="jhs-list-panel__empty" role="status" hidden />
        </section>
    );
}
