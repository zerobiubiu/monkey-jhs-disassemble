/**
 * 列表页插件 ListPagePlugin —— 对应原脚本 archetype/jhs.user.js L8279-9069。
 *
 * 列表页（window.isListPage）主插件：监听跨标签页 BroadcastChannel 刷新/清缓存
 * 消息；替换高清封面图、挂载分页跳页控件；
 * 依 IndexedDB 的收藏/屏蔽/已观看/关键词/演员黑名单数据对 .item 卡片做显隐
 * 过滤并注入 status-tag；绑定卡片点击；记忆演员页标签展开态；
 * DOM 变更后自动重过滤；并对 JavDb 标题做 Google 翻译（带 localStorage 缓存）。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o 等）已语义化；顶层站点/状态常量
 * o/r/c/d/h/p/B/C/_ 改由 ../constants 引入（currentHref/isJavdbSite/
 * isSearchOrUserPage/FILTER_ACTION/FAVORITE_ACTION/
 * HAS_WATCH_ACTION/ACTOR/NO/YES）。原顶层 Te（状态标签配置）改写为模块级
 * STATUS_TAG_CONFIG；原 _e（Google 翻译）改写为模块级 translateText；
 *
 *
 * 注意：原顶层常量 g（"hasDown"，「已下载」动作状态）已在 archetype/doc/
 * 09-remove-hasdown-constants.md 中作为「已删除」定稿移除。filterMovieList
 * 中原 {[g]: new Set()} 的键集合从未被读取（仅 filter/favorite/hasWatch
 * 被解构使用），属残留死代码；已同步原版删除该行，不再还原 HAS_DOWN_ACTION
 * 本地常量（避免运行时 ReferenceError 导致弹窗方式打开页面失效）。
 *
 * 构造函数中 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 注入的字段改为 class 字段语法（useDefineForClassFields:true，语义一致）。
 * $ / utils / storageManager / show / clog / gmHttp 已由 ../types/globals.d.ts
 * 声明为 any；内联 CSS/HTML 模板字符串原样保留（仅替换 ${} 插值变量名）。
 *
 * 方法实现已按功能域拆分至 ./list-page/ 子目录：
 * - lp-filter.tsx — filterMovieList + renderItemStatusTag（IDB 过滤 + status-tag）
 * - lp-translate.ts — translate + revertTranslation（Google 翻译 + localStorage 缓存）
 * - lp-dom.ts — findCarNumAndHref + replaceHdImg + showCarNumBox + bindClick
 *   （+ 共享辅助 replaceTitleTextNodes，合并三处重复的标题文本节点替换）
 * - lp-jump-page.tsx — addJumpPageControl（跳页控件）
 *
 * 本文件保留所有公共方法签名（getBean 可达面），方法体委托至对应辅助模块。
 */
import { isJavdbSite } from '../constants/site';
import { NO, YES } from '../constants/status';

import { TaskSupervisor } from '../core/task-supervisor';
import type { PageType } from '../core/page-context';

import { BasePlugin } from './base-plugin';
import { filterMovieList as _filterMovieList, renderItemStatusTag as _renderItemStatusTag } from './list-page/lp-filter';
import { translate as _translate, revertTranslation as _revertTranslation } from './list-page/lp-translate';
import {
    findCarNumAndHref as _findCarNumAndHref,
    replaceHdImg as _replaceHdImg,
    showCarNumBox as _showCarNumBox,
    bindClick as _bindClick
} from './list-page/lp-dom';
import { addJumpPageControl as _addJumpPageControl } from './list-page/lp-jump-page';

export class ListPagePlugin extends BasePlugin {
    // —— 当前页各类计数（原 i(this,"currentPage*",n)） ——
    currentPageFilterCount = 0;
    currentPageFavoriteCount = 0;
    currentPageHasWatchCount = 0;
    currentPageKeywordFilterCount = 0;
    currentPageActorFilterCount = 0;
    currentPageWaitCheckCount = 0;
    currentPageTotalCount = 0;

    /** 统一生命周期管理：MutationObserver 等资源由此 supervisor 管控。 */
    private supervisor = new TaskSupervisor();

    /** 翻译缓存（localStorage["jhs_translate"]，番号→译文）。 */
    cache: Record<string, string> = (() => {
        try {
            const raw = localStorage.getItem('jhs_translate');
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    })();

    /** 翻译写入队列，串行化 localStorage 写入。 */
    writeQueue: Promise<void> = Promise.resolve();

    /** 返回插件名，供 PluginManager 注册去重。对应原 L8298-8300。 */
    getName(): string {
        return 'ListPagePlugin';
    }

    /** 销毁插件，清理 supervisor 管理的所有资源（MutationObserver 等）。 */
    destroy(): void {
        this.supervisor.abort();
    }

    /** 仅在列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['list'];
    }

    /** 列表页主处理。对应原 L8301-8339。 */
    async handle(): Promise<void> {
        new BroadcastChannel('channel-refresh').addEventListener(
            'message',
            async (event: MessageEvent) => {
                const msgType = event.data.type;
                if (msgType === 'refresh') {
                    storageManager.clearCarListCache();
                    await this.doFilter();
                    const historyPlugin = this.getBean('HistoryPlugin');
                    if (historyPlugin.tableObj) {
                        historyPlugin.tableObj.setData();
                    }
                    const newVideoPlugin = this.getBean('NewVideoPlugin');
                    if (newVideoPlugin) {
                        newVideoPlugin.showNewVideoCount().then();
                        newVideoPlugin.loadData();
                    }
                } else if (msgType === 'cleanCache_filter_actor_actress_car_list') {
                    storageManager.clearFilterActorActressCarListCache();
                } else if (msgType === 'clean_cacheSettingObj') {
                    storageManager.clearSettingCache();
                }
            }
        );
        this.replaceHdImg();
        this.addJumpPageControl();
        await this.doFilter();
        this.bindClick().then();
        this.rememberTagExpand();
        $(this.getSelector().itemSelector + ' a').attr('target', '_blank');
        this.checkDom();
        // 列表页挂载"想看/观看"同步监听器，刷新本页 .item 卡片 status-tag
        this.getBean('DetailPageButtonPlugin').setupWantWatchedSyncListener();
    }

    /** 记忆演员页标签展开态（localStorage["jhs_tag_expand"]）。对应原 L8340-8359。 */
    rememberTagExpand(): void {
        if (!window.location.href.includes('actors')) {
            return;
        }
        const expandBtn = $('.tag-expand');
        if (expandBtn.length === 0) {
            return;
        }
        const storageKey = 'jhs_tag_expand';
        const wasExpanded = localStorage.getItem(storageKey) === 'true';
        const contentEl = $('.actor-tags .content');
        if (wasExpanded && contentEl.hasClass('collapse')) {
            expandBtn[0].click();
        }
        expandBtn.on('click', function () {
            const isExpanded = !contentEl.hasClass('collapse');
            localStorage.setItem(storageKey, isExpanded.toString());
        });
    }

    /** 监听列表容器 DOM 变更并自动重过滤/重排序。对应原 L8360-8392。 */
    checkDom(): void {
        if (!window.isListPage) {
            return;
        }
        const selectorConfig = this.getSelector();
        const containerEl = document.querySelector(selectorConfig.boxSelector);
        if (!containerEl) {
            clog.error('没有找到容器节点!');
            return;
        }
        const observerOptions: MutationObserverInit = {
            childList: true,
            subtree: false
        };
        const observer = this.supervisor.observe(containerEl, async () => {
            observer.disconnect();
            try {
                this.replaceHdImg();
                this.addJumpPageControl();
                await this.doFilter();
                await this.getBean('ListPageButtonPlugin').sortItems();
                $(this.getSelector().itemSelector + ' a').attr('target', '_blank');
                this.getBean('AutoPagePlugin').checkLoad();
            } finally {
                observer.observe(containerEl, observerOptions);
            }
        }, observerOptions);
    }

    /** 触发列表过滤。对应原 L8432-8440。 */
    async doFilter(): Promise<void> {
        if (!window.isListPage) {
            return;
        }
        const itemEls = $(this.getSelector().itemSelector).toArray();
        if (itemEls.length) {
            await this.filterMovieList(itemEls);
        }
    }

    /** 解析详情页女演员名称（若启用补录）。对应原 L8712-8739。 */
    async parseActressName(url: string): Promise<string | null> {
        let actressName: string | null = null;
        if ((await storageManager.getSetting('enableSaveActressCarInfo', NO)) === YES) {
            clog.debug('鉴定补录演员信息-已启用, 开始解析详情页');
            clog.debug('开始解析演员详情页', url);
            const html = await gmHttp.get(url);
            const $dom = utils.htmlTo$dom(String(html));
            if (isJavdbSite) {
                actressName = $dom
                    .find('.female')
                    .prev()
                    .map((_index: number, el: HTMLElement) => $(el).text())
                    .get()
                    .join(' ');
            }
            clog.debug('解析到名称:', actressName);
        }
        return actressName;
    }

    // ── 过滤 / status-tag（lp-filter.tsx）─────────────────────────────────

    async renderItemStatusTag(item: HTMLElement, carNum: string): Promise<void> {
        return _renderItemStatusTag(item, carNum);
    }
    async filterMovieList(itemEls: HTMLElement[]): Promise<void> {
        return _filterMovieList(this, itemEls);
    }

    // ── 翻译（lp-translate.ts）────────────────────────────────────────────

    async translate($item: JQuery): Promise<void> {
        return _translate(this, $item);
    }
    async revertTranslation(): Promise<void> {
        return _revertTranslation(this);
    }

    // ── DOM 解析 / 事件绑定（lp-dom.ts）───────────────────────────────────

    findCarNumAndHref($item: JQuery): {
        carNum: string;
        aHref: string;
        url: string;
        title: string;
        publishTime: string;
    } {
        return _findCarNumAndHref($item);
    }
    replaceHdImg(imgEls?: JQuery): void {
        return _replaceHdImg(this, imgEls);
    }
    showCarNumBox(carNum: string): void {
        return _showCarNumBox(carNum);
    }
    async bindClick(): Promise<void> {
        return _bindClick(this);
    }

    // ── 跳页控件（lp-jump-page.tsx）───────────────────────────────────────

    addJumpPageControl(): void {
        return _addJumpPageControl();
    }
}
