/**
 * 详情页「第三方站点访问次数」的绑定与就地渲染。
 *
 * 详情页的站点按钮是原生 `<a target="_blank" class="site-btn">`，**没有任何 JS 点击逻辑**
 * （打开外站全靠浏览器默认行为），因此计数必须自己挂监听。本模块负责：
 *
 * 1. **只绑一次**：`document` 捕获阶段委托 + 模块级 `bound` 门闩。原因是
 *    `OtherSitePlugin.loadOtherSite()` 会在设置开关切换、FC2 弹窗等场景反复执行，
 *    每次都重新 append 一份按钮 HTML（`#otherSiteBox` id 因此可能重复），
 *    元素级监听会重复绑定、重复计数。
 * 2. **只认真实外跳**：按钮已解析出可跳转 `href`（非空、非 `#` 占位）时才计 1 次；
 *    左键（含键盘回车）与中键算真实外跳，右键不触发导航故不计数。
 * 3. **同一事件只处理一次**：用 `WeakSet` 标记已处理的事件对象，重复绑定 / 事件重放
 *    都不会把一次点击算成两次。
 * 4. **就地更新**：计数后立即按当前统计刷新所有按钮徽标（含重复的容器副本）与汇总行，
 *    不做异步等待，避免显示过期数据。
 *
 * 渲染的初始值由 `OtherSiteBtn.count` / `OtherSiteBox.visitTotal` 属性给出（服务端式一遍渲染），
 * 本模块只负责「点击后」的刷新，两者共用同一套 class 名。
 */

import {
    emptyExternalVisitStat,
    readExternalVisitStat,
    recordExternalSiteVisit,
    type ExternalVisitStat
} from '../../core/storage/external-visit-ops';
import {
    SITE_BTN_ID_ATTR,
    SITE_OPEN_COUNT_CLASS
} from '../../components/other-site/other-site-btn';
import { SITE_VISIT_TOTAL_CLASS } from '../../components/other-site/other-site-box';

let bound = false;
let currentCarNum = '';

/** 已处理过的事件对象（一次真实点击只计一次）。 */
const handledEvents = new WeakSet<Event>();

/**
 * 登记当前详情页的番号；点击计数时用它定位统计记录。
 * 每次 `loadOtherSite()` 都调用一次（详情页同一时刻只有一个视频，FC2 弹窗会覆盖为 FC2 番号）。
 */
export function setVisitCounterCarNum(carNum: string): void {
    currentCarNum = carNum;
}

/** 当前详情页的访问统计（供初始渲染与测试读取）。 */
export function currentVisitStat(): ExternalVisitStat {
    return currentCarNum ? readExternalVisitStat(currentCarNum) : emptyExternalVisitStat();
}

/** 按钮是否已解析出可跳转的外站地址（未命中 / 占位 `#` 不算访问）。 */
function isRealExternalOpen(anchor: Element): boolean {
    const href = anchor.getAttribute('href');
    if (href === null) return false;
    const trimmed = href.trim();
    return trimmed !== '' && trimmed !== '#';
}

/** 该事件是否是「会真的打开外站」的点击。 */
function isOpenGesture(event: Event): boolean {
    if (event.type === 'auxclick') return (event as MouseEvent).button === 1;
    return (event as MouseEvent).button === 0;
}

function handleVisitClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest(`a.site-btn[${SITE_BTN_ID_ATTR}]`);
    if (!anchor) return;
    if (handledEvents.has(event)) return;
    if (!isOpenGesture(event)) return;
    if (!isRealExternalOpen(anchor)) return;
    const siteId = anchor.getAttribute(SITE_BTN_ID_ATTR) ?? '';
    if (!siteId || !currentCarNum) return;
    handledEvents.add(event);
    renderExternalVisitStat(recordExternalSiteVisit(currentCarNum, siteId));
}

/**
 * 按统计刷新页面上所有副本的徽标与汇总行。
 * 0 次的站点不显示徽标、总计为 0 时整行隐藏（不占位、不显示「0 次」）。
 */
export function renderExternalVisitStat(stat: ExternalVisitStat): void {
    for (const anchor of document.querySelectorAll<HTMLElement>(
        `a.site-btn[${SITE_BTN_ID_ATTR}]`
    )) {
        const badge = anchor.querySelector<HTMLElement>(`.${SITE_OPEN_COUNT_CLASS}`);
        if (!badge) continue;
        const count = stat.bySite[anchor.getAttribute(SITE_BTN_ID_ATTR) ?? ''] ?? 0;
        badge.textContent = String(count);
        badge.style.display = count > 0 ? '' : 'none';
    }
    for (const totalEl of document.querySelectorAll<HTMLElement>(`.${SITE_VISIT_TOTAL_CLASS}`)) {
        const numEl = totalEl.querySelector('b');
        if (numEl) numEl.textContent = String(stat.total);
        totalEl.dataset.total = String(stat.total);
        totalEl.style.display = stat.total > 0 ? '' : 'none';
    }
}

/** 挂载委托监听（幂等；document 级监听按页面生命周期保留，同详情页链接处理）。 */
export function bindExternalVisitCounter(): void {
    if (bound) return;
    bound = true;
    document.addEventListener('click', handleVisitClick, true);
    document.addEventListener('auxclick', handleVisitClick, true);
}

/** 卸载委托监听（可重复调用）。 */
export function unbindExternalVisitCounter(): void {
    if (!bound) return;
    bound = false;
    document.removeEventListener('click', handleVisitClick, true);
    document.removeEventListener('auxclick', handleVisitClick, true);
}

/** 测试用：恢复未绑定、无番号的初始状态。 */
export function __resetVisitCounterForTest(): void {
    unbindExternalVisitCounter();
    currentCarNum = '';
}