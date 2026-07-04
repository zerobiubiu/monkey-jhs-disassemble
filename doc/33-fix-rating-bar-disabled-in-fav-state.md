# 33 - 修复收藏状态下评分星星被禁用无法切换

- **文档类型**: 🔧开发指导
- **文档状态**: ✅已执行
- **关联文件**: `src/plugins/detail-page-button-plugin.tsx`

## 1. 问题描述

### 现象
视频详情页的评分栏（`.jhs-rating-bar`）中，当影片处于"已收藏"（想看）
状态时，星星评分被禁用（`.jhs-stars.is-disabled`，`pointer-events: none`
+ `opacity: 0.4`），无法点击星星切换到"已观看 + N星"。

用户原话："选为已收藏时，评分选择就不可用了，这里冲突了，不对这应该能
随时互相切换的"。

### 根因
`_syncRatingBar()` 方法的 `want`（想看/收藏）分支中调用了
`starsEl.classList.add('is-disabled')`，CSS `.jhs-stars.is-disabled .jhs-star`
设置 `pointer-events: none`，导致星星不可点击。

这是 archetype 原版的设计（L6040 `starsEl.classList.add("is-disabled")`），
项目重构时忠实保留了原逻辑。但原版设计存在逻辑 bug：收藏状态下用户
无法通过点击星星切换到已观看，只能先点"已读"再点星星，体验不顺畅。

### 交互逻辑
评分栏有三个操作入口：
1. **点击星星** → `quickSetHasWatch(score)` → 切换为"已观看 + N星"
2. **点击"已读"按钮** → `quickSetHasWatch(0)` → 切换为"已观看 + 0星"
3. **点击"♥ 收藏"按钮** → `quickConvertToFav()` → 切换为"想看/收藏"

三个操作应能随时互相切换。但 `is-disabled` 阻断了路径 1（收藏→已观看）。

## 2. 修改方案

`src/plugins/detail-page-button-plugin.tsx` 的 `_syncRatingBar()` 方法，
`want` 分支中将 `starsEl.classList.add('is-disabled')` 改为
`starsEl.classList.remove('is-disabled')`：

```diff
 if (want) {
-    // 想看：星星禁用全灰，收藏高亮
+    // 想看：收藏高亮，星星保持可用（可随时点击切换为已观看+N星）
     stars.forEach((s: any) => s.classList.remove('is-active'));
-    starsEl.classList.add('is-disabled');
+    starsEl.classList.remove('is-disabled');
     readBtn.classList.remove('is-active');
     favBtn.classList.add('is-active');
 }
```

修改后：
- 收藏状态下星星不再变灰禁用，保持正常外观与可点击
- 点击任意星星 → `quickSetHasWatch(score)` → 切换为已观看+N星
- 点击"♥ 收藏" → `quickConvertToFav()` → 切换回收藏
- 点击"已读" → `quickSetHasWatch(0)` → 切换为已观看+0星
- 三者随时互相切换，无阻断

**注**：此修复偏离 archetype 原版行为（原版在收藏状态下禁用星星），
属于用户明确要求的行为改进，非"零偏差"重构。

## 3. 验证

### 构建验证
```
tsc -b        # exit 0
vite build   # built in 1.29s, 产物 1705.49 kB (gzip 406.39 kB)
```

### 逻辑验证
- 收藏状态：`starsEl` 无 `is-disabled` 类 → 星星 `pointer-events` 正常 → 可点击
- 点击星星 → `quickSetHasWatch(score)` → `_syncRatingBar()` 走 `watched` 分支 → 星星高亮
- 点击"♥ 收藏" → `quickConvertToFav()` → `_syncRatingBar()` 走 `want` 分支 → 收藏高亮、星星可用
- 三条路径闭环，随时切换
