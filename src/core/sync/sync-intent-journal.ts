/**
 * 跨站同步共享基础设施 —— 意图日志（intent journal）。
 *
 * 借鉴 VLT 的 pending journal 模式（video-lists-tag/server/vlt-server-api.ts，doc/195）：
 * 将「已接收但未完成消费」的意图写入 localStorage，崩溃/中断后下次加载可恢复。
 *
 * 键格式：`jhs:car-sync-intent:{revision}`
 * 值格式：JSON `{ type: 'delta'|'full', revision: number, ts: number }`
 */

import {
    readPersistentPrefix,
    removePersistentValue,
    writePersistentValue
} from '../storage/persistent-data-store';

/** 意图日志 localStorage 键前缀。 */
const INTENT_PREFIX = 'jhs:car-sync-intent:';

/** 未完成的消费意图。 */
export interface PendingIntent {
    /** 同步类型：增量或全量。 */
    type: 'delta' | 'full';
    /** 对应的同步修订号。 */
    revision: number;
    /** 写入时间戳（毫秒）。 */
    ts: number;
}

/**
 * 写入一条消费意图（消费开始前调用）。
 * @param revision 同步修订号
 * @param kind 同步类型
 */
export function writeIntent(revision: number, kind: 'delta' | 'full'): void {
    writePersistentValue(
        'carSyncIntent',
        String(revision),
        INTENT_PREFIX + revision,
        { type: kind, revision, ts: Date.now() }
    );
}

/**
 * 清除一条消费意图（消费成功后调用）。
 * @param revision 同步修订号
 */
export function clearIntent(revision: number): void {
    removePersistentValue('carSyncIntent', String(revision), INTENT_PREFIX + revision);
}

/**
 * 读取所有未完成意图，按 ts 升序排列。
 * @returns 未完成意图数组（单条解析失败跳过）
 */
export function readPendingIntents(): PendingIntent[] {
    const intents: PendingIntent[] = [];
    const values = readPersistentPrefix<PendingIntent>('carSyncIntent', INTENT_PREFIX);
    for (const value of Object.values(values)) {
        if (value && typeof value.revision === 'number') intents.push(value);
    }
    return intents.sort((a, b) => a.ts - b.ts);
}

/**
 * 清理超过 maxAgeMs 的过期意图（默认 24h）。
 * @param maxAgeMs 过期阈值（毫秒），默认 24 小时
 */
export function cleanStaleIntents(maxAgeMs = 86400000): void {
    const cutoff = Date.now() - maxAgeMs;
    const values = readPersistentPrefix<PendingIntent>('carSyncIntent', INTENT_PREFIX);
    for (const [revision, value] of Object.entries(values)) {
        if (!value || typeof value.ts !== 'number' || value.ts < cutoff) {
            removePersistentValue('carSyncIntent', revision, INTENT_PREFIX + revision);
        }
    }
}
