// @vitest-environment jsdom
/** 真实组件 + 控制器交互；网络替身不触碰网站或账户。 */
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BatchListsPicker, BatchListsProgress } from '../src/components/list-page/batch-lists-dialog';
import { LpBatchToolbar } from '../src/components/list-page/lp-batch-bar';
import { jsxToString } from '../src/core/jsx-to-string';
import { isBatchListDialogOpen, openBatchListDialog, runBatchListProgress } from '../src/plugins/list-page/batch-lists/dialog';
import type { BatchListChoice, BatchListItem, BatchListJob, BatchListProgress } from '../src/types/batch-lists';

const mocks = vi.hoisted(() => ({ choices: vi.fn(), start: vi.fn(), recover: vi.fn(), jobs: vi.fn(), running: vi.fn() }));
vi.mock('../src/plugins/list-page/batch-lists/site', () => ({ fetchBatchListChoices: mocks.choices }));
vi.mock('../src/plugins/list-page/batch-lists/journal', async (importOriginal) => ({
    ...await importOriginal<typeof import('../src/plugins/list-page/batch-lists/journal')>(),
    readBatchListJobs: mocks.jobs
}));
vi.mock('../src/plugins/list-page/batch-lists/service', () => ({
    emptyBatchListProgress: () => ({ total: 0, done: 0, succeeded: 0, failed: 0, pending: 0, phase: 'lists', current: '', ratingTotal: 0, ratingDone: 0, ratingFailed: 0 }),
    startBatchListJob: mocks.start,
    recoverBatchListJobs: mocks.recover,
    isBatchListExecutionRunning: mocks.running
}));

const items: BatchListItem[] = [{ carNum: 'ABC-001', url: '/v/demo', videoId: 'demo' }];
const choices = [{ id: '7', name: '值得复盘', url: '/lists/7' }, { id: '8', name: '等待更新', url: '/lists/8' }];
const groupedChoice: BatchListChoice = {
    id: 'group:等待更新', name: '等待更新', url: '/lists/8',
    group: { base: '等待更新', pattern: '^(.+?)(\\d+)$', excludeNames: [] },
    members: [
        { id: '8', name: '等待更新1', num: 1 },
        { id: '9', name: '等待更新2', num: 2 },
        { id: '10', name: '等待更新3', num: 3 }
    ]
};
const otherGroupedChoice: BatchListChoice = {
    id: 'group:值得复盘', name: '值得复盘', url: '/lists/11',
    group: { base: '值得复盘', pattern: '^(.+?)(\\d+)$', excludeNames: [] },
    members: [{ id: '11', name: '值得复盘1', num: 1 }, { id: '12', name: '值得复盘2', num: 2 }]
};
const done: BatchListProgress = { total: 1, done: 1, succeeded: 1, failed: 0, pending: 0, phase: 'done', current: '已同步完成', ratingTotal: 0, ratingDone: 0, ratingFailed: 0 };
const pausedJob: BatchListJob = {
    version: 2, id: 'paused-job', origin: window.location.origin, lists: [choices[1]], desiredChecked: false,
    createdAt: 1, updatedAt: 2, attempts: 1, retryAt: 0, ratingsComplete: true, paused: true,
    items: [{ ...items[0], state: 'pending', error: '', ratingsComplete: true, operations: [{ listId: choices[1].id, state: 'pending', error: '' }] }]
};

function click(action: string): void {
    document.querySelector<HTMLButtonElement>(`[data-list-act="${action}"]`)!.click();
}

function selectRating(kind: 'unchanged' | 'favorite' | 'watched', score = 0): void {
    const select = document.querySelector<HTMLSelectElement>('#jhs-batch-rating-kind')!;
    select.value = kind;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (kind === 'watched') document.querySelector<HTMLSelectElement>('#jhs-batch-rating-score')!.value = String(score);
}

function mountRatingShortcuts() {
    const toolbar = document.createElement('section');
    toolbar.innerHTML = jsxToString(createElement(LpBatchToolbar, { count: 1, busy: false }));
    const clicked = vi.fn();
    toolbar.addEventListener('click', (event) => {
        if ((event.target as Element).closest('[data-act="favorite"], [data-act="watched"]')) clicked();
    });
    document.body.appendChild(toolbar);
    return clicked;
}

async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/** 保留执行控制权，验证窗口收起与执行结算是两个独立生命周期。 */
function deferredRecovery() {
    let finish!: (progress: BatchListProgress) => void;
    let fail!: (error: Error) => void;
    const outcome = new Promise<BatchListProgress>((resolve, reject) => { finish = resolve; fail = reject; });
    const work = vi.fn((_notify: (progress: BatchListProgress) => void, _signal?: AbortSignal) => outcome);
    const closed = runBatchListProgress(work);
    const [notify, signal] = work.mock.calls[0];
    return { closed, finish, fail, work, notify, signal: signal! };
}

beforeEach(() => {
    mocks.choices.mockReset().mockResolvedValue(choices);
    mocks.start.mockReset().mockResolvedValue(done);
    mocks.recover.mockReset().mockResolvedValue(done);
    mocks.jobs.mockReset().mockReturnValue([]);
    mocks.running.mockReset().mockResolvedValue(false);
    vi.stubGlobal('clog', { error: vi.fn() });
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

afterEach(() => {
    document.querySelector<HTMLDialogElement>('dialog')?.close();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('批量清单视图', () => {
    it('入口遵守已有禁用态；目标名经过 JSX 转义', () => {
        document.body.innerHTML = jsxToString(createElement(LpBatchToolbar, { count: 0, busy: false }));
        expect(document.querySelector<HTMLButtonElement>('[data-act="lists"]')!.disabled).toBe(true);
        expect(document.querySelectorAll('[data-act="favorite"], [data-act="watched"]')).not.toHaveLength(0);
        const name = '<img onerror="x">';
        document.body.innerHTML = jsxToString(createElement(BatchListsPicker, { count: 2, choices: [{ ...choices[0], name }], loading: false, error: '' }));
        expect(document.querySelector('img')).toBeNull();
        expect(document.querySelector('.jhs-batch-lists-choice')!.textContent).toContain(name);
        expect(document.querySelector<HTMLInputElement>('input[value="add"]')!.checked).toBe(true);
        expect(document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.type).toBe('checkbox');
    });

    it('失败时保留重试，运行与停止中的按钮互斥', () => {
        const progress = { ...done, succeeded: 0, failed: 1, pending: 1, current: '保留未完成项目' };
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, { progress, running: false, error: '' }));
        expect(document.querySelector('.is-incomplete')).not.toBeNull();
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
        expect(document.querySelector('[data-list-act="close"]')).not.toBeNull();
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, { progress, running: true, error: '' }));
        expect(document.querySelector('[data-list-act="close"]')).toBeNull();
        expect(document.querySelector('[data-list-act="retry"]')).toBeNull();
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="stop"]')!.disabled).toBe(false);
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, { progress, running: true, stopping: true, error: '' }));
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="stop"]')!.disabled).toBe(true);
    });

    it('未完成操作入口与开始新任务独立；加载中不提供会被迟到目录覆盖的恢复按钮', () => {
        const props = { count: 2, choices: [], loading: false, error: '网站目录读取失败', hasRecoverable: true };
        document.body.innerHTML = jsxToString(createElement(BatchListsPicker, props));
        expect(document.querySelector('[data-list-act="resume"]')).not.toBeNull();
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="start"]')!.disabled).toBe(true);
        document.body.innerHTML = jsxToString(createElement(BatchListsPicker, { ...props, hasRecoverable: false }));
        expect(document.querySelector('[data-list-act="resume"]')).toBeNull();
        document.body.innerHTML = jsxToString(createElement(BatchListsPicker, { ...props, loading: true }));
        expect(document.querySelector('[data-list-act="resume"]')).toBeNull();
    });

    it('评价请求中的主进度仍按视频计数，评价待确认或停止时保留继续入口', () => {
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, {
            progress: { ...done, total: 5, done: 1, phase: 'ratings', ratingTotal: 5, ratingDone: 3, concurrency: 2 },
            running: true, error: ''
        }));
        const bar = document.querySelector<HTMLProgressElement>('progress')!;
        expect(bar.max).toBe(5);
        expect(bar.value).toBe(1);
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, {
            progress: { ...done, ratingPending: 1 }, running: false, error: ''
        }));
        expect(document.querySelector('.is-incomplete')).not.toBeNull();
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
        document.body.innerHTML = jsxToString(createElement(BatchListsProgress, {
            progress: { ...done, stopped: true }, running: false, error: ''
        }));
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
    });

    it('手动停止并关闭后，重新打开可按原记录继续；不把当前选择当成新任务', async () => {
        mocks.start.mockResolvedValueOnce({ ...done, succeeded: 0, pending: 1, stopped: true });
        const first = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        await flush();
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        click('close');
        await first;
        mocks.jobs.mockReturnValue([pausedJob]);
        const reopened = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('[data-list-act="resume"]')).not.toBeNull();
        // 当前选中目标与原任务不同，恢复入口仍不调用start或传入当前选择。
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"][value="7"]')!.click();
        selectRating('watched', 5);
        click('resume');
        await flush();
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();
        expect(mocks.start).toHaveBeenCalledTimes(1);
        expect(mocks.recover).toHaveBeenCalledExactlyOnceWith(expect.any(Function), true, expect.any(AbortSignal));
        click('close');
        await reopened;
    });

    it('目录加载完成前没有恢复入口；目录失败后也能继续持久化任务', async () => {
        mocks.jobs.mockReturnValue([pausedJob]);
        let fail!: (error: Error) => void;
        mocks.choices.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
        const promise = openBatchListDialog(items);
        expect(document.querySelector('[data-list-act="resume"]')).toBeNull();
        fail(new Error('网站未登录'));
        await flush();
        expect(document.querySelector('[role="alert"]')!.textContent).toContain('网站未登录');
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="start"]')!.disabled).toBe(true);
        expect(document.querySelector<HTMLSelectElement>('#jhs-batch-rating-kind')!.disabled).toBe(true);
        click('resume');
        await flush();
        expect(mocks.recover).toHaveBeenCalledExactlyOnceWith(expect.any(Function), true, expect.any(AbortSignal));
        expect(mocks.start).not.toHaveBeenCalled();
        click('close');
        await promise;
    });

    it.each([false, true])('同源执行锁仍被持有时不把未完成记录当成中断（目录失败：%s）', async (loadError) => {
        mocks.jobs.mockReturnValue([pausedJob]);
        mocks.running.mockResolvedValue(true);
        if (loadError) mocks.choices.mockRejectedValueOnce(new Error('未登录'));
        const first = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('[data-list-act="resume"]')).toBeNull();
        expect(mocks.recover).not.toHaveBeenCalled();
        click('close');
        await first;
        mocks.running.mockResolvedValue(false);
        const reopened = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('[data-list-act="resume"]')).not.toBeNull();
        click('close');
        await reopened;
    });

    it('逻辑组只展示聚合名称；按详情配置未合并的单项保持原名', () => {
        document.body.innerHTML = jsxToString(createElement(BatchListsPicker, {
            count: 3, choices: [groupedChoice, { id: '11', name: '排除清单1', url: '/lists/11' }], loading: false, error: ''
        }));
        const names = Array.from(document.querySelectorAll('.jhs-batch-lists-choice'), (row) => row.textContent);
        expect(names[0]).toContain(groupedChoice.name);
        for (const member of groupedChoice.members!) expect(names[0]).not.toContain(member.name);
        expect(names[1]).toContain('排除清单1');
        expect(document.querySelectorAll('input[name="jhs-batch-list-choice"][type="checkbox"]')).toHaveLength(2);
        expect(document.querySelector('details')).toBeNull();
    });

    it('逻辑组搜索、选中摘要及加入/移出说明均不展开成员，提交完整组目标', async () => {
        mocks.choices.mockResolvedValueOnce([choices[0], groupedChoice]);
        const promise = openBatchListDialog(items);
        await flush();
        const checkbox = document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"][value="group:等待更新"]')!;
        checkbox.click();
        expect(document.querySelector('[data-role="selected-target"]')!.textContent).toContain(groupedChoice.name);
        const behavior = document.querySelector<HTMLElement>('[data-role="group-behavior"]')!;
        expect(behavior.hidden).toBe(false);
        const addDescription = behavior.textContent;
        const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = '等待更新';
        search.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.jhs-batch-lists-choice:not([hidden])')).toHaveLength(1);
        for (const member of groupedChoice.members!) expect(document.body.innerHTML).not.toContain(member.name);
        document.querySelector<HTMLInputElement>('input[value="remove"]')!.click();
        expect(behavior.hidden).toBe(false);
        expect(behavior.textContent).not.toBe(addDescription);
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledWith(items, [groupedChoice], false, expect.any(Function), expect.any(AbortSignal));
        click('close');
        await promise;
    });

    it('跨搜索筛选可同时选择两个组，摘要保留数量与名称，并只提交一个任务', async () => {
        mocks.choices.mockResolvedValueOnce([groupedChoice, otherGroupedChoice]);
        const promise = openBatchListDialog(items);
        await flush();
        const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
        const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="jhs-batch-list-choice"]'));
        const summary = document.querySelector('[data-role="selected-target"]')!;
        search.value = groupedChoice.name;
        search.dispatchEvent(new Event('input'));
        checkboxes[0].click();
        search.value = otherGroupedChoice.name;
        search.dispatchEvent(new Event('input'));
        checkboxes[1].click();
        expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, true]);
        expect(document.querySelectorAll('.jhs-batch-lists-choice:not([hidden])')).toHaveLength(1);
        expect(summary.textContent).toContain('2');
        expect(summary.textContent).toContain(groupedChoice.name);
        expect(summary.textContent).toContain(otherGroupedChoice.name);
        search.value = '';
        search.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.jhs-batch-lists-choice:not([hidden])')).toHaveLength(2);
        checkboxes[0].click();
        expect(summary.textContent).not.toContain(groupedChoice.name);
        checkboxes[0].click();
        selectRating('watched', 5);
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledExactlyOnceWith(items, [groupedChoice, otherGroupedChoice], true, expect.any(Function), expect.any(AbortSignal), { kind: 'watched', score: 5 });
        click('close');
        await promise;
    });

    it('必须选择目标；搜索不丢选择，移出动作传入 false', async () => {
        const promise = openBatchListDialog(items);
        await flush();
        expect(isBatchListDialogOpen()).toBe(true);
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="start"]')!.disabled).toBe(true);
        const checkbox = document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"][value="8"]')!;
        checkbox.click();
        const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = '复盘';
        search.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.jhs-batch-lists-choice[hidden]')).toHaveLength(1);
        expect(checkbox.checked).toBe(true);
        document.querySelector<HTMLInputElement>('input[value="remove"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledWith(items, [choices[1]], false, expect.any(Function), expect.any(AbortSignal));
        click('close');
        await promise;
        expect(isBatchListDialogOpen()).toBe(false);
    });

    it('默认不修改评价，只提交一次清单任务；已读星级初始隐藏', async () => {
        const promise = openBatchListDialog(items);
        await flush();
        expect(document.querySelector<HTMLSelectElement>('#jhs-batch-rating-kind')!.value).toBe('unchanged');
        expect(document.querySelector<HTMLElement>('.jhs-batch-lists-rating-score')!.hidden).toBe(true);
        expect(document.querySelector<HTMLSelectElement>('#jhs-batch-rating-score')!.disabled).toBe(true);
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledExactlyOnceWith(items, [choices[0]], true, expect.any(Function), expect.any(AbortSignal));
        click('close');
        await promise;
    });

    it('显式收藏与聚合清单一次提交，不触发原工具栏快捷收藏', async () => {
        mocks.choices.mockResolvedValueOnce([groupedChoice]);
        const shortcuts = mountRatingShortcuts();
        const promise = openBatchListDialog(items);
        await flush();
        selectRating('favorite');
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledExactlyOnceWith(items, [groupedChoice], true, expect.any(Function), expect.any(AbortSignal), { kind: 'favorite', score: 0 });
        expect(shortcuts).not.toHaveBeenCalled();
        click('close');
        await promise;
    });

    it('显式已读5星与移出清单一次提交；切回不修改不会携带隐藏星级', async () => {
        const shortcuts = mountRatingShortcuts();
        const promise = openBatchListDialog(items);
        await flush();
        selectRating('watched', 5);
        expect(document.querySelector<HTMLElement>('.jhs-batch-lists-rating-score')!.hidden).toBe(false);
        const scores = document.querySelectorAll<HTMLOptionElement>('#jhs-batch-rating-score option');
        expect(Array.from(scores, (option) => option.value)).toEqual(['0', '1', '2', '3', '4', '5']);
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        document.querySelector<HTMLInputElement>('input[value="remove"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledExactlyOnceWith(items, [choices[0]], false, expect.any(Function), expect.any(AbortSignal), { kind: 'watched', score: 5 });
        expect(shortcuts).not.toHaveBeenCalled();
        click('close');
        await promise;

        mocks.start.mockClear();
        const next = openBatchListDialog(items);
        await flush();
        selectRating('watched', 5);
        selectRating('unchanged');
        expect(document.querySelector<HTMLElement>('.jhs-batch-lists-rating-score')!.hidden).toBe(true);
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledExactlyOnceWith(items, [choices[0]], true, expect.any(Function), expect.any(AbortSignal));
        click('close');
        await next;
    });

    it('运行时 Escape 请求停止，但当前请求结算前不关闭；保留离页提示', async () => {
        let finish!: (result: BatchListProgress) => void;
        mocks.start.mockReturnValue(new Promise<BatchListProgress>((resolve) => { finish = resolve; }));
        const promise = openBatchListDialog(items);
        await flush();
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        dialog.dispatchEvent(esc);
        expect(esc.defaultPrevented).toBe(true);
        expect(mocks.start.mock.calls[0][4].aborted).toBe(true);
        const cancel = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(dialog.open).toBe(true);
        const unload = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unload);
        expect(unload.defaultPrevented).toBe(true);
        dialog.close();
        expect(dialog.open).toBe(true);
        finish(done);
        await flush();
        click('close');
        await promise;
        const after = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
    });

    it('停止按钮只发一次停止信号；当前回执后保留成功计数，再手动继续使用新的信号', async () => {
        let finish!: (result: BatchListProgress) => void;
        let notify!: (progress: BatchListProgress) => void;
        let stopEvents = 0;
        const initial: BatchListProgress = { ...done, total: 3, done: 1, succeeded: 1, pending: 2, phase: 'lists', current: '等待当前网站响应' };
        mocks.start.mockImplementation((_items, _choice, _desired, onProgress, signal: AbortSignal) => {
            notify = onProgress;
            notify(initial);
            signal.addEventListener('abort', () => { stopEvents++; });
            return new Promise<BatchListProgress>((resolve) => { finish = resolve; });
        });
        const promise = openBatchListDialog(items);
        await flush();
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        const signal = mocks.start.mock.calls[0][4] as AbortSignal;
        expect(signal.aborted).toBe(false);
        click('stop');
        expect(signal.aborted).toBe(true);
        click('stop');
        expect(stopEvents).toBe(1);
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="stop"]')!.disabled).toBe(true);
        expect(document.querySelector('[data-list-act="close"]')).toBeNull();
        expect(isBatchListDialogOpen()).toBe(true);
        // 已发出请求随后确认成功，停止状态也必须接纳真实回执。
        const confirmed = { ...initial, done: 2, succeeded: 2, pending: 1 };
        notify(confirmed);
        expect(document.querySelector('.jhs-batch-lists-summary dd')!.textContent).toBe('2');
        finish({ ...confirmed, phase: 'done', stopped: true });
        await flush();
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
        expect(document.querySelector('[data-list-act="stop"]')).toBeNull();
        expect(mocks.recover).not.toHaveBeenCalled();
        click('retry');
        await flush();
        const nextSignal = mocks.recover.mock.calls[0][2] as AbortSignal;
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();
        expect(nextSignal).not.toBe(signal);
        expect(nextSignal.aborted).toBe(false);
        expect(mocks.recover).toHaveBeenCalledWith(expect.any(Function), true, nextSignal);
        click('close');
        await promise;
    });

    it('清单加载失败不允许开始，取消等待不需要等网络结束', async () => {
        mocks.choices.mockRejectedValueOnce(new Error('未登录'));
        const first = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('[role="alert"]')!.textContent).toContain('未登录');
        expect(document.querySelector<HTMLButtonElement>('[data-list-act="start"]')!.disabled).toBe(true);
        click('close');
        await first;
        mocks.choices.mockReturnValueOnce(new Promise(() => undefined));
        const second = openBatchListDialog(items);
        click('close');
        await second;
        expect(isBatchListDialogOpen()).toBe(false);
        expect(mocks.start).not.toHaveBeenCalled();
    });

    it('恢复异常显示失败且支持立即重试，不抛成未处理拒绝', async () => {
        const promise = runBatchListProgress(async () => { throw new Error('存储未提交'); });
        await flush();
        expect(document.querySelector('[role="alert"]')!.textContent).toContain('存储未提交');
        click('retry');
        await flush();
        expect(mocks.recover).toHaveBeenCalledWith(expect.any(Function), true, expect.any(AbortSignal));
        click('close');
        await promise;
    });

    it('恢复进度最小化后继续执行并释放页面交互，保留离页提示和活跃窗口保护', async () => {
        const input = document.createElement('input');
        const pageAction = document.createElement('button');
        const onPageClick = vi.fn();
        pageAction.addEventListener('click', onPageClick);
        document.body.append(input, pageAction);
        const task = deferredRecovery();
        const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
        const floating = document.querySelector<HTMLButtonElement>('.jhs-batch-lists-floating')!;
        let closed = false;
        void task.closed.then(() => { closed = true; });
        expect(floating.hidden).toBe(true);
        task.notify({ ...done, total: 3, done: 1, succeeded: 1, pending: 2, phase: 'lists' });
        click('minimize');
        expect(dialog.open).toBe(false);
        expect(floating.hidden).toBe(false);
        expect(isBatchListDialogOpen()).toBe(true);
        expect(task.signal.aborted).toBe(false);
        input.focus();
        pageAction.click();
        expect(onPageClick).toHaveBeenCalledOnce();
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        input.dispatchEvent(esc);
        expect(esc.defaultPrevented).toBe(false);
        expect(task.signal.aborted).toBe(false);
        const unload = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unload);
        expect(unload.defaultPrevented).toBe(true);
        task.notify({ ...done, total: 3, done: 2, succeeded: 2, pending: 1, phase: 'lists' });
        expect(floating.textContent).toMatch(/2\s*\/\s*3/);
        expect(document.activeElement).toBe(input);

        const extraWork = vi.fn().mockResolvedValue(done);
        const duplicate = runBatchListProgress(extraWork);
        await flush();
        expect(extraWork).not.toHaveBeenCalled();
        expect(mocks.choices).not.toHaveBeenCalled();
        expect(document.querySelectorAll('dialog')).toHaveLength(1);
        expect(document.querySelectorAll('.jhs-batch-lists-floating')).toHaveLength(1);
        expect(closed).toBe(false);
        task.finish({ ...done, total: 3, done: 3, succeeded: 3 });
        await flush();
        expect(closed).toBe(false);
        expect(dialog.open).toBe(false);
        expect(document.activeElement).toBe(input);
        expect(floating.classList.contains('is-unread')).toBe(true);
        expect(floating.textContent).toContain('同步完成');
        const after = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
        click('restore');
        expect(dialog.open).toBe(true);
        expect(floating.hidden).toBe(true);
        expect(floating.classList.contains('is-unread')).toBe(false);
        expect(task.work).toHaveBeenCalledOnce();
        expect(document.querySelector<HTMLProgressElement>('progress')!.value).toBe(3);
        click('close');
        await Promise.all([task.closed, duplicate]);
        expect(isBatchListDialogOpen()).toBe(false);
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();
    });

    it.each([false, true])('主动入口展开同一个恢复窗口，不创建任务；关闭后新任务仍不可最小化（已结算：%s）', async (settled) => {
        const task = deferredRecovery();
        const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
        const floating = document.querySelector<HTMLButtonElement>('.jhs-batch-lists-floating')!;
        task.notify({ ...done, total: 3, done: 1, succeeded: 1, pending: 2, phase: 'lists' });
        click('minimize');
        if (settled) { task.finish(done); await flush(); }
        const manualOpen = openBatchListDialog(items);
        expect(document.querySelector('dialog')).toBe(dialog);
        expect(dialog.open).toBe(true);
        expect(floating.hidden).toBe(true);
        expect(floating.classList.contains('is-unread')).toBe(false);
        expect(task.signal.aborted).toBe(false);
        expect(task.work).toHaveBeenCalledOnce();
        expect(mocks.choices).not.toHaveBeenCalled();
        expect(mocks.start).not.toHaveBeenCalled();
        expect(mocks.recover).not.toHaveBeenCalled();
        if (!settled) { task.finish(done); await flush(); }
        click('close');
        await Promise.all([task.closed, manualOpen]);
        expect(isBatchListDialogOpen()).toBe(false);
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();

        const next = openBatchListDialog(items);
        await flush();
        expect(document.querySelector('dialog')).not.toBe(dialog);
        expect(mocks.choices).toHaveBeenCalledOnce();
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        document.querySelector<HTMLInputElement>('input[name="jhs-batch-list-choice"]')!.click();
        click('start');
        await flush();
        expect(mocks.start).toHaveBeenCalledOnce();
        expect(document.querySelector('[data-list-act="minimize"]')).toBeNull();
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();
        click('close');
        await next;
    });

    it.each([false, true])('迟到的最小化 close 事件不会停止或移除已经展开的窗口（已结算：%s）', async (settled) => {
        const closeEvents: (() => void)[] = [];
        HTMLDialogElement.prototype.close = function () {
            this.open = false;
            closeEvents.push(() => this.dispatchEvent(new Event('close')));
        };
        const task = deferredRecovery();
        const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
        // 两轮快速收起/展开，模拟浏览器尚未派发 close 的时序。
        for (let count = 0; count < 2; count++) {
            click('minimize');
            click('restore');
        }
        expect(closeEvents).toHaveLength(2);
        if (settled) { task.finish(done); await flush(); }
        closeEvents.splice(0).forEach((dispatch) => dispatch());
        expect(task.signal.aborted).toBe(false);
        expect(dialog.open).toBe(true);
        expect(dialog.isConnected).toBe(true);
        expect(isBatchListDialogOpen()).toBe(true);
        expect(task.work).toHaveBeenCalledOnce();
        if (!settled) { task.finish(done); await flush(); }
        click('close');
        closeEvents.splice(0).forEach((dispatch) => dispatch());
        await task.closed;
        expect(document.querySelector('.jhs-batch-lists-floating')).toBeNull();
    });

    it.each([
        ['部分失败', { ...done, succeeded: 0, failed: 1, pending: 1 }, '仍有项目待完成'],
        ['评价待确认', { ...done, ratingPending: 1 }, '仍有项目待完成'],
        ['手动停止', { ...done, stopped: true, pending: 1 }, '已停止']
    ] as const)('最小化的%s结算保留真实状态，展开后可以继续', async (_scenario, result, label) => {
        const task = deferredRecovery();
        click('minimize');
        task.finish(result);
        await flush();
        const floating = document.querySelector<HTMLButtonElement>('.jhs-batch-lists-floating')!;
        expect(floating.textContent).toContain(label);
        expect(floating.textContent).not.toContain('同步完成');
        expect(floating.classList.contains('is-unread')).toBe(true);
        click('restore');
        expect(floating.classList.contains('is-unread')).toBe(false);
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
        click('retry');
        await flush();
        expect(mocks.recover).toHaveBeenCalledExactlyOnceWith(expect.any(Function), true, expect.any(AbortSignal));
        expect(document.querySelector('[data-list-act="minimize"]')).not.toBeNull();
        click('close');
        await task.closed;
    });

    it('最小化期间异常不会伪报完成或抢焦点，展开可见错误与最后计数', async () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const task = deferredRecovery();
        task.notify({ ...done, total: 3, done: 1, succeeded: 1, pending: 2, phase: 'lists' });
        click('minimize');
        input.focus();
        task.fail(new Error('日志写入失败'));
        await flush();
        const floating = document.querySelector<HTMLButtonElement>('.jhs-batch-lists-floating')!;
        expect(floating.classList.contains('is-unread')).toBe(true);
        expect(floating.textContent).toContain('仍有项目待完成');
        expect(document.activeElement).toBe(input);
        expect(document.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
        click('restore');
        expect(document.querySelector('[role="alert"]')!.textContent).toContain('日志写入失败');
        expect(document.querySelector<HTMLProgressElement>('progress')!.value).toBe(1);
        expect(document.querySelector('[data-list-act="retry"]')).not.toBeNull();
        click('close');
        await task.closed;
    });
});
