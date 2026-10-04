> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **影响范围**：详情页清单面板合并行（`.jhs-list-group`）的取消 / 加入路由与展示态重算；不涉及 VLT 服务端管线本身
> **前置文档**：`13-merged-row-uncheck-silent-failure.md`（缺陷现场与候选修法）、`10-list-management.md`
> **替代文档**：无
> **生效版本**：v1.47.3

# 合并行「取消」静默失败修复：未知成员不再伪装成已取消

## 1. 背景

2026-09-16 用户报告（番号 `JFB-510`，清单 `等待更新1`，listId `Azm8DM`）：详情页合并行（`等待更新1` + `等待更新2` 显示为合并行 `等待更新`）取消勾选 → UI 立刻显示已取消，但服务端并未移除；再次勾选进入 `等待更新2`；刷新后仍在 `等待更新1`。现场取证（详见 `13-merged-row-uncheck-silent-failure.md`）确认：服务端接口正常、两侧数据一致，失败发生在客户端一次取消动作没有走完。

根因（doc/13 §2.2）：动作端（`setNativeCheckbox`）与展示端（`liveMembers`）共用 `findNativeInput`。查找失败时两件事同时发生——① 取消被静默跳过（服务端零请求）；② 展示端把查不到的成员当作「未含片」重算成未勾选。二者叠加即「UI 说取消了，实际没取消」。

本文档执行 doc/13 §5 的修法 1/2/3 并收口该缺陷。

## 2. 方案与实施

### 2.1 取消路由：重试一次 + 服务端管线兜底（修法 1）

`src/plugins/detail-page-button/dpb-list-merge-ui.ts`：

- 原生派发失败不再直接判失败：等待一个成员间隔（220ms）重试一次，覆盖 `listContainer` 整体重建的短暂窗口；
- 仍失败改走 VLT 服务端管线直连兜底 `enqueueServerCheckboxMutation(movieInfo, listInfo, false, null, true)`——该管线遵守「先服务端确认、后本地镜像」顺序（doc/13 §6），并与原生 change 路径共用同一串行队列；
- 取消范围扩展：原生可解析且已勾选的成员 + 原生不可见但本地关联（`VltDb.queryMoviesLists`）确认含片的成员（覆盖「成员未载入分页」场景）。

### 2.2 展示端：区分「未含片」与「状态未知」（修法 2）

- `liveMembers` 不再静默丢弃查找失败的成员，改返回 `{ members, unresolved }`；
- 合并行渲染 `indeterminate = state.indeterminate || unresolved.length > 0`：存在未知成员时呈现半选，不再伪装成「已取消」；清单计数括注也计入未知成员。

### 2.3 加入路由：本地关联交叉校验（修法 3）

- 加入前先查本地关联：任一成员已含片（url 含同一 listId 或清单名一致）即阻断并提示「已在…（本地记录）」，避免原生勾选态滞后时把同一影片塞进同组第二个清单（本次「进入等待更新2」的直接后果）。

### 2.4 纯函数

`src/plugins/detail-page-button/dpb-list-merge.ts` 新增 `findLocallyContained(candidates, localEntries)`（本地关联命中口径：url `/lists/{id}` 或清单名完全一致）。

## 3. 修改文件清单

| 文件 | 变更 |
|---|---|
| `src/plugins/detail-page-button/dpb-list-merge.ts` | 新增纯函数 `findLocallyContained` |
| `src/plugins/detail-page-button/dpb-list-merge-ui.ts` | `liveMembers` 返回结构；`refreshMergedRowDisplay` 半选规则；`removeFromGroup` 重试 + 兜底 + 未解析成员纳入；`addToGroup` 交叉校验；新增 `getCurrentMovieInfo` / `queryLocalMemberships` / `cancelMemberAssociation` |
| `tests/dpb-list-merge.test.ts` | +4 用例（`findLocallyContained`） |
| `tests/dpb-list-merge-ui.test.ts`（新增） | +9 用例（jsdom + 假时钟）：半选展示 ×3、取消（正常 / 兜底 / 重建重试）×3、加入（阻断 / 正常）×2、手动刷新 ×1 |

## 4. 执行验证记录

### 执行环境

- Windows x64；Bun + vitest 4.1.10（`@vitest-environment jsdom` + `vi.useFakeTimers` 假时钟，不依赖真实等待）；2026-10-05

### 验证命令

- `bunx tsc -b`（类型门禁）
- `bunx vitest run tests/dpb-list-merge.test.ts tests/dpb-list-merge-ui.test.ts`（定向）
- `bun run test`（全量）
- `bun run build`（`tsc -b && vite build`）

### 实际输出

- `tsc -b`：rc=0；
- 定向：2 文件 / 46 用例全过（含新增 13）；
- 全量：**35 文件 / 362 用例全过**（原 34 / 349 + 13）；
- `bun run build`：✓ built in 767ms；产物 `dist/monkey-jhs-disassemble.user.js` 1,284.97 kB（gzip 330.03 kB）。

### 前端或调用方验证

- jsdom 场景回归覆盖 doc/13 §5 要求的三类场景：① 两成员组取消（全部派发原生 change、无失败提示）；② 容器重建（首试失败、重试窗口内恢复 → 原生路径命中，不走兜底）；③ 成员未载入分页（原生不可见 + 本地含片 → 服务端管线兜底，参数 `(movieInfo, listInfo, false, null, true)`）；
- 展示端半选规则、加入阻断 / 放行各有专项用例；
- 真实浏览器侧：缺陷原始现场（`JFB-510`）未复现，暂无法端到端复测；原 §4 取证清单仍适用于下一次现场。

### 验证结论

doc/13 修法 1/2/3 已实施并通过自动化回归；静态与构建门禁全绿。缺陷本体从「静默失败」收口为「失败可见、可重试、可兜底」。

### 已知限制

- 原缺陷未复现，三条失败假设（容器重建 / 未载入分页 / busy）未逐条现场实证；本修复按等价路径做防御性收口；
- 兜底依赖详情页影片信息可读（`.video-detail`）与 VLT 服务端管线可用；两者不可用时计入「移除失败」提示（不再静默）；
- 展示端对未知成员呈现半选（与「部分含片」共用同一视觉），属「宁可不表态、不误报已取消」的取舍。
