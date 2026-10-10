/**
 * MissAV 状态标签筛选插件 MissavStatusFilterPlugin —— 与 javdb StatusTagFilterPlugin
 * 同源的 MissAV 版状态筛选。
 *
 * 功能：根据 MissAVStatusTagPlugin 注入的 `.missav-status-tag` 标签（data-status 属性）
 * 动态生成筛选芯片，过滤显示视频卡片（`.thumbnail.group`）。收集各状态标签计数
 * （mstf-collect），点击芯片按 OR 逻辑筛选（mstf-apply），再次点击取消；
 * 无标签卡片走「无状态标签」芯片（no-tag 变体）。
 *
 * 挂载点：grid 上方的原生「过滤: 所有」行（`div.flex.justify-between.mb-6`），
 * 缺失时回退到 h1 或缩略图容器父链（Camoufox 实测）。
 *
 * 生命周期：TaskSupervisor 统一管理 observer 与防抖定时器；destroy() 一次性清理。
 * 无 pageTypes 覆写：isMissavSite 站点注册即激活（与 MissavAutoPagePlugin 一致），
 * 视频播放页由 isVideoPage() 守卫跳过。
 */
import { TaskSupervisor } from '../../core/task-supervisor';

import { BasePlugin } from '../base-plugin';
import { isVideoPage } from '../car-status-sync/missav-renderer';
import { isVideoDetailPath } from '../../core/util/site/missav-paths';
import { NO_TAG_VALUE, STATUS_ORDER, collectStatusCounts, statusToLabel } from './mstf-collect';
import { applyFilter } from './mstf-apply';

import missavStatusFilterCssRaw from '../../styles/missav-status-filter/missav-status-filter.css?raw';

/** 挂载点：grid 上方的原生「过滤: 所有」行（Camoufox 实测）。 */
const MOUNT_SELECTOR = 'div.flex.justify-between.mb-6';

/**
 * MissAV 状态标签筛选插件主类。
 */
export class MissavStatusFilterPlugin extends BasePlugin {
    /** 统一生命周期管理器：observer 与防抖定时器注册与清理。 */
    private supervisor = new TaskSupervisor();
    /** MutationObserver 防抖计时器（监听 status-tag 变化时防抖刷新）。 */
    private observerDebounce = 0;
    /** 筛选栏容器引用（applyActiveFilter / observer 回调共用）。 */
    private filterBar: HTMLDivElement | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "MissavStatusFilterPlugin"
     */
    getName(): string {
        return 'MissavStatusFilterPlugin';
    }

    /**
     * 注入筛选栏 + 芯片样式。由 PluginManager.processCss 在 handle 之前调用。
     * 基础布局样式由 filter-chip-base.css 顶层注入，此处仅返回 active 配色
     * 与 no-tag 变体。
     *
     * @returns missav-status-filter.css 全文
     */
    async initCss(): Promise<string> {
        return missavStatusFilterCssRaw;
    }

    /**
     * 主处理：非视频播放页时尝试构建筛选栏并启动 MutationObserver。
     * 视频页判定用 URL 特征（#sprite-plyr 延迟渲染致 isVideoPage() 时序不可靠，doc/227）。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if (isVideoPage() || isVideoDetailPath(location.pathname)) return;
        this.tryBuild();
        this.startObserving();
    }

    /**
     * 尝试构建筛选栏。挂载点按优先级：原生「过滤: 所有」行 → h1 → 缩略图容器父链。
     *
     * @returns 是否已存在筛选栏或构建成功
     */
    private tryBuild(): boolean {
        if (document.querySelector('.missav-status-filter-bar')) return true;
        const mount = document.querySelector(MOUNT_SELECTOR)
            ?? document.querySelector('h1')
            ?? document.querySelector('.thumbnail.group')?.parentElement?.parentElement;
        if (!mount) return false;
        this.buildFilterBar(mount);
        return true;
    }

    /**
     * 构建筛选栏：标签 + 芯片容器，挂载到 mount 之后，并绑定芯片点击委托。
     * 点击委托绑定在 chips 容器上，renderChips 重建芯片后仍有效。
     *
     * @param mount 挂载目标元素
     */
    private buildFilterBar(mount: Element): void {
        const bar = document.createElement('div');
        bar.className = 'missav-status-filter-bar';
        const label = document.createElement('span');
        label.className = 'missav-status-filter-label';
        label.textContent = '状态:';
        const chips = document.createElement('div');
        chips.className = 'missav-status-filter-chips';
        bar.append(label, chips);
        mount.insertAdjacentElement('afterend', bar);
        this.filterBar = bar;
        this.renderChips(chips);
        // 芯片点击 → 重应用
        chips.addEventListener('click', (e) => {
            const chip = (e.target as HTMLElement).closest?.('.missav-status-filter-chip');
            if (chip) {
                chip.classList.toggle('active');
                this.applyActiveFilter();
            }
        });
    }

    /**
     * 重建芯片列表。先读取当前 chips 容器的 active 状态（data-value），
     * 再按最新计数渲染，重建后恢复 active（保留筛选态）。
     *
     * @param chips 芯片容器
     */
    private renderChips(chips: HTMLDivElement): void {
        const active = new Set(
            Array.from(chips.querySelectorAll('.missav-status-filter-chip.active')).map(
                (c) => (c as HTMLElement).dataset.value || ''
            )
        );
        chips.innerHTML = '';
        const counts = collectStatusCounts();
        // 遍历原始 status key（STATUS_ORDER），计数键为 label（collectStatusCounts
        // 按显示名聚合）；dataset.value 必须存原始 key 供 applyFilter 匹配（审查修复 1）。
        const ordered = [...STATUS_ORDER, ...(counts[NO_TAG_VALUE] ? [NO_TAG_VALUE] : [])];
        for (const status of ordered) {
            const label = statusToLabel(status);
            const c = counts[label] ?? 0;
            if (c === 0) continue;
            const chip = document.createElement('span');
            chip.className = 'missav-status-filter-chip';
            if (status === NO_TAG_VALUE) chip.classList.add('no-status');
            chip.textContent = status === NO_TAG_VALUE ? `无状态标签 ${c}` : `${label} ${c}`;
            chip.dataset.value = status;
            if (active.has(status)) chip.classList.add('active');
            chips.appendChild(chip);
        }
    }

    /**
     * 收集当前 active 芯片值并委托 mstf-apply 应用筛选（OR 逻辑）。
     */
    private applyActiveFilter(): void {
        if (!this.filterBar) return;
        const chips = this.filterBar.querySelector('.missav-status-filter-chips');
        const active = new Set(
            Array.from(chips?.querySelectorAll('.missav-status-filter-chip.active') ?? []).map(
                (c) => (c as HTMLElement).dataset.value || ''
            )
        );
        applyFilter(active);
    }

    /**
     * 启动 MutationObserver：监听 .thumbnail.group 的 data-status 属性变化
     * （MissAVStatusTagPlugin 异步注入标签）与子节点增删。回调先经门控过滤
     * （observerNeedsRefresh），仅网格/状态标签相关变更才防抖 150ms 后
     * 先取 active 再重建芯片 + 重应用筛选；chips 容器自身重建不触发，避免自刷新死循环。
     */
    private startObserving(): void {
        this.supervisor.observe(document.body, (mutations) => {
            // 门控：仅当变更涉及缩略图/状态标签（新增节点匹配/包含，或 data-status
            // 属性变更）才刷新；chips 子节点重建不命中，杜绝自触发循环（审查修复 2）。
            if (!this.observerNeedsRefresh(mutations)) return;
            // 挂载点迟到：先尝试构建筛选栏（tryBuild 幂等），失败由后续批次重试（审查修复 3）。
            if (!this.filterBar) this.tryBuild();
            clearTimeout(this.observerDebounce);
            this.observerDebounce = this.supervisor.setTimeout(() => {
                const bar = this.filterBar;
                if (!bar) return;
                const chips = bar.querySelector<HTMLDivElement>('.missav-status-filter-chips');
                if (chips) {
                    const active = new Set(
                        Array.from(chips.querySelectorAll('.missav-status-filter-chip.active')).map(
                            (c) => (c as HTMLElement).dataset.value || ''
                        )
                    );
                    this.renderChips(chips);
                    applyFilter(active);
                }
            }, 150);
        }, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
    }

    /**
     * 观察器门控：判断 mutation 批次是否与网格/状态标签相关。
     * childList：新增节点匹配或包含 .thumbnail.group / .missav-status-tag；
     * attributes：data-status 属性变更。chips 子节点重建不命中。
     *
     * @param mutations observer 回调收到的变更批次
     * @returns 是否需要刷新筛选栏
     */
    private observerNeedsRefresh(mutations: MutationRecord[]): boolean {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-status') {
                return true;
            }
            if (mutation.type !== 'childList') continue;
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = node as HTMLElement;
                if (
                    el.matches?.('.thumbnail.group, .missav-status-tag') ||
                    el.querySelector?.('.thumbnail.group, .missav-status-tag')
                ) {
                    return true;
                }
            }
            // 删除节点同样需刷新（上游 renderBadges 状态清除时移除旧徽章）
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = node as HTMLElement;
                if (
                    el.matches?.('.thumbnail.group, .missav-status-tag') ||
                    el.querySelector?.('.thumbnail.group, .missav-status-tag')
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 销毁插件：一次性清理所有 supervisor 管理的资源。 */
    destroy(): void {
        this.supervisor.abort();
    }
}