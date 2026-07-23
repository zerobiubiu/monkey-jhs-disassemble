# doc/179 — 原子化→复用循环收敛验证（Round 4 执行 / Round 5–8 复查）

> 文档类型：📄参考说明
> 文档状态：✅已执行

本文档记录「先原子化拆分、再复用合并、再原子化复查、再复用复查、多轮循环」工作流的**收敛验证**过程与证据。Round 4 为执行轮（产生 v1.28.18 原子化 + v1.28.19 复用两个代码版本），Round 5–6 为工作级复查，Round 7–8 为导演级源码核查。本文档为纯文档记录，**不递增版本号**（按 AGENTS §6.1.1，纯文档修改不递增版本；代码版本保持 1.28.19）。

## 1. 背景

用户在多轮请求中要求对全代码做原子化拆分与复用合并的多轮循环检查。Round 4 的全树审计发现：

- `list-page-plugin.tsx`（734 行）此前**从未原子化**（更早 wave 的声明为假）；
- 多个已拆分 barrel 仍含残留逻辑（history / blacklist / new-video 的数据层方法未移出）；
- 15 个超 400 行文件混合多职责；
- 复用维度存在 3 个真实项：C3（simple_lists 分页获取跨插件重复）、C1（back-to-top CSS 孪生）、C2（back-to-top 逻辑对，需分级记录）。

Round 4 据此执行了 v1.28.18（18 文件原子化，7 新子目录 + 25 新模块）与 v1.28.19（C3 提取 `fetchSimpleListsPage` + C1 分组选择器去重 + C2 记录不合并）。

## 2. Round 5–6 工作级复查（只读）

| 轮 | 原子化判定 | 复用判定 |
|----|-----------|---------|
| R5 | CONVERGED（L=12，H=0 M=0） | CONVERGED（L=9，H=0 M=0） |
| R6 | CONVERGED（L=2，H=0 M=0） | CONVERGED（L=12，H=0 M=0） |

R6 在**未变更**的树上独立复核：20 个 barrel 行数与 R5 逐字节相同；≥400 行集合与 R5 完全一致（11 文件，全内聚 L/N-A）；复用维度对 C1/C3/D1 给出 grep 证据（分组选择器存在 + 冗余块计数 0；`fetchSimpleListsPage` 单定义 + 双调用方；`replaceTitleTextNodes` 单定义 + 3 调用点）。

## 3. Round 7–8 导演级源码核查（只读，逐文件 import 图 / 函数清单）

对全部 14 个 ≥290 行文件以「import 图（类协调器）/ 函数清单（模块文件）」为透镜亲自核查，结论如下：

| 文件 | 行数 | 观察到的证据 | 判定 |
|------|------|-------------|------|
| vlt-create-list-api.ts | 546 | 仅 import 同级逻辑模块，无 JSX/组件/CSS；唯一边界见 §4 | 内聚（依赖方向 L） |
| lp-filter.tsx | 288 | filterMovieList + renderItemStatusTag 同读 IDB 同写 .item DOM = 数据驱动渲染，单一职责 | 内聚 |
| setting-plugin.tsx | 451 | import 块显示所有重逻辑已提取至 setting/* + 7 组件 + 3 CSS；类体为编排壳 | 协调器 |
| dpb-list-panel.tsx | 428 | fetch + render 原语在 L427-428 再导出至 dpb-list-panel-fetch/-render；余为面板 UI 生命周期 | 协调器 |
| db/vlt-db-core.ts | 419 | 零网络/零 DOM/零 UI/零 toast；纯连接 + 事务 + CRUD + 修订辅助 = DAO | 内聚 |
| rating-display-plugin.ts | 440 | 从 5 同级模块 import renderer/cache/net/config/utils；类 = Core 编排 | 内聚核心 |
| history-plugin.tsx | 431 | L56 自 history/history-data import getDataList + batch-ops + tabulator + 3 组件 → R4 M4 残留**已落地** | 协调器 |
| vlt-tags.ts | 421 | render→vlt-tag-renderer、filter→vlt-filter-bar、listener→vlt-sync-listener 均已提取；类 = 数据驱动标签渲染 | 内聚 |
| storage-manager.ts | 415 | CRUD 自 5 个 storage/*-ops import + migrations；类 = facade + 类型再导出 | facade |
| detail-page-button-plugin.tsx | 414 | ~40 函数以 `_*` 别名自 5 个 dpb-* 模块 import；类 = 薄委托 | 协调器 |
| vlt-reconcile.ts | 410 | 单一对账管线；HTML 解析服务于快照构建，非独立职责 | 内聚管线 |
| page-sort-plugin.ts | 400 | 仅 import base + css；自包含叶子；sortGuard MO 内在于「保持排序」 | 内聚 |
| osp-preload.tsx | 393 | 预加载 + 其自身进度徽标渲染 = 预加载状态的数据驱动视图 | 内聚 |
| common-util.ts | 296 | L26-32 自 util/esc-layer import 5 个 ESC 函数 + 10 个 util 模块；类 = 薄 facade → R4 M2 ESC **已落地** | facade |

核查中可交叉验证的两处先前 wave 提取（history 的 getDataList、common-util 的 ESC）均确认**已落入 barrel**，非「声称已拆」。

## 4. 唯一边界文件 vlt-create-list-api.ts 的依赖方向解析

该文件含一个 UI 状态复位函数 `restoreCreateListUi`（L530-546，导出），看似应归 `-ui` 模块。亲自读代码后的依赖方向证据：

- `finishCreateList`（L496-525，**必须留在 -api**：L510 `refreshListPanel()` + L524 `handleCheckboxChange(...)` 为 IDB 同步）在 **L507 调用** `restoreCreateListUi()`；
- `vlt-create-list-ui.tsx` **L11** `import { createList, restoreCreateListUi } from './vlt-create-list-api'`，即 `-ui → -api` 边已存在；`-api` 不 import `-ui`，当前图为 DAG。

若把 `restoreCreateListUi` 移入 `-ui`：因 `finishCreateList` 在 L507 调用它且须留 `-api`，将产生 `-api → -ui`，叠加既有 `-ui → -api` = **`ui ↔ api` 循环**。若连 `finishCreateList` 一并移入 `-ui`，则把 L510/L524 的 IDB 同步拖入 UI 模块 = 内聚退化。两种「更整洁」的拆法均更差（一者成环、一者错置数据同步）。故将 `{createList, finishCreateList, restoreCreateListUi}` 簇置于 `-api`、`-ui` 作纯导入叶子，是无环且保内聚的选择 → 分级 **L/N-A**（非 M）。这也说明此处若强行开 wave 只会引入成环风险的无效 churn。

## 5. 复用维度已决项（grep 证据，备查）

- C1 back-to-top CSS 孪生 = RESOLVED：`back-to-top-button.css` 含分组选择器 `#jhs-back-to-top, #jdb-wf-back-to-top`；`list-waterfall-plugin.css` 中 `#jdb-wf-back-to-top` 计数 0；`@keyframes jdb-wf-spin` 保留。
- C2 back-to-top 逻辑对 = N/A：双按钮为设计意图（`back-to-top.ts` 以 `getElementById('jhs-back-to-top')` 守卫避免重复创建；jQuery tween 500ms vs native smooth 手感不同），合并改手感 = 零偏差风险，记录不合并。
- C3 simple_lists 获取 = RESOLVED：`fetchSimpleListsPage` 单定义于 `core/util/util-simple-lists.ts`，`dpb-list-panel-fetch.ts` 与 `vlt-server-api.ts` 双调用；throw-vs-null 语义保留在各调用方。
- D1 replaceTitleTextNodes = RESOLVED：单定义于 `list-page/lp-dom.ts`，3 调用点委托。
- 广播总线 / failWithToast / ColoredTextCell 采纳 = 全 N/A/L（不同通道形状 / 无剩余对 / 单用 span）。
- R6–R11 / NEW-1 / NEW-2 = L；R5 Fc2 骨架 = N/A（§10.2 有害过度抽象，记录不合并）。

## 6. 收敛判定

- 原子化维度：R5、R6 工作级 CONVERGED；R7、R8 导演级对全部 ≥290 行文件确认内聚/协调/facade，唯一边界按依赖方向解析为 L。
- 复用维度：R5、R6 工作级 CONVERGED；无 ≥15 行同职责跨文件重复，无未采纳的干净采纳候选。
- 结论：循环在 Round 4 执行后、Round 5–8 复查下达到**不动点**；对未变更字节的进一步迭代只会复现相同判定。

## 7. 重开条件（精确）

仅当未来代码变更引入下列之一时重开循环：

1. 某文件混合 ≥2 个**因不同原因变化**的独立职责；
2. 出现 ≥15 行、跨 ≥2 文件、同职责且形状干净可合并的重复块；
3. 出现可拆分而**不**引入 import 循环、**不**把数据同步拖入 UI 模块的内聚簇。

在当前字节（dd54bc6）上三者均不存在；其中 (3) 即 §4 的边界，已据代码关闭。

## 8. 提交记录

- `e17a3e7` v1.28.17 复用合并（Wave 3）
- `18ced63` v1.28.18 原子化拆分（Wave 4 / Round 4）
- `dd54bc6` v1.28.19 复用合并（Wave 4 / Round 4）
- 本文档提交：纯文档，不递增版本（保持 1.28.19）。
