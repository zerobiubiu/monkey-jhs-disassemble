/**
 * 自动翻页（瀑布流）插件 AutoPagePlugin —— 对应原脚本 archetype/jhs.user.js L9070-9296。
 *
 * 在列表页（window.isListPage）滚动接近底部时自动抓取下一页并追加到列表容器。
 * 不修改地址栏 URL（保持进入列表时的原始地址）。JavDb 站超过 60 页（c11 类目
 * 30 页）或月度页时改走 Beyond60Plugin；翻页结果重复番号比例≥50%时判定被 JavDB
 * 限制页码并停止瀑布流。
 *
 * 原构造函数中 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 改为 class 字段语法（useDefineForClassFields:true，语义一致）；单字母局部变量
 * （原 e/t/n/a/i/s/c/d/h/g/p/m/u）已语义化；顶层站点/状态常量 o/r/_/C 改由
 * ../constants 引入（currentHref/isJavdbSite/YES/NO）。
 *
 * $ / utils / storageManager / clog / gmHttp 已由 ../types/globals.d.ts 声明为
 * any；运行时挂载到 window 的 isListPage 以 window.isListPage 访问；
 * 内联 CSS/HTML 模板字符串原样保留。
 *
 * 方法组已拆分至 ./auto-page/ 子目录：
 *   ap-fetch.ts  — loadNextPage（抓取并追加下一页）
 *   ap-scroll.ts — checkScrollPosition / checkLoad / setLoadMode /
 *                  showLoadAllBtn / hideLoadAllBtn / createLoadAllBtn /
 *                  loadAllPages / updateLoadAllBtn / setState
 * 本类保留同名薄委托方法，内部调用点签名不变。
 */
import { currentHref, isJavdbSite } from '../constants/site';

import type { PageType } from '../core/page-context';
import { TaskSupervisor } from '../core/task-supervisor';
import { PaginationStateMachine } from '../core/pagination-state';

import { BasePlugin } from './base-plugin';
import { loadNextPage } from './auto-page/ap-fetch';
import {
    checkLoad,
    checkScrollPosition,
    createLoadAllBtn,
    hideLoadAllBtn,
    loadAllPages,
    setLoadMode,
    setState,
    showLoadAllBtn,
    updateLoadAllBtn
} from './auto-page/ap-scroll';

import autoPageCssRaw from '../styles/auto-page-plugin.css?raw';

/** 单页元信息（滚动同步当前页码用）。 */
export interface PageItem {
    /** 页码 */
    page: number;
    /** 该页顶部在文档中的滚动高度 */
    top: number;
    /** 该页 URL（用于 replaceState 同步地址栏） */
    url: string;
}

export class AutoPagePlugin extends BasePlugin {
    /** 预加载触发距离（px）：loader 顶部进入「视口高度 + 该距离」时触发翻页。 */
    preloadDistance = 500;
    /** 当前页码（滚动同步 / URL 与标题更新使用），构造时按当前 URL 解析。 */
    currentPage = this.getInitialPageNumber();
    /** 已加载页元信息列表（页码 / 顶部坐标 / URL），供滚动时定位当前页。 */
    pageItems: PageItem[] = [];
    /** 列表容器节点（waterfall 启动时由 boxSelector 查得）。 */
    container: Element | null = null;
    /** 瀑布流状态 loader 节点（展示加载中 / 错误 / 无更多）。 */
    loader: HTMLDivElement | null = null;
    /** 下一页 URL；无更多时为 null/undefined。 */
    nextUrl: string | null | undefined = undefined;
    /** 分页状态机：统一管理 hasMore/isLoading/phase 状态转换。 */
    pagination = new PaginationStateMachine();
    /** 「加载全部」浮动按钮节点（有下一页时始终显示）。 */
    loadAllBtn: HTMLDivElement | null = null;
    /** 是否正在自动加载全部后续页（防重入）。 */
    isLoadingAll = false;
    /**
     * 触底加载方式：auto=滑到底自动加载下一页；click=滑到底显示按钮，点击再加载。
     * 设置项 autoPageLoadMode，缺省 auto。瀑布流本身常开。
     */
    loadMode: 'auto' | 'click' = 'auto';
    /** 统一生命周期管理器：定时器、事件监听器、Observer 的注册与清理。 */
    supervisor = new TaskSupervisor();

    /**
     * 返回插件名，供 PluginManager 注册去重。对应原 L9077-9079。
     *
     * @returns "AutoPagePlugin"
     */
    getName(): string {
        return 'AutoPagePlugin';
    }

    /** 销毁插件：中止所有注册的定时器与事件监听器。 */
    destroy(): void {
        this.supervisor.abort();
    }

    /** 仅在列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['list'];
    }

    /**
     * 注入瀑布流 loader 的内联样式。对应原 L9080-9082。
     *
     * @returns Promise<string>，含 <style> 的 CSS 片段；无异常抛出
     */
    async initCss(): Promise<string> {
        return autoPageCssRaw;
    }

    /**
     * 列表页主处理：启动瀑布流。对应原 L9083-9085。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        this.waterfall().then();
    }

    /**
     * 依当前 URL 解析初始页码：JavDb 站匹配 `?page=N`；未匹配返回 1。对应原
     * L9086-9104。
     *
     * @returns 页码（≥1）
     */
    getInitialPageNumber(): number {
        if (isJavdbSite) {
            const match = currentHref.match(/[?&]page=(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            } else {
                return 1;
            }
        }
        return 1;
    }

    /**
     * 启动瀑布流：查找容器、创建 loader、注册滚动/点击事件、探测下一页。
     * 对应原 L9105-9144。
     *
     * @returns Promise<void>；容器缺失时打印错误并返回，不抛出
     */
    async waterfall(): Promise<void> {
        if (await this.shouldDisablePaging()) {
            return;
        }
        const selectorConfig = this.getSelector();
        this.container = document.querySelector(selectorConfig.boxSelector);
        if (!this.container) {
            clog.error('没有找到容器节点,停止瀑布流!');
            return;
        }
        const container = this.container;
        this.loader = document.createElement('div');
        const loader = this.loader;
        loader.className = 'jhs-scroll';
        container.parentNode!.insertBefore(loader, container.nextSibling);
        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href
        });
        this.supervisor.addEventListener(loader, 'click', () => {
            // 错误重试 / 点按钮加载下一页
            if (
                loader.classList.contains('waterfall-error') ||
                loader.classList.contains('waterfall-click')
            ) {
                this.pagination.retry();
                this.loadNextPage().then();
            }
        });
        this.supervisor.addEventListener(window, 'scroll', () => {
            this.checkLoad();
            this.checkScrollPosition();
        });
        const nextLinkEl = document.querySelector<HTMLAnchorElement>(
            selectorConfig.nextPageSelector
        );
        this.nextUrl = nextLinkEl == null ? undefined : nextLinkEl.href;
        this.pagination.init(!!this.nextUrl);
        // 瀑布流常开；触底方式由 autoPageLoadMode 控制
        const mode = await storageManager.getSetting('autoPageLoadMode', 'auto');
        this.loadMode = mode === 'click' ? 'click' : 'auto';
        this.supervisor.setTimeout(() => {
            this.checkLoad();
        }, 1000);
        if (!this.pagination.hasMore) {
            this.setState('waterfall-no-more', '已经到底了');
        } else {
            // 有下一页时始终显示「加载全部」
            this.showLoadAllBtn();
        }
    }

    /**
     * 抓取并追加下一页。委托至 auto-page/ap-fetch。
     */
    async loadNextPage(): Promise<void> {
        return loadNextPage(this);
    }

    /**
     * 滚动时同步内部 currentPage。委托至 auto-page/ap-scroll。
     */
    checkScrollPosition(): void {
        checkScrollPosition(this);
    }

    /**
     * 探测 loader 是否进入预加载区间。委托至 auto-page/ap-scroll。
     */
    checkLoad(): void {
        checkLoad(this);
    }

    /**
     * 运行时切换触底加载方式。委托至 auto-page/ap-scroll。
     */
    setLoadMode(mode: 'auto' | 'click'): void {
        setLoadMode(this, mode);
    }

    /**
     * 显示「加载全部」按钮。委托至 auto-page/ap-scroll。
     */
    showLoadAllBtn(): void {
        showLoadAllBtn(this);
    }

    /**
     * 隐藏并移除「加载全部」按钮。委托至 auto-page/ap-scroll。
     */
    hideLoadAllBtn(): void {
        hideLoadAllBtn(this);
    }

    /**
     * 创建「加载全部」浮动按钮。委托至 auto-page/ap-scroll。
     */
    createLoadAllBtn(): void {
        createLoadAllBtn(this);
    }

    /**
     * 自动加载后续所有页。委托至 auto-page/ap-scroll。
     */
    async loadAllPages(): Promise<void> {
        return loadAllPages(this);
    }

    /**
     * 更新「加载全部」按钮文案与禁用态。委托至 auto-page/ap-scroll。
     */
    updateLoadAllBtn(text: string, disabled: boolean): void {
        updateLoadAllBtn(this, text, disabled);
    }

    /**
     * 设置 loader 的状态类与文案。委托至 auto-page/ap-scroll。
     */
    setState(stateClass: string, text: string): void {
        setState(this, stateClass, text);
    }

    /**
     * 判定是否禁用瀑布流：非列表页直接禁用；URL 命中搜索/播放/已观看/高级
     * 搜索等路径时禁用。对应原 L9261-9274。
     *
     * @returns Promise<boolean>，true 表示禁用
     */
    async shouldDisablePaging(): Promise<boolean> {
        if (!window.isListPage) {
            return true;
        }
        return [
            'search?q',
            'handlePlayback=1',
            'handleTop=1',
            '/want_watch_videos',
            '/watched_videos',
            '/advanced_search?type=100'
        ].some((pattern) => currentHref.includes(pattern));
    }

    /**
     * 历史遗留：曾同步当前页到地址栏。瀑布流不再改 URL，保留空实现以免外部调用报错。
     * @param _url 忽略
     */
    updatePageUrl_old(_url: string): void {
        /* no-op：不修改地址栏 */
    }

    /**
     * 历史遗留：曾同步当前页到地址栏（replaceState/pushState）。
     * 现固定 no-op，瀑布流保持进入列表时的原始 URL。
     * @param _url 忽略
     */
    updatePageUrl(_url: string): void {
        /* no-op：不修改地址栏 */
    }
}
