/**
 * 内容排序插件 PageSortPlugin —— 集成自 archetype/pageSort.user.js
 * （原脚本整体 L1-190，独立油猴脚本 `Javdb 内容排序` v1.0）。
 *
 * 功能：对 Javdb 的单页内容排序（按名称升序/降序、按评分升序/降序）。
 * 在工具栏注入排序按钮组，点击切换排序方式；再次点击已选中项恢复原始顺序。
 * 排序守卫（MutationObserver）监听 DOM 顺序是否被外部修改，自动重新应用排序。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本无 GM_* API、无数据源、无网络请求，
 * 纯 DOM + jQuery 操作。原脚本 `@require jquery@4.0.0`，本项目已 ESM import
 * jquery 3.7.1 并挂全局（libs.ts），API 兼容，直接复用全局 $，无需 @require。
 *
 * 原脚本 injectSortStyles() 用 document.createElement('style') 注入 CSS，
 * 此处改走 initCss() 机制返回 CSS 字符串（项目既定模式，替代 GM_addStyle / 手动
 * createElement）。CSS 提取到 src/styles/page-sort-plugin.css。
 *
 * 原脚本 `@run-at document-end` + waitForContainer()，本项目 @run-at document-idle
 * + processPlugins() 在页面加载后执行，且保留 waitForContainer() 等待容器就绪。
 *
 * 控制流保留要点：
 * 1. SORT_CONFIGS 单一数据源：按钮文本 + 排序函数，新增排序方式只需追加一条
 * 2. data-sort-original-index 标记原始位置，用于恢复原始顺序
 * 3. applySort 重入守卫（isApplyingSort），防止守卫自己触发自己
 * 4. sortGuard.takeRecords() 清空 append 产生的 mutation 记录，防止微任务触发误判
 * 5. MutationObserver 监听 childList，外部修改顺序时自动重新应用（重试上限 5 次）
 * 6. 再次点击已选中项取消选中并恢复原始顺序
 * 7. waitForContainer 用 MutationObserver 等待 body > section > div 出现
 */
import { BasePlugin } from './base-plugin';
import pageSortCssRaw from '../styles/page-sort-plugin.css?raw';

/** 日志前缀。 */
const LOG = '[pageSort]';

/** 排序方式配置（单一数据源：按钮文本 + 排序函数）。 */
interface SortConfig {
    /** 按钮文本（同时作为排序方式标识）。 */
    label: string;
    /** 排序函数：原地排序 items 数组。 */
    sortFn: (items: HTMLElement[]) => HTMLElement[];
    /** 是否已实现（未实现时跳过，仅日志记录）。 */
    implemented: boolean;
}

/**
 * 排序比较函数（番号对比）。
 * 从 item 的 `a > div.video-title > strong` 提取文本，localeCompare 对比。
 *
 * @param $itemA jQuery 包装的 item A
 * @param $itemB jQuery 包装的 item B
 * @returns 负/零/正
 */
function compareItems($itemA: any, $itemB: any): number {
    const getStrongText = ($item: any): string => {
        const $strong = $item.find('a > div.video-title > strong');
        return $strong.length ? $strong.text().trim() : '';
    };
    const textA = getStrongText($itemA);
    const textB = getStrongText($itemB);
    return textA.localeCompare(textB);
}

/**
 * 从 item 节点提取评分。
 * 解析 `a > div.score > span` 中的浮点数。
 *
 * @param $item jQuery 包装的 item
 * @returns 评分浮点数；无评分返回 0
 */
function getScore($item: any): number {
    const $span = $item.find('a > div.score > span');
    if (!$span.length) return 0;
    const text = $span.text().trim();
    const match = text.match(/(\d+\.\d+)/);
    if (!match) return 0;
    return parseFloat(match[1]) || 0;
}

/**
 * 创建排序按钮 span 元素。
 *
 * @param text 按钮文本
 * @returns jQuery 包装的 span.button.is-small
 */
function newOption(text: string): any {
    return $('<span>', {
        text: text,
        class: 'button is-small'
    });
}

/** 排序配置表。新增排序方式只需在此数组追加一条，按钮和排序逻辑自动同步。 */
const SORT_CONFIGS: SortConfig[] = [
    {
        label: '按照名称升序',
        sortFn: (items) => items.sort((a, b) => compareItems($(a), $(b))),
        implemented: true
    },
    {
        label: '按照名称降序',
        sortFn: (items) => items.sort((a, b) => compareItems($(b), $(a))),
        implemented: true
    },
    {
        label: '按照评分升序',
        sortFn: (items) => items.sort((a, b) => getScore($(a)) - getScore($(b))),
        implemented: true
    },
    {
        label: '按照评分降序',
        sortFn: (items) => items.sort((a, b) => getScore($(b)) - getScore($(a))),
        implemented: true
    }
];

/**
 * 内容排序插件主类。
 *
 * 原脚本对应行号：L1-190（整体）。原脚本用 IIFE 闭包承载局部状态
 * （activeSort/isApplyingSort/sortGuardRetries/sortGuard/$container），此处转为类私有字段。
 */
export class PageSortPlugin extends BasePlugin {
    /** 视频列表容器（createSortSelector 时查询，applySort 重查询其子项）。 */
    private $container: any = null;
    /** 当前激活的排序方式（null = 原始顺序）。 */
    private activeSort: string | null = null;
    /** 守卫：防止排序守卫自己触发自己。 */
    private isApplyingSort = false;
    /** 安全计数器，防止极端情况死循环。 */
    private sortGuardRetries = 0;
    /** 守卫重试上限。 */
    private readonly MAX_GUARD_RETRIES = 5;
    /** 排序守卫：监听页面是否把顺序改了回来。 */
    private sortGuard: MutationObserver | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "PageSortPlugin"
     */
    getName(): string {
        return 'PageSortPlugin';
    }

    /**
     * 注入排序按钮选中态样式。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本 injectSortStyles() 用 document.createElement('style')，此处走 initCss
     * 机制返回 CSS 字符串。
     *
     * @returns page-sort-plugin.css 全文
     */
    async initCss(): Promise<string> {
        return pageSortCssRaw;
    }

    /**
     * 主处理：等待页面容器出现后注入排序选择器。对应原 L178-190 + waitForContainer。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        this.waitForContainer();
    }

    /**
     * 等待页面容器出现后注入排序选择器。对应原 L179-190。
     * 用 MutationObserver 监听 body 子树变化，`body > section > div` 出现后触发。
     */
    private waitForContainer(): void {
        console.log(`${LOG} 等待页面容器加载...`);
        const observer = new MutationObserver((_mutations: MutationRecord[], obs: MutationObserver) => {
            const $container = $('body > section > div');
            if ($container.length) {
                obs.disconnect();
                console.log(`${LOG} 页面容器已就绪，开始注入排序选择器`);
                this.createSortSelector();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * 创建排序选择器：查找工具栏/列表容器、标记原始位置、构建按钮组、注册事件。
     * 对应原 L48-176。
     */
    private createSortSelector(): void {
        const $toolbar = $('body > section > div > div.toolbar');
        if (!$toolbar.length) {
            console.warn(`${LOG} 未找到工具栏 .toolbar，跳过排序选择器注入`);
            return;
        }
        const $container = $(
            'body > section > div > div.movie-list.h.cols-4.vcols-8'
        );
        if (!$container.length) {
            console.warn(`${LOG} 未找到视频列表容器 .movie-list，跳过排序选择器注入`);
            return;
        }
        this.$container = $container;

        const $items = $container.children('.item');
        if ($items.length === 0) {
            console.warn(`${LOG} 视频列表为空，跳过排序选择器注入`);
            return;
        }

        // 给每个节点打上原始位置标记（用于恢复原始顺序）
        $items.each(function (this: HTMLElement, i: number) {
            this.setAttribute('data-sort-original-index', String(i));
        });

        // 排序守卫：监听页面是否把顺序改了回来
        const sortGuard = new MutationObserver(() => {
            if (this.activeSort && !this.isApplyingSort) {
                if (this.sortGuardRetries >= this.MAX_GUARD_RETRIES) {
                    console.warn(
                        `${LOG} 排序守卫重试已达上限 (${this.MAX_GUARD_RETRIES})，放弃自动恢复`
                    );
                    return;
                }
                this.sortGuardRetries++;
                console.log(
                    `${LOG} 检测到 DOM 顺序被外部修改，重新应用排序 (${this.sortGuardRetries}/${this.MAX_GUARD_RETRIES})`
                );
                this.applySort(this.activeSort);
            }
        });
        this.sortGuard = sortGuard;
        sortGuard.observe($container[0], { childList: true });

        // 构建排序按钮组
        const $buttonGroup = $('<div>', {
            css: {
                display: 'inline-block',
                marginBottom: '.1rem',
                lineHeight: '2.2rem',
                marginRight: '.4rem',
                marginLeft: 'auto'
            }
        });
        const $buttons = $('<div>', {
            class: 'buttons has-addons'
        });
        $buttonGroup.append($buttons);
        $toolbar.append($buttonGroup);

        // 从配置表遍历创建排序选项按钮
        SORT_CONFIGS.forEach((config: SortConfig) => {
            $buttons.append(newOption(config.label));
        });

        // 事件委托：处理排序按钮点击（用箭头函数保留 this 为类实例）
        $buttons.on('click', '.button.is-small', (e: any) => {
            e.preventDefault();
            e.stopPropagation();

            const $this = $(e.currentTarget);
            const isActive = $this.hasClass('selected-method');

            // 用户手动操作，重置守卫重试计数器
            this.sortGuardRetries = 0;

            if (isActive) {
                // 再次点击已选中项：取消选中并恢复原始顺序
                $this.removeClass('selected-method');
                this.activeSort = null;
                this.applySort(null);
            } else {
                // 移除其他按钮的选中状态
                $this.siblings('.selected-method').removeClass('selected-method');
                // 设置当前按钮为选中态
                $this.addClass('selected-method');
                const method = $this.text();
                this.activeSort = method;
                this.applySort(method);
            }
        });

        console.log(`${LOG} 排序选择器已注入，共 ${$items.length} 个影片`);
    }

    /**
     * 执行排序（统一的排序入口）。对应原 L97-135。
     * 重查询当前 DOM 中的节点（防止节点被替换后引用失效），按 sortMethod 排序后
     * append 回容器；清空 takeRecords 防止微任务触发守卫误判。
     *
     * @param sortMethod 排序方式（SORT_CONFIGS 中的 label），null 表示恢复原始顺序
     */
    private applySort(sortMethod: string | null): void {
        if (this.isApplyingSort) return;
        this.isApplyingSort = true;

        // 重新查询当前 DOM 中的节点（防止节点被替换后引用失效）
        const currentItems: HTMLElement[] = this.$container.children('.item').get();
        if (currentItems.length === 0) {
            this.isApplyingSort = false;
            return;
        }

        if (sortMethod === null) {
            // 恢复原始顺序（无需查配置表）
            currentItems.sort((a: HTMLElement, b: HTMLElement) => {
                const ai = parseInt(a.getAttribute('data-sort-original-index') || '0') || 0;
                const bi = parseInt(b.getAttribute('data-sort-original-index') || '0') || 0;
                return ai - bi;
            });
            this.$container.append(currentItems);
            console.log(`${LOG} 已恢复原始顺序`);
        } else {
            // 从配置表查找对应的排序函数
            const config = SORT_CONFIGS.find((c: SortConfig) => c.label === sortMethod);
            if (!config) {
                console.warn(`${LOG} 未识别的排序选项: ${sortMethod}`);
                this.isApplyingSort = false;
                return;
            }
            if (!config.implemented || !config.sortFn) {
                console.log(`${LOG} ${sortMethod} - 待实现`);
                this.isApplyingSort = false;
                return;
            }
            config.sortFn(currentItems);
            this.$container.append(currentItems);
            console.log(`${LOG} 已${sortMethod}排列 ${currentItems.length} 个影片`);
        }

        // 关键：清空 append 产生的 mutation 记录，防止微任务触发守卫误判
        this.sortGuard?.takeRecords();

        this.isApplyingSort = false;
    }
}
