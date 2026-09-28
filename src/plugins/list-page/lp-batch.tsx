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

import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION, NO, YES } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';
import { getActressNames } from '../../core/util/site/actress-links';
import { injectStatusTag } from '../../core/util/util-status-tag';
import type { CarSaveInput } from '../../core/storage/car-list-ops';

import {
    LpBatchCheckbox,
    LpBatchSideBar,
    LpBatchToolbar
} from '../../components/list-page/lp-batch-bar';

import type { ListPagePlugin } from '../list-page-plugin';
import {
    BatchSelection,
    planFavoriteBatch,
    planFilterBatch,
    planUnwatchBatch,
    planWatchedBatch
} from './lp-batch-state';
import type { BatchActionKind, BatchItemInfo, BatchPlan } from './lp-batch-state';
import { enqueueBatchPush, stopBatchSync } from './lp-batch-sync';
import type { BatchPushKind } from './lp-batch-sync';

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
 * 左侧常驻竖排栏容器类名 —— 导出供其它插件**停靠**自己的按钮到同一列
 * （如 AutoPagePlugin 的「加载全部」；停靠方补 `is-docked` 自定义样式）。
 */
export const BATCH_SIDE_CLASS = 'jhs-lp-batch-side';

/** 侧栏内「选择组槽位」类名（刷新只重写槽位内容，不碰外部停靠按钮）。 */
export const BATCH_SIDE_SLOT_CLASS = 'jhs-lp-batch-side-select';

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
        | 'request-list';
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
    renderSideBar();
    renderActionBar();
}

/**
 * 渲染／刷新左侧常驻竖排栏。
 *
 * 容器（`.jhs-lp-batch-side`）与「选择组槽位」分离：刷新只重写**槽位内容**，
 * 其它插件停靠在容器里的按钮（如 AutoPagePlugin 的「加载全部」）作为容器兄弟节点
 * **不会被冲掉**（v1.46.27 的教训：直接重写容器 innerHTML 会清掉外部子节点）。
 */
function renderSideBar(): void {
    if (!sideEl) {
        sideEl = document.createElement('div');
        sideEl.className = BATCH_SIDE_CLASS;
        document.body.appendChild(sideEl);
    }
    ensureBatchSideSlot(sideEl, jsxToString(<LpBatchSideBar hasSelection={selection.size > 0} />));
}

/**
 * 确保侧栏内的「选择组槽位」就绪并写入选择组 HTML。
 *
 * 槽位固定为容器的**首个**子节点；外部停靠按钮追加在后面，刷新时不受影响。
 *
 * @param container 侧栏容器
 * @param html 选择组 HTML（由 `LpBatchSideBar` 渲染）
 * @returns 槽位元素
 */
export function ensureBatchSideSlot(container: HTMLElement, html: string): HTMLElement {
    let slot = container.querySelector<HTMLElement>('.' + BATCH_SIDE_SLOT_CLASS);
    if (!slot) {
        slot = document.createElement('div');
        slot.className = BATCH_SIDE_SLOT_CLASS;
        container.prepend(slot);
    }
    slot.innerHTML = html;
    return slot;
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
        const carNums = selection.list();
        const carList = await storageManager.getCarList();
        if (kind === 'favorite') {
            const favorites = carList.filter((car) => car.status === FAVORITE_ACTION).map((car) => car.carNum);
            await applyPlan(planFavoriteBatch(carNums, infoByCarNum, favorites), '收藏', {
                kind: 'favorite',
                score: 0
            });
        } else if (kind === 'watched') {
            await applyPlan(planWatchedBatch(carNums, infoByCarNum, score), `已读 ${score}星`, {
                kind: 'watched',
                score
            });
        } else if (kind === 'filter') {
            const filtered = carList.filter((car) => car.status === FILTER_ACTION).map((car) => car.carNum);
            await applyPlan(planFilterBatch(carNums, infoByCarNum, filtered), '拉黑', {
                kind: 'favorite',
                score: 0
            });
        } else {
            const watched = carList.filter((car) => car.status === HAS_WATCH_ACTION).map((car) => car.carNum);
            const plan = planUnwatchBatch(carNums, watched);
            const changed = plan.carNums.length
                ? await storageManager.clearCarWatchStatus(plan.carNums)
                : 0;
            // 取消已读的服务端对应操作是**删除评价记录**（破坏性远端操作，见 doc/31 §4）
            let unwatchQueued = 0;
            if (plan.carNums.length > 0) {
                const targets: CarSaveInput[] = [];
                for (const carNum of plan.carNums) {
                    const info = infoByCarNum.get(carNum);
                    if (info) targets.push({ carNum: info.carNum, url: info.url });
                }
                unwatchQueued = await enqueueIfServerSyncEnabled(targets, { kind: 'unwatch', score: 0 });
            }
            reportResult('取消已读', changed, plan.skipped.length, 0, unwatchQueued);
        }
        await refreshAfterBatch(plugin);
    } catch (error: unknown) {
        show.error('批量操作失败: ' + (error instanceof Error ? error.message : String(error)));
        clog.error(`${BATCH_LOG} 批量操作失败`, error);
    } finally {
        busy = false;
        renderBatchToolbar();
    }
}

/**
 * 执行写入计划并汇报结果。
 *
 * @param plan 写入计划
 * @param label 结果文案前缀
 * @param push 需要后台推送到 JavDB 时给出操作类型与评分（**不阻塞**，立即返回）
 */
async function applyPlan(
    plan: BatchPlan,
    label: string,
    push?: { kind: BatchPushKind; score: number }
): Promise<void> {
    if (plan.inputs.length > 0) {
        await storageManager.saveCarList(plan.inputs);
    }
    // 本地已写入成功 → 入队后台推送（节流串行、带重试，不等待网络）
    let queued = 0;
    if (push && plan.inputs.length > 0) {
        queued = await enqueueIfServerSyncEnabled(plan.inputs, push);
    }
    reportResult(label, plan.inputs.length, plan.skipped.length, plan.missing.length, queued);
}

/**
 * 按 `autoServerSync` 设置决定是否入队后台推送（与详情页评价校验同一开关，默认开启）。
 *
 * @param inputs 刚写入的记录
 * @param push 操作类型与评分
 * @returns 实际入队数（设置关闭或无有效 videoId 时为 0）
 */
async function enqueueIfServerSyncEnabled(
    inputs: CarSaveInput[],
    push: { kind: BatchPushKind; score: number }
): Promise<number> {
    try {
        if ((await storageManager.getSetting('autoServerSync', YES)) === NO) {
            clog.log(`${BATCH_LOG} autoServerSync 已关闭，跳过 JavDB 推送`);
            return 0;
        }
    } catch {
        // 读设置失败按开启处理（与详情页校验的默认一致）
    }
    return enqueueBatchPush(
        inputs.map((input) => ({ carNum: input.carNum, url: String(input.url ?? '') })),
        push.kind,
        push.score
    );
}

/** 汇报批量结果（成功/跳过分别说明原因）。 */
function reportResult(
    label: string,
    done: number,
    skipped: number,
    missing: number,
    syncQueued = 0
): void {
    const parts = [`${label} ${done} 项`];
    if (skipped > 0) parts.push(`跳过 ${skipped} 项（已是目标状态）`);
    if (missing > 0) parts.push(`跳过 ${missing} 项（卡片信息缺失）`);
    if (syncQueued > 0) parts.push(`已提交后台同步 JavDB ${syncQueued} 项`);
    const msg = parts.join('，');
    if (done > 0) {
        show.ok(msg);
    } else {
        show.info(msg);
    }
    clog.log(`${BATCH_LOG} ${msg}`);
}

/** 写入完成后刷新：清空选择、重建勾选框、重新过滤（刷新状态标签）+ 刷新星级索引。 */
async function refreshAfterBatch(plugin: ListPagePlugin): Promise<void> {
    selection.clear();
    infoByCarNum.clear();
    await plugin.doFilter();
    syncBatchCheckboxes(plugin);
    renderBatchToolbar();
    const stf = plugin.getBean('StatusTagFilterPlugin');
    if (stf) {
        await stf.warmScoreIndex();
    }
}
