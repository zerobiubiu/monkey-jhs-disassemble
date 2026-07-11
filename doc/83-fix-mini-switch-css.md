# 83 - 修复设置面板开关按钮 CSS

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

设置面板（SettingDialog）与悬浮简化设置（SimpleSettingPanel）中的
`.mini-switch` 开关全部显示异常：不再是 40×20 圆角滑块，而是被压扁或变成
16×16 小方块，开关滑块 `::before` 圆点错位。

根因来自 doc/70 设置面板 UI 美化时新增/改写的选择器与 `.mini-switch` 冲突：

| 冲突规则 | 特异性 | 破坏效果 |
|---------|--------|---------|
| `.form-content * { width:100%; padding:5px 8px; box-sizing:border-box }` | (0,1,0) | 与 `.mini-switch` 同级；`box-sizing:border-box` + padding 把 40×20 内容区压扁 |
| `.content-panel input[type='checkbox'] { width:16px; height:16px }` | (0,2,1) | 高于 `.mini-switch` (0,1,0)，强制 16×16，开关样式失效 |

原版 archetype 中 `.form-content *` **无** `box-sizing:border-box`，也 **无**
`.content-panel input[type='checkbox']` 规则，故原版开关正常。

## 方案

1. `.form-content *` 改为 `.form-content > *:not(.mini-switch):not(br)`，
   不再给开关/换行施加 width/padding/box-sizing
2. `.content-panel input[type='checkbox']` 加 `:not(.mini-switch)`，只美化普通复选框
3. 开关选择器升级为 `input.mini-switch[type='checkbox']`（特异性 (0,2,1)），
   显式 `padding:0; margin:0; min/max-width:40px; flex-shrink:0`，
   防止其它表单规则再覆盖

## 实施

| 文件 | 变更 |
|------|------|
| `src/styles/setting-plugin.css` | 排除冲突 + 强化 mini-switch 规则 |
| `vite.config.ts` | version 1.10.0 → 1.10.1 |

## 执行验证记录

```
bun run build  # tsc -b && vite build
✓ built in 1.17s
dist/monkey-jhs-disassemble.user.js  1,906.37 kB │ gzip: 437.60 kB
```

（layer.css IE hack 的 lightningcss 警告为既有容错，与本次无关）

## 后续验证建议

1. 打开设置弹窗 → 基础配置：鉴定补录演员信息 / 高亮已收藏演员 等开关应为
   灰/绿圆角滑块，点击滑块圆点左右滑动
2. 悬浮简化设置：屏蔽单番号/演员/关键词等一排开关尺寸正常、不占满整行
3. 普通 checkbox（如备份面板若有）仍为 16×16 + accent-color 主色
