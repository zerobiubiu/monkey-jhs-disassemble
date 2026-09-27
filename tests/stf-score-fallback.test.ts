/**
 * 已读星级「缺失 score 回退」测试（doc/28）。
 *
 * `car_list.score` 与 JavDB 个人评分缓存（`RatingCache`）是两套独立来源：
 * 记录**有** score 时以记录为准；**没有** score 时回退到外部评分源；两边都没有才是 0。
 *
 * 回退源通过 `setScoreFallbackResolver` 注入，因此本模块保持零插件依赖、可直接单测。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HAS_WATCH_ACTION, FAVORITE_ACTION } from '../src/constants/status';
import {
    getScore,
    setCarRecords,
    setScoreFallbackResolver
} from '../src/plugins/status-tag-filter/stf-score';

/** 造一条 car_list 记录（score 缺省表示「记录里没有 score 字段」）。 */
function record(carNum: string, status: string, score?: number): Record<string, unknown> {
    return score === undefined ? { carNum, status } : { carNum, status, score };
}

afterEach(() => {
    setScoreFallbackResolver(null);
    setCarRecords([]);
});

describe('缺失 score 回退到外部评分源', () => {
    it('记录没有 score 时用回退源（JavDB 个人评分）', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION)] as never);
        setScoreFallbackResolver(() => 4);
        expect(getScore('A')).toBe(4);
    });

    it('回退源也没有 → 0（已读未评分）', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION)] as never);
        setScoreFallbackResolver(() => null);
        expect(getScore('A')).toBe(0);
    });

    it('未注入回退源时行为与旧实现一致（缺失 → 0）', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION)] as never);
        expect(getScore('A')).toBe(0);
    });

    it('记录有 score 时**不查**回退源（记录优先）', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION, 2)] as never);
        const resolver = vi.fn(() => 5);
        setScoreFallbackResolver(resolver);
        expect(getScore('A')).toBe(2);
        expect(resolver).not.toHaveBeenCalled();
    });

    it('记录里 score=0（真的评 0 星）与「没有 score」区分开：前者不查回退源', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION, 0)] as never);
        const resolver = vi.fn(() => 5);
        setScoreFallbackResolver(resolver);
        expect(getScore('A')).toBe(0);
        expect(resolver).not.toHaveBeenCalled();
    });

    it('非已读记录不取评分（回退源也不查）', () => {
        setCarRecords([record('A', FAVORITE_ACTION)] as never);
        const resolver = vi.fn(() => 4);
        setScoreFallbackResolver(resolver);
        expect(getScore('A')).toBeNull();
        expect(resolver).not.toHaveBeenCalled();
    });

    it('回退值越界/小数会被归一化到 0–5 整数', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION), record('B', HAS_WATCH_ACTION)] as never);
        setScoreFallbackResolver((carNum: string) => (carNum === 'A' ? 7 : 3.4));
        expect(getScore('A')).toBe(5);
        expect(getScore('B')).toBe(3);
    });

    it('传 null 取消回退源', () => {
        setCarRecords([record('A', HAS_WATCH_ACTION)] as never);
        setScoreFallbackResolver(() => 4);
        expect(getScore('A')).toBe(4);
        setScoreFallbackResolver(null);
        expect(getScore('A')).toBe(0);
    });
});
