# 91 - 修复关键词标签 × 乱码为 脳

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

设置「视频标题屏蔽词」标签右侧删除钮显示为 `脳` 而非 `×`。

## 根因

doc/90 用 PowerShell `Out-File` 从 git 恢复 `keyword-label.tsx` 时 UTF-8 损坏，
`×`（U+00D7）被错误解码为 `脳`。

## 修复

重写 `src/components/keyword-label.tsx`，删除钮使用 `'\u00d7'`（×）。

## 验证

```
bun run build
children: "\u00d7"  # dist 中为 UTF-8 C3 97（×）
version 1.12.1 → 1.12.2
```
