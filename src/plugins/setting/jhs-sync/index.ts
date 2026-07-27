/**
 * JHS ↔ JavDB 双向同步模块统一出口（doc/213）。
 */
export { handleFullSyncClick, handleJhsSyncClick, abortSync } from './sync-ui';
export type { SyncResult, FullSyncResult, ConflictEntry } from './sync-common';
