// @vitest-environment jsdom
/**
 * 评分持久化判定（`rating-persist.ts`）测试（doc/29）。
 *
 * 只补空缺：无记录不新建、非已读不写、已有 score（含主动 0 星）不覆盖。
 * `persistRating` 的 IO 部分依赖 storageManager（运行时全局），此处只覆盖纯判定。
 */
import { describe, expect, it } from 'vitest';
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import { decideRatingPersist } from '../src/plugins/rating-display/rating-persist';

describe('decideRatingPersist', () => {
    it('已读且无 score → write（补空缺）', () => {
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION }, 4)).toBe('write');
    });

    it('已读且 score 为 undefined/null → write', () => {
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION, score: undefined }, 3)).toBe('write');
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION, score: null }, 3)).toBe('write');
    });

    it('已读但**已有** score → has-score（不覆盖，含主动评 0 星）', () => {
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION, score: 2 }, 5)).toBe('has-score');
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION, score: 0 }, 5)).toBe('has-score');
    });

    it('非已读记录 → not-watched（评分只对已读有意义）', () => {
        expect(decideRatingPersist({ status: FAVORITE_ACTION }, 4)).toBe('not-watched');
        expect(decideRatingPersist({ status: '' }, 4)).toBe('not-watched');
    });

    it('car_list 里没有该番号 → no-record（不新建记录）', () => {
        expect(decideRatingPersist(undefined, 4)).toBe('no-record');
        expect(decideRatingPersist(null, 4)).toBe('no-record');
    });

    it('非法评分（越界 / 非有限数）→ invalid-rating', () => {
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION }, 0)).toBe('invalid-rating');
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION }, 6)).toBe('invalid-rating');
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION }, NaN)).toBe('invalid-rating');
        expect(decideRatingPersist({ status: HAS_WATCH_ACTION }, Infinity)).toBe('invalid-rating');
    });

    it('非法评分优先级高于记录存在性（不因缺记录而漏判）', () => {
        expect(decideRatingPersist(undefined, 9)).toBe('invalid-rating');
    });
});
