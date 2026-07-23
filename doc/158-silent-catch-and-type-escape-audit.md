# doc/158 — 静默 catch 与类型安全逃逸审计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

第三至六轮（doc/153–157）闭合了六维一致性审计（console / show.error / 导入 /
CSS 类名 / z-index / devtools 跟踪）。本轮补充审计三个**结构正确性**维度：
静默 catch 块（错误吞没）、TypeScript 类型逃逸（@ts-ignore / @ts-expect-error）、
ESLint 抑制（eslint-disable / eslint-disable-next-line）。

## 审计结果

| 维度 | 全树结果 | 说明 |
|------|----------|------|
| 空 catch 块（`catch {}`） | **17**（全部有意） | 三通道广播（GM/localStorage/CustomEvent）的 best-effort 内层 catch，外层已有 `clog.error`；vlt-db 事务 abort 后 re-throw 的清理 catch。均非错误吞没——外层保证可观测性 |
| `@ts-ignore` | **0** | 全树无使用 |
| `@ts-expect-error` | **0** | 全树无使用 |
| block-level `eslint-disable` | **0** | 无文件级/块级抑制 |
| `eslint-disable-next-line` | **7** | 全部为 `@typescript-eslint/no-explicit-any`（已知 backlog） |

### eslint-disable-next-line 明细

| 文件 | 行 | 抑制规则 |
|------|-----|----------|
| `src/core/logger.tsx` | 262, 341, 350, 360, 369 | no-explicit-any（日志器泛型参数） |
| `src/components/hit-show-movie-item.tsx` | 34 | no-explicit-any |
| `src/components/preview-video-quality-btn.tsx` | 25 | no-explicit-any |

这 7 处是 805 个 `no-explicit-any` 警告中**唯一被显式抑制**的——其余 798 个以
warning 形式存在，未被抑制。它们属于路线图「805 any 消除」多会话工作，本轮不触碰。

## 全树结构正确性审计闭合状态

| 维度 | 轮次 | 状态 |
|------|------|------|
| console→clog 错误统一 | R3+R4 | ✅ |
| show.error instanceof 守卫 | R3+R4 | ✅ |
| 导入六组顺序 | R3+R4+R5+R6 | ✅ |
| CSS 类名前缀 | R3 | ✅ |
| z-index 令牌 | R3 | ✅ |
| devtools 跟踪保留 | R4 | ✅ |
| 静默 catch 块 | **R7** | ✅ |
| @ts-ignore / @ts-expect-error | **R7** | ✅ |
| eslint-disable 抑制 | **R7** | ✅ |

**九维结构正确性审计闭合。**

## 版本号决策

本轮**无 src/ 变更**（全树审计清洁）。按 §6.1.1「纯文档修改不递增版本号」，
**不递增版本号**，**不写 CHANGELOG 条目**。

## 实施

| 文件 | 操作 |
|------|------|
| `doc/README.md` | 修改：阅读顺序追加 doc/158 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.21s
```

tsc 零错误。产物大小不变。`@version` 仍为 1.28.3（未递增）。
