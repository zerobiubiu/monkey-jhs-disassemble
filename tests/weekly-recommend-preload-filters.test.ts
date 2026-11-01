// @vitest-environment jsdom
/** 同页两套预加载筛选独立计数和选中，推荐内三栏按标记交集显示。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FilterScope } from '../src/types/filter-scope';
import { TaskSupervisor } from '../src/core/task-supervisor';
import { PRELOAD_QUEUE_TOGGLE_EVENT } from '../src/plugins/list-page/lp-batch';
import type { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import {
    buildFilterBar,
    ensureFilterBar,
    PRELOAD_HIDDEN_ATTR,
    refreshFilterBar,
    refreshScopedPreloadFilter
} from '../src/plugins/other-site/osp-filter-bar';
import { togglePreloadQueuePanel } from '../src/plugins/other-site/osp-preload-panel';

vi.mock('../src/plugins/other-site/osp-preload-panel', () => ({ togglePreloadQueuePanel: vi.fn() }));

const supervisors: TaskSupervisor[] = [];

function card(id: string, status: string): string {
    return `<div class="item" id="${id}"><div class="jhs-preload-status">
        <span class="jhs-ps-badge jhs-ps-${status}"></span></div></div>`;
}

function fixture(): { plugin: OtherSitePlugin; scope: FilterScope } {
    document.body.innerHTML = `<section><div><div class="movie-list">
        ${card('main-success', 'success')}${card('main-failed', 'failed')}
    </div></div></section>${card('bare-success', 'success')}
    <div id="recommend-scope" data-jhs-filter-scope="weekly-recommend">
        <div id="scoped-controls"></div><div id="recommend-container">
            ${card('rec-success', 'success')}${card('rec-failed', 'failed')}
        </div>
    </div>`;
    const supervisor = new TaskSupervisor();
    supervisors.push(supervisor);
    const plugin = {
        preloadStatusEnabled: true,
        preloadFilterReady: true,
        filterRefreshDebounce: 0,
        supervisor
    } as unknown as OtherSitePlugin;
    return {
        plugin,
        scope: {
            root: document.getElementById('recommend-scope')!,
            mount: document.getElementById('scoped-controls')!,
            itemSelector: '#recommend-container .item'
        }
    };
}

function chip(root: ParentNode, value: string): HTMLElement {
    return root.querySelector<HTMLElement>(`.preload-filter-chip[data-value="${value}"]`)!;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    supervisors.splice(0).forEach((supervisor) => supervisor.abort());
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.replaceChildren();
});

describe('推荐面板独立预加载筛选', () => {
    it('主栏与推荐栏分别统计自身范围，重复构建不会新增 DOM', () => {
        const { plugin, scope } = fixture();
        const scoped = buildFilterBar(plugin, scope)!;
        expect(document.querySelector('.jhs-filter-stack')).toBeNull();
        ensureFilterBar(plugin);
        const main = document.querySelector('.jhs-filter-stack .preload-filter-bar')!;
        expect(chip(main, 'success').textContent).toBe('成功匹配 1');
        expect(chip(scoped, 'success').textContent).toBe('成功匹配 1');
        expect(buildFilterBar(plugin, scope)).toBe(scoped);
        expect(document.querySelectorAll('.preload-filter-bar')).toHaveLength(2);
        expect(document.getElementById('bare-success')!.hasAttribute(PRELOAD_HIDDEN_ATTR)).toBe(false);
    });

    it('两栏可选择相反条件，推荐芯片不会参与主栏筛选', () => {
        const { plugin, scope } = fixture();
        const main = buildFilterBar(plugin)!;
        const scoped = buildFilterBar(plugin, scope)!;
        chip(main, 'success').click();
        chip(scoped, 'failed').click();
        expect(document.getElementById('main-failed')!.style.display).toBe('none');
        expect(document.getElementById('main-success')!.style.display).toBe('');
        expect(document.getElementById('rec-failed')!.style.display).toBe('');
        expect(document.getElementById('rec-success')!.style.display).toBe('none');
        chip(scoped, 'failed').click();
        expect(document.getElementById('rec-success')!.style.display).toBe('');
        expect(document.getElementById('main-failed')!.style.display).toBe('none');
        expect(document.getElementById('bare-success')!.style.display).toBe('');
    });

    it('刷新推荐计数保留选择和本栏筛选，不占用主栏防抖计时器', async () => {
        const { plugin, scope } = fixture();
        const main = buildFilterBar(plugin)!;
        const scoped = buildFilterBar(plugin, scope)!;
        chip(scoped, 'failed').click();
        refreshFilterBar(plugin);
        const mainTimer = plugin.filterRefreshDebounce;
        document.querySelector('#rec-success .jhs-ps-badge')!.className = 'jhs-ps-badge jhs-ps-failed';
        refreshScopedPreloadFilter(scope);
        expect(plugin.filterRefreshDebounce).toBe(mainTimer);
        expect(chip(scoped, 'failed').classList.contains('active')).toBe(true);
        expect(chip(scoped, 'failed').textContent).toBe('匹配失败 2');
        expect(document.getElementById('rec-success')!.style.display).toBe('');
        await vi.advanceTimersByTimeAsync(150);
        expect(chip(main, 'success').textContent).toBe('成功匹配 1');
        expect(chip(scoped, 'failed').classList.contains('active')).toBe(true);
    });

    it('别栏先隐藏时仍独立计算本栏条件，逐栏清空不会提前展示', () => {
        const { plugin, scope } = fixture();
        const scoped = buildFilterBar(plugin, scope)!;
        const success = document.getElementById('rec-success')!;
        success.setAttribute('data-status-tag-hidden', '');
        success.style.display = 'none';
        chip(scoped, 'failed').click();
        expect(success.hasAttribute(PRELOAD_HIDDEN_ATTR)).toBe(true);
        success.removeAttribute('data-status-tag-hidden');
        refreshScopedPreloadFilter(scope);
        expect(success.style.display).toBe('none');
        chip(scoped, 'failed').click();
        expect(success.hasAttribute(PRELOAD_HIDDEN_ATTR)).toBe(false);
        expect(success.style.display).toBe('');
    });

    it.each(['data-status-tag-hidden', 'data-video-lists-tag-hidden', 'data-lrs-hidden', 'data-hide'])(
        '清空预加载栏时保留其他 %s 标记和隐藏状态', (otherMarker) => {
            const { plugin, scope } = fixture();
            const scoped = buildFilterBar(plugin, scope)!;
            chip(scoped, 'failed').click();
            const success = document.getElementById('rec-success')!;
            success.setAttribute(otherMarker, 'yes');
            chip(scoped, 'failed').click();
            expect(success.hasAttribute(PRELOAD_HIDDEN_ATTR)).toBe(false);
            expect(success.hasAttribute(otherMarker)).toBe(true);
            expect(success.style.display).toBe('none');
        }
    );

    it('推荐与主栏反复构建时请求列表事件只绑定一次', () => {
        const { plugin, scope } = fixture();
        buildFilterBar(plugin, scope);
        const main = buildFilterBar(plugin)!;
        main.remove();
        buildFilterBar(plugin);
        buildFilterBar(plugin, scope);
        document.dispatchEvent(new Event(PRELOAD_QUEUE_TOGGLE_EVENT));
        expect(togglePreloadQueuePanel).toHaveBeenCalledExactlyOnceWith(plugin);
    });

    it('预加载配置未就绪或状态功能关闭时不构建推荐栏', () => {
        const { plugin, scope } = fixture();
        plugin.preloadFilterReady = false;
        expect(buildFilterBar(plugin, scope)).toBeNull();
        plugin.preloadFilterReady = true;
        plugin.preloadStatusEnabled = false;
        expect(buildFilterBar(plugin, scope)).toBeNull();
        expect(scope.mount.childElementCount).toBe(0);
    });
});
