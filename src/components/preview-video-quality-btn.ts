/**
 * PreviewVideoQualityBtn —— 预览视频画质切换按钮 HTML 字符串组件。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 handleVideo（L644-646）：原
 * `$(\`<button class="video-control-btn...">` + .css 链式创建，含 id/data-quality/
 * data-video-src/内联 style（active 态蓝底白字），由 `$qualityGroup.append($btn)`
 * 消费。opt / src / isActive 通过 prop 注入。
 *
 * 保留原 class（video-control-btn + active）/id/data-* /内联 style 原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** PreviewVideoQualityBtn 的属性（opt 为画质选项常量，字段为 any）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PreviewVideoQualityBtnProps {
    /** 画质选项（含 id/quality/text 字段）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opt: any;
    /** 该画质对应的视频源 URL。 */
    src: string;
    /** 是否当前选中（active 态蓝底白字）。 */
    isActive: boolean;
}

/**
 * 渲染画质切换按钮的 HTML 字符串。
 * @returns video-control-btn HTML，供 `$(html)` 创建后 `.append()` 消费。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PreviewVideoQualityBtn({
    opt,
    src,
    isActive,
}: PreviewVideoQualityBtnProps): string {
    return `\n                    <button class="video-control-btn${isActive ? " active" : ""}" \n                            id="${opt.id}" \n                            data-quality="${opt.quality}"\n                            data-video-src="${src}"\n                            style="min-width: 40px; border: 1px solid #ccc; background-color: ${isActive ? "#007bff" : "#fff"}; color: ${isActive ? "white" : "black"};">\n                        ${opt.text}\n                    </button>\n                `;
}
