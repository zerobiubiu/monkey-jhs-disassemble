# 94 - 修复跨标签页收藏/已观看状态标签不同步

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户报告：在视频详情页点击收藏或已读后，列表页（其他标签页）视频卡片右上角的
已收藏/已观看状态标签（`.status-tag`）不刷新。

## 根因

doc/76（commit `3611d81`，集成 jhs 3.3.6.027）为 `StorageManager.getCarList()`
引入了运行时缓存 `cacheCarList`（受 `featureFlags.storageCacheDeepCopy` 控制，
默认开启）。缓存仅在**本页** `saveCar`/`removeCar` 时更新，**不跨标签页同步**。

跨标签页同步有两条路径，均受影响：

| 路径 | 触发方 | 接收方 | 缓存问题 |
|------|--------|--------|----------|
| `broadcastWantWatchedSync`（GM_setValue + localStorage + CustomEvent） | `quickConvertToFav`/`quickSetHasWatch`/`onWantAdded`/`onWatchedAdded` | `setupWantWatchedSyncListener` → `refreshItemStatusTag` → `renderItemStatusTag` → `getCar` | 列表页 `cacheCarList` 为旧值 |
| `refresh()`（BroadcastChannel `channel-refresh`） | `favoriteOne`/`hasWatchOne`/`filterOne` 等 | `handle` 的 `refresh` 分支 → `doFilter` → `filterMovieList` → `getCarList` | 列表页 `cacheCarList` 为旧值 |

`clearCarListCache()` 方法自 doc/76 起就已定义但**从未被调用**，属遗漏。

## 修复

在两条跨标签页同步路径的接收端，于读取数据前清除 `cacheCarList`：

1. **`detail-page-button-plugin.tsx` `handleSync`**：payload 校验通过后、
   `showStatus`/`refreshItemStatusTag` 之前，调用
   `storageManager.clearCarListCache()`
2. **`list-page-plugin.tsx` BroadcastChannel `refresh` 分支**：`doFilter()`
   之前调用 `storageManager.clearCarListCache()`

清除后 `getCar`/`getCarList` 会从 IndexedDB 重读最新值，状态标签正确刷新。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/detail-page-button-plugin.tsx` | `handleSync` 内 payload 校验后加 `storageManager.clearCarListCache()` |
| `src/plugins/list-page-plugin.tsx` | BroadcastChannel `refresh` 分支 `doFilter()` 前加 `storageManager.clearCarListCache()` |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,890.60 kB │ gzip: 435.01 kB
✓ built in 1.14s
```

tsc -b 零错误，vite build 成功。

## 后续验证建议

- 打开列表页（Tab A），在另一标签页打开某影片详情页（Tab B）
- 在 Tab B 点击收藏（快捷评分面板的收藏按钮）→ 切回 Tab A，确认该卡片右上角
  出现「已收藏」标签
- 在 Tab B 点击已读（0 星）→ 切回 Tab A，确认标签变为「已观看」
- 在 Tab B 点击拉黑 → 切回 Tab A，确认标签变为「已屏蔽」
- 使用 JHS 菜单按钮（如可见）收藏/已读，同样验证跨标签页同步
