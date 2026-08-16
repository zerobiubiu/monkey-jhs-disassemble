/**
 * 同步引擎核心（doc/214）。
 *
 * 设计目标：支持 5 万+ 条目级别的双向增量同步。
 * - 分页抓取：逐页抓取 JavDB 想看/已看列表，每页后保存 checkpoint
 * - 断点续接：关闭页面/弹窗后下次打开从断点继续
 * - 后台处理：引擎在模块级 setInterval 中运行，不依赖弹窗可见性
 * - 中途退出：每次 tick 后保存进度，abort 仅停止 interval 不清除进度
 *
 * 生命周期：
 *   startSync() → setInterval(tick, interval) → tick 推进 phase → done/error
 *   pauseSync() → clearInterval（进度保留）
 *   resumeSync() → 从 loadSession() 恢复 → setInterval
 *   resetSync() → clearSession + 重置 UI
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../../constants/status';

import type { SyncConflict, SyncOp, SyncSession } from './sync-session';
import {
    clearSession,
    createSession,
    isResumable,
    loadSession,
    saveSession
} from './sync-session';

import {
    extractVideoId,
    fetchPageHtml,
    postWantToWatch,
    postWatched,
    readRatingCacheMap,
    SYNC_PAGE_LIMIT
} from './sync-common';

/** 引擎状态变更回调（供 UI 层订阅）。 */
export type SyncListener = (session: SyncSession) => void;

/** 模块级引擎状态。 */
let session: SyncSession = createSession();
let timer: ReturnType<typeof setInterval> | null = null;
let listeners: SyncListener[] = [];
/** 当前 tick 是否正在执行（防重入）。 */
let ticking = false;

/** 订阅引擎状态变更。返回取消订阅函数。 */
export function onSyncChange(fn: SyncListener): () => void {
    listeners.push(fn);
    return () => {
        listeners = listeners.filter((l) => l !== fn);
    };
}

/** 通知所有监听器。 */
function emit(): void {
    for (const fn of listeners) fn(session);
}

/** 获取当前会话快照（只读）。 */
export function getSession(): Readonly<SyncSession> {
    return session;
}

/** 引擎是否正在运行。 */
export function isRunning(): boolean {
    return timer !== null;
}

/** 是否有可恢复的未完成会话。 */
export function hasResumableSession(): boolean {
    const saved = loadSession();
    return saved !== null && isResumable(saved);
}

// ─── 分页抓取辅助 ───────────────────────────────────────────────

/** 抓取单页，返回 [videoId, carNum][] 和下一页 URL。 */
async function fetchOnePage(
    url: string
): Promise<{ entries: [string, string][]; nextUrl: string | null }> {
    const absUrl = new URL(url, window.location.origin).href;
    const html = await fetchPageHtml(absUrl);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const entries: [string, string][] = [];
    doc.querySelectorAll('.movie-list .item').forEach((item) => {
        const a = item.querySelector('a[href*="/v/"]');
        const strong = item.querySelector('.video-title strong');
        if (!a) return;
        const m = (a.getAttribute('href') || '').match(/\/v\/([^/?#]+)/);
        if (!m) return;
        entries.push([m[1], strong ? (strong.textContent || '').trim() : '']);
    });
    const next = doc.querySelector('a.pagination-next');
    const nextUrl = next ? next.getAttribute('href') : null;
    return { entries, nextUrl };
}

// ─── 对比逻辑 ───────────────────────────────────────────────

/** 构建对比队列（compare 阶段）。 */
async function buildQueue(): Promise<void> {
    const carList = await storageManager.getCarList();
    const ratingCache = await readRatingCacheMap();

    const javdbWantMap = new Map(session.javdbWant);
    const javdbWatchedMap = new Map(session.javdbWatched);

    // JHS 侧索引
    const jhsWantByVideoId = new Map<string, string>();
    const jhsWatchedByVideoId = new Map<string, string>();
    for (const car of carList) {
        const vid = extractVideoId(car.url);
        if (!vid) continue;
        if (car.status === FAVORITE_ACTION) jhsWantByVideoId.set(vid, car.carNum);
        else if (car.status === HAS_WATCH_ACTION) jhsWatchedByVideoId.set(vid, car.carNum);
    }

    const queue: SyncOp[] = [];
    const conflicts: SyncConflict[] = [];
    let skipped = 0;

    // 方向 1：JHS 想看 → JavDB
    for (const [vid, carNum] of jhsWantByVideoId) {
        if (javdbWantMap.has(vid)) { skipped++; continue; }
        if (javdbWatchedMap.has(vid)) {
            conflicts.push({ carNum, jhsStatus: '想看', javdbStatus: '已看' });
            continue;
        }
        queue.push({ carNum, videoId: vid, action: 'want-to-javdb' });
    }

    // 方向 2：JHS 已看 → JavDB（含评分）
    for (const car of carList) {
        if (car.status !== HAS_WATCH_ACTION) continue;
        const vid = extractVideoId(car.url);
        if (!vid) continue;
        if (javdbWatchedMap.has(vid)) { skipped++; continue; }
        if (javdbWantMap.has(vid)) {
            conflicts.push({ carNum: car.carNum, jhsStatus: '已看', javdbStatus: '想看' });
            continue;
        }
        const score = (typeof car.score === 'number' && car.score > 0)
            ? car.score
            : (ratingCache.get(car.carNum) ?? 0);
        queue.push({ carNum: car.carNum, videoId: vid, action: 'watched-to-javdb', score });
    }

    // 方向 3：JavDB 想看 → JHS
    for (const [vid, carNum] of javdbWantMap) {
        if (!carNum) continue;
        if (jhsWantByVideoId.has(vid)) { skipped++; continue; }
        if (jhsWatchedByVideoId.has(vid)) {
            conflicts.push({ carNum, jhsStatus: '已看', javdbStatus: '想看' });
            continue;
        }
        queue.push({ carNum, videoId: vid, action: 'want-from-javdb' });
    }

    // 方向 4：JavDB 已看 → JHS
    for (const [vid, carNum] of javdbWatchedMap) {
        if (!carNum) continue;
        if (jhsWatchedByVideoId.has(vid)) { skipped++; continue; }
        if (jhsWantByVideoId.has(vid)) {
            conflicts.push({ carNum, jhsStatus: '想看', javdbStatus: '已看' });
            continue;
        }
        queue.push({ carNum, videoId: vid, action: 'watched-from-javdb' });
    }

    session.queue = queue;
    session.queueDone = 0;
    session.skipped = skipped;
    session.conflicts = conflicts;
    session.phase = 'execute';
    saveSession(session);
    emit();
}

// ─── 执行单条操作 ───────────────────────────────────────────────

async function executeOp(op: SyncOp): Promise<void> {
    switch (op.action) {
        case 'want-to-javdb':
            await postWantToWatch(op.videoId);
            break;
        case 'watched-to-javdb':
            await postWatched(op.videoId, op.score ?? 0);
            break;
        case 'want-from-javdb':
            await storageManager.saveCar({
                carNum: op.carNum,
                url: `/v/${op.videoId}`,
                actionType: FAVORITE_ACTION
            });
            break;
        case 'watched-from-javdb':
            await storageManager.saveCar({
                carNum: op.carNum,
                url: `/v/${op.videoId}`,
                actionType: HAS_WATCH_ACTION,
                score: 0
            });
            break;
    }
}

// ─── Tick 驱动 ───────────────────────────────────────────────

/** 每次 tick 推进一个最小工作单元。 */
async function tick(): Promise<void> {
    if (ticking) return;
    ticking = true;
    try {
        switch (session.phase) {
            case 'fetch-want': {
                const startUrl = session.wantPage === 0
                    ? '/users/want_watch_videos'
                    : `/users/want_watch_videos?page=${session.wantPage + 1}`;
                if (session.wantPage >= SYNC_PAGE_LIMIT) {
                    session.phase = 'fetch-watched';
                    saveSession(session);
                    emit();
                    break;
                }
                const { entries, nextUrl } = await fetchOnePage(startUrl);
                session.javdbWant.push(...entries);
                session.wantPage++;
                if (!nextUrl || entries.length === 0) {
                    session.phase = 'fetch-watched';
                }
                saveSession(session);
                emit();
                break;
            }
            case 'fetch-watched': {
                const startUrl = session.watchedPage === 0
                    ? '/users/watched_videos'
                    : `/users/watched_videos?page=${session.watchedPage + 1}`;
                if (session.watchedPage >= SYNC_PAGE_LIMIT) {
                    session.phase = 'compare';
                    saveSession(session);
                    emit();
                    break;
                }
                const { entries, nextUrl } = await fetchOnePage(startUrl);
                session.javdbWatched.push(...entries);
                session.watchedPage++;
                if (!nextUrl || entries.length === 0) {
                    session.phase = 'compare';
                }
                saveSession(session);
                emit();
                break;
            }
            case 'compare': {
                await buildQueue();
                break;
            }
            case 'execute': {
                if (session.queueDone >= session.queue.length) {
                    session.phase = 'done';
                    saveSession(session);
                    emit();
                    stopTimer();
                    break;
                }
                const op = session.queue[session.queueDone];
                try {
                    await executeOp(op);
                    session.synced++;
                } catch (err) {
                    session.failed.push(
                        `${op.carNum}（${err instanceof Error ? err.message : '失败'}）`
                    );
                }
                session.queueDone++;
                // 每 10 条保存一次 checkpoint（减少 localStorage 写入频率）
                if (session.queueDone % 10 === 0 || session.queueDone >= session.queue.length) {
                    saveSession(session);
                }
                emit();
                break;
            }
            default:
                stopTimer();
                break;
        }
    } catch (err) {
        session.phase = 'error';
        session.errorMsg = err instanceof Error ? err.message : String(err);
        saveSession(session);
        emit();
        stopTimer();
    } finally {
        ticking = false;
    }
}

// ─── 公开控制 API ───────────────────────────────────────────────

/** 启动新同步（清除旧会话）。 */
export function startSync(interval: number): void {
    stopTimer();
    session = createSession();
    session.phase = 'fetch-want';
    saveSession(session);
    emit();
    timer = setInterval(() => void tick(), interval);
}

/** 从断点恢复同步。 */
export function resumeSync(interval: number): boolean {
    const saved = loadSession();
    if (!saved || !isResumable(saved)) return false;
    stopTimer();
    session = saved;
    emit();
    timer = setInterval(() => void tick(), interval);
    return true;
}

/** 暂停同步（保留进度，可恢复）。 */
export function pauseSync(): void {
    stopTimer();
    saveSession(session);
    emit();
}

/** 中止并清除会话（不可恢复）。 */
export function resetSync(): void {
    stopTimer();
    session = createSession();
    clearSession();
    emit();
}

/** 停止 interval。 */
function stopTimer(): void {
    if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
}

/** 获取进度百分比（0-100）。 */
export function getProgress(): number {
    switch (session.phase) {
        case 'idle': return 0;
        case 'fetch-want': return Math.min(10, session.wantPage * 0.5);
        case 'fetch-watched': return 10 + Math.min(10, session.watchedPage * 0.5);
        case 'compare': return 20;
        case 'execute': {
            const total = session.queue.length || 1;
            return 20 + Math.round((session.queueDone / total) * 80);
        }
        case 'done': return 100;
        case 'error': return -1;
        default: return 0;
    }
}

/** 获取当前阶段的人类可读描述。 */
export function getPhaseLabel(): string {
    switch (session.phase) {
        case 'idle': return '就绪';
        case 'fetch-want': return `抓取 JavDB 想看列表（第 ${session.wantPage} 页，已获 ${session.javdbWant.length} 条）`;
        case 'fetch-watched': return `抓取 JavDB 已看列表（第 ${session.watchedPage} 页，已获 ${session.javdbWatched.length} 条）`;
        case 'compare': return '对比中…';
        case 'execute': return `执行同步 ${session.queueDone}/${session.queue.length}（成功 ${session.synced}，失败 ${session.failed.length}）`;
        case 'done': return `同步完成：成功 ${session.synced}，失败 ${session.failed.length}，跳过 ${session.skipped}，冲突 ${session.conflicts.length}`;
        case 'error': return `错误：${session.errorMsg || '未知'}`;
        default: return '';
    }
}
