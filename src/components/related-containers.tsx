/**
 * RelatedContainers —— 相关清单区容器与页脚空容器（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.showRelated 提供：`<div id="relatedContainer"></div>` 与
 * `<div id="relatedFooter"></div>` 两个相邻 div，由 `target.append(html)` 消费。
 * 结构对称 ReviewContainers（doc/13 已提取），DOM ID 沿用原版单数 related 命名。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 showRelated 中 `target.append()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `target.append(jsxToString(<RelatedContainers />))`
 * Fragment 透明拼接 children，输出 `<div id="relatedContainer"></div><div id="relatedFooter"></div>`。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染相关清单区容器 + 页脚空容器的 JSX。
 * @returns 两个 div 拼接的 JSX（Fragment），经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RelatedContainers() {
    return (
        <>
            <div id="relatedContainer"></div>
            <div id="relatedFooter"></div>
        </>
    );
}
