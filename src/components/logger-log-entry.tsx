/**
 * LoggerLogEntry —— 日志面板单条日志条目（React 函数组件，JSX）。
 *
 * 提取自 src/core/logger.ts 的 _createLogElement（L449）：原 `el.innerHTML = ...`
 * 含时间戳 `<span class="console-logger-timestamp">` 与消息
 * `<span class="console-logger-message" data-type="...">`，由 _createLogElement
 * 创建 div 后写入 innerHTML。
 *
 * 保留原 class/data-type/换行与缩进文本原样不动；timeStr / messageType / message
 * 通过 prop 注入。message 为已格式化的 HTML 字符串（含 `<a>`/`<br/>` 等内联
 * 转换），用 `dangerouslySetInnerHTML` 原样注入，与原 `innerHTML = ...<span
 * ...>${message}</span>` 行为一致（不转义标签）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 _createLogElement 中
 * `el.innerHTML = ...` 消费时，需先用 `jsxToString`（来自 ./jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `el.innerHTML = jsxToString(<LoggerLogEntry {...props} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** LoggerLogEntry 的属性。 */
export interface LoggerLogEntryProps {
    /** 时间字符串（HH:MM:SS）。 */
    timeStr: string;
    /** 消息类型（msg/json 等，写入 data-type）。 */
    messageType: string;
    /** 已格式化的消息 HTML（含链接/JSON 等内联转换），原样注入不转义。 */
    message: string;
}

/** 前导换行 + 16 空格缩进（与原 innerHTML 模板字符串首段一致）。 */
const INDENT_BEFORE = "\n                ";
/** 两个 span 之间的换行 + 16 空格缩进。 */
const INDENT_BETWEEN = "\n                ";
/** 末尾换行 + 12 空格缩进（闭合 div 前的缩进）。 */
const INDENT_AFTER = "\n            ";

/**
 * 渲染单条日志条目的 JSX。
 * @param props.timeStr 时间字符串
 * @param props.messageType 消息类型（写入 data-type）
 * @param props.message 已格式化消息 HTML，原样注入不转义
 * @returns 日志条目 JSX，经 jsxToString 转 HTML 字符串后供 `el.innerHTML` 消费。
 */
export function LoggerLogEntry({
    timeStr,
    messageType,
    message,
}: LoggerLogEntryProps) {
    return (
        <>
            {INDENT_BEFORE}
            <span className="console-logger-timestamp">[{timeStr}]</span>
            {INDENT_BETWEEN}
            <span
                className="console-logger-message"
                data-type={messageType}
                dangerouslySetInnerHTML={{ __html: message }}
            />
            {INDENT_AFTER}
        </>
    );
}
