// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRELOAD_FILTER_READY_EVENT, STATUS_FILTER_DATA_EVENT } from '../src/constants/weekly-recommend';
import { HAS_WATCH_ACTION } from '../src/constants/status';
import type { FilterScope } from '../src/types/filter-scope';
import type { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import { WeeklyRecommendFilters } from '../src/plugins/list-page/weekly-recommend-filters';
import { WeeklyRecommendController } from '../src/plugins/list-page/weekly-recommend';
import { pageContext } from '../src/core/page-context';
import { setCarRecords } from '../src/plugins/status-tag-filter/stf-score';

vi.mock('../src/core/page-context', () => ({ pageContext: { isHomePage: true } }));

const instances: Array<{ destroy(): void }> = [];

function card(id: string, status: string, list: string, preload: string): string {
    return `<div class="item" id="${id}"><a href="/v/${id}"><div class="video-title"><strong>${id}</strong></div>
        <div class="tags has-addons"><span class="tag is-success status-tag">${status}</span></div>
        <div class="jhs-vlt-tags-display"><span class="jhs-vlt-tag-link">${list}</span></div>
        <div class="jhs-preload-status"><span class="jhs-ps-badge jhs-ps-${preload}"></span></div></a></div>`;
}

function setup(ready = true) {
    document.body.innerHTML = `<section><div><div class="movie-list">${card('MAIN', '主状态', '主清单', 'failed')}</div></div></section>
        <div id="panel" data-jhs-filter-scope="recommend"><div id="filters"></div><div id="recommend-container">
        ${card('REC-1', '已读', '甲清单', 'success')}${card('REC-2', '已收藏', '乙清单', 'failed')}</div></div>`;
    const root = document.getElementById('panel')!;
    const scope: FilterScope = { root, mount: document.getElementById('filters')!, itemSelector: '#recommend-container .item' };
    const other = { preloadFilterReady: ready, preloadStatusEnabled: true } as OtherSitePlugin;
    const controller = new WeeklyRecommendFilters(scope, () => other);
    instances.push(controller);
    controller.init();
    return { root, scope, other, controller };
}

function click(root: ParentNode, selector: string): void {
    const button = root.querySelector<HTMLElement>(selector);
    expect(button).not.toBeNull();
    button!.click();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    instances.splice(0).forEach((instance) => instance.destroy());
    vi.useRealTimers();
    document.body.replaceChildren();
    setCarRecords([]);
    document.head.querySelectorAll('[data-test-style]').forEach((style) => style.remove());
});

describe('推荐三栏协调', () => {
    it('复用三套栏并按清单、状态、预加载排序，计数不含主流', () => {
        const { scope } = setup();
        expect(Array.from(scope.mount.children, (bar) => bar.className)).toEqual([
            'jhs-vlt-filter-bar', 'status-tag-filter-bar', 'preload-filter-bar'
        ]);
        expect(scope.mount.textContent).not.toContain('主状态');
        expect(scope.mount.textContent).not.toContain('主清单');
    });

    it('三栏筛选组成交集，逐栏清空不误恢复其他条件，主流不受影响', () => {
        const { root } = setup();
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        click(root, '.status-tag-filter-chip[data-value="已收藏"]');
        expect(document.getElementById('REC-1')!.style.display).toBe('none');
        expect(document.getElementById('REC-2')!.style.display).toBe('none');
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        expect(document.getElementById('REC-1')!.style.display).toBe('none');
        expect(document.getElementById('REC-2')!.style.display).toBe('');
        click(root, '.preload-filter-chip[data-value="success"]');
        expect(document.getElementById('REC-2')!.style.display).toBe('none');
        click(root, '.status-tag-filter-chip[data-value="已收藏"]');
        expect(document.getElementById('REC-1')!.style.display).toBe('');
        expect(document.getElementById('REC-2')!.style.display).toBe('none');
        expect(document.getElementById('MAIN')!.style.display).toBe('');
    });

    it('清单筛选变化后合并刷新预加载可见计数，不需要内容变更', () => {
        const { root } = setup();
        const failureChip = (): string | null => root.querySelector('[data-value="failed"]')!.textContent;
        expect(failureChip()).toContain('1');
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        vi.advanceTimersByTime(100);
        expect(failureChip()).toContain('0');
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        vi.advanceTimersByTime(100);
        expect(failureChip()).toContain('1');
    });

    it('配置晚到后才构建预加载栏，反复ready不重复创建', () => {
        const { root, other } = setup(false);
        expect(root.querySelector('.preload-filter-bar')).toBeNull();
        other.preloadFilterReady = true;
        document.dispatchEvent(new Event(PRELOAD_FILTER_READY_EVENT));
        document.dispatchEvent(new Event(PRELOAD_FILTER_READY_EVENT));
        expect(root.querySelectorAll('.preload-filter-bar')).toHaveLength(1);
    });

    it('评分索引晚到后不必重新打开即可更新推荐星级芯片', () => {
        const { root } = setup();
        expect(root.querySelector('[data-value="score:4"]')).toBeNull();
        setCarRecords([{ carNum: 'REC-1', status: HAS_WATCH_ACTION, score: 4 }]);
        document.dispatchEvent(new Event(STATUS_FILTER_DATA_EVENT));
        expect(root.querySelector('[data-value="score:4"]')?.textContent).toContain('1');
    });

    it('内容更新合批刷新并保留选中，不观察自身筛选DOM造成循环', async () => {
        const { root, scope, controller } = setup();
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        const refresh = vi.spyOn(controller, 'refresh');
        root.querySelector('#recommend-container')!.insertAdjacentHTML('beforeend', card('REC-3', '新状态', '新清单', 'queued'));
        await Promise.resolve();
        vi.advanceTimersByTime(100);
        await Promise.resolve();
        vi.advanceTimersByTime(1000);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(scope.mount.textContent).toContain('新状态');
        expect(root.querySelector('.jhs-vlt-filter-chip[data-value="甲清单"]')!.classList.contains('jhs-vlt-active')).toBe(true);
        expect(document.getElementById('REC-3')!.style.display).toBe('none');
    });

    it('销毁清理本地筛选标记，但保留基础屏蔽', () => {
        const { root, controller } = setup();
        click(root, '.jhs-vlt-filter-chip[data-value="甲清单"]');
        const blocked = document.getElementById('REC-2')!;
        blocked.setAttribute('data-hide', 'yes');
        controller.destroy();
        expect(blocked.hasAttribute('data-video-lists-tag-hidden')).toBe(false);
        expect(blocked.style.display).toBe('none');
    });
});

it('隐藏原生持久收起链接，保留节点且销毁后恢复原位置显示', () => {
    document.body.innerHTML = '<section><div><h1>每週推薦(週一/四更新)<a id="collapse" href="#">收起到下次更新</a></h1><div id="recommend-container"></div></div></section>';
    const anchor = document.getElementById('collapse')!;
    const originalParent = anchor.parentElement;
    const action = vi.fn();
    anchor.addEventListener('click', action);
    const style = document.createElement('style');
    style.dataset.testStyle = 'true';
    style.textContent = readFileSync(resolve('src/styles/list-page/weekly-recommend.css'), 'utf8');
    document.head.appendChild(style);
    pageContext.isHomePage = true;
    const controller = new WeeklyRecommendController();
    instances.push(controller);
    controller.init();
    expect(getComputedStyle(anchor).display).toBe('none');
    expect(action).not.toHaveBeenCalled();
    controller.destroy();
    expect(anchor.parentElement).toBe(originalParent);
    expect(getComputedStyle(anchor).display).not.toBe('none');
});
