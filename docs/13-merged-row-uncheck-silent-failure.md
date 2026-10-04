> **文档类型**：📄 参考说明 / 🔧 开发指导
> **文档状态**：🚫 已废弃（缺陷已由 `41-merged-row-uncheck-fix.md` 修复；本文档保留现场与假设记录，不再更新）
> **影响范围**：详情页清单面板合并行（`.jhs-list-group`）的取消路由与展示态重算；不涉及 VLT 服务端管线本身
> **前置文档**：`docs/10-list-management.md`（doc/200 合并 / doc/204 压实 / doc/205 自动化联动）、`docs/06-waterfall-and-list-sync.md`（doc/124/125/126 等待更新联动与一致性治理）
> **替代文档**：`41-merged-row-uncheck-fix.md`
> **生效版本**：待定（记录于 v1.46.4 之后的现场）

# 合并行「取消」静默失败：动作端与展示端共用同一原生 checkbox 查找器

## 1. 背景

2026-09-16 用户报告一条具体现象（番号 `JFB-510`，清单 `等待更新1`，listId `Azm8DM`）：

1. 打开详情页，该片在 `等待更新1`；用户账号存在 `等待更新1`、`等待更新2` 两个清单，被序号合并为**一个合并行**（显示名 `等待更新`）。
2. 在合并行上**取消勾选** → UI 立刻显示为已取消，但**服务端并未移除**（刷新后仍在 `等待更新1`）。
3. 再次勾选 → 该片**进入了 `等待更新2`**。
4. 再取消 → `等待更新2` 的取消**正常生效**。
5. 刷新页面 → 该片仍在 `等待更新1`，反复操作始终无法清除。

清理动作最终由控制台脚本完成（服务端 POST + 本地镜像，结果对称：两侧均 496，本地剩余关联为空），**本缺陷本身未修复，也未复现**。本文档只固化现场、代码定位与候选修法，待下次可复现时再处理。

## 2. 现场取证（已验证事实）

### 2.1 数据一致性排除

| 检查项 | 结果 |
|--------|------|
| 本地镜像 `JAV-JHS/appData/vlt_movie_inventory` | 存在 `JFB-510::Azm8DM` |
| 本地 `vlt_inventory[Azm8DM]` | `name='等待更新1'`、`count=497`、真实关联数 `497`（**无漂移**） |
| 服务端 `GET /users/simple_lists?vid=…` | `Azm8DM` 对 `JFB-510` 为 `checked=true`、显示数量 `497` |
| 服务端写入 `POST /users/save_video_to_list {checked:false}` | `200` + `{success:true, message:'已從清單等待更新1中移除'}`，复核 `checked=false`、数量 `496` |

**结论**：服务端接口可用、两侧数据一致。现象既不是数据分叉，也不是接口权限/参数/上限问题；失败发生在**客户端这一次取消动作没有走完**。

### 2.2 现象到代码的逐条映射

| 用户观察 | 对应代码 |
|----------|----------|
| 取消后展示变未勾选 | `removeFromGroup` 末尾 `plugin._scheduleListPanelSync(0)` → `refreshMergedRowDisplay` → `liveMembers` → `computeGroupCheckState` |
| 服务端没删 | `setNativeCheckbox` 查不到原生 input → `return false`，**不派发 change**，服务端零请求 |
| 再勾选进了 `等待更新2` | `pickTargetMember` 跳过 `member.checked === true` 的成员；`liveMembers` 读到的 `等待更新1` 仍是原生真值 `true` → 顺延到 `等待更新2` |
| `等待更新2` 的取消正常 | 该成员原生 input 可定位 → 派发 change → `setupCheckboxListener` → POST 成功（已实证） |

关键代码（`src/plugins/detail-page-button/dpb-list-merge-ui.ts`）：

- `findNativeInput`（L60-65）：查不到返回 `null`；
- `liveMembers`（L113-126）：`const input = findNativeInput(ref.id); if (!input) continue;` —— 该成员被**静默丢弃**；
- `setNativeCheckbox`（L136-143）：`if (!input) return false;` —— 取消动作被**静默跳过**；
- `removeFromGroup`（L385-409）：`if (!ok) failed.push(member.name)`，仅用于展示 `以下清单移除失败：…` 提示，主流程继续；
- `addToGroup`（L337-358）：`computeGroupCheckState` 有 `containing.length > 0` → 提示「该影片已在此清单组中」；否则 `pickTargetMember` 选目标。

**缺陷本质**：**动作端（派发取消）与展示端（重算合并行勾选态）共用同一个 `findNativeInput`**。当该查找失败时，两件事同时发生——① 取消动作静默不执行；② 展示端因找不到该成员、将其视为「不含片」而重算出 `checked=false`。二者叠加即用户所见「UI 说取消了，实际没取消」。

## 3. 未验证环节（下次复现需确认）

「`等待更新1` 的原生 checkbox 为什么查不到」尚无现场证据。候选假设，按可能性排序：

1. **原生容器被替换**：`removeFromGroup` 逐成员串行取消，成员间 `await sleep(SERIAL_CHANGE_GAP_MS)`；期间一次成功的取消会触发 JavDB 原生刷新，`#modal-save-list [data-list-target="listContainer"]` 整体重建，导致 `dataset.listMembers` 中其余成员的引用过期（代码注释已提示 listContainer 可能被替换，doc/128 亦记录过 generation 递增处理）。
2. **成员未进入原生容器**：该成员落在 `/users/simple_lists` 尚未抓回的分页里（面板分页聚合 50 页上限）。
3. **成员处于 busy/禁用态**：`forwardListGroupChange` 在 `dataset.jhsBusy === '1'` 时忽略本次变更并回滚展示。

## 4. 下次复现的取证清单

1. 点合并行取消时开 Console，观察是否出现：
   - `${LOG_PREFIX} ═══ 取消 [JFB-510] → 等待更新1 ═══`（无 → 命中假设 1/2/3）
   - `同步结果: movie=… list=… association=…`（`deleted` / `unchanged` / 其他）
   - 面板提示「以下清单移除失败：…」
2. 同时抓：`document.querySelectorAll('#modal-save-list input[data-list-id]')` 的 id 列表、合并行 `dataset.listMembers`、以及 `#modal-save-list [data-list-target="listContainer"]` 是否在操作期间被替换（`MutationObserver` 记录）。
3. 记录操作前后服务端 `/users/simple_lists` 的 `Azm8DM` 勾选态。

## 5. 候选修法（未执行）

| # | 位置 | 改动方向 |
|---|------|----------|
| 1 | `removeFromGroup` | `setNativeCheckbox` 失败时先按 `dataset.listMembers` 重新解析成员引用重试一次；仍失败则用 `VltDb` 本地关联兜底走一次 `enqueueServerCheckboxMutation(..., false, null, true)`，并把最终结果如实回显（不再只提示而当作已完成） |
| 2 | `liveMembers` / `findNativeInput` | 查找失败不要静默 `continue`：区分「未含片」与「状态未知」，未知时触发一次 `_scheduleListPanelSync` 待原生容器重建后重算，避免展示端把未知当未含片 |
| 3 | `addToGroup` / `pickTargetMember` | 「是否已含片」与本地 `VltDb.queryMoviesLists` 交叉校验，避免原生勾选态滞后时把同一影片塞进同组第二个清单（本次「进等待更新2」的直接后果） |

修法 1/2 需覆盖三种场景回归：① 两成员组取消；② 三成员组取消（验证中途容器替换）；③ 成员未载入分页时取消。修法 3 需构造原生 `checked` 与本地关联不一致的场景。

## 6. 相关控制台脚本（已验证可用，用于兜底清理）

现场使用过的三段只读/写入脚本，均通过语法解析并在真实页面执行成功：

- 本地关联查询（只读 `JAV-JHS/appData` 的 `vlt_movie_inventory` / `vlt_inventory` / `vlt_meta`）；
- 服务端勾选态查询（只读 `GET /users/simple_lists?vid=…`，按 `data-list-id` 定位目标清单，翻页聚合）；
- 服务端移除 `POST /users/save_video_to_list`；本地镜像删除（删除 `"<番号>::<listId>"` 键、按剩余关联**重算** `count`、递增 `meta.listRevisions[listId]`、事务完成后读回复查）。

顺序约束（重要）：**必须先确认服务端已移除，再删本地镜像**。反序时服务端仍勾选、本地无关联，下次打开详情页会被 `runAutomaticReconciliation` 的「服务器已勾选、本地无关联 → 全量校准」分支写回本地（`src/plugins/video-lists-tag/vlt-reconcile.ts:443-454`）。

## 7. 执行验证记录

### 执行环境

- 用户真实浏览器（JavDB 详情页 `JFB-510`，登录态），2026-09-16
- 本次未修改任何 `src/` 文件，故无 `tsc -b && vite build` / `bun run test` 输出；`userscript.version` 按 `docs/README.md` §3.3 不递增

### 验证命令

- 浏览器控制台：本地关联查询（只读）、服务端勾选态查询（只读）、`POST /users/save_video_to_list`、本地镜像删除
- 文档自身：Markdown 结构检查（元数据块 + 章节完整）

### 实际输出

- 本地查询：`JFB-510` 本地关联 1 条，`listId=Azm8DM`、`name=等待更新1`、`countCache=497`、`countReal=497`
- 服务端查询：`Azm8DM（等待更新1）对 JFB-510：checked = true | 显示数量 = 497`
- 服务端移除：`POST -> 200 {success: true, message: '已從清單等待更新1中移除'}`，复核 `checked = false | 496`
- 本地删除：`removed='JFB-510::Azm8DM'`、`countAfter=496`、`剩余关联=[]`

### 前端或调用方验证

清理后服务端与本地同为 496，两侧收敛；刷新列表页标签消失。**缺陷本体（合并行取消静默失败）未复现、未修复**。

### 验证结论

`JFB-510` 的残留数据已清除，但这属于绕开缺陷的兜底操作，不是修复。合并行取消路由的静默失败路径仍存在，需按 §4 取证后在可复现条件下处理。

### 已知限制

- 失败点（原生 checkbox 查找为何失败）未定位，§3 三条假设均未验证；
- 现象描述来自用户回忆，非现场日志，中间态（提示文案、Console 行）缺失；
- 未构造最小复现（两清单组 + 一台片 + 取消/加入/取消序列）。