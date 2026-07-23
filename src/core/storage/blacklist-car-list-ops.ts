/**
 * 黑名单番号清单操作（提取自 StorageManager）。
 *
 * 包含黑名单番号的查询、批量保存与按演员移除：getBlacklistCarList /
 * batchSaveBlacklistCarList / removeBlacklistCarList。所有函数以
 * StorageManager 实例为首参。
 */

import { featureFlags } from '../feature-flags';
import { storageRevision } from '../storage-revision';
import type { StorageManager } from '../storage-manager';

import type { CarRecord, CarSaveInput } from './car-list-ops';
import { saveSingleCar } from './car-list-ops';

import { logColoredHtml } from '../../components/log/log-colored';

/** 获取黑名单番号清单（带缓存，命中非空缓存直接返回）。 */
export async function getBlacklistCarList(sm: StorageManager): Promise<CarRecord[]> {
    const cached = sm.cache_filter_actor_actress_car_list;
    if (cached && cached.length > 0) {
        if (featureFlags.storageCacheDeepCopy) {
            return utils.deepFreeze(utils.copyObj(cached));
        }
        return cached;
    }
    const fresh: CarRecord[] = (await sm.forage.getItem(sm.blacklist_car_list_key)) || [];
    sm.cache_filter_actor_actress_car_list = fresh;
    if (featureFlags.storageCacheDeepCopy) {
        return utils.deepFreeze(utils.copyObj(fresh));
    }
    return fresh;
}

/**
 * 批量保存黑名单番号清单（去重后落库并清理关联新作品）。
 * @param inputs 番号保存入参列表
 * @throws 透传 saveSingleCar
 */
export async function batchSaveBlacklistCarList(sm: StorageManager, inputs: CarSaveInput[]): Promise<void> {
    const list = await getBlacklistCarList(sm);
    const cloned = JSON.parse(JSON.stringify(list));
    let changed = false;
    const newCarNums: string[] = [];
    for (const item of inputs) {
        if (!cloned.find((entry: CarRecord) => entry.carNum === item.carNum)) {
            saveSingleCar(item, cloned);
            clog.log(
                '屏蔽演员番号: ' + logColoredHtml(`${item.names} ${item.carNum}`)
            );
            changed = true;
            newCarNums.push(item.carNum);
        }
    }
    if (changed) {
        await sm.forage.setItem(sm.blacklist_car_list_key, cloned);
        storageRevision.increment();
        await sm.removeNewVideoList(newCarNums);
        window.cleanCache_filter_actor_actress_car_list();
    }
}

/** 按演员 starId 移除黑名单番号。 @param starId 演员 starId */
export async function removeBlacklistCarList(sm: StorageManager, starId: string): Promise<void> {
    const list = await getBlacklistCarList(sm);
    const filtered = list.filter((item) => item.starId !== starId);
    if (filtered.length !== list.length) {
        await sm.forage.setItem(sm.blacklist_car_list_key, filtered);
        storageRevision.increment();
        window.cleanCache_filter_actor_actress_car_list();
    }
}
