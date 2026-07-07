# 55. 自动收藏联动星标评分组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/53 + doc/54 实现了自动收藏 + 三重广播，但用户反馈：
**视频详情页的星标评分处的收藏不是收藏状态**。

### 根因

星标评分组件（RatingBar）的收藏按钮高亮状态由 `_syncRatingBar()` 控制，
该方法从 **JavDB 原生 DOM**（`.review-buttons`）检测「想看」按钮是否激活：

```typescript
// _syncRatingBar (L764-808)
const want = !!rb.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
if (want) {
    favBtn.classList.add('is-active');  // 收藏高亮
}
```

仅写 JHS IndexedDB（`FAVORITE_ACTION`）+ 三重广播**不会**让 JavDB 原生
「想看」按钮激活，因此 `_syncRatingBar` 检测不到 `want` 状态，评分条
收藏按钮不高亮。

`quickConvertToFav`（一键转收藏）之所以能让评分条收藏高亮，是因为它在
`saveCar` 后还调用了：
1. `_triggerJavdbWant()` — 调 JavDB API 设为「想看」，`_execRailsJs`
   执行 Rails 返回的 JS **同步更新 DOM**（想看按钮激活）
2. `_syncRatingBar()` — 从已更新的 DOM 检测到 `want` 状态，收藏按钮高亮

doc/53+54 缺少这两步。

## 方案

### 复用 DetailPageButtonPlugin 的事件链

在 `vlt-sync.ts` 中新增 `triggerJavdbWantAndSyncRatingBar()` 函数，
通过 `pluginManager.getBean('DetailPageButtonPlugin')` 获取插件实例，
复用其 `_triggerJavdbWant()` + `_syncRatingBar()`。

串行化方式也与 `quickConvertToFav` 完全一致（复用实例的 `_reviewChain`
+ `_wantWatchedSyncing` 字段）：

```typescript
detailPlugin._reviewChain = (detailPlugin._reviewChain || Promise.resolve())
    .then(async () => {
        detailPlugin._wantWatchedSyncing = true;
        try {
            await detailPlugin._triggerJavdbWant();
            detailPlugin._syncRatingBar();
        } finally {
            detailPlugin._wantWatchedSyncing = false;
        }
    })
    .catch(() => {});
```

### 完整事件链对比

| 步骤 | quickConvertToFav | autoFavoriteIfPendingUpdate（修复后） |
|------|-------------------|--------------------------------------|
| saveCar 写 IndexedDB | ✅ | ✅ |
| broadcastWantWatchedSync 三重广播 | ✅ | ✅ |
| show.ok / showToast | ✅ | ✅ |
| _triggerJavdbWant 调 JavDB API 设为想看 | ✅ | ✅（本次补充） |
| _syncRatingBar 刷新评分条收藏高亮 | ✅ | ✅（本次补充） |
| showStatus 刷新菜单按钮文案 | ✅（广播触发） | ✅（广播触发） |
| refreshItemStatusTag 列表页刷新 | ✅（广播触发） | ✅（广播触发） |

### 设计要点

- **零侵入已定稿插件**：不修改 `DetailPageButtonPlugin` 代码，仅通过
  `pluginManager.getBean` 获取实例调用其已有方法
- **_reviewChain 串行化**：复用实例的 `_reviewChain` Promise 链，防止
  与 `hookWantAndWatchedButtons` 的 MutationObserver 竞争
- **_wantWatchedSyncing 守卫**：`_triggerJavdbWant` 内部更新
  `_lastWantState` 防止 MutationObserver 误触发 `onWantAdded`；
  `_wantWatchedSyncing` 标志防止 `onWantAdded` 重复写入
- **容错**：`DetailPageButtonPlugin` 未注册时仅 warn 跳过，不阻断流程

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | +`triggerJavdbWantAndSyncRatingBar()` 函数（通过 pluginManager 获取 DetailPageButtonPlugin 实例，复用 _reviewChain 串行调用 _triggerJavdbWant + _syncRatingBar）；`autoFavoriteIfPendingUpdate` 收藏成功后调用 |

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.12s
dist/monkey-jhs-disassemble.user.js  1,820.81 kB │ gzip: 416.24 kB
```

- `tsc -b` 类型检查通过（零错误）
- `vite build` 构建成功
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告

### 产物对比

| 版本 | 产物大小 | gzip |
|------|----------|------|
| v1.5.1（doc/54 后） | 1,820.06 kB | 416.06 kB |
| v1.5.2（doc/55 后） | 1,820.81 kB | 416.24 kB |

## 后续验证建议

1. 详情页勾选「等待更新」清单后：
   - 星标评分组件的收藏按钮（⭐）应高亮（`is-active` 类）
   - JavDB 原生「想看」按钮也应激活
   - 菜单按钮文案应显示「⭐ 已收藏」
2. 已收藏的视频再勾选「等待更新」清单：不重复触发（已收藏跳过）
3. 已标记「已观看」的视频勾选「等待更新」清单：跳过自动收藏，
   星标评分组件保持「已观看」状态不变
