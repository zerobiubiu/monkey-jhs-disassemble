/**
 * StatusTag —— 列表项状态标签 React 组件（示范，孤立可用，不被 main.tsx 引入）。
 *
 * 提取自 src/plugins/list-page-plugin.ts：
 *   - renderItemStatusTag 的 tagHtml（L376）—— JavDb 站 <span> 变体
 *   - filterMovieList 的 tagHtml（L545-547）—— JavDb <span> / JavBus <a> 双变体
 *   - STATUS_TAG_CONFIG（L76-126）的颜色/文案/reasonType 由调用方解析后以 props 传入
 *
 * 保留原 HTML 结构与 CSS 类名（tag is-success status-tag / a-primary status-tag /
 * tag）、data-tip/title 属性、内联 style（含 `!important`，React 19 以字符串保留）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。
 * 如需供 layer/jQuery 字符串消费，可用
 *   `renderToStaticMarkup(<StatusTag {...props} />)`（来自 react-dom/server）
 * 转换为 HTML 字符串后 `.append()`。
 */
import type { CSSProperties } from "react";

/** 状态标签出现位置（对应原 tagPosition 设置：rightTop/leftTop）。 */
export type StatusTagPosition = "rightTop" | "leftTop";

/** 状态标签所属站点（决定 JavDb <span> / JavBus <a> 变体）。 */
export type StatusTagSite = "javdb" | "javbus";

export interface StatusTagProps {
    /** 标签文案（如 "🚫 已屏蔽" / "⭐ 已收藏" / "🔍 已观看"）。 */
    text: string;
    /** 标签背景色（如 BLOCK_COLOR / FAVORITE_COLOR / WATCHED_COLOR）。 */
    color: string;
    /** 悬停提示原因（data-tip）；缺省渲染空串。 */
    reasonText?: string;
    /** 出现位置，默认 "rightTop"（右上）。 */
    position?: StatusTagPosition;
    /** 站点变体，默认 "javdb"。 */
    site?: StatusTagSite;
}

/**
 * 计算定位片段：rightTop → right:0；leftTop → left:0；top 固定 5px。
 * @param position 位置枚举
 */
function positionStyle(position: StatusTagPosition): CSSProperties {
    return position === "leftTop"
        ? { left: 0, top: "5px" }
        : { right: 0, top: "5px" };
}

/**
 * 渲染列表项状态标签。
 * - site="javdb"：`<span class="tag is-success status-tag">`
 * - site="javbus"：`<a class="a-primary status-tag"><span class="tag">`
 * 与原 tagHtml 的类名、内联样式、data-tip/title 属性保持一致。
 */
export function StatusTag({
    text,
    color,
    reasonText = "",
    position = "rightTop",
    site = "javdb",
}: StatusTagProps) {
    const pos = positionStyle(position);
    if (site === "javbus") {
        const style: CSSProperties = {
            marginRight: "5px",
            padding: "0 5px",
            color: "#fff !important",
            borderRadius: "10px",
            position: "absolute",
            zIndex: 10,
            backgroundColor: `${color} !important`,
            ...pos,
        };
        return (
            <a
                className="a-primary status-tag"
                data-tip={reasonText}
                title=""
                style={style}
            >
                <span className="tag" style={{ color: "#fff !important" }}>
                    {text}
                </span>
            </a>
        );
    }
    const style: CSSProperties = {
        marginRight: "5px",
        borderRadius: "10px",
        position: "absolute",
        zIndex: 10,
        backgroundColor: `${color} !important`,
        ...pos,
    };
    return (
        <span
            className="tag is-success status-tag"
            data-tip={reasonText}
            title=""
            style={style}
        >
            {text}
        </span>
    );
}
