/**
 * LoggerLogEntry —— 日志面板单条日志条目 innerHTML 字符串组件。
 *
 * 提取自 src/core/logger.ts 的 _createLogElement（L449）：原 `el.innerHTML = ...`
 * 含时间戳 `<span class="console-logger-timestamp">` 与消息
 * `<span class="console-logger-message" data-type="...">`，由 _createLogElement
 * 创建 div 后写入 innerHTML。
 *
 * 保留原 class/data-type/\n 转义与缩进原样不动；timeStr / messageType / message
 * 通过 prop 注入。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** LoggerLogEntry 的属性。 */
export interface LoggerLogEntryProps {
    /** 时间字符串（HH:MM:SS）。 */
    timeStr: string;
    /** 消息类型（msg/json 等，写入 data-type）。 */
    messageType: string;
    /** 已格式化的消息 HTML（含链接/JSON 等内联转换）。 */
    message: string;
}

/**
 * 渲染单条日志条目 innerHTML 的 HTML 字符串。
 * @returns 日志条目 HTML，供 `el.innerHTML = html` 消费。
 */
export function LoggerLogEntry({
    timeStr,
    messageType,
    message,
}: LoggerLogEntryProps): string {
    return `\n                <span class="console-logger-timestamp">[${timeStr}]</span>\n                <span class="console-logger-message" data-type="${messageType}">${message}</span>\n            `;
}
