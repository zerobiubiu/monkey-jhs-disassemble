# doc/153 — z-index 统一化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 5（UI/UX V2）项「清理超大 z-index」。

项目中 9 个 CSS 文件使用 5 种不同量级的 z-index（9999~9999999999），
无统一管理。layer.js 的 z-index 无上限递增（每次打开弹窗 +1，mousedown +1），
above-layer 元素需 genuinely large 常量保证始终在弹窗之上。

## 方案

设计令牌新增两个 z-index 层级：

```css
--jhs-z-page: 9999;      /* 页面内元素（back-to-top/load-all/瀑布流按钮/tag 下拉） */
--jhs-z-top: 999999999;  /* above-layer 层（tooltip/loading/logger/fc2/visit-history） */
```

| 文件 | 原值 | 新值 |
|------|------|------|
| auto-page-plugin.css | 9999 | var(--jhs-z-page) |
| back-to-top-button.css | 9999 | var(--jhs-z-page) |
| list-waterfall-plugin.css | 9999 | var(--jhs-z-page) |
| video-lists-tag.css | 99999 | var(--jhs-z-page) |
| fc2-plugin.css | 99999999 | var(--jhs-z-top) |
| loading.css | 99999999 | var(--jhs-z-top) |
| logger.css | 99999999 | var(--jhs-z-top) |
| tooltip.css | 9999999999 | var(--jhs-z-top) |
| visit-history-tooltip.css | 9999999999 | var(--jhs-z-top) |

**不修改**：image-preview.css（`/* __Z_INDEX__ */` 占位符，运行时动态替换）。

## 实施

| 文件 | 操作 |
|------|------|
| `src/styles/design-tokens.css` | 修改：新增 --jhs-z-page/--jhs-z-top |
| 9 个 `src/styles/*.css` | 修改：z-index → var(--jhs-z-page/--jhs-z-top) |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,023.49 kB │ gzip: 467.15 kB
✓ built in 1.22s
```

tsc 零错误。产物 -0.10 kB（CSS 变量引用比硬编码数字短）。
