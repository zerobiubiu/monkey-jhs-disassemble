// @vitest-environment jsdom
/**
 * MissavStatusFilterPlugin UI 接线测试（Task 2 审查回环修复验证 + doc/223 cell 级显隐）。
 *
 * 覆盖审查发现的最关键 wiring 缺陷（修复 1）：
 * 1. chip.dataset.value 必须存原始 status key（'favorite'/'hasWatch'），而非显示
 *    label（'⭐ 已收藏'）——否则 applyFilter 按 key 匹配时全部卡片被隐藏。
 * 2. 点击「⭐ 已收藏」chip → favorite 卡片保留（无 data-mstf-hidden），
 *    hasWatch / 无标签卡片被隐藏（data-mstf-hidden="yes"）。
 * 3. 再次点击取消 → 全部恢复显示。
 * 4. 显隐发生在 grid cell（外层包装 DIV）上而非缩略图自身（doc/223：隐藏 cell
 *    后 grid 自动重排不留空洞）。
 *
 * 说明：
 * - handle() 内 isVideoPage() 检查 #sprite-plyr，jsdom body 无此元素 → false，
 *   正常进入 tryBuild + startObserving。
 * - tryBuild 优先挂载点取 div.flex.justify-between.mb-6，测试 body 前置该元素。
 * - 每个用例结束后 plugin.destroy() 断开 observer，避免跨用例残留。
 */
import { afterEach, describe, expect, it } from 'vitest';

import { MissavStatusFilterPlugin } from '../src/plugins/missav-status-filter/missav-status-filter-plugin';

/** 构造列表页 body：挂载点 + grid（2 favorite + 1 hasWatch + 1 无标签，各带包装 DIV）。 */
function buildPage(): void {
    document.body.innerHTML =
        '<div class="flex justify-between mb-6"></div>' +
        '<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">' +
        '<div><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div></div>' +
        '<div><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div></div>' +
        '<div><div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div></div>' +
        '<div><div class="thumbnail group"></div></div>' +
        '</div>';
}

describe('MissavStatusFilterPlugin UI 接线', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('构建筛选栏，chip.value 为原始 key，点击筛选（隐藏 grid cell）/ 取消恢复', async () => {
        buildPage();
        const plugin = new MissavStatusFilterPlugin();
        try {
            await plugin.handle();

            // ① 筛选栏已挂载
            const bar = document.querySelector('.missav-status-filter-bar');
            expect(bar).not.toBeNull();

            // ② 芯片 dataset.value 为原始 status key 而非 label
            const chips = Array.from(document.querySelectorAll<HTMLElement>('.missav-status-filter-chip'));
            const values = chips.map((c) => c.dataset.value);
            expect(values).toContain('favorite');
            expect(values).toContain('hasWatch');
            expect(values).not.toContain('⭐ 已收藏');
            expect(values).not.toContain('🔍 已观看');
            // 无标签芯片 value 为 NO_TAG_VALUE
            expect(chips.find((c) => c.dataset.value === 'no-tag')).toBeDefined();

            // ③ 点击「⭐ 已收藏」chip → favorite 的 grid cell（包装 DIV）保留，
            //    hasWatch / 无标签的 grid cell 被隐藏（缩略图自身不受影响）
            const favChip = chips.find((c) => c.dataset.value === 'favorite')!;
            expect(favChip.textContent).toContain('⭐ 已收藏');
            favChip.click();
            const cells = Array.from(document.querySelectorAll<HTMLElement>('.grid > div'));
            expect(cells[0].getAttribute('data-mstf-hidden')).toBeNull();
            expect(cells[1].getAttribute('data-mstf-hidden')).toBeNull();
            expect(cells[2].getAttribute('data-mstf-hidden')).toBe('yes');
            expect(cells[3].getAttribute('data-mstf-hidden')).toBe('yes');
            // 缩略图自身无标记、未隐藏
            for (const item of Array.from(document.querySelectorAll<HTMLElement>('.thumbnail.group'))) {
                expect(item.getAttribute('data-mstf-hidden')).toBeNull();
                expect(item.style.display).toBe('');
            }

            // ④ 再次点击取消 → 全部 grid cell 恢复
            favChip.click();
            for (const cell of Array.from(document.querySelectorAll<HTMLElement>('.grid > div'))) {
                expect(cell.getAttribute('data-mstf-hidden')).toBeNull();
                expect(cell.style.display).toBe('');
            }
        } finally {
            plugin.destroy();
        }
    });
});