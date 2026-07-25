# doc/194 — 统一跨站同步协议：删除双路径，单线化

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

跨站番号状态同步（javdb → missav）自 doc/187 引入 `crossSiteSyncProtocol`
feature flag 后，所有核心函数都存在 flagged / non-flagged 两个版本，共计
**10 处 flag 分支、6 对重复函数、~350 行冗余代码**。flag 默认关闭，
实际生产环境用户已手动开启（两侧 `localStorage.jhs_upgrade_flags.crossSiteSyncProtocol = true`），
旧路径成为死代码。

本次重构**删除 flag 和全部旧路径**，让 P3 协议（修订号 journal + 门控 + 对账 + 回滚）
成为唯一实现。同时删除为 flag 不对称设计的补丁模块 `car-status-delta-route.ts`，
清理死常量和重复函数。

## 2. 方案

### 2.1 删除 feature flag

- `src/core/feature-flags.ts`：从 `FeatureFlags` interface 和默认值中删除
  `crossSiteSyncProtocol`。用户 localStorage 中残留的该键由 `Object.assign`
  复制到对象上但无代码读取，无害。

### 2.2 javdb 发布端（car-list-reader-plugin.ts）

| 操作 | 说明 |
|------|------|
| 删除旧 `syncFullCarStatus()` | ~65 行，无条件覆盖写，被修订号保护版取代 |
| 删除旧 `pushDelta()` 路径体 | ~38 行，单对象覆盖写，被 journal 追加取代 |
| 删除 `isFullSyncing` 旧锁变量 | 被 `isFullSyncing`（原 `isFullSyncingFlagged`）取代 |
| 重命名 | `syncFullCarStatusFlagged` → `syncFullCarStatus`；`pushDeltaFlagged` → `pushDelta`；`isFullSyncingFlagged` → `isFullSyncing` |
| 删除 3 处 flag 分支 | 菜单命令 / 增量推送入口 / 页面加载全量同步 |
| 删除诊断 `flag` 字段 | 不再需要报告 flag 状态 |

### 2.3 missav 消费端（missav-status-tag-plugin.ts）

| 操作 | 说明 |
|------|------|
| 删除旧 `consumeDelta()` | ~26 行，无门控直写，被 `applyDelta`（修订号门控+回滚）取代 |
| 删除旧 `consumeFull()` | ~48 行，`isFullConsuming` 布尔锁 + 只 upsert 不删，被 `applyFull`（对账+校验+回滚）取代 |
| 删除 `isFullConsuming` 变量 | 被 `enqueueConsume` 串行队列取代 |
| 重命名 | `consumeFullFlagged` → `consumeFull`；`applyDeltaFlagged` → `applyDelta`；`applyFullFlagged` → `applyFull` |
| 删除 5 处 flag 分支 | 增量监听器 / 全量监听器 / 初始化 / consumeDelta 守卫 / consumeFull 守卫 |
| 简化增量监听器 | 删除 `deltaRoute` 路由，所有增量无条件走 `consumeDeltaJournal` |
| 删除诊断 `flag` 字段 | 不再需要 |

### 2.4 IDB 层（car-status-db.ts）

| 操作 | 说明 |
|------|------|
| 删除旧 `upsertLocalCars()` | ~41 行，无 `normalizeLocalRecord` 校验 |
| 重命名 | `upsertLocalCarsFlagged` → `upsertLocalCars`（含严格校验） |
| 删除旧 `importLocalDB()` 路径 | ~46 行，`clear()` + `put`，被对账+回滚版取代 |
| 重命名 | `importLocalDBFlagged` → `importLocalDB` |
| 删除 `buildJavdbUrlLocal()` | ~7 行，与 `car-status-columnar.ts` 的 `buildJavdbUrl` 完全重复 |
| 删除 1 处 flag 分支 | `importLocalDB` 入口 |

### 2.5 删除模块

| 文件 | 行数 | 原因 |
|------|-----:|------|
| `src/plugins/car-status-sync/car-status-delta-route.ts` | 43 | flag 不对称补丁（doc/189），统一后所有增量恒走 journal，`legacy` 路由永不触发 |
| `tests/delta-route.test.ts` | ~80 | 随模块删除 |

### 2.6 清理

| 文件 | 操作 |
|------|------|
| `car-status-config.ts` | 删除死常量 `GM_KEY_LAST_SYNC_TS`（全 src/ 无引用）；清理 ⚑ 注释 |
| `car-status-columnar.ts` | 清理"featureFlags.crossSiteSyncProtocol 门控"注释块 |

## 3. 统一后的协议（唯一路径）

### 增量路径
```
saveCar → callback → pushDelta
  → nextRevision()（Web Lock + 单调修订号）
  → appendDeltaJournal()（读→追加→排序→压缩→写 GM）
  → 超 256 项去重，超 500 项改发全量
```

### 全量路径
```
needsSync → syncFullCarStatus
  → nextRevision() → 读 car_list → 列存 → gzip
  → publishSnapshot（修订号保护 + journal 裁剪）
```

### 消费路径
```
GM_addValueChangeListener(DELTA) → consumeDeltaJournal
  → readDeltaJournal → sortDeltaJournal
  → enqueueConsume(() => applyDelta(delta))
    → isDeltaPayload 校验
    → shouldApply（内存门控）
    → withSyncRevision（Web Lock + IDB 门控 + 回滚）
    → upsertLocalCars（normalizeLocalRecord 校验）
    → markApplied → processAll

GM_addValueChangeListener(DATA) → consumeFull
  → validateColumnarSnapshot 严格校验
  → shouldApply → withSyncRevision
  → replaceLocalCars（对账：写新+删旧+回滚）
  → markApplied → processAll
```

### 页面加载初始化
```
consumeFull(undefined) + consumeDeltaJournal(journal)
  + 消费验证（GM revision > IDB 水位线 → 补消费）
```

## 4. 实施（修改文件清单）

| 文件 | 操作 | 行数变化 |
|------|------|------:|
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 删旧路径+重命名 | 460→335（−125） |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 删旧路径+重命名+删 deltaRoute | 676→~560（−116） |
| `src/plugins/car-status-sync/car-status-db.ts` | 删旧路径+重命名+删死代码 | 756→645（−111） |
| `src/plugins/car-status-sync/car-status-config.ts` | 删死常量+清注释 | 135→128（−7） |
| `src/plugins/car-status-sync/car-status-columnar.ts` | 清注释 | −3 |
| `src/core/feature-flags.ts` | 删 crossSiteSyncProtocol | −3 |
| `src/plugins/car-status-sync/car-status-delta-route.ts` | **删除** | −43 |
| `tests/delta-route.test.ts` | **删除** | −80 |
| `vite.config.ts` | 版本 1.28.34→1.29.0 | — |
| `changelog/CHANGELOG.md` | +v1.29.0 | — |
| `doc/README.md` | +doc/194 | — |

**总计净减 ~488 行**，10 处 flag 分支 → 0，6 对重复函数 → 6 个唯一实现，
1 个冗余模块删除。

## 5. 兼容性

- **GM DELTA 格式**：统一后恒为数组。`readDeltaJournal` 兼容单对象（包成 `[value]`），
  旧版 javdb 写的单对象仍能被新版 missav 消费——滚动升级安全
- **IDB 版本**：`openLocalDB` 已统一为 v2，无破坏性变更
- **用户 localStorage**：`jhs_upgrade_flags.crossSiteSyncProtocol` 残留键无害
  （`Object.assign` 复制到对象上但无代码读取）
- **备份**：`car_list`（源数据）在 WebDav 备份中；GM 同步键和 missav IDB
  为可再生缓存/传输层，无需备份（换浏览器后 `needsSync=true` 自动重建）

## 6. 执行验证记录

- `diagnostics`（Zed TS 语言服务）：全项目 **0 errors**
  （仅 `car-status-db.ts` 4 个既有 warning + 3 个无关文件各 1 个既有 warning）
- `grep -c "featureFlags" car-status-sync/*.ts` → **0**
- `grep -c "Flagged" car-status-sync/*.ts` → **0**
- `grep -c "deltaRoute" src/ tests/` → **0**
- `bun run build` / `bun run test`：终端超时未能完成，需用户手动运行
