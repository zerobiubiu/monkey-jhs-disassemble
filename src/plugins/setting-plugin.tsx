/**
 * 设置插件 SettingPlugin —— 对应原脚本 archetype/jhs.user.js L9429-10564。
 *
 * 全局设置入口：注入设置按钮（JavDb 顶栏下拉 / 详情页 h3 前），
 * 悬浮显示简化设置面板（显示已鉴定/收藏/已观看、弹窗打开、瀑布流、翻译、悬浮大图、
 * 115 匹配、女优信息、第三方资源、长缩略图、更高画质预览、竖图模式、页面列数/宽度），
 * 点击打开完整设置弹层（数据备份 / 基础配置 / 外部网站 / 缓存管理等）；
 * 提供本地导入导出、WebDav 云备份/查看/下载/导入、缓存清理与查看、回到顶部按钮。
 *
 * JS→TS 改造要点：
 * - 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/d/h/g/p 等）已语义化命名。
 * - 站点布尔 r 改由 ../constants/site 引入（isJavdbSite）；
 *   状态文本 m/v/k 与布尔标识 _/C 改由 ../constants/status 引入
 *   （BLOCK_TEXT/FAVORITE_TEXT/WATCHED_TEXT/YES/NO）；
 *   画质列表 L 改由 ../constants/video-quality 引入（VIDEO_QUALITY_LIST）。
 * - 原顶层 ImageHoverPreview 改用 ../core/image-preview 的 ImagePreview（同名重构）。
 * - window.isDetailPage 为运行时挂载全局，以 (window as any).isDetailPage 访问；
 *   window.refresh() 以全局 refresh() 调用（src/types/globals.d.ts 已声明）；
 *   window.imageHoverPreviewObj 以 (window as any).imageHoverPreviewObj 访问。
 * - WebDav 加密/解密/客户端（原 Me/Ne/De）已提取至 core/webdav-crypto
 *   （encryptCredential/decryptCredential）与 core/webdav（WebDavClient），
 *   经 (window as any).encryptCredential / .decryptCredential / .WebDavClient 访问。
 * - 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 *   改为 class 字段语法（useDefineForClassFields:true，语义一致）。
 * - $ / layer / utils / storageManager / show / clog / Tabulator / loading 已由
 *   ../types/globals.d.ts 声明为 any；jQuery .each 回调按本仓库既有约定改写为
 *   (_index, element) 箭头形式，规避 noImplicitThis；
 *   .side-menu-item 点击保留 function(this: any) 以维持 $(this) 语义。
 * - any 类型 callee（$/layer/Tabulator/utils/gmHttp 等）的回调参数显式标注 : any
 *   以规避 noImplicitAny；未使用的回调参数加 _ 前缀豁免 noUnusedParameters。
 * - catch (e) → catch (err: any)（strict useUnknownInCatchVariables）。
 * - 内联 HTML/CSS 已提取为组件/CSS：设置挂载容器/回到顶部按钮/关键词标签/简化设置面板/
 *   缓存项/画质选项 → 组件，回到顶部 CSS 与竖图/横图 CSS → src/styles/*.css + ?raw。
 *   layer 弹窗 content 由 SettingDialog/HelpDialog/BackupFileDialog 组件返回 JSX，
 *   经 jsxToString 转为 HTML 字符串（doc/21）。
 * - 控制流（分支、try/catch/finally、fire-and-forget .then()、loopDetector、
 *   requestAnimationFrame 滚动监听、FileReader 异步链）与原脚本一致。
 */
import { isJavdbSite } from '../constants/site';
import { YES, NO } from '../constants/status';
import { VIDEO_QUALITY_LIST } from '../constants/video-quality';
import { BasePlugin } from './base-plugin';

import settingCssRaw from '../styles/setting-plugin.css?raw';
import helpDialogCssRaw from '../styles/help-dialog.css?raw';
import backToTopCssRaw from '../styles/back-to-top-button.css?raw';

import horizontalImgCssRaw from '../styles/setting-image-mode-horizontal.css?raw';
import { jsxToString } from '../core/jsx-to-string';
import { SettingDialog } from '../components/setting-dialog';
import { HelpDialog } from '../components/help-dialog';
import { BackupFileDialog } from '../components/backup-file-dialog';
import { BackToTopButton } from '../components/back-to-top-button';
import { CacheItemHtml } from '../components/cache-item-html';
import { SettingMountBox } from '../components/setting-mount-box';
import { SimpleSettingPanel } from '../components/simple-setting-panel';
import { VideoQualityOption } from '../components/video-quality-option';
import { KeywordLabel } from '../components/keyword-label';
import { VltDb, type MigrationData } from './video-lists-tag/vlt-db';
import { showToast } from './video-lists-tag/vlt-toast';
import { GM_KEY_CAR_STATUS_DATA } from './car-status-sync/car-status-config';
import {
    toColumnar,
    gzipToBase64,
    countColumnar,
    columnarToFlat,
    buildJavdbUrl
} from './car-status-sync/car-status-columnar';
import { importLocalDB, exportLocalDB } from './car-status-sync/car-status-db';
import {
    getCredentialId,
    DEFAULT_AUTO_BACKUP_CONFIG,
    shouldAutoBackup,
    getAutoBackupFileName,
    markAutoBackupDone,
    type AutoBackupConfig,
    type AutoBackupFrequency
} from '../core/auto-backup';
import {
    collectLocalStorageBackup,
    collectGmStorageBackup,
    applyBackupExtras
} from '../core/backup-extra-storage';

/** 缓存项配置（localStorage 键 + 展示文本 + 说明）。 */
interface CacheItem {
    key: string;
    text: string;
    title: string;
}

/**
 * 计算指定 localStorage key 的缓存统计信息。
 * @param key localStorage 键名
 * @returns size 字节数；count 条目数（JSON 对象的 key 数或数组长度）
 */
function getCacheStats(key: string): { size: number; count: number } {
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
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class SettingPlugin extends BasePlugin {
    /** WebDav 备份目录名。对应原 L9432。 */
    folderName = 'JHS-数据备份';

    /** 可管理的缓存项清单。对应原 L9433-9464（已删除 jhs_screenShot 死 key）。 */
    cacheItems: CacheItem[] = [
        {
            key: 'jhs_dmm_video',
            text: '🎥 预览视频缓存',
            title: 'DMM 预告片画质→URL 映射（联动清理 jhs_other_site_dmm）'
        },
        {
            key: 'jhs_other_site',
            text: '🌍 第三方站点缓存',
            title: 'missav/supjav 等站点搜索结果（随 WebDav 备份）'
        },
        {
            key: 'jhs_other_site_dmm',
            text: '🌍 DMM 预览伴生缓存',
            title: 'DMM 预览相关第三方链接（随 WebDav 备份）'
        },
        {
            key: 'jhs_translate',
            text: '🆎 标题翻译',
            title: '番号→中文标题翻译（Google Translate，随备份）'
        },
        {
            key: 'jhs_actress_info',
            text: '👩 演员信息',
            title: '演员身高/体重/三围/罩杯/生日（随备份）'
        },
        {
            key: 'jhs_score_info',
            text: '⭐ Top250|热播 评分数据',
            title: '影片评分 HTML 快照（随备份）'
        },
        {
            key: 'jhs_screenShot',
            text: '🖼️ 截图墙缓存',
            title: 'javstore 截图墙（随备份）'
        },
        {
            key: 'jhs_visit_history',
            text: '🕐 访问记录',
            title: '页面访问时间记录（随备份）'
        },
        {
            key: 'jdb:rating_cache_v2',
            text: '⭐ 列表评分缓存',
            title: '评分显示插件缓存（随备份）'
        }
    ];

    /** 返回插件名，供 PluginManager 注册去重。对应原 L9466-9468。 */
    getName(): string {
        return 'SettingPlugin';
    }

    /** 注入设置面板 CSS（容器宽度/列数 + 设置项/开关/侧栏/面板等样式）。对应原 L9469-9482。
     *  帮助弹窗 help-* 样式不在 initCss 注入，改由 helpBtn 点击时在 layer.open
     *  content 中拼接 help-dialog.css（原 L10040 content 内 <style> 块 + HTML），
     *  与原脚本 content 字符级一致。 */
    async initCss(): Promise<string> {
        const settings = await storageManager.getSetting();
        const containerWidth = (settings == null ? undefined : settings.containerWidth) ?? '70';
        const containerColumns =
            utils.isMobile() && window.innerWidth < 1000
                ? 1
                : ((settings == null ? undefined : settings.containerColumns) ?? 4);
        this.applyImageMode().then();
        let cssText = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${containerWidth}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));\n            }\n        `;
        return settingCssRaw
            .replace('__CSS_TEXT__', cssText)
            .replace('__SIMPLE_SETTING_TOP__', '35px')
            .replace('__SIMPLE_SETTING_RIGHT__', '-300%');
    }

    /** 挂载设置按钮入口（顶栏/顶栏迷你/详情页 h3 前）并绑定悬浮/点击。对应原 L9483-9558。 */
    async handle(): Promise<void> {
        if ((await storageManager.getSetting('enableClog', YES)) === YES) {
            clog.show();
        }
        if (isJavdbSite) {
            const toggleSettingBox = function () {
                if ($('.navbar-search').is(':hidden')) {
                    $('.mini-setting-box').hide();
                    $('.setting-box').show();
                } else {
                    $('.mini-setting-box').show();
                    $('.setting-box').hide();
                }
            };
            $('#navbar-menu-user .navbar-end').prepend(
                jsxToString(<SettingMountBox variant="navbar" />)
            );
            utils.loopDetector(
                () => $('#miniHistoryBtn').length > 0,
                () => {
                    $('.miniHistoryBtnBox').before(jsxToString(<SettingMountBox variant="mini" />));
                    toggleSettingBox();
                }
            );
            $(window).resize(toggleSettingBox);
        }
        $('.main-nav, .container-fluid').on('click', '#setting-btn, #mini-setting-btn', () => {
            clog.lowZIndex();
            this.openSettingDialog();
        });
        $('.main-nav, .container-fluid')
            .on('mouseenter', '.setting-box', () => {
                $('.simple-setting').html(this.simpleSetting()).show();
                this.initSimpleSettingForm().then();
                clog.lowZIndex();
            })
            .on('mouseleave', '.setting-box', () => {
                $('.simple-setting').html('').hide();
            });
        $('.main-nav, .container-fluid')
            .on('mouseenter', '.mini-setting-box', () => {
                $('.mini-simple-setting').html(this.simpleSetting()).show();
                this.initSimpleSettingForm().then();
                clog.lowZIndex();
            })
            .on('mouseleave', '.mini-setting-box', () => {
                $('.mini-simple-setting').html('').hide();
            });
        this.addBackToTopBtn();
    }

    /** 挂载"回到顶部"悬浮按钮并绑定滚动显隐/点击平滑滚动。对应原 L9559-9629。 */
    addBackToTopBtn(): void {
        utils.insertStyle(backToTopCssRaw);
        const btn = $(jsxToString(<BackToTopButton />));
        $('body').append(btn);
        btn.on('click', () => {
            utils.smoothScrollToTop(500); // 稍微放慢一点滚动速度，更有质感
        });

        // 使用 requestAnimationFrame 优化滚动监听
        let ticking = false;
        $(window).on('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if ($(window).scrollTop() > 300) {
                        btn.addClass('show');
                    } else {
                        btn.removeClass('show');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    /** 打开完整设置弹层（侧栏 + 各面板）。对应原 L9630-9660。 */
    async openSettingDialog(
        panelName: string = 'backup-panel',
        callback?: () => void
    ): Promise<void> {
        const cacheItemsHtml = this.cacheItems
            .map((item) => {
                const stats = getCacheStats(item.key);
                return jsxToString(
                    <CacheItemHtml
                        text={item.text}
                        cacheKey={item.key}
                        title={item.title}
                        size={formatSize(stats.size)}
                        count={stats.count > 0 ? `${stats.count} 条` : '空'}
                    />
                );
            })
            .join('');
        let qualityOptionsHtml = '';
        VIDEO_QUALITY_LIST.forEach((option) => {
            if (option.canSelect) {
                qualityOptionsHtml += jsxToString(
                    <VideoQualityOption quality={option.quality} text={option.text} />
                );
            }
        });
        const dialogHtml = jsxToString(
            <SettingDialog
                panelName={panelName}
                cacheItemsHtml={cacheItemsHtml}
                qualityOptionsHtml={qualityOptionsHtml}
                isJavdbSite={isJavdbSite}
            />
        );
        layer.open({
            type: 1,
            title: '设置',
            content: dialogHtml,
            area: utils.getResponsiveArea(['55%', '90%']),
            scrollbar: false,
            success: (layerEl: any, layerIndex: any) => {
                $(layerEl).find('.layui-layer-content').css('position', 'relative');
                this.loadForm();
                this.bindClick();
                utils.setupEscClose(layerIndex);
                if (callback) {
                    callback();
                }
            }
        });
    }

    /** 生成简化设置面板 HTML（悬浮下拉显示的精简版）。对应原 L9661-9663。 */
    simpleSetting(): string {
        return jsxToString(<SimpleSettingPanel isJavdbSite={isJavdbSite} />);
    }

    /** 从 storageManager 加载设置并回填到设置表单各输入项。对应原 L9664-9747。 */
    async loadForm(): Promise<void> {
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
        $('#webDavUrl').val(settings.webDavUrl || '');
        $('#webDavUsername').val(settings.webDavUsername || '');
        $('#webDavPassword').val(settings.webDavPassword || '');
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
        const otherSitePlugin = this.getBean('OtherSitePlugin');
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
        this.refreshPreloadCacheStats();
        const titleFilterKeyword = await storageManager.getTitleFilterKeyword();
        if (titleFilterKeyword) {
            titleFilterKeyword.forEach((keyword: string) => {
                this.addLabelTag('#filterKeywordContainer', keyword);
            });
        }
        $('#filterKeywordContainer .add-tag-btn').on('click', () =>
            this.addKeyword('#filterKeywordContainer')
        );
        $('#filterKeywordContainer .keyword-input').on('keypress', (event: any) => {
            if (event.key === 'Enter') {
                this.addKeyword('#filterKeywordContainer');
            }
        });
    }

    /** 初始化简化设置面板表单（回填值 + 绑定即时生效的 change/input 事件）。对应原 L9807-10044。 */
    async initSimpleSettingForm(): Promise<void> {
        const settings = await storageManager.getSetting();
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
        $('#autoPage').prop('checked', !settings.autoPage || settings.autoPage === YES);
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
        $('#containerColumns').on('input', async () => {
            const columns = $('#containerColumns').val();
            $('#showContainerColumns').text(columns);
            if (isJavdbSite) {
                (document.querySelector('.movie-list') as any).style.gridTemplateColumns =
                    `repeat(${columns}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem('containerColumns', columns);
            this.applyImageMode();
        });
        $('#containerWidth').on('input', async (event: any) => {
            const rangeValue = parseInt($(event.target).val());
            const widthPercent = rangeValue + 70 + '%';
            $('#showContainerWidth').text(widthPercent);
            if (isJavdbSite) {
                (document.querySelector('section .container') as any).style.minWidth = widthPercent;
            }
            storageManager.saveSettingItem('containerWidth', rangeValue + 70);
        });
        $('#dialogOpenDetail').on('change', () => {
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
        $('#showFilterItem').on('change', async () => {
            const value = $('#showFilterItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterItem', value);
            refresh();
        });
        $('#showFilterActorItem').on('change', async () => {
            const value = $('#showFilterActorItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterActorItem', value);
            refresh();
        });
        $('#showFilterKeywordItem').on('change', async () => {
            const value = $('#showFilterKeywordItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterKeywordItem', value);
            refresh();
        });
        $('#showFavoriteItem').on('change', async () => {
            const value = $('#showFavoriteItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFavoriteItem', value);
            refresh();
        });
        $('#showHasWatchItem').on('change', async () => {
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
            } else {
                $filterCheckboxes.removeAttr('data-tip');
            }
        };
        $('#showAllItem').prop('checked', !!settings.showAllItem && settings.showAllItem === YES);
        $('#showAllItem').on('change', async () => {
            const value = $('#showAllItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showAllItem', value);
            updateDisabledState();
            refresh();
        });
        updateDisabledState();
        $('#needClosePage').on('change', async () => {
            await storageManager.saveSettingItem(
                'needClosePage',
                $('#needClosePage').is(':checked') ? YES : NO
            );
            refresh();
        });
        $('#autoPage').on('change', async () => {
            const value = $('#autoPage').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('autoPage', value);
            const autoPagePlugin = this.getBean('AutoPagePlugin');
            // 排序按钮始终显示；autoPage=NO 时自动排序
            if (value === YES) {
                autoPagePlugin?.showLoadAllBtn();
            } else {
                autoPagePlugin?.hideLoadAllBtn();
                this.getBean('ListPageButtonPlugin')?.sortItems().then();
            }
        });
        $('#translateTitle').on('change', async () => {
            const value = $('#translateTitle').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('translateTitle', value);
            if (value === YES) {
                await this.getBean('ListPagePlugin').doFilter();
            } else {
                await this.getBean('ListPagePlugin').revertTranslation();
                $('.translated-title').remove();
            }
        });
        $('#enableLoadActressInfo').on('change', async () => {
            const value = $('#enableLoadActressInfo').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadActressInfo', value);
            if (value === YES) {
                this.getBean('ActressInfoPlugin').loadActressInfo();
            } else {
                $('.actress-info').remove();
            }
        });
        $('#enableLoadOtherSite').on('change', async () => {
            const value = $('#enableLoadOtherSite').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadOtherSite', value);
            if (value === YES) {
                this.getBean('OtherSitePlugin').loadOtherSite().then();
            } else {
                $('#otherSiteBox').remove();
            }
        });
        $('#moreBtn').on('click', () => {
            $('.simple-setting').html('').hide();
            this.openSettingDialog('base-panel');
        });
        $('#helpBtn').on('click', () => {
            layer.open({
                type: 1,
                title: '',
                shadeClose: true,
                scrollbar: false,
                content: '<style>' + helpDialogCssRaw + '</style>' + jsxToString(<HelpDialog />),
                area: utils.getResponsiveArea(['50%', '90%'])
            });
        });
    }

    /** 注入横图模式 CSS（竖图设置项已移除，固定横图）。对应原 L10045-10065。 */
    async applyImageMode(): Promise<void> {
        $('#verticalImgStyle').remove();
        $('<style>').attr('id', 'verticalImgStyle').text(horizontalImgCssRaw).appendTo('head');
    }

    /** 绑定设置弹层内各按钮/输入的点击/输入事件。对应原 L10066-10131。 */
    bindClick(): void {
        $('.side-menu-item').on('click', function (this: any) {
            $('.side-menu-item').removeClass('active');
            $(this).addClass('active');
            $('.content-panel').hide();
            const panelName = $(this).data('panel');
            $('#' + panelName).show();
            if (panelName === 'cache-panel') {
                $('#saveBtn').hide();
                $('#clean-all').show();
                this.refreshAllCacheStats();
            } else if (panelName === 'vlt-panel') {
                $('#saveBtn').hide();
                $('#clean-all').hide();
            } else if (panelName === 'missav-panel') {
                $('#saveBtn').hide();
                $('#clean-all').hide();
            } else if (panelName === 'preload-panel') {
                $('#saveBtn').show();
                $('#clean-all').hide();
                this.refreshPreloadCacheStats();
            } else {
                $('#saveBtn').show();
                $('#clean-all').hide();
            }
        });
        $('#importBtn').on('click', () => this.importData());
        $('#exportBtn').on('click', () => this.exportData());
        $('#webdavBackupBtn').on('click', () => this.backupDataByWebDav());
        $('#webdavBackupListBtn').on('click', () => this.backupListBtnByWebDav());
        $('#saveBtn').on('click', () => this.saveForm());
        // ===== 缓存管理面板事件绑定 =====
        // 初始化总量显示
        this.refreshAllCacheStats();
        // 清理单个缓存
        $('.clean-btn').on('click', (event: any) => {
            const cacheKey = $(event.currentTarget).data('key');
            const cacheItem = this.cacheItems.find((item) => item.key === cacheKey)!;
            localStorage.removeItem(cacheKey);
            // 联动清理 jhs_other_site_dmm（DMM 预览视频的伴生缓存）
            if (cacheKey === 'jhs_dmm_video') {
                localStorage.removeItem('jhs_other_site_dmm');
            }
            show.ok(`${cacheItem.text} 清理成功`);
            $('#cache-data-display').hide();
            this.refreshCacheStats(cacheKey);
            this.refreshAllCacheStats();
        });
        // 全部清理
        $('#clean-all').on('click', () => {
            this.cacheItems.forEach((item) => localStorage.removeItem(item.key));
            localStorage.removeItem('jhs_other_site_dmm');
            show.ok('全部缓存已清理');
            $('#cache-data-display').hide();
            this.refreshAllCacheStats();
        });
        // 查看缓存内容
        $('.view-btn').on('click', (event: any) => {
            const cacheKey = $(event.currentTarget).data('key');
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
        });
        // 导出缓存为 JSON 文件
        $('.export-btn').on('click', (event: any) => {
            const cacheKey = $(event.currentTarget).data('key');
            const cachedData = localStorage.getItem(cacheKey);
            if (!cachedData) {
                show.error('缓存为空，无可导出数据');
                return;
            }
            const cacheItem = this.cacheItems.find((item) => item.key === cacheKey)!;
            const blob = new Blob([cachedData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cacheKey}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            show.ok(`${cacheItem.text} 已导出`);
        });
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
        $('#vlt-import-btn').on('click', () => {
            $('#vlt-file-input').trigger('click');
        });
        $('#vlt-file-input').on('change', async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const $status = $('#vlt-status');
            $status.text('⏳ 导入中...').css('color', '#0d6efd');
            try {
                const text = await file.text();
                const data: MigrationData = JSON.parse(text);
                const stats = await VltDb.importData(data);
                $status
                    .html(
                        `✓ 导入完成：${stats.movies} 部影片, ${stats.inventory} 个清单, ${stats.movieInventory} 条关联`
                    )
                    .css('color', '#198754');
                showToast(
                    `✓ 导入完成：${stats.movies} 部影片, ${stats.inventory} 个清单, ${stats.movieInventory} 条关联`,
                    'success'
                );
                setTimeout(() => window.location.reload(), 1500);
            } catch (err: any) {
                $status.text(`✗ 导入失败：${err.message}`).css('color', '#dc3545');
                showToast(`✗ 导入失败：${err.message}`, 'error');
            }
            e.target.value = '';
        });
        $('#vlt-export-btn').on('click', async () => {
            const $status = $('#vlt-status');
            $status.text('⏳ 导出中...').css('color', '#0d6efd');
            try {
                const data = await VltDb.exportData();
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vlt-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                $status
                    .html(
                        `✓ 导出完成：${Object.keys(data.movies).length} 部影片, ${Object.keys(data.inventory).length} 个清单, ${Object.keys(data.movieInventory).length} 条关联`
                    )
                    .css('color', '#198754');
                showToast('✓ 导出完成', 'success');
            } catch (err: any) {
                $status.text(`✗ 导出失败：${err.message}`).css('color', '#dc3545');
                showToast(`✗ 导出失败：${err.message}`, 'error');
            }
        });

        // MissAV 同步面板：立即同步 / 导入 / 导出按钮
        $('#missav-sync-btn').on('click', async () => {
            const $status = $('#missav-status');
            $status.text('⏳ 同步中...').css('color', '#0d6efd');
            try {
                const carList = await storageManager.getCarList();
                if (carList.length === 0) {
                    $status.text('✗ car_list 为空').css('color', '#dc3545');
                    return;
                }
                const colRes = toColumnar(carList);
                const count = countColumnar(colRes.byStatus);
                const base64 = await gzipToBase64(colRes.byStatus);
                if (!base64) {
                    $status.text('✗ 压缩失败').css('color', '#dc3545');
                    return;
                }
                const payload = {
                    data: base64,
                    hwm: new Date().toISOString(),
                    count,
                    ts: Date.now()
                };
                GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);
                $status.html(`✓ 同步完成：${count} 条记录已推送到 GM 存储`).css('color', '#198754');
                showToast(`✓ 同步完成：${count} 条`, 'success');
            } catch (err: any) {
                $status.text(`✗ 同步失败：${err.message}`).css('color', '#dc3545');
                showToast(`✗ 同步失败：${err.message}`, 'error');
            }
        });
        $('#missav-import-btn').on('click', () => {
            $('#missav-file-input').trigger('click');
        });
        $('#missav-file-input').on('change', async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const $status = $('#missav-status');
            $status.text('⏳ 导入中...').css('color', '#0d6efd');
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                // 兼容后端服务器导出格式（列存 groups）和 missav 本地导出格式（行式 records）
                let records: Array<{ carNum: string; status: string; url: string }>;
                if (Array.isArray(data)) {
                    // 行式格式 [{carNum, status, url}]
                    records = data;
                } else if (data.records && Array.isArray(data.records)) {
                    records = data.records;
                } else {
                    // 列存格式（后端导出）：转为行式，并将 url_path 转换为完整 url
                    const flat = columnarToFlat(data);
                    records = flat.map((r) => ({
                        carNum: r.carNum,
                        status: r.status,
                        url: buildJavdbUrl(r.url_path)
                    }));
                }
                const written = await importLocalDB(records);
                $status.html(`✓ 导入完成：${written} 条记录`).css('color', '#198754');
                showToast(`✓ 导入完成：${written} 条`, 'success');
            } catch (err: any) {
                $status.text(`✗ 导入失败：${err.message}`).css('color', '#dc3545');
                showToast(`✗ 导入失败：${err.message}`, 'error');
            }
            e.target.value = '';
        });
        $('#missav-export-btn').on('click', async () => {
            const $status = $('#missav-status');
            $status.text('⏳ 导出中...').css('color', '#0d6efd');
            try {
                const records = await exportLocalDB();
                const json = JSON.stringify(records, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `missav-status-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                $status.html(`✓ 导出完成：${records.length} 条记录`).css('color', '#198754');
                showToast('✓ 导出完成', 'success');
            } catch (err: any) {
                $status.text(`✗ 导出失败：${err.message}`).css('color', '#dc3545');
                showToast(`✗ 导出失败：${err.message}`, 'error');
            }
        });
    }

    /**
     * 刷新单个缓存项的统计信息（大小 + 条目数）。
     * @param cacheKey localStorage 键名
     */
    refreshCacheStats(cacheKey: string): void {
        const stats = getCacheStats(cacheKey);
        const $item = $(`.cache-item[data-cache-key="${cacheKey}"]`);
        $item.find('.cache-size').text(formatSize(stats.size));
        $item.find('.cache-count').text(stats.count > 0 ? `${stats.count} 条` : '空');
    }

    /**
     * 刷新预加载配置面板的缓存状态显示（jhs_other_site 总数 + MissAv/SupJav 分站计数 + 占用）。
     * 与「缓存管理」面板的「第三方站点缓存」为同一缓存，此处仅展示统计，清理见缓存管理面板。
     */
    refreshPreloadCacheStats(): void {
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
            `共 <b>${stats.count}</b> 条（MissAv ${missAv} / SupJav ${supJav}）｜占用 ${formatSize(stats.size)}`
        );
    }

    /**
     * 刷新所有缓存项的统计信息 + 总占用大小。
     */
    refreshAllCacheStats(): void {
        let totalSize = 0;
        for (const item of this.cacheItems) {
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

    /** 保存设置表单到 storageManager 并刷新页面/相关插件。对应原 L10132-10207。 */
    async saveForm(): Promise<void> {
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
        settings.webDavUrl = $('#webDavUrl').val();
        settings.webDavUsername = $('#webDavUsername').val();
        settings.webDavPassword = $('#webDavPassword').val();
        // 自动备份配置（随备份文件保存）
        settings.autoBackupConfig = {
            enabled: $('#enableAutoBackup').is(':checked'),
            frequency: $('#autoBackupFrequency').val() as AutoBackupFrequency
        };
        settings.missAvUrl = $('#missAvUrl').val().replace(/\/$/, '');
        settings.supJavUrl = $('#supJavUrl').val().replace(/\/$/, '');
        // 预加载配置
        settings.enablePreload = $('#enablePreload').is(':checked') ? YES : NO;
        settings.enablePreloadStatus = $('#enablePreloadStatus').is(':checked') ? YES : NO;
        settings.preloadDebounce = $('#preloadDebounce').val();
        settings.preloadConcurrency = $('#preloadConcurrency').val();
        settings.preloadCacheTTL = $('#preloadCacheTTL').val();
        // 站点启用写入 jhs_enabled_sites（localStorage，非 settings 对象）
        const otherSitePluginForSave = this.getBean('OtherSitePlugin');
        const enabledSiteIds: string[] = [];
        if ($('#preload-enable-missAvBtn').is(':checked')) enabledSiteIds.push('missAvBtn');
        if ($('#preload-enable-supJavBtn').is(':checked')) enabledSiteIds.push('supJavBtn');
        otherSitePluginForSave.saveEnabledSites(enabledSiteIds);
        settings.enableFavoriteActresses = $('#enableFavoriteActresses').is(':checked') ? YES : NO;
        settings.enableSaveActressCarInfo = $('#enableSaveActressCarInfo').is(':checked')
            ? YES
            : NO;
        await storageManager.saveSetting(settings);
        const titleFilterKeywordList: string[] = [];
        $('#filterKeywordContainer .keyword-label')
            .toArray()
            .forEach((label: any) => {
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
        const newVideoPlugin = this.getBean('NewVideoPlugin');
        if (newVideoPlugin) {
            newVideoPlugin.resetBtnTip();
        }
        this.getBean('BlacklistPlugin').resetBtnTip();
        this.getBean('BlacklistPlugin').reloadTable();
    }

    /** 在关键词容器内添加一个关键词标签（带删除按钮）。 */
    addLabelTag(containerSelector: string, keyword: string): void {
        const $tagBox = $(`${containerSelector} .tag-box`);
        let $label: any;
        const bgColor = '#cbd5e1';
        let textColor = '#333';
        if (/^[a-z]{2,}-/i.test(keyword) && isJavdbSite) {
            textColor = '#3477ad';
            $label = $(
                jsxToString(
                    <KeywordLabel
                        keyword={keyword}
                        bgColor={bgColor}
                        textColor={textColor}
                        variant="link"
                        href={`/video_codes/${keyword.replace('-', '')}`}
                    />
                )
            );
        } else {
            $label = $(
                jsxToString(
                    <KeywordLabel
                        keyword={keyword}
                        bgColor={bgColor}
                        textColor={textColor}
                        variant="div"
                    />
                )
            );
        }
        $label.find('.keyword-remove').click((event: any) => {
            event.stopPropagation();
            event.preventDefault();
            const $removeBtn = $(event.currentTarget);
            const removeKeyword = $removeBtn
                .closest('.keyword-label')
                .attr('data-keyword')
                .split(' ')[0];
            utils.q(event, `是否移除屏蔽词  ${removeKeyword}?`, async () => {
                $removeBtn.parent().remove();
            });
        });
        $tagBox.append($label);
    }

    /** 从输入框读取关键词并添加为标签。 */
    addKeyword(containerSelector: string): void {
        const $input = $(`${containerSelector} .keyword-input`);
        const keyword = $input.val().trim();
        if (keyword) {
            this.addLabelTag(containerSelector, keyword);
            $input.val('');
        }
    }

    /** 从本地 JSON 文件导入数据（覆盖确认 + reload）。对应原 L10245-10291。 */
    importData(): void {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.onchange = (event: any) => {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = (loadEvent: any) => {
                    try {
                        const resultText = loadEvent.target.result.toString();
                        const parsedData = JSON.parse(resultText);
                        layer.confirm(
                            '确定是否要覆盖导入？',
                            {
                                icon: 3,
                                title: '确认覆盖',
                                btn: ['确定', '取消']
                            },
                            async (layerIndex: any) => {
                                applyBackupExtras(parsedData);
                                await storageManager.importData(parsedData);
                                show.ok('数据导入成功');
                                layer.close(layerIndex);
                                location.reload();
                            }
                        );
                    } catch (err: any) {
                        console.error(err);
                        show.error('导入失败：文件内容不是有效的JSON格式 ' + err);
                    }
                };
                reader.onerror = () => {
                    show.error('读取文件时出错');
                };
                reader.readAsText(file);
            };
            document.body.appendChild(fileInput);
            fileInput.click();
            setTimeout(() => document.body.removeChild(fileInput), 1000);
        } catch (err: any) {
            console.error(err);
            show.error('导入数据时出错: ' + err.message);
        }
    }

    /** 通过 WebDav 备份数据（加密后上传）。对应原 L10292-10323。 */
    async backupDataByWebDav(): Promise<void> {
        const settings = await storageManager.getSetting();
        const webDavUrl = settings.webDavUrl;
        if (!webDavUrl) {
            show.error('请填写webDav服务地址并保存后, 再试此功能');
            return;
        }
        const webDavUsername = settings.webDavUsername;
        if (!webDavUsername) {
            show.error('请填写webDav用户名并保存后, 再试此功能');
            return;
        }
        const webDavPassword = settings.webDavPassword;
        if (!webDavPassword) {
            show.error('请填写webDav密码并保存后, 再试此功能');
            return;
        }
        const fileName = utils.getNowStr('_', '_') + '.json';
        let exportText = JSON.stringify(await this.buildBackupPayload(settings));
        exportText = (window as any).encryptCredential(exportText);
        const loadingHandle = loading();
        try {
            const webdavClient = new (window as any).WebDavClient(
                webDavUrl,
                webDavUsername,
                webDavPassword
            );
            await webdavClient.backup(this.folderName, fileName, exportText);
            show.ok('备份完成');
        } catch (err: any) {
            console.error(err);
            show.error(err.toString());
        } finally {
            loadingHandle.close();
        }
    }

    /**
     * 构造备份 payload：IndexedDB 全量 + 元信息 + localStorage 长期缓存/偏好 + GM 清单数据。
     * 含 __localStorage / __gmStorage，导入时由 applyBackupExtras 写回后剥离，
     * 避免 importData 误写入 forage。
     */
    async buildBackupPayload(settings: any): Promise<Record<string, any>> {
        const exportData = await storageManager.exportData();
        exportData.__meta = {
            credentialId: getCredentialId(),
            autoBackupConfig: settings.autoBackupConfig || DEFAULT_AUTO_BACKUP_CONFIG,
            backupTime: utils.getNowStr('_', '_', '_')
        };
        exportData.__localStorage = collectLocalStorageBackup();
        exportData.__gmStorage = collectGmStorageBackup();
        return exportData;
    }

    /**
     * 自动备份（增量滚动覆盖）。
     *
     * 文件名固定为 `auto_<credentialId>.json`，一个浏览器只保留一份，
     * 每次自动备份覆盖该文件（不堆叠历史）。备份内容含 credentialId
     * 与 autoBackupConfig。静默执行，失败仅 console.warn 不打扰用户。
     *
     * 由 main.tsx 启动序列在插件执行后调用。
     */
    async autoBackup(): Promise<void> {
        const settings = await storageManager.getSetting();
        const config: AutoBackupConfig = settings.autoBackupConfig || DEFAULT_AUTO_BACKUP_CONFIG;
        if (!shouldAutoBackup(config)) return;
        const webDavUrl = settings.webDavUrl;
        if (!webDavUrl) return; // 未配置 WebDav，静默跳过
        const webDavUsername = settings.webDavUsername;
        const webDavPassword = settings.webDavPassword;
        if (!webDavUsername || !webDavPassword) return;
        try {
            let exportText = JSON.stringify(await this.buildBackupPayload(settings));
            exportText = (window as any).encryptCredential(exportText);
            const webdavClient = new (window as any).WebDavClient(
                webDavUrl,
                webDavUsername,
                webDavPassword
            );
            await webdavClient.backup(this.folderName, getAutoBackupFileName(), exportText);
            markAutoBackupDone();
            console.log('[JHS 自动备份] 完成');
        } catch (err: any) {
            console.warn('[JHS 自动备份] 失败:', err.message || err);
        }
    }

    /** 通过 WebDav 查看备份文件列表。对应原 L10324-10352。 */
    async backupListBtnByWebDav(): Promise<void> {
        const settings = await storageManager.getSetting();
        const webDavUrl = settings.webDavUrl;
        if (!webDavUrl) {
            show.error('请填写webDav服务地址并保存后, 再试此功能');
            return;
        }
        const webDavUsername = settings.webDavUsername;
        if (!webDavUsername) {
            show.error('请填写webDav用户名并保存后, 再试此功能');
            return;
        }
        const webDavPassword = settings.webDavPassword;
        if (!webDavPassword) {
            show.error('请填写webDav密码并保存后, 再试此功能');
            return;
        }
        const loadingHandle = loading();
        try {
            const webdavClient = new (window as any).WebDavClient(
                webDavUrl,
                webDavUsername,
                webDavPassword
            );
            const backupList = await webdavClient.getBackupList(this.folderName);
            this.openFileListDialog(backupList, webdavClient, 'WebDav');
        } catch (err: any) {
            console.error(err);
            show.error(`发生错误: ${err ? err.message : err}`);
        } finally {
            loadingHandle.close();
        }
    }

    /** 打开备份文件列表弹层（Tabulator 表格，含删除/下载/导入操作）。对应原 L10353-10552。 */
    openFileListDialog(backupList: any, webdavClient: any, titlePrefix: string): void {
        layer.open({
            type: 1,
            title: titlePrefix + '备份文件',
            content: jsxToString(<BackupFileDialog />),
            area: ['800px', '70%'],
            anim: -1,
            success: () => {
                const table = new Tabulator('#table-container', {
                    layout: 'fitColumns',
                    placeholder: '暂无数据',
                    virtualDom: true,
                    data: backupList,
                    responsiveLayout: 'collapse',
                    responsiveLayoutCollapse: true,
                    columnDefaults: {
                        headerHozAlign: 'center',
                        hozAlign: 'center'
                    },
                    columns: [
                        {
                            title: '文件名',
                            field: 'name',
                            width: 200,
                            headerSort: false,
                            responsive: 0
                        },
                        {
                            title: '文件大小',
                            field: 'size',
                            responsive: 1,
                            headerSort: false,
                            formatter: (cell: any, _params: any, _onRendered: any) => {
                                const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
                                let unitIndex = 0;
                                let size = cell.getData().size;
                                while (size >= 1024 && unitIndex < units.length - 1) {
                                    size /= 1024;
                                    unitIndex++;
                                }
                                return `${size % 1 == 0 ? size.toFixed(0) : size.toFixed(2)} ${units[unitIndex]}`;
                            }
                        },
                        {
                            title: '备份日期',
                            field: 'createTime',
                            responsive: 2,
                            headerSort: false,
                            formatter: (cell: any, _params: any, _onRendered: any) => {
                                const data = cell.getData();
                                return `${utils.getNowStr('-', ':', data.createTime)}`;
                            }
                        },
                        {
                            title: '操作',
                            minWidth: 250,
                            responsive: 0,
                            headerSort: false,
                            formatter: (cell: any, _params: any, onRendered: any) => {
                                const rowData = cell.getData();
                                onRendered(() => {
                                    const $dangerBtn = cell.getElement().querySelector('.a-danger');
                                    const $primaryBtn = cell
                                        .getElement()
                                        .querySelector('.a-primary');
                                    const $successBtn = cell
                                        .getElement()
                                        .querySelector('.a-success');
                                    if ($dangerBtn) {
                                        $dangerBtn.addEventListener('click', (_event: any) => {
                                            layer.confirm(
                                                `是否删除 ${rowData.name} ?`,
                                                {
                                                    icon: 3,
                                                    title: '提示',
                                                    btn: ['确定', '取消']
                                                },
                                                async (layerIndex: any) => {
                                                    layer.close(layerIndex);
                                                    let loadingHandle = loading();
                                                    try {
                                                        await webdavClient.deleteFile(
                                                            rowData.fileId
                                                        );
                                                        let newList =
                                                            await webdavClient.getBackupList(
                                                                this.folderName
                                                            );
                                                        table.replaceData(newList);
                                                        layer.alert('删除成功');
                                                    } catch (err: any) {
                                                        console.error(err);
                                                        show.error(
                                                            `发生错误: ${err ? err.message : err}`
                                                        );
                                                    } finally {
                                                        loadingHandle.close();
                                                    }
                                                }
                                            );
                                        });
                                    }
                                    if ($primaryBtn) {
                                        $primaryBtn.addEventListener(
                                            'click',
                                            async (_event: any) => {
                                                let loadingHandle = loading();
                                                try {
                                                    const decrypted = (
                                                        window as any
                                                    ).decryptCredential(
                                                        await webdavClient.getFileContent(
                                                            rowData.fileId
                                                        )
                                                    );
                                                    utils.download(decrypted, rowData.name);
                                                } catch (err: any) {
                                                    clog.error(err);
                                                    show.error('下载失败: ' + err);
                                                } finally {
                                                    loadingHandle.close();
                                                }
                                            }
                                        );
                                    }
                                    if ($successBtn) {
                                        $successBtn.addEventListener('click', (_event: any) => {
                                            layer.confirm(
                                                `是否将该云备份数据 ${rowData.name} 导入?`,
                                                {
                                                    icon: 3,
                                                    title: '提示',
                                                    btn: ['确定', '取消']
                                                },
                                                async (layerIndex: any) => {
                                                    layer.close(layerIndex);
                                                    let loadingHandle = loading();
                                                    try {
                                                        let fileContent =
                                                            await webdavClient.getFileContent(
                                                                rowData.fileId
                                                            );
                                                        show.info('解密文件内容...');
                                                        fileContent = (
                                                            window as any
                                                        ).decryptCredential(fileContent);
                                                        show.info('解密完成, 开始导入...');
                                                        const parsedData = JSON.parse(fileContent);
                                                        applyBackupExtras(parsedData);
                                                        await storageManager.importData(parsedData);
                                                        show.ok('导入成功!');
                                                        window.location.reload();
                                                    } catch (err: any) {
                                                        console.error(err);
                                                        show.error(err);
                                                    } finally {
                                                        loadingHandle.close();
                                                    }
                                                }
                                            );
                                        });
                                    }
                                });
                                return '\n                                    <a class="a-danger">删除</a>\n                                    <a class="a-primary">下载</a>\n                                    <a class="a-success">导入</a>\n                                ';
                            }
                        }
                    ],
                    locale: 'zh-cn',
                    langs: {
                        'zh-cn': {
                            pagination: {
                                first: '首页',
                                first_title: '首页',
                                last: '尾页',
                                last_title: '尾页',
                                prev: '上一页',
                                prev_title: '上一页',
                                next: '下一页',
                                next_title: '下一页',
                                all: '所有',
                                page_size: '每页行数'
                            }
                        }
                    }
                });
            }
        });
    }

    /** 导出本地 JSON 数据文件（含访问记录等 __localStorage，与 WebDav 备份一致）。 */
    async exportData(): Promise<void> {
        try {
            const settings = await storageManager.getSetting();
            const exportText = JSON.stringify(await this.buildBackupPayload(settings));
            const fileName = `${utils.getNowStr('_', '_')}.json`;
            utils.download(exportText, fileName);
            show.ok('数据导出成功');
        } catch (err: any) {
            console.error(err);
            show.error('导出数据时出错: ' + err.message);
        }
    }
}
