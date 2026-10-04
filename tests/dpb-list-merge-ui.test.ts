// @vitest-environment jsdom
/**
 * dpb-list-merge-ui 合并行路由回归测试（doc/41：修复 docs/13 缺陷）。
 *
 * 覆盖 doc/13 §5 修法 1/2/3：
 * 1. 展示端（修法 2）：原生 checkbox 不可解析的成员不得被当作「未含片」（保持半选）
 * 2. 取消（修法 1）：两成员组串行取消，全部派发原生 change
 * 3. 取消（修法 1）：成员原生 checkbox 不可用且本地关联含片 → 走 VLT 服务端管线兜底
 * 4. 取消（修法 1）：容器重建（重试窗口内恢复）→ 重试命中，不走兜底
 * 5. 加入（修法 3）：本地已含片（原生滞后）→ 阻断，不派发原生 change
 * 6. 加入（修法 3）：本地无记录 → 正常加入最靠前未满清单
 *
 * 时间控制：全程使用 vitest 假时钟（vi.useFakeTimers + advanceTimersByTimeAsync），
 * 不依赖真实等待；成员间隔/重试节拍（220ms）按虚拟时间推进。
 *
 * mock 边界：vlt-server（网络/IDB 管线）与 vlt-db（IndexedDB）整体替换；
 * vlt-helpers 仅覆写 getMovieInfo/getListInfo，其余保持真实实现。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import type { ListGroup } from '../src/plugins/detail-page-button/dpb-list-merge';
import {
    buildMergedRow,
    forwardListGroupChange,
    refreshMergedRowDisplay
} from '../src/plugins/detail-page-button/dpb-list-merge-ui';
import type { DetailListPanelElement } from '../src/plugins/detail-page-button/dpb-list-panel';
import type { DetailPageButtonPlugin } from '../src/plugins/detail-page-button-plugin';
import { VltDb } from '../src/plugins/video-lists-tag/vlt-db';
import { enqueueServerCheckboxMutation } from '../src/plugins/video-lists-tag/vlt-server';

vi.mock('../src/plugins/video-lists-tag/vlt-server', () => ({
    enqueueServerCheckboxMutation: vi.fn(async () => undefined),
    fetchAuthoritativeCheckboxState: vi.fn(async () => null),
    setupCheckboxListener: vi.fn()
}));

vi.mock('../src/plugins/video-lists-tag/vlt-db', () => ({
    VltDb: {
        queryMoviesLists: vi.fn(async () => ({}))
    }
}));

vi.mock('../src/plugins/video-lists-tag/vlt-helpers', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getMovieInfo: vi.fn(() => ({
            designation: 'JFB-510',
            info: {
                href: 'https://javdb.com/v/abc123',
                title: '',
                release_date: '',
                cover_src: '',
                score: 0,
                series: 'JFB',
                code: '510'
            }
        })),
        getListInfo: vi.fn((listId: string) => ({
            list_id: listId,
            info: { url: `https://javdb.com/lists/${listId}?locale=zh`, name: '' }
        }))
    };
});

/** 插件替身：只带合并行路由实际调用的两个方法。 */
interface PluginDouble extends DetailPageButtonPlugin {
    _showListPanelNotice: Mock;
    _scheduleListPanelSync: Mock;
}

function makePlugin(): PluginDouble {
    return {
        _showListPanelNotice: vi.fn(),
        _scheduleListPanelSync: vi.fn()
    } as unknown as PluginDouble;
}

interface MountItem {
    id: string;
    name: string;
    checked: boolean;
    count?: number;
}

/** 挂载原生 modal 容器（#modal-save-list > listContainer）。 */
function mountNativeContainer(items: MountItem[]): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'modal-save-list';
    const container = document.createElement('div');
    container.dataset.listTarget = 'listContainer';
    for (const item of items) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.listId = item.id;
        input.checked = item.checked;
        const span = document.createElement('span');
        span.textContent = `${item.name} (${item.count ?? 10})`;
        label.append(input, span);
        container.append(label);
    }
    modal.append(container);
    document.body.append(modal);
    return container;
}

function nativeInput(container: HTMLElement, id: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`input[data-list-id="${id}"]`);
    if (!input) throw new Error(`missing native input: ${id}`);
    return input;
}

/** 构造合并组（base=等待更新，成员按入参）。 */
function makeGroup(
    rows: Array<Partial<{ listId: string; name: string; num: number; checked: boolean; count: number }>>
): ListGroup {
    return {
        base: '等待更新',
        members: rows.map((row, index) => ({
            listId: row.listId ?? `L${index + 1}`,
            name: row.name ?? `等待更新${index + 1}`,
            num: row.num ?? index + 1,
            count: row.count ?? 10,
            checked: row.checked ?? false,
            disabled: false
        }))
    };
}

/** 构建合并行并挂载到 body（返回行元素与合并行 checkbox）。 */
function mountMergedRow(group: ListGroup): { row: HTMLElement; display: HTMLInputElement } {
    const row = buildMergedRow(group);
    document.body.append(row);
    const display = row.querySelector<HTMLInputElement>(
        '.jhs-list-item__label input[type="checkbox"]'
    );
    if (!display) throw new Error('missing merged-row checkbox');
    return { row, display };
}

beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/v/abc123');
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
});

describe('展示端：未知成员不再伪装成未含片（修法 2）', () => {
    it('成员原生 checkbox 缺失时保持半选', () => {
        mountNativeContainer([{ id: 'A', name: '等待更新1', checked: false }]);
        // B 不在原生容器（未载入分页 / 容器重建中）
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: false },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        expect(display.indeterminate).toBe(true);
    });

    it('全部成员可解析且全部未含片时不为半选', () => {
        mountNativeContainer([
            { id: 'A', name: '等待更新1', checked: false },
            { id: 'B', name: '等待更新2', checked: false }
        ]);
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: false },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        expect(display.indeterminate).toBe(false);
        expect(display.checked).toBe(false);
    });

    it('部分含片 + 未知成员：同时显示已选与半选', () => {
        mountNativeContainer([{ id: 'A', name: '等待更新1', checked: true }]);
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: true },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        expect(display.checked).toBe(true);
        expect(display.indeterminate).toBe(true);
    });
});

describe('取消路由（修法 1）', () => {
    it('两成员组串行取消：全部派发原生 change 且无失败提示', async () => {
        const container = mountNativeContainer([
            { id: 'A', name: '等待更新1', checked: true },
            { id: 'B', name: '等待更新2', checked: true }
        ]);
        const events: string[] = [];
        container.addEventListener('change', (event) => {
            events.push((event.target as HTMLInputElement).dataset.listId || '');
        });
        const { row, display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: true },
                { listId: 'B', name: '等待更新2', checked: true }
            ])
        );
        const plugin = makePlugin();
        const panel = {} as unknown as DetailListPanelElement;
        display.checked = false;
        forwardListGroupChange(plugin, panel, display);
        await vi.advanceTimersByTimeAsync(500);
        expect(nativeInput(container, 'A').checked).toBe(false);
        expect(nativeInput(container, 'B').checked).toBe(false);
        expect(events).toEqual(['A', 'B']);
        expect(vi.mocked(enqueueServerCheckboxMutation)).not.toHaveBeenCalled();
        expect(row.dataset.jhsBusy).toBeUndefined();
        expect(plugin._showListPanelNotice).not.toHaveBeenCalled();
        expect(plugin._scheduleListPanelSync).toHaveBeenCalled();
    });

    it('成员原生 checkbox 不可用且本地含片：走服务端管线兜底', async () => {
        const container = mountNativeContainer([{ id: 'A', name: '等待更新1', checked: true }]);
        vi.mocked(VltDb.queryMoviesLists).mockResolvedValueOnce({
            'JFB-510': [{ name: '等待更新2', url: 'https://javdb.com/lists/B?locale=zh', style: null }]
        });
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: true },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        const plugin = makePlugin();
        const panel = {} as unknown as DetailListPanelElement;
        display.checked = false;
        forwardListGroupChange(plugin, panel, display);
        await vi.advanceTimersByTimeAsync(1000);
        expect(nativeInput(container, 'A').checked).toBe(false);
        expect(vi.mocked(enqueueServerCheckboxMutation)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(enqueueServerCheckboxMutation)).toHaveBeenCalledWith(
            expect.objectContaining({ designation: 'JFB-510' }),
            expect.objectContaining({
                list_id: 'B',
                info: expect.objectContaining({ name: '等待更新2' })
            }),
            false,
            null,
            true
        );
        expect(plugin._showListPanelNotice).not.toHaveBeenCalled();
    });

    it('容器重建：重试窗口内恢复时走原生，不再走兜底', async () => {
        const container = mountNativeContainer([
            { id: 'A', name: '等待更新1', checked: true },
            { id: 'B', name: '等待更新2', checked: true }
        ]);
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: true },
                { listId: 'B', name: '等待更新2', checked: true }
            ])
        );
        const plugin = makePlugin();
        const panel = {} as unknown as DetailListPanelElement;
        display.checked = false;
        forwardListGroupChange(plugin, panel, display);
        // 取消 A 后、处理 B 之前：B 的节点被移除（模拟 listContainer 整体重建）
        nativeInput(container, 'B').closest('label')?.remove();
        await vi.advanceTimersByTimeAsync(220);
        // 重试窗口内（B 首次尝试已失败、重试尚未触发）重建新节点：服务端尚未移除故仍为勾选
        const rebuilt = document.createElement('label');
        const rebuiltInput = document.createElement('input');
        rebuiltInput.type = 'checkbox';
        rebuiltInput.dataset.listId = 'B';
        rebuiltInput.checked = true;
        const rebuiltSpan = document.createElement('span');
        rebuiltSpan.textContent = '等待更新2 (10)';
        rebuilt.append(rebuiltInput, rebuiltSpan);
        container.append(rebuilt);
        await vi.advanceTimersByTimeAsync(700);
        expect(nativeInput(container, 'A').checked).toBe(false);
        expect(rebuiltInput.checked).toBe(false);
        expect(vi.mocked(enqueueServerCheckboxMutation)).not.toHaveBeenCalled();
    });
});

describe('加入路由交叉校验（修法 3）', () => {
    it('本地已含片（原生滞后）时阻断，不派发原生 change', async () => {
        const container = mountNativeContainer([
            { id: 'A', name: '等待更新1', checked: false },
            { id: 'B', name: '等待更新2', checked: false }
        ]);
        vi.mocked(VltDb.queryMoviesLists).mockResolvedValueOnce({
            'JFB-510': [{ name: '等待更新1', url: 'https://javdb.com/lists/A?locale=zh', style: null }]
        });
        const events: string[] = [];
        container.addEventListener('change', (event) => {
            events.push((event.target as HTMLInputElement).dataset.listId || '');
        });
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: false },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        const plugin = makePlugin();
        const panel = {} as unknown as DetailListPanelElement;
        display.checked = true;
        forwardListGroupChange(plugin, panel, display);
        await vi.advanceTimersByTimeAsync(50);
        expect(events).toEqual([]);
        expect(plugin._showListPanelNotice).toHaveBeenCalledTimes(1);
        expect(String(plugin._showListPanelNotice.mock.calls[0][1])).toContain('本地记录');
        expect(plugin._scheduleListPanelSync).toHaveBeenCalled();
    });

    it('本地无记录时正常加入最靠前未满清单', async () => {
        const container = mountNativeContainer([
            { id: 'A', name: '等待更新1', checked: false },
            { id: 'B', name: '等待更新2', checked: false }
        ]);
        const events: string[] = [];
        container.addEventListener('change', (event) => {
            events.push((event.target as HTMLInputElement).dataset.listId || '');
        });
        const { display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: false },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        const plugin = makePlugin();
        const panel = {} as unknown as DetailListPanelElement;
        display.checked = true;
        forwardListGroupChange(plugin, panel, display);
        await vi.advanceTimersByTimeAsync(50);
        expect(nativeInput(container, 'A').checked).toBe(true);
        expect(nativeInput(container, 'B').checked).toBe(false);
        expect(events).toEqual(['A']);
        expect(vi.mocked(enqueueServerCheckboxMutation)).not.toHaveBeenCalled();
    });
});

describe('展示刷新（refreshMergedRowDisplay）', () => {
    it('手动刷新同样遵循半选规则', () => {
        mountNativeContainer([{ id: 'A', name: '等待更新1', checked: true }]);
        const { row, display } = mountMergedRow(
            makeGroup([
                { listId: 'A', name: '等待更新1', checked: true },
                { listId: 'B', name: '等待更新2', checked: false }
            ])
        );
        refreshMergedRowDisplay(row);
        expect(display.checked).toBe(true);
        expect(display.indeterminate).toBe(true);
    });
});
