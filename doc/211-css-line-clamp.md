# 211 - 修复 CSS line-clamp 兼容性警告

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

诊断报告两条 warning：

1. `rating-bar.css` 的 `.jhs-list-item__name` 用了 `-webkit-line-clamp: 2` 但缺标准
   `line-clamp` 属性 → 兼容性警告「Also define the standard property 'line-clamp'」。
2. `archetype/modMyListOpenWay.user.js` 的「File ignored because of a matching ignore pattern」。

## 2. 方案

- **CSS 警告（修复）**：`.jhs-list-item__name` 在 `-webkit-line-clamp: 2` 后补标准
  `line-clamp: 2`（前缀属性 + 标准属性并存，兼容现代浏览器）。
- **archetype 警告（无需处理）**：`archetype/` 为只读参考脚本，在 ESLint 全局 `ignores`
  （`eslint.config.js`）中。「File ignored」是 ESLint 对**被忽略文件**的预期提示，仅在编辑器
  对打开的忽略文件时显示；`bun run lint` 只扫 `src/`，不涉及 archetype，不产生此提示。属预期
  行为，不改代码。

## 3. 实施

| 文件 | 改动 |
|---|---|
| `src/styles/rating-bar.css` | `.jhs-list-item__name` 补 `line-clamp: 2` |

## 4. 执行验证记录

```
$ bunx stylelint src/styles/rating-bar.css   # 通过（无警告）
$ bun run build      # tsc -b 零错误，✓ built
```

版本 1.36.0→1.36.1（CSS 兼容性修复，patch）。
