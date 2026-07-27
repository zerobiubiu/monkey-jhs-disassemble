/**
 * 编号清单整理执行引擎（doc/204 期2a，核心写路径）。
 *
 * 将 planCompaction 产出的搬运计划真正写入 JavDB：串行执行、每步「先加后删」、
 * 加入后经权威校验再移除来源（保证不变式1「永不丢片」）、步间间隔限速、
 * 可中止、可切片（试运行 K 个后交由 UI 确认再续跑）。
 *
 * 复用 VLT `postJavdbListMutation`（写）+ `fetchAuthoritativeCheckboxState`（权威校验）。
 * 期2b 将叠加：自适应退避、恢复日志/续传、批检查点、整次撤销。
 * 期2c 将叠加：执行进度 UI、汇总报告。
 */
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../video-lists-tag/server/vlt-server-api';

import type { CompactionPlan, ReflowMove } from './lr-types';

/** 执行选项。 */
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
    onProgress?: (info: { done: number; total: number; videoId: string }) => void;
    /** listId → 清单名（日志/提示用）。 */
    nameOf?: (listId: string) => string;
}

/** 执行结果。 */
export interface ExecuteResult {
    /** done=全部完成；paused=本切片跑完仍有剩余（试运行）；aborted=被中止。 */
    status: 'done' | 'paused' | 'aborted';
    /** 本切片成功完成的 move 数。 */
    completed: number;
    /** 本切片失败的 move 数。 */
    failed: number;
    /** 下一个待执行下标（续跑用）。 */
    nextIndex: number;
    /** 失败明细。 */
    errors: string[];
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
 * @param move 单个搬运
 * @param nameOf listId → 名称
 * @returns 错误明细（空数组=成功）
 */
async function executeMove(move: ReflowMove, nameOf: (id: string) => string): Promise<string[]> {
    const errors: string[] = [];

    // 先加后删：先加入目标清单
    if (move.addTo !== null) {
        const add = await postJavdbListMutation(move.videoId, move.addTo, true);
        if (add.kind === 'rejected') {
            errors.push(
                `[${move.videoId}] 加入「${nameOf(move.addTo)}」被拒：${add.message}（跳过，不删来源）`
            );
            return errors;
        }
        if (add.kind === 'unknown') {
            const auth = await fetchAuthoritativeCheckboxState(move.videoId, move.addTo);
            if (!auth?.checked) {
                errors.push(`[${move.videoId}] 加入「${nameOf(move.addTo)}」未确认（跳过，不删来源）`);
                return errors;
            }
        }
    }

    // 再移除来源清单
    for (const removeId of move.removeFrom) {
        const rm = await postJavdbListMutation(move.videoId, removeId, false);
        if (rm.kind === 'rejected') {
            errors.push(`[${move.videoId}] 移除「${nameOf(removeId)}」被拒：${rm.message}`);
        } else if (rm.kind === 'unknown') {
            const auth = await fetchAuthoritativeCheckboxState(move.videoId, removeId);
            if (auth?.checked) {
                errors.push(`[${move.videoId}] 移除「${nameOf(removeId)}」未确认（待清理）`);
            }
        }
    }

    return errors;
}

/**
 * 执行压实计划的一个切片（串行 + 先加后删 + 校验 + 间隔 + 可中止）。
 *
 * @param plan 压实计划
 * @param options 执行选项
 * @returns 执行结果（含 nextIndex 供续跑）
 */
export async function executeCompactionPlan(
    plan: CompactionPlan,
    options: ExecuteOptions
): Promise<ExecuteResult> {
    const { startIndex, count, interval, signal, onProgress } = options;
    const nameOf = options.nameOf ?? ((id: string) => id);
    const end = Math.min(plan.moves.length, startIndex + count);
    const errors: string[] = [];
    let completed = 0;
    let failed = 0;
    let nextIndex = startIndex;

    for (let i = startIndex; i < end; i++) {
        if (signal.aborted) {
            return { status: 'aborted', completed, failed, nextIndex: i, errors };
        }
        const move = plan.moves[i];
        onProgress?.({ done: i - startIndex, total: end - startIndex, videoId: move.videoId });
        try {
            const moveErrors = await executeMove(move, nameOf);
            if (moveErrors.length === 0) {
                completed++;
            } else {
                failed++;
                errors.push(...moveErrors);
            }
        } catch (err: unknown) {
            failed++;
            errors.push(
                `[${move.videoId}] 异常：${err instanceof Error ? err.message : String(err)}`
            );
        }
        nextIndex = i + 1;
        if (i + 1 < end && !signal.aborted) await sleep(interval);
    }

    const status = nextIndex >= plan.moves.length ? 'done' : 'paused';
    return { status, completed, failed, nextIndex, errors };
}
