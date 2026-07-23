/**
 * 黑名单演员操作（提取自 StorageManager）。
 *
 * 包含黑名单演员的增删改查：getBlacklist / addBlacklistItem /
 * updateBlacklistItem / deleteBlacklistItem。所有函数以 StorageManager
 * 实例为首参，通过其 @internal 字段访问 forage。
 */

import { storageRevision } from '../storage-revision';
import type { StorageManager } from '../storage-manager';

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
    key?: unknown;
    /** 旧字段，clean_no_url_blacklist 中迁移到 createTime */
    recordTime?: unknown;
    [key: string]: unknown;
}

/** 获取黑名单演员列表。 @returns blacklist（空时返回 []） */
export async function getBlacklist(sm: StorageManager): Promise<BlacklistItem[]> {
    return (await sm.forage.getItem(sm.blacklist_key)) || [];
}

/**
 * 新增或更新黑名单演员。
 * @param item 黑名单演员入参
 * @throws 缺失 starId / name / role
 */
export async function addBlacklistItem(sm: StorageManager, item: BlacklistItem): Promise<void> {
    const { starId, name, allName, role, movieType, url } = item;
    if (!starId) {
        throw new Error('缺失starId');
    }
    if (!name) {
        throw new Error('缺失name');
    }
    if (!role) {
        throw new Error('缺失role');
    }
    const list = await getBlacklist(sm);
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
    await sm.forage.setItem(sm.blacklist_key, list);
    storageRevision.increment();
}

/**
 * 更新黑名单演员的检查/发布时间。
 * @param item 含 starId 与可选 checkTime/lastPublishTime
 * @throws 参数不全 / 未找到演员
 */
export async function updateBlacklistItem(sm: StorageManager, item: BlacklistItem): Promise<void> {
    if (!item || !item.starId) {
        throw new Error('参数不全');
    }
    const list = await getBlacklist(sm);
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
    await sm.forage.setItem(sm.blacklist_key, list);
    storageRevision.increment();
}

/** 按 starId 删除黑名单演员。 @param starId 演员 starId */
export async function deleteBlacklistItem(sm: StorageManager, starId: string): Promise<void> {
    const list = await getBlacklist(sm);
    const filtered = list.filter((entry) => entry.starId !== starId);
    if (list.length !== filtered.length) {
        await sm.forage.setItem(sm.blacklist_key, filtered);
        storageRevision.increment();
    }
}
