/**
 * HitShowScore —— 热播影片评分（星级 + 分数 + 评价人数）（React 函数组件，JSX）。
 *
 * 为 HitShowPlugin.loadScore 提供：`<span class="value">` 包裹 `<span class="score-stars">`
 * 星级容器（满星 icon-star，空星 icon-star gray）+ 分数 + 评价人数文案，
 * 由 appendScoreHtml 写入 #score_<id>（slideUp(0) 隐藏后 html 填充并 slideDown(500) 展开）。
 *
 * 合并原 getStarRating 逻辑到本组件内部（满星数 = Math.floor(score)，0-5），
 * 保留原 `<span class="value">` 包裹、`<span class="score-stars">` 星级容器、
 * 分数与评价人数文案原样不动；score / watchedCount 通过 prop 注入。
 * 星级以 `<i className="icon-star" />` / `<i className="icon-star gray" />` JSX
 * 元素数组渲染（jsxToString 逐个输出 `<i class="icon-star"></i>`，与原模板拼接
 * 的 HTML 字符串零偏差；无需 key——jsxToString 不走 React 协调，无 key 警告）。
 * score-stars span 与分数文案同行保留空格，`&nbsp;` 解码为 U+00A0，DOM 等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadScore 中 scoreHtml 计算时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `const scoreHtml = jsxToString(<HitShowScore score={score} watchedCount={watchedCount} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */
import type { ReactElement } from 'react';

/** HitShowScore 的属性。 */
export interface HitShowScoreProps {
    /** 评分（取整后为满星数，0-5）。 */
    score: number;
    /** 评价人数。 */
    watchedCount: number;
}

/**
 * 由分数生成 5 颗星的 JSX 元素数组（满星 icon-star，空星 icon-star gray）。
 * @param score 评分（满星数 = Math.floor(score)）
 * @returns 星级 JSX 元素数组（无需 key：jsxToString 不走 React 协调）。
 */
function getStarRating(score: number): ReactElement[] {
    const stars: ReactElement[] = [];
    const fullStars = Math.floor(score);
    for (let i = 0; i < fullStars; i++) {
        stars.push(<i className="icon-star" />);
    }
    for (let i = 0; i < 5 - fullStars; i++) {
        stars.push(<i className="icon-star gray" />);
    }
    return stars;
}

/**
 * 渲染评分（星级 + 分数 + 评价人数）的 JSX。
 * @param props.score 评分
 * @param props.watchedCount 评价人数
 * @returns score span JSX，经 jsxToString 转 HTML 字符串后供 appendScoreHtml 写入 #score_<id>。
 */
export function HitShowScore({ score, watchedCount }: HitShowScoreProps) {
    return (
        <span className="value">
            <span className="score-stars">{getStarRating(score)}</span> &nbsp; {score}分，由
            {watchedCount}人評價
        </span>
    );
}
