// @vitest-environment jsdom
/**
 * MissavStatusFilterPlugin UI 接线与三态交互回归测试。
 *
 * 覆盖：
 * 1. chip.dataset.value 为原始 status key（'favorite'/'hasWatch'），cell 级显隐与取消恢复；
 * 2. 右键单击排除（阻止默认菜单、同步 `aria-pressed="mixed"` 与 `jhs-filter-excluded`）；
 * 3. 左键双击单选包含、右键双击（350ms 内两次右键）单选排除；
 * 4. 筛选栏空白处双击一键清空所有包含/排除条件；
 * 5. 动态刷新保活排除态与零计数芯片、Enter/Space 键盘无障碍交互。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    FILTER_EXCLUDED_CLASS,
    FILTER_STATE_ATTR,
    RIGHT_DOUBLE_CLICK_MS
} from '../src/core/util/site/filter-chips';
import { MissavStatusFilterPlugin } from '../src/plugins/missav-status-filter/missav-status-filter-plugin';

/** 构造列表页 body：挂载点 + grid（2 favorite + 1 hasWatch + 1 filter + 1 无标签，各带包装 DIV）。 */
function buildPage(): void {
    document.body.innerHTML =
        '<div class="flex justify-between mb-6"></div>' +
        '<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">' +
        '<div id="c-fav-1"><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div></div>' +
        '<div id="c-fav-2"><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div></div>' +
        '<div id="c-watch"><div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div></div>' +
        '<div id="c-filter"><div class="thumbnail group"><span class="missav-status-tag" data-status="filter"></span></div></div>' +
        '<div id="c-none"><div class="thumbnail group"></div></div>' +
        '</div>';
}

function chipByValue(value: string): HTMLElement {
    const found = Array.from(document.querySelectorAll<HTMLElement>('.missav-status-filter-chip')).find(
        (c) => c.dataset.value === value
    );
    if (!found) throw new Error(`未找到芯片: ${value}`);
    return found;
}

function visibleCells(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.grid > div'))
        .filter((cell) => cell.style.display !== 'none')
        .map((cell) => cell.id);
}

function rightClick(el: HTMLElement): MouseEvent {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    el.dispatchEvent(event);
    return event;
}

function leftDblClick(el: HTMLElement): MouseEvent {
    const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 0 });
    el.dispatchEvent(event);
    return event;
}

describe('MissavStatusFilterPlugin UI 接线与三态交互', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('构建筛选栏，chip.value 为原始 key，点击筛选（隐藏 grid cell）/ 取消恢复', async () => {
        buildPage();
        const plugin = new MissavStatusFilterPlugin();
        try {
            await plugin.handle();

            const bar = document.querySelector('.missav-status-filter-bar');
            expect(bar).not.toBeNull();

            const chips = Array.from(document.querySelectorAll<HTMLElement>('.missav-status-filter-chip'));
            const values = chips.map((c) => c.dataset.value);
            expect(values).toContain('favorite');
            expect(values).toContain('hasWatch');
            expect(values).not.toContain('⭐ 已收藏');
            expect(values).not.toContain('🔍 已观看');
            expect(chips.find((c) => c.dataset.value === 'no-tag')).toBeDefined();

            const favChip = chipByValue('favorite');
            expect(favChip.textContent).toContain('⭐ 已收藏');
            favChip.click();
            expect(favChip.getAttribute('aria-pressed')).toBe('true');
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2']);
            expect(document.getElementById('c-watch')!.getAttribute('data-mstf-hidden')).toBe('yes');
            for (const item of Array.from(document.querySelectorAll<HTMLElement>('.thumbnail.group'))) {
                expect(item.getAttribute('data-mstf-hidden')).toBeNull();
                expect(item.style.display).toBe('');
            }

            favChip.click();
            expect(favChip.getAttribute('aria-pressed')).toBe('false');
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch', 'c-filter', 'c-none']);
        } finally {
            plugin.destroy();
        }
    });

    it('支持右键排除、左/右键双击单选以及筛选区空白处双击全清', async () => {
        buildPage();
        const plugin = new MissavStatusFilterPlugin();
        try {
            await plugin.handle();
            const bar = document.querySelector<HTMLElement>('.missav-status-filter-bar')!;

            // 1) 右键排除「已屏蔽」与「无状态标签」
            const filterChip = chipByValue('filter');
            const noTagChip = chipByValue('no-tag');
            const ev = rightClick(filterChip);
            expect(ev.defaultPrevented).toBe(true);
            expect(filterChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(true);
            expect(filterChip.getAttribute(FILTER_STATE_ATTR)).toBe('exclude');
            expect(filterChip.getAttribute('aria-pressed')).toBe('mixed');
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch', 'c-none']);

            rightClick(noTagChip);
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch']);

            // 2) 左键双击「已观看」→ 清空前述排除项并单选包含「已观看」
            const watchChip = chipByValue('hasWatch');
            leftDblClick(watchChip);
            expect(filterChip.getAttribute('aria-pressed')).toBe('false');
            expect(noTagChip.getAttribute('aria-pressed')).toBe('false');
            expect(watchChip.getAttribute('aria-pressed')).toBe('true');
            expect(visibleCells()).toEqual(['c-watch']);

            // 3) 叠加「已收藏」后右键双击「已收藏」（350ms 内两次右键）→ 清空「已观看」，仅排除「已收藏」
            const favChip = chipByValue('favorite');
            favChip.click();
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch']);

            rightClick(favChip);
            vi.advanceTimersByTime(100);
            rightClick(favChip);
            expect(watchChip.getAttribute('aria-pressed')).toBe('false');
            expect(favChip.getAttribute('aria-pressed')).toBe('mixed');
            expect(visibleCells()).toEqual(['c-watch', 'c-filter', 'c-none']);

            // 超过双击窗再次右键取消排除
            vi.advanceTimersByTime(RIGHT_DOUBLE_CLICK_MS + 50);
            rightClick(favChip);
            expect(favChip.getAttribute('aria-pressed')).toBe('false');
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch', 'c-filter', 'c-none']);

            // 4) 选中多项后在筛选栏空白处双击 → 一键清空全部条件
            favChip.click();
            rightClick(filterChip);
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2']);
            leftDblClick(bar);
            expect(bar.querySelectorAll('[aria-pressed="true"], [aria-pressed="mixed"]')).toHaveLength(0);
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch', 'c-filter', 'c-none']);
        } finally {
            plugin.destroy();
        }
    });

    it('DOM 动态变更刷新时保留排除态及零计数芯片，取消后自动清理；支持 Enter/Space 键盘操作', async () => {
        buildPage();
        const plugin = new MissavStatusFilterPlugin();
        try {
            await plugin.handle();

            // 右键排除「已屏蔽」，随后移除页面上唯一的已屏蔽卡片
            rightClick(chipByValue('filter'));
            document.getElementById('c-filter')!.remove();
            await vi.advanceTimersByTimeAsync(200);

            // 计数归零但因处于排除态仍保留芯片以便取消
            const staleChip = chipByValue('filter');
            expect(staleChip.textContent).toBe('🚫 已屏蔽 0');
            expect(staleChip.getAttribute('aria-pressed')).toBe('mixed');

            // 间隔后右键取消排除 → 过期零计数芯片立即移除
            vi.advanceTimersByTime(RIGHT_DOUBLE_CLICK_MS + 50);
            rightClick(staleChip);
            expect(document.querySelector('.missav-status-filter-chip[data-value="filter"]')).toBeNull();

            // Enter / Space 键盘切换包含态
            const watchChip = chipByValue('hasWatch');
            expect(watchChip.getAttribute('role')).toBe('button');
            expect(watchChip.tabIndex).toBe(0);
            watchChip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            expect(watchChip.getAttribute('aria-pressed')).toBe('true');
            expect(visibleCells()).toEqual(['c-watch']);

            watchChip.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
            expect(watchChip.getAttribute('aria-pressed')).toBe('false');
            expect(visibleCells()).toEqual(['c-fav-1', 'c-fav-2', 'c-watch', 'c-none']);
        } finally {
            plugin.destroy();
        }
    });

    it('支持 状态 ∩ MissAV原生收藏 ∩ JavDB归属清单 三栏交集筛选、各栏独立双击单选与栈空白区一键全清', async () => {
        document.body.innerHTML =
            '<div class="flex justify-between mb-6"></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">' +
            '<div id="m-1"><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span>' +
            '<div class="jhs-missav-card-meta" data-missav-saved="yes"><span class="jhs-missav-saved-badge">MissAV</span>' +
            '<div class="jhs-missav-vlt-tags"><a class="jhs-missav-vlt-tag" data-vlt-name="精选">精选</a></div></div></div></div>' +
            '<div id="m-2"><div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span>' +
            '<div class="jhs-missav-card-meta" data-missav-saved="no">' +
            '<div class="jhs-missav-vlt-tags"><a class="jhs-missav-vlt-tag" data-vlt-name="复盘">复盘</a></div></div></div></div>' +
            '<div id="m-3"><div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span>' +
            '<div class="jhs-missav-card-meta" data-missav-saved="yes"><span class="jhs-missav-saved-badge">MissAV</span>' +
            '<div class="jhs-missav-vlt-tags"><a class="jhs-missav-vlt-tag" data-vlt-name="精选">精选</a></div></div></div></div>' +
            '<div id="m-4"><div class="thumbnail group">' +
            '<div class="jhs-missav-card-meta" data-missav-saved="no"><div class="jhs-missav-vlt-tags"><span class="jhs-missav-vlt-empty">—</span></div></div></div></div>' +
            '</div>';

        const plugin = new MissavStatusFilterPlugin();
        try {
            await plugin.handle();

            const stack = document.querySelector<HTMLElement>('.jhs-missav-filter-stack')!;
            const savedChip = document.querySelector<HTMLElement>('.missav-saved-filter-chip[data-value="saved"]')!;
            const vltJingXuan = document.querySelector<HTMLElement>('.missav-vlt-filter-chip[data-value="精选"]')!;
            const vltNoTag = document.querySelector<HTMLElement>('.missav-vlt-filter-chip[data-value="no-vlt-tag"]')!;

            expect(savedChip.textContent).toBe('♥ 已收藏 2');
            expect(vltJingXuan.textContent).toBe('精选 2');
            expect(vltNoTag.textContent).toBe('无清单 1');

            // 1) 叠加 状态=favorite ∩ MissAV=saved ∩ 清单=精选 → 仅 m-1 显示
            chipByValue('favorite').click();
            expect(visibleCells()).toEqual(['m-1', 'm-2']);

            savedChip.click();
            expect(visibleCells()).toEqual(['m-1']);

            vltJingXuan.click();
            expect(visibleCells()).toEqual(['m-1']);

            // 2) 清单栏右键双击单选排除「精选」→ 仅重置清单栏，不清空状态栏与 MissAV 栏（结果全不匹配）
            rightClick(vltJingXuan);
            vi.advanceTimersByTime(100);
            rightClick(vltJingXuan);
            expect(chipByValue('favorite').getAttribute('aria-pressed')).toBe('true');
            expect(savedChip.getAttribute('aria-pressed')).toBe('true');
            expect(vltJingXuan.getAttribute('aria-pressed')).toBe('mixed');
            expect(visibleCells()).toEqual([]);

            // 3) 筛选栈空白处双击 → 一键清空全部三栏条件并恢复全部 4 张卡片
            leftDblClick(stack);
            expect(stack.querySelectorAll('[aria-pressed="true"], [aria-pressed="mixed"]')).toHaveLength(0);
            expect(visibleCells()).toEqual(['m-1', 'm-2', 'm-3', 'm-4']);
        } finally {
            plugin.destroy();
        }
    });
});
