> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/plugins/visit-history-plugin.ts`（访问记录记录/查询逻辑）；新增 `tests/visit-history-lookup.test.ts`
> **前置文档**：`docs/05-list-preload-and-history.md`（doc/112–116 访问记录插件）、`docs/12-indexeddb-persistent-data-migration.md`（visitHistory namespace 迁移）
> **替代文档**：无
> **生效版本**：v1.46.5

# 访问记录：取消条目上限 + 修复「访问过仍显示无访问记录」

## 1. 背景

用户报告两个问题（2026-09-21）：

1. **访问过的页面，详情页元数据链接 hover 仍显示「无访问记录」**。
2. 要求**去掉 5000 条上限淘汰**，记录不设上限。

### 1.1 根因分析（问题 1）

访问记录的记录键与查询键在多数场景下**天然不一致**：

| 侧 | 键的来源 | 示例 |
|----|----------|------|
| 记录（`recordVisit()`） | `location.pathname + location.search`（实际访问的 URL） | `/actors/xxx?page=2`、`/?vft=2&vst=1` |
| 查询（原逻辑） | 链接 href 归一化后的 `url.pathname + url.search` | 详情页元数据链接 href 通常**不带 query**：`/actors/xxx` |

详情页元数据面板（番號/導演/片商/系列/類別/演員）的站内链接指向「干净」的 path，而用户实际访问的页面几乎总是带翻页/筛选参数（`?page=2`、排序、筛选条件等）。原查询 `this.readHistory()[this.activePath]` 是**纯精确匹配**——只要 search 有任何差异就查不到，直接显示「无访问记录」。

次要因素（本轮不改，仅记录）：

- `MAX_ENTRIES = 5000` 淘汰最旧条目（用户已确认移除）；
- `replacePersistentMap` IndexedDB 写入为 fire-and-forget（`void`），极快关闭页面时该次记录可能未落盘（同 key 后续访问会重写，只影响「打开一次即秒关」的页面）。

## 2. 方案

### 2.1 取消条目上限

删除 `MAX_ENTRIES` 常量与 `evictIfNeeded()` 方法，`recordVisit()` 直接写入。可行性依据：v1.46.3（doc/12）后访问记录存于独立 IndexedDB（`JAV-JHS-PersistentData` 的 `visitHistory` namespace），无 localStorage 5MB 配额压力；5 万条 path→时间戳条目约数 MB，IndexedDB 完全可承载。

### 2.2 查询回退匹配

新增导出纯函数 `lookupVisitTime(history, path)`：

- **精确匹配优先**：`pathname + search` 完全一致直接返回（保持既有精确语义，如区分 `/search?q=a` 与 `/search?q=b` 的访问）；
- **回退**：未命中时取**同 pathname**（任意 search）下时间戳最大的一条。覆盖两类场景：
  - 链接无 query、访问记录带参（主场景：详情页元数据链接 → 翻页/筛选后的访问）；
  - 链接带部分 query、访问记录参数更多（如链接 `/search?q=x`、访问 `/search?q=x&f=all`）。
- **pathname 边界**：base 前缀后必须紧跟 `?` 或为完整 key（`key.length === base.length || key[base.length] === '?'`），避免 `/actors/a` 误匹配 `/actors/ab`。

性能：回退分支线性扫描整张表。上限取消后表会持续增长，但遍历为纯内存对象操作，1 万条约 <1ms，且仅在 hover 时（`TICK_MS=500` 间隔刷新）执行，无可感知影响；未来条目量级显著增长时再考虑分片/索引（见 §6）。

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | ① 删除 `MAX_ENTRIES` 与 `evictIfNeeded()`；② 新增导出 `lookupVisitTime()` 纯函数；③ `showVisitTooltip` 的 update 回调查询改走 `lookupVisitTime`；④ 文件头注释同步 |
| `tests/visit-history-lookup.test.ts` | 新增，10 用例（精确匹配 3 / 回退匹配 3 / 边界 4） |

不涉及：记录侧键格式（保持 `pathname + search`，保留完整参数信息）、备份链路（`__persistentData.visitHistory`）、缓存管理面板（`jhs_visit_history`）、CSS。

## 4. 测试设计

| 组 | 用例 | 锁定行为 |
|----|------|----------|
| 精确匹配 | 带参命中 / 精确键优先于更新的同 pathname 记录 / 无 query 命中 | 精确语义不被回退破坏 |
| 回退匹配 | 无 query 链接取同 pathname 最新 / 带参未命中也回退 / 反向（记录无 query、查询带参） | 翻页/筛选参数不一致场景 |
| 边界 | `/actors/a` 不匹配 `/actors/ab`（正向 + 反向）/ 空历史 / 其他 pathname 不参与 | 前缀边界与隔离性 |

测试文件使用 jsdom 环境（模块链上 `constants/site` 依赖 `window.location`），断言全部针对纯函数。

## 5. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-21

### 验证命令

```bash
bun run test
bun run build   # tsc -b && vite build
```

### 实际输出

- `bun run test`：**Test Files 15 passed (15) · Tests 198 passed (198)**（新增 10 用例）
- `bun run build`：**✓ built in 742ms**，产物 `dist/monkey-jhs-disassemble.user.js` 1,187.38 kB（gzip 303.70 kB），`tsc -b` 无错误

### 前端或调用方验证

静态验证覆盖；实际 hover 效果建议用户在 Tampermonkey 更新脚本后自测：

1. 打开任意演员/片商/系列列表页并翻页（产生带参记录）→ 回详情页 hover 对应元数据链接 → 应显示「X分钟前打开过」（旧版此处误报「无访问记录」）；
2. DevTools → Application → IndexedDB → `JAV-JHS-PersistentData` → records，确认长期使用条目数不再因 5000 上限被淘汰。

### 验证结论

tsc 严格编译、构建、198 个单测全绿；行为变更语义由 10 个新增单测锁定（精确优先 + 同 pathname 最新回退 + 前缀边界）。

### 已知限制

- 回退匹配取「最新」记录，无法区分「哪次带参访问」——只回答「这个页面（pathname）最近什么时候打开过」，符合插件定位；
- `replacePersistentMap` fire-and-forget 写入竞态保留（极快关页可能丢该次记录），影响面极小，未处理；
- 条目无上限持续增长，若未来达数万条且出现可感知卡顿，需做分片/索引优化（当前遍历 <1ms，无需求）。

## 6. 关联

- 版本：v1.46.5（AGENTS.md §6.1.1，`src/` 逻辑修改 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.5
- 历史演进：doc/112（插件初版）→ 113/114（实时悬浮）→ 115/116（随备份）→ doc/12（迁移 IndexedDB）→ 本文档
