/**
 * ReviewItem —— 评论区单条评论卡片 HTML 字符串组件。
 *
 * 提取自 src/plugins/review-plugin.ts 的 displayReviews（L258-259）：原模板拼接
 * `<div class="item columns is-desktop">` 含楼号、用户名、星级、时间、点赞数、正文
 * （正文内链接已由 ReviewLinkContent 转换）。由 `container.append(html)` 消费。
 *
 * 保留原 class/id/内联 style、`<p class="review-content">`、\n 转义原样不动；
 * floor / username / stars / time / likesCount / content 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** ReviewItem 的属性。 */
export interface ReviewItemProps {
    /** 楼号（调用方传入当前楼号，自增由调用方处理）。 */
    floor: number;
    /** 用户名。 */
    username: string;
    /** 星级 HTML（由调用方 Array(score).fill('<i class="icon-star"></i>').join("") 生成）。 */
    stars: string;
    /** 格式化后的时间文本。 */
    time: string;
    /** 点赞数。 */
    likesCount: number;
    /** 正文 HTML（链接已转换）。 */
    content: string;
}

/**
 * 渲染单条评论卡片的 HTML 字符串。
 * @returns review item HTML，供 `.append()` 消费。
 */
export function ReviewItem({
    floor,
    username,
    stars,
    time,
    likesCount,
    content,
}: ReviewItemProps): string {
    return `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${floor}楼</span>\n                    ${username} &nbsp;&nbsp; <span class="score-stars">${stars}</span> \n                    <span class="time">${time}</span> \n                    &nbsp;&nbsp; 点赞:${likesCount}\n                    <p class="review-content" style="margin-top: 5px;"> ${content} </p>\n                </div>\n            `;
}
