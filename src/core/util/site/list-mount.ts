/**
 * 列表页「过滤/筛选栏」挂载点 —— 站点 DOM 事实的**共享单点**（doc/48、doc/49）。
 *
 * 背景：JavDB 首页/改版页面上 `.tabs.is-boxed` 不一定落在标准层，且可能嵌在影片网格内部。
 * 挂载链与插入方位此前分散在三处（`stf-ui.findMountTarget` + `doBuild` 的 matches 分支、
 * `vlt-filter-bar.buildFilterBar`），一旦各处口径不同就会出现两种坏结果：
 * - 只认结构式 → 命中 0 静默不挂（doc/48）；
 * - 用宽松式回退但插在其后 → 插入点落在卡片网格里，整页布局错乱（doc/49）。
 *
 * 现统一为「挂载点 = 目标元素 + 插入方位」：
 * 1. 演员页标签区 → 之后；
 * 2. 结构式筛选标签栏（既有页面既有位置）→ 之后；
 * 3. **影片列表容器本身 → 之前**（与列表同层兄弟，绝不会落进网格）；
 * 4. 页面容器 → 作为首子元素（`afterbegin`）。
 *
 * 全部选择器取自注册表，本模块不持有站点字面量。
 */

import { siteSelector } from './selectors';

/** 挂载点：目标元素 + 插入方位（`insertAdjacentElement` 的第二参）。 */
export interface ListMountPoint {
    target: Element;
    position: 'beforebegin' | 'afterend' | 'afterbegin';
}

/**
 * 寻找过滤/筛选栏的挂载点。
 *
 * @param pathname 当前路径（默认读 location，便于测试注入）
 * @returns 挂载点；页面无可用锚点时返回 null（调用方自决，如超时强挂）
 */
export function findListMountPoint(pathname: string = window.location.pathname): ListMountPoint | null {
    if (/^\/actors\//.test(pathname)) {
        const actorTags = document.querySelector(siteSelector('actorTags'));
        if (actorTags) return { target: actorTags, position: 'afterend' };
    }

    // 1) 结构式筛选标签栏：既有页面（清单/搜索/系列）保持既有位置
    const tabsBoxed = document.querySelector(siteSelector('tabsBoxed'));
    if (tabsBoxed) return { target: tabsBoxed, position: 'afterend' };

    // 2) 影片列表正上方：插在列表之前 —— 与列表同层，不会成为网格项（首页走这条）
    const list = document.querySelector(siteSelector('list'));
    if (list) return { target: list, position: 'beforebegin' };

    // 3) 无列表容器：挂到页面容器顶部
    for (const key of ['sectionListInner', 'sectionList'] as const) {
        const container = document.querySelector(siteSelector(key));
        if (container) return { target: container, position: 'afterbegin' };
    }

    return null;
}

/**
 * 按挂载点把筛选栏插入 DOM（单根直插，用于超时兜底等无栈场景）。
 *
 * @param mount 挂载点
 * @param bar 待插入的筛选栏元素
 */
export function applyListMountPoint(mount: ListMountPoint, bar: HTMLElement): void {
    mount.target.insertAdjacentElement(mount.position, bar);
}

/** 筛选栏统一容器（三根栏都进这个栈，顺序由优先级决定）。 */
export const FILTER_STACK_CLASS = 'jhs-filter-stack';

/**
 * 筛选栏显示优先级（**唯一的顺序权威**，与挂载先后无关）。
 *
 * 现场口径：筛选（清单标签）→ 状态（状态标签芯片）→ 预加载（外站预加载）。
 */
export const FILTER_BAR_PRIORITY = { vlt: 10, status: 20, preload: 30 } as const;

/** 优先级在栈内子元素上的属性名。 */
const STACK_PRIORITY_ATTR = 'data-jhs-filter-priority';

/**
 * 取回（必要时创建）筛选栏栈容器。
 *
 * 容器挂在 `findListMountPoint()` 给出的位置；页面暂无可用锚点时返回 null
 * （调用方自决：等待锚点 / 超时兜底直挂）。
 *
 * @returns 栈容器或 null
 */
export function ensureFilterStack(): HTMLElement | null {
    const existing = document.querySelector<HTMLElement>(`.${FILTER_STACK_CLASS}`);
    if (existing) return existing;

    const mount = findListMountPoint();
    if (!mount) return null;

    const stack = document.createElement('div');
    stack.className = FILTER_STACK_CLASS;
    applyListMountPoint(mount, stack);
    return stack;
}

/**
 * 把筛选栏按优先级放进栈容器。
 *
 * doc/50：三根栏此前各自找锚点直插，顺序取决于并发挂载先后（实测首页被挂成
 * 状态 → 预加载 → 筛选）。改为统一入栈后，顺序只由 `priority` 决定。
 *
 * @param bar 筛选栏元素
 * @param priority 显示优先级（取值见 `FILTER_BAR_PRIORITY`）
 * @returns 是否入栈成功（无可用锚点时为 false）
 */
export function mountFilterBar(bar: HTMLElement, priority: number): boolean {
    const stack = ensureFilterStack();
    if (!stack) return false;

    bar.setAttribute(STACK_PRIORITY_ATTR, String(priority));
    const next = Array.from(stack.children).find(
        (child) => Number(child.getAttribute(STACK_PRIORITY_ATTR) ?? 0) > priority
    );
    if (next) {
        stack.insertBefore(bar, next);
    } else {
        stack.appendChild(bar);
    }
    return true;
}