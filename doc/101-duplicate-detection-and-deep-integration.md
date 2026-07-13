# 101 - 重复检测优化 + 加载全部深度融合 loader 状态

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户使用「加载全部」按钮时遇到"翻页内容出现重复数据, 页码受JavDB限制,
已停止瀑布流"错误，且按钮仍显示"✓ 已全部加载"——状态不一致。

两个问题：

1. **重复检测误判**：`checkDuplicateCarNumbers` 原逻辑为 newList 中**连续 ≥2 个**
   番号在 existingList 中即判定。但 `existingList = getBoxCarInfoList()` 提取的是
   **当前 DOM 所有已加载页**的番号——"加载全部"循环加载多页后 existingList 极大，
   新页中个别番号碰巧连续重复就误判为页码受限。

2. **没有深度融合**：`loadAllPages` 循环退出后无脑显示"✓ 已全部加载"，
   没感知 `loadNextPage` 设置的 `waterfall-error` loader 状态。

## 方案

### 1. 重复检测：连续≥2 → 重复比例≥50%

`checkDuplicateCarNumbers`（base-plugin.ts）改为统计 newList 中在 existingList
已存在的番号**总数**，**重复比例 ≥50%** 才判定页码受限。

- JavDB 页码受限时返回重复内容 → newList 大部分番号重复 → 比例高 → 判定 ✓
- 新页有新内容，个别番号碰巧连续重复 → 比例低 → 不判定 ✓
- 不受 existingList 大小影响（只看比例，不看绝对数量）

### 2. 深度融合：loadAllPages 感知 loader 状态

`loadAllPages` 循环退出后检查 `this.loader` 的 className + textContent，
三种结果同步按钮文案：

| loader 状态 | 按钮文案 | 淡出 | 说明 |
|------------|---------|------|------|
| `waterfall-error` + 含"重复" | 已停止（页码受限） | 否 | 让用户看到 loader 错误信息 |
| `waterfall-error` + 其他 | 加载失败，点击重试 | 否 | 可点击重试 |
| 其他（no-more/loading） | ✓ 已全部加载 | 是（2秒后淡出） | 正常完成 |

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/base-plugin.ts` | `checkDuplicateCarNumbers` 连续≥2 检测改为重复比例≥50% 检测；注释更新 |
| `src/plugins/auto-page-plugin.ts` | `loadAllPages` 循环退出后检查 `loader.classList` 含 `waterfall-error` → 按 textContent 区分"页码受限"/"加载失败"；否则"已全部加载"+淡出；doc-comment 补充深度融合说明；头部注释"连续重复"→"重复比例≥50%" |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.26 kB │ gzip: 432.89 kB
✓ built in 1.12s
```

- `tsc -b` 零错误，2 个修改文件诊断无 error/warning
- 产物 1879.26 kB（gzip 432.89 kB），较 1.13.1 +0.20 kB
- version `1.13.1` → `1.13.2`（优化，patch 递增）

## 后续验证建议

1. 打开番号较多的分类列表页，开启瀑布流模式，点击「加载全部」
2. 应能加载多页而**不再误判**"重复数据"（除非 JavDB 真的页码受限返回重复内容）
3. 若 JavDB 真的页码受限 → 按钮显示"已停止（页码受限）"，loader 显示"翻页内容
   出现重复数据"，两者状态一致
4. 若加载失败 → 按钮显示"加载失败，点击重试"，可点击重试
5. 正常加载完 → 按钮显示"✓ 已全部加载"，2 秒后淡出
