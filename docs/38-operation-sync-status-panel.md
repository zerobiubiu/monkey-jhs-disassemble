# 视频操作同步状态：持久化记录 + 设置面板（可查、可操作）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页批量操作与详情页操作 → JavDB 的后台推送可见性、设置弹窗新增面板、操作同步记录的存储
> **前置文档**：`27-list-batch-actions.md`、`31-batch-push-to-javdb-background-queue.md`、`37-detail-page-status-ops-non-blocking.md`
> **替代文档**：无
> **生效版本**：v1.47.0

## 1. 需求

> 「现在的批量操作虽然是在后台执行和网站的同步，但是这个同步过程我并不知道进度和执行状态，
> 我希望在设置里单开一个视频操作同步状态的标签，能够查到视频在插件和网站的数据同步的状态值，
> 也能够在设置中操作状态情况。」

拆解：

| # | 要求 | 落点 |
|---|---|---|
| R1 | 看到**每条视频**的同步状态与进度 | 逐条持久化记录 + 面板表格 |
| R2 | 看到**插件侧**与**网站侧**两个状态值 | 记录同时存「操作行为（kind + score）」与「网站同步结果（state/attempts/error）」 |
| R3 | 能在设置里**操作**状态 | 行内「重试 / 取消」+ 工具条「重试全部失败 / 清理已结束」 |
| R4 | 跨页面/跨会话可查（不是一关页面就没了） | 记录落 GM 存储，容量上限内自动淘汰 |

## 2. 现状问题

`list-page/lp-batch-sync.ts` 的后台队列**只有内存态与聚合计数**：

- `queue` 是模块级数组，离开页面（`stopBatchSync()`）即清空 —— 用户此后再也看不到「哪些没推上去」；
- `getBatchSyncStatus()` 只给 `pending/succeeded/failed` 三个数字，**没有逐条**信息；
- 失败原因只进 `clog` 面板，与具体视频的对应关系靠肉眼翻日志；
- 详情页的三条推送路径（收藏 / 已读 N★ / 拉黑）走各自的串行链，状态同样无处可查。

结论：缺的是**逐条、持久、可操作**的同步账本 —— 这也是本次新增的核心。

## 3. 设计

### 3.1 记录与状态机

`src/plugins/setting/jhs-sync/op-sync-records.ts`（新）定义一条记录 = 一个（番号 × 操作类型）：

```
pending ──▶ running ──▶ success
   │           │
   │           └──▶ failed（重试耗尽，带原因）
   └──▶ cancelled（用户在面板取消）
```

字段：`carNum / url / kind / score / state / attempts / error / origin / enqueuedAt / updatedAt`。

- `kind`：`favorite`（收藏/想看）、`watched`（已读 + 评分）、`unwatch`（取消已读＝删站点评价）、`filter`（拉黑）；
- `origin`：`list`（列表页批量）/ `detail`（详情页单条），面板可据此区分来源；
- 同一（番号 × kind）重复登记时**覆盖并重置**为 `pending` —— 语义是「这个视频的这一次操作还没落到网站」，
  首次入队时间保留。

### 3.2 存储与容量

- 单键 GM 存储（`jhs:op-sync-records`），JSON 数组；非油猴环境自动回退内存（测试可注入替身）；
- 容量上限 `OP_SYNC_CAPACITY = 400`：超限时**优先淘汰最旧的终态记录**（success/failed/cancelled），
  `pending/running` 不淘汰；
- 坏数据（类型不符的条目）在读取时被过滤，不让脏数据拖垮面板。

**不进备份**：记录是**可重建的派生状态**（真值仍是 `car_list` 与站点），进备份只会让备份体积随操作次数膨胀；
清空记录不会删除任何 `car_list` 数据，也不改 schema（仍为 6）。

### 3.3 集成点（只记账，不发请求）

| 位置 | 记账动作 |
|---|---|
| `lp-batch-sync.enqueueBatchPush` | 入队即登记为 `pending`；缺 videoId 被跳过的项记为 `failed`（原因可见、可重试） |
| `lp-batch-sync.step` | 推送前 `running`；成功 `success`；失败退回队尾 `pending`；重试耗尽 `failed` + 原因 |
| `dpb-rating-api` 三条路径 | 本地写入后登记（`origin: 'detail'`）；站点请求前 `running`；成功 `success`；失败 `failed` + 原因 |

### 3.4 面板（设置 → 🔁 操作同步）

- **摘要**：待推送 / 推送中 / 已同步 / 失败 / 已取消 计数；
- **表格**：番号 · 插件侧状态（如「已读 3★」）· 网站同步状态（含失败原因；`pending` 区分「排队中」与「已中断」）·
  尝试次数 · 更新时间 · 操作；
- **工具条**：🔄 刷新 / ↻ 重试全部失败 / 🧹 清理已结束；
- **行内操作**：↻ 重试（按记录重新入队，走与批量操作同一条推送路径）/ ✕ 取消（从队列移除并置 `cancelled`）；
- 刷新范式与「插件诊断」一致：**快照 + 刷新按钮**，内容区 `#op-sync-content` 由
  `SettingPlugin.refreshOpSync()` 重渲染（**不用** MutationObserver 注入）。

侧栏项位于「📊 插件诊断」之后，`data-panel="op-sync-panel"`；面板隐藏底栏「保存设置」（与诊断/收藏同步同规则）。

### 3.5 语义边界（数据安全）

- **取消不回滚**：本地 `car_list` 状态是用户明确执行过的操作行为，取消只停止远端推送；
- **失败不回滚**：站点失败多为网络波动，本地状态保留；详情页开页的自动校验（方向 1/3）会补推；
- **重试不改本地**：只重新入队推送，不重复写库；
- 拉黑在站点侧等价「已读 0 星」（`toBatchPushKind('filter') → 'watched'`），与详情页 `quickBlock` 语义一致。

## 4. 实现清单

| 文件 | 变更 |
|---|---|
| `src/plugins/setting/jhs-sync/op-sync-records.ts` | **新增**：记录状态机 + GM 存储 + 查询/计数/清理 + 测试注入点 |
| `src/components/setting/op-sync-table.tsx` | **新增**：`OpSyncTable` 组件 + `renderOpSyncHtml` / `renderOpSyncSummaryHtml` |
| `src/components/setting-panels/op-sync-panel.tsx` | **新增**：面板外壳（摘要 / 工具条 / 内容区 / 状态行） |
| `src/components/setting/setting-dialog.tsx` | 侧栏项「🔁 操作同步」+ 渲染 `OpSyncPanel` |
| `src/plugins/list-page/lp-batch-sync.ts` | 记账（入队 / step / 缺 videoId）+ `retryOpSync` / `retryFailedOpSync` / `cancelOpSync` / `isOpSyncQueued` / `toBatchPushKind` |
| `src/plugins/setting/setting-form-bind.ts` | 面板分支（隐藏保存按钮 + 刷新）+ 工具条与行内操作绑定 + `handleOpSyncRowAction` |
| `src/plugins/detail-page-button/dpb-rating-api.tsx` | 三条推送路径登记与状态流转（`origin: 'detail'`） |
| `src/plugins/setting-plugin.tsx` | `refreshOpSync()`（渲染表格 + 摘要，最近 200 条） |
| `src/styles/setting-plugin.css` | `.op-sync-*` 样式（全部走设计令牌，无新增色值） |
| `tests/op-sync-records.test.ts`、`tests/op-sync-table.test.ts` | **新增** 17 用例 |

## 5. 验证

- `bun run build`（tsc -b + vite build）通过；`dist @version` = 1.47.0。
- `bun run lint` / `bun run lint:css` 零 error / 零 warning。
- `bun run test` 全绿：**32 文件 / 338 用例**（新增 17）。
- `bun run check:structure` / `check:docs` / `check:selectors` 通过（未新增站点选择器字面量）。
- **未做真实浏览器实测**：本机 chrome-devtools MCP 连续超时不可用 → 面板交互体感由用户在真实站点复测。

## 6. 后续可扩展（本次刻意不做）

1. **逐条「网站侧真实值」对账**：目前「网站同步状态」= 推送结果（成功/失败/待推送），
   不是**实时拉取站点当前状态**。若要做「本地值 vs 站点真实值」逐条比对，需按视频拉详情页
   （`sync-common.fetchPageHtml`）做批量巡检 —— 属于独立的巡检任务，不与本面板的即时状态混淆。
2. 面板筛选（按状态/来源/番号搜索）与导出为 JSON。
3. 侧栏徽标（失败计数）常显。