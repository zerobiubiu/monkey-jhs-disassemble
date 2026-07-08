# 73 - 快捷评分面板新增拉黑按钮（第二步）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/72 隐藏了 `DetailMenuButtons` 的状态行（屏蔽/收藏/已观看），但拉黑功能
随之不可见。需在快捷评分面板新增「🚫 拉黑」按钮，替代被隐藏的 `#filterBtn`。

拉黑不能单纯屏蔽——需同时将 javdb 原生端设为已读0星（和已读按钮一样调
`_triggerJavdbReview(0)`），并弹确认框警告严重性。

## 方案

### 拉黑逻辑与普通已读的区别

| 行为 | 普通已读（quickSetHasWatch(0)） | 拉黑（quickBlock） |
|------|-------------------------------|------|
| JHS 本地状态 | `HAS_WATCH_ACTION` + score=0 | `FILTER_ACTION`（屏蔽） |
| javdb 原生端 | 设为已观看0星 | 同样设为已观看0星（让影片不在想看列表，不出现在推荐） |
| 确认弹窗 | 无（直接执行） | **必须有**，警告严重性 |
| 操作后 | 留在详情页 | 关闭页面（`utils.closePage()`）+ 刷新（`refresh()`） |
| 广播 | `hasWatch+add` | `filter+add`（让列表页隐藏该卡片） |
| 互斥处理 | 先移除 favorite | 先移除已有记录（favorite/hasWatch），再写 FILTER_ACTION |
| MutationObserver 阻断 | `_wantWatchedSyncing=true` | 同样阻断（防止 onWatchedAdded 覆盖 FILTER_ACTION） |

### 关键风险处理

**MutationObserver 误触发**：`_triggerJavdbReview(0)` 会触发 Rails JS 更新
`.review-buttons` DOM → `hookWantAndWatchedButtons` 检测到"已观看"被添加 →
调 `onWatchedAdded` 写入 `HAS_WATCH_ACTION`，与拉黑写的 `FILTER_ACTION` 冲突。

解法：与 `quickSetHasWatch` 一致，用 `_wantWatchedSyncing=true` 阻断 observer，
`_reviewChain` 串行化 javdb 原生端操作。

**saveCar 抛错**：如果该番号已有记录（如已收藏/已观看），`saveCar` 会抛
"已在收藏列表中"/"已在屏蔽列表中"。解法：先 `removeCar` 清除已有记录，再写
`FILTER_ACTION`。

### `_syncRatingBar` 增加 filter 状态

filter 状态是 JHS 独有（javdb 原生无屏蔽概念），`_syncRatingBar` 原本只从
原生 DOM 读 want/watched 状态。新增异步查 `storageManager.getCar` 判断是否
已拉黑，是则给 `.jhs-block-btn` 加 `is-active` 高亮（红色 `#de3333`）。

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/components/rating-bar-html.tsx` | `.jhs-rating-actions` 内新增 `.jhs-block-btn`（🚫 拉黑）按钮 |
| `src/plugins/detail-page-button-plugin.tsx` | `_buildRatingBar` 获取 blockBtn + 绑定 click → `quickBlock()`；新增 `quickBlock` 方法（确认框 + 写 FILTER_ACTION + 广播 + 设为已读0星 + 关闭页面）；`_syncRatingBar` 新增 blockBtn 引用 + 异步查 JHS 记录高亮 filter 状态 |
| `src/styles/rating-bar.css` | `.jhs-block-btn` 样式（hover/is-active 红色/is-popping 动画） |
| `vite.config.ts` | version 1.8.3 → 1.8.4 |

### `quickBlock` 方法流程

```
点击 🚫 拉黑
  └─ quickBlock()
       ├─ utils.q 确认框（警告严重性）
       └─ 确认后：
            1. removeCar 清除已有记录（避免 saveCar 抛错）
            2. saveCar({ actionType: FILTER_ACTION })
            3. broadcastWantWatchedSync({ status: filter, op: 'add' })
            4. _reviewChain 串行：
                 _wantWatchedSyncing = true（阻断 observer）
                 _triggerJavdbReview(0)（设为已读0星）
                 _syncRatingBar()
                 _wantWatchedSyncing = false
            5. showStatus + refresh + closePage
```

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 214 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,854.22 kB │ gzip: 424.22 kB
✓ built in 1.08s
```

- `tsc -b` 通过
- `vite build` 通过
- diagnostics：detail-page-button-plugin.tsx / rating-bar-html.tsx 均无 errors/warnings

### 版本号

`vite.config.ts` version `1.8.3` → `1.8.4`（新增功能，patch 递增）

## 后续验证建议

1. 详情页快捷评分条应显示「🚫 拉黑」按钮（收藏/已读/拉黑三个按钮）
2. 点击拉黑 → 弹确认框，含红色警告文案
3. 确认后 → toast「XXX 已拉黑」→ 页面关闭 + 列表页刷新
4. 列表页对应卡片应被隐藏（data-hide）
5. 重新打开该影片详情页 → 拉黑按钮应红色高亮（is-active）
6. javdb 原生端应显示"已观看0星"（影片不在想看列表）
7. MutationObserver 不会误触发 onWatchedAdded 覆盖 FILTER_ACTION
8. 快捷键屏蔽（filterHotKey）仍能正常工作（事件绑定在隐藏的 #filterBtn 上）
