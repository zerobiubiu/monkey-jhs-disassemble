/**
 * WantWatchedHintSpan —— 想看/看過页面标题提示 HTML 字符串组件。
 *
 * 提取自 src/plugins/want-and-watched-videos-plugin.ts 的 handle（L44/L59）：
 * 两处 `$("h3").append('<span style="...">（JHS 现已在详情页自动同步"想看|看過"，本页按钮仅用于初始补录）</span>')`，
 * 在标题后追加说明。variant 决定文案（want=想看 / watched=看過）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** WantWatchedHintSpan 的变体。 */
export type WantWatchedHintVariant = "want" | "watched";

/** WantWatchedHintSpan 的属性。 */
export interface WantWatchedHintSpanProps {
    /** 变体（want=想看，watched=看過）。 */
    variant: WantWatchedHintVariant;
}

/**
 * 渲染标题提示 span 的 HTML 字符串。
 * @returns 提示 span HTML，供 `.append()` 消费。
 */
export function WantWatchedHintSpan({ variant }: WantWatchedHintSpanProps): string {
    const label = variant === "want" ? "想看" : "看過";
    return `<span style="margin-left:8px;color:#888;font-size:12px;">（JHS 现已在详情页自动同步"${label}"，本页按钮仅用于初始补录）</span>`;
}
