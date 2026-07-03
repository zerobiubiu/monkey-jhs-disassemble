/**
 * ActressInfoDetailSegment —— 影片详情页演员信息标签段 HTML 字符串组件。
 *
 * 提取自 src/plugins/actress-info-plugin.ts 的 handleDetailPage（L119-121，
 * 原 archetype/jhs.user.js L4194-4198 的 segment）：有信息版（panel-block
 * actress-info，含生日/年龄 + 身高/体重 + 三围/罩杯三组 info-tag 链接）与
 * 无信息版（panel-block actress-info，仅含指向维基搜索页的演员名链接）。
 *
 * 保留原 HTML 结构、类名（panel-block actress-info / info-tag）、
 * 内联 style（margin-left: 5px）、target="_blank"、\n 转义与缩进、尾随空格
 * 原样不动，与原 segment 字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串（模板拼接，不用 JSX、不用
 * renderToStaticMarkup），供 handleDetailPage 中 `.after(html)` 拼接消费：
 *   `html += ActressInfoDetailSegment({ actressName, info, wikiApiUrl: this.apiUrl })`
 * info 是否存在决定有/无信息版分支，与原三元一致；演员名/维基详情/URL 前缀
 * 等动态值由 props 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。属性值不做转义，与原始 jQuery
 * `.after(htmlString)` 行为一致。
 */

/** 演员维基百科详情（searchInfo 返回结构，对应原 L4304-4324 返回的对象字面量）。 */
export interface ActressWikiInfo {
    /** 生日（如 "1993年4月15日"）。 */
    birthday: string;
    /** 年龄（如 "30岁"；现年齢单元格为空时为空串）。 */
    age: string;
    /** 身高（如 "165cm"）。 */
    height: string;
    /** 体重（如 "50 kg"；为 "― kg" 占位时归一为空串）。 */
    weight: string;
    /** 三围文本（去除 cm 后的原始文本）。 */
    threeSizeText: string;
    /** 罩杯尺寸。 */
    braSize: string;
    /** 维基百科页面 URL。 */
    url: string;
}

/** ActressInfoDetailSegment 的属性。 */
interface ActressInfoDetailSegmentProps {
    /** 演员名（渲染到 <strong> 文本，无信息版拼接进维基搜索 href）。 */
    actressName: string;
    /** 维基详情；非空渲染有信息版（三组 info-tag），null/undefined 渲染无信息版。 */
    info: ActressWikiInfo | null | undefined;
    /** 维基 API URL 前缀（对应插件实例字段 apiUrl），无信息版拼接演员名得到搜索页 href。 */
    wikiApiUrl: string;
}

/**
 * 渲染影片详情页演员信息标签段的 HTML 字符串。
 * @param props.actressName 演员名
 * @param props.info 维基详情（null/undefined 时渲染无信息版）
 * @param props.wikiApiUrl 维基 API URL 前缀（无信息版拼接 href）
 * @returns panel-block actress-info 段 HTML，供 handleDetailPage `.after()` 拼接。
 */
export function ActressInfoDetailSegment({
    actressName,
    info,
    wikiApiUrl,
}: ActressInfoDetailSegmentProps): string {
    if (info) {
        return `\n                    <div class="panel-block actress-info">\n                        <strong>${actressName}:</strong>\n                        <a href="${info.url}" style="margin-left: 5px" target="_blank">\n                            <span class="info-tag">${info.birthday} ${info.age}</span>\n                            <span class="info-tag">${info.height} ${info.weight}</span>\n                            <span class="info-tag">${info.threeSizeText} ${info.braSize}</span>\n                        </a>\n                    </div>\n                `;
    }
    return `<div class="panel-block actress-info"><a href="${wikiApiUrl + actressName}" target="_blank"><strong>${actressName}:</strong></a></div> `;
}
