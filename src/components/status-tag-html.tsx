/**
 * StatusTagHtml —— 列表项状态标签（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/list-page-plugin.ts：
 *   - renderItemStatusTag 的 tagHtml（L376）—— JavDb 站 <span> 变体
 *     （render 变体：data-tip=tagConfig.reasonType，style 内 `position:absolute;\n`
 *     无尾空格，title 与 style 同行）
 *   - filterMovieList 的 tagHtml（L545-547）—— JavDb <span> / JavBus <a> 双变体
 *     （filter 变体：data-tip=reasonText，style 内 `position:absolute; \n`
 *     有尾空格，title 后换行+缩进再 style）
 *
 * 保留原 HTML 结构、CSS 类名（tag is-success status-tag / a-primary status-tag /
 * tag）、data-tip/title 属性、内联 style 值（含 `!important`，以字符串值
 * 形式写入 CSSProperties，jsxToString 原样输出）、\n 转义与缩进、尾随空格
 * 语义等价（JSX 紧凑输出丢失属性间/子节点间 \n 空白，DOM/CSS 渲染等价，
 * 与示范 temporary-image-container.tsx 风格一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供插件中 `.append(html)` 消费：
 *   - renderItemStatusTag：`jsxToString(<StatusTagHtml site="javdb" variant="render" ... />)`
 *   - filterMovieList JavDb：`jsxToString(<StatusTagHtml site="javdb" variant="filter" ... />)`
 *   - filterMovieList JavBus：`jsxToString(<StatusTagHtml site="javbus" variant="filter" ... />)`
 * text/color/dataTip/positionStyle 由调用方从 STATUS_TAG_CONFIG 与
 * setting.tagPosition 解析后以 props 传入。
 *
 * variant 字段保留于接口以维持调用点稳定（renderItemStatusTag 传 "render"，
 * filterMovieList 传 "filter"）；在 JSX 模式下 render/filter 的差异仅在于
 * style 值内的 \n/尾空格，CSSProperties 无法表达且对 CSS 解析无影响，故
 * 函数体不再按 variant 分支，两变体输出一致（DOM 等价）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义（data-tip/title 等
 * 按本工程约定不转义，与原 jQuery `.append(htmlString)` 行为一致）。
 */
import type { CSSProperties } from 'react';

/** 状态标签所属站点（决定 JavDb <span> / JavBus <a> 变体）。 */
export type StatusTagSite = 'javdb' | 'javbus';

/** 状态标签模板变体：render=renderItemStatusTag 用，filter=filterMovieList 用。 */
export type StatusTagVariant = 'render' | 'filter';

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
 * 将调用方传入的定位片段字符串解析为 CSSProperties 对象。
 *
 * positionStyle 形如 `"right: 0; top:5px;"` 或 `"left: 0; top:5px;"`，
 * 由调用方据 setting.tagPosition 算出。此处按是否含 `right`/`left`
 * 分发为对象字段，供 CSSProperties 展开。输出经 jsxToString 还原为
 * `right:0;top:5px` / `left:0;top:5px`（与原值 CSS 等价，仅空白差异）。
 *
 * @param positionStyle 定位片段字符串
 * @returns CSSProperties 含 right/left + top 字段
 */
function parsePositionStyle(positionStyle: string): CSSProperties {
    if (positionStyle.includes('right')) {
        return { right: 0, top: '5px' };
    }
    return { left: 0, top: '5px' };
}

/**
 * 渲染列表项状态标签的 JSX。
 * @param props.text 标签文案
 * @param props.color 标签背景色
 * @param props.dataTip 悬停提示原因（data-tip）
 * @param props.positionStyle 定位片段（right:0/left:0 + top:5px）
 * @param props.site 站点变体（默认 javdb；javbus 渲染 <a>+<span>）
 * @param props.variant 模板变体（默认 filter；JSX 模式下不影响输出，保留接口）
 * @returns status-tag 的 React 元素，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function StatusTagHtml({
    text,
    color,
    dataTip,
    positionStyle,
    site = 'javdb'
}: StatusTagHtmlProps) {
    const posStyle = parsePositionStyle(positionStyle);
    if (site === 'javbus') {
        const outerStyle: CSSProperties = {
            marginRight: '5px',
            padding: '0 5px',
            color: '#fff !important',
            borderRadius: '10px',
            position: 'absolute',
            zIndex: 10,
            backgroundColor: `${color} !important`,
            ...posStyle
        };
        return (
            <a className="a-primary status-tag" data-tip={dataTip} title="" style={outerStyle}>
                <span className="tag" style={{ color: '#fff !important' }}>
                    {text}
                </span>
            </a>
        );
    }
    const spanStyle: CSSProperties = {
        marginRight: '5px',
        borderRadius: '10px',
        position: 'absolute',
        zIndex: 10,
        backgroundColor: `${color} !important`,
        ...posStyle
    };
    return (
        <span className="tag is-success status-tag" data-tip={dataTip} title="" style={spanStyle}>
            {text}
        </span>
    );
}
