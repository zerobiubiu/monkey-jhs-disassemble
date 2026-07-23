/**
 * 标签显示模块 —— 从本地 IndexedDB 查询清单标签并渲染到视频卡片。
 *
 * 来源：archetype/videoListsTag.user.js（整体迁移），远程 API 调用全部改为
 * 本地 IDB 查询（VltDb.queryMoviesLists）。
 *
 * 集成方式：作为 VltPlugin（BasePlugin 子类）的数据/视图层，由插件壳调用
 * initExistingItems / handleNewItems / setupAutoRefreshListener。原脚本用
 * GM_addStyle 注入的 CSS 已提取到 src/styles/video-lists-tag.css。
 *
 * === 数据流变更 ===
 * 原脚本：GM_xmlhttpRequest → POST https://jls.zerobiubiu.top/api/movies_lists
 *         → 返回 { [designation]: [{ name, url, style }] }
 * 现  在：VltDb.queryMoviesLists(designations) → 直接读 IndexedDB
 *         → 返回 { [designation]: [{ name, url, style }] }（结构一致，零改渲染层）
 *
 * === 协同安全（显隐互不干扰） ===
 * 本模块用 `data-video-lists-tag-hidden` 标记自己隐藏的卡片，与：
 *   - statusTagFilter 的 `data-status-tag-hidden`
 *   - listReadingStatus 的 `data-lrs-hidden`
 *   - jhs 的 `data-hide`
 * 互不干扰。applyFilter 的 hiddenByOther 检查确保被其他脚本隐藏的卡片不被
 * 纳入管理，单向触发，不会死循环。
 *
 * === 控制流对应关系 ===
 * - fetchTags/fetchAndMergeTags：原 L478-577（GM_xmlhttpRequest → VltDb）
 * - addTagDisplay：原 L580-660（渲染单个卡片标签）→ vlt-tag-renderer
 * - refreshAllTags：原 L366-401（全量刷新）
 * - refreshDesignation：原 L410-457（精准刷新单个番号）
 * - applyFilter：原 L717-807（4 种筛选模式）→ vlt-filter-bar
 * - buildFilterModeDropdown：原 L814-911（模式下拉）→ vlt-filter-bar
 * - buildFilterBar：原 L918-1043（筛选栏 + refreshChips + createFilterChip）→ vlt-filter-bar
 * - initExistingItems：原 L1057-1090（初始化）
 * - handleNewItems：原 L1106-1163（流式增量 + 防抖）
 * - setupAutoRefreshListener：原 L1189-1282（三重监听）→ vlt-sync-listener
 */
import { VltDb } from './vlt-db';
import {
    applyFilter,
    buildFilterBar,
    collectAllUniqueTags,
    collectTagCounts,
    countNoTagItems,
    updateFilterBar
} from './vlt-filter-bar';
import { addTagDisplay, renderTags, tagsEqual } from './vlt-tag-renderer';
import { setupAutoRefreshListener } from './vlt-sync-listener';
import type { SyncPayload } from './vlt-sync-listener';

/** 标签条目（与 VltDb.queryMoviesLists 返回值元素结构一致）。 */
export interface TagEntry {
    name: string;
    url: string | null;
    style: { name: string; bg: string; text: string } | null;
}

/** 标签缓存类型：番号 → 标签数组。 */
export type TagsCache = Record<string, TagEntry[]>;

/** GM 存储键：自动刷新开关。 */
const AUTO_REFRESH_KEY = 'jdb:auto-refresh-enabled';

/**
 * 标签显示模块主类。
 *
 * 原脚本用 IIFE 闭包承载局部状态（mockTags/autoRefreshEnabled/
 * currentFilterMode/pendingNewItems/debounceTimer），此处全部转为类字段。
 * filterBar._refreshChips / details._updateModeUI 保留挂在 DOM 元素上
 * （与原脚本一致，用 as any 访问）。
 *
 * 渲染/筛选/监听逻辑已提取到独立模块，类方法为薄委托。
 */
export class VltTags {
    /** 标签缓存（替代原 mockTags）。null 表示尚未从 IDB 加载。 */
    private tagsCache: TagsCache | null = null;

    /** 当前筛选模式（默认 CONTAINS_ANY）。筛选栏模块直接读写。 */
    currentFilterMode: string = 'contains-any';

    /** 自动刷新开关（跨标签页联动）。筛选栏/监听模块直接读写。 */
    autoRefreshEnabled: boolean = true;

    /** 待处理的流式新增卡片队列（防抖累积）。 */
    private pendingNewItems: Element[] = [];

    /** 防抖定时器（handleNewItems 用）。 */
    private debounceTimer: number | null = null;

    /** 防抖间隔（毫秒），累积在此期间内的新增卡片统一请求。 */
    private readonly DEBOUNCE_MS: number = 300;

    // ==================== 标签数据管理 ====================

    /** 获取当前标签缓存（供渲染模块读取）。 */
    getTagsCache(): TagsCache | null {
        return this.tagsCache;
    }

    /**
     * 从 IDDB 查询番号对应的标签列表（全量替换 tagsCache）。
     * 替代原 L478-521 的 GM_xmlhttpRequest POST /api/movies_lists。
     *
     * @param designations 当前页面所有番号数组
     * @throws IDB 读取异常时 reject（由调用方 try/catch）
     */
    async fetchTags(designations: string[]): Promise<void> {
        this.tagsCache = await VltDb.queryMoviesLists(designations);
    }

    /**
     * 从 IDDB 查询指定番号的标签并合并到现有 tagsCache（增量更新）。
     * 替代原 L528-577 的 GM_xmlhttpRequest POST /api/movies_lists。
     *
     * 首次调用（tagsCache 为 null）时直接赋值；后续调用用 Object.assign 合并。
     *
     * @param designations 新增的番号数组
     * @throws IDB 读取异常时 reject（由调用方 try/catch）
     */
    async fetchAndMergeTags(designations: string[]): Promise<void> {
        const newTags = await VltDb.queryMoviesLists(designations);
        if (!this.tagsCache) {
            this.tagsCache = newTags;
        } else {
            Object.assign(this.tagsCache, newTags);
        }
    }

    // ==================== 标签渲染（委托 vlt-tag-renderer） ====================

    /**
     * 给单个 .item 卡片添加标签显示。
     * @param item 单个 .item 卡片元素
     */
    addTagDisplay(item: Element): void {
        addTagDisplay(this, item);
    }

    // ==================== 刷新 ====================

    /**
     * 重新拉取标签并刷新所有卡片（对应原 L366-401）。
     *
     * 流程：收集页面所有番号 → fetchTags 全量替换 → 移除旧标签容器 →
     * 重新渲染所有卡片 → 更新筛选栏。
     */
    async refreshAllTags(): Promise<void> {
        const items = document.querySelectorAll('.item');
        const lists = Array.from(items)
            .map((item: Element) => {
                const strong = item.querySelector('a > div.video-title > strong');
                return strong ? strong.innerHTML : null;
            })
            .filter((s): s is string => !!s);
        if (lists.length === 0) return;

        console.log(`[视频清单标签] 开始刷新，共 ${lists.length} 个番号`);
        try {
            await this.fetchTags(lists);
        } catch (err) {
            clog.error(`自动刷新标签数据失败（${lists.length} 个番号）:`, err);
            return;
        }

        // 移除旧标签容器
        document.querySelectorAll('.jhs-vlt-tags-display').forEach((el: Element) => el.remove());

        // 重新渲染
        renderTags(this);

        // 更新筛选栏
        this.updateFilterBar();

        console.log('[视频清单标签] 自动刷新完成');
    }

    /**
     * 精准刷新单个番号的标签（对应原 L410-457）。
     *
     * - 仅当番号在当前页面时才处理
     * - 增量拉取单个番号（fetchAndMergeTags），合并到 tagsCache
     * - 与旧数据对比（tagsEqual），未变化则跳过 DOM 更新
     * - 有变化时移除旧容器、重新渲染该卡片、刷新筛选栏
     *
     * @param designation 要刷新的番号
     */
    async refreshDesignation(designation: string): Promise<void> {
        console.log(`[视频清单标签] refreshDesignation: ${designation}`);

        // 找到页面上匹配该番号的卡片
        const allItems = document.querySelectorAll('.item');
        const targetItem = Array.from(allItems).find((item: Element) => {
            const strong = item.querySelector('a > div.video-title > strong');
            return strong && strong.innerHTML === designation;
        });
        if (!targetItem) {
            console.log(
                `[视频清单标签] ${designation} 不在当前页面 (共 ${allItems.length} 张卡片)`
            );
            return;
        }

        // 保存旧标签数据用于比对
        const oldTags = this.tagsCache ? this.tagsCache[designation] || [] : null;

        // 增量拉取单个番号
        try {
            await this.fetchAndMergeTags([designation]);
        } catch (err) {
            clog.error(`[视频清单标签] 刷新 ${designation} 失败:`, err);
            return;
        }

        // 比对新旧数据，未变化则跳过 DOM 更新
        const newTags = this.tagsCache![designation] || [];
        if (tagsEqual(oldTags, newTags)) {
            console.log(
                `[视频清单标签] ${designation} 标签未变化，跳过 DOM 更新 (${newTags.length} 个标签)`
            );
            return;
        }

        // 移除旧容器，渲染新数据
        const oldContainer = targetItem.querySelector('.jhs-vlt-tags-display');
        if (oldContainer) oldContainer.remove();
        this.addTagDisplay(targetItem);

        // 标签集合变化时刷新筛选栏
        this.updateFilterBar();

        console.log(
            `[视频清单标签] ${designation} 标签已更新 (${oldTags ? oldTags.length : 0} → ${newTags.length})`
        );
    }

    // ==================== 筛选器（委托 vlt-filter-bar） ====================

    /**
     * 从 GM 存储加载自动刷新开关状态（对应原 L340-356）。
     * 未设置过时默认开启；读取异常时默认开启。
     */
    private loadAutoRefreshState(): void {
        try {
            const val = GM_getValue(AUTO_REFRESH_KEY);
            if (val === undefined) {
                this.autoRefreshEnabled = true;
                console.log('[视频清单标签] 自动刷新: 未设置过 → 默认开启');
            } else {
                this.autoRefreshEnabled = val === true || val === 'true';
                console.log(
                    `[视频清单标签] 自动刷新: 存储值 = ${this.autoRefreshEnabled} (原始=${JSON.stringify(val)})`
                );
            }
        } catch (e) {
            this.autoRefreshEnabled = true;
            console.warn('[视频清单标签] 自动刷新: 读取异常 → 默认开启', e);
        }
    }

    /**
     * 保存自动刷新开关状态到 GM 存储（对应原 L359-363）。
     * 筛选栏模块通过 plugin.saveAutoRefreshState() 调用。
     *
     * @param enabled 开关状态
     */
    saveAutoRefreshState(enabled: boolean): void {
        try {
            GM_setValue(AUTO_REFRESH_KEY, enabled);
        } catch {
            // 忽略写入异常
        }
    }

    /** 应用当前筛选。 */
    applyFilter(): void {
        applyFilter(this);
    }

    /** 构建筛选器 UI。 */
    buildFilterBar(): void {
        buildFilterBar(this);
    }

    /** 更新筛选栏芯片。 */
    updateFilterBar(): void {
        updateFilterBar(this);
    }

    /** 收集页面上所有唯一的标签名称。 */
    collectAllUniqueTags(): string[] {
        return collectAllUniqueTags();
    }

    /** 收集每个标签的出现次数。 */
    collectTagCounts(): Record<string, number> {
        return collectTagCounts();
    }

    /** 计算无标签的卡片数。 */
    countNoTagItems(): number {
        return countNoTagItems();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化：收集番号 → fetchTags → 渲染 → buildFilterBar（对应原 L1057-1090）。
     * 由插件壳在页面就绪后调用。
     */
    async initExistingItems(): Promise<void> {
        // 加载自动刷新开关状态（原脚本在 DOMContentLoaded 时调用，此处提前到初始化）
        this.loadAutoRefreshState();

        const items = document.querySelectorAll('.item');
        if (items.length === 0) return;

        // 收集所有番号
        const lists = Array.from(items)
            .map((item: Element) => {
                const strong = item.querySelector('a > div.video-title > strong');
                return strong ? strong.innerHTML : null;
            })
            .filter((s): s is string => !!s);

        if (lists.length === 0) return;

        // 请求标签数据
        try {
            await this.fetchTags(lists);
            console.log(
                `[视频清单标签] 初始化加载完成: ${lists.length} 个番号, ${Object.keys(this.tagsCache || {}).length} 个有标签`
            );
        } catch (err) {
            clog.error('获取标签数据失败:', err);
            this.tagsCache = {}; // 失败时设空对象，避免后续报错
            return;
        }

        // 为每个卡片添加标签
        renderTags(this);

        // 构建标签筛选器
        this.buildFilterBar();
    }

    /**
     * 处理流式新增的视频卡片（对应原 L1106-1163）。
     * 采用防抖策略，将短时间内的多次新增合并为一次 IDB 请求。
     *
     * 流程：
     * 1. 立即用已有数据渲染（tagsCache 中已存在的番号直接展示，未命中的展示占位符）
     * 2. 追加到 pendingNewItems 队列
     * 3. 防抖 DEBOUNCE_MS 后：收集未缓存番号 → fetchAndMergeTags → 移除旧容器 → 重新渲染
     *
     * @param newItems 新增的 .item 元素数组
     */
    async handleNewItems(newItems: Element[]): Promise<void> {
        // 立即用已有数据渲染
        newItems.forEach((item: Element) => this.addTagDisplay(item));

        // 追加到待处理队列
        this.pendingNewItems.push(...newItems);

        // 清除上一次定时器，重新计时
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(async () => {
            // 取出当前批次并清空队列
            const itemsToRefresh = [...this.pendingNewItems];
            this.pendingNewItems = [];
            this.debounceTimer = null;

            // 收集这些卡片中 tagsCache 尚未覆盖的番号
            const uncachedCodes: string[] = [];
            const seen = new Set<string>();
            for (const item of itemsToRefresh) {
                const strong = item.querySelector('a > div.video-title > strong');
                if (!strong) continue;
                const code = strong.innerHTML;
                if (!code || seen.has(code)) continue;
                // 只请求 tagsCache 中缺失的番号
                if (!this.tagsCache || !(code in this.tagsCache)) {
                    uncachedCodes.push(code);
                    seen.add(code);
                }
            }

            if (uncachedCodes.length === 0) {
                this.updateFilterBar();
                return;
            }

            try {
                await this.fetchAndMergeTags(uncachedCodes);
            } catch (err) {
                clog.error('[视频清单标签] 获取新增标签数据失败:', err);
                return;
            }

            // 移除旧占位容器，用完整数据重新渲染这些卡片
            itemsToRefresh.forEach((item: Element) => {
                const oldContainer = item.querySelector('.jhs-vlt-tags-display');
                if (oldContainer) oldContainer.remove();
                this.addTagDisplay(item);
            });

            this.updateFilterBar();
            console.log(`[视频清单标签] 已为 ${uncachedCodes.length} 个新番号获取标签`);
        }, this.DEBOUNCE_MS);
    }

    // ==================== 自动刷新监听（委托 vlt-sync-listener） ====================

    /**
     * 设置跨脚本跨标签页联动监听（对应原 L1189-1282）。
     *
     * @param onSync 同步事件回调（payload 包含 designation/action/association/time）
     */
    setupAutoRefreshListener(onSync: (payload: SyncPayload) => void): void {
        setupAutoRefreshListener(this, onSync);
    }
}
