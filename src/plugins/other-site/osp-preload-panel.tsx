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
