# 批量操作后台同步 JavDB（不阻塞、懒加载、节流串行）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页批量「收藏 / 已读 N星」→ JavDB 服务器同步时机
> **前置文档**：`27-list-batch-actions.md`、`30-ui-polish-from-field-testing.md`
> **替代文档**：无
> **生效版本**：v1.46.23

## 1. 需求（用户实测反馈）

> 「批量操作时应该立即同步至 JavDB 而不是等待开视频页才同步，同步可以在后台懒加载，
> 慢慢同步而不需要阻塞执行。」

## 2. 改前的问题

批量「收藏 / 已读 N星」只写本地 `car_list`，JavDB 侧的推送要等到**下次打开该影片详情页**
由「评价状态自动校验」（方向 1：脚本有记录、服务器无评价 → 推送）才发生。
于是列表页批量操作后，本地已变、服务器未变，两边在一段时间内不一致。

## 3. 方案：后台推送队列（`lp-batch-sync.ts`）

| 性质 | 做法 |
|---|---|
| **不阻塞** | `enqueueBatchPush()` 同步返回（入队即结束）；调用方批量写库后不再 `await` 任何网络 |
| **节流** | 逐项串行，项间 `DEFAULT_PACING_MS = 900ms`，避免批量瞬间打满站点（Cloudflare 风险） |
| **重试** | 每项最多 `MAX_ATTEMPTS = 2` 次；失败项退回**队尾**（不打断其它项），耗尽则计入 `failed` |
| **复用** | 直接用 `setting/jhs-sync/sync-common` 的 `postWantToWatch` / `postWatched` / `deleteReview` / `fetchPageHtml` / `extractVideoId` —— 与「JHS ↔ JavDB 同步」面板**同一条 API 路径**，不重复实现 |
| **可观测** | 逐项 `clog.log/warn/error`；队列跑完给一条汇总 toast（成功 N / 失败 M） |
| **尊重设置** | 读 `autoServerSync`（默认开启，与详情页校验同一开关）；关闭时**不入队**并记日志 |
| **可终止** | `stopBatchSync()` 在 `destroyBatchToolbar()` 调用，清定时器 + 清队列 |
| **兜底** | 队列只活在当前页面；未推完就离开页面时，详情页的评价状态校验（方向 1/3）仍会在下次打开该影片时补齐 —— 不会造成永久不一致 |

### 数据流

```
列表页勾选 → 批量写入 car_list（本地权威，立即可见）
          ↓（不等网络）
    enqueueBatchPush(刚写入的记录, kind, score)
          ↓ 后台 900ms/项、串行、带重试
    postWantToWatch(videoId) | postWatched(videoId, score)
          ↓ 队列清空
    汇总 toast：后台同步 JavDB 完成：成功 N 项（失败 M 项详见日志）
```

### 文案

批量结果 toast 增加一段「**已提交后台同步 JavDB N 项**」，让「本地已写」与「后台在推」两件事一眼分开；
队列跑完再单独提示一次最终结果（失败才用 `show.error`）。

## 4. 「取消已读」：删除服务器评价记录（已实现）

JavDB 服务器侧没有「取消已读」这个动作 —— 等价操作是**删除评价记录**
（`POST /v/{id}/reviews/{reviewId}` + `_method=delete`）。删除会**一并移除服务器上该影片的评价正文**，
因此默认是破坏性远端操作。

**用户已确认不写评价正文**，故本次将其纳入后台队列，代价与保障：

| 环节 | 做法 |
|---|---|
| 取 reviewId | 拉详情页 HTML → `findReviewIdInHtml()`（与详情页 `getReviewId()` 同一选择器：`.review-buttons a[data-method='delete'][href*='/reviews/']`） |
| 无需删除 | 服务器上本就无评价（找不到 reviewId）→ **直接视为已完成**，不做多余请求 |
| 删除 | `deleteReview(videoId, reviewId)`（CSRF + `_method=delete`，与详情页删除分支同一路径） |
| 代价 | 每项 2 个请求（拉详情页 + 删除），仍受同一节流（约 900ms/项）节制 |
| 失败处理 | 与其它类型一致：退队尾重试 2 次，耗尽计失败并提示 |

⚠️ 若将来你在 JavDB 上写过评价正文，批量「取消已读」会连正文一同删除 —— 那时应改为逐条确认。

## 5. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/list-page/lp-batch-sync.ts` | **新增** 后台推送队列（计划/入队/节流/重试/统计/停止；含 unwatch 分支） |
| `src/plugins/setting/jhs-sync/sync-common.ts` | 新增 `findReviewIdInHtml`（从详情页 HTML 取 reviewId）与 `deleteReview`（CSRF + `_method=delete`） |
| `src/plugins/list-page/lp-batch.tsx` | `applyPlan` 增加 `push` 参数 → `enqueueIfServerSyncEnabled()`；取消已读分支同样入队；`reportResult` 汇报入队数；`destroyBatchToolbar` 调 `stopBatchSync` |
| `tests/lp-batch-sync.test.ts` | **新增** 8 用例（计划解析/过滤、入队计数、停止、不启动、unwatch 计划） |
| `tests/jhs-sync-review-id.test.ts` | **新增** 6 用例（reviewId 提取：命中/带参数/无链接/非数字/空输入/作用域） |

**数据安全**：本地写入逻辑不变（仍复用 `saveCarList` / `clearCarWatchStatus`）；
新增的只是**本地成功之后**的异步推送，且推送失败不影响本地状态。

## 6. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**29 文件 / 307 用例**（新增 14：推送计划/队列 8 + reviewId 提取 6） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 7. 真实浏览器验证建议

1. 勾选 3 张卡片 → 点「收藏」→ **立即**看到本地结果 toast（含「已提交后台同步 JavDB 3 项」），
   界面不卡顿（批量写入不等网络）。
2. 打开控制台：每约 0.9 秒出现一条「已同步 JavDB: XXX」；约 3 秒后出现汇总 toast
   「后台同步 JavDB 完成：成功 3 项」。
3. 换个浏览器标签（或退出登录态）打开 JavDB 的「想看」列表 → 这 3 部已在服务器上 ✓
   （这正是「不用再等打开详情页」的验证点）。
4. 断网 / 未登录状态下批量操作 → 本地仍成功；后台同步项重试 2 次后计入失败并提示（详见日志）。
5. 设置面板关闭 `autoServerSync` → 批量操作不再产生后台推送日志（只写本地）。
6. **取消已读**：勾选 2 张已读卡片点「取消已读」→ 控制台可见拉详情页与删除日志
   （每项 2 个请求，仍约 0.9s/项）→ 打开该影片详情页，服务器上已无评价记录
   （`.review-buttons` 回到未评价态）。

## 8. 已知限制

- 队列为**内存态**（不持久化）：关闭/刷新页面会终止未完成的推送，交由详情页校验兜底补齐。
  若需要「关站也保证推完」，需引入持久化队列（新存储键 → 需同步纳入备份，见 doc/29 的覆盖面约定）。
- 节流间隔固定 900ms，未做成设置项。
- `postWatched` 是 `POST /v/{id}/reviews`（与同步面板一致）；**服务器对「已有评价再次 POST」的
  行为由站点决定**，若返回非 2xx 会计入失败统计并记日志，本地状态不受影响。
- 未登录 / 列表页无 CSRF meta 时，所有推送会失败并计入统计（明确提示，不静默）。
