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
 * any；运行时挂载到 window 的 isListPage 以 (window as any).isListPage 访问；
 * 内联 CSS/HTML 模板字符串原样保留。
 */
import { currentHref, isJavdbSite } from '../constants/site';
import { BasePlugin } from './base-plugin';
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
    /** 是否还有后续页可加载。 */
    hasMore = false;
    /** 是否正在请求下一页（防重入）。 */
    isLoading = false;
    /** 「加载全部」浮动按钮节点（有下一页时始终显示）。 */
    loadAllBtn: HTMLDivElement | null = null;
    /** 是否正在自动加载全部后续页（防重入）。 */
    isLoadingAll = false;
    /**
     * 触底加载方式：auto=滑到底自动加载下一页；click=滑到底显示按钮，点击再加载。
     * 设置项 autoPageLoadMode，缺省 auto。瀑布流本身常开。
     */
    loadMode: 'auto' | 'click' = 'auto';

    /**
     * 返回插件名，供 PluginManager 注册去重。对应原 L9077-9079。
     *
     * @returns "AutoPagePlugin"
     */
    getName(): string {
        return 'AutoPagePlugin';
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
            console.error('没有找到容器节点,停止瀑布流!');
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
        loader.addEventListener('click', () => {
            // 错误重试 / 点按钮加载下一页
            if (
                loader.classList.contains('waterfall-error') ||
                loader.classList.contains('waterfall-click')
            ) {
                this.loadNextPage().then();
            }
        });
        window.addEventListener('scroll', () => {
            this.checkLoad();
            this.checkScrollPosition();
        });
        const nextLinkEl = document.querySelector<HTMLAnchorElement>(
            selectorConfig.nextPageSelector
        );
        this.nextUrl = nextLinkEl == null ? undefined : nextLinkEl.href;
        this.hasMore = !!this.nextUrl;
        // 瀑布流常开；触底方式由 autoPageLoadMode 控制
        const mode = await storageManager.getSetting('autoPageLoadMode', 'auto');
        this.loadMode = mode === 'click' ? 'click' : 'auto';
        setTimeout(() => {
            this.checkLoad();
        }, 1000);
        if (!this.hasMore) {
            this.setState('waterfall-no-more', '已经到底了');
        } else {
            // 有下一页时始终显示「加载全部」
            this.showLoadAllBtn();
        }
    }

    /**
     * 抓取并追加下一页。JavDb 站超过 60 页（c11 类目 30 页）或月度页时走
     * Beyond60Plugin；否则 gmHttp 抓取并校验重复番号后追加。对应原 L9145-9236。
     *
     * @returns Promise<void>；抓取失败时切换错误态，不抛出
     */
    async loadNextPage(): Promise<void> {
        if (this.isLoading || !this.nextUrl) {
            return;
        }
        this.isLoading = true;
        this.setState('waterfall-loading', '加载中...');
        const selectorConfig = this.getSelector();
        try {
            const pageNum = utils.getUrlParam(this.nextUrl, 'page');
            let maxPage = 60;
            if (currentHref.includes('c11')) {
                maxPage = 30;
            }
            if ((isJavdbSite && pageNum > maxPage) || currentHref.includes('month')) {
                const beyond60Plugin = this.getBean('Beyond60Plugin');
                if (beyond60Plugin) {
                    const {
                        html,
                        nextUrl: beyondNextUrl,
                        hasMore: beyondHasMore
                    } = await beyond60Plugin.handleBeyond60(this.nextUrl);
                    if (html) {
                        const scrollHeight = this.container!.scrollHeight;
                        this.pageItems.push({
                            page: this.currentPage + 1,
                            top: scrollHeight,
                            url: this.nextUrl
                        });
                        $('.movie-list').append(html);
                    }
                    this.hasMore = beyondHasMore;
                    this.nextUrl = beyondNextUrl;
                    const paginationHtml = beyond60Plugin.createPagination(pageNum, beyondHasMore);
                    $('.pagination').html(paginationHtml);
                    this.setState('waterfall-loading', '');
                    if (!this.hasMore) {
                        this.setState('waterfall-no-more', '已经到底了');
                    }
                    return;
                }
            }
            const responseHtml = await gmHttp.get(this.nextUrl);
            clog.log('请求下一页内容:', this.nextUrl);
            const $dom = utils.htmlTo$dom(responseHtml);
            const items = $dom.find(this.getSelector().requestDomItemSelector);
            const existingList = this.getBoxCarInfoList();
            const newList = this.getBoxCarInfoList(items);
            if (this.checkDuplicateCarNumbers(existingList, newList)) {
                this.nextUrl = null;
                this.hasMore = false;
                this.setState(
                    'waterfall-error',
                    '翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流'
                );
                return;
            }
            const scrollHeight = this.container!.scrollHeight;
            this.pageItems.push({
                page: this.currentPage + 1,
                top: scrollHeight,
                url: this.nextUrl
            });
            const listPagePlugin = this.getBean('ListPagePlugin');
            const coverImgs = $dom.find(this.getSelector().coverImgSelector);
            listPagePlugin.replaceHdImg(coverImgs);
            $(this.getSelector().boxSelector).append(items);
            const nextLinkEl = $dom.find(selectorConfig.nextPageSelector);
            this.nextUrl = nextLinkEl == null ? undefined : nextLinkEl.attr('href');
            this.hasMore = !!this.nextUrl;
            const paginationEl = $dom.find('.pagination');
            $('.pagination').replaceWith(paginationEl);
            this.setState('waterfall-loading', '');
            if (!this.hasMore) {
                this.setState('waterfall-no-more', '已经到底了');
            }
        } catch (err) {
            clog.error('加载失败:', err);
            this.setState('waterfall-error', '加载失败，点击重试');
        } finally {
            this.isLoading = false;
            // 点按钮模式：本页加载完若仍在底部，再次显示「点击加载下一页」
            if (this.loadMode === 'click' && this.hasMore && this.nextUrl) {
                this.checkLoad();
            }
        }
    }

    /**
     * 滚动时同步内部 currentPage（供「加载全部」文案等使用）。
     * 不再改地址栏，避免瀑布流滚动污染 URL。对应原 L9237-9249（已去 URL 同步）。
     */
    checkScrollPosition(): void {
        const scrollY = window.scrollY;
        for (let i = this.pageItems.length - 1; i >= 0; i--) {
            const item = this.pageItems[i];
            if (scrollY >= item.top) {
                if (this.currentPage !== item.page) {
                    this.currentPage = item.page;
                }
                break;
            }
        }
    }

    /**
     * 探测 loader 是否进入预加载区间。
     * - loadMode=auto：自动抓取下一页
     * - loadMode=click：展示「点击加载下一页」，由用户点击 loader 再抓取
     */
    checkLoad(): void {
        if (!this.loader) {
            return;
        }
        if (this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance) {
            if (this.loadMode === 'click') {
                if (
                    this.isLoading ||
                    !this.hasMore ||
                    !this.nextUrl ||
                    this.loader.classList.contains('waterfall-error') ||
                    this.loader.classList.contains('waterfall-loading') ||
                    this.loader.classList.contains('waterfall-no-more')
                ) {
                    return;
                }
                this.setState('waterfall-click', '点击加载下一页');
            } else {
                this.loadNextPage().then();
            }
        }
    }

    /**
     * 运行时切换触底加载方式（设置面板即时生效，无需整页刷新）。
     * @param mode auto | click
     */
    setLoadMode(mode: 'auto' | 'click'): void {
        this.loadMode = mode === 'click' ? 'click' : 'auto';
        if (this.loadMode === 'auto') {
            // 切回自动：若已在底部则立即尝试加载
            this.checkLoad();
        } else if (
            this.loader &&
            this.hasMore &&
            this.nextUrl &&
            !this.isLoading &&
            !this.loader.classList.contains('waterfall-no-more')
        ) {
            // 切到点按钮：若已在底部则显示提示
            if (
                this.loader.getBoundingClientRect().top <
                window.innerHeight + this.preloadDistance
            ) {
                this.setState('waterfall-click', '点击加载下一页');
            }
        }
    }

    /**
     * 判定是否禁用瀑布流：非列表页直接禁用；URL 命中搜索/播放/已观看/高级
     * 搜索等路径时禁用。对应原 L9261-9274。
     *
     * @returns Promise<boolean>，true 表示禁用
     */
    async shouldDisablePaging(): Promise<boolean> {
        if (!(window as any).isListPage) {
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

    /**
     * 显示「加载全部」按钮（瀑布流模式开启时由设置面板 change 调用）。
     * 已存在 / 无下一页 / 容器未初始化时不创建，避免重复。
     */
    showLoadAllBtn(): void {
        if (this.loadAllBtn) return;
        if (!this.container || !this.hasMore) return;
        this.createLoadAllBtn();
    }

    /**
     * 隐藏并移除「加载全部」按钮（瀑布流模式关闭时由设置面板 change 调用）。
     * 正在 loadAllPages 时安全移除（后续 updateLoadAllBtn 对 null 跳过）。
     */
    hideLoadAllBtn(): void {
        if (!this.loadAllBtn) return;
        this.loadAllBtn.remove();
        this.loadAllBtn = null;
    }

    /**
     * 创建「加载全部」浮动按钮并追加到 body。
     * 瀑布流模式且有下一页时调用，点击后循环加载所有后续页。
     */
    createLoadAllBtn(): void {
        const btn = document.createElement('div');
        btn.className = 'jhs-load-all-btn';
        btn.textContent = '加载全部';
        btn.addEventListener('click', () => {
            if (!this.isLoadingAll) {
                this.loadAllPages().then();
            }
        });
        document.body.appendChild(btn);
        this.loadAllBtn = btn;
    }

    /**
     * 自动加载后续所有页：循环 loadNextPage 直到无更多页、出错或无进展。
     * 通过 pageItems.length 变化检测无进展（autoPage 被关闭 / isLoading 重入）。
     * 循环退出后感知 loadNextPage 设置的 loader 状态（waterfall-error/no-more），
     * 区分"页码受限停止"/"加载失败"/"全部加载完"三种结果，同步按钮文案。
     */
    async loadAllPages(): Promise<void> {
        if (this.isLoadingAll || !this.hasMore) return;
        this.isLoadingAll = true;
        this.updateLoadAllBtn('加载中...', true);
        try {
            while (this.hasMore && this.nextUrl) {
                const before = this.pageItems.length;
                await this.loadNextPage();
                if (this.pageItems.length === before) break;
                this.updateLoadAllBtn(`加载中...（第 ${this.currentPage} 页）`, true);
            }
            // 深度融合：感知 loadNextPage 设置的 loader 状态
            if (this.loader?.classList.contains('waterfall-error')) {
                const text = this.loader?.textContent || '';
                if (text.includes('重复')) {
                    this.updateLoadAllBtn('已停止（页码受限）', false);
                } else {
                    this.updateLoadAllBtn('加载失败，点击重试', false);
                }
            } else {
                this.updateLoadAllBtn('✓ 已全部加载', false);
                setTimeout(() => {
                    this.loadAllBtn?.classList.add('jhs-load-all-fadeout');
                    setTimeout(() => {
                        this.loadAllBtn?.remove();
                        this.loadAllBtn = null;
                    }, 500);
                }, 2000);
            }
        } catch {
            this.updateLoadAllBtn('加载失败，点击重试', false);
        } finally {
            this.isLoadingAll = false;
        }
    }

    /**
     * 更新「加载全部」按钮文案与禁用态。
     * @param text 按钮文案
     * @param disabled 是否禁用（加载中时禁用点击视觉）
     */
    updateLoadAllBtn(text: string, disabled: boolean): void {
        if (!this.loadAllBtn) return;
        this.loadAllBtn.textContent = text;
        if (disabled) {
            this.loadAllBtn.classList.add('jhs-load-all-disabled');
        } else {
            this.loadAllBtn.classList.remove('jhs-load-all-disabled');
        }
    }

    /**
     * 设置 loader 的状态类与文案。对应原 L9292-9295。
     *
     * @param stateClass 状态类名（waterfall-loading/error/no-more）
     * @param text 展示文案
     */
    setState(stateClass: string, text: string): void {
        this.loader!.className = `jhs-scroll ${stateClass}`;
        this.loader!.textContent = text;
    }
}
