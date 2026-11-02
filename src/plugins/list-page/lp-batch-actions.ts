/** 批量评价的数据写入与后台同步编排；界面状态由 lp-batch 管理。 */
import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION, NO, YES } from '../../constants/status';

import type { CarSaveInput } from '../../core/storage/car-list-ops';

import { planFavoriteBatch, planFilterBatch, planUnwatchBatch, planWatchedBatch } from './lp-batch-state';
import type { BatchActionKind, BatchItemInfo, BatchPlan } from './lp-batch-state';
import { enqueueBatchPush } from './lp-batch-sync';
import type { BatchPushKind } from './lp-batch-sync';
import type { OpSyncKind } from '../setting/jhs-sync/op-sync-records';

const BATCH_LOG = '[列表页批量操作]';

export async function executeBatchRating(
    carNums: string[], infoByCarNum: Map<string, BatchItemInfo>, kind: BatchActionKind, score: number
): Promise<void> {
    const carList = await storageManager.getCarList();
    if (kind === 'favorite') {
        const favorites = carList.filter((car) => car.status === FAVORITE_ACTION).map((car) => car.carNum);
        await applyPlan(planFavoriteBatch(carNums, infoByCarNum, favorites), '收藏', {
            kind: 'favorite',
            score: 0
        });
    } else if (kind === 'watched') {
        await applyPlan(planWatchedBatch(carNums, infoByCarNum, score), `已读 ${score}星`, {
            kind: 'watched',
            score
        });
    } else if (kind === 'filter') {
        const filtered = carList.filter((car) => car.status === FILTER_ACTION).map((car) => car.carNum);
        await applyPlan(planFilterBatch(carNums, infoByCarNum, filtered), '拉黑', {
            kind: 'watched',
            recordKind: 'filter',
            score: 0
        });
    } else {
        const watched = carList.filter((car) => car.status === HAS_WATCH_ACTION).map((car) => car.carNum);
        const plan = planUnwatchBatch(carNums, watched);
        const changed = plan.carNums.length
            ? await storageManager.clearCarWatchStatus(plan.carNums)
            : 0;
        // 取消已读的服务端对应操作是**删除评价记录**（破坏性远端操作，见 doc/31 §4）
        let unwatchQueued = 0;
        if (plan.carNums.length > 0) {
            const targets: CarSaveInput[] = [];
            for (const carNum of plan.carNums) {
                const info = infoByCarNum.get(carNum);
                if (info) targets.push({ carNum: info.carNum, url: info.url });
            }
            unwatchQueued = await enqueueIfServerSyncEnabled(targets, { kind: 'unwatch', score: 0 });
        }
        reportResult('取消已读', changed, plan.skipped.length, 0, unwatchQueued);
    }
}

/**
 * 执行写入计划并汇报结果。
 *
 * @param plan 写入计划
 * @param label 结果文案前缀
 * @param push 需要后台推送到 JavDB 时给出操作类型与评分（**不阻塞**，立即返回）
 */
async function applyPlan(
    plan: BatchPlan,
    label: string,
    push?: { kind: BatchPushKind; score: number; recordKind?: OpSyncKind }
): Promise<void> {
    if (plan.inputs.length > 0) {
        await storageManager.saveCarList(plan.inputs);
    }
    // 本地已写入成功 → 入队后台推送（节流串行、带重试，不等待网络）
    let queued = 0;
    if (push && plan.inputs.length > 0) {
        queued = await enqueueIfServerSyncEnabled(plan.inputs, push);
    }
    reportResult(label, plan.inputs.length, plan.skipped.length, plan.missing.length, queued);
}

/**
 * 按 `autoServerSync` 设置决定是否入队后台推送（与详情页评价校验同一开关，默认开启）。
 *
 * @param inputs 刚写入的记录
 * @param push 操作类型与评分
 * @returns 实际入队数（设置关闭或无有效 videoId 时为 0）
 */
async function enqueueIfServerSyncEnabled(
    inputs: CarSaveInput[],
    push: { kind: BatchPushKind; score: number; recordKind?: OpSyncKind }
): Promise<number> {
    try {
        if ((await storageManager.getSetting('autoServerSync', YES)) === NO) {
            clog.log(`${BATCH_LOG} autoServerSync 已关闭，跳过 JavDB 推送`);
            return 0;
        }
    } catch {
        // 读设置失败按开启处理（与详情页校验的默认一致）
    }
    return enqueueBatchPush(
        inputs.map((input) => ({ carNum: input.carNum, url: String(input.url ?? '') })),
        push.kind,
        push.score,
        { recordKind: push.recordKind }
    );
}

/** 汇报批量结果（成功/跳过分别说明原因）。 */
function reportResult(
    label: string,
    done: number,
    skipped: number,
    missing: number,
    syncQueued = 0
): void {
    const parts = [`${label} ${done} 项`];
    if (skipped > 0) parts.push(`跳过 ${skipped} 项（已是目标状态）`);
    if (missing > 0) parts.push(`跳过 ${missing} 项（卡片信息缺失）`);
    if (syncQueued > 0) parts.push(`已提交后台同步 JavDB ${syncQueued} 项`);
    const msg = parts.join('，');
    if (done > 0) {
        show.ok(msg);
    } else {
        show.info(msg);
    }
    clog.log(`${BATCH_LOG} ${msg}`);
}
