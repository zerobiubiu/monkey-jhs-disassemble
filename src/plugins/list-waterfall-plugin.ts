/**
 * 清单瀑布流插件 ListWaterfallPlugin —— 集成自
 * archetype/listWaterfall.user.js
 * （原脚本整体 L1-510，独立油猴脚本 `JavDB 清单瀑布流` v0.1.0）。
 *
 * 功能：为「我的清单」和「收藏的清单」页面启用瀑布流自动翻页，滚动接近底部
 * 自动加载下一页。GM_xmlhttpRequest 抓取下一页 HTML → DOMParser 解析 →
 * 提取 `#lists > ul` 的 li → 去重（id 集合）→ append 到当前容器 → 链接重写
 * （target=_blank + /lists/{id} 短地址）→ 替换分页 nav → 同步地址栏 URL
 * （replaceState）。含状态条三态（loading/error/no-more）+ 回到顶部按钮。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本 GM_addStyle 改走 initCss()，
 * GM_getValue 需补 grant + globals.d.ts 声明，GM_registerMenuCommand 保留。
 *
 * === 与主项目的兼容性（无冲突，独立运行） ===
 * 操作 `#lists > ul` 容器（清单列表页），与主项目 `AutoPagePlugin` 操作的
 * `.movie-list`（视频列表页）完全不同，无 DOM 容器冲突。
 *
 * 与 `ModMyListOpenWayPlugin`（doc/35）的协同：两者都操作 `#lists > ul > li`，
 * 但 ModMyListOpenWay 只处理首屏 li（修改打开方式），本插件的 rewriteItemLinks
 * 对 append 的新 li 做相同重写（原脚本注释"与 modMyListOpenWay 行为保持一致"）。
 * 两者操作不同 li 集合，不冲突。
 *
 * 原脚本 `@include /users/lists*` + `@include /users/favorite_lists*`，本项目
 * 在 handle() 内加 `ALLOWED_PATHS` 路径守卫等价实现。
 *
 * 控制流保留要点：
 * 1. isEnabled() 读 GM_getValue 开关（默认开启）；toggleEnabled 切换 + confirm 刷新
 * 2. ALLOWED_PATHS 路径白名单（/users/lists + /users/favorite_lists）
 * 3. init 查找容器 → 记录首屏 li id（去重集合）→ 创建 loader → 绑定 scroll
 * 4. loadNextPage：gmGet 抓 HTML → DOMParser 解析 → 提取 li → 去重 → append →
 *    rewriteItemLinks → 替换分页 nav → 记录 pageItems 滚动定位
 * 5. checkLoad：loader 距视口底部 PRELOAD_DISTANCE(800px) 时触发加载
 * 6. updateCurrentPageFromScroll：滚动时同步内部页码（不改地址栏）
 * 7. createBackToTopBtn + updateBackToTopBtn：rAF 节流的回到顶部按钮
 * 8. MAX_PAGES(200) 保护，防止异常无限加载
 *
 * 方法组已拆分至 ./list-waterfall/ 子目录：
 *   lw-fetch.ts  — loadNextPage / setState / findNextUrl / toAbsolute / SEL / LOG_PREFIX
 *   lw-scroll.ts — checkLoad / updateCurrentPageFromScroll
 * 本类保留同名薄委托方法，内部调用点签名不变。
 */
import { TaskSupervisor } from '../core/task-supervisor';
import { createBackToTopButton } from '../core/util/back-to-top';

import { BasePlugin } from './base-plugin';
import { findNextUrl, loadNextPage as lwLoadNextPage, LOG_PREFIX, SEL, setState, toAbsolute } from './list-waterfall/lw-fetch';
import { checkLoad, updateCurrentPageFromScroll } from './list-waterfall/lw-scroll';

import listWaterfallCssRaw from '../styles/list-waterfall-plugin.css?raw';

/** 瀑布流开关持久化键（GM_setValue/getValue）。 */
const ENABLED_KEY = 'jdb:list-waterfall-enabled';

/** 路径白名单（@include 较宽松，需在脚本内精确校验）。 */
const ALLOWED_PATHS = new Set(['/users/lists', '/users/favorite_lists']);

/** 每页滚动位置记录（用于滚动时同步地址栏）。 */
interface PageItem {
    /** 页码 */
    page: number;
    /** 该页顶部在文档中的滚动高度 */
    top: number;
    /** 该页 URL（用于 replaceState 同步地址栏） */
    url: string;
}

/**
 * 从当前 URL 提取初始页码。对应原 L170-173。
 *
 * @returns 页码，默认 1
 */
function getInitialPage(): number {
    const m = location.search.match(/[?&]page=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
}

/**
 * 读取瀑布流开关（默认开启）。对应原 L54-56。
 *
 * @returns 是否启用
 */
function isEnabled(): boolean {
    return GM_getValue(ENABLED_KEY, true);
}

/**
 * 清单瀑布流插件主类。
 *
 * 原脚本对应行号：L245-502（ListWaterfall 类）。原脚本用独立 class + IIFE 入口，
 * 此处转为 BasePlugin 子类，状态字段保留为类字段（sub-module 需访问）。
 */
export class ListWaterfallPlugin extends BasePlugin {
    /** 当前页码（滚动同步 / URL 与标题更新使用）。 */
    currentPage = getInitialPage();
    /** 下一页绝对 URL（无则表示已到底）。 */
    nextUrl: string | null = null;
    /** 是否还有更多页。 */
    hasMore = false;
    /** 加载中标志，防重入。 */
    isLoading = false;
    /** 状态条 DOM 节点。 */
    loader: HTMLDivElement | null = null;
    /** 清单列表容器（#lists > ul）。 */
    container: HTMLUListElement | null = null;
    /** 已加载的 li id 集合，用于去重检测。 */
    loadedIds: Set<string> = new Set();
    /** 每页滚动位置记录，用于滚动时同步地址栏。 */
    pageItems: PageItem[] = [];
    /** scroll 事件处理器引用。 */
    private _onScroll: (() => void) | null = null;
    /** 回到顶部按钮清理函数。 */
    private cleanupBackToTop: (() => void) | null = null;
    /** 任务生命周期管理器。 */
    private supervisor = new TaskSupervisor();

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "ListWaterfallPlugin"
     */
    getName(): string {
        return 'ListWaterfallPlugin';
    }

    /**
     * 注入 loader + 回到顶部按钮样式。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本用 GM_addStyle，此处走 initCss 机制返回 CSS 字符串。
     *
     * @returns list-waterfall-plugin.css 全文
     */
    async initCss(): Promise<string> {
        return listWaterfallCssRaw;
    }

    /**
     * 主处理：路径白名单 + 开关校验 → 初始化瀑布流。对应原 L155-162 + L506-507。
     *
     * 原脚本 `@include /users/lists*` + `@include /users/favorite_lists*`，本项目
     * 在 handle() 内加 `ALLOWED_PATHS` 路径守卫等价实现。
     * 原脚本 GM_registerMenuCommand 在 IIFE 顶层注册，此处移到 handle() 内注册
     * （仅清单页注册，非清单页不注册菜单）。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 路径白名单校验
        if (!ALLOWED_PATHS.has(location.pathname)) return;
        // 开关校验
        if (!isEnabled()) {
            console.log(`${LOG_PREFIX} 瀑布流已关闭，退出`);
            return;
        }
        // 注册菜单命令（原脚本在 IIFE 顶层注册，此处移到 handle 内仅清单页注册）
        GM_registerMenuCommand(
            `${isEnabled() ? '✓' : '✗'} 清单瀑布流自动翻页`,
            this.toggleEnabled.bind(this)
        );
        this.init();
    }

    /**
     * 切换开关状态并提示刷新。对应原 L61-72。
     */
    private toggleEnabled(): void {
        const next = !isEnabled();
        GM_setValue(ENABLED_KEY, next);
        console.log(`${LOG_PREFIX} 瀑布流开关: ${next ? '开启' : '关闭'}`);
        if (
            window.confirm(
                `清单瀑布流自动翻页已${next ? '开启' : '关闭'}，是否刷新页面应用？`
            )
        ) {
            window.location.reload();
        }
    }

    /**
     * 初始化瀑布流：查找容器、记录首屏、创建状态条、绑定滚动。对应原 L274-334。
     */
    private init(): void {
        this.container = document.querySelector(SEL.box);
        if (!this.container) {
            console.warn(`${LOG_PREFIX} 未找到容器 ${SEL.box}，退出`);
            return;
        }

        // 记录首屏所有 li 的 id，用于后续去重
        this.container.querySelectorAll(SEL.item).forEach((li: Element) => {
            if (li.id) this.loadedIds.add(li.id);
        });

        // 创建状态条并插入到容器之后
        this.loader = document.createElement('div');
        this.loader.className = 'jdb-wf-loader';
        this.container.parentNode!.insertBefore(
            this.loader,
            this.container.nextSibling
        );

        // 点击错误状态重试
        this.supervisor.addEventListener(this.loader, 'click', () => {
            if (this.loader!.classList.contains('error')) {
                this.loadNextPage();
            }
        });

        // 记录首页信息
        const nextHref = findNextUrl(document);
        this.nextUrl = nextHref ? toAbsolute(nextHref) : null;
        this.hasMore = !!this.nextUrl;

        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href
        });

        // 创建回到顶部按钮
        this.cleanupBackToTop = createBackToTopButton();

        // 绑定滚动监听（passive，不阻止滚动）
        this._onScroll = () => {
            this.checkLoad();
            this.updateCurrentPageFromScroll();
        };
        this.supervisor.addEventListener(window, 'scroll', this._onScroll, {
            passive: true
        });

        // 启动后立即检查一次（可能首屏内容不足以填满视口）
        this.supervisor.setTimeout(() => this.checkLoad(), 500);

        if (!this.hasMore) {
            this.setState('no-more', '已经到底了');
        } else {
            this.setState('', '');
        }

        console.log(`${LOG_PREFIX} 已启动 (页码 ${this.currentPage})`);
    }

    /**
     * 加载下一页。委托至 list-waterfall/lw-fetch。
     */
    private async loadNextPage(): Promise<void> {
        return lwLoadNextPage(this);
    }

    /**
     * 检查是否需要触发加载。委托至 list-waterfall/lw-scroll。
     */
    private checkLoad(): void {
        checkLoad(this);
    }

    /**
     * 根据滚动位置更新当前页码。委托至 list-waterfall/lw-scroll。
     */
    private updateCurrentPageFromScroll(): void {
        updateCurrentPageFromScroll(this);
    }

    /**
     * 设置状态条样式与文本。委托至 list-waterfall/lw-fetch。
     */
    private setState(cls: string, text: string): void {
        setState(this, cls, text);
    }

    /**
     * 销毁插件，中止所有异步任务。
     */
    destroy(): void {
        this.cleanupBackToTop?.();
        this.supervisor.abort();
    }
}
