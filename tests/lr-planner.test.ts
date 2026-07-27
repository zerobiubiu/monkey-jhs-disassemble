/**
 * lr-planner 压实规划纯逻辑单测（doc/202，期1）。
 *
 * 覆盖：低序号优先填满 501、组内去重（同 base 多清单只留一份）、就近保留最小化搬运、
 * 空操作、组总容量溢出。node 环境即可运行。
 */
import { describe, expect, it } from 'vitest';

import { planCompaction } from '../src/plugins/list-reflow/lr-planner';
import type { PlannerListInput } from '../src/plugins/list-reflow/lr-types';

function list(listId: string, num: number, videoIds: string[]): PlannerListInput {
    return { listId, num, name: `清单${num}`, videoIds };
}

/** 生成 n 个不重复影片 ID。 */
function vids(prefix: string, n: number): string[] {
    return Array.from({ length: n }, (_, i) => `${prefix}${i}`);
}

describe('planCompaction', () => {
    it('低序号优先填满（小总量全入最靠前清单）', () => {
        const plan = planCompaction('等待更新', [
            list('1', 1, ['a']),
            list('2', 2, ['b', 'c', 'd'])
        ]);
        expect(plan.totalUnique).toBe(4);
        expect(plan.targets.map((t) => t.target)).toEqual([4, 0]);
        // b/c/d 从清单2 移入清单1
        expect(plan.moves.length).toBe(3);
        expect(plan.addCount).toBe(3);
        expect(plan.removeCount).toBe(3);
        expect(plan.overflow).toEqual([]);
    });

    it('组内去重：同片在多清单只保留一份，并计入重复审计', () => {
        const plan = planCompaction('等待更新', [
            list('1', 1, ['a', 'b']),
            list('2', 2, []),
            list('3', 3, ['a', 'c'])
        ]);
        expect(plan.totalUnique).toBe(3); // a/b/c
        expect(plan.duplicateCount).toBe(1);
        expect(plan.duplicates).toEqual(['a']);
        // 终态全部落入清单1（容量足够）
        const moveA = plan.moves.find((m) => m.videoId === 'a');
        expect(moveA?.removeFrom).toEqual(['3']);
        expect(moveA?.addTo).toBeNull(); // a 已在清单1
        const moveC = plan.moves.find((m) => m.videoId === 'c');
        expect(moveC?.removeFrom).toEqual(['3']);
        expect(moveC?.addTo).toBe('1');
        expect(plan.overflow).toEqual([]);
    });

    it('重复片在多个非目标清单时全部移除', () => {
        const plan = planCompaction('x', [
            list('1', 1, ['y']),
            list('2', 2, ['x']),
            list('3', 3, ['x'])
        ]);
        const moveX = plan.moves.find((m) => m.videoId === 'x');
        expect(moveX?.removeFrom.sort()).toEqual(['2', '3']);
        expect(moveX?.addTo).toBe('1');
        expect(plan.duplicates).toEqual(['x']);
    });

    it('已压实状态为空操作', () => {
        const plan = planCompaction('等待更新', [
            list('1', 1, vids('a', 501)),
            list('2', 2, vids('b', 100))
        ]);
        expect(plan.totalUnique).toBe(601);
        expect(plan.targets.map((t) => t.target)).toEqual([501, 100]);
        expect(plan.moves.length).toBe(0);
        expect(plan.addCount).toBe(0);
        expect(plan.removeCount).toBe(0);
    });

    it('满 501 后向后排', () => {
        const plan = planCompaction('等待更新', [
            list('1', 1, vids('a', 401)),
            list('2', 2, vids('b', 501)),
            list('3', 3, vids('c', 120))
        ]);
        expect(plan.totalUnique).toBe(1022);
        expect(plan.targets.map((t) => t.target)).toEqual([501, 501, 20]);
        expect(plan.overflow).toEqual([]);
        // 清单3 需腾出 100 部，清单1 需补 100 部
        expect(plan.addCount).toBeGreaterThan(0);
        expect(plan.removeCount).toBeGreaterThan(0);
    });

    it('组总容量不足时记录溢出', () => {
        const plan = planCompaction('x', [list('1', 1, vids('a', 502))]);
        expect(plan.totalUnique).toBe(502);
        expect(plan.targets[0].target).toBe(501);
        expect(plan.overflow.length).toBe(1);
        expect(plan.moves.length).toBe(0); // 已在清单1，无处可搬
    });

    it('入参顺序无关（按序号排序）', () => {
        const a = planCompaction('x', [
            list('3', 3, ['p']),
            list('1', 1, ['q']),
            list('2', 2, ['r'])
        ]);
        const b = planCompaction('x', [
            list('1', 1, ['q']),
            list('2', 2, ['r']),
            list('3', 3, ['p'])
        ]);
        expect(a.targets.map((t) => t.num)).toEqual([1, 2, 3]);
        expect(a.totalUnique).toBe(b.totalUnique);
        expect(a.moves.length).toBe(b.moves.length);
    });

    it('单清单内重复影片先去重', () => {
        const plan = planCompaction('x', [list('1', 1, ['a', 'a', 'b'])]);
        expect(plan.totalUnique).toBe(2);
        expect(plan.moves.length).toBe(0);
    });
});
