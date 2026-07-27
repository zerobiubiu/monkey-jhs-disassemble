# 205 - 泛化「自动收藏 / 自动移除」清单联动（值得复盘受保护模型）

> **文档类型**：🔧 开发指导
> **文档状态**：🔧 待执行

## 1. 背景

现有清单↔评价联动以「等待更新」为中心（doc/53 加入等待更新→自动收藏；doc/124 评分/已读→
移出等待更新；doc/125 加入非等待更新清单→移出等待更新）。用户希望**泛化**为「值得复盘」
受保护模型：

- **需求 A**：加入「除 值得复盘\* 外的任意清单」→ 自动收藏（想看）。
- **需求 B**：将影片从「收藏」改为「任意已读星级」→ 自动移出「除 值得复盘\* 外的所有清单」。

A/B 是 doc/53/124 的**严格超集**（等待更新旧行为完全保留，范围扩大到「除值得复盘外全部」），
可用现成原语实现。本文记录完整方案，用户已确认全部决策，**暂不实现**。

## 2. 用户确认的决策（2026-07-27）

| # | 决策 | 采纳 |
|---|---|---|
| D1 | Feature B 是否覆盖**原生「我看過」按钮**触发的 收藏→已看 | **覆盖**（双路径，互斥不重复） |
| D2 | **0 星「已读」**是否触发 Feature B | **触发**（与 doc/124 一致） |
| D3 | **doc/125**（加入非等待更新清单→移出等待更新）去留 | **保留** |
| D4 | 「受保护关键词」是否做成**可配置**设置项 | **做成设置**，默认「值得复盘」 |
| D5 | 是否加 A/B **总开关** | **加** `autoFavCleanupEnabled`，默认开 |

## 3. 语义模型

「值得复盘」为受保护例外，其余清单为临时：

| 清单类型 | 加入时 | 收藏→已读时 |
|---|---|---|
| **值得复盘\***（受保护） | **不**自动收藏（复盘片通常已看过） | **保留**，不移出 |
| **其他任意清单**（临时） | **自动收藏**（想看） | **移出** |

「值得复盘\*」**包含匹配**（`值得复盘`/`值得复盘1`/`值得复盘-无码` 均算）。
典型生命周期：加入「无码」→ 自动收藏 → 日后评 3 星 → 移出「无码」等所有非值得复盘清单
（值得复盘\* 保留）。

## 4. 与现有 doc/53 / 124 / 125 的关系

| 现有 | 现状 | 新方案 |
|---|---|---|
| doc/53 加入「等待更新\*」→ 自动收藏 | 仅等待更新触发 | 被 **Feature A 取代**（超集，向后兼容） |
| doc/124 评分/已读 → 移出「等待更新\*」 | 仅移出等待更新 | 被 **Feature B 取代**（超集，向后兼容） |
| doc/125 加入非等待更新清单 → 移出等待更新 | 独立「归类即离开收件箱」 | **保留**（D3）；用独立函数，不与 Feature B 混用（见 §6 末注） |

## 5. Feature A：加入任意清单（除值得复盘\*）→ 自动收藏

- **触发点**：`vlt-checkbox.ts` `handleCheckboxChange`，当 `checked===true`（加入）且
  `association !== 'limit_exceeded'`。
- **触发条件（改）**：清单名**不含**受保护关键词（`!isProtectedList(lname)`）；原 doc/53 为
  `含 '等待更新'`。
- **动作**：`autoFavoriteIfPendingUpdate`（保留现有保护）：
  - 番号**已有** JHS 状态（收藏/已读/屏蔽）→ **跳过**，不覆盖（防状态回退）。
  - 番号**无**状态 → `saveCar(FAVORITE_ACTION)` + 广播 + `triggerJavdbWantAndSyncRatingBar`
    （同步 JavDB 想看 + 评分条）。
- toast 文案从「添加至等待更新」改为实际清单名。
- **总开关**：`autoFavCleanupEnabled` 关闭时跳过本自动化。

## 6. Feature B：收藏 → 已读星级 → 移出所有非值得复盘清单

- **触发点（双路径，互斥不重复）**：
  1. **脚本评分条** `quickSetHasWatch`（点星 1–5 / 点「已读」0 星，D2 含 0 星）。该路径用
     `_wantWatchedSyncing` 阻断 observer，不与路径 2 重复。
  2. **原生「我看過」按钮** → MutationObserver → `onWatchedAdded`（D1 覆盖）。
- **触发门控（新增）**：
  - **改动前 JHS 状态 === FAVORITE_ACTION（收藏）** —— 落实「**从收藏**改为」；
  - 且新状态 = 已观看（任意星级，含 0 星）。
  - `quickSetHasWatch` 本就读取旧 car record（`if status===FAVORITE removeCar`），可据此判旧态；
    `onWatchedAdded` 同理在写新态前读旧态判定。
- **动作**：新函数 `removeFromNonProtectedListsOnWatch`：
  - **DOM 优先**：遍历原生 `#modal-save-list` 中当前影片**已勾选**的清单，凡名称**不含**受保护
    关键词者 → 取消勾选 + 派发 change（走 VLT 服务端管线 `enqueueServerCheckboxMutation` 真删）
    + 同步面板勾选框。
  - **DOM 不可用兜底**：查 `VltDb.queryMoviesLists` 得当前影片清单 → 过滤非受保护 → 服务端移除。
  - 名称**含**受保护关键词的清单 → **跳过保留**。
- **总开关**：`autoFavCleanupEnabled` 关闭时跳过。

> **与 doc/125 分离**：Feature B 的移除函数（移出所有非受保护清单，on-watch）与 doc/125 的
> 「移出等待更新」（on-categorize，用 `AUTO_FAVORITE_KEYWORD='等待更新'`）是**两个独立函数**，
> 不可混用——否则 doc/125 泛化后会把你刚加入的清单也移除。常量分工：`AUTO_FAVORITE_KEYWORD=
> '等待更新'`（doc/125 专用）、受保护关键词（Feature A 例外 + Feature B 保留）。

## 7. 配置（基础配置「清单收藏合并」分区追加）

| 项 | 默认 | 说明 |
|---|---|---|
| `autoFavCleanupEnabled` | 开（YES） | A/B 两个自动化总开关（D5） |
| `protectedListKeywords` | `值得复盘` | 逗号分隔、包含匹配；**同时**驱动 Feature A 例外与 Feature B 保留（D4） |

常量 `AUTO_FAVORITE_KEYWORD='等待更新'` 保留给 doc/125。

## 8. 边界与补全

1. 已看过/已屏蔽的片加入清单 → **不**自动收藏（保留现有 skip，防状态回退）。
2. 评星触发移除时，该片不在任何非受保护清单 → noop。
3. 部分清单移除失败 → 复用 VLT 服务端管线恢复日志/重试（`enqueueServerCheckboxMutation`），不静默丢操作。
4. 「值得复盘」包含匹配（`值得复盘1`/`值得复盘-无码` 均受保护）。
5. 「从收藏改为」判定基于改动前 JHS car record 旧状态。
6. 0 星「已读」触发 Feature B（D2）。
7. 双路径互斥：脚本评分条用 `_wantWatchedSyncing` 阻断 observer，原生按钮走 observer。
8. **与 doc/200 合并面板交互**：移除取消原生 checkbox → modal observer → `syncMergedRowsForListId`
   响应式刷新合并行。
9. **与期2（doc/204）交互**：期2 是用户主动批处理，Feature B 是单片评星触发，时机不同不冲突；
   期2 文档应标注「压实等待更新N 期间若手动评星会触发 Feature B 移除非受保护清单」。

## 9. 涉及修改的模块（仅列，不实现）

| 模块 | 改动 |
|---|---|
| `vlt-helpers.ts` | 新增受保护关键词读取 + `isProtectedList(name, keywords)` 辅助 |
| `vlt-checkbox.ts` | `handleCheckboxChange` 自动收藏条件改 `!isProtectedList`（Feature A）；新增 `removeFromNonProtectedListsOnWatch` + 泛化 uncheck/find 辅助（Feature B）；doc/125 逻辑保留不动 |
| `dpb-rating-api.tsx` | `quickSetHasWatch` 增「旧态===收藏」门控 + 调 Feature B（脚本路径） |
| `dpb-want-watched.ts` | `onWatchedAdded` 增「旧态===收藏」门控 + 调 Feature B（原生按钮路径） |
| `base-panel.tsx` / `setting-form-load.ts` | 新增 `autoFavCleanupEnabled` 开关 + `protectedListKeywords` 输入 |
| `tests/` | `isProtectedList` / 过滤 / 触发门控 纯逻辑单测 |

## 10. 风险

- **误移除（主要）**：Feature B 从**所有**非受保护清单移除（范围远大于 doc/124）。若存在本意
  「长期保留」的清单，评星后会被清掉。受保护清单目前仅「值得复盘」，如需保留其他清单，用
  `protectedListKeywords` 追加。**实施前用户须确认「值得复盘」是唯一需保留的清单类**。
- **批量移除**：单片所在清单通常不多（几个），非期2 大批量，用现有逐条服务端管线即可，限流风险低。
- **状态判定依赖 JHS car record**：若本地 car record 缺失/与服务端不一致，「旧态===收藏」门控
  可能误判。建议在门控同时参考原生想看 tag（`.review-buttons`）作双重确认。

## 11. 待实施

本方案已用户确认存档，**尚未实现**。实现时建议先做 Feature A（条件改动小），再做 Feature B
（双路径 + 门控 + 泛化移除），各步配单测并补执行验证记录，依 migration 原则推进状态。
