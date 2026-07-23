/**
 * LogColored —— 日志面板红色强调文本 span（React 函数组件，JSX）。
 *
 * 提取自 src/core/storage-manager.ts 多处 clog.log 消息中的
 * `<span style="color: #f40">...</span>` 红色强调片段：
 *   - batchSaveBlacklistCarList（L640）：屏蔽演员番号；
 *   - addFavoriteActressList（L714/L721/L728/L745）：补全女优头像/类别、
 *     更正女优名字、同步 JavDB 已收藏的演员。
 * 日志消息 HTML 经日志面板 innerHTML 渲染，`color: #f40` 内联色经 style
 * 对象还原为 `color:#f40`（DOM 等价）。
 *
 * text 经 jsxToString 文本转义保护（与原模板直接插值在良构数据下输出一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 clog.log 参数拼接消费时，
 * 需先用 `jsxToString`（来自 ./jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串：
 *   `clog.log(jsxToString(<LogColored text={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import { jsxToString } from '../../core/jsx-to-string';

/** LogColored 的属性。 */
export interface LogColoredProps {
    /** 红色强调文本。 */
    text: string;
}

/**
 * 渲染红色强调 span 的 JSX。
 * @param props.text 强调文本
 * @returns `<span style="color:#f40">text</span>` 的 React 元素，经 jsxToString
 *          转 HTML 字符串后供 clog.log 参数拼接。
 */
export function LogColored({ text }: LogColoredProps) {
    return <span style={{ color: '#f40' }}>{text}</span>;
}

/**
 * 便捷辅助：将红色强调文本直接渲染为 HTML 字符串。
 *
 * 供无法书写 JSX 的 `.ts` 模块（如 src/core/storage-manager.ts）拼接 clog.log
 * 参数使用，等价于 `jsxToString(<LogColored text={text} />)`。
 * @param text 红色强调文本
 * @returns `<span style="color:#f40">text</span>` 的 HTML 字符串
 */
export function logColoredHtml(text: string): string {
    return jsxToString(<LogColored text={text} />);
}
