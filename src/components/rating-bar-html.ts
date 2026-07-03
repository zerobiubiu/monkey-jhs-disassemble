/**
 * RatingBarHtml —— 详情页星星评分组件 HTML 字符串版本。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 _buildRatingBar
 * （L601-615 的 bar.innerHTML，原 archetype/jhs.user.js L5784 附近）：
 *   - .jhs-stars 容器（data-score=0）内含 5 个 .jhs-star（data-score 1-5，★）
 *   - .jhs-rating-actions 容器内含「♥ 收藏」(.jhs-fav-btn) 与「已读」(.jhs-read-btn)
 *
 * 保留原 HTML 结构、CSS 类名（jhs-rating-bar 由外层 div 承载、jhs-stars /
 * jhs-star / jhs-rating-actions / jhs-fav-btn / jhs-read-btn）、data-score
 * 属性、button title 与文案。原模板不含内联样式，视觉样式由插件
 * _injectRatingStyles 注入的 rating-bar.css 契约提供，本组件仅产出
 * DOM/类名契约，忠实于原 innerHTML。
 *
 * 状态类（is-active / is-disabled / is-busy / is-preview / is-popping）
 * 由插件 _syncRatingBar / _setRatingBusy 运行时切换，组件只产出初始
 * 无状态结构。交互（hover 预览、点击星星/已读/收藏）由插件在
 * _buildRatingBar 内 addEventListener 绑定。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（与原 innerHTML 拼接
 * 逻辑一致：[1,2,3,4,5].map(...).join("")）。无动态值，无 props。
 *
 * 与 src/components/rating-bar.tsx 的关系：rating-bar.tsx 是 JSX 示范
 * （孤立可用，不被 main.tsx 引入，内部用 useState 复现交互）；本文件
 * 是字符串版本，供插件 `bar.innerHTML = RatingBarHtml()` 直接消费，
 * 遵循 doc/06 统一规定（返回字符串，不用 JSX/renderToStaticMarkup）。
 */

/**
 * 渲染星星评分组件的初始 HTML 字符串（无状态）。
 * @returns .jhs-rating-bar 内部结构：5 星 + 收藏/已读按钮，供
 *          `bar.innerHTML = RatingBarHtml()` 消费。
 */
export function RatingBarHtml(): string {
    return (
        '<div class="jhs-stars" data-score="0">' +
        [1, 2, 3, 4, 5]
            .map(
                (n) =>
                    '<span class="jhs-star" data-score="' +
                    n +
                    '">★</span>',
            )
            .join("") +
        "</div>" +
        '<div class="jhs-rating-actions">' +
        '<button class="jhs-fav-btn" type="button" title="设为想看（收藏）">♥ 收藏</button>' +
        '<button class="jhs-read-btn" type="button" title="设为已观看（0星）">已读</button>' +
        "</div>"
    );
}
