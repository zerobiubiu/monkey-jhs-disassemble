/**
 * 日志模块。
 *
 * 对应原 `archetype/jhs.user.js` L2365-2762 的日志面板实现：含 `class o` 及其
 * 顶部的样式配置 `e`、过滤器映射 `t`、最大条数 `n` 与三个 localStorage 键
 * `a/i/s`。仅在 JS→TS 转换与命名优化的范围内重写，控制流与渲染逻辑保持不变。
 *
 * 重构说明：面板 DOM 渲染 / 事件绑定 / 过滤逻辑已提取至
 * `src/core/util/logger-panel.tsx`，本类作为薄 facade 保持 `clog.*` 全局调用面
 * 不变；log/warn/error/debug + 条目管理 + localStorage 持久化保留于此。
 *
 * 依赖（已由 `src/types/globals.d.ts` 声明为 any）：
 * - `storageManager`：读取 `clogMsgCount` 最大条数上限；
 * - `localStorage`：持久化折叠/最大化/过滤器状态。
 * 面板样式由原脚本顶部注入的 `<style>` 块提供，本模块不重复注入。
 */

import { jsxToString } from './jsx-to-string';
import { UrlAutoLink } from '../components/misc/url-auto-link';
import {
    FILTER_KEY,
    LOG_TYPE_STYLES,
    bindEvents,
    checkInitialCollapseState,
    checkInitialMaximizeState,
    clear as panelClear,
    createContainer,
    renderLog,
    reRenderAllLogs,
    setFilter
} from './util/logger-panel';

export interface LogEntry {
    /** 渲染后的消息 HTML（对象已 JSON 序列化、URL 已链接化） */
    message: string;
    /** 消息渲染类型：`"msg"` 普通文本 / `"json"` 预格式化 JSON */
    messageType: string;
    /** 日志类型：`base`/`warn`/`error`/`debug`，决定颜色与过滤归属 */
    type: string;
    /** 生成时间 */
    timestamp: Date;
    /** 唯一标识（Date.now() + Math.random()），用于淘汰旧条目时定位 DOM */
    id: number;
}

export class Logger {
    /** 当前生效的过滤器名 */
    currentFilter: string;
    /** 全部日志条目（含因折叠/过滤未渲染的） */
    logs: LogEntry[] = [];
    /** 面板 DOM 是否已创建并绑定事件 */
    isInitialized: boolean = false;
    /** 用户是否手动向上滚动（用于抑制自动滚到底部） */
    userScrolledUp: boolean = false;
    /** 面板根容器（createContainer 中赋值） */
    container!: HTMLDivElement;
    /** 折叠/展开切换按钮 */
    toggleBtn!: HTMLDivElement;
    /** 日志窗口主体（含 header/filters/content） */
    window!: HTMLDivElement;
    /** 最大化按钮 */
    maximizeBtn!: HTMLButtonElement;
    /** 过滤器行容器 */
    filtersContainer!: HTMLDivElement;
    /** 过滤器按钮组容器 */
    filterButtonGroup!: HTMLDivElement;
    /** "到底部" 按钮 */
    scrollToBottomBtn!: HTMLButtonElement;
    /** 日志内容滚动区 */
    content!: HTMLDivElement;
    /** 日志条数上限（超出后从头部淘汰）；惰性读取自 storageManager 的 `clogMsgCount` 设置 */
    maxLogCount: number = 2000;
    /** maxLogCount 是否已发起异步读取（避免重复请求） */
    maxLogCountInitialized: boolean = false;

    /**
     * 读取持久化的过滤器状态；未设置或无效时回退到 `base`。
     * DOM 初始化延迟到首次 `tryInitialize()`。
     */
    constructor() {
        const stored = localStorage.getItem(FILTER_KEY);
        this.currentFilter = stored && LOG_TYPE_STYLES[stored] ? stored : 'base';
    }

    /**
     * 若 DOM 已就绪则确保面板初始化。
     * @returns 是否已初始化（true 表示可安全操作面板 DOM）
     */
    tryInitialize(): boolean {
        return (
            document.readyState !== 'loading' &&
            (this.isInitialized || (this.init(), (this.isInitialized = true), true))
        );
    }

    /** 创建面板 DOM、绑定事件、恢复持久化状态。 */
    init(): void {
        createContainer(this);
        bindEvents(this);
        checkInitialMaximizeState(this);
        checkInitialCollapseState(this);
    }

    /**
     * 追加一条日志（核心入口）。先确保初始化，再对参数做类型归一化、
     * 对象 JSON 序列化、URL 链接化，最后渲染；超出上限时淘汰最旧一条。
     *
     * 时序说明：原脚本在模块顶层 `await storageManager.getSetting(...)`
     * 读取日志条数上限。但本模块被 legacy 顶部 import 时 storageManager
     * 全局尚未实例化，故改为在首次调用本方法时异步读取并缓存到
     * `maxLogCount`；读取完成前以默认值 2000 兜底，语义保持一致。
     * @param message 首个参数，作为消息主体
     * @param typeArg 第二参数；若为合法日志类型则用作类型，否则并入消息
     * @param extraArgs 其余参数，拼接到消息
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addLog(message: any, typeArg: any = 'base', ...extraArgs: any[]): void {
        if (!this.maxLogCountInitialized) {
            this.maxLogCountInitialized = true;
            storageManager.getSetting('clogMsgCount', 2000).then((v: number) => {
                this.maxLogCount = v;
            }).catch(() => { /* 存储异常时保持默认值 */ });
        }
        const initialized = this.tryInitialize();
        let resolvedType: string;
        let resolvedExtra: unknown[] = [];
        if (LOG_TYPE_STYLES[typeArg]) {
            resolvedType = typeArg;
            resolvedExtra = extraArgs;
        } else {
            resolvedType = 'base';
            resolvedExtra = [typeArg, ...extraArgs];
        }
        resolvedType = LOG_TYPE_STYLES[resolvedType] ? resolvedType : 'base';
        const allParts: unknown[] = [message, ...resolvedExtra];
        let messageType: string = 'msg';
        const parts: string[] = [];
        allParts.forEach((part) => {
            if (Object.prototype.toString.call(part) === '[object Error]') {
                parts.push(String(part));
            } else if (typeof part === 'object' && part !== null) {
                try {
                    parts.push(jsxToString(<br />) + JSON.stringify(part, null, 2));
                    messageType = 'json';
                } catch {
                    parts.push(String(part));
                    messageType = 'msg';
                }
            } else {
                parts.push(String(part));
            }
        });
        let formattedMessage: string = parts.join('  ');
        formattedMessage = formattedMessage.replace(
            /(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|]/gi,
            (match) => {
                const isHttpOrFtp = match.startsWith('http') || match.startsWith('ftp');
                const isProtocolRelative = match.startsWith('//');
                const isWww = match.startsWith('www.');
                let href = match;
                if (isProtocolRelative) {
                    href = `http:${match}`;
                } else if (!isHttpOrFtp && isWww) {
                    href = `http://${match}`;
                }
                return jsxToString(<UrlAutoLink href={href} text={match} />);
            }
        );
        const entry: LogEntry = {
            message: formattedMessage,
            messageType,
            type: resolvedType,
            timestamp: new Date(),
            id: Date.now() + Math.random()
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogCount) {
            const firstEntry = this.logs[0];
            if (initialized) {
                const oldEl = this.content.querySelector<HTMLDivElement>(
                    `.console-logger-entry[data-id="${firstEntry.id}"]`
                );
                if (oldEl) {
                    this.logs.shift();
                    this.content.removeChild(oldEl);
                }
            }
        }
        if (initialized) {
            renderLog(this, entry);
        }
    }

    /** 以 `base` 类型异步输出日志（setTimeout 0 解耦调用栈）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, 'base', ...rest);
        }, 0);
    }

    /** 以 `error` 类型异步输出日志，并同步打到 `console.error`。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(...args: any[]): void {
        const [first, ...rest] = args;
        console.error(...args);
        setTimeout(() => {
            this.addLog(first, 'error', ...rest);
        }, 0);
    }

    /** 以 `warn` 类型异步输出日志。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, 'warn', ...rest);
        }, 0);
    }

    /** 以 `debug` 类型异步输出日志。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debug(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, 'debug', ...rest);
        }, 0);
    }

    /** 重新渲染全部日志（清空内容区后按当前过滤器批量重建）。 */
    reRenderAllLogs(): void {
        reRenderAllLogs(this);
    }

    /**
     * 切换当前过滤器并持久化、刷新按钮 active 态、重渲染日志。
     * @param filterType 过滤器名（base/warn/error/debug）
     */
    setFilter(filterType: string): void {
        setFilter(this, filterType);
    }

    /** 清空全部日志与内容区 DOM。 */
    clear(): void {
        panelClear(this);
    }

    /** 显示面板并重渲染日志；未初始化时尝试初始化。 */
    show(): void {
        if ((this.isInitialized && this.container) || (this.tryInitialize() && this.container)) {
            this.container.style.display = '';
            this.reRenderAllLogs();
        }
    }

    /** 隐藏面板（display:none）。 */
    hide(): void {
        if (this.isInitialized && this.container) {
            this.container.style.display = 'none';
        }
    }

    /** 将面板 z-index 调低（让位于弹窗等）。 */
    lowZIndex(): void {
        if (this.isInitialized && this.container) {
            this.container.style.zIndex = '12345678';
        }
    }

    /** 将面板 z-index 调高（恢复到最前）。 */
    highZIndex(): void {
        if (this.isInitialized && this.container) {
            this.container.style.zIndex = '999999999';
        }
    }
}
