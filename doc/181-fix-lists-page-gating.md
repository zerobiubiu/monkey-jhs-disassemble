# doc/181 — 修复 /users/lists 页面插件被跳过

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户报告 https://javdb.com/users/lists 页面"我的清单"功能全部失效：清单删除/改名不同步、阅读进度工具栏不显示、清单标签不渲染。

## 根因

commit 5b4f447（v1.28.15，Wave 1）为 PluginManager 添加了 `matchesPage()` 门控：插件声明 `pageTypes` 后，仅在匹配的页面类型上执行 `handle()`。`VideoListsTagPlugin` 和 `ListReadingStatusPlugin` 声明了 `pageTypes: ['detail', 'list']`，但 `/users/lists` 页面的 `pageContext.pageType` 解析为 `'unknown'`（无 `/v/`、无 `.movie-list`、无 `advanced_search`），导致两个插件在该页面被**静默跳过**——`handle()` 从未执行。

此 bug 非 v1.28.18–v1.28.20 的原子化/复用 wave 引入；原子化 wave 未触碰 vlt-plugin.ts 或 list-reading-status-plugin.ts。

## 修复

移除两个插件的 `pageTypes` getter 覆写（及其 `import type { PageType }`），使其继承默认 `[]`（匹配所有页面）。两个插件的 `handle()` 内部已有健壮的路径守卫（`isDetailPage` / `/users/lists` / `isListPage` 早返回），与 `ListWaterfallPlugin` 和 `ModMyListOpenWayPlugin` 的模式一致——后者无 `pageTypes` 覆写，在 `/users/lists` 上正常工作。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/plugins/video-lists-tag/vlt-plugin.ts | 删除 `get pageTypes()` + `import type { PageType }` |
| src/plugins/list-reading-status-plugin.ts | 删除 `get pageTypes()` + `import type { PageType }` |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / stylelint 干净 / check:structure OK。
