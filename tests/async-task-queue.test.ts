/**
 * AsyncTaskQueue 回归测试（doc/26）。
 *
 * 覆盖：并发上限、单任务抛错不中断、句柄快照、取消（等待中/执行中）、置顶。
 * 模块内 `clog.error` 是全局对象（main.tsx 注入），测试里以 stub 提供。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncTaskQueue } from '../src/core/async-task-queue';

/** 建一个可手动兑现的 Promise（用于精确控制并发时序）。 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

/** 让微任务队列跑空（等待 pump 的 then/finally 链推进）。 */
const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 0));

describe('AsyncTaskQueue', () => {
    beforeEach(() => {
        vi.stubGlobal('clog', { error: vi.fn() });
    });

    it('concurrency=1 时严格串行（保序）', async () => {
        const queue = new AsyncTaskQueue(1);
        const order: string[] = [];
        queue.addTask(async () => {
            await tick();
            order.push('a');
        });
        queue.addTask(() => {
            order.push('b');
        });
        await queue.waitAllFinished();
        expect(order).toEqual(['a', 'b']);
    });

    it('concurrency=2 时并行启动（第二个不必等第一个结束）', async () => {
        const queue = new AsyncTaskQueue(2);
        const first = deferred();
        let started = 0;
        queue.addTask(async () => {
            started++;
            await first.promise;
        });
        queue.addTask(() => {
            started++;
        });
        await tick();
        expect(started).toBe(2);
        first.resolve();
        await queue.waitAllFinished();
    });

    it('并发数之外的任务留在等待队列', async () => {
        const queue = new AsyncTaskQueue(1);
        const first = deferred();
        queue.addTask(() => first.promise, 'a');
        queue.addTask(() => undefined, 'b');
        await tick();
        expect(queue.getTasks().map((t) => `${t.key}:${t.state}`)).toEqual(['a:running', 'b:pending']);
        first.resolve();
        await queue.waitAllFinished();
        expect(queue.getTasks()).toEqual([]);
    });

    it('单任务抛错被吞掉且不中断后续任务', async () => {
        const queue = new AsyncTaskQueue(1);
        const ran: string[] = [];
        queue.addTask(() => {
            throw new Error('boom');
        });
        queue.addTask(() => {
            ran.push('after');
        });
        await queue.waitAllFinished();
        expect(ran).toEqual(['after']);
    });

    it('取消等待中的任务：该任务永不出队执行', async () => {
        const queue = new AsyncTaskQueue(1);
        const first = deferred();
        const ran: string[] = [];
        queue.addTask(() => first.promise, 'a');
        queue.addTask(() => {
            ran.push('b');
        }, 'b');
        expect(queue.cancel('b')).toBe(true);
        first.resolve();
        await queue.waitAllFinished();
        expect(ran).toEqual([]);
    });

    it('取消执行中的任务：仅置标记，任务闭包可自检', async () => {
        const queue = new AsyncTaskQueue(1);
        let sawCancelled = false;
        queue.addTask(async (handle) => {
            await tick();
            sawCancelled = handle.isCancelled();
        }, 'a');
        queue.cancel('a');
        await queue.waitAllFinished();
        expect(sawCancelled).toBe(true);
    });

    it('取消不存在的键返回 false', async () => {
        const queue = new AsyncTaskQueue(1);
        expect(queue.cancel('nope')).toBe(false);
        expect(queue.prioritize('nope')).toBe(false);
    });

    it('置顶把等待中的任务提到队首', async () => {
        const queue = new AsyncTaskQueue(1);
        const first = deferred();
        const order: string[] = [];
        queue.addTask(() => first.promise, 'running');
        queue.addTask(() => {
            order.push('b');
        }, 'b');
        queue.addTask(() => {
            order.push('c');
        }, 'c');
        expect(queue.prioritize('c')).toBe(true);
        expect(queue.getTasks().map((t) => t.key)).toEqual(['running', 'c', 'b']);
        first.resolve();
        await queue.waitAllFinished();
        expect(order).toEqual(['c', 'b']);
    });

    it('waitAllFinished 在空队列上立即返回', async () => {
        await expect(new AsyncTaskQueue(1).waitAllFinished()).resolves.toBeUndefined();
    });

    it('setConcurrency 提升后立刻启动等待中的任务', async () => {
        const queue = new AsyncTaskQueue(1);
        const first = deferred();
        let startedSecond = false;
        queue.addTask(() => first.promise);
        queue.addTask(() => {
            startedSecond = true;
        });
        await tick();
        expect(startedSecond).toBe(false);
        queue.setConcurrency(2);
        await tick();
        expect(startedSecond).toBe(true);
        first.resolve();
        await queue.waitAllFinished();
    });
});
