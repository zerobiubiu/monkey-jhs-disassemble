/**
 * ReviewItem —— 评论区单条评论卡片（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.displayReviews 提供：`<div class="item columns is-desktop">` 含楼号、
 * 用户名、星级、时间、点赞数、正文（正文内链接已由 ReviewLinkContent 转换），
 * 由 `container.append(html)` 消费。
 *
 * 保留原 class/id/内联 style、`<p class="review-content">`、文案原样不动；
 * 所有远端字段均作为文本或已校验的 JSX 节点渲染，不接收预拼接 HTML，避免评论
 * 内容进入 `dangerouslySetInnerHTML`。`&nbsp;` 实体在 JSX 中解码为 U+00A0 字符。
 * 内联行（username / score-stars / time / 点赞）保持同一行以保留原模板
 * 同行空格，DOM 等价；楼号 span 为 position:absolute、`<p>` 为块级，其周围
 * 换行空白折叠后 DOM 等价（紧凑化空白差异）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 displayReviews 中 `container.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<ReviewItem {...props} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import type { ReactNode } from 'react';

/** ReviewItem 的属性。 */
export interface ReviewItemProps {
    /** 楼号（调用方传入当前楼号，自增由调用方处理）。 */
    floor: number;
    /** 用户名。 */
    username: string;
    /** 星级数量；组件限制为 JavDB 的 0–5 星范围。 */
    score: number;
    /** 格式化后的时间文本。 */
    time: string;
    /** 点赞数。 */
    likesCount: number;
    /** 已安全拆分的正文文本与链接节点。 */
    content: ReactNode;
}

/**
 * 渲染单条评论卡片的 JSX。
 * @returns review item JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ReviewItem({ floor, username, score, time, likesCount, content }: ReviewItemProps) {
    const starCount = Number.isFinite(score) ? Math.max(0, Math.min(5, Math.trunc(score))) : 0;
    return (
        <div
            className="item columns is-desktop"
            style={{
                display: 'block',
                marginTop: '6px',
                backgroundColor: '#ffffff',
                padding: '10px',
                marginLeft: '-10px',
                wordBreak: 'break-word',
                position: 'relative'
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: '5px',
                    right: '10px',
                    color: '#999',
                    fontSize: '12px'
                }}
            >
                #{floor}楼
            </span>
            {username} &nbsp;&nbsp;{' '}
            <span className="score-stars">
                {Array.from({ length: starCount }, (_, index) => (
                    <i className="icon-star" key={index} />
                ))}
            </span>{' '}
            <span className="time">{time}</span> &nbsp;&nbsp; 点赞:{likesCount}
            <p className="review-content" style={{ marginTop: '5px' }}>
                {' '}
                {content}
                {' '}
            </p>
        </div>
    );
}
