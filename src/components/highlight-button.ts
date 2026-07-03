/**
 * HighlightButton —— 标签高亮 ★ 按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 highlightTag
 * （L109-111，原 archetype/jhs.user.js L4067 的 hover-in 回调内
 * `$('<button class="highlight-btn" title="高亮显示">★</button>')`）：
 * hover 标签时由 jQuery 构造此按钮并 append 到标签内，点击切换该标签的
 * 高亮收藏状态（增删 storageManager 高亮列表并同步 DOM 类名）。
 *
 * 保留原 HTML 结构、类名（highlight-btn）、title 属性、★ 字符原样不动，
 * 与原 jQuery `$('<button ...>★</button>')` 构造结果零偏差。无动态值。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 highlightTag 中
 * `$(HighlightButton())` 消费（jQuery 接受 HTML 字符串构造元素）。
 * hover 进出动画（fadeIn/fadeOut + remove）与 click 事件绑定仍由
 * highlightTag 持有，组件只负责静态 HTML。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 `$('<button ...>')` 行为一致。
 */

/**
 * 渲染标签高亮 ★ 按钮的 HTML 字符串。
 * @returns `<button class="highlight-btn" title="高亮显示">★</button>`，
 *          供 jQuery `$(HighlightButton())` 构造后 append 到标签内。
 */
export function HighlightButton(): string {
    return '<button class="highlight-btn" title="高亮显示">★</button>';
}
