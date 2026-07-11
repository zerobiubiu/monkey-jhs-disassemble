/**
 * 自动翻页（瀑布流）插件 AutoPagePlugin —— 对应原脚本 archetype/jhs.user.js L9070-9296。
 *
 * 在列表页（window.isListPage）滚动接近底部时自动抓取下一页并追加到列表容器，
 * 同步当前页码到 URL（replaceState）；JavDb 站超过 60 页（c11 类目 30 页）或月度
 * 页时改走 Beyond60Plugin；翻页结果出现连续重复番号时判定被 JavDB 限制页码并
 * 停止瀑布流。
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
import { NO, YES } from '../constants/status';
import { featureFlags } from '../core/feature-flags';
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
            if (loader.classList.contains('waterfall-error')) {
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
        setTimeout(() => {
            this.checkLoad();
        }, 1000);
        if (!this.hasMore) {
            this.setState('waterfall-no-more', '已经到底了');
        }
    }

    /**
     * 抓取并追加下一页：autoPage 设置为 NO 时直接返回；JavDb 站超过 60 页
     * （c11 类目 30 页）或月度页时走 Beyond60Plugin；否则 gmHttp 抓取并校验
     * 重复番号后追加。对应原 L9145-9236。
     *
     * @returns Promise<void>；抓取失败时切换错误态，不抛出
     */
    async loadNextPage(): Promise<void> {
        if ((await storageManager.getSetting('autoPage', YES)) === NO) {
            this.setState('waterfall-loading', '');
            return;
        }
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
        }
    }

    /**
     * 滚动时同步当前页码：自末页向前找到首个顶部坐标 ≤ scrollY 的页，页码
     * 变化时更新 URL。对应原 L9237-9249。
     */
    checkScrollPosition(): void {
        const scrollY = window.scrollY;
        for (let i = this.pageItems.length - 1; i >= 0; i--) {
            const item = this.pageItems[i];
            if (scrollY >= item.top) {
                if (this.currentPage !== item.page) {
                    this.currentPage = item.page;
                    this.updatePageUrl(item.url);
                }
                break;
            }
        }
    }

    /**
     * 探测 loader 是否进入预加载区间，是则触发下一页抓取。对应原 L9250-9260。
     */
    checkLoad(): void {
        if (!this.loader) {
            return;
        }
        if (this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance) {
            this.loadNextPage().then();
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
        await storageManager.getSetting('autoPage', YES);
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
     * 旧版 URL 同步（pushState）；已被 updatePageUrl 取代，保留以维持原逻辑。
     * 对应原 L9275-9282。
     *
     * @param url 目标页 URL
     */
    updatePageUrl_old(url: string): void {
        window.history.pushState({}, '', url);
    }

    /**
     * 同步当前页到地址栏。
     * flag 开：replaceState（不污染历史栈）；flag 关：pushState。
     *
     * @param url 目标页 URL
     */
    updatePageUrl(url: string): void {
        if (featureFlags.autoPageReplaceState) {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
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
