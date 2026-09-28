/**
 * 列表页批量操作 → JavDB **后台推送队列**（doc/31）。
 *
 * 需求：批量「收藏 / 已读 N星」写完本地后应**立即**推送 JavDB，而不是等用户日后打开详情页
 * 由评价状态校验补推；推送**在后台懒加载、慢慢进行、不阻塞**批量操作本身。
 *
 * 设计要点：
 * - **不阻塞**：`enqueueBatchPush` 同步返回，调用方（批量写库）不等待任何网络；
 * - **节流**：逐项串行，每项之间 `PACING_MS`（默认 900ms），避免批量打满站点被 CF 拦截；
 * - **失败重试**：每项最多尝试 `MAX_ATTEMPTS`（默认 2）次，重试项退回队尾，最终失败的计入统计；
 * - **复用既有原语**：`sync-common` 的 `postWantToWatch` / `postWatched` / `extractVideoId`
 *   —— 与「JHS ↔ JavDB 同步」面板走同一条 API 路径，不重复实现；
 * - **尊重设置**：`autoServerSync` 关闭时调用方不入队（见 lp-batch.tsx）；
 * - **兜底**：队列只活在当前页面，未推完就离开页面时，详情页的评价状态自动校验（方向 1/3）
 *   仍会在下次打开该影片时补齐 —— 不会造成「本地与服务器永久不一致」。
 */

import {
    deleteReview,
    extractVideoId,
    fetchPageHtml,
    findReviewIdInHtml,
    postWantToWatch,
    postWatched
} from '../setting/jhs-sync/sync-common';

import {
    cancelOpSyncRecord,
    listOpSyncRecords,
    setOpSyncState,
    upsertOpSync,
    type OpSyncKind,
    type OpSyncOrigin
} from '../setting/jhs-sync/op-sync-records';

/**
 * 需要推送的操作类型。
 *
 * - `favorite`：设为 JavDB 想看；
 * - `watched`：设为已看 + 评分；
 * - `unwatch`：删除 JavDB 评价记录（= 服务器侧的「取消已读」）。这是**破坏性远端操作**
 *   （会一并移除服务器上该影片的评价正文），仅在用户明确意图下使用，见 doc/31 §4。
 */
export type BatchPushKind = 'favorite' | 'watched' | 'unwatch';

/** 待推送的一项（本地已完成写入）。 */
export interface BatchPushItem {
    /** 番号（仅用于日志与统计）。 */
    carNum: string;
    /** 详情页 url（`/v/{id}`，用于提取 videoId）。 */
    url: string;
}

/** 队列内条目。 */
export interface BatchPushEntry extends BatchPushItem {
    kind: BatchPushKind;
    score: number;
    videoId: string;
    attempts: number;
}

/** 队列状态快照。 */
export interface BatchSyncStatus {
    /** 仍在队列中的项数（含待重试）。 */
    pending: number;
    /** 已成功推送数。 */
    succeeded: number;
    /** 最终失败数（重试耗尽）。 */
    failed: number;
    /** 是否有定时任务在跑。 */
    scheduled: boolean;
}

/** 两次推送之间的间隔（温和节流）。 */
const DEFAULT_PACING_MS = 900;

/** 单项最大尝试次数（含首次）。 */
const MAX_ATTEMPTS = 2;

/** 运行时 pacing（可被入队参数覆盖，便于测试）。 */
let pacingMs = DEFAULT_PACING_MS;

/** 待推送队列。 */
let queue: BatchPushEntry[] = [];

/** 定时器句柄（同一时刻最多一个）。 */
let timer: ReturnType<typeof setTimeout> | null = null;

/** 累计统计（一次连队跑完或停止时重置）。 */
const stats = { succeeded: 0, failed: 0 };

/**
 * 构造推送计划（**纯函数**，便于单测）：解析 videoId、过滤无法定位的项。
 *
 * @param items 待推送项（通常为刚写入 car_list 的记录）
 * @param kind 操作类型
 * @param score 评分（仅 `watched` 有效，0–5）
 * @returns 可入队条目 + 因缺少 videoId 被跳过的番号
 */
export function planBatchPush(
    items: BatchPushItem[],
    kind: BatchPushKind,
    score = 0
): { entries: BatchPushEntry[]; skipped: string[] } {
    const entries: BatchPushEntry[] = [];
    const skipped: string[] = [];
    for (const item of items) {
        const videoId = extractVideoId(item.url);
        if (!videoId) {
            skipped.push(item.carNum);
            continue;
        }
        entries.push({ carNum: item.carNum, url: item.url, kind, score, videoId, attempts: 0 });
    }
    return { entries, skipped };
}

/**
 * 入队并启动后台推送（**同步返回，不等待网络**）。
 *
 * @param items 待推送项
 * @param kind 操作类型
 * @param score 评分（仅 `watched` 有效）
 * @param options.pacingMs 覆盖节流间隔（测试用）
 * @returns 实际入队数
 */
export function enqueueBatchPush(
    items: BatchPushItem[],
    kind: BatchPushKind,
    score = 0,
    options?: { pacingMs?: number; origin?: OpSyncOrigin }
): number {
    if (options?.pacingMs !== undefined) pacingMs = options.pacingMs;
    const { entries, skipped } = planBatchPush(items, kind, score);
    if (skipped.length > 0) {
        clog.warn(`[列表页批量操作] ${skipped.length} 项缺少 videoId，跳过 JavDB 推送: ${skipped.join(', ')}`);
        // 记账（doc/38）：缺 videoId 也属「本地已写、网站未同步」，标 failed 在面板可见并可重试
        for (const carNum of skipped) {
            const item = items.find((i) => i.carNum === carNum);
            upsertOpSync({ carNum, url: item?.url ?? '', kind, score, origin: options?.origin ?? 'list' });
            setOpSyncState(carNum, kind, 'failed', { error: '缺少 videoId，无法定位详情页' });
        }
    }
    if (entries.length === 0) return 0;
    // 记账（doc/38）：入队即登记为「待推送」，供设置面板展示进度与状态
    for (const entry of entries) {
        upsertOpSync({
            carNum: entry.carNum,
            url: entry.url,
            kind: entry.kind,
            score: entry.score,
            origin: options?.origin ?? 'list'
        });
    }
    queue.push(...entries);
    schedule(0);
    return entries.length;
}

/** 当前队列状态快照。 */
export function getBatchSyncStatus(): BatchSyncStatus {
    return { pending: queue.length, succeeded: stats.succeeded, failed: stats.failed, scheduled: timer !== null };
}

/**
 * 停止后台推送并清空队列（插件销毁 / 页面卸载时调用）。
 * 未推完的项由详情页评价状态校验兜底补齐。
 */
export function stopBatchSync(): void {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
    const dropped = queue.length;
    if (dropped > 0) {
        clog.warn(`[列表页批量操作] 后台同步中止，剩余 ${dropped} 项交由详情页校验补推`);
    }
    queue = [];
    resetStats();
}

/** 仅在测试中重置模块状态（不改生产行为）。 */
export function resetBatchSyncForTest(): void {
    stopBatchSync();
    pacingMs = DEFAULT_PACING_MS;
}

/** 排队下一次执行（去重：同一时刻只挂一个定时器）。 */
function schedule(delay: number): void {
    if (timer !== null) return;
    timer = setTimeout(() => {
        timer = null;
        void step();
    }, delay);
}

/**
 * 执行单项推送。
 *
 * `unwatch` 需先拉详情页取 reviewId：服务器上本就无评价时直接视为已完成（不做多余请求）。
 *
 * @param entry 队列条目
 */
async function pushEntry(entry: BatchPushEntry): Promise<void> {
    if (entry.kind === 'favorite') {
        await postWantToWatch(entry.videoId);
        return;
    }
    if (entry.kind === 'watched') {
        await postWatched(entry.videoId, entry.score);
        return;
    }
    const html = await fetchPageHtml(`/v/${entry.videoId}`);
    const reviewId = findReviewIdInHtml(html);
    if (!reviewId) return; // 服务器上无评价记录 → 已是目标状态
    await deleteReview(entry.videoId, reviewId);
}

/** 处理一项：成功计入统计，失败退回队尾重试，重试耗尽则计失败。 */
async function step(): Promise<void> {
    const entry = queue.shift();
    if (!entry) {
        finish();
        return;
    }
    setOpSyncState(entry.carNum, entry.kind, 'running', { attempts: entry.attempts });
    try {
        await pushEntry(entry);
        stats.succeeded++;
        setOpSyncState(entry.carNum, entry.kind, 'success', { attempts: entry.attempts, error: '' });
        clog.log(`[列表页批量操作] 已同步 JavDB: ${entry.carNum}`);
    } catch (error: unknown) {
        entry.attempts++;
        const reason = error instanceof Error ? error.message : String(error);
        if (entry.attempts < MAX_ATTEMPTS) {
            queue.push(entry);
            setOpSyncState(entry.carNum, entry.kind, 'pending', { attempts: entry.attempts, error: reason });
            clog.warn(`[列表页批量操作] 同步失败将重试（${entry.attempts}/${MAX_ATTEMPTS}）: ${entry.carNum} — ${reason}`);
        } else {
            stats.failed++;
            setOpSyncState(entry.carNum, entry.kind, 'failed', { attempts: entry.attempts, error: reason });
            clog.error(`[列表页批量操作] 同步 JavDB 失败: ${entry.carNum} — ${reason}`);
        }
    }
    schedule(queue.length > 0 ? pacingMs : 0);
}

/** 队列清空后的收尾：汇总 toast（只在确实推过东西时提示）+ 统计重置。 */
function finish(): void {
    const { succeeded, failed } = stats;
    if (succeeded > 0 || failed > 0) {
        const msg =
            `后台同步 JavDB 完成：成功 ${succeeded} 项` + (failed > 0 ? `，失败 ${failed} 项（详见日志）` : '');
        if (failed > 0) {
            show.error(msg);
        } else {
            show.ok(msg);
        }
        clog.log(`[列表页批量操作] ${msg}`);
    }
    resetStats();
}

/** 重置累计统计。 */
function resetStats(): void {
    stats.succeeded = 0;
    stats.failed = 0;
}

/**
 * 记录类型 → 站点推送类型。
 *
 * 拉黑在站点侧等价于「已读 0 星」（与详情页 quickBlock 语义一致），
 * 因此映射为 `watched`。
 *
 * @param kind 记录类型
 * @returns 队列推送类型
 */
export function toBatchPushKind(kind: OpSyncKind): BatchPushKind {
    return kind === 'filter' ? 'watched' : kind;
}

/**
 * 从设置面板**重试**一条记录（doc/38）：重新入队，走与批量操作同一条推送路径。
 *
 * @param record 待重试记录
 * @returns 是否已入队（url 无法定位 videoId 时为 false）
 */
export function retryOpSync(record: {
    carNum: string;
    url: string;
    kind: OpSyncKind;
    score: number;
    origin: OpSyncOrigin;
}): boolean {
    const queued = enqueueBatchPush([{ carNum: record.carNum, url: record.url }], toBatchPushKind(record.kind), record.score, {
        origin: record.origin
    });
    return queued > 0;
}

/**
 * 从设置面板**重试全部失败记录**。
 *
 * @returns 实际入队条数
 */
export function retryFailedOpSync(): number {
    let queued = 0;
    for (const record of listOpSyncRecords({ states: ['failed'] })) {
        if (retryOpSync(record)) queued++;
    }
    return queued;
}

/**
 * 从设置面板**取消**一条记录：先从内存队列移除，再把记录置 `cancelled`。
 *
 * 注意：只影响同步记录（不再自动重推），**不回滚 car_list 里已写入的本地状态**
 * —— 本地状态是用户明确执行过的操作行为，不应因远端同步被取消而消失。
 *
 * @param carNum 番号
 * @param kind 操作类型
 * @returns 是否找到并取消了记录
 */
export function cancelOpSync(carNum: string, kind: OpSyncKind): boolean {
    queue = queue.filter((e) => !(e.carNum === carNum && e.kind === kind));
    return cancelOpSyncRecord(carNum, kind);
}

/**
 * 当前内存队列中是否仍有该（番号 × 操作）—— 面板用于区分「排队中」与「已随页面离开而中断」。
 *
 * @param carNum 番号
 * @param kind 操作类型
 */
export function isOpSyncQueued(carNum: string, kind: OpSyncKind): boolean {
    return queue.some((e) => e.carNum === carNum && e.kind === kind);
}
