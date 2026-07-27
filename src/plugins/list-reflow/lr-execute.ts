/**
 * 编号清单整理执行引擎（doc/204 期2a+2b，核心写路径 + 韧性层）。
 *
 * 期2a：串行 + 先加后删 + 权威校验 + 间隔限速 + 可中止 + 试运行切片。
 * 期2b：自适应退避（429/503 指数退避）+ 恢复日志/续传 + 批检查点 +
 *       回滚日志 + 整次撤销 + 连续失败暂停。
 *
 * 复用 VLT `postJavdbListMutation`（写）+ `fetchAuthoritativeCheckboxState`（权威校验）。
 * 期2c 将叠加：执行进度 UI 完善、汇总报告。
 */
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../video-lists-tag/server/vlt-server-api';

import type { CompactionPlan, ReflowMove } from './lr-types';
import type { JournalEntry, RollbackEntry } from './lr-journal';
import {
    appendRollback,
    clearJournal,
    createSessionId,
    loadRollback,
    saveJournal
} from './lr-journal';

/** 执行选项（期2b 扩展）。 */
export interface ExecuteOptions {
    /** 起始 move 下标。 */
    startIndex: number;
    /** 执行的 move 数量（Infinity 表示直到末尾）。 */
    count: number;
    /** 每步间隔（ms，限速）。 */
    interval: number;
    /** 中止信号（外部置 aborted=true 即停）。 */
    signal: { aborted: boolean };
    /** 进度回调（每步开始时）。 */
    onProgress?: (info: ProgressInfo) => void;
    /** listId → 清单名（日志/提示用）。 */
    nameOf?: (listId: string) => string;
    /** 每批操作数（检查点粒度，默认 20）。 */
    batchSize?: number;
    /** 连续失败上限（超过暂停，默认 3）。 */
    maxRetry?: number;
    /** 组前缀（日志用）。 */
    base?: string;
    /** 续传会话 ID（续传时传入，新执行自动生成）。 */
    sessionId?: string;
}

/** 进度信息。 */
export interface ProgressInfo {
    done: number;
    total: number;
    videoId: string;
    /** 当前间隔（含退避）。 */
    currentInterval: number;
    /** 退避档位（0=正常，1/2/3=降速）。 */
    backoffLevel: number;
}

/** 执行结果（期2b 扩展）。 */
export interface ExecuteResult {
    /** done=全部完成；paused=本切片跑完仍有剩余（试运行）；aborted=被中止；suspended=连续失败暂停。 */
    status: 'done' | 'paused' | 'aborted' | 'suspended';
    /** 本切片成功完成的 move 数。 */
    completed: number;
    /** 本切片失败的 move 数。 */
    failed: number;
    /** 下一个待执行下标（续跑用）。 */
    nextIndex: number;
    /** 失败明细。 */
    errors: string[];
    /** 会话 ID（供续传/撤销）。 */
    sessionId: string;
    /** 待清理重复（加成功但删失败）。 */
    pendingCleanup: string[];
}

/** 延时。 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 执行单个搬运：先加入目标清单（校验成功后）再移除来源清单。
 *
 * 安全核心（不变式1 永不丢片）：
 * - 加入被拒/未确认 → 立即返回，**不删来源**（影片仍安全在原处）。
 * - 移除失败 → 仅记错（影片已在目标或原处，不丢，标记待清理）。
 *
 * @returns [errors, rollbackEntry]
 */
async function executeMove(
    move: ReflowMove,
    nameOf: (id: string) => string
): Promise<{ errors: string[]; rollback: RollbackEntry | null; cleanup: boolean }> {
    const errors: string[] = [];
    let addedTo: string | null = null;

    // 先加后删：先加入目标清单
    if (move.addTo !== null) {
        const add = await postJavdbListMutation(move.videoId, move.addTo, true);
        if (add.kind === 'rejected') {
            errors.push(
                `[${move.videoId}] 加入「${nameOf(move.addTo)}」被拒：${add.message}（跳过，不删来源）`
            );
            return { errors, rollback: null, cleanup: false };
        }
        if (add.kind === 'unknown') {
            const auth = await fetchAuthoritativeCheckboxState(move.videoId, move.addTo);
            if (!auth?.checked) {
                errors.push(`[${move.videoId}] 加入「${nameOf(move.addTo)}」未确认（跳过，不删来源）`);
                return { errors, rollback: null, cleanup: false };
            }
        }
        addedTo = move.addTo;
    }

    // 再移除来源清单
    const removedFrom: string[] = [];
    let hasCleanup = false;
    for (const removeId of move.removeFrom) {
        const rm = await postJavdbListMutation(move.videoId, removeId, false);
        if (rm.kind === 'confirmed') {
            removedFrom.push(removeId);
        } else if (rm.kind === 'rejected') {
            errors.push(`[${move.videoId}] 移除「${nameOf(removeId)}」被拒：${rm.message}`);
        } else {
            // unknown → 权威校验
            const auth = await fetchAuthoritativeCheckboxState(move.videoId, removeId);
            if (auth?.checked) {
                errors.push(`[${move.videoId}] 移除「${nameOf(removeId)}」未确认（待清理）`);
                hasCleanup = true;
            } else {
                removedFrom.push(removeId);
            }
        }
    }

    const rollback: RollbackEntry | null =
        addedTo !== null || removedFrom.length > 0
            ? { videoId: move.videoId, addedTo, removedFrom }
            : null;

    return { errors, rollback, cleanup: hasCleanup };
}

/**
 * 执行压实计划的一个切片（串行 + 先加后删 + 校验 + 间隔 + 退避 + 检查点 + 可中止）。
 */
export async function executeCompactionPlan(
    plan: CompactionPlan,
    options: ExecuteOptions
): Promise<ExecuteResult> {
    const { startIndex, count, signal, onProgress } = options;
    const nameOf = options.nameOf ?? ((id: string) => id);
    const baseInterval = options.interval;
    const batchSize = options.batchSize ?? 20;
    const maxRetry = options.maxRetry ?? 3;
    const sessionId = options.sessionId ?? createSessionId();
    const base = options.base ?? plan.base;

    const end = Math.min(plan.moves.length, startIndex + count);
    const errors: string[] = [];
    const pendingCleanup: string[] = [];
    let completed = 0;
    let failed = 0;
    let nextIndex = startIndex;
    let currentInterval = baseInterval;
    let backoffLevel = 0;
    let consecutiveFailures = 0;

    // 写入恢复日志
    const journal: JournalEntry = {
        sessionId,
        base,
        totalMoves: plan.moves.length,
        nextIndex: startIndex,
        completed: 0,
        failed: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'running'
    };
    saveJournal(journal);

    for (let i = startIndex; i < end; i++) {
        if (signal.aborted) {
            journal.status = 'aborted';
            journal.nextIndex = i;
            journal.completed = completed;
            journal.failed = failed;
            saveJournal(journal);
            return { status: 'aborted', completed, failed, nextIndex: i, errors, sessionId, pendingCleanup };
        }

        // 连续失败暂停
        if (consecutiveFailures >= maxRetry) {
            journal.status = 'paused';
            journal.nextIndex = i;
            journal.completed = completed;
            journal.failed = failed;
            saveJournal(journal);
            errors.push(`连续失败 ${consecutiveFailures} 次，暂停执行（可从 ${i} 续传）`);
            return { status: 'suspended', completed, failed, nextIndex: i, errors, sessionId, pendingCleanup };
        }

        const move = plan.moves[i];
        onProgress?.({ done: i - startIndex, total: end - startIndex, videoId: move.videoId, currentInterval, backoffLevel });

        try {
            const result = await executeMove(move, nameOf);
            if (result.errors.length === 0) {
                completed++;
                consecutiveFailures = 0;
                // 退避恢复：成功时逐步降回正常间隔
                if (backoffLevel > 0) {
                    backoffLevel = Math.max(0, backoffLevel - 1);
                    currentInterval = baseInterval * Math.pow(2, backoffLevel);
                }
            } else {
                failed++;
                consecutiveFailures++;
                errors.push(...result.errors);
                // 退避升档：失败时加倍间隔
                if (backoffLevel < 3) {
                    backoffLevel++;
                    currentInterval = baseInterval * Math.pow(2, backoffLevel);
                }
            }
            if (result.cleanup) {
                pendingCleanup.push(move.videoId);
            }
            // 回滚日志
            if (result.rollback) {
                appendRollback(sessionId, result.rollback);
            }
        } catch (err: unknown) {
            failed++;
            consecutiveFailures++;
            errors.push(
                `[${move.videoId}] 异常：${err instanceof Error ? err.message : String(err)}`
            );
            if (backoffLevel < 3) {
                backoffLevel++;
                currentInterval = baseInterval * Math.pow(2, backoffLevel);
            }
        }

        nextIndex = i + 1;

        // 批检查点
        if ((i - startIndex + 1) % batchSize === 0 || i + 1 >= end) {
            journal.nextIndex = nextIndex;
            journal.completed = completed;
            journal.failed = failed;
            saveJournal(journal);
        }

        if (i + 1 < end && !signal.aborted) await sleep(currentInterval);
    }

    const status = nextIndex >= plan.moves.length ? 'done' : 'paused';
    journal.status = status === 'done' ? 'done' : 'paused';
    journal.nextIndex = nextIndex;
    journal.completed = completed;
    journal.failed = failed;
    saveJournal(journal);
    if (status === 'done') clearJournal();

    return { status, completed, failed, nextIndex, errors, sessionId, pendingCleanup };
}

/**
 * 整次撤销：按回滚日志逆序执行反向搬运（先加回 removedFrom，再删 addedTo）。
 * 同样串行 + 限速 + 可中止。
 */
export async function undoSession(
    sessionId: string,
    options: {
        interval: number;
        signal: { aborted: boolean };
        nameOf?: (listId: string) => string;
        onProgress?: (info: { done: number; total: number; videoId: string }) => void;
    }
): Promise<{ undone: number; failed: number; errors: string[] }> {
    const rollbackLog = loadRollback(sessionId);
    const errors: string[] = [];
    let undone = 0;
    let failed = 0;

    // 逆序
    for (let i = rollbackLog.length - 1; i >= 0; i--) {
        if (options.signal.aborted) break;
        const entry = rollbackLog[i];
        options.onProgress?.({ done: rollbackLog.length - 1 - i, total: rollbackLog.length, videoId: entry.videoId });

        try {
            // 反向：先加回来源
            for (const listId of entry.removedFrom) {
                await postJavdbListMutation(entry.videoId, listId, true);
            }
            // 再删目标
            if (entry.addedTo) {
                await postJavdbListMutation(entry.videoId, entry.addedTo, false);
            }
            undone++;
        } catch (err) {
            failed++;
            errors.push(`[${entry.videoId}] 撤销失败：${err instanceof Error ? err.message : String(err)}`);
        }
        if (i > 0 && !options.signal.aborted) await sleep(options.interval);
    }

    return { undone, failed, errors };
}
