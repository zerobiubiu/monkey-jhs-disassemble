/**
 * MagnetHubMountBox —— 磁力搜索弹窗挂载容器（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.tsx 的 createMenuBtn（L241）：
 * layer.open content 的 `'<div id="magnet-hub-mount" style="padding:10px"></div>'`，
 * success 回调内 `$('#magnet-hub-mount').append(hub.createMagnetHub(...))` 挂载
 * 磁力搜索组件。
 *
 * 保留原 id（magnet-hub-mount，success 回调选择器依赖）与内联 padding
 * （经 style 对象还原为 `padding:10px`，DOM 等价）；原空标签体经 jsxToString
 * 输出为 `<div ...></div>`（非 void 标签保留闭合标签），DOM 等价。无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 layer.open content 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串
 * 渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `content: jsxToString(<MagnetHubMountBox />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染磁力搜索挂载容器 div 的 JSX。
 * @returns `<div id="magnet-hub-mount" style="padding:10px"></div>` 的 React
 *          元素，经 jsxToString 转 HTML 字符串后供 layer.open content 消费。
 */
export function MagnetHubMountBox() {
    return <div id="magnet-hub-mount" style={{ padding: '10px' }}></div>;
}
