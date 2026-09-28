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
import { bindFavSyncPanel } from './jhs-sync/fav-sync-bind';
import { backupDataByWebDav, backupListBtnByWebDav } from './webdav-operations';
import { backupDataByGit, backupListBtnByGit } from './git-operations';
import { cancelOpSync, retryFailedOpSync, retryOpSync } from '../list-page/lp-batch-sync';
import { clearOpSyncTerminal, getOpSyncRecord, type OpSyncKind } from './jhs-sync/op-sync-records';
import { saveForm } from './setting-form-load';

/** 绑定设置弹层内各按钮/输入的点击/输入事件。对应原 L10066-10131。 */
export function bindClick(plugin: SettingPlugin): void {
    $('.side-menu-item').on('click', function (this: HTMLElement) {
        $('.side-menu-item').removeClass('active');
        $(this).addClass('active');
        $('.content-panel').hide();
        const panelName = $(this).data('panel');
        $('#' + panelName).show();
        // doc/249：底栏只保留「保存设置」，但它并非每个面板都适用。
        // 「清理全部缓存」已移回 cache-panel 面板内部，不再参与这里的显隐切换。
        if (panelName === 'cache-panel') {
            $('#saveBtn').hide();
            refreshAllCacheStats(plugin);
        } else if (panelName === 'vlt-panel') {
            // doc/207：清单管理器现有配置项需保存→显示 saveBtn；导入导出按钮独立保留
            $('#saveBtn').show();
        } else if (panelName === 'missav-panel') {
            $('#saveBtn').hide();
        } else if (panelName === 'fav-sync-panel') {
            $('#saveBtn').hide();
        } else if (panelName === 'preload-panel') {
            $('#saveBtn').show();
            refreshPreloadCacheStats(plugin);
        } else if (panelName === 'diagnostics-panel') {
            $('#saveBtn').hide();
            plugin.refreshDiagnostics();
        } else if (panelName === 'op-sync-panel') {
            $('#saveBtn').hide();
            plugin.refreshOpSync();
        } else {
            $('#saveBtn').show();
        }
    });
    // ===== 侧栏键盘导航（doc/248 audit）=====
    // 侧栏项已改为 role=tab 的 <button>，Tab 能进入；此处补齐方向键切换。
    // 与 click 共用同一套切换逻辑（触发 click 而不是重写一遍）。
    $('.side-menu-item').on('keydown', function (this: HTMLElement, event: KeyboardEvent) {
        const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const $items = $('.side-menu-item');
        const index = $items.index(this);
        let next = index;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % $items.length;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + $items.length) % $items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = $items.length - 1;
        const $next = $items.eq(next);
        $items.attr('tabindex', '-1');
        $next.attr('tabindex', '0');
        $next.trigger('focus').trigger('click');
    });
    $('#importBtn').on('click', () => importData(plugin));
    $('#exportBtn').on('click', () => exportData(plugin));
    $('#webdavBackupBtn').on('click', () => backupDataByWebDav(plugin));
    $('#webdavBackupListBtn').on('click', () => backupListBtnByWebDav(plugin));
    $('#gitBackupBtn').on('click', () => backupDataByGit(plugin));
    $('#gitBackupListBtn').on('click', () => backupListBtnByGit(plugin));
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
    // ===== 操作同步面板事件绑定（doc/38）=====
    $('#op-sync-refresh-btn').on('click', () => {
        plugin.refreshOpSync();
        show.ok('同步状态已刷新');
    });
    $('#op-sync-retry-all-btn').on('click', () => {
        const queued = retryFailedOpSync();
        plugin.refreshOpSync();
        if (queued > 0) show.ok(`已重新入队 ${queued} 条`);
        else show.info('没有可重试的失败记录');
    });
    $('#op-sync-clear-btn').on('click', () => {
        const removed = clearOpSyncTerminal();
        plugin.refreshOpSync();
        show.ok(removed > 0 ? `已清理 ${removed} 条已结束记录` : '没有已结束的记录');
    });
    // 行内操作（重试 / 取消）：委托到面板内容区，避免逐行绑定
    $('#op-sync-content').on('click', '.op-sync-action', function (this: HTMLElement) {
        const $row = $(this).closest('tr');
        const carNum = String($row.data('carnum') ?? '');
        const kind = String($row.data('kind') ?? '');
        const act = String($(this).data('act') ?? '');
        if (!carNum || !kind) return;
        handleOpSyncRowAction(plugin, carNum, kind as OpSyncKind, act);
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
    // 收藏同步面板（doc/214：独立页 + 引擎驱动）
    bindFavSyncPanel();

    // MissAV 同步面板：立即同步 / 导入 / 导出按钮
    $('#missav-sync-btn').on('click', () => handleMissavSync());
    $('#missav-import-btn').on('click', () => handleMissavImportClick());
    $('#missav-file-input').on('change', (event: Event) => handleMissavFileChange(event));
    $('#missav-export-btn').on('click', () => handleMissavExportClick());
}

/**
 * 处理「操作同步」面板的行内操作（doc/38）。
 *
 * - `retry`：按记录重新入队后台推送（走与批量操作同一条路径）；
 * - `cancel`：从内存队列移除并置 `cancelled`（**不回滚**本地 car_list 状态）。
 *
 * @param plugin 设置插件实例（用于刷新面板）
 * @param carNum 番号
 * @param kind 操作类型
 * @param act 动作（`retry` | `cancel`）
 */
function handleOpSyncRowAction(
    plugin: SettingPlugin,
    carNum: string,
    kind: OpSyncKind,
    act: string
): void {
    if (act === 'cancel') {
        cancelOpSync(carNum, kind);
        plugin.refreshOpSync();
        show.ok(`${carNum} 已取消同步（本地状态保留）`);
        return;
    }
    const record = getOpSyncRecord(carNum, kind);
    if (!record) {
        plugin.refreshOpSync();
        return;
    }
    const queued = retryOpSync(record);
    plugin.refreshOpSync();
    if (queued) show.ok(`${carNum} 已重新入队同步`);
    else show.error(`${carNum} 无法重试：缺少可定位的详情页地址`);
}
