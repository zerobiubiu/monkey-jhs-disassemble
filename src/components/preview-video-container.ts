/**
 * PreviewVideoContainer —— 详情页预览视频封面入口 HTML 字符串组件。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 initDmm（L572-574）：原
 * `$(".preview-images").prepend(\`<a class="preview-video-container" data-fancybox="gallery" href="#preview-video"><span>預告片</span><img src="${coverSrc}" ...></a>\`)`，
 * 在预览图区首位插入预告片封面入口。coverSrc 通过 prop 注入。
 *
 * 保留原 class/data-fancybox/href/内联 style/alt 原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** PreviewVideoContainer 的属性。 */
export interface PreviewVideoContainerProps {
    /** 封面图 src。 */
    coverSrc: string;
}

/**
 * 渲染预览视频封面入口的 HTML 字符串。
 * @returns preview-video-container HTML，供 `.prepend()` 消费。
 */
export function PreviewVideoContainer({
    coverSrc,
}: PreviewVideoContainerProps): string {
    return `\n                    <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                        <span>預告片</span>\n                        <img src="${coverSrc}" class="video-cover" style="width: 150px; height: auto;" alt="">\n                    </a>\n                `;
}
