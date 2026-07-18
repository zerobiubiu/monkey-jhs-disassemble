# 124 - 评分/已读后自动移出「等待更新」清单

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-18

## 1. 背景

### 需求

用户在详情页做出评分（0–5 星）或点击「已读」（0 星）后，若当前视频
仍在名称包含「等待更新」的清单中，应自动移出；不在该清单则不做任何处理。

### 既有对称能力

doc/53：向「等待更新」清单**添加**视频时自动收藏。

本需求为反向闭环：评完分/已读 = 不再「等待更新」→ 移出清单。

### 切入点

| 入口 | 方法 | 说明 |
|------|------|------|
| 星标 1–5 | `DetailPageButtonPlugin.quickSetHasWatch(score)` | 已观看 + N 星 |
| 已读按钮 | `quickSetHasWatch(0)` | 已观看 + 0 星 |

不挂钩：拉黑 `quickBlock`、菜单「已观看」`hasWatchOne`（关页且无星级 UI）。

## 2. 方案

### 主路径（优先）

在 `quickSetHasWatch` JHS 写入成功后 fire-and-forget 调用
`autoRemoveFromPendingUpdateOnWatch()`：

1. 扫描 `#modal-save-list` 内已勾选、且清单名含「等待更新」的 checkbox
2. `checked = false` + `dispatchEvent(change)` → 触发：
   - JavDB Stimulus `list#listCheckboxChanged`（服务端移出）
   - `setupCheckboxListener` → `handleCheckboxChange(..., false)`（本地 IDB + 广播 + toast）
3. 同步取消 `.jhs-list-panel` 克隆勾选（仅 UI，不二次派发）

关键词与 doc/53 共用：`AUTO_FAVORITE_KEYWORD = '等待更新'`（名称包含即匹配）。

### 兜底

| 情况 | 行为 |
|------|------|
| 清单 DOM 已加载且已勾选 | 立即 uncheck（主路径） |
| DOM 未就绪但 VltDb 有关联 | 最多轮询 ~3s 等 checkbox，再 uncheck |
| 仍无 DOM | 仅 `handleCheckboxChange(..., false)` 本地 IDB 移除 |

评分未变化（同星级早退）不触发移出。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 新增 `autoRemoveFromPendingUpdateOnWatch` / `uncheckPendingUpdateListCheckboxes` / `findPendingUpdateListsForCurrentMovie` |
| `src/plugins/detail-page-button-plugin.tsx` | import + `quickSetHasWatch` 成功后调用 |
| `vite.config.ts` | version `1.19.5` → `1.19.6` |

## 4. 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 219 modules transformed
dist/monkey-jhs-disassemble.user.js  1,924.91 kB │ gzip: 443.34 kB
✓ built in 1.18s
```

lightningcss IE hack 警告为既有 layer.css，非本次引入。

## 5. 后续验证建议

1. 详情页将视频勾进「等待更新」→ 点 3 星：应 toast「已从「等待更新」移除」+ 面板取消勾选
2. 不在「等待更新」中评分：仅评分 toast，无清单移除 toast
3. 点「已读」(0 星)：同上移出
4. 名称如「等待更新-无码」也应匹配
5. 评分未变化（重复点同星）：不移出、不重复 toast
