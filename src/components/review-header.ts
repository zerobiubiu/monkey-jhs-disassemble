/**
 * ReviewHeader —— 评论区头部（分隔线 + 折叠/展开按钮）HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 showReview（L110-112）：原模板拼接
 * 评论区头部（左右渐变分隔线 + "❓ 评论区" + 折叠/展开按钮，含 toggle-text /
 * toggle-icon），由 `target.append(html)` 消费。isExpanded === YES 时显示"折叠▲"，
 * 否则"展开▼"。
 *
 * 保留原 `<div style="display:flex;...">` 结构、id（reviewsFold）、类名、内联 style、
 * data-tip、\n 转义原样不动；foldText / iconText 通过 prop 注入（由调用方依
 * isExpanded === YES 预计算）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** ReviewHeader 的属性。 */
export interface ReviewHeaderProps {
    /** 折叠/展开按钮文案（"折叠" 或 "展开"）。 */
    foldText: string;
    /** 折叠/展开图标（"▲" 或 "▼"）。 */
    iconText: string;
}

/**
 * 渲染评论区头部的 HTML 字符串。
 * @returns 评论区头部 HTML，供 `.append()` 消费。
 */
export function ReviewHeader({ foldText, iconText }: ReviewHeaderProps): string {
    return `\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;" data-tip="想要发表评论? 滑上去, 点击上面的按钮-看过">❓ 评论区</span>\n                <a id="reviewsFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${foldText}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${iconText}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `;
}
