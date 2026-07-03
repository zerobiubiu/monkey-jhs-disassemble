/**
 * PreviewVideoActionBtn —— 预览视频操作按钮（屏蔽/收藏/快进）HTML 字符串组件。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 handleVideo（L658-668）：原
 * `$(\`<button class="menu-btn" id="video-..." style="...">文案 (快捷键)</button>\`)`
 * 三处创建（屏蔽/收藏/快进），由 `$actionGroup.append($btn)` 消费。hotKey 缺省时
 * 不显示快捷键括号。id/color/label/hotKey 通过 prop 注入。
 *
 * 保留原 class（menu-btn）/id/内联 style（背景色）/文案与快捷键括号逻辑原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
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
 * 渲染预览视频操作按钮的 HTML 字符串。
 * @returns menu-btn HTML，供 `$(html)` 创建后 `.append()` 消费。
 */
export function PreviewVideoActionBtn({
    id,
    color,
    label,
    hotKey,
}: PreviewVideoActionBtnProps): string {
    return `<button class="menu-btn" id="${id}" style="min-width: 120px; background-color:${color};">${label} ${hotKey ? "(" + hotKey + ")" : ""}</button>`;
}
