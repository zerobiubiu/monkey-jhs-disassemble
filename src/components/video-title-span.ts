/**
 * VideoTitleSpan —— JavBus 列表项标题 wrap span HTML 字符串组件。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 fixBusTitleBox（L309 的 wrap）：
 * 将 `.photo-info span:first` 的首个子节点（文本）包裹进
 * `<span class="video-title" title="${imgTitle}">${imgTitle}</span>`，
 * 供后续 findCarNumAndHref/translate/revertTranslation 通过 .video-title 定位。
 *
 * 保留原 HTML 结构、类名（video-title）、title 属性、内联文本，与原模板零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 fixBusTitleBox 中
 * `.wrap(VideoTitleSpan({ imgTitle }))` 消费（jQuery .wrap 接受 HTML 字符串）。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 jQuery `.wrap(htmlString)` 行为一致。
 */

/** VideoTitleSpan 的属性。 */
export interface VideoTitleSpanProps {
    /** 标题文本（同时渲染为 title 属性与 span 文本内容）。 */
    imgTitle: string;
}

/**
 * 渲染 JavBus 列表项标题 wrap span 的 HTML 字符串。
 * @param props.imgTitle 标题文本
 * @returns `<span class="video-title" title="...">...</span>`，供 .wrap() 消费。
 */
export function VideoTitleSpan({ imgTitle }: VideoTitleSpanProps): string {
    return `<span class="video-title" title="${imgTitle}">${imgTitle}</span>`;
}
