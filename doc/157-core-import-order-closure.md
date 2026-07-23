# doc/157 — core 目录导入顺序闭合审计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

第三至五轮（doc/153–156）覆盖了 plugins（39 文件）、components（34 文件）、
main.tsx 的三维一致性审计（console / show.error / 导入顺序），并将约定固化为
AGENTS.md §9。唯一未系统审计的目录类是 `src/core/`（28 个模块文件）。
本轮闭合此缺口。

## 审计结果

| 维度 | 结果 |
|------|------|
| `console.*`（非 excepted 文件） | **0**（storage-manager / gm-http / webdav 等全部使用 clog.*/show.*） |
| CSS?raw 导入 | 2 文件违规（image-preview.tsx / tooltip.ts 将 CSS?raw 置于首位） |
| 导入顺序（其余 26 文件） | **全合规** |
| `src/constants/` | **0** console，无导入违规（仅导出常量） |
| `src/types/` | **0** console，无导入违规（仅 .d.ts 声明） |

## 修复

| 文件 | 操作 |
|------|------|
| `src/core/image-preview.tsx` | 导入重排：CSS?raw 从 L24 移至末位（core sibling → components → CSS?raw） |
| `src/core/tooltip.ts` | 导入重排：CSS?raw 从 L14 移至末位（core sibling → CSS?raw） |

## 全树一致性审计闭合状态

| 目录 | 文件数 | console | show.error | 导入 | CSS 类名 | z-index |
|------|--------|---------|------------|------|----------|---------|
| `src/core/` | 28 | ✅ | ✅ | ✅ (本轮) | N/A | N/A |
| `src/plugins/` | 40 | ✅ (R3+R4) | ✅ (R3+R4) | ✅ (R3+R4) | ✅ (R3) | ✅ (R3) |
| `src/components/` | 34 | ✅ (R5) | ✅ (R5) | ✅ (R5) | N/A | N/A |
| `src/main.tsx` | 1 | N/A | N/A | ✅ (R4) | N/A | N/A |
| `src/constants/` | 3 | ✅ (本轮) | N/A | N/A | N/A | N/A |
| `src/types/` | 1 | ✅ (本轮) | N/A | N/A | N/A | N/A |
| `src/styles/` | 34 | N/A | N/A | N/A | ✅ (R3) | ✅ (R3) |

**全树六维一致性审计闭合。** 约定已固化于 AGENTS.md §9，后续 agent 自动遵守。

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.20s
```

tsc 零错误。产物大小不变（仅导入行序变更）。
