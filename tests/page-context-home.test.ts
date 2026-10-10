// @vitest-environment jsdom
/**
 * JavDB 首页的页面上下文（doc/47）。
 *
 * 背景：过滤/筛选组件（卡片过滤、状态标签芯片栏、清单标签筛选栏）原先只认
 * `window.isListPage`（DOM 检测 `.movie-list`）。首页本身是影片列表页，但若列表
 * 未在 document-idle 前出现，判定即为 false → 组件整体不执行；而历史行为（原脚本
 * 无页面门控）是首页一直展示这些组件。
 *
 * 本用例固化修复后的语义：首页在未检出列表容器时记为 `home` 并属影片列表语境；
 * 检出列表容器时仍是 `list`（既有语义不变，避免影响其它 `pageTypes:['list']` 插件）。
 *
 * 站点常量按模块替身置为 javdb；jsdom 默认 URL 的 pathname 即 `/`（首页）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/constants/site', () => ({
    isJavdbSite: true,
    isMissavSite: false
}));

import {
    detectPageContext,
    initPageContext,
    isJavdbHomePath,
    isVideoListContext
} from '../src/core/page-context';

/** 替身 jQuery：只提供检测用到的 `.movie-list` 计数。 */
function stubMovieList(count: number): void {
    (globalThis as unknown as Record<string, unknown>).$ = (): { length: number } => ({ length: count });
}

afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).$;
});

describe('JavDB 首页判定', () => {
    it('首页未检出 .movie-list → pageType=home，且属影片列表语境', () => {
        stubMovieList(0);

        const ctx = initPageContext();

        expect(ctx.isHomePage).toBe(true);
        expect(ctx.isListPage).toBe(false);
        expect(ctx.pageType).toBe('home');
        expect(isVideoListContext()).toBe(true);
    });

    it('首页检出 .movie-list → 仍是 list（既有语义不变）', () => {
        stubMovieList(1);

        const ctx = initPageContext();

        expect(ctx.isListPage).toBe(true);
        expect(ctx.pageType).toBe('list');
        expect(isVideoListContext()).toBe(true);
    });

    it('home 只由 pathname 决定，与 DOM 计数无关', () => {
        stubMovieList(0);
        expect(detectPageContext().isHomePage).toBe(true);

        stubMovieList(40);
        expect(detectPageContext().isHomePage).toBe(true);
    });

    it('站点标识：javdb 首页 site=javdb、isJavdbSite=true', () => {
        stubMovieList(0);
        const ctx = detectPageContext();

        expect(ctx.site).toBe('javdb');
        expect(ctx.isJavdbSite).toBe(true);
        expect(ctx.isMissavSite).toBe(false);
    });
});

describe('isJavdbHomePath（doc/51 的按页面 CSS 作用域共用同一判定）', () => {
    it('`/` 与空串为首页', () => {
        expect(isJavdbHomePath('/')).toBe(true);
        expect(isJavdbHomePath('')).toBe(true);
    });

    it('其它路径不是首页', () => {
        expect(isJavdbHomePath('/search?q=a')).toBe(false);
        expect(isJavdbHomePath('/users/want_watch')).toBe(false);
        expect(isJavdbHomePath('/v/abc123')).toBe(false);
        expect(isJavdbHomePath('/actors/MVzk')).toBe(false);
    });

    it('detectPageContext 的 isHomePage 与它同源（首页固定为 true）', () => {
        stubMovieList(0);
        expect(detectPageContext().isHomePage).toBe(isJavdbHomePath(window.location.pathname));
    });
});