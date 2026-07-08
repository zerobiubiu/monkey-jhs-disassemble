/**
 * WantWatchedHintSpan —— 想看/看过页面标题提示（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/want-and-watched-videos-plugin.ts 的 handle（L44/L59）：
 * 两处 `$("h3").append('<span style="...">（JHS 现已在详情页自动同步"想看|看过"，本页按钮仅用于初始补录）</span>')`，
 * 在标题后追加说明。variant 决定文案（want=想看 / watched=看过）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handle 中 `.append()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$("h3").append(jsxToString(<WantWatchedHintSpan variant="want" />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** WantWatchedHintSpan 的变体。 */
export type WantWatchedHintVariant = 'want' | 'watched';

/** WantWatchedHintSpan 的属性。 */
export interface WantWatchedHintSpanProps {
    /** 变体（want=想看，watched=看过）。 */
    variant: WantWatchedHintVariant;
}

/**
 * 渲染标题提示 span 的 JSX。
 * @returns 提示 span JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function WantWatchedHintSpan({ variant }: WantWatchedHintSpanProps) {
    const label = variant === 'want' ? '想看' : '看过';
    return (
        <span
            style={{
                marginLeft: '8px',
                color: '#888',
                fontSize: '12px'
            }}
        >
            （JHS 现已在详情页自动同步"{label}"，本页按钮仅用于初始补录）
        </span>
    );
}
