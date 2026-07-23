/**
 * 设置表单绑定操作（提取自 SettingPlugin）。
 *
 * 包含完整设置弹层的表单加载/保存、事件绑定编排，以及快捷设置
 * 面板的表单初始化。所有函数以 SettingPlugin 实例为首参。
 */
import { createElement } from 'react';

import { isJavdbSite } from '../../constants/site';
import { YES, NO } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';
import { renderDiagnosticsText } from '../../core/plugin-diagnostics';
import {
    getCredentialId,
    DEFAULT_AUTO_BACKUP_CONFIG,
    type AutoBackupConfig,
    type AutoBackupFrequency
} from '../../core/auto-backup';

import type { SettingPlugin } from '../setting-plugin';
import {
    GM_KEY_WEBDAV_URL,
    GM_KEY_WEBDAV_USERNAME,
    GM_KEY_WEBDAV_PASSWORD,
    GM_KEY_BACKUP_PASSWORD
} from './setting-keys';
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

import { HelpDialog } from '../../components/dialogs/help-dialog';
import { StyleBlock } from '../../components/misc/style-block';

import helpDialogCssRaw from '../../styles/help-dialog.css?raw';

/** 从 storageManager 加载设置并回填到设置表单各输入项。对应原 L9664-9747。 */
export async function loadForm(plugin: SettingPlugin): Promise<void> {
    const settings = await storageManager.getSetting();
    $('#videoQuality').val(settings.videoQuality);
    $('#reviewCount').val(settings.reviewCount || 20);
    $('#tagPosition').val(settings.tagPosition || 'rightTop');
    $('#movieShowType').val(settings.movieShowType || 'hide');
    $('#waitCheckCount').val(settings.waitCheckCount || 5);
    const tagNumber = settings.highlightedTagNumber || 1;
    const tagColor = settings.highlightedTagColor || '#ce2222';
    $('#highlightedTagNumber').val(settings.highlightedTagNumber || 1);
    $('#highlightedTagColor').val(settings.highlightedTagColor || '#ce2222');
    $('#highlightedTagLabel').css('border', `${tagNumber}px solid ${tagColor}`);
    $('#enableClog').val(settings.enableClog || YES);
    $('#clogMsgCount').val(settings.clogMsgCount || 2000);
    $('#httpTimeout').val(settings.httpTimeout || 5000);
    $('#httpRetryCount').val(settings.httpRetryCount || 3);
    // WebDAV 凭据：优先 GM 新格式，回退 settings 旧格式并迁移
    const webDavUrl = GM_getValue(GM_KEY_WEBDAV_URL, '') || settings.webDavUrl || '';
    const webDavUsername = GM_getValue(GM_KEY_WEBDAV_USERNAME, '') || settings.webDavUsername || '';
    const webDavPassword = GM_getValue(GM_KEY_WEBDAV_PASSWORD, '') || settings.webDavPassword || '';
    const backupPwd = GM_getValue(GM_KEY_BACKUP_PASSWORD, '') || settings.backupPassword || '';
    if (webDavUrl && !GM_getValue(GM_KEY_WEBDAV_URL, '')) GM_setValue(GM_KEY_WEBDAV_URL, webDavUrl);
    if (webDavUsername && !GM_getValue(GM_KEY_WEBDAV_USERNAME, ''))
        GM_setValue(GM_KEY_WEBDAV_USERNAME, webDavUsername);
    if (webDavPassword && !GM_getValue(GM_KEY_WEBDAV_PASSWORD, ''))
        GM_setValue(GM_KEY_WEBDAV_PASSWORD, webDavPassword);
    if (backupPwd && !GM_getValue(GM_KEY_BACKUP_PASSWORD, ''))
        GM_setValue(GM_KEY_BACKUP_PASSWORD, backupPwd);
    $('#webDavUrl').val(webDavUrl);
    $('#webDavUsername').val(webDavUsername);
    $('#webDavPassword').val(webDavPassword);
    $('#backupPassword').val(backupPwd);
    // 自动备份配置
    const autoBackupConfig: AutoBackupConfig =
        settings.autoBackupConfig || DEFAULT_AUTO_BACKUP_CONFIG;
    $('#enableAutoBackup').prop('checked', autoBackupConfig.enabled);
    $('#autoBackupFrequency').val(autoBackupConfig.frequency);
    // 本机凭证 ID（只读显示，不进入备份系统）
    $('#credentialIdDisplay').val(getCredentialId());
    $('#enableFavoriteActresses').prop(
        'checked',
        !settings.enableFavoriteActresses || settings.enableFavoriteActresses === YES
    );
    $('#enableSaveActressCarInfo').prop(
        'checked',
        !!settings.enableSaveActressCarInfo && settings.enableSaveActressCarInfo === YES
    );
    const otherSitePlugin = plugin.getBean('OtherSitePlugin');
    const missAvUrl = await otherSitePlugin.getMissAvUrl();
    const supJavUrl = await otherSitePlugin.getSupJavUrl();
    $('#missAvUrl').val(missAvUrl);
    $('#supJavUrl').val(supJavUrl);
    // 预加载配置（enablePreload/enablePreloadStatus 默认开启）
    $('#enablePreload').prop(
        'checked',
        !settings.enablePreload || settings.enablePreload === YES
    );
    $('#enablePreloadStatus').prop(
        'checked',
        !settings.enablePreloadStatus || settings.enablePreloadStatus === YES
    );
    $('#preloadDebounce').val(settings.preloadDebounce || 300);
    $('#preloadConcurrency').val(settings.preloadConcurrency || 1);
    $('#preloadCacheTTL').val(settings.preloadCacheTTL ?? 0);
    const enabledSites = otherSitePlugin.getEnabledSites();
    $('#preload-enable-missAvBtn').prop('checked', enabledSites.includes('missAvBtn'));
    $('#preload-enable-supJavBtn').prop('checked', enabledSites.includes('supJavBtn'));
    refreshPreloadCacheStats(plugin);
    const titleFilterKeyword = await storageManager.getTitleFilterKeyword();
    if (titleFilterKeyword) {
        titleFilterKeyword.forEach((keyword: string) => {
            plugin.addLabelTag('#filterKeywordContainer', keyword);
        });
    }
    $('#filterKeywordContainer .add-tag-btn').on('click', () =>
        plugin.addKeyword('#filterKeywordContainer')
    );
    $('#filterKeywordContainer .keyword-input').on('keypress', (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            plugin.addKeyword('#filterKeywordContainer');
        }
    });
}

/** 保存设置表单到 storageManager 并刷新页面/相关插件。对应原 L10132-10207。 */
export async function saveForm(plugin: SettingPlugin): Promise<void> {
    const settings = await storageManager.getSetting();
    settings.videoQuality = $('#videoQuality').val();
    settings.reviewCount = $('#reviewCount').val();
    settings.tagPosition = $('#tagPosition').val();
    settings.movieShowType = $('#movieShowType').val();
    settings.waitCheckCount = $('#waitCheckCount').val();
    settings.highlightedTagNumber = $('#highlightedTagNumber').val();
    settings.highlightedTagColor = $('#highlightedTagColor').val();
    settings.httpTimeout = $('#httpTimeout').val();
    settings.httpRetryCount = $('#httpRetryCount').val();
    settings.enableClog = $('#enableClog').val();
    if (settings.enableClog === YES) {
        clog.show();
    } else {
        clog.hide();
    }
    settings.clogMsgCount = $('#clogMsgCount').val();
    // WebDAV 凭据写入 GM 私有存储（不再存入 settings）
    GM_setValue(GM_KEY_WEBDAV_URL, $('#webDavUrl').val() || '');
    GM_setValue(GM_KEY_WEBDAV_USERNAME, $('#webDavUsername').val() || '');
    GM_setValue(GM_KEY_WEBDAV_PASSWORD, $('#webDavPassword').val() || '');
    GM_setValue(GM_KEY_BACKUP_PASSWORD, $('#backupPassword').val() || '');
    // 清除旧凭据字段（一次性迁移）
    delete settings.webDavUrl;
    delete settings.webDavUsername;
    delete settings.webDavPassword;
    // 自动备份配置（随备份文件保存）
    settings.autoBackupConfig = {
        enabled: $('#enableAutoBackup').is(':checked'),
        frequency: $('#autoBackupFrequency').val() as AutoBackupFrequency
    };
    settings.missAvUrl = String($('#missAvUrl').val() ?? '').replace(/\/$/, '');
    settings.supJavUrl = String($('#supJavUrl').val() ?? '').replace(/\/$/, '');
    // 预加载配置
    settings.enablePreload = $('#enablePreload').is(':checked') ? YES : NO;
    settings.enablePreloadStatus = $('#enablePreloadStatus').is(':checked') ? YES : NO;
    settings.preloadDebounce = $('#preloadDebounce').val();
    settings.preloadConcurrency = $('#preloadConcurrency').val();
    settings.preloadCacheTTL = $('#preloadCacheTTL').val();
    // 站点启用写入 jhs_enabled_sites（localStorage，非 settings 对象）
    const otherSitePluginForSave = plugin.getBean('OtherSitePlugin');
    const enabledSiteIds: string[] = [];
    if ($('#preload-enable-missAvBtn').is(':checked')) enabledSiteIds.push('missAvBtn');
    if ($('#preload-enable-supJavBtn').is(':checked')) enabledSiteIds.push('supJavBtn');
    otherSitePluginForSave.saveEnabledSites(enabledSiteIds);
    settings.enableFavoriteActresses = $('#enableFavoriteActresses').is(':checked') ? YES : NO;
    settings.enableSaveActressCarInfo = $('#enableSaveActressCarInfo').is(':checked') ? YES : NO;
    await storageManager.saveSetting(settings);
    const titleFilterKeywordList: string[] = [];
    $('#filterKeywordContainer .keyword-label')
        .toArray()
        .forEach((label: HTMLElement) => {
            const keyword = $(label)
                .text()
                .replace('×', '')
                .replace(/[\r\n]+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
            titleFilterKeywordList.push(keyword);
        });
    await storageManager.saveTitleFilterKeyword(titleFilterKeywordList);
    show.ok('保存成功');
    refresh();
    const newVideoPlugin = plugin.getBean('NewVideoPlugin');
    if (newVideoPlugin) {
        newVideoPlugin.resetBtnTip();
    }
    plugin.getBean('BlacklistPlugin').resetBtnTip();
    plugin.getBean('BlacklistPlugin').reloadTable();
}

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

/** 初始化简化设置面板表单（回填值 + 绑定即时生效的 change/input 事件）。对应原 L9807-10044。 */
export async function initSimpleSettingForm(plugin: SettingPlugin): Promise<void> {
    const settings = await storageManager.getSetting();
    const ns = '.jhsQs';
    $('#containerColumns').val(settings.containerColumns || 4);
    $('#showContainerColumns').text(settings.containerColumns || 4);
    $('#containerWidth').val((settings.containerWidth || 70) - 70);
    $('#showContainerWidth').text((settings.containerWidth || 70) + '%');
    $('#dialogOpenDetail').prop(
        'checked',
        !settings.dialogOpenDetail || settings.dialogOpenDetail === YES
    );
    $('#needClosePage').prop(
        'checked',
        !settings.needClosePage || settings.needClosePage === YES
    );
    const loadMode = settings.autoPageLoadMode === 'click' ? 'click' : 'auto';
    $('#autoPageLoadMode').attr('data-value', loadMode);
    $('#autoPageLoadMode .jhs-qs-seg-btn')
        .removeClass('is-active')
        .filter(`[data-value="${loadMode}"]`)
        .addClass('is-active');
    $('#translateTitle').prop(
        'checked',
        !settings.translateTitle || settings.translateTitle === YES
    );
    $('#enableLoadActressInfo').prop(
        'checked',
        !settings.enableLoadActressInfo || settings.enableLoadActressInfo === YES
    );
    $('#enableLoadOtherSite').prop(
        'checked',
        !settings.enableLoadOtherSite || settings.enableLoadOtherSite === YES
    );
    $('#containerColumns')
        .off(`input${ns}`)
        .on(`input${ns}`, async () => {
            const columns = $('#containerColumns').val();
            $('#showContainerColumns').text(String(columns ?? ''));
            if (isJavdbSite) {
                const movieListEl = document.querySelector('.movie-list') as HTMLElement | null;
                if (movieListEl)
                    movieListEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem('containerColumns', columns);
            plugin.applyImageMode();
        });
    $('#containerWidth')
        .off(`input${ns}`)
        .on(`input${ns}`, async (event: Event) => {
            const rangeValue = parseInt(String($(event.target).val()), 10) || 0;
            const widthPercent = rangeValue + 70 + '%';
            $('#showContainerWidth').text(widthPercent);
            if (isJavdbSite) {
                const containerEl = document.querySelector('section .container') as HTMLElement | null;
                if (containerEl) containerEl.style.minWidth = widthPercent;
            }
            storageManager.saveSettingItem('containerWidth', rangeValue + 70);
        });
    $('#dialogOpenDetail')
        .off(`change${ns}`)
        .on(`change${ns}`, () => {
            const value = $('#dialogOpenDetail').is(':checked') ? YES : NO;
            storageManager.saveSettingItem('dialogOpenDetail', value);
        });
    $('#showFilterItem').prop(
        'checked',
        !!settings.showFilterItem && settings.showFilterItem === YES
    );
    $('#showFilterActorItem').prop(
        'checked',
        !!settings.showFilterActorItem && settings.showFilterActorItem === YES
    );
    $('#showFilterKeywordItem').prop(
        'checked',
        !!settings.showFilterKeywordItem && settings.showFilterKeywordItem === YES
    );
    $('#showFavoriteItem').prop(
        'checked',
        !settings.showFavoriteItem || settings.showFavoriteItem === YES
    );
    $('#showHasWatchItem').prop(
        'checked',
        !settings.showHasWatchItem || settings.showHasWatchItem === YES
    );
    $('#showFilterItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterItem', value);
            refresh();
        });
    $('#showFilterActorItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterActorItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterActorItem', value);
            refresh();
        });
    $('#showFilterKeywordItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterKeywordItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterKeywordItem', value);
            refresh();
        });
    $('#showFavoriteItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFavoriteItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFavoriteItem', value);
            refresh();
        });
    $('#showHasWatchItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showHasWatchItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showHasWatchItem', value);
            refresh();
        });
    const $filterCheckboxes = $(
        '#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasWatchItem'
    );
    const updateDisabledState = () => {
        const isChecked = $('#showAllItem').is(':checked');
        $filterCheckboxes.prop('disabled', isChecked);
        if (isChecked) {
            $filterCheckboxes.attr('data-tip', '请先关闭显示所有才可点击');
            $('#jhs-qs-filter-group').addClass('is-disabled');
        } else {
            $filterCheckboxes.removeAttr('data-tip');
            $('#jhs-qs-filter-group').removeClass('is-disabled');
        }
    };
    $('#showAllItem').prop('checked', !!settings.showAllItem && settings.showAllItem === YES);
    $('#showAllItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showAllItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showAllItem', value);
            updateDisabledState();
            refresh();
        });
    updateDisabledState();
    $('#needClosePage')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            await storageManager.saveSettingItem(
                'needClosePage',
                $('#needClosePage').is(':checked') ? YES : NO
            );
            refresh();
        });
    $('#autoPageLoadMode')
        .off(`click${ns}`)
        .on(`click${ns}`, '.jhs-qs-seg-btn', async (event: Event) => {
            const value =
                $(event.currentTarget).attr('data-value') === 'click' ? 'click' : 'auto';
            const $seg = $('#autoPageLoadMode');
            if ($seg.attr('data-value') === value) return;
            $seg.attr('data-value', value);
            $seg.find('.jhs-qs-seg-btn').removeClass('is-active');
            $(event.currentTarget).addClass('is-active');
            await storageManager.saveSettingItem('autoPageLoadMode', value);
            const autoPagePlugin = plugin.getBean('AutoPagePlugin');
            autoPagePlugin?.setLoadMode?.(value);
            autoPagePlugin?.showLoadAllBtn?.();
        });
    $('#translateTitle')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#translateTitle').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('translateTitle', value);
            if (value === YES) {
                await plugin.getBean('ListPagePlugin').doFilter();
            } else {
                await plugin.getBean('ListPagePlugin').revertTranslation();
                $('.translated-title').remove();
            }
        });
    $('#enableLoadActressInfo')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#enableLoadActressInfo').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadActressInfo', value);
            if (value === YES) {
                plugin.getBean('ActressInfoPlugin').loadActressInfo();
            } else {
                $('.actress-info').remove();
            }
        });
    $('#enableLoadOtherSite')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#enableLoadOtherSite').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadOtherSite', value);
            if (value === YES) {
                plugin.getBean('OtherSitePlugin').loadOtherSite().then();
            } else {
                $('#otherSiteBox').remove();
            }
        });
    $('#moreBtn')
        .off(`click${ns}`)
        .on(`click${ns}`, () => {
            plugin.cancelSimpleSettingHide();
            $('.simple-setting, .mini-simple-setting').html('').hide();
            plugin.openSettingDialog('base-panel');
        });
    $('#helpBtn')
        .off(`click${ns}`)
        .on(`click${ns}`, () => {
            layer.open({
                type: 1,
                title: '',
                shadeClose: true,
                scrollbar: false,
                content:
                    jsxToString(createElement(StyleBlock, { css: helpDialogCssRaw })) +
                    jsxToString(createElement(HelpDialog, null)),
                area: utils.getResponsiveArea(['50%', '90%'])
            });
        });
}
