/**
 * op-sync-table 渲染单测（doc/38）。
 *
 * 覆盖：空态、行内「插件侧状态值 / 网站同步状态」文案与状态类、
 * 排队中与已中断的区分、摘要文案。记录对象为纯字面量，不触存储与 DOM。
 */

import { describe, expect, it } from 'vitest';

import { renderOpSyncHtml, renderOpSyncSummaryHtml } from '../src/components/setting/op-sync-table';

import type { OpSyncRecord } from '../src/plugins/setting/jhs-sync/op-sync-records';

/** 构造一条记录。 */
function record(patch: Partial<OpSyncRecord> = {}): OpSyncRecord {
    return {
        carNum: 'ABC-001',
        url: '/v/abc1',
        kind: 'watched',
        score: 0,
        state: 'pending',
        attempts: 0,
        error: '',
        origin: 'list',
        enqueuedAt: 1000,
        updatedAt: 2000,
        ...patch
    };
}

describe('op-sync-table 渲染', () => {
    it('无记录时给出空态提示', () => {
        const html = renderOpSyncHtml([]);

        expect(html).toContain('暂无同步记录');
        expect(html).not.toContain('op-sync-table');
    });

    it('每行带番号/操作标识与状态类，文案区分插件侧与网站侧', () => {
        const html = renderOpSyncHtml([record({ kind: 'watched', score: 3, state: 'success' })]);

        expect(html).toContain('data-carnum="ABC-001"');
        expect(html).toContain('data-kind="watched"');
        expect(html).toContain('已读 3★');
        expect(html).toContain('✅ 已同步');
        expect(html).toContain('op-sync-row--success');
        expect(html).toContain('data-act="retry"');
        expect(html).toContain('data-act="cancel"');
    });

    it('待推送区分「排队中」与「已中断」；失败带原因', () => {
        const rows = [
            record({ carNum: 'Q-1', state: 'pending' }),
            record({ carNum: 'Q-2', state: 'pending' }),
            record({ carNum: 'F-1', state: 'failed', attempts: 2, error: 'HTTP 503' })
        ];
        const html = renderOpSyncHtml(rows, ['Q-1::watched']);

        expect(html).toContain('待推送（排队中）');
        expect(html).toContain('待推送（已中断）');
        expect(html).toContain('❌ 失败：HTTP 503');
        expect(html).toContain('op-sync-row--failed');
    });

    it('各操作类型的插件侧文案', () => {
        const html = renderOpSyncHtml([
            record({ carNum: 'A', kind: 'favorite' }),
            record({ carNum: 'B', kind: 'watched', score: 0 }),
            record({ carNum: 'C', kind: 'unwatch' }),
            record({ carNum: 'D', kind: 'filter' })
        ]);

        expect(html).toContain('♥ 收藏（想看）');
        expect(html).toContain('已读（0 星）');
        expect(html).toContain('取消已读（删评价）');
        expect(html).toContain('🚫 拉黑（已读 0 星）');
    });

    it('摘要按状态拼接计数', () => {
        const text = renderOpSyncSummaryHtml({
            pending: 2,
            running: 1,
            success: 5,
            failed: 3,
            cancelled: 4
        });

        expect(text).toBe('待推送 2 · 推送中 1 · 已同步 5 · 失败 3 · 已取消 4');
    });
});