> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/plugins/other-site/osp-helpers.ts`（删除 LRU 淘汰）、`osp-probe.tsx` / `osp-preload.tsx`（调用点）、`other-site-plugin.tsx`（注释）
> **前置文档**：`docs/14-visit-history-no-limit-and-fallback-lookup.md`（访问记录取消上限，同批决策）、`docs/12-indexeddb-persistent-data-migration.md`（预加载缓存迁移 IndexedDB）
> **替代文档**：无
> **生效版本**：v1.46.6

# 外站预加载缓存取消 5000 条上限

## 1. 背景

v1.46.5 取消访问记录 `MAX_ENTRIES = 5000` 上限后，用户要求排查其余条目上限并去掉「有用且不需要上限」的数据淘汰。全 `src/` 扫描确认唯一同类上限为**外站预加载缓存**：

- `src/plugins/other-site/osp-helpers.ts`：`PRELOAD_CACHE_MAX = 5000` + `evictStaleCache()` LRU 淘汰（写入缓存时超过 5000 条按 `ts` 升序删除最旧，旧格式无 ts 条目优先淘汰）
- 调用点：`osp-probe.tsx:133`（实时探测写入）、`osp-preload.tsx:221`（预加载写入）

其余扫描到的上限均不属于「持久数据条目淘汰」，不在本批范围：页数保护（lw-fetch/lr-data `MAX_PAGES=200`、vlt-reconcile `100`、dpb-list-panel-fetch `50`）、增量协议切换（`CAR_STATUS_DELTA_MAX_ITEMS=500`，超限改发全量快照不丢数据）、服务端镜像（清单 `MAX_COUNT=501`）、UI 环形缓冲（`clogMsgCount`，用户可调）、防死循环重试上限、意图日志 24h 过期清理。

## 2. 方案

与访问记录同理：预加载缓存（外站探测/预加载结果，键 `番号_siteId` → `{type, url, ts}`）是**长期有效数据**，v1.46.3 后存于独立 IndexedDB（`JAV-JHS-PersistentData` 的 `otherSite`/`otherSiteDmm`/`dmmVideo` namespace），无 localStorage 5MB 配额压力。被淘汰的条目意味着对应影片要重新发起外站请求（多一次探测开销）。

- 删除 `PRELOAD_CACHE_MAX` 常量与 `evictStaleCache()` 函数；
- 两个调用点移除 `evictStaleCache(cache)` 调用；
- **有效期语义不变**：缓存仍受设置项 `preloadCacheTTL`（`isCacheEntryValid`，默认 0 = 永不过期）控制，用户可随时主动清理（设置面板「清理缓存」含 `jhs_other_site` 等 key）——上限只是唯一的重复兜底，移除后过期与手动清理两条路径完整保留。

体积评估：单条预加载结果约 100–200 字节，1 万条约 1–2 MB，IndexedDB 完全可承载；每次写入是 `readPersistentMap` 全表读 + `replacePersistentMap` 全表写，万条级内存对象操作 <10ms，无可感知影响。

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/plugins/other-site/osp-helpers.ts` | 删除 `PRELOAD_CACHE_MAX` 与 `evictStaleCache()` |
| `src/plugins/other-site/osp-probe.tsx` | 移除 import 与 1 处调用 |
| `src/plugins/other-site/osp-preload.tsx` | 移除 import 与 1 处调用 |
| `src/plugins/other-site-plugin.tsx` | 模块说明注释同步 |

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-21

### 验证命令

```bash
bun run build   # tsc -b && vite build
bun run test
rg 'evictStaleCache|PRELOAD_CACHE_MAX' src/
```

### 实际输出

- `bun run build`：**✓ built in 664ms**，产物 1,186.88 kB（gzip 303.55 kB），`tsc -b` 无错误
- `bun run test`：**Test Files 15 passed · Tests 198 passed**
- `rg` 零残留命中（标识符与常量全清除）

### 前端或调用方验证

静态验证覆盖；建议用户更新脚本后观察：长期使用中预加载缓存条目数不再回落（DevTools → IndexedDB → `JAV-JHS-PersistentData`），旧条目不再被静默删除。

### 验证结论

tsc 严格编译、构建、198 单测全绿，标识符零残留；行为变更（不再淘汰）语义明确，无测试锁定需求（删除纯减少行为）。

### 已知限制

- 缓存无限增长，备份 payload（`__persistentData.otherSite*`）体积随条目数线性增大——用户可用「清理缓存」或 `preloadCacheTTL` 主动控制；
- 全表读写在条目量极大（数万+）时可能有轻微写入延迟，当前量级无可感知影响。

## 5. 关联

- 版本：v1.46.6（AGENTS.md §6.1.1，`src/` 逻辑修改 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.6
- 同批决策：v1.46.5（doc/14）访问记录取消上限
