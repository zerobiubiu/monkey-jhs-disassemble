/**
 * 存储管理模块（提取自 archetype/jhs.user.js L228-1080 `class z`）
 *
 * 基于 localforage（IndexedDB）封装，管理番号清单（carList）、黑名单演员
 * （blacklist）、黑名单番号清单（blacklistCarList）、收藏演员
 * （favoriteActresses）、高亮标签（highlightedTags）、标题/评论过滤关键词、
 * 以及全局设置（setting）。并提供数据结构迁移与导入/导出能力。
 *
 * 依赖（已由 src/types/globals.d.ts 声明为 any）：
 * - localforage：IndexedDB 封装库（@require 引入）；
 * - show / utils / clog：运行时全局；
 * - window.cleanCache_filter_actor_actress_car_list / clean_cacheSettingObj：
 *   由 legacy 启动逻辑挂载的缓存清理钩子。
 *
 * 仅 JS→TS 转换与命名优化，控制流与原脚本保持一致。
 */

import { ACTOR, ACTRESS, CENSORED, UNCENSORED } from '../constants/site';
import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../constants/status';
import { featureFlags } from './feature-flags';

/** 「已下载」状态兼容常量（原 g，已下载功能删除后保留以兼容历史数据） */
const HAS_DOWN_STATUS = 'hasDown';
/** 无码标签（原 addFavoriteActressList 内局部 d） */
const UNCENSORED_TAG = '(無碼)';

/** 番号记录（carList / blacklistCarList 通用） */
export interface CarRecord {
    carNum: string;
    url?: string;
    names?: string;
    status?: string;
    createDate?: string;
    updateDate?: string;
    publishTime?: string;
    starId?: string;
    score?: number;
    remark?: string;
    /** 旧字段，merge_tow_car_list_table 中迁移到 names */
    actress?: string;
    /** 旧字段，merge_blacklist 中删除 */
    type?: any;
    [key: string]: any;
}

/**
 * car_list 变更事件（由 carListChangeCallback 触发，供 CarListReaderPlugin 增量推送）。
 * - upsert：记录被新增或更新，upserts 为受影响的完整 CarRecord 数组
 * - delete：记录被删除，deletes 为被删除的番号数组
 */
export interface CarListChangeEvent {
    action: 'upsert' | 'delete';
    upserts?: CarRecord[];
    deletes?: string[];
}

/** 番号保存入参（_saveSingleCar / saveCar / saveCarList / updateCarInfo） */
export interface CarSaveInput {
    carNum: string;
    url?: string;
    names?: string;
    actionType?: string;
    publishTime?: string;
    starId?: string;
    score?: number;
    remark?: string;
    [key: string]: any;
}

/** 黑名单演员记录 */
export interface BlacklistItem {
    starId?: string;
    name?: string;
    allName?: string[];
    createTime?: string;
    role?: string;
    movieType?: string;
    url?: string;
    checkTime?: string;
    lastPublishTime?: string;
    /** 旧字段，merge_blacklist 中迁移到 role */
    isActor?: boolean;
    /** 旧字段，clean_no_url_blacklist 中迁移到 createTime */
    key?: any;
    /** 旧字段，clean_no_url_blacklist 中迁移到 createTime */
    recordTime?: any;
    [key: string]: any;
}

/** 收藏演员记录 */
export interface FavoriteActress {
    starId?: string;
    name: string;
    allName?: string[];
    avatar?: string;
    lastCheckTime?: string;
    lastPublishTime?: string;
    createDate?: string;
    updateDate?: string;
    actressType?: string;
    newVideoList?: string[];
    remark?: string;
    /** 旧字段，merge_favoriteActress 中迁移到 starId */
    dbId?: string;
    [key: string]: any;
}

/** 全局设置对象 */
export interface Setting {
    [key: string]: any;
}

/**
 * 备份可恢复的 IndexedDB 键。
 *
 * 这些键覆盖当前核心数据、历史迁移键以及由独立插件寄生到同一
 * `JAV-JHS/appData` 仓库中的数据。导入时拒绝未知键，避免把任意 JSON
 * 对象当作业务数据写入存储；新增插件使用新键时必须同步扩展此清单。
 */
const BACKUP_ARRAY_KEYS = new Set([
    'car_list',
    'blacklist',
    'blacklist_car_list',
    'favorite_actresses',
    'highlighted_tags',
    'filter_keyword_title',
    'filter_keyword_review',
    // 旧版本键（交给启动迁移逻辑继续处理）。
    'filter_actor_actress_info_list',
    'favorite_actresses_info_list',
    'car_list_filter_actor_actress',
    'title_filter_keyword',
    'review_filter_keyword',
    'highlightedTags'
]);

const BACKUP_OBJECT_KEYS = new Set([
    'setting',
    'listReadingStatus_data',
    'jhsRatingDisplay_data',
    'vlt_movies',
    'vlt_inventory',
    'vlt_movie_inventory',
    'vlt_meta'
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isKnownBackupKey(key: string): boolean {
    return BACKUP_ARRAY_KEYS.has(key) || BACKUP_OBJECT_KEYS.has(key);
}

function isValidBackupValue(key: string, value: unknown): boolean {
    if (BACKUP_ARRAY_KEYS.has(key)) return Array.isArray(value);
    if (key === 'setting') return isPlainRecord(value);
    if (BACKUP_OBJECT_KEYS.has(key)) return isPlainRecord(value) || Array.isArray(value);
    return false;
}

/** 比较 localForage 可序列化值；回滚时用它避免覆盖并发标签页的新写入。 */
function storageValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    try {
        return JSON.stringify(left) === JSON.stringify(right);
    } catch {
        return false;
    }
}

interface NavigatorWithOptionalLocks {
    locks?: {
        request<T>(
            name: string,
            options: { mode: 'exclusive' },
            callback: () => Promise<T>
        ): Promise<T>;
    };
}

const STORAGE_IMPORT_LOCK_NAME = 'jhs-storage-import';

/** 在支持 Web Locks 的浏览器中串行化跨标签页备份导入。 */
async function withStorageImportLock<T>(task: () => Promise<T>): Promise<T> {
    const browserNavigator =
        typeof navigator === 'undefined'
            ? undefined
            : (navigator as NavigatorWithOptionalLocks);
    if (!browserNavigator?.locks) return task();
    return browserNavigator.locks.request(
        STORAGE_IMPORT_LOCK_NAME,
        { mode: 'exclusive' },
        task
    );
}

/**
 * 校验并复制可导入的 IndexedDB 数据。
 *
 * 备份外层的 `__meta`/`__localStorage`/`__gmStorage` 必须由
 * `prepareBackupImport` 先剥离；StorageManager 本身不接受任何 `__*` 键。
 */
export function validateStorageImportData(data: unknown): Record<string, unknown> {
    if (!isPlainRecord(data)) {
        throw new Error('导入数据必须是普通对象');
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
        throw new Error('导入数据为空，已拒绝覆盖现有数据');
    }

    for (const [key, value] of entries) {
        if (key.startsWith('__')) {
            throw new Error(`导入数据包含未剥离的元字段：${key}`);
        }
        if (!isKnownBackupKey(key)) {
            throw new Error(`导入数据包含未知键：${key}`);
        }
        if (!isValidBackupValue(key, value)) {
            throw new Error(`导入数据字段格式无效：${key}`);
        }
    }

    return Object.fromEntries(entries);
}

export class StorageManager {
    /** 单例实例（原 n.instance） */
    private static instance: StorageManager | null = null;

    private readonly car_list_key = 'car_list';
    private readonly filter_keyword_title_key = 'filter_keyword_title';
    private readonly filter_keyword_review_key = 'filter_keyword_review';
    private readonly setting_key = 'setting';
    private readonly blacklist_key = 'blacklist';
    private readonly blacklist_car_list_key = 'blacklist_car_list';
    private readonly favorite_actresses_key = 'favorite_actresses';
    private readonly highlighted_tags_key = 'highlighted_tags';

    /** localforage 实例 */
    private readonly forage: any = localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: 'JAV-JHS',
        version: 1,
        storeName: 'appData'
    });

    /** 番号清单缓存（新版） */
    private cacheCarList: CarRecord[] | null = null;
    /** 收藏演员缓存（新版） */
    private cacheFavoriteActressList: FavoriteActress[] | null = null;
    /** 黑名单番号清单缓存 */
    private cache_filter_actor_actress_car_list: CarRecord[] | null = null;
    /** 设置对象缓存 */
    private cacheSettingObj: Setting | null = null;

    /**
     * car_list 变更回调（由 CarListReaderPlugin 注入，用于增量推送到 missav 端）。
     * storageManager 不关心回调内部做什么，只负责在 car_list 写入后触发。
     */
    private carListChangeCallback?: (event: CarListChangeEvent) => void;

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

    /** 清空所有运行时缓存，供全量导入完成或回滚后重新读取持久化数据。 */
    private clearRuntimeCaches(): void {
        this.clearCarListCache();
        this.clearFavoriteActressListCache();
        this.clearFilterActorActressCarListCache();
        this.clearSettingCache();
    }

    constructor() {
        if (StorageManager.instance) {
            throw new Error('StorageManager已被实例化过了!');
        }
        StorageManager.instance = this;
    }

    // ===== 番号清单 =====

    /** 获取全部番号记录。 @returns carList（空时返回 []） */
    async getCarList(): Promise<CarRecord[]> {
        if (featureFlags.storageCacheDeepCopy) {
            if (!this.cacheCarList) {
                this.cacheCarList = (await this.forage.getItem(this.car_list_key)) || [];
            }
            return utils.copyObj(this.cacheCarList);
        }
        return (await this.forage.getItem(this.car_list_key)) || [];
    }

    /**
     * 读取番号清单并保留“键不存在”和“明确为空”的区别。
     * 跨域全量同步只有在 exists=true 时才允许发布空快照，避免首次安装或导入中间态
     * 把 MissAV 端已有状态误判为权威空清单。
     */
    async getCarListSnapshot(): Promise<{ exists: boolean; records: CarRecord[] }> {
        const value = await this.forage.getItem(this.car_list_key);
        if (value === null || value === undefined) {
            return { exists: false, records: [] };
        }
        if (!Array.isArray(value)) {
            throw new Error('car_list 数据格式无效');
        }
        return { exists: true, records: value as CarRecord[] };
    }

    /** 按番号查询单条记录。 @param carNum 番号 @returns 命中记录或 undefined */
    async getCar(carNum: string): Promise<CarRecord | undefined> {
        const list = await this.getCarList();
        if (featureFlags.caseInsensitiveCarNum) {
            const lower = carNum.toLowerCase();
            return list.find((car) => car.carNum.toLowerCase() === lower);
        }
        return list.find((car) => car.carNum === carNum);
    }

    /**
     * 保存/更新单条番号记录到给定清单（同步，不落库）。
     * @param input 番号保存入参
     * @param list  目标清单（就地修改）
     * @throws carNum 为空 / url 为空 / 已在对应列表 / actionType 非法
     */
    _saveSingleCar(input: CarSaveInput, list: CarRecord[]): void {
        let { carNum, url, names, actionType, publishTime, starId, score } = input;
        if (!carNum) {
            show.error('番号为空!');
            throw new Error('番号为空!');
        }
        if (!url) {
            show.error('url为空!');
            throw new Error('url为空!');
        }
        if (!url.includes('http')) {
            url = window.location.origin + url;
        }
        if (names) {
            names = names.trim();
        }
        let car = featureFlags.caseInsensitiveCarNum
            ? list.find((item) => item.carNum.toLowerCase() === carNum.toLowerCase())
            : list.find((item) => item.carNum === carNum);
        if (car) {
            if (names) {
                car.names = names;
            }
            if (url) {
                car.url = url;
            }
            if (publishTime) {
                car.publishTime = publishTime;
            }
            if (score !== undefined) {
                car.score = score;
            }
            car.updateDate = utils.getNowStr();
        } else {
            const now = utils.getNowStr();
            car = {
                carNum,
                url,
                names,
                status: '',
                createDate: now,
                updateDate: now,
                publishTime
            };
            if (starId) {
                car.starId = starId;
            }
            if (score !== undefined) {
                car.score = score;
            }
            list.push(car);
        }
        switch (actionType) {
            case FILTER_ACTION:
                if (car.status === FILTER_ACTION) {
                    const msg = `${carNum} 已在屏蔽列表中`;
                    show.error(msg);
                    throw new Error(msg);
                }
                car.status = FILTER_ACTION;
                break;
            case FAVORITE_ACTION:
                if (car.status === FAVORITE_ACTION) {
                    const msg = `${carNum} 已在收藏列表中`;
                    show.error(msg);
                    throw new Error(msg);
                }
                car.status = FAVORITE_ACTION;
                break;
            case HAS_DOWN_STATUS:
                car.status = HAS_DOWN_STATUS;
                break;
            case HAS_WATCH_ACTION:
                car.status = HAS_WATCH_ACTION;
                break;
            default: {
                const msg = 'actionType错误, 请联系作者更正: ' + actionType;
                show.error(msg);
                throw new Error(msg);
            }
        }
    }

    /**
     * 保存单条番号并清理关联新作品。
     * @param input 番号保存入参
     * @throws 透传 _saveSingleCar
     */
    async saveCar(input: CarSaveInput): Promise<void> {
        const list: CarRecord[] = (await this.forage.getItem(this.car_list_key)) || [];
        this._saveSingleCar(input, list);
        await this.forage.setItem(this.car_list_key, list);
        this.cacheCarList = list;
        await this.removeNewVideoList([input.carNum]);
        // 增量通知：推送被修改的单条记录
        const car = featureFlags.caseInsensitiveCarNum
            ? list.find((c) => c.carNum.toLowerCase() === input.carNum.toLowerCase())
            : list.find((c) => c.carNum === input.carNum);
        if (car) this.carListChangeCallback?.({ action: 'upsert', upserts: [car] });
    }

    /**
     * 更新已有番号记录信息。
     * @param input 番号保存入参（使用 carNum 定位）
     * @throws 番号为空 / url 为空 / 数据不存在 / actionType 非法
     */
    async updateCarInfo(input: CarSaveInput): Promise<void> {
        let { carNum, url, names, actionType, remark } = input;
        if (!carNum) {
            show.error('番号为空!');
            throw new Error('番号为空!');
        }
        if (!url) {
            show.error('url为空!');
            throw new Error('url为空!');
        }
        if (names) {
            names = names.trim();
        }
        const list: CarRecord[] = (await this.forage.getItem(this.car_list_key)) || [];
        const car = list.find((item) => item.carNum === carNum);
        if (!car) {
            const msg = '数据不存在: ' + carNum;
            show.error(msg);
            throw new Error(msg);
        }
        car.names = names;
        car.url = url;
        car.remark = remark;
        car.updateDate = utils.getNowStr();
        switch (actionType) {
            case FAVORITE_ACTION:
                car.status = FAVORITE_ACTION;
                break;
            case HAS_WATCH_ACTION:
                car.status = HAS_WATCH_ACTION;
                break;
            default: {
                const msg = 'actionType错误, 请联系作者更正: ' + actionType;
                show.error(msg);
                throw new Error(msg);
            }
        }
        await this.forage.setItem(this.car_list_key, list);
        this.cacheCarList = list;
        // 增量通知：推送被更新的单条记录
        this.carListChangeCallback?.({ action: 'upsert', upserts: [car] });
    }

    /**
     * 批量保存番号记录。
     * @param inputs 番号保存入参列表
     * @throws 记录列表为空 / 透传 _saveSingleCar
     */
    async saveCarList(inputs: CarSaveInput[]): Promise<void> {
        if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
            show.error('记录列表为空!');
            throw new Error('记录列表为空!');
        }
        const list: CarRecord[] = (await this.forage.getItem(this.car_list_key)) || [];
        for (const item of inputs) {
            try {
                this._saveSingleCar(item, list);
            } catch (err) {
                throw err;
            }
        }
        await this.forage.setItem(this.car_list_key, list);
        this.cacheCarList = list;
        // 增量通知：推送所有被修改的记录
        const numSet = featureFlags.caseInsensitiveCarNum
            ? new Set(inputs.map((i) => i.carNum.toLowerCase()))
            : new Set(inputs.map((i) => i.carNum));
        const upserts = featureFlags.caseInsensitiveCarNum
            ? list.filter((c) => numSet.has(c.carNum.toLowerCase()))
            : list.filter((c) => numSet.has(c.carNum));
        if (upserts.length > 0) this.carListChangeCallback?.({ action: 'upsert', upserts });
    }

    /** 从收藏演员的新作品列表中移除指定番号。 @param carNums 待移除番号列表 */
    async removeNewVideoList(carNums: string[]): Promise<void> {
        const actressList = await this.getFavoriteActressList();
        let changed = false;
        const updated = actressList.map((actress) => {
            if (!actress.newVideoList || !Array.isArray(actress.newVideoList)) {
                return actress;
            }
            const filtered = actress.newVideoList.filter((carNum) => {
                const matched = carNums.includes(carNum);
                if (matched) {
                    clog.log('移除关联女优新作品', actress.name, carNum);
                    changed = true;
                }
                return !matched;
            });
            return { ...actress, newVideoList: filtered };
        });
        if (changed) {
            await this.forage.setItem(this.favorite_actresses_key, updated);
            this.clearFavoriteActressListCache();
        }
    }

    /**
     * 删除单条番号记录。
     * @param carNum 番号
     * @returns 成功 true；不存在 false
     */
    async removeCar(carNum: string): Promise<boolean> {
        const list = await this.getCarList();
        const beforeLen = list.length;
        const filtered = list.filter((item) => item.carNum !== carNum);
        if (filtered.length === beforeLen) {
            show.error(`${carNum} 不存在`);
            return false;
        } else {
            await this.forage.setItem(this.car_list_key, filtered);
            this.clearCarListCache();
            // 增量通知：推送被删除的番号
            this.carListChangeCallback?.({ action: 'delete', deletes: [carNum] });
            return true;
        }
    }

    /**
     * 批量删除番号记录。
     * @param carNums 待删除番号列表
     * @returns 删除条数（未删除返回 false）
     */
    async batchRemoveCars(carNums: string[]): Promise<boolean | number> {
        const list = await this.getCarList();
        const beforeLen = list.length;
        const numSet = new Set(carNums);
        const filtered = list.filter((item) => !numSet.has(item.carNum));
        const removed = beforeLen - filtered.length;
        if (removed === 0) return false;
        await this.forage.setItem(this.car_list_key, filtered);
        this.clearCarListCache();
        // 增量通知：推送被删除的番号
        this.carListChangeCallback?.({ action: 'delete', deletes: carNums });
        return removed;
    }

    // ===== 黑名单演员 =====

    /** 获取黑名单演员列表。 @returns blacklist（空时返回 []） */
    async getBlacklist(): Promise<BlacklistItem[]> {
        return (await this.forage.getItem(this.blacklist_key)) || [];
    }

    /**
     * 新增或更新黑名单演员。
     * @param item 黑名单演员入参
     * @throws 缺失 starId / name / role
     */
    async addBlacklistItem(item: BlacklistItem): Promise<void> {
        let { starId, name, allName, role, movieType, url } = item;
        if (!starId) {
            throw new Error('缺失starId');
        }
        if (!name) {
            throw new Error('缺失name');
        }
        if (!role) {
            throw new Error('缺失role');
        }
        const list = await this.getBlacklist();
        const existing = list.find((entry) => entry.starId === starId);
        if (existing) {
            existing.url = url;
            existing.role = role;
            existing.movieType = movieType;
            clog.log('更新黑名单演员信息', existing);
        } else {
            const created: BlacklistItem = {
                starId,
                name,
                allName: allName || [name],
                createTime: utils.getNowStr(),
                role,
                movieType,
                url
            };
            list.push(created);
            clog.log('增加黑名单演员信息', created);
        }
        await this.forage.setItem(this.blacklist_key, list);
    }

    /**
     * 更新黑名单演员的检查/发布时间。
     * @param item 含 starId 与可选 checkTime/lastPublishTime
     * @throws 参数不全 / 未找到演员
     */
    async updateBlacklistItem(item: BlacklistItem): Promise<void> {
        if (!item || !item.starId) {
            throw new Error('参数不全');
        }
        const list = await this.getBlacklist();
        const existing = list.find((entry) => entry.starId === item.starId);
        if (!existing) {
            throw new Error(`未找到黑名单演员信息:${item.name} ${item.starId}`);
        }
        if (item.checkTime) {
            existing.checkTime = item.checkTime;
        }
        if (item.lastPublishTime) {
            existing.lastPublishTime = item.lastPublishTime;
        }
        await this.forage.setItem(this.blacklist_key, list);
    }

    /** 按 starId 删除黑名单演员。 @param starId 演员 starId */
    async deleteBlacklistItem(starId: string): Promise<void> {
        const list = await this.getBlacklist();
        const filtered = list.filter((entry) => entry.starId !== starId);
        if (list.length !== filtered.length) {
            await this.forage.setItem(this.blacklist_key, filtered);
        }
    }

    // ===== 黑名单番号清单 =====

    /** 获取黑名单番号清单（带缓存，空数组也视为有效缓存）。 */
    async getBlacklistCarList(): Promise<CarRecord[]> {
        const cached = this.cache_filter_actor_actress_car_list;
        if (cached !== null) {
            if (featureFlags.storageCacheDeepCopy) {
                return utils.deepFreeze(utils.copyObj(cached));
            }
            return cached;
        }
        const fresh: CarRecord[] = (await this.forage.getItem(this.blacklist_car_list_key)) || [];
        this.cache_filter_actor_actress_car_list = fresh;
        if (featureFlags.storageCacheDeepCopy) {
            return utils.deepFreeze(utils.copyObj(fresh));
        }
        return fresh;
    }

    /**
     * 批量保存黑名单番号清单（去重后落库并清理关联新作品）。
     * @param inputs 番号保存入参列表
     * @throws 透传 _saveSingleCar
     */
    async batchSaveBlacklistCarList(inputs: CarSaveInput[]): Promise<void> {
        const list = await this.getBlacklistCarList();
        const cloned = JSON.parse(JSON.stringify(list));
        let changed = false;
        const newCarNums: string[] = [];
        for (const item of inputs) {
            if (!cloned.find((entry: CarRecord) => entry.carNum === item.carNum)) {
                this._saveSingleCar(item, cloned);
                clog.log(
                    `屏蔽演员番号: <span style="color: #f40">${item.names} ${item.carNum}</span>`
                );
                changed = true;
                newCarNums.push(item.carNum);
            }
        }
        if (changed) {
            await this.forage.setItem(this.blacklist_car_list_key, cloned);
            this.clearFilterActorActressCarListCache();
            await this.removeNewVideoList(newCarNums);
            (window as any).cleanCache_filter_actor_actress_car_list();
        }
    }

    /** 按演员 starId 移除黑名单番号。 @param starId 演员 starId */
    async removeBlacklistCarList(starId: string): Promise<void> {
        const list = await this.getBlacklistCarList();
        const filtered = list.filter((item) => item.starId !== starId);
        if (filtered.length !== list.length) {
            await this.forage.setItem(this.blacklist_car_list_key, filtered);
            this.clearFilterActorActressCarListCache();
            (window as any).cleanCache_filter_actor_actress_car_list();
        }
    }

    // ===== 收藏演员 =====

    /** 获取收藏演员列表。 @returns favoriteActresses（空时返回 []） */
    async getFavoriteActressList(): Promise<FavoriteActress[]> {
        if (featureFlags.storageCacheDeepCopy) {
            if (!this.cacheFavoriteActressList) {
                this.cacheFavoriteActressList =
                    (await this.forage.getItem(this.favorite_actresses_key)) || [];
            }
            return utils.copyObj(this.cacheFavoriteActressList);
        }
        return (await this.forage.getItem(this.favorite_actresses_key)) || [];
    }

    /**
     * 同步收藏演员，补全头像/类别并更正名字。
     * @param inputs 待同步演员列表
     * @returns 更新/新增条数
     * @throws 缺失 starId / name
     */
    async addFavoriteActressList(inputs: FavoriteActress[]): Promise<number> {
        const list = await this.getFavoriteActressList();
        let count = 0;
        for (const item of inputs) {
            let { starId, name, allName, avatar, lastCheckTime, lastPublishTime, actressType } =
                item;
            if (!starId) {
                throw new Error('缺失starId');
            }
            if (!name) {
                throw new Error('缺失name');
            }
            if (!allName) {
                allName = [name];
            }
            if (!actressType) {
                actressType =
                    name.includes(UNCENSORED_TAG) || allName.some((n) => n.includes(UNCENSORED_TAG))
                        ? UNCENSORED
                        : CENSORED;
            }
            name = name.replace(UNCENSORED_TAG, '');
            allName = allName.map((n) => n.replace(UNCENSORED_TAG, ''));
            const existing = list.find((entry) => entry.starId === starId);
            if (existing) {
                if (!existing.avatar || !existing.avatar.includes('https')) {
                    if (avatar) {
                        clog.log(avatar);
                        existing.avatar = avatar;
                        clog.log(`<span style="color: #f40">补全女优头像: ${name}</span>`);
                        count++;
                    }
                }
                if (!existing.actressType && actressType) {
                    existing.actressType = actressType;
                    clog.log(
                        `<span style="color: #f40">补全女优类别: ${name} ${actressType}</span>`
                    );
                    count++;
                }
                if (existing.name.includes(UNCENSORED_TAG)) {
                    existing.name = name;
                    existing.allName = allName;
                    clog.log(`<span style="color: #f40">更正女优名字: ${name} ${allName}</span>`);
                    count++;
                }
                continue;
            }
            const now = utils.getNowStr();
            list.push({
                starId,
                name,
                allName,
                avatar,
                lastCheckTime,
                lastPublishTime,
                createDate: now,
                updateDate: now,
                actressType
            });
            clog.log(`<span style="color: #f40">同步JavDB已收藏的演员: ${name}</span>`);
            count++;
        }
        if (count > 0) {
            await this.forage.setItem(this.favorite_actresses_key, list);
            this.clearFavoriteActressListCache();
        } else {
            clog.log('信息已记录, 无需要进行同步收藏的演员');
        }
        return count;
    }

    /**
     * 移除收藏演员。
     * @param starId 演员 starId
     * @returns 成功 true；不存在 false
     */
    async removeFavoriteActress(starId: string): Promise<boolean> {
        const list = await this.getFavoriteActressList();
        const beforeLen = list.length;
        const filtered = list.filter((entry) => entry.starId !== starId);
        if (filtered.length === beforeLen) {
            clog.error(`移除演员失败, ${starId} 不存在`);
            return false;
        } else {
            await this.forage.setItem(this.favorite_actresses_key, filtered);
            this.clearFavoriteActressListCache();
            return true;
        }
    }

    /**
     * 更新收藏演员信息（仅更新提供的字段）。
     * @param item 含 starId 及待更新字段
     * @returns false 表示未找到演员；否则更新落库后无返回
     * @throws 缺失 starId
     */
    async updateFavoriteActress(item: FavoriteActress): Promise<boolean | void> {
        const list = await this.getFavoriteActressList();
        const {
            starId,
            name,
            allName,
            avatar,
            lastCheckTime,
            newVideoList,
            lastPublishTime,
            actressType,
            remark
        } = item;
        if (!starId) {
            throw new Error('缺失starId');
        }
        const existing = list.find((entry) => entry.starId === starId);
        if (!existing) {
            clog.error('未找到演员信息', starId, name);
            return false;
        }
        if (name) {
            existing.name = name;
        }
        if (allName) {
            existing.allName = allName;
        }
        if (avatar) {
            existing.avatar = avatar;
        }
        if (actressType != null) {
            existing.actressType = actressType;
        }
        if (lastCheckTime) {
            existing.lastCheckTime = lastCheckTime;
        }
        if (newVideoList) {
            existing.newVideoList = newVideoList;
        }
        if (lastPublishTime) {
            existing.lastPublishTime = lastPublishTime;
        }
        if (remark) {
            existing.remark = remark;
        }
        existing.updateDate = utils.getNowStr();
        await this.forage.setItem(this.favorite_actresses_key, list);
        this.clearFavoriteActressListCache();
    }

    // ===== 高亮标签 =====

    /** 获取高亮标签列表。 @returns tags（空时返回 []） */
    async getHighlightedTags(): Promise<any[]> {
        return (await this.forage.getItem(this.highlighted_tags_key)) || [];
    }

    /** 设置高亮标签列表。 @param tags 标签列表 @returns forage.setItem 返回值 */
    async setHighlightedTags(tags: any[]): Promise<any> {
        return await this.forage.setItem(this.highlighted_tags_key, tags);
    }

    // ===== 过滤关键词 =====

    /**
     * 保存过滤关键词到指定键（私有辅助）。
     * @param keyword 单个关键词或整段替换列表
     * @param key     localforage 存储键
     * @param label   冲突提示用的标签名
     * @returns 保存后的列表
     * @throws 单个关键词已存在
     */
    async #saveKeyword(keyword: string | string[], key: string, label: string): Promise<string[]> {
        let list: string[];
        if (Array.isArray(keyword)) {
            list = [...keyword];
        } else {
            list = (await this.forage.getItem(key)) || [];
            if (list.includes(keyword)) {
                const msg = `${keyword} ${label}已存在`;
                show.error(msg);
                throw new Error(msg);
            }
            list.push(keyword);
        }
        await this.forage.setItem(key, list);
        return list;
    }

    /**
     * 保存标题过滤关键词，并清理命中前缀的关联新作品。
     * @param keyword 单个关键词或整段替换列表
     * @returns 列表入参时返回 null，否则无返回
     * @throws 透传 #saveKeyword
     */
    async saveTitleFilterKeyword(keyword: string | string[]): Promise<void | null> {
        await this.#saveKeyword(keyword, this.filter_keyword_title_key, '标题关键词');
        if (Array.isArray(keyword)) {
            return null;
        }
        const actressList = await this.getFavoriteActressList();
        let changed = false;
        const updated = actressList.map((actress) => {
            if (!actress.newVideoList || !Array.isArray(actress.newVideoList)) {
                return actress;
            }
            const filtered = actress.newVideoList.filter((carNum) => {
                const matched = carNum.startsWith(keyword);
                if (matched) {
                    clog.log('移除关联女优新作品', actress.name, carNum);
                    changed = true;
                }
                return !matched;
            });
            return { ...actress, newVideoList: filtered };
        });
        if (changed) {
            await this.forage.setItem(this.favorite_actresses_key, updated);
            this.clearFavoriteActressListCache();
        }
    }

    /**
     * 保存评论过滤关键词。
     * @param keyword 单个关键词或整段替换列表
     * @returns 保存后的列表
     * @throws 透传 #saveKeyword
     */
    async saveReviewFilterKeyword(keyword: string | string[]): Promise<string[]> {
        return this.#saveKeyword(keyword, this.filter_keyword_review_key, '评论关键词');
    }

    /** 获取标题过滤关键词列表。 @returns 列表（空时返回 []） */
    async getTitleFilterKeyword(): Promise<string[]> {
        return (await this.forage.getItem(this.filter_keyword_title_key)) || [];
    }

    /** 获取评论过滤关键词列表。 @returns 列表（空时返回 []） */
    async getReviewFilterKeywordList(): Promise<string[]> {
        return (await this.forage.getItem(this.filter_keyword_review_key)) || [];
    }

    // ===== 设置 =====

    /**
     * 读取设置项（带缓存）。
     * @param key          设置键（null 返回整个设置对象）
     * @param defaultValue 键不存在时的返回值
     * @returns 布尔/数值/原值，或 defaultValue
     */
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
            this.clearSettingCache();
            (window as any).clean_cacheSettingObj();
        } else {
            show.error('设置对象为空');
        }
    }

    /**
     * 保存单个设置项。
     * @param key   设置键
     * @param value 设置值
     */
    async saveSettingItem(key: string, value: any): Promise<void> {
        if (!key) {
            show.error('key 不能为空');
            return;
        }
        const setting = await this.getSetting();
        setting[key] = value;
        await this.saveSetting(setting);
        // saveSetting 已清理当前缓存；保留这里的显式调用，避免未来替换
        // saveSetting 实现时单项保存再次引入旧值读取。
        this.clearSettingCache();
        (window as any).clean_cacheSettingObj();
    }

    // ===== 导入/导出 =====

    /**
     * 以快照保护方式导入数据。
     *
     * 调用方负责在调用前剥离不属于 IndexedDB 的备份元字段；本方法会校验键和值
     * 的基本 schema，并在任一写入失败时恢复导入前快照，避免留下半份数据。
     * 只覆盖备份中明确出现的键，保留当前版本新增而旧备份未包含的键，避免旧备份
     * 导致新插件数据被误删。
     *
     * @param data 键值对数据
     */
    async importData(data: unknown): Promise<void> {
        const validatedData = validateStorageImportData(data);
        await withStorageImportLock(async () => {
            const snapshot = new Map<string, any>();
            await this.forage.iterate((value: any, key: string) => {
                snapshot.set(key, value);
            });

            const entries = Object.entries(validatedData);
            // 记录“尝试写入”的键，而不是在失败时恢复整个仓库。
            // 某个 setItem 可能在 reject 前已经落盘，因此失败键也要进入
            // 条件回滚；未被本次导入触及的键绝不能被回滚覆盖。
            const attemptedKeys = new Set<string>();
            try {
                // 只覆盖备份列出的键，不删除其它键，兼容旧备份与新插件数据。
                for (const [key, value] of entries) {
                    attemptedKeys.add(key);
                    await this.forage.setItem(key, value);
                }
            } catch (importError) {
                try {
                    // 逐键条件回滚：只有当前值仍等于本次导入值时才恢复。
                    // 若另一标签页已在导入期间写入同一键，则保留它的最新值，
                    // 避免“导入失败”反而吞掉并发的正常操作。
                    for (const [key, importedValue] of entries) {
                        if (!attemptedKeys.has(key)) continue;
                        const currentValue = await this.forage.getItem(key);
                        if (!storageValuesEqual(currentValue, importedValue)) continue;
                        if (snapshot.has(key)) {
                            await this.forage.setItem(key, snapshot.get(key));
                        } else {
                            await this.forage.removeItem(key);
                        }
                    }
                } catch (rollbackError) {
                    this.clearRuntimeCaches();
                    const importMessage =
                        importError instanceof Error ? importError.message : String(importError);
                    const rollbackMessage =
                        rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                    throw new Error(
                        `导入失败且原数据回滚失败（导入错误：${importMessage}；回滚错误：${rollbackMessage}）`
                    );
                }
                this.clearRuntimeCaches();
                throw importError;
            }
            this.clearRuntimeCaches();
        });
    }

    /** 导出全部数据。 @returns 键值对数据 @throws 没有可导出的数据 */
    async exportData(): Promise<Record<string, any>> {
        const data: Record<string, any> = {};
        await this.forage.iterate((value: any, key: string) => {
            data[key] = value;
        });
        if (Object.keys(data).length === 0) {
            throw new Error('没有可导出的数据');
        }
        return data;
    }

    // ===== 数据结构迁移 =====

    /** 迁移旧表名到新键名（一次性）。 */
    async merge_table_name(): Promise<void> {
        const mappings = [
            {
                oldKey: 'filter_actor_actress_info_list',
                newKey: this.blacklist_key,
                // blacklist 当前没有独立读取缓存；清理所有运行时快照可覆盖未来
                // 引入缓存的版本，避免旧键迁移后继续使用旧数据。
                clearCache: () => this.clearRuntimeCaches()
            },
            {
                oldKey: 'favorite_actresses_info_list',
                newKey: this.favorite_actresses_key,
                clearCache: () => this.clearFavoriteActressListCache()
            },
            {
                oldKey: 'car_list_filter_actor_actress',
                newKey: this.blacklist_car_list_key,
                clearCache: () => this.clearFilterActorActressCarListCache()
            },
            {
                oldKey: 'title_filter_keyword',
                newKey: this.filter_keyword_title_key
            },
            {
                oldKey: 'review_filter_keyword',
                newKey: this.filter_keyword_review_key
            },
            {
                oldKey: 'highlightedTags',
                newKey: this.highlighted_tags_key
            }
        ];

        for (const { oldKey, newKey, clearCache } of mappings) {
            const items = await this.forage.getItem(oldKey);
            if (items && items.length > 0) {
                const currentItems = await this.forage.getItem(newKey);
                // 新键一旦存在（包括显式空数组）即为权威数据，旧键不得覆盖或复活它。
                if (currentItems == null) {
                    console.log('更正', oldKey);
                    await this.forage.setItem(newKey, items);
                }
            }
            await this.forage.removeItem(oldKey);
            // 即使旧键为空或新键已存在，也让相关缓存失效；迁移可能由设置页
            // 手动触发，此时不能假设缓存尚未建立。
            clearCache?.();
        }
    }

    /** 清理无 url 的黑名单番号与冗余字段（key/recordTime→createTime）。 */
    async clean_no_url_blacklist(): Promise<void> {
        const [blacklistCars, blacklist] = await Promise.all([
            this.getBlacklistCarList(),
            this.getBlacklist()
        ]);
        // 无旧番号数据时不能据此删除演员黑名单；否则空番号表会误清整个 blacklist。
        if (blacklistCars.length === 0 || !blacklistCars[0].actress) {
            return;
        }
        const nameSet: Set<string | undefined> = new Set(blacklist.map((item) => item.name));
        const filteredCars = blacklistCars.filter(
            (item) => !item.actress || nameSet.has(item.actress)
        );
        if (blacklistCars.length !== filteredCars.length) {
            clog.debug('清理 blacklistCarList 前', blacklistCars.length);
            clog.debug('清理 blacklistCarList 后', filteredCars.length);
            await this.forage.setItem(this.blacklist_car_list_key, filteredCars);
            this.cache_filter_actor_actress_car_list = null;
        }
        const actressSet: Set<string | undefined> = new Set(
            filteredCars.map((item) => item.actress)
        );
        let cleanedBlacklist = blacklist.filter((item) => actressSet.has(item.name));
        cleanedBlacklist = cleanedBlacklist.map((item) => {
            const cleaned: BlacklistItem = { ...item };
            delete cleaned.key;
            delete cleaned.recordTime;
            if (item.recordTime !== undefined) {
                cleaned.createTime = item.recordTime;
            }
            return cleaned;
        });
        if (
            blacklist.length !== cleanedBlacklist.length ||
            blacklist.some((item) => 'key' in item || 'recordTime' in item)
        ) {
            clog.debug('清理 Blacklist 前', blacklist.length);
            clog.debug('清理 Blacklist 后', cleanedBlacklist.length);
            await this.forage.setItem(this.blacklist_key, cleanedBlacklist);
        }
    }

    /** 清理设置中的冗余键（旧定时任务配置项与 downPath115）。 */
    async async_merge_other(): Promise<void> {
        const setting = await this.getSetting();
        let changed = false;
        const deprecatedKeys = [
            'enableCheckFilterActorActress',
            'checkIntervalTime_filterActorActress',
            'checkIntervalTime_ruleTime',
            'checkIntervalTime_newVideo',
            'checkIntervalTime_favoriteActress',
            'checkFilterTime',
            'checkFilterConcurrencyCount',
            'checkFilterSleep',
            'enableCheckBlacklist',
            'checkBlacklist_intervalTime',
            'checkBlacklist_ruleTime',
            'enableCheckFavoriteActress',
            'checkFavoriteActress_IntervalTime',
            'enableCheckNewVideo',
            'checkNewVideo_intervalTime',
            'checkNewVideo_ruleTime',
            'checkConcurrencyCount',
            'checkRequestSleep'
        ];
        for (const key of deprecatedKeys) {
            if (Object.prototype.hasOwnProperty.call(setting, key)) {
                delete setting[key];
                changed = true;
            }
        }
        if (setting.downPath115) {
            delete setting.downPath115;
            changed = true;
        }
        if (changed) {
            await this.saveSetting(setting);
            clog.debug('配置数据已更正');
        }
    }

    /** 迁移黑名单数据结构（isActor→role、补全 starId/allName/movieType）。 */
    async merge_blacklist(): Promise<void> {
        const list = await this.getBlacklist();
        if (!list || list.length === 0) {
            return;
        }
        let changed = false;
        const merged = list.map((item) => {
            const mergedItem: BlacklistItem = { ...item };
            let itemChanged = false;
            if (Object.prototype.hasOwnProperty.call(mergedItem, 'isActor') && !mergedItem.role) {
                mergedItem.role = mergedItem.isActor ? ACTOR : ACTRESS;
                delete mergedItem.isActor;
                itemChanged = true;
            }
            if (!mergedItem.starId && mergedItem.url) {
                try {
                    const pathname = new URL(mergedItem.url).pathname;
                    const extracted = pathname
                        .split('/')
                        .filter((seg) => seg.trim() !== '')
                        .pop();
                    if (mergedItem.starId !== extracted) {
                        mergedItem.starId = extracted;
                        itemChanged = true;
                    }
                } catch (err) {
                    clog.error('提取url-starId发生错误', mergedItem.url, err);
                }
            }
            if (!mergedItem.allName) {
                mergedItem.allName = mergedItem.name ? [mergedItem.name] : [];
                itemChanged = true;
            }
            if (!mergedItem.movieType) {
                mergedItem.movieType = CENSORED;
                itemChanged = true;
            }
            if (mergedItem.url && mergedItem.url.includes('sort_type')) {
                try {
                    const urlObj = new URL(mergedItem.url);
                    urlObj.searchParams.delete('sort_type');
                    mergedItem.url = urlObj.toString();
                    itemChanged = true;
                    clog.debug('去除黑名单地址sort_type参数');
                } catch (err) {
                    clog.error('去除黑名单地址sort_type参数失败', mergedItem.url, err);
                }
            }
            if (itemChanged) {
                changed = true;
            }
            return mergedItem;
        });
        if (changed) {
            clog.debug('更正 Blacklist 数据结构');
            await this.forage.setItem(this.blacklist_key, merged);
        }
        const carList = await this.getBlacklistCarList();
        changed = false;
        const mergedCars = carList.map((item) => {
            const mergedItem: CarRecord = { ...item };
            if (!mergedItem.starId) {
                const match = merged.find((entry) => entry.name === mergedItem.actress);
                if (match) {
                    mergedItem.starId = match.starId;
                    changed = true;
                }
            }
            if (mergedItem.type) {
                delete mergedItem.type;
                changed = true;
            }
            return mergedItem;
        });
        if (changed) {
            clog.debug('更正 blacklistCarList 数据结构');
            await this.forage.setItem(this.blacklist_car_list_key, mergedCars);
            this.clearFilterActorActressCarListCache();
        }
    }

    /** 迁移收藏演员数据结构（dbId→starId）。 */
    async merge_favoriteActress(): Promise<void> {
        const list = await this.getFavoriteActressList();
        if (!list || list.length === 0) {
            return;
        }
        let changed = false;
        const merged = list.map((item) => {
            let itemChanged = false;
            if (item.dbId) {
                item.starId = item.dbId;
                delete item.dbId;
                itemChanged = true;
            }
            if (itemChanged) {
                changed = true;
            }
            return item;
        });
        if (changed) {
            clog.debug('更正 favoriteActressesInfoList 数据结构');
            await this.forage.setItem(this.favorite_actresses_key, merged);
            this.clearFavoriteActressListCache();
        }
    }

    /** 迁移两个番号清单的 actress→names 字段。 */
    async merge_tow_car_list_table(): Promise<void> {
        const blacklistCars = await this.getBlacklistCarList();
        const carList = await this.getCarList();
        let changed = false;
        const mergedBlacklistCars = blacklistCars.map((item) => {
            const mergedItem: CarRecord = { ...item };
            let itemChanged = false;
            if (mergedItem.actress !== undefined) {
                if (mergedItem.names === undefined) {
                    mergedItem.names = mergedItem.actress;
                }
                delete mergedItem.actress;
                itemChanged = true;
            }
            if (itemChanged) {
                changed = true;
            }
            return mergedItem;
        });
        if (changed) {
            clog.debug('更正 blacklistCarList 数据结构 actress->names');
            await this.forage.setItem(this.blacklist_car_list_key, mergedBlacklistCars);
            this.clearFilterActorActressCarListCache();
        }
        changed = false;
        const mergedCars = carList.map((item) => {
            const mergedItem: CarRecord = { ...item };
            let itemChanged = false;
            if (mergedItem.actress !== undefined) {
                if (mergedItem.names === undefined) {
                    mergedItem.names = mergedItem.actress;
                }
                delete mergedItem.actress;
                itemChanged = true;
            }
            if (itemChanged) {
                changed = true;
            }
            return mergedItem;
        });
        if (changed) {
            clog.debug('更正 carList 数据结构 actress->names');
            await this.forage.setItem(this.car_list_key, mergedCars);
            this.clearCarListCache();
        }
    }
}
