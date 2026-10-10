// @vitest-environment jsdom
/**
 * 外部站点访问统计测试（docs/45）。
 *
 * 覆盖用户验收口径：
 * 1. 单次有效外跳只计一次，并立即刷新展示（徽标 + 汇总行）；
 * 2. 重复事件 / 重复绑定不重复计数；
 * 3. 未解析出链接（无 href / 占位 #）的点击不计；中键算访问、右键不算；
 * 4. 不同视频、不同站点互相独立；同一番号的不同大小写写法落到同一条记录；
 * 5. 「刷新页面」后统计仍在（重新渲染读回已存值，而非内存态）；
 * 6. 读取失败按零值展示，且不覆盖已存计数（宁可少计一次，不丢失历史）；
 * 7. 零值时徽标与汇总行都不出现（不占位）。
 *
 * 夹具使用**真实组件**（OtherSiteBtn / OtherSiteBox 经 jsxToString 渲染），
 * 因此 class / data-* 契约一旦改动，本测试会失败。
 */
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    SITE_BTN_ID_ATTR,
    SITE_OPEN_COUNT_CLASS,
    OtherSiteBtn
} from '../src/components/other-site/other-site-btn';
import { SITE_VISIT_TOTAL_CLASS, OtherSiteBox } from '../src/components/other-site/other-site-box';
import {
    __setExternalVisitStoreForTest,
    readExternalVisitStat,
    recordExternalSiteVisit,
    type ExternalVisitStat,
    type ExternalVisitStore
} from '../src/core/storage/external-visit-ops';
import { jsxToString } from '../src/core/jsx-to-string';
import {
    __resetVisitCounterForTest,
    bindExternalVisitCounter,
    currentVisitStat,
    setVisitCounterCarNum
} from '../src/plugins/other-site/osp-visit-count';

/** 内存统计存储（默认读写替身）。 */
function createFakeStore(): ExternalVisitStore & { data: Map<string, ExternalVisitStat> } {
    const data = new Map<string, ExternalVisitStat>();
    return {
        data,
        read: (carNum) => data.get(carNum),
        write: (carNum, value) => {
            data.set(carNum, value);
        }
    };
}

const SITE_IDS = ['missAvBtn', 'supJavBtn'];

/** 用真实组件渲染一份 #otherSiteBox（等价 loadOtherSite 的初始渲染）。 */
function renderBox(stat: ExternalVisitStat, siteIds: readonly string[] = SITE_IDS): void {
    const siteButtonsHtml = siteIds
        .map((id) =>
            jsxToString(
                createElement(OtherSiteBtn, {
                    id,
                    enabled: true,
                    count: stat.bySite[id] ?? 0
                })
            )
        )
        .join('');
    document.body.innerHTML = jsxToString(
        createElement(OtherSiteBox, {
            siteButtonsHtml,
            isJavdbSite: true,
            visitTotal: stat.total
        })
    );
}

function button(siteId: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`a.site-btn[${SITE_BTN_ID_ATTR}="${siteId}"]`);
    if (!el) throw new Error(`未找到站点按钮 ${siteId}`);
    return el;
}

function badge(siteId: string): HTMLElement {
    const el = button(siteId).querySelector<HTMLElement>(`.${SITE_OPEN_COUNT_CLASS}`);
    if (!el) throw new Error(`未找到计数徽标 ${siteId}`);
    return el;
}

function totalLine(): HTMLElement {
    const el = document.querySelector<HTMLElement>(`.${SITE_VISIT_TOTAL_CLASS}`);
    if (!el) throw new Error('未找到汇总行');
    return el;
}

/** 让锚点解析出外站地址（probeSite 成功后的状态）。 */
function resolveHref(siteId: string, href = 'https://missav.ws/abc-123'): void {
    button(siteId).setAttribute('href', href);
}

function dispatch(el: Element, type: string, buttonIndex = 0): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: buttonIndex });
    el.dispatchEvent(event);
    return event;
}

beforeEach(() => {
    document.body.innerHTML = '';
    // jsdom 对真实 <a href> 的跳转未实现，这里拦掉默认行为以免报错；
    // 计数器在捕获阶段运行，先于本监听。
    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a')) {
            event.preventDefault();
        }
    });
});

afterEach(() => {
    __resetVisitCounterForTest();
    __setExternalVisitStoreForTest(null);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('外部站点访问统计', () => {
    it('单次真实外跳只计一次，并立即刷新徽标与汇总行', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);
        renderBox(currentVisitStat());
        setVisitCounterCarNum('abc-123');
        bindExternalVisitCounter();
        resolveHref('missAvBtn');

        dispatch(button('missAvBtn'), 'click');

        expect(store.data.get('ABC-123')).toEqual({
            total: 1,
            bySite: { missAvBtn: 1 },
            updatedAt: expect.any(Number)
        });
        expect(badge('missAvBtn').textContent).toBe('1');
        expect(badge('missAvBtn').style.display).not.toBe('none');
        expect(totalLine().querySelector('b')?.textContent).toBe('1');
        expect(totalLine().dataset.total).toBe('1');
        expect(totalLine().style.display).not.toBe('none');
        // 未点击的站点仍为零值、徽标不显示
        expect(badge('supJavBtn').style.display).toBe('none');
    });

    it('重复派发同一事件对象或重复绑定都不会重复计数', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);
        renderBox(currentVisitStat());
        setVisitCounterCarNum('ABC-123');
        bindExternalVisitCounter();
        bindExternalVisitCounter(); // 幂等：不会叠加监听
        resolveHref('missAvBtn');

        const event = dispatch(button('missAvBtn'), 'click');
        button('missAvBtn').dispatchEvent(event); // 同一事件对象再派发一次

        expect(store.data.get('ABC-123')?.total).toBe(1);
        expect(badge('missAvBtn').textContent).toBe('1');

        dispatch(button('missAvBtn'), 'click'); // 新的一次真实点击仍然计数
        expect(store.data.get('ABC-123')?.total).toBe(2);
        expect(badge('missAvBtn').textContent).toBe('2');
    });

    it('未解析出链接的点击不计（无 href / 占位 #）', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);
        renderBox(currentVisitStat());
        setVisitCounterCarNum('ABC-123');
        bindExternalVisitCounter();

        dispatch(button('missAvBtn'), 'click'); // 无 href
        resolveHref('supJavBtn', '#');
        dispatch(button('supJavBtn'), 'click'); // 占位

        expect(store.data.size).toBe(0);
        expect(badge('missAvBtn').style.display).toBe('none');
        expect(totalLine().style.display).toBe('none');
    });

    it('中键算一次访问，右键与其它键不算', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);
        renderBox(currentVisitStat());
        setVisitCounterCarNum('ABC-123');
        bindExternalVisitCounter();
        resolveHref('missAvBtn');

        dispatch(button('missAvBtn'), 'auxclick', 1); // 中键 → 新标签页打开
        expect(store.data.get('ABC-123')?.total).toBe(1);

        dispatch(button('missAvBtn'), 'click', 2); // 右键不会触发 click，此处模拟其它键
        dispatch(button('missAvBtn'), 'contextmenu', 2); // 右键菜单 → 不计数
        expect(store.data.get('ABC-123')?.total).toBe(1);
    });

    it('不同视频、不同站点互相独立，番号大小写归一', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);

        recordExternalSiteVisit('abc-123', 'missAvBtn');
        recordExternalSiteVisit(' abc-123 ', 'missAvBtn');
        recordExternalSiteVisit('xyz-999', 'supJavBtn');

        expect(readExternalVisitStat('ABC-123')).toMatchObject({
            total: 2,
            bySite: { missAvBtn: 2 }
        });
        expect(readExternalVisitStat('XYZ-999')).toMatchObject({
            total: 1,
            bySite: { supJavBtn: 1 }
        });
    });

    it('刷新页面后统计仍在（重新渲染读回已存值）', () => {
        const store = createFakeStore();
        __setExternalVisitStoreForTest(store);
        renderBox(currentVisitStat());
        setVisitCounterCarNum('ABC-123');
        bindExternalVisitCounter();
        resolveHref('missAvBtn');
        dispatch(button('missAvBtn'), 'click');

        // 模拟刷新：DOM 重建，统计从存储读回
        __resetVisitCounterForTest();
        renderBox(readExternalVisitStat('ABC-123'));
        setVisitCounterCarNum('ABC-123');
        bindExternalVisitCounter();

        expect(badge('missAvBtn').textContent).toBe('1');
        expect(badge('missAvBtn').style.display).not.toBe('none');
        expect(totalLine().querySelector('b')?.textContent).toBe('1');
    });

    it('读取失败时按零值展示，且不覆盖已存计数', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const write = vi.fn();
        __setExternalVisitStoreForTest({
            read: () => {
                throw new Error('IndexedDB 读取失败（模拟）');
            },
            write
        });

        expect(readExternalVisitStat('ABC-123')).toMatchObject({ total: 0, bySite: {} });
        expect(recordExternalSiteVisit('ABC-123', 'missAvBtn')).toMatchObject({
            total: 0,
            bySite: {}
        });
        expect(write).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
    });

    it('零值时徽标与汇总行都不出现（不占位）', () => {
        renderBox(readExternalVisitStat('NONE-1'));

        expect(badge('missAvBtn').style.display).toBe('none');
        expect(badge('supJavBtn').style.display).toBe('none');
        expect(totalLine().style.display).toBe('none');
        expect(totalLine().dataset.total).toBe('0');
    });
});