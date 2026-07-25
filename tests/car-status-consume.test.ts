/**
 * missav 端跨站同步消费管线核心纯函数回归测试。
 *
 * 覆盖 car-status-journal.ts 中从 missav-status-tag-plugin.ts /
 * car-list-reader-plugin.ts 提取的共享解析函数：
 * readDeltaJournal / sortDeltaJournal / isDeltaPayload / getPayloadRevision。
 *
 * environment: node（纯函数，无 GM/IDB/DOM 依赖）。
 */
import { describe, expect, it } from 'vitest';

import {
    getPayloadRevision,
    isDeltaPayload,
    readDeltaJournal,
    sortDeltaJournal
} from '../src/plugins/car-status-sync/car-status-journal';

// ---------------------------------------------------------------------------
// 辅助工厂：构造合法/非法载荷
// ---------------------------------------------------------------------------

/** 构造一个合法的 upsert 载荷。 */
function makeUpsert(overrides: Record<string, unknown> = {}) {
    return {
        action: 'upsert' as const,
        items: [{ carNum: 'ABC-123', status: 'favorite', url_path: '/v/abc123' }],
        ts: 1721800000000,
        ...overrides
    };
}

/** 构造一个合法的 delete 载荷。 */
function makeDelete(overrides: Record<string, unknown> = {}) {
    return {
        action: 'delete' as const,
        items: [{ carNum: 'DEF-456' }],
        ts: 1721800001000,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// readDeltaJournal
// ---------------------------------------------------------------------------

describe('readDeltaJournal', () => {
    it('数组输入 → 过滤无效项，保留合法载荷', () => {
        const valid = makeUpsert();
        const invalid = { action: 'upsert', items: [], ts: 1 }; // 空 items → 非法
        const journal = readDeltaJournal([valid, invalid, 'garbage', 42, null]);
        expect(journal).toHaveLength(1);
        expect(journal[0]).toEqual(valid);
    });

    it('单对象输入 → 包成数组', () => {
        const payload = makeUpsert();
        const journal = readDeltaJournal(payload);
        expect(journal).toHaveLength(1);
        expect(journal[0]).toEqual(payload);
    });

    it('null → 空数组', () => {
        expect(readDeltaJournal(null)).toEqual([]);
    });

    it('undefined → 空数组', () => {
        expect(readDeltaJournal(undefined)).toEqual([]);
    });

    it('空数组 → 空数组', () => {
        expect(readDeltaJournal([])).toEqual([]);
    });

    it('全部无效项 → 空数组', () => {
        expect(readDeltaJournal([{ action: 'unknown' }, 'str', 0])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// sortDeltaJournal
// ---------------------------------------------------------------------------

describe('sortDeltaJournal', () => {
    it('按 revision 升序排列', () => {
        const a = makeUpsert({ revision: 300 });
        const b = makeUpsert({ revision: 100 });
        const c = makeUpsert({ revision: 200 });
        const sorted = sortDeltaJournal([a, b, c]);
        expect(sorted.map((p) => getPayloadRevision(p))).toEqual([100, 200, 300]);
    });

    it('无 revision 时回退到 ts 排序', () => {
        const a = makeUpsert({ ts: 3000 });
        const b = makeUpsert({ ts: 1000 });
        const sorted = sortDeltaJournal([a, b]);
        expect(sorted.map((p) => getPayloadRevision(p))).toEqual([1000, 3000]);
    });

    it('相同 revision 保持原始插入顺序（稳定排序）', () => {
        const first = makeUpsert({ revision: 100, ts: 1000 });
        const second = makeDelete({ revision: 100, ts: 2000 });
        const sorted = sortDeltaJournal([first, second]);
        // 两个载荷 revision 相同，应保持原始顺序：first 在前
        expect(sorted[0]).toEqual(first);
        expect(sorted[1]).toEqual(second);
    });

    it('空 journal → 空数组', () => {
        expect(sortDeltaJournal([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// isDeltaPayload
// ---------------------------------------------------------------------------

describe('isDeltaPayload', () => {
    it('合法 upsert（含 revision）→ true', () => {
        expect(isDeltaPayload(makeUpsert({ revision: 42 }))).toBe(true);
    });

    it('合法 upsert（无 revision）→ true', () => {
        expect(isDeltaPayload(makeUpsert())).toBe(true);
    });

    it('合法 delete → true', () => {
        expect(isDeltaPayload(makeDelete())).toBe(true);
    });

    it('缺 url_path 的 upsert → false', () => {
        const payload = {
            action: 'upsert',
            items: [{ carNum: 'ABC-123', status: 'favorite' }],
            ts: 1721800000000
        };
        expect(isDeltaPayload(payload)).toBe(false);
    });

    it('空 items → false', () => {
        expect(isDeltaPayload(makeUpsert({ items: [] }))).toBe(false);
    });

    it('非对象（字符串）→ false', () => {
        expect(isDeltaPayload('not-an-object')).toBe(false);
    });

    it('非对象（数字）→ false', () => {
        expect(isDeltaPayload(42)).toBe(false);
    });

    it('null → false', () => {
        expect(isDeltaPayload(null)).toBe(false);
    });

    it('数组 → false', () => {
        expect(isDeltaPayload([makeUpsert()])).toBe(false);
    });

    it('status 不在 STATUS_LIST → false', () => {
        const payload = {
            action: 'upsert',
            items: [{ carNum: 'ABC-123', status: 'invalidStatus', url_path: '/v/abc' }],
            ts: 1721800000000
        };
        expect(isDeltaPayload(payload)).toBe(false);
    });

    it('action 非法 → false', () => {
        expect(isDeltaPayload({ action: 'update', items: [{ carNum: 'X' }], ts: 1 })).toBe(false);
    });

    it('ts 为负数 → false', () => {
        expect(isDeltaPayload(makeUpsert({ ts: -1 }))).toBe(false);
    });

    it('revision 为负数 → false', () => {
        expect(isDeltaPayload(makeUpsert({ revision: -5 }))).toBe(false);
    });

    it('carNum 为空白字符串 → false', () => {
        const payload = {
            action: 'upsert',
            items: [{ carNum: '  ', status: 'favorite', url_path: '/v/x' }],
            ts: 1721800000000
        };
        expect(isDeltaPayload(payload)).toBe(false);
    });

    it('STATUS_LIST 所有合法状态均通过', () => {
        for (const status of ['filter', 'favorite', 'hasDown', 'hasWatch']) {
            const payload = {
                action: 'upsert',
                items: [{ carNum: 'ABC-123', status, url_path: '/v/abc' }],
                ts: 1721800000000
            };
            expect(isDeltaPayload(payload)).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// getPayloadRevision
// ---------------------------------------------------------------------------

describe('getPayloadRevision', () => {
    it('有 revision → 返回 revision', () => {
        expect(getPayloadRevision({ revision: 42, ts: 9999 })).toBe(42);
    });

    it('无 revision 有 ts → 返回 ts', () => {
        expect(getPayloadRevision({ ts: 1721800000000 })).toBe(1721800000000);
    });

    it('revision 为 0 → 返回 0（有效非负整数）', () => {
        expect(getPayloadRevision({ revision: 0, ts: 9999 })).toBe(0);
    });

    it('revision 为负数 → -1', () => {
        expect(getPayloadRevision({ revision: -1, ts: 9999 })).toBe(-1);
    });

    it('revision 为 undefined 且 ts 为负数 → -1', () => {
        expect(getPayloadRevision({ revision: undefined, ts: -100 })).toBe(-1);
    });

    it('ts 为 NaN → -1', () => {
        expect(getPayloadRevision({ ts: NaN })).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// 端到端场景：javdb 写入 journal → missav 读取消费
// ---------------------------------------------------------------------------

describe('端到端：javdb 写入 → missav 读取消费', () => {
    it('模拟 javdb 写入 2 条 upsert journal，missav 读取后排序正确', () => {
        // javdb 端先写入 revision=200 的变更，再写入 revision=100 的变更
        // （模拟乱序写入或并发场景）
        const laterChange = makeUpsert({
            revision: 200,
            items: [{ carNum: 'XYZ-789', status: 'hasWatch', url_path: '/v/xyz789' }]
        });
        const earlierChange = makeUpsert({
            revision: 100,
            items: [{ carNum: 'ABC-123', status: 'favorite', url_path: '/v/abc123' }]
        });

        // GM 存储中 journal 按写入顺序存放（乱序）
        const gmValue = [laterChange, earlierChange];

        // missav 端读取
        const journal = readDeltaJournal(gmValue);
        expect(journal).toHaveLength(2);

        // 排序后 revision 升序
        const sorted = sortDeltaJournal(journal);
        expect(getPayloadRevision(sorted[0])).toBe(100);
        expect(getPayloadRevision(sorted[1])).toBe(200);
        expect(sorted[0].items[0].carNum).toBe('ABC-123');
        expect(sorted[1].items[0].carNum).toBe('XYZ-789');
    });

    it('混入无效载荷时只消费合法项', () => {
        const valid = makeUpsert({ revision: 50 });
        const invalid1 = { action: 'upsert', items: [], ts: 1 };
        const invalid2 = 'corrupted-data';
        const invalid3 = null;

        const journal = readDeltaJournal([valid, invalid1, invalid2, invalid3]);
        expect(journal).toHaveLength(1);
        expect(journal[0]).toEqual(valid);

        const sorted = sortDeltaJournal(journal);
        expect(sorted).toHaveLength(1);
    });

    it('旧单对象载荷（无 revision）被正确包装并排序', () => {
        // 旧协议 javdb 写入单对象（非数组）
        const legacyPayload = makeUpsert({ ts: 5000 });

        const journal = readDeltaJournal(legacyPayload);
        expect(journal).toHaveLength(1);

        const sorted = sortDeltaJournal(journal);
        expect(getPayloadRevision(sorted[0])).toBe(5000);
    });
});
