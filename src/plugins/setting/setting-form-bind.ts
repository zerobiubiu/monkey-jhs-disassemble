/**
 * 设置弹层事件绑定（提取自 setting-form-binder.ts）。
 *
 * bindClick：绑定设置弹层内各按钮/输入的点击/输入事件。
 * 需要插件状态的函数以 SettingPlugin 实例为首参。
 */
import { renderDiagnosticsText } from '../../core/plugin-diagnostics';

import type { SettingPlugin } from '../setting-plugin';
import {
    refreshAllCacheStats,
    refreshPreloadCacheStats,
    handleCleanCache,
    handleCleanAllCache,
    handleViewCache,
    handleExportCache
} from './cache-management';
import {
    importData,
    exportData,
    handleVltImportClick,
    handleVltFileChange,
    handleVltExportClick,
    handleMissavSync,
    handleMissavImportClick,
    handleMissavFileChange,
    handleMissavExportClick
} from './data-import-export';
import { backupDataByWebDav, backupListBtnByWebDav } from './webdav-operations';
import { saveForm } from './setting-form-load';

/** 绑定设置弹层内各按钮/输入的点击/输入事件。对应原 L10066-10131。 */
export function bindClick(plugin: SettingPlugin): void {
    $('.side-menu-item').on('click', function (this: HTMLElement) {
        $('.side-menu-item').removeClass('active');
        $(this).addClass('active');
        $('.content-panel').hide();
        const panelName = $(this).data('panel');
        $('#' + panelName).show();
        if (panelName === 'cache-panel') {
            $('#saveBtn').hide();
            $('#clean-all').show();
            refreshAllCacheStats(plugin);
        } else if (panelName === 'vlt-panel') {
            $('#saveBtn').hide();
            $('#clean-all').hide();
        } else if (panelName === 'missav-panel') {
            $('#saveBtn').hide();
            $('#clean-all').hide();
        } else if (panelName === 'preload-panel') {
            $('#saveBtn').show();
            $('#clean-all').hide();
            refreshPreloadCacheStats(plugin);
        } else if (panelName === 'diagnostics-panel') {
            $('#saveBtn').hide();
            $('#clean-all').hide();
            plugin.refreshDiagnostics();
        } else {
            $('#saveBtn').show();
            $('#clean-all').hide();
        }
    });
    $('#importBtn').on('click', () => importData(plugin));
    $('#exportBtn').on('click', () => exportData(plugin));
    $('#webdavBackupBtn').on('click', () => backupDataByWebDav(plugin));
    $('#webdavBackupListBtn').on('click', () => backupListBtnByWebDav(plugin));
    $('#saveBtn').on('click', () => saveForm(plugin));
    // ===== 插件诊断面板事件绑定 =====
    $('#copy-diagnostics-btn').on('click', () => {
        const text = renderDiagnosticsText(plugin.pluginManager);
        navigator.clipboard.writeText(text).then(
            () => show.ok('诊断报告已复制到剪贴板'),
            () => show.error('复制失败，请手动选择文本复制')
        );
    });
    $('#refresh-diagnostics-btn').on('click', () => {
        plugin.refreshDiagnostics();
        show.ok('诊断报告已刷新');
    });
    // ===== 缓存管理面板事件绑定 =====
    // 初始化总量显示
    refreshAllCacheStats(plugin);
    // 清理单个缓存
    $('.clean-btn').on('click', (event: Event) => handleCleanCache(plugin, event));
    // 全部清理
    $('#clean-all').on('click', () => handleCleanAllCache(plugin));
    // 查看缓存内容
    $('.view-btn').on('click', (event: Event) => handleViewCache(event));
    // 导出缓存为 JSON 文件
    $('.export-btn').on('click', (event: Event) => handleExportCache(plugin, event));
    const $tagNumber = $('#highlightedTagNumber');
    const $tagColor = $('#highlightedTagColor');
    const $tagLabel = $('#highlightedTagLabel');
    function updateBorder(): void {
        const number = $tagNumber.val();
        const color = $tagColor.val();
        $tagLabel.css('border', `${number}px solid ${color}`);
    }
    $tagNumber.on('input', updateBorder);
    $tagColor.on('input', updateBorder);

    // 收藏清单关系面板：导入/导出按钮
    $('#vlt-import-btn').on('click', () => handleVltImportClick());
    $('#vlt-file-input').on('change', (event: Event) => handleVltFileChange(event));
    $('#vlt-export-btn').on('click', () => handleVltExportClick());

    // MissAV 同步面板：立即同步 / 导入 / 导出按钮
    $('#missav-sync-btn').on('click', () => handleMissavSync());
    $('#missav-import-btn').on('click', () => handleMissavImportClick());
    $('#missav-file-input').on('change', (event: Event) => handleMissavFileChange(event));
    $('#missav-export-btn').on('click', () => handleMissavExportClick());
}
