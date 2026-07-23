# doc/180 — CSS 筛选芯片共享基础提取（Round 4 CSS 复用）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

Round 4 的 TS/TSX 复用扫描以函数签名/try-catch 形状为锚点，未系统比较 CSS 规则块。导演级 CSS 全文件审查发现 `status-tag-filter-plugin.css` / `video-lists-tag.css` / `preload-status-badge.css` 三个文件的筛选栏+芯片基础样式（bar/label/chips/chip/hover）逐字节相同（~30 声明 × 3 文件），仅类名前缀与 active 配色不同。这是先前扫描方法论的覆盖缺口（TS/TSX 锚点未覆盖 CSS-to-CSS 跨文件重复），非收敛逻辑本身的失败。

## 方案

新建 `src/styles/filter-chip-base.css`，以分组选择器统一 5 个共享规则块（bar/label/chips/chip/hover）；各插件 CSS 仅保留 active 配色与 no-tag/pf-dot 变体。`main.tsx` 顶层 `injectCss` 注入（design-tokens 之后、accessibility 之前）。

## 零偏差处理

stf/vlt 原始芯片为 `display: inline-block`（纯文本内容），preload 为 `display: inline-flex; align-items: center`（含 `.pf-dot` 子元素）。共享基础使用 `inline-block`（匹配 stf/vlt 原始值），preload 自有 CSS 覆盖为 `inline-flex`（通过 initCss 后注入的级联顺序胜出）。三插件渲染与原始逐字节一致。

## 附带修复

`scripts/check-structure.ts` 的 `src/styles` 文件数上限 37→38（新增 `filter-chip-base.css`）。

## 实施清单

| 文件 | 操作 | 行数变化 |
|------|------|----------|
| `filter-chip-base.css` | 新建 | +66 |
| `status-tag-filter-plugin.css` | 删除共享块 | 68→25 |
| `video-lists-tag.css` | 删除共享块 | 474→431 |
| `preload-status-badge.css` | 删除共享块 + 添加 inline-flex 覆盖 | 184→144 |
| `main.tsx` | import + injectCss | +2 行 |
| `scripts/check-structure.ts` | 上限 37→38 | 1 行 |

## 门禁

tsc 0 错 / vitest 28/28 / eslint 0 错（59 warn）/ stylelint 干净 / check:structure OK（332 文件 53 目录）。

## 产物

2395.39 kB（gzip 611.52 kB），较 v1.28.19 略减（CSS 去重）。
