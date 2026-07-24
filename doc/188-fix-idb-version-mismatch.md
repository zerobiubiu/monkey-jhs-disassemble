# 188 — 修复 MissAV IDB 版本冲突（统一 openLocalDB）

## 背景

P3 移植（doc/187）引入两个 IndexedDB opener 打开同名 DB（`MISSAV_DB_NAME`）：

- `openLocalDB()`：硬编码 version `1`，仅创建 `cars` 仓库
- `openLocalDBFlagged()`：打开 `MISSAV_DB_VERSION`（2），创建 `cars` + `sync_meta` 仓库

当 `crossSiteSyncProtocol` flag 开启时，flagged 消费路径（`applyFullFlagged` → `replaceLocalCars` → `upsertLocalCarsFlagged` → `openLocalDBFlagged()`）将 DB 升级到 v2。此后任何调用旧 CRUD 函数（`upsertLocalCars`、`queryLocalCars`、`deleteLocalCars` 等）的代码经由 `openLocalDB()` 以 v1 打开 DB，触发：

> "The requested version (1) is less than the existing version (2)."

导致 flag-ON 全量同步写入 60k 记录后，`processAll()` → `queryLocalCars()` 崩溃，MissAV 页面标签不渲染。同理 `applyDeltaFlagged` 调用 `upsertLocalCars`/`deleteLocalCars`（v1）也在 v2 升级后崩溃。

## 方案

统一为单一 opener `openLocalDB()`，打开 `MISSAV_DB_VERSION`（2），`onupgradeneeded` 中包含 `sync_meta` 创建守卫（`oldVersion < MISSAV_DB_VERSION && !contains`）。删除 `openLocalDBFlagged`，所有调用点改为 `openLocalDB()`。

## 实施

- `src/plugins/car-status-sync/car-status-db.ts`：
  - `openLocalDB()` 从 `indexedDB.open(MISSAV_DB_NAME, 1)` 改为 `indexedDB.open(MISSAV_DB_NAME, MISSAV_DB_VERSION)`
  - `onupgradeneeded` 增加 `sync_meta` 仓库创建守卫
  - 删除 `openLocalDBFlagged()` 函数体（22 行）
  - 9 处 `openLocalDBFlagged()` 调用替换为 `openLocalDB()`
  - 更新 JSDoc 注释

## 影响

- **flag-OFF**：首次运行 post-update 时 DB 从 v1→v2 升级（创建空 `sync_meta` 仓库）。旧 CRUD 函数仅读写 `cars` 仓库，不触及 `sync_meta`，用户可见行为零变化。空 `sync_meta` 仓库无副作用。
- **flag-ON**：所有路径统一使用 v2 opener，不再出现版本冲突。

## 验证

- `bun run build`：✓
- `bun run test`：28/28 passed
- `bun run lint`：0 errors
- `bun run check:structure`：OK
- dist `@version`：1.28.29
