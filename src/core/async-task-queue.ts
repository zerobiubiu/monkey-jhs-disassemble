/**
 * 异步任务队列 AsyncTaskQueue（提取自 archetype/jhs.user.js L4831-4845 的 class ve，
 * 并扩展为可配置并发 + 任务句柄）。
 *
 * - concurrency=1：与原版等价的串行执行（前一个完成后再跑下一个）
 * - concurrency>1：最多同时执行 N 个任务，完成后从等待队列取下一个
 * 单任务抛错会被 catch 吞掉并记 clog，不中断后续任务。
 *
 * 句柄扩展（doc/26）：任务可带业务键，便于外部**观察队列**（`getTasks`）与
 * **手动干预**（`cancel` / `prioritize`）。不传键时行为与原实现完全一致。
 */

/** 任务对外句柄：供任务闭包自检取消状态，也作为队列内标识。 */
export interface QueueTaskHandle {
    /** 业务键（同键任务在队列中并列存在时不保证唯一，仅用于展示与定位）。 */
    readonly key: string;
    /** 是否已被取消；任务闭包可据此在开工前提前退出（无法中断已在途的请求）。 */
    isCancelled(): boolean;
}

/** 任务在队列中的快照（供可视化面板展示）。 */
export interface QueueTaskInfo {
    /** 业务键。 */
    readonly key: string;
    /** 状态：等待中 / 执行中。 */
    readonly state: 'pending' | 'running';
}

/** 任务闭包签名：接收句柄，便于自检取消。 */
type QueueTaskRunner = (handle: QueueTaskHandle) => unknown | Promise<unknown>;

/** 队列内的任务条目。 */
interface TaskEntry {
    handle: TaskHandle;
    run: QueueTaskRunner;
}

/** 句柄实现：可变取消位。 */
class TaskHandle implements QueueTaskHandle {
    private cancelled = false;

    constructor(readonly key: string) {}

    isCancelled(): boolean {
        return this.cancelled;
    }

    /** 置位取消标记（仅队列内部调用）。 */
    markCancelled(): void {
        this.cancelled = true;
    }
}

/**
 * 异步任务队列：支持 1..N 并发、任务句柄（取消 / 置顶 / 快照），
 * 单任务失败不中断后续任务。
 */
export class AsyncTaskQueue {
    /** 最大并发数（≥1）。 */
    private concurrency: number;
    /** 正在执行的任务数。 */
    private runningCount = 0;
    /** 正在执行的任务（供快照与取消）。 */
    private running = new Set<TaskHandle>();
    /** 等待执行的任务队列。 */
    private pending: TaskEntry[] = [];
    /** waitAllFinished 的等待者。 */
    private idleWaiters: Array<() => void> = [];

    /**
     * @param concurrency 并发数，默认 1（串行，兼容原行为）
     */
    constructor(concurrency = 1) {
        this.concurrency = Math.max(1, Math.floor(Number(concurrency)) || 1);
    }

    /**
     * 运行时调整并发上限；增大时立即尝试启动等待中的任务。
     * @param concurrency 新的并发数（≥1）
     */
    setConcurrency(concurrency: number): void {
        this.concurrency = Math.max(1, Math.floor(Number(concurrency)) || 1);
        this.pump();
    }

    /** 当前配置的并发上限。 */
    getConcurrency(): number {
        return this.concurrency;
    }

    /**
     * 向队列追加任务，按并发上限调度执行。
     * 任务抛错会被捕获并记录到 clog，不会中断后续任务。
     *
     * @param task 待执行任务；可为同步或异步，返回值被忽略。接收 {@link QueueTaskHandle} 以便自检取消。
     * @param key 业务键（可选）；供 `getTasks` / `cancel` / `prioritize` 定位
     * @returns 任务句柄
     */
    addTask(task: QueueTaskRunner, key = ''): QueueTaskHandle {
        const handle = new TaskHandle(key);
        this.pending.push({ handle, run: task });
        this.pump();
        return handle;
    }

    /** 当前队列快照（先执行中、后等待中）。 */
    getTasks(): QueueTaskInfo[] {
        const infos: QueueTaskInfo[] = [];
        for (const handle of this.running) {
            infos.push({ key: handle.key, state: 'running' });
        }
        for (const entry of this.pending) {
            infos.push({ key: entry.handle.key, state: 'pending' });
        }
        return infos;
    }

    /**
     * 取消任务：等待中的直接出队；执行中的置取消标记（无法中断在途请求，
     * 由任务闭包在下一步自检后提前退出）。
     *
     * @param key 业务键
     * @returns 是否找到并取消
     */
    cancel(key: string): boolean {
        const index = this.pending.findIndex((entry) => entry.handle.key === key);
        if (index >= 0) {
            const [removed] = this.pending.splice(index, 1);
            removed.handle.markCancelled();
            this.notifyIdle();
            return true;
        }
        for (const handle of this.running) {
            if (handle.key === key) {
                handle.markCancelled();
                return true;
            }
        }
        return false;
    }

    /**
     * 把等待中的任务提到队首（已取消或不存在则返回 false）。
     *
     * @param key 业务键
     * @returns 是否发生了重排
     */
    prioritize(key: string): boolean {
        const index = this.pending.findIndex((entry) => entry.handle.key === key);
        if (index < 0) {
            return false;
        }
        if (index === 0) {
            return true;
        }
        const [entry] = this.pending.splice(index, 1);
        this.pending.unshift(entry);
        return true;
    }

    /**
     * 等待当前已入队任务全部完成（成功或被捕获的失败）。
     * 等待期间新加入的任务也会被纳入（直到队列真正空闲）。
     */
    async waitAllFinished(): Promise<void> {
        if (this.runningCount === 0 && this.pending.length === 0) {
            return;
        }
        return new Promise<void>((resolve) => {
            this.idleWaiters.push(resolve);
            this.pump();
        });
    }

    /** 在并发允许时从 pending 取任务启动。 */
    private pump(): void {
        while (this.runningCount < this.concurrency && this.pending.length > 0) {
            const entry = this.pending.shift()!;
            this.runningCount++;
            this.running.add(entry.handle);
            Promise.resolve()
                .then(() => entry.run(entry.handle))
                .catch((err: unknown) => {
                    clog.error('执行异步队列任务失败:', err);
                })
                .finally(() => {
                    this.runningCount--;
                    this.running.delete(entry.handle);
                    this.pump();
                    this.notifyIdle();
                });
        }
        this.notifyIdle();
    }

    /** 队列空闲时唤醒 waitAllFinished。 */
    private notifyIdle(): void {
        if (this.runningCount !== 0 || this.pending.length !== 0) return;
        const waiters = this.idleWaiters.splice(0);
        for (const w of waiters) w();
    }
}
