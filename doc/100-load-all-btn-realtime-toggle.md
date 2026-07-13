# 100 - 「加载全部」按钮实时显示/隐藏（设置面板切换即时生效）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/99 新增的「加载全部」按钮只在 `waterfall()` 页面加载时创建，检查
`autoPage === YES` 后调 `createLoadAllBtn()`。用户通过设置面板切换「瀑布流
模式」开关后，按钮**不会实时出现/消失**，需刷新页面才生效——不完善。

根因：`setting-plugin.tsx` 的 `autoPage` change 绑定只保存设置 +
隐藏/显示 `#sort-toggle-btn` 排序按钮，**没有通知 AutoPagePlugin**
创建/删除「加载全部」按钮。

## 方案

在 AutoPagePlugin 新增 `showLoadAllBtn()` / `hideLoadAllBtn()` 两个公开方法，
setting-plugin 的 autoPage change 回调中通过 `getBean('AutoPagePlugin')`
实时调用，实现切换即时生效。

### 方法设计

| 方法 | 逻辑 | 安全性 |
|------|------|--------|
| `showLoadAllBtn()` | 已存在 / 无下一页 / 容器未初始化 → 不创建；否则 `createLoadAllBtn()` | 幂等，重复调用安全 |
| `hideLoadAllBtn()` | 不存在 → 跳过；否则 `remove()` + 置 null | 正在 `loadAllPages` 时安全移除（后续 `updateLoadAllBtn` 对 null 跳过） |

### 边缘情况

- **正在 loadAllPages 时关闭瀑布流**：`hideLoadAllBtn` 移除按钮 →
  `loadAllPages` 的 while 循环中 `loadNextPage` 因 autoPage=NO 返回 →
  `pageItems.length` 不变 → break 退出 → `updateLoadAllBtn` 对 null 跳过 →
  `finally` 重置 `isLoadingAll`。安全。
- **非列表页切换 autoPage**：`waterfall()` 未启动，`container` 为 null →
  `showLoadAllBtn` 检查 `!this.container` 跳过。安全。
- **无下一页时切换**：`hasMore` 为 false → `showLoadAllBtn` 跳过。安全。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/auto-page-plugin.ts` | 新增 `showLoadAllBtn()` / `hideLoadAllBtn()` 方法；`waterfall()` 末尾改用 `showLoadAllBtn()` 替代直接 `createLoadAllBtn()`（幂等） |
| `src/plugins/setting-plugin.tsx` | `autoPage` change 回调中 `getBean('AutoPagePlugin')` 调用 `showLoadAllBtn()` / `hideLoadAllBtn()` |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.06 kB │ gzip: 432.86 kB
✓ built in 1.11s
```

- `tsc -b` 零错误，2 个修改文件诊断无 error/warning
- 产物 1879.06 kB（gzip 432.86 kB），较 1.13.0 +0.41 kB
- version `1.13.0` → `1.13.1`（优化，patch 递增）

## 后续验证建议

1. 打开 javdb 列表页，确保快捷设置中「瀑布流模式」**关闭**状态
2. 打开快捷设置 → 开启「瀑布流模式」→ **不需刷新**，右下角立即出现「加载全部」按钮
3. 关闭「瀑布流模式」→ 按钮立即消失
4. 再次开启 → 按钮立即出现（幂等，不重复创建）
5. 点击按钮加载中 → 关闭「瀑布流模式」→ 按钮消失，加载循环安全退出
6. 非列表页（搜索/已观看页）切换开关 → 按钮不出现（container 为 null）
