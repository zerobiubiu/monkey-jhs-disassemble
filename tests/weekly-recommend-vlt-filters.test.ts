// @vitest-environment jsdom
/** 推荐与主流复用清单筛选组件，各自保有计数、选中、模式及显隐范围。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FilterScope } from '../src/types/filter-scope';
import { VltDb } from '../src/plugins/video-lists-tag/vlt-db';
import { FILTER_MODES, TAG_HIDDEN_ATTR } from '../src/plugins/video-lists-tag/vlt-filter-apply';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

function card(id: string, tags: string[]): string {
    return `<div id="${id}" class="item">${tags.map((tag) =>
        `<span class="jhs-vlt-tag-link">${tag}</span>`
    ).join('')}</div>`;
}

function fixture(): { scope: FilterScope; main: VltTags; scoped: VltTags } {
    // 推荐先出现在 DOM 中，验证主流查找不会误命中先创建的推荐筛选栏。
    document.body.innerHTML = `<div id="panel" data-jhs-filter-scope="weekly">
        <div id="filters"></div><div id="recommend-container">
            ${card('rec-a', ['共同', '推荐'])}${card('rec-b', ['其他'])}
        </div></div>
        <section><div><div class="movie-list">
            ${card('main-a', ['共同'])}${card('main-b', ['主流'])}
        </div></div></section>`;
    const scope: FilterScope = {
        root: document.getElementById('panel')!,
        itemSelector: '#recommend-container .item',
        mount: document.getElementById('filters')!
    };
    const main = new VltTags();
    const scoped = new VltTags(scope);
    scoped.buildFilterBar();
    main.buildFilterBar();
    return { scope, main, scoped };
}

function bar(scope?: FilterScope): HTMLElement {
    if (scope) return scope.mount.querySelector('.jhs-vlt-filter-bar')!;
    return document.querySelector('.jhs-filter-stack .jhs-vlt-filter-bar')!;
}

function chip(value: string, scope?: FilterScope): HTMLElement {
    return Array.from(bar(scope).querySelectorAll<HTMLElement>('.jhs-vlt-filter-chip'))
        .find((element) => element.dataset.value === value)!;
}

beforeEach(() => vi.stubGlobal('GM_setValue', vi.fn()));
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

describe('推荐清单筛选的独立范围', () => {
    it('分别构建两套 UI 与计数，推荐不创建全局自动刷新开关或查询数据库', () => {
        const query = vi.spyOn(VltDb, 'queryMoviesLists');
        const { scope, main, scoped } = fixture();

        expect(document.querySelectorAll('.jhs-vlt-filter-bar')).toHaveLength(2);
        expect(main.collectAllUniqueTags()).toEqual(['主流', '共同']);
        expect(scoped.collectAllUniqueTags()).toEqual(['共同', '其他', '推荐']);
        expect(main.collectTagCounts()).toEqual({ 共同: 1, 主流: 1 });
        expect(scoped.collectTagCounts()).toEqual({ 共同: 1, 推荐: 1, 其他: 1 });
        expect(bar(scope).querySelector('.jhs-vlt-auto-refresh-toggle')).toBeNull();
        expect(bar().querySelector('.jhs-vlt-auto-refresh-toggle')).not.toBeNull();
        expect(query).not.toHaveBeenCalled();
        expect(GM_setValue).not.toHaveBeenCalled();
    });

    it('推荐 active 芯片不进入默认主流筛选，主流 active 也不影响推荐', () => {
        const { scope, main, scoped } = fixture();
        chip('推荐', scope).click();
        main.applyFilter();
        expect(document.getElementById('main-a')!.style.display).toBe('');
        expect(document.getElementById('main-b')!.style.display).toBe('');
        expect(document.getElementById('rec-a')!.style.display).toBe('');
        expect(document.getElementById('rec-b')!.style.display).toBe('none');

        chip('主流').click();
        scoped.applyFilter();
        expect(document.getElementById('main-a')!.style.display).toBe('none');
        expect(document.getElementById('main-b')!.style.display).toBe('');
        expect(document.getElementById('rec-a')!.style.display).toBe('');
        expect(document.getElementById('rec-b')!.style.display).toBe('none');
    });

    it('筛选模式仅修改对应实例，推荐排除模式不改变主流包含模式', () => {
        const { scope, main, scoped } = fixture();
        chip('共同').click();
        chip('共同', scope).click();
        bar(scope).querySelector<HTMLElement>(`[data-mode="${FILTER_MODES.EXCLUDES_ALL}"]`)!.click();

        expect(scoped.currentFilterMode).toBe(FILTER_MODES.EXCLUDES_ALL);
        expect(main.currentFilterMode).toBe(FILTER_MODES.CONTAINS_ANY);
        expect(document.getElementById('rec-a')!.style.display).toBe('none');
        expect(document.getElementById('rec-b')!.style.display).toBe('');
        expect(document.getElementById('main-a')!.style.display).toBe('');
        expect(document.getElementById('main-b')!.style.display).toBe('none');
    });

    it.each(['data-hide', 'data-status-tag-hidden', 'data-preload-hidden', 'data-lrs-hidden'])(
        '其他隐藏原因 %s 存在时仍计算自身条件，清空清单筛选不错误恢复', (otherMarker) => {
            const { scope } = fixture();
            const item = document.getElementById('rec-a')!;
            item.setAttribute(otherMarker, '');
            item.style.display = 'none';

            chip('其他', scope).click();

            expect(item.hasAttribute(TAG_HIDDEN_ATTR)).toBe(true);
            expect(item.style.display).toBe('none');
            chip('其他', scope).click();
            expect(item.hasAttribute(TAG_HIDDEN_ATTR)).toBe(false);
            expect(item.hasAttribute(otherMarker)).toBe(true);
            expect(item.style.display).toBe('none');
            expect(document.getElementById('rec-b')!.style.display).toBe('');
        }
    );

    it('其他栏已隐藏的匹配卡片仍清理自身过期隐藏标记', () => {
        const { scope, scoped } = fixture();
        chip('其他', scope).click();
        const item = document.getElementById('rec-a')!;
        item.setAttribute('data-status-tag-hidden', '');
        item.querySelector('.jhs-vlt-tag-link')!.textContent = '其他';

        scoped.applyFilter();

        expect(item.hasAttribute(TAG_HIDDEN_ATTR)).toBe(false);
        expect(item.style.display).toBe('none');
        item.removeAttribute('data-status-tag-hidden');
        scoped.applyFilter();
        expect(item.style.display).toBe('');
    });

    it('动态刷新保留消失标签的 active 状态，晚到同标签卡片自动套用筛选', () => {
        const { scope, main, scoped } = fixture();
        chip('推荐', scope).click();
        chip('主流').click();
        document.querySelector('#rec-a .jhs-vlt-tag-link:last-child')!.remove();

        scoped.updateFilterBar();

        expect(chip('推荐', scope).classList.contains('jhs-vlt-active')).toBe(true);
        expect(chip('推荐', scope).textContent).toBe('推荐 0');
        expect(document.getElementById('rec-a')!.style.display).toBe('none');
        document.getElementById('recommend-container')!.insertAdjacentHTML('beforeend', card('late', ['推荐']));
        scoped.updateFilterBar();
        main.updateFilterBar();
        expect(chip('推荐', scope).textContent).toBe('推荐 1');
        expect(document.getElementById('late')!.style.display).toBe('');
        expect(chip('主流').classList.contains('jhs-vlt-active')).toBe(true);
        expect(document.getElementById('main-a')!.style.display).toBe('none');
        expect(document.getElementById('main-b')!.style.display).toBe('');
    });
});
