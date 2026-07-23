/**
 * 存储管理模块（提取自 archetype/jhs.user.js L228-1080 `class z`）
 *
 * 基于 localforage（IndexedDB）封装，管理番号清单（carList）、黑名单演员
 * （blacklist）、黑名单番号清单（blacklistCarList）、收藏演员
 * （favoriteActresses）、高亮标签（highlightedTags）、标题/评论过滤关键词、
 * 以及全局设置（setting）。并提供数据结构迁移与导入/导出能力。
 *
 * 具体操作已拆分至 src/core/storage/ 子模块：
 * - car-list-ops.ts：番号清单增删改查
 * - blacklist-ops.ts：黑名单演员增删改查
 * - blacklist-car-list-ops.ts：黑名单番号清单
 * - favorite-actress-ops.ts：收藏演员
 * - keyword-ops.ts：过滤关键词
 * - storage-migrations.ts：数据结构迁移
 *
 * 本文件保留类定义、单例管理、缓存字段、设置读写、导入/导出，
 * 以及指向子模块的薄委托方法。
 *
 * 依赖（已由 src/types/globals.d.ts 声明为 any）：
 * - localforage：IndexedDB 封装库（@require 引入）；
 * - show / utils / clog：运行时全局；
 * - window.cleanCache_filter_actor_actress_car_list / clean_cacheSettingObj：
 *   由 legacy 启动逻辑挂载的缓存清理钩子。
 *
 * 仅 JS→TS 转换与命名优化，控制流与原脚本保持一致。
 */

import { featureFlags } from './feature-flags';
import { storageRevision } from './storage-revision';
import type { CarListChangeEvent, CarRecord, CarSaveInput } from './storage/car-list-ops';
import {
    batchRemoveCars,
    getCar,
    getCarList,
    removeCar,
    saveCar,
    saveCarList,
    saveSingleCar,
    updateCarInfo
} from './storage/car-list-ops';
import type { BlacklistItem } from './storage/blacklist-ops';
import {
    addBlacklistItem,
    deleteBlacklistItem,
    getBlacklist,
    updateBlacklistItem
} from './storage/blacklist-ops';
import {
    batchSaveBlacklistCarList,
    getBlacklistCarList,
    removeBlacklistCarList
} from './storage/blacklist-car-list-ops';
import type { FavoriteActress } from './storage/favorite-actress-ops';
import {
    addFavoriteActressList,
    getFavoriteActressList,
    removeFavoriteActress,
    removeNewVideoList,
    updateFavoriteActress
} from './storage/favorite-actress-ops';
import {
    getReviewFilterKeywordList,
    getTitleFilterKeyword,
    saveReviewFilterKeyword,
    saveTitleFilterKeyword
} from './storage/keyword-ops';
import { async_merge_other, clean_no_url_blacklist, runMigrations } from './storage/storage-migrations';

// Re-export types for external consumers (importers use `from '../core/storage-manager'`)
export type { CarListChangeEvent, CarRecord, CarSaveInput } from './storage/car-list-ops';
export type { BlacklistItem } from './storage/blacklist-ops';
export type { FavoriteActress } from './storage/favorite-actress-ops';

/** 全局设置对象 */
export interface Setting {
    [key: string]: unknown;
}

export class StorageManager {
    /** 单例实例（原 n.instance） */
    private static instance: StorageManager | null = null;

    /** @internal 存储键（子模块通过 StorageManager 实例访问） */
    readonly car_list_key = 'car_list';
    /** @internal */
    readonly filter_keyword_title_key = 'filter_keyword_title';
    /** @internal */
    readonly filter_keyword_review_key = 'filter_keyword_review';
    /** @internal */
    readonly setting_key = 'setting';
    /** @internal */
    readonly blacklist_key = 'blacklist';
    /** @internal */
    readonly blacklist_car_list_key = 'blacklist_car_list';
    /** @internal */
    readonly favorite_actresses_key = 'favorite_actresses';
    /** @internal */
    readonly highlighted_tags_key = 'highlighted_tags';

    /** localforage 实例（可通过构造函数注入测试替身） */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- localforage is untyped global, 40+ usage sites
    /** @internal */
    readonly forage: any;

    /** 番号清单缓存（新版） @internal */
    cacheCarList: CarRecord[] | null = null;
    /** 收藏演员缓存（新版） @internal */
    cacheFavoriteActressList: FavoriteActress[] | null = null;
    /** 黑名单番号清单缓存 @internal */
    cache_filter_actor_actress_car_list: CarRecord[] | null = null;
    /** 设置对象缓存 @internal */
    cacheSettingObj: Setting | null = null;

    /**
     * car_list 变更回调（由 CarListReaderPlugin 注入，用于增量推送到 missav 端）。
     * storageManager 不关心回调内部做什么，只负责在 car_list 写入后触发。
     * @internal
     */
    carListChangeCallback?: (event: CarListChangeEvent) => void;

    constructor(forageInstance?: unknown) {
        if (StorageManager.instance) {
            throw new Error('StorageManager已被实例化过了!');
        }
        StorageManager.instance = this;
        this.forage =
            forageInstance ??
            localforage.createInstance({
                driver: localforage.INDEXEDDB,
                name: 'JAV-JHS',
                version: 1,
                storeName: 'appData'
            });
    }

    /**
     * 重置单例（仅限测试）。生产代码不应调用。
     * 允许测试创建新的 StorageManager 实例以隔离各用例。
     */
    static __resetForTesting(): void {
        StorageManager.instance = null;
    }

    /**
     * 注入 car_list 变更回调。
     * @param cb 回调函数，接收变更事件（upsert/delete + 受影响的记录/番号）
     */
    setCarListChangeCallback(cb: (event: CarListChangeEvent) => void): void {
        this.carListChangeCallback = cb;
    }

    /** 清空黑名单番号清单缓存，供跨标签页消息和数据迁移后刷新运行时数据。 */
    clearFilterActorActressCarListCache(): void {
        this.cache_filter_actor_actress_car_list = null;
    }

    /** 清空设置缓存，供跨标签页消息和设置保存后刷新运行时数据。 */
    clearSettingCache(): void {
        this.cacheSettingObj = null;
    }

    /** 清空番号清单缓存。 */
    clearCarListCache(): void {
        this.cacheCarList = null;
    }

    /** 清空收藏演员缓存。 */
    clearFavoriteActressListCache(): void {
        this.cacheFavoriteActressList = null;
    }

    // ===== 番号清单（委托至 storage/car-list-ops） =====

    /** 获取全部番号记录。 @returns carList（空时返回 []） */
    async getCarList(): Promise<CarRecord[]> { return getCarList(this); }

    /** 按番号查询单条记录。 @param carNum 番号 @returns 命中记录或 undefined */
    async getCar(carNum: string): Promise<CarRecord | undefined> { return getCar(this, carNum); }

    /**
     * 保存/更新单条番号记录到给定清单（同步，不落库）。
     * @param input 番号保存入参
     * @param list  目标清单（就地修改）
     */
    _saveSingleCar(input: CarSaveInput, list: CarRecord[]): void { saveSingleCar(input, list); }

    /** 保存单条番号并清理关联新作品。 */
    async saveCar(input: CarSaveInput): Promise<void> { return saveCar(this, input); }

    /** 更新已有番号记录信息。 */
    async updateCarInfo(input: CarSaveInput): Promise<void> { return updateCarInfo(this, input); }

    /** 批量保存番号记录。 */
    async saveCarList(inputs: CarSaveInput[]): Promise<void> { return saveCarList(this, inputs); }

    /** 删除单条番号记录。 */
    async removeCar(carNum: string): Promise<boolean> { return removeCar(this, carNum); }

    /** 批量删除番号记录。 */
    async batchRemoveCars(carNums: string[]): Promise<boolean | number> { return batchRemoveCars(this, carNums); }

    // ===== 黑名单演员（委托至 storage/blacklist-ops） =====

    /** 获取黑名单演员列表。 */
    async getBlacklist(): Promise<BlacklistItem[]> { return getBlacklist(this); }

    /** 新增或更新黑名单演员。 */
    async addBlacklistItem(item: BlacklistItem): Promise<void> { return addBlacklistItem(this, item); }

    /** 更新黑名单演员的检查/发布时间。 */
    async updateBlacklistItem(item: BlacklistItem): Promise<void> { return updateBlacklistItem(this, item); }

    /** 按 starId 删除黑名单演员。 */
    async deleteBlacklistItem(starId: string): Promise<void> { return deleteBlacklistItem(this, starId); }

    // ===== 黑名单番号清单（委托至 storage/blacklist-car-list-ops） =====

    /** 获取黑名单番号清单（带缓存）。 */
    async getBlacklistCarList(): Promise<CarRecord[]> { return getBlacklistCarList(this); }

    /** 批量保存黑名单番号清单。 */
    async batchSaveBlacklistCarList(inputs: CarSaveInput[]): Promise<void> { return batchSaveBlacklistCarList(this, inputs); }

    /** 按演员 starId 移除黑名单番号。 */
    async removeBlacklistCarList(starId: string): Promise<void> { return removeBlacklistCarList(this, starId); }

    // ===== 收藏演员（委托至 storage/favorite-actress-ops） =====

    /** 获取收藏演员列表。 */
    async getFavoriteActressList(): Promise<FavoriteActress[]> { return getFavoriteActressList(this); }

    /** 同步收藏演员，补全头像/类别并更正名字。 */
    async addFavoriteActressList(inputs: FavoriteActress[]): Promise<number> { return addFavoriteActressList(this, inputs); }

    /** 移除收藏演员。 */
    async removeFavoriteActress(starId: string): Promise<boolean> { return removeFavoriteActress(this, starId); }

    /** 更新收藏演员信息（仅更新提供的字段）。 */
    async updateFavoriteActress(item: FavoriteActress): Promise<boolean | void> { return updateFavoriteActress(this, item); }

    /** 从收藏演员的新作品列表中移除指定番号。 */
    async removeNewVideoList(carNums: string[]): Promise<void> { return removeNewVideoList(this, carNums); }

    // ===== 高亮标签 =====

    async getHighlightedTags(): Promise<string[]> {
        return (await this.forage.getItem(this.highlighted_tags_key)) || [];
    }

    async setHighlightedTags(tags: string[]): Promise<string[]> {
        return await this.forage.setItem(this.highlighted_tags_key, tags);
    }

    // ===== 过滤关键词（委托至 storage/keyword-ops） =====

    /** 保存标题过滤关键词，并清理命中前缀的关联新作品。 */
    async saveTitleFilterKeyword(keyword: string | string[]): Promise<void | null> { return saveTitleFilterKeyword(this, keyword); }

    /** 保存评论过滤关键词。 */
    async saveReviewFilterKeyword(keyword: string | string[]): Promise<string[]> { return saveReviewFilterKeyword(this, keyword); }

    /** 获取标题过滤关键词列表。 */
    async getTitleFilterKeyword(): Promise<string[]> { return getTitleFilterKeyword(this); }

    /** 获取评论过滤关键词列表。 */
    async getReviewFilterKeywordList(): Promise<string[]> { return getReviewFilterKeywordList(this); }

    // ===== 设置 =====

    /**
     * 读取设置项（带缓存）。
     * @param key          设置键（null 返回整个设置对象）
     * @param defaultValue 键不存在时的返回值
     * @returns 布尔/数值/原值，或 defaultValue
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 30+ callers across plugins rely on any return
    async getSetting(key: string | null = null, defaultValue?: any): Promise<any> {
        if (!this.cacheSettingObj) {
            this.cacheSettingObj = (await this.forage.getItem(this.setting_key)) || {};
        }
        const setting = featureFlags.storageCacheDeepCopy
            ? utils.copyObj(this.cacheSettingObj!)
            : this.cacheSettingObj!;
        if (key === null) {
            return setting;
        }
        const val = setting[key];
        if (val) {
            if (val === 'true' || val === 'false') {
                return val.toLowerCase() === 'true';
            } else if (typeof val != 'string' || val.trim() === '' || isNaN(Number(val))) {
                return val;
            } else {
                return Number(val);
            }
        } else {
            return defaultValue;
        }
    }

    /**
     * 保存整个设置对象并使缓存失效。
     * @param setting 设置对象（为空时提示错误）
     */
    async saveSetting(setting: Setting): Promise<void> {
        if (setting) {
            await this.forage.setItem(this.setting_key, setting);
            storageRevision.increment();
            window.clean_cacheSettingObj();
        } else {
            show.error('设置对象为空');
        }
    }

    /**
     * 保存单个设置项。
     * @param key   设置键
     * @param value 设置值
     */
    async saveSettingItem(key: string, value: unknown): Promise<void> {
        if (!key) {
            show.error('key 不能为空');
            return;
        }
        const setting = await this.getSetting();
        setting[key] = value;
        await this.saveSetting(setting);
        window.clean_cacheSettingObj();
    }

    // ===== 导入/导出 =====

    /**
     * 原子性导入数据：先写入临时实例，成功后再切换到主实例。
     * 任何步骤失败时主数据库保持不变，避免导入中途失败导致数据丢失。
     * @param data 键值对数据（备份 JSON 解析结果）
     * @throws 数据格式非法或写入/切换过程出错
     */
    async importData(data: Record<string, unknown>): Promise<void> {
        // 1. 验证备份数据格式：必须是普通对象、非 null、非数组
        if (
            typeof data !== 'object' ||
            data === null ||
            Array.isArray(data)
        ) {
            throw new Error('备份数据格式非法：必须是键值对对象');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- localforage global is untyped
        const tempInstance: any = localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: 'JAV-JHS',
            storeName: 'appData_import_staging'
        });

        try {
            const tasks: Promise<unknown>[] = [];
            for (const key in data) {
                tasks.push(tempInstance.setItem(key, data[key]));
            }
            await Promise.all(tasks);

            // 4. 暂存写入成功 → 清空主实例 → 将临时数据复制到主实例
            await tempInstance.iterate((value: unknown, key: string) => {
                return this.forage.setItem(key, value);
            });
            storageRevision.increment();

            // 5. 复制成功 → 清理临时实例
            await tempInstance.clear();
            await tempInstance.dropInstance();
        } catch (err) {
            // 6. 任何步骤失败 → 清理临时实例，主实例不变（或已被 clear 但属于极端情况）
            try {
                await tempInstance.clear();
                await tempInstance.dropInstance();
            } catch {
                // 清理失败不掩盖原始错误
            }
            throw err;
        }

        // 7. 导入成功 → 清理所有运行时缓存
        this.cacheCarList = null;
        this.cacheFavoriteActressList = null;
        this.cache_filter_actor_actress_car_list = null;
        this.cacheSettingObj = null;

        // 8. 对老备份数据执行迁移，确保结构升级到当前版本
        await this.runMigrations();
    }

    async exportData(): Promise<Record<string, unknown>> {
        const data: Record<string, unknown> = {};
        await this.forage.iterate((value: unknown, key: string) => {
            data[key] = value;
        });
        if (Object.keys(data).length === 0) {
            throw new Error('没有可导出的数据');
        }
        return data;
    }

    // ===== 数据结构迁移（委托至 storage/storage-migrations） =====

    /** 版本化数据迁移入口。 */
    async runMigrations(): Promise<void> { return runMigrations(this); }

    /** 清理无 url 的黑名单番号与冗余字段（key/recordTime→createTime）。 */
    async clean_no_url_blacklist(): Promise<void> { return clean_no_url_blacklist(this); }

    /** 清理设置中的冗余键（旧定时任务配置项与 downPath115）。 */
    async async_merge_other(): Promise<void> { return async_merge_other(this); }
}
