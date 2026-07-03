/**
 * ActressInfoStarPageHtml —— 演员主页演员信息块 HTML 字符串组件。
 *
 * 提取自 src/plugins/actress-info-plugin.ts 的 handleStarPage（L187-191，
 * 原 archetype/jhs.user.js L4245-4259 的 html）：无信息版（actress-info
 * div，"无此相关演员信息"提示）与有信息版（actress-info a 链接，含
 * 出生日期/年龄/身高 与 体重/三围/罩杯 两行 flex 布局）。
 *
 * 保留原 HTML 结构、类名（actress-info）、内联 style（font-size:17px /
 * font-weight:normal / margin-top:5px / display:flex / margin-bottom:10px /
 * width:300px|200px）、target="_blank"、\n 转义与缩进原样不动，与原 html
 * 字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串（模板拼接，不用 JSX、不用
 * renderToStaticMarkup），供 handleStarPage 中 `.append(html)` 消费：
 *   `nameSectionEl.parent().append(ActressInfoStarPageHtml({ info }))`
 * info 是否存在决定有/无信息版分支，与原
 * `let html = 无信息版; if (info) { html = 有信息版; }` 等价。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。属性值不做转义，与原始 jQuery
 * `.append(htmlString)` 行为一致。
 */
import type { ActressWikiInfo } from "./actress-info-detail-segment";

/** ActressInfoStarPageHtml 的属性。 */
interface ActressInfoStarPageHtmlProps {
    /** 维基详情；非空渲染有信息版（双行 flex），null/undefined 渲染无信息版（"无此相关演员信息"）。 */
    info: ActressWikiInfo | null | undefined;
}

/**
 * 渲染演员主页演员信息块的 HTML 字符串。
 * @param props.info 维基详情（null/undefined 时渲染无信息版）
 * @returns actress-info 块 HTML，供 handleStarPage `.append()` 消费。
 */
export function ActressInfoStarPageHtml({
    info,
}: ActressInfoStarPageHtmlProps): string {
    if (info) {
        return `\n                <a class="actress-info" href="${info.url}" target="_blank">\n                    <div style="font-size: 17px; font-weight: normal; margin-top: 5px;">\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">出生日期: ${info.birthday}</span>\n                            <span style="width: 200px;">年龄: ${info.age}</span>\n                            <span style="width: 200px;">身高: ${info.height}</span>\n                        </div>\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">体重: ${info.weight}</span>\n                            <span style="width: 200px;">三围: ${info.threeSizeText}</span>\n                            <span style="width: 200px;">罩杯: ${info.braSize}</span>\n                        </div>\n                    </div>\n                </a>\n            `;
    }
    return '<div class="actress-info" style="font-size: 17px; font-weight: normal; margin-top: 5px;">无此相关演员信息</div>';
}
