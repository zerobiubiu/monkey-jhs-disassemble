// @vitest-environment jsdom
/** 首页推荐独立浮层与主列表的边界，覆盖原始翻页 HTML 及搬移后的 DOM。 */
import $ from 'jquery';
import { afterEach, describe, expect, it } from 'vitest';

import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import { siteSelector } from '../src/core/util/site/selectors';
import { BasePlugin } from '../src/plugins/base-plugin';
import { applyFilter } from '../src/plugins/status-tag-filter/stf-apply';
import {
    collectStatusTagCounts,
    countNoStatusItems
} from '../src/plugins/status-tag-filter/stf-collect';
import {
    collectMissingStatusTags,
    countWatchedByScore,
    setCarRecords
} from '../src/plugins/status-tag-filter/stf-score';

function card(id: string, tag = ''): string {
    return `<div id="${id}" class="item"><a class="box" href="/v/${id}">
        <div class="video-title"><strong>${id}</strong></div>
        ${tag ? `<div class="tags has-addons"><span class="tag is-success status-tag">${tag}</span></div>` : ''}
    </a></div>`;
}

function fixture(): string {
    return `<section><div>
        <h1>每週推薦(週一/四更新)</h1>
        <div id="recommend-container" class="movie-list">
            ${card('recommend-a', '推荐独占')}
            <div id="recommend-inner" class="movie-list">${card('recommend-b')}</div>
        </div>
        <div id="main-list" class="movie-list">
            ${card('main-read', '主列表已读')}
            ${card('main-favorite', '主列表收藏')}
            ${card('main-none')}
        </div>
    </div></section>`;
}

function ids(elements: Iterable<Element>): string[] {
    return Array.from(elements, (element) => element.id);
}

function setActiveChip(value: string): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'status-tag-filter-chip active';
    chip.dataset.value = value;
    document.body.appendChild(chip);
    return chip;
}

afterEach(() => {
    document.body.replaceChildren();
    setCarRecords([]);
});

describe('推荐与主列表选择器隔离', () => {
    it.each([false, true])('推荐移入 body 浮层=%s 时只匹配主列表', (moved) => {
        document.body.innerHTML = fixture();
        if (moved) {
            const panel = document.createElement('div');
            document.body.appendChild(panel);
            panel.appendChild(document.querySelector(siteSelector('weeklyRecommend'))!);
        }

        expect(ids(document.querySelectorAll(siteSelector('list')))).toEqual(['main-list']);
        expect(ids(document.querySelectorAll(siteSelector('listItem')))).toEqual([
            'main-read', 'main-favorite', 'main-none'
        ]);
        expect(Array.from(document.querySelectorAll(siteSelector('listItemLink')), (link) =>
            link.getAttribute('href')
        )).toEqual(['/v/main-read', '/v/main-favorite', '/v/main-none']);
        expect(ids($(siteSelector('list')).toArray())).toEqual(['main-list']);
        expect(ids($(siteSelector('listItem')).toArray())).toEqual([
            'main-read', 'main-favorite', 'main-none'
        ]);
    });

    it('下一页原始 HTML 抓取只取得主列表，不把推荐追加进瀑布流', () => {
        const nextPage = new DOMParser().parseFromString(fixture(), 'text/html');
        const selectors = new BasePlugin().getSelector();

        expect(ids($(nextPage).find(selectors.boxSelector).toArray())).toEqual(['main-list']);
        expect(ids($(nextPage).find(selectors.requestDomItemSelector).toArray())).toEqual([
            'main-read', 'main-favorite', 'main-none'
        ]);
        expect(selectors.itemSelector).toBe(siteSelector('listItem'));
    });

    it('推荐容器本身即使也是卡片，仍不进入通用筛选集合', () => {
        document.body.innerHTML = fixture();
        document.querySelector(siteSelector('weeklyRecommend'))!.classList.add('item');

        expect(ids(document.querySelectorAll(siteSelector('filterItem')))).toEqual([
            'main-read', 'main-favorite', 'main-none'
        ]);
    });
});

describe('首页主筛选不影响推荐内容', () => {
    it('标签、无状态卡片与星级统计均排除推荐', () => {
        document.body.innerHTML = fixture() +
            '<div class="tags has-addons"><span class="tag is-success status-tag">非卡片独占</span></div>';
        setCarRecords([
            { carNum: 'main-read', status: HAS_WATCH_ACTION, score: 4 },
            { carNum: 'recommend-a', status: HAS_WATCH_ACTION, score: 5 },
            { carNum: 'recommend-b', status: HAS_WATCH_ACTION, score: 5 }
        ] as never);

        expect(collectStatusTagCounts()).toEqual({ 主列表已读: 1, 主列表收藏: 1 });
        expect(countNoStatusItems()).toBe(1);
        expect(countWatchedByScore()).toEqual({ 4: 1 });
    });

    it('点击主列表标签仅隐藏不匹配的主列表卡片，推荐保持原样', () => {
        document.body.innerHTML = fixture();
        const recommend = document.querySelector(siteSelector('weeklyRecommend'))!;
        const before = recommend.outerHTML;
        setActiveChip('主列表已读');

        applyFilter();

        expect(document.getElementById('main-read')!.style.display).toBe('');
        expect(document.getElementById('main-favorite')!.style.display).toBe('none');
        expect(document.getElementById('main-none')!.style.display).toBe('none');
        expect(recommend.outerHTML).toBe(before);
    });

    it('取消筛选只恢复主列表，不清理推荐原有隐藏状态', () => {
        document.body.innerHTML = fixture();
        const main = document.getElementById('main-none')!;
        const recommend = document.getElementById('recommend-b')!;
        for (const item of [main, recommend]) {
            item.style.display = 'none';
            item.setAttribute('data-status-tag-hidden', '');
        }

        applyFilter();

        expect(main.style.display).toBe('');
        expect(main.hasAttribute('data-status-tag-hidden')).toBe(false);
        expect(recommend.style.display).toBe('none');
        expect(recommend.hasAttribute('data-status-tag-hidden')).toBe(true);
    });

    it('缺失状态标签补渲染只面向主列表', () => {
        document.body.innerHTML = fixture();
        setCarRecords([
            { carNum: 'main-none', status: FAVORITE_ACTION },
            { carNum: 'recommend-b', status: FAVORITE_ACTION }
        ] as never);

        expect(collectMissingStatusTags(() => false).map(({ carNum }) => carNum)).toEqual(['main-none']);
    });

    it('没有推荐时保留原有裸卡片筛选兼容性', () => {
        document.body.innerHTML = card('bare-read', '已读') + card('bare-none');
        setActiveChip('已读');

        applyFilter();

        expect(document.getElementById('bare-read')!.style.display).toBe('');
        expect(document.getElementById('bare-none')!.style.display).toBe('none');
        expect(countNoStatusItems()).toBe(1);
    });
});
