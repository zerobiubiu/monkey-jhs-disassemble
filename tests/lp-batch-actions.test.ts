import { afterEach, expect, it, vi } from 'vitest';

import { FILTER_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import { executeBatchRating } from '../src/plugins/list-page/lp-batch-actions';
import { enqueueBatchPush } from '../src/plugins/list-page/lp-batch-sync';

vi.mock('../src/plugins/list-page/lp-batch-sync', () => ({ enqueueBatchPush: vi.fn(async () => 1) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('批量拉黑登记为屏蔽意图并推送已读零星，避免清单补同步误判为过期收藏', async () => {
    const saveCarList = vi.fn();
    vi.stubGlobal('storageManager', {
        getCarList: async () => [], saveCarList, getSetting: async () => 'yes'
    });
    vi.stubGlobal('show', { ok: vi.fn(), info: vi.fn() });
    vi.stubGlobal('clog', { log: vi.fn() });
    const info = new Map([['test-1', { carNum: 'TEST-1', url: '/v/v1' }]]);
    await executeBatchRating(['test-1'], info, 'filter', 0);
    expect(saveCarList).toHaveBeenCalledWith([expect.objectContaining({ carNum: 'TEST-1', actionType: FILTER_ACTION })]);
    expect(enqueueBatchPush).toHaveBeenCalledWith([{ carNum: 'TEST-1', url: '/v/v1' }], 'watched', 0, { recordKind: 'filter' });
});

it('批量五星保留已读评分且不变更为屏蔽意图', async () => {
    const saveCarList = vi.fn();
    vi.stubGlobal('storageManager', { getCarList: async () => [], saveCarList, getSetting: async () => 'yes' });
    vi.stubGlobal('show', { ok: vi.fn(), info: vi.fn() });
    vi.stubGlobal('clog', { log: vi.fn() });
    await executeBatchRating(['test-1'], new Map([['test-1', { carNum: 'TEST-1', url: '/v/v1' }]]), 'watched', 5);
    expect(saveCarList).toHaveBeenCalledWith([expect.objectContaining({ actionType: HAS_WATCH_ACTION, score: 5 })]);
    expect(enqueueBatchPush).toHaveBeenCalledWith([{ carNum: 'TEST-1', url: '/v/v1' }], 'watched', 5, { recordKind: undefined });
});
