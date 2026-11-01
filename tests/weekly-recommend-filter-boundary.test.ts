// @vitest-environment jsdom
/** 推荐区解析清单标签，但不参与主列表清单与预加载筛选统计。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskSupervisor } from '../src/core/task-supervisor';
import { initFilterBar } from '../src/plugins/other-site/osp-filter-bar';
import type { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import {
    applyFilter,
    collectAllUniqueTags,
    collectTagCounts,
    countNoTagItems,
    TAG_HIDDEN_ATTR
} from '../src/plugins/video-lists-tag/vlt-filter-apply';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

function card(id: string, tag: string, status: string): string {
    return `<div id="${id}" class="item"><a href="/v/${id}">
        <div class="video-title"><strong>${id}</strong></div><div class="meta"></div></a>
        ${tag ? `<span class="jhs-vlt-tag-link">${tag}</span>` : ''}
        <div class="jhs-preload-status"><span class="jhs-ps-badge jhs-ps-${status}"></span></div>
    </div>`;
}

function fixture(moved: boolean): void {
    document.body.innerHTML = `<section><div>
        <div id="recommend-container" class="movie-list">
            ${card('REC', '推荐专属', 'success')}${card('REC-EMPTY', '', 'success')}
        </div>
        <div class="movie-list">
            ${card('MAIN', '主列表', 'success')}${card('OTHER', '', 'failed')}
        </div>
    </div></section>`;
    if (moved) document.body.appendChild(document.getElementById('recommend-container')!);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

describe.each([false, true])('推荐搬入浮层=%s 时的筛选边界', (moved) => {
    it('标签统计与清单筛选只处理主列表，清空筛选不恢复推荐的既有隐藏', () => {
        fixture(moved);
        const plugin = new VltTags();
        const recommendation = document.getElementById('REC')!;
        expect(collectAllUniqueTags()).toEqual(['主列表']);
        expect(collectTagCounts()).toEqual({ 主列表: 1 });
        expect(countNoTagItems()).toBe(1);
        const chip = document.createElement('span');
        chip.className = 'jhs-vlt-filter-chip jhs-vlt-active';
        chip.dataset.value = '主列表';
        document.body.appendChild(chip);

        applyFilter(plugin);

        expect(document.getElementById('OTHER')!.style.display).toBe('none');
        expect(recommendation.style.display).toBe('');
        recommendation.setAttribute(TAG_HIDDEN_ATTR, '');
        recommendation.style.display = 'none';
        chip.remove();
        applyFilter(plugin);
        expect(document.getElementById('OTHER')!.style.display).toBe('');
        expect(recommendation.style.display).toBe('none');
        expect(recommendation.hasAttribute(TAG_HIDDEN_ATTR)).toBe(true);
    });

    it('预加载芯片数量与点击筛选排除推荐，取消筛选不触碰推荐隐藏状态', () => {
        fixture(moved);
        const supervisor = new TaskSupervisor();
        const plugin = { preloadStatusEnabled: true, supervisor } as unknown as OtherSitePlugin;
        initFilterBar(plugin);
        const successChip = document.querySelector<HTMLElement>('.preload-filter-chip[data-value="success"]')!;
        const recommendation = document.getElementById('REC')!;
        expect(successChip.textContent).toBe('成功匹配 1');

        successChip.click();

        expect(document.getElementById('OTHER')!.style.display).toBe('none');
        expect(recommendation.style.display).toBe('');
        recommendation.setAttribute('data-preload-hidden', '');
        recommendation.style.display = 'none';
        successChip.click();
        expect(document.getElementById('OTHER')!.style.display).toBe('');
        expect(recommendation.style.display).toBe('none');
        expect(recommendation.hasAttribute('data-preload-hidden')).toBe(true);
        supervisor.abort();
    });

    it('增量卡片入口同时为推荐与主列表渲染和查询标签', async () => {
        fixture(moved);
        const plugin = new VltTags();
        const render = vi.spyOn(plugin, 'addTagDisplay').mockImplementation(() => {});
        const fetch = vi.spyOn(plugin, 'fetchAndMergeTags').mockResolvedValue();
        vi.spyOn(plugin, 'updateFilterBar').mockImplementation(() => {});
        const recommendation = document.getElementById('REC')!;
        const main = document.getElementById('MAIN')!;

        await plugin.handleNewItems([recommendation, main]);
        await vi.runAllTimersAsync();

        expect(fetch).toHaveBeenCalledExactlyOnceWith(['REC', 'MAIN']);
        expect(render).toHaveBeenCalledWith(main);
        expect(render).toHaveBeenCalledWith(recommendation);
    });
});
