# 118 - 瀑布流常开 + 触底加载方式切换

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

原快捷设置有「瀑布流模式」总开关（`autoPage`）：关=传统分页+自动排序，
开=瀑布流+「加载全部」。用户要求：

1. 去掉瀑布流总开关，**默认常开**
2. 触底加载分两种：自动下一页 / 底部出按钮点了再加载
3. **「加载全部」按钮一直存在**（有下一页时）

## 2. 方案

| 设置 | 说明 |
|------|------|
| ~~`autoPage` UI~~ | 移除；逻辑上瀑布流常开，不再用其关闭瀑布流 |
| **`autoPageLoadMode`** | `auto`（默认）触底自动加载下一页；`click` 触底显示「点击加载下一页」，点 loader 再加载 |

行为：

- `waterfall()` 不再判断 `autoPage===YES` 才 `showLoadAllBtn`，有下一页即显示
- `loadNextPage` 不再因 `autoPage===NO` 早退
- `checkLoad`：`auto` → 调 `loadNextPage`；`click` → `setState('waterfall-click', '点击加载下一页')`
- loader 点击：`waterfall-error` 或 `waterfall-click` 时加载
- 设置面板 `setLoadMode` 即时切换，无需整页刷新
- ListPageButtonPlugin：不再读 `autoPage`，不自动 sortItems（与常开瀑布流一致）

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/components/simple-setting-panel.tsx` | 瀑布流开关 → 触底加载方式 select |
| `src/plugins/setting-plugin.tsx` | load/save autoPageLoadMode；移除 autoPage change |
| `src/plugins/auto-page-plugin.ts` | loadMode、checkLoad、loader 点击、loadAll 常显、setLoadMode |
| `src/styles/auto-page-plugin.css` | `.waterfall-click` 样式 |
| `src/plugins/list-page-button-plugin.tsx` | 去掉 autoPage 自动排序分支 |
| `vite.config.ts` | 1.18.1→1.19.0 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 同步 |

## 4. 验证

```bash
$ npx tsc -b && npx vite build
```

建议：列表页默认触底自动翻页 + 右下「加载全部」；改为「点按钮」后滑到底只
出现蓝字「点击加载下一页」，点后才追加；「加载全部」始终可点。
