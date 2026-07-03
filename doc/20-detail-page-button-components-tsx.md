# 20 - 详情页按钮组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖。`doc/17`/`18`/`19` 先后将列表页 /
鉴定记录 / 黑名单共 26 个 HTML 字符串组件转为 TSX 原生 React 组件，调用点改
`jsxToString(<Comp {...props} />)`，并合并删除孤立示范 `.tsx`。

`doc/08` 将 DetailPageButton 插件的字幕弹窗提取为 `SubtitleTableDialog` /
`SubtitlePreviewDialog`；`doc/13` 扫描剩余 HTML 时该插件的菜单按钮组 / 评分条 /
清单面板 / 字幕操作列 / 字幕单行亦提取为返回 HTML 字符串的 `.ts` 组件
（`DetailMenuButtons` / `RatingBarHtml` / `ListPanel` / `SubtitleActionCell` /
`SubtitleLine`）。此外 `rating-bar.tsx` 是 JSX 示范（孤立可用，不被 main.tsx
引入，内部用 useState 复现交互），与 `rating-bar-html.ts` 字符串版并存。

本次将上述 7 个组件统一转为 TSX 原生 React 组件（JSX），调用点改用
`jsxToString(<Comp {...props} />)`，并删除孤立示范 `rating-bar.tsx`（其职责
由合并后的 `rating-bar-html.tsx` 正式组件 + 插件 addEventListener 接管）。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `detail-menu-buttons.ts` | `detail-menu-buttons.tsx` | 6 props（filter/favorite/watched 的 text+color）；inline style 含 linear-gradient 渐变背景 |
| `rating-bar-html.ts` | `rating-bar-html.tsx` | 无 props；Fragment 输出 .jhs-stars + .jhs-rating-actions；合并删除示范 `rating-bar.tsx` |
| `list-panel.ts` | `list-panel.tsx` | 无 props；单 `<div class="jhs-list-panel" />` |
| `subtitle-action-cell.ts` | `subtitle-action-cell.tsx` | 无 props；两按钮间 `{" "}` 保空格 |
| `subtitle-line.ts` | `subtitle-line.tsx` | 2 props（paddedNum/line）；`{"\n"}` 保尾部换行 |
| `subtitle-table-dialog.ts` | `subtitle-table-dialog.tsx` | 无 props；外层 overflow 容器 + #xunlei-table-container |
| `subtitle-preview-dialog.ts` | `subtitle-preview-dialog.tsx` | 1 prop（content）；`dangerouslySetInnerHTML={{ __html: content }}` 原始注入 |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 文件 | 改动 |
|------|------|
| `src/plugins/detail-page-button-plugin.ts` → `.tsx` | 加 `import { jsxToString }`；改 7 处：`DetailMenuButtons`(createMenuBtn) / `RatingBarHtml`(_buildRatingBar) / `ListPanel`(_ensureListPanel) / `SubtitleTableDialog`(searchXunLeiSubtitle content) / `SubtitleActionCell`(formatter return) / `SubtitleLine`(previewSubtitle 逐行) / `SubtitlePreviewDialog`(previewSubtitle content) |

> 调用点文件原为 `.ts`，因需写 JSX 语法，重命名为 `.tsx`。`main.tsx` 以
> 无扩展名 `import` 引入该插件，TS bundler 解析自动定位到 `.tsx`。

## 3. 转换规则

1. `class="xxx"` → `className="xxx"`；`id`/`data-*`/`title`/`type` 原样。
2. `style="padding:10px;color:red"` → `style={{ padding: '10px', color: 'red' }}`
   （camelCase；`background-color` → `backgroundColor`、`text-align` → `textAlign`、
   `flex-wrap` → `flexWrap`、`white-space` → `whiteSpace`、`padding-bottom` →
   `paddingBottom`、`font-family` → `fontFamily`）。
3. 渐变背景 `background: linear-gradient(...)` → `{ background: "linear-gradient(...)" }`
   （原样字符串，jsxToString 输出 `background:linear-gradient(...)`）。
4. `on*` 事件：原 HTML 由 jQuery/addEventListener 绑定，JSX 不写。
5. 自闭合 `<div />`（非 void）：jsxToString 输出 `<div ...></div>`（与原空 div 等价）。
6. 动态 `${var}` → `{props.var}`；`data-score=${n}` → `data-score={n}`
   （number，jsxToString 输出 `data-score="n"`）。
7. 多并列节点（RatingBarHtml 两 div、SubtitleActionCell 两 a、SubtitleLine
   span+文本+`\n`）用 Fragment `<>...</>` 包裹。
8. 原始 HTML 注入（SubtitlePreviewDialog 的 content 是预拼接 HTML 字符串）→
   `dangerouslySetInnerHTML={{ __html: content }}`（jsxToString 取 __html 作
   inner HTML 不转义，与原模板 `${content}` 插值一致；doc/19 已为此扩展 jsxToString）。

## 4. 零偏差说明（行为变化）

- **属性间 / 子节点间 `\n` 与缩进丢失**：jsxToString 紧凑输出。原模板中的
  `\n` + 空格缩进（detail-menu-buttons 按钮换行、subtitle-table-dialog 容器
  缩进、subtitle-action-cell 前导/尾部缩进）丢失。对 DOM 构建
  （`.after`/`.before`/`insertAdjacentHTML`/`innerHTML`/layer content）与 CSS
  解析无影响，与示范 `temporary-image-container.tsx` 风格一致。
- **SubtitleActionCell 两按钮间空格**：原 `</a>\n<空格><a>` 折叠为单空格，
  以 `{" "}` 显式保留，与原 HTML 折叠语义一致（inline `<a>` 按钮间一个空格）。
- **SubtitleLine 尾部 `\n`**：以 `{"\n"}` 文本节点保留（jsxToString 不转义
  空白/换行）。该 `\n` 在 SubtitlePreviewDialog 容器 `white-space:pre-wrap`
  下渲染为换行，功能性保留。
- **SubtitleLine 行文本转义**：原模板字符串拼接不转义 `line`；JSX 模式下
  jsxToString 对文本节点转义 `&` `<` `>`。DOM 文本内容一致，且避免字幕正文
  含 HTML 特殊字符时的注入风险（与 doc/17 §4 一致）。
- **style 尾分号丢失**：原 `color:#AAA;` → jsxToString 输出 `color:#AAA`
  （无尾分号），CSS 等价。
- **RatingBarHtml 输出范围**：原返回 `.jhs-stars` + `.jhs-rating-actions` 两
  段拼接（无外层 `.jhs-rating-bar`，外层 div 由插件 createElement 承载）；
  JSX 以 Fragment 包裹两节点，jsxToString 透明拼接 children，输出一致。

## 5. 执行验证记录

### 5.1 类型检查 + 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  495.97 kB │ gzip: 121.68 kB
✓ built in 348ms
```

`tsc -b`（strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports）通过，无类型错误
（`tsc -b --force` 退出码 0 复核）。`vite build` 成功，产物 495.97 kB
（gzip 121.68 kB），较 doc/19 基线 494.26 kB（gzip 121.41 kB）+1.71 kB
（7 组件 JSX runtime 增量，可接受）。

### 5.2 残留引用核查

- `react-dom/server` / `renderToStaticMarkup`：`src/` 内运行时零引用。
- `rating-bar.tsx`（示范）：已删除，`src/` 内零引用（grep `RatingBar` /
  `rating-bar` 仅命中 archetype 文档与 `rating-bar-html` 正式组件）。
- 7 个组件仅被 `detail-page-button-plugin.tsx` 引用（grep 确认无其他调用点）。

### 5.3 提交

- 主题：`详情页按钮组件转 TSX（jsxToString 调用点）`
- 文件：
  - 删除：7 个 `.ts` 组件 + `rating-bar.tsx` 示范 + `detail-page-button-plugin.ts`
  - 新增：7 个 `.tsx` 组件 + `detail-page-button-plugin.tsx`
  - 文档：`doc/20-detail-page-button-components-tsx.md`、`doc/README.md`
- hash：见 `git log -1`

## 6. 相关文件链接

- `src/core/jsx-to-string.ts`（轻量渲染器，doc/16）
- `src/components/temporary-image-container.tsx`（首个试点，doc/16）
- `doc/08-subtitle-dialogs-component.md`（字幕弹窗提取定稿，✅已执行，不改）
- `doc/13-remaining-html-components.md`（菜单/评分/清单/字幕操作列/单行提取定稿，✅已执行，不改）
- `doc/16-jsx-to-string.md`（jsxToString 方案，✅已执行）
- `doc/17-list-page-components-tsx.md` / `doc/18-history-actress-components-tsx.md` /
  `doc/19-blacklist-components-tsx.md`（前三批 .ts→.tsx 转换先例）
