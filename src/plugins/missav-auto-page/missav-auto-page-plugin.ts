/**
 * MissAV 列表页瀑布流插件 MissavAutoPagePlugin。
 *
 * 加载模式对齐 javdb AutoPagePlugin 的 click 模式：滚动触底时在底部显示
 * 「点击加载下一页」按钮，点击加载一页；另有「加载全部」浮动按钮（循环加载
 * 所有剩余页）与「回到顶部」按钮（复用 core/util/back-to-top 工厂）。
 *
 * 番号去重防重复追加；追加缩略图时修复站点懒加载（data-src → src）。
 * 无设置项、无 pageTypes 覆写：isMissavSite 站点注册即激活。
 *
 * 模块依赖：map-selectors（选择器/纯函数）、map-fetch（抓取追加）。
 */
import { PaginationStateMachine } from '../../core/pagination-state';
import { TaskSupervisor } from '../../core/task-supervisor';
import { createBackToTopButton } from '../../core/util/back-to-top';

import { BasePlugin } from '../base-plugin';
import { isVideoPage } from '../car-status-sync/missav-renderer';
import { fetchNextPage } from './map-fetch';
import { MAP_SEL, collectCarNums, extractThumbs, findNextUrl } from './map-selectors';

import missavAutoPageCssRaw from '../../styles/missav-auto-page/missav-auto-page.css?raw';
import backToTopCssRaw from '../../styles/back-to-top-button.css?raw';

/** 触底检测预加载距离（px）：loader 进入「视口高度 + 该距离」时显示加载按钮。 */
const PRELOAD_DISTANCE = 800;

export class MissavAutoPagePlugin extends BasePlugin {
    /** 缩略图网格容器节点（handle 时按 MAP_SEL.grid 查得，失败降级父链）。 */
    container: Element | null = null;
    /** 下一页 URL；无更多页面时为 null。 */
    nextUrl: string | null = null;
    /** 分页状态机：统一管理 hasMore/phase 状态转换。 */
    pagination = new PaginationStateMachine();
    /** 统一生命周期管理器：事件监听器注册与清理。 */
    supervisor = new TaskSupervisor();
    /** 底部 loader 节点（加载下一页按钮 / 状态提示）。 */
    loader: HTMLDivElement | null = null;
    /** 「加载全部」浮动按钮节点。 */
    loadAllBtn: HTMLDivElement | null = null;
    /** 是否正在加载全部（防重入）。 */
    isLoadingAll = false;
    /** 已加载页数（初始 1，成功后递增，供「加载全部」文案显示页码）。 */
    loadedPages = 1;
    /** 已加载缩略图的番号集合，用于跨页去重。 */
    loadedCarNums = new Set<string>();
    /** 回到顶部按钮清理函数（destroy 时调用）。 */
    private backToTopCleanup: (() => void) | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "MissavAutoPagePlugin"
     */
    getName(): string {
        return 'MissavAutoPagePlugin';
    }

    /**
     * 注入瀑布流 loader / 加载全部按钮 / 回到顶部按钮样式。
     *
     * @returns Promise<string>，拼接的 CSS 片段；无异常抛出
     */
    async initCss(): Promise<string> {
        return missavAutoPageCssRaw + backToTopCssRaw;
    }

    /**
     * MissAV 列表页主处理：定位容器、创建 loader / 加载全部 / 回到顶部按钮、
     * 注册滚动与点击事件、探测下一页并预填当前页番号。
     *
     * @returns Promise<void>；容器缺失时静默返回，不抛出
     */
    async handle(): Promise<void> {
        // 视频播放页不启用瀑布流（底部推荐区有同款 grid，Camoufox 实测无分页链接，跳过避免注入无意义 loader）
        if (isVideoPage()) return;

        let container = document.querySelector(MAP_SEL.grid);
        if (!container) {
            // 降级：按探针实测父链取缩略图容器
            container = document.querySelector(MAP_SEL.thumb)?.parentElement?.parentElement ?? null;
        }
        if (!container) return;
        this.container = container;

        // 注入 loader（「点击加载下一页」按钮载体）到容器之后
        const loader = document.createElement('div');
        loader.className = 'jhs-map-loader';
        container.parentNode?.insertBefore(loader, container.nextSibling);
        this.loader = loader;

        // 探测下一页 + 初始化状态机
        this.nextUrl = findNextUrl(document);
        this.pagination.init(!!this.nextUrl);

        // 预填当前页已加载番号
        collectCarNums(extractThumbs(container)).forEach((c) => c && this.loadedCarNums.add(c));

        // loader 点击：加载下一页 / 错误态重试
        this.supervisor.addEventListener(loader, 'click', () => {
            if (this.pagination.isLoading) return;
            if (this.pagination.phase === 'error') this.pagination.retry();
            if (this.pagination.canLoad && this.nextUrl) {
                void fetchNextPage(this);
            }
        });

        // 滚动触底检测：loader 进入预加载区间时显示「点击加载下一页」按钮
        this.supervisor.addEventListener(window, 'scroll', () => this.checkLoad(), {
            passive: true
        });

        // 「加载全部」浮动按钮（有下一页时创建）
        this.showLoadAllBtn();

        // 回到顶部按钮（复用核心工厂，样式由 initCss 注入）
        this.backToTopCleanup = createBackToTopButton();

        // 初始检测：首屏已在底部时直接显示加载按钮
        this.supervisor.setTimeout(() => {
            this.checkLoad();
        }, 500);

        if (!this.pagination.hasMore) {
            this.setLoader('jhs-map-no-more', '已经到底了');
        }
    }

    /**
     * 触底检测：loader 进入预加载区间且可加载时，显示「点击加载下一页」按钮。
     * 不自动加载（click 模式，对齐 javdb 视频流页面交互）。
     */
    checkLoad(): void {
        if (!this.loader) return;
        if (this.loader.getBoundingClientRect().top < window.innerHeight + PRELOAD_DISTANCE) {
            if (
                this.pagination.isLoading ||
                !this.pagination.hasMore ||
                !this.nextUrl ||
                this.loader.classList.contains('jhs-map-error') ||
                this.loader.classList.contains('jhs-map-loading') ||
                this.loader.classList.contains('jhs-map-no-more')
            ) {
                return;
            }
            this.setLoader('jhs-map-click', '点击加载下一页');
        }
    }

    /**
     * 显示「加载全部」浮动按钮。已存在 / 无下一页 / 容器未初始化时不创建。
     */
    showLoadAllBtn(): void {
        if (this.loadAllBtn) return;
        if (!this.container || !this.pagination.hasMore) return;
        const btn = document.createElement('div');
        btn.className = 'jhs-map-load-all-btn';
        btn.textContent = '加载全部';
        this.supervisor.addEventListener(btn, 'click', () => {
            if (!this.isLoadingAll) {
                void this.loadAllPages();
            }
        });
        document.body.appendChild(btn);
        this.loadAllBtn = btn;
    }

    /**
     * 自动加载后续所有页：循环 fetchNextPage 直到无更多页、出错或无进展。
     * 通过 loadedCarNums.size 变化检测无进展（防死循环）。
     * 循环退出后感知 loader 状态（error），区分「加载失败」/「全部加载完」。
     */
    async loadAllPages(): Promise<void> {
        if (this.isLoadingAll || !this.pagination.hasMore) return;
        this.isLoadingAll = true;
        this.updateLoadAllBtn('加载中...', true);
        try {
            while (this.pagination.hasMore && this.nextUrl) {
                const before = this.loadedCarNums.size;
                await fetchNextPage(this);
                if (this.loadedCarNums.size === before) break;
                this.updateLoadAllBtn(`加载中...（第 ${this.loadedPages} 页）`, true);
            }
            if (this.loader?.classList.contains('jhs-map-error')) {
                this.updateLoadAllBtn('加载失败，点击重试', false);
            } else {
                this.updateLoadAllBtn('✓ 已全部加载', false);
                this.supervisor.setTimeout(() => {
                    this.loadAllBtn?.classList.add('jhs-map-load-all-fadeout');
                    this.supervisor.setTimeout(() => {
                        this.loadAllBtn?.remove();
                        this.loadAllBtn = null;
                    }, 500);
                }, 2000);
            }
        } catch (err) {
            clog.error('[MissAV 瀑布流] 加载全部失败:', err);
            this.updateLoadAllBtn('加载失败，点击重试', false);
        } finally {
            this.isLoadingAll = false;
        }
    }

    /**
     * 更新「加载全部」按钮文案与禁用态。
     *
     * @param text 按钮文案
     * @param disabled 是否禁用（加载中时禁用点击视觉）
     */
    updateLoadAllBtn(text: string, disabled: boolean): void {
        if (!this.loadAllBtn) return;
        this.loadAllBtn.textContent = text;
        this.loadAllBtn.classList.toggle('jhs-map-load-all-disabled', disabled);
    }

    /**
     * 设置 loader 的状态类与文案。
     *
     * @param cls 状态类名：jhs-map-loading / jhs-map-error / jhs-map-no-more /
     *            jhs-map-click / 空字符串（空闲态）
     * @param text 显示文本
     */
    setLoader(cls: string, text: string): void {
        if (!this.loader) return;
        this.loader.className = `jhs-map-loader ${cls}`.trim();
        this.loader.textContent = text;
    }

    /** 销毁插件：中止所有注册的事件监听器并清理回到顶部按钮。 */
    destroy(): void {
        this.supervisor.abort();
        this.backToTopCleanup?.();
        this.backToTopCleanup = null;
    }
}