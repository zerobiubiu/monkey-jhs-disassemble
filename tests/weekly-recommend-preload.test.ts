// @vitest-environment jsdom
/** 推荐仅打开时参与预加载，使用真实队列与无联网 HTTP 替身验证时序和去重。 */
import $ from 'jquery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEEKLY_RECOMMEND_ITEMS_EVENT, WEEKLY_RECOMMEND_VISIBILITY_EVENT } from '../src/constants/weekly-recommend';
import { OtherSitePlugin } from '../src/plugins/other-site-plugin';
import { cancelPreloadTask, enqueuePreloadTask, preloadListPage, syncAllBadges } from '../src/plugins/other-site/osp-preload';
import { observePreloadLists } from '../src/plugins/other-site/osp-preload-observer';

const state = vi.hoisted(() => ({ cache: {} as Record<string, unknown> }));
vi.mock('../src/core/page-context', () => ({ pageContext: { isHomePage: true } }));
vi.mock('../src/core/storage/persistent-data-store', () => ({
    readPersistentMap: () => state.cache,
    replacePersistentMap: (_namespace: string, _key: string, next: Record<string, unknown>) => {
        state.cache = next;
    }
}));

const plugins: OtherSitePlugin[] = [];
const getSetting = vi.fn(async (_key: string, fallback: unknown) => fallback);
const getCarList = vi.fn(async () => []);
const http = vi.fn(async (url: string) => response(new URL(url).searchParams.get('q')!));

function response(code: string): string {
    return `<div><a class="result" href="https://example.test/v/${code}" data-code="${code}"></a></div>`;
}

function card(code: string, id = code): string {
    return `<div class="item" id="${id}"><a class="box" href="/v/${code}">
        <div class="video-title"><strong>${code}</strong></div><div class="meta"></div>
    </a></div>`;
}

function fixture(main = card('MAIN'), recommendation = card('REC')): HTMLElement {
    document.body.innerHTML = `<section><div><div class="movie-list">${main}</div></div></section>
        <div id="jhs-weekly-recommend-panel" hidden><div id="recommend-container">${recommendation}</div></div>`;
    return document.getElementById('jhs-weekly-recommend-panel')!;
}

function plugin(): OtherSitePlugin {
    const instance = new OtherSitePlugin();
    instance.siteConfigs = [{
        id: 'testBtn',
        getBaseUrl: async () => 'https://example.test',
        itemSelector: '.result',
        searchPath: (base, code) => `${base}/search?q=${code}`,
        getDetailPageHref: (item: JQuery<HTMLElement>) => item.attr('href') || '',
        findCarNumOrTitle: (item: JQuery<HTMLElement>) => item.attr('data-code') || ''
    }];
    vi.spyOn(instance, 'getBean').mockReturnValue({
        findCarNumAndHref: (item: JQuery<HTMLElement>) => ({ carNum: item.find('strong').first().text() })
    } as never);
    plugins.push(instance);
    return instance;
}

function visible(panel: HTMLElement, open: boolean): void {
    panel.hidden = !open;
    document.dispatchEvent(new Event(WEEKLY_RECOMMEND_VISIBILITY_EVENT));
}

beforeEach(() => {
    state.cache = {};
    getSetting.mockReset().mockImplementation(async (_key, fallback) => fallback);
    getCarList.mockReset().mockResolvedValue([]);
    http.mockReset().mockImplementation(async (url) => response(new URL(url).searchParams.get('q')!));
    vi.stubGlobal('$', $);
    vi.stubGlobal('storageManager', { getSetting, getCarList });
    vi.stubGlobal('gmHttp', { get: http });
    vi.stubGlobal('utils', { htmlTo$dom: (html: string) => $(html) });
    vi.stubGlobal('clog', { error: vi.fn(), warn: vi.fn(), debug: vi.fn() });
    window.isDetailPage = false;
    localStorage.clear();
});

afterEach(() => {
    plugins.splice(0).forEach((instance) => instance.destroy());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.replaceChildren();
});

describe('每周推荐按需预加载', () => {
    it('推荐默认隐藏时只请求主列表，唯一推荐不创建预加载徽标', async () => {
        fixture();
        const instance = plugin();
        syncAllBadges(instance);
        await preloadListPage(instance);
        await instance.preloadQueue.waitAllFinished();
        expect(http).toHaveBeenCalledExactlyOnceWith('https://example.test/search?q=MAIN', undefined, undefined, true);
        expect(document.getElementById('REC')!.querySelector('.jhs-preload-status')).toBeNull();
    });

    it('显隐事件触发推荐预加载，反复打开只发一条请求，完成后重开使用缓存', async () => {
        const panel = fixture();
        state.cache.MAIN_test = { url: 'cached', type: 'single' };
        let resolveRequest!: (html: string) => void;
        http.mockImplementation(() => new Promise<string>((resolve) => { resolveRequest = resolve; }));
        const instance = plugin();
        await instance.handle();
        visible(panel, true);
        await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));
        visible(panel, false);
        visible(panel, true);
        visible(panel, false);
        visible(panel, true);
        await Promise.resolve();
        expect(http).toHaveBeenCalledTimes(1);
        resolveRequest(response('REC'));
        await instance.preloadQueue.waitAllFinished();
        visible(panel, false);
        visible(panel, true);
        await Promise.resolve();
        await Promise.resolve();
        expect(http).toHaveBeenCalledTimes(1);
        expect(document.getElementById('REC')!.querySelector('.jhs-ps-success')).not.toBeNull();
    });

    it('初始化期间面板已打开时也处理推荐，主流与推荐同番号共用一个任务且同步徽标', async () => {
        const panel = fixture(card('SAME', 'main-copy'), card('SAME', 'recommend-copy'));
        panel.hidden = false;
        let resolveRequest!: (html: string) => void;
        http.mockImplementation(() => new Promise<string>((resolve) => { resolveRequest = resolve; }));
        const instance = plugin();
        await instance.handle();
        await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));
        await preloadListPage(instance);
        expect(instance.preloadQueue.getTasks()).toHaveLength(1);
        expect(document.querySelectorAll('.jhs-ps-requesting')).toHaveLength(2);
        visible(panel, false);
        resolveRequest(response('SAME'));
        await instance.preloadQueue.waitAllFinished();
        expect(http).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.jhs-ps-success')).toHaveLength(2);
    });

    it('读取评分记录期间关闭推荐，排队前复核后不产生请求或任务', async () => {
        const panel = fixture('', card('REC'));
        panel.hidden = false;
        let resolveRecords!: (records: never[]) => void;
        getCarList.mockImplementation(() => new Promise<never[]>((resolve) => { resolveRecords = resolve; }));
        const instance = plugin();
        const pending = preloadListPage(instance);
        await vi.waitFor(() => expect(getCarList).toHaveBeenCalledTimes(1));
        panel.hidden = true;
        resolveRecords([]);
        await pending;
        await instance.preloadQueue.waitAllFinished();
        expect(http).not.toHaveBeenCalled();
        expect(instance.preloadTasks.size).toBe(0);
    });

    it('打开推荐中的空卡片晚填番号后，可通过内容事件预加载且隐藏时事件无效', async () => {
        const panel = fixture('', '<div class="item" id="late-shell"></div>');
        panel.hidden = false;
        const instance = plugin();
        await instance.handle();
        await Promise.resolve();
        expect(http).not.toHaveBeenCalled();
        document.getElementById('late-shell')!.innerHTML = card('LATE');
        document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));
        await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));
        await instance.preloadQueue.waitAllFinished();
        panel.hidden = true;
        document.getElementById('recommend-container')!.insertAdjacentHTML('beforeend', card('HIDDEN'));
        document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));
        await Promise.resolve();
        expect(http).toHaveBeenCalledTimes(1);
    });

    it('关闭后未执行的推荐独占任务跳过，重开仍可重新排队', async () => {
        const panel = fixture('', card('REC'));
        panel.hidden = false;
        const instance = plugin();
        let unblock!: () => void;
        instance.preloadQueue.addTask(() => new Promise<void>((resolve) => { unblock = resolve; }), 'block');
        await preloadListPage(instance);
        panel.hidden = true;
        unblock();
        await instance.preloadQueue.waitAllFinished();
        expect(http).not.toHaveBeenCalled();
        expect(instance.preloadTasks.get('REC_testBtn')?.status).toBe('cancelled');
        panel.hidden = false;
        await preloadListPage(instance);
        await instance.preloadQueue.waitAllFinished();
        expect(http).toHaveBeenCalledTimes(1);
    });

    it('同番号任务由推荐先入队，推荐关闭后仍为主列表执行', async () => {
        const panel = fixture(card('SAME', 'main-copy'), card('SAME', 'recommend-copy'));
        panel.hidden = false;
        const instance = plugin();
        enqueuePreloadTask(instance, 'SAME', instance.siteConfigs[0], document.getElementById('recommend-copy'));
        panel.hidden = true;
        await instance.preloadQueue.waitAllFinished();
        expect(http).toHaveBeenCalledTimes(1);
        expect(document.getElementById('main-copy')!.querySelector('.jhs-ps-success')).not.toBeNull();
    });

    it('手动取消共享的排队任务时清除同番号每张卡片的旧徽标', async () => {
        const panel = fixture(card('SAME', 'main-copy'), card('SAME', 'recommend-copy'));
        panel.hidden = false;
        const instance = plugin();
        let unblock!: () => void;
        instance.preloadQueue.addTask(() => new Promise<void>((resolve) => { unblock = resolve; }), 'block');
        await preloadListPage(instance);
        expect(document.querySelectorAll('.jhs-ps-queued')).toHaveLength(2);
        expect(cancelPreloadTask(instance, 'SAME_testBtn')).toBe(true);
        expect(document.querySelectorAll('.jhs-preload-status')).toHaveLength(0);
        unblock();
        await instance.preloadQueue.waitAllFinished();
        expect(http).not.toHaveBeenCalled();
    });

    it.each(['enableLoadOtherSite', 'enablePreload'])('%s 关闭时显隐事件不触发推荐请求', async (disabledKey) => {
        const panel = fixture();
        getSetting.mockImplementation(async (key, fallback) => key === disabledKey ? 'no' : fallback);
        const instance = plugin();
        await instance.handle();
        visible(panel, true);
        await Promise.resolve();
        expect(http).not.toHaveBeenCalled();
        expect(instance.preloadTasks.size).toBe(0);
    });

    it('推荐打开时新增卡片触发防抖调度，徽标增删与隐藏推荐变化不重复触发', async () => {
        vi.useFakeTimers();
        const panel = fixture('', '');
        panel.hidden = false;
        const instance = plugin();
        const sync = vi.fn();
        const preload = vi.fn(async () => {});
        observePreloadLists(instance, sync, preload);
        document.getElementById('recommend-container')!.insertAdjacentHTML('beforeend', card('LATE'));
        await Promise.resolve();
        expect(sync).toHaveBeenCalledTimes(1);
        const badge = document.createElement('span');
        badge.className = 'jhs-ps-badge';
        document.getElementById('LATE')!.appendChild(badge);
        await Promise.resolve();
        expect(sync).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(300);
        expect(preload).toHaveBeenCalledTimes(1);
        panel.hidden = true;
        document.getElementById('recommend-container')!.insertAdjacentHTML('beforeend', card('HIDDEN'));
        await Promise.resolve();
        expect(sync).toHaveBeenCalledTimes(1);
    });
});
