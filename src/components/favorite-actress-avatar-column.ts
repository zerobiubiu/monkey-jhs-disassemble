/**
 * FavoriteActressAvatarColumn —— 演员主页头像占位列 HTML 字符串组件。
 *
 * 提取自 src/plugins/favorite-actresses-plugin.ts 的 replaceActressAvatar
 * （L243-244，原 archetype/jhs.user.js L10852 的 avatarColumnHtml）：
 * `.section-columns` 内 prepend 的占位列（column actor-avatar → image →
 * 空 avatar span），供后续 `.avatar` 选择器填充背景图。
 *
 * 保留原 HTML 结构、类名（column actor-avatar / image / avatar）、
 * 标签间空格原样不动，与原字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串（模板拼接，不用 JSX、不用
 * renderToStaticMarkup），供 replaceActressAvatar 中 `.prepend()` 消费：
 *   `$(".section-columns").prepend(FavoriteActressAvatarColumn())`
 * 无动态值，故无 props。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。
 */

/**
 * 渲染演员主页头像占位列的 HTML 字符串。
 * @returns column actor-avatar 列 HTML（image > 空 avatar span），供
 *          replaceActressAvatar `.prepend()` 后由 `.avatar` 选择器填充背景图。
 */
export function FavoriteActressAvatarColumn(): string {
    return '<div class="column actor-avatar"> <div class="image"> <span class="avatar"></span> </div> </div>';
}
