/**
 * MissAV 列表多栏筛选插件 MissavStatusFilterPlugin —— 与 JavDB 筛选栈功能完全同步。
 *
 * 在 MissAV 列表页顶部原生「过滤: 所有」行下方注入无框 Nord 暗色筛选栈 `.jhs-missav-filter-stack`，
 * 按 subgrid 对齐承载三栏（各自交集生效、空栏自动隐藏）：
 * 1. `状态:`（`.missav-status-filter-bar`）—— 依据 `.missav-status-tag` 筛选 JavDB 收藏/观看/屏蔽/下载状态
 * 2. `MissAV:`（`.missav-saved-filter-bar`）—— 依据 `.jhs-missav-card-meta` 筛选 MissAV 自身收藏状态，
 *    右侧附轻量「同步收藏 / 刷新收藏」原生按钮供一键同源同步 `/cn/saved`
 * 3. `清单:`（`.missav-vlt-filter-bar`）—— 依据 `.jhs-missav-vlt-tag` 筛选 JavDB 归属清单
 *
 * 三栏共享 `core/util/site/filter-chips.ts` 交互引擎：
 * - 左键单击包含（OR）/ 右键单击排除（拦截菜单）/ 左右键双击本栏独立单选；
 * - 双击外层筛选栈空白处一键清空全部三栏条件；
 * - 完整 Enter/Space 键盘与 `aria-pressed` 无障碍支持。
 */
import { TaskSupervisor } from '../../core/task-supervisor';
import {
    bindFilterBarInteraction,
    bindFilterContainerClear,
    collectChipStates,
    getChipState,
    initFilterChip,
    readFilterSelections
} from '../../core/util/site/filter-chips';
import { isVideoDetailPath } from '../../core/util/site/missav-paths';

import { BasePlugin } from '../base-plugin';
import { isVideoPage } from '../car-status-sync/missav-renderer';
import { syncAllMissavSavedPages } from '../car-status-sync/missav-saved-sync';
import {
    MISSAV_SAVED_VALUE,
    MISSAV_UNSAVED_VALUE,
    NO_TAG_VALUE,
    NO_VLT_TAG_VALUE,
    STATUS_ORDER,
    collectMissavSavedCounts,
    collectStatusCounts,
    collectVltTagCounts,
    statusToLabel
} from './mstf-collect';
import {
    applyFilter,
    applyMissavSavedFilter,
    applyMissavVltFilter
} from './mstf-apply';

import missavStatusFilterCssRaw from '../../styles/missav-status-filter/missav-status-filter.css?raw';

/** 挂载点：grid 上方的原生「过滤: 所有」行（Camoufox 实测）。 */
const MOUNT_SELECTOR = 'div.flex.justify-between.mb-6';

const INCLUDE_CLASS = 'active';
const STATUS_CHIP_SEL = '.missav-status-filter-chip';
const SAVED_CHIP_SEL = '.missav-saved-filter-chip';
const VLT_CHIP_SEL = '.missav-vlt-filter-chip';

/** 观察器需要响应的卡片与元数据节点选择器。 */
const RELEVANT_NODE_SEL =
    '.thumbnail.group, .missav-status-tag, .jhs-missav-card-meta, .jhs-missav-saved-badge, .jhs-missav-vlt-tag';

/**
 * MissAV 多栏筛选插件主类。
 */
export class MissavStatusFilterPlugin extends BasePlugin {
    /** 统一生命周期管理器：observer 与防抖定时器注册与清理。 */
    private supervisor = new TaskSupervisor();
    /** MutationObserver 防抖计时器。 */
    private observerDebounce = 0;
    /** 外层多栏筛选栈容器引用。 */
    private filterStack: HTMLDivElement | null = null;
    private statusBar: HTMLDivElement | null = null;
    private savedBar: HTMLDivElement | null = null;
    private vltBar: HTMLDivElement | null = null;
    private syncBtn: HTMLButtonElement | null = null;

    getName(): string {
        return 'MissavStatusFilterPlugin';
    }

    async initCss(): Promise<string> {
        return missavStatusFilterCssRaw;
    }

    async handle(): Promise<void> {
        if (isVideoPage() || isVideoDetailPath(location.pathname)) return;
        this.tryBuild();
        this.startObserving();
    }

    /** 尝试构建多栏筛选栈。挂载点按优先级：原生「过滤: 所有」行 → h1 → 缩略图容器父链。 */
    private tryBuild(): boolean {
        if (document.querySelector('.jhs-missav-filter-stack')) return true;
        const mount =
            document.querySelector(MOUNT_SELECTOR) ??
            document.querySelector('h1') ??
            document.querySelector('.thumbnail.group')?.parentElement?.parentElement;
        if (!mount) return false;
        this.buildFilterStack(mount);
        return true;
    }

    /** 创建单行筛选栏骨架（标签 + 芯片容器）。 */
    private createBarRow(
        barClass: string,
        labelClass: string,
        labelText: string,
        chipsClass: string,
        ariaLabel: string
    ): { bar: HTMLDivElement; chips: HTMLDivElement } {
        const bar = document.createElement('div');
        bar.className = barClass;

        const label = document.createElement('span');
        label.className = labelClass;
        label.textContent = labelText;

        const chips = document.createElement('div');
        chips.className = chipsClass;
        chips.setAttribute('role', 'group');
        chips.setAttribute('aria-label', ariaLabel);

        bar.append(label, chips);
        return { bar, chips };
    }

    /** 构建三栏无框筛选栈，接入共享三态交互与外层空白区双击全清。 */
    private buildFilterStack(mount: Element): void {
        const stack = document.createElement('div');
        stack.className = 'jhs-missav-filter-stack';

        // 1) JavDB 影片状态栏（保留既有类名与属性契约）
        const statusRow = this.createBarRow(
            'missav-status-filter-bar',
            'missav-status-filter-label',
            '状态:',
            'missav-status-filter-chips',
            '影片状态筛选'
        );

        // 2) MissAV 原生收藏栏 + 右侧同步按钮
        const savedRow = this.createBarRow(
            'missav-saved-filter-bar',
            'missav-saved-filter-label',
            'MissAV:',
            'missav-saved-filter-chips',
            'MissAV 原生收藏筛选'
        );
        const syncBtn = document.createElement('button');
        syncBtn.type = 'button';
        syncBtn.className = 'missav-saved-sync-btn';
        syncBtn.textContent = '同步收藏';
        syncBtn.title = '抓取当前账号的 MissAV 收藏列表并刷新本地缓存';
        this.supervisor.addEventListener(syncBtn, 'click', () => {
            void this.handleSyncSavedClick();
        });
        this.syncBtn = syncBtn;

        // 3) JavDB 归属清单栏
        const vltRow = this.createBarRow(
            'missav-vlt-filter-bar',
            'missav-vlt-filter-label',
            '清单:',
            'missav-vlt-filter-chips',
            'JavDB 归属清单筛选'
        );

        stack.append(statusRow.bar, savedRow.bar, vltRow.bar);
        mount.insertAdjacentElement('afterend', stack);

        this.filterStack = stack;
        this.statusBar = statusRow.bar;
        this.savedBar = savedRow.bar;
        this.vltBar = vltRow.bar;

        bindFilterBarInteraction(statusRow.bar, {
            chipSelector: STATUS_CHIP_SEL,
            includeClass: INCLUDE_CLASS,
            onChange: () => {
                this.applyStatusBar();
                this.pruneInactiveZeroChips(statusRow.chips, STATUS_CHIP_SEL, () =>
                    this.renderStatusChips(statusRow.chips)
                );
            },
            onRefresh: () => this.renderStatusChips(statusRow.chips)
        });

        bindFilterBarInteraction(savedRow.bar, {
            chipSelector: SAVED_CHIP_SEL,
            includeClass: INCLUDE_CLASS,
            onChange: () => {
                this.applySavedBar();
                this.pruneInactiveZeroChips(savedRow.chips, SAVED_CHIP_SEL, () =>
                    this.renderSavedChips(savedRow.chips)
                );
            },
            onRefresh: () => this.renderSavedChips(savedRow.chips)
        });

        bindFilterBarInteraction(vltRow.bar, {
            chipSelector: VLT_CHIP_SEL,
            includeClass: INCLUDE_CLASS,
            onChange: () => {
                this.applyVltBar();
                this.pruneInactiveZeroChips(vltRow.chips, VLT_CHIP_SEL, () =>
                    this.renderVltChips(vltRow.chips)
                );
            },
            onRefresh: () => this.renderVltChips(vltRow.chips)
        });

        // 外层筛选栈绑定空白区双击全清：双击任意一行标签旁或栈内空白处即一键重置全部三栏
        bindFilterContainerClear(stack);

        this.renderAllBars();
    }

    /** 若存在计数归零且刚取消选中的残留芯片，触发单栏重建清理。 */
    private pruneInactiveZeroChips(
        chips: HTMLElement,
        chipSelector: string,
        rerender: () => void
    ): void {
        const hasInactiveZero = Array.from(
            chips.querySelectorAll<HTMLElement>(`${chipSelector}[data-count="0"]`)
        ).some((el) => getChipState(el, INCLUDE_CLASS) === 'none');
        if (hasInactiveZero) rerender();
    }

    /** 统一刷新全部三栏芯片（保活已包含/已排除状态）。 */
    private renderAllBars(): void {
        const statusChips = this.statusBar?.querySelector<HTMLDivElement>('.missav-status-filter-chips');
        const savedChips = this.savedBar?.querySelector<HTMLDivElement>('.missav-saved-filter-chips');
        const vltChips = this.vltBar?.querySelector<HTMLDivElement>('.missav-vlt-filter-chips');
        if (statusChips) this.renderStatusChips(statusChips);
        if (savedChips) this.renderSavedChips(savedChips);
        if (vltChips) this.renderVltChips(vltChips);
    }

    /** 统一重应用全部三栏筛选。 */
    private applyAllBars(): void {
        this.applyStatusBar();
        this.applySavedBar();
        this.applyVltBar();
    }

    /** 渲染「状态:」栏芯片。 */
    private renderStatusChips(chips: HTMLDivElement): void {
        const savedStates = collectChipStates(chips, STATUS_CHIP_SEL, INCLUDE_CLASS);
        chips.textContent = '';
        const counts = collectStatusCounts();

        const ordered = [
            ...STATUS_ORDER,
            ...(counts[NO_TAG_VALUE] || savedStates.has(NO_TAG_VALUE) ? [NO_TAG_VALUE] : [])
        ];
        for (const status of ordered) {
            const label = statusToLabel(status);
            const count = counts[label] ?? 0;
            const state = savedStates.get(status) ?? 'none';
            if (count === 0 && state === 'none') continue;

            const chip = document.createElement('span');
            chip.className = 'missav-status-filter-chip';
            if (status === NO_TAG_VALUE) chip.classList.add('no-status');
            chip.textContent = status === NO_TAG_VALUE ? `无状态标签 ${count}` : `${label} ${count}`;
            chip.dataset.value = status;
            chip.dataset.count = String(count);
            initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
            chips.appendChild(chip);
        }
    }

    /** 渲染「MissAV:」原生收藏筛选栏芯片与轻量同步按钮。 */
    private renderSavedChips(chips: HTMLDivElement): void {
        const savedStates = collectChipStates(chips, SAVED_CHIP_SEL, INCLUDE_CLASS);
        const { saved, unsaved } = collectMissavSavedCounts();
        const hasCardMeta = document.querySelector('.jhs-missav-card-meta') !== null;

        chips.textContent = '';

        // 尚未渲染任何卡片底部元数据时（如纯状态测试页），保持为空由 CSS 自动折叠不干扰原界面
        if (!hasCardMeta && saved === 0 && savedStates.size === 0) {
            return;
        }

        const hasSavedAny = saved > 0 || savedStates.size > 0;
        if (hasSavedAny) {
            const entries: Array<{ value: string; label: string; count: number; isSaved: boolean }> = [
                { value: MISSAV_SAVED_VALUE, label: `♥ 已收藏 ${saved}`, count: saved, isSaved: true },
                { value: MISSAV_UNSAVED_VALUE, label: `未收藏 ${unsaved}`, count: unsaved, isSaved: false }
            ];
            for (const entry of entries) {
                const state = savedStates.get(entry.value) ?? 'none';
                if (entry.count === 0 && state === 'none') continue;
                const chip = document.createElement('span');
                chip.className = `missav-saved-filter-chip ${entry.isSaved ? 'is-saved' : 'is-unsaved'}`;
                chip.textContent = entry.label;
                chip.dataset.value = entry.value;
                chip.dataset.count = String(entry.count);
                initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
                chips.appendChild(chip);
            }
        }

        if (this.syncBtn) {
            if (!this.syncBtn.disabled) {
                this.syncBtn.textContent = saved > 0 ? '刷新收藏' : '同步收藏';
            }
            chips.appendChild(this.syncBtn);
        }
    }

    /** 渲染「清单:」JavDB 归属清单筛选栏芯片。 */
    private renderVltChips(chips: HTMLDivElement): void {
        const savedStates = collectChipStates(chips, VLT_CHIP_SEL, INCLUDE_CLASS);
        const { counts, orderedNames, noTagCount } = collectVltTagCounts();

        chips.textContent = '';

        // 页面无任何归属清单标签且无活跃选中/排除项时折叠整行
        if (orderedNames.length === 0 && savedStates.size === 0) {
            return;
        }

        const names = [...orderedNames];
        for (const kept of savedStates.keys()) {
            if (kept !== NO_VLT_TAG_VALUE && !names.includes(kept)) {
                names.push(kept);
            }
        }

        for (const name of names) {
            const count = counts[name] ?? 0;
            const state = savedStates.get(name) ?? 'none';
            if (count === 0 && state === 'none') continue;
            const chip = document.createElement('span');
            chip.className = 'missav-vlt-filter-chip';
            chip.textContent = `${name} ${count}`;
            chip.dataset.value = name;
            chip.dataset.count = String(count);
            initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: state });
            chips.appendChild(chip);
        }

        const noTagState = savedStates.get(NO_VLT_TAG_VALUE) ?? 'none';
        if (noTagCount > 0 || noTagState !== 'none') {
            const chip = document.createElement('span');
            chip.className = 'missav-vlt-filter-chip no-vlt-tag';
            chip.textContent = `无清单 ${noTagCount}`;
            chip.dataset.value = NO_VLT_TAG_VALUE;
            chip.dataset.count = String(noTagCount);
            initFilterChip(chip, { includeClass: INCLUDE_CLASS, initialState: noTagState });
            chips.appendChild(chip);
        }
    }

    /** 点击「同步收藏 / 刷新收藏」按钮，同源抓取全部 MissAV 收藏分页并更新界面。 */
    private async handleSyncSavedClick(): Promise<void> {
        const btn = this.syncBtn;
        if (!btn || btn.disabled) return;
        const prevText = btn.textContent || '同步收藏';
        btn.disabled = true;
        btn.textContent = '同步中...';
        try {
            const res = await syncAllMissavSavedPages(({ page, collected }) => {
                if (this.syncBtn) {
                    this.syncBtn.textContent = `同步中 (${page}页·${collected})`;
                }
            });
            if (res.ok) {
                document.dispatchEvent(new CustomEvent('jhs-missav-saved-local-sync'));
                window.show?.ok?.(`MissAV 收藏同步完成：共 ${res.total} 部（${res.pages} 页）`);
            } else {
                window.show?.error?.(res.message);
            }
        } finally {
            if (this.syncBtn) {
                this.syncBtn.disabled = false;
                const { saved } = collectMissavSavedCounts();
                this.syncBtn.textContent = saved > 0 ? '刷新收藏' : prevText;
            }
        }
    }

    private applyStatusBar(): void {
        if (!this.statusBar) return;
        const chips = this.statusBar.querySelectorAll<HTMLElement>(STATUS_CHIP_SEL);
        applyFilter(readFilterSelections(chips, INCLUDE_CLASS));
    }

    private applySavedBar(): void {
        if (!this.savedBar) return;
        const chips = this.savedBar.querySelectorAll<HTMLElement>(SAVED_CHIP_SEL);
        applyMissavSavedFilter(readFilterSelections(chips, INCLUDE_CLASS));
    }

    private applyVltBar(): void {
        if (!this.vltBar) return;
        const chips = this.vltBar.querySelectorAll<HTMLElement>(VLT_CHIP_SEL);
        applyMissavVltFilter(readFilterSelections(chips, INCLUDE_CLASS));
    }

    /** 启动 MutationObserver：感知状态标签、底部卡片信息区与新卡片加入，防抖刷新并重应用三栏交集。 */
    private startObserving(): void {
        this.supervisor.observe(
            document.body,
            (mutations) => {
                if (!this.observerNeedsRefresh(mutations)) return;
                if (!this.filterStack) this.tryBuild();
                clearTimeout(this.observerDebounce);
                this.observerDebounce = this.supervisor.setTimeout(() => {
                    if (!this.filterStack) return;
                    this.renderAllBars();
                    this.applyAllBars();
                }, 150);
            },
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-status', 'data-missav-saved', 'data-meta-sig']
            }
        );
    }

    private observerNeedsRefresh(mutations: MutationRecord[]): boolean {
        for (const mutation of mutations) {
            if (
                mutation.type === 'attributes' &&
                (mutation.attributeName === 'data-status' ||
                    mutation.attributeName === 'data-missav-saved' ||
                    mutation.attributeName === 'data-meta-sig')
            ) {
                return true;
            }
            if (mutation.type !== 'childList') continue;
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = node as HTMLElement;
                if (el.matches?.(RELEVANT_NODE_SEL) || el.querySelector?.(RELEVANT_NODE_SEL)) {
                    return true;
                }
            }
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = node as HTMLElement;
                if (el.matches?.(RELEVANT_NODE_SEL) || el.querySelector?.(RELEVANT_NODE_SEL)) {
                    return true;
                }
            }
        }
        return false;
    }

    destroy(): void {
        this.supervisor.abort();
    }
}
