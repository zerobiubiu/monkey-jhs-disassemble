# 68 - 评分缓存同步补充：0 星（已读未评分）显示 ★0 而非占位「已看」

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

### 现象

doc/67 实现了详情页标记已读/评分时通过广播 payload 携带 `score` 直接写入
`RatingCache`，免去列表页悬停远程抓取。但用户反馈：详情页点「已读」按钮
（0 星）后，列表页仍显示绿色占位「已看」，而非「★0」。

### 根因

doc/67 的实现有两处将 0 星排除：

1. `_invalidateCards` 的写入条件为 `score && score >= 1`——JavaScript 中
   `0` 是 falsy，`score && ...` 短路为 false，导致 0 星走 else 分支清缓存，
   而非写缓存
2. `RatingRenderer.showRating` 的渲染分支为 `rating && rating >= 1 &&
   rating <= 5`——同样排除 0，`showRating(item, 0)` 降级为占位「已看」

即使写入了 `RatingCache.set(code, 0)`，`showRating(item, 0)` 也会降级显示
占位，视觉上仍是「已看」。

## 方案

### 0 星语义澄清

- `RatingCache` 存 0：表示**确定是已读未评分**（由 jhs 详情页标记写入），
  区别于「未缓存」（不确定，需悬停远程抓取验证）
- `showRating(item, 0)`：显示金色「★0」，title「已看 · 0/5 星（未评分）」，
  与 1-5 星一致的 `is-rated` 样式
- `showRating(item, null/undefined)`：仍降级为占位「已看」（未缓存或解析失败）

### 改动

1. `_invalidateCards` 写入条件从 `score && score >= 1` 改为
   `typeof score === 'number'`（0-5 均写入，`score` 只在 hasWatch+add 时
   携带且为 0-5 的 number）
2. `showRating` 增加 `rating === 0` 分支，显示「★0」金色标签

### 数据流

```
详情页点「已读」(score=0)
  └─ broadcastWantWatchedSync({ score: 0 })
       └─ _invalidateCards(code, 'hasWatch', 'add', 0)
            └─ RatingCache.set(code, 0)        ← 现在写入（原来被排除）
                 └─ processItem 命中缓存
                      └─ showRating(item, 0)   ← 显示 ★0（原来降级占位）
                           └─ jhsrdLoaded=true（悬停不再远程抓取）
```

### 一致性验证

- 「先评 3 星，后改 0 星（已读）」：广播 score=0，`RatingCache.set` 更新
  3→0，`showRating(★0)` ✓
- 「先 0 星，后 3 星」：广播 score=3，`RatingCache.set` 更新 0→3，
  `showRating(★3)` ✓
- 「0 星后取消观看」：`onWatchedRemoved` 广播 hasWatch+remove，走 else
  清缓存 + 移除标签 ✓
- 「init 悬停验证」：★0 也是 `is-rated`，init 对 fromCache 的 is-rated 项
  delete loaded，悬停 fetchRating；`parseRating` 对未评分返回 null 不覆盖，
  ★0 保持，标记 loaded=true 不再重试 ✓
- 「远程抓取路径不受影响」：`fetchRating` 只在 `parseRating` 返回 1-5 时调
  `showRating`，0 星（未评分）返回 null 不调，保持当前显示 ✓

## 实施

### 修改文件清单

1. `src/plugins/rating-display/rating-display-plugin.tsx`
   - `_invalidateCards` 写入条件 `score && score >= 1` →
     `typeof score === 'number'`

2. `src/plugins/rating-display/rating-renderer.tsx`
   - `showRating` 增加 `rating === 0` 分支（★0 金色标签），原 1-5 分支改为
     `else if`，占位降级分支不变
   - 更新方法 doc-comment

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 213 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,843.47 kB │ gzip: 421.82 kB
✓ built in 1.15s
```

- `tsc -b` 通过（无类型错误）
- `vite build` 通过
- 产物 1843.47 kB（gzip 421.82 kB），较 doc/67 基线 +0.42 kB
- diagnostics 无 errors/warnings

### 版本号

`vite.config.ts` version `1.7.6` → `1.7.7`（修正，patch 递增）

## 后续验证建议

1. 详情页点「已读」（0 星）→ 列表页对应卡片显示金色「★0」，
   title「已看 · 0/5 星（未评分）」，无需悬停等待（Network 无详情页请求）
2. 详情页点星级（如 3 星）→ 列表页显示「★3」（doc/67 已验证）
3. 详情页先点 3 星再点「已读」→ 列表页从「★3」变为「★0」
4. 详情页 0 星后取消观看 → 列表页评分标签移除
