/**
 * MagnetHubContainers —— 磁链聚合骨架容器（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/magnet-hub-plugin.tsx 的 createMagnetHub（原
 * `$('<div class="magnet-container"></div>')` / `$('<div class="magnet-tabs"></div>')` /
 * `$('<div class="magnet-results"></div>')` 三处 jQuery HTML 字面量）：
 * 外层容器 + 标签栏 + 结果区三个空 div。
 *
 * 保留原类名原样不动。`$(jsxToString(...))` 产出的 jQuery 对象与
 * `$('<div class="..."></div>')` 等价，后续 `.append()` / `.on()` /
 * `.find()` 行为不变。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createMagnetHub 中 `$()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `const $container = $(jsxToString(<MagnetHubContainer />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染磁链聚合外层容器的 JSX。
 * @returns `.magnet-container` 空 div JSX，经 jsxToString 转 HTML 字符串后供 `$()` 消费。
 */
export function MagnetHubContainer() {
    return <div className="magnet-container"></div>;
}

/**
 * 渲染引擎标签栏容器的 JSX。
 * @returns `.magnet-tabs` 空 div JSX，经 jsxToString 转 HTML 字符串后供 `$()` 消费。
 */
export function MagnetHubTabs() {
    return <div className="magnet-tabs"></div>;
}

/**
 * 渲染搜索结果区容器的 JSX。
 * @returns `.magnet-results` 空 div JSX，经 jsxToString 转 HTML 字符串后供 `$()` 消费。
 */
export function MagnetHubResults() {
    return <div className="magnet-results"></div>;
}
