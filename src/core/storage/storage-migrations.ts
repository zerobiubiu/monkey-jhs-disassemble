/**
 * 数据结构迁移（提取自 StorageManager）。
 *
 * 包含版本化迁移入口 runMigrations 及 6 个迁移步骤：merge_table_name /
 * clean_no_url_blacklist / async_merge_other / merge_blacklist /
 * merge_favoriteActress / merge_tow_car_list_table。所有函数以
 * StorageManager 实例为首参。
 */

import { ACTOR, ACTRESS, CENSORED } from '../../constants/site';

import type { StorageManager } from '../storage-manager';

import type { CarRecord } from './car-list-ops';
import type { BlacklistItem } from './blacklist-ops';
import type { FavoriteActress } from './favorite-actress-ops';

/** 当前数据结构版本号。每次新增迁移步骤时递增。 */
export const CURRENT_SCHEMA_VERSION = 6;
export const SCHEMA_VERSION_KEY = '__jhs_schema_version';

/**
 * 版本化数据迁移入口（替代原 6 个独立迁移调用）。
 * 首次升级执行全部迁移；后续启动仅读取版本号（~1ms）。
 * 使用 navigator.locks 防止多标签页并发迁移。
 * 每步成功后才写入版本号；失败保留当前版本，下次启动重试。
 */
export async function runMigrations(sm: StorageManager): Promise<void> {
    const run = async (): Promise<void> => {
        let version: number =
            (await sm.forage.getItem(SCHEMA_VERSION_KEY)) ?? 0;
        if (version >= CURRENT_SCHEMA_VERSION) return;

        const steps: Array<{ target: number; fn: () => Promise<void> }> = [
            { target: 1, fn: () => merge_table_name(sm) },
            { target: 2, fn: () => clean_no_url_blacklist(sm) },
            { target: 3, fn: () => async_merge_other(sm) },
            { target: 4, fn: () => merge_blacklist(sm) },
            { target: 5, fn: () => merge_favoriteActress(sm) },
            { target: 6, fn: () => merge_tow_car_list_table(sm) }
        ];

        for (const step of steps) {
            if (version >= step.target) continue;
            try {
                await step.fn();
                await sm.forage.setItem(SCHEMA_VERSION_KEY, step.target);
                version = step.target;
            } catch (err) {
                clog.error(`数据迁移 ${version}→${step.target} 失败，下次启动重试`, err);
                break;
            }
        }

        // 迁移完成后统一清理受影响的缓存
        sm.cacheCarList = null;
        sm.cacheFavoriteActressList = null;
        sm.cache_filter_actor_actress_car_list = null;
        sm.cacheSettingObj = null;
    };

    if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request('jhs-storage-migration', { mode: 'exclusive' }, run);
    } else {
        await run();
    }
}

/** 迁移旧表名到新键名（一次性）。 */
export async function merge_table_name(sm: StorageManager): Promise<void> {
    let oldKey = 'filter_actor_actress_info_list';
    let items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.blacklist_key, items);
    }
    await sm.forage.removeItem(oldKey);
    oldKey = 'favorite_actresses_info_list';
    items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.favorite_actresses_key, items);
    }
    await sm.forage.removeItem(oldKey);
    oldKey = 'car_list_filter_actor_actress';
    items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.blacklist_car_list_key, items);
    }
    await sm.forage.removeItem(oldKey);
    oldKey = 'title_filter_keyword';
    items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.filter_keyword_title_key, items);
    }
    await sm.forage.removeItem(oldKey);
    oldKey = 'review_filter_keyword';
    items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.filter_keyword_review_key, items);
    }
    await sm.forage.removeItem(oldKey);
    oldKey = 'highlightedTags';
    items = (await sm.forage.getItem(oldKey)) || [];
    if (items && items.length > 0) {
        clog.debug('更正', oldKey);
        await sm.forage.setItem(sm.highlighted_tags_key, items);
    }
    await sm.forage.removeItem(oldKey);
}

/** 清理无 url 的黑名单番号与冗余字段（key/recordTime→createTime）。 */
export async function clean_no_url_blacklist(sm: StorageManager): Promise<void> {
    // 直接读取原始数据（绕过 deepFreeze，迁移需要修改记录）
    const [blacklistCars, blacklist] = await Promise.all([
        (sm.forage.getItem(sm.blacklist_car_list_key) as Promise<CarRecord[]>) || [],
        (sm.forage.getItem(sm.blacklist_key) as Promise<BlacklistItem[]>) || []
    ]);
    if (!blacklistCars.length && !blacklist.length) return;
    const nameSet: Set<string | undefined> = new Set(blacklist.map((item) => item.name));
    const filteredCars = blacklistCars.filter(
        (item) => !item.actress || nameSet.has(item.actress)
    );
    if (blacklistCars.length !== filteredCars.length) {
        clog.debug('清理 blacklistCarList 前', blacklistCars.length);
        clog.debug('清理 blacklistCarList 后', filteredCars.length);
        await sm.forage.setItem(sm.blacklist_car_list_key, filteredCars);
        sm.cache_filter_actor_actress_car_list = null;
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
            cleaned.createTime = item.recordTime as string;
        }
        return cleaned;
    });
    if (
        blacklist.length !== cleanedBlacklist.length ||
        blacklist.some((item) => 'key' in item || 'recordTime' in item)
    ) {
        clog.debug('清理 Blacklist 前', blacklist.length);
        clog.debug('清理 Blacklist 后', cleanedBlacklist.length);
        await sm.forage.setItem(sm.blacklist_key, cleanedBlacklist);
    }
}

/** 清理设置中的冗余键（旧定时任务配置项与 downPath115）。 */
export async function async_merge_other(sm: StorageManager): Promise<void> {
    const setting = await sm.getSetting();
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
        await sm.saveSetting(setting);
        clog.debug('配置数据已更正');
    }
}

/** 迁移黑名单数据结构（isActor→role、补全 starId/allName/movieType）。 */
export async function merge_blacklist(sm: StorageManager): Promise<void> {
    // 直接读取原始数据（绕过 deepFreeze，迁移需要修改记录）
    const list: BlacklistItem[] = (await sm.forage.getItem(sm.blacklist_key)) || [];
    if (!list.length) return;
    let changed = false;
    const merged = list.map((item) => {
        let itemChanged = false;
        if (Object.prototype.hasOwnProperty.call(item, 'isActor') && !item.role) {
            item.role = item.isActor ? ACTOR : ACTRESS;
            delete item.isActor;
            itemChanged = true;
        }
        if (!item.starId && item.url) {
            try {
                const pathname = new URL(item.url).pathname;
                const extracted = pathname
                    .split('/')
                    .filter((seg) => seg.trim() !== '')
                    .pop();
                if (item.starId !== extracted) {
                    item.starId = extracted;
                    itemChanged = true;
                }
            } catch (err) {
                clog.error('提取url-starId发生错误', item.url, err);
            }
        }
        if (!item.allName) {
            item.allName = item.name ? [item.name] : [];
            itemChanged = true;
        }
        if (!item.movieType) {
            item.movieType = CENSORED;
            itemChanged = true;
        }
        if (item.url && item.url.includes('sort_type')) {
            try {
                const urlObj = new URL(item.url);
                urlObj.searchParams.delete('sort_type');
                item.url = urlObj.toString();
                itemChanged = true;
                clog.debug('去除黑名单地址sort_type参数');
            } catch (err) {
                clog.error('去除黑名单地址sort_type参数失败', item.url, err);
            }
        }
        if (itemChanged) changed = true;
        return item;
    });
    if (changed) {
        clog.debug('更正 Blacklist 数据结构');
        await sm.forage.setItem(sm.blacklist_key, merged);
    }
    const carList: CarRecord[] = (await sm.forage.getItem(sm.blacklist_car_list_key)) || [];
    changed = false;
    const mergedCars = carList.map((item) => {
        if (!item.starId) {
            const match = list.find((entry) => entry.name === item.actress);
            if (match) item.starId = match.starId;
            changed = true;
        }
        if (item.type) {
            delete item.type;
            changed = true;
        }
        return item;
    });
    if (changed) {
        clog.debug('更正 blacklistCarList 数据结构');
        await sm.forage.setItem(sm.blacklist_car_list_key, mergedCars);
        sm.cache_filter_actor_actress_car_list = null;
    }
}

/** 迁移收藏演员数据结构（dbId→starId）。 */
export async function merge_favoriteActress(sm: StorageManager): Promise<void> {
    // 直接读取原始数据（绕过 deepFreeze，迁移需要修改记录）
    const list: FavoriteActress[] = (await sm.forage.getItem(sm.favorite_actresses_key)) || [];
    if (!list.length) return;
    let changed = false;
    const merged = list.map((item) => {
        if (item.dbId) {
            item.starId = item.dbId;
            delete item.dbId;
            changed = true;
        }
        return item;
    });
    if (changed) {
        clog.debug('更正 favoriteActressesInfoList 数据结构');
        await sm.forage.setItem(sm.favorite_actresses_key, merged);
        sm.cacheFavoriteActressList = null;
    }
}

/** 迁移两个番号清单的 actress→names 字段。 */
export async function merge_tow_car_list_table(sm: StorageManager): Promise<void> {
    // 直接读取原始数据（绕过 deepFreeze，迁移需要修改记录）
    const blacklistCars: CarRecord[] = (await sm.forage.getItem(sm.blacklist_car_list_key)) || [];
    const carList: CarRecord[] = (await sm.forage.getItem(sm.car_list_key)) || [];
    let changed = false;
    const mergedBlacklistCars = blacklistCars.map((item) => {
        if (item.actress !== undefined) {
            item.names = item.actress;
            delete item.actress;
            changed = true;
        }
        return item;
    });
    if (changed) {
        clog.debug('更正 blacklistCarList 数据结构 actress->names');
        await sm.forage.setItem(sm.blacklist_car_list_key, mergedBlacklistCars);
        sm.cache_filter_actor_actress_car_list = null;
    }
    changed = false;
    const mergedCars = carList.map((item) => {
        if (item.actress !== undefined) {
            item.names = item.actress;
            delete item.actress;
            changed = true;
        }
        return item;
    });
    if (changed) {
        clog.debug('更正 carList 数据结构 actress->names');
        await sm.forage.setItem(sm.car_list_key, mergedCars);
        sm.cacheCarList = null;
    }
}
