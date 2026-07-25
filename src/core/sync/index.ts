/**
 * 跨站同步共享基础设施统一出口（doc/195）。
 *
 * 汇总 Web Locks 包装、键控串行队列、意图日志三个共享模块，
 * 供 car-status-sync 等跨站同步链路复用。
 */

export { withExclusiveLock } from './sync-lock';
export { KeyedQueue } from './sync-queue';
export { writeIntent, clearIntent, readPendingIntents, cleanStaleIntents } from './sync-intent-journal';
export type { PendingIntent } from './sync-intent-journal';
