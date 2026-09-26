/**
 * 缓存管理操作（提取自 SettingPlugin）。
 *
 * 包含缓存统计计算、字节格式化、统计刷新，以及缓存清理/查看/导出
 * 的点击处理函数。需要插件状态的函数以 SettingPlugin 实例为首参。
 */
import { createElement } from 'react';

import { jsxToString } from '../../core/jsx-to-string';
import {
    clearPersistentNamespace,
    readPersistentMap,
    type PersistentNamespace
} from '../../core/storage/persistent-data-store';

import { RatingCache } from '../rating-display/rating-cache';
import type { SettingPlugin } from '../setting-plugin';
import { downloadJson } from './data-import-export';

import { q } from '../../core/util/util-popup';

import { PreloadCacheStatsText } from '../../components/misc/preload-cache-stats-text';

const CACHE_NAMESPACE_BY_KEY: Partial<Record<string, PersistentNamespace>> = {
    jhs_dmm_video: 'dmmVideo',
    jhs_other_site: 'otherSite',
    jhs_other_site_dmm: 'otherSiteDmm',
    jhs_translate: 'translate',
    jhs_actress_info: 'actressInfo',
    jhs_score_info: 'scoreInfo',
    jhs_screenShot: 'screenShot',
    jhs_visit_history: 'visitHistory'
};

function readCacheValue(key: string): Record<string, unknown> | null {
    if (key === 'jdb:rating_cache_v2' && Object.keys(RatingCache._data).length > 0) {
        return RatingCache._data as Record<string, unknown>;
    }
    const namespace = CACHE_NAMESPACE_BY_KEY[key];
    if (namespace) return readPersistentMap<unknown>(namespace, key);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/** 计算指定缓存 key 的统计信息，数据源可能是 IndexedDB 或旧 localStorage。 */
export function getCacheStats(key: string): { size: number; count: number } {
    const value = readCacheValue(key);
    if (!value) return { size: 0, count: 0 };
    const size = new Blob([JSON.stringify(value)]).size;
    return { size, count: Array.isArray(value) ? value.length : Object.keys(value).length };
}

/**
 * 格式化字节数为人类可读字符串。
 * @param bytes 字节数
 * @returns 如 "0 B" / "1.2 KB" / "3.4 MB"
 */
export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 刷新单个缓存项的统计信息（大小 + 条目数）。
 * @param _plugin 插件实例（保留首参约定，当前未使用）
 * @param cacheKey localStorage 键名
 */
export function refreshCacheStats(_plugin: SettingPlugin, cacheKey: string): void {
    const stats = getCacheStats(cacheKey);
    const $item = $(`.cache-item[data-cache-key="${cacheKey}"]`);
    $item.find('.cache-size').text(formatSize(stats.size));
    $item.find('.cache-count').text(stats.count > 0 ? `${stats.count} 条` : '空');
}

/**
 * 刷新所有缓存项的统计信息 + 总占用大小。
 */
export function refreshAllCacheStats(plugin: SettingPlugin): void {
    let totalSize = 0;
    for (const item of plugin.cacheItems) {
        const stats = getCacheStats(item.key);
        totalSize += stats.size;
        const $item = $(`.cache-item[data-cache-key="${item.key}"]`);
        $item.find('.cache-size').text(formatSize(stats.size));
        $item.find('.cache-count').text(stats.count > 0 ? `${stats.count} 条` : '空');
    }
    // 联动缓存 jhs_other_site_dmm 的体积也计入总量
    totalSize += getCacheStats('jhs_other_site_dmm').size;
    $('#cache-total-size').text(`总占用 ${formatSize(totalSize)}`);
}

/**
 * 刷新预加载配置面板的缓存状态显示（jhs_other_site 总数 + MissAv/SupJav 分站计数 + 占用）。
 * 与「缓存管理」面板的「第三方站点缓存」为同一缓存，此处仅展示统计，清理见缓存管理面板。
 */
export function refreshPreloadCacheStats(_plugin: SettingPlugin): void {
    const stats = getCacheStats('jhs_other_site');
    const cache = readCacheValue('jhs_other_site') ?? {};
    const keys = Object.keys(cache);
    const missAv = keys.filter((key: string) => key.endsWith('_missAv')).length;
    const supJav = keys.filter((key: string) => key.endsWith('_supJav')).length;
    $('#preload-cache-stats').html(
        jsxToString(
            createElement(PreloadCacheStatsText, {
                count: stats.count,
                missAv,
                supJav,
                size: formatSize(stats.size)
            })
        )
    );
}

// ===== 缓存管理面板点击处理 =====

/** .clean-btn 点击：清理单个缓存（含 DMM 伴生缓存联动清理）。 */
export function handleCleanCache(plugin: SettingPlugin, event: Event): void {
    const cacheKey = String($(event.currentTarget).data('key'));
    const cacheItem = plugin.cacheItems.find((item) => item.key === cacheKey)!;
    const namespace = CACHE_NAMESPACE_BY_KEY[cacheKey];
    if (cacheKey === 'jdb:rating_cache_v2') RatingCache.clear();
    else if (namespace) clearPersistentNamespace(namespace, cacheKey);
    else localStorage.removeItem(cacheKey);
    // 联动清理 jhs_other_site_dmm（DMM 预览视频的伴生缓存）
    if (cacheKey === 'jhs_dmm_video') {
        clearPersistentNamespace('otherSiteDmm', 'jhs_other_site_dmm');
    }
    show.ok(`${cacheItem.text} 清理成功`);
    $('#cache-data-display').hide();
    refreshCacheStats(plugin, cacheKey);
    refreshAllCacheStats(plugin);
}

/**
 * #clean-all 点击：确认后清理全部缓存。
 *
 * doc/248 harden：原实现直接清空全部缓存且无确认、无撤销——评分缓存需重新发起
 * 大量请求重建，外站预加载缓存在 v1.46.6 取消上限后可能已积累到很大规模。
 * 现改用项目既有的 `q()` 确认框（core/util/util-popup.ts，与其它破坏性操作一致），
 * 并在文案中给出受影响条目与总体积，让用户在确认前看得到代价。
 */
export function handleCleanAllCache(plugin: SettingPlugin): void {
    let totalSize = 0;
    let totalCount = 0;
    for (const item of plugin.cacheItems) {
        const stats = getCacheStats(item.key);
        totalSize += stats.size;
        totalCount += stats.count;
    }
    totalSize += getCacheStats('jhs_other_site_dmm').size;

    q(
        null,
        `将清空 <b>${plugin.cacheItems.length}</b> 项缓存（共 <b>${totalCount}</b> 条，约 ${formatSize(totalSize)}）。<br>` +
            '评分缓存清空后需重新获取；外站预加载缓存清空后对应影片需重新探测。<br>' +
            '<b>此操作不可撤销。</b>',
        () => {
            plugin.cacheItems.forEach((item) => {
                const namespace = CACHE_NAMESPACE_BY_KEY[item.key];
                if (item.key === 'jdb:rating_cache_v2') RatingCache.clear();
                else if (namespace) clearPersistentNamespace(namespace, item.key);
                else localStorage.removeItem(item.key);
            });
            clearPersistentNamespace('otherSiteDmm', 'jhs_other_site_dmm');
            show.ok('全部缓存已清理');
            $('#cache-data-display').hide();
            refreshAllCacheStats(plugin);
        }
    );
}

/** .view-btn 点击：查看缓存内容（JSON 格式化显示）。 */
export function handleViewCache(event: Event): void {
    const cacheKey = String($(event.currentTarget).data('key'));
    const cachedData = readCacheValue(cacheKey);
    const $display = $('#cache-data-display');
    const $pre = $display.find('pre');
    $display.show();
    $pre.text(cachedData ? JSON.stringify(cachedData, null, 2) : '无数据');
}

/** .export-btn 点击：导出缓存为 JSON 文件。 */
export function handleExportCache(plugin: SettingPlugin, event: Event): void {
    const cacheKey = String($(event.currentTarget).data('key'));
    const cachedData = readCacheValue(cacheKey);
    if (!cachedData) {
        show.error('缓存为空，无可导出数据');
        return;
    }
    const cacheItem = plugin.cacheItems.find((item) => item.key === cacheKey)!;
    downloadJson(JSON.stringify(cachedData), `${cacheKey}-${new Date().toISOString().split('T')[0]}.json`);
    show.ok(`${cacheItem.text} 已导出`);
}
