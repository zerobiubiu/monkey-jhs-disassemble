/**
 * 详情页按钮插件 DetailPageButtonPlugin —— 对应原脚本 archetype/jhs.user.js L5118-6440。
 *
 * 在影片详情页注入顶部工具按钮组（屏蔽/收藏/已观看/磁力过滤/字幕搜索）、
 * 自动同步 JavDB 原生「想看/看過」状态到 JHS IndexedDB（MutationObserver 监听
 * .review-buttons 变化，三重通道广播）、注入星星评分组件与清单平铺面板、
 * 绑定快捷键（屏蔽/收藏/已观看/快进预览视频）、迅雷/SubTitleCat 字幕搜索与预览。
 *
 * 方法实现已按功能域拆分至 ./detail-page-button/ 子目录：
 * - dpb-want-watched.ts — 想看/已观看 MutationObserver 同步 + 广播
 * - dpb-rating.ts — 星星评分组件 + javdb 原生评价 API
 * - dpb-list-panel.ts — 清单平铺面板（ensure/init/分页/渲染）
 * - dpb-subtitle.ts — 迅雷字幕搜索与预览
 * - dpb-helpers.ts — 纯 DOM 轮询辅助
 * - dpb-types.ts — 共享类型
 *
 * 本文件保留所有公共方法签名（getBean 可达面），方法体委托至对应辅助模块。
 */
import { isJavdbSite } from '../constants/site';
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    BLOCK_TEXT,
    BLOCKED_TEXT,
    BLOCK_COLOR,
    FAVORITE_TEXT,
    FAVORITED_TEXT,
    FAVORITE_COLOR,
    WATCHED_TEXT,
    WATCHED_COLOR,
    YES,
    NO
} from '../constants/status';

import { featureFlags } from '../core/feature-flags';
import type { PageType } from '../core/page-context';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';
import {
    hookWantAndWatchedButtons as _hookWantAndWatchedButtons,
    detectWantWatchedState as _detectWantWatchedState,
    onWantAdded as _onWantAdded,
    onWantRemoved as _onWantRemoved,
    onWatchedAdded as _onWatchedAdded,
    onWatchedRemoved as _onWatchedRemoved,
    removeCarIfStatus as _removeCarIfStatus,
    broadcastWantWatchedSync as _broadcastWantWatchedSync,
    setupWantWatchedSyncListener as _setupWantWatchedSyncListener,
    refreshItemStatusTag as _refreshItemStatusTag
} from './detail-page-button/dpb-want-watched';
import {
    addQuickActionButtons as _addQuickActionButtons,
    buildRatingBar as _buildRatingBar,
    injectRatingStyles as _injectRatingStyles,
    syncRatingBar as _syncRatingBar,
    setRatingBusy as _setRatingBusy,
    quickSetHasWatch as _quickSetHasWatch,
    quickBlock as _quickBlock,
    quickConvertToFav as _quickConvertToFav,
    triggerJavdbReview as _triggerJavdbReview,
    triggerJavdbWant as _triggerJavdbWant
} from './detail-page-button/dpb-rating';
import {
    ensureListPanel as _ensureListPanel,
    bindListPanelControls as _bindListPanelControls,
    forwardListPanelChange as _forwardListPanelChange,
    initListPanel as _initListPanel,
    syncListPanelInputState as _syncListPanelInputState,
    updateListPanelEntryState as _updateListPanelEntryState,
    scheduleListPanelSync as _scheduleListPanelSync,
    renderListPanel as _renderListPanel,
    createListPanelEntry as _createListPanelEntry,
    applyListPanelView as _applyListPanelView,
    showListPanelLoading as _showListPanelLoading,
    showListPanelError as _showListPanelError,
    isListContainerLoaded as _isListContainerLoaded,
    startListPanelLoadTimeout as _startListPanelLoadTimeout,
    clearListPanelLoadTimeout as _clearListPanelLoadTimeout,
    loadAllListPages as _loadAllListPages,
    fetchAllListPageEntries as _fetchAllListPageEntries,
    showListPanelNotice as _showListPanelNotice,
    clearListPanelNotice as _clearListPanelNotice
} from './detail-page-button/dpb-list-panel';
import type { DetailListPanelElement, DetailListEntry } from './detail-page-button/dpb-list-panel';
import {
    searchXunLeiSubtitle as _searchXunLeiSubtitle,
    previewSubtitle as _previewSubtitle
} from './detail-page-button/dpb-subtitle';
import { waitForDomChange as _waitForDomChange, waitForEl as _waitForEl } from './detail-page-button/dpb-helpers';
import type { WantWatchedState, WantWatchedSyncPayload } from './detail-page-button/dpb-types';

import { DetailMenuButtons } from '../components/dpb/detail-menu-buttons';
import { MagnetHubMountBox } from '../components/magnet-hub/magnet-hub-mount-box';

export class DetailPageButtonPlugin extends BasePlugin {
    /** .review-buttons MutationObserver 是否已安装（hookWantAndWatchedButtons）。 */
    _wantWatchedObserved: boolean = false;
    /** 上一次检测到的「想看/已观看」状态（用于差异比对）。 */
    _lastWantState: WantWatchedState | null = null;
    /** 正在执行同步操作（阻断 MutationObserver 防递归）。 */
    _wantWatchedSyncing: boolean = false;
    /** .review-buttons 变化防抖计时器。 */
    _wantWatchedDebounce: ReturnType<typeof setTimeout> | null = null;
    /** 同步监听器是否已安装（setupWantWatchedSyncListener）。 */
    _wantWatchedListenerInstalled: boolean = false;
    /** 星星评分组件是否已注入（addQuickActionButtons）。 */
    _quickActionAdded: boolean = false;
    /** 清单面板是否已确保创建（_ensureListPanel）。 */
    _listPanelEnsured: boolean = false;
    /** 清单面板是否正在初始化（_initListPanel）。 */
    _listPanelIniting: boolean = false;
    /** 清单 ajax 是否已触发加载（_initListPanel）。 */
    _listAjaxTriggered: boolean = false;
    /** 观察稳定 modal 外壳，支持其内部 listContainer 被整体替换。 */
    _listPanelObserver: MutationObserver | null = null;
    /** 清单面板重绘防抖计时器。 */
    _listPanelSyncTimer: number | null = null;
    /** 清单原生数据加载超时计时器。 */
    _listPanelLoadTimer: number | null = null;
    /** 聚合 `/users/simple_lists` 全部分页的单飞任务。 */
    _listPanelPaginationPromise: Promise<void> | null = null;
    /** modal 源条目被替换时递增，阻止旧分页快照覆盖新容器。 */
    _listPanelPaginationGeneration: number = 0;
    /** 评分组件重建防抖计时器。 */
    _ratingSyncDebounce: ReturnType<typeof setTimeout> | null = null;
    /** javdb 原生评价操作串行化链（quickSetHasWatch / quickConvertToFav）。 */
    _reviewChain: Promise<void> | null = null;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L5119-5121。 */
    getName(): string {
        return 'DetailPageButtonPlugin';
    }

    /** 仅在详情页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail'];
    }

    /**
     * 详情页主处理：隐藏视频控件；仅详情页时创建菜单按钮、挂钩想看/看過同步、
     * 注入快捷评分组件、安装同步监听器。对应原 L5126-5140。
     */
    async handle(): Promise<void> {
        this.hideVideoControls();
        if (window.isDetailPage) {
            this.createMenuBtn();
            this.hookWantAndWatchedButtons();
            this.addQuickActionButtons();
            this.setupWantWatchedSyncListener();
        }
    }

    /**
     * 创建详情页顶部工具按钮组（屏蔽/收藏/已观看/磁力过滤/字幕搜索）并绑定事件。
     * 对应原 L5141-5182。注入 .tabs 后方。
     */
    async createMenuBtn(): Promise<void> {
        const pageInfo = this.getPageInfo();
        const carNum = pageInfo.carNum!;
        const menuHtml = jsxToString(
            <DetailMenuButtons
                filterText={BLOCK_TEXT}
                filterColor={BLOCK_COLOR}
                favoriteText={FAVORITE_TEXT}
                favoriteColor={FAVORITE_COLOR}
                watchedText={WATCHED_TEXT}
                watchedColor={WATCHED_COLOR}
                showMagnetSearch={featureFlags.magnetHubPlugin}
            />
        );
        if (isJavdbSite) {
            $('.tabs').after(menuHtml);
        }
        $('#favoriteBtn').on('click', () => this.favoriteOne());
        $('#filterBtn').on('click', (event: MouseEvent) => this.filterOne(event));
        $('#hasWatchBtn').on('click', async () => this.hasWatchOne());
        const highlightPlugin = this.getBean('HighlightMagnetPlugin');
        const enableFilter = await storageManager.getSetting('enableMagnetsFilter', YES);
        $('#magnets-span').text(enableFilter === YES ? '关闭磁力过滤' : '开启磁力过滤');
        if (enableFilter === YES) {
            highlightPlugin.doFilterMagnet();
        }
        $('#enable-magnets-filter').on('click', (_event: unknown) => {
            const $span = $('#magnets-span');
            if ($span.text() === '关闭磁力过滤') {
                highlightPlugin.showAll();
                $span.text('开启磁力过滤');
                storageManager.saveSettingItem('enableMagnetsFilter', NO);
            } else {
                highlightPlugin.doFilterMagnet();
                $span.text('关闭磁力过滤');
                storageManager.saveSettingItem('enableMagnetsFilter', YES);
            }
        });
        $('#search-subtitle-btn').on('click', (event: MouseEvent) =>
            utils.openPage(
                `https://subtitlecat.com/index.php?search=${carNum}`,
                carNum,
                false,
                event
            )
        );
        $('#xunLeiSubtitleBtn').on('click', () => this.searchXunLeiSubtitle(carNum));
        // 磁力搜索按钮（#magnetSearchBtn）由 DetailMenuButtons 组件右行渲染，
        // 此处仅绑定 click 事件（MagnetHubPlugin，feature flag 控制）。
        if (featureFlags.magnetHubPlugin) {
            $('#magnetSearchBtn').on('click', () => {
                const hub = this.getBean('MagnetHubPlugin');
                if (!hub) return;
                layer.open({
                    type: 1,
                    title: `磁力搜索 - ${carNum}`,
                    content: jsxToString(<MagnetHubMountBox />),
                    area: utils.getResponsiveArea(['80%', '80%']),
                    success: () => {
                        $('#magnet-hub-mount').append(hub.createMagnetHub(carNum ?? ''));
                    }
                });
            });
        }
        this.showStatus(carNum).then();
    }

    /**
     * 按当前 JHS 记录状态刷新三个菜单按钮文案（屏蔽/收藏/已观看）。
     * 对应原 L5183-5204。末尾 case 无 break 合规（无下一分支可穿透）。
     * @param carNum 番号
     */
    async showStatus(carNum: string): Promise<void> {
        const $filterSpan = $('#filterBtn span');
        const $favoriteSpan = $('#favoriteBtn span');
        const $hasWatchSpan = $('#hasWatchBtn span');
        $filterSpan.text(BLOCK_TEXT);
        $favoriteSpan.text(FAVORITE_TEXT);
        $hasWatchSpan.text(WATCHED_TEXT);
        const carRecord = await storageManager.getCar(carNum);
        if (carRecord) {
            switch (carRecord.status) {
                case FILTER_ACTION:
                    $filterSpan.text(BLOCKED_TEXT);
                    break;
                case FAVORITE_ACTION:
                    $favoriteSpan.text(FAVORITED_TEXT);
                    break;
                case HAS_WATCH_ACTION:
                    $hasWatchSpan.text('🔍 已标记观看');
            }
        }
    }

    // ── 想看/已观看同步（dpb-want-watched.ts）──────────────────────────────

    hookWantAndWatchedButtons(): void { _hookWantAndWatchedButtons(this); }
    detectWantWatchedState(container: Element): WantWatchedState { return _detectWantWatchedState(container); }
    async onWantAdded(): Promise<void> { return _onWantAdded(this); }
    async onWantRemoved(): Promise<void> { return _onWantRemoved(this); }
    async onWatchedAdded(): Promise<void> { return _onWatchedAdded(this); }
    async onWatchedRemoved(): Promise<void> { return _onWatchedRemoved(this); }
    async removeCarIfStatus(carNum: string, status: string): Promise<boolean> { return _removeCarIfStatus(carNum, status); }
    broadcastWantWatchedSync(payload: WantWatchedSyncPayload): void { _broadcastWantWatchedSync(payload); }
    setupWantWatchedSyncListener(): void { _setupWantWatchedSyncListener(this); }
    refreshItemStatusTag(carNum: string): void { _refreshItemStatusTag(this, carNum); }

    // ── 星星评分 + javdb 原生评价 API（dpb-rating.ts）─────────────────────

    addQuickActionButtons(): void { _addQuickActionButtons(this); }
    _buildRatingBar(nav: Element): void { _buildRatingBar(this, nav); }
    _injectRatingStyles(): void { _injectRatingStyles(); }
    _syncRatingBar(): void { _syncRatingBar(this); }
    _setRatingBusy(busy: boolean): void { _setRatingBusy(busy); }
    async quickSetHasWatch(score: number): Promise<void> { return _quickSetHasWatch(this, score); }
    async quickBlock(): Promise<void> { return _quickBlock(this); }
    async quickConvertToFav(): Promise<void> { return _quickConvertToFav(this); }
    async _triggerJavdbReview(score: number): Promise<void> { return _triggerJavdbReview(this, score); }
    async _triggerJavdbWant(): Promise<void> { return _triggerJavdbWant(this); }

    // ── 清单平铺面板（dpb-list-panel.ts）──────────────────────────────────

    _ensureListPanel(nav: HTMLElement): void { _ensureListPanel(this, nav); }
    _bindListPanelControls(panel: DetailListPanelElement): void { _bindListPanelControls(this, panel); }
    _forwardListPanelChange(panel: DetailListPanelElement, displayInput: HTMLInputElement): void { _forwardListPanelChange(this, panel, displayInput); }
    _initListPanel(forceReload = false): void { _initListPanel(this, forceReload); }
    _syncListPanelInputState(sourceInput: HTMLInputElement): void { _syncListPanelInputState(this, sourceInput); }
    _updateListPanelEntryState(input: HTMLInputElement): void { _updateListPanelEntryState(input); }
    _scheduleListPanelSync(delay = 48): void { _scheduleListPanelSync(this, delay); }
    _renderListPanel(): void { _renderListPanel(this); }
    _createListPanelEntry(source: Element): DetailListEntry | null { return _createListPanelEntry(this, source); }
    _applyListPanelView(panel: DetailListPanelElement): void { _applyListPanelView(panel); }
    _showListPanelLoading(panel: DetailListPanelElement): void { _showListPanelLoading(this, panel); }
    _showListPanelError(panel: DetailListPanelElement, message: string): void { _showListPanelError(this, panel, message); }
    _isListContainerLoaded(container: Element | null): container is Element { return _isListContainerLoaded(container); }
    _startListPanelLoadTimeout(panel: DetailListPanelElement): void { _startListPanelLoadTimeout(this, panel); }
    _clearListPanelLoadTimeout(): void { _clearListPanelLoadTimeout(this); }
    _loadAllListPages(panel: DetailListPanelElement, container: HTMLElement): void { _loadAllListPages(this, panel, container); }
    async _fetchAllListPageEntries(videoId: string): Promise<Element[]> { return _fetchAllListPageEntries(videoId); }
    _showListPanelNotice(panel: DetailListPanelElement, message: string): void { _showListPanelNotice(this, panel, message); }
    _clearListPanelNotice(panel: DetailListPanelElement): void { _clearListPanelNotice(panel); }

    // ── 字幕搜索与预览（dpb-subtitle.ts）──────────────────────────────────

    searchXunLeiSubtitle(carNum: string): void { _searchXunLeiSubtitle(this, carNum); }
    async previewSubtitle(url: string, filename: string): Promise<void> { return _previewSubtitle(url, filename); }

    // ── 纯 DOM 辅助（dpb-helpers.ts）──────────────────────────────────────

    _waitForDomChange(selector: string, ms: number): Promise<Element | null> { return _waitForDomChange(selector, ms); }
    _waitForEl(fn: () => unknown, ms: number): Promise<unknown> { return _waitForEl(fn, ms); }

    // ── 菜单按钮操作（保留在类内）─────────────────────────────────────────

    /**
     * 收藏当前影片（写入 JHS favorite）。对应原 L6112-6124。
     */
    async favoriteOne(): Promise<void> {
        const pageInfo = this.getPageInfo();
        await storageManager.saveCar({
            carNum: pageInfo.carNum!,
            url: pageInfo.url ?? undefined,
            names: pageInfo.actress ?? undefined,
            actionType: FAVORITE_ACTION,
            publishTime: pageInfo.publishTime ?? undefined
        });
        this.showStatus(pageInfo.carNum!).then();
        refresh();
        utils.closePage();
    }

    /**
     * 标记当前影片为已观看（写入 JHS hasWatch）。对应原 L6125-6137。
     */
    async hasWatchOne(): Promise<void> {
        const pageInfo = this.getPageInfo();
        await storageManager.saveCar({
            carNum: pageInfo.carNum!,
            url: pageInfo.url ?? undefined,
            names: pageInfo.actress ?? undefined,
            actionType: HAS_WATCH_ACTION,
            publishTime: pageInfo.publishTime ?? undefined
        });
        this.showStatus(pageInfo.carNum!).then();
        refresh();
        utils.closePage();
    }

    /**
     * 屏蔽当前影片。对应原 L6267-6306。
     * @param event 点击事件（可 null）
     */
    async filterOne(event: MouseEvent | null): Promise<void> {
        if (event) {
            event.preventDefault();
        }
        const pageInfo = this.getPageInfo();
        utils.q(event, `是否屏蔽${pageInfo.carNum}?`, async () => {
            await storageManager.saveCar({
                carNum: pageInfo.carNum!,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: FILTER_ACTION,
                publishTime: pageInfo.publishTime ?? undefined
            });
            this.showStatus(pageInfo.carNum!).then();
            refresh();
            utils.closePage();
        });
    }

    /**
     * 快进预览视频 5 秒（预览视频/iframe/容器/按钮多路径处理）。对应原 L6307-6338。
     */
    speedVideo(): void {
        if ($('#preview-video').is(':visible')) {
            const videoEl = document.getElementById('preview-video') as HTMLVideoElement | null;
            if (videoEl) {
                videoEl.muted = false;
                videoEl.controls = false;
                if (videoEl.currentTime + 5 < videoEl.duration) {
                    videoEl.currentTime += 5;
                } else {
                    show.info('预览视频结束, 已回到开头');
                    videoEl.currentTime = 1;
                }
            }
            return;
        }
        const $iframe = $('iframe[id^="layui-layer-iframe"]');
        if ($iframe.length > 0) {
            ($iframe[0] as HTMLIFrameElement).contentWindow?.postMessage('speedVideo', '*');
            return;
        }
        const $container = $('.preview-video-container');
        if ($container.length > 0) {
            $container[0].click();
            const videoEl = document.getElementById('preview-video') as HTMLVideoElement | null;
            if (videoEl) {
                videoEl.currentTime += 5;
                videoEl.muted = false;
            }
        } else {
            $('#javTrailersBtn').click();
        }
    }

    /**
     * 鼠标移入预览视频时显示原生控件。对应原 L6339-6343。
     */
    hideVideoControls(): void {
        $(document).on('mouseenter', '#preview-video', function (this: HTMLElement) {
            $(this).prop('controls', true);
        });
    }
}
