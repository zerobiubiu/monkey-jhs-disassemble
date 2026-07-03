/**
 * RelatedHeader —— 相关清单区头部（分隔线 + 折叠/展开按钮）（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.showRelated 提供：左右渐变分隔线 + "相关清单" + 折叠/展开按钮
 * （含 toggle-text / toggle-icon），由 `target.append(html)` 消费。
 * isExpanded === YES 时显示"折叠▲"，否则"展开▼"。
 *
 * 结构对称 ReviewHeader（doc/13 已提取），文案为原版"相关清单"（无 emoji，非"相关合集"），
 * DOM ID 沿用原版单数 related 命名（relatedFold），不携带评论区专属 data-tip。
 * 折叠链接色 #1897ff 与 archetype L10602 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 showRelated 中 `target.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `target.append(jsxToString(<RelatedHeader foldText={...} iconText={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** RelatedHeader 的属性。 */
export interface RelatedHeaderProps {
    /** 折叠/展开按钮文案（"折叠" 或 "展开"）。 */
    foldText: string;
    /** 折叠/展开图标（"▲" 或 "▼"）。 */
    iconText: string;
}

/**
 * 渲染相关清单区头部的 JSX。
 * @param props.foldText 折叠/展开按钮文案
 * @param props.iconText 折叠/展开图标
 * @returns 相关清单头部 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RelatedHeader({ foldText, iconText }: RelatedHeaderProps) {
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
            <span style={{ padding: "0 10px" }}>相关清单</span>
            <a
                id="relatedFold"
                style={{
                    marginLeft: "8px",
                    color: "#1897ff",
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
