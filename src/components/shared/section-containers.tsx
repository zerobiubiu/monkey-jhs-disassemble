/**
 * SectionContainers —— 通用区块容器与页脚空容器（React 函数组件，JSX）。
 *
 * 合并 ReviewContainers / RelatedContainers：两个相邻 div（容器 + 页脚），
 * 由 `target.append(html)` 消费。DOM ID 由调用方注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 `target.append()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串。
 */

/** SectionContainers 的属性。 */
export interface SectionContainersProps {
    /** 内容容器 DOM id（如 "reviewsContainer" / "relatedContainer"）。 */
    containerId: string;
    /** 页脚容器 DOM id（如 "reviewsFooter" / "relatedFooter"）。 */
    footerId: string;
}

/**
 * 渲染区块容器 + 页脚空容器的 JSX。
 * @returns 两个 div 拼接的 JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function SectionContainers({ containerId, footerId }: SectionContainersProps) {
    return (
        <>
            <div id={containerId}></div>
            <div id={footerId}></div>
        </>
    );
}
