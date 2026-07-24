# doc/187 — 跨站车号状态同步协议升级（feature flag 默认关）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

codex-dev 的 P3：跨站车号状态同步协议升级，替换当前 `replaceLocalCars` 的 `objectStore.clear()`（全量擦除，写入中途失败即丢数据）。当前 master 仅有 doc/138 的基础 revision 门控。

## 实现（全部位于 featureFlags.crossSiteSyncProtocol 之后，默认关）

- **car-status-db**：新增 withSyncRevision / withLocalSyncLock（navigator.locks 跨标签互斥）/ 批量对账（先 upsert 校验条数、再删多余、失败恢复快照，替换 clear()）/ getCarListSnapshot / normalizeLocalRecord / normalizeJavdbUrlPath。IDB 请求版本 = flag ? 2 : 1；sync_meta 仅在升级到 v2 时创建，故 flag 关时 DB 维持 v1、不迁移。
- **car-list-reader-plugin**：单调修订号（GM_KEY_CAR_STATUS_REVISION）+ 增量 journal（按 carNum 去重 + 500 上限 + gzip 全量收敛）+ fullResyncRequested 补发。
- **missav-status-tag-plugin**：消费队列串行化（enqueueConsume + lock）+ 修订号门控（canApplyRevision，旧载荷不复活已删记录）+ 全量后补消费保留的增量 journal。
- **car-status-columnar**：严格列存校验（validateColumnarSnapshot / parseColumnarImport / normalizeUrl：HTTPS + javdb.com 主机）。
- **car-status-config**：新增类型与常量。

## 不变量

flag 关（默认）时运行行为与改动前逐字节一致：未修改任何既有函数体，新协议仅经 `if (featureFlags.crossSiteSyncProtocol)` 在调用点分支，else 分支调用原函数原参数。

## 启用与风险

默认关闭。启用方式：控制台 `localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ crossSiteSyncProtocol: true }))` 后刷新。**启用前必须跨标签页实测**（javdb 端改状态 → missav 端标签实时/全量同步、关标签/刷新不丢、并发标签不互相覆盖），因本环境无法做用户脚本跨标签实测。flag 关路径已由 tsc/vitest 覆盖，flag 开路径需人工实测。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/core/feature-flags.ts | 新增 crossSiteSyncProtocol（默认 false） |
| src/plugins/car-status-sync/car-status-config.ts | 新增类型/常量 |
| src/plugins/car-status-sync/car-status-db.ts | 新增协议函数 + 调用点分支 + IDB 条件 v2 |
| src/plugins/car-status-sync/car-list-reader-plugin.ts | 修订号 + journal + 调用点分支 |
| src/plugins/car-status-sync/missav-status-tag-plugin.ts | 消费串行化 + 修订号门控 + 调用点分支 |
| src/plugins/car-status-sync/car-status-columnar.ts | 严格校验 + 调用点分支 |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / check:structure OK；flag 关 diff 审计：既有函数体未改。
