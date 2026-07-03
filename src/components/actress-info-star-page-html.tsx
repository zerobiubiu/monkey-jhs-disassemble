/**
 * ActressInfoStarPageHtml —— 演员主页演员信息块（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/actress-info-plugin.ts 的 handleStarPage（L187-191，
 * 原 archetype/jhs.user.js L4245-4259 的 html）：无信息版（actress-info
 * div，"无此相关演员信息"提示）与有信息版（actress-info a 链接，含
 * 出生日期/年龄/身高 与 体重/三围/罩杯 两行 flex 布局）。
 *
 * 保留原 HTML 结构、类名（actress-info）、内联 style 值（font-size:17px /
 * font-weight:normal / margin-top:5px / display:flex / margin-bottom:10px /
 * width:300px|200px，经 CSSProperties 对象还原为 kebab-case CSS 字符串，值
 * 原样保留）、target="_blank" 零偏差。info 是否存在决定有/无信息版分支，
 * 与原 `let html = 无信息版; if (info) { html = 有信息版; }` 等价。原模板
 * 中的 `\n` 转义与缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS 渲染
 * 无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleStarPage 中 `.append(html)`
 * 消费：
 *   `nameSectionEl.parent().append(jsxToString(<ActressInfoStarPageHtml info={info} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 jQuery `.append(htmlString)`
 * 行为一致。
 */
import type { ActressWikiInfo } from "./actress-info-detail-segment";

/** ActressInfoStarPageHtml 的属性。 */
interface ActressInfoStarPageHtmlProps {
    /** 维基详情；非空渲染有信息版（双行 flex），null/undefined 渲染无信息版（"无此相关演员信息"）。 */
    info: ActressWikiInfo | null | undefined;
}

/**
 * 渲染演员主页演员信息块的 JSX。
 * @param props.info 维基详情（null/undefined 时渲染无信息版）
 * @returns actress-info 块 React 元素，经 jsxToString 转 HTML 字符串后供
 *          handleStarPage `.append()` 消费。
 */
export function ActressInfoStarPageHtml({
    info,
}: ActressInfoStarPageHtmlProps) {
    if (info) {
        return (
            <a
                className="actress-info"
                href={info.url}
                target="_blank"
            >
                <div
                    style={{
                        fontSize: "17px",
                        fontWeight: "normal",
                        marginTop: "5px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            marginBottom: "10px",
                        }}
                    >
                        <span style={{ width: "300px" }}>
                            出生日期: {info.birthday}
                        </span>
                        <span style={{ width: "200px" }}>
                            年龄: {info.age}
                        </span>
                        <span style={{ width: "200px" }}>
                            身高: {info.height}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginBottom: "10px",
                        }}
                    >
                        <span style={{ width: "300px" }}>
                            体重: {info.weight}
                        </span>
                        <span style={{ width: "200px" }}>
                            三围: {info.threeSizeText}
                        </span>
                        <span style={{ width: "200px" }}>
                            罩杯: {info.braSize}
                        </span>
                    </div>
                </div>
            </a>
        );
    }
    return (
        <div
            className="actress-info"
            style={{
                fontSize: "17px",
                fontWeight: "normal",
                marginTop: "5px",
            }}
        >
            无此相关演员信息
        </div>
    );
}
