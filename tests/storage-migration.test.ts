// @vitest-environment jsdom
/**
 * StorageManager 版本化迁移回归测试 —— 保护 doc/135/162 schema 版本化迁移。
 *
 * 第一组（runMigrations 集成契约）：
 * 1. 幂等性：version=6 时零步骤执行，数据不变。
 * 2. 版本门控：version=3 时仅执行步骤 4-6，跳过 1-3。
 * 3. 全量 0→6：旧键数据迁移到新键，旧键删除，version 升至 6。
 * 4. 迁移后缓存失效：getBlacklistCarList 返回迁移后的数据（非旧冻结缓存）。
 * 5. 失败重试：步骤抛错时版本号不前进，下次启动重试。
 * 第二组（附件重点分析路径的正向回归，doc/163）：
 * 6. clean_no_url_blacklist 跨清单过滤 + recordTime→createTime + 冗余字段删除。
 * 7. async_merge_other 废弃设置键与 downPath115 删除、有效键保留。
 *
 * 使用手写 in-memory fake forage（Map 后端），无需 fake-indexeddb 依赖。
 * environment: jsdom（文件级 pragma）—— constants/site.ts 模块加载期读
 * window.location.href；并 stub globalThis.clog / utils / window.clean_cacheSettingObj。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ---- in-memory fake forage ----
class FakeForage {
    private store = new Map<string, any>();

    seed(key: string, value: any): void {
        this.store.set(key, value);
    }

    async getItem(key: string): Promise<any> {
        return this.store.has(key) ? this.store.get(key) : null;
    }

    async setItem(key: string, value: any): Promise<void> {
        this.store.set(key, value);
    }

    async removeItem(key: string): Promise<void> {
        this.store.delete(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }

    has(key: string): boolean {
        return this.store.has(key);
    }

    get(key: string): any {
        return this.store.get(key);
    }
}

// ---- globals stub ----
const savedGlobals: Record<string, any> = {};

function stubGlobals(): void {
    savedGlobals.clog = (globalThis as any).clog;
    savedGlobals.utils = (globalThis as any).utils;
    savedGlobals.windowClean = (globalThis as any).window?.clean_cacheSettingObj;
    (globalThis as any).clog = {
        log: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
    };
    (globalThis as any).utils = {
        copyObj: (x: any) => JSON.parse(JSON.stringify(x)),
        deepFreeze: (x: any) => x
    };
    // async_merge_other 的 saveSetting 路径会调用 window.clean_cacheSettingObj()
    if ((globalThis as any).window) {
        (globalThis as any).window.clean_cacheSettingObj = () => {};
    }
}

function restoreGlobals(): void {
    (globalThis as any).clog = savedGlobals.clog;
    (globalThis as any).utils = savedGlobals.utils;
    if ((globalThis as any).window) {
        if (savedGlobals.windowClean === undefined) {
            delete (globalThis as any).window.clean_cacheSettingObj;
        } else {
            (globalThis as any).window.clean_cacheSettingObj = savedGlobals.windowClean;
        }
    }
}

// ---- import AFTER globals are stubbed (vitest hoists imports, so we use dynamic import) ----
// Actually vitest hoists static imports above everything. We need the module to see our stubs.
// Solution: set globals in a top-level side-effect BEFORE the dynamic import.
// But vitest runs beforeEach before each test, not before module load.
// The module (storage-manager) references clog/utils at CALL time (inside methods), not at load time.
// So static import is fine — the globals just need to exist when runMigrations() executes.

import { StorageManager } from '../src/core/storage-manager';

const SCHEMA_KEY = '__jhs_schema_version';

describe('StorageManager.runMigrations', () => {
    let forage: FakeForage;

    beforeEach(() => {
        stubGlobals();
        StorageManager.__resetForTesting();
        forage = new FakeForage();
    });

    afterEach(() => {
        restoreGlobals();
    });

    it('幂等性：version=6 时零步骤执行', async () => {
        forage.seed(SCHEMA_KEY, 6);
        forage.seed('car_list', [{ carNum: 'ABC-123', names: ['X'], status: 1 }]);
        const sm = new StorageManager(forage as any);
        await sm.runMigrations();
        expect(await forage.getItem(SCHEMA_KEY)).toBe(6);
        // car_list 未被触碰
        const cars = await forage.getItem('car_list');
        expect(cars).toEqual([{ carNum: 'ABC-123', names: ['X'], status: 1 }]);
    });

    it('版本门控：version=3 时仅执行步骤 4-6', async () => {
        forage.seed(SCHEMA_KEY, 3);
        // 步骤 4 的输入：blacklist 含旧字段 isActor
        forage.seed('blacklist', [
            { name: 'Alice', isActor: true, url: 'https://javdb.com/actors/ABC' }
        ]);
        // 步骤 5 的输入：收藏演员含旧字段 dbId
        forage.seed('favorite_actresses', [{ dbId: '999', name: 'Bob' }]);
        // 步骤 6 的输入：car_list 含旧字段 actress
        forage.seed('car_list', [{ carNum: 'XYZ-001', actress: 'Alice' }]);
        forage.seed('blacklist_car_list', [{ carNum: 'XYZ-002', actress: 'Alice' }]);
        // 设置无废弃键（步骤 3 不执行 saveSetting → 不需 window stub）
        forage.seed('setting', {});

        const sm = new StorageManager(forage as any);
        await sm.runMigrations();

        expect(await forage.getItem(SCHEMA_KEY)).toBe(6);

        // 步骤 4：isActor → role
        const bl = await forage.getItem('blacklist');
        expect(bl[0].role).toBeDefined();
        expect(bl[0].isActor).toBeUndefined();
        expect(bl[0].starId).toBe('ABC'); // 从 URL pathname 提取
        expect(bl[0].allName).toEqual(['Alice']);
        expect(bl[0].movieType).toBeDefined();

        // 步骤 5：dbId → starId
        const fav = await forage.getItem('favorite_actresses');
        expect(fav[0].starId).toBe('999');
        expect(fav[0].dbId).toBeUndefined();

        // 步骤 6：actress → names
        const cars = await forage.getItem('car_list');
        expect(cars[0].names).toBe('Alice');
        expect(cars[0].actress).toBeUndefined();

        const blCars = await forage.getItem('blacklist_car_list');
        expect(blCars[0].names).toBe('Alice');
        expect(blCars[0].actress).toBeUndefined();
    });

    it('全量 0→6：旧键迁移 + 旧键删除', async () => {
        // 无 version 键 → 默认 0
        // 步骤 1 的旧键
        forage.seed('filter_actor_actress_info_list', [{ name: 'Carol', url: 'https://javdb.com/actors/DEF' }]);
        forage.seed('favorite_actresses_info_list', [{ dbId: '111', name: 'Dave' }]);
        forage.seed('car_list_filter_actor_actress', [{ carNum: 'AAA-001', actress: 'Carol' }]);
        // 步骤 3 的设置（无废弃键）
        forage.seed('setting', {});

        const sm = new StorageManager(forage as any);
        await sm.runMigrations();

        expect(await forage.getItem(SCHEMA_KEY)).toBe(6);

        // 旧键已删除
        expect(forage.has('filter_actor_actress_info_list')).toBe(false);
        expect(forage.has('favorite_actresses_info_list')).toBe(false);
        expect(forage.has('car_list_filter_actor_actress')).toBe(false);

        // 新键已填充
        const bl = await forage.getItem('blacklist');
        expect(bl.length).toBe(1);
        expect(bl[0].name).toBe('Carol');

        const fav = await forage.getItem('favorite_actresses');
        expect(fav.length).toBe(1);
        expect(fav[0].starId).toBe('111');

        const blCars = await forage.getItem('blacklist_car_list');
        expect(blCars.length).toBe(1);
        expect(blCars[0].names).toBe('Carol');
    });

    it('迁移后缓存失效：getBlacklistCarList 返回迁移后数据', async () => {
        forage.seed(SCHEMA_KEY, 5); // 仅步骤 6 待执行
        forage.seed('blacklist_car_list', [{ carNum: 'BBB-001', actress: 'Eve' }]);
        forage.seed('blacklist', []);
        forage.seed('car_list', []);
        forage.seed('setting', {});

        const sm = new StorageManager(forage as any);
        await sm.runMigrations();

        // 迁移后 actress → names
        const blCars = await sm.getBlacklistCarList();
        expect(blCars[0].names).toBe('Eve');
        expect((blCars[0] as any).actress).toBeUndefined();
    });

    it('失败步骤保留版本号，下次重试', async () => {
        // 构造一个会在步骤 4 抛错的 forage
        const badForage = new FakeForage();
        badForage.seed(SCHEMA_KEY, 3);
        badForage.seed('setting', {});
        // 步骤 4 读 blacklist 时返回非法数据使 map 抛错
        const origGetItem = badForage.getItem.bind(badForage);
        let callCount = 0;
        badForage.getItem = async (key: string) => {
            if (key === 'blacklist') {
                callCount++;
                if (callCount === 1) {
                    // 返回一个使 .map 抛错的值（非数组）
                    return 'not-an-array' as any;
                }
            }
            return origGetItem(key);
        };

        const sm = new StorageManager(badForage as any);
        await sm.runMigrations();

        // 步骤 4 失败 → version 停留在 3
        expect(await badForage.getItem(SCHEMA_KEY)).toBe(3);
    });
});

describe('StorageManager 迁移步骤行为（附件分析路径的正向回归）', () => {
    let forage: FakeForage;

    beforeEach(() => {
        stubGlobals();
        StorageManager.__resetForTesting();
        forage = new FakeForage();
    });

    afterEach(() => {
        restoreGlobals();
    });

    it('clean_no_url_blacklist：跨清单过滤 + recordTime→createTime + 冗余字段删除', async () => {
        // 演员黑名单：Alice 被番号引用且带冗余字段；Orphan 无任何番号引用（应被清除）
        forage.seed('blacklist', [
            { name: 'Alice', key: 'k1', recordTime: 1000 },
            { name: 'Orphan', key: 'k2', recordTime: 2000 }
        ]);
        // 番号黑名单：C1 引用 Alice（保留）；C2 引用不存在的 Ghost（应被清除）；C3 无 actress（保留）
        forage.seed('blacklist_car_list', [
            { carNum: 'C1', actress: 'Alice' },
            { carNum: 'C2', actress: 'Ghost' },
            { carNum: 'C3' }
        ]);

        const sm = new StorageManager(forage as any);
        await sm.clean_no_url_blacklist();

        // 番号侧：C2（actress 不在演员 nameSet）被清除
        const cars = await forage.getItem('blacklist_car_list');
        expect(cars.map((c: any) => c.carNum)).toEqual(['C1', 'C3']);

        // 演员侧：Orphan（name 不在保留番号的 actressSet）被清除；
        // Alice 的 key/recordTime 被删除，recordTime 迁移为 createTime
        const bl = await forage.getItem('blacklist');
        expect(bl).toHaveLength(1);
        expect(bl[0].name).toBe('Alice');
        expect(bl[0].createTime).toBe(1000);
        expect('key' in bl[0]).toBe(false);
        expect('recordTime' in bl[0]).toBe(false);
    });

    it('async_merge_other：删除废弃设置键与 downPath115，保留有效键', async () => {
        forage.seed('setting', {
            theme: 'dark', // 有效键，必须保留
            enableCheckBlacklist: true, // 废弃键
            checkRequestSleep: 500, // 废弃键
            downPath115: '/old/path' // 废弃键
        });

        const sm = new StorageManager(forage as any);
        await sm.async_merge_other();

        const setting = await forage.getItem('setting');
        expect(setting.theme).toBe('dark');
        expect('enableCheckBlacklist' in setting).toBe(false);
        expect('checkRequestSleep' in setting).toBe(false);
        expect('downPath115' in setting).toBe(false);
    });
});
