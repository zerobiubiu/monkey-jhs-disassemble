// 鉴黄师 用户脚本入口
//
// 由 archetype/jhs.user.js（单文件 11000+ 行混淆脚本）拆分重构而来。
// 原整体逻辑曾迁入 src/legacy/jhs.ts（@ts-nocheck）作为过渡载体，
// 现已将其全部内容移入本文件并完成类型化（去 @ts-nocheck），
// src/legacy 目录随之废弃删除。
// 入口负责触发启动序列执行，保证打包产物在功能逻辑与执行效果上
// 与原始脚本一致。后续将逐步把各模块从本文件进一步提取为正式 TS 模块。
//
// 详见 doc/ 目录下的迁移文档。

import './core/libs';
import { isJavdbSite, isMissavSite } from './constants/site';
import loadingCssRaw from './styles/loading.css?raw';
import viewerCssRaw from './styles/viewer.css?raw';
import loggerCssRaw from './styles/logger.css?raw';
import javdbSiteCssRaw from './styles/javdb-site.css?raw';
import commonToolbarCssRaw from './styles/common-toolbar.css?raw';
import aNormalButtonsCssRaw from './styles/a-normal-buttons.css?raw';
import { injectCss } from './core/style-injector';
import { loadGfriends, filetreeDb } from './core/gfriends';
import { WebDavClient } from './core/webdav';
import { createLoading } from './core/loading';
import { show } from './core/toast';
import { VIEWER_CONFIG } from './core/viewer';
import { jsxToString } from './core/jsx-to-string';
import { TemporaryImageContainer } from './components/temporary-image-container';
import { Logger } from './core/logger';
import { StorageManager } from './core/storage-manager';
import { CommonUtil } from './core/common-util';
import { GmHttp } from './core/gm-http';
import { setupLayerWrapper } from './core/layer-wrapper';
import { setupTooltip } from './core/tooltip';
import { encryptCredential, decryptCredential } from './core/webdav-crypto';
import { PluginManager } from './plugins/plugin-manager';
import { DetailPagePlugin } from './plugins/detail-page-plugin';
import { HighlightMagnetPlugin } from './plugins/highlight-magnet-plugin';
import { FoldCategoryPlugin } from './plugins/fold-category-plugin';
import { ActressInfoPlugin } from './plugins/actress-info-plugin';
import { HitShowPlugin } from './plugins/hit-show-plugin';
import { Top250Plugin } from './plugins/top250-plugin';
import { NavBarPlugin } from './plugins/nav-bar-plugin';
import { OtherSitePlugin } from './plugins/other-site-plugin';
import { ReviewPlugin } from './plugins/review-plugin';
import { ListPageButtonPlugin } from './plugins/list-page-button-plugin';
import { AutoPagePlugin } from './plugins/auto-page-plugin';
import { BlacklistPlugin } from './plugins/blacklist-plugin';
import { WantAndWatchedVideosPlugin } from './plugins/want-and-watched-videos-plugin';
import { RelatedPlugin } from './plugins/related-plugin';
import { FavoriteActressesPlugin } from './plugins/favorite-actresses-plugin';
import { NewVideoPlugin } from './plugins/new-video-plugin';
import { HistoryPlugin } from './plugins/history-plugin';
import { SettingPlugin } from './plugins/setting-plugin';
import { DetailPageButtonPlugin } from './plugins/detail-page-button-plugin';
import { ListPagePlugin } from './plugins/list-page-plugin';
import { PreviewVideoPlugin } from './plugins/preview-video-plugin';
import { RatingDisplayPlugin } from './plugins/rating-display/rating-display-plugin';
import { Fc2Plugin } from './plugins/fc2-plugin';
import { KeyPageTurningPlugin } from './plugins/key-page-turning-plugin';
import { ModMyListOpenWayPlugin } from './plugins/mod-my-list-open-way-plugin';
import { PageSortPlugin } from './plugins/page-sort-plugin';
import { StatusTagFilterPlugin } from './plugins/status-tag-filter-plugin';
import { ListWaterfallPlugin } from './plugins/list-waterfall-plugin';
import { ListReadingStatusPlugin } from './plugins/list-reading-status-plugin';
import { ModalListDisablerPlugin } from './plugins/modal-list-disabler-plugin';
import { VideoListsTagPlugin } from './plugins/video-lists-tag/vlt-plugin';
import { CarListReaderPlugin } from './plugins/car-status-sync/car-list-reader-plugin';
import { VisitHistoryPlugin } from './plugins/visit-history-plugin';
import { MissavStatusTagPlugin } from './plugins/car-status-sync/missav-status-tag-plugin';
import { MissavQuickCopyPlugin } from './plugins/missav-quick-copy-plugin';
import { featureFlags } from './core/feature-flags';
import { TranslatePlugin } from './plugins/translate-plugin';
import { ScreenShotPlugin } from './plugins/screenshot-plugin';
import { MagnetHubPlugin } from './plugins/magnet-hub-plugin';
import { ImageRecognitionPlugin } from './plugins/image-recognition-plugin';
import { Fc2By123AvPlugin } from './plugins/fc2-by-123av-plugin';

// ===== 全局 Window 接口扩展 =====
// 声明启动序列挂载到 window 的运行时属性类型。
// 高权限服务仅挂到 userscript 沙箱 window，不暴露给页面 unsafeWindow。
declare global {
    interface Window {
        utils: CommonUtil;
        gmHttp: GmHttp;
        storageManager: StorageManager;
        loadGfriends: typeof loadGfriends;
        filetreeDb: typeof filetreeDb;
        WebDavClient: typeof WebDavClient;
        refresh: () => void;
        cleanCache_filter_actor_actress_car_list: () => void;
        clean_cacheSettingObj: () => void;
        loading: typeof createLoading;
        show: typeof show;
        showImageViewer: (src: any, alt?: string) => void;
        clog: Logger;
        pluginManager: PluginManager;
        encryptCredential: typeof encryptCredential;
        decryptCredential: typeof decryptCredential;
        isDetailPage: boolean;
        isListPage: boolean;
        isFc2Page: boolean;
    }
}

// ===== CSS replace（原 M/N/j/E/F/H → 语义化命名） =====
let javdbHideNavCss: string = '';
if (window.location.href.includes('hideNav=1')) {
    javdbHideNavCss =
        '\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ';
}
const javdbSiteCss = javdbSiteCssRaw.replace('/*__HIDENAV2__*/', javdbHideNavCss);
function generateScrollbarCss(): string {
    const scrollbarSelectors: string[] = [
        '.jhs-scrollbar',
        '.content-panel',
        '.tabulator-tableholder',
        '.has-navbar-fixed-top',
        '.layui-layer-content'
    ];
    const appendPseudo = (selectors: string[], pseudo: string) =>
        selectors.map((selector: string) => `${selector}${pseudo}`).join(',');
    const trackPseudo = '::-webkit-scrollbar-track';
    const thumbPseudo = '::-webkit-scrollbar-thumb';
    const thumbHoverPseudo = '::-webkit-scrollbar-thumb:hover';
    return `\n    ${appendPseudo(scrollbarSelectors, '::-webkit-scrollbar')}{width:6px;height:6px;}\n    ${appendPseudo(scrollbarSelectors, trackPseudo)}{background:#f1f1f1;border-radius:10px;}\n    ${appendPseudo(scrollbarSelectors, thumbPseudo)}{background:#888;border-radius:10px;}\n    ${appendPseudo(scrollbarSelectors, thumbHoverPseudo)}{background:#555;}\n    `
        .trim()
        .replace(/\n/g, '');
}
const commonToolbarCss = commonToolbarCssRaw.replace('/*__SCROLLBAR__*/', generateScrollbarCss());
if (isJavdbSite) {
    injectCss(javdbSiteCss);
}
injectCss(aNormalButtonsCssRaw);
injectCss(commonToolbarCss);

// ===== 运行时全局挂载（utils/gmHttp/storageManager/gt/lt/De） =====
window.utils = new CommonUtil();
window.gmHttp = new GmHttp();
window.storageManager = new StorageManager();
window.loadGfriends = loadGfriends;
window.filetreeDb = filetreeDb;
window.WebDavClient = WebDavClient;

// ===== BroadcastChannel 跨标签页刷新/清缓存（原 G → refreshChannel） =====
const refreshChannel = new BroadcastChannel('channel-refresh');
window.refresh = function () {
    refreshChannel.postMessage({
        type: 'refresh'
    });
};
window.cleanCache_filter_actor_actress_car_list = function () {
    refreshChannel.postMessage({
        type: 'cleanCache_filter_actor_actress_car_list'
    });
};
window.clean_cacheSettingObj = function () {
    refreshChannel.postMessage({
        type: 'clean_cacheSettingObj'
    });
};

// ===== loading CSS 注入 + loading/show 挂载 =====
injectCss(loadingCssRaw);
window.loading = createLoading;
window.show = show;

// ===== 图片查看器（原 window.showImageViewer） =====
(function () {
    function resetOverflow(delay = 10) {
        setTimeout(() => {
            const shadeCount = document.querySelectorAll('.layui-layer-shade').length;
            document.documentElement.style.overflow = shadeCount > 0 ? 'hidden' : '';
        }, delay);
    }
    injectCss(viewerCssRaw);
    window.showImageViewer = function (src: any, alt: string = '') {
        let container: any = null;
        let isTemporary = false;
        if (typeof src == 'string' || src instanceof String) {
            container = $(
                jsxToString(<TemporaryImageContainer src={String(src)} alt={alt} />)
            ).appendTo('body');
            isTemporary = true;
        } else {
            container = $(src);
        }
        const viewerRef: { current: any } = { current: null };
        const viewerOptions = VIEWER_CONFIG({
            container,
            isTemporary,
            resetOverflow,
            viewerRef
        });
        viewerRef.current = new Viewer(container[0], viewerOptions);
        viewerRef.current.show();
    };
})();

// ===== 日志控制台 clog + 全局异常捕获（原 async IIFE） =====
(async function () {
    injectCss(loggerCssRaw);
    window.clog = new Logger();
    (function () {
        const logger = window.clog || console;
        window.addEventListener('error', function (event) {
            const filename = event.filename;
            const message = event.message;
            if (!filename.includes('javdb')) {
                logger.error(`[全局 Error 异常捕获] ${message} 来源: ${filename}`);
            }
        });
        window.addEventListener('unhandledrejection', function (event) {
            const reason = event.reason;
            const reasonMessage = (reason == null ? undefined : reason.message) ?? '';
            if (reasonMessage.includes('play()')) {
                return;
            }
            if (reasonMessage.includes('The element has no supported sources')) {
                show.error('播放失败, 请检查是否已对节点分流?');
                logger.error('播放失败, 请检查是否已对节点分流?');
                return;
            }
            if (reasonMessage.includes('<span>1005</span>') && reasonMessage.includes('fc2ppvdb')) {
                return;
            }
            const logMessage = `[全局 Promise 异常捕获] ${reasonMessage || String(reason)}`;
            logger.error(logMessage, reason);
            event.preventDefault();
        });
    })();
    document.addEventListener('mousedown', (event) => {
        const clog = window.clog;
        if (!clog.isInitialized || !clog.container) {
            return;
        }
        const target = event.target as HTMLElement;
        const loggerSelectors = [
            '.console-logger-container',
            '.layui-layer-shade',
            '.loading-container'
        ].join(',');
        if (target.closest(loggerSelectors)) {
            clog.highZIndex();
        } else {
            clog.lowZIndex();
        }
    });
})();

// ===== Tooltip =====
setupTooltip();

// WebDav 加密/解密辅助函数仅挂到沙箱 window，供现有 setting-plugin 调用。
window.encryptCredential = encryptCredential;
window.decryptCredential = decryptCredential;
setupLayerWrapper();

// 库 CSS（layer/toastify/viewer/tabulator）已由 src/core/libs.ts 以 ESM import
// 打包进产物，运行时注入 <style>，不再走 utils.importResource CDN 动态加载。

// ===== 启动序列：PluginManager + 注册 40 插件（JavDB 38 + MissAV 2） =====
const pluginManager: PluginManager = (function () {
    const manager = new PluginManager();
    window.pluginManager = manager;
    if (isJavdbSite) {
        manager.register(ListPagePlugin);
        manager.register(AutoPagePlugin);
        manager.register(FoldCategoryPlugin);
        manager.register(ListPageButtonPlugin);
        manager.register(HistoryPlugin);
        manager.register(SettingPlugin);
        manager.register(NavBarPlugin);
        manager.register(HitShowPlugin);
        manager.register(Top250Plugin);
        manager.register(DetailPagePlugin);
        manager.register(ReviewPlugin);
        manager.register(DetailPageButtonPlugin);
        manager.register(HighlightMagnetPlugin);
        manager.register(PreviewVideoPlugin);
        manager.register(ActressInfoPlugin);
        manager.register(OtherSitePlugin);
        manager.register(WantAndWatchedVideosPlugin);
        manager.register(RelatedPlugin);
        manager.register(BlacklistPlugin);
        manager.register(FavoriteActressesPlugin);
        manager.register(NewVideoPlugin);
        manager.register(RatingDisplayPlugin);
        manager.register(Fc2Plugin);
        manager.register(KeyPageTurningPlugin);
        manager.register(ModMyListOpenWayPlugin);
        manager.register(PageSortPlugin);
        manager.register(StatusTagFilterPlugin);
        manager.register(ListWaterfallPlugin);
        manager.register(ListReadingStatusPlugin);
        manager.register(ModalListDisablerPlugin);
        manager.register(VideoListsTagPlugin);
        manager.register(CarListReaderPlugin);
        manager.register(VisitHistoryPlugin);
        // 升级新插件（feature flag 可插拔）
        if (featureFlags.translatePlugin) manager.register(TranslatePlugin);
        if (featureFlags.screenShotPlugin) manager.register(ScreenShotPlugin);
        if (featureFlags.magnetHubPlugin) manager.register(MagnetHubPlugin);
        if (featureFlags.imageRecognitionPlugin) manager.register(ImageRecognitionPlugin);
        if (featureFlags.fc2By123AvPlugin) manager.register(Fc2By123AvPlugin);
    }
    // MissAV 站点单独注册 missav 专属插件（不注册 javdb 的 33 个插件）
    if (isMissavSite) {
        manager.register(MissavStatusTagPlugin);
        manager.register(MissavQuickCopyPlugin);
    }
    return manager;
})();

// ===== 启动序列：页面判定 + storage 合并 + 插件执行 =====
(async function () {
    await pluginManager.processCss();
    window.isDetailPage = (function () {
        const href = window.location.href;
        return href.split('?')[0].includes('/v/');
    })();
    window.isListPage = (function () {
        const href = window.location.href;
        return $('.movie-list').length > 0 || href.includes('advanced_search');
    })();
    window.isFc2Page = (function () {
        const href = window.location.href;
        return href.includes('advanced_search?type=3') || href.includes('advanced_search?type=100');
    })();
    // storageManager 合并操作仅在 javdb 站点执行（missav 站点无 jhs 数据，跳过避免创建空库）
    if (isJavdbSite) {
        const storageStartupTasks: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
            ['merge_table_name', () => storageManager.merge_table_name()],
            ['clean_no_url_blacklist', () => storageManager.clean_no_url_blacklist()],
            ['async_merge_other', () => storageManager.async_merge_other()],
            ['merge_blacklist', () => storageManager.merge_blacklist()],
            ['merge_favoriteActress', () => storageManager.merge_favoriteActress()],
            ['merge_tow_car_list_table', () => storageManager.merge_tow_car_list_table()]
        ];
        for (const [taskName, runTask] of storageStartupTasks) {
            try {
                await runTask();
            } catch (error: unknown) {
                window.clog.error(`[启动存储维护失败] ${taskName}`, error);
                // 后续维护依赖前序数据形态；失败后停止继续迁移，但仍允许插件启动读取原数据。
                break;
            }
        }
    }
    if (isJavdbSite && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie)) {
        show.error('请切换到中文语言下才可正常使用本脚本', {
            duration: -1
        });
    }
    await pluginManager.processPlugins();
    // 自动备份：插件执行后触发（每天第一次打开 / 每次打开，由设置控制）
    if (isJavdbSite) {
        const settingPlugin = pluginManager.getBean('SettingPlugin') as SettingPlugin;
        if (settingPlugin) {
            settingPlugin.autoBackup().then();
        }
    }
})();
