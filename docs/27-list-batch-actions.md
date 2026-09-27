# 列表页勾选式批量操作（收藏 / 已读 0–5★ / 取消已读）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页卡片勾选框与底部工具栏；`car_list` 新增批量「取消已读」写入路径
> **前置文档**：`24-read-status-score-filter.md`、`26-preload-request-list-panel.md`
> **替代文档**：无
> **生效版本**：v1.46.19

> 本文件是「列表页批量与预加载 UX」需求（3 项）的**第 3 项**增量，也是该需求的收口项。

## 1. 背景与需求

列表页此前只能逐张卡片进入详情页操作；用户希望**勾选多张卡片后一次性写入**：

- **收藏**（`status = 收藏`）
- **已读**（`status = 已读` + `score` = 0–5 星，与 doc/24 的星级筛选同一数据源）
- **取消已读**（清除已读标记）

用户确认口径（Q5b）：**勾选后**执行，而不是「一键对当前页全部执行」——
避免误伤未选中的卡片。

## 2. 数据安全边界（本项最关键的设计约束）

| 操作 | 存储路径 | 为什么这样做 |
|---|---|---|
| 收藏 | `saveCarList`（批量新增/更新） | **已在收藏列表的番号直接跳过** —— `saveSingleCar` 对重复收藏会 `failWithToast`，逐条调用会中断整批 |
| 已读 n★ | `saveCarList`（`actionType=已读` + `score=n`） | 存储层对「重复已读」无重复校验 → 可用来**改星**（已读 → 已读 3★） |
| 取消已读 | **新增** `clearCarWatchStatus` | 只把 `status` 置回未标记，**保留记录与 url/names/remark/score/createDate**。绝不用 `removeCar`（那会整条删除用户记录） |

- 只对 `status === 已读` 的记录执行取消已读 → **不会误清收藏/屏蔽状态**。
- 无变化的批量（`changed === 0`）**不写库**（避免无意义修订号自增与跨标签广播）。
- 写入后不迁移、不清理任何既有数据。

## 3. 方案

### 3.1 分层

| 层 | 文件 | 职责 |
|---|---|---|
| 纯逻辑 | `src/plugins/list-page/lp-batch-state.ts` | `BatchSelection`（勾选集合，大小写归一）+ `planFavoriteBatch` / `planWatchedBatch` / `planUnwatchBatch`（算出待写入记录与跳过原因，**不落库**） |
| 视图 | `src/components/list-page/lp-batch-bar.tsx` | `LpBatchCheckbox`（卡片勾选框）+ `LpBatchToolbar`（底部工具栏） |
| 编排 | `src/plugins/list-page/lp-batch.tsx` | 注入勾选框、文档级点击委托、执行批量写入、结果汇报、写后刷新 |
| 样式 | `src/styles/list-page/lp-batch.css` | 勾选框与工具栏样式（走 design-tokens） |
| 存储 | `src/core/storage/car-list-ops.ts` | 新增 `clearCarWatchStatus`（+ `StorageManager` 委托方法） |

### 3.2 勾选框注入点

复用 `core/util/util-status-tag` 的 `injectStatusTag`（`.tags` → `.item-tag` → `.photo-info > span > div`
三级回退）——与状态标签**同一注入点、同一套定位上下文**，因此绝对定位行为与既有状态标签一致，
不需要改动站点元素的 `position`，也不引入新的裸站点选择器（`check:selectors` 保持 89 文件 / 275 处）。

### 3.3 交互要点

- 勾选框位于 `<a>` 内：点击时 `preventDefault + stopPropagation`，否则会打开详情页；
  勾选态由 JS 显式设置（组件**刻意不渲染 `checked` 属性** —— `checked="false"` 在 HTML 里仍算选中）。
- 文档级**单一委托监听**（`click`），不随列表重排重复绑定；`destroyBatchToolbar` 负责移除。
- 勾选数为 0 → 工具栏移除；> 0 → 底部固定工具栏出现（`--jhs-z-page`，不压过 layer 弹窗）。
- 写入进行中 → `busy` 置位，工具栏按钮全禁用（防重复提交）。
- 写入完成后：清空选择 → 重新 `doFilter()`（刷新状态标签/显隐）→ 重建勾选框 →
  `StatusTagFilterPlugin.warmScoreIndex()`（刷新星级索引，使新的已读星级立即出现在筛选栏）。

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/list-page/lp-batch-state.ts` | **新增** 勾选集合 + 三类写入计划 |
| `src/plugins/list-page/lp-batch.tsx` | **新增** 编排（注入/委托/执行/刷新） |
| `src/components/list-page/lp-batch-bar.tsx` | **新增** `LpBatchCheckbox` / `LpBatchToolbar` |
| `src/styles/list-page/lp-batch.css` | **新增** 样式 |
| `src/core/storage/car-list-ops.ts` | **新增** `clearCarWatchStatus`（保留记录的取消已读） |
| `src/core/storage-manager.ts` | 暴露 `clearCarWatchStatus` 委托方法 |
| `src/plugins/list-page-plugin.tsx` | `initBatchToolbar` / `syncBatchCheckboxes` 薄委托 + `initCss` 注入样式 + `handle()` / `checkDom()` / `destroy()` 接线 |
| `tests/lp-batch-state.test.ts` | **新增** 9 用例（勾选集合、收藏跳过/信息缺失、星级透传含 0、取消已读只命中已读） |

## 5. 执行验证记录

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**22 文件 / 263 用例**（原 21 / 254，新增 9） |
| `bun run check:structure` | exit 0（384 files, 67 dirs） |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

### 验证结论

三类批量写入的**决策部分**（写什么、跳过什么、为什么跳过）由 9 个单测覆盖：
收藏跳过已收藏、已读透传星级（含 `score=0` 不被丢弃）、取消已读只命中当前已读记录。
写入路径全部复用既有存储 API；新增的只有 `clearCarWatchStatus`（保留记录、只清 status）。

## 6. 后续验证建议（真实浏览器）

1. 列表页每张卡片左上角出现勾选框；勾选 2–3 张 → 底部出现工具栏「已选 N 项」。
2. 点「收藏」→ toast 报告写入/跳过数量；卡片出现收藏状态标签（或计数变化）。
3. 点「已读 3★」→ 卡片出现已读标签；状态筛选栏的 `3星` 芯片计数 +N。
4. 点「取消已读」→ 已读标签消失；对收藏卡片执行同一操作时**收藏状态不受影响**。
5. 勾选框点击**不应**打开详情页（验证 `preventDefault` 生效）。
6. 写入后选择被清空，工具栏消失。

## 7. 已知限制

- 批量只作用于**当前页面已渲染的卡片**（未加载的卡片不在选择范围）。
- 收藏卡片没有「批量取消收藏」入口（用户未要求；避免误删用户收藏关系）。
- 勾选框固定左上角，若用户把状态标签位置设为「左上」（`tagPosition=leftTop`）会与标签视觉重叠
  —— 两者均可见可点，仅位置邻近。
- 选择状态为**页面级**（模块级变量）：翻页/刷新后清空。
