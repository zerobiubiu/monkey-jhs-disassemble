/**
 * 标签显示模块 —— 从本地 IndexedDB 查询清单标签、渲染到视频卡片并协调筛选栏。
 *
 * 来源：archetype/videoListsTag.user.js（整体迁移），远程 API 调用全部改为
 * 本地 IDB 查询（VltDb.queryMoviesLists）。
 *
 * 架构边界（实时同步永久开启重构）：
 * - 本类只负责标签数据缓存、卡片标签渲染、批量增量/实时刷新与筛选栏委托；
 * - 不再保存已移除的自动刷新开关状态（无 GM 读写）或筛选模式状态；
 * - 跨标签页广播订阅由插件壳 `VideoListsTagPlugin` 统一经 `vlt-sync-listener` /
 *   `vlt-remote-sync` 挂载并由 `TaskSupervisor` 管理生命周期，推送到本类的
 *   `queueDesignationRefresh()` 合并批量刷新，避免并发多番号更新互相丢弃。
 */
import { siteSelector } from '../../core/util/site/selectors';
import type { FilterScope } from '../../types/filter-scope';

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

/** 标签条目（与 VltDb.queryMoviesLists 返回值元素结构一致）。 */
export interface TagEntry {
    name: string;
    url: string | null;
    style: { name: string; bg: string; text: string } | null;
}

/** 标签缓存类型：番号 → 标签数组。 */
export type TagsCache = Record<string, TagEntry[]>;

/**
 * 标签显示模块主类。
 *
 * 渲染/筛选逻辑已提取到独立模块，类方法保留面向插件壳与作用域筛选的协调入口。
 */
export class VltTags {
    /** 范围仅约束筛选 UI 与计数；未传入时沿用主页面行为。 */
    constructor(readonly filterScope?: FilterScope) {}

    /** 标签缓存（替代原 mockTags）。null 表示尚未从 IDB 加载。 */
    private tagsCache: TagsCache | null = null;

    /** 待处理的流式新增卡片队列（防抖累积）。 */
    private pendingNewItems: Element[] = [];

    /** 防抖定时器（handleNewItems 用）。 */
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** 防抖间隔（毫秒），累积在此期间内的新增卡片统一请求。 */
    private readonly DEBOUNCE_MS: number = 300;

    /** 待合并刷新的番号集合（实时同步短窗口合批，防止并发更新丢失）。 */
    private pendingRefreshDesignations = new Set<string>();

    /** 实时同步合批定时器。 */
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;

    /** 是否正在执行合批刷新（在途期间新到番号自动续跑下一轮）。 */
    private refreshingDesignations = false;

    /** 实时同步合批窗口（毫秒）。 */
    private readonly SYNC_COALESCE_MS: number = 50;

    /** 是否已销毁（防止在途异步完成后回写 DOM）。 */
    private destroyed = false;

    // ==================== 生命周期 ====================

    /** 清理待执行定时器与缓冲队列。 */
    destroy(): void {
        this.destroyed = true;
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.refreshTimer !== null) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.pendingNewItems = [];
        this.pendingRefreshDesignations.clear();
    }

    // ==================== 标签数据管理 ====================

    /** 获取当前标签缓存（供渲染模块读取）。 */
    getTagsCache(): TagsCache | null {
        return this.tagsCache;
    }

    /**
     * 从 IDB 查询番号对应的标签列表（全量替换 tagsCache）。
     *
     * @param designations 当前页面所有番号数组
     */
    async fetchTags(designations: string[]): Promise<void> {
        this.tagsCache = await VltDb.queryMoviesLists(designations);
    }

    /**
     * 从 IDB 查询指定番号的标签并合并到现有 tagsCache（增量更新）。
     *
     * @param designations 新增或变更的番号数组
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

    // ==================== 实时刷新 ====================

    /**
     * 重新拉取标签并刷新所有卡片（清单删除/改名等全局变更触发）。
     */
    async refreshAllTags(): Promise<void> {
        if (this.destroyed) return;
        const items = document.querySelectorAll(siteSelector('parsedItem'));
        const lists = Array.from(items)
            .map((item: Element) => {
                const strong = item.querySelector('a > div.video-title > strong');
                return strong ? strong.innerHTML : null;
            })
            .filter((s): s is string => !!s);
        if (lists.length === 0) return;

        console.log(`[视频清单标签] 开始全量刷新，共 ${lists.length} 个番号`);
        try {
            await this.fetchTags(lists);
        } catch (err) {
            clog.error(`刷新标签数据失败（${lists.length} 个番号）:`, err);
            return;
        }
        if (this.destroyed) return;

        document.querySelectorAll('.jhs-vlt-tags-display').forEach((el: Element) => el.remove());
        renderTags(this);
        this.updateFilterBar();

        console.log('[视频清单标签] 全量刷新完成');
    }

    /**
     * 将单个变更番号排入实时同步合批队列：
     * 短窗口内的多条同步通知（例如批量清单操作或跨标签页连续勾选）会合并为一次 IDB 查询，
     * 在途期间新到达的番号会在当前批次完成后自动续刷，确保零丢失。
     */
    queueDesignationRefresh(designation: string): void {
        if (this.destroyed || !designation) return;
        this.pendingRefreshDesignations.add(designation);
        if (this.refreshingDesignations || this.refreshTimer !== null) return;

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            void this.flushPendingDesignationRefreshes();
        }, this.SYNC_COALESCE_MS);
    }

    /** 串行排空待刷新番号队列，直到队列为空或实例销毁。 */
    private async flushPendingDesignationRefreshes(): Promise<void> {
        if (this.destroyed || this.refreshingDesignations || this.pendingRefreshDesignations.size === 0) {
            return;
        }
        this.refreshingDesignations = true;
        try {
            while (!this.destroyed && this.pendingRefreshDesignations.size > 0) {
                const batch = Array.from(this.pendingRefreshDesignations);
                this.pendingRefreshDesignations.clear();
                await this.refreshDesignations(batch);
            }
        } finally {
            this.refreshingDesignations = false;
        }
    }

    /**
     * 批量精准刷新一组番号的标签：
     * 仅对当前页面存在的番号发一次 IDB 查询，对比新旧标签后只重绘变化的卡片并刷新一次筛选栏。
     */
    async refreshDesignations(designations: string[]): Promise<void> {
        if (this.destroyed) return;
        const uniqueCodes = [...new Set(designations.filter(Boolean))];
        if (uniqueCodes.length === 0) return;

        const wanted = new Set(uniqueCodes);
        const allItems = document.querySelectorAll(siteSelector('parsedItem'));
        const matchedItems = new Map<string, Element[]>();

        for (const item of Array.from(allItems)) {
            const strong = item.querySelector('a > div.video-title > strong');
            const code = strong?.innerHTML;
            if (!code || !wanted.has(code)) continue;
            const list = matchedItems.get(code);
            if (list) list.push(item);
            else matchedItems.set(code, [item]);
        }

        const matchedCodes = Array.from(matchedItems.keys());
        if (matchedCodes.length === 0) {
            console.log(
                `[视频清单标签] ${uniqueCodes.join(', ')} 不在当前页面 (共 ${allItems.length} 张卡片)`
            );
            return;
        }

        const oldTagsByCode = new Map<string, TagEntry[] | null>();
        for (const code of matchedCodes) {
            oldTagsByCode.set(code, this.tagsCache ? this.tagsCache[code] || [] : null);
        }

        try {
            await this.fetchAndMergeTags(matchedCodes);
        } catch (err) {
            clog.error(`[视频清单标签] 刷新 ${matchedCodes.join(', ')} 失败:`, err);
            return;
        }
        if (this.destroyed) return;

        let anyChanged = false;
        for (const code of matchedCodes) {
            const targetItems = matchedItems.get(code)!;
            const oldTags = oldTagsByCode.get(code) ?? null;
            const newTags = this.tagsCache?.[code] || [];

            if (tagsEqual(oldTags, newTags)) {
                // 同番号可能同时出现在主列表与推荐中，补齐尚未渲染的新实例。
                targetItems.forEach((item) => this.addTagDisplay(item));
                console.log(
                    `[视频清单标签] ${code} 标签未变化，跳过 DOM 更新 (${newTags.length} 个标签)`
                );
                continue;
            }

            anyChanged = true;
            for (const item of targetItems) {
                item.querySelector('.jhs-vlt-tags-display')?.remove();
                this.addTagDisplay(item);
            }
            console.log(
                `[视频清单标签] ${code} 标签已更新 (${oldTags ? oldTags.length : 0} → ${newTags.length})`
            );
        }

        if (anyChanged) {
            this.updateFilterBar();
        }
    }

    /**
     * 精准刷新单个番号的标签。
     *
     * @param designation 要刷新的番号
     */
    async refreshDesignation(designation: string): Promise<void> {
        console.log(`[视频清单标签] refreshDesignation: ${designation}`);
        await this.refreshDesignations([designation]);
    }

    // ==================== 筛选器（委托 vlt-filter-bar） ====================

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
        return collectAllUniqueTags(this.filterScope);
    }

    /** 收集每个标签的出现次数。 */
    collectTagCounts(): Record<string, number> {
        return collectTagCounts(this.filterScope);
    }

    /** 计算无标签的卡片数。 */
    countNoTagItems(): number {
        return countNoTagItems(this.filterScope);
    }

    // ==================== 初始化与增量流 ====================

    /**
     * 初始化：收集番号 → fetchTags → 渲染 → buildFilterBar。
     * 由插件壳在页面就绪后调用。
     */
    async initExistingItems(): Promise<void> {
        if (this.destroyed) return;
        const items = document.querySelectorAll(siteSelector('parsedItem'));
        if (items.length === 0) return;

        const lists = Array.from(items)
            .map((item: Element) => {
                const strong = item.querySelector('a > div.video-title > strong');
                return strong ? strong.innerHTML : null;
            })
            .filter((s): s is string => !!s);

        if (lists.length === 0) return;

        try {
            await this.fetchTags(lists);
            console.log(
                `[视频清单标签] 初始化加载完成: ${lists.length} 个番号, ${Object.keys(this.tagsCache || {}).length} 个有标签`
            );
        } catch (err) {
            clog.error('获取标签数据失败:', err);
            this.tagsCache = {};
            return;
        }
        if (this.destroyed) return;

        renderTags(this);
        this.buildFilterBar();
    }

    /**
     * 处理流式新增的视频卡片，防抖合批查询未缓存番号并刷新筛选栏。
     *
     * @param newItems 新增的 .item 元素数组
     */
    async handleNewItems(newItems: Element[]): Promise<void> {
        if (this.destroyed) return;
        const parsedItems = newItems.filter((item) => item.matches(siteSelector('parsedItem')));
        if (parsedItems.length === 0) return;

        // 立即用已有数据渲染
        parsedItems.forEach((item: Element) => this.addTagDisplay(item));

        this.pendingNewItems.push(...parsedItems);
        if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(async () => {
            const itemsToRefresh = [...this.pendingNewItems];
            this.pendingNewItems = [];
            this.debounceTimer = null;
            if (this.destroyed) return;

            const uncachedCodes: string[] = [];
            const seen = new Set<string>();
            for (const item of itemsToRefresh) {
                const strong = item.querySelector('a > div.video-title > strong');
                if (!strong) continue;
                const code = strong.innerHTML;
                if (!code || seen.has(code)) continue;
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
            if (this.destroyed) return;

            itemsToRefresh.forEach((item: Element) => {
                const oldContainer = item.querySelector('.jhs-vlt-tags-display');
                if (oldContainer) oldContainer.remove();
                this.addTagDisplay(item);
            });

            this.updateFilterBar();
            console.log(`[视频清单标签] 已为 ${uncachedCodes.length} 个新番号获取标签`);
        }, this.DEBOUNCE_MS);
    }
}
