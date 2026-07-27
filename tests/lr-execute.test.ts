/**
 * lr-execute 压实执行引擎单测（doc/204 期2a）。
 *
 * 用 vi.mock 隔离 VLT 网络层（postJavdbListMutation / fetchAuthoritativeCheckboxState），
 * 验证安全核心：先加后删、加入被拒/未确认则不删来源（不变式1 永不丢片）、
 * 纯去重只移除、切片 paused/nextIndex、完成 done、中止 aborted。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCompactionPlan } from '../src/plugins/list-reflow/lr-execute';
import type { CompactionPlan, ReflowMove } from '../src/plugins/list-reflow/lr-types';
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../src/plugins/video-lists-tag/server/vlt-server-api';

vi.mock('../src/plugins/video-lists-tag/server/vlt-server-api', () => ({
    postJavdbListMutation: vi.fn(),
    fetchAuthoritativeCheckboxState: vi.fn()
}));

const mockPost = vi.mocked(postJavdbListMutation);
const mockAuth = vi.mocked(fetchAuthoritativeCheckboxState);

function makePlan(moves: ReflowMove[]): CompactionPlan {
    return {
        base: 'x',
        totalUnique: 0,
        duplicateCount: 0,
        duplicates: [],
        targets: [],
        moves,
        addCount: 0,
        removeCount: 0,
        overflow: []
    };
}

const run = (plan: CompactionPlan, count = 10, signal = { aborted: false }) =>
    executeCompactionPlan(plan, { startIndex: 0, count, interval: 0, signal });

beforeEach(() => {
    mockPost.mockReset();
    mockAuth.mockReset();
});

describe('executeCompactionPlan', () => {
    it('先加后删：加入成功后才移除来源', async () => {
        mockPost.mockResolvedValue({ kind: 'confirmed', message: 'ok' });
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: 'B' }]));
        expect(result.completed).toBe(1);
        expect(result.failed).toBe(0);
        expect(mockPost.mock.calls[0]).toEqual(['v1', 'B', true]);
        expect(mockPost.mock.calls[1]).toEqual(['v1', 'A', false]);
    });

    it('加入被拒 → 不移除来源（不丢片）', async () => {
        mockPost.mockResolvedValue({ kind: 'rejected', message: '已满' });
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: 'B' }]));
        expect(result.failed).toBe(1);
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost.mock.calls[0]).toEqual(['v1', 'B', true]);
    });

    it('纯去重（addTo=null）只移除来源', async () => {
        mockPost.mockResolvedValue({ kind: 'confirmed', message: 'ok' });
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A', 'C'], addTo: null }]));
        expect(result.completed).toBe(1);
        expect(mockPost.mock.calls.map((c) => [c[1], c[2]])).toEqual([
            ['A', false],
            ['C', false]
        ]);
    });

    it('加入 unknown 但权威校验已加入 → 继续移除', async () => {
        mockPost.mockResolvedValue({ kind: 'unknown', message: '?' });
        mockAuth.mockImplementation(async (_videoId, listId) => ({
            checked: listId === 'B',
            count: 1,
            name: listId
        }));
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: 'B' }]));
        expect(result.completed).toBe(1);
        expect(mockAuth).toHaveBeenCalledWith('v1', 'B');
        expect(mockPost.mock.calls[1]).toEqual(['v1', 'A', false]);
    });

    it('加入 unknown 且权威校验未加入 → 不移除', async () => {
        mockPost.mockResolvedValue({ kind: 'unknown', message: '?' });
        mockAuth.mockResolvedValue({ checked: false, count: 0, name: 'B' });
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: 'B' }]));
        expect(result.failed).toBe(1);
        expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('切片：count 限制 → paused + nextIndex', async () => {
        mockPost.mockResolvedValue({ kind: 'confirmed', message: 'ok' });
        const plan = makePlan([
            { videoId: 'v1', removeFrom: ['A'], addTo: null },
            { videoId: 'v2', removeFrom: ['A'], addTo: null },
            { videoId: 'v3', removeFrom: ['A'], addTo: null }
        ]);
        const result = await run(plan, 2);
        expect(result.status).toBe('paused');
        expect(result.completed).toBe(2);
        expect(result.nextIndex).toBe(2);
    });

    it('全部完成 → done', async () => {
        mockPost.mockResolvedValue({ kind: 'confirmed', message: 'ok' });
        const result = await run(makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: null }]));
        expect(result.status).toBe('done');
    });

    it('中止 → aborted 且不发请求', async () => {
        mockPost.mockResolvedValue({ kind: 'confirmed', message: 'ok' });
        const result = await run(
            makePlan([{ videoId: 'v1', removeFrom: ['A'], addTo: null }]),
            10,
            { aborted: true }
        );
        expect(result.status).toBe('aborted');
        expect(mockPost).not.toHaveBeenCalled();
    });
});
