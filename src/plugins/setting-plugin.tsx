/**
 * 设置插件 SettingPlugin —— 对应原脚本 archetype/jhs.user.js L9429-10564。
 *
 * 全局设置入口：注入设置按钮（JavDb 顶栏下拉 / 详情页 h3 前），
 * 悬浮显示简化设置面板（显示已鉴定/收藏/已观看、弹窗打开、瀑布流、翻译、悬浮大图、
 * 115 匹配、女优信息、第三方资源、长缩略图、更高画质预览、竖图模式、页面列数/宽度），
 * 点击打开完整设置弹层（数据备份 / 基础配置 / 外部网站 / 缓存管理等）；
 * 提供本地导入导出、WebDav 云备份/查看/下载/导入、缓存清理与查看、回到顶部按钮。
 *
 * 原子化拆分（Wave 2）：表单绑定 / 缓存管理 / WebDav 操作 / 数据导入导出
 * 四大组逻辑已提取至 ./setting/ 子模块，本类仅保留入口挂载、弹层打开、
 * 快捷设置、回到顶部、关键词标签、诊断刷新、自动备份等编排方法，
 * 以及指向子模块函数的薄委托方法（内部调用点与 getBean 表面签名不变）。
 *
 * JS→TS 改造要点：
 * - 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/d/h/g/p 等）已语义化命名。
 * - 站点布尔 r 改由 ../constants/site 引入（isJavdbSite）；
 *   状态文本 m/v/k 与布尔标识 _/C 改由 ../constants/status 引入（YES/NO）；
 *   画质列表 L 改由 ../constants/video-quality 引入（VIDEO_QUALITY_LIST）。
 * - WebDav 加密/解密/客户端（原 Me/Ne/De）已提取至 core/webdav-crypto
 *   （encryptCredential/decryptCredential）与 core/webdav（WebDavClient），
 *   经 window.encryptCredential / .decryptCredential / .WebDavClient 访问。
 * - 内联 HTML/CSS 已提取为组件/CSS：设置挂载容器/回到顶部按钮/关键词标签/简化设置面板/
 *   缓存项/画质选项 → 组件，回到顶部 CSS 与竖图/横图 CSS → src/styles/*.css + ?raw。
 *   layer 弹窗 content 由 SettingDialog/HelpDialog/BackupFileDialog 组件返回 JSX，
 *   经 jsxToString 转为 HTML 字符串（doc/21）。
 * - 控制流（分支、try/catch/finally、fire-and-forget .then()、loopDetector、
 *   requestAnimationFrame 滚动监听、FileReader 异步链）与原脚本一致。
 */
import { isJavdbSite } from '../constants/site';
import { YES } from '../constants/status';
import { VIDEO_QUALITY_LIST } from '../constants/video-quality';

import { jsxToString } from '../core/jsx-to-string';
import { renderDiagnosticsHtml } from '../core/plugin-diagnostics';
import {
    DEFAULT_AUTO_BACKUP_CONFIG,
    shouldAutoBackup,
    getAutoBackupFileName,
    markAutoBackupDone,
    type AutoBackupConfig
} from '../core/auto-backup';
import type { WebDavClient, WebDavFileItem } from '../core/webdav';

import { BasePlugin } from './base-plugin';
import {
    loadForm,
    saveForm,
    bindClick,
    initSimpleSettingForm
} from './setting/setting-form-binder';
import {
    getCacheStats,
    formatSize,
    refreshCacheStats,
    refreshAllCacheStats,
    refreshPreloadCacheStats
} from './setting/cache-management';
import { importData, exportData, buildBackupPayload } from './setting/data-import-export';
import {
    backupDataByWebDav,
    backupListBtnByWebDav,
    openFileListDialog,
    getWebDavCredentialsFromGm
} from './setting/webdav-operations';

import { SettingDialog } from '../components/setting/setting-dialog';
import { BackToTopButton } from '../components/misc/back-to-top-button';
import { CacheItemHtml } from '../components/setting/cache-item-html';
import { SettingMountBox } from '../components/setting/setting-mount-box';
import { SimpleSettingPanel } from '../components/setting/simple-setting-panel';
import { VideoQualityOption } from '../components/setting/video-quality-option';
import { KeywordLabel } from '../components/misc/keyword-label';
import { StyleBlock } from '../components/misc/style-block';

import settingCssRaw from '../styles/setting-plugin.css?raw';
import backToTopCssRaw from '../styles/back-to-top-button.css?raw';
import horizontalImgCssRaw from '../styles/setting-image-mode-horizontal.css?raw';

/** 缓存项配置（localStorage 键 + 展示文本 + 说明）。 */
export interface CacheItem {
    key: string;
    text: string;
    title: string;
}

export class SettingPlugin extends BasePlugin {
    /** WebDav 备份目录名。对应原 L9432。 */
    folderName = 'JHS-数据备份';

    /** 快捷设置面板 mouseleave 延迟关闭定时器（避免移入间隙误关）。 */
    private simpleSettingHideTimer: ReturnType<typeof setTimeout> | null = null;

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
        const cssText = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${containerWidth}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));\n            }\n        `;
        return settingCssRaw.replace('__CSS_TEXT__', cssText);
    }

    /** 取消快捷设置延迟关闭。 */
    cancelSimpleSettingHide(): void {
        if (this.simpleSettingHideTimer != null) {
            clearTimeout(this.simpleSettingHideTimer);
            this.simpleSettingHideTimer = null;
        }
    }

    /** 延迟关闭快捷设置面板（给移入面板留缓冲）。 */
    private scheduleSimpleSettingHide(selector: string): void {
        this.cancelSimpleSettingHide();
        this.simpleSettingHideTimer = setTimeout(() => {
            $(selector).html('').hide();
            this.simpleSettingHideTimer = null;
        }, 220);
    }

    /** 打开快捷设置并初始化表单。 */
    private openSimpleSetting(selector: string): void {
        this.cancelSimpleSettingHide();
        $(selector).html(this.simpleSetting()).show();
        this.initSimpleSettingForm().then();
        clog.lowZIndex();
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
                this.openSimpleSetting('.simple-setting');
            })
            .on('mouseleave', '.setting-box', () => {
                this.scheduleSimpleSettingHide('.simple-setting');
            });
        $('.main-nav, .container-fluid')
            .on('mouseenter', '.mini-setting-box', () => {
                this.openSimpleSetting('.mini-simple-setting');
            })
            .on('mouseleave', '.mini-setting-box', () => {
                this.scheduleSimpleSettingHide('.mini-simple-setting');
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
                    if (($(window).scrollTop() ?? 0) > 300) {
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
            success: (layerEl: HTMLElement, layerIndex: number) => {
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

    /** 注入横图模式 CSS（竖图设置项已移除，固定横图）。对应原 L10045-10065。 */
    async applyImageMode(): Promise<void> {
        $('#verticalImgStyle').remove();
        $(jsxToString(<StyleBlock id="verticalImgStyle" css={horizontalImgCssRaw} />)).appendTo(
            'head'
        );
    }

    /** 刷新插件诊断面板内容（renderDiagnosticsHtml 内部已改读聚合诊断 plugins）。 */
    refreshDiagnostics(): void {
        $('#diagnostics-content').html(renderDiagnosticsHtml(this.pluginManager));
    }

    /** 在关键词容器内添加一个关键词标签（带删除按钮）。 */
    addLabelTag(containerSelector: string, keyword: string): void {
        const $tagBox = $(`${containerSelector} .tag-box`);
        let $label: JQuery;
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
        $label.find('.keyword-remove').click((event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
            const $removeBtn = $(event.currentTarget);
            const removeKeyword = ($removeBtn
                .closest('.keyword-label')
                .attr('data-keyword') ?? '')
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
        const keyword = String($input.val() ?? '').trim();
        if (keyword) {
            this.addLabelTag(containerSelector, keyword);
            $input.val('');
        }
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
        const creds = getWebDavCredentialsFromGm();
        if (!creds) return; // 未配置 WebDav，静默跳过
        try {
            const exportText = JSON.stringify(await this.buildBackupPayload(settings));
            const webdavClient = new window.WebDavClient(creds.url, creds.username, creds.password);
            await webdavClient.backup(this.folderName, getAutoBackupFileName(), exportText);
            markAutoBackupDone();
            console.log('[JHS 自动备份] 完成');
        } catch (err: unknown) {
            console.warn(
                '[JHS 自动备份] 失败:',
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    // ===== 表单绑定（委托至 setting/setting-form-binder） =====

    /** 从 storageManager 加载设置并回填到设置表单各输入项。 */
    async loadForm(): Promise<void> {
        return loadForm(this);
    }

    /** 保存设置表单到 storageManager 并刷新页面/相关插件。 */
    async saveForm(): Promise<void> {
        return saveForm(this);
    }

    /** 绑定设置弹层内各按钮/输入的点击/输入事件。 */
    bindClick(): void {
        bindClick(this);
    }

    /** 初始化简化设置面板表单（回填值 + 绑定即时生效的 change/input 事件）。 */
    async initSimpleSettingForm(): Promise<void> {
        return initSimpleSettingForm(this);
    }

    // ===== 缓存管理（委托至 setting/cache-management） =====

    /** 刷新单个缓存项的统计信息（大小 + 条目数）。 */
    refreshCacheStats(cacheKey: string): void {
        refreshCacheStats(this, cacheKey);
    }

    /** 刷新预加载配置面板的缓存状态显示。 */
    refreshPreloadCacheStats(): void {
        refreshPreloadCacheStats(this);
    }

    /** 刷新所有缓存项的统计信息 + 总占用大小。 */
    refreshAllCacheStats(): void {
        refreshAllCacheStats(this);
    }

    // ===== 数据导入导出（委托至 setting/data-import-export） =====

    /** 从本地 JSON 文件导入数据（覆盖确认 + reload）。 */
    importData(): void {
        importData(this);
    }

    /** 导出本地 JSON 数据文件。 */
    async exportData(): Promise<void> {
        return exportData(this);
    }

    /** 构造备份 payload（IndexedDB 全量 + 元信息 + localStorage/GM 清单数据）。 */
    async buildBackupPayload(
        settings: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        return buildBackupPayload(settings);
    }

    // ===== WebDav 操作（委托至 setting/webdav-operations） =====

    /** 通过 WebDav 备份数据（明文上传）。 */
    async backupDataByWebDav(): Promise<void> {
        return backupDataByWebDav(this);
    }

    /** 通过 WebDav 查看备份文件列表。 */
    async backupListBtnByWebDav(): Promise<void> {
        return backupListBtnByWebDav(this);
    }

    /** 打开备份文件列表弹层（Tabulator 表格，含删除/下载/导入操作）。 */
    openFileListDialog(
        backupList: WebDavFileItem[],
        webdavClient: WebDavClient,
        titlePrefix: string
    ): void {
        openFileListDialog(this, backupList, webdavClient, titlePrefix);
    }
}
