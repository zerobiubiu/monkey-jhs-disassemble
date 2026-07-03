/**
 * HitShowToolBar —— 热播榜单日/周/月切换工具栏（React 函数组件，JSX）。
 *
 * 为 HitShowPlugin.toolBar 提供：`<div class="button-group">` 内含 conditionBox
 * 三按钮（日榜/周榜/月榜），当前 period 对应按钮高亮 is-info，
 * 由 `this.contentBox.append(html)` 消费。
 *
 * 保留原 HTML 结构、类名、内联 style、href 原样不动；period 通过 prop 注入
 * 决定各按钮 is-info 类。`padding:18px 18px !important` 以
 * `style={{ padding: "18px 18px !important" }}` 保留（!important 写在值里）；
 * href 含 `&` 作为属性值不转义（jsxToString 不转义属性值，与原模板一致），
 * 用表达式 `href={"/...&..."}` 形式避免 JSX 对属性字面量做实体解码。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 toolBar 中 `this.contentBox.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `this.contentBox.append(jsxToString(<HitShowToolBar period={period} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** HitShowToolBar 的属性。 */
export interface HitShowToolBarProps {
    /** 时间段（"daily"/"weekly"/"monthly"），URL 缺省时为 null。 */
    period: string | null;
}

/**
 * 渲染热播日/周/月榜切换工具栏的 JSX。
 * @param props.period 时间段，决定对应按钮 is-info 高亮
 * @returns button-group JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function HitShowToolBar({ period }: HitShowToolBarProps) {
    return (
        <div className="button-group" style={{ marginTop: "18px" }}>
            <div className="buttons has-addons" id="conditionBox">
                <a
                    style={{ padding: "18px 18px !important" }}
                    className={`button is-small ${period === "daily" ? "is-info" : ""}`}
                    href={"/advanced_search?handlePlayback=1&period=daily"}
                >
                    日榜
                </a>{" "}
                <a
                    style={{ padding: "18px 18px !important" }}
                    className={`button is-small ${period === "weekly" ? "is-info" : ""}`}
                    href={"/advanced_search?handlePlayback=1&period=weekly"}
                >
                    周榜
                </a>{" "}
                <a
                    style={{ padding: "18px 18px !important" }}
                    className={`button is-small ${period === "monthly" ? "is-info" : ""}`}
                    href={"/advanced_search?handlePlayback=1&period=monthly"}
                >
                    月榜
                </a>
            </div>
        </div>
    );
}
