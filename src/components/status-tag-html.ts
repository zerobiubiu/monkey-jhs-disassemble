/**
 * StatusTagHtml —— 列表项状态标签 HTML 字符串组件。
 *
 * 提取自 src/plugins/list-page-plugin.ts：
 *   - renderItemStatusTag 的 tagHtml（L376）—— JavDb 站 <span> 变体
 *     （render 变体：data-tip=tagConfig.reasonType，style 内 `position:absolute;\n`
 *     无尾空格，title 与 style 同行）
 *   - filterMovieList 的 tagHtml（L545-547）—— JavDb <span> / JavBus <a> 双变体
 *     （filter 变体：data-tip=reasonText，style 内 `position:absolute; \n`
 *     有尾空格，title 后换行+缩进再 style）
 *
 * 与同目录 status-tag.tsx（JSX 示范组件，孤立可用，不被 main.tsx 引入）内容
 * 等价，但本组件返回 HTML 字符串（模板拼接），遵循 doc/06 统一规定：不用 JSX、
 * 不用 renderToStaticMarkup。
 *
 * 保留原 HTML 结构、CSS 类名（tag is-success status-tag / a-primary status-tag /
 * tag）、data-tip/title 属性、内联 style（含 `!important`）、\n 转义与缩进、
 * 尾随空格原样不动。render 与 filter 两变体在 style 换行/尾空格上有字符级
 * 差异，组件以 `variant` prop 区分以保零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供插件中 `.append(html)` 消费：
 *   - renderItemStatusTag：`StatusTagHtml({ site:"javdb", variant:"render", ... })`
 *   - filterMovieList JavDb：`StatusTagHtml({ site:"javdb", variant:"filter", ... })`
 *   - filterMovieList JavBus：`StatusTagHtml({ site:"javbus", variant:"filter", ... })`
 * text/color/dataTip/positionStyle 由调用方从 STATUS_TAG_CONFIG 与 setting.tagPosition
 * 解析后以 props 传入。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 jQuery `.append(htmlString)` 行为一致。
 */

/** 状态标签所属站点（决定 JavDb <span> / JavBus <a> 变体）。 */
export type StatusTagSite = "javdb" | "javbus";

/** 状态标签模板变体：render=renderItemStatusTag 用，filter=filterMovieList 用。 */
export type StatusTagVariant = "render" | "filter";

/** StatusTagHtml 的属性。 */
export interface StatusTagHtmlProps {
    /** 标签文案（如 BLOCKED_TEXT / FAVORITED_TEXT / WATCHED_TEXT）。 */
    text: string;
    /** 标签背景色（如 BLOCK_COLOR / FAVORITE_COLOR / WATCHED_COLOR）。 */
    color: string;
    /** 悬停提示原因（data-tip）；render 变体传 tagConfig.reasonType，filter 变体传 reasonText。 */
    dataTip: string;
    /** 定位片段：rightTop → "right: 0; top:5px;"，leftTop → "left: 0; top:5px;"。 */
    positionStyle: string;
    /** 站点变体，默认 "javdb"。 */
    site?: StatusTagSite;
    /** 模板变体，默认 "filter"（renderItemStatusTag 调用方须传 "render"）。 */
    variant?: StatusTagVariant;
}

/**
 * 渲染列表项状态标签的 HTML 字符串。
 * @param props.text 标签文案
 * @param props.color 标签背景色
 * @param props.dataTip 悬停提示原因（data-tip）
 * @param props.positionStyle 定位片段（right:0/left:0 + top:5px）
 * @param props.site 站点变体（默认 javdb；javbus 渲染 <a>+<span>）
 * @param props.variant 模板变体（默认 filter；render 用 renderItemStatusTag 的字符级模板）
 * @returns status-tag HTML，供 `.append()` 消费。
 */
export function StatusTagHtml({
    text,
    color,
    dataTip,
    positionStyle,
    site = "javdb",
    variant = "filter",
}: StatusTagHtmlProps): string {
    if (site === "javbus") {
        return `<a class="a-primary status-tag" data-tip="${dataTip}"  title=""\n                        style="margin-right: 5px; padding: 0 5px; color: #fff !important; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${color} !important; ${positionStyle}">\n                        <span class="tag" style="color:#fff !important;">${text}</span>\n                    </a>`;
    }
    if (variant === "render") {
        return `<span class="tag is-success status-tag" data-tip="${dataTip}" title="" style="margin-right: 5px; border-radius:10px; position:absolute;\n                        z-index:10; background-color: ${color} !important; ${positionStyle}">\n                        ${text}\n                    </span>`;
    }
    return `<span class="tag is-success status-tag" data-tip="${dataTip}" title=""\n                        style="margin-right: 5px; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${color} !important; ${positionStyle}">\n                        ${text}\n                    </span>`;
}
