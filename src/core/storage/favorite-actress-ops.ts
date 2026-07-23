/**
 * 收藏演员操作（提取自 StorageManager）。
 *
 * 包含收藏演员的查询、同步、更新、移除与新作品清理：
 * getFavoriteActressList / addFavoriteActressList / updateFavoriteActress /
 * removeFavoriteActress / removeNewVideoList。所有函数以 StorageManager
 * 实例为首参。
 */

import { CENSORED, UNCENSORED } from '../../constants/site';

import { featureFlags } from '../feature-flags';
import { storageRevision } from '../storage-revision';
import type { StorageManager } from '../storage-manager';

import { logColoredHtml } from '../../components/log/log-colored';

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
    [key: string]: unknown;
}

/** 无码标签（原 addFavoriteActressList 内局部 d） */
const UNCENSORED_TAG = '(無碼)';

/** 获取收藏演员列表。 @returns favoriteActresses（空时返回 []） */
export async function getFavoriteActressList(sm: StorageManager): Promise<FavoriteActress[]> {
    if (featureFlags.storageCacheDeepCopy) {
        if (!sm.cacheFavoriteActressList) {
            sm.cacheFavoriteActressList =
                (await sm.forage.getItem(sm.favorite_actresses_key)) || [];
        }
        return utils.copyObj(sm.cacheFavoriteActressList ?? []);
    }
    return (await sm.forage.getItem(sm.favorite_actresses_key)) || [];
}

/**
 * 同步收藏演员，补全头像/类别并更正名字。
 * @param inputs 待同步演员列表
 * @returns 更新/新增条数
 * @throws 缺失 starId / name
 */
export async function addFavoriteActressList(sm: StorageManager, inputs: FavoriteActress[]): Promise<number> {
    const list = await getFavoriteActressList(sm);
    let count = 0;
    for (const item of inputs) {
        const { starId, avatar, lastCheckTime, lastPublishTime } = item;
        let { name, allName, actressType } = item;
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
                    clog.log(logColoredHtml(`补全女优头像: ${name}`));
                    count++;
                }
            }
            if (!existing.actressType && actressType) {
                existing.actressType = actressType;
                clog.log(
                    logColoredHtml(`补全女优类别: ${name} ${actressType}`)
                );
                count++;
            }
            if (existing.name.includes(UNCENSORED_TAG)) {
                existing.name = name;
                existing.allName = allName;
                clog.log(logColoredHtml(`更正女优名字: ${name} ${allName}`));
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
        clog.log(logColoredHtml(`同步JavDB已收藏的演员: ${name}`));
        count++;
    }
    if (count > 0) {
        await sm.forage.setItem(sm.favorite_actresses_key, list);
        storageRevision.increment();
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
export async function removeFavoriteActress(sm: StorageManager, starId: string): Promise<boolean> {
    const list = await getFavoriteActressList(sm);
    const beforeLen = list.length;
    const filtered = list.filter((entry) => entry.starId !== starId);
    if (filtered.length === beforeLen) {
        clog.error(`移除演员失败, ${starId} 不存在`);
        return false;
    } else {
        await sm.forage.setItem(sm.favorite_actresses_key, filtered);
        storageRevision.increment();
        sm.cacheFavoriteActressList = filtered;
        return true;
    }
}

/**
 * 更新收藏演员信息（仅更新提供的字段）。
 * @param item 含 starId 及待更新字段
 * @returns false 表示未找到演员；否则更新落库后无返回
 * @throws 缺失 starId
 */
export async function updateFavoriteActress(sm: StorageManager, item: FavoriteActress): Promise<boolean | void> {
    const list = await getFavoriteActressList(sm);
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
    await sm.forage.setItem(sm.favorite_actresses_key, list);
    storageRevision.increment();
}

/** 从收藏演员的新作品列表中移除指定番号。 @param carNums 待移除番号列表 */
export async function removeNewVideoList(sm: StorageManager, carNums: string[]): Promise<void> {
    const actressList = await getFavoriteActressList(sm);
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
        await sm.forage.setItem(sm.favorite_actresses_key, updated);
    }
}
