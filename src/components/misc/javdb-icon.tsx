/**
 * JavDBIcon —— JavDB 字母 J SVG 图标（React 函数组件，JSX）。
 *
 * 提取自 missav-quick-copy-plugin 的 createSVGJavDB 内联 SVG 字符串
 * （原 template.innerHTML 解析）。SVG 含 kebab-only 属性（stroke-width/
 * stroke-linecap/stroke-linejoin），无法以 JSX 属性表达（jsxToString 不做
 * 非 style 属性名 camel→kebab 转换），故保留为命名常量 JAVDB_ICON_SVG，经
 * dangerouslySetInnerHTML 原样注入（不转义），SVG 标记逐字节保留。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createSVGJavDB 中
 * `jsxToString(<JavDBIcon />)` 渲染后经 template 解析提取 svg 节点消费，
 * 最终 DOM 与原脚本一致（button 直接挂 svg 元素，无包裹层）。
 */

/** JavDB 字母 J 图标 SVG 标记（tabler icon，原样保留，仅经 dangerouslySetInnerHTML 消费）。 */
const JAVDB_ICON_SVG = `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-letter-j-small"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 8h4v6a2 2 0 1 1 -4 0" /></svg>`;

/**
 * 渲染 JavDB 图标承载 span 的 JSX。
 * @returns span（内含原始 SVG 标记）JSX，经 jsxToString 转 HTML 字符串后
 *          供 createSVGJavDB 解析提取 svg 节点。
 */
export function JavDBIcon() {
    return <span dangerouslySetInnerHTML={{ __html: JAVDB_ICON_SVG }} />;
}
