# 189 — MissAV 增量消费按载荷形状路由（修复跨站 flag 不对称静默丢增量）

## 背景

这是与 doc/188（MissAV IDB 版本冲突）**独立**的第二个跨站同步 bug。

跨站车号状态同步的增量传递，在「发布端 javdb 开了
`featureFlags.crossSiteSyncProtocol`、消费端 missav 没开」时**静默丢数据**
（不报错、标签不变、无「增量更新」日志）：

- **发布端**（`car-list-reader-plugin.ts`，本次不改）：`pushDelta()` 在 flag ON 时
  走 `pushDeltaFlagged` → `appendDeltaJournal`，把 `GM_KEY_CAR_STATUS_DELTA` 写成
  **数组 journal**；flag OFF 时写成**单对象** `{action,items,ts}`。
- **消费端**（`missav-status-tag-plugin.ts`）：增量监听器原本按**消费端自己的**
  `featureFlags.crossSiteSyncProtocol` 选解析器——flag ON 走 `consumeDeltaJournal`
  （经 `readDeltaJournal` 兼容数组 + 单对象），flag OFF 走 `consumeDelta`
  （只认单对象的 `.action`）。
- `consumeDelta()` 的 flag OFF 分支只判断 `delta.action === 'upsert'/'delete'`；
  传入数组时 `delta.action === undefined`，两分支都不进，直接掉到 `processAll()`，
  **不写库、不报错** = 静默丢弃。
- flag 存 `localStorage['jhs_upgrade_flags']`，**按域名隔离**；GM 存储跨域共享；
  flag 默认 false。故 javdb=ON / missav=OFF 必触发静默丢。反向
  （javdb=OFF / missav=ON）安全，因 `readDeltaJournal` 会把单对象包成数组。
- 全量路径 `consumeFull` 只读 `data.data/count/hwm`，两种全量格式都含这些字段，
  **形状兼容**，无需改。

## 方案

让消费端**按载荷形状**路由，而非按本地 flag，使任意 flag 组合都不静默丢；
flag 对称时行为逐字节不变（零偏差硬要求）。

1. **增量监听器 dispatch**：`Array.isArray(newValue)` → 无条件 `consumeDeltaJournal`；
   否则（单对象）维持原逻辑（本地 flag ON→`consumeDeltaJournal`，OFF→`consumeDelta`）。
   理由：`consumeDelta` 处理不了数组；`consumeDeltaJournal` 经 `readDeltaJournal`
   兼容数组 + 单对象。
2. **初始化兜底**：flag OFF 分支原本只 `consumeFull` 不读 journal；补一条——若
   `GM_getValue(GM_KEY_CAR_STATUS_DELTA)` 是数组，也 `consumeDeltaJournal` 一次
   （否则 javdb=ON 只发增量时，missav=OFF 初始化也丢；监听器仅在后续变更时触发）。
3. **可测试 seam**：把形状路由判定抽成纯函数 `deltaRoute(newValue, localFlagOn)`，
   监听器与初始化共用。

### flag-OFF 走 journal 路径的可行性核实（改前 read 确认）

- `consumeDeltaJournal` → `applyDeltaFlagged` → `withSyncRevision` →
  `upsertLocalCars`/`deleteLocalCars` 全链路**无** `featureFlags` 守卫，flag-OFF 走得通。
- `withSyncRevision` 依赖 `sync_meta` 仓库；`car-status-db.ts` 的 `openLocalDB`
  （doc/188 已统一）在 `MISSAV_DB_VERSION`（2）的 `onupgradeneeded` 无条件创建
  `sync_meta`，故 flag-OFF 首次运行 v1→v2 升级后 `sync_meta` 存在，journal 路径不崩。
- 修订号门控：flag-ON 发布端写的增量带 `revision`，`getPayloadRevision`/`canApplyRevision`
  正常生效；`shouldApply` 初值 `lastAppliedRevision = -1`，合法 revision 均可应用。

### deltaRoute 边界语义

- 数组（含空数组）→ `'journal'`：形状是数组即新协议发布端所写；空数组经
  `readDeltaJournal([])` 过滤为 `[]`，消费器空转无副作用。若判 `'legacy'` 会把数组
  塞给只认单对象的 `consumeDelta`，正是本修复要消灭的静默丢路径。
- 单对象 → 按本地 flag（ON→`'journal'`，OFF→`'legacy'`），即 flag 对称旧路径。
- null/undefined/字符串 → 按本地 flag（非数组即非 journal）；监听器 `newValue` 真值守卫
  与初始化 `Array.isArray` 形状判定下不会收到这些值，判 `'legacy'` 与修复前逐字节一致。

## 实施

- 新增 `src/plugins/car-status-sync/car-status-delta-route.ts`：纯函数 seam
  `deltaRoute(newValue, localFlagOn): 'journal' | 'legacy'` + `DeltaRoute` 类型。
- `src/plugins/car-status-sync/missav-status-tag-plugin.ts`：
  - 增量监听器改按 `deltaRoute(newValue, featureFlags.crossSiteSyncProtocol)` 路由
    （数组无条件 journal，单对象维持本地 flag 门控）。
  - 初始化 flag OFF 分支补兜底：`consumeFull` 后若增量为数组则 `consumeDeltaJournal` 一次。
  - 新增 `import { deltaRoute } from './car-status-delta-route'`。
- 新增 `tests/delta-route.test.ts`：`deltaRoute` 四组合 + 边界（空数组/null/undefined/字符串）。
- `vite.config.ts`：`userscript.version` 1.28.29 → 1.28.30（§6.1.1 bug 修复 patch +1）。

**未改**（硬约束）：featureFlags 默认值、javdb 发布侧
（`pushDelta`/`pushDeltaFlagged`/`sync*`）、`car-status-db.ts` 的 `openLocalDB`、
全量消费路径形状。

## 影响

- **flag 对称（双 OFF 或双 ON）**：行为逐字节不变。双 OFF 时发布端写单对象，
  `deltaRoute(单对象, false) = 'legacy'` → `consumeDelta`（旧路径）；双 ON 时
  `deltaRoute(数组, true) = 'journal'` → `consumeDeltaJournal`（旧路径）。
- **flag 不对称 javdb=ON / missav=OFF（修复点）**：数组增量改走 `consumeDeltaJournal`，
  正常 upsert/delete + `processAll`，不再静默丢；初始化也补消费数组。
- **flag 不对称 javdb=OFF / missav=ON**：原本安全，`deltaRoute(单对象, true) = 'journal'`，
  行为不变。

## 验证

- `bun run build`：✓（`tsc -b && vite build`，dist 产物 `@version` 1.28.30；
  lightningcss 的 IE hack `Unexpected token Semicolon` 警告为 layer.css 已知无害容错）
- `bun run test`：36/36 passed（含新增 `delta-route.test.ts` 8 用例）
- `bun run check:structure`：OK（333 files, 53 dirs within limits）
- `bun run lint`：0 errors（基线 0 errors，未引入新 error）

## 后续验证建议（浏览器实测）

1. 两边控制台读 flag 值确认组合：
   `JSON.parse(localStorage.getItem('jhs_upgrade_flags') || '{}').crossSiteSyncProtocol`
   （javdb 域设 true，missav 域不设/false）。
2. javdb 端标记某番号为想看/已看（触发 `pushDelta` 写数组 journal）。
3. missav 端打开含该番号的列表/视频页，确认：
   - 控制台**无** `VersionError`（doc/188 已修，此处复核）；
   - 出现「增量更新 upsert N 条」日志（证明数组增量被消费，非静默丢）；
   - 该番号缩略图标签变色（证明写库 + `processAll` 生效）。
4. 刷新 missav 页面，确认初始化兜底也能补消费数组（标签仍在）。
