# 65. 修复详情页清单面板「预设清单」过滤失效

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

视频详情页的清单平铺面板（`.jhs-list-panel`）本应过滤掉「預設清單」
（只对自己可见的默认清单），但该清单仍然显示在面板中。

### 根因

doc/59 执行了全局繁→简字符替换（21 个文件），将代码中的
`預設清單`（繁体）改为了 `预设清单`（简体）。但 JavDB 服务端
返回的 DOM 文本仍然是**繁体** `預設清單`。

实测确认：
- `listContainer` 第 12 个子元素文本：`預設清單`（繁体）
- `hasTraditional: true`，`hasSimplified: false`
- 代码 `child.textContent.includes('预设清单')`（简体）→ **不匹配**
- 过滤失败，`預設清單` 被克隆到 `.jhs-list-panel`

## 方案

将 `includes('预设清单')` 改为正则 `/预[设設]清[单單]/`，
同时匹配简体（`预设清单`）和繁体（`預設清單`）。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/detail-page-button-plugin.tsx` | `_initListPanel` sync 函数：`includes('预设清单')` → `/预[设設]清[单單]/.test()` |
| `src/plugins/video-lists-tag/vlt-sync.ts` | `refreshListPanel`：同上 |
| `vite.config.ts` | 版本 1.7.3 → 1.7.4 |

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.14s
dist/monkey-jhs-disassemble.user.js  1,842.87 kB │ gzip: 421.69 kB
```

### DOM 实测

- `listContainer` 12 个子元素，第 12 个文本含 `預設清單`（繁体）
- `.jhs-list-panel` 修复前：12 条（含預設清單）
- `.jhs-list-panel` 修复后：应显示 11 条（預設清單被过滤）
