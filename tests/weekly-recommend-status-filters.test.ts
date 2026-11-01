// @vitest-environment jsdom
/** 同一状态/星级筛选器在主流和推荐范围独立运行，交集由真实标记协调。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HAS_WATCH_ACTION } from '../src/constants/status';
import { pageContext } from '../src/core/page-context';
import type { CarRecord } from '../src/core/storage-manager';
import type { FilterScope } from '../src/types/filter-scope';
import { StatusTagFilterPlugin } from '../src/plugins/status-tag-filter-plugin';
import { applyFilter } from '../src/plugins/status-tag-filter/stf-apply';
import { collectStatusTagCounts, countNoStatusItems } from '../src/plugins/status-tag-filter/stf-collect';
import { collectMissingStatusTags, countWatchedByScore, setCarRecords, setScoreFallbackResolver } from '../src/plugins/status-tag-filter/stf-score';
import { doBuild, type StatusFilterBar } from '../src/plugins/status-tag-filter/stf-ui';

let scope: FilterScope;
let activePlugin: StatusTagFilterPlugin | undefined;

function card(id: string, tag = '', attrs = ''): string {
    return `<div class="item" id="${id}" ${attrs}><div class="video-title"><strong>${id}</strong></div>` +
        (tag ? `<div class="tags has-addons"><span class="tag is-success status-tag">${tag}</span></div>` : '') + '</div>';
}

function item(id: string): HTMLElement {
    return document.getElementById(id)!;
}

function chip(bar: HTMLElement, value: string): HTMLElement {
    const found = [...bar.querySelectorAll<HTMLElement>('.status-tag-filter-chip')].find((entry) => entry.dataset.value === value);
    if (!found) throw new Error(`未生成筛选芯片 ${value}`);
    return found;
}

function records(): CarRecord[] {
    return [
        { carNum: 'M3', status: HAS_WATCH_ACTION, score: 3 },
        { carNum: 'R5', status: HAS_WATCH_ACTION, score: 5 },
        { carNum: 'R2', status: HAS_WATCH_ACTION, score: 2 },
        { carNum: 'RB', status: HAS_WATCH_ACTION, score: 1 },
    ] as CarRecord[];
}

function buildBoth(): { mainBar: StatusFilterBar; recommendBar: StatusFilterBar } {
    // 刻意先建推荐栏，覆盖主插件误认首个同名栏而跳过挂载的历史风险。
    const recommendBar = doBuild(undefined, scope)!;
    const mainBar = doBuild()!;
    return { mainBar, recommendBar };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = `<section><div><div class="movie-list" id="main-list">${card('M3', '主流状态')}${card('M0')}</div></div></section>` +
        `<aside id="weekly" data-jhs-filter-scope="weekly"><div id="weekly-filters"></div><div id="recommend-container">` +
        `${card('R5', '已收藏')}${card('R2', '已观看')}${card('R0')}${card('RB', '已收藏', 'data-hide="yes" style="display:none"')}` +
        '</div></aside>';
    scope = { root: item('weekly'), mount: item('weekly-filters'), itemSelector: '#recommend-container .item' };
    setCarRecords(records());
    setScoreFallbackResolver(null);
    pageContext.isListPage = true;
});

afterEach(() => {
    activePlugin?.destroy();
    activePlugin = undefined;
    setCarRecords([]);
    setScoreFallbackResolver(null);
    pageContext.isListPage = false;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('主流与推荐的状态/星级范围', () => {
    it('状态、无标签和评分计数各限于本区，基础屏蔽不进入推荐计数', () => {
        expect(collectStatusTagCounts()).toEqual({ 主流状态: 1 });
        expect(collectStatusTagCounts(scope)).toEqual({ 已收藏: 1, 已观看: 1 });
        expect(countNoStatusItems()).toBe(1);
        expect(countNoStatusItems(scope)).toBe(1);
        expect(countWatchedByScore()).toEqual({ 3: 1 });
        expect(countWatchedByScore(scope)).toEqual({ 2: 1, 5: 1 });
    });

    it('推荐先建也不阻碍主栏挂载，两次构建各自返回原栏且不重复', () => {
        const { mainBar, recommendBar } = buildBoth();
        expect(mainBar).not.toBe(recommendBar);
        expect(recommendBar.parentElement).toBe(scope.mount);
        expect(mainBar.closest('#weekly')).toBeNull();
        expect(doBuild()).toBe(mainBar);
        expect(doBuild(undefined, scope)).toBe(recommendBar);
        expect(document.querySelectorAll('.status-tag-filter-bar')).toHaveLength(2);
        expect(chip(mainBar, 'score:3').textContent).toBe('3星 1');
        expect(chip(recommendBar, 'score:5').textContent).toBe('5星 1');
    });

    it('点击推荐状态只筛推荐，点击主流状态也不读取推荐激活芯片', () => {
        const { mainBar, recommendBar } = buildBoth();
        chip(recommendBar, '已收藏').click();
        expect(item('R5').style.display).toBe('');
        expect(item('R2').style.display).toBe('none');
        expect(item('R0').style.display).toBe('none');
        expect(item('M3').style.display).toBe('');
        expect(item('M0').style.display).toBe('');

        chip(mainBar, '主流状态').click();
        expect(item('M3').style.display).toBe('');
        expect(item('M0').style.display).toBe('none');
        expect(item('R5').style.display).toBe('');
        expect(item('R2').style.display).toBe('none');
        expect(chip(recommendBar, '已收藏').classList.contains('active')).toBe(true);
    });

    it('推荐星级按共享个人评分索引筛选，但不会隐藏主流同区外卡片', () => {
        const { recommendBar } = buildBoth();
        chip(recommendBar, 'score:2').click();
        expect(item('R2').style.display).toBe('');
        expect(item('R5').style.display).toBe('none');
        expect(item('R0').style.display).toBe('none');
        expect(item('M3').style.display).toBe('');
        expect(item('M0').style.display).toBe('');
    });

    it('刷新保留本栏状态与星级激活值，结果消失也保留零计数芯片', () => {
        const { mainBar, recommendBar } = buildBoth();
        chip(mainBar, '主流状态').click();
        chip(recommendBar, '已收藏').click();
        chip(recommendBar, 'score:5').click();
        item('R5').remove();
        recommendBar._refreshChips();
        applyFilter(scope);

        expect(chip(recommendBar, '已收藏').classList.contains('active')).toBe(true);
        expect(chip(recommendBar, '已收藏').textContent).toBe('已收藏 0');
        expect(chip(recommendBar, 'score:5').classList.contains('active')).toBe(true);
        expect(chip(recommendBar, 'score:5').textContent).toBe('5星 0');
        expect(chip(mainBar, '主流状态').classList.contains('active')).toBe(true);
        expect(item('R2').style.display).toBe('none');
        expect(item('M3').style.display).toBe('');
    });

    it('缺标签补渲染的默认入口继续只收集主流，不把推荐加入主计数路径', () => {
        const missing = collectMissingStatusTags(() => false);
        expect(missing.map((entry) => entry.carNum)).toEqual(['M3']);
    });
});

describe('推荐状态与其他两栏的交集', () => {
    it('其他栏先隐藏时仍独立计算本栏，清空只清自身且保留基础/LRS标记', () => {
        const { recommendBar } = buildBoth();
        item('R5').setAttribute('data-video-lists-tag-hidden', '');
        item('R5').style.display = 'none';
        item('R2').setAttribute('data-preload-hidden', '');
        item('R2').style.display = 'none';
        item('R0').setAttribute('data-lrs-hidden', '');
        item('R0').style.display = 'none';

        chip(recommendBar, '已收藏').click();
        expect(item('R5').hasAttribute('data-status-tag-hidden')).toBe(false);
        expect(item('R5').style.display).toBe('none');
        expect(item('R2').hasAttribute('data-status-tag-hidden')).toBe(true);
        item('R2').removeAttribute('data-preload-hidden');
        applyFilter(scope);
        expect(item('R2').style.display).toBe('none');

        chip(recommendBar, '已收藏').click();
        expect(item('R2').hasAttribute('data-status-tag-hidden')).toBe(false);
        expect(item('R2').style.display).toBe('');
        expect(item('R5').style.display).toBe('none');
        expect(item('R5').hasAttribute('data-video-lists-tag-hidden')).toBe(true);
        expect(item('R0').style.display).toBe('none');
        expect(item('R0').hasAttribute('data-lrs-hidden')).toBe(true);
        expect(item('RB').style.display).toBe('none');
        expect(item('RB').getAttribute('data-hide')).toBe('yes');
    });
});

describe('StatusTagFilterPlugin 主栏接线', () => {
    it('真实主插件不把推荐栏当主栏，主流变更刷新也不重写推荐激活状态', async () => {
        const recommendBar = doBuild(undefined, scope)!;
        chip(recommendBar, '已收藏').click();
        activePlugin = new StatusTagFilterPlugin();
        vi.spyOn(activePlugin, 'warmScoreIndex').mockResolvedValue(undefined);
        await activePlugin.handle();
        const mainBar = document.querySelector<StatusFilterBar>('.jhs-filter-stack .status-tag-filter-bar')!;
        expect(mainBar).not.toBeNull();
        expect(mainBar).not.toBe(recommendBar);
        item('main-list').insertAdjacentHTML('beforeend', card('M-NEW', '新增主标签'));
        await vi.advanceTimersByTimeAsync(300);

        expect(chip(mainBar, '新增主标签').textContent).toBe('新增主标签 1');
        expect(chip(recommendBar, '已收藏').classList.contains('active')).toBe(true);
        expect(recommendBar.textContent).not.toContain('新增主标签');
        expect(item('R2').style.display).toBe('none');
    });
});
