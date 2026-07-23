/**
 * TranslatedTitle —— 标题翻译结果块（React 函数组件，JSX）。
 *
 * 提取自 translate-plugin.tsx translate 的两处模板字符串：
 *   - 加载占位：`<div class="translated-title">翻译中...</div>`
 *   - 失败提示：`<div class="translated-title" style="color: red;">${message}</div>`
 *
 * 保留原 class 原样不动（.translated-title 样式由 src/styles/translate-plugin.css
 * 经 initCss 注入）；失败态以 error prop 附加内联 color:red（与原模板一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 translate 中
 * `$titleElement.after(jsxToString(<TranslatedTitle>翻译中...</TranslatedTitle>))`
 * 与 `$loadingElement.replaceWith(jsxToString(<TranslatedTitle error message={...} />))` 消费。
 */
import type { ReactNode, CSSProperties } from 'react';

/** TranslatedTitle 的属性。 */
export interface TranslatedTitleProps {
    /** 是否为失败态（附加内联 color:red）。 */
    error?: boolean;
    /** 块内文本（「翻译中...」或错误信息）。 */
    children: ReactNode;
}

/** 失败态内联样式：红色文字。 */
const errorStyle: CSSProperties = { color: 'red' };

/**
 * 渲染标题翻译结果块的 JSX。
 * @param props.error 是否失败态
 * @param props.children 块内文本
 * @returns translated-title div JSX，经 jsxToString 转 HTML 字符串后供
 *          after()/replaceWith() 消费。
 */
export function TranslatedTitle({ error, children }: TranslatedTitleProps) {
    return (
        <div className="translated-title" style={error ? errorStyle : undefined}>
            {children}
        </div>
    );
}
