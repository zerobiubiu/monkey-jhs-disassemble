/**
 * FavoriteActressAvatarColumn —— 演员主页头像占位列（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/favorite-actresses-plugin.ts 的 replaceActressAvatar
 * （L243-244，原 archetype/jhs.user.js L10852 的 avatarColumnHtml）：
 * `.section-columns` 内 prepend 的占位列（column actor-avatar → image →
 * 空 avatar span），供后续 `.avatar` 选择器填充背景图。
 *
 * 保留原 HTML 结构、类名（column actor-avatar / image / avatar）。原模板中
 * 标签间的空格（`<div ...> <div ...> <span ...></span> </div> </div>`）为
 * 纯空白文本节点，JSX 紧凑输出后丢失，对 DOM 构建/CSS 渲染无影响（与示范
 * temporary-image-container.tsx 风格一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 replaceActressAvatar 中
 * `.prepend()` 消费：
 *   `$(".section-columns").prepend(jsxToString(<FavoriteActressAvatarColumn />))`
 * 无动态值，故无 props。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染演员主页头像占位列的 JSX。
 * @returns column actor-avatar 列 React 元素（image > 空 avatar span），经
 *          jsxToString 转 HTML 字符串后供 replaceActressAvatar `.prepend()`
 *          后由 `.avatar` 选择器填充背景图。
 */
export function FavoriteActressAvatarColumn() {
    return (
        <div className="column actor-avatar">
            <div className="image">
                <span className="avatar"></span>
            </div>
        </div>
    );
}
