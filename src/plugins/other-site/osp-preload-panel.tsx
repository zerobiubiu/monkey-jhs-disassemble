/**
 * 「批量预加载请求列表面板」控制器（doc/26）。
 *
 * 独立浮层（Q4b）：挂到 `document.body` 的固定定位容器，不遮蔽页面、可随时开关。
 * 内容由 `PreloadQueuePanel` 组件经 `jsxToString` 渲染后写入容器 `innerHTML`，
 * 每次刷新重建（列表规模小；与卡片徽标的 jQuery 实时更新互不干扰）。
 *
 * 交互用**容器级事件委托**（按钮带 `data-act` / `data-key`），
 * 避免每次重建都重新绑定监听器。
 *
 * 依赖方向：本模块**不**导入 osp-preload（避免循环）；重试/取消经
 * `OtherSitePlugin.retryPreload / cancelPreload` 薄委托进入预加载编排层。
 */

import { jsxToString } from '../../core/jsx-to-string';

import { PreloadQueuePanel } from '../../components/other-site/preload-queue-panel';
import type { PreloadQueueRow } from '../../components/other-site/preload-queue-panel';

import type { OtherSitePlugin } from '../other-site-plugin';

/** 日志前缀（与 osp-preload 一致）。 */
const PANEL_LOG = '[OtherSite 预加载]';

/** 面板容器类名（定位与样式见 styles/other-site/preload-queue-panel.css）。 */
export const PRELOAD_QUEUE_PANEL_CLASS = 'jhs-pqp-layer';

/** 刷新防抖毫秒（合并批量状态变更）。 */
const REFRESH_DEBOUNCE_MS = 120;

/**
 * 开关请求列表面板：已打开则关闭，未打开则挂载。
 * @param plugin OtherSitePlugin 实例（提供队列、注册表与生命周期管理）
 */
export function togglePreloadQueuePanel(plugin: OtherSitePlugin): void {
    if (plugin.preloadQueuePanelEl) {
        destroyPreloadQueuePanel(plugin);
        return;
    }
    const el = document.createElement('div');
    el.className = PRELOAD_QUEUE_PANEL_CLASS;
    plugin.preloadQueuePanelEl = el;
    plugin.supervisor.addEventListener(el, 'click', (event: Event) => {
        handlePanelClick(plugin, event);
    });
    document.body.appendChild(el);
    enablePanelDrag(plugin, el);
    renderPreloadQueuePanel(plugin);
    console.log(`${PANEL_LOG} 请求列表面板已打开`);
}

/**
 * 请求刷新面板（防抖）。面板未打开时是空操作。
 * @param plugin OtherSitePlugin 实例
 */
export function refreshPreloadQueuePanel(plugin: OtherSitePlugin): void {
    if (!plugin.preloadQueuePanelEl) return;
    clearTimeout(plugin.preloadQueuePanelDebounce);
    plugin.preloadQueuePanelDebounce = plugin.supervisor.setTimeout(() => {
        renderPreloadQueuePanel(plugin);
    }, REFRESH_DEBOUNCE_MS);
}

/**
 * 关闭并移除面板。
 * @param plugin OtherSitePlugin 实例
 */
export function destroyPreloadQueuePanel(plugin: OtherSitePlugin): void {
    clearTimeout(plugin.preloadQueuePanelDebounce);
    plugin.preloadQueuePanelDebounce = 0;
    plugin.preloadQueuePanelEl?.remove();
    plugin.preloadQueuePanelEl = null;
}

// ── 拖动（表头作把手；pointer 事件，无第三方依赖）──────────────────

/** 拖动会话状态（同一时刻只可能有一个）。 */
let dragState: {
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
} | null = null;

/**
 * 让面板可拖动：按住表头（按钮除外）拖动，位置限制在视口内。
 *
 * 首次拖动时把「居中 transform」换算为绝对 left/top，之后不再居中 ——
 * 否则拖动过程会因 transform 基准变化而跳位。
 *
 * @param plugin OtherSitePlugin 实例（用其 supervisor 统一管理监听器生命周期）
 * @param el 面板容器
 */
function enablePanelDrag(plugin: OtherSitePlugin, el: HTMLElement): void {
    plugin.supervisor.addEventListener(el, 'pointerdown', (event: Event) => {
        const pointer = event as PointerEvent;
        const target = pointer.target as HTMLElement | null;
        if (!target?.closest('.jhs-pqp-header') || target.closest('button')) return;
        const rect = el.getBoundingClientRect();
        dragState = {
            pointerId: pointer.pointerId,
            startX: pointer.clientX,
            startY: pointer.clientY,
            originLeft: rect.left,
            originTop: rect.top
        };
        el.style.transform = 'none';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.classList.add('is-dragging');
        el.setPointerCapture(pointer.pointerId);
        event.preventDefault();
    });

    plugin.supervisor.addEventListener(el, 'pointermove', (event: Event) => {
        const pointer = event as PointerEvent;
        if (!dragState || pointer.pointerId !== dragState.pointerId) return;
        const maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - el.offsetHeight);
        const left = Math.min(
            maxLeft,
            Math.max(0, dragState.originLeft + (pointer.clientX - dragState.startX))
        );
        const top = Math.min(
            maxTop,
            Math.max(0, dragState.originTop + (pointer.clientY - dragState.startY))
        );
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    });

    const endDrag = (event: Event): void => {
        const pointer = event as PointerEvent;
        if (!dragState || pointer.pointerId !== dragState.pointerId) return;
        dragState = null;
        el.classList.remove('is-dragging');
        if (el.hasPointerCapture(pointer.pointerId)) el.releasePointerCapture(pointer.pointerId);
    };
    plugin.supervisor.addEventListener(el, 'pointerup', endDrag);
    plugin.supervisor.addEventListener(el, 'pointercancel', endDrag);
}

/** 重建面板内容（队列顺序 + 终态记录）。 */
function renderPreloadQueuePanel(plugin: OtherSitePlugin): void {
    const el = plugin.preloadQueuePanelEl;
    if (!el) return;
    el.innerHTML = jsxToString(
        <PreloadQueuePanel
            rows={collectPanelRows(plugin)}
            counts={plugin.preloadTasks.counts()}
            concurrency={plugin.preloadQueue.getConcurrency()}
        />
    );
}

/**
 * 组装面板行：先按**队列真实顺序**输出在队任务（执行中/排队中），
 * 再追加不在队列中的终态记录（失败/已取消）。
 */
function collectPanelRows(plugin: OtherSitePlugin): PreloadQueueRow[] {
    const rows: PreloadQueueRow[] = [];
    const inQueueKeys = new Set<string>();
    for (const task of plugin.preloadQueue.getTasks()) {
        inQueueKeys.add(task.key);
        const record = plugin.preloadTasks.get(task.key);
        const running = task.state === 'running';
        rows.push({
            key: task.key,
            carNum: record?.carNum ?? task.key,
            siteLabel: record?.siteLabel ?? '',
            status: running ? 'requesting' : 'queued',
            inQueue: true,
            running
        });
    }
    for (const record of plugin.preloadTasks.listTerminal()) {
        if (inQueueKeys.has(record.key)) continue;
        rows.push({
            key: record.key,
            carNum: record.carNum,
            siteLabel: record.siteLabel,
            status: record.status,
            inQueue: false,
            running: false
        });
    }
    return rows;
}

/** 处理面板内按钮点击（事件委托）。 */
function handlePanelClick(plugin: OtherSitePlugin, event: Event): void {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLElement>('[data-act]');
    if (!btn || btn.hasAttribute('disabled')) return;
    event.preventDefault();
    const act = btn.dataset.act ?? '';
    const key = btn.dataset.key ?? '';
    switch (act) {
        case 'close':
            destroyPreloadQueuePanel(plugin);
            return;
        case 'prioritize':
            plugin.preloadQueue.prioritize(key);
            break;
        case 'cancel':
            plugin.cancelPreload(key);
            break;
        case 'retry':
            plugin.retryPreload(key);
            break;
        case 'remove':
            plugin.preloadTasks.remove(key);
            break;
        case 'retry-failed':
            retryAllFailed(plugin);
            break;
        case 'clear-terminal':
            plugin.preloadTasks.clearTerminal();
            break;
        default:
            return;
    }
    renderPreloadQueuePanel(plugin);
}

/** 重试全部失败任务（已取消的不自动重试 —— 用户主动取消的意图优先）。 */
function retryAllFailed(plugin: OtherSitePlugin): void {
    const failedKeys = plugin.preloadTasks
        .listTerminal()
        .filter((record) => record.status === 'failed')
        .map((record) => record.key);
    for (const key of failedKeys) {
        plugin.retryPreload(key);
    }
    console.log(`${PANEL_LOG} 面板重试失败任务 ${failedKeys.length} 个`);
}
