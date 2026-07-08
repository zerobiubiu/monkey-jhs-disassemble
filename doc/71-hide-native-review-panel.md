# 71 - 隐藏详情页原生评价操作面板（第一步）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

快捷评分模块（`DetailPageButtonPlugin._buildRatingBar`）已在详情页注入
星星评分条（5 星 + 已读 + 收藏），完全覆盖了 JavDB 原生评价操作面板的功能。
原生面板仍可见，造成 UI 冗余——用户看到两套评价 UI。

用户要求隐藏原生操作面板，对应选择器：
```
body > section > div > div.video-detail > div:nth-child(4) > div > div:nth-child(2) > div:nth-child(1)
```

即 `.video-meta-panel` 第二列的第一个子 div（nav 的兄弟元素），是 JavDB 原生
评价操作区。

## 方案

### 隐藏而非去掉

**用 CSS `display:none` 隐藏，保留 DOM。** 原因：

| 依赖项 | 隐藏（display:none） | 去掉（remove） |
|--------|----------------------|----------------|
| `_buildRatingBar` 注入快捷评分条到 column | ✅ nav 不受影响 | ❌ 可能误删 |
| `_syncRatingBar` 从原生 DOM 读状态 | ✅ DOM 还在，querySelector 正常 | ❌ 无法读状态 |
| `hookWantAndWatchedButtons` MutationObserver | ✅ DOM 还在，observer 正常 | ❌ observer 失效 |
| `_getReviewId` 从 `.review-buttons a[data-method=delete]` 提取 | ✅ DOM 还在 | ❌ 拿不到 reviewId |
| `_javdbReviewApi` + `_execRailsJs` 更新 DOM | ✅ Rails JS 更新隐藏 DOM | ❌ 无 DOM 可更新 |

`display:none` 的元素 querySelector 仍能查询，MutationObserver 仍能监听，
input[checked] 仍能读取——所有 JS 依赖正常工作。

### 注入位置确认

快捷评分条 `.jhs-rating-bar` 注入到 `nav > .review-buttons > div:nth-child(1) > div > div`（column）内。
用户要隐藏的是 `div:nth-child(2) > div:nth-child(1)`，是 nav 的**兄弟元素**，
不包含快捷评分条，隐藏它不影响快捷评分条显示。

### 补充隐藏 review-buttons 内剩余原生 UI

现有 `rating-bar.css` 已隐藏部分原生 UI（review-title / buttons.are-small /
panel-block 兄弟），但还有原生星级 radio 和评价表单未隐藏。本次补充：

```css
/* 原生星级 radio + 评价表单 */
.review-buttons .rating-star,
.review-buttons form,
.review-buttons .field { display: none !important; }
```

DOM 保留供 `_syncRatingBar` 读 `input[name="video_review[score]"][checked]` 和
`_getReviewId` 提取 `.review-buttons a[data-method=delete]`。

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/styles/rating-bar.css` | 新增 3 条 CSS：隐藏原生星级 radio/表单 + 隐藏用户选择器对应的操作面板 |
| `vite.config.ts` | version 1.8.1 → 1.8.2 |

### CSS 规则

```css
/* 隐藏原生星级 radio + 评价表单（快捷评分条已替代）
   DOM 保留供 _syncRatingBar 读 input[checked] + _getReviewId 提取删除链接 */
.review-buttons .rating-star,
.review-buttons form,
.review-buttons .field {
    display: none !important;
}

/* 隐藏 nav 前的原生操作面板（div:nth-child(1)），快捷评分条在 nav 内不受影响 */
body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > div:nth-child(1) {
    display: none !important;
}
```

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 214 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,852.39 kB │ gzip: 423.88 kB
✓ built in 1.17s
```

- `tsc -b` 通过
- `vite build` 通过
- diagnostics：rating-bar.css 无 errors/warnings

### 版本号

`vite.config.ts` version `1.8.1` → `1.8.2`（UI 隐藏，patch 递增）

## 后续验证建议

1. 打开 javdb 详情页 → 原生评价操作面板（想看/看過按钮 + 星级 radio）应不可见
2. 快捷评分条（★ + 已读 + 收藏）应正常显示在 nav 内
3. 点击星级 → `_syncRatingBar` 仍能从隐藏的 DOM 读状态刷新快捷评分条
4. `hookWantAndWatchedButtons` MutationObserver 仍能监听 `.review-buttons` 变化
5. `_getReviewId` 仍能从隐藏的 `.review-buttons a[data-method=delete]` 提取 reviewId
6. 确认隐藏后无空白间隙（原生面板占位应消失）

## 第二步预告

确认隐藏效果后，将在快捷评分面板新增「🚫 拉黑」按钮：
- `RatingBarHtml` 组件新增 `.jhs-block-btn`
- 点击弹确认框警告严重性
- 确认后：写 `FILTER_ACTION` + 调 `_triggerJavdbReview(0)` 设为已读0星 +
  `_wantWatchedSyncing` 阻断 observer + 广播 + 关闭页面
- `_syncRatingBar` 增加 filter 状态高亮
