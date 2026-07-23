/**
 * 缓存管理操作（提取自 SettingPlugin）。
 *
 * 包含缓存统计计算、字节格式化、统计刷新，以及缓存清理/查看/导出
 * 的点击处理函数。需要插件状态的函数以 SettingPlugin 实例为首参。
 */
import { createElement } from 'react';

import { jsxToString } from '../../core/jsx-to-string';

import type { SettingPlugin } from '../setting-plugin';
import { downloadJson } from './data-import-export';

import { PreloadCacheStatsText } from '../../components/misc/preload-cache-stats-text';

/**
 * 计算指定 localStorage key 的缓存统计信息。
 * @param key localStorage 键名
 * @returns size 字节数；count 条目数（JSON 对象的 key 数或数组长度）
 */
export function getCacheStats(key: string): { size: number; count: number } {
    const raw = localStorage.getItem(key);
    if (!raw) return { size: 0, count: 0 };
    const size = new Blob([raw]).size;
    let count = 0;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            count = Object.keys(parsed).length;
        } else if (Array.isArray(parsed)) {
            count = parsed.length;
        }
    } catch {
        // 非 JSON，仅显示大小
    }
    return { size, count };
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
    const raw = localStorage.getItem('jhs_other_site');
    let missAv = 0;
    let supJav = 0;
    if (raw) {
        try {
            const cache = JSON.parse(raw);
            const keys = Object.keys(cache);
            missAv = keys.filter((k: string) => k.endsWith('_missAv')).length;
            supJav = keys.filter((k: string) => k.endsWith('_supJav')).length;
        } catch {
            /* 解析失败忽略 */
        }
    }
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
    localStorage.removeItem(cacheKey);
    // 联动清理 jhs_other_site_dmm（DMM 预览视频的伴生缓存）
    if (cacheKey === 'jhs_dmm_video') {
        localStorage.removeItem('jhs_other_site_dmm');
    }
    show.ok(`${cacheItem.text} 清理成功`);
    $('#cache-data-display').hide();
    refreshCacheStats(plugin, cacheKey);
    refreshAllCacheStats(plugin);
}

/** #clean-all 点击：清理全部缓存。 */
export function handleCleanAllCache(plugin: SettingPlugin): void {
    plugin.cacheItems.forEach((item) => localStorage.removeItem(item.key));
    localStorage.removeItem('jhs_other_site_dmm');
    show.ok('全部缓存已清理');
    $('#cache-data-display').hide();
    refreshAllCacheStats(plugin);
}

/** .view-btn 点击：查看缓存内容（JSON 格式化显示）。 */
export function handleViewCache(event: Event): void {
    const cacheKey = String($(event.currentTarget).data('key'));
    const cachedData = localStorage.getItem(cacheKey);
    const $display = $('#cache-data-display');
    const $pre = $display.find('pre');
    $display.show();
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            $pre.text(JSON.stringify(parsed, null, 2));
        } catch {
            $pre.text(cachedData);
        }
    } else {
        $pre.text('无数据');
    }
}

/** .export-btn 点击：导出缓存为 JSON 文件。 */
export function handleExportCache(plugin: SettingPlugin, event: Event): void {
    const cacheKey = String($(event.currentTarget).data('key'));
    const cachedData = localStorage.getItem(cacheKey);
    if (!cachedData) {
        show.error('缓存为空，无可导出数据');
        return;
    }
    const cacheItem = plugin.cacheItems.find((item) => item.key === cacheKey)!;
    downloadJson(cachedData, `${cacheKey}-${new Date().toISOString().split('T')[0]}.json`);
    show.ok(`${cacheItem.text} 已导出`);
}
