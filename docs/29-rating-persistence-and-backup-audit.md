# 评分持久化与备份审计（全插件评分类存储盘查 + 矫正）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：评分的持久化链路（`car_list.score`）、`RatingCache` 监听机制、JHS 同步拉取、备份覆盖范围
> **前置文档**：`28-missing-score-fallback-ratingcache.md`
> **替代文档**：无
> **生效版本**：v1.46.21

## 1. 需求

用户要求：**① 把「我在 JavDB 上的评分」持久化**；**② 这份持久化必须进入备份**；
**③ 顺带审计整个插件有没有其他不符合的地方**。

## 2. 审计：评分类存储 × 备份覆盖

| 存储 | 内容 | 位置 | 是否进备份 | 判定 |
|---|---|---|---|---|
| `car_list[].score` | 影片个人评分（0–5，主数据） | IDB `JAV-JHS/appData/car_list` | ✅ `storageManager.exportData()` 遍历该 store **全量**导出（storage-manager.ts:399-408） | 符合 |
| `RatingCache` | 影片个人评分缓存（1–5，抓取） | ① localStorage `jdb:rating_cache_v2` ② IDB `JAV-JHS/appData/jhsRatingDisplay_data` | ✅ ①在 `BACKUP_LOCAL_STORAGE_KEYS`（backup-extra-storage.ts:27「列表评分缓存（永久）」）②与 car_list **同库同表**，被 exportData 覆盖 | 符合（两路都在备份内） |
| `VltDb`（清单/影片/关联，`movie.score`） | 清单内影片评分 | IDB `JAV-JHS/appData`（vlt-db-core.ts:103-104 同库同表） | ✅ 同上 + 另有 VLT 面板独立导入导出 | 符合 |
| LRS `jdb:list-rating` | **清单本身**的评分（不是影片评分） | GM 存储 | ✅ `BACKUP_GM_KEYS` | 符合（语义不同） |
| MissAV `MissAV-CarStatus/cars` | 只有 carNum/status/url，**无评分** | 独立 IDB | ❌ 不在主备份（模块注释：走设置面板独立导出 JSON + WebDav） | 设计如此（MissAV 无评分语义） |
| `car-status-sync` 列存载荷（GM `GM_KEY_CAR_STATUS_DATA`） | 同上，不含评分 | GM 存储 | ❌ 白名单外 | 可由 car_list 零成本再生 ✓ 可接受 |

**审计结论**：评分相关数据**本来就已经在备份覆盖范围内**（car_list + RatingCache 两路 + VLT）。
真正的缺口不是「没备份」，而是「**抓到的评分压根没进 car_list**」——它只活在缓存里。

## 3. 发现的不符合项与矫正

### 3.1 【核心】抓取到的评分不落库

`rating-net.ts` 的 `fetchRating` 成功后只调 `RatingCache.set`，从不写 `car_list`；
于是「只在 JavDB 打过分的影片」在 jhs 主数据表里永远是「无评分」——
虽然能靠 doc/28 的回退参与筛选，但**不属于用户数据主表**，清缓存/换设备后语义退化。

**矫正**：新增 `src/plugins/rating-display/rating-persist.ts`

- `decideRatingPersist(car, rating)` —— **纯函数**判定：`invalid-rating` / `no-record` / `not-watched` / `has-score` / `write`
- `persistRating(code, rating)` —— 按判定写 `saveCar({ actionType: 已读, score })`（番号用 `RatingUtils.normalizeCode` 与缓存键对齐）
- `bindRatingPersistence()` —— 注册 `RatingCache` 变更监听；由 `RatingDisplayPlugin.handle()` 绑定

**只补空缺原则**（写进文件头文档）：

| 情况 | 行为 |
|---|---|
| car_list 无该番号记录 | **不新建**（不替用户扩写记录） |
| 状态不是「已读」 | 不写（评分只对已读有意义） |
| 记录已有 `score`（含用户主动评的 0 星） | 不覆盖（尊重用户在脚本内的记录） |
| 已读且无 `score` | **写入抓到的 1–5 分** |

幂等：写入后 car_list 就有 score 了，后续回调走 `has-score` 分支；不会与 doc/28 的回退互斥
（回退只在 `hasScore=false` 时生效，两者正好衔接）。

### 3.2 `watched-from-javdb` 硬编码 `score: 0`

`sync-engine.ts:197-202`（JHS 同步的「从 JavDB 拉已看」）写死 `score: 0`：

- 凭空伪造「已评分」状态；
- 因 `hasScore = true`，会**遮蔽** doc/28 的评分回退 → 明明 JavDB 上有 5 星，筛选里却算 0 星。

**矫正**：**不写 `score` 字段**。依据：`SyncOp.score` 的类型注释明确写着「评分（**仅 watched-to-javdb**）」
—— 拉取方向本来就没有评分数据，缺字段才等价于「未评分」。

### 3.3 `RatingCache.onChange` 单槽 → 监听器集合

doc/28 引入的是单槽回调（`onChange = fn`）。现在有两个消费者（星级筛选刷新计数、评分持久化落库），
单槽会互相覆盖。

**矫正**：`addChangeListener(fn): () => void` + `_changeListeners: Set`（逐监听器 `try/catch`，
单个监听器抛错不影响其它）；`StatusTagFilterPlugin` 改为注册 + 在 `destroy()` 注销。

## 4. 附带澄清（审计过、判定为**非缺陷**）

| 现象 | 判定 |
|---|---|
| `detail-page-button-plugin.tsx`「已看」按钮、`want-and-watched-videos-plugin.tsx` 批量导入**不写 score** | ✅ 正确：缺字段 = 未评分，与 doc/28 回退配套 |
| `dpb-rating.tsx` 点同一颗星 → `quickSetHasWatch(0)` 写 0 星 | ✅ 正确：用户主动取消评分，`has-score` 分支不覆盖 |
| MissAV 同步链路（`toColumnar` / `importLocalDB`）不含评分 | ✅ MissAV 无评分语义；`importLocalDB` 只写 MissAV 自有 DB，**不动 car_list**，无数据损失 |
| `GM_KEY_CAR_STATUS_DATA` 不在备份白名单 | ✅ 它是 car_list 的压缩派生载荷，可再生 |
| `lrs` 的 `jdb:list-rating` | ✅ 是**清单**评分，与影片评分不同维度，已在 GM 白名单 |

## 5. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/rating-display/rating-persist.ts` | **新增** 判定 + 落库 + 绑定监听 |
| `src/plugins/rating-display/rating-cache.ts` | `onChange` 单槽 → `addChangeListener` + 监听器集合 |
| `src/plugins/rating-display/rating-display-plugin.ts` | `handle()` 绑定评分持久化 |
| `src/plugins/setting/jhs-sync/sync-engine.ts` | 拉取方向不再写 `score: 0` |
| `src/plugins/status-tag-filter-plugin.ts` | 改用 `addChangeListener` + destroy 注销 |
| `tests/rating-persist.test.ts` | **新增** 7 用例（判定矩阵） |
| `tests/rating-backup-roundtrip.test.ts` | **新增** 3 用例（评分进 exportData / JSON 往返后保留 / 评分缓存 IDB 键在导出内） |

## 6. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**26 文件 / 285 用例**（原 24 / 275，新增 10：落库判定 7 + 备份往返 3） |
| `bun run check:structure` | exit 0（385 files, 67 dirs） |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 7. 真实浏览器验证建议

1. 找一张「已看但本脚本无评分」的卡片 → 悬停 0.5 秒抓到评分 →
   控制台出现 `[JHS-Rating] 评分已持久化到 car_list: XXX = N 星`。
2. **刷新页面**（不再悬停）→ 星级筛选直接按该分数分类（证明是持久数据而非缓存）。
3. 备份面板「导出数据」→ 在 JSON 里搜 `car_list`，确认该记录带 `score`；
   换配置导入该备份 → 评分仍在。
4. 反例保护：在本脚本给某卡片评 2 星 → 悬停抓到 JavDB 的 4 星 → **不会被改成 4**
   （`has-score` 分支不覆盖）。

## 8. 仍未决（需用户确认）

**列表页批量「已读 n★」只写本地 car_list，不推 JavDB**（详情页星级组件等其它入口都会推）。
这是目前唯一已知的「写入方向不一致」点。对外发送（在你的 JavDB 账号上批量打分）属高风险动作，
需你明确同意后再补齐。
