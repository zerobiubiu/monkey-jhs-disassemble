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
 * 按挂载点把筛选栏插入 DOM。
 *
 * @param mount 挂载点（`findListMountPoint` 或已挂栏的邻接点）
 * @param bar 待插入的筛选栏元素
 */
export function applyListMountPoint(mount: ListMountPoint, bar: HTMLElement): void {
    mount.target.insertAdjacentElement(mount.position, bar);
}