// @vitest-environment jsdom
/**
 * 列表页过滤/筛选栏挂载点（doc/48、doc/49）。
 *
 * 回归靶心两条（都是现场踩过的坑）：
 * 1. 结构式选择器在首页命中 0（`.tabs.is-boxed` 计数 1 但不在标准层）→ 必须仍能找到锚点；
 * 2. **不能把筛选栏插进卡片网格** —— 锚在影片列表「之前」（同层兄弟），
 *    这是 doc/49 修掉的错乱根因（上一版用宽松式标签栏 + 插其后，栏被当成网格项）。
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
    FILTER_BAR_PRIORITY,
    applyListMountPoint,
    findListMountPoint,
    mountFilterBar
} from '../src/core/util/site/list-mount';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('findListMountPoint — 列表页/首页', () => {
    it('结构式筛选标签栏存在 → 挂在它之后（既有页面保持既有位置）', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="tabs is-boxed">结构式</div>
                <div class="movie-list"></div>
            </div></section>`;

        const mount = findListMountPoint('/');

        expect(mount?.target).toBe(document.querySelector('.tabs.is-boxed'));
        expect(mount?.position).toBe('afterend');
    });

    it('首页形态：标签栏嵌在网格内、结构式命中 0 → 锚在影片列表之前', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="movie-list">
                    <div class="grid-item"><div class="tabs is-boxed">嵌在网格里的标签栏</div></div>
                </div>
            </div></section>`;

        const mount = findListMountPoint('/');

        expect(mount?.target).toBe(document.querySelector('.movie-list'));
        expect(mount?.position).toBe('beforebegin');
        // 结构式路径确实命中 0（本用例的前提）
        expect(document.querySelector('body > section > div > div.tabs.is-boxed')).toBeNull();
    });

    it('锚在列表之前时，插入后筛选栏与列表同层（不会成为网格项）', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="movie-list"><div class="item">卡片</div></div>
            </div></section>`;
        const mount = findListMountPoint('/');
        const bar = document.createElement('div');
        bar.className = 'jhs-vlt-filter-bar';

        applyListMountPoint(mount!, bar);

        const list = document.querySelector('.movie-list')!;
        expect(bar.nextElementSibling).toBe(list);
        expect(bar.parentElement).toBe(list.parentElement);
        expect(list.contains(bar)).toBe(false);
    });

    it('演员页 → 演员标签区之后', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="actor-tags tags">演员标签</div>
                <div class="movie-list"></div>
            </div></section>`;

        const mount = findListMountPoint('/actors/MVzk');

        expect(mount?.target).toBe(document.querySelector('.actor-tags.tags'));
        expect(mount?.position).toBe('afterend');
    });

    it('无影片列表容器 → 挂到页面容器顶部（afterbegin）', () => {
        document.body.innerHTML = `
            <section><div>
                <div><div class="toolbar">工具栏</div></div>
            </div></section>`;

        const mount = findListMountPoint('/');

        expect(mount?.position).toBe('afterbegin');
        expect(mount?.target).toBe(document.querySelector('body > section > div > div'));
    });

    it('页面结构完全缺失 → null（调用方自决，如超时强挂）', () => {
        document.body.innerHTML = '';

        expect(findListMountPoint('/')).toBeNull();
    });
});

describe('jhs-filter-stack — 三根栏的顺序权威（doc/50）', () => {
    const LIST_HTML = `
        <section><div>
            <div class="movie-list"><div class="item">卡片</div></div>
        </div></section>`;

    /** 造一根筛选栏并带上类名（顺序断言只看位置）。 */
    const makeBar = (cls: string): HTMLElement => {
        const bar = document.createElement('div');
        bar.className = cls;
        return bar;
    };

    it('无论挂载先后，栈内顺序恒为 筛选 → 状态 → 预加载', () => {
        document.body.innerHTML = LIST_HTML;

        // 故意逆序挂载
        mountFilterBar(makeBar('preload-filter-bar'), FILTER_BAR_PRIORITY.preload);
        mountFilterBar(makeBar('status-tag-filter-bar'), FILTER_BAR_PRIORITY.status);
        mountFilterBar(makeBar('jhs-vlt-filter-bar'), FILTER_BAR_PRIORITY.vlt);

        const stack = document.querySelector('.jhs-filter-stack')!;
        expect([...stack.children].map((el) => el.className)).toEqual([
            'jhs-vlt-filter-bar',
            'status-tag-filter-bar',
            'preload-filter-bar'
        ]);
    });

    it('栈容器只创建一次，且挂在影片列表之前（与列表同层）', () => {
        document.body.innerHTML = LIST_HTML;

        mountFilterBar(makeBar('jhs-vlt-filter-bar'), FILTER_BAR_PRIORITY.vlt);
        mountFilterBar(makeBar('status-tag-filter-bar'), FILTER_BAR_PRIORITY.status);

        const stacks = document.querySelectorAll('.jhs-filter-stack');
        expect(stacks).toHaveLength(1);
        const list = document.querySelector('.movie-list')!;
        expect(stacks[0].nextElementSibling).toBe(list);
        expect(list.contains(stacks[0])).toBe(false);
    });

    it('无可用锚点 → 入栈失败且不建空容器', () => {
        document.body.innerHTML = '';

        expect(mountFilterBar(makeBar('jhs-vlt-filter-bar'), FILTER_BAR_PRIORITY.vlt)).toBe(false);
        expect(document.querySelector('.jhs-filter-stack')).toBeNull();
    });
});