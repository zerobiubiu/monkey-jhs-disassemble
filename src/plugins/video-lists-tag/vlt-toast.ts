/**
 * Toast 通知系统 —— 队列式，最多 2 条同时显示，溢出堆叠。
 *
 * 提取自 archetype/listsOptionSync.user.js L22-269（toastQueue/injectToastStyles/
 * getToastContainer/promoteOverflow/dismissToast/showToast）。
 *
 * 原脚本自建 toast 系统（不依赖 jhs 的 show），此处保留原设计——
 * 因为 jhs 的 show 是 Toastify-js 全局，样式和队列行为不同。
 */

/** Toast 类型。 */
type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast 数据（展示中）。 */
interface VisibleToast {
    el: HTMLDivElement;
    timerId: ReturnType<typeof setTimeout>;
    createdAt: number;
}

/** Toast 数据（溢出排队中）。 */
interface OverflowToast {
    el: HTMLDivElement;
    msg: string;
    type: ToastType;
    duration: number;
}

/** 队列状态。 */
const queue = {
    MAX_VISIBLE: 2,
    SIMULTANEOUS_WINDOW: 500,
    EXTRA_DURATION: 1000,
    visible: [] as VisibleToast[],
    overflow: [] as OverflowToast[],
    lastAddTime: 0
};

/** SVG 图标。 */
const ICONS: Record<ToastType, string> = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8.01"/></svg>'
};

/** 获取或创建 toast 容器。 */
function getToastContainer(): HTMLDivElement {
    let el = document.getElementById('jdb-toast-container') as HTMLDivElement | null;
    if (!el) {
        el = document.createElement('div');
        el.id = 'jdb-toast-container';
        document.body.appendChild(el);
    }
    return el;
}

/** 将溢出队列中的下一条提升为可见。 */
function promoteOverflow(): void {
    if (queue.overflow.length === 0 || queue.visible.length >= queue.MAX_VISIBLE) return;

    const stacked = queue.visible.find((v: VisibleToast) => v.el.classList.contains('jdb-toast--stacked'));
    if (stacked) {
        // 取消堆叠态，恢复正常
        stacked.el.classList.remove('jdb-toast--stacked');
    }

    const next = queue.overflow.shift()!;
    const container = getToastContainer();
    container.appendChild(next.el);
    // 触发 reflow 后移除初始隐藏
    void next.el.offsetHeight;

    const now = Date.now();
    const isSimultaneous = now - queue.lastAddTime < queue.SIMULTANEOUS_WINDOW;
    let adjustedDuration = next.duration;
    if (isSimultaneous) {
        adjustedDuration += queue.EXTRA_DURATION;
    }
    queue.lastAddTime = now;

    queue.visible.push({
        el: next.el,
        timerId: setTimeout(() => dismissToast(next.el), adjustedDuration),
        createdAt: now
    });
}

/** 关闭一条 toast。 */
function dismissToast(el: HTMLDivElement): void {
    const idx = queue.visible.findIndex((v: VisibleToast) => v.el === el);
    if (idx < 0) return;

    const onTransitionEnd = () => {
        el.removeEventListener('transitionend', onTransitionEnd);
        el.remove();
        const i = queue.visible.findIndex((v: VisibleToast) => v.el === el);
        if (i >= 0) queue.visible.splice(i, 1);
        promoteOverflow();
    };

    el.classList.add('removing');
    el.addEventListener('transitionend', onTransitionEnd);
    // 兜底：300ms 后强制移除
    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
            const i = queue.visible.findIndex((v: VisibleToast) => v.el === el);
            if (i >= 0) queue.visible.splice(i, 1);
            promoteOverflow();
        }
    }, 300);

    if (idx >= 0) {
        clearTimeout(queue.visible[idx].timerId);
    }
}

/**
 * 显示 toast 通知。
 * @param msg 消息文本
 * @param type 类型（success/error/warning/info）
 * @param duration 持续时间 ms（默认 2500）
 */
export function showToast(msg: string, type: ToastType = 'info', duration: number = 2500): void {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `jdb-toast jdb-toast--${type}`;
    toast.innerHTML = `<span class="jdb-toast__icon">${ICONS[type]}</span><span class="jdb-toast__msg"></span>`;
    (toast.querySelector('.jdb-toast__msg') as HTMLElement).textContent = msg;

    // 点击 toast 关闭
    toast.addEventListener('click', () => dismissToast(toast));

    if (queue.visible.length < queue.MAX_VISIBLE) {
        const now = Date.now();
        const isSimultaneous = now - queue.lastAddTime < queue.SIMULTANEOUS_WINDOW;
        let adjustedDuration = duration;
        if (isSimultaneous) {
            adjustedDuration += queue.EXTRA_DURATION;
        }
        queue.lastAddTime = now;

        container.appendChild(toast);
        queue.visible.push({
            el: toast,
            timerId: setTimeout(() => dismissToast(toast), adjustedDuration),
            createdAt: now
        });
    } else {
        // 溢出：堆叠在队列中
        toast.classList.add('jdb-toast--stacked');
        // 点击堆叠 toast 立即提升
        toast.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            const stackedData = queue.overflow.find((o: OverflowToast) => o.el === toast);
            if (stackedData) {
                const i = queue.overflow.findIndex((o: OverflowToast) => o.el === toast);
                queue.overflow.splice(i, 1);
                promoteOverflow();
            }
        });
        queue.overflow.push({ el: toast, msg, type, duration });
    }
}
