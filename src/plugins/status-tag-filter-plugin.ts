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
 * 6. findMountTarget 按优先级查找挂载目标（jhs-vlt-filter-bar → tabs → section）
 * 7. MutationObserver 监听新增 .item/status-tag（防抖 150ms 刷新）
 * 8. init 等待 document.body + tryBuild + startObserving（含 10s 超时兜底）
 *
 * 方法组已拆分至 ./status-tag-filter/ 子目录：
 *   stf-collect.ts — collectStatusTagCounts / countNoStatusItems
 *   stf-apply.ts   — applyFilter
 *   stf-ui.ts      — createFilterChip / doBuild / findMountTarget
 * 本类保留同名薄委托方法，内部调用点签名不变。
 */
import type { PageType } from '../core/page-context';
import { TaskSupervisor } from '../core/task-supervisor';

import { BasePlugin } from './base-plugin';
import { applyFilter } from './status-tag-filter/stf-apply';
import { doBuild, findMountTarget, LOG } from './status-tag-filter/stf-ui';

import statusTagFilterCssRaw from '../styles/status-tag-filter-plugin.css?raw';

/**
 * 状态标签筛选插件主类。
 *
 * 原脚本对应行号：L1-280（整体）。原脚本用 IIFE 闭包承载局部状态
 * （observerDebounce/observer），此处转为类私有字段。
 */
export class StatusTagFilterPlugin extends BasePlugin {
    /** MutationObserver 防抖计时器（监听 .item/status-tag 新增时防抖刷新）。 */
    private observerDebounce = 0;
    /** 统一生命周期管理器。 */
    private supervisor = new TaskSupervisor();

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "StatusTagFilterPlugin"
     */
    getName(): string {
        return 'StatusTagFilterPlugin';
    }

    /** 仅在列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['list'];
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
        if (!window.isListPage) return;
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
            this.supervisor.setTimeout(() => this.init(), 100);
            return;
        }

        // 首次尝试构建筛选栏
        if (this.tryBuild()) {
            this.startObserving();
            return;
        }

        console.log(`${LOG} 未找到挂载目标，开始 MutationObserver 等待`);

        // 若挂载目标尚未渲染，通过防抖 MutationObserver 持续等待 DOM 变化
        let mountDebounce = 0;
        const mountObserver = this.supervisor.observe(document.body, () => {
            clearTimeout(mountDebounce);
            mountDebounce = this.supervisor.setTimeout(() => {
                if (this.tryBuild()) {
                    console.log(`${LOG} MutationObserver 挂载成功`);
                    mountObserver.disconnect();
                    this.startObserving();
                    clearTimeout(mountTimeout);
                }
            }, 100);
        }, { childList: true, subtree: true });

        // 超时兜底（10 秒后强制结束等待，用最终回退位置强行挂载）
        const mountTimeout = this.supervisor.setTimeout(() => {
            mountObserver.disconnect();
            if (!document.querySelector('.status-tag-filter-bar')) {
                const fallback = findMountTarget() || document.body.firstElementChild;
                if (fallback) {
                    doBuild(fallback as Element);
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

        const mountTarget = findMountTarget();
        if (!mountTarget) return false;

        doBuild(mountTarget);
        return true;
    }

    /**
     * 刷新筛选器：更新芯片列表并重新应用筛选。对应原 L234-240。
     */
    private updateFilterBar(): void {
        const filterBar = document.querySelector('.status-tag-filter-bar');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM augmentation: reading stored function ref
        if (filterBar && (filterBar as any)._refreshChips) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM augmentation: calling stored function ref
            (filterBar as any)._refreshChips();
            applyFilter();
        }
    }

    /**
     * 启动内容 MutationObserver：监听新增 .item 及 status-tag 注入（jhs 异步添加）。
     * 对应原 L243-261。防抖 150ms 后刷新筛选器。
     */
    private startObserving(): void {
        this.supervisor.observe(document.body, (mutations: MutationRecord[]) => {
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
                clearTimeout(this.observerDebounce);
                this.observerDebounce = this.supervisor.setTimeout(() => {
                    this.updateFilterBar();
                }, 150);
            }
        }, { childList: true, subtree: true });
    }

    /** 销毁插件：一次性清理所有 supervisor 管理的资源。 */
    destroy(): void {
        this.supervisor.abort();
    }
}
