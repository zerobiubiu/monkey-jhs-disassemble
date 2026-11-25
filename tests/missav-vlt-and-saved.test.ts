// @vitest-environment jsdom
/**
 * MissAV JavDB 归属清单同步展示 + MissAV 原生收藏识别同步回归测试。
 *
 * 覆盖：
 * 1. missav-paths：slug 提取（保留变体后缀）、收藏页路径识别、按语言前缀构造收藏页 URL；
 * 2. vlt-sync-protocol：紧凑快照构造、URL 补全与安全过滤、损坏快照拒绝校验；
 * 3. missav-saved-sync：基于实测 DOM 的详情页收藏按钮查找与状态读取、收藏页提取与防误清库校验；
 * 4. missav-card-meta：底部独立区渲染（不侵入封面）、双态徽标/清单胶囊/空态占位、签名差量更新；
 * 5. MissavVideoPreviewPlugin：点击底部独立区与清单链接放行，不误触发视频预览 iframe 弹窗。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    buildMissavSavedUrl,
    extractMissavSlug,
    isMissavSavedPage
} from '../src/core/util/site/missav-paths';
import {
    buildVltSnapshot,
    normalizeJavdbListUrl,
    validateVltSnapshot
} from '../src/plugins/car-status-sync/vlt-sync-protocol';
import {
    extractSavedItemsFromDoc,
    findDetailSaveButton,
    findSavedNextPageUrl,
    isValidSavedPageDoc,
    observeDetailSaveButton,
    readDetailSaveButtonState
} from '../src/plugins/car-status-sync/missav-saved-sync';
import * as savedDb from '../src/plugins/car-status-sync/missav-saved-db';
import { TaskSupervisor } from '../src/core/task-supervisor';
import { renderCardMeta } from '../src/plugins/car-status-sync/missav-card-meta';
import { MissavVideoPreviewPlugin } from '../src/plugins/missav-video-preview/missav-video-preview-plugin';

const parseHtml = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('missav-paths（slug 与收藏页路径）', () => {
    it('extractMissavSlug 保留变体后缀并规范为小写', () => {
        expect(extractMissavSlug('royd-380-uncensored-leak')).toBe('royd-380-uncensored-leak');
        expect(extractMissavSlug('https://missav.ws/cn/ROYD-380-uncensored-leak?ref=1')).toBe(
            'royd-380-uncensored-leak'
        );
        expect(extractMissavSlug('/dm539/cn/fns-260/')).toBe('fns-260');
        expect(extractMissavSlug('')).toBe('');
    });

    it('isMissavSavedPage 精准识别多语言与带随机前缀的收藏页路径', () => {
        expect(isMissavSavedPage('/cn/saved')).toBe(true);
        expect(isMissavSavedPage('/en/saved/')).toBe(true);
        expect(isMissavSavedPage('/dm539/cn/saved?page=2')).toBe(true);
        expect(isMissavSavedPage('/saved')).toBe(true);
        expect(isMissavSavedPage('/cn/new')).toBe(false);
        expect(isMissavSavedPage('/cn/fns-260')).toBe(false);
    });

    it('buildMissavSavedUrl 沿用当前语言前缀，缺省回退 cn', () => {
        expect(buildMissavSavedUrl('https://missav.ws', '/dm539/ja/new')).toBe(
            'https://missav.ws/ja/saved'
        );
        expect(buildMissavSavedUrl('https://missav.ai/', '/cn/fns-260')).toBe(
            'https://missav.ai/cn/saved'
        );
        expect(buildMissavSavedUrl('https://missav.ws', '/')).toBe('https://missav.ws/cn/saved');
    });
});

describe('vlt-sync-protocol（JavDB 归属清单跨站协议）', () => {
    it('normalizeJavdbListUrl 补全相对路径并拦截危险协议', () => {
        expect(normalizeJavdbListUrl('/lists/abc')).toBe('https://javdb.com/lists/abc');
        expect(normalizeJavdbListUrl('https://javdb.com/lists/xyz')).toBe('https://javdb.com/lists/xyz');
        expect(normalizeJavdbListUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeJavdbListUrl('data:text/html,hi')).toBeNull();
    });

    it('buildVltSnapshot 归一化番号、合并变体并过滤悬空关联，validateVltSnapshot 通过', () => {
        const snapshot = buildVltSnapshot(
            {
                l1: {
                    listId: 'l1',
                    name: '值得复盘',
                    url: '/lists/l1',
                    count: 2,
                    style: { name: 'primary', bg: '#0d6efd', text: '#fff' }
                },
                l2: {
                    listId: 'l2',
                    name: '高分精选',
                    url: 'javascript:evil()',
                    count: 1,
                    style: { name: 'warning', bg: '#ffc107', text: '#212529' }
                }
            },
            {
                'royd-380::l1': true,
                'ROYD-380::l2': true,
                'fns-260::l1': true,
                'fns-260::deleted-list': true,
                'abp-100::l1': false
            }
        );

        expect(snapshot.lists).toHaveLength(2);
        expect(snapshot.lists[0].url).toBe('https://javdb.com/lists/l1');
        expect(snapshot.lists[1].url).toBeNull();
        expect(snapshot.byCarNum['ROYD-380']).toEqual([0, 1]);
        expect(snapshot.byCarNum['FNS-260']).toEqual([0]);
        expect(snapshot.byCarNum['ABP-100']).toBeUndefined();

        const valid = validateVltSnapshot(snapshot, 2, 2);
        expect(valid.ok).toBe(true);
    });

    it('validateVltSnapshot 拒绝越界下标、数量不符与损坏结构', () => {
        const badIndex = validateVltSnapshot(
            {
                lists: [{ id: 'l1', name: '清单1', url: null, style: null }],
                byCarNum: { 'FNS-260': [5] }
            },
            1,
            1
        );
        expect(badIndex.ok).toBe(false);

        const countMismatch = validateVltSnapshot(
            {
                lists: [{ id: 'l1', name: '清单1', url: null, style: null }],
                byCarNum: { 'FNS-260': [0] }
            },
            1,
            2
        );
        expect(countMismatch.ok).toBe(false);
    });
});

describe('missav-saved-sync（基于实测 DOM 的收藏识别与分页解析）', () => {
    it('按实测详情页按钮准确识别已收藏（text-primary）与未收藏（text-nord4）', () => {
        const savedDoc = parseHtml(`
            <div>
                <button @click.prevent="toggleSave" type="button" class="inline-flex text-primary">
                    <svg x-show="saved"></svg>
                    <svg x-show="! saved" style="display: none;"></svg>
                    收藏
                </button>
            </div>
        `);
        const savedBtn = findDetailSaveButton(savedDoc);
        expect(savedBtn).not.toBeNull();
        expect(readDetailSaveButtonState(savedBtn!)).toBe(true);

        const unsavedDoc = parseHtml(`
            <div>
                <button @click.prevent="toggleSave" type="button" class="inline-flex text-nord4">
                    <svg x-show="saved" style="display: none;"></svg>
                    <svg x-show="! saved"></svg>
                    收藏
                </button>
            </div>
        `);
        const unsavedBtn = findDetailSaveButton(unsavedDoc);
        expect(unsavedBtn).not.toBeNull();
        expect(readDetailSaveButtonState(unsavedBtn!)).toBe(false);

        const unhydratedDoc = parseHtml(`
            <button @click.prevent="toggleSave" type="button" class="inline-flex"></button>
        `);
        expect(readDetailSaveButtonState(findDetailSaveButton(unhydratedDoc)!)).toBeNull();
    });

    it('解析实测 /cn/saved 页面卡片、下一页链接与防误清库校验', () => {
        const doc = parseHtml(`
            <h1>我的影片收藏</h1>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                <div>
                    <div class="thumbnail group">
                        <div class="relative aspect-w-16 aspect-h-9">
                            <a href="https://missav.ws/cn/royd-380-uncensored-leak" alt="royd-380-uncensored-leak"></a>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="thumbnail group">
                        <div class="relative aspect-w-16 aspect-h-9">
                            <a href="https://missav.ws/cn/fns-260" alt="fns-260"></a>
                        </div>
                    </div>
                </div>
            </div>
            <nav>
                <a href="https://missav.ws/cn/saved?page=2" rel="next">下一页</a>
            </nav>
        `);

        expect(isValidSavedPageDoc(doc, 'https://missav.ws/cn/saved')).toBe(true);
        expect(isValidSavedPageDoc(doc, 'https://missav.ws/cn/login')).toBe(false);

        const items = extractSavedItemsFromDoc(doc);
        expect(items).toEqual([
            { slug: 'royd-380-uncensored-leak', carNum: 'ROYD-380' },
            { slug: 'fns-260', carNum: 'FNS-260' }
        ]);
        expect(findSavedNextPageUrl(doc, 'https://missav.ws/cn/saved')).toBe(
            'https://missav.ws/cn/saved?page=2'
        );

        // 风控拦截页无卡片且非收藏标题 → 拒绝，防止误清本地收藏
        const cfDoc = parseHtml('<h1>Just a moment...</h1>');
        expect(isValidSavedPageDoc(cfDoc, 'https://missav.ws/cn/saved')).toBe(false);

        // 真正空收藏页含明确「我的影片收藏」标题 → 合法
        const emptySavedDoc = parseHtml('<h1>我的影片收藏</h1><div></div>');
        expect(isValidSavedPageDoc(emptySavedDoc, 'https://missav.ws/cn/saved')).toBe(true);
    });

    it('observeDetailSaveButton 在详情页/iframe 中初始补录已收藏、点击取消收藏删库、未点击不误删', async () => {
        vi.useFakeTimers();
        const upsertSpy = vi.spyOn(savedDb, 'upsertMissavSaved').mockResolvedValue(1);
        const deleteSpy = vi.spyOn(savedDb, 'deleteMissavSaved').mockResolvedValue(1);
        const onLocalChange = vi.fn();

        window.history.replaceState({}, '', '/cn/royd-380-uncensored-leak');
        document.body.innerHTML = `
            <button id="save-btn" @click.prevent="toggleSave" type="button" class="inline-flex text-primary">
                <svg x-show="saved"></svg>
                <svg x-show="! saved" style="display: none;"></svg>
                收藏
            </button>
        `;

        const supervisor = new TaskSupervisor();
        try {
            observeDetailSaveButton(supervisor, onLocalChange);
            await Promise.resolve();
            expect(upsertSpy).toHaveBeenCalledWith([
                { slug: 'royd-380-uncensored-leak', carNum: 'ROYD-380' }
            ]);
            expect(onLocalChange).toHaveBeenCalledWith('royd-380-uncensored-leak', true);

            // 模拟用户在 iframe 详情页点击「取消收藏」后 Alpine 切换 class
            const btn = document.getElementById('save-btn')!;
            btn.click();
            btn.classList.remove('text-primary');
            btn.classList.add('text-nord4');
            await vi.advanceTimersByTimeAsync(50);

            expect(deleteSpy).toHaveBeenCalledWith(['royd-380-uncensored-leak']);
            expect(onLocalChange).toHaveBeenCalledWith('royd-380-uncensored-leak', false);
        } finally {
            supervisor.abort();
            vi.useRealTimers();
        }
    });
});

describe('missav-card-meta（卡片底部独立信息区渲染与预览点击隔离）', () => {
    it('渲染在 .thumbnail.group 底部而非视频封面内，支持双信息展示、空态占位与差量刷新', () => {
        document.body.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                <div id="cell-1">
                    <div class="thumbnail group">
                        <div class="relative aspect-w-16 aspect-h-9">
                            <a href="https://missav.ws/cn/royd-380-uncensored-leak" alt="royd-380-uncensored-leak"></a>
                        </div>
                        <div class="my-2 text-sm">标题1</div>
                    </div>
                </div>
                <div id="cell-2">
                    <div class="thumbnail group">
                        <div class="relative aspect-w-16 aspect-h-9">
                            <a href="https://missav.ws/cn/fns-260" alt="fns-260"></a>
                        </div>
                        <div class="my-2 text-sm">标题2</div>
                    </div>
                </div>
                <div id="cell-3">
                    <div class="thumbnail group">
                        <div class="relative aspect-w-16 aspect-h-9">
                            <a href="https://missav.ws/cn/abp-100" alt="abp-100"></a>
                        </div>
                        <div class="my-2 text-sm">标题3</div>
                    </div>
                </div>
            </div>
        `;

        const vltMap = new Map([
            [
                'ROYD-380',
                [
                    {
                        id: 'l1',
                        name: '值得复盘',
                        url: 'https://javdb.com/lists/l1',
                        style: { name: 'warning', bg: '#ffc107', text: '#212529' }
                    }
                ]
            ]
        ]);
        const savedSet = new Set(['royd-380-uncensored-leak', 'fns-260']);

        const first = renderCardMeta(document.body, vltMap, savedSet);
        expect(first).toEqual({ updated: 3, savedMatched: 2, vltMatched: 1 });

        // 1) 视频封面 div.relative 内绝无注入底部信息区
        expect(document.querySelectorAll('.relative .jhs-missav-card-meta')).toHaveLength(0);

        // 2) cell-1 同时有 MissAV 收藏徽标与 JavDB 清单链接（浅底带 light-bg 类）
        const meta1 = document.querySelector<HTMLElement>('#cell-1 .thumbnail.group > .jhs-missav-card-meta')!;
        expect(meta1.dataset.missavSaved).toBe('yes');
        expect(meta1.querySelector('.jhs-missav-saved-badge')?.textContent).toBe('MissAV');
        const tagLink = meta1.querySelector<HTMLAnchorElement>('.jhs-missav-vlt-tag')!;
        expect(tagLink.tagName).toBe('A');
        expect(tagLink.href).toBe('https://javdb.com/lists/l1');
        expect(tagLink.classList.contains('jhs-vlt-light-bg')).toBe(true);

        // 3) cell-2 仅有 MissAV 收藏、无 JavDB 清单 → 不画多余的空占位 —
        const meta2 = document.querySelector<HTMLElement>('#cell-2 .jhs-missav-card-meta')!;
        expect(meta2.querySelector('.jhs-missav-saved-badge')).not.toBeNull();
        expect(meta2.querySelector('.jhs-missav-vlt-empty')).toBeNull();

        // 4) cell-3 既无收藏又无清单 → 保留 — 占位维持同行对齐
        const meta3 = document.querySelector<HTMLElement>('#cell-3 .jhs-missav-card-meta')!;
        expect(meta3.dataset.missavSaved).toBe('no');
        expect(meta3.querySelector('.jhs-missav-vlt-empty')?.textContent).toBe('\u2014');

        // 5) 数据未变时二次渲染完全跳过（updated = 0）
        const second = renderCardMeta(document.body, vltMap, savedSet);
        expect(second.updated).toBe(0);

        // 6) 取消 fns-260 收藏后，精准更新 cell-2 移除徽标并恢复占位
        savedSet.delete('fns-260');
        const third = renderCardMeta(document.body, vltMap, savedSet);
        expect(third.updated).toBe(1);
        expect(meta2.dataset.missavSaved).toBe('no');
        expect(meta2.querySelector('.jhs-missav-saved-badge')).toBeNull();
        expect(meta2.querySelector('.jhs-missav-vlt-empty')).not.toBeNull();
    });

    it('MissavVideoPreviewPlugin 放行底部独立信息区与清单链接点击，不触发弹窗', async () => {
        const layerOpen = vi.fn();
        (globalThis as Record<string, unknown>).layer = { open: layerOpen };

        document.body.innerHTML = `
            <div class="thumbnail group">
                <div class="relative aspect-w-16 aspect-h-9">
                    <a id="cover-link" href="https://missav.ws/cn/royd-380" alt="royd-380">cover</a>
                </div>
                <div class="jhs-missav-card-meta">
                    <span class="jhs-missav-saved-badge">MissAV</span>
                    <div class="jhs-missav-vlt-tags">
                        <a id="vlt-link" class="jhs-missav-vlt-tag" href="https://javdb.com/lists/1" target="_blank">清单A</a>
                    </div>
                </div>
            </div>
        `;

        const plugin = new MissavVideoPreviewPlugin();
        try {
            await plugin.handle();

            // 点击底部清单链接：放行，不拦截也不弹预览窗
            const vltClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
            document.getElementById('vlt-link')!.dispatchEvent(vltClick);
            expect(vltClick.defaultPrevented).toBe(false);
            expect(layerOpen).not.toHaveBeenCalled();

            // 点击 MissAV 收藏徽标：同样放行
            const savedClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
            document.querySelector('.jhs-missav-saved-badge')!.dispatchEvent(savedClick);
            expect(layerOpen).not.toHaveBeenCalled();

            // 点击封面链接：正常触发预览弹窗
            const coverClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
            document.getElementById('cover-link')!.dispatchEvent(coverClick);
            expect(coverClick.defaultPrevented).toBe(true);
            expect(layerOpen).toHaveBeenCalledTimes(1);
        } finally {
            plugin.destroy();
            delete (globalThis as Record<string, unknown>).layer;
        }
    });
});
