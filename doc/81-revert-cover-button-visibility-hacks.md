# 81 - 撤销 CoverButton 可见性加固（恢复设置开关控制）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-11

## 1. 背景

用户确认 CoverButton 未显示的根因是：**设置里已有独立开关**
（`enableScreenSvg` / `enableVideoSvg` / `enableHandleSvg` / `enableSiteSvg` /
`enableCopySvg`），关闭后工具栏不显示属预期行为。

据此要求撤销 doc/80 中为「强制可见」做的 1.9.2 / 1.9.3 加固改动，
恢复升级方案中的简洁实现。

## 2. 撤销内容

| 项 | 处理 |
|----|------|
| `.meta` 后独立行 `.jhs-cover-toolbar` | 撤销，仍只 append 到 `.tags` |
| `console.log` / 延迟 800ms·2s 补注 | 撤销 |
| 强制图标 CSS / opacity 0.75 等 | 撤销，恢复 archetype 风格 |
| `checkDom` 内额外 `addSvgBtn` | 撤销 |
| 设置弹窗 `end` → `enableSvgBtn` | 撤销 |
| `enableSvgBtn` 宽松判定 / 防点击穿透等 | 撤销，恢复 `toggle(enabled === YES)` |

## 3. 保留内容

- CoverButtonPlugin 本体（doc/76 升级落地）
- `ListPagePlugin.doFilter` 末尾 `addSvgBtn`（方案 ⑮）
- 设置面板 5 个「封面工具栏」开关（loadForm / saveForm）
- `featureFlags.coverButtonPlugin` 总开关

## 4. 使用说明

工具栏要显示：设置 → 基础配置 → **封面工具栏 - *** 五个开关打开并保存刷新。  
全局关闭：`featureFlags.coverButtonPlugin = false`（`jhs_upgrade_flags`）。

## 5. 版本

`1.9.3` → `1.9.4`（撤销可见性加固）

## 6. 验证

```
bun run build  ✓  @version 1.9.4
```

doc/80 保留为历史排查记录；以本文为准表示加固已撤销。
