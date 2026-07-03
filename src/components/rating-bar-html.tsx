/**
 * RatingBarHtml —— 详情页星星评分组件（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 _buildRatingBar
 * （L601-615 的 bar.innerHTML，原 archetype/jhs.user.js L5784 附近）：
 *   - .jhs-stars 容器（data-score=0）内含 5 个 .jhs-star（data-score 1-5，★）
 *   - .jhs-rating-actions 容器内含「♥ 收藏」(.jhs-fav-btn) 与「已读」(.jhs-read-btn)
 *
 * 保留原 HTML 结构、CSS 类名（jhs-stars / jhs-star / jhs-rating-actions /
 * jhs-fav-btn / jhs-read-btn）、data-score 属性、button type/title 与文案。
 * 原模板不含内联样式，视觉样式由插件 _injectRatingStyles 注入的
 * rating-bar.css 契约提供，本组件仅产出 DOM/类名契约，忠实于原 innerHTML。
 *
 * 状态类（is-active / is-disabled / is-busy / is-preview / is-popping）
 * 由插件 _syncRatingBar / _setRatingBusy 运行时切换，组件只产出初始
 * 无状态结构。交互（hover 预览、点击星星/已读/收藏）由插件在
 * _buildRatingBar 内 addEventListener 绑定。
 *
 * 渲染方式：本组件返回 JSX（React 元素），输出 .jhs-stars 与
 * .jhs-rating-actions 两个并列节点（Fragment 包裹，对应原 innerHTML
 * 拼接的两段字符串）。供 _buildRatingBar 中
 * `bar.innerHTML = jsxToString(<RatingBarHtml />)` 直接消费。无动态值，无 props。
 *
 * 与原 src/components/rating-bar.tsx 示范的关系：rating-bar.tsx 是 JSX
 * 示范（孤立可用，不被 main.tsx 引入，内部用 useState 复现交互），本文件
 * 转为正式 TSX 组件后该示范已合并删除（职责由本组件 + 插件 addEventListener 接管）。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString`（src/core/jsx-to-string，仅类型依赖
 * react，零运行时依赖，不引入 react-dom/server）渲染为 HTML 字符串。
 */

/**
 * 渲染星星评分组件初始结构的 JSX（无状态）。
 * @returns Fragment：.jhs-stars（data-score=0 + 5 个 .jhs-star）+
 *          .jhs-rating-actions（♥ 收藏 / 已读 按钮），经 jsxToString 转 HTML
 *          字符串后供 `bar.innerHTML =` 消费。
 */
export function RatingBarHtml() {
    return (
        <>
            <div className="jhs-stars" data-score={0}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className="jhs-star" data-score={n}>
                        ★
                    </span>
                ))}
            </div>
            <div className="jhs-rating-actions">
                <button
                    className="jhs-fav-btn"
                    type="button"
                    title="设为想看（收藏）"
                >
                    ♥ 收藏
                </button>
                <button
                    className="jhs-read-btn"
                    type="button"
                    title="设为已观看（0星）"
                >
                    已读
                </button>
            </div>
        </>
    );
}
