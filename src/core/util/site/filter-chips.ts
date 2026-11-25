/**
 * 列表筛选栏共享交互引擎 —— 三态芯片（未选/包含/排除）、左右键单双击与空白区双击清空。
 *
 * 供 `video-lists-tag`（筛选）、`status-tag-filter`（状态）、`other-site`（预加载）、
 * `site-tag-filter`（标签）四栏共享同一交互契约，消除各插件重复事件与状态代码：
 * - 左键单击：切换「包含」态（含排除态切回包含）
 * - 右键单击（屏蔽原生菜单）：切换「排除」态（含包含态切至排除）
 * - 左键双击芯片：清空本栏其他芯片后单选本项为「包含」（不影响其他三栏）
 * - 右键双击芯片（350ms 窗内连续两次右键同一芯片）：清空本栏其他芯片后单选本项为「排除」（不影响其他三栏）
 * - 栈容器空白区双击：清空该容器内所有筛选栏的全部包含/排除条件并刷新计数
 */

/** 单个筛选芯片的三态语义。 */
export type ChipFilterState = 'none' | 'include' | 'exclude';

/** 单个筛选栏内的包含/排除语义值集合。 */
export interface FilterSelections {
    included: Set<string>;
    excluded: Set<string>;
}

/** 筛选栏交互配置。 */
export interface FilterBarInteractionOptions {
    /** 芯片元素选择器（如 `.jhs-vlt-filter-chip`）。 */
    chipSelector: string;
    /** 本栏既有「包含」态激活类名（如 `jhs-vlt-active` 或 `active`）。 */
    includeClass: string;
    /** 芯片状态发生任意变化（单击/右键/双击/清空）时回调。 */
    onChange: (detail: {
        bar: HTMLElement;
        chip?: HTMLElement;
        nextState?: ChipFilterState;
    }) => void;
    /** 整组清空全部隐藏标记后回调，用于重算可见计数与清理过期零计数芯片。 */
    onRefresh?: () => void;
}

interface BarController {
    options: FilterBarInteractionOptions;
    lastRightClick: { value: string; time: number } | null;
    clearOnly: () => void;
    refresh: () => void;
}

/** 共享排除态类名（与各栏既有包含态类名互斥）。 */
export const FILTER_EXCLUDED_CLASS = 'jhs-filter-excluded';

/** 芯片元素标识属性（供空白区双击判定排除芯片）。 */
export const FILTER_CHIP_ATTR = 'data-jhs-filter-chip';

/** 芯片语义状态属性（`include` | `exclude`；未选中时移除）。 */
export const FILTER_STATE_ATTR = 'data-filter-state';

/** 筛选状态变化自定义事件（冒泡，供推荐浮层等外层协调器感知四栏变更）。 */
export const FILTER_CHANGE_EVENT = 'jhs-filter-change';

/** 右键双击判定时间窗（毫秒，标准浏览器无右键原生 dblclick 事件）。 */
export const RIGHT_DOUBLE_CLICK_MS = 350;

/** 空白区双击排除的选择器：命中芯片或任意交互控件时不触发全局清空。 */
const NON_BLANK_SELECTOR = `[${FILTER_CHIP_ATTR}], button, a, input, select, textarea, summary`;

const barControllers = new WeakMap<Element, BarController>();
const boundClearContainers = new WeakSet<Element>();

/** 读取单个芯片当前三态（兼容直接设置旧版 includeClass 的测试夹具）。 */
export function getChipState(chip: Element, includeClass: string): ChipFilterState {
    if (
        chip.classList.contains(FILTER_EXCLUDED_CLASS) ||
        chip.getAttribute(FILTER_STATE_ATTR) === 'exclude'
    ) {
        return 'exclude';
    }
    if (
        chip.classList.contains(includeClass) ||
        chip.getAttribute(FILTER_STATE_ATTR) === 'include'
    ) {
        return 'include';
    }
    return 'none';
}

/** 写入单个芯片三态并同步类名、`data-filter-state` 与 `aria-pressed`。 */
export function setChipState(
    chip: HTMLElement,
    state: ChipFilterState,
    includeClass: string
): void {
    chip.classList.toggle(includeClass, state === 'include');
    chip.classList.toggle(FILTER_EXCLUDED_CLASS, state === 'exclude');
    if (state === 'none') {
        chip.removeAttribute(FILTER_STATE_ATTR);
    } else {
        chip.setAttribute(FILTER_STATE_ATTR, state);
    }
    chip.setAttribute(
        'aria-pressed',
        state === 'include' ? 'true' : state === 'exclude' ? 'mixed' : 'false'
    );
}

/** 初始化筛选芯片的无障碍角色、聚焦能力与初始三态。 */
export function initFilterChip(
    chip: HTMLElement,
    opts: { includeClass: string; initialState?: ChipFilterState }
): void {
    chip.setAttribute(FILTER_CHIP_ATTR, '');
    if (chip.tagName !== 'BUTTON') {
        chip.setAttribute('role', 'button');
        chip.tabIndex = 0;
    }
    setChipState(chip, opts.initialState ?? 'none', opts.includeClass);
}

/** 快照容器内当前所有已包含/已排除芯片的语义值映射，供 `refreshChips` 保活状态。 */
export function collectChipStates(
    container: ParentNode,
    chipSelector: string,
    includeClass: string
): Map<string, Exclude<ChipFilterState, 'none'>> {
    const states = new Map<string, Exclude<ChipFilterState, 'none'>>();
    container.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => {
        const value = chip.dataset.value ?? '';
        if (!value) return;
        const state = getChipState(chip, includeClass);
        if (state !== 'none') states.set(value, state);
    });
    return states;
}

/** 从芯片列表读取当前包含集合与排除集合。 */
export function readFilterSelections(
    chips: Iterable<Element>,
    includeClass: string
): FilterSelections {
    const included = new Set<string>();
    const excluded = new Set<string>();
    for (const chip of chips) {
        const value = (chip as HTMLElement).dataset.value ?? '';
        if (!value) continue;
        const state = getChipState(chip, includeClass);
        if (state === 'include') included.add(value);
        else if (state === 'exclude') excluded.add(value);
    }
    return { included, excluded };
}

/** 判断是否存在任意包含或排除条件。 */
export function hasActiveSelections(selections: FilterSelections): boolean {
    return selections.included.size > 0 || selections.excluded.size > 0;
}

/**
 * 统一判定卡片是否通过本栏的包含/排除条件：
 * - 命中任意排除项 → 隐藏
 * - 存在包含项时，必须命中至少一项包含项才显示（OR）
 * - 无包含项且未命中排除项 → 显示
 */
export function matchesIncludeExclude(
    selections: FilterSelections,
    matchesAny: (values: ReadonlySet<string>) => boolean
): boolean {
    if (selections.excluded.size > 0 && matchesAny(selections.excluded)) return false;
    if (selections.included.size > 0 && !matchesAny(selections.included)) return false;
    return true;
}

/**
 * 为单个筛选栏委托绑定三态芯片交互（幂等；重复调用仅更新回调引用）。
 */
export function bindFilterBarInteraction(
    bar: HTMLElement,
    options: FilterBarInteractionOptions
): void {
    const existing = barControllers.get(bar);
    if (existing) {
        existing.options = options;
        return;
    }

    const controller: BarController = {
        options,
        lastRightClick: null,
        clearOnly: () => {
            const { chipSelector, includeClass, onChange } = controller.options;
            controller.lastRightClick = null;
            bar.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => {
                setChipState(chip, 'none', includeClass);
            });
            onChange({ bar });
        },
        refresh: () => {
            controller.options.onRefresh?.();
        }
    };
    barControllers.set(bar, controller);

    const findChip = (target: EventTarget | null): HTMLElement | null => {
        if (!(target instanceof Element)) return null;
        const chip = target.closest<HTMLElement>(controller.options.chipSelector);
        return chip && bar.contains(chip) ? chip : null;
    };

    const emitChange = (chip?: HTMLElement, nextState?: ChipFilterState): void => {
        controller.options.onChange({ bar, chip, nextState });
        bar.dispatchEvent(new CustomEvent(FILTER_CHANGE_EVENT, { bubbles: true, detail: { bar } }));
    };

    const toggleLeft = (chip: HTMLElement): void => {
        const { includeClass } = controller.options;
        controller.lastRightClick = null;
        const nextState: ChipFilterState =
            getChipState(chip, includeClass) === 'include' ? 'none' : 'include';
        setChipState(chip, nextState, includeClass);
        emitChange(chip, nextState);
    };

    const applySolo = (targetChip: HTMLElement, state: 'include' | 'exclude'): void => {
        const { chipSelector, includeClass } = controller.options;
        controller.lastRightClick = null;
        bar.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => {
            setChipState(chip, chip === targetChip ? state : 'none', includeClass);
        });
        emitChange(targetChip, state);
    };

    bar.addEventListener('click', (event: MouseEvent) => {
        const chip = findChip(event.target);
        if (!chip) return;
        toggleLeft(chip);
    });

    bar.addEventListener('dblclick', (event: MouseEvent) => {
        const chip = findChip(event.target);
        if (!chip) return;
        event.stopPropagation();
        applySolo(chip, event.button === 2 ? 'exclude' : 'include');
    });

    bar.addEventListener('contextmenu', (event: MouseEvent) => {
        const chip = findChip(event.target);
        if (!chip) return;
        event.preventDefault();
        const value = chip.dataset.value ?? '';
        const now = Date.now();
        const prev = controller.lastRightClick;
        const isDouble =
            event.detail >= 2 ||
            (prev !== null && prev.value === value && now - prev.time <= RIGHT_DOUBLE_CLICK_MS);

        if (isDouble) {
            applySolo(chip, 'exclude');
            return;
        }

        controller.lastRightClick = { value, time: now };
        const { includeClass } = controller.options;
        const nextState: ChipFilterState =
            getChipState(chip, includeClass) === 'exclude' ? 'none' : 'exclude';
        setChipState(chip, nextState, includeClass);
        emitChange(chip, nextState);
    });

    // 仅为非原生 button 芯片（span[role="button"]）补齐 Enter/Space 键盘交互；
    // 原生 <button> 已自带标准键盘激活行为，不重复绑定。
    bar.addEventListener('keydown', (event: KeyboardEvent) => {
        const chip = findChip(event.target);
        if (!chip || chip.tagName === 'BUTTON') return;
        if (event.key === 'Enter') {
            event.preventDefault();
            toggleLeft(chip);
        } else if (event.key === ' ') {
            event.preventDefault();
        }
    });

    bar.addEventListener('keyup', (event: KeyboardEvent) => {
        const chip = findChip(event.target);
        if (!chip || chip.tagName === 'BUTTON') return;
        if (event.key === ' ') {
            toggleLeft(chip);
        }
    });
}

/**
 * 清空指定筛选容器内所有已注册筛选栏的全部过滤条件：
 * 第一遍统一重置状态并移除各栏隐藏标记，第二遍统一刷新计数与清理零计数残留芯片。
 */
export function clearFilterContainer(container: ParentNode): void {
    const controllers: BarController[] = [];
    if (container instanceof Element) {
        const selfController = barControllers.get(container);
        if (selfController) controllers.push(selfController);
    }
    for (const child of Array.from(container.children)) {
        const controller = barControllers.get(child);
        if (controller) controllers.push(controller);
    }
    if (controllers.length === 0) return;

    for (const controller of controllers) {
        controller.clearOnly();
    }
    for (const controller of controllers) {
        controller.refresh();
    }
    if (container instanceof Element) {
        container.dispatchEvent(
            new CustomEvent(FILTER_CHANGE_EVENT, { bubbles: true, detail: { cleared: true } })
        );
    }
}

/**
 * 为筛选栈容器（`.jhs-filter-stack` 或独立作用域挂载点）绑定空白区域双击清空监听（幂等）。
 */
export function bindFilterContainerClear(container: HTMLElement): void {
    if (boundClearContainers.has(container)) return;
    boundClearContainers.add(container);

    container.addEventListener('dblclick', (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (target?.closest(NON_BLANK_SELECTOR)) return;
        clearFilterContainer(container);
    });
}
