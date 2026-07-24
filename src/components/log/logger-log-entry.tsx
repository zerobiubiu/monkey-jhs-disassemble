/**
 * LoggerLogEntry —— 日志面板单条日志条目（React 函数组件，JSX）。
 *
 * 提取自 src/core/logger.ts 的 _createLogElement（L449）：原 `el.innerHTML = ...`
 * 含时间戳 `<span class="console-logger-timestamp">` 与消息
 * `<span class="console-logger-message" data-type="...">`，由 _createLogElement
 * 创建 div 后写入 innerHTML。
 *
 * 保留原 class/data-type/换行与缩进文本原样不动；timeStr / messageType / message
 * 通过 prop 注入。message 为原始纯文本（addLog 不再内嵌 HTML）：渲染期由
 * `linkifySafe` 按 URL 模式切分为文本段与链接段——文本段作为普通 JSX 子节点
 * 输出（jsxToString 自动转义，杜绝 XSS），链接段经 `sanitizeUrl` 净化后渲染为
 * `<a target="_blank" rel="noopener noreferrer">`。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 _createLogElement 中
 * `el.innerHTML = ...` 消费时，需先用 `jsxToString`（来自 ../../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `el.innerHTML = jsxToString(<LoggerLogEntry {...props} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

import type { ReactNode } from 'react';
import { sanitizeUrl } from '../../core/jsx-to-string';

/** LoggerLogEntry 的属性。 */
export interface LoggerLogEntryProps {
    /** 时间字符串（HH:MM:SS）。 */
    timeStr: string;
    /** 消息类型（msg/json 等，写入 data-type）。 */
    messageType: string;
    /** 原始消息纯文本（URL 链接化在渲染期完成，不含 HTML）。 */
    message: string;
}

/** 前导换行 + 16 空格缩进（与原 innerHTML 模板字符串首段一致）。 */
const INDENT_BEFORE = '\n                ';
/** 两个 span 之间的换行 + 16 空格缩进。 */
const INDENT_BETWEEN = '\n                ';
/** 末尾换行 + 12 空格缩进（闭合 div 前的缩进）。 */
const INDENT_AFTER = '\n            ';

/** URL 匹配模式：http/https/ftp 协议（沿用原 addLog 链接化的核心形态）。 */
const URL_PATTERN = /(?:https?|ftp):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|]/gi;

/**
 * 将纯文本按 URL 切分为可安全渲染的 JSX 子节点序列。
 *
 * 文本段作为普通字符串子节点（jsxToString 自动转义 `&`/`<`/`>`，HTML 注入
 * 在此被转义中和）；URL 段经 `sanitizeUrl` 净化后渲染为外链。
 * @param text 原始消息文本
 * @returns 文本段（string）与链接元素（JSX）交替的 ReactNode 数组
 */
function linkifySafe(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    URL_PATTERN.lastIndex = 0;
    while ((match = URL_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        const url = match[0];
        nodes.push(
            <a
                key={match.index}
                href={sanitizeUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
            >
                {url}
            </a>
        );
        lastIndex = match.index + url.length;
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes;
}

/**
 * 渲染单条日志条目的 JSX。
 * @param props.timeStr 时间字符串
 * @param props.messageType 消息类型（写入 data-type）
 * @param props.message 原始消息纯文本，渲染期转义并链接化
 * @returns 日志条目 JSX，经 jsxToString 转 HTML 字符串后供 `el.innerHTML` 消费。
 */
export function LoggerLogEntry({ timeStr, messageType, message }: LoggerLogEntryProps) {
    return (
        <>
            {INDENT_BEFORE}
            <span className="console-logger-timestamp">[{timeStr}]</span>
            {INDENT_BETWEEN}
            <span className="console-logger-message" data-type={messageType}>
                {linkifySafe(message)}
            </span>
            {INDENT_AFTER}
        </>
    );
}
