# 212 - 修复 scripts/check-structure.ts 编辑器类型报错

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

诊断报告 `scripts/check-structure.ts` 7 个 error：`node:fs`/`node:path`/`process` 找不到
（缺 Node 类型）+ `entries.filter((e) => …)` 的 `e` 隐式 any。根因：`scripts/` 目录未被任何
带 Node 类型的 tsconfig 覆盖（`tsconfig.node.json` 只含 `vite.config.ts`，且项目未装
`@types/node`），编辑器 TS 语言服务无法解析 Node API。运行时 `bun run check:structure`
（bun 直接跑 TS）不受影响。

另有 `archetype/*.user.js` 4 条「File ignored because of a matching ignore pattern」——
`archetype/` 为只读参考脚本，在 ESLint 全局 `ignores` 中，属**预期提示**（仅编辑器对打开的
忽略文件显示，`bun run lint` 只扫 `src/` 不涉及），无需处理。

## 2. 方案

- 安装 `@types/node`（devDependency）。
- 新增独立 `scripts/tsconfig.json`（`types: ["node"]`，含 `strict`/`noUnusedLocals` 等），
  **不被根 `tsconfig.json` 引用**，故**不接入 `tsc -b` 构建**（保持 check-structure「不接入
  build」的设计），仅供编辑器 TS 语言服务解析 `scripts/`。
- **不污染 src/**：`tsconfig.app.json` 已有 `"types": ["react"]`（仅自动引入 react 全局类型），
  装 `@types/node` 不会被 src/ 自动引入；jquery/layui-layer 走本地 shim、blueimp-md5 走模块
  解析，均不受影响。

## 3. 实施

| 文件 | 改动 |
|---|---|
| `package.json` / `bun.lock` | devDependencies 增 `@types/node` |
| `scripts/tsconfig.json` | **新增** 独立 tsconfig（`types: ["node"]`，不被根 tsconfig 引用） |

非 `src/` 改动，按 §6.1.1 **不递增 userscript 版本**。

## 4. 执行验证记录

```
$ bunx tsc -p scripts/tsconfig.json --noEmit   # check-structure.ts 类型检查通过
$ bun run build      # tsc -b && vite build 通过（src/ 未受 @types/node 影响）
$ bun run lint       # 0 errors / 0 warnings
$ bun run test       # 111 passed
```

编辑器中 `scripts/check-structure.ts` 的 7 个 error 消除；`archetype/*.user.js` 的「文件被
忽略」为预期提示，保留。
