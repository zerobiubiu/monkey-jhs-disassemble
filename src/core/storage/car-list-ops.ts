/**
 * 番号清单操作（提取自 StorageManager）。
 *
 * 包含番号记录的增删改查：getCarList / getCar / saveCar / saveCarList /
 * updateCarInfo / removeCar / batchRemoveCars，以及内部同步写入辅助
 * saveSingleCar。所有函数以 StorageManager 实例为首参，通过其 @internal
 * 字段访问 forage / 缓存 / 回调。
 */

import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import { featureFlags } from '../feature-flags';
import { storageRevision } from '../storage-revision';
import { failWithToast } from '../toast';
import type { StorageManager } from '../storage-manager';

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
    type?: unknown;
    [key: string]: unknown;
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

/** 番号保存入参（saveSingleCar / saveCar / saveCarList / updateCarInfo） */
export interface CarSaveInput {
    carNum: string;
    url?: string;
    names?: string;
    actionType?: string;
    publishTime?: string;
    starId?: string;
    score?: number;
    remark?: string;
    [key: string]: unknown;
}

/** 「已下载」状态兼容常量（原 g，已下载功能删除后保留以兼容历史数据） */
const HAS_DOWN_STATUS = 'hasDown';

/**
 * 保存/更新单条番号记录到给定清单（同步，不落库）。
 * @param input 番号保存入参
 * @param list  目标清单（就地修改）
 * @throws carNum 为空 / url 为空 / 已在对应列表 / actionType 非法
 */
export function saveSingleCar(input: CarSaveInput, list: CarRecord[]): void {
    const { carNum, actionType, publishTime, starId, score } = input;
    let { url, names } = input;
    if (!carNum) {
        failWithToast('番号为空!');
    }
    if (!url) {
        failWithToast('url为空!');
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
                failWithToast(msg);
            }
            car.status = FILTER_ACTION;
            break;
        case FAVORITE_ACTION:
            if (car.status === FAVORITE_ACTION) {
                const msg = `${carNum} 已在收藏列表中`;
                failWithToast(msg);
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
            failWithToast(msg);
        }
    }
}

/** 获取全部番号记录。 @returns carList（空时返回 []） */
export async function getCarList(sm: StorageManager): Promise<CarRecord[]> {
    if (featureFlags.storageCacheDeepCopy) {
        if (!sm.cacheCarList) {
            sm.cacheCarList = (await sm.forage.getItem(sm.car_list_key)) || [];
        }
        return utils.copyObj(sm.cacheCarList ?? []);
    }
    return (await sm.forage.getItem(sm.car_list_key)) || [];
}

/** 按番号查询单条记录。 @param carNum 番号 @returns 命中记录或 undefined */
export async function getCar(sm: StorageManager, carNum: string): Promise<CarRecord | undefined> {
    const list = await getCarList(sm);
    if (featureFlags.caseInsensitiveCarNum) {
        const lower = carNum.toLowerCase();
        return list.find((car) => car.carNum.toLowerCase() === lower);
    }
    return list.find((car) => car.carNum === carNum);
}

/**
 * 保存单条番号并清理关联新作品。
 * @param input 番号保存入参
 * @throws 透传 saveSingleCar
 */
export async function saveCar(sm: StorageManager, input: CarSaveInput): Promise<void> {
    const list: CarRecord[] = (await sm.forage.getItem(sm.car_list_key)) || [];
    saveSingleCar(input, list);
    await sm.forage.setItem(sm.car_list_key, list);
    storageRevision.increment();
    sm.cacheCarList = list;
    await sm.removeNewVideoList([input.carNum]);
    // 增量通知：推送被修改的单条记录
    const car = featureFlags.caseInsensitiveCarNum
        ? list.find((c) => c.carNum.toLowerCase() === input.carNum.toLowerCase())
        : list.find((c) => c.carNum === input.carNum);
    if (car) sm.carListChangeCallback?.({ action: 'upsert', upserts: [car] });
}

/**
 * 更新已有番号记录信息。
 * @param input 番号保存入参（使用 carNum 定位）
 * @throws 番号为空 / url 为空 / 数据不存在 / actionType 非法
 */
export async function updateCarInfo(sm: StorageManager, input: CarSaveInput): Promise<void> {
    const { carNum, url, actionType, remark } = input;
    let { names } = input;
    if (!carNum) {
        failWithToast('番号为空!');
    }
    if (!url) {
        failWithToast('url为空!');
    }
    if (names) {
        names = names.trim();
    }
    const list: CarRecord[] = (await sm.forage.getItem(sm.car_list_key)) || [];
    const car = list.find((item) => item.carNum === carNum);
    if (!car) {
        const msg = '数据不存在: ' + carNum;
        failWithToast(msg);
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
            failWithToast(msg);
        }
    }
    await sm.forage.setItem(sm.car_list_key, list);
    storageRevision.increment();
    sm.cacheCarList = list;
    // 增量通知：推送被更新的单条记录
    sm.carListChangeCallback?.({ action: 'upsert', upserts: [car] });
}

/**
 * 批量保存番号记录。
 * @param inputs 番号保存入参列表
 * @throws 记录列表为空 / 透传 saveSingleCar
 */
export async function saveCarList(sm: StorageManager, inputs: CarSaveInput[]): Promise<void> {
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        failWithToast('记录列表为空!');
    }
    const list: CarRecord[] = (await sm.forage.getItem(sm.car_list_key)) || [];
    for (const item of inputs) {
        try {
            saveSingleCar(item, list);
        } catch (err) {
            throw err;
        }
    }
    await sm.forage.setItem(sm.car_list_key, list);
    storageRevision.increment();
    sm.cacheCarList = list;
    // 增量通知：推送所有被修改的记录
    const numSet = featureFlags.caseInsensitiveCarNum
        ? new Set(inputs.map((i) => i.carNum.toLowerCase()))
        : new Set(inputs.map((i) => i.carNum));
    const upserts = featureFlags.caseInsensitiveCarNum
        ? list.filter((c) => numSet.has(c.carNum.toLowerCase()))
        : list.filter((c) => numSet.has(c.carNum));
    if (upserts.length > 0) sm.carListChangeCallback?.({ action: 'upsert', upserts });
}

/**
 * 删除单条番号记录。
 * @param carNum 番号
 * @returns 成功 true；不存在 false
 */
export async function removeCar(sm: StorageManager, carNum: string): Promise<boolean> {
    const list = await getCarList(sm);
    const beforeLen = list.length;
    const filtered = list.filter((item) => item.carNum !== carNum);
    if (filtered.length === beforeLen) {
        show.error(`${carNum} 不存在`);
        return false;
    } else {
        await sm.forage.setItem(sm.car_list_key, filtered);
        storageRevision.increment();
        sm.cacheCarList = filtered;
        // 增量通知：推送被删除的番号
        sm.carListChangeCallback?.({ action: 'delete', deletes: [carNum] });
        return true;
    }
}

/**
 * 批量删除番号记录。
 * @param carNums 待删除番号列表
 * @returns 删除条数（未删除返回 false）
 */
export async function batchRemoveCars(sm: StorageManager, carNums: string[]): Promise<boolean | number> {
    const list = await getCarList(sm);
    const beforeLen = list.length;
    const numSet = new Set(carNums);
    const filtered = list.filter((item) => !numSet.has(item.carNum));
    const removed = beforeLen - filtered.length;
    if (removed === 0) return false;
    await sm.forage.setItem(sm.car_list_key, filtered);
    storageRevision.increment();
    sm.cacheCarList = filtered;
    // 增量通知：推送被删除的番号
    sm.carListChangeCallback?.({ action: 'delete', deletes: carNums });
    return removed;
}
