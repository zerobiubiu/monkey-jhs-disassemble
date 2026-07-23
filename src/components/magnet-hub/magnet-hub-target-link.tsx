/**
 * MagnetHubTargetLink —— 磁链聚合「原网页」链接（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/magnet-hub-plugin.tsx 的 createMagnetHub（原
 * `` $tabs.append(`<a style="margin-right: 20px;margin-top:3px" id="targetBox" href="..." target="_blank">原网页</a>`) ``
 * 模板字符串）：标签栏右侧跳转当前引擎原网页的链接。href 由调用方
 * 以 `engine.targetPage.replace('{keyword}', encodeURIComponent(keyword))`
 * 计算后传入；切换标签时仍由点击事件 `$('#targetBox').attr('href', ...)` 更新。
 *
 * 保留原 id/style/文案原样不动。内联 style 经 jsxToString 的 styleToCss
 * 输出 `margin-right:20px;margin-top:3px`（冒号后无空格、无尾分号），
 * 与原 `margin-right: 20px;margin-top:3px` DOM 等价（CSS 解析忽略空白）。
 * href 经 sanitizeUrl 校验（https 协议原样输出）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createMagnetHub 中
 * `$tabs.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$tabs.append(jsxToString(<MagnetHubTargetLink href={href} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** MagnetHubTargetLink 的属性。 */
export interface MagnetHubTargetLinkProps {
    /** 原网页地址（原 engine.targetPage 替换 {keyword} 后的完整 URL）。 */
    href: string;
}

/**
 * 渲染「原网页」链接的 JSX。
 * @param props.href 原网页地址
 * @returns 链接 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function MagnetHubTargetLink({ href }: MagnetHubTargetLinkProps) {
    return (
        <a
            style={{ marginRight: '20px', marginTop: '3px' }}
            id="targetBox"
            href={href}
            target="_blank"
        >
            原网页
        </a>
    );
}
