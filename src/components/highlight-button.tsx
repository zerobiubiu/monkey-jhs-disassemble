/**
 * HighlightButton —— 标签高亮 ★ 按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 highlightTag
 * （L109-111，原 archetype/jhs.user.js L4067 的 hover-in 回调内
 * `$('<button class="highlight-btn" title="高亮显示">★</button>')`）：
 * hover 标签时由 jQuery 构造此按钮并 append 到标签内，点击切换该标签的
 * 高亮收藏状态（增删 storageManager 高亮列表并同步 DOM 类名）。
 *
 * 保留原 HTML 结构、类名（highlight-btn）、title 属性、★ 字符原样不动，
 * 与原 jQuery `$('<button ...>★</button>')` 构造结果语义零偏差
 * （文本节点 ★ 经 jsxToString 转义，但 ★ 不属需转义字符，输出原样）。
 * 无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 highlightTag 中
 * `$(jsxToString(<HighlightButton />))` 消费（jQuery 接受 HTML 字符串
 * 构造元素）。hover 进出动画（fadeIn/fadeOut + remove）与 click 事件绑定
 * 仍由 highlightTag 持有，组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义（data-* / title 等
 * 按本工程约定不转义，与原 `$('<button ...>')` 行为一致）。
 */

/**
 * 渲染标签高亮 ★ 按钮的 JSX。
 * @returns `<button class="highlight-btn" title="高亮显示">★</button>` 的
 *          React 元素，经 jsxToString 转 HTML 字符串后供 jQuery `$()` 构造。
 */
export function HighlightButton() {
    return (
        <button className="highlight-btn" title="高亮显示">
            ★
        </button>
    );
}
