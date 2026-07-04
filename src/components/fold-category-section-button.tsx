/**
 * FoldCategorySectionButton —— 折叠分类 section-title 按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 createFoldBtn（L167
 * sectionTitleEl.append）：当页面存在 h2.section-title 时，在其内追加的
 * 折叠分类按钮——外层 div#foldCategoryBtn 包装内层 a.menu-btn（红色背景、
 * 左外边距、去底边、圆角），含 span 文案占位 + i 图标占位。
 *
 * 保留原 HTML 结构、id（foldCategoryBtn 在外层 div）、class（menu-btn）、
 * 内联 style 值零偏差（background-color / margin-left / border-bottom /
 * border-radius，含 `!important` 写入字符串值），语义等价。原模板中的 `\n`
 * 转义与缩进由 jsxToString 紧凑输出丢失（DOM 渲染等价，与示范
 * temporary-image-container.tsx 风格一致）。无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createFoldBtn 中
 * `$("h2.section-title").append(jsxToString(<FoldCategorySectionButton />))`
 * 消费。按钮文案/图标切换仍由 createFoldBtn 持有，组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。
 */
import type { CSSProperties } from 'react';

/**
 * 渲染折叠分类 section-title 按钮的 JSX。
 * @returns `div > a > span + i` 的 React 元素，经 jsxToString 转 HTML 字符串
 *          后供 jQuery .append() 消费。
 */
export function FoldCategorySectionButton() {
    const anchorStyle: CSSProperties = {
        backgroundColor: '#d23e60 !important',
        marginLeft: '20px',
        borderBottom: 'none !important',
        borderRadius: '3px'
    };
    const iconStyle: CSSProperties = { marginLeft: '10px' };
    return (
        <div id="foldCategoryBtn">
            <a className="menu-btn" style={anchorStyle}>
                <span></span>
                <i style={iconStyle}></i>
            </a>
        </div>
    );
}
