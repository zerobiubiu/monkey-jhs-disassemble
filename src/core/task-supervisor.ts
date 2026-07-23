/**
 * TaskSupervisor — AbortSignal 统一生命周期管理（Runtime V2 基础设施）。
 *
 * 将插件中散落的 setTimeout/setInterval/MutationObserver/addEventListener
 * 统一纳入 AbortSignal 管理。插件销毁或页面卸载时调用 abort() 一次性清理
 * 所有注册的资源，避免内存泄漏和幽灵回调。
 *
 * 使用方式（插件 opt-in）：
 * ```typescript
 * class MyPlugin extends BasePlugin {
 *     private supervisor = new TaskSupervisor();
 *
 *     async handle() {
 *         this.supervisor.setTimeout(() => this.doSomething(), 2000);
 *         this.supervisor.observe(document.body, this.onMutation, { childList: true });
 *         this.supervisor.addEventListener(window, 'resize', this.onResize);
 *     }
 *
 *     destroy() {
 *         this.supervisor.abort();
 *     }
 * }
 * ```
 */

/** 清理回调注册表条目。 */
interface CleanupEntry {
    type: 'timer' | 'interval' | 'observer' | 'listener';
    cleanup: () => void;
}

export class TaskSupervisor {
    private controller = new AbortController();
    private entries: CleanupEntry[] = [];
    private _aborted = false;

    /** 是否已中止。 */
    get aborted(): boolean {
        return this._aborted;
    }

    /** AbortSignal（可传递给 fetch 等原生 API）。 */
    get signal(): AbortSignal {
        return this.controller.signal;
    }

    /**
     * 注册 setTimeout，abort 时自动 clearTimeout。
     * @returns 定时器 ID
     */
    setTimeout(fn: () => void, ms: number): number {
        if (this._aborted) return -1;
        const id = window.setTimeout(() => {
            this.removeEntry(id, 'timer');
            fn();
        }, ms);
        this.entries.push({
            type: 'timer',
            cleanup: () => window.clearTimeout(id)
        });
        return id;
    }

    /**
     * 注册 setInterval，abort 时自动 clearInterval。
     * @returns 定时器 ID
     */
    setInterval(fn: () => void, ms: number): number {
        if (this._aborted) return -1;
        const id = window.setInterval(fn, ms);
        this.entries.push({
            type: 'interval',
            cleanup: () => window.clearInterval(id)
        });
        return id;
    }

    /**
     * 注册 MutationObserver，abort 时自动 disconnect。
     * @returns observer 实例
     */
    observe(
        target: Node,
        callback: MutationCallback,
        options?: MutationObserverInit
    ): MutationObserver {
        const observer = new MutationObserver(callback);
        if (!this._aborted) {
            observer.observe(target, options);
        }
        this.entries.push({
            type: 'observer',
            cleanup: () => observer.disconnect()
        });
        return observer;
    }

    /**
     * 注册事件监听器，abort 时自动 removeEventListener。
     * 原生支持 AbortSignal 的目标（如 fetch）可直接使用 this.signal。
     */
    addEventListener(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions
    ): void {
        if (this._aborted) return;
        const opts: AddEventListenerOptions = { ...options, signal: this.controller.signal };
        target.addEventListener(type, listener, opts);
        this.entries.push({
            type: 'listener',
            cleanup: () => target.removeEventListener(type, listener, options)
        });
    }

    /**
     * 中止所有注册的资源：清除定时器、断开 Observer、移除事件监听器。
     * 幂等：多次调用安全。
     */
    abort(): void {
        if (this._aborted) return;
        this._aborted = true;
        this.controller.abort();
        for (const entry of this.entries) {
            try {
                entry.cleanup();
            } catch {
                /* 清理失败不影响其他资源 */
            }
        }
        this.entries.length = 0;
    }

    /** 从注册表中移除已自然完成的条目。 */
    private removeEntry(id: number, type: CleanupEntry['type']): void {
        const index = this.entries.findIndex(
            (e) => e.type === type && e.cleanup.toString().includes(String(id))
        );
        if (index !== -1) this.entries.splice(index, 1);
    }
}
