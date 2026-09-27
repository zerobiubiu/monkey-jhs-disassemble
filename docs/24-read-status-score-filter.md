# 已读星级筛选（按本脚本评分）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页状态标签筛选栏（已读维度细分）
> **前置文档**：`javdb-site-structure.md`、`status-tag-filter` 相关插件
> **替代文档**：无
> **生效版本**：v1.46.16

> 本文件是「列表页批量与预加载 UX」需求（3 项）的**第 1 项**增量；第 2 项（预加载队列
> 面板与权重）、第 3 项（勾选式批量操作）在后续增量中另行记录。

## 1. 背景

状态标签筛选栏（`.status-tag-filter-bar`）原本只能按**标签文本**筛选：芯片由页面上
`.tag.is-success.status-tag` 的文本动态生成（收藏 / 已读 / 无标签 / 屏蔽类），点击按 OR 过滤。

问题：**已读无法按评分细分**。用户希望按**自己给出的评分**（不是站点评分）做 0–5 星过滤。

事实核对（代码）：

| 事实 | 出处 |
|---|---|
| 本脚本自己的评分存在 `car_list` 的 `CarRecord.score` | `src/core/storage/car-list-ops.ts` |
| 刻度为整数 **0–5**，`0` 表示未评分 | `dpb-review-sync.tsx`：「已看评分 0-5（0 表示未评分）」 |
| 已读状态常量为 `HAS_WATCH_ACTION` | `src/constants/status.ts` |
| `StorageManager.cacheCarList` 提供同步缓存 | `src/core/storage-manager.ts` |

## 2. 方案

### 2.1 新增 `src/plugins/status-tag-filter/stf-score.ts`

- `setCarRecords(records)`：把 `car_list` 灌入模块级 `carNum → score` 索引（**只收已读记录**）；
  评分归一化为 0–5 整数（缺失/非法 → 0，越界截断），防历史脏数据。
- `hasScoreIndex()` / `getScore(carNum)`：同步读取（`applyFilter` 是同步函数，不能 await）。
- `parseScoreChipValue(value)` / `SCORE_VALUE_PREFIX` / `SCORE_RANGE` / `formatScoreLabel`：
  星级芯片值协议（`score:0` … `score:5`）。
- `getItemCarNum(item)`：取卡片番号（走站点选择器注册表 `listTitleStrong`）。
- `countWatchedByScore()`：统计当前页已读卡片的星级分布（**跳过 `data-hide` 卡片**）。

**关键设计：星级判定不依赖 DOM 是否渲染了「已读」标签。** 判定依据是 car_list 里存在该番号的
已读记录（`getScore` 非 null）。这样「有记录但标签未渲染」的卡片同样被计入与筛选——
直接覆盖了需求里「给过已读但没有标签的，从缓存加载出来」的**过滤侧**语义。

### 2.2 筛选栏新增星级芯片（`stf-ui.ts`）

在标签芯片之后，若当前页存在已读卡片（`watchedTotal > 0`），追加 **6 个星级芯片**
（`0星`…`5星`，带各自计数）。芯片值与激活状态沿用既有机制（`dataset.value` + `.active`），
刷新时保留已选。

### 2.3 筛选逻辑支持星级（`stf-apply.ts`）

- `selectedTags` 排除星级值（避免把 `score:N` 当标签文本比对）；
- 新增 `selectedScores`：卡片必须是已读（`getScore` 非 null）且评分命中选中星级；
- 与既有条件用 OR 连接：`shouldShow = tagMatch || noTagMatch || scoreMatch`。

### 2.4 索引预热（`status-tag-filter-plugin.ts`）

新增 `warmScoreIndex()`：`await storageManager.getCarList()` → `setCarRecords(...)` → 刷新芯片。
在 `handle()` 中调用一次；后续批量操作改动 `car_list` 的入口也应调用以刷新。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/status-tag-filter/stf-score.ts` | **新增** 评分索引 + 星级芯片值协议 + 星级分布统计 |
| `src/plugins/status-tag-filter/stf-ui.ts` | 筛选栏追加 6 个星级芯片（有已读卡片时才生成） |
| `src/plugins/status-tag-filter/stf-apply.ts` | 星级匹配（与标签/无标签条件 OR） |
| `src/plugins/status-tag-filter-plugin.ts` | 新增 `warmScoreIndex()` 并在 `handle()` 预热 |
| `tests/stf-score.test.ts` | **新增** 11 用例（索引构建/归一化、芯片值解析、分布统计、跳过 data-hide） |

**未改动**：不写 `car_list`、不触发迁移、不改用户既有数据；`status-tag-filter-plugin.css`
（零偏差契约样式表）未触碰 —— 星级芯片复用既有 `.status-tag-filter-chip` 样式。

## 4. 执行验证记录

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0 |
| `bun run test` | exit 0；**18 文件 / 228 用例**（原 17 / 217，新增 11） |
| `bun run check:selectors` | exit 0（新文件无裸站点字面量：番号读取走注册表 `listTitleStrong`） |

### 验证结论

已读可按本脚本评分 0–5 星过滤；计数与筛选均以 `car_list` 记录为准，不依赖「已读」标签是否
渲染；非已读记录与 `data-hide` 卡片被正确排除。

## 5. 后续验证建议

1. 真实浏览器列表页：确认星级芯片出现、计数与 `car_list` 一致、点击后过滤正确、刷新保留选中。
2. 交叉验证：把某片手动标记 4★ 已读 → 列表页应出现 `4星` 计数 +1，且点 `4星` 能筛出。
3. 回归：无已读记录时不生成星级芯片，且不影响原有标签芯片与「无状态标签」逻辑。

## 6. 已知限制

- 星级分子当前按**整数** 0–5 聚合；若未来 `score` 支持半星，需要改 `SCORE_RANGE` 与归一化。
- 索引只在插件初始化与显式 `warmScoreIndex()` 时刷新；跨标签页的 `car_list` 变更需重新加载页面
  或后续接入存储修订回调（第 3 项批量操作落地后会调用刷新）。
- 卡片「已读」标签的**视觉补渲染**（有记录但页面未渲染标签时补出标签）是单独一项，见后续增量。


---

## 7. 增量二：从缓存补渲染缺失的状态标签（已执行）

### 背景

卡片 status-tag 由 `list-page/lp-filter.filterMovieList` 渲染，落地点是
`$item.find('.tags').append(...)`。若卡片**没有 `.tags` 容器**、番号解析失败或渲染时序不对，
就会出现「car_list 里明明有已读/收藏记录，卡片上却看不到标签」。

### 方案

- `stf-score.ts` 索引从「仅已读评分」扩为 **`carNum → { status, score }`**：
  新增 `getStatus(carNum)`，`getScore` 仍仅对已读记录返回值；新增
  `collectMissingStatusTags(hasTag)`（换出「有记录但缺标签」的卡片，跳过 `data-hide` 卡片）。
- 新增 `src/plugins/status-tag-filter/stf-render.ts`：`renderMissingStatusTags()` ——
  以 car_list 索引为准补渲染，注入点复用 `injectStatusTag` 的三级回退
  （`.tags` → `.item-tag` → `.photo-info > span > div`），比原路径容错更强。
- `status-tag-filter-plugin.warmScoreIndex()` 在灌入索引后调用补渲染，再刷新芯片。

**数据安全**：纯补充渲染 —— 不写 car_list、不改已有标签、不清除任何内容。

### 验证

`bun run test` → **18 文件 / 230 用例**（新增 2 条：状态索引覆盖、补渲染候选收集）；
`build` / `lint` / `check:selectors` 均 exit 0。

### 关于「缺失 score 回填」

需求提到「已读记录缺失 score 时回填」。**实现取“读取时兜底”而非写回**：
`setCarRecords` 把缺失/非法评分归一化为 `0`（未评分），筛选与计数均按 0 处理。
理由：`score` 的唯一来源就是本脚本自己的记录，缺失时**没有可信来源可回填**；
凭空写回会伪造用户评分，违背「不篡改既有数据」约束。
