/**
 * KeywordLabel —— 屏蔽关键词标签 HTML 字符串组件（链接/块 两种变体）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 addLabelTag（L966-972）：原依
 * `/^[a-z]{2,}-/i` 且 isJavdbSite 渲染 `<a class="keyword-label" href="/video_codes/...">`
 * 链接变体（蓝色文字），否则渲染 `<div class="keyword-label">` 块变体。均含
 * keyword 文本 + `<span class="keyword-remove">×</span>`。由 `$(html)` 创建后
 * `.append()` 到 .tag-box。
 *
 * 保留原 class/data-keyword/内联 style/\<span class="keyword-remove"> 原样不动；
 * keyword / bgColor / textColor / variant / href 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

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
 * 渲染屏蔽关键词标签的 HTML 字符串。
 * @returns keyword-label HTML，供 `$(html)` 创建后 `.append()` 消费。
 */
export function KeywordLabel({
    keyword,
    bgColor,
    textColor,
    variant,
    href,
}: KeywordLabelProps): string {
    if (variant === "link") {
        return `\n                <a class="keyword-label" data-keyword="${keyword}" style="background-color: ${bgColor}; color: ${textColor}" href="${href}" target="_blank">\n                    ${keyword}\n                    <span class="keyword-remove">×</span>\n                </a>\n            `;
    }
    return `\n                <div class="keyword-label" data-keyword="${keyword}" style="background-color: ${bgColor}; color: ${textColor}">\n                    ${keyword}\n                    <span class="keyword-remove">×</span>\n                </div>\n            `;
}
