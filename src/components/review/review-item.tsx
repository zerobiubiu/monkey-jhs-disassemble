/**
 * ReviewItem —— 评论区单条评论卡片（React 函数组件，JSX）。
 *
 * 为 ReviewPlugin.displayReviews 提供：`<div class="item columns is-desktop">` 含楼号、
 * 用户名、星级、时间、点赞数、正文（正文内链接已由 ReviewLinkContent 转换），
 * 由 `container.append(html)` 消费。
 *
 * 保留原 class/id/内联 style、`<p class="review-content">`、文案原样不动；
 * floor / username / time / likesCount 通过 prop 注入为文本子节点（jsxToString
 * 转义 `&`/`<`/`>`，浏览器解析后与原模板未转义插入 DOM 等价）；stars 为调用方
 * 生成的可信 HTML 字符串，按 React raw HTML 注入约定（__html）原始注入
 * （jsxToString 取 __html 作 inner HTML 不转义，与原模板 `${stars}` 插值一致）。
 * `&nbsp;` 实体在 JSX 中解码为 U+00A0 字符，DOM 渲染等价。
 * 内联行（username / score-stars / time / 点赞）保持同一行以保留原模板
 * 同行空格，DOM 等价；楼号 span 为 position:absolute、`<p>` 为块级，其周围
 * 换行空白折叠后 DOM 等价（紧凑化空白差异）。
 *
 * content（来自 JavDB API 的不可信 HTML）不再原始注入：由 safeReviewNodes 解析为
 * 安全 ReactNode 树 —— 文本节点经 jsxToString 转义；`<a>` 经 sanitizeUrl 并强制
 * `target="_blank" rel="noopener noreferrer"`；`<br>` 与白名单内联标签
 * （b/i/em/strong/p/span）保留标签并仅复制 class/style（恢复 a-primary 等可信样式），
 * 剥离其余属性（含 on 事件属性）；其余标签剥离（保留其文本子节点）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 displayReviews 中 `container.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<ReviewItem {...props} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */
import type { ReactNode } from 'react';
import { sanitizeUrl } from '../../core/jsx-to-string';

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
    /** 正文 HTML（链接已转换，不可信，经 safeReviewNodes 安全渲染）。 */
    content: string;
}

/** 内联标签白名单：渲染时保留标签本身（仅复制 class/style，剥离其余属性，含 SPAN 以保留 ed2k 高亮）。 */
const SAFE_INLINE_TAGS: Record<string, true> = { B: true, I: true, EM: true, STRONG: true, BR: true, P: true, SPAN: true };

/** 将内联 style 字符串解析为 React style 对象；空或解析失败返回 undefined（jsxToString 省略）。
 *  仅字符串切分 + kebab 转 camel，无 eval、无正则回溯，构造对象不抛错，try/catch 兜底。 */
function parseInlineStyle(s: string | null | undefined): Record<string, string> | undefined {
    if (!s) return undefined;
    try {
        const o: Record<string, string> = {};
        for (const part of s.split(';')) {
            const idx = part.indexOf(':');
            if (idx <= 0) continue;
            const k = part.slice(0, idx).trim();
            const v = part.slice(idx + 1).trim();
            if (!k || !v) continue;
            o[k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] = v;
        }
        return Object.keys(o).length ? o : undefined;
    } catch {
        return undefined;
    }
}

/**
 * 将不可信的评论正文 HTML 解析为安全的 ReactNode 树（XSS 加固，保留可信样式）。
 *
 * - 文本节点 → 字符串子节点（jsxToString 转义 & < >）
 * - <a> → href 经 sanitizeUrl，强制 target/rel，保留 class/style（恢复 a-primary 等可信样式）
 * - <br> → <br />
 * - 白名单内联标签（b/i/em/strong/p/span）→ 保留标签，仅复制 class/style，剥离其余属性
 * - 其他标签（script/iframe/img/svg/带 on 事件属性的元素等）→ 剥离标签、保留子节点
 *
 * 安全说明：仅复制 class/style 两类属性；on 事件属性、非 a 元素的 href、src、action 等永不复制，
 * 故事件向量无法注入；style 在目标浏览器（evergreen）中不可执行 javascript:，与加固前行为等价。
 *
 * @param html 来自 JavDB API 的不可信正文 HTML
 */
function safeReviewNodes(html: string): ReactNode[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walk = (nodes: NodeListOf<ChildNode> | ChildNode[], keyPrefix: string): ReactNode[] => {
        const res: ReactNode[] = [];
        Array.from(nodes).forEach((node, i) => {
            const key = `${keyPrefix}${i}`;
            if (node.nodeType === Node.TEXT_NODE) {
                const t = node.textContent ?? '';
                if (t) res.push(t);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                const tag = el.tagName.toUpperCase();
                const cls = el.getAttribute('class') || undefined;
                const stl = parseInlineStyle(el.getAttribute('style'));
                if (tag === 'A') {
                    res.push(
                        <a key={key} href={sanitizeUrl(el.getAttribute('href') || '')} target="_blank" rel="noopener noreferrer" className={cls} style={stl}>
                            {walk(el.childNodes, key + '-')}
                        </a>
                    );
                } else if (tag === 'BR') {
                    res.push(<br key={key} />);
                } else if (SAFE_INLINE_TAGS[tag]) {
                    const inner = walk(el.childNodes, key + '-');
                    if (tag === 'P') res.push(<p key={key} className={cls} style={stl}>{inner}</p>);
                    else if (tag === 'B') res.push(<b key={key} className={cls} style={stl}>{inner}</b>);
                    else if (tag === 'I') res.push(<i key={key} className={cls} style={stl}>{inner}</i>);
                    else if (tag === 'EM') res.push(<em key={key} className={cls} style={stl}>{inner}</em>);
                    else if (tag === 'STRONG') res.push(<strong key={key} className={cls} style={stl}>{inner}</strong>);
                    else if (tag === 'SPAN') res.push(<span key={key} className={cls} style={stl}>{inner}</span>);
                } else {
                    res.push(...walk(el.childNodes, key + '-'));
                }
            }
        });
        return res;
    };
    return walk(doc.body.childNodes, '');
}

/**
 * 渲染单条评论卡片的 JSX。
 * @returns review item JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ReviewItem({ floor, username, stars, time, likesCount, content }: ReviewItemProps) {
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
            <span className="score-stars" dangerouslySetInnerHTML={{ __html: stars }} />{' '}
            <span className="time">{time}</span> &nbsp;&nbsp; 点赞:{likesCount}
            <p className="review-content" style={{ marginTop: '5px' }}>
                {safeReviewNodes(content)}
            </p>
        </div>
    );
}
