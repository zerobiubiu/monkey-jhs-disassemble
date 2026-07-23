/**
 * ScrollTopIcon —— 回到顶部按钮的向上箭头 SVG 图标（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-waterfall-plugin.ts L475 的 innerHTML SVG 字面量。
 * SVG 仅含 viewBox / d 属性（JSX+jsxToString 安全），以 JSX 表达。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供无法书写 JSX 的 `.ts` 模块消费时，
 * 使用 `scrollTopIconHtml()` 便捷辅助直接获取 HTML 字符串。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import { jsxToString } from '../../core/jsx-to-string';

/** 向上箭头 SVG 路径数据。 */
const SCROLL_TOP_SVG_PATH = 'M12 4l-8 8h6v8h4v-8h6z';

/**
 * 渲染回到顶部箭头 SVG 的 JSX。
 * @returns `<svg viewBox="0 0 24 24"><path d="..."/></svg>` 的 React 元素
 */
export function ScrollTopIcon() {
    return (
        <svg viewBox="0 0 24 24">
            <path d={SCROLL_TOP_SVG_PATH} />
        </svg>
    );
}

/**
 * 便捷辅助：返回向上箭头 SVG 的 HTML 字符串。
 *
 * 供无法书写 JSX 的 `.ts` 模块（如 src/plugins/list-waterfall-plugin.ts）
 * 设置 innerHTML 使用，等价于 `jsxToString(<ScrollTopIcon />)`。
 * @returns `<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z"/></svg>` 的 HTML 字符串
 */
export function scrollTopIconHtml(): string {
    return jsxToString(<ScrollTopIcon />);
}
