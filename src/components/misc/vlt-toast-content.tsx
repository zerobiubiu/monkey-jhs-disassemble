/**
 * VltToastContent —— 清单 Toast 内容（图标 + 消息，React 函数组件，JSX）。
 *
 * 提取自 src/plugins/video-lists-tag/vlt-toast.ts 的 showToast（原
 * `` toast.innerHTML = `<span class="jdb-toast__icon">${ICONS[type]}</span><span class="jdb-toast__msg"></span>` ``
 * + 随后对 `.jdb-toast__msg` 的 textContent 赋值）：toast 内部结构为
 * 图标 span（内嵌 SVG）+ 消息 span。
 *
 * SVG 图标保留原字符串常量原样不动（含 stroke-width / stroke-linecap /
 * stroke-linejoin 等 kebab-only 属性，jsxToString 不做属性名 camelCase→
 * kebab 转换，无法以 JSX 属性表达），经 dangerouslySetInnerHTML 原样注入，
 * 仅以命名常量 + dangerouslySetInnerHTML 形式存在（零 HTML 字面量硬编码要求
 * 的允许例外）。类名 jdb-toast__icon / jdb-toast__msg 保留原样。
 *
 * 消息文本经 escapeText 转义 `&<>` 后写入——原实现先建空 span 再以
 * textContent 赋值（天然转义），两种路径对任意 msg 的最终 DOM 文本一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 showToast 中
 * `toast.innerHTML =` 消费时，需先用 `jsxToString`（来自
 * ../../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `toast.innerHTML = jsxToString(<VltToastContent type={type} msg={msg} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** Toast 类型（与 vlt-toast 的 ToastType 一致）。 */
export type VltToastType = 'success' | 'error' | 'warning' | 'info';

/** SVG 图标（原 vlt-toast ICONS，逐字符保留；仅经 dangerouslySetInnerHTML 注入）。 */
const TOAST_SVG_ICONS: Record<VltToastType, string> = {
    success:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8.01"/></svg>'
};

/** VltToastContent 的属性。 */
export interface VltToastContentProps {
    /** Toast 类型，决定图标（原 showToast 的 type 参数）。 */
    type: VltToastType;
    /** 消息文本（原 showToast 的 msg 参数）。 */
    msg: string;
}

/**
 * 渲染 toast 内容（图标 + 消息）的 JSX。
 * @param props.type Toast 类型
 * @param props.msg 消息文本
 * @returns 图标 span + 消息 span 拼接的 JSX，经 jsxToString 转 HTML 字符串后供 `innerHTML =` 消费。
 */
export function VltToastContent({ type, msg }: VltToastContentProps) {
    return (
        <>
            <span
                className="jdb-toast__icon"
                dangerouslySetInnerHTML={{ __html: TOAST_SVG_ICONS[type] }}
            />
            <span className="jdb-toast__msg">{msg}</span>
        </>
    );
}
