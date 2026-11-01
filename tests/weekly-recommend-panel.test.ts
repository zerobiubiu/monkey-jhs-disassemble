// @vitest-environment jsdom
/** 推荐原节点搬移、浮层交互及生命周期回归；不以 jsdom 代替真实布局验收。 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEEKLY_RECOMMEND_VISIBILITY_EVENT } from '../src/constants/weekly-recommend';
import { pageContext } from '../src/core/page-context';
import { dockLoadAllBtn } from '../src/plugins/auto-page/ap-scroll';
import type { AutoPagePlugin } from '../src/plugins/auto-page-plugin';
import { ensureBatchSideBar, ensureBatchSideBarContainer } from '../src/plugins/list-page/lp-batch';
import { WeeklyRecommendController } from '../src/plugins/list-page/weekly-recommend';

vi.mock('../src/core/page-context', () => ({ pageContext: { isHomePage: true } }));

const controllers: WeeklyRecommendController[] = [];

function createController(onItemsChanged?: () => void): WeeklyRecommendController {
    const controller = new WeeklyRecommendController(onItemsChanged);
    controllers.push(controller);
    return controller;
}

function mountFixture(): HTMLElement {
    document.body.innerHTML = `<section><div id="home">
        <p id="before">首页公告</p>
        <h1>每週推薦<small>(週一/四更新)</small></h1>
        <!-- 原站推荐切换项与占位内容 -->
        <nav id="recommend-tabs"><button id="native-tab">切换推荐</button></nav>
        <div id="recommend-container"><a id="native-link" href="/v/demo">推荐影片</a></div>
        <div id="main-list" class="movie-list"><div class="item">主列表影片</div></div>
    </div></section><button id="outside">其他操作</button>`;
    return document.getElementById('home')!;
}

function controls() {
    return {
        entry: document.querySelector<HTMLElement>('.jhs-weekly-recommend-entry')!,
        panel: document.getElementById('jhs-weekly-recommend-panel')!,
        toggle: document.querySelector<HTMLButtonElement>('.jhs-weekly-recommend-toggle')!,
        close: document.querySelector<HTMLButtonElement>('.jhs-weekly-recommend-close')!,
    };
}

/** 只提取实际显示的文字，兼容保留原生节点后以 hidden/CSS 隐藏的后缀。 */
function visibleText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node instanceof HTMLElement) {
        const style = getComputedStyle(node);
        if (node.hidden || style.display === 'none' || style.visibility === 'hidden') return '';
    }
    return [...node.childNodes].map(visibleText).join('');
}

beforeEach(() => {
    vi.useFakeTimers();
    pageContext.isHomePage = true;
});

afterEach(() => {
    for (const controller of controllers.splice(0)) controller.destroy();
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('每周推荐浮层：范围与原生节点', () => {
    it('只搬移 h1 到推荐容器的连续节点，保留节点身份与原生监听', () => {
        const home = mountFixture();
        const heading = home.querySelector('h1')!;
        const tabs = document.getElementById('recommend-tabs')!;
        const recommend = document.getElementById('recommend-container')!;
        const nativeTab = document.getElementById('native-tab')!;
        const before = document.getElementById('before')!;
        const main = document.getElementById('main-list')!;
        const nativeListener = vi.fn();
        nativeTab.addEventListener('click', nativeListener);

        createController().init();
        const { panel } = controls();

        expect(panel.parentNode).toBe(document.body);
        expect(panel.querySelector('h1')).toBe(heading);
        expect(panel.querySelector('#recommend-tabs')).toBe(tabs);
        expect(panel.querySelector('#recommend-container')).toBe(recommend);
        expect(before.parentNode).toBe(home);
        expect(main.parentNode).toBe(home);
        expect(panel.contains(main)).toBe(false);
        expect(panel.textContent).toContain('週一/四更新');
        nativeTab.click();
        expect(nativeListener).toHaveBeenCalledOnce();
        expect(document.querySelectorAll('#recommend-container')).toHaveLength(1);
    });

    it('销毁按原顺序精确还原文本、注释与元素，保留推荐后续动态内容', () => {
        const home = mountFixture();
        const originalNodes = [...home.childNodes];
        const controller = createController();
        controller.init();
        const dynamicLink = document.createElement('a');
        dynamicLink.textContent = '站点后续加载的推荐';
        document.getElementById('recommend-container')!.appendChild(dynamicLink);

        controller.destroy();

        expect(home.childNodes.length).toBe(originalNodes.length);
        originalNodes.forEach((node, index) => expect(home.childNodes[index]).toBe(node));
        expect(home.querySelector('#recommend-container')!.lastChild).toBe(dynamicLink);
        expect(document.querySelector('.jhs-weekly-recommend-entry')).toBeNull();
        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
    });

    it('重复初始化只建立一套入口与浮层', () => {
        mountFixture();
        const controller = createController();
        controller.init();
        const first = controls();
        controller.init();
        controller.init();

        expect(document.querySelectorAll('.jhs-weekly-recommend-entry')).toHaveLength(1);
        expect(document.querySelectorAll('#jhs-weekly-recommend-panel')).toHaveLength(1);
        expect(controls().panel).toBe(first.panel);
        first.toggle.click();
        expect(first.panel.hidden).toBe(false);
    });
});

describe('每周推荐入口：复用常驻批量侧栏', () => {
    it('入口是 body 直属侧栏的首个按钮，复用侧栏样式且首页不留占位元素', () => {
        const home = mountFixture();
        const before = document.getElementById('before')!;
        const main = document.getElementById('main-list')!;
        createController().init();
        const { entry, toggle } = controls();
        const side = document.querySelector<HTMLElement>('body > .jhs-lp-batch-side')!;

        expect(side).not.toBeNull();
        expect(entry).toBe(toggle);
        expect(toggle.tagName).toBe('BUTTON');
        expect(toggle.parentElement).toBe(side);
        expect(side.firstElementChild).toBe(toggle);
        expect(toggle.classList.contains('jhs-lp-batch-side-btn')).toBe(true);
        expect(home.contains(entry)).toBe(false);
        expect([...home.children]).toEqual([before, main]);
        expect(document.querySelectorAll('body > .jhs-lp-batch-side')).toHaveLength(1);
    });

    it('复用已有侧栏并保留其按钮身份和监听，不重新渲染已有选择组', () => {
        mountFixture();
        const side = document.createElement('div');
        side.className = 'jhs-lp-batch-side';
        document.body.appendChild(side);
        ensureBatchSideBar(side);
        const requestList = side.querySelector<HTMLButtonElement>('[data-act="request-list"]')!;
        const listener = vi.fn();
        requestList.addEventListener('click', listener);
        createController().init();

        expect(controls().toggle.parentElement).toBe(side);
        expect(side.querySelector('[data-act="request-list"]')).toBe(requestList);
        expect(document.querySelectorAll('.jhs-lp-batch-side')).toHaveLength(1);
        requestList.click();
        expect(listener).toHaveBeenCalledOnce();
    });

    it('侧栏刷新保持推荐入口的节点身份、首位和开关监听', () => {
        mountFixture();
        createController().init();
        const { toggle, panel } = controls();
        const side = toggle.parentElement!;
        ensureBatchSideBar(side);
        ensureBatchSideBar(side);
        expect(ensureBatchSideBarContainer()).toBe(side);

        expect(side.firstElementChild).toBe(toggle);
        expect(side.querySelectorAll('.jhs-weekly-recommend-toggle')).toHaveLength(1);
        toggle.click();
        expect(panel.hidden).toBe(false);
        toggle.click();
        expect(panel.hidden).toBe(true);
    });

    it('加载全部晚到时停靠在推荐按钮之后，刷新后仍保持第一、第二顺序', () => {
        mountFixture();
        createController().init();
        const { toggle } = controls();
        const side = toggle.parentElement!;
        const loadAll = document.createElement('button');
        loadAll.className = 'jhs-load-all-btn';
        loadAll.textContent = '加载全部';
        document.body.appendChild(loadAll);
        const schedule = vi.fn();
        const plugin = { loadAllBtn: loadAll, supervisor: { setTimeout: schedule } } as unknown as AutoPagePlugin;

        dockLoadAllBtn(plugin);
        ensureBatchSideBar(side);
        dockLoadAllBtn(plugin);

        expect(side.firstElementChild).toBe(toggle);
        expect(side.children[1]).toBe(loadAll);
        expect(loadAll.classList.contains('is-docked')).toBe(true);
        expect(schedule).not.toHaveBeenCalled();
    });

    it('加载全部先已停靠时，推荐随后挂载仍插到它前面', () => {
        mountFixture();
        const side = ensureBatchSideBarContainer();
        const loadAll = document.createElement('button');
        loadAll.className = 'jhs-load-all-btn';
        const plugin = { loadAllBtn: loadAll, supervisor: { setTimeout: vi.fn() } } as unknown as AutoPagePlugin;
        dockLoadAllBtn(plugin);
        expect(side.firstElementChild).toBe(loadAll);

        createController().init();

        expect(side.firstElementChild).toBe(controls().toggle);
        expect(side.children[1]).toBe(loadAll);
        expect(document.querySelectorAll('.jhs-lp-batch-side')).toHaveLength(1);
    });

    it('非首页保留现有侧栏，不插入每周推荐按钮', () => {
        mountFixture();
        const side = ensureBatchSideBarContainer();
        const originalButtons = [...side.children];
        pageContext.isHomePage = false;
        createController().init();

        expect([...side.children]).toEqual(originalButtons);
        expect(document.querySelector('.jhs-weekly-recommend-toggle')).toBeNull();
        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
    });
});

describe('每周推荐浮层：按钮、键盘与外部点击', () => {
    it('真实样式中的 display:flex 不覆盖 hidden，开关同时改变计算显示状态', () => {
        mountFixture();
        const style = document.createElement('style');
        style.textContent = readFileSync(resolve('src/styles/list-page/weekly-recommend.css'), 'utf8');
        document.head.appendChild(style);
        try {
            createController().init();
            const { panel, toggle } = controls();
            expect(getComputedStyle(panel).display).toBe('none');
            toggle.click();
            expect(getComputedStyle(panel).display).toBe('flex');
            toggle.click();
            expect(getComputedStyle(panel).display).toBe('none');
        } finally {
            style.remove();
        }
    });

    it('默认隐藏，入口按钮切换显示与 ARIA 状态', () => {
        mountFixture();
        createController().init();
        const { panel, toggle, close } = controls();

        expect(panel.hidden).toBe(true);
        expect(panel.getAttribute('role')).toBe('dialog');
        expect(panel.getAttribute('aria-modal')).toBe('false');
        expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById(panel.getAttribute('aria-labelledby')!)).not.toBeNull();
        toggle.click();
        expect(panel.hidden).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(close);
        toggle.click();
        expect(panel.hidden).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(toggle);
    });

    it('关闭按钮隐藏浮层并把焦点交回入口', () => {
        mountFixture();
        createController().init();
        const { panel, toggle, close } = controls();
        toggle.click();
        close.click();

        expect(panel.hidden).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(toggle);
    });

    it('Escape 关闭浮层并阻止同一按键继续冒泡', () => {
        mountFixture();
        createController().init();
        const { panel, toggle, close } = controls();
        toggle.click();
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        const windowListener = vi.fn();
        window.addEventListener('keydown', windowListener);
        try {
            close.dispatchEvent(event);
            expect(panel.hidden).toBe(true);
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(toggle);
            expect(windowListener).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener('keydown', windowListener);
        }
    });

    it('已由原弹层处理的 Escape 不再关闭推荐，其他按键也不关闭', () => {
        mountFixture();
        createController().init();
        const { panel, toggle, close } = controls();
        toggle.click();
        const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        handled.preventDefault();
        close.dispatchEvent(handled);
        close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(panel.hidden).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('浮层内部点击不关闭，外部点击关闭且不夺走外部焦点', () => {
        mountFixture();
        createController().init();
        const { panel, toggle } = controls();
        toggle.click();
        document.getElementById('native-link')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(panel.hidden).toBe(false);
        const outside = document.getElementById('outside')!;
        outside.focus();
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));

        expect(panel.hidden).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(outside);
    });

    it('销毁清理监听，旧入口不再打开已移除的浮层', () => {
        mountFixture();
        const controller = createController();
        controller.init();
        const { panel, toggle } = controls();
        controller.destroy();
        toggle.click();
        expect(panel.hidden).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        controller.init();
        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
    });
});

describe('每周推荐浮层：渐进增强与异步骨架', () => {
    it('非首页完全保留页面且不创建等待任务', () => {
        const home = mountFixture();
        const html = home.innerHTML;
        pageContext.isHomePage = false;
        createController().init();

        expect(home.innerHTML).toBe(html);
        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
        '<h1>每週推薦</h1><div id="main-list">主列表</div>',
        '<div id="recommend-container">推荐</div>',
        '<h1>每週推薦</h1><div><div id="recommend-container">推荐</div></div>',
        '<div id="recommend-container">推荐</div><h1>每週推薦</h1>',
    ])('推荐骨架缺失或边界不匹配时不修改内容：%s', (html) => {
        document.body.innerHTML = `<section><div id="home">${html}</div></section>`;
        const before = document.body.innerHTML;
        createController().init();

        expect(document.body.innerHTML).toBe(before);
        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
    });

    it('推荐骨架在等待窗口内到达后自动挂载，反复 init 不重复等待', async () => {
        document.body.innerHTML = '<section><div id="home"><div id="main-list">主列表</div></div></section>';
        const controller = createController();
        controller.init();
        controller.init();
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(9000);
        const home = document.getElementById('home')!;
        home.insertAdjacentHTML('afterbegin', '<h1>每週推薦</h1><div id="recommend-container">异步推荐</div>');
        await Promise.resolve();

        expect(controls().panel.hidden).toBe(true);
        expect(controls().panel.textContent).toContain('异步推荐');
        expect(document.querySelectorAll('#jhs-weekly-recommend-panel')).toHaveLength(1);
    });

    it('超过十秒停止观察，不因后续无关 DOM 变化继续挂载', async () => {
        document.body.innerHTML = '<section><div id="home"></div></section>';
        createController().init();
        vi.advanceTimersByTime(10000);
        document.getElementById('home')!.innerHTML = '<h1>每週推薦</h1><div id="recommend-container">迟到推荐</div>';
        await Promise.resolve();

        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('等待期间销毁立即清理定时器和观察器', async () => {
        document.body.innerHTML = '<section><div id="home"></div></section>';
        const controller = createController();
        controller.init();
        expect(vi.getTimerCount()).toBe(1);
        controller.destroy();
        expect(vi.getTimerCount()).toBe(0);
        document.getElementById('home')!.innerHTML = '<h1>每週推薦</h1><div id="recommend-container">迟到推荐</div>';
        await Promise.resolve();

        expect(document.getElementById('jhs-weekly-recommend-panel')).toBeNull();
    });
});

describe('每周推荐标题：隐藏更新时间后缀', () => {
    it.each([
        '每週推薦(週一/四更新) 更新於: 2026-10-29',
        '每週推薦<small>(週一/四更新)</small> <span>更新於: 2026-10-29</span>',
        '每週推薦<small>(週一/四更新)</small> 更新于: 2026-10-29',
        '每週推薦<small>(週一/四更新)</small> <span>Updated at: 2026-10-29</span>',
        '每週推薦<small>(週一/四更新) 更新於: 2026-10-29</small>',
    ])('只显示更新计划，销毁时原样恢复标题节点：%s', (html) => {
        mountFixture();
        const heading = document.querySelector('h1')!;
        heading.innerHTML = html;
        const originalNodes = [...heading.childNodes];
        const small = heading.querySelector('small');
        const style = document.createElement('style');
        style.textContent = readFileSync(resolve('src/styles/list-page/weekly-recommend.css'), 'utf8');
        document.head.appendChild(style);
        const controller = createController();
        try {
            controller.init();
            controls().toggle.click();
            expect(visibleText(heading).trim()).toBe('每週推薦(週一/四更新)');
            if (small) {
                expect(heading.querySelector('small')).toBe(small);
                expect(visibleText(small)).toContain('(週一/四更新)');
            }
            controller.destroy();
            expect(heading.innerHTML).toBe(html);
            originalNodes.forEach((node, index) => expect(heading.childNodes[index]).toBe(node));
        } finally {
            style.remove();
        }
    });
});

describe('每周推荐变化通知', () => {
    it('空卡片补齐原生身份和链接会重新通知，增强标签与译文不触发循环', async () => {
        mountFixture();
        const onItemsChanged = vi.fn();
        const controller = createController(onItemsChanged);
        controller.init();
        onItemsChanged.mockClear();
        const recommend = document.getElementById('recommend-container')!;
        const item = document.createElement('div');
        item.className = 'item';
        recommend.appendChild(item);
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        onItemsChanged.mockClear();

        item.innerHTML = '<a class="box" href="/v/first"><div class="video-title"><strong>REC-001</strong> 原生标题</div></a>';
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        onItemsChanged.mockClear();
        const nativeLink = item.querySelector('a.box')!;
        const nativeTitle = item.querySelector('.video-title')!;
        const nativeCarNum = nativeTitle.querySelector('strong')!.firstChild!;

        item.insertAdjacentHTML('beforeend', '<div class="tags"><span class="status-tag">已读</span></div>' +
            '<div class="jhs-vlt-tags-display"><a href="/lists/local">我的清单</a></div>' +
            '<div class="jhs-preload-status-bar"><span class="jhs-preload-status">排队中</span></div>');
        nativeTitle.lastChild!.textContent = ' 翻译后的标题';
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).not.toHaveBeenCalled();
        item.querySelector('.status-tag')!.textContent = '已收藏';
        item.querySelector('.jhs-preload-status')!.textContent = '成功';
        item.querySelector('.jhs-vlt-tags-display a')!.setAttribute('href', '/lists/another');
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).not.toHaveBeenCalled();

        nativeCarNum.textContent = 'REC-002';
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        onItemsChanged.mockClear();
        nativeLink.setAttribute('href', '/v/second');
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();

        controller.destroy();
        onItemsChanged.mockClear();
        nativeCarNum.textContent = 'REC-003';
        nativeLink.setAttribute('href', '/v/third');
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).not.toHaveBeenCalled();
    });

    it('默认隐藏不广播打开事件，开关广播时 panel.hidden 已同步', () => {
        mountFixture();
        const hiddenStates: boolean[] = [];
        const listener = () => hiddenStates.push(controls().panel.hidden);
        document.addEventListener(WEEKLY_RECOMMEND_VISIBILITY_EVENT, listener);
        try {
            createController().init();
            expect(hiddenStates).toEqual([]);
            const { toggle, close } = controls();
            toggle.click();
            close.click();
            toggle.click();
            document.getElementById('outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
            toggle.click();
            close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            expect(hiddenStates).toEqual([false, true, false, true, false, true]);
        } finally {
            document.removeEventListener(WEEKLY_RECOMMEND_VISIBILITY_EVENT, listener);
        }
    });

    it('挂载与卡片增删各通知一次，状态标签变化不反复通知，销毁后停止', async () => {
        mountFixture();
        const onItemsChanged = vi.fn();
        const controller = createController(onItemsChanged);
        controller.init();
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        onItemsChanged.mockClear();
        const recommend = document.getElementById('recommend-container')!;
        const first = document.createElement('div');
        first.className = 'item';
        first.innerHTML = '<span class="status-tag">已读</span>';
        const second = document.createElement('div');
        second.className = 'item';
        recommend.append(first, second);
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        onItemsChanged.mockClear();

        first.querySelector('.status-tag')!.textContent = '已收藏';
        first.insertAdjacentHTML('beforeend', '<span class="status-tag">已读</span>');
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).not.toHaveBeenCalled();

        first.remove();
        second.remove();
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).toHaveBeenCalledOnce();
        controller.destroy();
        onItemsChanged.mockClear();
        recommend.appendChild(document.createElement('div')).className = 'item';
        await vi.advanceTimersByTimeAsync(300);
        expect(onItemsChanged).not.toHaveBeenCalled();
    });
});
