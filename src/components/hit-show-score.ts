/**
 * HitShowScore —— 热播影片评分（星级 + 分数 + 评价人数）HTML 字符串组件。
 *
 * 提取自 src/plugins/hit-show-plugin.ts 的 loadScore（L178 scoreHtml）与
 * getStarRating（L126-136）：原 scoreHtml 模板内嵌 `this.getStarRating(score)`
 * 产出 5 颗星（满星 icon-star，空星 icon-star gray），由 appendScoreHtml 写入
 * #score_<id>（slideUp(0) 隐藏后 html 填充并 slideDown(500) 展开）。
 *
 * 合并 getStarRating 逻辑到本组件内部（满星数 = Math.floor(score)，0-5），
 * 保留原 `<span class="value">` 包裹、`<span class="score-stars">` 星级容器、
 * 分数与评价人数文案与 \n 转义原样不动；score / watchedCount 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** HitShowScore 的属性。 */
export interface HitShowScoreProps {
    /** 评分（取整后为满星数，0-5）。 */
    score: number;
    /** 评价人数。 */
    watchedCount: number;
}

/**
 * 由分数生成 5 颗星的 HTML（满星 icon-star，空星 icon-star gray）。
 * @param score 评分（满星数 = Math.floor(score)）
 * @returns 星级 HTML 字符串。
 */
function getStarRating(score: number): string {
    let html = "";
    const fullStars = Math.floor(score);
    for (let i = 0; i < fullStars; i++) {
        html += '<i class="icon-star"></i>';
    }
    for (let i = 0; i < 5 - fullStars; i++) {
        html += '<i class="icon-star gray"></i>';
    }
    return html;
}

/**
 * 渲染评分（星级 + 分数 + 评价人数）的 HTML 字符串。
 * @param props.score 评分
 * @param props.watchedCount 评价人数
 * @returns score span HTML，供 appendScoreHtml 写入 #score_<id>。
 */
export function HitShowScore({ score, watchedCount }: HitShowScoreProps): string {
    return `\n                        <span class="value">\n                            <span class="score-stars">${getStarRating(score)}</span> \n                            &nbsp; ${score}分，由${watchedCount}人評價\n                        </span>\n                    `;
}
