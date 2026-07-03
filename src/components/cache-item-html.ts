/**
 * CacheItemHtml —— 设置弹层缓存项卡片 HTML 字符串组件。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog（L289-292）map 回调：
 * 每个缓存项产出 `<div class="cache-item">` 含标题 + 清理/查看按钮（data-key），
 * 由调用方循环拼接为 cacheItemsHtml 后注入 SettingDialog 的 cache-panel。
 *
 * 保留原 class（cache-item / menu-btn clean-btn / menu-btn view-btn）、data-key、
 * 内联 style、`<span>` 文案原样不动；item.text / item.key / item.title 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** CacheItemHtml 的属性。 */
export interface CacheItemHtmlProps {
    /** 缓存项标题（如 "🎥 预览视频缓存"）。 */
    text: string;
    /** localStorage 键（data-key）。 */
    key: string;
    /** 清理按钮 title 提示。 */
    title: string;
}

/**
 * 渲染单个缓存项卡片的 HTML 字符串。
 * @returns cache-item HTML，供循环拼接后注入 SettingDialog。
 */
export function CacheItemHtml({ text, key, title }: CacheItemHtmlProps): string {
    return `\n            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">\n                <div style="font-weight: bold; margin-bottom: 8px;">${text}</div>\n                <div style="display: flex; gap: 8px;">\n                    <a class="menu-btn clean-btn" data-key="${key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${title}">\n                        <span>清理</span>\n                    </a>\n                    <a class="menu-btn view-btn" data-key="${key}" style="background-color:#b2bec0; flex:1; text-align:center;" >\n                        <span>查看</span>\n                    </a>\n                </div>\n            </div>\n        `;
}
