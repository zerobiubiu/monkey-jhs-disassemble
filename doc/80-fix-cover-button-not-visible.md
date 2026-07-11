# 80 - 修复 CoverButton 列表工具栏不可见

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-11

## 1. 背景

用户反馈列表页看不到 ⑮ CoverButtonPlugin 工具栏图标。

## 2. 可能根因（加固前）

1. **注入点脆弱**：仅 `$box.find('.tags').append`；无 `.tags` 的卡片会**静默失败**（jQuery 对空集 append 无效果）
2. **图标过淡**：`opacity: .3` + 未强制 SVG 尺寸，在部分主题下几乎看不见
3. **`enableSvgBtn` 误隐藏**：非 `yes`/`true` 一律 `toggle(false)`；异常空值会把五组图标全藏
4. **瀑布流时机**：`checkDom` MutationObserver 未再调 `addSvgBtn`（archetype 有）；新追加卡片可能没有工具栏
5. **点击穿透**：工具栏在 `<a.box>` 内，未 stopPropagation 时难用（看见也点不了）

## 3. 修复

| 项 | 做法 |
|----|------|
| 无 `.tags` | 自动在 `a.box` 末尾创建 `.tags.jhs-tool-tags` 再注入 |
| CSS | 强制 22px 图标、opacity 0.75、flex 布局、z-index |
| enableSvgBtn | 仅显式 `no`/`false` 隐藏；选择器限 `.tool-box` 内 |
| checkDom | doFilter 后再次 `addSvgBtn` |
| 事件 | tool-box 点击 `preventDefault` + `stopPropagation` |
| 调试 | clog.debug 输出注入统计 |
| 设置关闭 | `end` 回调 `enableSvgBtn` 热更新显隐 |

## 4. 修改文件

- `src/plugins/cover-button-plugin.tsx`（重写加固）
- `src/plugins/list-page-plugin.tsx`（checkDom 补注入）
- `src/plugins/setting-plugin.tsx`（end → enableSvgBtn）
- `vite.config.ts` → **1.9.2** → **1.9.3**

### 1.9.3 追加（series 页仍无日志/不可见）

用户在 `/series/Y8bD` 控制台有 StatusTag/VLT/pageSort/CarSync，**无任何 CoverButton 输出**。

根因补充：

1. `clog.debug` 默认过滤器 `base` **不包含 debug**，DevTools 也看不到（其它插件用 `console.log`）
2. 仅挂 `.tags` 在 series 布局上不够稳

追加修复：

- 注入日志改 `console.log('[CoverButton] ...')`
- 优先挂载到 **`.meta` 之后**独立行 `.jhs-cover-toolbar`（与清单标签同级）
- 800ms / 2000ms 延迟补注两轮，适配 series 异步渲染

## 5. 验证

```
bun run build  ✓  @version 1.9.3
```

浏览器控制台（列表/系列页）应出现：

```
[CoverButton] 注入完成: 新增 30, 已有跳过 0, 总数 30, path=/series/Y8bD
```

```js
!!unsafeWindow.pluginManager.getBean('CoverButtonPlugin')  // true
document.querySelectorAll('.tool-box').length              // > 0
document.querySelectorAll('.jhs-cover-toolbar').length      // > 0
```

## 6. 位置说明

工具栏在**每张卡片日期/meta 下方一行右侧**（独立 `.jhs-cover-toolbar`），不是封面中央悬浮。
