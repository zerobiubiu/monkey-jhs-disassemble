# 104 - 移除 PageSort 的 autoPage 禁用逻辑（所有列表页注入排序选择器）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/103 只移除了 autoPage 对 `#sort-toggle-btn`（jhs 排序按钮）的隐藏逻辑，
但 **PageSort 排序选择器**（按钮组：按名称/评分升降序）仍在 `autoPage=YES`
时 `return` 不注入。用户反馈 `/lists/*` 以外的页面排序组件**仍未恢复**。

## 根因

`PageSortPlugin.handle()` 仍保留 autoPage 检查：

```ts
if (autoPage === YES && !currentHref.includes('/lists/')) return;
```

- autoPage=YES 且非 `/lists/` → return → PageSort **不注入** → 排序选择器不显示
- `/lists/*` 有排序是因为 doc/102 加了 `!currentHref.includes('/lists/')` 排除

doc/103 之前认为"sortGuard MutationObserver 与瀑布流 append 冲突"所以保持禁用。
但重新审查 sortGuard 实现：

```ts
const sortGuard = new MutationObserver(() => {
    if (this.activeSort && !this.isApplyingSort) {  // 仅用户已选排序方式时
        if (this.sortGuardRetries >= this.MAX_GUARD_RETRIES) return;  // 5 次上限
        this.sortGuardRetries++;
        this.applySort(this.activeSort);  // 重新排序（含新追加项）
    }
});
```

- 仅 `activeSort !== null`（用户选了排序方式）时才触发重排
- 有 `MAX_GUARD_RETRIES=5` 上限，超限放弃
- 用户手动点击排序按钮时 `sortGuardRetries` 重置为 0

**冲突不严重**——用户没选排序方式时 sortGuard 不触发；选了排序方式后瀑布流
append 自动重排（含新项）是合理行为；5 次上限防死循环。

## 修复

移除 `handle()` 的 autoPage 检查，所有列表页注入 PageSort：

```ts
// 修改前
if (autoPage === YES && !currentHref.includes('/lists/')) return;

// 修改后（删除整行）
```

同时移除 unused import（`currentHref` + `YES`），更新 doc-comment。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/page-sort-plugin.ts` | `handle()` 移除 autoPage 检查 + `/lists/` 条件，改为直接 `waitForContainer()`；删除 unused `import { currentHref }` + `import { YES }`；doc-comment 更新（"autoPage=YES 时不注入"→"sortGuard 自动重排有上限"） |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.02 kB │ gzip: 432.80 kB
✓ built in 1.21s
```

- `tsc -b` 零错误，page-sort-plugin.ts 诊断无 error/warning（unused import 已删）
- 产物 1879.02 kB（gzip 432.80 kB），较 1.13.4 -0.11 kB
- version `1.13.4` → `1.13.5`（bug 修复，patch 递增）

## 后续验证建议

1. 打开普通列表页（`/movies`、`/tags`）→ `.toolbar` 中应出现 PageSort 排序
   选择器按钮组（按名称/评分升降序）
2. 开启「瀑布流模式」→ PageSort 排序选择器**仍显示**
3. 选择某排序方式 → 瀑布流 append 新页后自动重排（含新项），5 次后停止自动重排
4. 手动点击排序按钮 → 重置计数器，继续自动重排
5. `#sort-toggle-btn`（jhs 排序）与 PageSort 共存，点击其一时清除另一方的选中态
6. `/lists/*` 清单页 → PageSort 仍注入（不变）
