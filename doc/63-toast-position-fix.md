# 63. 修复 toast 通知被导航栏遮挡

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

清单删除/改名操作的 toast 通知（`#jdb-toast-container`）被 JavDB 固定
导航栏（`.main-nav.is-fixed-top`，高 56px，`z-index: 12345679`）遮挡。

toast 容器原 `top: 20px`，位于导航栏覆盖区域（0-56px）内，导致通知
内容被导航栏盖住不可见。

### 根因

`src/styles/video-lists-tag.css` 的 `#jdb-toast-container` 设置
`top: 20px`，未考虑 JavDB 全站固定导航栏的高度（56px）。

## 方案

将 `top` 从 `20px` 改为 `72px`（56px 导航栏 + 16px 间距），确保
toast 在导航栏下方显示。

`z-index: 99999` 本身高于导航栏的 `12345679`，无需调整。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/styles/video-lists-tag.css` | `#jdb-toast-container` 的 `top: 20px` → `top: 72px` |
| `vite.config.ts` | 版本 1.7.1 → 1.7.2（CSS 修复，patch 递增） |

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.24s
dist/monkey-jhs-disassemble.user.js  1,842.98 kB │ gzip: 421.58 kB
```

### 导航栏实测

- 导航栏 `.main-nav.is-fixed-top`：高 56px，`position: fixed`，`z-index: 12345679`
- `html.has-navbar-fixed-top`：`padding-top: 52px`
- toast 容器 `top: 72px` > 导航栏 56px → 不再被遮挡 ✅
