/**
 * 列表页勾选式批量操作 —— 编排层（doc/27）。
 *
 * 能力：卡片勾选框（勾选后出现底部工具栏）+ 三项批量写入
 * **收藏 / 已读 0–5★ / 取消已读**。
 *
 * 数据安全边界：
 * - 收藏：已在收藏列表的番号**跳过**（存储层对重复收藏会抛错），不覆盖原记录；
 * - 已读：写 `status = 已读` + `score`（存储层对重复已读不抛错，可用来改星）；
 * - 取消已读：只把 `status` 置回未标记，**保留记录与 url/names/remark/score**（不删数据）。
 *
 * 状态为模块级（单页单列表）：勾选集合 + 卡片信息表；`destroyBatchToolbar` 负责清理。
 */

import { jsxToString } from '../../core/jsx-to-string';
import { getActressNames } from '../../core/util/site/actress-links';
import { injectStatusTag } from '../../core/util/util-status-tag';

import type { BatchListItem } from '../../types/batch-lists';

import type { ListPagePlugin } from '../list-page-plugin';
import { executeBatchRating } from './lp-batch-actions';
import { BatchSelection } from './lp-batch-state';
import type { BatchActionKind, BatchItemInfo } from './lp-batch-state';
import { stopBatchSync } from './lp-batch-sync';
import { openBatchListDialog } from './batch-lists/dialog';
import { startBatchListRecovery } from './batch-lists/recovery';
import { extractVideoId } from '../setting/jhs-sync/sync-common';

import { LpBatchCheckbox, LpBatchSideBar, LpBatchToolbar } from '../../components/list-page/lp-batch-bar';

/** 日志前缀。 */
const BATCH_LOG = '[列表页批量操作]';

/**
 * 「请求列表」开关事件名：由左侧常驻竖排栏派发，OtherSitePlugin 监听后开关面板。
 * 用 DOM 自定义事件解耦，避免跨插件 import 循环。
 */
export const PRELOAD_QUEUE_TOGGLE_EVENT = 'jhs:toggle-preload-queue';

/** 勾选框类名（注入到卡片，复用 status-tag 的注入点）。 */
const ITEM_CLASS = 'jhs-lp-batch-item';

/** 工具栏外层类名（固定定位容器）。 */
const BAR_LAYER_CLASS = 'jhs-lp-batch-layer';
/**
 * 左侧常驻竖排栏容器类名 —— 导出供其它插件**停靠**自己的按钮到同一组
 * （首页「每周推荐」居首，其后为 AutoPagePlugin 的「加载全部」及选择组；
 * 停靠方自备 `is-docked` 样式，并**显式复位**浮层几何）。
 */
export const BATCH_SIDE_CLASS = 'jhs-lp-batch-side';

/** 内部简写（保持既有引用不变）。 */
const SIDE_CLASS = BATCH_SIDE_CLASS;

/** 勾选状态。 */
const selection = new BatchSelection();

/** 番号（小写）→ 卡片信息（批量写入所需）。 */
const infoByCarNum = new Map<string, BatchItemInfo>();

/** 是否正在执行批量写入。 */
let busy = false;

/** 工具栏容器（勾选数为 0 时移除）。 */
let barEl: HTMLElement | null = null;
/** 左侧常驻竖排选择组容器。 */
let sideEl: HTMLElement | null = null;

/** 是否已绑定全局委托监听。 */
let listenerBound = false;

/** 当前活跃插件（委托监听里回调渲染用）。 */
let activePlugin: ListPagePlugin | null = null;
let stopRecovery: (() => void) | null = null;

/**
 * 初始化批量操作 UI：绑定委托 + 注入勾选框 + 渲染工具栏。
 * 幂等（重复调用只刷新卡片态）。
 *
 * @param plugin ListPagePlugin 实例
 */
export function initBatchToolbar(plugin: ListPagePlugin): void {
    activePlugin = plugin;
    bindBatchEvents();
    syncBatchCheckboxes(plugin);
    renderBatchToolbar();
    stopRecovery ??= startBatchListRecovery();
}

/**
 * 同步卡片勾选框：补齐缺失的勾选框、刷新勾选态、缓存卡片信息。
 * 列表 DOM 变化（瀑布流新卡片/过滤重排）后调用。
 *
 * @param plugin ListPagePlugin 实例
 */
export function syncBatchCheckboxes(plugin: ListPagePlugin): void {
    $(plugin.getSelector().itemSelector).each((_index: number, el: Element) => {
        const $item = $(el);
        let info: { carNum: string; url: string; publishTime: string };
        try {
            info = plugin.findCarNumAndHref($item);
        } catch {
            return; // 番号解析失败，跳过该卡片
        }
        if (!info.carNum) return;
        const key = info.carNum.trim().toLowerCase();
        if (!infoByCarNum.has(key)) {
            infoByCarNum.set(key, {
                carNum: info.carNum,
                url: info.url,
                publishTime: info.publishTime,
                names: getActressNames(el) || undefined
            });
        }
        if ($item.find('.' + ITEM_CLASS).length === 0) {
            injectStatusTag(
                $item,
                jsxToString(
                    <LpBatchCheckbox
                        carNum={info.carNum}
                        checked={selection.has(info.carNum)}
                        label={info.carNum}
                    />
                )
            );
        }
        const checked = selection.has(info.carNum);
        $item.find('.' + ITEM_CLASS).toggleClass('is-checked', checked);
        $item.find('.' + ITEM_CLASS + ' .jhs-lp-batch-checkbox').prop('checked', checked);
    });
}

/** 销毁批量操作 UI（清监听 + 移除工具栏 + 清状态）。 */
export function destroyBatchToolbar(): void {
    if (listenerBound) {
        document.removeEventListener('click', onDocumentClick);
        listenerBound = false;
    }
    // 终止后台 JavDB 同步队列（未推完的项由详情页校验兜底补齐）
    stopBatchSync();
    stopRecovery?.();
    stopRecovery = null;
    barEl?.remove();
    barEl = null;
    selection.clear();
    infoByCarNum.clear();
    activePlugin = null;
}

/** 绑定全局委托监听（一次）。 */
function bindBatchEvents(): void {
    if (listenerBound) return;
    document.addEventListener('click', onDocumentClick);
    listenerBound = true;
}

/**
 * 判定元素是否属于本插件的批量 UI（浮出操作条或左侧常驻竖排栏内）。
 *
 * 抽成纯函数是因为：新增容器时极易漏掉白名单，导致按钮“点了没反应”
 * （v1.46.27 实际踩到过：侧栏按钮未列入白名单）。
 *
 * @param el 目标元素
 * @returns 是否在本插件容器内
 */
export function isBatchUiControl(el: Element | null): boolean {
    if (!el) return false;
    return el.closest('.' + BAR_LAYER_CLASS + ', .' + SIDE_CLASS) !== null;
}

/** 委托点击：卡片勾选框切换 / 工具栏动作。 */
function onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const boxEl = target.closest<HTMLElement>('.' + ITEM_CLASS);
    if (boxEl) {
        // 勾选框在 <a> 内：必须阻止默认行为与冒泡，否则会打开详情页
        event.preventDefault();
        event.stopPropagation();
        toggleItem(boxEl);
        return;
    }
    const btn = target.closest<HTMLElement>('[data-act]');
    if (btn && isBatchUiControl(btn) && !btn.hasAttribute('disabled')) {
        event.preventDefault();
        handleBarAction(btn);
    }
}

/** 切换单张卡片的勾选态。 */
function toggleItem(boxEl: HTMLElement): void {
    if (busy) return;
    const carNum = boxEl.dataset.carNum ?? '';
    if (!carNum) return;
    const checked = selection.toggle(carNum);
    $(boxEl).toggleClass('is-checked', checked);
    $(boxEl).find('.jhs-lp-batch-checkbox').prop('checked', checked);
    renderBatchToolbar();
}

/**
 * 收集**当前可见**卡片的番号（供「全选 / 反选」与计数）。
 *
 * 只算真正参与布局的卡片：被状态标签筛选 / 屏蔽 / 预加载筛选等插件隐藏
 * （`display: none`）的卡片**不纳入**——用户看不见的项不应被批量选中或写入。
 *
 * 可见性判定：卡片本体（`.jhs-lp-batch-item` 的宿主 `.item`）若 `offsetParent === null`
 * 则不参与布局；再配合 `getClientRects().length` 兜底（祖先 `display:none` 时也为 0）。
 *
 * @returns 番号列表（DOM 顺序）
 */
function collectVisibleCheckboxCarNums(): string[] {
    const carNums: string[] = [];
    for (const box of Array.from(document.querySelectorAll<HTMLElement>('.' + ITEM_CLASS))) {
        const carNum = box.dataset.carNum;
        if (!carNum) continue;
        const item = box.closest('.item') as HTMLElement | null;
        if (item && (item.offsetParent === null || item.getClientRects().length === 0)) continue;
        carNums.push(carNum);
    }
    return carNums;
}

/** 处理工具栏按钮动作。 */
function handleBarAction(btn: HTMLElement): void {
    const plugin = activePlugin;
    if (!plugin) return;
    const act = (btn.dataset.act ?? '') as
        | BatchActionKind
        | 'clear'
        | 'select-all'
        | 'invert'
        | 'filter'
        | 'lists'
        | 'request-list';
    if (busy) return;
    if (act === 'lists') {
        void runListBatch();
        return;
    }
    if (act === 'request-list') {
        // 请求列表属 other-site 预加载功能：经自定义事件解耦（避免跨插件 import）
        document.dispatchEvent(new CustomEvent(PRELOAD_QUEUE_TOGGLE_EVENT));
        return;
    }
    if (act === 'clear' || act === 'select-all' || act === 'invert') {
        if (act === 'clear') selection.clear();
        else if (act === 'select-all') selection.addAll(collectVisibleCheckboxCarNums());
        else selection.invert(collectVisibleCheckboxCarNums());
        syncBatchCheckboxes(plugin);
        renderBatchToolbar();
        return;
    }
    if (act !== 'favorite' && act !== 'watched' && act !== 'unwatch' && act !== 'filter') return;
    const score = Number(btn.dataset.score ?? 0);
    runBatch(plugin, act, isNaN(score) ? 0 : score).then();
}

/**
 * 渲染两块批量操作 UI：
 * - **侧栏**（`.jhs-lp-batch-side`）：常驻竖排在视频流左侧、屏幕中部，不随视频流滚动 ——
 *   「请求列表 / 全选 / 反选 / 清空」这类**不依赖已选项**的操作；
 * - **浮出操作条**（`.jhs-lp-batch-bar`）：选中 > 0 时从底部浮出 —— 收藏 / 已读 / 拉黑 /
 *   五星这类**针对已选视频内容**的操作，随选择出现符合交互直觉。
 */
function renderBatchToolbar(): void {
    ensureBatchSideBar(ensureBatchSideBarContainer());
    renderActionBar();
}

/**
 * 获取／创建左侧常驻侧栏容器，供批量操作和首页推荐共用。
 *
 * 选择组是**静态结构**（只有「清空」的可用性会变），因此**只首次渲染一次**，
 * 之后仅同步动态态 —— 刻意不再重写 innerHTML：否则其它插件**停靠进本组**的按钮
 * （如首页推荐和 AutoPagePlugin 的「加载全部」）会被每次刷新冲掉。
 */
export function ensureBatchSideBarContainer(): HTMLElement {
    if (!sideEl?.isConnected) {
        sideEl = document.querySelector<HTMLElement>('.' + BATCH_SIDE_CLASS) ?? document.createElement('div');
        sideEl.className = BATCH_SIDE_CLASS;
        document.body.appendChild(sideEl);
    }
    return sideEl;
}

/**
 * 确保侧栏容器已被渲染（只首次写入选择组「请求列表 / 全选 / 反选 / 清空」），
 * 并同步动态态（「清空」在无选择时禁用）。
 *
 * 已渲染时**不触碰其它子节点**，因此停靠进本组的按钮（首页推荐、加载全部等）
 * 可长期存活；相对顺序由停靠方维护。
 *
 * @param container 侧栏容器（`.jhs-lp-batch-side`）
 * @returns 容器本身
 */
export function ensureBatchSideBar(container: HTMLElement): HTMLElement {
    // 选择组缺失（首次/被外部清空）才重建；停靠按钮不在重建条件内
    if (!container.querySelector('[data-act="request-list"]')) {
        container.insertAdjacentHTML(
            'beforeend',
            jsxToString(<LpBatchSideBar hasSelection={selection.size > 0} />)
        );
    }
    const clearBtn = container.querySelector<HTMLButtonElement>('[data-act="clear"]');
    if (clearBtn) clearBtn.disabled = selection.size === 0;
    return container;
}

/** 渲染／移除浮出操作条（勾选为 0 时移除）。 */
function renderActionBar(): void {
    if (selection.size === 0) {
        barEl?.remove();
        barEl = null;
        return;
    }
    if (!barEl) {
        barEl = document.createElement('div');
        barEl.className = BAR_LAYER_CLASS;
        document.body.appendChild(barEl);
    }
    barEl.innerHTML = jsxToString(
        <LpBatchToolbar count={selection.size} busy={busy} />
    );
    bindStarPreview(barEl);
}

/**
 * 绑定星星悬停预览（与详情页快捷评分条一致的行为）。
 *
 * 指针进入第 N 颗时，**第 N 颗及其前面所有**都加 `is-preview`（`index < score`），
 * 离开整个星级容器时全部清除 —— 之前的 CSS-only `:hover` 只会亮悬停的那一颗，不正确。
 *
 * 每次渲染都是新元素，监听器随旧元素回收（不会重复叠加）。
 *
 * @param container 操作条容器（`.jhs-lp-batch-layer`）
 */
function bindStarPreview(container: HTMLElement): void {
    const starsEl = container.querySelector<HTMLElement>('.jhs-stars');
    if (!starsEl) return;
    const stars = Array.from(starsEl.querySelectorAll<HTMLElement>('.jhs-star'));
    starsEl.addEventListener('pointerover', (event: Event) => {
        const star = (event.target as HTMLElement).closest<HTMLElement>('.jhs-star');
        if (!star) return;
        const score = Number(star.dataset.score ?? 0);
        stars.forEach((el, index) => el.classList.toggle('is-preview', index < score));
    });
    starsEl.addEventListener('pointerleave', () => {
        stars.forEach((el) => el.classList.remove('is-preview'));
    });
}

/**
 * 执行批量写入。
 *
 * @param plugin ListPagePlugin 实例
 * @param kind 操作类型
 * @param score 已读星级（0–5，仅 kind === 'watched' 时使用）
 */
async function runBatch(plugin: ListPagePlugin, kind: BatchActionKind, score = 0): Promise<void> {
    if (busy || selection.size === 0) return;
    busy = true;
    renderBatchToolbar();
    try {
        await executeBatchRating(selection.list(), infoByCarNum, kind, score);
        await refreshAfterBatch(plugin);
    } catch (error: unknown) {
        show.error('批量操作失败: ' + (error instanceof Error ? error.message : String(error)));
        clog.error(`${BATCH_LOG} 批量操作失败`, error);
    } finally {
        busy = false;
        renderBatchToolbar();
    }
}

/** 锁住当前选择快照，弹窗内部负责预写、网站确认和失败重试。 */
async function runListBatch(): Promise<void> {
    if (busy || selection.size === 0) return;
    const plugin = activePlugin;
    busy = true;
    renderBatchToolbar();
    try {
        const items: BatchListItem[] = selection.list().map((key) => {
            const info = infoByCarNum.get(key);
            const videoId = extractVideoId(info?.url);
            if (!info || !videoId) throw new Error(`无法定位视频 ${key}，请刷新卡片后重新选择`);
            return { ...info, videoId };
        });
        await openBatchListDialog(items);
        if (plugin && activePlugin === plugin) await refreshAfterBatch(plugin, false);
    } catch (error: unknown) {
        show.error('批量清单操作失败：' + (error instanceof Error ? error.message : String(error)));
        clog.error(`${BATCH_LOG} 批量清单操作失败`, error);
    } finally {
        busy = false;
        renderBatchToolbar();
    }
}

/** 写入完成后刷新：清空选择、重建勾选框、重新过滤（刷新状态标签）+ 刷新星级索引。 */
async function refreshAfterBatch(plugin: ListPagePlugin, clearSelection = true): Promise<void> {
    if (clearSelection) selection.clear();
    infoByCarNum.clear();
    await plugin.doFilter();
    syncBatchCheckboxes(plugin);
    renderBatchToolbar();
    const stf = plugin.getBean('StatusTagFilterPlugin');
    if (stf) {
        await stf.warmScoreIndex();
    }
}
