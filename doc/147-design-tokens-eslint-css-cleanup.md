# doc/147 — 设计令牌 + ESLint 工具链 + CSS transition:all 清理

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 5（UI/UX V2）和批次 6（体积/类型/工具链）的基础项目。
本轮建立设计令牌词汇表、代码一致性工具链、清理 CSS 反模式。

## 方案

### 1. 设计令牌（src/styles/design-tokens.css）

`:root` 定义 CSS 自定义属性，令牌值与项目实际调色板一致：

| 类别 | 令牌 | 值 |
|------|------|-----|
| 主色 | `--jhs-color-primary` | `#5d87c2`（14 处硬编码的实际主色） |
| 语义色 | success/warning/error/info | `#64bb69`/`#d7a80c`/`#de3333`/`#25b1dc` |
| 中性色 | text/border/bg | `#363636`/`#e2e8f0`/`#fff` 等 |
| 间距 | xs→2xl | 4px→24px |
| 圆角 | sm→full | 4px→9999px |
| z-index | dropdown→tooltip | 100→600（统一管理，避免超大 z-index） |
| 过渡 | fast/normal | 150ms/250ms ease |
| 触控 | touch-target | 44px |

**令牌一致性说明**：令牌值取自实际硬编码调色板（`#5d87c2` 为 14 处使用的主色）。
rating-bar.css 的 `--jhs-list-*` 命名空间使用 Bulma 默认蓝 `#3273dc`（4 处），
是独立的列表强调色，与主色不同。硬编码值迁移到令牌是增量后续工作。

main.tsx 在所有其他 CSS 之前注入（令牌对全局可用）。

### 2. ESLint 工具链

`eslint.config.js`（flat config）：
- `@eslint/js` recommended + `typescript-eslint` recommended
- `@typescript-eslint/no-explicit-any: warn`（禁止新增 any，存量 warn）
- `consistent-type-imports`（强制 `import type`）
- `no-unused-vars`（忽略 `_` 前缀）
- 忽略 dist/archetype/node_modules

`package.json` 新增 `"lint": "eslint src/"` 脚本。
依赖：`eslint` + `@eslint/js` + `typescript-eslint`。

**基线**：首次运行 `bun run lint` 输出 852 problems（78 errors, 774 warnings），
主要为 `no-explicit-any` 存量警告（774 处）和 `no-unused-vars` 错误（78 处）。
后续逐步消除存量 any，新增代码不允许引入 any。

### 3. CSS `transition: all` 清理

12 个 CSS 文件中 19 处 `transition: all` 替换为具体过渡属性：

| 文件 | 处数 | 替换为 |
|------|------|--------|
| a-normal-buttons.css | 1 | background-color |
| back-to-top-button.css | 1 | opacity/visibility/transform/bg/color/shadow/border |
| common-toolbar.css | 1 | transform/box-shadow/opacity |
| list-reading-status-plugin.css | 3 | color/bg/border 组合 |
| list-waterfall-plugin.css | 1 | opacity/visibility/transform/bg/color/shadow/border |
| logger.css | 2 | background-color / bg/color/border |
| new-video-plugin.css | 1 | box-shadow/transform/bg |
| preload-status-badge.css | 1 | color/bg/border |
| rating-bar.css | 1 | color/bg/border/box-shadow |
| setting-plugin.css | 4 | box-shadow/transform/opacity 组合 |
| status-tag-filter-plugin.css | 1 | color/bg/border |
| visit-history-tooltip.css | 1 | opacity/transform |

保留原有 duration 和 timing-function，仅替换属性列表。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/styles/design-tokens.css` | 新建 |
| `src/main.tsx` | 修改：import + injectCss（最先注入） |
| `eslint.config.js` | 新建 |
| `package.json` | 修改：lint 脚本 + 3 个 devDependencies |
| 12 个 `src/styles/*.css` | 修改：19 处 transition:all 替换 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,021.86 kB │ gzip: 466.81 kB
✓ built in 1.23s

$ bun run lint
✖ 806 problems (0 errors, 806 warnings)

$ grep -c "transition:\s*all" src/styles/*.css
remaining transition:all: 0
```

tsc 零错误。ESLint 0 errors（`prefer-const`/`no-useless-escape` 保持 error 门禁，
存量 15 处已手动修复）。806 warnings 主要为 `no-explicit-any` 存量（后续逐步消除）。
`transition: all` 归零。
