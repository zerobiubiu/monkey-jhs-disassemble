# doc/195 — 跨站同步优化：共享基础设施 + 消费侧增强 + pushDelta 竞态修复

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/194 统一跨站同步协议（删除双路径、单线化）后，car-status-sync 链路仍存在
四类可优化点：

1. **重复基础设施**：Web Locks 排他锁包装有 3 处近乎相同的实现
   （`car-list-reader-plugin.ts` 的 `withPublisherLock`、`car-status-db.ts` 的
   `withLocalSyncLock`、`video-lists-tag/vlt-lock-queue.ts` 的 `withAssociationLock`）；
   键控串行队列有 2 处重复（`missav-status-tag-plugin.ts` 的 `enqueueConsume`、
   `vlt-lock-queue.ts` 的 `enqueueAssociationTask`）。
2. **消费侧无崩溃恢复**：missav 端「已接收但未完成消费」的载荷若在 IDB 写入
   中途崩溃/中断，下次加载无从知晓，只能等下一次实时通知或每日兜底全量。
3. **全量读取无一致性校验**：`applyFull` 读 GM 全量快照时，javdb 端可能正在
   写入，理论上会读到混合数据。
4. **pushDelta 竞态**：详情页收藏/已看/屏蔽触发 `saveCar` 后，异步增量推送
   可能被紧随的 `utils.closePage()` 中断，导致 GM 写入丢失。

本次提取共享基础设施 `src/core/sync/`，迁移 car-status 两侧，并加固消费侧与
发布侧。**不修改 VLT 文件**（`src/plugins/video-lists-tag/`）——由后续任务处理。

## 2. 方案

### 2.1 任务 1：共享基础设施 `src/core/sync/`

| 文件 | 职责 |
|------|------|
| `sync-lock.ts` | `withExclusiveLock(lockName, task)` —— Web Locks 统一包装，`navigator.locks` 不可用时降级直接执行 |
| `sync-queue.ts` | `KeyedQueue` —— 键控串行队列（同 key 串行、异 key 并发，前一任务失败不阻塞后续，队列尾自清理防泄漏） |
| `sync-intent-journal.ts` | 意图日志：`writeIntent`/`clearIntent`/`readPendingIntents`/`cleanStaleIntents`，借鉴 VLT pending journal（`vlt-server-api.ts`），键 `jhs:car-sync-intent:{revision}` |
| `index.ts` | 统一出口 |

`KeyedQueue.enqueue` 采用「队列尾 Promise + resolveTail」实现，规避了「每次
`.then` 创建新 Promise 导致自清理比较恒不等」的 bug：队列尾 `tail` 是稳定引用，
任务结算后 `resolveTail()`，`tail.then` 中比较 `queues.get(key) === tail` 成立时
才删除 Map 项。

### 2.2 任务 2：迁移 car-status 到共享基础设施

| 文件 | 操作 |
|------|------|
| `car-list-reader-plugin.ts` | 删除模块级 `withPublisherLock` + `NavigatorWithOptionalLocks`；`import { withExclusiveLock }`；3 处调用（`nextRevision`/`appendDeltaJournal`/`publishSnapshot`）改为 `withExclusiveLock(JAVDB_SYNC_LOCK_NAME, task)`；`JAVDB_SYNC_LOCK_NAME` 常量保留本文件 |
| `car-status-db.ts` | 删除模块级 `withLocalSyncLock` + `NavigatorWithOptionalLocks`；`import { withExclusiveLock }`；2 处调用（`withSyncRevision`/`importLocalDB`）改为 `withExclusiveLock(MISSAV_SYNC_LOCK_NAME, task)` |
| `missav-status-tag-plugin.ts` | 删除 `consumeQueue: Promise<void>` 属性与 `enqueueConsume` 方法；`import { KeyedQueue }`；新增 `private consumeQueue = new KeyedQueue()`；2 处调用改为 `this.consumeQueue.enqueue('consume', task)` |

### 2.3 任务 3：missav 消费侧增强

**3a 意图日志**（`missav-status-tag-plugin.ts`）：

- `applyDelta`/`applyFull` 在 `shouldApply` 门控通过后 `writeIntent(revision, kind)`；
  消费成功（含门控拒绝的幂等路径）后 `clearIntent(revision)`；catch 分支不清理
  （下次加载恢复）。
- `handle()` 步骤 4.5（消费验证）之后新增 **4.6 意图日志恢复**：
  `readPendingIntents()` 升序遍历，`delta` 类型重新 `consumeDeltaJournal`（幂等，
  门控防重复应用），`full` 类型仅清理（步骤 4 已 `consumeFull`）；最后
  `cleanStaleIntents()`（默认 24h 过期）。

**3b 双读一致性**（`applyFull`）：

读 GM 全量快照后，若为非监听器路径（`!payload`），间隔 50ms 复读一次，比较
`revision ?? ts`；不一致时 `logWarn` 并采用第二次读取结果，防止读取期间 javdb
正在写入导致混合数据。

### 2.4 任务 4：pushDelta 竞态修复

**4a `car-list-reader-plugin.ts`**：

- 新增 `private pendingPush: Promise<void>` 跟踪当前增量推送。
- 原 `pushDelta`（异步、内含 try/catch）重命名为 `private async pushDeltaAsync`，
  去掉内部 try/catch（错误上抛）。
- 新 `pushDelta(event): void` 为 fire-and-forget 入口：
  `this.pendingPush = this.pushDeltaAsync(event).catch(logErr)`。
- 新增 `async waitForPendingPush()`：`await this.pendingPush`。

**4b `detail-page-button-plugin.tsx`**：

`favoriteOne`/`hasWatchOne`/`filterOne`（`filterOne` 在 `utils.q` 回调内部）在
`saveCar` 之后、`closePage` 之前 `getBean('CarListReaderPlugin')` 并
`await clr.waitForPendingPush()`，避免 closePage 中断异步 GM 写入。
`getBean('CarListReaderPlugin')` 经 `PluginMap` 精确类型化，`waitForPendingPush`
已知于返回类型，`if (clr)` 仅作运行时未注册守卫。

## 3. 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/sync/sync-lock.ts` | **新增** `withExclusiveLock` |
| `src/core/sync/sync-queue.ts` | **新增** `KeyedQueue` |
| `src/core/sync/sync-intent-journal.ts` | **新增** 意图日志 4 函数 + `PendingIntent` |
| `src/core/sync/index.ts` | **新增** 统一出口 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 迁移锁 + pushDelta 竞态修复 |
| `src/plugins/car-status-sync/car-status-db.ts` | 迁移锁 |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 迁移队列 + 意图日志 + 双读 + 恢复 |
| `src/plugins/detail-page-button-plugin.tsx` | 三处 closePage 前等待增量推送 |
| `vite.config.ts` | 版本 1.29.0→1.30.0 |
| `changelog/CHANGELOG.md` | +v1.30.0 |
| `doc/README.md` | +doc/195 |
| `AGENTS.md` | §3.4 core 模块表新增 sync/ 子目录 |

## 4. 兼容性

- **锁名不变**：`JAVDB_SYNC_LOCK_NAME='jhs-javdb-car-status-publisher'`、
  `MISSAV_SYNC_LOCK_NAME='jhs-missav-car-status-sync'` 均保持原值，跨标签页互斥
  行为不变。
- **GM 存储格式不变**：增量 journal / 全量快照 / 修订号键均未改动。
- **意图日志为新增 localStorage 键**（`jhs:car-sync-intent:*`），不影响既有数据；
  `cleanStaleIntents` 24h 自动清理，无泄漏。
- **VLT 未动**：`vlt-lock-queue.ts` 的 `withAssociationLock`/`enqueueAssociationTask`
  保持原样（后续任务迁移），与本次新增的共享模块并存不冲突。
- **pushDelta 签名变化**：`pushDelta` 由 `async (): Promise<void>` 变为同步
  `(): void`。唯一调用方 `setCarListChangeCallback` 回调忽略返回值，无影响。

## 5. 执行验证记录

- `diagnostics`（Zed TS 语言服务，全量类型检查）：全项目 **0 errors**。
  - 新增 4 个 `src/core/sync/*.ts`：0 error / 0 warning。
  - `car-list-reader-plugin.ts` / `missav-status-tag-plugin.ts` /
    `detail-page-button-plugin.tsx`：0 error / 0 warning。
  - `car-status-db.ts`：0 error，4 个**既有** warning（thrown error 无 `cause`，
    doc/194 已记录，与本次无关）。
- `grep` 确认 `withPublisherLock`/`withLocalSyncLock`/`enqueueConsume`/
  `NavigatorWithOptionalLocks` 在全 `src/` **0 残留**。
- `bun run build` / `bun run test`：本轮终端工具不可用（`tool input was not fully
  received`，连 `echo ok` 均失败），未能运行，需用户手动执行验证。

## 6. 后续验证建议

1. `bun run build` 确认 `tsc -b && vite build` 通过，产物 `@version` 为 1.30.0。
2. `bun run test` 确认既有测试全绿（本次未新增测试，纯函数 `KeyedQueue`/
   意图日志可后续补单元测试）。
3. 跨标签实测：javdb 详情页收藏 → 立即关闭弹窗，missav 端确认增量到达
   （验证 waitForPendingPush 竞态修复）。
4. 模拟 missav 消费中途刷新页面，重载后确认 4.6 意图恢复补消费。
