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
 * - addTagDisplay：原 L580-660（渲染单个卡片标签）
 * - refreshAllTags：原 L366-401（全量刷新）
 * - refreshDesignation：原 L410-457（精准刷新单个番号）
 * - applyFilter：原 L717-807（4 种筛选模式）
 * - buildFilterModeDropdown：原 L814-911（模式下拉）
 * - buildFilterBar：原 L918-1043（筛选栏 + refreshChips + createFilterChip）
 * - initExistingItems：原 L1057-1090（初始化）
 * - handleNewItems：原 L1106-1163（流式增量 + 防抖）
 * - setupAutoRefreshListener：原 L1189-1282（三重监听）
 */
import { VltDb } from './vlt-db';

/** 标签条目（与 VltDb.queryMoviesLists 返回值元素结构一致）。 */
export interface TagEntry {
    name: string;
    url: string | null;
    style: { name: string; bg: string; text: string } | null;
}

/** 标签缓存类型：番号 → 标签数组。 */
type TagsCache = Record<string, TagEntry[]>;

/** Bootstrap 标准颜色调色板（IDB 中 style 缺失时回退使用）。 */
const bootstrapColors = [
    { name: 'primary', bg: '#0d6efd', text: '#fff' },
    { name: 'secondary', bg: '#6c757d', text: '#fff' },
    { name: 'success', bg: '#198754', text: '#fff' },
    { name: 'danger', bg: '#dc3545', text: '#fff' },
    { name: 'warning', bg: '#ffc107', text: '#212529' },
    { name: 'info', bg: '#0dcaf0', text: '#212529' },
    { name: 'dark', bg: '#212529', text: '#fff' }
];

/**
 * 随机选取 Bootstrap 配色（对应原 L288-296）。
 * IDB 中标签 style 缺失时由 addTagDisplay 回退调用。
 *
 * @returns { bg, text, isLight } —— isLight 标记浅色背景（需用深色文字）
 */
function getRandomBootstrapColor(): { bg: string; text: string; isLight: boolean } {
    const color = bootstrapColors[Math.floor(Math.random() * bootstrapColors.length)];
    return {
        bg: color.bg,
        text: color.text,
        isLight: color.text !== '#fff'
    };
}

/** 标记本脚本隐藏的卡片（与其他脚本的 hidden 属性区分，协同安全设计）。 */
const TAG_HIDDEN_ATTR = 'data-video-lists-tag-hidden';

/** GM 存储键：自动刷新开关。 */
const AUTO_REFRESH_KEY = 'jdb:auto-refresh-enabled';

/** GM 存储键 + localStorage 键：最后一次同步事件 payload。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

/** 筛选模式枚举（4 种）。 */
const FILTER_MODES = {
    CONTAINS_ANY: 'contains-any',
    CONTAINS_ALL: 'contains-all',
    EXCLUDES_ALL: 'excludes-all',
    EXCLUDES_ANY: 'excludes-any'
} as const;

/** 筛选模式配置（label + group 用于下拉菜单渲染）。 */
const FILTER_MODE_CONFIG: { value: string; label: string; group: 'include' | 'exclude' }[] = [
    { value: FILTER_MODES.CONTAINS_ANY, label: '包含任意一个', group: 'include' },
    { value: FILTER_MODES.CONTAINS_ALL, label: '全都包含', group: 'include' },
    { value: FILTER_MODES.EXCLUDES_ALL, label: '不包含以下标签', group: 'exclude' },
    { value: FILTER_MODES.EXCLUDES_ANY, label: '不包含以下任意一个', group: 'exclude' }
];

/**
 * 比对两个标签数组是否等价（对应原 L466-471）。
 * 用于精准刷新时跳过未变化的 DOM 更新，避免无谓重渲染。
 *
 * @param a 旧标签数组（可能为 null，表示尚未加载）
 * @param b 新标签数组
 * @returns true 表示等价（可跳过 DOM 更新）
 */
function tagsEqual(a: TagEntry[] | null, b: TagEntry[]): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 标签显示模块主类。
 *
 * 原脚本用 IIFE 闭包承载局部状态（mockTags/autoRefreshEnabled/
 * currentFilterMode/pendingNewItems/debounceTimer），此处全部转为类私有字段。
 * filterBar._refreshChips / details._updateModeUI 保留挂在 DOM 元素上
 * （与原脚本一致，用 as any 访问）。
 */
export class VltTags {
    /** 标签缓存（替代原 mockTags）。null 表示尚未从 IDB 加载。 */
    private tagsCache: TagsCache | null = null;

    /** 当前筛选模式（默认 CONTAINS_ANY）。 */
    private currentFilterMode: string = FILTER_MODES.CONTAINS_ANY;

    /** 自动刷新开关（跨标签页联动）。 */
    private autoRefreshEnabled: boolean = true;

    /** 待处理的流式新增卡片队列（防抖累积）。 */
    private pendingNewItems: Element[] = [];

    /** 防抖定时器（handleNewItems 用）。 */
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** 防抖间隔（毫秒），累积在此期间内的新增卡片统一请求。 */
    private readonly DEBOUNCE_MS: number = 300;

    // ==================== 标签数据管理 ====================

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

    // ==================== 标签渲染 ====================

    /**
     * 给单个 .item 卡片添加标签显示（对应原 L580-660）。
     *
     * 流程：
     * 1. 查找 `a > div.video-title > strong` 获取番号
     * 2. tagsCache 未加载时跳过（等数据就绪后由调用方重新触发渲染）
     * 3. 查找 `.meta` 作为插入点
     * 4. 创建 `.custom-tags-display` 容器
     * 5. 有标签：每个渲染为 `.custom-tag-link`（有 url 用 `<a>`，无 url 用 `<span>`）
     *    - 优先用 tag.style 配色；缺失时回退 getRandomBootstrapColor()
     *    - 浅色背景（text !== '#fff'）加 `light-bg` class
     * 6. 无标签：渲染占位符 `—`（pointer-events: none，不可点击）
     * 7. 添加滚轮横向滚动监听（触达边界时交还页面纵向滚动）
     * 8. 插入到 `.meta` 之后
     *
     * @param item 单个 .item 卡片元素
     */
    addTagDisplay(item: Element): void {
        if (item.querySelector('.custom-tags-display')) return;

        const strongEl = item.querySelector('a > div.video-title > strong');
        if (!strongEl) return;
        const designation = strongEl.innerHTML;

        // 标签数据尚未加载时跳过（等待 IDB 返回后再渲染）
        if (!this.tagsCache) return;

        const meta = item.querySelector('.meta');
        if (!meta) return;

        const container = document.createElement('div');
        container.className = 'custom-tags-display';

        const tags = this.tagsCache[designation];
        if (tags && tags.length > 0) {
            tags.forEach((tag: TagEntry) => {
                // url 为 null/空时渲染为 <span>，否则渲染为可点击的 <a>
                const urlTrimmed = tag.url?.trim();
                const hasUrl = !!urlTrimmed;
                const el = document.createElement(hasUrl ? 'a' : 'span');
                el.className = 'custom-tag-link';
                if (hasUrl && urlTrimmed) {
                    const anchor = el as HTMLAnchorElement;
                    anchor.href = urlTrimmed;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                }
                el.textContent = tag.name;

                // 优先使用 IDB 返回的 style；缺失时回退随机配色
                const style = tag.style;
                if (style && style.bg && style.text) {
                    el.style.backgroundColor = style.bg;
                    el.style.color = style.text;
                    if (style.text !== '#fff') {
                        el.classList.add('light-bg');
                    }
                } else {
                    const color = getRandomBootstrapColor();
                    el.style.backgroundColor = color.bg;
                    el.style.color = color.text;
                    if (color.isLight) {
                        el.classList.add('light-bg');
                    }
                }

                container.appendChild(el);
            });
        } else {
            // 无标签时放置一个不可点击的占位 span，保证容器有内容支撑 UI 平齐
            const placeholder = document.createElement('span');
            placeholder.className = 'custom-tag-link';
            placeholder.textContent = '\u2014'; // em-dash 占位
            placeholder.style.backgroundColor = '#e9ecef';
            placeholder.style.color = '#6c757d';
            placeholder.style.pointerEvents = 'none';
            placeholder.style.userSelect = 'none';
            container.appendChild(placeholder);
        }

        // 鼠标滚轮横向滚动，触达边界时交还页面纵向滚动
        container.addEventListener(
            'wheel',
            (e: WheelEvent) => {
                if (e.deltaY !== 0) {
                    const atStart = container.scrollLeft <= 0 && e.deltaY < 0;
                    const atEnd =
                        container.scrollLeft + container.clientWidth >= container.scrollWidth - 1 &&
                        e.deltaY > 0;
                    if (!atStart && !atEnd) {
                        e.preventDefault();
                        container.scrollLeft += e.deltaY;
                    }
                }
            },
            { passive: false }
        );

        meta.insertAdjacentElement('afterend', container);
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
            console.error(`自动刷新标签数据失败（${lists.length} 个番号）:`, err);
            return;
        }

        // 移除旧标签容器
        document.querySelectorAll('.custom-tags-display').forEach((el: Element) => el.remove());

        // 重新渲染
        document.querySelectorAll('.item').forEach((item: Element) => this.addTagDisplay(item));

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
            console.error(`[视频清单标签] 刷新 ${designation} 失败:`, err);
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
        const oldContainer = targetItem.querySelector('.custom-tags-display');
        if (oldContainer) oldContainer.remove();
        this.addTagDisplay(targetItem);

        // 标签集合变化时刷新筛选栏
        this.updateFilterBar();

        console.log(
            `[视频清单标签] ${designation} 标签已更新 (${oldTags ? oldTags.length : 0} → ${newTags.length})`
        );
    }

    // ==================== 筛选器 ====================

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
     *
     * @param enabled 开关状态
     */
    private saveAutoRefreshState(enabled: boolean): void {
        try {
            GM_setValue(AUTO_REFRESH_KEY, enabled);
        } catch {
            // 忽略写入异常
        }
    }

    /**
     * 应用当前筛选（对应原 L717-807）。
     *
     * 支持 4 种模式：
     * - CONTAINS_ANY：包含任意一个选中标签即显示（OR）
     * - CONTAINS_ALL：全都包含才显示（AND）
     * - EXCLUDES_ALL：一个都不包含才显示（NOR）
     * - EXCLUDES_ANY：至少缺少一个才显示（NAND）
     *
     * 协同安全：被其他脚本隐藏的卡片（display:none 且无 TAG_HIDDEN_ATTR）
     * 不纳入管理，跳过。无筛选时仅恢复本脚本隐藏的卡片。
     */
    private applyFilter(): void {
        const activeChips = document.querySelectorAll('.tag-filter-chip.active');
        const selectedValues = new Set(
            Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
        );

        // 无筛选时：仅恢复本脚本隐藏的卡片
        if (selectedValues.size === 0) {
            document.querySelectorAll(`.item[${TAG_HIDDEN_ATTR}]`).forEach((item: Element) => {
                (item as HTMLElement).removeAttribute(TAG_HIDDEN_ATTR);
                (item as HTMLElement).style.display = '';
            });
            return;
        }

        const showNoTag = selectedValues.has('no-tag');
        const selectedTags = new Set([...selectedValues].filter((v: string) => v !== 'no-tag'));

        document.querySelectorAll('.item').forEach((item: Element) => {
            const htmlItem = item as HTMLElement;
            // 协同安全：已被其他脚本隐藏的卡片不纳入管理
            const hiddenByOther =
                htmlItem.style.display === 'none' && !htmlItem.hasAttribute(TAG_HIDDEN_ATTR);
            if (hiddenByOther) return;

            const tagLinks = item.querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])"
            );
            const itemTagNames = new Set(
                Array.from(tagLinks).map((el: Element) => el.textContent?.trim() || '')
            );

            let tagMatch = false;

            if (selectedTags.size > 0) {
                switch (this.currentFilterMode) {
                    case FILTER_MODES.CONTAINS_ANY:
                        // 包含任意一个：命中任一标签即显示
                        tagMatch = [...selectedTags].some((t) => itemTagNames.has(t));
                        break;
                    case FILTER_MODES.CONTAINS_ALL:
                        // 全都包含：命中全部标签才显示
                        tagMatch = [...selectedTags].every((t) => itemTagNames.has(t));
                        break;
                    case FILTER_MODES.EXCLUDES_ALL:
                        // 不包含以下标签：一个都不包含才显示
                        tagMatch = ![...selectedTags].some((t) => itemTagNames.has(t));
                        break;
                    case FILTER_MODES.EXCLUDES_ANY:
                        // 不包含以下任意一个：至少缺少一个才显示
                        tagMatch = ![...selectedTags].every((t) => itemTagNames.has(t));
                        break;
                    default:
                        tagMatch = [...selectedTags].some((t) => itemTagNames.has(t));
                }
            }

            // 无标签条件独立判断，与标签匹配用 OR 连接
            const noTagMatch = showNoTag && itemTagNames.size === 0;

            const shouldShow = tagMatch || noTagMatch;

            if (shouldShow) {
                htmlItem.removeAttribute(TAG_HIDDEN_ATTR);
                htmlItem.style.display = '';
            } else {
                htmlItem.setAttribute(TAG_HIDDEN_ATTR, '');
                htmlItem.style.display = 'none';
            }
        });
    }

    /**
     * 构建筛选模式下拉菜单（对应原 L814-911）。
     * 使用 <details> 原生行为实现点击外部自动关闭。
     *
     * updateModeUI 闭包挂在 details._updateModeUI 上（as any），供外部刷新模式 UI。
     *
     * @returns HTMLDetailsElement 下拉菜单元素
     */
    private buildFilterModeDropdown(): HTMLDetailsElement {
        const details = document.createElement('details');
        details.className = 'filter-mode-dropdown';

        const summary = document.createElement('summary');
        summary.className = 'filter-mode-summary';

        // 模式指示圆点
        const indicator = document.createElement('span');
        indicator.className = 'filter-mode-indicator';
        summary.appendChild(indicator);

        // 当前模式文本
        const modeText = document.createElement('span');
        modeText.className = 'filter-mode-text';
        summary.appendChild(modeText);

        // 下拉箭头
        const arrow = document.createElement('span');
        arrow.className = 'filter-mode-arrow';
        arrow.textContent = '\u25BC';
        summary.appendChild(arrow);

        details.appendChild(summary);

        // 下拉面板
        const panel = document.createElement('div');
        panel.className = 'filter-mode-panel';

        /** 根据 currentFilterMode 刷新按钮与菜单状态 */
        const updateModeUI = (): void => {
            const config =
                FILTER_MODE_CONFIG.find((m) => m.value === this.currentFilterMode) ||
                FILTER_MODE_CONFIG[0];

            // 更新按钮文本
            modeText.textContent = config.label;

            // 更新按钮圆点
            indicator.className = 'filter-mode-indicator ' + config.group;

            // 更新菜单选中状态
            panel.querySelectorAll('.filter-mode-item').forEach((el: Element) => {
                el.classList.toggle(
                    'selected',
                    (el as HTMLElement).dataset.mode === this.currentFilterMode
                );
            });
        };

        // 构建菜单项
        let lastGroup: 'include' | 'exclude' | null = null;
        FILTER_MODE_CONFIG.forEach((mode) => {
            // 组间插入分隔线
            if (lastGroup && lastGroup !== mode.group) {
                const separator = document.createElement('div');
                separator.className = 'filter-mode-separator';
                panel.appendChild(separator);
            }
            lastGroup = mode.group;

            const item = document.createElement('div');
            item.className = 'filter-mode-item';
            if (mode.group === 'exclude') {
                item.classList.add('exclude');
            }
            item.dataset.mode = mode.value;

            // 圆点
            const dot = document.createElement('span');
            dot.className = 'filter-mode-indicator ' + mode.group;
            item.appendChild(dot);

            // 文本
            const text = document.createElement('span');
            text.textContent = mode.label;
            item.appendChild(text);

            item.addEventListener('click', () => {
                this.currentFilterMode = mode.value;
                updateModeUI();
                details.open = false;
                this.applyFilter();
            });

            panel.appendChild(item);
        });

        details.appendChild(panel);

        // 保存 updateModeUI 引用（与原脚本一致，挂在 DOM 元素上）
        (details as any)._updateModeUI = updateModeUI;

        // 初始刷新
        updateModeUI();

        return details;
    }

    /**
     * 构建筛选器 UI（对应原 L918-1043）。
     *
     * - 演员页面：插入到 div.actor-tags.tags 之后
     * - 其他页面：插入到 div.tabs.is-boxed 之后
     *
     * 内含 refreshChips（刷新芯片列表，保留已激活状态）和 createFilterChip
     * （创建单个芯片）。refreshChips 挂在 filterBar._refreshChips 上（as any），
     * 供 updateFilterBar 后续调用。
     */
    buildFilterBar(): void {
        if (document.querySelector('.tag-filter-bar')) return;

        // 根据页面类型选择挂载目标
        const isActorPage = /^\/actors\//.test(window.location.pathname);
        const mountTarget = isActorPage
            ? document.querySelector('body > section > div > div.actor-tags.tags')
            : document.querySelector('body > section > div > div.tabs.is-boxed');
        if (!mountTarget) return;

        const filterBar = document.createElement('div');
        filterBar.className = 'tag-filter-bar';

        const label = document.createElement('span');
        label.className = 'tag-filter-label';
        label.textContent = '筛选:';
        filterBar.appendChild(label);

        // ── 筛选模式下拉 ──
        const modeDropdown = this.buildFilterModeDropdown();
        filterBar.appendChild(modeDropdown);
        (filterBar as any)._modeDropdown = modeDropdown;

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'tag-filter-chips';
        filterBar.appendChild(chipsContainer);

        // ── 自动刷新开关 ──
        const toggleWrapper = document.createElement('label');
        toggleWrapper.className = 'auto-refresh-toggle';
        toggleWrapper.title = '监听清单操作，自动刷新标签';

        const switchSpan = document.createElement('span');
        switchSpan.className = 'auto-refresh-switch';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.autoRefreshEnabled;
        const slider = document.createElement('span');
        slider.className = 'auto-refresh-slider';
        switchSpan.appendChild(checkbox);
        switchSpan.appendChild(slider);

        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = '自动刷新';

        toggleWrapper.appendChild(switchSpan);
        toggleWrapper.appendChild(toggleLabel);
        filterBar.appendChild(toggleWrapper);

        checkbox.addEventListener('change', () => {
            this.autoRefreshEnabled = checkbox.checked;
            this.saveAutoRefreshState(this.autoRefreshEnabled);
            if (this.autoRefreshEnabled) {
                console.log('[视频清单标签] 自动刷新已开启');
            } else {
                console.log('[视频清单标签] 自动刷新已关闭');
            }
        });

        /**
         * 创建单个筛选芯片（对应原 L1019-1034）。
         *
         * @param labelText 芯片文本
         * @param value 芯片值（标签名或 'no-tag'）
         * @param opts 选项（isNoTag/count）
         * @returns 芯片 span 元素
         */
        const createFilterChip = (
            labelText: string,
            value: string,
            opts: { isNoTag?: boolean; count?: number } = {}
        ): HTMLSpanElement => {
            const { isNoTag = false, count } = opts;
            const chip = document.createElement('span');
            chip.className = 'tag-filter-chip';
            if (isNoTag) chip.classList.add('no-tag');
            chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
            chip.dataset.value = value;

            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                this.applyFilter();
            });

            return chip;
        };

        /** 刷新芯片列表（对应原 L982-1011），保留当前选中状态 */
        const refreshChips = (): void => {
            // 保存当前选中状态
            const activeValues = new Set(
                Array.from(chipsContainer.querySelectorAll('.tag-filter-chip.active')).map(
                    (c: Element) => (c as HTMLElement).dataset.value || ''
                )
            );

            chipsContainer.innerHTML = '';
            const allCounts = this.collectTagCounts();

            // "无标签" 芯片（带计数）
            const noCount = this.countNoTagItems();
            const noTagChip = createFilterChip('无标签', 'no-tag', {
                isNoTag: true,
                count: noCount
            });
            if (activeValues.has('no-tag')) noTagChip.classList.add('active');
            chipsContainer.appendChild(noTagChip);

            // 各标签芯片（带计数）—— 用 collectAllUniqueTags 获取去重排序的标签名
            const sortedTags = this.collectAllUniqueTags();
            sortedTags.forEach((tagName: string) => {
                const chip = createFilterChip(tagName, tagName, {
                    count: allCounts[tagName]
                });
                if (activeValues.has(tagName)) chip.classList.add('active');
                chipsContainer.appendChild(chip);
            });
        };

        refreshChips();

        // 作为挂载目标的兄弟元素插入到它之后
        mountTarget.insertAdjacentElement('afterend', filterBar);

        // 保存 refreshChips 引用以便后续更新（与原脚本一致，挂在 DOM 元素上）
        (filterBar as any)._refreshChips = refreshChips;
    }

    /**
     * 更新筛选栏芯片（对应原 L1048-1054）。
     * 新卡片加载后调用，重新生成芯片列表并重新应用筛选。
     */
    updateFilterBar(): void {
        const filterBar = document.querySelector('.tag-filter-bar');
        if (filterBar && (filterBar as any)._refreshChips) {
            (filterBar as any)._refreshChips();
            this.applyFilter();
        }
    }

    /**
     * 收集页面上所有唯一的标签名称（排除占位符）（对应原 L668-681）。
     * 占位符（pointer-events: none 的 —）被选择器排除。
     *
     * @returns 去重排序后的标签名数组
     */
    private collectAllUniqueTags(): string[] {
        const tagNames = new Set<string>();
        document
            .querySelectorAll(".custom-tag-link:not([style*='pointer-events: none'])")
            .forEach((el: Element) => {
                const name = el.textContent?.trim() || '';
                if (name && name !== '\u2014') {
                    tagNames.add(name);
                }
            });
        return [...tagNames].sort();
    }

    /**
     * 收集每个标签的出现次数（对应原 L684-697）。
     * 占位符被选择器排除。
     *
     * @returns 标签名→计数映射
     */
    private collectTagCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        document
            .querySelectorAll(".custom-tag-link:not([style*='pointer-events: none'])")
            .forEach((el: Element) => {
                const name = el.textContent?.trim() || '';
                if (name && name !== '\u2014') {
                    counts[name] = (counts[name] || 0) + 1;
                }
            });
        return counts;
    }

    /**
     * 计算无标签的卡片数（对应原 L700-709）。
     * 占位符被选择器排除，仅有占位符的卡片计为无标签。
     *
     * @returns 无标签的卡片数
     */
    private countNoTagItems(): number {
        let count = 0;
        document.querySelectorAll('.item').forEach((item: Element) => {
            const links = item.querySelectorAll(
                ".custom-tag-link:not([style*='pointer-events: none'])"
            );
            if (links.length === 0) count++;
        });
        return count;
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
            console.error('获取标签数据失败:', err);
            this.tagsCache = {}; // 失败时设空对象，避免后续报错
            return;
        }

        // 为每个卡片添加标签
        items.forEach((item: Element) => this.addTagDisplay(item));

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
                console.error('[视频清单标签] 获取新增标签数据失败:', err);
                return;
            }

            // 移除旧占位容器，用完整数据重新渲染这些卡片
            itemsToRefresh.forEach((item: Element) => {
                const oldContainer = item.querySelector('.custom-tags-display');
                if (oldContainer) oldContainer.remove();
                this.addTagDisplay(item);
            });

            this.updateFilterBar();
            console.log(`[视频清单标签] 已为 ${uncachedCodes.length} 个新番号获取标签`);
        }, this.DEBOUNCE_MS);
    }

    // ==================== 自动刷新监听 ====================

    /**
     * 设置跨脚本跨标签页联动监听（对应原 L1189-1282）。
     *
     * 三重监听机制（与 listsOptionSync 的三重广播对应）：
     * 1. CustomEvent 'jdb:sync-complete' —— 跨脚本同页面（即时）
     * 2. window 'storage' 事件 —— 跨脚本跨标签页（localStorage）
     * 3. GM_addValueChangeListener —— 同脚本跨标签页（GM 原生通道，兜底）
     *
     * 收到同步事件后，handleSyncNotify 做以下过滤：
     * - autoRefreshEnabled 关闭 → 跳过
     * - payload 无 designation → 跳过
     * - association 为 existed/limit_exceeded/unchanged → 标签不变，跳过
     * - 距上次刷新 < 500ms → 防抖跳过
     * 全部通过后调用 onSync(payload)，由调用方决定如何刷新
     * （通常传入 `(payload) => this.refreshDesignation(payload.designation)`）。
     *
     * @param onSync 同步事件回调（payload 包含 designation/action/association/time）
     */
    setupAutoRefreshListener(onSync: (payload: any) => void): void {
        let lastRefreshTime = 0;
        const DEBOUNCE_MS = 500; // 500ms 内不重复刷新

        // 服务器返回的「未变更」类 association —— 标签不会变化，跳过刷新
        const NO_CHANGE_ASSOCS = new Set(['existed', 'limit_exceeded', 'unchanged']);

        /** 处理同步通知，通过过滤后回调 onSync */
        const handleSyncNotify = (payload: any): void => {
            if (!this.autoRefreshEnabled) {
                console.log('[视频清单标签] 收到同步事件但自动刷新已关闭，跳过');
                return;
            }
            if (!payload || !payload.designation) {
                console.warn('[视频清单标签] 收到同步事件但无 designation:', payload);
                return;
            }
            if (NO_CHANGE_ASSOCS.has(payload.association)) {
                console.log(`[视频清单标签] association=${payload.association} 不影响标签，跳过`);
                return;
            }

            const now = Date.now();
            if (now - lastRefreshTime < DEBOUNCE_MS) {
                console.log(
                    `[视频清单标签] 距上次刷新 ${now - lastRefreshTime}ms < ${DEBOUNCE_MS}ms，防抖跳过`
                );
                return;
            }
            lastRefreshTime = now;

            console.log('[视频清单标签] 收到同步事件 → 精准刷新', payload);
            onSync(payload);
        };

        // 1) 跨脚本同页面（CustomEvent）
        document.addEventListener('jdb:sync-complete', (e: Event) => {
            console.log('[视频清单标签] [CustomEvent] 收到 jdb:sync-complete');
            handleSyncNotify((e as CustomEvent).detail);
        });

        // 2) 跨脚本跨标签页（localStorage storage 事件，只在其他标签页触发）
        window.addEventListener('storage', (e: StorageEvent) => {
            if (e.key !== LAST_SYNC_KEY) {
                return;
            }
            console.log(
                `[视频清单标签] [storage] key=${e.key} newValue=${e.newValue ? '<set>' : '<empty>'}`
            );
            if (!e.newValue) return;
            let payload: any;
            try {
                payload = JSON.parse(e.newValue);
            } catch {
                return;
            }
            handleSyncNotify(payload);
        });

        // 3) 同脚本跨标签页（GM 原生通道，兜底）
        GM_addValueChangeListener(
            LAST_SYNC_KEY,
            (_name: string, _oldValue: any, newValue: any, remote: boolean): void => {
                console.log(
                    `[视频清单标签] [GM_addValueChangeListener] remote=${remote} newValue=${newValue ? '<set>' : '<empty>'}`
                );
                if (!newValue) return;
                let payload: any;
                try {
                    payload = JSON.parse(newValue);
                } catch {
                    return;
                }
                handleSyncNotify(payload);
            }
        );

        console.log(
            `[视频清单标签] 自动刷新监听已就绪 (autoRefreshEnabled=${this.autoRefreshEnabled})`
        );
    }
}
