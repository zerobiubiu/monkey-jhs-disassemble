# 详情页状态操作不阻塞：本地优先写入 + 后台上传（closePage 等待拆段）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：详情页（含列表页 iframe 弹层内打开的详情页）收藏 / 已读 / 评分 0–5 操作的执行时序、关闭详情页的等待条件、站点推送失败的可见性
> **前置文档**：`27-list-batch-actions.md`、`29-rating-persistence-and-backup-audit.md`、`31-batch-push-to-javdb-background-queue.md`
> **替代文档**：无
> **生效版本**：v1.46.33

## 1. 需求

> 「详情页里点收藏 / 已读 / 评分 0–5 之后，必须等网站反馈之后才会有状态标签；
> 哪怕我把这个视频详情页（视频流中 iframe 弹出的）关了，也要等响应之后才能打开新视频弹窗页。
> 这些操作应该在后台异步执行，同时立即把操作行为持久化进本地数据库 —— 先写入操作行为
> （插件记录的状态标签），然后发请求，等网站响应后再把该操作落实为成功。」

拆解为可验证条目：

| # | 要求 | 判据 |
|---|---|---|
| R1 | 点击后**立即**持久化本地状态（插件记录的状态标签） | 本地写入先于任何站点请求 |
| R2 | 状态标签**立即**刷新，不等网站 | 标签渲染不依赖站点响应 |
| R3 | 站点请求**后台异步**执行 | 点击处理器不 `await` 站点请求 |
| R4 | 网站响应后再「落实为成功」 | 成功 → 站点 DOM 同步 + 评分条重算；失败 → 可见提示 |
| R5 | 关闭详情页不等网站响应 | `closePage()` 前不等待站点上传 |

## 2. 现状诊断（逐条对照代码，而非按现象猜测）

### 2.1 已经满足 R1–R3 的部分：插件自带快捷评分条

`src/plugins/detail-page-button/dpb-rating-api.tsx` 的三条操作路径已经是
**本地优先 + 站点推送不 await**：

1. **本地写入**：`storageManager.removeCar` / `saveCar`（即写入 `car_list`，插件状态标签的真值来源）；
2. **广播 + 立即刷新**：`plugin.broadcastWantWatchedSync(...)` → 跨标签页/跨 iframe 刷新 status-tag；
   `dpb-rating.tsx` 的点击处理器在本地写入返回后立刻 `showStatus()`；
3. **站点请求后台化**：`plugin._reviewChain = chain.then(站点推送)` —— 只是**挂到串行链上**，
   调用方不 `await`，`_wantWatchedSyncing` 只在推送执行期间阻断 MutationObserver。

因此「点了插件评分条要等网站响应才有状态标签」在代码层面不成立：标签在本地写入后即渲染。

### 2.2 真正的阻塞点：关页在等**网络上传**

`src/plugins/detail-page-button-plugin.tsx` 的 `favoriteOne` / `hasWatchOne` / `filterOne`
以及 `dpb-rating-api.tsx` 的 `quickBlock`，在 `utils.closePage()` 前执行：

```ts
// 等待增量推送完成，避免 closePage 中断异步 GM 写入（doc/195）
const clr = this.getBean('CarListReaderPlugin');
if (clr) await clr.waitForPendingPush();
```

而 `CarListReaderPlugin` 的 `pendingPush` **把两段语义混在一个 Promise 里**：
本地持久化（日志追加 + 修订号，都是 GM 同步写）**和**后台上传
（增量超阈值时的全量快照 POST / `syncFullCarStatus()`）。

结论：doc/195 想保护的是「本地 GM 写入不被关页打断」，实际却让关页**等到了网络上传** ——
这正是实测中「关了详情页要等响应」的原因。

### 2.3 「打开新视频弹窗也慢」是关页慢的连带现象

`src/core/common-util.ts` 的 `openPage()` 全函数同步：`layer.open({ type: 2, ... })`，
没有任何 `await`。所以打开本身不会被插件的 Promise 阻塞；实际时序是
「先关详情页（被上传阻塞）→ 才能开下一个」，与实测描述一致。

### 2.4 站点推送失败被静默吞掉（R4 无从判断）

`dpb-rating-api.tsx` 三处 `_reviewChain` 尾部 `.catch(() => {})`：
站点推送失败时既无日志也无提示，用户无法知道「是否落实为成功」。

## 3. 设计

### 3.1 `pendingPush` 拆成两段（本地持久化 / 后台上传）

`CarListReaderPlugin` 新增 `pendingJournal`，与 `pendingPush` 并列：

| Promise | 覆盖范围 | 何时兑现 | 用途 |
|---|---|---|---|
| `pendingJournal` | 本地持久化（journal 追加 + 修订号） | 本地写入完成，**先于**任何上传 | 关页前等待（毫秒级） |
| `pendingPush` | 上面 + 后台上传（全量快照 POST） | 全部完成 | 仅确实需要等上传时使用 |

- `markDurable()` 在「journal 已写入」处显式触发；超限分支（直接改发全量快照）与早返回路径
  在分支入口触发；`pushDelta` 末尾 `.finally(durableOnce)` 兜底，**保证 `pendingJournal` 必定兑现**
  （否则关页会挂在未兑现的 Promise 上）。
- **不丢上传**：未传完时 `GM_KEY_CAR_LIST_REV > GM_KEY_SYNCED_REV`，`CarListReaderPlugin`
  加载时的 `needsSync` 门控（含每日兜底）会自动续传 —— 复用既有机制，不新增队列、不改 schema。

### 3.2 关页只等本地持久化

四个关页点统一改为 `await clr.waitForPendingJournal()`，语义回到 doc/195 的初衷：
**保护本地写入，不等网络**。

### 3.3 站点推送失败必须可见，且不回滚本地

`dpb-rating-api.tsx` 三处静默 `.catch(() => {})` 改为：
`clog.warn`（页内面板）+ `show.error`（非阻塞 toast，`§9.3` 字符串拼接口径）。

本地状态**不回滚**：站点失败多半是网络/Cloudflare 波动，回滚会造成「用户明确点过的行为被系统撤销」；
开页的自动校验（`setupAutoReviewSync` 方向 1/3）会在下次进入详情页时重试推送。

### 3.4 「落实为成功」的落点保持原实现

站点响应成功 → `execRailsJs(响应 JS)`（站点 DOM 自更新）+ `plugin._syncRatingBar()`
（评分条按站点真实状态重算）→ 视为落实成功。本次不改该链路，只把失败分支补齐可见性。

## 4. 实现清单

| 文件 | 变更 |
|---|---|
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 新增 `pendingJournal` / `waitForPendingJournal()`；`pushDeltaAsync` 增 `markDurable` 参数并在 journal 写入、超限分支、`.finally` 处兑现 |
| `src/plugins/detail-page-button-plugin.tsx` | `favoriteOne` / `hasWatchOne` / `filterOne`：`waitForPendingPush()` → `waitForPendingJournal()` |
| `src/plugins/detail-page-button/dpb-rating-api.tsx` | `quickSetHasWatch` / `quickConvertToFav` / `quickBlock`：静默 catch → `clog.warn` + `show.error`；`quickBlock` 关页前补 `waitForPendingJournal()` |
| `docs/37-*.md`、`docs/README.md`、`changelog/CHANGELOG.md`、`vite.config.ts` | 文档与版本（v1.46.33） |

未改动：`dpb-rating.tsx`（点击路径已符合 R1–R3）、`dpb-want-watched.ts`、
`storage-manager.ts`、存储 schema（仍为 6）。

## 5. 验证

- `bun run build`（tsc -b + vite build）通过；产物 `@version` = 1.46.33。
- `bun run lint` / `bun run lint:css` 零 error / 零 warning。
- `bun run test` 全绿（30 文件 / 321 用例；本次改动为插件内部时序，无纯函数新增，未新增用例）。
- `bun run check:structure` / `check:docs` / `check:selectors` 通过（未新增站点选择器字面量）。
- **未做真实浏览器实测**：本机 chrome-devtools MCP 连续超时不可用，故「立即出标签、可立刻关页/切换弹窗」
  的实际体感由用户在真实站点复测确认（见 §6）。

## 6. 未完成：原生「想看 / 我看過」按钮的乐观写入（需真实 DOM 样本）

插件自带评分条已满足 R1–R3，但**站点原生**的「想看 / 我看過」按钮仍走
「站点 XHR → DOM 变化 → 150ms 防抖 → MutationObserver → 写本地」，即插件的状态标签要等站点响应。

要把它也改成「点击即写本地」，必须知道**被点击元素的可靠标识**。当前掌握的信息不足：

- `detectWantWatchedState()` 依据的是 `.review-buttons` 内的 **tag 链接**
  （指向用户清单，点击是**跳转**而非切换），不能当作按钮意图；
- 真正的切换按钮（及其 `href` / `data-method` / 文案）无实测样本，
  而站点选择器**必须进注册表**且**不得凭猜测写入**（`AGENTS.md` §9 + `doc/22`）。

因此本项**刻意不做**，避免猜测选择器造成误写本地状态。待用户提供一份真实站点
`.review-buttons` 容器的 outerHTML（或恢复浏览器实测能力）后，按 §3 同样的
「点击即写本地（意图由样本确定）→ 站点响应确认 → 已写状态经 MutationObserver 幂等校正」
实现，并补 1 组单元用例（意图判定纯函数）。

## 7. 数据安全边界

- 未修改 `storage-migrations.ts`（schema 仍 6），无迁移、无清理、无覆盖。
- 新增的等待只**减少**关页阻塞，不改变本地写入内容与顺序（`saveCar`/`removeCar` 仍在最前）。
- 站点失败不回滚本地、不删除任何记录；上传中断由修订号门控在下次加载续传。