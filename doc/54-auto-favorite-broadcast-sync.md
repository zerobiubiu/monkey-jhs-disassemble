# 54. 自动收藏补充三重广播事件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/53 实现了向「等待更新」清单添加视频时自动收藏的功能，
但仅写了 IndexedDB（`storageManager.saveCar`），未触发收藏相关的
后续事件链。导致：

- 当前详情页菜单按钮文案未刷新（仍显示「⭐ 收藏」而非「⭐ 已收藏」）
- 其他标签页列表页 status-tag 未同步刷新
- 与手动点击收藏（`onWantAdded`/`quickConvertToFav`）效果不一致

### 根因

手动收藏（`DetailPageButtonPlugin`）在 `saveCar` 后会调用
`broadcastWantWatchedSync` 三重广播（GM_setValue / localStorage /
CustomEvent），接收方 `setupWantWatchedSyncListener` 会：

1. **详情页**：`showStatus(carNum)` 刷新菜单按钮文案（屏蔽/收藏/已观看）
2. **列表页**：`refreshItemStatusTag(carNum)` 刷新匹配卡片的 status-tag

doc/53 的 `autoFavoriteIfPendingUpdate` 缺少此广播步骤。

## 方案

### 复制三重广播逻辑

在 `vlt-sync.ts` 中新增 `broadcastWantWatchedSync` 函数，
与 `DetailPageButtonPlugin.broadcastWantWatchedSync` 等价：

- 广播键：`jdb:want-watched-sync`（与原实现一致）
- 三重通道：GM_setValue / localStorage / CustomEvent
- payload：`{ carNum, status, op, time }`

在 `autoFavoriteIfPendingUpdate` 中，`saveCar` 成功后调用
`broadcastWantWatchedSync(des, FAVORITE_ACTION, 'add')`。

### 事件链对比

| 步骤 | onWantAdded（手动想看） | quickConvertToFav（一键转收藏） | autoFavoriteIfPendingUpdate（自动收藏） |
|------|------------------------|-------------------------------|---------------------------------------|
| saveCar 写 IndexedDB | ✅ | ✅ | ✅ |
| broadcastWantWatchedSync 三重广播 | ✅ | ✅ | ✅（本次补充） |
| show.ok toast | ✅ | ✅ | ✅（showToast） |
| showStatus 刷新按钮文案 | ✅（广播触发） | ✅（广播触发） | ✅（广播触发） |
| refreshItemStatusTag 列表页刷新 | ✅（广播触发） | ✅（广播触发） | ✅（广播触发） |
| _triggerJavdbWant 调 JavDB API | ❌ | ✅ | ❌（不调，见下方说明） |
| _syncRatingBar 评分条同步 | ❌ | ✅ | ❌（由广播间接触发） |

### 不调用 `_triggerJavdbWant` 的原因

`_triggerJavdbWant` 会调用 JavDB API 将影片设为「想看」，
改变 JavDB 原生 UI 状态。`favoriteOne`（最直接的「手动点击收藏」）
也没有调用它。自动收藏场景下用户仅勾选了清单，不期望
JavDB 原生「想看」按钮被联动勾选，故不调。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | +`WANT_WATCHED_SYNC_KEY` 常量；+`broadcastWantWatchedSync()` 三重广播函数；`autoFavoriteIfPendingUpdate` 中 `saveCar` 后调用广播 |

### 代码变更摘要

```typescript
// 新增：与 DetailPageButtonPlugin.broadcastWantWatchedSync 等价的三重广播
const WANT_WATCHED_SYNC_KEY = 'jdb:want-watched-sync';
function broadcastWantWatchedSync(carNum, status, op): void {
    const payload = { carNum, status, op, time: Date.now() };
    const json = JSON.stringify(payload);
    GM_setValue(WANT_WATCHED_SYNC_KEY, json);        // 跨标签页
    localStorage.setItem(WANT_WATCHED_SYNC_KEY, json); // 跨脚本同源
    document.dispatchEvent(new CustomEvent(WANT_WATCHED_SYNC_KEY, { detail: payload })); // 同页面
}

// autoFavoriteIfPendingUpdate 中 saveCar 成功后：
broadcastWantWatchedSync(des, FAVORITE_ACTION, 'add');
```

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.66s
dist/monkey-jhs-disassemble.user.js  1,820.06 kB │ gzip: 416.06 kB
```

- `tsc -b` 类型检查通过（零错误）
- `vite build` 构建成功
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告

### 产物对比

| 版本 | 产物大小 | gzip |
|------|----------|------|
| v1.5.0（doc/53 修改前） | 1,818.14 kB | 415.53 kB |
| v1.5.0（doc/53 后） | 1,819.41 kB | 415.91 kB |
| v1.5.1（doc/54 后） | 1,820.06 kB | 416.06 kB |

## 后续验证建议

1. 详情页勾选「等待更新」清单后：
   - 菜单按钮文案应从「⭐ 收藏」变为「⭐ 已收藏」（showStatus 刷新）
   - 出现 toast `⭐ 已自动收藏`
2. 打开另一个标签页的列表页，该番号的卡片 status-tag 应显示「已收藏」
3. 在列表页勾选清单（如果有平铺面板）后，当前页菜单按钮也应同步刷新
