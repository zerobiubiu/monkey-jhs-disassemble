/**
 * VideoQualityOption —— 预览视频画质下拉选项 HTML 字符串组件。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog（L296-298）循环：
 * VIDEO_QUALITY_LIST 中 canSelect 的项产出 `<option value="...">text</option>`，
 * 由调用方循环拼接为 qualityOptionsHtml 后注入 SettingDialog 的 videoQuality 下拉。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** VideoQualityOption 的属性。 */
export interface VideoQualityOptionProps {
    /** 画质值（option value）。 */
    quality: string;
    /** 画质文案（option 文本）。 */
    text: string;
}

/**
 * 渲染单个画质下拉选项的 HTML 字符串。
 * @returns option HTML，供循环拼接后注入 SettingDialog。
 */
export function VideoQualityOption({
    quality,
    text,
}: VideoQualityOptionProps): string {
    return `<option value="${quality}">${text}</option>`;
}
