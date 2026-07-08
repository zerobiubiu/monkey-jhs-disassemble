/**
 * WantWatchedImportButton —— 想看/看过页面"导入至 JHS"按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/want-and-watched-videos-plugin.ts 的 handle（L42/L57）：
 * 两处 `$("h3").append('<a class="..." id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>')`，
 * want 变体用 a-primary 类、watched 变体用 a-success 类。由 `.append()` 消费。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handle 中 `.append()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$("h3").append(jsxToString(<WantWatchedImportButton variant="want" />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** WantWatchedImportButton 的变体。 */
export type WantWatchedImportButtonVariant = 'want' | 'watched';

/** WantWatchedImportButton 的属性。 */
export interface WantWatchedImportButtonProps {
    /** 变体（want=a-primary，watched=a-success）。 */
    variant: WantWatchedImportButtonVariant;
}

/**
 * 渲染"导入至 JHS"按钮的 JSX。
 * @returns 导入按钮 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function WantWatchedImportButton({ variant }: WantWatchedImportButtonProps) {
    const cls = variant === 'want' ? 'a-primary' : 'a-success';
    return (
        <a className={cls} id="wantWatchBtn" style={{ padding: '10px' }}>
            导入至 JHS
        </a>
    );
}
