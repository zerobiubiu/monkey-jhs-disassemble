/**
 * WantWatchedImportButton —— 想看/看過页面"导入至 JHS"按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/want-and-watched-videos-plugin.ts 的 handle（L42/L57）：
 * 两处 `$("h3").append('<a class="..." id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>')`，
 * want 变体用 a-primary 类、watched 变体用 a-success 类。由 `.append()` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** WantWatchedImportButton 的变体。 */
export type WantWatchedImportButtonVariant = "want" | "watched";

/** WantWatchedImportButton 的属性。 */
export interface WantWatchedImportButtonProps {
    /** 变体（want=a-primary，watched=a-success）。 */
    variant: WantWatchedImportButtonVariant;
}

/**
 * 渲染"导入至 JHS"按钮的 HTML 字符串。
 * @returns 导入按钮 HTML，供 `.append()` 消费。
 */
export function WantWatchedImportButton({
    variant,
}: WantWatchedImportButtonProps): string {
    const cls = variant === "want" ? "a-primary" : "a-success";
    return `<a class="${cls}" id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>`;
}
