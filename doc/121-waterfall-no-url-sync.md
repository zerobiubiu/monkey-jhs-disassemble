# 121 · 瀑布流不再修改地址栏 URL

| 项 | 内容 |
|----|------|
| 文档类型 | 🔧开发指导 |
| 文档状态 | ✅已执行 |
| 版本 | 1.19.2 → 1.19.3 |

## 背景

列表瀑布流（AutoPagePlugin）滚动时会 `history.replaceState` / `pushState`
把地址栏改成 `?page=N`；清单瀑布流（ListWaterfallPlugin）同样 `replaceState`。
用户希望瀑布流加载时 **保持进入页面时的原始 URL**，方便复制/分享入口链接，
也不污染浏览器历史。

## 方案

1. `AutoPagePlugin.checkScrollPosition`：仍更新内部 `currentPage`（「加载全部」
   文案等），**不再**调用 `updatePageUrl`。
2. `updatePageUrl` / `updatePageUrl_old`：改为 no-op；移除对 `featureFlags.autoPageReplaceState` 的依赖。
3. `ListWaterfallPlugin.updateCurrentPageFromScroll`：去掉 `replaceState`。

加载下一页仍用内存中的 `nextUrl`，与地址栏无关。

## 实施

| 文件 | 变更 |
|------|------|
| `src/plugins/auto-page-plugin.ts` | 去 URL 同步；updatePageUrl no-op；删 featureFlags import |
| `src/plugins/list-waterfall-plugin.ts` | 去 replaceState |
| `vite.config.ts` | version 1.19.2→1.19.3 |

## 执行验证记录

```
$ npx tsc -b && npx vite build
# 通过；@version 1.19.3
```

## 后续验证建议

1. 打开任意列表页（如 `?page=1` 或无 page 参数），滚动加载多页：地址栏 URL 不变。
2. 刷新页面：仍回到进入时的列表入口页（非滚动过程中曾出现的 page=N）。
3. `/users/lists` 等清单瀑布流同样地址栏不随滚动变化。
