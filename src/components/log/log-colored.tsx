/**
 * logColoredHtml —— 日志面板红色强调文本 HTML 字符串辅助（薄门面）。
 *
 * 红色强调 span 的单一实现已合并至共享组件 ColoredTextCell
 *（src/components/shared/colored-text-cell.tsx，{text, color} 参数化）：
 * 原 LogColored 组件（`<span style={{ color: '#f40' }}>`）与其字节级相同，
 * 已删除，本模块仅保留无法书写 JSX 的 `.ts` 调用方所需的字符串辅助。
 *
 * 提取自 src/core/storage-manager.ts 多处 clog.log 消息中的
 * `<span style="color: #f40">...</span>` 红色强调片段：
 *   - batchSaveBlacklistCarList：屏蔽演员番号；
 *   - addFavoriteActressList：补全女优头像/类别、更正女优名字、
 *     同步 JavDB 已收藏的演员。
 * 日志消息 HTML 经日志面板 innerHTML 渲染，`color: #f40` 内联色经 style
 * 对象还原为 `color:#f40`（DOM 等价）。
 *
 * text 经 jsxToString 文本转义保护（与原模板直接插值在良构数据下输出一致）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import { jsxToString } from '../../core/jsx-to-string';

import { ColoredTextCell } from '../shared/colored-text-cell';

/**
 * 便捷辅助：将红色强调文本直接渲染为 HTML 字符串。
 *
 * 供无法书写 JSX 的 `.ts` 模块（如 src/core/storage/blacklist-car-list-ops.ts、
 * favorite-actress-ops.ts）拼接 clog.log 参数使用，等价于
 * `jsxToString(<ColoredTextCell text={text} color="#f40" />)`。
 * @param text 红色强调文本
 * @returns `<span style="color:#f40">text</span>` 的 HTML 字符串
 */
export function logColoredHtml(text: string): string {
    return jsxToString(<ColoredTextCell text={text} color="#f40" />);
}
