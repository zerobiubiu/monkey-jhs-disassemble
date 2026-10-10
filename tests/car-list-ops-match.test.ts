// @vitest-environment jsdom
/**
 * car_list 番号匹配口径回归（doc/47）。
 *
 * 背景：同一番号在写/读路径（saveSingleCar / getCar / saveCar / saveCarList /
 * clearCarWatchStatus）跟随 `featureFlags.caseInsensitiveCarNum`，而
 * `updateCarInfo` / `removeCar` / `batchRemoveCars` 历史上固定精确匹配 ——
 * 结果是「getCar 找得到、removeCar 删不掉」的静默失败。
 *
 * 本用例固化修复后的行为：**三条路径与读取路径同口径**，并验证开关关闭时
 * 退回精确匹配（保持开关语义完整）。
 */
import { afterEach, describe, expect, it } from 'vitest';

import { HAS_WATCH_ACTION } from '../src/constants/status';
import { featureFlags } from '../src/core/feature-flags';
import { StorageManager } from '../src/core/storage-manager';

/** localforage 替身（沿用 tests/ 既有约定：Map 支撑 getItem/setItem）。 */
class FakeForage {
    private store = new Map<string, unknown>();

    seed(key: string, value: unknown): void {
        this.store.set(key, value);
    }

    async getItem(key: string): Promise<unknown> {
        return this.store.has(key) ? this.store.get(key) : null;
    }

    async setItem(key: string, value: unknown): Promise<void> {
        this.store.set(key, value);
    }

    async removeItem(key: string): Promise<void> {
        this.store.delete(key);
    }
}

/** car_list 键（与 StorageManager.car_list_key 一致）。 */
const CAR_LIST_KEY = 'car_list';

/** 建一个装有一条 `ABC-1` 记录的 StorageManager。 */
function setup(): { sm: StorageManager; forage: FakeForage } {
    StorageManager.__resetForTesting();
    const forage = new FakeForage();
    const sm = new StorageManager(forage);
    forage.seed(CAR_LIST_KEY, [
        {
            carNum: 'ABC-1',
            url: 'https://javdb.com/v/abc1',
            names: '',
            status: '',
            createDate: '2026-01-01 00:00:00',
            updateDate: '2026-01-01 00:00:00'
        }
    ]);
    return { sm, forage };
}

/** 读取当前 car_list（直接读替身，绕开缓存）。 */
async function listOf(forage: FakeForage): Promise<Array<{ carNum: string; status?: string }>> {
    return (await forage.getItem(CAR_LIST_KEY)) as Array<{ carNum: string; status?: string }>;
}

// car-list-ops 走运行时全局 utils（getNowStr）与 toast（show.error → 全局 Toastify）
(globalThis as unknown as Record<string, unknown>).utils = {
    getNowStr: (): string => '2026-10-10 12:00:00',
    // getCarList 在 storageCacheDeepCopy 下用 utils.copyObj 做深拷贝
    copyObj: (value: unknown): unknown => structuredClone(value)
};
(globalThis as unknown as Record<string, unknown>).Toastify = (): { showToast: () => void } => ({
    showToast: (): void => {}
});
// car-list-ops 的 show.error 走运行时全局 window.show（main.tsx 挂载）
(globalThis as unknown as Record<string, unknown>).show = {
    ok: (): void => {},
    error: (): void => {},
    info: (): void => {}
};

afterEach(() => {
    // 开关是模块级单例，用例改动后必须还原默认值
    featureFlags.caseInsensitiveCarNum = true;
    StorageManager.__resetForTesting();
});

describe('番号匹配跟随 caseInsensitiveCarNum（默认开）', () => {
    it('getCar 读得到 → removeCar 就能删掉（同口径，修复前的静默失败）', async () => {
        const { sm, forage } = setup();
        expect((await sm.getCar('abc-1'))?.carNum).toBe('ABC-1');

        const removed = await sm.removeCar('abc-1');

        expect(removed).toBe(true);
        expect(await listOf(forage)).toHaveLength(0);
    });

    it('batchRemoveCars 大小写不同也能批量删除', async () => {
        const { sm, forage } = setup();

        const removed = await sm.batchRemoveCars(['abc-1']);

        expect(removed).toBe(1);
        expect(await listOf(forage)).toHaveLength(0);
    });

    it('updateCarInfo 大小写不同也能更新（不再抛 数据不存在）', async () => {
        const { sm, forage } = setup();

        await sm.updateCarInfo({
            carNum: 'abc-1',
            url: 'https://javdb.com/v/abc1',
            names: '新名字',
            actionType: HAS_WATCH_ACTION
        });

        const list = await listOf(forage);
        expect(list).toHaveLength(1);
        expect(list[0].carNum).toBe('ABC-1');
        expect(list[0].status).toBe(HAS_WATCH_ACTION);
    });

    it('clearCarWatchStatus 与其他路径同口径（对照）', async () => {
        const { sm, forage } = setup();
        await sm.updateCarInfo({
            carNum: 'ABC-1',
            url: 'https://javdb.com/v/abc1',
            names: '',
            actionType: HAS_WATCH_ACTION
        });

        const cleared = await sm.clearCarWatchStatus(['abc-1']);

        expect(cleared).toBe(1);
        expect((await listOf(forage))[0].status).toBe('');
    });
});

describe('开关关闭时退回精确匹配（开关语义完整）', () => {
    it('removeCar 大小写不同即视为不存在（不误删）', async () => {
        featureFlags.caseInsensitiveCarNum = false;
        const { sm, forage } = setup();

        const removed = await sm.removeCar('abc-1');

        expect(removed).toBe(false);
        expect(await listOf(forage)).toHaveLength(1);
    });

    it('batchRemoveCars 大小写不同返回 false', async () => {
        featureFlags.caseInsensitiveCarNum = false;
        const { sm } = setup();

        expect(await sm.batchRemoveCars(['abc-1'])).toBe(false);
    });

    it('精确大小写仍可正常删除（同一口径下的成功路径）', async () => {
        featureFlags.caseInsensitiveCarNum = false;
        const { sm, forage } = setup();

        expect(await sm.removeCar('ABC-1')).toBe(true);
        expect(await listOf(forage)).toHaveLength(0);
    });
});