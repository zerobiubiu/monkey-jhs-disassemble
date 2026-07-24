/**
 * 清单阅读进度插件 ListReadingStatusPlugin —— 集成自
 * archetype/listReadingStatus.user.js
 * （原脚本整体 L1-1391，独立油猴脚本 `JavDB 清单阅读进度` v1.5）。
 *
 * 功能：为我的清单页面和清单详情页添加阅读进度下拉框和星级评分（1-5星），
 * 数据双向实时同步，寄生 jhs IndexedDB 实现跨浏览器备份恢复；清单列表页
 * 提供排序与筛选工具栏。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本 GM_addStyle 改走 initCss()，
 * GM_setValue/getValue/GM_addValueChangeListener 保留（grant 已含）。
 *
 * === 与主项目及已集成插件的兼容性（天然兼容） ===
 * 操作 `#lists > ul > li`（清单列表项），与主项目 `AutoPagePlugin` 的 `.movie-list`
 * （视频列表页）不同容器，无冲突。
 *
 * 与已集成的清单页插件协同：
 * - `ListWaterfallPlugin`（doc/39）：append 新 li 后触发本插件 MutationObserver
 *   → processAllItems 为新 li 注入组件。原脚本注释已考虑"listWaterfall 追加"
 * - `ModMyListOpenWayPlugin`（doc/35）：只改链接 href/target，本插件在 li 内 div
 *   注入下拉框/星级，操作不同子元素，不冲突
 * - `StatusTagFilterPlugin`（doc/38）：操作 `.movie-list .item`（视频列表），
 *   本插件操作 `#lists > ul > li`（清单列表），不同容器
 *
 * li 显隐协同安全：原脚本用 `data-lrs-hidden` 属性 + `hiddenByOther` 检查，
 * 与 statusTagFilter 的 `data-status-tag-hidden`、jhs 的 `data-hide` 互不干扰。
 *
 * IndexedDB 寄生：`JAV-JHS/appData/listReadingStatus_data`，与 storageManager
 * 同库不同键，保留原生 indexedDB API（与 doc/25 rating-cache 模式一致）。
 *
 * 原脚本 `@include /users/favorite_lists*` + `/users/lists*` + `/lists/*`，
 * 本项目在 handle() 内加路径守卫等价实现。
 *
 * === 模块拆分（doc/40 决策已被取代：文件超 §10.1 800 行硬上限）===
 * 方法组已抽取到 `./list-reading-status/` 子目录：
 * - `lrs-storage.ts`：GM/IDB 数据层（阅读状态/评分/最近访问 + 备份恢复）
 * - `lrs-types.ts`：共享类型与常量（ListMeta/FilterStats/STAR_PATH/属性名）
 * - `lrs-render.ts`：UI 渲染（下拉框/星级/访问链接/列表项与详情页标题注入）
 * - `lrs-toolbar.ts`：排序/筛选/工具栏构建与刷新
 * 本类保留同名瘦委托方法，内部调用点与运行时 getBean 面保持不变；被委托方法
 * 读写的实例字段去掉 private（编译期修饰符，运行时无变化），以便跨模块访问。
 */
import { TaskSupervisor } from '../core/task-supervisor';

import { BasePlugin } from './base-plugin';
import {
    STORAGE_KEY,
    RATING_STORAGE_KEY,
    SORT_KEY,
    FILTER_READ_KEY,
    FILTER_RATING_KEY,
    restoreFromIndexedDB
} from './list-reading-status/lrs-storage';
import { ensureHeaderWidgets, processAllItems } from './list-reading-status/lrs-render';
import {
    loadToolbarState,
    tryBuildToolbar,
    refreshChips,
    restoreToolbarUI,
    applySortAndFilter
} from './list-reading-status/lrs-toolbar';

import listReadingStatusCssRaw from '../styles/list-reading-status-plugin.css?raw';

/**
 * 清单阅读进度插件主类。
 *
 * 原脚本对应行号：L1-1391（整体）。原脚本用 IIFE 闭包承载局部状态
 * （isProcessing/currentSort/filterReadStatus/filterRatingChips/isToolbarProcessing/
 * orderCounter/lastLiCount/observer/isDetailPage），此处转为类字段。
 * 被抽取到 `./list-reading-status/` 的方法组以 `plugin` 首参访问这些字段，
 * 故相关字段去掉 private（lastLiCount 仅 handle() 内部使用，保留 private）。
 */
export class ListReadingStatusPlugin extends BasePlugin {
    /** 防重入标志：防止 DOM 修改触发的 MutationObserver 回调导致无限循环。 */
    isProcessing = false;
    /** 当前排序方式。 */
    currentSort = 'default';
    /** 当前阅读状态筛选（all/read/unread）。 */
    filterReadStatus = 'all';
    /** 当前评分筛选芯片集合。 */
    filterRatingChips: Set<string> = new Set();
    /** 工具栏防重入标志。 */
    isToolbarProcessing = false;
    /** 原始顺序计数器（排序 tiebreaker）。 */
    orderCounter = 0;
    /** 上次 li 数量（仅数量变化时刷新芯片）。 */
    private lastLiCount = -1;
    /** 统一生命周期管理器。 */
    supervisor = new TaskSupervisor();
    /** 是否为清单详情页。 */
    isDetailPage = false;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "ListReadingStatusPlugin"
     */
    getName(): string {
        return 'ListReadingStatusPlugin';
    }

    /**
     * 注入下拉框 + 星级 + 工具栏样式。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本 3 段 GM_addStyle，此处走 initCss 机制返回合并后的 CSS 字符串。
     *
     * @returns list-reading-status-plugin.css 全文
     */
    async initCss(): Promise<string> {
        return listReadingStatusCssRaw;
    }

    /**
     * 主处理：路径守卫 → 加载状态 → 页面注入 → 备份恢复 → MutationObserver →
     * 跨标签页同步。对应原 L1284-1390。
     *
     * 原脚本 `@include /users/favorite_lists*` + `/users/lists*` + `/lists/*`，
     * 本项目在 handle() 内加路径守卫等价实现。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 路径守卫
        const pathname = location.pathname;
        const isListPage =
            pathname.startsWith('/users/favorite_lists') ||
            pathname.startsWith('/users/lists');
        const isDetail = /\/lists\/[^/]+$/.test(pathname);
        if (!isListPage && !isDetail) return;

        this.isDetailPage = isDetail;

        // 加载排序/筛选持久化状态
        this.loadToolbarState();

        // 页面初始注入
        if (this.isDetailPage) {
            this.ensureHeaderWidgets();
        } else {
            this.processAllItems();
            this.tryBuildToolbar();
        }

        // 尝试从 jhs IndexedDB 恢复备份
        restoreFromIndexedDB().then((restored: boolean) => {
            if (restored) {
                if (this.isDetailPage) {
                    this.ensureHeaderWidgets();
                } else {
                    this.processAllItems();
                    const tb = document.querySelector('.list-toolbar');
                    if (tb) this.refreshChips(tb as HTMLElement);
                }
            }
        });

        // MutationObserver：监听动态加载
        this.supervisor.observe(document.body, () => {
            if (this.isProcessing) return;
            if (this.isDetailPage) {
                this.ensureHeaderWidgets();
            } else {
                this.processAllItems();
                const ul = document.querySelector('#lists > ul');
                const cnt = ul ? ul.querySelectorAll(':scope > li').length : 0;
                if (cnt !== this.lastLiCount) {
                    this.lastLiCount = cnt;
                    const tb = document.querySelector('.list-toolbar');
                    if (tb) this.refreshChips(tb as HTMLElement);
                }
            }
        }, { childList: true, subtree: true });

        // 跨标签页实时同步
        if (typeof GM_addValueChangeListener !== 'undefined') {
            const refreshListToolbar = () => {
                if (this.isDetailPage) return;
                const tb = document.querySelector('.list-toolbar');
                if (tb) this.refreshChips(tb as HTMLElement);
            };
            GM_addValueChangeListener(STORAGE_KEY, () => {
                if (this.isDetailPage) {
                    this.ensureHeaderWidgets();
                } else {
                    this.processAllItems();
                    refreshListToolbar();
                }
            });
            GM_addValueChangeListener(RATING_STORAGE_KEY, () => {
                if (this.isDetailPage) {
                    this.ensureHeaderWidgets();
                } else {
                    this.processAllItems();
                    refreshListToolbar();
                }
            });
            GM_addValueChangeListener(SORT_KEY, () => {
                const v = GM_getValue(SORT_KEY);
                if (v) this.currentSort = v;
                if (this.isDetailPage) return;
                this.restoreToolbarUI();
                this.applySortAndFilter();
            });
            GM_addValueChangeListener(FILTER_READ_KEY, () => {
                const v = GM_getValue(FILTER_READ_KEY);
                if (v === 'read' || v === 'unread') this.filterReadStatus = v;
                else this.filterReadStatus = 'all';
                if (this.isDetailPage) return;
                this.restoreToolbarUI();
                this.applySortAndFilter();
            });
            GM_addValueChangeListener(FILTER_RATING_KEY, () => {
                const rc = GM_getValue(FILTER_RATING_KEY);
                try {
                    const arr = JSON.parse(rc);
                    this.filterRatingChips = new Set(Array.isArray(arr) ? arr : []);
                } catch {
                    this.filterRatingChips = new Set();
                }
                if (this.isDetailPage) return;
                this.restoreToolbarUI();
                this.applySortAndFilter();
            });
        }
    }

    // ---------- 瘦委托方法（同名，转发到 ./list-reading-status/ 方法组） ----------

    /** 从 GM 存储加载排序与筛选状态。委托 lrs-toolbar.loadToolbarState。 */
    loadToolbarState(): void {
        loadToolbarState(this);
    }

    /** 在清单详情页标题注入/更新组件。委托 lrs-render.ensureHeaderWidgets。 */
    ensureHeaderWidgets(): void {
        ensureHeaderWidgets(this);
    }

    /** 遍历所有 li 注入/更新组件。委托 lrs-render.processAllItems。 */
    processAllItems(): boolean {
        return processAllItems(this);
    }

    /** 尝试构建工具栏并应用排序筛选。委托 lrs-toolbar.tryBuildToolbar。 */
    tryBuildToolbar(): boolean {
        return tryBuildToolbar(this);
    }

    /** 刷新筛选芯片。委托 lrs-toolbar.refreshChips。 */
    refreshChips(toolbar: HTMLElement): void {
        refreshChips(this, toolbar);
    }

    /** 从持久化状态恢复工具栏 UI。委托 lrs-toolbar.restoreToolbarUI。 */
    restoreToolbarUI(): void {
        restoreToolbarUI(this);
    }

    /** 应用排序与筛选。委托 lrs-toolbar.applySortAndFilter。 */
    applySortAndFilter(): void {
        applySortAndFilter(this);
    }

    /** 销毁插件：中止所有由 supervisor 管理的资源。 */
    destroy(): void {
        this.supervisor.abort();
    }
}
