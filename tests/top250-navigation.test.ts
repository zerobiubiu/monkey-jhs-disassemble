// @vitest-environment jsdom
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import $ from 'jquery';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Top250Pagination } from '../src/components/top250/top250-pagination';
import { jsxToString } from '../src/core/jsx-to-string';
import { HitShowPlugin } from '../src/plugins/hit-show-plugin';
import { PluginManager } from '../src/plugins/plugin-manager';
import { Top250Plugin } from '../src/plugins/top250-plugin';

const loginDialog = vi.fn();

beforeEach(() => {
    vi.stubGlobal('$', $);
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('show', { error: vi.fn() });
    vi.stubGlobal('layer', { open: loginDialog });
    loginDialog.mockClear();
    document.body.innerHTML = `<nav class="main-nav"><a class="navbar-item" href="/rankings/top">TOP250</a></nav>
        <div class="main-tabs"><ul><li>猜你喜歡</li></ul></div>
        <section class="section"><div class="container"><nav class="pagination">
            <a class="pagination-previous" href="/rankings/top?t=y2024&page=1">上一頁</a>
            <a class="pagination-next" href="/rankings/top?t=y2024&page=3">下一頁</a>
            <ul class="pagination-list"><li><a class="pagination-link" href="/rankings/top?t=y2024&page=4"><span>4</span></a></li></ul>
        </nav></div></section>`;
});

afterEach(() => {
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
});

describe('原站榜单与脚本增强榜单', () => {
    it.each([
        ['.pagination-previous', 1, {}],
        ['.pagination-next', 3, {}],
        ['.pagination-link span', 4, { ctrlKey: true }],
    ] as const)('点击 %s 保留原站地址、筛选和浏览器默认动作', async (selector, page, modifiers) => {
        history.replaceState(null, '', '/rankings/top?t=y2024&page=2');
        await new Top250Plugin().handle();

        // 在冒泡末端记录浏览器本要跟随的链接；仅测试阻止 jsdom 的跨文档导航。
        let destination: string | undefined;
        const observe = (event: MouseEvent) => {
            if (!event.defaultPrevented) destination = (event.target as Element).closest('a')?.href;
            event.preventDefault();
        };
        window.addEventListener('click', observe);
        try {
            document.querySelector(selector)!.dispatchEvent(new MouseEvent('click', {
                bubbles: true, cancelable: true, ...modifiers,
            }));
        } finally {
            window.removeEventListener('click', observe);
        }
        expect(destination).toBe(`${location.origin}/rankings/top?t=y2024&page=${page}`);
        expect(document.querySelector('.main-nav a')?.getAttribute('href')).toBe('/rankings/top');
        expect(loginDialog).not.toHaveBeenCalled();
    });

    it('榜单外的主导航和旧标签保留增强入口，但不改分页；进入增强页才要求登录', async () => {
        history.replaceState(null, '', '/');
        await new Top250Plugin().handle();
        const entry = document.querySelector<HTMLAnchorElement>('.main-tabs a')!;
        const url = new URL(entry.href);
        expect([url.pathname, url.searchParams.get('handleTop')]).toEqual(['/search_advanced', '1']);
        expect(document.querySelector<HTMLAnchorElement>('.main-nav a')?.href).toBe(entry.href);
        expect(document.querySelector('.pagination-next')?.getAttribute('href')).toBe('/rankings/top?t=y2024&page=3');
        expect(loginDialog).not.toHaveBeenCalled();
        history.replaceState(null, '', entry.href);
        await new Top250Plugin().handle();
        expect(loginDialog).toHaveBeenCalledOnce();
    });

    it.each(['/rankings/top?handleTop=1&page=2', '/advanced_search?handleTop=1', '/search_advanced?handleTop=10', '/search_advanced?q=handleTop=1', '/login?handleTop=1'])('不把 %s 误认为增强榜单', async (url) => {
        history.replaceState(null, '', url);
        await new Top250Plugin().handle();
        expect(loginDialog).not.toHaveBeenCalled();
        expect(document.querySelectorAll('nav.pagination')).toHaveLength(1);
    });

    it('缺少挂载容器时不弹登录框，不开始加载榜单', async () => {
        history.replaceState(null, '', '/search_advanced?handleTop=1');
        document.querySelector('section')!.remove();
        await new Top250Plugin().handle();
        expect(show.error).toHaveBeenCalledOnce();
        expect(loginDialog).not.toHaveBeenCalled();
    });

    it('入口、分类、年份和翻页能 GET 到同一承载页，切换字幕不会修改宿主链接', async () => {
        // HTTP 站点契约独立于生产常量：旧拼写返回 404，而非使用 replaceState 假装落地。
        const shell = '<section class="section"><div class="container"><div class="toolbar"><a class="button" href="/help">站点帮助</a></div></div></section>';
        const server = createServer((req, res) => {
            if (req.method === 'GET' && req.url?.split('?')[0] === '/search_advanced') {
                res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }).end(shell);
            } else {
                res.writeHead(404).end();
            }
        });
        server.listen(0, '127.0.0.1');
        try {
            await once(server, 'listening');
            const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
            const follow = async (anchor: HTMLAnchorElement) => {
                const url = new URL(anchor.pathname + anchor.search, base);
                const response = await fetch(url, { redirect: 'error' });
                expect(response.status, url.pathname + url.search).toBe(200);
                return { url, html: await response.text() };
            };
            await new Top250Plugin().handle();
            const landing = await follow(document.querySelector<HTMLAnchorElement>('.main-nav a')!);
            document.body.innerHTML = landing.html;
            history.replaceState(null, '', landing.url.pathname + landing.url.search);
            const manager = new PluginManager();
            manager.register(HitShowPlugin);
            manager.register(Top250Plugin);
            const plugin = manager.getBean('Top250Plugin');
            plugin.toolBar('all', '', 1);
            plugin.hookPage(1);
            document.querySelector<HTMLElement>('[data-cnsub-value="1"]')!.click();
            const filters = [...document.querySelectorAll<HTMLAnchorElement>('.button-group a[href]')];
            const categories = filters.filter(a => new URL(a.href).searchParams.get('handleType') !== 'year');
            const year = filters.find(a => a.textContent?.trim() === '2024')!;
            const next = document.querySelector<HTMLAnchorElement>('.jhs-top250-pages .pagination-next')!;
            const destinations = await Promise.all([...categories, year, next].map(follow));
            expect(destinations.map(({ url }) => [url.searchParams.get('type_value'), url.searchParams.get('page')]))
                .toEqual([['', null], ['0', null], ['1', null], ['2', null], ['3', null], ['2024', null], ['', '2']]);
            expect(destinations.every(({ url }) => url.searchParams.get('handleTop') === '1' && url.searchParams.get('has_cnsub') === '1')).toBe(true);
            expect(document.querySelector('.toolbar a')?.getAttribute('href')).toBe('/help');
        } finally {
            const closed = once(server, 'close');
            server.close();
            await closed;
        }
    });
});

describe('增强榜单的分页链接', () => {
    it.each([1, 3, 5])('第 %i 页保留筛选、只替换一个 page，首末页无越界链接', (page) => {
        history.replaceState(null, '', '/search_advanced?handleTop=1&handleType=year&type_value=2024&has_cnsub=1&page=2&page=4');
        document.body.innerHTML = jsxToString(createElement(Top250Pagination, { page, search: location.search }));
        const destination = (target: number) => `${location.origin}/search_advanced?handleTop=1&handleType=year&type_value=2024&has_cnsub=1&page=${target}`;
        const href = (selector: string) => document.querySelector<HTMLAnchorElement>(selector)?.href || null;
        expect(href('.pagination-previous')).toBe(page === 1 ? null : destination(page - 1));
        expect(href('.pagination-next')).toBe(page === 5 ? null : destination(page + 1));
        expect(href('[aria-current="page"]')).toBe(destination(page));
        expect([...document.querySelectorAll<HTMLAnchorElement>('.pagination-link')].map(a => a.href))
            .toEqual([1, 2, 3, 4, 5].map(destination));
    });
});
