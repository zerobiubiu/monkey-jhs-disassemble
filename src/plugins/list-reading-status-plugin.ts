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
 * 控制流保留要点：
 * 1. 数据层：getRatingMap/saveRatingMap/setRating/getRating + getReadSet/saveReadSet/
 *    markAsRead/markAsUnread/isRead + getLastUriMap/saveLastUri/getLastUri
 * 2. IndexedDB 备份：syncToIndexedDB（写入）+ restoreFromIndexedDB（逐字段合并恢复）
 * 3. UI 层：ensureWidgets（li 注入下拉框+星级+访问链接）+ ensureHeaderWidgets（详情页
 *    h2 标题注入）+ processAllItems（遍历所有 li）+ createDropdown + createStarWidget
 * 4. 排序筛选层：applySort（10 种排序+稳定 tiebreaker）+ applyFilter（协同安全显隐）+
 *    applySortAndFilter + countFilterStats + buildToolbar + refreshChips
 * 5. MutationObserver：监听 body subtree，isProcessing 防重入，lastLiCount 仅数量
 *    变化时刷新芯片
 * 6. GM_addValueChangeListener：跨标签页同步 5 个键（阅读状态/评分/排序/筛选阅读/筛选评分）
 */
import { BasePlugin } from './base-plugin';
import listReadingStatusCssRaw from '../styles/list-reading-status-plugin.css?raw';

/** 日志前缀。 */
const LOG_PREFIX = '[listReadingStatus]';

/** 阅读状态持久化键（GM_setValue/getValue）。 */
const STORAGE_KEY = 'jdb:list-reading-status';
/** 评分持久化键。 */
const RATING_STORAGE_KEY = 'jdb:list-rating';
/** 最近访问记录持久化键。 */
const LAST_URI_KEY = 'jdb:list-last-uri';
/** 排序状态持久化键。 */
const SORT_KEY = 'jdb:list-sort';
/** 阅读状态筛选持久化键。 */
const FILTER_READ_KEY = 'jdb:list-filter-read';
/** 评分筛选持久化键。 */
const FILTER_RATING_KEY = 'jdb:list-filter-rating';

/** jhs IndexedDB 库名（寄生备份）。 */
const JHS_DB_NAME = 'JAV-JHS';
/** jhs IndexedDB 仓库名。 */
const JHS_STORE_NAME = 'appData';
/** 本插件寄生备份键名。 */
const BACKUP_KEY = 'listReadingStatus_data';

/** 本脚本隐藏标记（协同安全：与 statusTagFilter 的 data-status-tag-hidden 等互不干扰）。 */
const LRS_HIDDEN_ATTR = 'data-lrs-hidden';
/** 原始顺序索引（排序 tiebreaker，保证排序稳定）。 */
const LRS_ORDER_ATTR = 'data-lrs-order';

/** SVG 五角星路径。 */
const STAR_PATH =
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

// ---------- 数据层（模块级函数，不依赖实例状态） ----------

/** 获取评分映射表。对应原 L34-42。 */
function getRatingMap(): Record<string, number> {
    const raw = GM_getValue(RATING_STORAGE_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 持久化评分映射表（同步到 IndexedDB）。对应原 L48-51。 */
function saveRatingMap(map: Record<string, number>): void {
    GM_setValue(RATING_STORAGE_KEY, JSON.stringify(map));
    syncToIndexedDB();
}

/** 设置清单评分。对应原 L58-67。 */
function setRating(listId: string, rating: number): void {
    const map = getRatingMap();
    if (rating > 0) {
        map[listId] = rating;
    } else {
        delete map[listId];
    }
    saveRatingMap(map);
    console.log(`${LOG_PREFIX} 评分 ${listId}: ${rating || '清除'}`);
}

/** 获取清单评分。对应原 L74-76。 */
function getRating(listId: string): number {
    return getRatingMap()[listId] || 0;
}

/** 获取最近访问记录映射表。对应原 L86-94。 */
function getLastUriMap(): Record<string, { path: string; timestamp: number }> {
    const raw = GM_getValue(LAST_URI_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 保存当前页面 URI 作为清单的最后访问记录。对应原 L100-108。 */
function saveLastUri(listId: string): void {
    const map = getLastUriMap();
    map[listId] = {
        path: location.pathname + location.search,
        timestamp: Date.now()
    };
    GM_setValue(LAST_URI_KEY, JSON.stringify(map));
    syncToIndexedDB();
}

/** 获取清单的最后访问 URI。对应原 L115-117。 */
function getLastUri(listId: string): { path: string; timestamp: number } | null {
    return getLastUriMap()[listId] || null;
}

/** 获取已标记为"已读完"的清单 ID 集合。对应原 L453-462。 */
function getReadSet(): Set<string> {
    const raw = GM_getValue(STORAGE_KEY);
    if (!raw) return new Set();
    try {
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

/** 持久化已读完的清单 ID 集合。对应原 L468-471。 */
function saveReadSet(readSet: Set<string>): void {
    GM_setValue(STORAGE_KEY, JSON.stringify([...readSet]));
    syncToIndexedDB();
}

/** 将某个清单标记为已读完。对应原 L477-482。 */
function markAsRead(listId: string): void {
    const readSet = getReadSet();
    readSet.add(listId);
    saveReadSet(readSet);
    console.log(`${LOG_PREFIX} 已标记已读完: ${listId}`);
}

/** 将某个清单取消已读完标记。对应原 L488-493。 */
function markAsUnread(listId: string): void {
    const readSet = getReadSet();
    readSet.delete(listId);
    saveReadSet(readSet);
    console.log(`${LOG_PREFIX} 已取消标记: ${listId}`);
}

/** 判断某个清单是否已读完。对应原 L500-502。 */
function isRead(listId: string): boolean {
    return getReadSet().has(listId);
}

// ---------- IndexedDB 备份（模块级函数） ----------

/** 打开 jhs 的 IndexedDB。对应原 L129-141。 */
function openJhsDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(JHS_DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(JHS_STORE_NAME)) {
                db.createObjectStore(JHS_STORE_NAME);
            }
        };
    });
}

/** 将当前阅读状态和评分写入 IndexedDB（寄生到 jhs 备份通道）。对应原 L146-166。 */
function syncToIndexedDB(): void {
    try {
        const data = {
            readingStatus: [...getReadSet()],
            ratings: getRatingMap(),
            lastUris: getLastUriMap(),
            _updatedAt: new Date().toISOString()
        };
        openJhsDB()
            .then((db) => {
                const tx = db.transaction(JHS_STORE_NAME, 'readwrite');
                const store = tx.objectStore(JHS_STORE_NAME);
                store.put(data, BACKUP_KEY);
                tx.oncomplete = () => db.close();
                tx.onerror = () => db.close();
            })
            .catch(() => {});
    } catch {
        // 静默失败，IndexedDB 不可用不影响核心功能
    }
}

/** 从 IndexedDB 合并恢复数据（逐字段合并策略）。对应原 L183-259。 */
async function restoreFromIndexedDB(): Promise<boolean> {
    try {
        const db = await openJhsDB();
        const tx = db.transaction(JHS_STORE_NAME, 'readonly');
        const store = tx.objectStore(JHS_STORE_NAME);
        const data = await new Promise<any>((resolve, reject) => {
            const req = store.get(BACKUP_KEY);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
        });
        db.close();

        if (!data || !data.readingStatus) return false;

        let restored = false;

        // 1. readingStatus：取并集（已读完状态合并）
        const localReadSet = getReadSet();
        const cloudRead = Array.isArray(data.readingStatus) ? data.readingStatus : [];
        const mergedRead = new Set([...localReadSet, ...cloudRead]);
        if (mergedRead.size > localReadSet.size) {
            GM_setValue(STORAGE_KEY, JSON.stringify([...mergedRead]));
            restored = true;
        }

        // 2. ratings：云端补缺（本地优先，避免覆盖本地新评分）
        const localRatings = getRatingMap();
        const cloudRatings =
            data.ratings && typeof data.ratings === 'object' ? data.ratings : {};
        let ratingChanged = false;
        for (const [id, rating] of Object.entries(cloudRatings)) {
            if (!(id in localRatings)) {
                localRatings[id] = rating as number;
                ratingChanged = true;
            }
        }
        if (ratingChanged) {
            GM_setValue(RATING_STORAGE_KEY, JSON.stringify(localRatings));
            restored = true;
        }

        // 3. lastUris：按 timestamp 取更大者（保留更晚的访问记录）
        const localLastUris = getLastUriMap();
        const cloudLastUris =
            data.lastUris && typeof data.lastUris === 'object' ? data.lastUris : {};
        let lastUriChanged = false;
        for (const [id, uri] of Object.entries(cloudLastUris)) {
            const local = localLastUris[id];
            const cloudUri = uri as { path: string; timestamp: number };
            if (
                !local ||
                (cloudUri.timestamp && cloudUri.timestamp > (local.timestamp || 0))
            ) {
                localLastUris[id] = cloudUri;
                lastUriChanged = true;
            }
        }
        if (lastUriChanged) {
            GM_setValue(LAST_URI_KEY, JSON.stringify(localLastUris));
            restored = true;
        }

        if (restored) {
            console.log(
                `${LOG_PREFIX} 已从云端合并恢复数据 (更新于 ${data._updatedAt || '未知'})`
            );
        }
        return restored;
    } catch {
        return false;
    }
}

/** li 元数据（排序/筛选用）。 */
interface ListMeta {
    listId: string;
    title: string;
    movies: number;
    clicks: number;
    rating: number;
    visited: number;
    order: number;
}

/** 筛选统计。 */
interface FilterStats {
    read: number;
    unread: number;
    rated: number;
    unrated: number;
    stars: number[];
}

/**
 * 清单阅读进度插件主类。
 *
 * 原脚本对应行号：L1-1391（整体）。原脚本用 IIFE 闭包承载局部状态
 * （isProcessing/currentSort/filterReadStatus/filterRatingChips/isToolbarProcessing/
 * orderCounter/lastLiCount/observer/isDetailPage），此处转为类私有字段。
 */
export class ListReadingStatusPlugin extends BasePlugin {
    /** 防重入标志：防止 DOM 修改触发的 MutationObserver 回调导致无限循环。 */
    private isProcessing = false;
    /** 当前排序方式。 */
    private currentSort = 'default';
    /** 当前阅读状态筛选（all/read/unread）。 */
    private filterReadStatus = 'all';
    /** 当前评分筛选芯片集合。 */
    private filterRatingChips: Set<string> = new Set();
    /** 工具栏防重入标志。 */
    private isToolbarProcessing = false;
    /** 原始顺序计数器（排序 tiebreaker）。 */
    private orderCounter = 0;
    /** 上次 li 数量（仅数量变化时刷新芯片）。 */
    private lastLiCount = -1;
    /** MutationObserver 实例。 */
    private observer: MutationObserver | null = null;
    /** 是否为清单详情页。 */
    private isDetailPage = false;

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
        this.observer = new MutationObserver(() => {
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
        });
        this.observer.observe(document.body, { childList: true, subtree: true });

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

    // ---------- UI 层 ----------

    /** 更新下拉框的数据状态属性。对应原 L510-512。 */
    private updateSelectAppearance(select: HTMLSelectElement): void {
        select.setAttribute('data-status', select.value);
    }

    /** 更新星级评分的外观（填充/清空星星）。对应原 L519-528。 */
    private renderStars(starsEl: HTMLElement, rating: number): void {
        const svgs = starsEl.querySelectorAll('.list-rating-star');
        svgs.forEach((svg: Element, i: number) => {
            if (i < rating) {
                svg.classList.add('filled');
            } else {
                svg.classList.remove('filled');
            }
        });
    }

    /** 创建星级评分组件（SVG 五角星）。对应原 L538-582。 */
    private createStarWidget(listId: string): HTMLElement {
        const container = document.createElement('span');
        container.className = 'list-rating-stars';
        container.title = '评分 1-5 星，再次点击取消评分';

        const currentRating = getRating(listId);
        const NS = 'http://www.w3.org/2000/svg';

        for (let i = 1; i <= 5; i++) {
            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.classList.add('list-rating-star');
            (svg as SVGElement).dataset.rating = String(i);

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', STAR_PATH);
            svg.appendChild(path);

            if (i <= currentRating) {
                svg.classList.add('filled');
            }

            svg.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                const clicked = parseInt((svg as SVGElement).dataset.rating || '0');
                const current = getRating(listId);
                const newRating = clicked === current ? 0 : clicked;
                setRating(listId, newRating);
                this.renderStars(container, newRating);
            });

            svg.addEventListener('mouseenter', () => {
                this.renderStars(container, parseInt((svg as SVGElement).dataset.rating || '0'));
            });

            container.appendChild(svg);
        }

        container.addEventListener('mouseleave', () => {
            this.renderStars(container, getRating(listId));
        });

        return container;
    }

    /** 创建阅读进度下拉框元素。对应原 L589-619。 */
    private createDropdown(listId: string): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'list-reading-dropdown';

        const optionUnread = document.createElement('option');
        optionUnread.value = 'unread';
        optionUnread.textContent = '未读完';

        const optionRead = document.createElement('option');
        optionRead.value = 'read';
        optionRead.textContent = '已读完';

        select.appendChild(optionUnread);
        select.appendChild(optionRead);

        select.value = isRead(listId) ? 'read' : 'unread';
        this.updateSelectAppearance(select);

        select.addEventListener('change', () => {
            if (select.value === 'read') {
                markAsRead(listId);
            } else {
                markAsUnread(listId);
            }
            this.updateSelectAppearance(select);
        });

        return select;
    }

    /** 为单个 li 元素注入/更新阅读进度下拉框和星级评分。对应原 L625-673。 */
    private ensureWidgets(li: Element): void {
        const listId = (li as HTMLElement).id;
        if (!listId) return;

        const container = li.querySelector(':scope > div');
        if (!container) return;

        // 下拉框：更新或创建
        let select = container.querySelector('.list-reading-dropdown') as HTMLSelectElement | null;
        if (select) {
            select.value = isRead(listId) ? 'read' : 'unread';
            this.updateSelectAppearance(select);
        } else {
            select = this.createDropdown(listId);
            container.prepend(select);
        }

        // 星级评分：更新或创建
        let stars = container.querySelector('.list-rating-stars') as HTMLElement | null;
        if (stars) {
            this.renderStars(stars, getRating(listId));
        } else {
            stars = this.createStarWidget(listId);
            container.prepend(stars);
        }

        // 最后访问链接
        let uriLink = container.querySelector('.list-last-uri-link') as HTMLAnchorElement | null;
        const lastUri = getLastUri(listId);
        if (lastUri) {
            if (!uriLink) {
                uriLink = document.createElement('a');
                uriLink.className = 'list-last-uri-link';
                const d = new Date(lastUri.timestamp);
                const pad = (n: number) => String(n).padStart(2, '0');
                const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                const search = lastUri.path.includes('?')
                    ? ' ' + lastUri.path.slice(lastUri.path.indexOf('?') + 1)
                    : '';
                uriLink.textContent = `继续浏览 →${search} (${dateStr})`;
                container.appendChild(uriLink);
            }
            uriLink.href = lastUri.path;
        } else {
            if (uriLink) uriLink.remove();
        }
    }

    /** 在清单详情页标题中注入/更新阅读进度下拉框和星级评分。对应原 L680-725。 */
    private ensureHeaderWidgets(): void {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const m = location.pathname.match(/\/lists\/([^/]+)$/);
        if (!m) {
            this.isProcessing = false;
            return;
        }
        const listId = 'list-' + m[1];

        saveLastUri(listId);

        const h2 = document.querySelector(
            'body > section > div > div.columns.is-mobile.section-columns > div > h2'
        ) as HTMLElement | null;
        if (!h2) {
            this.isProcessing = false;
            return;
        }

        let select = h2.querySelector('.list-reading-dropdown') as HTMLSelectElement | null;
        if (select) {
            select.value = isRead(listId) ? 'read' : 'unread';
            this.updateSelectAppearance(select);
        } else {
            select = this.createDropdown(listId);
            h2.prepend(select);
        }

        let stars = h2.querySelector('.list-rating-stars') as HTMLElement | null;
        if (stars) {
            this.renderStars(stars, getRating(listId));
        } else {
            stars = this.createStarWidget(listId);
            h2.prepend(stars);
        }

        Promise.resolve().then(() => {
            this.isProcessing = false;
        });
    }

    /** 遍历 #lists > ul 下的所有 li 并注入/更新下拉框和星级评分。对应原 L731-753。 */
    private processAllItems(): boolean {
        if (this.isProcessing) return false;
        this.isProcessing = true;

        const ul = document.querySelector('#lists > ul');
        if (!ul) {
            this.isProcessing = false;
            return false;
        }

        const items = ul.querySelectorAll(':scope > li');
        items.forEach((li: Element) => this.ensureWidgets(li));

        this.applySortAndFilter();

        Promise.resolve().then(() => {
            this.isProcessing = false;
        });

        return items.length > 0;
    }

    // ---------- 排序与筛选层 ----------

    /** 从 GM 存储加载排序与筛选状态。对应原 L779-793。 */
    private loadToolbarState(): void {
        const s = GM_getValue(SORT_KEY);
        if (s) this.currentSort = s;
        const r = GM_getValue(FILTER_READ_KEY);
        if (r === 'read' || r === 'unread') this.filterReadStatus = r;
        const rc = GM_getValue(FILTER_RATING_KEY);
        if (rc) {
            try {
                const arr = JSON.parse(rc);
                if (Array.isArray(arr)) this.filterRatingChips = new Set(arr);
            } catch {
                this.filterRatingChips = new Set();
            }
        }
    }

    /** 持久化排序状态。对应原 L799-802。 */
    private saveSortState(v: string): void {
        this.currentSort = v;
        GM_setValue(SORT_KEY, v);
    }

    /** 持久化阅读状态筛选。对应原 L808-811。 */
    private saveFilterReadState(v: string): void {
        this.filterReadStatus = v;
        GM_setValue(FILTER_READ_KEY, v);
    }

    /** 持久化评分筛选芯片集合。对应原 L817-820。 */
    private saveFilterRatingState(set: Set<string>): void {
        this.filterRatingChips = set;
        GM_setValue(FILTER_RATING_KEY, JSON.stringify([...set]));
    }

    /** 从 li 提取排序/筛选所需的元数据。对应原 L827-847。 */
    private getListMeta(li: Element): ListMeta {
        const listId = (li as HTMLElement).id || '';
        const titleEl = li.querySelector("a[href*='/lists/']");
        const title = titleEl ? titleEl.textContent!.trim() : '';
        const metaTxt = li.querySelector('.meta')?.textContent ?? '';
        const moviesMatch = metaTxt.match(/([\d,]+)\s*部影片/);
        const clicksMatch = metaTxt.match(/點擊了\s*([\d,]+)/);
        return {
            listId,
            title,
            movies: moviesMatch ? parseInt(moviesMatch[1].replace(/,/g, '')) : 0,
            clicks: clicksMatch ? parseInt(clicksMatch[1].replace(/,/g, '')) : 0,
            rating: getRating(listId),
            visited: getLastUri(listId)?.timestamp ?? 0,
            order: parseInt(li.getAttribute(LRS_ORDER_ATTR) || '0') || 0
        };
    }

    /** 为 li 分配原始顺序索引。对应原 L853-857。 */
    private ensureLiOrder(li: Element): void {
        if (!li.hasAttribute(LRS_ORDER_ATTR)) {
            li.setAttribute(LRS_ORDER_ATTR, String(this.orderCounter++));
        }
    }

    /** 比较两个 li（按 currentSort），相同则按原始顺序 tiebreaker。对应原 L865-902。 */
    private compareLi(a: Element, b: Element): number {
        const ma = this.getListMeta(a);
        const mb = this.getListMeta(b);
        let cmp = 0;
        switch (this.currentSort) {
            case 'rating-desc': cmp = mb.rating - ma.rating; break;
            case 'rating-asc': cmp = ma.rating - mb.rating; break;
            case 'movies-desc': cmp = mb.movies - ma.movies; break;
            case 'movies-asc': cmp = ma.movies - mb.movies; break;
            case 'clicks-desc': cmp = mb.clicks - ma.clicks; break;
            case 'clicks-asc': cmp = ma.clicks - mb.clicks; break;
            case 'visited-desc': cmp = mb.visited - ma.visited; break;
            case 'visited-asc': cmp = ma.visited - mb.visited; break;
            case 'title-asc': cmp = ma.title.localeCompare(mb.title, 'zh'); break;
            default: cmp = 0;
        }
        if (cmp === 0) cmp = ma.order - mb.order;
        return cmp;
    }

    /** 应用排序：按 currentSort 重排 #lists > ul 下的 li。对应原 L908-924。 */
    private applySort(): void {
        if (this.currentSort === 'default') return;
        const ul = document.querySelector('#lists > ul');
        if (!ul) return;
        const lis = [...ul.querySelectorAll(':scope > li')] as HTMLElement[];
        if (lis.length < 2) return;
        lis.forEach((li) => this.ensureLiOrder(li));
        lis.sort((a, b) => this.compareLi(a, b));
        const sortedIds = lis.map((li) => li.id).join(',');
        const currentIds = [...ul.querySelectorAll(':scope > li')].map((li) => (li as HTMLElement).id).join(',');
        if (sortedIds === currentIds) return;
        const frag = document.createDocumentFragment();
        lis.forEach((li) => frag.appendChild(li));
        ul.appendChild(frag);
    }

    /** 判断 li 是否匹配当前筛选条件。对应原 L931-957。 */
    private matchesFilter(li: Element): boolean {
        const listId = (li as HTMLElement).id;
        if (!listId) return true;

        if (this.filterReadStatus !== 'all') {
            const read = isRead(listId);
            if (this.filterReadStatus === 'read' && !read) return false;
            if (this.filterReadStatus === 'unread' && read) return false;
        }

        if (this.filterRatingChips.size > 0) {
            const rating = getRating(listId);
            let match = false;
            if (this.filterRatingChips.has('rated') && rating > 0) match = true;
            if (this.filterRatingChips.has('unrated') && rating === 0) match = true;
            for (let i = 1; i <= 5; i++) {
                if (this.filterRatingChips.has(`rating-${i}`) && rating === i) {
                    match = true;
                    break;
                }
            }
            if (!match) return false;
        }
        return true;
    }

    /** 应用筛选：显示/隐藏 li（协同安全 data-lrs-hidden）。对应原 L964-995。 */
    private applyFilter(): void {
        const ul = document.querySelector('#lists > ul');
        if (!ul) return;
        const lis = ul.querySelectorAll(':scope > li');

        if (this.filterReadStatus === 'all' && this.filterRatingChips.size === 0) {
            lis.forEach((li: Element) => {
                const htmlLi = li as HTMLElement;
                if (htmlLi.hasAttribute(LRS_HIDDEN_ATTR)) {
                    htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
                    htmlLi.style.display = '';
                }
            });
            return;
        }

        lis.forEach((li: Element) => {
            const htmlLi = li as HTMLElement;
            const hiddenByOther =
                htmlLi.style.display === 'none' &&
                !htmlLi.hasAttribute(LRS_HIDDEN_ATTR);
            if (hiddenByOther) return;

            if (this.matchesFilter(htmlLi)) {
                htmlLi.removeAttribute(LRS_HIDDEN_ATTR);
                htmlLi.style.display = '';
            } else {
                htmlLi.setAttribute(LRS_HIDDEN_ATTR, '');
                htmlLi.style.display = 'none';
            }
        });
    }

    /** 应用排序与筛选（顺序：先排序后筛选）。对应原 L1000-1009。 */
    private applySortAndFilter(): void {
        if (this.isToolbarProcessing) return;
        this.isToolbarProcessing = true;
        try {
            this.applySort();
            this.applyFilter();
        } finally {
            this.isToolbarProcessing = false;
        }
    }

    /** 统计各筛选分类的清单数。对应原 L1015-1039。 */
    private countFilterStats(): FilterStats {
        const stats: FilterStats = {
            read: 0,
            unread: 0,
            rated: 0,
            unrated: 0,
            stars: [0, 0, 0, 0, 0]
        };
        const ul = document.querySelector('#lists > ul');
        if (!ul) return stats;
        ul.querySelectorAll(':scope > li').forEach((li: Element) => {
            const id = (li as HTMLElement).id;
            if (!id) return;
            if (isRead(id)) stats.read++;
            else stats.unread++;
            const r = getRating(id);
            if (r > 0) {
                stats.rated++;
                if (r >= 1 && r <= 5) stats.stars[r - 1]++;
            } else {
                stats.unrated++;
            }
        });
        return stats;
    }

    /** 创建单个筛选芯片。对应原 L1048-1091。 */
    private createFilterChip(label: string, value: string, count: number): HTMLSpanElement {
        const chip = document.createElement('span');
        chip.className = 'list-filter-chip';
        chip.dataset.value = value;
        const labelText = document.createElement('span');
        labelText.textContent = label;
        chip.appendChild(labelText);
        const countSpan = document.createElement('span');
        countSpan.className = 'chip-count';
        countSpan.textContent = String(count);
        chip.appendChild(countSpan);

        chip.addEventListener('click', () => {
            if (value === 'read' || value === 'unread') {
                const wasActive = chip.classList.contains('active');
                document
                    .querySelectorAll(
                        ".list-filter-chip[data-value='read'], .list-filter-chip[data-value='unread']"
                    )
                    .forEach((c: Element) => c.classList.remove('active'));
                if (!wasActive) {
                    chip.classList.add('active');
                    this.saveFilterReadState(value);
                } else {
                    this.saveFilterReadState('all');
                }
            } else {
                chip.classList.toggle('active');
                const next = new Set(this.filterRatingChips);
                if (chip.classList.contains('active')) {
                    next.add(value);
                } else {
                    next.delete(value);
                }
                this.saveFilterRatingState(next);
            }
            this.applySortAndFilter();
        });

        return chip;
    }

    /** 构建/刷新工具栏：挂载到 #lists 之前。对应原 L1097-1206。 */
    private buildToolbar(): HTMLElement | null {
        if (this.isDetailPage) return null;
        const lists = document.querySelector('#lists');
        if (!lists) return null;
        if (document.querySelector('.list-toolbar')) {
            return document.querySelector('.list-toolbar') as HTMLElement;
        }

        const toolbar = document.createElement('div');
        toolbar.className = 'list-toolbar';

        // 排序组
        const sortGroup = document.createElement('div');
        sortGroup.className = 'list-toolbar-group';
        const sortLabel = document.createElement('span');
        sortLabel.className = 'list-toolbar-label';
        sortLabel.textContent = '排序:';
        const sortSelect = document.createElement('select');
        sortSelect.className = 'list-sort-select';
        const sortOptions: [string, string][] = [
            ['default', '默认'],
            ['rating-desc', '评分 ↓'],
            ['rating-asc', '评分 ↑'],
            ['movies-desc', '影片数 ↓'],
            ['movies-asc', '影片数 ↑'],
            ['clicks-desc', '点击数 ↓'],
            ['clicks-asc', '点击数 ↑'],
            ['visited-desc', '最近访问 ↓'],
            ['visited-asc', '最久访问 ↓'],
            ['title-asc', '标题 A-Z']
        ];
        sortOptions.forEach(([val, txt]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            if (val === this.currentSort) opt.selected = true;
            sortSelect.appendChild(opt);
        });
        sortSelect.addEventListener('change', () => {
            this.saveSortState(sortSelect.value);
            this.applySortAndFilter();
        });
        sortGroup.appendChild(sortLabel);
        sortGroup.appendChild(sortSelect);
        toolbar.appendChild(sortGroup);

        const div1 = document.createElement('div');
        div1.className = 'list-filter-divider';
        toolbar.appendChild(div1);

        // 阅读状态筛选组
        const readGroup = document.createElement('div');
        readGroup.className = 'list-toolbar-group';
        const readLabel = document.createElement('span');
        readLabel.className = 'list-toolbar-label';
        readLabel.textContent = '阅读:';
        readGroup.appendChild(readLabel);
        const readChipsHost = document.createElement('div');
        readGroup.appendChild(readChipsHost);
        toolbar.appendChild(readGroup);

        const div2 = document.createElement('div');
        div2.className = 'list-filter-divider';
        toolbar.appendChild(div2);

        // 评分筛选组
        const ratingGroup = document.createElement('div');
        ratingGroup.className = 'list-toolbar-group';
        const ratingLabel = document.createElement('span');
        ratingLabel.className = 'list-toolbar-label';
        ratingLabel.textContent = '评分:';
        ratingGroup.appendChild(ratingLabel);
        const ratingChipsHost = document.createElement('div');
        ratingGroup.appendChild(ratingChipsHost);
        toolbar.appendChild(ratingGroup);

        // 重置按钮
        const reset = document.createElement('a');
        reset.className = 'list-toolbar-reset';
        reset.textContent = '重置筛选';
        reset.addEventListener('click', (e: Event) => {
            e.preventDefault();
            this.saveSortState('default');
            this.saveFilterReadState('all');
            this.saveFilterRatingState(new Set());
            sortSelect.value = 'default';
            toolbar
                .querySelectorAll('.list-filter-chip.active')
                .forEach((c: Element) => c.classList.remove('active'));
            this.applySortAndFilter();
        });
        toolbar.appendChild(reset);

        lists.insertAdjacentElement('beforebegin', toolbar);

        (toolbar as any)._readHost = readChipsHost;
        (toolbar as any)._ratingHost = ratingChipsHost;
        (toolbar as any)._sortSelect = sortSelect;

        this.refreshChips(toolbar);
        console.log(`${LOG_PREFIX} 排序与筛选工具栏已挂载`);
        return toolbar;
    }

    /** 刷新筛选芯片。对应原 L1212-1260。 */
    private refreshChips(toolbar: HTMLElement): void {
        const stats = this.countFilterStats();

        const readHost: HTMLElement | undefined = (toolbar as any)._readHost;
        if (readHost) {
            readHost.innerHTML = '';
            const readChip = this.createFilterChip('已读完', 'read', stats.read);
            if (this.filterReadStatus === 'read') readChip.classList.add('active');
            readHost.appendChild(readChip);
            const unreadChip = this.createFilterChip('未读完', 'unread', stats.unread);
            if (this.filterReadStatus === 'unread') unreadChip.classList.add('active');
            readHost.appendChild(unreadChip);
        }

        const ratingHost: HTMLElement | undefined = (toolbar as any)._ratingHost;
        if (ratingHost) {
            ratingHost.innerHTML = '';
            const ratedChip = this.createFilterChip('有评分', 'rated', stats.rated);
            if (this.filterRatingChips.has('rated')) ratedChip.classList.add('active');
            ratingHost.appendChild(ratedChip);
            const unratedChip = this.createFilterChip('无评分', 'unrated', stats.unrated);
            if (this.filterRatingChips.has('unrated')) unratedChip.classList.add('active');
            ratingHost.appendChild(unratedChip);
            for (let i = 1; i <= 5; i++) {
                const starChip = this.createFilterChip(`${i}星`, `rating-${i}`, stats.stars[i - 1]);
                if (this.filterRatingChips.has(`rating-${i}`)) starChip.classList.add('active');
                ratingHost.appendChild(starChip);
            }
        }
    }

    /** 尝试构建工具栏并应用排序筛选。对应原 L1266-1273。 */
    private tryBuildToolbar(): boolean {
        if (this.isDetailPage) return false;
        const toolbar = this.buildToolbar();
        if (!toolbar) return false;
        this.refreshChips(toolbar);
        this.applySortAndFilter();
        return true;
    }

    /** 从持久化状态恢复工具栏 UI。对应原 L1278-1283。 */
    private restoreToolbarUI(): void {
        const toolbar = document.querySelector('.list-toolbar') as HTMLElement | null;
        if (!toolbar) return;
        const sortSelect: HTMLSelectElement | undefined = (toolbar as any)._sortSelect;
        if (sortSelect) sortSelect.value = this.currentSort;
        this.refreshChips(toolbar);
    }
}
