/**
 * 异步任务队列 AsyncTaskQueue（提取自 archetype/jhs.user.js L4831-4845 的 class ve，
 * 并扩展为可配置并发）。
 *
 * - concurrency=1：与原版等价的串行执行（前一个完成后再跑下一个）
 * - concurrency>1：最多同时执行 N 个任务，完成后从等待队列取下一个
 * 单任务抛错会被 catch 吞掉并记 clog，不中断后续任务。
 */

/**
 * 异步任务队列：支持 1..N 并发，单任务失败不中断后续任务。
 */
export class AsyncTaskQueue {
    /** 最大并发数（≥1）。 */
    private concurrency: number;
    /** 正在执行的任务数。 */
    private running = 0;
    /** 等待执行的任务队列。 */
    private pending: Array<() => unknown | Promise<unknown>> = [];
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
     * @param task 待执行任务；可为同步或异步，返回值被忽略。
     */
    addTask(task: () => unknown | Promise<unknown>): void {
        this.pending.push(task);
        this.pump();
    }

    /**
     * 等待当前已入队任务全部完成（成功或被捕获的失败）。
     * 等待期间新加入的任务也会被纳入（直到队列真正空闲）。
     */
    async waitAllFinished(): Promise<void> {
        if (this.running === 0 && this.pending.length === 0) {
            return;
        }
        return new Promise<void>((resolve) => {
            this.idleWaiters.push(resolve);
            this.pump();
        });
    }

    /** 在并发允许时从 pending 取任务启动。 */
    private pump(): void {
        while (this.running < this.concurrency && this.pending.length > 0) {
            const task = this.pending.shift()!;
            this.running++;
            Promise.resolve()
                .then(() => task())
                .catch((err: unknown) => {
                    clog.error('执行异步队列任务失败:', err);
                })
                .finally(() => {
                    this.running--;
                    this.pump();
                    this.notifyIdle();
                });
        }
        this.notifyIdle();
    }

    /** 队列空闲时唤醒 waitAllFinished。 */
    private notifyIdle(): void {
        if (this.running !== 0 || this.pending.length !== 0) return;
        const waiters = this.idleWaiters.splice(0);
        for (const w of waiters) w();
    }
}
