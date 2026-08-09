# 240 - 项目依赖升级至最新版

> 文档类型：🔧开发指导
> 文档状态：✅已执行
> 影响范围：构建工具链（package.json devDependencies + react）
> 前置文档：239-library-cdn-require.md
> 替代文档：无
> 生效版本：1.46.0（不升版本号，依赖升级不改变用户脚本逻辑）

## 1. 背景

用户要求将项目依赖升级至最新版（2026-08-09 时点）。

## 2. 方案

### 2.1 升级清单（工具链，本批执行）

| 包 | 旧版本 | 新版本 | 说明 |
|----|--------|--------|------|
| vite | ^8.0.11 | ^8.2.1 | minor |
| vite-plugin-monkey | ^8.0.0 | ^8.1.0 | minor |
| @vitejs/plugin-react | ^6.0.3 | ^6.0.5 | patch |
| react | ^19.2.6 | ^19.2.8 | patch（dependency） |
| eslint | ^10.7.0 | ^10.8.1 | patch |
| typescript-eslint | ^8.65.0 | ^8.66.0 | patch |
| jsdom | ^29.1.1 | ^30.0.1 | major（仅测试环境） |
| @types/node | ^26.1.1 | ^26.2.0 | patch |
| @types/react | ^19.2.14 | ^19.2.18 | patch |

### 2.2 保持锁定（运行时 CDN 库，不升级）

7 个运行时库的 npm 版本与 `vite.config.ts` `externalGlobals` 的 CDN @require URL
严格同步（doc/239 架构），升级即改运行时行为、违背「与原始脚本零偏差」原则：

- **blueimp-md5 / layui-layer / localforage / toastify-js**：本已是 latest，无需动
- **jquery 3.7.1 → 4.0.0**（major）：jQuery 4 移除大量废弃 API，全项目未类型化
  `$` 调用 + 全部集成脚本均按 3.x 行为编写，升级风险高且 CDN URL 需同步
- **tabulator-tables 6.3.1 → 6.5.2 / viewerjs 1.11.1 → 1.11.8**（minor）：CDN URL
  需同步，改运行时行为

### 2.3 typescript 7.0.2 尝试后回退

- 尝试过 `typescript@^7.0.2`（native 编译器），`tsc -b` 构建通过；
- **但 typescript-eslint 8.66.0 硬性拒绝 TS 7.0**（`typescript-eslint does not
  support TS 7.0`，追踪 issue #10940，支持需等 TS ≥7.1），lint 门禁失败；
- 回退至 `typescript@^6.0.3`。待 typescript-eslint 支持后另行升级。

## 3. 实施

- `package.json`：按 §2.1 更新版本；`bun add` / `bun add -d` + `bun install` 更新
  `bun.lock` 与 node_modules。
- 其余文件零改动（不触碰 src/，不升 userscript.version 1.46.0）。

## 4. 执行验证记录

### 4.1 执行环境

Windows，Bun 1.x，Vite 8.2.1，TypeScript 6.0.3，vite-plugin-monkey 8.1.0。

### 4.2 验证命令与实际输出

| 命令 | 结果 |
|------|------|
| `bun run build`（tsc -b && vite build） | ✅ 通过，产物 1,168.26 kB（gzip 299.73 kB），@require 7 行、Tabulator interop `.default`、@version 1.46.0 均正确 |
| `bun run test`（vitest，jsdom 30） | ✅ 12 文件 177 用例全绿 |
| `bun run lint`（eslint 10.8.1 + typescript-eslint 8.66.0 + TS 6） | ✅ 0 errors |
| `bun run check:structure` | ✅ OK |

### 4.3 验证结论

✅ 工具链依赖升级至最新版，全部门禁通过；运行时 CDN 库保持锁定；TypeScript 7
因 typescript-eslint 不支持回退 6.x。

### 4.4 已知限制

- typescript 7.0 待 typescript-eslint 支持（TS ≥7.1）后再升级。
- jquery 4.0.0 / tabulator 6.5.2 / viewerjs 1.11.8 如需升级，须连同 vite.config.ts
  CDN URL 同步修改并做运行时回归（用户未确认，暂不动）。

## 5. 后续验证建议

- 若用户确认升级 jquery/tabulator/viewer，需同步 CDN URL + Camoufox/真机回归
  Tabulator 表格、layer 弹窗、图片查看器。