/**
 * ScreenShotFallback —— 截图获取失败回退块（React 函数组件，JSX）。
 *
 * 提取自 screenshot-plugin.tsx showErrorFallback 的模板字符串
 * `<div style="...">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='...' target='_blank'>前往确认</a>`。
 *
 * 保留原 class（retry-link/check-link 供委托事件绑定）/内联 style 语义原样不动；
 * 提示文案与链接经 jsxToString 转义/sanitizeUrl 处理（href='#' 与 https 地址原样通过）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 showErrorFallback 中
 * `$('.screen-container').html(jsxToString(<ScreenShotFallback carNum={...} />))` 消费。
 */
import type { CSSProperties } from 'react';

/** ScreenShotFallback 的属性。 */
export interface ScreenShotFallbackProps {
    /** 番号（拼接 javstore 搜索链接）。 */
    carNum: string;
}

/** 失败提示 div 内联样式（原 differentCss + cursor/color 声明）。 */
const fallbackStyle: CSSProperties = {
    marginTop: '50px',
    cursor: 'auto',
    color: '#000'
};

/**
 * 渲染截图获取失败回退块的 JSX。
 * @param props.carNum 番号
 * @returns 失败提示 + 重试/确认链接 JSX，经 jsxToString 转 HTML 字符串后供 .html() 消费。
 */
export function ScreenShotFallback({ carNum }: ScreenShotFallbackProps) {
    return (
        <>
            <div style={fallbackStyle}>获取缩略图失败</div>
            <br />
            <a href="#" className="retry-link">
                点击重试
            </a>{' '}
            或{' '}
            <a
                className="check-link"
                href={`https://javstore.net/search?q=${carNum}`}
                target="_blank"
            >
                前往确认
            </a>
        </>
    );
}
