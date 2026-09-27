// @vitest-environment jsdom
/**
 * 预加载优先级排序（`osp-preload-order.ts`）回归测试。
 *
 * 需求 doc/25 Q3：带状态标签（已读/已收藏）的卡片降为最低优先级，排到预加载队列末尾。
 */
import { describe, expect, it } from 'vitest';
import { orderItemsByPreloadPriority } from '../src/plugins/other-site/osp-preload-order';

/** 构造卡片并把它挂到 document 上（HTMLElement 才可比对）。 */
function makeItems(carNums: string[]): { items: HTMLElement[]; numOf: (el: HTMLElement) => string } {
    document.body.innerHTML = carNums
        .map((num) => `<div class="item" data-car="${num}"><strong>${num}</strong></div>`)
        .join('');
    const items = Array.from(document.querySelectorAll<HTMLElement>('.item'));
    return { items, numOf: (el: HTMLElement): string => el.getAttribute('data-car') ?? '' };
}

describe('预加载优先级排序', () => {
    it('带状态标签的卡片保持原序移到队列末尾', () => {
        const { items, numOf } = makeItems(['A', 'B', 'C', 'D', 'E']);
        const ordered = orderItemsByPreloadPriority(items, new Set(['b', 'd']), numOf);
        expect(ordered.map(numOf)).toEqual(['A', 'C', 'E', 'B', 'D']);
    });

    it('番号匹配不区分大小写（car_list 与页面大小写可能不一致）', () => {
        const { items, numOf } = makeItems(['dazd-314', 'ABC-1']);
        const ordered = orderItemsByPreloadPriority(items, new Set(['dazd-314']), numOf);
        expect(ordered.map(numOf)).toEqual(['ABC-1', 'dazd-314']);
    });

    it('番号取不到时按常规优先级处理（不因解析失败而降级）', () => {
        const { items, numOf } = makeItems(['A', 'B']);
        const ordered = orderItemsByPreloadPriority(items, new Set(['a', 'b']), () => '');
        expect(ordered).toBe(items);
    });

    it('无已读/已收藏记录时原样返回（同一数组引用，零开销）', () => {
        const { items, numOf } = makeItems(['A', 'B']);
        expect(orderItemsByPreloadPriority(items, new Set(), numOf)).toBe(items);
    });

    it('有记录但页面无命中时也原样返回', () => {
        const { items, numOf } = makeItems(['A', 'B']);
        expect(orderItemsByPreloadPriority(items, new Set(['zzz']), numOf)).toBe(items);
    });
});
