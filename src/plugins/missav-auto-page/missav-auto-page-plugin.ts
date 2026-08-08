/**
 * MissAV 列表页瀑布流插件 MissavAutoPagePlugin。
 *
 * 在 MissAV 列表页滚动接近底部时自动抓取下一页并追加到缩略图网格，
 * 番号去重防重复追加；loader 展示加载中 / 错误（点击重试）/ 无更多状态。
 * 无设置项、无 pageTypes 覆写：isMissavSite 站点注册即激活。
 */
import { PaginationStateMachine } from '../../core/pagination-state';
import { TaskSupervisor } from '../../core/task-supervisor';

import { BasePlugin } from '../base-plugin';
import { isVideoPage } from '../car-status-sync/missav-renderer';
import { fetchNextPage } from './map-fetch';
import { MAP_SEL, collectCarNums, extractThumbs, findNextUrl } from './map-selectors';

/** 触底预加载距离（px）：滚动距底部该距离内时提前加载下一页。 */
const PRELOAD_DISTANCE = 800;

/** loader 样式（前缀 jhs-map-，与类名一致）。 */
const LOADER_CSS = `
.jhs-map-loader { text-align: center; padding: 16px; color: #888; cursor: pointer; user-select: none; }
.jhs-map-loader.loading { cursor: default; }
.jhs-map-loader.error { color: #de3333; }
.jhs-map-loader.no-more { color: #aaa; cursor: default; font-size: 13px; }
`;

export class MissavAutoPagePlugin extends BasePlugin {
    /** 缩略图网格容器节点（handle 时按 MAP_SEL.grid 查得，失败降级父链）。 */
    container: Element | null = null;
    /** 下一页 URL；无更多页面时为 null。 */
    nextUrl: string | null = null;
    /** 分页状态机：统一管理 hasMore/phase 状态转换。 */
    pagination = new PaginationStateMachine();
    /** 统一生命周期管理器：事件监听器注册与清理。 */
    supervisor = new TaskSupervisor();
    /** loader 节点（加载中 / 错误 / 无更多提示）。 */
    loader: HTMLDivElement | null = null;
    /** 已加载缩略图的番号集合，用于跨页去重。 */
    loadedCarNums = new Set<string>();

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "MissavAutoPagePlugin"
     */
    getName(): string {
        return 'MissavAutoPagePlugin';
    }

    /**
     * 注入 loader 的内联样式。
     *
     * @returns Promise<string>，loader 样式片段；无异常抛出
     */
    async initCss(): Promise<string> {
        return LOADER_CSS;
    }

    /**
     * MissAV 列表页主处理：定位容器、创建 loader、注册滚动/点击事件、
     * 探测下一页并预填当前页番号。
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

        // 注入 loader 到容器之后
        const loader = document.createElement('div');
        loader.className = 'jhs-map-loader';
        container.parentNode?.insertBefore(loader, container.nextSibling);
        this.loader = loader;

        // 探测下一页 + 初始化状态机
        this.nextUrl = findNextUrl(document);
        this.pagination.init(!!this.nextUrl);

        // 预填当前页已加载番号
        collectCarNums(extractThumbs(container)).forEach((c) => c && this.loadedCarNums.add(c));

        // 滚动触底检测（800px 预加载距离）
        this.supervisor.addEventListener(window, 'scroll', () => {
            if (
                window.innerHeight + window.scrollY >= document.body.scrollHeight - PRELOAD_DISTANCE &&
                this.pagination.canLoad
            ) {
                void fetchNextPage(this);
            }
        });

        // loader 点击：错误态重试
        this.supervisor.addEventListener(loader, 'click', () => {
            this.pagination.retry();
            void fetchNextPage(this);
        });

        if (!this.pagination.hasMore) {
            this.setLoader('no-more', '已经到底了');
        }
    }

    /** 销毁插件：中止所有注册的事件监听器。 */
    destroy(): void {
        this.supervisor.abort();
    }

    /**
     * 设置 loader 的状态类与文案。
     *
     * @param cls 状态类名：loading/error/no-more/空
     * @param text 显示文本
     */
    setLoader(cls: string, text: string): void {
        if (!this.loader) return;
        this.loader.className = `jhs-map-loader ${cls}`.trim();
        this.loader.textContent = text;
    }
}