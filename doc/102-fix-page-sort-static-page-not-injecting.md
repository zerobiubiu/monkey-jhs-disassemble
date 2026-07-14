# 102 - 修复视频清单详情页排序按钮组不注入

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户报告视频清单详情页 `https://javdb.com/lists/*` 的「按照名称升序/降序、
按照评分升序/降序」排序按钮组丢失（不再出现在 `.toolbar` 内）。

## 根因

`PageSortPlugin.waitForContainer`（`src/plugins/page-sort-plugin.ts`）照搬原
`archetype/pageSort.user.js` 的等待模式：

```ts
const observer = new MutationObserver((_m, obs) => {
    const $container = $('body > section > div');
    if ($container.length) { obs.disconnect(); this.createSortSelector(); }
});
observer.observe(document.body, { childList: true, subtree: true });
```

原脚本 `@run-at document-end`，此时 `body > section > div` 尚未出现，
MutationObserver 会在 section 渲染时被触发，createSortSelector 才被调用。

本项目 `@run-at document-idle`，handle 调用时 DOM 已解析完成，`body > section > div`
**已经存在**。MutationObserver 不会在 `observe()` 时立即触发回调，只在
**后续 mutation** 时触发。视频清单详情页 `/lists/{id}` 是静态页（视频数有限、
通常单页无瀑布流 append），`document.body` 子树长期无 mutation → observer
**永不触发** → createSortSelector **永不调用** → 排序按钮组不注入。

### 实测验证

在 `https://javdb.com/lists/Azm8DM`（document.readyState=complete）安装模拟
PageSortPlugin 的 MutationObserver，5 秒内触发次数 = **0**，证实 observer
在静态清单详情页永不触发。同页同步检查 `.toolbar` + `.movie-list.h.cols-4.vcols-8`
+ 40 个 `.item` 全部就绪，`canInjectImmediately=true`——证明问题在等待模式
而非 DOM 缺失。

### 影响范围

- `/lists/{id}` 清单详情页（典型静态列表页，无瀑布流）→ **必现** 不注入
- 首页 `/`、标签页 `/tags`、搜索页等有 AutoPagePlugin 瀑布流 append 触发
  body 子树 mutation 的页面 → observer 最终会触发，但存在延迟（等首次
  瀑布流加载），非立即注入

## 方案

`waitForContainer` 改为「先同步尝试，失败才 observer 等待」模式（与
`StatusTagFilterPlugin.init` 一致）：

1. 先调用 `this.createSortSelector()`
2. 返回 true（注入成功）→ 直接 return，不挂 observer
3. 返回 false（.toolbar/.movie-list/.item 任一未就绪）→ 挂 observer 等待
   异步渲染，observer 回调内再次调用 `createSortSelector()`，成功则 disconnect

同时 `createSortSelector` 返回值由 `void` 改为 `boolean`，三个 early return
（`$toolbar`/`$container`/`$items` 缺失）改返回 `false`，末尾返回 `true`。

### 防重入分析

- 同步路径：createSortSelector 成功 → waitForContainer 直接 return，不挂
  observer，不会重复调用
- observer 路径：observer 回调 createSortSelector 成功 → 立即 disconnect，
  不会再触发，不会重复调用
- observer 回调 createSortSelector 失败 → observer 继续，但 createSortSelector
  每次失败都无副作用（`this.$container` 在 `$container` 检查通过后才赋值，
  `$items` 失败时仅 `$container` 被赋值，下次调用重新查询覆盖，无害）

无需额外防重入守卫。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/page-sort-plugin.ts` | `createSortSelector` 返回值 `void→boolean`，三处 early return 改 `return false`，末尾 `return true`；`waitForContainer` 改为先同步调 `createSortSelector()`，成功 return，失败才挂 observer（回调内 `createSortSelector()` 成功则 disconnect）；方法头 JSDoc 更新 |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,879.23 kB │ gzip: 432.87 kB
✓ built in 1.43s
```

- `tsc -b` 零错误，`page-sort-plugin.ts` 诊断无 error/warning
- lightningcss 对 layer.css IE hack 的 `Unexpected token Semicolon` 警告为
  errorRecovery 容错 strip（已有无害警告，非本次引入）
- version `1.13.2` → `1.13.3`（bug 修复，patch 递增）

## 后续验证建议

1. 访问 `https://javdb.com/lists/<任意清单ID>`（清单详情页），确认 `.toolbar`
   内出现「按照名称升序/按照名称降序/按照评分升序/按照评分降序」四个按钮
2. 点击按钮应能即时排序 `.movie-list` 内的视频卡片；再次点击已选中项恢复
   原始顺序
3. 访问首页 `/`、标签页 `/tags`，确认排序按钮组仍正常注入（回归无影响）
4. 开启设置面板「自动翻页（瀑布流）」后再访问清单详情页，确认 PageSortPlugin
   仍按 doc/37 协调方案 1 提前 return（autoPage=YES 时不注入，避免打乱瀑布流）
