/**
 * FoldCategoryToolbar —— 折叠分类工具条 HTML 字符串组件。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 createFoldBtn（L162
 * .tabs append）：右对齐弹性容器，含已选分类 span + 折叠分类按钮
 * （foldCategoryBtn，红色 a.menu-btn.main-tab-btn，span 文案占位 +
 * 可选快捷键提示 + i 图标占位）。
 *
 * 保留原 HTML 结构、id、class、内联 style 与 \n 转义、缩进，零偏差。
 * 已选分类文本与快捷键通过 props 注入；快捷键为空字符串时省略 " (xxx)"。
 *
 * 渲染方式：普通函数返回 HTML 字符串（模板拼接），供
 * createFoldBtn 中 $(".tabs").append(...) 消费。按钮文案/图标切换
 * 仍由 createFoldBtn 持有，组件只负责初始静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：不用 JSX、
 * 不用 renderToStaticMarkup。
 */

/** FoldCategoryToolbar 的属性。 */
export interface FoldCategoryToolbarProps {
    /** 已选分类文本（原 selectedTagsText，多个标签空格分隔）。 */
    selectedTagsText: string;
    /** 折叠分类快捷键（原 hotkey，空字符串则省略括号提示）。 */
    hotkey: string;
}

/**
 * 渲染折叠分类工具条的 HTML 字符串。
 * @param props.selectedTagsText 已选分类文本。
 * @param props.hotkey 折叠分类快捷键（空字符串则省略）。
 * @returns 工具条 HTML（已选分类 + 折叠按钮），供 jQuery .append() 消费。
 */
export function FoldCategoryToolbar({
    selectedTagsText,
    hotkey,
}: FoldCategoryToolbarProps): string {
    return `\n            <div style="display: flex;align-items: center;flex-grow:1;justify-content: flex-end;">\n                <div>已选分类: <span id="jhs-check-tag">${selectedTagsText}</span></div>\n                <a class="menu-btn  main-tab-btn" id="foldCategoryBtn" style="background-color:#d23e60 !important;">\n                    <span></span>\n                    ${hotkey ? ` (${hotkey})` : ""}\n                    <i style="margin-left: 10px"></i>\n                </a>\n\n            </div>\n        `;
}
