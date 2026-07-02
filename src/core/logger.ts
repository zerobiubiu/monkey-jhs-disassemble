/**
 * 日志面板模块。
 *
 * 对应原 `archetype/jhs.user.js` L2365-2762 的日志面板实现：含 `class o` 及其
 * 顶部的样式配置 `e`、过滤器映射 `t`、最大条数 `n` 与三个 localStorage 键
 * `a/i/s`。仅在 JS→TS 转换与命名优化的范围内重写，控制流与渲染逻辑保持不变。
 *
 * 依赖（已由 `src/types/globals.d.ts` 声明为 any）：
 * - `storageManager`：读取 `clogMsgCount` 最大条数上限；
 * - `localStorage`：持久化折叠/最大化/过滤器状态。
 * 面板样式由原脚本顶部注入的 `<style>` 块提供，本模块不重复注入。
 */

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

/** 日志类型样式配置：label/background/borderLeftColor */
const LOG_TYPE_STYLES: Record<
    string,
    { label: string; background: string; borderLeftColor: string }
> = {
    base: { label: "信息", background: "#e8f4fd", borderLeftColor: "#3498db" },
    warn: { label: "警告", background: "#fef9e7", borderLeftColor: "#f39c12" },
    error: { label: "错误", background: "#fdedec", borderLeftColor: "#e74c3c" },
    debug: { label: "调试", background: "#f4f6f6", borderLeftColor: "#95a5a6" },
};

/** 过滤器 → 命中类型映射：决定某过滤器下显示哪些类型的日志 */
const FILTER_TYPE_MAP: Record<string, string[]> = {
    base: ["base", "warn", "error"],
    warn: ["warn"],
    error: ["error"],
    debug: ["base", "warn", "error", "debug"],
};

/** localStorage 键：最大化状态 */
const MAXIMIZE_KEY = "jhs_clog_maximize";
/** localStorage 键：展开/折叠状态 */
const EXPAND_KEY = "jhs_clog_expand";
/** localStorage 键：当前过滤器 */
const FILTER_KEY = "jhs_clog_filter";

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
        this.currentFilter =
            stored && LOG_TYPE_STYLES[stored] ? stored : "base";
    }

    /**
     * 若 DOM 已就绪则确保面板初始化。
     * @returns 是否已初始化（true 表示可安全操作面板 DOM）
     */
    tryInitialize(): boolean {
        return (
            document.readyState !== "loading" &&
            (this.isInitialized ||
                (this.init(), (this.isInitialized = true), true))
        );
    }

    /** 创建面板 DOM、绑定事件、恢复持久化状态。 */
    init(): void {
        this.createContainer();
        this.bindEvents();
        this.checkInitialMaximizeState();
        this.checkInitialCollapseState();
    }

    /** 构建面板 DOM 树并追加到 body，按 LOG_TYPE_STYLES 生成过滤器按钮。 */
    createContainer(): void {
        this.container = document.createElement("div");
        this.container.className = "console-logger-container";
        this.container.style.display = "none";
        this.toggleBtn = document.createElement("div");
        this.toggleBtn.className = "console-logger-toggle collapsed";
        this.container.appendChild(this.toggleBtn);
        this.window = document.createElement("div");
        this.window.className = "console-logger-window collapsed";
        const header = document.createElement("div");
        header.className = "console-logger-header";
        const title = document.createElement("div");
        title.className = "console-logger-title";
        title.textContent = "JHS V3.3.2";
        const controls = document.createElement("div");
        controls.className = "console-logger-controls";
        this.maximizeBtn = document.createElement("button");
        this.maximizeBtn.textContent = "";
        this.maximizeBtn.classList.add("console-logger-maximize-toggle");
        controls.appendChild(this.maximizeBtn);
        const clearBtn = document.createElement("button");
        clearBtn.textContent = "清空";
        clearBtn.addEventListener("click", () => this.clear());
        controls.appendChild(clearBtn);
        header.appendChild(title);
        header.appendChild(controls);
        this.filtersContainer = document.createElement("div");
        this.filtersContainer.className = "console-logger-filters";
        this.filterButtonGroup = document.createElement("div");
        this.filterButtonGroup.className = "console-logger-filter-group";
        this.filtersContainer.appendChild(this.filterButtonGroup);
        this.scrollToBottomBtn = document.createElement("button");
        this.scrollToBottomBtn.className = "console-logger-scroll-to-bottom";
        this.scrollToBottomBtn.textContent = "到底部";
        this.filtersContainer.appendChild(this.scrollToBottomBtn);
        this.content = document.createElement("div");
        this.content.className = "console-logger-content jhs-scrollbar";
        this.window.appendChild(header);
        this.window.appendChild(this.filtersContainer);
        this.window.appendChild(this.content);
        this.container.appendChild(this.window);
        document.body.appendChild(this.container);
        Object.keys(LOG_TYPE_STYLES).forEach((typeName) => {
            const filterBtn = document.createElement("div");
            filterBtn.className = "console-logger-filter";
            if (typeName === this.currentFilter) {
                filterBtn.classList.add("active");
            }
            filterBtn.textContent = LOG_TYPE_STYLES[typeName].label;
            filterBtn.dataset.type = typeName;
            filterBtn.addEventListener("click", () => this.setFilter(typeName));
            this.filterButtonGroup.appendChild(filterBtn);
        });
    }

    /** 绑定折叠、最大化、滚到底部、滚动方向锁定等事件。 */
    bindEvents(): void {
        this.toggleBtn.addEventListener("click", () => {
            this.toggleExpandCollapsed();
        });
        this.maximizeBtn.addEventListener("click", () => this.toggleMaximize());
        this.scrollToBottomBtn.addEventListener("click", () => {
            this.content.scrollTop = this.content.scrollHeight;
            this.userScrolledUp = false;
        });
        this.content.addEventListener("scroll", () => {
            const atBottom =
                this.content.scrollHeight - this.content.clientHeight <=
                this.content.scrollTop + 5;
            this.userScrolledUp = !atBottom;
        });
        this.content.addEventListener(
            "wheel",
            (evt: WheelEvent) => {
                const atTop = this.content.scrollTop === 0;
                const atBottom =
                    this.content.scrollHeight - this.content.clientHeight <=
                    this.content.scrollTop + 1;
                if ((atTop && evt.deltaY < 0) || (atBottom && evt.deltaY > 0)) {
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            },
            { passive: false },
        );
    }

    /** 切换日志窗口展开/折叠，并持久化状态；展开时重渲染全部日志。 */
    toggleExpandCollapsed(): void {
        const isCollapsed = this.window.classList.toggle("collapsed");
        this.toggleBtn.classList.toggle("collapsed");
        if (isCollapsed) {
            localStorage.setItem(EXPAND_KEY, "no");
        } else {
            localStorage.setItem(EXPAND_KEY, "yes");
            this.reRenderAllLogs();
        }
    }

    /** 根据 EXPAND_KEY 恢复初始展开/折叠状态。 */
    checkInitialCollapseState(): void {
        const stored = localStorage.getItem(EXPAND_KEY);
        if (stored && stored !== "no") {
            this.window.classList.toggle("collapsed");
            this.toggleBtn.classList.toggle("collapsed");
            setTimeout(() => {
                this.content.scrollTop = this.content.scrollHeight;
            }, 0);
        } else {
            this.window.classList.add("collapsed");
            this.toggleBtn.classList.add("collapsed");
        }
    }

    /** 根据 MAXIMIZE_KEY 恢复初始最大化状态。 */
    checkInitialMaximizeState(): void {
        if (localStorage.getItem(MAXIMIZE_KEY) === "maximized") {
            this.window.classList.add("maximized");
            this.maximizeBtn.classList.add("active");
        }
    }

    /** 切换最大化/还原，持久化状态并在展开时滚到底部。 */
    toggleMaximize(): void {
        const isMaximized = this.window.classList.toggle("maximized");
        this.maximizeBtn.classList.toggle("active", isMaximized);
        if (isMaximized) {
            localStorage.setItem(MAXIMIZE_KEY, "maximized");
        } else {
            localStorage.setItem(MAXIMIZE_KEY, "minimized");
        }
        if (!this.window.classList.contains("collapsed")) {
            this.content.scrollTop = this.content.scrollHeight;
        }
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
    addLog(message: any, typeArg: any = "base", ...extraArgs: any[]): void {
        if (!this.maxLogCountInitialized) {
            this.maxLogCountInitialized = true;
            storageManager
                .getSetting("clogMsgCount", 2000)
                .then((v: number) => {
                    this.maxLogCount = v;
                });
        }
        const initialized = this.tryInitialize();
        let resolvedType: string;
        let resolvedExtra: any[] = [];
        if (LOG_TYPE_STYLES[typeArg]) {
            resolvedType = typeArg;
            resolvedExtra = extraArgs;
        } else {
            resolvedType = "base";
            resolvedExtra = [typeArg, ...extraArgs];
        }
        resolvedType = LOG_TYPE_STYLES[resolvedType] ? resolvedType : "base";
        const allParts: any[] = [message, ...resolvedExtra];
        let messageType: string = "msg";
        const parts: string[] = [];
        allParts.forEach((part) => {
            if (Object.prototype.toString.call(part) === "[object Error]") {
                parts.push(String(part));
            } else if (typeof part === "object" && part !== null) {
                try {
                    parts.push("<br/>" + JSON.stringify(part, null, 2));
                    messageType = "json";
                } catch {
                    parts.push(String(part));
                    messageType = "msg";
                }
            } else {
                parts.push(String(part));
            }
        });
        let formattedMessage: string = parts.join("  ");
        formattedMessage = formattedMessage.replace(
            /(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi,
            (match) => {
                const isHttpOrFtp =
                    match.startsWith("http") || match.startsWith("ftp");
                const isProtocolRelative = match.startsWith("//");
                const isWww = match.startsWith("www.");
                let href = match;
                if (isProtocolRelative) {
                    href = `http:${match}`;
                } else if (!isHttpOrFtp && isWww) {
                    href = `http://${match}`;
                }
                return `<a href="${href}" target="_blank">${match}</a>`;
            },
        );
        const entry: LogEntry = {
            message: formattedMessage,
            messageType,
            type: resolvedType,
            timestamp: new Date(),
            id: Date.now() + Math.random(),
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogCount) {
            const firstEntry = this.logs[0];
            if (initialized) {
                const oldEl = this.content.querySelector<HTMLDivElement>(
                    `.console-logger-entry[data-id="${firstEntry.id}"]`,
                );
                if (oldEl) {
                    this.logs.shift();
                    this.content.removeChild(oldEl);
                }
            }
        }
        if (initialized) {
            this.renderLog(entry);
        }
    }

    /** 以 `base` 类型异步输出日志（setTimeout 0 解耦调用栈）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, "base", ...rest);
        }, 0);
    }

    /** 以 `error` 类型异步输出日志，并同步打到 `console.error`。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(...args: any[]): void {
        const [first, ...rest] = args;
        console.error(...args);
        setTimeout(() => {
            this.addLog(first, "error", ...rest);
        }, 0);
    }

    /** 以 `warn` 类型异步输出日志。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, "warn", ...rest);
        }, 0);
    }

    /** 以 `debug` 类型异步输出日志。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debug(...args: any[]): void {
        const [first, ...rest] = args;
        setTimeout(() => {
            this.addLog(first, "debug", ...rest);
        }, 0);
    }

    /**
     * 渲染单条日志到内容区（面板可见、未折叠、且通过当前过滤器时）。
     * @param entry 待渲染条目
     */
    renderLog(entry: LogEntry): void {
        if (this.container.style.display === "none") {
            return;
        }
        if (this.window.classList.contains("collapsed")) {
            return;
        }
        if (!(FILTER_TYPE_MAP[this.currentFilter] || []).includes(entry.type)) {
            return;
        }
        const el = this._createLogElement(entry);
        this.content.appendChild(el);
        if (
            !this.window.classList.contains("collapsed") &&
            !this.userScrolledUp
        ) {
            this.content.scrollTop = this.content.scrollHeight;
        }
    }

    /** 重新渲染全部日志（清空内容区后按当前过滤器批量重建）。 */
    reRenderAllLogs(): void {
        if (this.container.style.display !== "none") {
            if (!this.window.classList.contains("collapsed")) {
                setTimeout(() => {
                    this.content.innerHTML = "";
                    if (this.logs.length === 0) {
                        return;
                    }
                    const filterTypes =
                        FILTER_TYPE_MAP[this.currentFilter] || [];
                    const fragment = document.createDocumentFragment();
                    this.logs.forEach((entry) => {
                        if (filterTypes.includes(entry.type)) {
                            const el = this._createLogElement(entry);
                            fragment.appendChild(el);
                        }
                    });
                    this.content.appendChild(fragment);
                    this.content.scrollTop = this.content.scrollHeight;
                }, 0);
            }
        }
    }

    /**
     * 构造单条日志的 DOM 元素（含时间戳、按类型着色的左边框与背景）。
     * @param entry 待渲染条目
     * @returns 日志条目 DOM
     */
    _createLogElement(entry: LogEntry): HTMLDivElement {
        const el = document.createElement("div");
        el.className = "console-logger-entry";
        el.dataset.type = entry.type;
        el.dataset.id = String(entry.id);
        const style = LOG_TYPE_STYLES[entry.type] || LOG_TYPE_STYLES.base;
        el.style.borderLeft = "3px solid " + style.borderLeftColor;
        el.style.background = style.background;
        const timeStr = (
            entry.timestamp instanceof Date
                ? entry.timestamp
                : new Date(entry.timestamp)
        )
            .toTimeString()
            .split(" ")[0];
        el.innerHTML = `\n                <span class="console-logger-timestamp">[${timeStr}]</span>\n                <span class="console-logger-message" data-type="${entry.messageType}">${entry.message}</span>\n            `;
        return el;
    }

    /**
     * 切换当前过滤器并持久化、刷新按钮 active 态、重渲染日志。
     * @param filterType 过滤器名（base/warn/error/debug）
     */
    setFilter(filterType: string): void {
        if (this.currentFilter === filterType) {
            return;
        }
        this.currentFilter = filterType;
        localStorage.setItem(FILTER_KEY, filterType);
        this.filterButtonGroup
            .querySelectorAll<HTMLDivElement>(".console-logger-filter")
            .forEach((btn) => {
                if (btn.dataset.type === filterType) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });
        this.reRenderAllLogs();
    }

    /** 清空全部日志与内容区 DOM。 */
    clear(): void {
        this.logs = [];
        this.content.innerHTML = "";
    }

    /** 显示面板并重渲染日志；未初始化时尝试初始化。 */
    show(): void {
        if (
            (this.isInitialized && this.container) ||
            (this.tryInitialize() && this.container)
        ) {
            this.container.style.display = "";
            this.reRenderAllLogs();
        }
    }

    /** 隐藏面板（display:none）。 */
    hide(): void {
        if (this.isInitialized && this.container) {
            this.container.style.display = "none";
        }
    }

    /** 将面板 z-index 调低（让位于弹窗等）。 */
    lowZIndex(): void {
        if (this.isInitialized && this.container) {
            this.container.style.zIndex = "12345678";
        }
    }

    /** 将面板 z-index 调高（恢复到最前）。 */
    highZIndex(): void {
        if (this.isInitialized && this.container) {
            this.container.style.zIndex = "999999999";
        }
    }
}
