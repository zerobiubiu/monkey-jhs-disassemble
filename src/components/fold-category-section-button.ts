/**
 * FoldCategorySectionButton —— 折叠分类 section-title 按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 createFoldBtn（L167
 * sectionTitleEl.append）：当页面存在 h2.section-title 时，在其内追加的
 * 折叠分类按钮——外层 div#foldCategoryBtn 包装内层 a.menu-btn（红色背景、
 * 左外边距、去底边、圆角），含 span 文案占位 + i 图标占位。
 *
 * 保留原 HTML 结构、id（foldCategoryBtn 在外层 div）、class（menu-btn）、
 * 内联 style 与 \n 转义、缩进，零偏差。无动态值。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 createFoldBtn 中
 * $("h2.section-title").append(...) 消费。按钮文案/图标切换仍由
 * createFoldBtn 持有，组件只负责静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：不用 JSX、
 * 不用 renderToStaticMarkup。
 */

/**
 * 渲染折叠分类 section-title 按钮的 HTML 字符串。
 * @returns 按钮 HTML（div > a > span + i），供 jQuery .append() 消费。
 */
export function FoldCategorySectionButton(): string {
    return `\n                <div id="foldCategoryBtn">\n                    <a class="menu-btn" style="background-color:#d23e60 !important;margin-left: 20px;border-bottom:none !important;border-radius:3px;">\n                        <span></span>\n                        <i style="margin-left: 10px"></i>\n                    </a>\n                </div>\n            `;
}
