/**
 * VideoTitleSpan —— JavBus 列表项标题 wrap span（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-page-plugin.ts 的 fixBusTitleBox（L309 的 wrap）：
 * 将 `.photo-info span:first` 的首个子节点（文本）包裹进
 * `<span class="video-title" title="${imgTitle}">${imgTitle}</span>`，
 * 供后续 findCarNumAndHref/translate/revertTranslation 通过 .video-title 定位。
 *
 * 保留原 HTML 结构、类名（video-title）、title 属性、内联文本，与原模板
 * 语义零偏差（title 属性值经 jsxToString 不转义，与原字符串拼接一致；
 * 文本节点经 escapeText 转义 &<>，但 imgTitle 通常为纯文本，DOM 渲染等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fixBusTitleBox 中
 * `.wrap(jsxToString(<VideoTitleSpan imgTitle={imgTitle} />))` 消费
 * （jQuery .wrap 接受 HTML 字符串）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。
 */

/** VideoTitleSpan 的属性。 */
export interface VideoTitleSpanProps {
    /** 标题文本（同时渲染为 title 属性与 span 文本内容）。 */
    imgTitle: string;
}

/**
 * 渲染 JavBus 列表项标题 wrap span 的 JSX。
 * @param props.imgTitle 标题文本
 * @returns `<span class="video-title" title="...">...</span>` 的 React 元素，
 *          经 jsxToString 转 HTML 字符串后供 .wrap() 消费。
 */
export function VideoTitleSpan({ imgTitle }: VideoTitleSpanProps) {
    return (
        <span className="video-title" title={imgTitle}>
            {imgTitle}
        </span>
    );
}
