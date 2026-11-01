// @vitest-environment jsdom
/** 推荐卡片复用真实过滤和点击管线，存储与页面打开使用无副作用替身。 */
import $ from 'jquery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTOR } from '../src/constants/site';
import { FAVORITE_ACTION, FAVORITED_TEXT, FILTER_ACTION, HAS_WATCH_ACTION, NO, WATCHED_TEXT, YES } from '../src/constants/status';
import type { ListPagePlugin } from '../src/plugins/list-page-plugin';
import { bindClick, findCarNumAndHref, showCarNumBox } from '../src/plugins/list-page/lp-dom';
import { filterMovieList } from '../src/plugins/list-page/lp-filter';

vi.mock('../src/constants/site', () => ({ isJavdbSite: true, isSearchOrUserPage: false, ACTOR: 'actor' }));
vi.mock('../src/core/feature-flags', () => ({ featureFlags: { caseInsensitiveCarNum: true, movieShowTypeVisibility: true } }));

const COUNT_KEYS = [
    'currentPageFilterCount', 'currentPageFavoriteCount', 'currentPageHasWatchCount',
    'currentPageKeywordFilterCount', 'currentPageActorFilterCount', 'currentPageWaitCheckCount', 'currentPageTotalCount',
] as const;

let settings: Record<string, string>;
let plugin: ListPagePlugin;
let translate: ReturnType<typeof vi.fn>;
let openPage: ReturnType<typeof vi.fn>;
let time: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.fn>;

/** 与现有 JavDB 列表卡片契约相同；特意不包含 .tags/.item-tag。 */
function card(carNum: string, title = '普通影片'): HTMLElement {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<a class="box" href="/v/${carNum}" title="${title}">
        <div class="cover"><img src="https://example.test/cover.jpg" /></div>
        <div class="video-title"><strong>${carNum}</strong> ${title}</div><div class="meta">2026-10-29</div>
    </a>`;
    return item;
}

function recommend(...items: HTMLElement[]): HTMLElement {
    const container = document.getElementById('recommend-container')!;
    container.append(...items);
    return container;
}

function main(...items: HTMLElement[]): HTMLElement {
    const container = document.getElementById('main-list')!;
    container.append(...items);
    return container;
}

function counts(): Record<string, number> {
    return Object.fromEntries(COUNT_KEYS.map((key) => [key, plugin[key]]));
}

function clickCover(item: HTMLElement): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    item.querySelector('.cover')!.dispatchEvent(event);
    return event;
}

async function flushClick(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    document.body.innerHTML = '<section><div><div id="main-list" class="movie-list"></div></div></section>' +
        '<div id="recommend-container"></div><button id="waitDownBtn"><span>原主列表统计</span></button>';
    settings = {
        showFilterItem: NO, showFilterActorItem: NO, showFilterKeywordItem: NO,
        showFavoriteItem: YES, showHasWatchItem: YES, showAllItem: NO,
        movieShowType: 'hide', tagPosition: 'rightTop', dialogOpenDetail: YES,
    };
    translate = vi.fn(async () => {});
    openPage = vi.fn();
    time = vi.fn(() => '1ms');
    log = vi.fn();
    vi.stubGlobal('$', $);
    vi.stubGlobal('utils', { time, openPage });
    vi.stubGlobal('clog', { log, error: vi.fn() });
    vi.stubGlobal('storageManager', {
        getCarList: vi.fn(async () => [
            { carNum: 'REC-FAV', status: FAVORITE_ACTION },
            { carNum: 'REC-WATCH', status: HAS_WATCH_ACTION },
            { carNum: 'REC-BLOCK', status: FILTER_ACTION },
            { carNum: 'MAIN-FAV', status: FAVORITE_ACTION },
        ]),
        getTitleFilterKeyword: vi.fn(async () => ['禁词']),
        getBlacklist: vi.fn(async () => [
            { starId: 'male-1', role: ACTOR }, { starId: 'female-1', role: 'actress' },
        ]),
        getBlacklistCarList: vi.fn(async () => [
            { carNum: 'REC-ACTOR', starId: 'male-1', names: '男演员甲' },
            { carNum: 'REC-ACTRESS', starId: 'female-1', names: '女演员乙' },
        ]),
        getSetting: vi.fn(async (key?: string, fallback?: unknown) => key ? settings[key] ?? fallback : settings),
    });
    plugin = {
        ...Object.fromEntries(COUNT_KEYS.map((key, index) => [key, 20 + index])),
        findCarNumAndHref,
        translate,
        parseMovieId: vi.fn(() => 'fc2-demo'),
        getBean: vi.fn(),
    } as unknown as ListPagePlugin;
});

afterEach(() => {
    $(document).off('.jhsListCard');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('推荐卡片复用过滤管线且与主列表统计隔离', () => {
    it.each([
        ['REC-FAV', '普通影片', FAVORITED_TEXT, false],
        ['REC-WATCH', '普通影片', WATCHED_TEXT, false],
        ['REC-BLOCK', '普通影片', '🚫 已屏蔽', true],
        ['REC-KEY', '包含禁词的影片', '❌ 关键词屏蔽', true],
        ['REC-ACTOR', '普通影片', '♂️ 男演员屏蔽', true],
        ['REC-ACTRESS', '普通影片', '♀️ 女演员屏蔽', true],
        ['REC-PENDING', '待鉴定影片', '', false],
    ])('%s 的状态、显隐、翻译与既有规则一致，不写主列表计数', async (carNum, title, label, hidden) => {
        const item = card(carNum, title);
        recommend(item);
        const before = counts();

        await filterMovieList(plugin, [item], false);

        expect(item.getAttribute('data-hide')).toBe(hidden ? YES : null);
        expect(item.style.display === 'none').toBe(hidden);
        expect(item.querySelector('.status-tag')?.textContent ?? '').toBe(label);
        expect(counts()).toEqual(before);
        expect(translate).toHaveBeenCalledOnce();
        expect(time).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        expect(document.querySelector('#waitDownBtn span')!.textContent).toBe('原主列表统计');
    });

    it('推荐无 .tags 时状态标签仍可注入，重复过滤不重复标签', async () => {
        const item = card('REC-FAV');
        recommend(item);
        expect(item.querySelector('.tags, .item-tag, .photo-info')).toBeNull();

        await filterMovieList(plugin, [item], false);
        await filterMovieList(plugin, [item], false);

        expect(item.querySelectorAll('.status-tag')).toHaveLength(1);
        expect(item.querySelector('.status-tag')!.textContent).toBe(FAVORITED_TEXT);
    });

    it('收藏与已读显示设置关闭会隐藏推荐，再开启恢复同一节点', async () => {
        const favorite = card('REC-FAV');
        const watched = card('REC-WATCH');
        recommend(favorite, watched);
        settings.showFavoriteItem = settings.showHasWatchItem = NO;
        await filterMovieList(plugin, [favorite, watched], false);
        expect(favorite.style.display).toBe('none');
        expect(watched.style.display).toBe('none');

        settings.showFavoriteItem = settings.showHasWatchItem = YES;
        await filterMovieList(plugin, [favorite, watched], false);
        expect(favorite.style.display).not.toBe('none');
        expect(watched.style.display).not.toBe('none');
        expect(favorite.hasAttribute('data-hide')).toBe(false);
        expect(watched.hasAttribute('data-hide')).toBe(false);
    });

    it('显示全部覆盖推荐屏蔽规则，但保留状态和原因提示', async () => {
        const item = card('REC-KEY', '包含禁词的影片');
        recommend(item);
        settings.showAllItem = YES;
        await filterMovieList(plugin, [item], false);

        expect(item.style.display).not.toBe('none');
        expect(item.hasAttribute('data-hide')).toBe(false);
        expect(item.querySelector('.status-tag')!.textContent).toBe('❌ 关键词屏蔽');
        expect(item.querySelector('.status-tag')!.getAttribute('data-tip')).toBe('禁词');
    });

    it('隐藏占位模式同样作用于推荐，模式切换时正确恢复', async () => {
        const item = card('REC-BLOCK');
        recommend(item);
        settings.movieShowType = 'visibility';
        await filterMovieList(plugin, [item], false);
        expect(item.getAttribute('data-hide')).toBe(YES);
        expect(item.style.display).not.toBe('none');
        expect((item.firstElementChild as HTMLElement).style.visibility).toBe('hidden');

        settings.movieShowType = 'hide';
        settings.showAllItem = YES;
        await filterMovieList(plugin, [item], false);
        expect(item.hasAttribute('data-hide')).toBe(false);
        expect((item.firstElementChild as HTMLElement).style.visibility).toBe('');
    });

    it('即使输入同时含推荐和主列表，也只有主列表进入统计与日志汇总', async () => {
        const favorite = card('MAIN-FAV');
        const pending = card('MAIN-PENDING');
        const recFavorite = card('REC-FAV');
        const recBlocked = card('REC-BLOCK');
        main(favorite, pending);
        recommend(recFavorite, recBlocked);

        await filterMovieList(plugin, [recFavorite, favorite, recBlocked, pending]);

        expect(counts()).toEqual({
            currentPageFilterCount: 0, currentPageFavoriteCount: 1, currentPageHasWatchCount: 0,
            currentPageKeywordFilterCount: 0, currentPageActorFilterCount: 0,
            currentPageWaitCheckCount: 1, currentPageTotalCount: 2,
        });
        expect(log).toHaveBeenCalledOnce();
        const countTable = document.createElement('div');
        countTable.innerHTML = log.mock.calls[0][0];
        expect(countTable.querySelector('tr:last-child td:last-child strong')!.textContent).toBe('2');
        const snapshot = counts();
        const timedCalls = time.mock.calls.length;
        await filterMovieList(plugin, [recFavorite, recBlocked], false);
        expect(counts()).toEqual(snapshot);
        expect(log).toHaveBeenCalledOnce();
        expect(time).toHaveBeenCalledTimes(timedCalls);
    });
});

describe('推荐与主列表的真实 document 点击委托', () => {
    it('重复绑定后晚到的推荐卡片点击仅打开一次，主列表也保持可用', async () => {
        const mainItem = card('MAIN-FAV');
        main(mainItem);
        await bindClick(plugin);
        await bindClick(plugin);
        const lateItem = card('REC-FAV');
        recommend(lateItem);

        const event = clickCover(lateItem);
        await flushClick();
        expect(event.defaultPrevented).toBe(true);
        expect(openPage).toHaveBeenCalledOnce();
        expect(openPage).toHaveBeenLastCalledWith('/v/REC-FAV', 'REC-FAV', true, expect.anything());
        clickCover(mainItem);
        await flushClick();
        expect(openPage).toHaveBeenCalledTimes(2);
        expect(openPage).toHaveBeenLastCalledWith('/v/MAIN-FAV', 'MAIN-FAV', true, expect.anything());
    });

    it('推荐卡片的元数据按钮不触发影片打开，关闭弹窗模式走新标签页', async () => {
        const item = card('REC-FAV');
        item.querySelector('.cover')!.insertAdjacentHTML('beforeend', '<div class="meta-buttons"><button>原站操作</button></div>');
        recommend(item);
        await bindClick(plugin);
        item.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await flushClick();
        expect(openPage).not.toHaveBeenCalled();

        settings.dialogOpenDetail = NO;
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        clickCover(item);
        await flushClick();
        expect(openPage).not.toHaveBeenCalled();
        expect(open).toHaveBeenCalledExactlyOnceWith('/v/REC-FAV', '_blank', 'noopener,noreferrer');
    });

    it('showCarNumBox 恢复两区同番号临时隐藏，保留真正屏蔽和其他番号', () => {
        const mainItem = card('REC-FAV');
        const recommendItem = card('REC-FAV');
        const blocked = card('REC-FAV');
        const other = card('OTHER');
        main(mainItem, blocked);
        recommend(recommendItem, other);
        $(mainItem).hide().attr('data-hide', 'REC-FAV-hide');
        $(recommendItem).hide().attr('data-hide', 'REC-FAV-hide');
        $(blocked).hide().attr('data-hide', YES);
        $(other).hide().attr('data-hide', 'OTHER-hide');

        showCarNumBox('REC-FAV');

        for (const restored of [mainItem, recommendItem]) {
            expect(restored.style.display).not.toBe('none');
            expect(restored.hasAttribute('data-hide')).toBe(false);
        }
        expect(blocked.style.display).toBe('none');
        expect(blocked.getAttribute('data-hide')).toBe(YES);
        expect(other.style.display).toBe('none');
        expect(other.getAttribute('data-hide')).toBe('OTHER-hide');
    });
});
