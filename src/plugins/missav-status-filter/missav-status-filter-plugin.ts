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
     * 与 MissavAutoPagePlugin 一致，视频页（detected by #sprite-plyr）不启用。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if (isVideoPage()) return;
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
        const ordered = [...STATUS_ORDER.map(statusToLabel), ...(counts[NO_TAG_VALUE] ? [NO_TAG_VALUE] : [])];
        for (const name of ordered) {
            const c = counts[name] ?? 0;
            if (c === 0) continue;
            const chip = document.createElement('span');
            chip.className = 'missav-status-filter-chip';
            if (name === NO_TAG_VALUE) chip.classList.add('no-status');
            chip.textContent = name === NO_TAG_VALUE ? `无状态标签 ${c}` : `${name} ${c}`;
            chip.dataset.value = name;
            if (active.has(name)) chip.classList.add('active');
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
     * （MissAVStatusTagPlugin 异步注入标签）与子节点增删。防抖 150ms 后
     * 先取 active 再重建芯片 + 重应用筛选。
     */
    private startObserving(): void {
        this.supervisor.observe(document.body, () => {
            clearTimeout(this.observerDebounce);
            this.observerDebounce = this.supervisor.setTimeout(() => {
                if (!this.filterBar) return;
                const chips = this.filterBar.querySelector('.missav-status-filter-chips');
                if (chips) {
                    const active = new Set(
                        Array.from(chips.querySelectorAll('.missav-status-filter-chip.active')).map(
                            (c) => (c as HTMLElement).dataset.value || ''
                        )
                    );
                    this.renderChips(chips as HTMLDivElement);
                    applyFilter(active);
                }
            }, 150);
        }, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
    }

    /** 销毁插件：一次性清理所有 supervisor 管理的资源。 */
    destroy(): void {
        this.supervisor.abort();
    }
}