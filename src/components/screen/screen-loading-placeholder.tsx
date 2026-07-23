/**
 * ScreenLoadingPlaceholder —— 缩略图加载占位块（React 函数组件，JSX）。
 *
 * 提取自 screenshot-plugin.tsx loadScreenShot、fc2-plugin.tsx handleLongImg、
 * fc2-by-123av-plugin.tsx handleLongImg 三处 prepend/before 的占位模板字符串
 * `<a class="tile-item screen-container" style="..."><div style="...">正在加载缩略图</div></a>`。
 *
 * 保留原 class/内联 style 语义原样不动（style 改由 style={{...}} 对象经
 * jsxToString 生成，camelToKebab 后与原 CSS 声明等价）。外层 a 无 href，
 * 与原脚本一致（仅占位，后续被 addImg 内容替换）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供调用方
 * `.prepend(jsxToString(<ScreenLoadingPlaceholder maxHeight="150px" />))`
 * 等场景消费。
 */
import type { CSSProperties } from 'react';

/** ScreenLoadingPlaceholder 的属性。 */
export interface ScreenLoadingPlaceholderProps {
    /** 外层 a 的 max-height/max-width（详情页 215px；FC2 弹窗 150px）。 */
    maxHeight: string;
}

/** 内层提示 div 内联样式（三处共用，原样保留）。 */
const innerStyle: CSSProperties = {
    marginTop: '50px',
    color: '#000',
    cursor: 'auto'
};

/**
 * 渲染缩略图加载占位块的 JSX。
 * @param props.maxHeight 外层 a 的 max-height/max-width
 * @returns tile-item screen-container 占位 JSX，经 jsxToString 转 HTML 字符串后
 *          供 prepend/before 消费。
 */
export function ScreenLoadingPlaceholder({ maxHeight }: ScreenLoadingPlaceholderProps) {
    const outerStyle: CSSProperties = {
        overflow: 'hidden',
        maxHeight,
        maxWidth: maxHeight,
        textAlign: 'center'
    };
    return (
        <a className="tile-item screen-container" style={outerStyle}>
            <div style={innerStyle}>正在加载缩略图</div>
        </a>
    );
}
