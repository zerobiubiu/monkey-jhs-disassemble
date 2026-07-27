/**
 * 编号清单组内压实规划器（纯逻辑，无 DOM/网络，便于单测）。
 *
 * 算法（不保留清单内顺序，组内每片唯一归属）：
 * 1. 统计组内影片归属（video → 所在清单集合），得去重影片流与重复影片。
 * 2. 目标容量：按序号升序每清单填满 501 再往后（低序号优先）。
 * 3. 分配：先「就近保留」（各清单现含影片在目标容量内优先留原位，最小化搬运），
 *    剩余影片按升序填入有空位的清单；超出组总容量者记为 overflow。
 * 4. 由「现态 vs 终态」diff 出搬运明细（移除多余归属 + 加入目标清单）。
 *
 * 不同 base 的归属不参与——本规划器只接收单个 base 组的成员。
 */
import { LIST_FULL_THRESHOLD } from '../detail-page-button/dpb-list-merge';

import type {
    CompactionPlan,
    PlanTargetRow,
    PlannerListInput,
    ReflowMove
} from './lr-types';

/** 按序号升序排序成员（同序号按 listId 稳定）。 */
function sortListsAsc(lists: PlannerListInput[]): PlannerListInput[] {
    return [...lists].sort((a, b) => {
        if (a.num !== b.num) return a.num - b.num;
        return a.listId < b.listId ? -1 : a.listId > b.listId ? 1 : 0;
    });
}

/** 去重并保持首次出现顺序。 */
function dedupePreserveOrder(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}

/**
 * 计算编号组的压实规划。
 * @param base 组前缀文字
 * @param lists 组成员及其影片集合
 * @returns 压实规划（目标分布 + 搬运明细 + 重复审计 + 溢出）
 */
export function planCompaction(base: string, lists: PlannerListInput[]): CompactionPlan {
    const sorted = sortListsAsc(lists);
    const count = sorted.length;
    const dedupedVideos = sorted.map((list) => dedupePreserveOrder(list.videoIds));

    // video → 所在清单 ID 集合（组内）
    const membership = new Map<string, string[]>();
    sorted.forEach((list, index) => {
        for (const videoId of dedupedVideos[index]) {
            const existing = membership.get(videoId);
            if (existing) existing.push(list.listId);
            else membership.set(videoId, [list.listId]);
        }
    });

    const uniqueVideos = Array.from(membership.keys());
    const totalUnique = uniqueVideos.length;

    // 目标容量：按序号升序填满 501 再往后
    const targets: number[] = new Array(count).fill(0);
    let remaining = totalUnique;
    for (let i = 0; i < count; i++) {
        const take = Math.min(LIST_FULL_THRESHOLD, remaining);
        targets[i] = take;
        remaining -= take;
    }

    // 分配终态归属
    const cap = [...targets];
    const final = new Map<string, string>();
    const placed = new Set<string>();
    // 第一步：就近保留（各清单现含影片在目标容量内留原位）
    for (let i = 0; i < count; i++) {
        for (const videoId of dedupedVideos[i]) {
            if (cap[i] > 0 && !placed.has(videoId)) {
                final.set(videoId, sorted[i].listId);
                placed.add(videoId);
                cap[i]--;
            }
        }
    }
    // 第二步：剩余影片按升序填入空位；无空位记为溢出
    const overflow: string[] = [];
    for (const videoId of uniqueVideos) {
        if (placed.has(videoId)) continue;
        let assigned = false;
        for (let i = 0; i < count; i++) {
            if (cap[i] > 0) {
                final.set(videoId, sorted[i].listId);
                placed.add(videoId);
                cap[i]--;
                assigned = true;
                break;
            }
        }
        if (!assigned) overflow.push(videoId);
    }

    // 由现态/终态 diff 出搬运明细
    const moves: ReflowMove[] = [];
    for (const [videoId, finalList] of final) {
        const current = membership.get(videoId) ?? [];
        const removeFrom = current.filter((id) => id !== finalList);
        const addTo = current.includes(finalList) ? null : finalList;
        if (removeFrom.length > 0 || addTo !== null) {
            moves.push({ videoId, removeFrom, addTo });
        }
    }

    const duplicates = uniqueVideos.filter(
        (videoId) => (membership.get(videoId)?.length ?? 0) > 1
    );
    const targetRows: PlanTargetRow[] = sorted.map((list, i) => ({
        listId: list.listId,
        num: list.num,
        name: list.name,
        current: dedupedVideos[i].length,
        target: targets[i]
    }));
    const addCount = moves.filter((m) => m.addTo !== null).length;
    const removeCount = moves.reduce((sum, m) => sum + m.removeFrom.length, 0);

    return {
        base,
        totalUnique,
        duplicateCount: duplicates.length,
        duplicates,
        targets: targetRows,
        moves,
        addCount,
        removeCount,
        overflow
    };
}
