# 70 - 设置面板 UI 美化

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/69 新增自动备份功能后，数据备份面板内容增多，但整体 UI 较为粗糙：
侧栏背景过于朴素、按钮无 hover 效果、表单输入框过窄且居中对齐、缺少分区
层次感。需系统美化设置面板。

## 方案

### 美化要点

| 区域 | 问题 | 优化 |
|------|------|------|
| 侧栏 | `#f5f5f5` 朴素、active `#e0e0e0` 对比度低 | 改 `#fbfcfd` 柔和背景、active 用主色 `#5d87c2` 半透明高亮 |
| 侧栏菜单项 | 文字 `#333` 纯黑、hover `#e9e9e9` | 文字改 `#64748b` 柔和灰、hover 主色半透明 + 文字变主色 |
| 按钮（menu-btn） | 无 CSS 定义，仅内联 backgroundColor，无圆角/hover/过渡 | 统一 `border-radius:6px` + hover 上浮 + `box-shadow` + `color:#fff` |
| 表单输入框 | `max-width:160px` 过窄、`text-align:center` 居中 | 改 `max-width:220px` + 左对齐 + `border-radius:6px` + focus 主色光晕 |
| 复选框 | 原生默认蓝色 | `accent-color:#5d87c2` 统一主色 |
| 设置项 | `margin-bottom:3px` 紧凑、无 hover 反馈 | `margin-bottom:8px` + `padding:6px 8px` + hover 主色半透明背景 |
| 底部按钮区 | `borderTop:#eee` + 纯白背景 | 改 `#e2e8f0` + `#fbfcfd` + flex 布局 + gap 间距 |
| 自动备份区域 | hr 分隔线无标题 | 改主色分区标题「⏰ 自动备份」+ 说明文案 |
| 配色 | 各种硬编码 backgroundColor | 统一主色 `#5d87c2`（与 WebDav 按钮一致） |

### 配色体系

统一以 `#5d87c2`（WebDav 查看备份按钮的蓝色）为主色，贯穿：
- 侧栏 active 高亮（`rgba(93,135,194,0.12)`）
- 侧栏 hover（`rgba(93,135,194,0.08)`）
- 输入框 focus 光晕（`rgba(93,135,194,0.15)`）
- 复选框 accent-color
- 自动备份分区标题
- 设置项 hover 背景

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/styles/setting-plugin.css` | 重写：侧栏/按钮/表单/复选框/设置项/底部按钮全部美化，新增 `.menu-btn` 统一样式 |
| `src/components/setting-dialog.tsx` | 侧栏背景 `#f5f5f5`→`#fbfcfd`；备份面板按钮加 emoji + flex gap；自动备份区域 hr 改分区标题；底部按钮区 flex + gap + `#fbfcfd`；凭证 ID 字号 12→11px 颜色 `#94a3b8` |
| `vite.config.ts` | version 1.8.0 → 1.8.1 |

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 214 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,851.72 kB │ gzip: 423.63 kB
✓ built in 1.13s
```

- `tsc -b` 通过
- `vite build` 通过
- diagnostics：setting-dialog.tsx / setting-plugin.css 均无 errors/warnings

### 版本号

`vite.config.ts` version `1.8.0` → `1.8.1`（UI 美化，patch 递增）

## 后续验证建议

1. 打开设置弹窗 → 侧栏应柔和灰底，active 项主色蓝高亮
2. 悬停侧栏菜单项 → 文字变主色蓝 + 背景半透明
3. 数据备份面板 → 按钮 hover 上浮 + 阴影
4. 输入框 focus → 主色蓝边框 + 光晕
5. 复选框 → 主色蓝 accent
6. 自动备份区域 → 主色蓝分区标题「⏰ 自动备份」
7. 底部按钮区 → flex 布局 + gap 间距 + 柔和背景
