import { jsxToString } from '../../../core/jsx-to-string';
import type { BatchListChoice, BatchListItem, BatchListProgress, BatchRatingChoice } from '../../../types/batch-lists';

import { emptyBatchListProgress, isBatchListExecutionRunning, recoverBatchListJobs, startBatchListJob } from './service';
import { fetchBatchListChoices } from './site';
import { isBatchListJobPending, readBatchListJobs } from './journal';

import { BatchListsDialogShell, BatchListsPicker, BatchListsProgress } from '../../../components/list-page/batch-lists-dialog';

import batchListsCss from '../../../styles/list-page/batch-lists.css?raw';

let activeDialog: HTMLDialogElement | null = null;
let activePromise: Promise<void> | null = null;

export function isBatchListDialogOpen(): boolean {
    return activeDialog?.isConnected === true;
}

/** 活跃页面拥有执行锁时不提供恢复入口；手动停止的任务仍可继续。 */
async function hasRecoverableJobs(): Promise<boolean> {
    try {
        if (await isBatchListExecutionRunning()) return false;
        return readBatchListJobs().some(isBatchListJobPending);
    } catch (error: unknown) {
        clog.error('[批量清单] 无法读取未完成操作', error);
        return false;
    }
}

/** 仅把用户本轮显式选择的评价交给组合任务，不触发旧快捷评价路径。 */
function readSelectedRating(container: HTMLElement): BatchRatingChoice | undefined {
    const kind = container.querySelector<HTMLSelectElement>('#jhs-batch-rating-kind')?.value;
    if (kind === 'favorite') return { kind, score: 0 };
    if (kind === 'watched') {
        const score = Number(container.querySelector<HTMLSelectElement>('#jhs-batch-rating-score')?.value ?? 0);
        return { kind, score };
    }
    return undefined;
}

/** 搜索仅隐藏目录行，所有勾选仍保留并作为同一个任务提交。 */
function readSelectedLists(container: HTMLElement, choices: BatchListChoice[]): BatchListChoice[] {
    const selectedIds = new Set(Array.from(
        container.querySelectorAll<HTMLInputElement>('input[name="jhs-batch-list-choice"]:checked'),
        (input) => input.value
    ));
    return choices.filter((choice) => selectedIds.has(choice.id));
}

/** 使用浏览器模态层保护焦点，不受 layer 全局关闭逻辑影响。 */
function createDialog(title: string) {
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) {
        throw new Error('当前浏览器不支持模态对话框，无法安全显示批量执行进度');
    }
    if (!document.getElementById('jhs-batch-lists-style')) {
        const style = document.createElement('style');
        style.id = 'jhs-batch-lists-style';
        style.textContent = batchListsCss;
        document.head.appendChild(style);
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'jhs-batch-lists-dialog jhs-scrollbar';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'jhs-batch-list-title');
    dialog.innerHTML = jsxToString(<BatchListsDialogShell title={title} />);
    const body = dialog.querySelector<HTMLElement>('[data-role="batch-list-body"]')!;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let running = false;
    let requestStop = (): void => undefined;
    let resolveClosed: () => void = () => undefined;
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    const beforeUnload = (event: BeforeUnloadEvent): void => {
        if (!running) return;
        event.preventDefault();
        event.returnValue = '';
    };
    const close = (): void => {
        if (running) requestStop();
        else dialog.close();
    };
    const onEscape = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return;
        // window 捕获先于项目既有的 document 捕获关闭器，避免关掉底下的 layer。
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
    };
    window.addEventListener('keydown', onEscape, true);
    window.addEventListener('beforeunload', beforeUnload);
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('click', (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-list-act="stop"]');
        if (button && !button.disabled && running) requestStop();
    });
    dialog.addEventListener('close', () => {
        // 手动关闭也仅请求停止后续执行；保留遮罩直到已发出的请求完成确认。
        if (running && dialog.isConnected) {
            requestStop();
            dialog.showModal();
            return;
        }
        window.removeEventListener('keydown', onEscape, true);
        window.removeEventListener('beforeunload', beforeUnload);
        dialog.remove();
        if (activeDialog === dialog) activeDialog = null;
        activePromise = null;
        returnFocus?.focus();
        resolveClosed();
    });
    document.body.appendChild(dialog);
    activeDialog = dialog;
    dialog.showModal();
    return {
        dialog, body, closed, close,
        isRunning: (): boolean => running,
        setStopHandler: (handler: () => void): void => { requestStop = handler; },
        setRunning: (value: boolean): void => { running = value; }
    };
}

/** 本轮错误保留最后已观察到的计数，不把异常包装成完成。 */
async function executeInDialog(
    view: ReturnType<typeof createDialog>,
    work: (notify: (progress: BatchListProgress) => void, signal?: AbortSignal) => Promise<BatchListProgress>
): Promise<void> {
    if (view.isRunning()) return;
    view.setRunning(true);
    const controller = new AbortController();
    let stopping = false;
    let progress = emptyBatchListProgress();
    const render = (running: boolean, error = ''): void => {
        view.body.innerHTML = jsxToString(<BatchListsProgress progress={progress} running={running} stopping={stopping} error={error} />);
    };
    view.setStopHandler(() => {
        if (controller.signal.aborted) return;
        stopping = true;
        controller.abort();
        render(true);
        view.dialog.focus();
    });
    render(true);
    view.dialog.focus();
    let errorText = '';
    try {
        progress = await work((value) => { progress = value; render(true); }, controller.signal);
    } catch (error: unknown) {
        errorText = '执行未完成：' + (error instanceof Error ? error.message : String(error));
        clog.error('[批量清单] 执行未完成', error);
    } finally {
        view.setRunning(false);
        view.setStopHandler(() => undefined);
        render(false, errorText);
        view.body.querySelector<HTMLButtonElement>('[data-list-act="close"]')?.focus();
    }
}

/** 手动与自动恢复共用同一阻塞式进度视图。 */
export async function runBatchListProgress(
    work: (notify: (progress: BatchListProgress) => void, signal?: AbortSignal) => Promise<BatchListProgress>,
    title = '恢复批量清单操作'
): Promise<void> {
    if (isBatchListDialogOpen()) return activePromise ?? Promise.resolve();
    const view = createDialog(title);
    activePromise = view.closed;
    view.dialog.addEventListener('click', (event) => {
        const action = (event.target as Element).closest<HTMLElement>('[data-list-act]')?.dataset.listAct;
        if (action === 'close') view.close();
        if (action === 'retry') void executeInDialog(view, (notify, signal) => recoverBatchListJobs(notify, true, signal));
    });
    await executeInDialog(view, work);
    await view.closed;
}

export async function openBatchListDialog(items: BatchListItem[]): Promise<void> {
    if (isBatchListDialogOpen()) return activePromise ?? Promise.resolve();
    if (items.length === 0 || !items[0].videoId) throw new Error('请先选择具有有效影片信息的视频');
    const view = createDialog('批量设置评价与清单');
    activePromise = view.closed;
    view.body.innerHTML = jsxToString(<BatchListsPicker count={items.length} choices={[]} loading error="" />);
    view.dialog.addEventListener('click', (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-list-act]');
        if (!button || button.disabled) return;
        if (button.dataset.listAct === 'close') view.close();
        if (button.dataset.listAct === 'resume' || button.dataset.listAct === 'retry') {
            if (button.dataset.listAct === 'resume') view.dialog.querySelector('h2')!.textContent = '继续未完成操作';
            void executeInDialog(view, (notify, signal) => recoverBatchListJobs(notify, true, signal));
        }
    });
    try {
        const choices = await Promise.race([
            fetchBatchListChoices(items[0].videoId),
            view.closed.then(() => null)
        ]);
        if (!choices || !view.dialog.isConnected) return;
        const hasRecoverable = await hasRecoverableJobs();
        if (!view.dialog.isConnected) return;
        view.body.innerHTML = jsxToString(<BatchListsPicker count={items.length} choices={choices} loading={false} error="" hasRecoverable={hasRecoverable} />);
        const search = view.body.querySelector<HTMLInputElement>('#jhs-batch-list-search')!;
        const start = view.body.querySelector<HTMLButtonElement>('[data-list-act="start"]')!;
        const rows = Array.from(view.body.querySelectorAll<HTMLElement>('.jhs-batch-lists-choice'));
        const choiceNames = new Map(choices.map((choice) => [choice.id, choice.name.toLocaleLowerCase()]));
        search.addEventListener('input', () => {
            const query = search.value.trim().toLocaleLowerCase();
            rows.forEach((row) => {
                const id = row.querySelector<HTMLInputElement>('input')?.value ?? '';
                row.hidden = !(choiceNames.get(id) ?? '').includes(query);
            });
            const noMatches = view.body.querySelector<HTMLElement>('[data-role="no-matches"]')!;
            noMatches.hidden = rows.some((row) => !row.hidden);
        });
        view.body.addEventListener('change', () => {
            const watched = view.body.querySelector<HTMLSelectElement>('#jhs-batch-rating-kind')?.value === 'watched';
            const scoreRow = view.body.querySelector<HTMLElement>('.jhs-batch-lists-rating-score');
            const score = view.body.querySelector<HTMLSelectElement>('#jhs-batch-rating-score');
            if (scoreRow) scoreRow.hidden = !watched;
            if (score) score.disabled = !watched;
            const selected = readSelectedLists(view.body, choices);
            start.disabled = selected.length === 0;
            const target = view.body.querySelector<HTMLElement>('[data-role="selected-target"]');
            if (target) target.textContent = selected.length > 0
                ? `已选 ${selected.length} 个清单：${selected.map((choice) => choice.name).join('、')}`
                : '尚未选择清单';
            const groups = selected.filter((choice) => choice.group);
            const behavior = view.body.querySelector<HTMLElement>('[data-role="group-behavior"]');
            if (behavior) {
                behavior.hidden = groups.length === 0;
                const removing = view.body.querySelector<HTMLInputElement>('input[name="jhs-batch-list-direction"]:checked')?.value === 'remove';
                behavior.textContent = groups.length === 0 ? '' : removing
                    ? `所选 ${groups.length} 个清单组分别移出组内已关联的清单。`
                    : `所选 ${groups.length} 个清单组分别自动分配到可用清单，全部满员时自动续建。`;
            }
        });
        view.dialog.addEventListener('click', (event) => {
            const action = (event.target as Element).closest<HTMLElement>('[data-list-act]')?.dataset.listAct;
            if (action !== 'start' || start.disabled) return;
            const selected = readSelectedLists(view.body, choices);
            if (selected.length === 0) return;
            const desired = view.body.querySelector<HTMLInputElement>('input[name="jhs-batch-list-direction"]:checked')?.value !== 'remove';
            const rating = readSelectedRating(view.body);
            start.disabled = true;
            void executeInDialog(view, (notify, signal) => rating
                ? startBatchListJob(items, selected, desired, notify, signal, rating)
                : startBatchListJob(items, selected, desired, notify, signal));
        });
        search.focus();
    } catch (error: unknown) {
        const hasRecoverable = await hasRecoverableJobs();
        if (view.dialog.isConnected) {
            view.body.innerHTML = jsxToString(<BatchListsPicker count={items.length} choices={[]} loading={false} error={'无法读取网站清单：' + (error instanceof Error ? error.message : String(error))} hasRecoverable={hasRecoverable} />);
        }
    }
    await view.closed;
}
