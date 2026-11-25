// @vitest-environment jsdom
/**
 * 站点原生卡片标签筛选（SiteTagFilterPlugin）回归测试。
 *
 * 覆盖：
 * 1. 从 `div.tags.has-addons > span` 实时采集站点原生标签（不预设名单、排除扩展 `.status-tag`
 *    收藏/已观看/屏蔽标签与 `.jhs-status-tags` 兜底容器及批量勾选框）；
 * 2. 无标签卡片计数与筛选、整页无原生标签时不挂空栏；
 * 3. 多选 OR 筛选、`aria-pressed` 同步、动态瀑布流追加与 DOM 变动实时刷新及零计数保留/取消清理；
 * 4. 主页面四栏交集协同（不互踩、不误恢复 `data-hide` 与未知外部隐藏）；
 * 5. 首页「每周推荐」浮层独立作用域与销毁清理。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageContext } from '../src/core/page-context';
import { TaskSupervisor } from '../src/core/task-supervisor';
import type { FilterScope } from '../src/types/filter-scope';
import { WeeklyRecommendFilters } from '../src/plugins/list-page/weekly-recommend-filters';
import type { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import { buildFilterBar as buildPreloadBar } from '../src/plugins/other-site/osp-filter-bar';
import { SiteTagFilterPlugin } from '../src/plugins/site-tag-filter/site-tag-filter-plugin';
import { applySiteTagFilter } from '../src/plugins/site-tag-filter/stgf-apply';
import {
    SITE_TAG_HIDDEN_ATTR,
    SITE_TAG_NO_TAG_VALUE,
    collectSiteTagCounts,
    countNoSiteTagItems,
    getItemNativeTags
} from '../src/plugins/site-tag-filter/stgf-collect';
import { buildSiteTagFilterBar, refreshSiteTagFilterBar } from '../src/plugins/site-tag-filter/stgf-ui';
import { doBuild as buildStatusBar } from '../src/plugins/status-tag-filter/stf-ui';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

let activePlugin: SiteTagFilterPlugin | undefined;
const supervisors: TaskSupervisor[] = [];
const destroyables: Array<{ destroy(): void }> = [];

function cardHtml(
    id: string,
    opts: {
        nativeTags?: string[];
        statusTags?: string[];
        listTags?: string[];
        preload?: string;
        attrs?: string;
        fallbackStatusContainer?: boolean;
        includeCheckbox?: boolean;
        emptyTagsContainer?: boolean;
    } = {}
): string {
    const {
        nativeTags = [],
        statusTags = [],
        listTags = [],
        preload,
        attrs = '',
        fallbackStatusContainer = false,
        includeCheckbox = false,
        emptyTagsContainer = false
    } = opts;
    const nativeSpans = nativeTags.map((tag) => `<span class="tag is-success">${tag}</span>`).join('');
    const statusSpans = statusTags
        .map((tag) => `<span class="tag is-success status-tag">${tag}</span>`)
        .join('');
    const checkbox = includeCheckbox
        ? `<label class="jhs-lp-batch-item"><input type="checkbox" class="jhs-lp-batch-checkbox"></label>`
        : '';
    const hasRegularTags = nativeSpans || (!fallbackStatusContainer && (statusSpans || checkbox)) || emptyTagsContainer;
    const regularTagsBlock = hasRegularTags
        ? `<div class="tags has-addons">${nativeSpans}${fallbackStatusContainer ? '' : statusSpans + checkbox}</div>`
        : '';
    const fallbackTagsBlock = fallbackStatusContainer
        ? `<div class="tags has-addons jhs-status-tags">${statusSpans}${checkbox}</div>`
        : '';
    const vltBlock = listTags.length
        ? `<div class="jhs-vlt-tags-display">${listTags.map((t) => `<span class="jhs-vlt-tag-link">${t}</span>`).join('')}</div>`
        : '';
    const preloadBlock = preload
        ? `<div class="jhs-preload-status"><span class="jhs-ps-badge jhs-ps-${preload}"></span></div>`
        : '';

    return `<div class="item" id="${id}" ${attrs}><a class="box" href="/v/${id}">
        <div class="video-title"><strong>${id}</strong></div>
        ${preloadBlock}${vltBlock}${regularTagsBlock}
    </a>${fallbackTagsBlock}</div>`;
}

function itemEl(id: string): HTMLElement {
    return document.getElementById(id)!;
}

function chipEl(root: ParentNode, value: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll<HTMLButtonElement>('.jhs-site-tag-filter-chip')).find(
        (el) => el.dataset.value === value
    );
    if (!found) throw new Error(`未找到原生标签芯片: ${value}`);
    return found;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    pageContext.isListPage = true;
    pageContext.isHomePage = false;
});

afterEach(() => {
    activePlugin?.destroy();
    activePlugin = undefined;
    destroyables.splice(0).forEach((entry) => entry.destroy());
    supervisors.splice(0).forEach((s) => s.abort());
    pageContext.isListPage = false;
    pageContext.isHomePage = false;
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('原生卡片标签采集（排除扩展状态标签）', () => {
    it('实时收集 div.tags.has-addons 下的所有原生 span，排除收藏等 status-tag 与兜底容器', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('A-001', {
                nativeTags: ['含磁鏈', '昨日首種', '含磁鏈'],
                statusTags: ['⭐ 已收藏'],
                includeCheckbox: true
            })}
            ${cardHtml('A-002', {
                nativeTags: ['含中字磁鏈'],
                statusTags: ['👀 已观看']
            })}
            ${cardHtml('A-003', {
                statusTags: ['⭐ 已收藏'],
                emptyTagsContainer: true
            })}
            ${cardHtml('A-004', {
                statusTags: ['⭐ 已收藏'],
                fallbackStatusContainer: true
            })}
            ${cardHtml('A-005')}
            ${cardHtml('A-006', {
                nativeTags: ['今日新種'],
                attrs: 'data-hide="yes" style="display:none"'
            })}
        </div></div></section>`;

        // 单卡去重且排除扩展状态标签与勾选框
        expect(Array.from(getItemNativeTags(itemEl('A-001')))).toEqual(['含磁鏈', '昨日首種']);
        expect(Array.from(getItemNativeTags(itemEl('A-003')))).toEqual([]);
        expect(Array.from(getItemNativeTags(itemEl('A-004')))).toEqual([]);

        // 页面统计不预设名单、不含 status-tag、跳过 data-hide 卡片
        expect(collectSiteTagCounts()).toEqual({
            含磁鏈: 1,
            昨日首種: 1,
            含中字磁鏈: 1
        });
        // A-003（仅有收藏标签）、A-004（兜底容器）、A-005（无容器）均计入无标签
        expect(countNoSiteTagItems()).toBe(3);
    });

    it('整页没有任何原生标签时不挂载空筛选栏', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('N-1', { statusTags: ['⭐ 已收藏'] })}
            ${cardHtml('N-2')}
        </div></div></section>`;

        expect(buildSiteTagFilterBar()).toBeUndefined();
        expect(document.querySelector('.jhs-site-tag-filter-bar')).toBeNull();
    });
});

describe('动态渲染、多选 OR 筛选与实时同步', () => {
    it('按当前页标签实时渲染芯片、支持 OR 多选及无标签筛选，并同步 aria-pressed', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('V-1', { nativeTags: ['含磁鏈', '昨日首種'], statusTags: ['⭐ 已收藏'] })}
            ${cardHtml('V-2', { nativeTags: ['含中字磁鏈'] })}
            ${cardHtml('V-3', { statusTags: ['⭐ 已收藏'] })}
        </div></div></section>`;

        const bar = buildSiteTagFilterBar()!;
        expect(bar).toBeDefined();
        expect(bar.querySelector('.jhs-site-tag-filter-label')?.textContent).toBe('标签:');

        const chipTexts = Array.from(bar.querySelectorAll('.jhs-site-tag-filter-chip'), (el) => el.textContent);
        expect(chipTexts).toEqual(['无标签 1', '含磁鏈 1', '含中字磁鏈 1', '昨日首種 1']);
        expect(chipEl(bar, SITE_TAG_NO_TAG_VALUE).classList.contains('is-no-tag')).toBe(true);

        // 单选「含中字磁鏈」
        const subChip = chipEl(bar, '含中字磁鏈');
        expect(subChip.getAttribute('aria-pressed')).toBe('false');
        subChip.click();
        expect(subChip.getAttribute('aria-pressed')).toBe('true');
        expect(itemEl('V-1').style.display).toBe('none');
        expect(itemEl('V-2').style.display).toBe('');
        expect(itemEl('V-3').style.display).toBe('none');

        // 叠加「无标签」→ OR 逻辑
        chipEl(bar, SITE_TAG_NO_TAG_VALUE).click();
        expect(itemEl('V-1').style.display).toBe('none');
        expect(itemEl('V-2').style.display).toBe('');
        expect(itemEl('V-3').style.display).toBe('');

        // 全部取消 → 恢复显示
        subChip.click();
        chipEl(bar, SITE_TAG_NO_TAG_VALUE).click();
        expect(itemEl('V-1').style.display).toBe('');
        expect(itemEl('V-2').style.display).toBe('');
        expect(itemEl('V-3').style.display).toBe('');
        expect(itemEl('V-1').hasAttribute(SITE_TAG_HIDDEN_ATTR)).toBe(false);
    });

    it('全页都有原生标签时不渲染冗余的「无标签 0」芯片', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('F-1', { nativeTags: ['含磁鏈'] })}
            ${cardHtml('F-2', { nativeTags: ['可播放'] })}
        </div></div></section>`;

        const bar = buildSiteTagFilterBar()!;
        const values = Array.from(bar.querySelectorAll<HTMLElement>('.jhs-site-tag-filter-chip'), (el) => el.dataset.value);
        expect(values).not.toContain(SITE_TAG_NO_TAG_VALUE);
        expect(values).toEqual(['含磁鏈', '可播放']);
    });

    it('瀑布流晚到卡片出现任意新标签时实时挂载/刷新、保留激活态，并在零计数芯片取消后清理空栏', async () => {
        document.body.innerHTML = `<section><div><div class="movie-list" id="main-list">
            ${cardHtml('P-1')}
        </div></div></section>`;

        activePlugin = new SiteTagFilterPlugin();
        await activePlugin.handle();
        // 初始无原生标签 → 不挂空栏
        expect(document.querySelector('.jhs-site-tag-filter-bar')).toBeNull();

        // 瀑布流追加带自定义实时标签的新卡片 → 自动挂载并渲染
        itemEl('main-list').insertAdjacentHTML('beforeend', cardHtml('P-2', { nativeTags: ['自定新标'] }));
        await vi.advanceTimersByTimeAsync(200);

        const bar = document.querySelector<HTMLElement>('.jhs-site-tag-filter-bar')!;
        expect(bar).not.toBeNull();
        expect(chipEl(bar, '自定新标').textContent).toBe('自定新标 1');
        expect(chipEl(bar, SITE_TAG_NO_TAG_VALUE).textContent).toBe('无标签 1');

        // 选中「自定新标」后，再追加一张不含该标签的新卡与一张含该标签的新卡
        chipEl(bar, '自定新标').click();
        expect(itemEl('P-1').style.display).toBe('none');
        expect(itemEl('P-2').style.display).toBe('');

        itemEl('main-list').insertAdjacentHTML(
            'beforeend',
            cardHtml('P-3', { nativeTags: ['另一标签'] }) + cardHtml('P-4', { nativeTags: ['自定新标'] })
        );
        await vi.advanceTimersByTimeAsync(200);

        expect(chipEl(bar, '自定新标').classList.contains('active')).toBe(true);
        expect(chipEl(bar, '自定新标').textContent).toBe('自定新标 2');
        expect(chipEl(bar, '另一标签').textContent).toBe('另一标签 1');
        expect(itemEl('P-3').style.display).toBe('none');
        expect(itemEl('P-4').style.display).toBe('');

        // 所有带原生标签的卡片都被移除：已激活芯片保留 0 计数以便取消，取消后自动收起空栏
        itemEl('P-2').remove();
        itemEl('P-3').remove();
        itemEl('P-4').remove();
        await vi.advanceTimersByTimeAsync(200);

        expect(chipEl(bar, '自定新标').textContent).toBe('自定新标 0');
        expect(chipEl(bar, '自定新标').classList.contains('active')).toBe(true);
        chipEl(bar, '自定新标').click();
        expect(itemEl('P-1').style.display).toBe('');
        expect(document.querySelector('.jhs-site-tag-filter-bar')).toBeNull();
    });

    it('纯注入扩展 status-tag 不会把收藏标签采集进原生标签栏', async () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('S-1', { nativeTags: ['含磁鏈'] })}
        </div></div></section>`;

        activePlugin = new SiteTagFilterPlugin();
        await activePlugin.handle();
        const tagsBox = itemEl('S-1').querySelector('.tags.has-addons')!;
        tagsBox.insertAdjacentHTML('beforeend', '<span class="tag is-success status-tag">⭐ 已收藏</span>');
        await vi.advanceTimersByTimeAsync(200);

        const bar = document.querySelector('.jhs-site-tag-filter-bar')!;
        expect(bar.textContent).toContain('含磁鏈 1');
        expect(bar.textContent).not.toContain('已收藏');
    });
});

describe('主页面多栏交集协同与推荐浮层隔离', () => {
    it('与清单/状态/预加载栏任意顺序叠加和取消均严格呈交集，且不误恢复基础屏蔽与未知脚本隐藏', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('C-1', { nativeTags: ['含中字磁鏈'], statusTags: ['已观看'], listTags: ['必看'], preload: 'success' })}
            ${cardHtml('C-2', { nativeTags: ['含中字磁鏈'], statusTags: ['已收藏'], listTags: ['必看'], preload: 'failed' })}
            ${cardHtml('C-3', { nativeTags: ['含磁鏈'], statusTags: ['已观看'], listTags: ['待定'], preload: 'success' })}
            ${cardHtml('C-HIDE', { nativeTags: ['含中字磁鏈'], statusTags: ['已观看'], attrs: 'data-hide="yes" style="display:none"' })}
            ${cardHtml('C-EXT', { nativeTags: ['含中字磁鏈'], statusTags: ['已观看'], attrs: 'style="display:none"' })}
        </div></div></section>`;

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

        // 1) 先点「标签: 含中字磁鏈」→ 仅 C-1, C-2 保留可见
        chipEl(siteTagBar, '含中字磁鏈').click();
        expect(itemEl('C-1').style.display).toBe('');
        expect(itemEl('C-2').style.display).toBe('');
        expect(itemEl('C-3').style.display).toBe('none');
        expect(itemEl('C-HIDE').style.display).toBe('none');
        expect(itemEl('C-EXT').style.display).toBe('none');

        // 2) 再点「状态: 已观看」→ 交集只剩 C-1（C-3 虽已被标签栏隐藏，仍需独立打上状态隐藏标记）
        statusBar.querySelector<HTMLElement>('.status-tag-filter-chip[data-value="已观看"]')!.click();
        expect(itemEl('C-1').style.display).toBe('');
        expect(itemEl('C-2').style.display).toBe('none');
        expect(itemEl('C-3').style.display).toBe('none');
        expect(itemEl('C-2').hasAttribute('data-status-tag-hidden')).toBe(true);

        // 3) 取消「标签: 含中字磁鏈」→ 状态栏「已观看」仍生效，所以 C-1 和 C-3 显示，C-2 仍隐藏！
        chipEl(siteTagBar, '含中字磁鏈').click();
        expect(itemEl('C-1').style.display).toBe('');
        expect(itemEl('C-2').style.display).toBe('none');
        expect(itemEl('C-3').style.display).toBe('');
        expect(itemEl('C-HIDE').style.display).toBe('none');
        expect(itemEl('C-EXT').style.display).toBe('none');

        // 4) 叠加「预加载: 成功匹配」与「标签: 含中字磁鏈」再取消状态栏 → 交集保留 C-1
        preloadBar.querySelector<HTMLElement>('.preload-filter-chip[data-value="success"]')!.click();
        chipEl(siteTagBar, '含中字磁鏈').click();
        statusBar.querySelector<HTMLElement>('.status-tag-filter-chip[data-value="已观看"]')!.click();
        expect(itemEl('C-1').style.display).toBe('');
        expect(itemEl('C-2').style.display).toBe('none');
        expect(itemEl('C-3').style.display).toBe('none');

        // 5) 全部取消 → C-1/C-2/C-3 恢复，C-HIDE 与 C-EXT 仍隐藏
        preloadBar.querySelector<HTMLElement>('.preload-filter-chip[data-value="success"]')!.click();
        chipEl(siteTagBar, '含中字磁鏈').click();
        expect(itemEl('C-1').style.display).toBe('');
        expect(itemEl('C-2').style.display).toBe('');
        expect(itemEl('C-3').style.display).toBe('');
        expect(itemEl('C-HIDE').style.display).toBe('none');
        expect(itemEl('C-EXT').style.display).toBe('none');
    });

    it('首页每周推荐浮层独立挂载原生标签栏、不与主流串扰，销毁清理标记并保留 data-hide', () => {
        document.body.innerHTML = `<section><div><div class="movie-list">
            ${cardHtml('MAIN-1', { nativeTags: ['主流标签'], statusTags: ['已读'] })}
        </div></div></section>
        <div id="panel" data-jhs-filter-scope="recommend"><div id="filters"></div><div id="recommend-container">
            ${cardHtml('REC-1', { nativeTags: ['含中字磁鏈'], statusTags: ['已读'], listTags: ['甲'], preload: 'success' })}
            ${cardHtml('REC-2', { nativeTags: ['昨日首種'], statusTags: ['已收藏'], listTags: ['乙'], preload: 'failed' })}
            ${cardHtml('REC-HIDE', { nativeTags: ['含中字磁鏈'], attrs: 'data-hide="yes" style="display:none"' })}
        </div></div>`;

        const root = itemEl('panel');
        const scope: FilterScope = {
            root,
            mount: itemEl('filters'),
            itemSelector: '#recommend-container .item'
        };
        const other = { preloadFilterReady: true, preloadStatusEnabled: true } as OtherSitePlugin;
        const controller = new WeeklyRecommendFilters(scope, () => other);
        destroyables.push(controller);
        controller.init();
        refreshSiteTagFilterBar();

        // 浮层按 筛选 → 状态 → 预加载 → 标签 排序且不含主流标签
        expect(Array.from(scope.mount.children, (el) => el.className)).toEqual([
            'jhs-vlt-filter-bar',
            'status-tag-filter-bar',
            'preload-filter-bar',
            'jhs-site-tag-filter-bar'
        ]);
        expect(scope.mount.textContent).not.toContain('主流标签');

        // 点推荐原生标签不影响主流
        chipEl(scope.mount, '含中字磁鏈').click();
        expect(itemEl('REC-1').style.display).toBe('');
        expect(itemEl('REC-2').style.display).toBe('none');
        expect(itemEl('MAIN-1').style.display).toBe('');

        // 销毁清理 data-site-tag-hidden，但保留基础屏蔽
        controller.destroy();
        expect(itemEl('REC-2').hasAttribute(SITE_TAG_HIDDEN_ATTR)).toBe(false);
        expect(itemEl('REC-2').style.display).toBe('');
        expect(itemEl('REC-HIDE').style.display).toBe('none');
        applySiteTagFilter();
        expect(itemEl('MAIN-1').style.display).toBe('');
    });
});
