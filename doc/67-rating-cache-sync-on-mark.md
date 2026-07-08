# 67 - 评分缓存同步优化：详情页标记已读时直接写入评分缓存

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

### 现象

在视频详情页点击「已读」或星级按钮标记已观看时，`DetailPageButtonPlugin.quickSetHasWatch(score)`
已经拿到了评分 `score`（0-5），并写入了 JHS 本地库 `car_list`（含 `score` 字段）。
然而列表页的评分显示组件 `RatingDisplayPlugin` 使用的是**另一套独立缓存**
`RatingCache`（localStorage `jdb:rating_cache_v2` + IDB 寄生 `jhsRatingDisplay_data`），
两套缓存互不相通。

导致用户在列表页悬停已看卡片时，`RatingDisplayPlugin.fetchRating` 仍需通过
`GM_xmlhttpRequest` 远程抓取详情页 HTML → `parseRating` 解析 1-5 星 → 写入
`RatingCache`，才能显示评分。这是一次完全可以避免的网络请求——评分信息在标记
已读时就已经在手里了。

### 根因

`broadcastWantWatchedSync` 的广播 payload 只携带 `{carNum, status, op}`，
**没有 score**。`RatingDisplayPlugin._invalidateCards` 收到 `hasWatch+add`
事件后只能清缓存（`delete RatingCache._data[code]`），无法直接写入评分，
只能等列表页悬停时远程抓取。

### 数据流对比

两套评分缓存的对比：

| 缓存 | 存储位置 | key | value | 写入时机 |
|------|---------|-----|-------|---------|
| `car_list` | IDB `JAV-JHS/appData` | 原始 carNum | `{status, score, ...}` | `quickSetHasWatch` **已写入 score** |
| `RatingCache` | localStorage + IDB寄生 | `normalizeCode(carNum)` | `{rating, updatedAt}` | 列表页悬停**远程抓取详情页**后写入 |

## 方案

### 选型：扩展广播 payload 携带 score（方案 B）

考虑过两个方案：

- **方案 A**：详情页 `quickSetHasWatch` 直接调 `RatingCache.set` 写缓存
  - 问题：`detail-page-button-plugin` 要反向依赖 `rating-display` 模块，
    破坏插件间单向依赖（`rating-display` 注释明确说它"仅监听"
    `detail-page-button-plugin` 的事件，不反过来）
- **方案 B（采用）**：扩展广播 payload 携带 score，列表页收到后写缓存
  - 不破坏插件依赖方向（仍是 detail-page-button → 广播 → rating-display 单向）
  - 跨标签页也能受益（广播走 GM/localStorage/CustomEvent 三通道）
  - 改动集中、影响面小

### 优化后数据流

```
详情页 quickSetHasWatch(score)
  ├─ storageManager.saveCar({ score }) → car_list（原有）
  ├─ broadcastWantWatchedSync({ carNum, status:'hasWatch', op:'add', score }) ← 新增 score
  └─ _triggerJavdbReview(score) → javdb 原生 API（原有）

列表页 RatingDisplayPlugin 收到广播
  └─ _invalidateCards(code, 'hasWatch', 'add', score)
       ├─ score>=1 → RatingCache.set(code, score) ← 直接写缓存，不再清缓存
       └─ processItem 命中缓存 → showRating(★N) → 标记 jhsrdLoaded=true
           （悬停不再触发 fetchRating 远程抓取）
```

### 语义边界

- `score >= 1`（1-5 星）：直接写 `RatingCache`，列表页命中缓存显示评分，
  免去远程抓取
- `score === 0`（已读未评分）：不写 `RatingCache`（`RatingCache` 语义上只存
  1-5 评分，`parseRating` 对未评分返回 null 也不写），保持占位「已看」态，
  行为与优化前一致
- `onWatchedAdded`（MutationObserver 检测 javdb 原生「已观看」被添加）：
  不携带 score（它本身也不知道 score），`_invalidateCards` 走原清缓存逻辑，
  行为不变
- 想看/收藏/取消：status 非 hasWatch 或 op 非 add，走清缓存逻辑，行为不变

### 一致性验证

- 「先评 3 星，后改 5 星」：两次广播 score=3 / score=5，
  `RatingCache.set` 内部判断 rating 变化（3≠5）会更新 ✓
- 「先评 5 星，后取消观看」：`onWatchedRemoved` 广播 hasWatch+remove，
  `_invalidateCards` 走 else 分支清缓存 + 移除标签 ✓
- 「先评 5 星，后转想看」：`quickConvertToFav` 广播 favorite+add，
  `_invalidateCards` 走 else 分支清缓存 + watchedMap.delete ✓
- 「用户在 javdb 原生页面改评分（非通过 jhs）」：jhs 不知道，不广播，
  RatingCache 保持旧值；init 的悬停验证兜底（L259-265 对 jhsrdFromCache
  项 delete jhsrdLoaded，首次悬停重新抓取验证）不受影响 ✓

## 实施

### 修改文件清单

1. `src/plugins/detail-page-button-plugin.tsx`
   - `WantWatchedSyncPayload` 接口新增 `score?: number` 字段
   - `quickSetHasWatch` 广播时传 `score`（仅此一处需要带 score；
     `onWatchedAdded`/`onWantAdded`/`quickConvertToFav` 等不涉及评分，
     不带 score，payload.score 为 undefined）

2. `src/plugins/rating-display/rating-display-plugin.tsx`
   - `SyncPayload` 接口新增 `score?: number` 字段
   - `_invalidateCards` 方法签名新增 `score?: number` 参数：
     - `hasWatch+add+score>=1` → `RatingCache.set(code, score)` 写缓存
       （不再 `delete RatingCache._data[code]`）
     - 其他情况 → 保持原清缓存逻辑
   - 两处调用点（CustomEvent 监听 / localStorage storage 监听）传递 `score`

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
vite v8.1.3 building client environment for production...
✓ 213 modules transformed.
computing gzip size...
dist/monkey-jhs-disassemble.user.js  1,843.05 kB │ gzip: 421.78 kB
✓ built in 1.24s
```

- `tsc -b` 通过（无类型错误）
- `vite build` 通过（lightningcss 的 IE hack 警告为已知 errorRecovery 容错，
  不影响构建）
- 产物 1843.05 kB（gzip 421.78 kB），较 doc/66 基线 1832.52 kB +10.53 kB
  （主要来自新增注释与 payload 字段，无新增依赖）
- diagnostics：两文件均无 errors/warnings

### 版本号

`vite.config.ts` version `1.7.5` → `1.7.6`（优化，patch 递增）

## 后续验证建议

1. 详情页点击星级（如 3 星）→ 列表页对应卡片应直接显示「★3」，
   无需悬停等待远程抓取（Network 面板无详情页请求）
2. 详情页点击「已读」（0 星）→ 列表页对应卡片显示「已看」占位，
   行为不变
3. 详情页先评 3 星再改 5 星 → 列表页评分更新为「★5」
4. 详情页评 5 星后取消观看 → 列表页评分标签移除
5. 跨标签页：标签页 A 详情页评 3 星 → 标签页 B 列表页对应卡片显示「★3」
   （通过 localStorage storage 事件同步）
