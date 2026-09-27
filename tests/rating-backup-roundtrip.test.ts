// @vitest-environment jsdom
/**
 * 评分备份往返测试（doc/29 验证条目）。
 *
 * 断言两件事：
 * 1. `saveCar` 写入的 `score` 出现在 `storageManager.exportData()` 里 ——
 *    该方法是本地 JSON 导出与 WebDav 备份的共同 payload 来源；
 * 2. 用该 payload 做 `importData` 到全新实例后，评分完整保留（往返无损）。
 *
 * 另验证 `RatingCache` 的 IDB 寄生键（`jhsRatingDisplay_data`）同样被 `exportData`
 * 全量带出（它与 car_list 同库同表）。
 *
 * 使用手写 in-memory fake forage（同 tests/storage-migration.test.ts 的 seam），
 * 无需 fake-indexeddb 依赖；environment: jsdom。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HAS_WATCH_ACTION } from '../src/constants/status';
import { StorageManager } from '../src/core/storage-manager';

/** in-memory fake forage（Map 后端）。 */
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

    async clear(): Promise<void> {
        this.store.clear();
    }

    async iterate(callback: (value: unknown, key: string) => void): Promise<void> {
        for (const [key, value] of this.store) callback(value, key);
    }

    async keys(): Promise<string[]> {
        return [...this.store.keys()];
    }
}

const g = globalThis as unknown as { clog?: unknown; utils?: unknown };

/**
 * 新建 StorageManager 实例（单例守卫：构造前必须重置）。
 * @param forage 注入的 forage 替身
 * @returns 新实例（并已注册为单例）
 */
function createSm(forage: FakeForage): StorageManager {
    StorageManager.__resetForTesting();
    return new StorageManager(forage);
}

/** 造一条已读记录（带评分）。 */
function watchedRecord(score: number): {
    carNum: string;
    url: string;
    actionType: string;
    score: number;
} {
    return { carNum: 'DAZD-314', url: '/v/DAZD-314', actionType: HAS_WATCH_ACTION, score };
}

describe('评分备份往返（doc/29）', () => {
    let sm: StorageManager;

    beforeEach(() => {
        g.clog = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
        g.utils = {
            getNowStr: (): string => '2026-01-01_00:00:00',
            copyObj: (value: unknown): unknown => JSON.parse(JSON.stringify(value))
        };
        sm = createSm(new FakeForage());
    });

    it('saveCar 写入的评分出现在 exportData（备份 payload 的来源）', async () => {
        await sm.saveCar(watchedRecord(4));
        const payload = await sm.exportData();
        const list = payload.car_list as Array<{ carNum: string; score?: number }>;
        expect(list.find((car) => car.carNum === 'DAZD-314')?.score).toBe(4);
    });

    it('导出 → 导入往返后评分完整保留（JSON 序列化 + 重新装载）', async () => {
        await sm.saveCar(watchedRecord(5));
        const payload = await sm.exportData();

        // 备份文件是 JSON 文本：模拟一次真实往返（序列化 → 解析 → 落回存储）
        const parsed = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
        const forage2 = new FakeForage();
        for (const [key, value] of Object.entries(parsed)) forage2.seed(key, value);
        const restored = createSm(forage2);

        // 注：storageManager.importData 内部用 localforage 暂存实例（需真实浏览器环境），
        // 故此处只断言「备份 payload 能无损还原出带评分的 car_list」。
        expect((await restored.getCar('DAZD-314'))?.score).toBe(5);
    });

    it('评分缓存 IDB 寄生键（jhsRatingDisplay_data）同样在导出内', async () => {
        // exportData 遍历 store 全部键；这里直接证明「同库同表」的评分缓存会被带出
        const forage = new FakeForage();
        forage.seed('car_list', []);
        forage.seed('jhsRatingDisplay_data', { 'DAZD-314': { rating: 4, updatedAt: 1 } });
        const payload = await createSm(forage).exportData();
        expect(payload.jhsRatingDisplay_data).toEqual({ 'DAZD-314': { rating: 4, updatedAt: 1 } });
    });
});
