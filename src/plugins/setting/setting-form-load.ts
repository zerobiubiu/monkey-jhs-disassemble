/**
 * 设置表单加载与保存（提取自 setting-form-binder.ts）。
 *
 * loadForm：从 storageManager 加载设置并回填到设置表单各输入项。
 * saveForm：保存设置表单到 storageManager 并刷新页面/相关插件。
 * 需要插件状态的函数以 SettingPlugin 实例为首参。
 */
import { YES, NO } from '../../constants/status';

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
import { refreshPreloadCacheStats } from './cache-management';

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
