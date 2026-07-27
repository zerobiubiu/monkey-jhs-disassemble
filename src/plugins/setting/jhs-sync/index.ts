/**
 * JHS ↔ JavDB 双向同步模块统一出口（doc/214）。
 *
 * 引擎驱动：sync-engine（tick 推进 + 断点续接 + 后台处理）
 * UI 绑定：fav-sync-bind（面板按钮 → 引擎 API）
 * 会话持久化：sync-session（localStorage）
 */
export { bindFavSyncPanel } from './fav-sync-bind';
export {
    startSync,
    resumeSync,
    pauseSync,
    resetSync,
    isRunning,
    hasResumableSession,
    getSession,
    getProgress,
    getPhaseLabel,
    onSyncChange
} from './sync-engine';
export type { SyncSession, SyncOp, SyncConflict, SyncPhase } from './sync-session';
