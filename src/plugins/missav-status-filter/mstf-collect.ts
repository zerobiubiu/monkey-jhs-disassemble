/**
 * MissAV 多栏筛选数据采集纯函数模块（状态 + MissAV 原生收藏 + JavDB 归属清单）。
 */
import { STATUS_CONFIG } from '../car-status-sync/car-status-config';

export const NO_TAG_VALUE = 'no-tag';
export const STATUS_ORDER = ['favorite', 'hasWatch', 'filter', 'hasDown'];

/** MissAV 原生收藏筛选值常量。 */
export const MISSAV_SAVED_VALUE = 'saved';
export const MISSAV_UNSAVED_VALUE = 'unsaved';

/** JavDB 归属清单筛选「无标签」值常量。 */
export const NO_VLT_TAG_VALUE = 'no-vlt-tag';

export function statusToLabel(status: string): string {
    return STATUS_CONFIG[status]?.label || status;
}

export function getItemStatus(item: Element): string | null {
    const tag = item.querySelector<HTMLElement>('.missav-status-tag');
    return tag?.dataset.status || null;
}

export function collectStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    let noTag = 0;
    document.querySelectorAll('.thumbnail.group').forEach((item) => {
        const status = getItemStatus(item);
        if (status) {
            const name = statusToLabel(status);
            counts[name] = (counts[name] || 0) + 1;
        } else {
            noTag++;
        }
    });
    if (noTag > 0) counts[NO_TAG_VALUE] = noTag;
    return counts;
}

/** 读取单张 MissAV 卡片的 MissAV 原生收藏态。 */
export function getItemMissavSaved(item: Element): boolean {
    const meta = item.querySelector<HTMLElement>('.jhs-missav-card-meta');
    if (meta?.dataset.missavSaved === 'yes') return true;
    if (meta?.dataset.missavSaved === 'no') return false;
    return item.querySelector('.jhs-missav-saved-badge') !== null;
}

/** 统计当前页面所有卡片的 MissAV 原生收藏与未收藏数量。 */
export function collectMissavSavedCounts(): { saved: number; unsaved: number } {
    let saved = 0;
    let unsaved = 0;
    document.querySelectorAll('.thumbnail.group').forEach((item) => {
        if (getItemMissavSaved(item)) saved++;
        else unsaved++;
    });
    return { saved, unsaved };
}

/** 读取单张 MissAV 卡片的 JavDB 归属清单名称列表（去重）。 */
export function getItemVltTags(item: Element): string[] {
    const tags: string[] = [];
    const seen = new Set<string>();
    item.querySelectorAll<HTMLElement>('.jhs-missav-vlt-tag').forEach((el) => {
        const name = (el.dataset.vltName || el.textContent || '').trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        tags.push(name);
    });
    return tags;
}

/** 统计当前页面所有卡片的 JavDB 归属清单出现次数与无清单卡片数。 */
export function collectVltTagCounts(): {
    counts: Record<string, number>;
    orderedNames: string[];
    noTagCount: number;
} {
    const counts: Record<string, number> = {};
    let noTagCount = 0;
    document.querySelectorAll('.thumbnail.group').forEach((item) => {
        const tags = getItemVltTags(item);
        if (tags.length === 0) {
            noTagCount++;
            return;
        }
        for (const name of tags) {
            counts[name] = (counts[name] || 0) + 1;
        }
    });
    const orderedNames = Object.keys(counts).sort((a, b) => {
        const diff = counts[b] - counts[a];
        return diff !== 0 ? diff : a.localeCompare(b, 'zh-CN');
    });
    return { counts, orderedNames, noTagCount };
}
