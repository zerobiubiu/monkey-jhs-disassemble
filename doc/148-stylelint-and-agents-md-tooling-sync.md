# doc/148 — Stylelint 工具链 + AGENTS.md 工具链同步

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 6（体积/类型/工具链）的 CSS 一致性工具。doc/147 已建立 ESLint
（TypeScript 一致性），本轮补充 Stylelint（CSS 一致性），并同步
AGENTS.md 中 doc/143-147 新增的工具链和样式信息。

## 方案

### 1. Stylelint 工具链

`.stylelintrc.json`（stylelint-config-standard 基础）：
- 禁用与项目风格冲突的规则（selector-class-pattern、custom-property-pattern、
  no-descending-specificity、vendor-prefix 相关等）
- 排除 dist/archetype/node_modules（layer-fix.css 已验证 lint 干净，无需排除）

`package.json` 新增 `"lint:css": "stylelint \"src/styles/**/*.css\""` 脚本。
依赖：`stylelint` + `stylelint-config-standard`。

**自动修复**：`stylelint --fix` 修复 442 处：
- `rgba(r,g,b,a)` → `rgb(r,g,b,a)`（CSS Color Level 4 语法，渲染完全一致）
- 规则间空行格式化
- 无语义变更（已逐条验证 diff）

**基线**：0 errors（3 处不可自动修复的 deprecated 规则已禁用）。

### 2. AGENTS.md 工具链同步

| 节 | 变更 |
|----|------|
| §3.1 | CSS 注入枚举补充 `design-tokens`（最先注入） |
| §3.6 | 补充 design-tokens/accessibility 注入说明 + transition:all 清理记录 |
| §3.7 | 补充 GM API 类型化说明（GMXmlHttpRequestDetails 接口） |
| §3.8 | **新增**工具链节（build/lint/lint:css 三重门禁） |
| §3.9 | 原 §3.8 PRODUCT.md 重编号 |

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `.stylelintrc.json` | 新建 |
| `package.json` | 修改：lint:css 脚本 + 2 个 devDependencies |
| `AGENTS.md` | 修改：§3.1/§3.6/§3.7/§3.8/§3.9 |
| 28 个 `src/styles/*.css` | 修改：stylelint --fix 自动修复 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,022.45 kB │ gzip: 466.86 kB
✓ built in 1.19s

$ bun run lint
✖ 806 problems (0 errors, 806 warnings)

$ bun run lint:css
(no output — 0 errors)
```

三重门禁全绿：tsc ✅ · ESLint 0 errors ✅ · Stylelint 0 errors ✅
