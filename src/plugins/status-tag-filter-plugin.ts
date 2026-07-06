/**
 * 状态标签筛选插件 StatusTagFilterPlugin —— 集成自
 * archetype/statusTagFilter.user.js
 * （原脚本整体 L1-280，独立油猴脚本 `JavDB 状态标签筛选` v1.0）。
 *
 * 功能：根据页面上 status-tag 文本内容动态生成筛选芯片，过滤显示视频卡片。
 * 收集 `.tag.is-success.status-tag` 文本及计数，生成芯片（含"无状态标签"芯片），
 * 点击芯片按 OR 逻辑筛选（命中任一选中标签即显示）；再次点击取消。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本用 GM_addStyle 注入 CSS，
 * 此处改走 initCss() 机制返回 CSS 字符串（项目既定模式）。
 *
 * === 与 jhs 主项目的兼容性（天然兼容，无需复杂协调） ===
 * jhs 的 ListPagePlugin.filterMovieList 注入 status-tag 的 class 为
 * `tag is-success status-tag`（见 StatusTagHtml 组件），与本脚本的选择器
 * `.tag.is-success.status-tag` 完全匹配——本脚本能正确读取 jhs 注入的标签。
 *
 * 显隐协同：jhs 用 `$item.hide().attr('data-hide', YES)` 控制显隐（设 display:none
 * + data-hide 属性），本脚本用 `item.style.display` + `data-status-tag-hidden`
 * 属性。
 *
 * === 深度协同安全（doc/48 增强）===
 * 原脚本协同安全依赖 `style.display === 'none'` 判断"被其他脚本隐藏"，但
 * style.display 在排序/筛选时序竞争中可能被临时清除/覆盖，导致判断失效、
 * 被屏蔽卡片被错误恢复显示。
 *
 * doc/48 把协同安全判断从"依赖易变的 style.display"升级为"依赖稳定的语义
 * 属性 data-hide"：直接检查卡片是否带 jhs 的 `data-hide` 属性（两种值：
 * "yes"=filterMovieList 屏蔽 / "<carNum>-hide"=showCarNumBox 临时隐藏），
 * 只要属性在就跳过——排序移动节点（同一引用）不会丢失属性，彻底消除时序竞争。
 *
 * 同时 collectStatusTagCounts / countNoStatusItems 也排除被 jhs 屏蔽的卡片，
 * 芯片计数只反映实际可见的卡片，避免计数失真。
 *
 * MutationObserver：jhs filterMovieList 的 hide/show 改 display 会触发本脚本
 * observer → updateFilterBar → applyFilter，但 applyFilter 的协同安全设计会
 * 跳过 jhs 隐藏的卡片，不会恢复它们；本脚本的 applyFilter 不改 jhs 隐藏的卡片
 * display，不会触发 jhs 的 observer——单向触发，不会死循环。
 *
 * autoPage 瀑布流：AutoPagePlugin append 新页 → 触发本脚本 observer →
 * updateFilterBar 刷新芯片计数 + 重新应用筛选——这是正确行为（新页加入后
 * 应刷新芯片）。
 *
 * 控制流保留要点：
 * 1. collectStatusTagCounts 收集 status-tag 文本→计数映射
 * 2. countNoStatusItems 计算无状态标签的卡片数
 * 3. applyFilter 协同安全：被其他脚本隐藏的卡片不纳入管理；OR 逻辑筛选
 * 4. createFilterChip 创建芯片（标签名+计数，点击 toggle active + applyFilter）
 * 5. doBuild 构建筛选栏（refreshChips 保留已激活状态）
 * 6. findMountTarget 按优先级查找挂载目标（tag-filter-bar → tabs → section）
 * 7. MutationObserver 监听新增 .item/status-tag（防抖 150ms 刷新）
 * 8. init 等待 document.body + tryBuild + startObserving（含 10s 超时兜底）
 */
import { BasePlugin } from './base-plugin';
import statusTagFilterCssRaw from '../styles/status-tag-filter-plugin.css?raw';

/** 日志前缀。 */
const LOG = '[状态标签筛选]';

/** 标记本脚本隐藏的卡片（与 jhs 的 data-hide 区分，协同安全设计）。 */
const HIDDEN_ATTR = 'data-status-tag-hidden';

/**
 * jhs 主项目的隐藏标记属性名。
 * jhs ListPagePlugin.filterMovieList 用 `$item.hide().attr('data-hide', YES)`
 * （值为 "yes"），showCarNumBox 用 `data-hide="<carNum>-hide"`（临时隐藏）。
 * 两种值都表示卡片被 jhs 隐藏，本脚本统一检查属性是否存在（不关心值）。
 */
const JHS_HIDE_ATTR = 'data-hide';

/** status-tag 选择器（与 jhs StatusTagHtml 生成的 class 一致）。 */
const STATUS_TAG_SELECTOR = '.item .tags.has-addons .tag.is-success.status-tag';

/** 无状态标签芯片的值。 */
const NO_TAG_VALUE = 'no-tag';

/**
 * 收集每个 status-tag 文本的出现次数。
 * 对应原 L40-52。
 *
 * doc/48 增强：排除被 jhs 屏蔽的卡片（带 data-hide 属性），
 * 芯片计数只反映实际可见的卡片，避免计数失真。
 *
 * @returns 标签文本→计数映射
 */
function collectStatusTagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    document.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
        // 向上查找最近的 .item 容器，跳过被 jhs 屏蔽的卡片
        const itemEl = el.closest('.item');
        if (itemEl && itemEl.hasAttribute(JHS_HIDE_ATTR)) return;
        const text = el.textContent?.trim() || '';
        if (text) {
            counts[text] = (counts[text] || 0) + 1;
        }
    });
    return counts;
}

/**
 * 计算无状态标签的卡片数。
 * 对应原 L57-66。
 *
 * doc/48 增强：排除被 jhs 屏蔽的卡片（带 data-hide 属性），
 * 计数只反映实际可见的卡片。
 *
 * @returns 无状态标签的卡片数
 */
function countNoStatusItems(): number {
    let count = 0;
    document.querySelectorAll('.item').forEach((item: Element) => {
        // 跳过被 jhs 屏蔽的卡片
        if (item.hasAttribute(JHS_HIDE_ATTR)) return;
        if (!item.querySelector(STATUS_TAG_SELECTOR)) {
            count++;
        }
    });
    return count;
}

/**
 * 状态标签筛选插件主类。
 *
 * 原脚本对应行号：L1-280（整体）。原脚本用 IIFE 闭包承载局部状态
 * （observerDebounce/observer），此处转为类私有字段。
 */
export class StatusTagFilterPlugin extends BasePlugin {
    /** MutationObserver 防抖计时器（监听 .item/status-tag 新增时防抖刷新）。 */
    private observerDebounce: ReturnType<typeof setTimeout> | null = null;
    /** 内容 MutationObserver（监听 .item/status-tag 新增）。 */
    private observer: MutationObserver | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "StatusTagFilterPlugin"
     */
    getName(): string {
        return 'StatusTagFilterPlugin';
    }

    /**
     * 注入筛选栏 + 芯片样式。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本用 GM_addStyle，此处走 initCss 机制返回 CSS 字符串。
     *
     * @returns status-tag-filter-plugin.css 全文
     */
    async initCss(): Promise<string> {
        return statusTagFilterCssRaw;
    }

    /**
     * 主处理：列表页时初始化筛选栏。对应原 L250-280 init()。
     *
     * 与 jhs 协调：仅 isListPage 时注入（非列表页无 .item，不注入）。
     * 原脚本 @include javdb*.com/* 所有页面，本项目在 handle() 内加守卫。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if (!(window as any).isListPage) return;
        this.init();
    }

    /**
     * 初始化：等待 document.body → tryBuild → startObserving。
     * 对应原 L250-280。含 10s 超时兜底（最终回退位置强行挂载）。
     */
    private init(): void {
        console.log(`${LOG} 初始化, pathname:`, window.location.pathname);

        if (!document.body) {
            console.warn(`${LOG} document.body 不存在，延后初始化`);
            setTimeout(() => this.init(), 100);
            return;
        }

        // 首次尝试构建筛选栏
        if (this.tryBuild()) {
            this.startObserving();
            return;
        }

        console.log(`${LOG} 未找到挂载目标，开始 MutationObserver 等待`);

        // 若挂载目标尚未渲染，通过防抖 MutationObserver 持续等待 DOM 变化
        let mountDebounce: ReturnType<typeof setTimeout> | null = null;
        const mountObserver = new MutationObserver(() => {
            if (mountDebounce) clearTimeout(mountDebounce);
            mountDebounce = setTimeout(() => {
                if (this.tryBuild()) {
                    console.log(`${LOG} MutationObserver 挂载成功`);
                    mountObserver.disconnect();
                    this.startObserving();
                    if (mountTimeout) clearTimeout(mountTimeout);
                }
            }, 100);
        });
        mountObserver.observe(document.body, { childList: true, subtree: true });

        // 超时兜底（10 秒后强制结束等待，用最终回退位置强行挂载）
        const mountTimeout = setTimeout(() => {
            mountObserver.disconnect();
            if (!document.querySelector('.status-tag-filter-bar')) {
                const fallback = this.findMountTarget() || document.body.firstElementChild;
                if (fallback) {
                    this.doBuild(fallback as Element);
                    this.startObserving();
                    console.warn(`${LOG} 通过最终回退挂载`, fallback);
                } else {
                    console.warn(`${LOG} 超时后仍无挂载目标`);
                }
            }
        }, 10000);
    }

    /**
     * 尝试构建筛选栏。对应原 L225-232。
     *
     * @returns 是否成功构建
     */
    private tryBuild(): boolean {
        if (document.querySelector('.status-tag-filter-bar')) return true;

        const mountTarget = this.findMountTarget();
        if (!mountTarget) return false;

        this.doBuild(mountTarget);
        return true;
    }

    /**
     * 按优先级依次查找可用的挂载目标。对应原 L197-220。
     *
     * @returns 挂载目标元素或 null
     */
    private findMountTarget(): Element | null {
        // 1) 优先挂在 videoListsTag 的 .tag-filter-bar 之后
        const tagFilterBar = document.querySelector('.tag-filter-bar');
        if (tagFilterBar) return tagFilterBar;

        // 2) 挂在页面默认 tabs 容器之后
        const isActorPage = /^\/actors\//.test(window.location.pathname);
        if (isActorPage) {
            const actorTags = document.querySelector('body > section > div > div.actor-tags.tags');
            if (actorTags) return actorTags;
        } else {
            const tabsBoxed = document.querySelector('body > section > div > div.tabs.is-boxed');
            if (tabsBoxed) return tabsBoxed;
        }

        // 3) 回退：挂在 section 容器的第一个子元素之前
        const section = document.querySelector('body > section > div > div');
        if (section && section.firstElementChild) {
            if (!section.firstElementChild.matches('.tag-filter-bar, .status-tag-filter-bar')) {
                return section.firstElementChild;
            }
        }

        // 4) 最终回退：挂在 body > section > div 的第一个子元素之前
        const container = document.querySelector('body > section > div');
        if (container && container.firstElementChild) {
            if (!container.firstElementChild.matches('.tag-filter-bar, .status-tag-filter-bar')) {
                return container.firstElementChild;
            }
        }

        return null;
    }

    /**
     * 构建筛选栏并插入到挂载目标之后。对应原 L150-195。
     * 内部定义 refreshChips（收集 status-tag 文本并重建芯片，保留已激活状态）。
     *
     * @param mountTarget 挂载参考元素
     */
    private doBuild(mountTarget: Element): void {
        if (document.querySelector('.status-tag-filter-bar')) return;

        const filterBar = document.createElement('div');
        filterBar.className = 'status-tag-filter-bar';

        // 标签
        const label = document.createElement('span');
        label.className = 'status-tag-filter-label';
        label.textContent = '\u72B6\u6001:'; // 状态:
        filterBar.appendChild(label);

        // 芯片容器
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'status-tag-filter-chips';
        filterBar.appendChild(chipsContainer);

        // 保存 refreshChips 引用以便后续更新（挂在 DOM 元素上，与原脚本一致）
        const refreshChips = (): void => {
            // 保存当前选中状态
            const activeValues = new Set(
                Array.from(chipsContainer.querySelectorAll('.status-tag-filter-chip.active')).map(
                    (c: Element) => (c as HTMLElement).dataset.value || ''
                )
            );

            chipsContainer.innerHTML = '';

            // "无状态标签" 芯片（始终在第一位，带计数）
            const noCount = countNoStatusItems();
            const noTagChip = this.createFilterChip('无状态标签', NO_TAG_VALUE, {
                isNoTag: true,
                count: noCount
            });
            if (activeValues.has(NO_TAG_VALUE)) noTagChip.classList.add('active');
            chipsContainer.appendChild(noTagChip);

            // 各状态标签芯片（根据页面实际内容动态生成，带计数）
            const allCounts = collectStatusTagCounts();
            const sortedTags = Object.keys(allCounts).sort();
            sortedTags.forEach((tagName: string) => {
                const chip = this.createFilterChip(tagName, tagName, {
                    count: allCounts[tagName]
                });
                if (activeValues.has(tagName)) chip.classList.add('active');
                chipsContainer.appendChild(chip);
            });
        };

        // 初始构建芯片
        refreshChips();

        // 插入到 DOM
        if (mountTarget.matches('.tag-filter-bar, .actor-tags.tags, .tabs.is-boxed')) {
            mountTarget.insertAdjacentElement('afterend', filterBar);
        } else {
            mountTarget.insertAdjacentElement('beforebegin', filterBar);
        }

        // 保存 refreshChips 引用以便后续更新（与原脚本 filterBar._refreshChips 一致）
        (filterBar as any)._refreshChips = refreshChips;

        console.log(`${LOG} 筛选栏已挂载`);
    }

    /**
     * 创建单个筛选芯片。对应原 L130-145。
     *
     * @param labelText 芯片文本
     * @param value 芯片值（标签文本或 'no-tag'）
     * @param opts 选项（isNoTag/count）
     * @returns 芯片 span 元素
     */
    private createFilterChip(
        labelText: string,
        value: string,
        opts: { isNoTag?: boolean; count?: number } = {}
    ): HTMLSpanElement {
        const { isNoTag = false, count } = opts;
        const chip = document.createElement('span');
        chip.className = 'status-tag-filter-chip';
        if (isNoTag) chip.classList.add('no-status');
        // 芯片文本：标签名 + 计数（如 "⭐ 已收藏 12"）
        chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
        chip.dataset.value = value;

        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            this.applyFilter();
        });

        return chip;
    }

    /**
     * 应用筛选：根据当前激活的芯片显示/隐藏 .item 元素。对应原 L75-120。
     *
     * 协同安全（与 jhs 兼容的关键）：
     * - 被其他脚本隐藏的卡片（display:none 且无 data-status-tag-hidden）不纳入管理
     * - jhs 用 jQuery .hide() + data-hide 属性隐藏卡片，本脚本识别为"被其他脚本隐藏"并跳过
     *
     * 筛选逻辑：
     * - 无激活芯片：仅恢复本脚本隐藏的卡片（不触碰其他脚本已隐藏的）
     * - 激活"无状态标签"芯片：仅显示无任何状态标签的项
     * - 激活其他芯片：OR 逻辑，命中任一选中标签即显示
     */
    private applyFilter(): void {
        const activeChips = document.querySelectorAll('.status-tag-filter-chip.active');
        const selectedValues = new Set(
            Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
        );

        // 无筛选时：仅恢复本脚本隐藏的卡片，不清除其他脚本的隐藏
        // doc/48 增强：恢复时检查 data-hide，避免恢复被 jhs 屏蔽的卡片
        if (selectedValues.size === 0) {
            document.querySelectorAll(`.item[${HIDDEN_ATTR}]`).forEach((item: Element) => {
                const htmlItem = item as HTMLElement;
                // 被jhs 屏蔽的卡片不恢复显示（保持隐藏）
                if (htmlItem.hasAttribute(JHS_HIDE_ATTR)) return;
                htmlItem.removeAttribute(HIDDEN_ATTR);
                htmlItem.style.display = '';
            });
            return;
        }

        const showNoTag = selectedValues.has(NO_TAG_VALUE);
        const selectedTags = new Set([...selectedValues].filter((v) => v !== NO_TAG_VALUE));

        document.querySelectorAll('.item').forEach((item: Element) => {
            const htmlItem = item as HTMLElement;
            // 协同安全（doc/48 增强）：被 jhs 屏蔽的卡片不纳入管理。
            // 优先检查稳定的语义属性 data-hide（jhs 两种隐藏标记：
            // "yes"=filterMovieList 屏蔽 / "<carNum>-hide"=showCarNumBox 临时隐藏），
            // 而非易变的 style.display——排序/筛选时序竞争中 style.display 可能
            // 被临时清除/覆盖，但 data-hide 属性在同一节点引用上不会丢失
            // （jQuery empty+append 移动节点不丢属性）。同时保留 style.display
            // 检查作为兼底（兼容未知脚本的隐藏）。
            const hiddenByJhs = htmlItem.hasAttribute(JHS_HIDE_ATTR);
            const hiddenByOther =
                htmlItem.style.display === 'none' && !htmlItem.hasAttribute(HIDDEN_ATTR);
            if (hiddenByJhs || hiddenByOther) return;

            // 收集当前卡片内所有 status-tag 的文本
            const itemStatusTags = new Set<string>();
            item.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
                const text = el.textContent?.trim() || '';
                if (text) itemStatusTags.add(text);
            });

            // 标签匹配：命中任一选定标签即显示（OR 逻辑）
            let tagMatch = false;
            if (selectedTags.size > 0) {
                tagMatch = [...selectedTags].some((t) => itemStatusTags.has(t));
            }

            // 无标签条件独立判断，与标签匹配用 OR 连接
            const noTagMatch = showNoTag && itemStatusTags.size === 0;

            const shouldShow = tagMatch || noTagMatch;

            if (shouldShow) {
                htmlItem.removeAttribute(HIDDEN_ATTR);
                htmlItem.style.display = '';
            } else {
                htmlItem.setAttribute(HIDDEN_ATTR, '');
                htmlItem.style.display = 'none';
            }
        });
    }

    /**
     * 刷新筛选器：更新芯片列表并重新应用筛选。对应原 L234-240。
     */
    private updateFilterBar(): void {
        const filterBar = document.querySelector('.status-tag-filter-bar');
        if (filterBar && (filterBar as any)._refreshChips) {
            (filterBar as any)._refreshChips();
            this.applyFilter();
        }
    }

    /**
     * 启动内容 MutationObserver：监听新增 .item 及 status-tag 注入（jhs 异步添加）。
     * 对应原 L243-261。防抖 150ms 后刷新筛选器。
     */
    private startObserving(): void {
        this.observer = new MutationObserver((mutations: MutationRecord[]) => {
            let shouldRefresh = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const el = node as Element;
                    if (
                        el.matches?.('.item') ||
                        el.querySelectorAll?.('.item').length > 0 ||
                        el.matches?.('.tag.is-success.status-tag') ||
                        el.querySelectorAll?.('.tag.is-success.status-tag').length > 0
                    ) {
                        shouldRefresh = true;
                        break;
                    }
                }
                if (shouldRefresh) break;
            }

            if (shouldRefresh) {
                if (this.observerDebounce) clearTimeout(this.observerDebounce);
                this.observerDebounce = setTimeout(() => {
                    this.updateFilterBar();
                }, 150);
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
