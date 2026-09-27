/**
 * 列表页批量操作纯逻辑（`lp-batch-state.ts`）回归测试（doc/27）。
 *
 * 覆盖勾选集合与三类写入计划：跳过条件（已在收藏/信息缺失）、星级透传、
 * 「取消已读」只命中当前已读记录。
 */
import { describe, expect, it } from 'vitest';
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import {
    BatchSelection,
    planFavoriteBatch,
    planUnwatchBatch,
    planWatchedBatch
} from '../src/plugins/list-page/lp-batch-state';
import type { BatchItemInfo } from '../src/plugins/list-page/lp-batch-state';

function makeInfos(...carNums: string[]): Map<string, BatchItemInfo> {
    const map = new Map<string, BatchItemInfo>();
    for (const carNum of carNums) {
        map.set(carNum.toLowerCase(), {
            carNum,
            url: `/v/${carNum}`,
            names: `${carNum} 演员`,
            publishTime: '2026-01-01'
        });
    }
    return map;
}

describe('BatchSelection', () => {
    it('toggle 返回切换后的状态，大小写不敏感', () => {
        const selection = new BatchSelection();
        expect(selection.toggle('DAZD-314')).toBe(true);
        expect(selection.has('dazd-314')).toBe(true);
        expect(selection.toggle('dazd-314')).toBe(false);
        expect(selection.has('DAZD-314')).toBe(false);
        expect(selection.size).toBe(0);
    });

    it('list / clear', () => {
        const selection = new BatchSelection();
        selection.toggle('A');
        selection.toggle('B');
        expect(selection.size).toBe(2);
        expect(selection.list().sort()).toEqual(['a', 'b']);
        selection.clear();
        expect(selection.size).toBe(0);
        expect(selection.list()).toEqual([]);
    });
});

describe('planFavoriteBatch', () => {
    it('生成收藏写入（透传 url/names/publishTime + actionType）', () => {
        const plan = planFavoriteBatch(['DAZD-314'], makeInfos('DAZD-314'), []);
        expect(plan.inputs).toEqual([
            {
                carNum: 'DAZD-314',
                url: '/v/DAZD-314',
                names: 'DAZD-314 演员',
                publishTime: '2026-01-01',
                actionType: FAVORITE_ACTION
            }
        ]);
        expect(plan.skipped).toEqual([]);
        expect(plan.missing).toEqual([]);
    });

    it('已在收藏列表的番号跳过（存储层重复收藏会抛错）', () => {
        const plan = planFavoriteBatch(['A', 'b'], makeInfos('A', 'B'), ['a']);
        expect(plan.inputs.map((i) => i.carNum)).toEqual(['B']);
        expect(plan.skipped).toEqual(['A']);
    });

    it('页面找不到卡片信息 → missing', () => {
        const plan = planFavoriteBatch(['A', 'X'], makeInfos('A'), []);
        expect(plan.inputs.map((i) => i.carNum)).toEqual(['A']);
        expect(plan.missing).toEqual(['X']);
    });
});

describe('planWatchedBatch', () => {
    it('写入已读 + 星级，已在已读列表的也照常写入（用于改星）', () => {
        const plan = planWatchedBatch(['A', 'B'], makeInfos('A', 'B'), 3);
        expect(plan.inputs).toHaveLength(2);
        expect(plan.inputs[0]).toMatchObject({ carNum: 'A', actionType: HAS_WATCH_ACTION, score: 3 });
        expect(plan.inputs[1]).toMatchObject({ carNum: 'B', score: 3 });
        expect(plan.skipped).toEqual([]);
    });

    it('score=0 表示已读未评分（0 会被完整透传，不被丢弃）', () => {
        const plan = planWatchedBatch(['A'], makeInfos('A'), 0);
        expect(plan.inputs[0].score).toBe(0);
    });
});

describe('planUnwatchBatch', () => {
    it('只对当前已读的记录生效，其余跳过（不误清收藏状态）', () => {
        const result = planUnwatchBatch(['A', 'B', 'C'], ['a', 'C']);
        expect(result.carNums).toEqual(['A', 'C']);
        expect(result.skipped).toEqual(['B']);
    });

    it('无已读记录时全部跳过', () => {
        const result = planUnwatchBatch(['A'], []);
        expect(result.carNums).toEqual([]);
        expect(result.skipped).toEqual(['A']);
    });
});
