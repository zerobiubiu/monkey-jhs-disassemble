// @vitest-environment jsdom
/** 推荐与主列表共享解析及精准刷新，主列表的筛选、翻页契约继续独立。 */
import $ from 'jquery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEEKLY_RECOMMEND_ITEMS_EVENT } from '../src/constants/weekly-recommend';
import { initPageContext } from '../src/core/page-context';
import { refreshItemStatusTag } from '../src/plugins/detail-page-button/dpb-want-watched';
import type { DetailPageButtonPlugin } from '../src/plugins/detail-page-button-plugin';
import { revertTranslation } from '../src/plugins/list-page/lp-translate';
import type { ListPagePlugin } from '../src/plugins/list-page-plugin';
import { RATING_CONFIG } from '../src/plugins/rating-display/rating-config';
import { VltDb } from '../src/plugins/video-lists-tag/vlt-db';
import { VideoListsTagPlugin } from '../src/plugins/video-lists-tag/vlt-plugin';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

vi.mock('../src/plugins/video-lists-tag/vlt-sync', () => ({
    removeFromNonProtectedListsOnWatch: vi.fn(),
    setupCheckboxListener: vi.fn(),
    setupCreateListButton: vi.fn(),
    setupListManagementListener: vi.fn(),
    removeDetailPageCheckbox: vi.fn(),
    updateDetailPageCheckboxLabel: vi.fn()
}));
vi.mock('../src/plugins/video-lists-tag/vlt-remote-sync', () => ({ setupListMgmtBroadcastListener: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-reconcile', () => ({
    setAutoReconcileDelay: vi.fn(),
    setAutoServerSyncEnabled: vi.fn()
}));
vi.mock('../src/plugins/video-lists-tag/vlt-checkbox', () => ({
    setAutoFavCleanupEnabled: vi.fn(),
    setProtectedKeywords: vi.fn()
}));

function card(id: string, code = 'SAME-001'): string {
    return `<div id="${id}" class="item"><a class="box" href="/v/${id}" title="原始标题">
        <div class="cover"></div>
        <div class="video-title" title="译文"><strong>${code}</strong> 译文</div>
        <div class="meta"></div></a></div>`;
}

function fixture(): void {
    // 推荐不依赖 movie-list 类；站点异步重建为普通 div 时仍需正常处理。
    document.body.innerHTML = `<section><div>
        <div class="movie-list">${card('main')}</div>
    </div></section><div id="recommend-container">${card('recommend')}</div>`;
}

function tag(name: string) {
    return { name, url: null, style: { name: 'primary', bg: '#123456', text: '#ffffff' } };
}

beforeEach(() => {
    vi.stubGlobal('$', $);
    vi.stubGlobal('GM_getValue', vi.fn(() => true));
    vi.stubGlobal('clog', { error: vi.fn() });
    fixture();
    initPageContext();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

describe('推荐清单标签接入普通卡片解析', () => {
    it.each([false, true])('推荐缺少 meta=%s 时渲染清单标签，优先使用原 meta 锚点', async (withoutMeta) => {
        vi.spyOn(VltDb, 'queryMoviesLists').mockResolvedValue({ 'SAME-001': [tag('推荐清单')] });
        const plugin = new VltTags();
        await plugin.fetchTags(['SAME-001']);
        const item = document.getElementById('recommend')!;
        if (withoutMeta) item.querySelector('.meta')!.remove();
        const anchor = item.querySelector(withoutMeta ? '.video-title' : '.meta');

        plugin.addTagDisplay(item);

        const display = item.querySelector('.jhs-vlt-tags-display');
        expect(display?.textContent).toBe('推荐清单');
        expect(display?.previousElementSibling).toBe(anchor);
    });

    it('初始化为主列表与无 movie-list 类的推荐卡片均查询并渲染标签', async () => {
        const query = vi.spyOn(VltDb, 'queryMoviesLists').mockResolvedValue({
            'SAME-001': [tag('初始化标签')]
        });
        const plugin = new VltTags();
        vi.spyOn(plugin, 'buildFilterBar').mockImplementation(() => {});

        await plugin.initExistingItems();

        expect(query).toHaveBeenCalledOnce();
        expect(query.mock.calls[0][0]).toContain('SAME-001');
        expect(document.querySelector('#main .jhs-vlt-tags-display')?.textContent).toBe('初始化标签');
        expect(document.querySelector('#recommend .jhs-vlt-tags-display')?.textContent).toBe('初始化标签');
    });

    it('精准刷新同时更新主列表与推荐中的同番号实例', async () => {
        const query = vi.spyOn(VltDb, 'queryMoviesLists').mockResolvedValue({ 'SAME-001': [tag('旧标签')] });
        const plugin = new VltTags();
        vi.spyOn(plugin, 'updateFilterBar').mockImplementation(() => {});
        await plugin.fetchTags(['SAME-001']);
        plugin.addTagDisplay(document.getElementById('main')!);
        plugin.addTagDisplay(document.getElementById('recommend')!);
        query.mockResolvedValue({ 'SAME-001': [tag('新标签')] });

        await plugin.refreshDesignation('SAME-001');

        expect(document.querySelector('#main .jhs-vlt-tags-display')?.textContent).toBe('新标签');
        expect(document.querySelector('#recommend .jhs-vlt-tags-display')?.textContent).toBe('新标签');
        expect(document.querySelectorAll('.jhs-vlt-tags-display')).toHaveLength(2);
    });

    it('标签数据未变化时也补齐晚到的推荐实例', async () => {
        vi.spyOn(VltDb, 'queryMoviesLists').mockResolvedValue({ 'SAME-001': [tag('已有标签')] });
        const plugin = new VltTags();
        await plugin.fetchTags(['SAME-001']);
        plugin.addTagDisplay(document.getElementById('main')!);

        await plugin.refreshDesignation('SAME-001');

        expect(document.querySelector('#recommend .jhs-vlt-tags-display')?.textContent).toBe('已有标签');
        expect(document.querySelectorAll('.jhs-vlt-tags-display')).toHaveLength(2);
    });

    it('全量刷新删除旧显示后为两个区域重建标签', async () => {
        vi.spyOn(VltDb, 'queryMoviesLists').mockResolvedValue({ 'SAME-001': [tag('全量新标签')] });
        const plugin = new VltTags();
        vi.spyOn(plugin, 'updateFilterBar').mockImplementation(() => {});
        for (const item of document.querySelectorAll('.item')) {
            const old = document.createElement('div');
            old.className = 'jhs-vlt-tags-display';
            old.textContent = '过期标签';
            item.appendChild(old);
        }

        await plugin.refreshAllTags();

        expect(document.querySelector('#main .jhs-vlt-tags-display')?.textContent).toBe('全量新标签');
        expect(document.querySelector('#recommend .jhs-vlt-tags-display')?.textContent).toBe('全量新标签');
    });
});

describe('推荐原生卡片晚填事件接线', () => {
    it('空卡片填充后事件触发增量处理，销毁后移除监听', async () => {
        const item = document.getElementById('recommend')!;
        item.replaceChildren();
        vi.spyOn(VltTags.prototype, 'initExistingItems').mockResolvedValue();
        vi.spyOn(VltTags.prototype, 'setupAutoRefreshListener').mockImplementation(() => {});
        vi.spyOn(VltTags.prototype, 'buildFilterBar').mockImplementation(() => {});
        const parse = vi.spyOn(VltTags.prototype, 'handleNewItems').mockResolvedValue();
        const plugin = new VideoListsTagPlugin();
        try {
            await plugin.handle();
            parse.mockClear();
            item.innerHTML = '<a href="/v/late"><div class="video-title"><strong>LATE-001</strong></div></a>';

            document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));

            expect(parse).toHaveBeenCalledExactlyOnceWith([item]);
            plugin.destroy();
            parse.mockClear();
            document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));
            expect(parse).not.toHaveBeenCalled();
        } finally {
            plugin.destroy();
        }
    });
});

describe('推荐的精准状态、评分和翻译还原', () => {
    it('精准状态刷新覆盖两区同番号卡片，排除区域外无关裸卡片', () => {
        document.body.insertAdjacentHTML('beforeend', card('outside'));
        const render = vi.fn();
        const plugin = { getBean: () => ({ renderItemStatusTag: render }) } as unknown as DetailPageButtonPlugin;

        refreshItemStatusTag(plugin, 'SAME-001');

        expect(render.mock.calls.map(([item]) => item.id)).toEqual(['main', 'recommend']);
        expect(render).toHaveBeenCalledWith(document.getElementById('recommend'), 'SAME-001');
    });

    it('评分既覆盖无 movie-list 类的推荐，也保留原用户列卡片', () => {
        document.body.insertAdjacentHTML('beforeend', '<div class="is-user-page"><div id="user-card" class="column is-one-quarter"></div></div>');

        expect(Array.from(document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR), (item) => item.id))
            .toEqual(['main', 'recommend', 'user-card']);
        expect(document.getElementById('recommend')!.closest(RATING_CONFIG.ITEM_SELECTOR)?.id).toBe('recommend');
    });

    it('还原标题同时覆盖推荐与主列表，不修改番号', async () => {
        await revertTranslation({} as ListPagePlugin);

        for (const id of ['main', 'recommend']) {
            const title = document.querySelector(`#${id} .video-title`)!;
            expect(title.querySelector('strong')!.textContent).toBe('SAME-001');
            expect(title.textContent).toContain('原始标题');
            expect(title.hasAttribute('title')).toBe(false);
        }
    });
});
