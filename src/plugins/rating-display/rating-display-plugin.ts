/**
 * 评分显示插件 RatingDisplayPlugin —— 集成自 archetype/jhsRatingDisplay.user.js
 * （原脚本整体 L1-916，独立油猴脚本 `JHS 评分显示` v2.0）。
 *
 * 功能：在 javdb 列表页卡片封面上显示个人评分（首屏缓存优先 → 悬停懒加载，
 * 实时同步刷新）。从 jhs IndexedDB 读取已看番号，抓取详情页解析 1-5 星评分，
 * 缓存到 localStorage + 寄生 jhs IDB（永久不过期）。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (r)` 块）。原脚本的 GM_addStyle 改走 initCss() 机制，
 * GM_registerMenuCommand 保留（vite.config grant 已补），GM_xmlhttpRequest
 * 直接使用全局（与原脚本零偏差）。
 *
 * 原脚本 `jdb:want-watched-sync` 事件源由本项目 detail-page-button-plugin
 * 的 broadcastWantWatchedSync 触发，本插件仅监听，控制流与原脚本一致。
 *
 * 模块拆分：config / utils / cache / net / renderer 各自独立，本文件承载
 * Core 主流程（processItem / refreshAll / clearPageCache / loadAll /
 * _invalidateCards / init）与插件入口（getName / initCss / handle）。
 */
import { BasePlugin } from '../base-plugin';

import { RatingRenderer } from './rating-renderer';
import { buildWatchedMap, RatingCache } from './rating-cache';
import { fetchRating } from './rating-net';
import { RATING_CONFIG } from './rating-config';
import { RatingUtils } from './rating-utils';

import ratingDisplayCssRaw from '../../styles/rating-display.css?raw';

/** jhs 同步事件 payload 形状（detail-page-button-plugin 广播）。
 *  score 仅在 hasWatch+add 时携带（详情页标记已读/评分时已知星级）。 */
interface SyncPayload {
    carNum: string;
    status: string;
    op: string;
    /** 评分 1-5（仅 hasWatch+add 携带；0/未评分/想看/收藏不带） */
    score?: number;
}

/** 评分显示插件主类（承载原脚本 Core 主流程）。 */
export class RatingDisplayPlugin extends BasePlugin {
    /** 已看番号集合（规范化番号 → 原始记录）。原 Core.watchedMap。 */
    watchedMap: Map<string, any> = new Map();

    /** 跨标签页同步脏标记（visibilitychange 兜底全量刷新用）。原 Core._dirty。 */
    _dirty = false;

    /** 返回插件名，供 PluginManager 注册去重。 */
    getName(): string {
        return 'RatingDisplayPlugin';
    }

    /**
     * 注入评分显示 CSS。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本 Core.injectStyles() 用 GM_addStyle，此处走 initCss 机制返回 CSS 字符串。
     * @returns rating-display.css 全文
     */
    async initCss(): Promise<string> {
        return ratingDisplayCssRaw;
    }

    /**
     * 显示底部 toast 提示（2.5s 后自动移除）。对应原 L568-575。
     * 同一时刻仅保留一个 toast。
     * @param msg 提示文本
     */
    toast(msg: string): void {
        document.querySelector('.jhs-rd-toast')?.remove();
        const div = document.createElement('div');
        div.className = 'jhs-rd-toast';
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    }

    /**
     * 处理单个卡片——核心入口。对应原 L582-605。
     * - 命中已看集合 → 有缓存直接显示分值，无缓存显示占位
     * - 未命中 → 移除旧标签（如有）
     * 通过 dataset.jhsrdProcessed 去重，避免重复处理。
     * @param item 列表页卡片元素
     */
    processItem(item: HTMLElement): void {
        if (!item || item.dataset.jhsrdProcessed === 'true') return;
        item.dataset.jhsrdProcessed = 'true';

        const code = RatingUtils.getCode(item);
        if (!code) return;

        if (!this.watchedMap.has(code)) {
            // 不在已看列表 → 确保旧标签被移除
            RatingRenderer.removeFrom(item);
            return;
        }

        // 缓存优先
        const cached = RatingCache.get(code);
        if (cached) {
            RatingRenderer.showRating(item, cached.rating);
            item.dataset.jhsrdLoaded = 'true';
            // 标记为「来自缓存」——init 后会清除 loaded 让首次悬停验证
            item.dataset.jhsrdFromCache = 'true';
        } else {
            RatingRenderer.showPlaceholder(item);
        }
    }

    /** 重新处理所有卡片（不清缓存）。对应原 L608-617。 */
    refreshAll(): void {
        document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR).forEach((item) => {
            const el = item as HTMLElement;
            RatingRenderer.removeFrom(el);
            el.dataset.jhsrdProcessed = 'false';
            delete el.dataset.jhsrdLoaded;
            delete el.dataset.jhsrdFetching;
            delete el.dataset.jhsrdFromCache;
            this.processItem(el);
        });
    }

    /**
     * 清空当前页面所有卡片的评分缓存。对应原 L622-651。
     * 仅清除当前页卡片对应番号的缓存条目，然后重处理当前页所有卡片。
     */
    clearPageCache(): void {
        const codes = new Set<string>();
        document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR).forEach((item) => {
            const code = RatingUtils.getCode(item as HTMLElement);
            if (code) codes.add(code);
        });

        let cleared = 0;
        codes.forEach((code) => {
            if (RatingCache._data[code]) {
                delete RatingCache._data[code];
                cleared++;
            }
        });

        if (cleared > 0) RatingCache.save();

        // 重新处理当前页所有卡片
        document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR).forEach((item) => {
            const el = item as HTMLElement;
            RatingRenderer.removeFrom(el);
            delete el.dataset.jhsrdLoaded;
            delete el.dataset.jhsrdFromCache;
            el.dataset.jhsrdProcessed = 'false';
            this.processItem(el);
        });

        this.toast(`已清除 ${cleared} 个评分缓存，当前页 ${codes.size} 张卡片`);
    }

    /**
     * 全量加载当前页面所有未评分的占位卡片。对应原 L656-680。
     * 为占位标签加 is-loading 类，并发抓取评分后移除 loading。
     */
    loadAll(): void {
        const targets: HTMLElement[] = [];
        document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR).forEach((item) => {
            const el = item as HTMLElement;
            if (el.dataset.jhsrdFetching !== 'true' && el.dataset.jhsrdLoaded !== 'true') {
                targets.push(el);
            }
        });

        if (targets.length === 0) {
            this.toast('当前页面所有卡片已加载评分');
            return;
        }

        this.toast(`开始加载 ${targets.length} 个评分...`);
        targets.forEach((item) => {
            const tag = item.querySelector('.jhs-user-rating') as HTMLElement | null;
            if (tag) tag.classList.add('is-loading');
            fetchRating(item).finally(() => {
                if (tag) tag.classList.remove('is-loading');
            });
        });
    }

    /**
     * 清除指定番号缓存并重处理对应卡片（用于 jhs 同步后实时刷新）。对应原 L689-716。
     * 根据 status/op 直接更新 watchedMap，无需重读整个 car_list：
     *   - hasWatch + add → 加入 watchedMap
     *   - favorite + add / 任意 remove → 移出 watchedMap
     * 遍历所有卡片用 RatingUtils.getCode 匹配番号。
     * @param code   规范化番号
     * @param status 同步事件 status（hasWatch / favorite）
     * @param op     同步事件 op（add / remove）
     * @param score  评分 1-5（仅 hasWatch+add 时可能携带；详情页标记已读/评分时已知星级，
     *               直接写入评分缓存，免去列表页悬停远程抓取详情页解析评分）
     */
    _invalidateCards(code: string, status: string, op: string, score?: number): void {
        // 直接用广播信息更新 watchedMap 快照
        if (status === 'hasWatch' && op === 'add') {
            if (!this.watchedMap.has(code)) {
                this.watchedMap.set(code, {
                    carNum: code,
                    status: 'hasWatch'
                });
            }
        } else {
            this.watchedMap.delete(code);
        }
        // 评分同步优化：hasWatch+add 且 score 为数字（0-5）时，直接写入评分缓存
        // （RatingCache.set 内部判断 rating 变化才写），列表页 processItem 会命中缓存
        // 直接显示评分（0 星显示 ★0，1-5 星显示 ★N），不再悬停远程抓取详情页；
        // 其他变更（取消观看/转想看/收藏等）清评分缓存
        if (status === 'hasWatch' && op === 'add' && typeof score === 'number') {
            RatingCache.set(code, score);
        } else {
            delete RatingCache._data[code];
            RatingCache.save();
        }
        document.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR).forEach((item) => {
            const el = item as HTMLElement;
            if (RatingUtils.getCode(el) === code) {
                RatingRenderer.removeFrom(el);
                delete el.dataset.jhsrdLoaded;
                delete el.dataset.jhsrdFromCache;
                el.dataset.jhsrdProcessed = 'false';
                this.processItem(el);
            }
        });
        this._dirty = true;
        const cur = localStorage.getItem('jdb:want-watched-sync');
        if (cur) localStorage.setItem('jhsrd:last-sync-digest', cur);
    }

    /**
     * 主初始化流程。对应原 L718-915。
     *
     * 执行顺序：
     * 1. 加载评分缓存（localStorage → IDB 兜底）
     * 2. 启动时检测 jhs 同步事件（跨导航缓存失效 → 全量清空）
     * 3. 构建已看番号集合
     * 4. 首屏处理所有卡片
     * 5. 缓存命中项取消 loaded（首次悬停验证评分是否变化）
     * 6. MutationObserver 实时刷新（新卡片 / status-tag 变动）
     * 7. 悬停懒加载（pointerover/out 500ms 延迟）
     * 8. GM_registerMenuCommand × 4（全量加载 / 清当前页 / 清所有 / 刷新已看）
     * 9. jdb:want-watched-sync CustomEvent 监听（同标签页精确刷新）
     * 10. storage 事件监听（跨标签页精确刷新）
     * 11. visibilitychange 监听（页面重新可见时兜底）
     *
     * 原脚本 injectStyles() 调用已移除（改走 initCss 机制，CSS 更早注入）。
     */
    async init(): Promise<void> {
        await RatingCache.load();

        // ---- 启动时检测 jhs 同步事件（解决同一标签页页面导航后缓存失效） -------
        const syncVal = localStorage.getItem('jdb:want-watched-sync');
        const lastDigest = localStorage.getItem('jhsrd:last-sync-digest');
        if (syncVal && syncVal !== lastDigest) {
            RatingUtils.log('INIT_SYNC', 'jhs 有新的同步事件，全量清空评分缓存');
            RatingCache.clear();
            this._dirty = true;
            localStorage.setItem('jhsrd:last-sync-digest', syncVal);
        }

        this.watchedMap = await buildWatchedMap();

        // 首屏处理
        document
            .querySelectorAll(RATING_CONFIG.ITEM_SELECTOR)
            .forEach((i) => this.processItem(i as HTMLElement));

        // 评分修改不触发 jhs 广播——对缓存命中的项取消 loaded，
        // 首次悬停自动重新抓取以验证评分是否变化
        document.querySelectorAll('.jhs-user-rating.is-rated').forEach((el) => {
            const item = (el as Element).closest(RATING_CONFIG.ITEM_SELECTOR) as HTMLElement | null;
            if (item && item.dataset.jhsrdFromCache === 'true') {
                delete item.dataset.jhsrdLoaded;
                delete item.dataset.jhsrdFromCache;
            }
        });

        // ---- MutationObserver：实时刷新（监听 jhs 异步注入 status-tag 及新卡片） ----
        const pending = new Set<HTMLElement>();
        const flushPending = RatingUtils.debounce(() => {
            pending.forEach((item) => this.processItem(item));
            pending.clear();
        }, 150);

        new MutationObserver((muts) => {
            for (const mutation of muts) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType !== 1) continue; // 仅 Element
                    const el = addedNode as Element;
                    if (el.matches(RATING_CONFIG.ITEM_SELECTOR)) pending.add(el as HTMLElement);
                    const found = el.querySelectorAll(RATING_CONFIG.ITEM_SELECTOR);
                    if (found && found.length)
                        found.forEach((node) => pending.add(node as HTMLElement));
                }

                // status-tag 变动（jhs 异步注入后卡片状态变化）→ 刷新
                const target = mutation.target;
                if (target instanceof Element && target.closest('.tags.has-addons')) {
                    const item = target.closest(RATING_CONFIG.ITEM_SELECTOR) as HTMLElement | null;
                    if (item) {
                        item.dataset.jhsrdProcessed = 'false';
                        this.processItem(item);
                    }
                }
            }
            flushPending();
        }).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // ---- 悬停整个 .item 500ms → 懒加载评分 ----
        let hoverTimer: ReturnType<typeof setTimeout> | null = null;
        let hoveredItem: HTMLElement | null = null;

        document.body.addEventListener('pointerover', (e) => {
            const target = e.target as Element | null;
            const item = target?.closest(RATING_CONFIG.ITEM_SELECTOR) as HTMLElement | null;
            if (!item || item === hoveredItem) return;
            hoveredItem = item;

            // 如果已加载过，跳过
            if (item.dataset.jhsrdLoaded === 'true') return;
            // 仅处理有占位标签、尚未加载的
            const tag = item.querySelector('.jhs-user-rating.is-placeholder') as HTMLElement | null;
            if (!tag) return;

            if (hoverTimer) clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (hoveredItem !== item) return;
                tag.classList.add('is-loading');
                fetchRating(item).finally(() => {
                    tag.classList.remove('is-loading');
                });
            }, RATING_CONFIG.HOVER_DELAY);
        });

        document.body.addEventListener('pointerout', (e) => {
            const target = e.target as Element | null;
            const item = target?.closest(RATING_CONFIG.ITEM_SELECTOR) as HTMLElement | null;
            if (!item || item !== hoveredItem) return;
            hoveredItem = null;
            if (hoverTimer) clearTimeout(hoverTimer);
            // 移除 loading 状态
            const tag = item.querySelector('.jhs-user-rating.is-loading');
            if (tag) tag.classList.remove('is-loading');
        });

        // ---- 菜单 ----------------
        GM_registerMenuCommand('全量加载当前页评分', () => {
            this.loadAll();
        });

        GM_registerMenuCommand('清空当前页评分缓存', () => {
            this.clearPageCache();
        });

        GM_registerMenuCommand('清空所有评分缓存', () => {
            RatingCache.clear();
            this.refreshAll();
            this.toast('所有评分缓存已清空');
        });

        GM_registerMenuCommand('刷新已看列表', async () => {
            this.watchedMap = await buildWatchedMap();
            this.refreshAll();
            this.toast(`已看: ${this.watchedMap.size} 项 · 缓存: ${RatingCache.size()} 条`);
        });

        // ---- 实时刷新：同标签页 jhs CustomEvent ----------------
        document.addEventListener(
            'jdb:want-watched-sync',
            (e: Event) => {
                const { carNum, status, op, score } = (e as CustomEvent<SyncPayload>).detail || {};
                if (!carNum || !status || !op) return;
                const code = RatingUtils.normalizeCode(carNum);
                RatingUtils.log('SYNC_EVENT', code, status, op, score);
                this._invalidateCards(code, status, op, score);
            },
            { passive: true }
        );

        // ---- 实时刷新：跨标签页 localStorage 事件 ----------------
        window.addEventListener('storage', (e) => {
            if (e.key === 'jdb:want-watched-sync' && e.newValue) {
                try {
                    const payload = JSON.parse(e.newValue) as SyncPayload;
                    if (payload && payload.carNum && payload.status && payload.op) {
                        const code = RatingUtils.normalizeCode(payload.carNum);
                        RatingUtils.log(
                            'STORAGE_SYNC',
                            '跨标签页精确刷新',
                            code,
                            payload.status,
                            payload.op
                        );
                        this._invalidateCards(code, payload.status, payload.op, payload.score);
                    }
                } catch {
                    this._dirty = true;
                }
            }
        });

        // ---- 实时刷新：页面重新可见时兜底 -------------------------
        document.addEventListener(
            'visibilitychange',
            () => {
                if (document.hidden) return;
                // 跨标签页修改评分后切回 → 标记为待验证
                document.querySelectorAll('.jhs-user-rating.is-rated').forEach((el) => {
                    const item = (el as Element).closest(
                        RATING_CONFIG.ITEM_SELECTOR
                    ) as HTMLElement | null;
                    if (item) item.dataset.jhsrdLoaded = 'false';
                });
                if (this._dirty) {
                    this._dirty = false;
                    this.refreshAll();
                }
            },
            { passive: true }
        );

        RatingUtils.log('INIT', `已看 ${this.watchedMap.size} · 缓存 ${RatingCache.size()}`);
    }

    /**
     * 插件主处理入口（由 PluginManager.processPlugins 调度）。
     * 仅在 javdb 站点注册（main.tsx 的 `if (r)` 块），故无需再次判定站点。
     */
    async handle(): Promise<void> {
        await this.init();
    }
}
