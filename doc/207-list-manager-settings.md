# 207 - 清单管理器设置页重构 + 可配置项整理

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

清单相关设置散落且不全：合并/编号整理 4 项挤在 base-panel「清单收藏合并」分区；
详情页清单排序**无持久化默认值**（每次默认名称降序）；「收藏清单关系」(vlt-panel)
仅导入/导出、无配置。doc/204/205/206 还将引入一批配置项。用户要求：升级 vlt-panel 为
「清单管理器」专页，集中管理所有清单可配置项（含默认排序方式/排序字段），并先做
**可配置项整理**再执行。用户已确认四项决策（见 §2）。

## 2. 用户确认的决策（2026-07-27）

1. **升级 vlt-panel 为「清单管理器」**（保留 panelId `vlt-panel`，改标签与内容）。
2. **要做** `listSortBy`（排序字段：名称/数量/序号）。
3. **`autoReconcileDelay` 做成可配置**。
4. 认可执行顺序：doc/206 → 清单管理器设置页 → doc/205 → doc/204 分期。

## 3. 可配置项整理（盘点）

### 3.1 现有（已实现，散在 base-panel「清单收藏合并」）

| 键 | 含义 | 控件 |
|---|---|---|
| `listMergeEnabled` | 启用序号清单合并 | 开关 |
| `listMergePattern` | 合并匹配正则 | 输入 |
| `listMergeExcludeNames` | 不参与合并的清单名 | 输入 |
| `listReflowEnabled` | 启用清单页编号整理 | 开关 |

### 3.2 详情页清单排序（现状无持久化设置）

`dpb-list-panel.tsx` `DetailListSort='name-desc'|'name-asc'`，`Intl.Collator(zh-CN,numeric)`
按名称排（次键 listId），每次默认 `name-desc`，用户切换不被记住。

### 3.3 本次新增

| 键 | 含义 | 选项/默认 |
|---|---|---|
| `listDefaultSort` | 清单面板**默认排序方式** | name-desc(名称降序,默认) / name-asc(名称升序) |
| `listSortBy` | **排序字段** | name(名称,默认) / count(数量) / num(序号) |
| `autoReconcileDelay` | 自动对账延迟 ms（doc/206④，原硬编码 350） | 默认 800 |

### 3.4 后续文档将引入（本次预留，落地时补入本页）

- doc/205：`autoFavCleanupEnabled`、`protectedListKeywords`。
- doc/204 期2：`reflowInterval`、`reflowBatchSize`、`reflowTrialCount`、`reflowMaxRetry`（并发锁 1 不开放）。

## 4. 「清单管理器」设置页设计

升级 vlt-panel（保留 panelId `vlt-panel`），分區：

```
📋 清单管理器
├─ 🗂️ 序号合并      listMergeEnabled / listMergePattern / listMergeExcludeNames  (迁入)
├─ 📐 排序显示      listDefaultSort / listSortBy                                 (新增)
├─ ⚙️ 编号整理      listReflowEnabled                                            (迁入)
├─ 🔄 对账校准      autoReconcileDelay                                           (新增, doc/206④)
└─ 💾 数据管理      导入/导出（保留 vlt-import-btn / vlt-export-btn / vlt-file-input / vlt-status）
```

> doc/205/204 落地时再增「⭐ 自动收藏联动」「🚀 压实执行」分区。

## 5. 本次实施（第一阶段：doc/206 + 设置页重构 + 排序）

### 5.1 doc/206 对账消噪

| # | 改动 | 位置 |
|---|---|---|
| ① | `runAutomaticReconciliation` 对账调用 `quiet:true` | `vlt-reconcile.ts` |
| ② | `reconcileListBeforeMutation` 对账调用 `quiet:true` | `vlt-reconcile.ts` |
| ③ | `reconcileAfterConfirmedMutation` **保持** `quiet:false` | `vlt-reconcile.ts` |
| ④ | `AUTO_RECONCILE_DELAY` 改为可变 + `setAutoReconcileDelay()`；VLT 插件 handle 读 `autoReconcileDelay` 设置并注入（默认 800） | `vlt-reconcile.ts` + `vlt-plugin.ts` |

### 5.2 设置页重构

| 文件 | 改动 |
|---|---|
| `src/components/setting-panels/list-manager-panel.tsx` | **新增** 清单管理器面板组件（5 分区 + 保留导入导出 ID） |
| `src/components/setting/setting-dialog.tsx` | 侧栏「收藏清单关系」→「📋 清单管理器」；vlt-panel 由 `SyncPanel` 换为 `ListManagerPanel` |
| `src/plugins/setting/setting-form-bind.ts` | vlt-panel 由「隐藏 saveBtn」改为「显示 saveBtn」（现有配置项需保存）；导入导出绑定不变 |
| `src/components/setting-panels/base-panel.tsx` | 移除「清单收藏合并」分区（4 项迁出） |
| `src/plugins/setting/setting-form-load.ts` | load/save 新增 `listDefaultSort`/`listSortBy`/`autoReconcileDelay` |

### 5.3 排序接线

| 文件 | 改动 |
|---|---|
| `src/plugins/detail-page-button-plugin.tsx` | 新增 `_listDisplayConfig {defaultSort, sortBy}`，handle 加载 |
| `src/plugins/detail-page-button/dpb-list-panel.tsx` | `ensureListPanel` 按 `listDefaultSort` 设下拉默认 + 写 `panel.dataset.listSortBy`；`applyListPanelView` 按 sortBy(name/count/num) 排序 |

## 6. 执行验证记录（2026-07-27）

第一阶段（doc/206 对账消噪 + 清单管理器设置页重构 + 排序设置）已实施：

- 新增 `list-manager-panel.tsx`（序号合并/排序显示/编号整理/对账校准/数据管理 五分区）。
- `setting-dialog.tsx` 侧栏「收藏清单关系」→「📋 清单管理器」，vlt-panel 由 SyncPanel 换为
  ListManagerPanel；`setting-form-bind.ts` vlt-panel 显示 saveBtn。
- `base-panel.tsx` 移除「清单收藏合并」分区（listMerge*/listReflow* 迁入清单管理器）。
- `setting-form-load.ts` 新增 listDefaultSort/listSortBy/autoReconcileDelay 读写。
- `dpb-list-panel.tsx` 按 listDefaultSort 设排序下拉默认 + 按 listSortBy(name/count/num) 排序；
  `detail-page-button-plugin.tsx` 新增 `_listDisplayConfig` 加载。
- doc/206 ①②③④ 同步落地（见 doc/206 §9）。

```
$ bun run build      # tsc -b 零错误，390 modules，✓ built
$ bun run test       # 103 passed
$ bun run lint       # 0 errors / 0 warnings
$ bun run check:structure   # OK (347 files, 57 dirs)
```

版本 1.32.1→1.33.0（minor：新增清单管理器设置页 + 排序设置）。doc/205/204 落地时再于本页
增「自动收藏联动」「压实执行」分区（见 §7）。

## 7. 后续

- doc/205 落地 → 本页增「自动收藏联动」分区（autoFavCleanupEnabled / protectedListKeywords）。
- doc/204 期2 落地 → 本页增「压实执行」分区（reflowInterval 等）。
