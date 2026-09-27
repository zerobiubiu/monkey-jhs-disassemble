// @vitest-environment jsdom
/**
 * 列表页批量操作 → JavDB 后台推送队列（`lp-batch-sync.ts`）测试（doc/31）。
 *
 * 只覆盖**不触碰网络**的部分：推送计划（videoId 解析/过滤）、入队计数、状态快照与停止。
 * 真正的网络路径（`postWantToWatch` / `postWatched`）属站点 API，交由真实浏览器验证。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    enqueueBatchPush,
    getBatchSyncStatus,
    planBatchPush,
    resetBatchSyncForTest,
    stopBatchSync
} from '../src/plugins/list-page/lp-batch-sync';

describe('planBatchPush', () => {
    it('从 /v/{id} 解析 videoId 并透传 kind / score', () => {
        const { entries, skipped } = planBatchPush(
            [
                { carNum: 'A-1', url: '/v/abc123' },
                { carNum: 'B-2', url: 'https://javdb.com/v/xyz9?locale=zh' }
            ],
            'watched',
            4
        );
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ carNum: 'A-1', videoId: 'abc123', kind: 'watched', score: 4, attempts: 0 });
        expect(entries[1].videoId).toBe('xyz9');
        expect(skipped).toEqual([]);
    });

    it('无法解析 videoId 的项被跳过并单独列出（不静默丢弃）', () => {
        const { entries, skipped } = planBatchPush(
            [
                { carNum: 'A-1', url: '/v/ok1' },
                { carNum: 'X-9', url: '/actors/123' },
                { carNum: 'Y-8', url: '' }
            ],
            'favorite'
        );
        expect(entries.map((entry) => entry.carNum)).toEqual(['A-1']);
        expect(skipped).toEqual(['X-9', 'Y-8']);
    });

    it('favorite 不携带评分（score 固定 0）', () => {
        const { entries } = planBatchPush([{ carNum: 'A-1', url: '/v/ok1' }], 'favorite');
        expect(entries[0].score).toBe(0);
    });
});

describe('enqueueBatchPush / 队列状态', () => {
    beforeEach(() => {
        vi.stubGlobal('clog', { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });
        vi.stubGlobal('show', { ok: vi.fn(), info: vi.fn(), error: vi.fn() });
        resetBatchSyncForTest();
    });

    afterEach(() => {
        resetBatchSyncForTest();
    });

    it('返回实际入队数，pending 同步增加（同步返回，不等网络）', () => {
        const queued = enqueueBatchPush(
            [
                { carNum: 'A-1', url: '/v/ok1' },
                { carNum: 'B-2', url: '/v/ok2' },
                { carNum: 'X-9', url: '/actors/1' }
            ],
            'favorite',
            0,
            { pacingMs: 60_000 }
        );
        expect(queued).toBe(2);
        expect(getBatchSyncStatus().pending).toBe(2);
        expect(getBatchSyncStatus().succeeded).toBe(0);
    });

    it('无可入队项时不启动队列', () => {
        expect(enqueueBatchPush([{ carNum: 'X-9', url: '/actors/1' }], 'favorite')).toBe(0);
        expect(getBatchSyncStatus().pending).toBe(0);
        expect(getBatchSyncStatus().scheduled).toBe(false);
    });

    it('stopBatchSync 清空队列（未推完的项交由详情页校验兜底）', () => {
        enqueueBatchPush(
            [
                { carNum: 'A-1', url: '/v/ok1' },
                { carNum: 'B-2', url: '/v/ok2' }
            ],
            'favorite',
            0,
            { pacingMs: 60_000 }
        );
        stopBatchSync();
        expect(getBatchSyncStatus().pending).toBe(0);
        expect(getBatchSyncStatus().scheduled).toBe(false);
    });
});

describe('planBatchPush 取消已读（unwatch）', () => {
    it('只需 videoId，不携带评分', () => {
        const { entries } = planBatchPush([{ carNum: 'A-1', url: '/v/ok1' }], 'unwatch');
        expect(entries[0]).toMatchObject({ kind: 'unwatch', score: 0, videoId: 'ok1' });
    });

    it('无 videoId 时同样被跳过（交给本地状态与后续校验）', () => {
        const { entries, skipped } = planBatchPush([{ carNum: 'X-9', url: '/actors/1' }], 'unwatch');
        expect(entries).toHaveLength(0);
        expect(skipped).toEqual(['X-9']);
    });
});
