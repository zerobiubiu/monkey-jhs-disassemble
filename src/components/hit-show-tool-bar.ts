/**
 * HitShowToolBar —— 热播榜单日/周/月切换工具栏 HTML 字符串组件。
 *
 * 提取自 src/plugins/hit-show-plugin.ts 的 toolBar（L115-118）：原模板拼接
 * `<div class="button-group">` 内含 conditionBox 三按钮（日榜/周榜/月榜），
 * 当前 period 对应按钮高亮 is-info，由 `this.contentBox.append(html)` 消费。
 *
 * 保留原 HTML 结构、类名、内联 style、href 与 \n 转义原样不动；period 通过
 * prop 注入决定各按钮 is-info 类。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** HitShowToolBar 的属性。 */
export interface HitShowToolBarProps {
    /** 时间段（"daily"/"weekly"/"monthly"），URL 缺省时为 null。 */
    period: string | null;
}

/**
 * 渲染热播日/周/月榜切换工具栏的 HTML 字符串。
 * @param props.period 时间段，决定对应按钮 is-info 高亮
 * @returns button-group HTML，供 `.append()` 消费。
 */
export function HitShowToolBar({ period }: HitShowToolBarProps): string {
    return `\n            <div class="button-group" style="margin-top:18px">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "daily" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "weekly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "monthly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n                </div>\n            </div>\n        `;
}
