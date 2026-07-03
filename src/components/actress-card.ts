/**
 * ActressCard —— 收藏女优卡片 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 renderActressCards（L253）循环体：
 * 每个女优产出 `<div class="actress-card">` 含头像、名称、别名、上次检测/最后发行
 * 时间、停更提示、备注、编辑/取消收藏按钮（editSvg/deleteSvg）、类别标签、
 * 最新作品数量角标。由调用方循环拼接为 cardsHtml 后 `$container.html(cardsHtml)` 消费。
 *
 * 保留原 HTML 结构、类名、内联 style、data-* 属性、\n 转义原样不动；
 * 所有动态值（actress 派生字段、editSvg/deleteSvg、typeLabel/typeColor、
 * isStale/btnStyle、ruleTimeYears、actressUrl/allNameText/newVideoCount）
 * 通过 prop 注入。原模板 `ruleTimeHours / 24 / 365` 由调用方预算为
 * ruleTimeYears 传入（数字拼接，行为一致）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

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
    /** 按钮内联 style（停更时为渐变背景，否则空字符串）。 */
    btnStyle: string;
    /** 类别标签（"有码"/"无码"/"未知"）。 */
    typeLabel: string;
    /** 类别标签背景色。 */
    typeColor: string;
    /** 最新作品数量。 */
    newVideoCount: number;
}

/**
 * 渲染单个收藏女优卡片的 HTML 字符串。
 * @returns actress-card HTML，供循环拼接后 `.html()` 消费。
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
    newVideoCount,
}: ActressCardProps): string {
    return `\n                <div class="actress-card" data-starId="${starId}" style="${isStale ? "background: #d4cece;" : ""} min-height: 370px;">\n                    <a href="${actressUrl}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                        <img src="${avatar}" alt="${allNameText}" class="actress-card-avatar">\n                    </a>\n\n                    <div>\n                        <a href="${actressUrl}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                            <div class="actress-card-name">${name}</div>\n                        </a>\n                        <div class="actress-card-allname" title="${allNameText}">${allNameText}</div>\n                    </div>\n                    \n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>上次检测: ${lastCheckTime}</span>\n                    </div>\n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>最后发行作品: ${lastPublishTime}</span>\n                    </div>\n\n                    <div style="font-size: 0.7em; color: #cc4444; margin-top: 5px; min-height: 18px">\n                         <span>${isStale ? "停更" + ruleTimeYears + "年以上, 下轮任务不再进行检测" : ""}</span>\n                    </div>\n                    \n                    <div style="font-size: 0.8em; margin-top: 5px; color: #3765c5; min-height: 10px">\n                         <span>${remark}</span>\n                    </div>\n                    \n                    <div style="margin-top: 10px;display: flex; justify-content:center; gap: 10px;">\n                        <a title="编辑" class="card-btn btn-edit-actress" style="${btnStyle}" data-starId="${starId}">${editSvg}</a>\n                        <a title="取消收藏" class="card-btn btn-delete-actress" style="${btnStyle}" data-starId="${starId}">${deleteSvg}</a>\n                    </div>\n                    \n                    <div class="card-tag" style="background-color:${typeColor}">${typeLabel}</div>\n                    <div class="card-new-count-tag" data-tip="最新作品数量: ${newVideoCount}">🔔 ${newVideoCount}</div>\n                </div>\n            `;
}
