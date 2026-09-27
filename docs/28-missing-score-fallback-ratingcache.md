# 缺失 score 回填：改用已实现的「JavDB 个人评分」读取机制（doc/24 需求③修正）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：已读星级筛选/计数的评分来源；`RatingCache` 新增可选变更钩子
> **前置文档**：`24-read-status-score-filter.md`（其中 §7 的判断由本文修正）
> **替代文档**：无
> **生效版本**：v1.46.20

## 1. 背景：doc/24 §7 的判断是错的

doc/24 时期我给出的判断是：「`score` 唯一来源是本脚本记录，缺失时没有可信来源，
凭空写回 0 等于伪造用户评分」，因此只做了**读取兜底为 0**。

**这个判断错了** —— 本仓库早就实现了「读取你在 JavDB 上**亲自打的评分**」的机制，
也就是用户记忆中的「插件数据库里没有评分时，鼠标放上去会自动获取我给出的评分值」。

## 2. 现有机制（证据，全部在 `src/plugins/rating-display/`）

移植自 `archetype/jhsRatingDisplay.user.js`：

| 模块 | 事实 |
|---|---|
| `rating-cache.ts` | `RatingCache`：`code(规范化番号) → { rating, updatedAt }`；localStorage 主存 + jhs IndexedDB 寄生备份，**永久不过期**；`get(code)` 是**同步**读内存镜像 |
| `rating-utils.ts` | `normalizeCode(raw) = raw.trim().toUpperCase().replace(/\s+/g, '-')`；`getCode(item)` 优先 `.video-title strong` |
| `rating-net.ts` | `fetchRating(item)`：限流 + 重试的 `GM_xmlhttpRequest` 拉详情页 → `DOMParser` → 解析**个人评分** `input[checked]`（1–5）→ 命中则 `RatingCache.set` + `RatingRenderer.showRating` |
| `rating-display-plugin.ts` | ① 卡片在 `watchedMap`（来自 car_list 已看记录）中且缓存未命中 → 渲染 `.jhs-user-rating.is-placeholder`；② `pointerover .item` 悬停 `HOVER_DELAY(500ms)` → `fetchRating` 懒抓取；③ Tampermonkey 菜单「全量加载当前页评分」批量抓取；④ `applySync` 在 car_list 的评分/状态变化时 `RatingCache.set` 反向同步 |

**关键事实**：`car_list.score` 与 `RatingCache` 是**两套独立存储**。同一番号的评分可能只存在于其中一边
（例：你只在本脚本标记了「已看」但在 JavDB 上打了分 → 只有 `RatingCache` 有值）。

## 3. 问题

旧实现把「car_list 记录没有 score」一律当 0，于是：

- 你在 JavDB 上打的分数（只存在于 `RatingCache`）在星级筛选里**完全看不见**；
- 这些卡片还被算进 `0星` 芯片，与「确实评了 0 星」混为一谈。

## 4. 修正方案（**读取回填**，不写 car_list）

### 4.1 `stf-score.ts` —— 索引区分「无 score」与「评 0 分」

- `CarIndexEntry` 新增 `hasScore`：`typeof score === 'number' && Number.isFinite(score)`；
- 新增 `setScoreFallbackResolver(resolver | null)`：外部评分源**注入式**接入
  （模块本身保持零插件依赖，可独立单测）；
- `getScore(carNum)`：

```
非已读 / 无记录              → null
已读 && hasScore             → 记录里的 score（越界归一化到 0–5 整数）
已读 && !hasScore && 回退源有值 → 回退值（归一化）
已读 && !hasScore && 回退源无值 → 0（已读未评分）
```

因此 `countWatchedByScore()`（星级芯片计数）与 `stf-apply`（星级筛选）**自动受益**，无需改动。

### 4.2 `status-tag-filter-plugin.ts` —— 接入缓存并跟随刷新

- `warmScoreIndex()` 先调 `ensureRatingFallback()`（只接一次）：
  `await RatingCache.load()`（内存镜像，之后 `getScore` 同步可读）
  → `setScoreFallbackResolver((carNum) => RatingCache.get(RatingUtils.normalizeCode(carNum))?.rating ?? null)`
  → 注册 `RatingCache.onChange`；
- **评分抓取后计数自动跟上**：`onChange` 触发 200ms 防抖 → 只 `updateFilterBar()`
  （评分来源变了但 car_list 没变，**不必重建索引**）；
- `destroy()` 里 `RatingCache.onChange = null`，避免插件销毁后仍引用本实例。

### 4.3 `rating-cache.ts` —— 新增可选 `onChange` 钩子

`set()` 写入成功后调用 `onChange?.(code, rating)`（异常兜底记日志）；
**未设置时与原实现零差异**（纯新增钩子，不改变原控制流）。

### 4.4 为什么不写回 `car_list.score`

- 用户既有约束是「不动用户既有数据（只做补充渲染与新增写入）」，读取回填已达成功能目标；
- `RatingCache` 永久缓存 + 悬停/菜单抓取，本身不需要复制一份进 car_list；
- 若确需把值持久化进 `car_list`（真正意义的写回），属**修改用户数据**的新决策，需明确要求后另开增量。

## 5. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/status-tag-filter/stf-score.ts` | `hasScore` 标记 + `setScoreFallbackResolver` + `getScore` 回退与归一化 + 文档头更新 |
| `src/plugins/status-tag-filter-plugin.ts` | `ensureRatingFallback()`（加载缓存/注入 resolver/注册钩子）+ 防抖刷新 + destroy 清理 |
| `src/plugins/rating-display/rating-cache.ts` | 新增可选 `onChange` 钩子（写入成功后回调） |
| `tests/stf-score-fallback.test.ts` | **新增** 8 用例 |

**数据安全**：只**读** `RatingCache` 与 `car_list`；不写 car_list、不迁移、其字段一律不动。

## 6. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**24 文件 / 275 用例**（原 23 / 267，新增 8） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

关键用例：记录有 score 时**不查**回退源；`score=0`（真的评 0 星）与「没有 score」被区分开；
非已读记录不取评分；回退值越界/小数归一化；传 null 取消回退。

## 7. 真实浏览器验证建议

1. 找一张「已看但没在本脚本打过分」的卡片（详情页曾用「已看」标记）。
2. **悬停该卡片 0.5 秒** → 卡片出现 `jhs-user-rating` 评分（既有行为）→
   状态筛选栏里该番号随之从 `0星` 移到对应星级芯片计数（本次新增的联动）。
3. 也可用 Tampermonkey 菜单「全量加载当前页评分」批量抓取当前页 → 整页计数刷新。
4. 在本脚本里给某卡片评 3 星（详情页星级）→ 记录写入 `car_list.score` → 之后以记录值为准
   （`RatingCache` 会被 `applySync` 同步，两边一致）。

## 8. 已知限制

- 只有**已被抓取过**的评分才在筛选里可见：`RatingCache` 里没有、`car_list` 里也没有的卡片，
  仍按「已读未评分」计入 `0星`。抓取时机沿用既有设计（悬停懒加载 / 菜单全量加载），
  本增量**不新增自动批量抓取**（避免打开列表页就请求几十个详情页）。
- `hasScore` 的区分只对 `car_list` 记录生效；`RatingCache` 侧永远是 1–5 的有效值。
- 若用户手动「清空当前页评分缓存」（既有菜单），已抓取的评分会消失，计数随之回到 `0星` —— 这是预期行为。
