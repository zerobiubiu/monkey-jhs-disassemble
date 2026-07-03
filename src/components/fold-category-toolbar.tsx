/**
 * FoldCategoryToolbar —— 折叠分类工具条（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fold-category-plugin.ts 的 createFoldBtn（L162
 * .tabs append）：右对齐弹性容器，含已选分类 span + 折叠分类按钮
 * （foldCategoryBtn，红色 a.menu-btn.main-tab-btn，span 文案占位 +
 * 可选快捷键提示 + i 图标占位）。
 *
 * 保留原 HTML 结构、id（foldCategoryBtn / jhs-check-tag）、class
 * （含原模板 `menu-btn  main-tab-btn` 的双空格原样保留）、内联 style 值
 * 零偏差（display:flex / align-items:center / flex-grow:1 /
 * justify-content:flex-end / background-color:#d23e60 !important /
 * margin-left:10px）。已选分类文本与快捷键通过 props 注入；快捷键为空
 * 字符串时省略 " (xxx)"。原模板中的 `\n` 转义与缩进由 jsxToString 紧凑
 * 输出丢失（DOM 渲染等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createFoldBtn 中
 * `$(".tabs").append(jsxToString(<FoldCategoryToolbar selectedTagsText={...} hotkey={...} />))`
 * 消费。按钮文案/图标切换仍由 createFoldBtn 持有，组件只负责初始静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。
 */
import type { CSSProperties } from "react";

/** FoldCategoryToolbar 的属性。 */
export interface FoldCategoryToolbarProps {
    /** 已选分类文本（原 selectedTagsText，多个标签空格分隔）。 */
    selectedTagsText: string;
    /** 折叠分类快捷键（原 hotkey，空字符串则省略括号提示）。 */
    hotkey: string;
}

/**
 * 渲染折叠分类工具条的 JSX。
 * @param props.selectedTagsText 已选分类文本。
 * @param props.hotkey 折叠分类快捷键（空字符串则省略）。
 * @returns 工具条 React 元素（已选分类 + 折叠按钮），经 jsxToString 转 HTML
 *          字符串后供 jQuery .append() 消费。
 */
export function FoldCategoryToolbar({
    selectedTagsText,
    hotkey,
}: FoldCategoryToolbarProps) {
    const containerStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        flexGrow: 1,
        justifyContent: "flex-end",
    };
    const anchorStyle: CSSProperties = {
        backgroundColor: "#d23e60 !important",
    };
    const iconStyle: CSSProperties = { marginLeft: "10px" };
    return (
        <div style={containerStyle}>
            <div>
                已选分类: <span id="jhs-check-tag">{selectedTagsText}</span>
            </div>
            <a
                className="menu-btn  main-tab-btn"
                id="foldCategoryBtn"
                style={anchorStyle}
            >
                <span></span>
                {hotkey ? ` (${hotkey})` : ""}
                <i style={iconStyle}></i>
            </a>
        </div>
    );
}
