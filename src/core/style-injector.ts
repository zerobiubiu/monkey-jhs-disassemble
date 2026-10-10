/**
 * CSS 注入 helper（原 main.tsx 中的 H）
 *
 * 将 CSS 文本注入 document.head：
 *  - 当文本包含 `<style>` 标签时，直接 insertAdjacentHTML（保留标签结构）；
 *  - 否则创建 `<style>` 元素并 textContent 赋值后 appendChild。
 * 空字符串入参不做任何操作。
 */

/**
 * 样式表里的 CSS 占位符标记。
 *
 * **样式表里的标记与替换串必须逐字一致**：v1.28.15 的「原子化拆分」把注释统一
 * 格式化成 `/* X *\/`（补了内部空格），静默打断了两处注入（`__HIDENAV2__`、
 * `__SCROLLBAR__` 的 CSS 从未生效），直到 doc/55 才被发现并修复。故标记在此单点
 * 声明，形态固定为 `/* X *\/`，由 tests/css-placeholder.test.ts 守住
 * 「标记存在于对应样式表、替换后无残留」。
 */
export const CSS_PLACEHOLDER = {
    /** 隐藏站点原生导航（javdb-site.css） */
    hideNav: '/* __HIDENAV2__ */',
    /** 首页隐藏原生「大封面 / 小封面」切换（javdb-site.css） */
    hideCoverSize: '/* __HIDE_COVER_SIZE__ */',
    /** 自建滚动容器样式（common-toolbar.css） */
    scrollbar: '/* __SCROLLBAR__ */'
} as const;

/**
 * 用 css 文本替换 raw 中的占位符标记（标记不存在时原样返回）。
 *
 * @param raw - 含占位符标记的原始 CSS 文本
 * @param marker - 占位符标记（取 {@link CSS_PLACEHOLDER} 的值）
 * @param css - 要注入的 CSS 文本
 */
export function fillCssPlaceholder(raw: string, marker: string, css: string): string {
    return raw.replace(marker, css);
}

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
