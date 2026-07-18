/**
 * 详情页按钮插件 DetailPageButtonPlugin —— 对应原脚本 archetype/jhs.user.js L5118-6440。
 *
 * 在影片详情页注入顶部工具按钮组（屏蔽/收藏/已观看/磁力过滤/字幕搜索）、
 * 自动同步 JavDB 原生「想看/看過」状态到 JHS IndexedDB（MutationObserver 监听
 * .review-buttons 变化，三重通道广播）、注入星星评分组件与清单平铺面板、
 * 绑定快捷键（屏蔽/收藏/已观看/快进预览视频）、迅雷/SubTitleCat 字幕搜索与预览。
 *
 * JS→TS 改造要点：
 * - 单字母局部变量（原 e/t/n/a/i/s/r/l/o/c/d/h/p/m/u/f/v/b/w/k/S/_/C 等）已语义化命名。
 * - 站点布尔 r 改由 ../constants/site 引入（isJavdbSite）；
 *   状态动作 d/h/p 与展示文本/颜色 m/u/f/v/b/w/k/S 与布尔标识 _/C 改由
 *   ../constants/status 引入（FILTER_ACTION/FAVORITE_ACTION/HAS_WATCH_ACTION/
 *   BLOCK_TEXT/BLOCKED_TEXT/BLOCK_COLOR/FAVORITE_TEXT/FAVORITED_TEXT/FAVORITE_COLOR/
 *   WATCHED_TEXT/WATCHED_COLOR/YES/NO）。
 * - window.isDetailPage 为运行时挂载全局，以 (window as any).isDetailPage 访问；
 *   window.refresh() 以全局 refresh() 调用（src/types/globals.d.ts 已声明）。
 * - 动态挂载到 this 的内部状态字段（_wantWatchedObserved / _lastWantState /
 *   _wantWatchedSyncing / _wantWatchedDebounce / _wantWatchedListenerInstalled /
 *   _quickActionAdded / _listPanelEnsured / _listPanelIniting / _listAjaxTriggered /
 *   _ratingSyncDebounce / _reviewChain）显式声明为 class 字段，保留原 this.X 读写路径。
 * - DOM 元素的自定义属性（__jhsObserved / __jhsRatingObserved / __jhsListClickBound /
 *   __jhsListObserved）以 any 类型变量承载，规避 strict 类型检查；
 *   专用元素（meta/input/video）使用 HTMLMetaElement/HTMLInputElement/HTMLVideoElement。
 * - any 类型 callee（$/layer/Tabulator/utils/gmHttp 等）的回调参数显式标注 : any
 *   以规避 noImplicitAny；未使用的回调参数加 _ 前缀豁免 noUnusedParameters。
 * - catch (e) → catch (err: any)（strict useUnknownInCatchVariables）；空 catch (_)
 *   → catch {}（optional catch binding，ES2019+）。
 * - 内联 CSS/HTML（含 Tabulator 列配置、Rails JS 注入 <script>）原样保留，
 *   仅替换模板插值变量名；其余结构性 HTML/CSS 按 doc/06-component-html-string.md
 *   统一规定提取为组件或 .css + ?raw（组件现返回 JSX，经 jsxToString 转 HTML
 *   字符串，见 doc/20-detail-page-button-components-tsx.md）：
 *   - 菜单按钮组 menuHtml → DetailMenuButtons(props)（createMenuBtn 消费）
 *   - 评分条 bar.innerHTML → RatingBarHtml()（_buildRatingBar 消费）
 *   - 清单面板空 div → ListPanel()（_ensureListPanel 以 insertAdjacentHTML 消费）
 *   - 星星样式 <style> → src/styles/rating-bar.css + ?raw，由 _injectRatingStyles
 *     注入（保留 id=jhs-rating-styles 去重与 addQuickActionButtons 显式调用时序）
 *   - 两处 layer 弹窗 content（searchXunLeiSubtitle 字幕表格容器、
 *     previewSubtitle 字幕预览容器）提取为 SubtitleTableDialog / SubtitlePreviewDialog
 *     组件（返回 JSX），插件层以 content: jsxToString(<X {...props} />) 消费。
 *   - searchXunLeiSubtitle Tabulator 操作列 formatter 返回的预览/下载按钮 →
 *     SubtitleActionCell()（formatter 返回 jsxToString(<SubtitleActionCell />)，事件绑定仍由 onRendered 持有）
 *   - previewSubtitle 逐行拼接的 `<span style="color:#AAA;">${paddedNum}. </span>${line}\n` →
 *     SubtitleLine({ paddedNum, line })（逐行 output += 拼接）
 * - 控制流（分支、MutationObserver、try/catch/finally、fire-and-forget .then()、
 *   Promise 串行化 _reviewChain、IIFE、空 catch）与原脚本一致。
 */
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';
import { SubtitleActionCell } from '../components/subtitle-action-cell';
import { SubtitleLine } from '../components/subtitle-line';
import { SubtitlePreviewDialog } from '../components/subtitle-preview-dialog';
import { SubtitleTableDialog } from '../components/subtitle-table-dialog';
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
import { jsxToString } from '../core/jsx-to-string';
import { DetailMenuButtons } from '../components/detail-menu-buttons';
import { RatingBarHtml } from '../components/rating-bar-html';
import { ListPanel } from '../components/list-panel';
import ratingBarCssRaw from '../styles/rating-bar.css?raw';
import { autoRemoveFromPendingUpdateOnWatch } from './video-lists-tag/vlt-sync';

/** 「想看/已观看」状态推断结果（detectWantWatchedState 返回结构） */
interface WantWatchedState {
    want: boolean;
    watched: boolean;
}

/** 「想看/已观看」同步广播载荷（broadcastWantWatchedSync / setupWantWatchedSyncListener）
 *  score 仅在 hasWatch+add 时携带（详情页标记已读/评分时已知星级），
 *  供 RatingDisplayPlugin 直接写入评分缓存，免去列表页悬停远程抓取详情页。 */
interface WantWatchedSyncPayload {
    carNum: any;
    status: any;
    op: 'add' | 'remove';
    time?: number;
    /** 评分 1-5（仅 hasWatch+add 携带；0/未评分/想看/收藏不带） */
    score?: number;
}

export class DetailPageButtonPlugin extends BasePlugin {
    /** .review-buttons MutationObserver 是否已安装（hookWantAndWatchedButtons）。 */
    _wantWatchedObserved: boolean = false;
    /** 上一次检测到的「想看/已观看」状态（用于差异比对）。 */
    _lastWantState: WantWatchedState | null = null;
    /** 正在执行同步操作（阻断 MutationObserver 防递归）。 */
    _wantWatchedSyncing: boolean = false;
    /** .review-buttons 变化防抖计时器。 */
    _wantWatchedDebounce: any = null;
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
    /** 评分组件重建防抖计时器。 */
    _ratingSyncDebounce: any = null;
    /** javdb 原生评价操作串行化链（quickSetHasWatch / quickConvertToFav）。 */
    _reviewChain: Promise<void> | null = null;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L5119-5121。 */
    getName(): string {
        return 'DetailPageButtonPlugin';
    }

    /**
     * 详情页主处理：隐藏视频控件；仅详情页时创建菜单按钮、挂钩想看/看過同步、
     * 注入快捷评分组件、安装同步监听器。对应原 L5126-5140。
     */
    async handle(): Promise<void> {
        this.hideVideoControls();
        if ((window as any).isDetailPage) {
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
        const carNum = pageInfo.carNum;
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
        $('#filterBtn').on('click', (event: any) => this.filterOne(event));
        $('#hasWatchBtn').on('click', async () => this.hasWatchOne());
        const highlightPlugin = this.getBean('HighlightMagnetPlugin');
        const enableFilter = await storageManager.getSetting('enableMagnetsFilter', YES);
        $('#magnets-span').text(enableFilter === YES ? '关闭磁力过滤' : '开启磁力过滤');
        if (enableFilter === YES) {
            highlightPlugin.doFilterMagnet();
        }
        $('#enable-magnets-filter').on('click', (_event: any) => {
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
        $('#search-subtitle-btn').on('click', (event: any) =>
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
                    content: '<div id="magnet-hub-mount" style="padding:10px"></div>',
                    area: utils.getResponsiveArea(['80%', '80%']),
                    success: () => {
                        $('#magnet-hub-mount').append(hub.createMagnetHub(carNum));
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
    async showStatus(carNum: any): Promise<void> {
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

    /**
     * 监听 JavDB 原生「想看/看過」按钮变化，自动同步到 JHS。
     * 用 MutationObserver 监听 .review-buttons 子树变化，比对前后状态差异。
     * 对应原 L5217-5264。
     */
    hookWantAndWatchedButtons(): void {
        if (!isJavdbSite) return;
        if (this._wantWatchedObserved) return;
        const self = this;
        // 等待 .review-buttons 出现
        const ensure = () => {
            const container: any = document.querySelector(
                'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons'
            );
            if (!container) {
                setTimeout(ensure, 200);
                return;
            }
            if (container.__jhsObserved) return;
            container.__jhsObserved = true;
            self._wantWatchedObserved = true;
            // 记录初始状态
            self._lastWantState = self.detectWantWatchedState(container);
            const observer = new MutationObserver(() => {
                if (self._wantWatchedSyncing) return;
                // 防抖：连续多次变化合并
                clearTimeout(self._wantWatchedDebounce);
                self._wantWatchedDebounce = setTimeout(() => {
                    self._wantWatchedSyncing = true;
                    try {
                        const currentState = self.detectWantWatchedState(container);
                        const lastState = self._lastWantState || {
                            want: false,
                            watched: false
                        };
                        if (currentState.want !== lastState.want) {
                            if (currentState.want) self.onWantAdded();
                            else self.onWantRemoved();
                        }
                        if (currentState.watched !== lastState.watched) {
                            if (currentState.watched) self.onWatchedAdded();
                            else self.onWatchedRemoved();
                        }
                        self._lastWantState = currentState;
                    } finally {
                        self._wantWatchedSyncing = false;
                    }
                }, 150);
            });
            observer.observe(container, { childList: true, subtree: true });
        };
        ensure();
    }

    /**
     * 从 .review-buttons DOM 推断当前 JavDB 的「想看」和「已观看」状态。
     * 对应原 L5271-5285。
     * @param container .review-buttons 容器
     * @returns 状态推断结果
     */
    detectWantWatchedState(container: any): WantWatchedState {
        // is-info is-light tag = 我想看
        // is-success is-light tag = 我看過
        // 它们的 parent a[href] 指向 /users/want_watch_videos 或 /users/watched_videos
        const wantTag = container.querySelector(
            "a[href='/users/want_watch_videos'] .tag.is-info.is-light"
        );
        const watchedTag = container.querySelector(
            "a[href='/users/watched_videos'] .tag.is-success.is-light"
        );
        return {
            want: !!wantTag,
            watched: !!watchedTag
        };
    }

    /**
     * 检测到「想看」被勾选时的处理：写入 JHS favorite 并广播。
     * 对应原 L5290-5316。
     */
    async onWantAdded(): Promise<void> {
        const pageInfo = this.getPageInfo();
        try {
            // 避免重复写入同状态导致 _saveSingleCar 抛错
            const carRecord = await storageManager.getCar(pageInfo.carNum);
            if (carRecord && carRecord.status === FAVORITE_ACTION) {
                // 已为 favorite，不重复写
            } else {
                await storageManager.saveCar({
                    carNum: pageInfo.carNum,
                    url: pageInfo.url,
                    names: pageInfo.actress,
                    actionType: FAVORITE_ACTION,
                    publishTime: pageInfo.publishTime
                });
                this.broadcastWantWatchedSync({
                    carNum: pageInfo.carNum,
                    status: FAVORITE_ACTION,
                    op: 'add'
                });
                show.ok(`${pageInfo.carNum} 已收藏`);
            }
        } catch (err: any) {
            console.error('[JHS-想看自动同步] 写入失败', err);
        }
        this.showStatus(pageInfo.carNum).then();
    }

    /**
     * 检测到「想看」被取消时的处理：从 JHS 移除 favorite 并广播。
     * 对应原 L5321-5337。
     */
    async onWantRemoved(): Promise<void> {
        const pageInfo = this.getPageInfo();
        try {
            const removed = await this.removeCarIfStatus(pageInfo.carNum, FAVORITE_ACTION);
            if (removed) {
                this.broadcastWantWatchedSync({
                    carNum: pageInfo.carNum,
                    status: FAVORITE_ACTION,
                    op: 'remove'
                });
                show.ok(`${pageInfo.carNum} 已取消收藏`);
            }
        } catch (err: any) {
            console.error('[JHS-想看自动同步] 移除失败', err);
        }
        this.showStatus(pageInfo.carNum).then();
    }

    /**
     * 检测到「已观看」被勾选时的处理：写入 JHS hasWatch 并广播。
     * 对应原 L5342-5367。
     */
    async onWatchedAdded(): Promise<void> {
        const pageInfo = this.getPageInfo();
        try {
            const carRecord = await storageManager.getCar(pageInfo.carNum);
            if (carRecord && carRecord.status === HAS_WATCH_ACTION) {
                // 已为 hasWatch，不重复写
            } else {
                await storageManager.saveCar({
                    carNum: pageInfo.carNum,
                    url: pageInfo.url,
                    names: pageInfo.actress,
                    actionType: HAS_WATCH_ACTION,
                    publishTime: pageInfo.publishTime
                });
                this.broadcastWantWatchedSync({
                    carNum: pageInfo.carNum,
                    status: HAS_WATCH_ACTION,
                    op: 'add'
                });
                show.ok(`${pageInfo.carNum} 已标记看过`);
            }
        } catch (err: any) {
            console.error('[JHS-观看自动同步] 写入失败', err);
        }
        this.showStatus(pageInfo.carNum).then();
    }

    /**
     * 检测到「已观看」被取消时的处理：从 JHS 移除 hasWatch 并广播。
     * 对应原 L5372-5388。
     */
    async onWatchedRemoved(): Promise<void> {
        const pageInfo = this.getPageInfo();
        try {
            const removed = await this.removeCarIfStatus(pageInfo.carNum, HAS_WATCH_ACTION);
            if (removed) {
                this.broadcastWantWatchedSync({
                    carNum: pageInfo.carNum,
                    status: HAS_WATCH_ACTION,
                    op: 'remove'
                });
                show.ok(`${pageInfo.carNum} 已取消看过`);
            }
        } catch (err: any) {
            console.error('[JHS-观看自动同步] 移除失败', err);
        }
        this.showStatus(pageInfo.carNum).then();
    }

    /**
     * 仅当 JHS 中该番号状态为目标 status 时移除记录。
     * 对应原 L5396-5401。
     * @param carNum 番号
     * @param status 目标状态（FAVORITE_ACTION=想看 / HAS_WATCH_ACTION=已观看）
     * @returns 是否执行了移除
     */
    async removeCarIfStatus(carNum: any, status: any): Promise<boolean> {
        const carRecord = await storageManager.getCar(carNum);
        if (!carRecord) return false;
        if (carRecord.status !== status) return false;
        return await storageManager.removeCar(carNum);
    }

    /**
     * 广播「想看/观看」状态变更，供其他标签页/脚本接收。
     * 三重通道：GM_setValue / localStorage / CustomEvent。对应原 L5407-5429。
     * @param payload 变更载荷
     */
    broadcastWantWatchedSync(payload: WantWatchedSyncPayload): void {
        try {
            const json = JSON.stringify({ ...payload, time: Date.now() });
            // 1) GM 原生通道（跨标签页）
            try {
                GM_setValue('jdb:want-watched-sync', json);
            } catch {}
            // 2) localStorage（跨脚本同源）
            try {
                localStorage.setItem('jdb:want-watched-sync', json);
            } catch {}
            // 3) CustomEvent（跨脚本同页面）
            try {
                document.dispatchEvent(
                    new CustomEvent('jdb:want-watched-sync', {
                        detail: payload
                    })
                );
            } catch {}
        } catch (err: any) {
            console.error('[JHS-想看/观看同步] 广播失败', err);
        }
    }

    /**
     * 接收来自其他标签页/脚本的「想看/观看」状态变更，同步刷新本页状态。
     * 三重通道监听：CustomEvent / localStorage storage 事件 / GM_addValueChangeListener。
     * 对应原 L5435-5477。
     */
    setupWantWatchedSyncListener(): void {
        if (!isJavdbSite) return;
        if (this._wantWatchedListenerInstalled) return;
        this._wantWatchedListenerInstalled = true;
        const self = this;
        const handleSync = (rawData: any) => {
            const payload: any =
                (rawData && rawData.detail) ||
                (() => {
                    try {
                        return JSON.parse(rawData);
                    } catch {
                        return null;
                    }
                })();
            if (!payload || !payload.carNum) return;

            // 清除 carList 缓存：跨标签页广播时本页 cacheCarList 可能已过期
            //（detail 页 saveCar 仅更新自身缓存，不跨标签同步）
            storageManager.clearCarListCache();

            // 1) 详情页：刷新 JHS 菜单按钮文案
            try {
                const currentCarNum = self.getPageInfo().carNum;
                if (currentCarNum && payload.carNum === currentCarNum) {
                    self.showStatus(currentCarNum).then(() => {});
                }
            } catch {}

            // 2) 列表页/series 页：刷新匹配卡片的 status-tag
            self.refreshItemStatusTag(payload.carNum);
        };
        // 1) 同页面 CustomEvent
        document.addEventListener('jdb:want-watched-sync', (event: any) =>
            handleSync(event.detail)
        );
        // 2) localStorage（跨标签页 / 跨 iframe）
        window.addEventListener('storage', (event: StorageEvent) => {
            if (event.key !== 'jdb:want-watched-sync' || !event.newValue) return;
            handleSync(event.newValue);
        });
        // 3) GM 通道
        try {
            GM_addValueChangeListener(
                'jdb:want-watched-sync',
                (_name: any, _oldValue: any, newValue: any) => {
                    if (!newValue) return;
                    handleSync(newValue);
                }
            );
        } catch {}
    }

    /**
     * 跨页/跨 iframe 同步：刷新当前页所有匹配 carNum 的视频卡片 status-tag。
     * 走 ListPagePlugin.filterMovieList 同样的渲染逻辑（取自 IndexedDB 真值）。
     * 对应原 L5485-5501。
     * @param carNum 要刷新的番号
     */
    refreshItemStatusTag(carNum: any): void {
        try {
            const selectorConfig = this.getSelector();
            const itemSelector = selectorConfig.itemSelector;
            const items: any = document.querySelectorAll(itemSelector);
            for (const item of items) {
                const strongEl: any = item.querySelector('a > div.video-title > strong');
                if (!strongEl || strongEl.innerHTML !== carNum) continue;
                // 找到匹配的卡片，交给 ListPagePlugin 重跑单卡片
                const listPagePlugin = this.getBean('ListPagePlugin');
                if (!listPagePlugin) continue;
                listPagePlugin.renderItemStatusTag(item, carNum);
            }
        } catch (err: any) {
            console.error('[JHS-想看/观看] 刷新列表项 status-tag 失败', err);
        }
    }

    /**
     * 在详情页注入星星评分组件（5星 + 已读 + 收藏）。
     * 组件会被 Rails ajax 替换销毁，用 MutationObserver 监听变化自动重建。
     * 对应原 L5508-5542。
     */
    addQuickActionButtons(): void {
        if (!(window as any).isDetailPage) return;
        if (this._quickActionAdded) return;
        this._quickActionAdded = true;
        const self = this;
        this._injectRatingStyles();
        const ensure = () => {
            const nav: any = document.querySelector(
                'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
            );
            if (!nav) {
                setTimeout(ensure, 400);
                return;
            }
            // 构建组件（如果不存在）
            self._buildRatingBar(nav);
            self._syncRatingBar();
            // 清单面板独立等待 #otherSiteBox 出现（OtherSitePlugin 异步注入）
            self._ensureListPanel(nav);
            // 监听 .review-buttons 变化（Rails ajax 替换 innerHTML 会销毁组件 → 重建 + 状态刷新）
            const rb: any = nav.querySelector('.review-buttons');
            if (rb && !rb.__jhsRatingObserved) {
                rb.__jhsRatingObserved = true;
                new MutationObserver(() => {
                    if (self._wantWatchedSyncing) return;
                    clearTimeout(self._ratingSyncDebounce);
                    self._ratingSyncDebounce = setTimeout(() => {
                        self._buildRatingBar(nav);
                        self._syncRatingBar();
                    }, 200);
                }).observe(rb, { childList: true, subtree: true });
            }
        };
        ensure();
    }

    /**
     * 构建星星评分组件 DOM 并插入 .column 上方（如已存在则跳过）。
     * 对应原 L5548-5631。
     * @param nav nav 容器
     */
    _buildRatingBar(nav: any): void {
        const column: any = nav.querySelector('div.review-buttons > div:nth-child(1) > div > div');
        if (!column) return;
        if (column.querySelector('.jhs-rating-bar')) return; // 已存在
        const self = this;
        const bar = document.createElement('div');
        bar.className = 'jhs-rating-bar';
        bar.innerHTML = jsxToString(<RatingBarHtml />);
        const starsEl: any = bar.querySelector('.jhs-stars');
        const stars: any = bar.querySelectorAll('.jhs-star');
        const readBtn: any = bar.querySelector('.jhs-read-btn');
        const favBtn: any = bar.querySelector('.jhs-fav-btn');
        const blockBtn: any = bar.querySelector('.jhs-block-btn');
        // hover 预览
        starsEl.addEventListener('pointerover', (e: any) => {
            const star = e.target.closest('.jhs-star');
            if (!star) return;
            const score = +star.dataset.score;
            stars.forEach((s: any, i: number) => s.classList.toggle('is-preview', i < score));
        });
        starsEl.addEventListener('pointerleave', () =>
            stars.forEach((s: any) => s.classList.remove('is-preview'))
        );
        // 点击星星 → 已观看 + N星
        stars.forEach((star: any) => {
            star.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const score = +star.dataset.score;
                star.classList.add('is-popping');
                setTimeout(() => star.classList.remove('is-popping'), 300);
                self._setRatingBusy(true);
                try {
                    await self.quickSetHasWatch(score);
                } finally {
                    self._setRatingBusy(false);
                    self.showStatus(self.getPageInfo().carNum).then();
                }
            });
        });
        // 已读 → 已观看 + 0星
        readBtn.addEventListener('click', async (e: any) => {
            e.preventDefault();
            readBtn.classList.add('is-popping');
            setTimeout(() => readBtn.classList.remove('is-popping'), 300);
            self._setRatingBusy(true);
            try {
                await self.quickSetHasWatch(0);
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum).then();
            }
        });
        // 收藏 → 想看
        favBtn.addEventListener('click', async (e: any) => {
            e.preventDefault();
            favBtn.classList.add('is-popping');
            setTimeout(() => favBtn.classList.remove('is-popping'), 300);
            self._setRatingBusy(true);
            try {
                await self.quickConvertToFav();
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum).then();
            }
        });
        // 拉黑 → 屏蔽 + 设为已读0星 + 关闭页面（需确认）
        blockBtn.addEventListener('click', async (e: any) => {
            e.preventDefault();
            blockBtn.classList.add('is-popping');
            setTimeout(() => blockBtn.classList.remove('is-popping'), 300);
            await self.quickBlock();
        });
        column.insertBefore(bar, column.firstChild);
    }

    /**
     * 轮询等待 #otherSiteBox 出现后创建清单面板、初始化、绑定事件代理。
     * 对应原 L5637-5681。
     * @param nav nav 容器
     */
    _ensureListPanel(nav: any): void {
        if (this._listPanelEnsured) return;
        const otherSite: any = nav.querySelector('#otherSiteBox');
        if (!otherSite) {
            setTimeout(() => this._ensureListPanel(nav), 400);
            return;
        }
        this._listPanelEnsured = true;
        const self = this;
        // 创建清单面板
        if (!nav.querySelector('.jhs-list-panel')) {
            otherSite.insertAdjacentHTML('afterend', jsxToString(<ListPanel />));
        }
        // 初始化（触发 ajax 加载 + 克隆同步）
        self._initListPanel();
        // 事件代理：平铺面板 checkbox change → 同步到 modal 内 checkbox 触发 Stimulus
        const listPanel: any = nav.querySelector('.jhs-list-panel');
        if (listPanel && !listPanel.__jhsListClickBound) {
            listPanel.__jhsListClickBound = true;
            listPanel.addEventListener('change', (e: any) => {
                if (e.target.type !== 'checkbox') return;
                const modal: any = document.querySelector('#modal-save-list');
                const listContainer: any = modal?.querySelector(
                    '[data-list-target="listContainer"]'
                );
                if (!listContainer) return;
                const panels = Array.from(listPanel.querySelectorAll('input[type="checkbox"]'));
                const idx = panels.indexOf(e.target);
                const modalCheckboxes = listContainer.querySelectorAll('input[type="checkbox"]');
                const target = modalCheckboxes[idx];
                if (target) {
                    target.checked = e.target.checked;
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
    }

    /**
     * 初始化清单平铺面板：程序化触发 save-list-button 打开 modal（CSS 隐藏），
     * 监听 listContainer 内容变化并克隆到 .jhs-list-panel。
     * 对应原 L5688-5733。
     */
    _initListPanel(): void {
        if (this._listPanelIniting) return;
        this._listPanelIniting = true;
        const self = this;
        const ensure = () => {
            const btn: any = document.querySelector('#save-list-button');
            const modal: any = document.querySelector('#modal-save-list');
            if (!btn || !modal) {
                setTimeout(ensure, 400);
                return;
            }
            const listContainer: any = modal.querySelector('[data-list-target="listContainer"]');
            if (!listContainer) return;
            // 程序化触发 ajax 加载清单
            if (!self._listAjaxTriggered) {
                self._listAjaxTriggered = true;
                btn.click();
            }
            // 监听 listContainer 内容变化 → 克隆到平铺面板
            if (!listContainer.__jhsListObserved) {
                listContainer.__jhsListObserved = true;
                const sync = () => {
                    const panel: any = document.querySelector('.jhs-list-panel');
                    if (!panel) return;
                    panel.innerHTML = '';
                    Array.from(listContainer.children).forEach((child: any) => {
                        // 跳过「预设清单」/「預設清單」（简/繁体均匹配）
                        if (/[预預][设設]清[单單]/.test(child.textContent)) return;
                        const clone = child.cloneNode(true);
                        panel.appendChild(clone);
                    });
                };
                new MutationObserver(sync).observe(listContainer, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['checked', 'disabled']
                });
                // 初始同步
                setTimeout(sync, 500);
            }
        };
        ensure();
    }

    /**
     * 注入星星评分组件的 CSS 样式。对应原 L5738-5778。
     */
    _injectRatingStyles(): void {
        if (document.getElementById('jhs-rating-styles')) return;
        const style = document.createElement('style');
        style.id = 'jhs-rating-styles';
        style.textContent = ratingBarCssRaw;
        document.head?.appendChild(style);
    }

    /**
     * 从 javdb 原生 DOM 检测当前评价状态，同步星星组件显示。
     * 状态：want（想看）/ watched+N（已观看 N 星）/ filter（已拉黑）/ none（未评价）。
     * filter 状态是 JHS 独有（javdb 原生无屏蔽概念），需额外查 JHS 记录。
     * 对应原 L5784-5832。
     */
    _syncRatingBar(): void {
        let bar: any = document.querySelector('.jhs-rating-bar');
        // 组件被 Rails ajax innerHTML 替换销毁 → 重建
        if (!bar) {
            const nav: any = document.querySelector(
                'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
            );
            if (nav) this._buildRatingBar(nav);
            bar = document.querySelector('.jhs-rating-bar');
        }
        if (!bar) return;
        const rb: any = document.querySelector('.review-buttons');
        if (!rb) return;
        const want = !!rb.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
        const watched = !!rb.querySelector(
            "a[href='/users/watched_videos'] .tag.is-success.is-light"
        );
        const checked: any = rb.querySelector('input[name="video_review[score]"][checked]');
        const score = checked ? +checked.value : 0;

        const stars: any = bar.querySelectorAll('.jhs-star');
        const starsEl: any = bar.querySelector('.jhs-stars');
        const readBtn: any = bar.querySelector('.jhs-read-btn');
        const favBtn: any = bar.querySelector('.jhs-fav-btn');
        const blockBtn: any = bar.querySelector('.jhs-block-btn');

        // 先清除所有状态类
        stars.forEach((s: any) => s.classList.remove('is-active'));
        starsEl.classList.remove('is-disabled');
        readBtn.classList.remove('is-active');
        favBtn.classList.remove('is-active');
        blockBtn.classList.remove('is-active');

        if (want) {
            // 想看：收藏高亮，星星保持可用（可随时点击切换为已观看+N星）
            favBtn.classList.add('is-active');
        } else if (watched) {
            // 已观看：前 N 星高亮，已读看 N 是否 0
            stars.forEach((s: any, i: number) => s.classList.toggle('is-active', i < score));
            readBtn.classList.toggle('is-active', score === 0);
        } else {
            // 未评价
        }

        // 额外检查 JHS 是否已拉黑（filter 状态是 JHS 独有，javdb 原生无屏蔽概念）
        const carNum = this.getPageInfo().carNum;
        if (carNum) {
            storageManager.getCar(carNum).then((carRecord: any) => {
                if (carRecord && carRecord.status === FILTER_ACTION) {
                    blockBtn.classList.add('is-active');
                }
            });
        }
    }

    /**
     * 设置评分组件忙碌状态（操作期间禁用交互）。对应原 L5837-5840。
     * @param busy 是否忙碌
     */
    _setRatingBusy(busy: boolean): void {
        const bar: any = document.querySelector('.jhs-rating-bar');
        if (bar) bar.classList.toggle('is-busy', busy);
    }

    /**
     * 一键设为已观看并设置评鉴分数。对应原 L5846-5895。
     * @param score 评分 0-5
     */
    async quickSetHasWatch(score: number): Promise<void> {
        const pageInfo = this.getPageInfo();
        if (!pageInfo.carNum) return;
        // ---- JHS 端更新 ----
        try {
            const carRecord = await storageManager.getCar(pageInfo.carNum);
            if (carRecord && carRecord.status === FAVORITE_ACTION) {
                await storageManager.removeCar(pageInfo.carNum);
            }
            if (carRecord && carRecord.status === HAS_WATCH_ACTION && carRecord.score === score) {
                show.ok(pageInfo.carNum + ' 评分未变化');
                return;
            }
            await storageManager.saveCar({
                carNum: pageInfo.carNum,
                url: pageInfo.url,
                names: pageInfo.actress,
                actionType: HAS_WATCH_ACTION,
                publishTime: pageInfo.publishTime,
                score: score
            });
            this.broadcastWantWatchedSync({
                carNum: pageInfo.carNum,
                status: HAS_WATCH_ACTION,
                op: 'add',
                score
            });
            show.ok(
                pageInfo.carNum +
                    ' \u5df2\u6807\u8bb0\u770b\u8fc7 ' +
                    (score > 0 ? '\u2605' + score : '')
            );
            // 已读/评分后：若在「等待更新」清单中则自动移出（不在则 noop）
            autoRemoveFromPendingUpdateOnWatch().then();
        } catch (err: any) {
            console.error('[JHS-快键] 设为已观看失败', err);
            show.error('操作失败: ' + err.message);
            return;
        }
        // 串行化 javdb 原生端操作，避免连续点击并发冲突；
        // _wantWatchedSyncing 期间阻断 MutationObserver，完成后立即释放
        this._reviewChain = (this._reviewChain || Promise.resolve())
            .then(async () => {
                this._wantWatchedSyncing = true;
                try {
                    await this._triggerJavdbReview(score);
                    this._syncRatingBar();
                } finally {
                    this._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    }

    /**
     * 快捷拉黑：弹确认框警告严重性 → 确认后写 FILTER_ACTION + 设为已读0星 + 关闭页面。
     *
     * 与 filterOne 的区别：
     * - filterOne 仅写 JHS FILTER_ACTION，不调 javdb 原生端
     * - quickBlock 额外调 _triggerJavdbReview(0) 设为已读0星（让影片不在想看列表，
     *   不出现在推荐），并用 _wantWatchedSyncing 阻断 MutationObserver 防止
     *   onWatchedAdded 覆盖 JHS 的 FILTER_ACTION 状态
     * - 广播 filter+add 让列表页实时隐藏该卡片
     */
    async quickBlock(): Promise<void> {
        const pageInfo = this.getPageInfo();
        if (!pageInfo.carNum) return;
        utils.q(
            null,
            `是否拉黑 ${pageInfo.carNum}？<br/><span style='color:#f40'>拉黑后该影片将被屏蔽，列表页自动隐藏，且设为已读0星。此操作不可在详情页撤销。</span>`,
            async () => {
                this._setRatingBusy(true);
                try {
                    // 1) JHS 端：先移除已有记录（避免 saveCar 抛“已在屏蔽列表中”），再写 FILTER_ACTION
                    const carRecord = await storageManager.getCar(pageInfo.carNum);
                    if (carRecord) {
                        await storageManager.removeCar(pageInfo.carNum);
                    }
                    await storageManager.saveCar({
                        carNum: pageInfo.carNum,
                        url: pageInfo.url,
                        names: pageInfo.actress,
                        actionType: FILTER_ACTION,
                        publishTime: pageInfo.publishTime
                    });
                    // 2) 广播 filter+add（列表页实时隐藏该卡片）
                    this.broadcastWantWatchedSync({
                        carNum: pageInfo.carNum,
                        status: FILTER_ACTION,
                        op: 'add'
                    });
                    show.ok(`${pageInfo.carNum} 已拉黑`);
                } catch (err: any) {
                    console.error('[JHS-快键] 拉黑失败', err);
                    show.error('操作失败: ' + err.message);
                    return;
                }
                // 3) javdb 原生端：设为已读0星（串行 + 阻断 observer）
                this._reviewChain = (this._reviewChain || Promise.resolve())
                    .then(async () => {
                        this._wantWatchedSyncing = true;
                        try {
                            await this._triggerJavdbReview(0);
                            this._syncRatingBar();
                        } finally {
                            this._wantWatchedSyncing = false;
                        }
                    })
                    .catch(() => {});
                // 4) 关闭页面 + 刷新
                this.showStatus(pageInfo.carNum).then();
                refresh();
                utils.closePage();
            }
        );
    }

    /**
     * 获取 javdb 的 CSRF token。对应原 L5900-5903。
     * @returns CSRF token 或 null
     */
    _getCsrfToken(): string | null {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        return meta ? meta.content : null;
    }

    /**
     * 从当前 URL 提取 videoId（如 /v/Ebqv9 → Ebqv9）。对应原 L5909-5911。
     * @returns videoId 或 null
     */
    _getVideoId(): string | null {
        return location.pathname.match(/\/v\/([^/]+)/)?.[1] || null;
    }

    /**
     * 从 .review-buttons 的删除链接提取当前 reviewId。对应原 L5917-5923。
     * @returns reviewId 或 null
     */
    _getReviewId(): string | null {
        const del: any = document.querySelector(
            ".review-buttons a[data-method='delete'][href*='/reviews/']"
        );
        if (!del) return null;
        return del.getAttribute('href')?.match(/\/reviews\/(\d+)/)?.[1] || null;
    }

    /**
     * 在页面主上下文执行 javdb Rails 返回的 JS（text/javascript）。
     * 用 <script> 标签注入而非 eval，确保在 Tampermonkey 沙箱中也运行于页面主上下文。
     * 对应原 L5933-5942。
     * @param jsText Rails 返回的 JS 源码
     */
    _execRailsJs(jsText: string): void {
        try {
            const script = document.createElement('script');
            script.textContent = jsText;
            document.head?.appendChild(script);
            script.remove();
        } catch (err: any) {
            console.error('[JHS-快键] 执行 Rails JS 失败', err);
        }
    }

    /**
     * 通过 javdb 原生评价 API 设置状态（已观看/想看），替代不可靠的 DOM form 操作。
     * 对应原 L5951-6011。
     * @param action 目标状态（'watched' 或 'wanted'）
     * @param score 评分 0-5（仅 watched 有效）
     */
    async _javdbReviewApi(action: 'watched' | 'wanted', score: number = 0): Promise<void> {
        const token = this._getCsrfToken();
        if (!token) throw new Error('无法获取 CSRF token');
        const videoId = this._getVideoId();
        if (!videoId) throw new Error('无法获取 videoId');
        const reviewId = this._getReviewId();

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': token
        };
        const tokenParam = `authenticity_token=${encodeURIComponent(token)}`;

        if (action === 'watched') {
            // 有 reviewId → PATCH 改状态；无 → POST 新建
            const url = reviewId ? `/v/${videoId}/reviews/${reviewId}` : `/v/${videoId}/reviews`;
            const methodParam = reviewId ? '&_method=patch' : '';
            const body = `${tokenParam}${methodParam}&video_review[status]=watched&video_review[score]=${score}&video_review[content]=`;
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body,
                credentials: 'same-origin'
            });
            if (!res.ok) throw new Error(`设为已观看失败: HTTP ${res.status}`);
            // 执行 Rails 返回的 JS：更新 DOM + 重绑定 UJS 事件
            this._execRailsJs(await res.text());
        } else if (action === 'wanted') {
            // 想看与已评价互斥：已有 review 先删除再建想看
            if (reviewId) {
                const delRes = await fetch(`/v/${videoId}/reviews/${reviewId}`, {
                    method: 'POST',
                    headers,
                    body: `${tokenParam}&_method=delete`,
                    credentials: 'same-origin'
                });
                if (!delRes.ok) throw new Error(`删除旧评价失败: HTTP ${delRes.status}`);
                this._execRailsJs(await delRes.text());
            }
            const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, {
                method: 'POST',
                headers,
                body: tokenParam,
                credentials: 'same-origin'
            });
            if (!res.ok) throw new Error(`设为想看失败: HTTP ${res.status}`);
            this._execRailsJs(await res.text());
        }

        // 同步 _lastWantState 防止 MutationObserver 误触发
        const rb: any = document.querySelector('.review-buttons');
        if (rb && this._wantWatchedObserved) {
            this._lastWantState = this.detectWantWatchedState(rb);
        }
    }

    /**
     * 一键设为已观看并设置评鉴分数（javdb 原生端）。对应原 L6017-6019。
     * @param score 评分 0-5
     */
    async _triggerJavdbReview(score: number): Promise<void> {
        await this._javdbReviewApi('watched', score);
    }

    /**
     * 轮询等待指定选择器的元素 innerHTML 发生变化。对应原 L6020-6047。
     * @param selector CSS 选择器
     * @param ms 超时毫秒
     * @returns 变化后的元素或 null
     */
    _waitForDomChange(selector: string, ms: number): Promise<any> {
        return new Promise((resolve) => {
            const start = Date.now();
            const el: any = document.querySelector(selector);
            if (!el) {
                resolve(null);
                return;
            }
            const before = el.innerHTML;
            const check = () => {
                const cur: any = document.querySelector(selector);
                if (!cur) {
                    resolve(null);
                    return;
                }
                if (cur.innerHTML !== before) {
                    resolve(cur);
                    return;
                }
                if (Date.now() - start > ms) {
                    resolve(cur);
                    return;
                }
                setTimeout(check, 200);
            };
            setTimeout(check, 200);
        });
    }

    /**
     * 轮询等待 fn 返回的元素出现。对应原 L6048-6065。
     * @param fn 查找元素的函数
     * @param ms 超时毫秒
     * @returns 找到的元素或 null
     */
    _waitForEl(fn: () => any, ms: number): Promise<any> {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                const el = fn();
                if (el) {
                    resolve(el);
                    return;
                }
                if (Date.now() - start > ms) {
                    resolve(null);
                    return;
                }
                setTimeout(check, 150);
            };
            check();
        });
    }

    /**
     * 一键转为收藏（想看）。对应原 L6066-6105。
     */
    async quickConvertToFav(): Promise<void> {
        const pageInfo = this.getPageInfo();
        if (!pageInfo.carNum) return;
        try {
            const carRecord = await storageManager.getCar(pageInfo.carNum);
            if (carRecord && carRecord.status === FAVORITE_ACTION) {
                show.ok(pageInfo.carNum + ' 已是已收藏');
                return;
            }
            if (carRecord) await storageManager.removeCar(pageInfo.carNum);
            await storageManager.saveCar({
                carNum: pageInfo.carNum,
                url: pageInfo.url,
                names: pageInfo.actress,
                actionType: FAVORITE_ACTION,
                publishTime: pageInfo.publishTime
            });
            this.broadcastWantWatchedSync({
                carNum: pageInfo.carNum,
                status: FAVORITE_ACTION,
                op: 'add'
            });
            show.ok(pageInfo.carNum + ' \u5df2\u8f6c\u4e3a\u6536\u85cf');
        } catch (err: any) {
            console.error('[JHS-快键] 转为已收藏失败', err);
            show.error('操作失败: ' + err.message);
            return;
        }
        this._reviewChain = (this._reviewChain || Promise.resolve())
            .then(async () => {
                this._wantWatchedSyncing = true;
                try {
                    await this._triggerJavdbWant();
                    this._syncRatingBar();
                } finally {
                    this._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    }

    /**
     * 将当前影片在 javdb 原生端设为「想看」（通过 API）。对应原 L6109-6111。
     */
    async _triggerJavdbWant(): Promise<void> {
        await this._javdbReviewApi('wanted');
    }

    /**
     * 收藏当前影片（写入 JHS favorite）。对应原 L6112-6124。
     */
    async favoriteOne(): Promise<void> {
        const pageInfo = this.getPageInfo();
        await storageManager.saveCar({
            carNum: pageInfo.carNum,
            url: pageInfo.url,
            names: pageInfo.actress,
            actionType: FAVORITE_ACTION,
            publishTime: pageInfo.publishTime
        });
        this.showStatus(pageInfo.carNum).then();
        refresh();
        utils.closePage();
    }

    /**
     * 标记当前影片为已观看（写入 JHS hasWatch）。对应原 L6125-6137。
     */
    async hasWatchOne(): Promise<void> {
        const pageInfo = this.getPageInfo();
        await storageManager.saveCar({
            carNum: pageInfo.carNum,
            url: pageInfo.url,
            names: pageInfo.actress,
            actionType: HAS_WATCH_ACTION,
            publishTime: pageInfo.publishTime
        });
        this.showStatus(pageInfo.carNum).then();
        refresh();
        utils.closePage();
    }

    /**
     * 搜索迅雷字幕并以 Tabulator 表格展示。对应原 L6138-6266。
     * @param carNum 番号
     */
    searchXunLeiSubtitle(carNum: any): void {
        const loadingHandle = loading();
        gmHttp
            .get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${carNum}`)
            .then((response: any) => {
                const subtitleList = response.data;
                if (subtitleList && subtitleList.length !== 0) {
                    layer.open({
                        type: 1,
                        title: '迅雷字幕',
                        content: jsxToString(<SubtitleTableDialog />),
                        scrollbar: false,
                        area: utils.getResponsiveArea(['60%', '70%']),
                        anim: -1,
                        success: (_layero: any, index: any) => {
                            new Tabulator('#xunlei-table-container', {
                                layout: 'fitColumns',
                                placeholder: '暂无数据',
                                virtualDom: true,
                                data: subtitleList,
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
                                        headerSort: false,
                                        responsive: 0
                                    },
                                    {
                                        title: '类型',
                                        field: 'ext',
                                        headerSort: false,
                                        responsive: 0
                                    },
                                    {
                                        title: '操作',
                                        responsive: 0,
                                        headerSort: false,
                                        formatter: (
                                            cell: any,
                                            _formatterParams: any,
                                            onRendered: any
                                        ) => {
                                            const rowData = cell.getData();
                                            onRendered(() => {
                                                const previewBtn = cell
                                                    .getElement()
                                                    .querySelector('.a-primary');
                                                const downloadBtn = cell
                                                    .getElement()
                                                    .querySelector('.a-success');
                                                if (previewBtn) {
                                                    previewBtn.addEventListener(
                                                        'click',
                                                        async (_event: any) => {
                                                            const subUrl = rowData.url;
                                                            const subFilename =
                                                                carNum + '.' + rowData.ext;
                                                            this.previewSubtitle(
                                                                subUrl,
                                                                subFilename
                                                            );
                                                        }
                                                    );
                                                }
                                                if (downloadBtn) {
                                                    downloadBtn.addEventListener(
                                                        'click',
                                                        async (_event: any) => {
                                                            const subUrl = rowData.url;
                                                            const subFilename =
                                                                carNum + '.' + rowData.ext;
                                                            const content =
                                                                await gmHttp.get(subUrl);
                                                            utils.download(content, subFilename);
                                                        }
                                                    );
                                                }
                                            });
                                            return jsxToString(<SubtitleActionCell />);
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
                            utils.setupEscClose(index);
                        }
                    });
                } else {
                    show.error('迅雷中找不到相关字幕!');
                }
            })
            .catch((err: any) => {
                console.error(err);
                show.error(err);
            })
            .finally(() => {
                loadingHandle.close();
            });
    }

    /**
     * 屏蔽当前影片。对应原 L6267-6306。
     * @param event 点击事件（可 null）
     */
    async filterOne(event: any): Promise<void> {
        if (event) {
            event.preventDefault();
        }
        const pageInfo = this.getPageInfo();
        utils.q(event, `是否屏蔽${pageInfo.carNum}?`, async () => {
            await storageManager.saveCar({
                carNum: pageInfo.carNum,
                url: pageInfo.url,
                names: pageInfo.actress,
                actionType: FILTER_ACTION,
                publishTime: pageInfo.publishTime
            });
            this.showStatus(pageInfo.carNum).then();
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
            $iframe[0].contentWindow.postMessage('speedVideo', '*');
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
        $(document).on('mouseenter', '#preview-video', function (this: any) {
            $(this).prop('controls', true);
        });
    }

    /**
     * 预览 ASS/SRT 字幕文件内容。对应原 L6397-6439。
     * @param url 字幕文件 URL
     * @param filename 字幕文件名
     */
    async previewSubtitle(url: any, filename: any): Promise<void> {
        if (!url) {
            console.error('未提供文件URL');
            return;
        }
        const ext = url.split('.').pop().toLowerCase();
        if (ext === 'ass' || ext === 'srt') {
            try {
                const subtitleContent = await gmHttp.get(url);
                let title = '字幕预览';
                if (ext === 'ass') {
                    title = 'ASS字幕预览 - ' + filename;
                } else if (ext === 'srt') {
                    title = 'SRT字幕预览 - ' + filename;
                }
                const lines = subtitleContent.split('\n');
                let output = '';
                const numWidth = String(lines.length).length;
                lines.forEach((line: any, idx: number) => {
                    const paddedNum = String(idx + 1).padStart(numWidth, ' ');
                    output += jsxToString(<SubtitleLine paddedNum={paddedNum} line={line} />);
                });
                const htmlContent = output;
                layer.open({
                    type: 1,
                    title: title,
                    area: ['80%', '80%'],
                    scrollbar: false,
                    content: jsxToString(<SubtitlePreviewDialog content={htmlContent} />),
                    btn: ['下载', '关闭'],
                    btn1: function (_index: any, _layero: any, _instance: any) {
                        utils.download(subtitleContent, filename);
                        return false;
                    }
                });
            } catch (err: any) {
                show.error(`预览失败: ${err.message}`);
                console.error('预览字幕文件出错:', err);
            }
        } else {
            show.error('仅支持预览ASS和SRT字幕文件');
        }
    }
}
