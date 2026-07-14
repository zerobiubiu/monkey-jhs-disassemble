# 103 - 修复普通列表页排序组件丢失（移除 autoPage 对 #sort-toggle-btn 的隐藏）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/102 修复了 `/lists/*` 清单页排序组件丢失，但其他视频列表页（`/movies`、
`/tags` 等）排序组件仍不显示。用户怀疑是 doc/92/93 清理 `/actors/*` 组件时
误伤。

## 根因分析

### 排除 doc/92/93

git diff 确认 26f108d（doc/93）对 `menu-button-box-html.tsx` 的修改**仅删除**
演员页相关代码（`actorsPage` prop + `filterAllVideo` 按钮 + `FILTER_ALL_TIP`
常量），**完全没动** `#sort-toggle-btn` 的渲染逻辑（`{showSortToggle && ...}`）。
对 `list-page-button-plugin.tsx` 的修改也只是演员页早 return，不影响普通列表页。

doc/92 说的"PageSortPlugin handle 直接 return"**从未落地**（git log 确认
`page-sort-plugin.ts` 只有 2 个 commit，都不含"直接 return"）。

### 真正的原因

**autoPage=YES（瀑布流模式）时排序与瀑布流互斥**，三处禁用排序：

| 位置 | 逻辑 | 影响 |
|------|------|------|
| `ListPageButtonPlugin.handle()` | `autoPage===YES → $('#sort-toggle-btn').hide()` | jhs 排序按钮隐藏 |
| `ListPageButtonPlugin.sortItems()` | `autoPage===YES → return` | 不执行排序 |
| `PageSortPlugin.handle()` | `autoPage===YES → return` | PageSort 不注入 |
| `setting-plugin` autoPage change | `YES → $('#sort-toggle-btn').hide()` | 运行时切换也隐藏 |

`/lists/*` 有排序是因为 doc/102 加了 `!currentHref.includes('/lists/')` 排除
条件。普通列表页没加排除，所以 autoPage=YES 时排序仍被禁用。

## 修复

**移除 autoPage 对 `#sort-toggle-btn` 的隐藏逻辑**——排序按钮始终显示，
用户可在瀑布流模式下手动排序：

- autoPage=NO：页面加载时自动排序（保持原行为）
- autoPage=YES：页面加载时不自动排序（保持瀑布流原始顺序），但用户可手动
  点击 `#sort-toggle-btn` 排序（不影响瀑布流追加，新追加的项在末尾）

`sortItems()` 移除 autoPage 判断（页面加载时是否自动排序由 `handle()` 控制，
用户手动点击时执行排序）。

**PageSortPlugin 保持 autoPage=YES 不注入**——其 sortGuard MutationObserver
会监听容器 childList 变化，瀑布流 append 新页时触发误判重排，与瀑布流冲突。
`/lists/*` 无瀑布流分页，PageSort 仍注入（doc/102 的 `!currentHref.includes('/lists/')`
条件保留）。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/list-page-button-plugin.tsx` | `handle()` 移除 autoPage 隐藏 `#sort-toggle-btn` 逻辑，改为 `!autoPageEnabled` 时才调 `sortItems()`；`sortItems()` 移除 autoPage 判断（保留 isSearchOrUserPage 跳过）；doc-comment 更新 |
| `src/plugins/setting-plugin.tsx` | autoPage change 移除 `#sort-toggle-btn` hide/show 逻辑 + `isListsPage` 判断；autoPage=NO 时调 `getBean('ListPageButtonPlugin')?.sortItems()`；删除 unused `currentHref` import |

### 保留不变

| 文件 | 保留 | 理由 |
|------|------|------|
| `src/plugins/page-sort-plugin.ts` | `autoPage===YES && !currentHref.includes('/lists/') → return` | sortGuard MutationObserver 与瀑布流 append 冲突；/lists/ 无分页仍注入 |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.13 kB │ gzip: 432.83 kB
✓ built in 1.12s
```

- `tsc -b` 零错误，3 个修改文件诊断无 error/warning（currentHref unused import 已删）
- 产物 1879.13 kB（gzip 432.83 kB），较 1.13.3 -0.26 kB
- version `1.13.3` → `1.13.4`（bug 修复，patch 递增）

## 后续验证建议

1. 打开普通列表页（如 `/movies`、`/tags`）→ 确认 `#sort-toggle-btn` 排序按钮显示
2. 开启「瀑布流模式」→ 排序按钮**仍显示**（不再隐藏）
3. 开启瀑布流 + 点击排序按钮 → 执行排序（重排当前已加载项），瀑布流追加的新页在末尾
4. 关闭「瀑布流模式」→ 自动执行排序（`sortItems()`）
5. `/lists/*` 清单页 → 排序按钮 + PageSort 排序选择器都显示
6. 搜索页 `/search?q=` → 排序按钮不显示（`isSearchOrUserPage` 跳过）
