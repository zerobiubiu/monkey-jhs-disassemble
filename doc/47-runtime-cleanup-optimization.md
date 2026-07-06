# 47 - 运行时调度与依赖清理优化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

本次优化针对项目静态巡检中发现的低风险问题：

- `PluginManager` 内部已 catch 插件异常并返回 `{ status: 'rejected' }`，但外层按 `Promise.allSettled` 的外层 `result.status` 过滤，导致失败汇总不生效。
- `main.tsx` 以 fire-and-forget 方式调用 `processCss().then()`，与“CSS 先于插件逻辑注入”的架构约束不完全一致。
- `StorageManager.merge_blacklist()` 中遗留迁移分支条件为 `!item.url && item.url.includes(...)`，实际恒 false，且在 url 为空时有抛错风险。
- `ListPagePlugin` 通过全局 `any` 直接改 `StorageManager` private 缓存字段。
- `layui-layer` 已由 JS 包自身带入 `layer.css`，`libs.ts` 又显式 import 一次，造成重复构建警告。
- `react-dom` / `@types/react-dom` 已无源码引用，和“仅 jsxToString 渲染 HTML 字符串”的约束不一致。

## 2. 变更

### 2.1 插件调度

- `PluginManager.processCss()` / `processPlugins()` 改为 `Promise.all` 收集结构化结果。
- 插件级异常仍在单个任务内 catch，不影响其他插件执行。
- 失败汇总改按 `result.status === 'rejected'` 判断返回值，确保最终错误清单真实可见。

### 2.2 启动顺序

- `main.tsx` 移除独立 `pluginManager.processCss().then()`。
- 启动 IIFE 内改为：
  1. `await pluginManager.processCss()`
  2. 页面判定
  3. storage 迁移/清理
  4. `await pluginManager.processPlugins()`

CSS 注入顺序与 AGENTS.md 的架构约束保持一致。

### 2.3 StorageManager 缓存与迁移

- 新增 `clearFilterActorActressCarListCache()`。
- 新增 `clearSettingCache()`。
- `ListPagePlugin` 的 BroadcastChannel 缓存清理改走公开方法，不再直接改 private 字段。
- `merge_blacklist()` 的 `sort_type` 清理分支改为 `item.url && item.url.includes('sort_type')`，并在清理后标记 `itemChanged = true`。

### 2.4 依赖与 CSS

- 删除 `src/core/libs.ts` 中显式 `import 'layui-layer/layer.css'`；保留 `layui-layer` 包自身引入的 layer.css。
- 移除 `react-dom` 与 `@types/react-dom`，更新 `bun.lock`。

## 3. 验证

执行：

```bash
bun run build
```

结果：

- `tsc -b` 通过。
- `vite build` 通过。
- 产物：`dist/monkey-jhs-disassemble.user.js 1,809.45 kB`
- gzip：`413.37 kB`
- lightningcss 仍输出一组 `layui-layer/layer.css` IE hack 警告（`*display` / `*zoom` / `_display`），属于 doc/24 记录过的已知无害警告；重复导入后产生的第二组警告已消失。
