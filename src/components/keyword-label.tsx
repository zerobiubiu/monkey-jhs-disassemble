/**
 * KeywordLabel —— 屏蔽关键词标签（React 函数组件，JSX，链接/块 两种变体）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 addLabelTag（L966-972）：原依
 * `/^[a-z]{2,}-/i` 且 isJavdbSite 渲染 `<a class="keyword-label" href="/video_codes/...">`
 * 链接变体（蓝色文字），否则渲染 `<div class="keyword-label">` 块变体。均含
 * keyword 文本 + `<span class="keyword-remove">×</span>`。由 `$(html)` 创建后
 * `.append()` 到 .tag-box。
 *
 * 保留原 class/data-keyword/内联 style（background-color/color）/`<span class="keyword-remove">`
 * 原样不动；keyword / bgColor / textColor / variant / href 通过 props 注入。
 * 原模板中的 `\n` 转义与缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响（keyword 文本与 `<span>` 间的换行空白折叠为无空白，inline 元素
 * 间无空格，DOM 等价——原 `keyword\n<空格><span>` 折叠后亦无空格）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 addLabelTag 中 `$()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串：
 *   `$(jsxToString(<KeywordLabel keyword={...} bgColor={...} textColor={...} variant="link" href={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义（data-keyword/keyword 等按本工程约定
 * 不转义，与原 jQuery `$(htmlString)` 行为一致）。
 */
import type { CSSProperties } from "react";

/** KeywordLabel 的变体（link=可跳转的 a，div=纯块）。 */
export type KeywordLabelVariant = "link" | "div";

/** KeywordLabel 的属性。 */
export interface KeywordLabelProps {
    /** 关键词文本。 */
    keyword: string;
    /** 背景色。 */
    bgColor: string;
    /** 文字色（link 变体为蓝色，div 变体为深灰）。 */
    textColor: string;
    /** 变体（link 时需提供 href）。 */
    variant: KeywordLabelVariant;
    /** link 变体的跳转地址（div 变体不用）。 */
    href?: string;
}

/**
 * 渲染屏蔽关键词标签的 JSX。
 * @param props.keyword 关键词文本
 * @param props.bgColor 背景色
 * @param props.textColor 文字色
 * @param props.variant 变体（link/div）
 * @param props.href link 变体跳转地址
 * @returns keyword-label JSX，经 jsxToString 转 HTML 字符串后供 `$(html)`
 *          创建后 `.append()` 消费。
 */
export function KeywordLabel({
    keyword,
    bgColor,
    textColor,
    variant,
    href,
}: KeywordLabelProps) {
    const style: CSSProperties = {
        backgroundColor: bgColor,
        color: textColor,
    };
    if (variant === "link") {
        return (
            <a
                className="keyword-label"
                data-keyword={keyword}
                style={style}
                href={href}
                target="_blank"
            >
                {keyword}
                <span className="keyword-remove">×</span>
            </a>
        );
    }
    return (
        <div className="keyword-label" data-keyword={keyword} style={style}>
            {keyword}
            <span className="keyword-remove">×</span>
        </div>
    );
}
