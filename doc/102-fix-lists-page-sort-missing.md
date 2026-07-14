# 102 - 修复 /lists/* 清单页排序组件丢失

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户报告：视频清单页面（`https://javdb.com/lists/*`）的排序组件丢失。

## 根因

`/lists/*` 清单详情页有 `.movie-list`（`isListPage=true`），但通常无
`.pagination-next`（不支持瀑布流分页）。然而 `autoPage=YES` 时**无条件**禁用排序：

| 位置 | 逻辑 | 影响 |
|------|------|------|
| `ListPageButtonPlugin.handle()` L58 | `autoPage===YES → $('#sort-toggle-btn').hide()` | jhs 排序按钮隐藏 |
| `PageSortPlugin.handle()` L195 | `autoPage===YES → return` | PageSort 排序选择器不注入 |
| `setting-plugin.tsx` autoPage change | `YES → $('#sort-toggle-btn').hide()` | 运行时切换也隐藏 |

设计意图是"排序与瀑布流互斥"——瀑布流按原始顺序追加，排序会打乱追加顺序。
但 `/lists/*` 不支持瀑布流分页（无 `.pagination-next`，AutoPagePlugin 显示
"已经到底了"），autoPage 的排序互斥在该页面**不合理**。

## 修复

`/lists/` 路径下 autoPage=YES **不禁用**排序（排序与瀑布流互斥仅在有分页的
列表页生效）：

```ts
// 修改前：autoPage===YES → 禁用排序
if (autoPage === YES) return;

// 修改后：autoPage===YES 且非 /lists/ 路径 → 禁用排序
if (autoPage === YES && !currentHref.includes('/lists/')) return;
```

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/page-sort-plugin.ts` | 添加 `import { currentHref }`；handle() 的 autoPage 判断加 `!currentHref.includes('/lists/')` 条件 |
| `src/plugins/list-page-button-plugin.tsx` | handle() 的 autoPage 判断加 `!currentHref.includes('/lists/')` 条件（不隐藏 #sort-toggle-btn） |
| `src/plugins/setting-plugin.tsx` | 添加 `currentHref` 到 import；autoPage change 回调中 `/lists/` 路径不隐藏/显示 #sort-toggle-btn |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.39 kB │ gzip: 432.93 kB
✓ built in 1.09s
```

- `tsc -b` 零错误，3 个修改文件诊断无 error/warning
- 产物 1879.39 kB（gzip 432.93 kB），较 1.13.2 +0.13 kB
- version `1.13.2` → `1.13.3`（bug 修复，patch 递增）

## 后续验证建议

1. 打开 `https://javdb.com/lists/{某清单ID}` 清单详情页
2. 确认排序组件（#sort-toggle-btn / PageSort 排序选择器）正常显示
3. 开启快捷设置中的「瀑布流模式」→ `/lists/` 页面排序组件**仍显示**
   （不隐藏），普通列表页排序组件隐藏（设计行为）
4. 关闭「瀑布流模式」→ 普通列表页排序组件恢复显示
5. 确认 `/lists/` 页面瀑布流不启动（无 `.pagination-next`，显示"已经到底了"）
