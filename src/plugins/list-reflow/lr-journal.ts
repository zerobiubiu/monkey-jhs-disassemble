/**
 * 编号清单整理 —— 恢复日志 + 回滚日志（doc/204 期2b）。
 *
 * 恢复日志（journal）：执行前写 pending，成功后标 done，支持续传。
 * 回滚日志（rollback）：每完成一步记录 {videoId, addedTo, removedFrom}，
 * 供整次撤销（逆序反向搬运）和 pending_cleanup 重试。
 *
 * 存储：独立持久数据 IndexedDB；迁移未激活时兼容 localStorage，键前缀 jhs:reflow:*。
 */

import {
    readPersistentValue,
    removePersistentValue,
    writePersistentValue
} from '../../core/storage/persistent-data-store';

/** 恢复日志条目。 */
export interface JournalEntry {
    /** 会话 ID（一次执行一个）。 */
    sessionId: string;
    /** 组前缀。 */
    base: string;
    /** 总 move 数。 */
    totalMoves: number;
    /** 下一个待执行下标。 */
    nextIndex: number;
    /** 已完成数。 */
    completed: number;
    /** 失败数。 */
    failed: number;
    /** 创建时间戳。 */
    createdAt: number;
    /** 最后更新时间戳。 */
    updatedAt: number;
    /** 状态。 */
    status: 'running' | 'paused' | 'done' | 'aborted';
}

/** 回滚日志条目（单步）。 */
export interface RollbackEntry {
    videoId: string;
    /** 加入的目标清单（null 表示纯去重无加入）。 */
    addedTo: string | null;
    /** 移除的来源清单列表。 */
    removedFrom: string[];
}

const JOURNAL_KEY = 'jhs:reflow:journal';
const ROLLBACK_PREFIX = 'jhs:reflow:rollback:';

// ─── 恢复日志 ───────────────────────────────────────────────

/** 写入/更新恢复日志。 */
export function saveJournal(entry: JournalEntry): void {
    entry.updatedAt = Date.now();
    writePersistentValue('reflowJournal', 'current', JOURNAL_KEY, entry);
}

/** 读取恢复日志（不存在返回 null）。 */
export function loadJournal(): JournalEntry | null {
    return readPersistentValue<JournalEntry>('reflowJournal', 'current', JOURNAL_KEY);
}

/** 清除恢复日志。 */
export function clearJournal(): void {
    removePersistentValue('reflowJournal', 'current', JOURNAL_KEY);
}

/** 是否有未完成的恢复日志（可续传）。 */
export function hasResumableJournal(): boolean {
    const j = loadJournal();
    return j !== null && (j.status === 'running' || j.status === 'paused');
}

// ─── 回滚日志 ───────────────────────────────────────────────

/** 追加一条回滚记录。 */
export function appendRollback(sessionId: string, entry: RollbackEntry): void {
    const key = ROLLBACK_PREFIX + sessionId;
    const list = readPersistentValue<RollbackEntry[]>('reflowRollback', sessionId, key) ?? [];
    list.push(entry);
    writePersistentValue('reflowRollback', sessionId, key, list);
}

/** 读取回滚日志。 */
export function loadRollback(sessionId: string): RollbackEntry[] {
    const key = ROLLBACK_PREFIX + sessionId;
    return readPersistentValue<RollbackEntry[]>('reflowRollback', sessionId, key) ?? [];
}

/** 清除回滚日志。 */
export function clearRollback(sessionId: string): void {
    const key = ROLLBACK_PREFIX + sessionId;
    removePersistentValue('reflowRollback', sessionId, key);
}

/** 生成会话 ID。 */
export function createSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
