/**
 * 日志面板 DOM 渲染 / 事件绑定 / 过滤逻辑（提取自 Logger 类）。
 *
 * 面板样式由原脚本顶部注入的 `<style>` 块提供，本模块不重复注入。
 * 依赖全局 storageManager（经 Logger.addLog 读取 clogMsgCount）。
 * 各函数以 Logger 实例为参数透传（thread collaborator），控制流与渲染逻辑保持不变。
 */

import { jsxToString } from '../jsx-to-string';
import { LoggerLogEntry } from '../../components/log/logger-log-entry';
import type { LogEntry, Logger } from '../logger';

/** 日志类型样式配置：label/background/borderLeftColor */
export const LOG_TYPE_STYLES: Record<
    string,
    { label: string; background: string; borderLeftColor: string }
> = {
    base: { label: '信息', background: '#e8f4fd', borderLeftColor: '#3498db' },
    warn: { label: '警告', background: '#fef9e7', borderLeftColor: '#f39c12' },
    error: { label: '错误', background: '#fdedec', borderLeftColor: '#e74c3c' },
    debug: { label: '调试', background: '#f4f6f6', borderLeftColor: '#95a5a6' }
};

/** 过滤器 → 命中类型映射：决定某过滤器下显示哪些类型的日志 */
const FILTER_TYPE_MAP: Record<string, string[]> = {
    base: ['base', 'warn', 'error'],
    warn: ['warn'],
    error: ['error'],
    debug: ['base', 'warn', 'error', 'debug']
};

/** localStorage 键：最大化状态 */
const MAXIMIZE_KEY = 'jhs_clog_maximize';
/** localStorage 键：展开/折叠状态 */
const EXPAND_KEY = 'jhs_clog_expand';
/** localStorage 键：当前过滤器 */
export const FILTER_KEY = 'jhs_clog_filter';

/** 构建面板 DOM 树并追加到 body，按 LOG_TYPE_STYLES 生成过滤器按钮。 */
export function createContainer(logger: Logger): void {
    logger.container = document.createElement('div');
    logger.container.className = 'console-logger-container';
    logger.container.style.display = 'none';
    logger.toggleBtn = document.createElement('div');
    logger.toggleBtn.className = 'console-logger-toggle collapsed';
    logger.container.appendChild(logger.toggleBtn);
    logger.window = document.createElement('div');
    logger.window.className = 'console-logger-window collapsed';
    const header = document.createElement('div');
    header.className = 'console-logger-header';
    const title = document.createElement('div');
    title.className = 'console-logger-title';
    title.textContent = 'JHS V3.3.2';
    const controls = document.createElement('div');
    controls.className = 'console-logger-controls';
    logger.maximizeBtn = document.createElement('button');
    logger.maximizeBtn.textContent = '';
    logger.maximizeBtn.classList.add('console-logger-maximize-toggle');
    controls.appendChild(logger.maximizeBtn);
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清空';
    clearBtn.addEventListener('click', () => logger.clear());
    controls.appendChild(clearBtn);
    header.appendChild(title);
    header.appendChild(controls);
    logger.filtersContainer = document.createElement('div');
    logger.filtersContainer.className = 'console-logger-filters';
    logger.filterButtonGroup = document.createElement('div');
    logger.filterButtonGroup.className = 'console-logger-filter-group';
    logger.filtersContainer.appendChild(logger.filterButtonGroup);
    logger.scrollToBottomBtn = document.createElement('button');
    logger.scrollToBottomBtn.className = 'console-logger-scroll-to-bottom';
    logger.scrollToBottomBtn.textContent = '到底部';
    logger.filtersContainer.appendChild(logger.scrollToBottomBtn);
    logger.content = document.createElement('div');
    logger.content.className = 'console-logger-content jhs-scrollbar';
    logger.window.appendChild(header);
    logger.window.appendChild(logger.filtersContainer);
    logger.window.appendChild(logger.content);
    logger.container.appendChild(logger.window);
    document.body.appendChild(logger.container);
    Object.keys(LOG_TYPE_STYLES).forEach((typeName) => {
        const filterBtn = document.createElement('div');
        filterBtn.className = 'console-logger-filter';
        if (typeName === logger.currentFilter) {
            filterBtn.classList.add('active');
        }
        filterBtn.textContent = LOG_TYPE_STYLES[typeName].label;
        filterBtn.dataset.type = typeName;
        filterBtn.addEventListener('click', () => logger.setFilter(typeName));
        logger.filterButtonGroup.appendChild(filterBtn);
    });
}

/** 绑定折叠、最大化、滚到底部、滚动方向锁定等事件。 */
export function bindEvents(logger: Logger): void {
    logger.toggleBtn.addEventListener('click', () => {
        toggleExpandCollapsed(logger);
    });
    logger.maximizeBtn.addEventListener('click', () => toggleMaximize(logger));
    logger.scrollToBottomBtn.addEventListener('click', () => {
        logger.content.scrollTop = logger.content.scrollHeight;
        logger.userScrolledUp = false;
    });
    logger.content.addEventListener('scroll', () => {
        const atBottom =
            logger.content.scrollHeight - logger.content.clientHeight <= logger.content.scrollTop + 5;
        logger.userScrolledUp = !atBottom;
    });
    logger.content.addEventListener(
        'wheel',
        (evt: WheelEvent) => {
            const atTop = logger.content.scrollTop === 0;
            const atBottom =
                logger.content.scrollHeight - logger.content.clientHeight <=
                logger.content.scrollTop + 1;
            if ((atTop && evt.deltaY < 0) || (atBottom && evt.deltaY > 0)) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        },
        { passive: false }
    );
}

/** 切换日志窗口展开/折叠，并持久化状态；展开时重渲染全部日志。 */
export function toggleExpandCollapsed(logger: Logger): void {
    const isCollapsed = logger.window.classList.toggle('collapsed');
    logger.toggleBtn.classList.toggle('collapsed');
    if (isCollapsed) {
        localStorage.setItem(EXPAND_KEY, 'no');
    } else {
        localStorage.setItem(EXPAND_KEY, 'yes');
        reRenderAllLogs(logger);
    }
}

/** 根据 EXPAND_KEY 恢复初始展开/折叠状态。 */
export function checkInitialCollapseState(logger: Logger): void {
    const stored = localStorage.getItem(EXPAND_KEY);
    if (stored && stored !== 'no') {
        logger.window.classList.toggle('collapsed');
        logger.toggleBtn.classList.toggle('collapsed');
        setTimeout(() => {
            logger.content.scrollTop = logger.content.scrollHeight;
        }, 0);
    } else {
        logger.window.classList.add('collapsed');
        logger.toggleBtn.classList.add('collapsed');
    }
}

/** 根据 MAXIMIZE_KEY 恢复初始最大化状态。 */
export function checkInitialMaximizeState(logger: Logger): void {
    if (localStorage.getItem(MAXIMIZE_KEY) === 'maximized') {
        logger.window.classList.add('maximized');
        logger.maximizeBtn.classList.add('active');
    }
}

/** 切换最大化/还原，持久化状态并在展开时滚到底部。 */
export function toggleMaximize(logger: Logger): void {
    const isMaximized = logger.window.classList.toggle('maximized');
    logger.maximizeBtn.classList.toggle('active', isMaximized);
    if (isMaximized) {
        localStorage.setItem(MAXIMIZE_KEY, 'maximized');
    } else {
        localStorage.setItem(MAXIMIZE_KEY, 'minimized');
    }
    if (!logger.window.classList.contains('collapsed')) {
        logger.content.scrollTop = logger.content.scrollHeight;
    }
}

/**
 * 渲染单条日志到内容区（面板可见、未折叠、且通过当前过滤器时）。
 * @param logger Logger 实例
 * @param entry  待渲染条目
 */
export function renderLog(logger: Logger, entry: LogEntry): void {
    if (logger.container.style.display === 'none') {
        return;
    }
    if (logger.window.classList.contains('collapsed')) {
        return;
    }
    if (!(FILTER_TYPE_MAP[logger.currentFilter] || []).includes(entry.type)) {
        return;
    }
    const el = _createLogElement(entry);
    logger.content.appendChild(el);
    if (!logger.window.classList.contains('collapsed') && !logger.userScrolledUp) {
        logger.content.scrollTop = logger.content.scrollHeight;
    }
}

/** 重新渲染全部日志（清空内容区后按当前过滤器批量重建）。 */
export function reRenderAllLogs(logger: Logger): void {
    if (logger.container.style.display !== 'none') {
        if (!logger.window.classList.contains('collapsed')) {
            setTimeout(() => {
                logger.content.innerHTML = '';
                if (logger.logs.length === 0) {
                    return;
                }
                const filterTypes = FILTER_TYPE_MAP[logger.currentFilter] || [];
                const fragment = document.createDocumentFragment();
                logger.logs.forEach((entry) => {
                    if (filterTypes.includes(entry.type)) {
                        const el = _createLogElement(entry);
                        fragment.appendChild(el);
                    }
                });
                logger.content.appendChild(fragment);
                logger.content.scrollTop = logger.content.scrollHeight;
            }, 0);
        }
    }
}

/**
 * 构造单条日志的 DOM 元素（含时间戳、按类型着色的左边框与背景）。
 * @param entry 待渲染条目
 * @returns 日志条目 DOM
 */
export function _createLogElement(entry: LogEntry): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'console-logger-entry';
    el.dataset.type = entry.type;
    el.dataset.id = String(entry.id);
    const style = LOG_TYPE_STYLES[entry.type] || LOG_TYPE_STYLES.base;
    el.style.borderLeft = '3px solid ' + style.borderLeftColor;
    el.style.background = style.background;
    const timeStr = (
        entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)
    )
        .toTimeString()
        .split(' ')[0];
    el.innerHTML = jsxToString(
        <LoggerLogEntry
            timeStr={timeStr}
            messageType={entry.messageType}
            message={entry.message}
        />
    );
    return el;
}

/**
 * 切换当前过滤器并持久化、刷新按钮 active 态、重渲染日志。
 * @param logger     Logger 实例
 * @param filterType 过滤器名（base/warn/error/debug）
 */
export function setFilter(logger: Logger, filterType: string): void {
    if (logger.currentFilter === filterType) {
        return;
    }
    logger.currentFilter = filterType;
    localStorage.setItem(FILTER_KEY, filterType);
    logger.filterButtonGroup
        .querySelectorAll<HTMLDivElement>('.console-logger-filter')
        .forEach((btn) => {
            if (btn.dataset.type === filterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    reRenderAllLogs(logger);
}

/** 清空全部日志与内容区 DOM。 */
export function clear(logger: Logger): void {
    logger.logs = [];
    logger.content.innerHTML = '';
}
