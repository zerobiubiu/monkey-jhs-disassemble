/**
 * Toast 通知系统 —— 队列式，最多 2 条同时显示，溢出堆叠。
 *
 * 提取自 archetype/listsOptionSync.user.js L22-269（toastQueue/injectToastStyles/
 * getToastContainer/promoteOverflow/dismissToast/showToast）。
 *
 * 原脚本自建 toast 系统（不依赖 jhs 的 show），此处保留原设计——
 * 因为 jhs 的 show 是 Toastify-js 全局，样式和队列行为不同。
 *
 * 内联 HTML 字面量已组件化（doc/16-jsx-to-string.md 零 HTML 字符串硬编码
 * 要求）：showToast 原 `innerHTML =` 模板（图标 span + 消息 span）→
 * VltToastContent 组件，经 jsxToString 转 HTML 字符串后赋值 innerHTML。
 * 4 个 SVG 图标含 kebab-only 属性（stroke-width/stroke-linecap/
 * stroke-linejoin，jsxToString 不做属性名 camelCase→kebab 转换），以命名
 * 常量保留于 VltToastContent 内，仅经 dangerouslySetInnerHTML 注入，
 * 逐字符保留原标记。消息文本经 escapeText 转义后写入，与原文本
 * 「空 span + textContent 赋值」路径对任意 msg 的最终 DOM 文本一致。
 * （本文件由 vlt-toast.ts 更名而来，仅因引入 JSX；各导入方均为无扩展名
 * 相对路径，无需改动。）
 */
import { jsxToString } from '../../core/jsx-to-string';

import { VltToastContent } from '../../components/misc/vlt-toast-content';

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
    toast.innerHTML = jsxToString(<VltToastContent type={type} msg={msg} />);

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
