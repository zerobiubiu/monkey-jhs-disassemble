/**
 * 过滤关键词操作（提取自 StorageManager）。
 *
 * 包含标题/评论过滤关键词的保存与查询：saveTitleFilterKeyword /
 * saveReviewFilterKeyword / getTitleFilterKeyword / getReviewFilterKeywordList，
 * 以及内部辅助 saveKeyword。所有函数以 StorageManager 实例为首参。
 */

import { storageRevision } from '../storage-revision';
import { failWithToast } from '../toast';
import type { StorageManager } from '../storage-manager';

import { getFavoriteActressList } from './favorite-actress-ops';

/**
 * 保存过滤关键词到指定键（内部辅助）。
 * @param keyword 单个关键词或整段替换列表
 * @param key     localforage 存储键
 * @param label   冲突提示用的标签名
 * @returns 保存后的列表
 * @throws 单个关键词已存在
 */
export async function saveKeyword(
    sm: StorageManager,
    keyword: string | string[],
    key: string,
    label: string
): Promise<string[]> {
    let list: string[];
    if (Array.isArray(keyword)) {
        list = [...keyword];
    } else {
        list = (await sm.forage.getItem(key)) || [];
        if (list.includes(keyword)) {
            const msg = `${keyword} ${label}已存在`;
            failWithToast(msg);
        }
        list.push(keyword);
    }
    await sm.forage.setItem(key, list);
    return list;
}

/**
 * 保存标题过滤关键词，并清理命中前缀的关联新作品。
 * @param keyword 单个关键词或整段替换列表
 * @returns 列表入参时返回 null，否则无返回
 * @throws 透传 saveKeyword
 */
export async function saveTitleFilterKeyword(
    sm: StorageManager,
    keyword: string | string[]
): Promise<void | null> {
    await saveKeyword(sm, keyword, sm.filter_keyword_title_key, '标题关键词');
    storageRevision.increment();
    if (Array.isArray(keyword)) {
        return null;
    }
    const actressList = await getFavoriteActressList(sm);
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
        await sm.forage.setItem(sm.favorite_actresses_key, updated);
    }
}

/**
 * 保存评论过滤关键词。
 * @param keyword 单个关键词或整段替换列表
 * @returns 保存后的列表
 * @throws 透传 saveKeyword
 */
export async function saveReviewFilterKeyword(
    sm: StorageManager,
    keyword: string | string[]
): Promise<string[]> {
    return saveKeyword(sm, keyword, sm.filter_keyword_review_key, '评论关键词');
}

/** 获取标题过滤关键词列表。 @returns 列表（空时返回 []） */
export async function getTitleFilterKeyword(sm: StorageManager): Promise<string[]> {
    return (await sm.forage.getItem(sm.filter_keyword_title_key)) || [];
}

/** 获取评论过滤关键词列表。 @returns 列表（空时返回 []） */
export async function getReviewFilterKeywordList(sm: StorageManager): Promise<string[]> {
    return (await sm.forage.getItem(sm.filter_keyword_review_key)) || [];
}
