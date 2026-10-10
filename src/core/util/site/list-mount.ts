/**
 * 列表页「过滤/筛选栏」挂载锚点 —— 站点 DOM 事实的**共享单点**（doc/48）。
 *
 * 背景：JavDB 首页/改版页面上 筛选标签栏（is-boxed 类） 不一定落在
 * 列表页标准层 这一层（实测首页 筛选标签栏（is-boxed 类） 计数为 1，
 * 但结构式选择器命中 0）。原先两处各自维护挂载链：
 * - `status-tag-filter/stf-ui.findMountTarget()`：结构式 → 容器兜底 → 插件内 10s 强挂；
 * - `video-lists-tag/vlt-filter-bar.buildFilterBar()`：**只有结构式一条**，命中 0 即静默
 *   `return`，于是首页只剩前者能显示（用户实测 `stfBar:true / vltBar:false`）。
 *
 * 现统一到本模块：结构式 → 宽松式 → 容器首子元素兜底；两侧共用同一锚点，
 * 因此两根栏始终相邻（后挂的那个插在已挂栏之后）。
 *
 * 全部选择器取自注册表（siteSelector），本模块不持有裸站点字面量。
 */

import { siteSelector } from './selectors';

/** 取容器首子元素（用于无标签栏时的兜底锚点）。 */
function firstChildOf(selector: string): Element | null {
    const container = document.querySelector(selector);
    return container?.firstElementChild ?? null;
}

/**
 * 寻找过滤/筛选栏的挂载锚点（筛选栏统一插在返回元素之后）。
 *
 * 顺序（doc/48）：演员页标签区 → 结构式筛选标签栏 → 宽松式筛选标签栏 →
 * 列表页内层容器首子元素 → 列表页外层容器首子元素 → null（调用方自决，如超时强挂）。
 *
 * @param pathname 当前路径（默认读 location，便于测试注入）
 * @returns 挂载锚点元素；页面无可用锚点时返回 null
 */
export function findListMountTarget(pathname: string = window.location.pathname): Element | null {
    if (/^\/actors\//.test(pathname)) {
        return document.querySelector(siteSelector('actorTags'));
    }
    return (
        document.querySelector(siteSelector('tabsBoxed')) ??
        document.querySelector(siteSelector('tabsBoxedLoose')) ??
        firstChildOf(siteSelector('sectionListInner')) ??
        firstChildOf(siteSelector('sectionList'))
    );
}