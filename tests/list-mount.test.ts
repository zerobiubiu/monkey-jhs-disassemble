// @vitest-environment jsdom
/**
 * 列表页过滤/筛选栏挂载锚点（doc/48）。
 *
 * 回归靶心：JavDB 首页实测 `.tabs.is-boxed` 计数为 1，但它**不在**
 * `body > section > div > div` 这一层 —— 结构式选择器命中 0。此前
 * `status-tag-filter` 有四级兜底（能挂上），`video-lists-tag` 的清单标签筛选栏
 * 只有结构式一条、命中 0 即静默 return，于是首页只显示前一根栏。
 *
 * 本用例固化共享单点的优先级：结构式 → 宽松式 → 容器首子元素 → null。
 */
import { afterEach, describe, expect, it } from 'vitest';

import { findListMountTarget } from '../src/core/util/site/list-mount';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('findListMountTarget — 列表页/首页', () => {
    it('结构式筛选标签栏存在 → 返回它', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="tabs is-boxed">结构式</div>
                <div class="movie-list"></div>
            </div></section>`;

        const target = findListMountTarget('/');

        expect(target).toBe(document.querySelector('body > section > div > div.tabs.is-boxed'));
    });

    it('标签栏嵌在别处（非结构式路径）→ 宽松式命中（首页回归）', () => {
        document.body.innerHTML = `
            <section><div>
                <div class="movie-list">
                    <div class="wrapper"><div class="tabs is-boxed">宽松式</div></div>
                </div>
            </div></section>`;

        const target = findListMountTarget('/');

        expect(target).toBe(document.querySelector('.tabs.is-boxed'));
        expect(document.querySelector('body > section > div > div.tabs.is-boxed')).toBeNull();
    });

    it('演员页 → 演员标签区（宽松式）', () => {
        document.body.innerHTML = `
            <section><div>
                <div><div class="actor-tags tags">演员标签</div></div>
                <div class="tabs is-boxed">首页式标签栏</div>
            </div></section>`;

        const target = findListMountTarget('/actors/MVzk');

        expect(target).toBe(document.querySelector('.actor-tags.tags'));
    });

    it('无任何标签栏 → 兜底到内层容器首子元素', () => {
        document.body.innerHTML = `
            <section><div>
                <div><div class="toolbar">工具栏</div></div>
            </div></section>`;

        const target = findListMountTarget('/');

        expect(target).toBe(document.querySelector('.toolbar'));
    });

    it('页面结构完全缺失 → null（调用方自决，如超时强挂）', () => {
        document.body.innerHTML = '';

        expect(findListMountTarget('/')).toBeNull();
    });
});