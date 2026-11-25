// @vitest-environment jsdom
/**
 * 视频清单标签永久实时同步架构回归测试：
 * 1. 无自动刷新开关 DOM / 无 GM_getValue·GM_setValue 开关读写；
 * 2. `subscribeTagSync` 对多通道（CustomEvent/storage/GM）同一广播回声精准去重，不误吞其他番号；
 * 3. `VltTags.queueDesignationRefresh` 在 50ms 合批窗内将多番号并发事件合并为一次 IDB 查询，
 *    且在途期间新到番号自动续跑下一轮，不丢失；
 * 4. `VideoListsTagPlugin.destroy()` 通过 `AbortSignal` 完整停止广播接收与挂起定时器。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageContext } from '../src/core/page-context';
import { VltDb } from '../src/plugins/video-lists-tag/vlt-db';
import { VideoListsTagPlugin } from '../src/plugins/video-lists-tag/vlt-plugin';
import {
    LAST_SYNC_KEY,
    SYNC_COMPLETE_EVENT,
    createTagSyncDeduper,
    shouldProcessTagSync,
    subscribeTagSync
} from '../src/plugins/video-lists-tag/vlt-sync-listener';
import { VltTags } from '../src/plugins/video-lists-tag/vlt-tags';

type GmListener = (name: string, oldVal: unknown, newVal: unknown, remote: boolean) => void;

let gmListeners: Array<{ key: string; cb: GmListener }> = [];

function listHtml(codes: string[]): string {
    return `<section><div><div class="movie-list">${codes
        .map(
            (code) =>
                `<div class="item" id="card-${code}"><a href="/v/${code}"><div class="video-title"><strong>${code}</strong></div><div class="meta"></div></a></div>`
        )
        .join('')}</div></div></section>`;
}

beforeEach(() => {
    vi.useFakeTimers();
    gmListeners = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('GM_getValue', vi.fn());
    vi.stubGlobal('GM_setValue', vi.fn());
    vi.stubGlobal('GM_addValueChangeListener', vi.fn((key: string, cb: GmListener) => {
        gmListeners.push({ key, cb });
    }));
    vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });
    pageContext.isListPage = true;
    pageContext.isHomePage = false;
    (window as unknown as { isDetailPage?: boolean }).isDetailPage = false;
});

afterEach(() => {
    pageContext.isListPage = false;
    pageContext.isHomePage = false;
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('vlt-sync-listener 永久实时同步订阅与去重', () => {
    it('校验载荷：过滤缺番号与未变更 association', () => {
        expect(shouldProcessTagSync(null)).toBe(false);
        expect(shouldProcessTagSync({ action: 'add', association: 'created' })).toBe(false);
        expect(shouldProcessTagSync({ designation: 'ABC-001', association: 'existed' })).toBe(false);
        expect(shouldProcessTagSync({ designation: 'ABC-001', association: 'unchanged' })).toBe(false);
        expect(shouldProcessTagSync({ designation: 'ABC-001', association: 'limit_exceeded' })).toBe(false);
        expect(shouldProcessTagSync({ designation: 'ABC-001', association: 'created' })).toBe(true);
        expect(shouldProcessTagSync({ designation: 'ABC-001', association: 'deleted' })).toBe(true);
    });

    it('多通道回声去重：同一广播经 CustomEvent/storage/GM 送达只触发一次，不同番号或新时间戳不误吞', () => {
        const deduper = createTagSyncDeduper(500, 5000);
        expect(deduper.accept({ designation: 'A-1', action: 'add', association: 'created', time: 1000 }, 1000)).toBe(true);
        // 同一事件经另一通道 5ms 后到达 → 去重
        expect(deduper.accept({ designation: 'A-1', action: 'add', association: 'created', time: 1000 }, 1005)).toBe(false);
        // 并发另一番号 20ms 后到达 → 必须放行！
        expect(deduper.accept({ designation: 'B-2', action: 'add', association: 'created', time: 1020 }, 1020)).toBe(true);
        // 同一番号 150ms 后有新操作（新时间戳）→ 必须放行！
        expect(deduper.accept({ designation: 'A-1', action: 'add', association: 'created', time: 1150 }, 1150)).toBe(true);
    });

    it('subscribeTagSync 支持 AbortSignal 停止监听，且跨 storage + GM 同事件只回调一次', () => {
        const controller = new AbortController();
        const received: string[] = [];
        subscribeTagSync((payload) => received.push(payload.designation), { signal: controller.signal });

        const payload = { designation: 'A-1', action: 'add', association: 'created', time: 2000 };
        const raw = JSON.stringify(payload);

        // 模拟跨标签页 storage + GM 双通道同时送达同一事件
        window.dispatchEvent(new StorageEvent('storage', { key: LAST_SYNC_KEY, newValue: raw }));
        gmListeners.forEach((l) => l.key === LAST_SYNC_KEY && l.cb(LAST_SYNC_KEY, null, raw, true));
        expect(received).toEqual(['A-1']);

        // 另一番号紧接通过 CustomEvent 到达 → 不受阻塞
        document.dispatchEvent(
            new CustomEvent(SYNC_COMPLETE_EVENT, {
                detail: { designation: 'B-2', action: 'remove', association: 'deleted', time: 2010 }
            })
        );
        expect(received).toEqual(['A-1', 'B-2']);

        // abort 后三通道均不再回调
        controller.abort();
        document.dispatchEvent(
            new CustomEvent(SYNC_COMPLETE_EVENT, {
                detail: { designation: 'C-3', action: 'add', association: 'created', time: 3000 }
            })
        );
        gmListeners.forEach((l) =>
            l.key === LAST_SYNC_KEY &&
            l.cb(
                LAST_SYNC_KEY,
                null,
                JSON.stringify({ designation: 'D-4', action: 'add', association: 'created', time: 3001 }),
                true
            )
        );
        expect(received).toEqual(['A-1', 'B-2']);
    });
});

describe('VltTags 合批实时刷新与插件生命周期', () => {
    it('并发到达多个番号时合批为一次 IDB 查询，在途期间新到番号自动续刷', async () => {
        document.body.innerHTML = listHtml(['A-1', 'B-2', 'C-3']);

        let resolveFirstBatch!: (value: Record<string, Array<{ name: string; url: null; style: null }>>) => void;
        const queryMock = vi
            .spyOn(VltDb, 'queryMoviesLists')
            .mockResolvedValueOnce({ 'A-1': [], 'B-2': [], 'C-3': [] })
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirstBatch = resolve;
                    })
            )
            .mockResolvedValueOnce({ 'C-3': [{ name: '清单丙', url: null, style: null }] });

        const tags = new VltTags();
        await tags.initExistingItems();
        expect(GM_getValue).not.toHaveBeenCalled();
        expect(GM_setValue).not.toHaveBeenCalled();

        // 连续入队 A-1 与 B-2 → 50ms 后合批查询一次
        tags.queueDesignationRefresh('A-1');
        tags.queueDesignationRefresh('B-2');
        await vi.advanceTimersByTimeAsync(50);

        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(queryMock.mock.calls[1][0]).toEqual(['A-1', 'B-2']);

        // 在途期间新到 C-3 → 第一批结束后自动续跑第三轮查询
        tags.queueDesignationRefresh('C-3');
        resolveFirstBatch({
            'A-1': [{ name: '清单甲', url: null, style: null }],
            'B-2': [{ name: '清单乙', url: null, style: null }]
        });
        await vi.advanceTimersByTimeAsync(0);

        expect(queryMock).toHaveBeenCalledTimes(3);
        expect(queryMock.mock.calls[2][0]).toEqual(['C-3']);
        expect(document.querySelector('#card-A-1 .jhs-vlt-tags-display')?.textContent).toBe('清单甲');
        expect(document.querySelector('#card-B-2 .jhs-vlt-tags-display')?.textContent).toBe('清单乙');
        expect(document.querySelector('#card-C-3 .jhs-vlt-tags-display')?.textContent).toBe('清单丙');
        expect(document.querySelector('.jhs-vlt-filter-bar')?.textContent).toContain('清单丙 1');
        tags.destroy();
    });

    it('VideoListsTagPlugin 默认永久开启实时同步且不渲染开关/模式下拉，destroy 后不再刷新', async () => {
        document.body.innerHTML = listHtml(['X-1']);
        const queryMock = vi
            .spyOn(VltDb, 'queryMoviesLists')
            .mockResolvedValueOnce({ 'X-1': [] })
            .mockResolvedValueOnce({ 'X-1': [{ name: '新清单', url: null, style: null }] });

        const plugin = new VideoListsTagPlugin();
        await plugin.handle();

        const bar = document.querySelector('.jhs-vlt-filter-bar')!;
        expect(bar).not.toBeNull();
        expect(bar.querySelector('details')).toBeNull();
        expect(bar.querySelector('label')).toBeNull();
        expect(GM_getValue).not.toHaveBeenCalled();

        // 广播同步完成事件 → 自动合批刷新卡片与筛选栏
        document.dispatchEvent(
            new CustomEvent(SYNC_COMPLETE_EVENT, {
                detail: { designation: 'X-1', action: 'add', association: 'created', time: 5000 }
            })
        );
        await vi.advanceTimersByTimeAsync(60);

        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(document.querySelector('#card-X-1 .jhs-vlt-tags-display')?.textContent).toBe('新清单');
        expect(bar.textContent).toContain('新清单 1');

        // 销毁后不再响应任何同步广播
        plugin.destroy();
        document.dispatchEvent(
            new CustomEvent(SYNC_COMPLETE_EVENT, {
                detail: { designation: 'X-1', action: 'remove', association: 'deleted', time: 6000 }
            })
        );
        await vi.advanceTimersByTimeAsync(60);
        expect(queryMock).toHaveBeenCalledTimes(2);
    });
});
