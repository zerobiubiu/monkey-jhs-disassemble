/**
 * PreviewVideoActionBtn —— 预览视频操作按钮（屏蔽/收藏/快进）（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 handleVideo（L658-668）：原
 * `$(\`<button class="menu-btn" id="video-..." style="...">文案 (快捷键)</button>\`)`
 * 三处创建（屏蔽/收藏/快进），由 `$actionGroup.append($btn)` 消费。hotKey 缺省时
 * 不显示快捷键括号。id/color/label/hotKey 通过 prop 注入。
 *
 * 保留原 class（menu-btn）/id/内联 style（背景色）/文案与快捷键括号逻辑原样不动。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleVideo 中 `$(html)` 创建后
 * `.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量
 * JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$(jsxToString(<PreviewVideoActionBtn id={...} color={...} label={...} hotKey={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** PreviewVideoActionBtn 的属性。 */
export interface PreviewVideoActionBtnProps {
    /** 按钮 id（如 "video-filterBtn"）。 */
    id: string;
    /** 背景色（如 "#de3333"）。 */
    color: string;
    /** 按钮文案（如 "屏蔽"/"收藏"/"快进"）。 */
    label: string;
    /** 快捷键（缺省/空时不显示括号）。 */
    hotKey: string | null | undefined;
}

/**
 * 渲染预览视频操作按钮的 JSX。
 * @returns menu-btn JSX，经 jsxToString 转 HTML 字符串后供 `$(html)` 创建后 `.append()` 消费。
 */
export function PreviewVideoActionBtn({
    id,
    color,
    label,
    hotKey,
}: PreviewVideoActionBtnProps) {
    return (
        <button
            className="menu-btn"
            id={id}
            style={{
                minWidth: "120px",
                backgroundColor: color,
            }}
        >
            {label} {hotKey ? `(${hotKey})` : ""}
        </button>
    );
}
