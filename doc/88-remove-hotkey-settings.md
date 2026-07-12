# 88 - 移除设置快捷键配置及业务快捷键功能

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户要求：将设置中的「快捷键配置」面板全部清理，相关功能模块也不再需要
（列表页悬停快捷屏蔽/收藏/观看、详情页快捷键、折叠分类/控制台快捷键、按钮上的
快捷键提示等）。

说明：独立插件 `KeyPageTurningPlugin`（方向键翻页）不依赖设置快捷键系统，保留。

## 方案

1. 设置 UI：删除侧栏「⌨️ 快捷键配置」+ `#hotkey-panel` 整块
2. SettingPlugin：删除 loadForm/saveForm 中 hotkey 读写与 `handleHotkeyInput` /
   `parseHotkey` / `isDuplicateHotkey`
3. ListPagePlugin：删除 `bindListPageHotKey` 及 `$currentImage`/热键字段
4. DetailPageButtonPlugin：删除 `bindHotkey`、热键字段、`answerCount`/force 屏蔽、
   按钮文案中的 `(快捷键)` 后缀
5. PreviewVideoPlugin / FoldCategory：去掉 hotKey 展示与读取
6. 删除 `src/core/hotkey.ts`；main.tsx 去掉 Hotkey keydown/keyup 监听

## 实施

| 文件 | 变更 |
|------|------|
| `src/components/setting-dialog.tsx` | 删 hotkey 侧栏+面板；去掉 block/favorite/watched props |
| `src/plugins/setting-plugin.tsx` | 删 hotkey load/save/handlers |
| `src/plugins/list-page-plugin.tsx` | 删 bindListPageHotKey |
| `src/plugins/detail-page-button-plugin.tsx` | 删 bindHotkey / 热键相关 |
| `src/plugins/preview-video-plugin.tsx` | 去掉热键读取与按钮 prop |
| `src/plugins/fold-category-plugin.tsx` | 去掉 foldCategoryHotKey |
| `src/components/preview-video-action-btn.tsx` | 去掉 hotKey prop |
| `src/components/fold-category-toolbar.tsx` | 去掉 hotkey prop |
| `src/main.tsx` | 去掉 Hotkey 监听 |
| `src/core/hotkey.ts` | **删除** |
| `AGENTS.md` / `vite.config.ts` | 同步描述 |
| `vite.config.ts` | version 1.10.8 → **1.11.0**（功能移除） |

## 执行验证记录

```
bun run build  # tsc -b && vite build
✓ built in 1.57s
dist/monkey-jhs-disassemble.user.js  1,897.98 kB │ gzip: 436.41 kB
```

## 后续验证建议

1. 设置弹窗侧栏无「快捷键配置」
2. 列表页/详情页按 a/s 等键不再触发屏蔽/收藏
3. 详情菜单按钮无 `(a)` 类快捷键后缀
4. 方向键翻页（KeyPageTurning）仍可用
