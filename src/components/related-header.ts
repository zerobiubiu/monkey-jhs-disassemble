/**
 * RelatedHeader —— 相关清单区头部（分隔线 + 折叠/展开按钮）HTML 字符串组件。
 *
 * 为 RelatedPlugin.showRelated 提供：左右渐变分隔线 + "📁 相关清单" + 折叠/展开按钮
 * （含 toggle-text / toggle-icon），由 `target.append(html)` 消费。
 * isExpanded === YES 时显示"折叠▲"，否则"展开▼"。
 *
 * 结构对称 ReviewHeader（doc/13 已提取），文案为原版"相关清单"（非"相关合集"），
 * DOM ID 沿用原版单数 related 命名（relatedFold），不携带评论区专属 data-tip。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** RelatedHeader 的属性。 */
export interface RelatedHeaderProps {
    /** 折叠/展开按钮文案（"折叠" 或 "展开"）。 */
    foldText: string;
    /** 折叠/展开图标（"▲" 或 "▼"）。 */
    iconText: string;
}

/**
 * 渲染相关清单区头部的 HTML 字符串。
 * @returns 相关清单头部 HTML，供 `.append()` 消费。
 */
export function RelatedHeader({
    foldText,
    iconText,
}: RelatedHeaderProps): string {
    return `\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;">📁 相关清单</span>\n                <a id="relatedFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${foldText}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${iconText}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `;
}
