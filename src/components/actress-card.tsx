/**
 * ActressCard —— 收藏女优卡片（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 renderActressCards（L253）循环体：
 * 每个女优产出 `<div class="actress-card">` 含头像、名称、别名、上次检测/最后发行
 * 时间、停更提示、备注、编辑/取消收藏按钮（editSvg/deleteSvg）、类别标签、
 * 最新作品数量角标。由调用方循环拼接为 cardsHtml 后 `$container.html(cardsHtml)` 消费。
 *
 * 保留原 HTML 结构、类名、内联 style（经 CSSProperties 对象还原为 kebab-case
 * CSS 字符串，值原样保留）、data-* 属性（data-starId/data-tip 原样）。
 * 所有动态值（actress 派生字段、editSvg/deleteSvg、typeLabel/typeColor、
 * isStale/btnStyle、ruleTimeYears、actressUrl/allNameText/newVideoCount）
 * 通过 prop 注入。原模板 `ruleTimeHours / 24 / 365` 由调用方预算为
 * ruleTimeYears 传入（数字拼接，行为一致）。
 *
 * - 外层 div 的 background 由 isStale 控制：`{...(isStale ? { background: "#d4cece" } : null), minHeight: "370px"}`
 *   （原 `${isStale ? "background: #d4cece;" : ""} min-height: 370px;`，CSS 等价）。
 * - editSvg/deleteSvg 为原始 SVG HTML 字符串，用 `dangerouslySetInnerHTML={{ __html: ... }}`
 *   注入 `<a>`，避免 jsxToString 转义 SVG 的 `<`/`>`（doc/19 已为此扩展 jsxToString）。
 * - btnStyle 由原 string（`"background: linear-gradient(...);box-shadow: none"` 或 `""`）
 *   改为 CSSProperties 对象（`{ background: "linear-gradient(...)", boxShadow: "none" }` 或 `{}`，
 *   调用点同步对象化），jsxToString 输出等价 CSS。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 renderActressCards 循环消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串，再 `.join("")` 拼接：
 *   `pageActresses.map(a => jsxToString(<ActressCard {...props} />)).join("")`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。动态文本与属性由 jsxToString 统一转义（doc/129）。
 */
import type { CSSProperties } from 'react';

/** ActressCard 的属性。 */
export interface ActressCardProps {
    /** 女优 starId。 */
    starId: string;
    /** 头像 URL（缺省由调用方回退默认图）。 */
    avatar: string;
    /** 主名称。 */
    name: string;
    /** 别名合并文本。 */
    allNameText: string;
    /** 详情页链接。 */
    actressUrl: string;
    /** 上次检测时间（可能为空字符串）。 */
    lastCheckTime: string;
    /** 最后发行作品时间（可能为空字符串）。 */
    lastPublishTime: string;
    /** 是否停更。 */
    isStale: boolean;
    /** 停更年数（ruleTimeHours / 24 / 365，停更时展示）。 */
    ruleTimeYears: number;
    /** 备注（可能为空字符串）。 */
    remark: string;
    /** 编辑按钮内嵌 SVG。 */
    editSvg: string;
    /** 取消收藏按钮内嵌 SVG。 */
    deleteSvg: string;
    /** 按钮内联 style（停更时为渐变背景，否则空对象）。 */
    btnStyle: CSSProperties;
    /** 类别标签（"有码"/"无码"/"未知"）。 */
    typeLabel: string;
    /** 类别标签背景色。 */
    typeColor: string;
    /** 最新作品数量。 */
    newVideoCount: number;
}

/**
 * 渲染单个收藏女优卡片的 JSX。
 * @returns actress-card JSX，经 jsxToString 转 HTML 字符串后供循环拼接 `.html()` 消费。
 */
export function ActressCard({
    starId,
    avatar,
    name,
    allNameText,
    actressUrl,
    lastCheckTime,
    lastPublishTime,
    isStale,
    ruleTimeYears,
    remark,
    editSvg,
    deleteSvg,
    btnStyle,
    typeLabel,
    typeColor,
    newVideoCount
}: ActressCardProps) {
    return (
        <div
            className="actress-card"
            data-starId={starId}
            style={{
                ...(isStale ? { background: '#d4cece' } : null),
                minHeight: '370px'
            }}
        >
            <a
                href={actressUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    flexGrow: 1
                }}
            >
                <img src={avatar} alt={allNameText} className="actress-card-avatar" />
            </a>
            <div>
                <a
                    href={actressUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                        flexGrow: 1
                    }}
                >
                    <div className="actress-card-name">{name}</div>
                </a>
                <div className="actress-card-allname" title={allNameText}>
                    {allNameText}
                </div>
            </div>
            <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                <span>上次检测: {lastCheckTime}</span>
            </div>
            <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                <span>最后发行作品: {lastPublishTime}</span>
            </div>
            <div
                style={{
                    fontSize: '0.7em',
                    color: '#cc4444',
                    marginTop: '5px',
                    minHeight: '18px'
                }}
            >
                <span>{isStale ? `停更${ruleTimeYears}年以上, 下轮任务不再进行检测` : ''}</span>
            </div>
            <div
                style={{
                    fontSize: '0.8em',
                    marginTop: '5px',
                    color: '#3765c5',
                    minHeight: '10px'
                }}
            >
                <span>{remark}</span>
            </div>
            <div
                style={{
                    marginTop: '10px',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px'
                }}
            >
                <a
                    title="编辑"
                    className="card-btn btn-edit-actress"
                    style={btnStyle}
                    data-starId={starId}
                    dangerouslySetInnerHTML={{ __html: editSvg }}
                />
                <a
                    title="取消收藏"
                    className="card-btn btn-delete-actress"
                    style={btnStyle}
                    data-starId={starId}
                    dangerouslySetInnerHTML={{ __html: deleteSvg }}
                />
            </div>
            <div className="card-tag" style={{ backgroundColor: typeColor }}>
                {typeLabel}
            </div>
            <div className="card-new-count-tag" data-tip={`最新作品数量: ${newVideoCount}`}>
                🔔 {newVideoCount}
            </div>
        </div>
    );
}
