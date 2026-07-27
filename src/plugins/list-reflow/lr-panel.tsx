/**
 * 编号清单整理面板挂载与交互（doc/202 期1 + doc/204 期2a/2b/2c）。
 *
 * 在 /lists/{id} 清单页注入 ReflowPanel 外壳，按需：
 * - 「识别编号组」→ 抓 /users/lists 发现同 base 编号组，渲染各清单数量/满员行。
 * - 「生成整理计划」→ 枚举组内影片 + 规划，渲染只读压实预览（lr-plan）。
 * - 「执行整理」→ 期2a 先加后删写路径 + 试运行闸。
 * - 「继续上次整理」→ 期2b 恢复日志续传。
 * - 「撤销本次整理」→ 期2b 回滚日志逆序反向搬运。
 * - 进度条 + 汇总报告 → 期2c 体验层。
 */
import { jsxToString } from '../../core/jsx-to-string';

import { LIST_FULL_THRESHOLD } from '../detail-page-button/dpb-list-merge';
import type { ListMergeConfig } from '../detail-page-button/dpb-list-merge';
import { discoverGroup, fetchAllUserLists, getCurrentListId } from './lr-data';
import { executeCompactionPlan, undoSession } from './lr-execute';
import type { ExecuteResult } from './lr-execute';
import { hasResumableJournal, loadJournal, clearJournal } from './lr-journal';
import { runPlanPreview } from './lr-plan';
import type { CompactionPlan, ReflowGroup } from './lr-types';

import { ReflowPanel } from '../../components/list-reflow/reflow-panel';

/** 将 JSX 渲染的 HTML 字符串转为单个元素。 */
function toElement(html: string): HTMLElement {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild as HTMLElement;
}

/** 渲染编号组成员行（序号/名称/数量/裸名/已满标记）。 */
function renderMemberRows(listsElement: HTMLElement, group: ReflowGroup): void {
    listsElement.replaceChildren();
    for (const member of group.members) {
        const row = document.createElement('div');
        row.className = 'jhs-reflow-list';
        row.dataset.listId = member.listId;

        const num = document.createElement('span');
        num.className = 'jhs-reflow-list__num';
        num.textContent = member.num === 0 ? '★' : String(member.num);
        num.title = member.num === 0 ? '裸名清单（压实最优先）' : `序号 ${member.num}`;

        const name = document.createElement('span');
        name.className = 'jhs-reflow-list__name';
        name.textContent = member.name;
        name.title = member.name;

        const count = document.createElement('span');
        count.className = 'jhs-reflow-list__count';
        count.textContent = member.count === null ? '—' : String(member.count);

        row.append(num, name, count);
        if (member.num === 0) {
            const flag = document.createElement('span');
            flag.className = 'jhs-reflow-list__flag is-bare';
            flag.textContent = '裸名';
            row.append(flag);
        }
        if (member.count !== null && member.count >= LIST_FULL_THRESHOLD) {
            const flag = document.createElement('span');
            flag.className = 'jhs-reflow-list__flag is-full';
            flag.textContent = '已满';
            row.append(flag);
        }
        listsElement.append(row);
    }
}

/** 渲染汇总报告（期2c）。 */
function renderReport(reportElement: HTMLElement, result: ExecuteResult): void {
    reportElement.replaceChildren();
    reportElement.hidden = false;

    const lines: string[] = [];
    lines.push(`✓ 成功：${result.completed}`);
    if (result.failed > 0) lines.push(`✗ 失败：${result.failed}`);
    if (result.pendingCleanup.length > 0) {
        lines.push(`⚠ 待清理重复：${result.pendingCleanup.length}（${result.pendingCleanup.join('、')}）`);
    }
    if (result.errors.length > 0) {
        lines.push('');
        lines.push('失败明细：');
        for (const err of result.errors.slice(0, 20)) {
            lines.push(`  ${err}`);
        }
        if (result.errors.length > 20) {
            lines.push(`  …共 ${result.errors.length} 条`);
        }
    }

    const pre = document.createElement('pre');
    pre.className = 'jhs-reflow-panel__report-text';
    pre.textContent = lines.join('\n');
    reportElement.append(pre);
}

/** 更新进度条（期2c）。 */
function updateProgress(
    progressElement: HTMLElement,
    fillElement: HTMLElement,
    textElement: HTMLElement,
    done: number,
    total: number,
    backoffLevel: number
): void {
    progressElement.hidden = false;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    fillElement.style.width = `${pct}%`;
    const backoffLabel = backoffLevel > 0 ? `（退避 ×${Math.pow(2, backoffLevel)}）` : '';
    textElement.textContent = `${done}/${total} (${pct}%)${backoffLabel}`;
}

/**
 * 在当前清单页挂载整理面板并绑定交互。幂等（已存在则跳过）。
 * @param config 合并配置（复用 listMergePattern / listMergeExcludeNames 分组规则）
 */
export function initReflowPanel(config: ListMergeConfig): void {
    const currentListId = getCurrentListId();
    if (!currentListId) return;
    if (document.querySelector('.jhs-reflow-panel')) return;

    const panel = toElement(jsxToString(<ReflowPanel />));
    const anchor = document.querySelector('.movie-list');
    if (anchor) {
        anchor.insertAdjacentElement('beforebegin', panel);
    } else {
        (document.querySelector('main') || document.body).prepend(panel);
    }

    const statusElement = panel.querySelector<HTMLElement>('[data-reflow-status]');
    const listsElement = panel.querySelector<HTMLElement>('[data-reflow-lists]');
    const planElement = panel.querySelector<HTMLElement>('[data-reflow-plan]');
    const progressElement = panel.querySelector<HTMLElement>('[data-reflow-progress]');
    const progressFill = panel.querySelector<HTMLElement>('[data-reflow-progress-fill]');
    const progressText = panel.querySelector<HTMLElement>('[data-reflow-progress-text]');
    const reportElement = panel.querySelector<HTMLElement>('[data-reflow-report]');
    const identifyButton = panel.querySelector<HTMLButtonElement>('[data-reflow-identify]');
    const planButton = panel.querySelector<HTMLButtonElement>('[data-reflow-plan-btn]');
    const execButton = panel.querySelector<HTMLButtonElement>('[data-reflow-exec-btn]');
    const abortButton = panel.querySelector<HTMLButtonElement>('[data-reflow-abort-btn]');
    const resumeButton = panel.querySelector<HTMLButtonElement>('[data-reflow-resume-btn]');
    const undoButton = panel.querySelector<HTMLButtonElement>('[data-reflow-undo-btn]');
    if (
        !statusElement ||
        !listsElement ||
        !planElement ||
        !progressElement ||
        !progressFill ||
        !progressText ||
        !reportElement ||
        !identifyButton ||
        !planButton ||
        !execButton ||
        !abortButton ||
        !resumeButton ||
        !undoButton
    )
        return;

    const setStatus = (message: string, stateClass = ''): void => {
        statusElement.textContent = message;
        statusElement.className =
            'jhs-reflow-panel__status' + (stateClass ? ` ${stateClass}` : '');
    };

    let group: ReflowGroup | null = null;
    let plan: CompactionPlan | null = null;
    let execSignal: { aborted: boolean } = { aborted: false };
    let lastSessionId: string | null = null;

    // 期2b：检测可续传的恢复日志
    if (hasResumableJournal()) {
        resumeButton.hidden = false;
        const journal = loadJournal();
        if (journal) {
            setStatus(`检测到上次未完成的整理（${journal.base}，已完成 ${journal.completed}/${journal.totalMoves}）`);
        }
    }

    identifyButton.addEventListener('click', () => {
        identifyButton.disabled = true;
        setStatus('正在识别编号组…');
        void (async () => {
            try {
                const allLists = await fetchAllUserLists();
                clog.log(`[编号整理] /users/lists 识别到 ${allLists.length} 个清单`);
                group = discoverGroup(currentListId, allLists, config);
                if (!group) {
                    clog.log(
                        `[编号整理] 当前清单 ${currentListId} 未归入编号组（名称未匹配序号规则或被排除）`
                    );
                    listsElement.hidden = true;
                    planButton.hidden = true;
                    if (planElement) planElement.hidden = true;
                    setStatus('此清单不属于编号组');
                    return;
                }
                renderMemberRows(listsElement, group);
                listsElement.hidden = false;
                planButton.hidden = false;
                setStatus(`编号组「${group.base}」· ${group.members.length} 个清单`, 'is-ok');
            } catch (error) {
                setStatus(
                    '识别失败：' + (error instanceof Error ? error.message : String(error)),
                    'is-error'
                );
            } finally {
                identifyButton.disabled = false;
            }
        })();
    });

    planButton.addEventListener('click', () => {
        if (!group) return;
        planButton.disabled = true;
        execButton.hidden = true;
        void runPlanPreview(panel, group, setStatus)
            .then((result) => {
                plan = result;
                if (plan && plan.moves.length > 0) execButton.hidden = false;
            })
            .catch((error: unknown) => {
                setStatus(
                    '生成计划失败：' + (error instanceof Error ? error.message : String(error)),
                    'is-error'
                );
            })
            .finally(() => {
                planButton.disabled = false;
            });
    });

    const finishExecution = (result?: ExecuteResult): void => {
        execButton.disabled = false;
        execButton.hidden = false;
        abortButton.hidden = true;
        resumeButton.hidden = true;
        if (result) {
            lastSessionId = result.sessionId;
            if (result.completed > 0) {
                undoButton.hidden = false;
            }
            renderReport(reportElement, result);
        }
    };

    const runExecution = async (thePlan: CompactionPlan, startIndex: number): Promise<void> => {
        execSignal = { aborted: false };
        execButton.disabled = true;
        execButton.hidden = true;
        abortButton.hidden = false;
        resumeButton.hidden = true;
        undoButton.hidden = true;
        reportElement.hidden = true;
        progressElement.hidden = false;

        const settings = await storageManager.getSetting();
        const interval = Number(settings.reflowInterval) || 400;
        const trialCount = Number(settings.reflowTrialCount) || 10;
        const batchSize = Number(settings.reflowBatchSize) || 20;
        const maxRetry = Number(settings.reflowMaxRetry) || 3;
        const nameOf = (id: string): string =>
            thePlan.targets.find((t) => t.listId === id)?.name ?? id;

        const onProgress = (p: { done: number; total: number; videoId: string; currentInterval: number; backoffLevel: number }): void => {
            updateProgress(progressElement, progressFill, progressText, p.done, p.total, p.backoffLevel);
            setStatus(`执行中 ${p.done + 1}/${p.total}：${p.videoId}`);
        };

        // 试运行切片
        const trial = await executeCompactionPlan(thePlan, {
            startIndex,
            count: startIndex === 0 ? trialCount : Infinity,
            interval,
            signal: execSignal,
            onProgress,
            nameOf,
            batchSize,
            maxRetry,
            base: thePlan.base
        });

        if (trial.status === 'aborted') {
            setStatus(`已中止（完成 ${trial.completed}，失败 ${trial.failed}）`, 'is-error');
            finishExecution(trial);
            return;
        }
        if (trial.status === 'suspended') {
            setStatus(`连续失败暂停（完成 ${trial.completed}，失败 ${trial.failed}）`, 'is-error');
            resumeButton.hidden = false;
            finishExecution(trial);
            return;
        }
        if (trial.status === 'done') {
            setStatus(
                `完成：成功 ${trial.completed}，失败 ${trial.failed}`,
                trial.failed > 0 ? 'is-error' : 'is-ok'
            );
            finishExecution(trial);
            return;
        }

        // 试运行切片跑完仍有剩余 → 确认继续
        utils.q(
            null,
            `试运行完成：成功 ${trial.completed}，失败 ${trial.failed}。继续剩余 ${
                thePlan.moves.length - trial.nextIndex
            } 个？`,
            () => {
                void (async () => {
                    const rest = await executeCompactionPlan(thePlan, {
                        startIndex: trial.nextIndex,
                        count: Infinity,
                        interval,
                        signal: execSignal,
                        onProgress,
                        nameOf,
                        batchSize,
                        maxRetry,
                        base: thePlan.base,
                        sessionId: trial.sessionId
                    });
                    const merged: ExecuteResult = {
                        status: rest.status === 'aborted' ? 'aborted' : 'done',
                        completed: trial.completed + rest.completed,
                        failed: trial.failed + rest.failed,
                        nextIndex: rest.nextIndex,
                        errors: [...trial.errors, ...rest.errors],
                        sessionId: rest.sessionId,
                        pendingCleanup: [...trial.pendingCleanup, ...rest.pendingCleanup]
                    };
                    setStatus(
                        merged.status === 'aborted'
                            ? `已中止（完成 ${merged.completed}，失败 ${merged.failed}）`
                            : `完成：成功 ${merged.completed}，失败 ${merged.failed}`,
                        merged.status === 'aborted' || merged.failed > 0 ? 'is-error' : 'is-ok'
                    );
                    finishExecution(merged);
                })();
            },
            () => {
                setStatus(`试运行后取消（已完成 ${trial.completed}）`);
                finishExecution(trial);
            }
        );
    };

    execButton.addEventListener('click', () => {
        if (!plan || plan.moves.length === 0) return;
        utils.q(
            null,
            `将搬运 ${plan.moves.length} 部影片（先试运行，确认无误后继续）。确认开始？`,
            () => {
                void runExecution(plan!, 0);
            }
        );
    });

    abortButton.addEventListener('click', () => {
        execSignal.aborted = true;
        setStatus('正在中止…');
    });

    // 期2b：续传按钮
    resumeButton.addEventListener('click', () => {
        const journal = loadJournal();
        if (!journal) {
            setStatus('无可续传的会话');
            return;
        }
        if (!plan) {
            setStatus('请先生成整理计划再续传', 'is-error');
            return;
        }
        utils.q(
            null,
            `检测到上次未完成的整理（已完成 ${journal.completed}/${journal.totalMoves}），从第 ${journal.nextIndex + 1} 步继续？`,
            () => {
                void runExecution(plan!, journal.nextIndex);
            }
        );
    });

    // 期2b：撤销按钮
    undoButton.addEventListener('click', () => {
        if (!lastSessionId) return;
        utils.q(
            null,
            '确定撤销本次整理？将按回滚日志逆序执行反向搬运（同样先加后删 + 限速）。',
            () => {
                undoButton.disabled = true;
                setStatus('正在撤销…');
                execSignal = { aborted: false };
                abortButton.hidden = false;
                void (async () => {
                    const settings = await storageManager.getSetting();
                    const interval = Number(settings.reflowInterval) || 400;
                    const nameOf = (id: string): string =>
                        plan?.targets.find((t) => t.listId === id)?.name ?? id;
                    const result = await undoSession(lastSessionId!, {
                        interval,
                        signal: execSignal,
                        nameOf,
                        onProgress: (p) => {
                            setStatus(`撤销中 ${p.done + 1}/${p.total}：${p.videoId}`);
                            updateProgress(progressElement, progressFill, progressText, p.done, p.total, 0);
                        }
                    });
                    setStatus(
                        `撤销完成：成功 ${result.undone}，失败 ${result.failed}`,
                        result.failed > 0 ? 'is-error' : 'is-ok'
                    );
                    undoButton.disabled = false;
                    undoButton.hidden = true;
                    abortButton.hidden = true;
                    clearJournal();
                })();
            }
        );
    });
}
