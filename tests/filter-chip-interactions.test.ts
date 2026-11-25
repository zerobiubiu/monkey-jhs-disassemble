// @vitest-environment jsdom
/**
 * 四栏筛选三态交互回归测试（筛选 / 状态 / 预加载 / 标签）：
 * 1. 左键单击包含（OR）、右键单击排除（阻止默认菜单）、同栏包含+排除混合规则；
 * 2. 左键双击单选包含、右键双击（350ms 内连续右键）单选排除，均清除本栏多项但互不影响其他三栏；
 * 3. `.jhs-filter-stack` 空白区域双击清空四栏全部过滤条件并刷新预加载计数，保留基础屏蔽与外部隐藏；
 * 4. 首页推荐浮层独立作用域的空白区双击清空与主流完全隔离；
 * 5. 键盘 Enter / Space 与 ARIA `aria-pressed`（false / true / mixed）状态同步。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HAS_WATCH_ACTION } from '../src/constants/status';
import type { CarRecord } from '../src/core/storage-manager';
import { TaskSupervisor } from '../src/core/task-supervisor';
import {
    FILTER_EXCLUDED_CLASS,
    FILTER_STATE_ATTR,
    RIGHT_DOUBLE_CLICK_MS
} from '../src/core/util/site/filter-chips';
import type { FilterScope } from '../src/types/filter-scope';
import { WeeklyRecommendFilters } from '../src/plugins/list-page/weekly-recommend-filters';
import type { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import { buildFilterBar as buildPreloadBar } from '../src/plugins/other-site/osp-filter-bar';
import { buildSiteTagFilterBar } from '../src/plugins/site-tag-filter/stgf-ui';
import { setCarRecords } from '../src/plugins/status-tag-filter/stf-score';
import { doBuild as buildStatusBar } from '../src/plugins/status-tag-filter/stf-ui';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

const supervisors: TaskSupervisor[] = [];
const destroyables: Array<{ destroy(): void }> = [];

function cardHtml(
    id: string,
    opts: {
        listTags?: string[];
        statusTags?: string[];
        preload?: string;
        nativeTags?: string[];
        attrs?: string;
    } = {}
): string {
    const { listTags = [], statusTags = [], preload, nativeTags = [], attrs = '' } = opts;
    const vltHtml = listTags.length
        ? `<div class="jhs-vlt-tags-display">${listTags.map((t) => `<span class="jhs-vlt-tag-link">${t}</span>`).join('')}</div>`
        : '';
    const statusHtml = statusTags.map((t) => `<span class="tag is-success status-tag">${t}</span>`).join('');
    const nativeHtml = nativeTags.map((t) => `<span class="tag is-info">${t}</span>`).join('');
    const tagsHtml = statusHtml || nativeHtml ? `<div class="tags has-addons">${nativeHtml}${statusHtml}</div>` : '';
    const preloadHtml = preload
        ? `<div class="jhs-preload-status"><span class="jhs-ps-badge jhs-ps-${preload}"></span></div>`
        : '';
    return `<div class="item" id="${id}" ${attrs}><a class="box" href="/v/${id}">
        <div class="video-title"><strong>${id}</strong></div>
        ${preloadHtml}${vltHtml}${tagsHtml}
    </a></div>`;
}

function item(id: string): HTMLElement {
    return document.getElementById(id)!;
}

function visibleIds(ids: string[]): string[] {
    return ids.filter((id) => item(id).style.display !== 'none');
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

function findChip(bar: ParentNode, selector: string, value: string): HTMLElement {
    const found = Array.from(bar.querySelectorAll<HTMLElement>(selector)).find(
        (el) => el.dataset.value === value
    );
    if (!found) throw new Error(`未找到芯片 ${selector}[data-value="${value}"]`);
    return found;
}

function buildMainFourBars() {
    document.body.innerHTML = `<section><div><div class="movie-list">
        ${cardHtml('V-1', { listTags: ['必看', '高分'], statusTags: ['已观看'], preload: 'success', nativeTags: ['含磁鏈', '含中字磁鏈'] })}
        ${cardHtml('V-2', { listTags: ['必看'], statusTags: ['已观看'], preload: 'failed', nativeTags: ['含磁鏈'] })}
        ${cardHtml('V-3', { listTags: ['待定'], statusTags: ['已收藏'], preload: 'queued', nativeTags: ['昨日首種'] })}
        ${cardHtml('V-4', { listTags: [], statusTags: [], preload: 'requesting', nativeTags: [] })}
        ${cardHtml('V-HIDE', { listTags: ['必看'], statusTags: ['已观看'], preload: 'success', nativeTags: ['含磁鏈'], attrs: 'data-hide="yes" style="display:none"' })}
        ${cardHtml('V-EXT', { listTags: ['必看'], statusTags: ['已观看'], preload: 'success', nativeTags: ['含磁鏈'], attrs: 'style="display:none"' })}
    </div></div></section>`;

    setCarRecords([
        { carNum: 'V-1', status: HAS_WATCH_ACTION, score: 5 },
        { carNum: 'V-2', status: HAS_WATCH_ACTION, score: 0 }
    ] as CarRecord[]);

    const vlt = new VltTags();
    vlt.buildFilterBar();
    const statusBar = buildStatusBar()!;
    const supervisor = new TaskSupervisor();
    supervisors.push(supervisor);
    const preloadPlugin = {
        preloadStatusEnabled: true,
        preloadFilterReady: true,
        filterRefreshDebounce: 0,
        supervisor
    } as unknown as OtherSitePlugin;
    const preloadBar = buildPreloadBar(preloadPlugin)!;
    const siteTagBar = buildSiteTagFilterBar()!;
    const stack = document.querySelector<HTMLElement>('.jhs-filter-stack')!;
    const vltBar = stack.querySelector<HTMLElement>('.jhs-vlt-filter-bar')!;

    return { stack, vltBar, statusBar, preloadBar, siteTagBar };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    destroyables.splice(0).forEach((entry) => entry.destroy());
    supervisors.splice(0).forEach((s) => s.abort());
    setCarRecords([]);
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('四栏左键包含与右键排除语义', () => {
    const ALL = ['V-1', 'V-2', 'V-3', 'V-4'];

    it('清单栏：左键包含、右键排除、同栏包含+排除混合及无标签排除', () => {
        const { vltBar } = buildMainFourBars();
        const mustChip = findChip(vltBar, '.jhs-vlt-filter-chip', '必看');
        const highChip = findChip(vltBar, '.jhs-vlt-filter-chip', '高分');
        const noTagChip = findChip(vltBar, '.jhs-vlt-filter-chip', 'no-tag');

        // 1) 左键包含「必看」→ V-1, V-2
        mustChip.click();
        expect(mustChip.getAttribute('aria-pressed')).toBe('true');
        expect(mustChip.getAttribute(FILTER_STATE_ATTR)).toBe('include');
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);

        // 2) 同栏右键排除「高分」→ V-2（含必看但不含高分）
        const ev = rightClick(highChip);
        expect(ev.defaultPrevented).toBe(true);
        expect(highChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(true);
        expect(highChip.getAttribute('aria-pressed')).toBe('mixed');
        expect(highChip.getAttribute(FILTER_STATE_ATTR)).toBe('exclude');
        expect(visibleIds(ALL)).toEqual(['V-2']);

        // 3) 间隔超过双击窗后再次右键取消「高分」排除；左键再点取消「必看」
        vi.advanceTimersByTime(RIGHT_DOUBLE_CLICK_MS + 50);
        rightClick(highChip);
        expect(highChip.getAttribute('aria-pressed')).toBe('false');
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);

        mustChip.click();
        expect(visibleIds(ALL)).toEqual(ALL);

        // 4) 仅右键排除「无标签」→ 隐藏 V-4，显示全部有标签卡片
        rightClick(noTagChip);
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2', 'V-3']);
        // 左键点击已排除芯片可直接切换为包含态
        noTagChip.click();
        expect(noTagChip.classList.contains('jhs-vlt-active')).toBe(true);
        expect(noTagChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(false);
        expect(visibleIds(ALL)).toEqual(['V-4']);
    });

    it('状态栏：支持左键「已观看」+ 右键排除「0星」组合筛选', () => {
        const { statusBar } = buildMainFourBars();
        const watchedChip = findChip(statusBar, '.status-tag-filter-chip', '已观看');
        const zeroStarChip = findChip(statusBar, '.status-tag-filter-chip', 'score:0');

        watchedChip.click();
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);

        rightClick(zeroStarChip);
        expect(visibleIds(ALL)).toEqual(['V-1']);
        expect(zeroStarChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(true);
    });

    it('预加载栏：右键排除「匹配失败」仅隐藏失败项，其余状态正常保留', () => {
        const { preloadBar } = buildMainFourBars();
        const failedChip = findChip(preloadBar, '.preload-filter-chip', 'failed');

        rightClick(failedChip);
        expect(failedChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(true);
        expect(failedChip.classList.contains('active')).toBe(false);
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-3', 'V-4']);
    });

    it('标签栏：左键包含「含磁鏈」+ 右键排除「含中字磁鏈」精准留存仅含磁鏈卡片', () => {
        const { siteTagBar } = buildMainFourBars();
        const magnetChip = findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含磁鏈');
        const subChip = findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含中字磁鏈');

        magnetChip.click();
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);

        rightClick(subChip);
        expect(visibleIds(ALL)).toEqual(['V-2']);
        expect(subChip.getAttribute('aria-pressed')).toBe('mixed');
    });
});

describe('四栏独立双击单选（左键单选包含 / 右键单选排除）', () => {
    const ALL = ['V-1', 'V-2', 'V-3', 'V-4'];

    it('左键双击单选清空本栏多项并独选该项为包含，不影响其他三栏', () => {
        const { vltBar, statusBar, preloadBar, siteTagBar } = buildMainFourBars();

        // 在四栏各自设多项/排除态
        findChip(vltBar, '.jhs-vlt-filter-chip', '必看').click();
        rightClick(findChip(vltBar, '.jhs-vlt-filter-chip', '高分'));
        findChip(statusBar, '.status-tag-filter-chip', '已观看').click();
        findChip(statusBar, '.status-tag-filter-chip', '已收藏').click();
        findChip(preloadBar, '.preload-filter-chip', 'success').click();
        findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含磁鏈').click();

        // 仅在状态栏左键双击「已收藏」→ 状态栏清空「已观看」仅保留「已收藏」；其余三栏保持不变
        const favChip = findChip(statusBar, '.status-tag-filter-chip', '已收藏');
        leftDblClick(favChip);

        expect(findChip(statusBar, '.status-tag-filter-chip', '已观看').getAttribute('aria-pressed')).toBe('false');
        expect(favChip.getAttribute('aria-pressed')).toBe('true');
        expect(findChip(vltBar, '.jhs-vlt-filter-chip', '必看').getAttribute('aria-pressed')).toBe('true');
        expect(findChip(vltBar, '.jhs-vlt-filter-chip', '高分').getAttribute('aria-pressed')).toBe('mixed');
        expect(findChip(preloadBar, '.preload-filter-chip', 'success').getAttribute('aria-pressed')).toBe('true');
        expect(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含磁鏈').getAttribute('aria-pressed')).toBe('true');
    });

    it('右键双击（350ms 内两次右键）清空本栏多项并独选该项为排除，且四栏各自独立', () => {
        const { vltBar, statusBar, preloadBar, siteTagBar } = buildMainFourBars();

        // 四栏各自多选
        findChip(vltBar, '.jhs-vlt-filter-chip', '必看').click();
        findChip(vltBar, '.jhs-vlt-filter-chip', '待定').click();
        findChip(statusBar, '.status-tag-filter-chip', '已观看').click();
        findChip(preloadBar, '.preload-filter-chip', 'queued').click();
        findChip(siteTagBar, '.jhs-site-tag-filter-chip', '昨日首種').click();

        // 在清单栏连续两次右键「必看」（间隔 120ms ≤ 350ms）→ 清空「待定」，仅排除「必看」
        const mustChip = findChip(vltBar, '.jhs-vlt-filter-chip', '必看');
        rightClick(mustChip);
        vi.advanceTimersByTime(120);
        rightClick(mustChip);

        expect(mustChip.getAttribute('aria-pressed')).toBe('mixed');
        expect(mustChip.classList.contains(FILTER_EXCLUDED_CLASS)).toBe(true);
        expect(findChip(vltBar, '.jhs-vlt-filter-chip', '待定').getAttribute('aria-pressed')).toBe('false');
        // 其余三栏原状态丝毫未动
        expect(findChip(statusBar, '.status-tag-filter-chip', '已观看').getAttribute('aria-pressed')).toBe('true');
        expect(findChip(preloadBar, '.preload-filter-chip', 'queued').getAttribute('aria-pressed')).toBe('true');
        expect(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '昨日首種').getAttribute('aria-pressed')).toBe('true');

        // 同样在预加载栏右键双击「匹配失败」→ 清空「排队中」，仅排除「匹配失败」，其余三栏仍不受影响
        const failedChip = findChip(preloadBar, '.preload-filter-chip', 'failed');
        rightClick(failedChip);
        vi.advanceTimersByTime(100);
        rightClick(failedChip);

        expect(failedChip.getAttribute('aria-pressed')).toBe('mixed');
        expect(findChip(preloadBar, '.preload-filter-chip', 'queued').getAttribute('aria-pressed')).toBe('false');
        expect(mustChip.getAttribute('aria-pressed')).toBe('mixed');
        expect(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '昨日首種').getAttribute('aria-pressed')).toBe('true');
    });

    it('标签栏左键双击单选与预加载栏独立；双击芯片不会冒泡触发栈容器清空全部', () => {
        const { vltBar, siteTagBar } = buildMainFourBars();

        findChip(vltBar, '.jhs-vlt-filter-chip', '必看').click();
        findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含磁鏈').click();
        rightClick(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含中字磁鏈'));

        const subChip = findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含中字磁鏈');
        leftDblClick(subChip);

        // 标签栏清空「含磁鏈」，仅包含「含中字磁鏈」；清单栏「必看」依然保留
        expect(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '含磁鏈').getAttribute('aria-pressed')).toBe('false');
        expect(subChip.getAttribute('aria-pressed')).toBe('true');
        expect(findChip(vltBar, '.jhs-vlt-filter-chip', '必看').getAttribute('aria-pressed')).toBe('true');
        expect(visibleIds(ALL)).toEqual(['V-1']);
    });
});

describe('.jhs-filter-stack 空白区域双击清空全部过滤条件', () => {
    const ALL = ['V-1', 'V-2', 'V-3', 'V-4'];

    it('在栈容器或各栏空白处双击，立即清除四栏所有包含与排除条件，且不误恢复基础屏蔽和外部隐藏', () => {
        const { stack, vltBar, statusBar, preloadBar, siteTagBar } = buildMainFourBars();

        findChip(vltBar, '.jhs-vlt-filter-chip', '必看').click();
        rightClick(findChip(statusBar, '.status-tag-filter-chip', 'score:0'));
        findChip(preloadBar, '.preload-filter-chip', 'success').click();
        rightClick(findChip(siteTagBar, '.jhs-site-tag-filter-chip', '昨日首種'));
        expect(visibleIds(ALL)).toEqual(['V-1']);

        // 双击某个筛选栏右侧空白处（bar 自身，非芯片）
        leftDblClick(vltBar);

        expect(visibleIds(ALL)).toEqual(ALL);
        expect(item('V-HIDE').style.display).toBe('none');
        expect(item('V-EXT').style.display).toBe('none');
        expect(stack.querySelectorAll('[aria-pressed="true"], [aria-pressed="mixed"]')).toHaveLength(0);
        // 预加载可见计数同步恢复
        expect(findChip(preloadBar, '.preload-filter-chip', 'failed').textContent).toBe('匹配失败 1');

        // 再次选中后直接双击 .jhs-filter-stack 容器本身空白处同样清空
        rightClick(findChip(preloadBar, '.preload-filter-chip', 'queued'));
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2', 'V-4']);
        leftDblClick(stack);
        expect(visibleIds(ALL)).toEqual(ALL);
        expect(stack.querySelectorAll('[aria-pressed="true"], [aria-pressed="mixed"]')).toHaveLength(0);
    });

    it('首页推荐浮层筛选区空白双击仅清空推荐四栏，不影响主列表筛选', () => {
        const { vltBar } = buildMainFourBars();
        findChip(vltBar, '.jhs-vlt-filter-chip', '必看').click();
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);

        document.body.insertAdjacentHTML(
            'beforeend',
            `<div id="rec-panel" data-jhs-filter-scope="recommend">
                <div id="rec-filters"></div>
                <div id="recommend-container">
                    ${cardHtml('R-1', { listTags: ['推荐甲'], statusTags: ['已读'], preload: 'success', nativeTags: ['含磁鏈'] })}
                    ${cardHtml('R-2', { listTags: ['推荐乙'], statusTags: ['已收藏'], preload: 'failed', nativeTags: ['昨日首種'] })}
                </div>
            </div>`
        );
        const scope: FilterScope = {
            root: item('rec-panel'),
            mount: item('rec-filters'),
            itemSelector: '#recommend-container .item'
        };
        const other = { preloadFilterReady: true, preloadStatusEnabled: true } as OtherSitePlugin;
        const controller = new WeeklyRecommendFilters(scope, () => other);
        destroyables.push(controller);
        controller.init();

        findChip(scope.mount, '.jhs-vlt-filter-chip', '推荐甲').click();
        rightClick(findChip(scope.mount, '.jhs-site-tag-filter-chip', '昨日首種'));
        vi.advanceTimersByTime(100);
        expect(item('R-1').style.display).toBe('');
        expect(item('R-2').style.display).toBe('none');
        expect(findChip(scope.mount, '.preload-filter-chip', 'failed').textContent).toBe('匹配失败 0');

        // 双击推荐筛选区空白处：仅清空推荐四栏并恢复推荐预加载计数，主流筛选不受影响
        leftDblClick(scope.mount);
        expect(item('R-1').style.display).toBe('');
        expect(item('R-2').style.display).toBe('');
        expect(findChip(scope.mount, '.preload-filter-chip', 'failed').textContent).toBe('匹配失败 1');
        expect(visibleIds(ALL)).toEqual(['V-1', 'V-2']);
        expect(findChip(vltBar, '.jhs-vlt-filter-chip', '必看').getAttribute('aria-pressed')).toBe('true');
    });
});

describe('非原生按钮芯片的键盘无障碍交互', () => {
    it('span[role="button"] 芯片支持 Enter(keydown) 与 Space(keyup) 切换包含态', () => {
        const { vltBar } = buildMainFourBars();
        const mustChip = findChip(vltBar, '.jhs-vlt-filter-chip', '必看');

        expect(mustChip.getAttribute('role')).toBe('button');
        expect(mustChip.tabIndex).toBe(0);

        mustChip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(mustChip.getAttribute('aria-pressed')).toBe('true');

        const spaceDown = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        mustChip.dispatchEvent(spaceDown);
        expect(spaceDown.defaultPrevented).toBe(true);
        // Space 在松开（keyup）时激活，keydown 不提前切换
        expect(mustChip.getAttribute('aria-pressed')).toBe('true');

        mustChip.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        expect(mustChip.getAttribute('aria-pressed')).toBe('false');
    });
});
