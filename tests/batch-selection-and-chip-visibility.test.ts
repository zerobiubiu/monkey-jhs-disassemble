/**
 * doc/30 打磨引入的两处纯逻辑测试：
 * 1. `BatchSelection.addAll / invert` —— 「全选 / 反选」的集合语义；
 * 2. `visibleScoreChips` —— 星级芯片只显示当前页实际存在的档位（与「已观看/已收藏/
 *    无状态标签」一致的展示口径）。
 */
import { describe, expect, it } from 'vitest';
import { BatchSelection } from '../src/plugins/list-page/lp-batch-state';
import { SCORE_VALUE_PREFIX, visibleScoreChips } from '../src/plugins/status-tag-filter/stf-score';

describe('BatchSelection 批量选择', () => {
    it('addAll 取并集，保留已有选择', () => {
        const selection = new BatchSelection();
        selection.toggle('X-1');
        selection.addAll(['a-1', 'B-2']);
        expect(selection.size).toBe(3);
        expect(selection.has('x-1')).toBe(true);
        expect(selection.has('A-1')).toBe(true);
        expect(selection.has('b-2')).toBe(true);
    });

    it('addAll 对已选番号幂等（不重复计数）', () => {
        const selection = new BatchSelection();
        selection.addAll(['a-1', 'A-1']);
        selection.addAll(['a-1']);
        expect(selection.size).toBe(1);
    });

    it('invert 只翻转给定集合，集合外的选择保持不动', () => {
        const selection = new BatchSelection();
        selection.addAll(['a-1', 'outside']);
        selection.invert(['a-1', 'b-2']);
        expect(selection.has('a-1')).toBe(false); // 集合内已选 → 取消
        expect(selection.has('b-2')).toBe(true); // 集合内未选 → 选中
        expect(selection.has('outside')).toBe(true); // 集合外不受影响
    });

    it('invert 两次回到原状态', () => {
        const selection = new BatchSelection();
        selection.addAll(['a-1', 'b-2']);
        selection.invert(['a-1', 'b-2']);
        expect(selection.size).toBe(0);
        selection.invert(['a-1', 'b-2']);
        expect(selection.size).toBe(2);
    });
});

describe('visibleScoreChips 星级芯片可见档位', () => {
    it('只返回当前页有卡片的档位（不再铺开 0–5）', () => {
        expect(visibleScoreChips({ 3: 5, 5: 1 }, new Set())).toEqual([3, 5]);
    });

    it('全为 0 时返回空（无已读卡片 → 不生成任何星级芯片）', () => {
        expect(visibleScoreChips({}, new Set())).toEqual([]);
        expect(visibleScoreChips({ 0: 0, 1: 0 }, new Set())).toEqual([]);
    });

    it('已激活档位计数为 0 时仍保留（筛选态不无声消失）', () => {
        expect(visibleScoreChips({}, new Set([`${SCORE_VALUE_PREFIX}2`]))).toEqual([2]);
    });

    it('返回顺序按分数升序', () => {
        expect(visibleScoreChips({ 5: 1, 1: 2, 3: 1 }, new Set())).toEqual([1, 3, 5]);
    });
});
