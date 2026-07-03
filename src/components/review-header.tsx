/**
 * ReviewHeader —— 评论区头部（分隔线 + 折叠/展开按钮）（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.showReview 提供：左右渐变分隔线 + "❓ 评论区" + 折叠/展开按钮
 * （含 toggle-text / toggle-icon），由 `target.append(html)` 消费。
 * isExpanded === YES 时显示"折叠▲"，否则"展开▼"。
 *
 * 保留原 `<div style="display:flex;...">` 结构、id（reviewsFold）、类名、内联 style、
 * data-tip、文案原样不动；foldText / iconText 通过 prop 注入（由调用方依
 * isExpanded === YES 预计算）。折叠链接色 #1890ff 与 archetype 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 showReview 中 `target.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `target.append(jsxToString(<ReviewHeader foldText={...} iconText={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** ReviewHeader 的属性。 */
export interface ReviewHeaderProps {
    /** 折叠/展开按钮文案（"折叠" 或 "展开"）。 */
    foldText: string;
    /** 折叠/展开图标（"▲" 或 "▼"）。 */
    iconText: string;
}

/**
 * 渲染评论区头部的 JSX。
 * @param props.foldText 折叠/展开按钮文案
 * @param props.iconText 折叠/展开图标
 * @returns 评论区头部 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ReviewHeader({ foldText, iconText }: ReviewHeaderProps) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                margin: "16px 0",
                color: "#666",
                fontSize: "14px",
            }}
        >
            <span
                style={{
                    flex: 1,
                    height: "1px",
                    background:
                        "linear-gradient(to right, transparent, #999, transparent)",
                }}
            ></span>
            <span
                style={{ padding: "0 10px" }}
                data-tip="想要发表评论? 滑上去, 点击上面的按钮-看过"
            >
                ❓ 评论区
            </span>
            <a
                id="reviewsFold"
                style={{
                    marginLeft: "8px",
                    color: "#1890ff",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <span className="toggle-text">{foldText}</span>
                <span className="toggle-icon" style={{ marginLeft: "4px" }}>
                    {iconText}
                </span>
            </a>
            <span
                style={{
                    flex: 1,
                    height: "1px",
                    background:
                        "linear-gradient(to right, transparent, #999, transparent)",
                }}
            ></span>
        </div>
    );
}
