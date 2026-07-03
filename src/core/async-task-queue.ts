/**
 * 异步任务队列 AsyncTaskQueue（提取自 archetype/jhs.user.js L4831-4845 的 class ve）
 *
 * 将多个异步任务串行化执行：每个新任务都会接到当前队列尾部，前一个任务
 * 完成（成功或失败被捕获）后才会执行下一个。单个任务抛错会被 catch 吞掉
 * 并记录到 clog，不会中断后续任务。
 *
 * 重构说明（JS→TS，行为等价）：
 * - 类名 ve → AsyncTaskQueue
 * - 单字母参数 e（任务函数）→ task；catch 形参 e（原与外层 e 同名遮蔽）→ err
 * - 私有字段 this.queue → class field
 * - 控制流原样保留：addTask 仍为 `this.queue = this.queue.then(task).catch(log)`
 * - 全局 clog 由 src/types/globals.d.ts 声明为 any，本模块直接使用
 */

/**
 * 异步任务队列：串行执行入队任务，单任务失败不中断后续任务。
 */
export class AsyncTaskQueue {
    /** 当前队列尾部的 Promise，新任务接到其后；初始为已完成的空 Promise。 */
    private queue: Promise<unknown>;

    /**
     * 构造空队列。
     */
    constructor() {
        this.queue = Promise.resolve();
    }

    /**
     * 向队列尾部追加一个任务，按入队顺序串行执行。
     * 任务抛出的错误会被捕获并记录到 clog，不会中断后续任务。
     *
     * @param task 待执行任务；可为同步或异步（返回 Promise），返回值被忽略。
     */
    addTask(task: () => unknown | Promise<unknown>): void {
        this.queue = this.queue
            .then(() => task())
            .catch((err: unknown) => {
                clog.error("执行异步队列任务失败:", err);
            });
    }

    /**
     * 等待当前已入队的所有任务全部完成（成功或被捕获的失败）。
     * 后续新加入的任务不在此等待范围内。
     *
     * @returns 队列当前尾部的 Promise。
     */
    async waitAllFinished(): Promise<unknown> {
        return this.queue;
    }
}
