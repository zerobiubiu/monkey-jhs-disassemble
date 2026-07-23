/**
 * 视频清单标签插件 VideoListsTagPlugin —— 合并集成自
 * archetype/listsOptionSync.user.js + archetype/videoListsTag.user.js
 *
 * 功能：
 * 1. 详情页清单 checkbox 勾选/取消 → JavDB 成功确认后同步到本地 IndexedDB
 * 2. 列表页从本地 IDB 查询番号所属清单 → 显示标签 + 筛选栏
 * 3. 跨标签页自动刷新标签（三重广播：GM_setValue/localStorage/CustomEvent）
 *
 * === 根本性变更（doc/44 记录） ===
 * 原脚本通过远程服务器 API（https://jls.zerobiubiu.top）同步数据，
 * 此处改为本地 IndexedDB（寄生 JAV-JHS/appData，随 jhs WebDav 备份）：
 * - POST /api/sync/movies_lists → VltDb.sync()
 * - POST /api/movies_lists → VltDb.queryMoviesLists()
 * - PostgreSQL 触发器（count 维护）→ 代码手动 ±1
 * - CHECK 约束 count<=501 → 代码检查
 * - 清单 style 随机配色 → 代码从 bootstrapColors 选取
 *
 * 数据迁移：从 PostgreSQL 导出 JSON（dist/vlt-migration-data.json），
 * 通过 GM_registerMenuCommand 菜单"导入迁移数据"导入到 IndexedDB。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册。
 *
 * 模块拆分：
 * - vlt-db.ts — IndexedDB 数据层（VltDb.sync/queryMoviesLists/check/importData）
 * - vlt-reconcile.ts — JavDB 完整分页快照校验 + 本地清单自动对账
 * - vlt-toast.ts — Toast 通知（showToast）
 * - vlt-tags.ts — 标签显示 + 筛选栏（VltTags）
 * - vlt-sync.ts — checkbox 同步 + 三重广播（setupCheckboxListener/handleCheckboxChange）
 * - vlt-plugin.tsx — 插件入口（本文件）
 */
import type { PageType } from '../../core/page-context';

import { BasePlugin } from '../base-plugin';
import { VltTags } from './vlt-tags';
import {
    setupCheckboxListener,
    setupCreateListButton,
    setupListManagementListener,
    removeDetailPageCheckbox,
    updateDetailPageCheckboxLabel
} from './vlt-sync';
import { setupListMgmtBroadcastListener } from './vlt-remote-sync';

import videoListsTagCssRaw from '../../styles/video-lists-tag.css?raw';

/**
 * 视频清单标签插件主类。
 */
export class VideoListsTagPlugin extends BasePlugin {
    /** 标签管理器实例。 */
    private vltTags: VltTags | null = null;
    /** 内容 MutationObserver（监听新 .item 加入）。 */
    private observer: MutationObserver | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "VideoListsTagPlugin"
     */
    getName(): string {
        return 'VideoListsTagPlugin';
    }

    /** 详情页 + 列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail', 'list'];
    }

    /**
     * 注入标签 + 筛选栏 + Toast 样式。
     *
     * @returns video-lists-tag.css 全文
     */
    async initCss(): Promise<string> {
        return videoListsTagCssRaw;
    }

    /**
     * 主处理：
     * 1. 注册迁移数据导入菜单
     * 2. 详情页：注册 checkbox 同步监听
     * 3. 列表页：初始化标签显示 + 筛选栏 + MutationObserver + 自动刷新
     *
     * @returns Promise<void>
     */
    async handle(): Promise<void> {
        // 详情页：checkbox 同步 + 新增清单 UI + 清单管理广播接收
        if (window.isDetailPage) {
            setupCheckboxListener();
            setupCreateListButton();
            // 接收清单删除/改名广播：实时移除/更新 checkbox
            setupListMgmtBroadcastListener(
                (listId: string) => removeDetailPageCheckbox(listId),
                (listId: string, newName: string) => updateDetailPageCheckboxLabel(listId, newName)
            );
            return;
        }

        // /users/lists 清单管理页：监听删除/改名 → 同步 IDB
        if (window.location.href.includes('/users/lists')) {
            setupListManagementListener();
            return;
        }

        // 列表页：标签显示 + 筛选
        if (!window.isListPage) return;

        this.vltTags = new VltTags();

        // 初始化已有卡片
        await this.vltTags.initExistingItems();

        // MutationObserver：监听新 .item 加入（AutoPagePlugin 瀑布流 / listWaterfall）
        this.setupItemObserver();

        // 接收清单删除/改名广播：实时全量刷新标签
        setupListMgmtBroadcastListener(
            () => this.vltTags?.refreshAllTags().then(),
            () => this.vltTags?.refreshAllTags().then()
        );

        // 自动刷新监听（跨标签页同步事件）
        this.vltTags.setupAutoRefreshListener((payload) => {
            // 收到同步事件后，精准刷新对应番号的标签
            if (payload?.designation) {
                this.vltTags?.refreshDesignation(payload.designation).then();
            }
        });
    }

    /**
     * 设置 MutationObserver 监听新 .item 加入。
     * 对应原 videoListsTag.user.js L1165-1186。
     */
    private setupItemObserver(): void {
        this.observer = new MutationObserver((mutations: MutationRecord[]) => {
            const newItems: Element[] = [];
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const el = node as Element;
                    if (el.matches?.('.item')) {
                        newItems.push(el);
                    } else if (el.querySelectorAll?.('.item').length > 0) {
                        newItems.push(...Array.from(el.querySelectorAll('.item')));
                    }
                }
            }
            if (newItems.length > 0) {
                this.vltTags?.handleNewItems(newItems).then();
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
