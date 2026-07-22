/**
 * KeywordLabel —— 屏蔽关键词标签（React 函数组件，JSX，链接/块 两种变体）。
 */
import type { CSSProperties } from 'react';

/** KeywordLabel 的变体（link=可跳转的 a，div=纯块）。 */
export type KeywordLabelVariant = 'link' | 'div';

/** KeywordLabel 的属性。 */
export interface KeywordLabelProps {
    /** 关键词文本。 */
    keyword: string;
    /** 背景色。 */
    bgColor: string;
    /** 文字色（link 变体为蓝色，div 变体为深灰）。 */
    textColor: string;
    /** 变体（link 时需提供 href）。 */
    variant: KeywordLabelVariant;
    /** link 变体的跳转地址（div 变体不用）。 */
    href?: string;
}

/**
 * 渲染屏蔽关键词标签的 JSX。
 */
export function KeywordLabel({ keyword, bgColor, textColor, variant, href }: KeywordLabelProps) {
    const style: CSSProperties = {
        backgroundColor: bgColor,
        color: textColor
    };
    if (variant === 'link') {
        return (
            <a
                className="keyword-label"
                data-keyword={keyword}
                style={style}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {keyword}
                <span className="keyword-remove">{'\u00d7'}</span>
            </a>
        );
    }
    return (
        <div className="keyword-label" data-keyword={keyword} style={style}>
            {keyword}
            <span className="keyword-remove">{'\u00d7'}</span>
        </div>
    );
}
