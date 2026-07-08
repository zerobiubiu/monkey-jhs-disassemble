# 72 - 隐藏详情页菜单按钮组状态行（屏蔽/收藏/已观看）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

### doc/71 修正

doc/71 误判了用户选择器 `div:nth-child(4) > div > div:nth-child(2) > div:nth-child(1)`
对应的元素——通过 MCP 访问 javdb 详情页确认，该选择器对应的是**脚本自己创建的
`DetailMenuButtons` 按钮组左行**（`#filterBtn`/`#favoriteBtn`/`#hasWatchBtn`），
不是 JavDB 原生评价面板。原生评价面板早已被 rating-bar.css 原有规则隐藏（用户
反馈"原来就没问题"）。

本 doc 撤回 doc/71 在 rating-bar.css 中新增的两条多余规则（`.review-buttons
.rating-star/form/.field` + `div:nth-child(1)` 选择器），改为正确隐藏
`DetailMenuButtons` 的状态行。

### 实际需求

`DetailMenuButtons` 组件（`createMenuBtn` 注入到 `.tabs` 后方）包含两行：
- **左行**：屏蔽(#filterBtn) + 收藏(#favoriteBtn) + 已观看(#hasWatchBtn)
  → 已被快捷评分条（星星+已读+收藏）完全覆盖，拉黑待第二步移入评分条
- **右行**：磁力过滤 + 字幕(迅雷) + 字幕(SubTitleCat)
  → 独立功能，必须保留

需隐藏左行（三个状态按钮），保留右行（工具按钮）。

## 方案

### 隐藏而非去掉

用 CSS `display:none` 隐藏左行，保留 DOM。原因：
- `createMenuBtn` 绑定了 `#filterBtn`/`#favoriteBtn`/`#hasWatchBtn` 的 click 事件
- `showStatus` 会更新这三个按钮的文案
- 快捷键（filterHotKey/favoriteHotKey/hasWatchHotKey）绑定在 `bindHotkey` 中
  通过模拟这些按钮的 click 实现
- 隐藏后这些事件绑定和文案更新仍正常运行（只是看不见），不影响快捷键功能

### 实现

给 `DetailMenuButtons` 组件的左行加 `className="jhs-menu-status-row"`，右行加
`className="jhs-menu-tools-row"`，在 rating-bar.css 中隐藏左行。

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/styles/rating-bar.css` | 撤回 doc/71 新增的两条多余规则；新增隐藏 `.jhs-menu-status-row` |
| `src/components/detail-menu-buttons.tsx` | 左行 div 加 `className="jhs-menu-status-row"`，右行加 `className="jhs-menu-tools-row"` |
| `vite.config.ts` | version 1.8.2 → 1.8.3 |

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 214 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,852.12 kB │ gzip: 423.82 kB
✓ built in 1.14s
```

- `tsc -b` 通过
- `vite build` 通过
- 产物 1852.12 kB（gzip 423.82 kB），较 doc/71 基线 1852.39 kB -0.27 kB（撤回多余 CSS）

### 版本号

`vite.config.ts` version `1.8.2` → `1.8.3`（修正 + UI 隐藏，patch 递增）

## 后续验证建议

1. 打开 javdb 详情页 → 屏蔽/收藏/已观看三个按钮应不可见
2. 磁力过滤 + 字幕按钮应正常显示
3. 快捷评分条（★ + 已读 + 收藏）应正常显示
4. 快捷键（屏蔽 E / 收藏 D / 已观看 W）仍能正常工作（事件绑定在隐藏的 DOM 上）
5. 确认隐藏后右行按钮无位置偏移

## 第二步预告

确认隐藏效果后，将在快捷评分面板新增「🚫 拉黑」按钮。
