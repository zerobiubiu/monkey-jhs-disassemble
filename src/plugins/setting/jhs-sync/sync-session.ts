/**
 * 同步会话持久化（doc/214）。
 *
 * 将同步进度存入 localStorage，支持：
 * - 断点续接：关闭页面/弹窗后下次打开自动恢复
 * - 后台处理：引擎在模块级 setInterval 中运行，不依赖弹窗可见性
 * - 中途退出：每次 tick 后保存 checkpoint，下次从断点继续
 */

/** 同步阶段。 */
export type SyncPhase =
    | 'idle'
    | 'fetch-want'
    | 'fetch-watched'
    | 'compare'
    | 'execute'
    | 'done'
    | 'error';

/** 单条待执行操作。 */
export interface SyncOp {
    carNum: string;
    videoId: string;
    /** 操作方向与类型。 */
    action: 'want-to-javdb' | 'watched-to-javdb' | 'want-from-javdb' | 'watched-from-javdb';
    /** 评分（仅 watched-to-javdb）。 */
    score?: number;
}

/** 冲突条目。 */
export interface SyncConflict {
    carNum: string;
    jhsStatus: string;
    javdbStatus: string;
}

/** 持久化会话状态。 */
export interface SyncSession {
    /** 会话创建时间戳。 */
    createdAt: number;
    /** 最后更新时间戳。 */
    updatedAt: number;
    /** 当前阶段。 */
    phase: SyncPhase;
    /** 抓取想看列表：已完成的页码。 */
    wantPage: number;
    /** 抓取已看列表：已完成的页码。 */
    watchedPage: number;
    /** JavDB 想看 videoId→carNum 映射（增量累积）。 */
    javdbWant: [string, string][];
    /** JavDB 已看 videoId→carNum 映射（增量累积）。 */
    javdbWatched: [string, string][];
    /** 待执行操作队列。 */
    queue: SyncOp[];
    /** 队列中已完成的索引。 */
    queueDone: number;
    /** 成功数。 */
    synced: number;
    /** 失败明细。 */
    failed: string[];
    /** 跳过数（已存在）。 */
    skipped: number;
    /** 冲突列表。 */
    conflicts: SyncConflict[];
    /** 错误信息（phase=error 时）。 */
    errorMsg?: string;
}

const SESSION_KEY = 'jhs:sync_session_v1';

/** 创建空会话。 */
export function createSession(): SyncSession {
    const now = Date.now();
    return {
        createdAt: now,
        updatedAt: now,
        phase: 'idle',
        wantPage: 0,
        watchedPage: 0,
        javdbWant: [],
        javdbWatched: [],
        queue: [],
        queueDone: 0,
        synced: 0,
        failed: [],
        skipped: 0,
        conflicts: []
    };
}

/** 从 localStorage 加载会话（不存在则返回 null）。 */
export function loadSession(): SyncSession | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as SyncSession;
    } catch {
        return null;
    }
}

/** 保存会话到 localStorage。 */
export function saveSession(session: SyncSession): void {
    session.updatedAt = Date.now();
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        // 存储满时静默失败（不阻断同步）
    }
}

/** 清除会话。 */
export function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
}

/** 判断会话是否可恢复（非 idle/done/error 且有进度）。 */
export function isResumable(session: SyncSession): boolean {
    return (
        session.phase !== 'idle' &&
        session.phase !== 'done' &&
        session.phase !== 'error'
    );
}
