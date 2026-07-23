/**
 * UrlAutoLink —— 日志消息 URL 自动链接化锚点（React 函数组件，JSX）。
 *
 * 提取自 src/core/logger.tsx 的 log（L312）：URL 正则替换回调返回的
 * `<a href="${href}" target="_blank">${match}</a>`，将日志文本中的
 * http/https/ftp/www/协议相对 URL 包裹为新标签页链接。
 *
 * 保留原属性（href 原值、target="_blank"，无 rel）与链接文本（原始 match）
 * 原样不动；href 经 jsxToString 的 sanitizeUrl 校验（日志 URL 均为
 * http/https/ftp 协议，输出不变），text 经文本转义保护。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 log 中正则 .replace 回调返回时，
 * 需先用 `jsxToString`（来自 ./jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串：
 *   `return jsxToString(<UrlAutoLink href={href} text={match} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** UrlAutoLink 的属性。 */
export interface UrlAutoLinkProps {
    /** 链接地址（原始 match 或补全协议后的 URL）。 */
    href: string;
    /** 链接文本（原始 match）。 */
    text: string;
}

/**
 * 渲染 URL 自动链接锚点的 JSX。
 * @param props.href 链接地址
 * @param props.text 链接文本
 * @returns `<a href="..." target="_blank">text</a>` 的 React 元素，经
 *          jsxToString 转 HTML 字符串后供正则替换回调返回。
 */
export function UrlAutoLink({ href, text }: UrlAutoLinkProps) {
    return (
        <a href={href} target="_blank">
            {text}
        </a>
    );
}
