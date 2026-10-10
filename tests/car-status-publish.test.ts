/**
 * 跨站状态**发布侧**用例回归（doc/47）。
 *
 * 靶心：全量快照只有一个权威构造点 —— 自动全量同步与设置面板「同步到 missav」
 * 按钮都走 `publishFullSnapshot`，产出的载荷必须是**协议完整**的
 * （`revision`/`mode`/`ready` 齐备、`ts === revision`、`hwm` 由同一 revision 派生），
 * 并同步维护修订号与同步指针 —— 修复前面板路径自建载荷缺三个字段，
 * 消费端只能回退 `ts`（墙钟）当修订号写水位线。
 *
 * environment: node（注入 GM 替身；Web Locks 缺失时 withExclusiveLock 直接执行）。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    GM_KEY_CAR_STATUS_REVISION,
    type CarStatusPayload
} from '../src/plugins/car-status-sync/car-status-config';
import {
    __resetPublisherForTest,
    allocateRevision,
    appendDeltaJournal,
    publishFullSnapshot
} from '../src/plugins/car-status-sync/car-status-publish';
import type { CarRecord } from '../src/core/storage-manager';

/** GM 存储替身（GM_getValue / GM_setValue）。 */
const gm = new Map<string, unknown>();

function installGmStubs(): void {
    gm.clear();
    (globalThis as unknown as Record<string, unknown>).GM_getValue = (key: string, fallback?: unknown): unknown =>
        gm.has(key) ? gm.get(key) : fallback;
    (globalThis as unknown as Record<string, unknown>).GM_setValue = (key: string, value: unknown): void => {
        gm.set(key, value);
    };
}

/** 一条可进列存的 car_list 记录（status/url 齐备）。 */
const record = (carNum: string): CarRecord => ({
    carNum,
    url: `https://javdb.com/v/${carNum.toLowerCase()}`,
    status: 'favorite'
});

const getList =
    (records: CarRecord[]) =>
    async (): Promise<CarRecord[]> =>
        records;

beforeEach(() => {
    installGmStubs();
    __resetPublisherForTest();
});

describe('publishFullSnapshot：协议完整载荷（面板与自动同步同一条路径）', () => {
    it('写出 revision/mode/ready，且 ts === revision、hwm 由同一 revision 派生', async () => {
        const result = await publishFullSnapshot(getList([record('ABC-1'), record('DEF-2')]));

        expect(result.ok).toBe(true);
        expect(result.count).toBe(2);
        const payload = gm.get(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload;
        expect(payload.revision).toBe(result.revision);
        expect(payload.ts).toBe(payload.revision);
        expect(payload.mode).toBe('snapshot');
        expect(payload.ready).toBe(true);
        expect(payload.count).toBe(2);
        expect(payload.hwm).toBe(new Date(payload.revision as number).toISOString());
        expect(typeof payload.data).toBe('string');
        expect((payload.data as string).length).toBeGreaterThan(0);
    });

    it('同步维护修订号与同步指针（SYNCED_REV / LAST_SYNC_TIME）', async () => {
        gm.set('jhs_car_list_rev', 7);
        await publishFullSnapshot(getList([record('ABC-1')]));

        expect(gm.get(GM_KEY_CAR_STATUS_REVISION)).toBeGreaterThan(0);
        expect(gm.get('jhs_car_status_synced_rev')).toBe(7);
        expect(typeof gm.get('jhs_car_status_last_sync')).toBe('number');
    });

    it('空 car_list → 不写快照（reason=empty）', async () => {
        const result = await publishFullSnapshot(getList([]));

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('empty');
        expect(gm.has(GM_KEY_CAR_STATUS_DATA)).toBe(false);
        expect(gm.has(GM_KEY_CAR_STATUS_REVISION)).toBe(false);
    });

    it('行全部无效（缺 status/url）→ 不写快照（reason=no-valid，与消费端拒收 count=0 一致）', async () => {
        const result = await publishFullSnapshot(getList([{ carNum: 'ABC-1' }, { carNum: 'DEF-2' }]));

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('no-valid');
        expect(gm.has(GM_KEY_CAR_STATUS_DATA)).toBe(false);
    });

    it('旧快照不能覆盖新快照（reason=superseded），且不改动现场', async () => {
        // 构造「已发布一份修订号远高于本次分配值」的现场：本次分配 = max(now, …) 必低于它
        const futureRevision = Date.now() + 10_000_000;
        gm.set(GM_KEY_CAR_STATUS_REVISION, 0);
        gm.set(GM_KEY_CAR_STATUS_DATA, {
            data: 'existing',
            hwm: new Date(futureRevision).toISOString(),
            count: 1,
            ts: futureRevision,
            revision: futureRevision,
            mode: 'snapshot',
            ready: true
        });
        const seededJournal = [
            { action: 'upsert', items: [{ carNum: 'OLD-1', status: 'favorite', url_path: 'x' }], ts: 1, revision: 1 }
        ];
        gm.set(GM_KEY_CAR_STATUS_DELTA, seededJournal);

        const result = await publishFullSnapshot(getList([record('DEF-2')]));

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('superseded');
        expect((gm.get(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload).revision).toBe(futureRevision);
        // 被拒的发布不写快照、也不裁剪日志（裁剪只在真正写入时发生）
        expect(gm.get(GM_KEY_CAR_STATUS_DELTA)).toEqual(seededJournal);
    });

    it('发布成功后裁剪比快照更旧的增量日志', async () => {
        gm.set(GM_KEY_CAR_STATUS_DELTA, [
            { action: 'upsert', items: [{ carNum: 'OLD-1', status: 'favorite', url_path: 'x' }], ts: 1, revision: 1 }
        ]);

        const result = await publishFullSnapshot(getList([record('ABC-1')]));

        expect(result.ok).toBe(true);
        expect(gm.get(GM_KEY_CAR_STATUS_DELTA)).toEqual([]);
    });
});

describe('修订号与增量日志（发布侧基础能力）', () => {
    it('allocateRevision 单调递增且写入 GM', async () => {
        const first = await allocateRevision();
        const second = await allocateRevision();

        expect(second).toBeGreaterThan(first);
        expect(gm.get(GM_KEY_CAR_STATUS_REVISION)).toBe(second);
    });

    it('appendDeltaJournal 追加并保留 revision 字段', async () => {
        await appendDeltaJournal({
            action: 'delete',
            items: [{ carNum: 'ABC-1' }],
            ts: 10,
            revision: 10
        });

        const journal = gm.get(GM_KEY_CAR_STATUS_DELTA) as Array<Record<string, unknown>>;
        expect(journal).toHaveLength(1);
        expect(journal[0].revision).toBe(10);
    });
});