/**
 * CSS 注入 helper（原 main.tsx 中的 H）
 *
 * 将 CSS 文本注入 document.head：
 *  - 当文本包含 `<style>` 标签时，直接 insertAdjacentHTML（保留标签结构）；
 *  - 否则创建 `<style>` 元素并 textContent 赋值后 appendChild。
 * 空字符串入参不做任何操作。
 */

/**
 * 将 CSS 文本注入到 document.head。
 *
 * @param css - CSS 文本；可包含 `<style>` 标签包裹，也可为纯样式文本。空串将被忽略。
 */
export function injectCss(css: string): void {
    if (css) {
        if (css.includes('<style>')) {
            document.head.insertAdjacentHTML('beforeend', css);
        } else {
            const el = document.createElement('style');
            el.textContent = css;
            document.head.appendChild(el);
        }
    }
}
