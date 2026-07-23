# doc/140 — 插件 pageTypes 声明迁移

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/139 建立了 Runtime V2 基础设施（PageContext + PluginManager.matchesPage），
但所有 40 个插件的 `pageTypes` 均为空数组（匹配所有页面）。
本轮为 19 个页面特定插件添加 `pageTypes` 声明，使 PluginManager
在 processCss/processPlugins 时按页面类型过滤。

## 方案

### 页面类型映射

| 页面类型 | 插件 | pageTypes |
|---------|------|-----------|
| 详情页（9） | detail-page, detail-page-button, favorite-actresses, highlight-magnet, preview-video, review, screenshot, translate, visit-history | `['detail']` |
| 列表页（6） | auto-page, fold-category, list-page-button, list-page, page-sort, status-tag-filter | `['list']` |
| 混合（3） | other-site, list-reading-status, vlt | `['detail', 'list']` |
| 非详情页（1） | key-page-turning | `['list', 'fc2', 'unknown']` |
| 全局（21） | 其余插件（setting, blacklist, history, nav-bar, hit-show, top250, new-video, related, want-watched, fc2, fc2-by-123av, magnet-hub, image-recognition, rating-display, car-list-reader, missav-status-tag, missav-quick-copy, modal-list-disabler, list-waterfall, list-parser, page-sort） | `[]`（匹配所有） |

### 修改模式

每个文件 2 处修改：

```typescript
// 1. import
import type { PageType } from '../core/page-context';

// 2. getName() 之后
get pageTypes(): PageType[] {
    return ['detail'];  // 或 ['list'] / ['detail', 'list'] / ['list', 'fc2', 'unknown']
}
```

### 向后兼容

handle() 中已有的页面守卫（`if (!window.isDetailPage) return;`）保留不动。
pageTypes 过滤是额外的第一层防线，handle 内守卫是第二层。
两层同时存在确保零行为偏差。

## 实施（修改文件清单）

19 个插件文件，每个添加 import + getter。

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 224 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,010.96 kB │ gzip: 463.96 kB
✓ built in 1.19s
```

tsc 零错误。产物 +0.92 kB（19 个 getter）。

## 效果

| 页面 | 之前执行 | 之后执行 | 跳过 |
|------|---------|---------|------|
| 详情页 | 40 插件 CSS + handle | 31 插件 | 9 列表页/全局中不匹配的 |
| 列表页 | 40 插件 CSS + handle | 34 插件 | 6 详情页插件 |
| 其他页面 | 40 插件 CSS + handle | 39 插件 | 1 key-page-turning |
