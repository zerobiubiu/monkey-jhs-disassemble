/**
 * SectionHeader —— 通用区块头部（分隔线 + 折叠/展开按钮）（React 函数组件，JSX）。
 *
 * 合并 ReviewHeader / RelatedHeader：左右渐变分隔线 + 标题 + 折叠/展开按钮
 * （含 toggle-text / toggle-icon），由 `target.append(html)` 消费。
 * isExpanded === YES 时显示"折叠▲"，否则"展开▼"。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `target.append()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionHeader 的属性。 */
export interface SectionHeaderProps {
    /** 标题文案（如 "❓ 评论区" / "相关清单"）。 */
    title: string;
    /** 折叠按钮 DOM id（如 "reviewsFold" / "relatedFold"）。 */
    foldId: string;
    /** 折叠链接色（如 "#1890ff" / "#1897ff"）。 */
    linkColor: string;
    /** 标题 data-tip 提示（可选，评论区专属）。 */
    tooltip?: string;
    /** 折叠/展开按钮文案（"折叠" 或 "展开"）。 */
    foldText: string;
    /** 折叠/展开图标（"▲" 或 "▼"）。 */
    iconText: string;
}

/**
 * 渲染区块头部的 JSX。
 * @returns 区块头部 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function SectionHeader({ title, foldId, linkColor, tooltip, foldText, iconText }: SectionHeaderProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                margin: '16px 0',
                color: '#666',
                fontSize: '14px'
            }}
        >
            <span
                style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, #999, transparent)'
                }}
            ></span>
            <span style={{ padding: '0 10px' }} data-tip={tooltip}>
                {title}
            </span>
            <a
                id={foldId}
                style={{
                    marginLeft: '8px',
                    color: linkColor,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <span className="toggle-text">{foldText}</span>
                <span className="toggle-icon" style={{ marginLeft: '4px' }}>
                    {iconText}
                </span>
            </a>
            <span
                style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, #999, transparent)'
                }}
            ></span>
        </div>
    );
}
