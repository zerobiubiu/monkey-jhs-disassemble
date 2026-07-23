/**
 * ScreenReloading —— 截图重新加载提示块（React 函数组件，JSX）。
 *
 * 提取自 screenshot-plugin.tsx showErrorFallback 重试分支的模板字符串
 * `<div style="${differentCss};cursor:auto;color:#000;">正在重新加载...</div>`。
 *
 * 保留原内联 style 语义原样不动。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供重试回调中
 * `$('.screen-container').html(jsxToString(<ScreenReloading />))` 消费。
 */
import type { CSSProperties } from 'react';

/** 重新加载提示 div 内联样式（原 differentCss + cursor/color 声明）。 */
const reloadingStyle: CSSProperties = {
    marginTop: '50px',
    cursor: 'auto',
    color: '#000'
};

/**
 * 渲染重新加载提示块的 JSX。
 * @returns 提示 div JSX，经 jsxToString 转 HTML 字符串后供 .html() 消费。
 */
export function ScreenReloading() {
    return <div style={reloadingStyle}>正在重新加载...</div>;
}
