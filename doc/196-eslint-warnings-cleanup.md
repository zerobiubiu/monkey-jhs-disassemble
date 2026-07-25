# doc/196 — 消除全部 ESLint 警告（764 → 0）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

项目 ESLint 基线为 0 errors / 764 warnings（AGENTS.md §3.8）。
本次将全部警告清零，提升工程质量。

## 2. 修改分类

| 类别 | 数量 | 修法 |
|------|-----:|------|
| 第三方库 `any`（globals.d.ts / shim） | ~25 | 文件级 `eslint-disable @typescript-eslint/no-explicit-any` |
| `import()` 类型注解（globals.d.ts） | 6 | 行内 `eslint-disable consistent-type-imports` |
| `no-useless-assignment`（死初始值） | 8 | `let x = init` → `let x: Type` |
| 空 `catch {}` | 5 | 补 `/* ignore */` 注释 |
| `preserve-caught-error`（ES2020 限制） | 5 | 行内 eslint-disable + 原因注释 |
| 未使用 eslint-disable 指令 | 2 | 移到正确位置或删除 |
| 表达式语句 | 3 | `void expr` 或改为 if/const |
| 无用 try/catch | 1 | 删除包装 |
| `hasOwnProperty` 直接调用 | 1 | 改 `Object.prototype.hasOwnProperty.call()` |
| 仅类型导入 | 1 | `import` → `import type` |
| 未使用类型参数 | 1 | `T` → `_T` |
| 冗余 ignores 模式 | 1 | eslint.config.js 删除 `*.config.*` |

## 3. 修改文件清单（20 个）

`src/types/globals.d.ts`、`src/types/jquery-shim.d.ts`、`src/types/layui-layer-shim.d.ts`、
`src/main.tsx`、`src/core/logger.tsx`、`src/core/gm-http.ts`、`src/core/storage-manager.ts`、
`src/core/storage/car-list-ops.ts`、`src/core/image-preview.tsx`、`src/core/util/util-sort.ts`、
`src/plugins/history-plugin.tsx`、`src/plugins/detail-page-button/dpb-want-watched.ts`、
`src/plugins/detail-page-button/dpb-subtitle.tsx`、`src/plugins/actress-info-plugin.tsx`、
`src/plugins/history/history-tabulator.tsx`、`src/plugins/list-reading-status/lrs-sort.ts`、
`src/plugins/list-page/lp-filter.tsx`、`src/plugins/preview-video/dmm-resolver.tsx`、
`src/plugins/video-lists-tag/vlt-list-mgmt.ts`、`src/plugins/video-lists-tag/vlt-create-list-api.ts`、
`eslint.config.js`

## 4. 执行验证

- `diagnostics`（Zed TS + ESLint）：**No errors or warnings found in the project** ✅
- 所有修改为纯 lint 层面，零业务逻辑变更
