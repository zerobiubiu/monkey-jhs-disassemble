# 17 - 列表页/折叠分类组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖，产物增量 +3.77 kB。`temporary-
image-container.tsx` 已作为首个试点验证该方案。

`doc/11` 将列表页 5 个 HTML 模板提取为返回 HTML 字符串的 `.ts` 函数组件
（`StatusTagHtml`/`VideoTitleSpan`/`JumpPageControl`/`PageCountTable`/
`MenuButtonBoxHtml`），并保留了 `status-tag.tsx`/`menu-button-box.tsx` 两个
JSX 示范组件（孤立可用，不被引用）。`doc/13` 补充了 `FoldCategoryToolbar`/
`FoldCategorySectionButton`/`HighlightButton` 三个返回 HTML 字符串的 `.ts`。

本次将上述 8 个组件统一转为 TSX 原生 React 组件（JSX），调用点改用
`jsxToString(<Comp {...props} />)`，并删除两个孤立示范 `.tsx`（其职责由
合并后的 `.tsx` 正式组件接管）。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `status-tag-html.ts` | `status-tag-html.tsx` | 合并删除示范 `status-tag.tsx` |
| `menu-button-box-html.ts` | `menu-button-box-html.tsx` | 合并删除示范 `menu-button-box.tsx` |
| `video-title-span.ts` | `video-title-span.tsx` | — |
| `jump-page-control.ts` | `jump-page-control.tsx` | — |
| `page-count-table.ts` | `page-count-table.tsx` | — |
| `fold-category-toolbar.ts` | `fold-category-toolbar.tsx` | — |
| `fold-category-section-button.ts` | `fold-category-section-button.tsx` | — |
| `highlight-button.ts` | `highlight-button.tsx` | — |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 文件 | 改动 |
|------|------|
| `src/plugins/list-page-plugin.tsx` | 加 `import { jsxToString }`；改 5 处：`VideoTitleSpan`(L306) / `StatusTagHtml` render(L373) / `StatusTagHtml` filter(L554) / `PageCountTable`(L585) / `JumpPageControl`(L1081) |
| `src/plugins/list-page-button-plugin.tsx` | 加 `import { jsxToString }`；改 2 处 `MenuButtonBoxHtml`（javdb L135 / javbus L166） |
| `src/plugins/fold-category-plugin.tsx` | 加 `import { jsxToString }`；改 3 处：`HighlightButton`(L113) / `FoldCategoryToolbar`(L172) / `FoldCategorySectionButton`(L177) |

> 调用点文件原为 `.ts`，因需写 JSX 语法，重命名为 `.tsx`。`main.tsx` 以
> 无扩展名 `import` 引入这三个插件，TS bundler 解析自动定位到 `.tsx`。

## 3. 转换规则

1. `class="xxx"` → `className="xxx"`；`data-*`/`id`/`title` 原样。
2. `style="padding:10px;color:red"` → `style={{ padding: '10px', color: 'red' }}`
   （camelCase；`!important` 写入字符串值如 `'10px !important'`；数值如
   `z-index:10` 用 `zIndex: 10`，jsxToString 输出 `z-index:10` 不加 px）。
3. `on*` 事件：原 HTML 由 jQuery 绑定，JSX 不写。
4. 自闭合 `<input>`/`<img>`/`<br>`/`<hr>`/`<i>` 由 jsxToString 按 void
   elements 集合输出 `<tag ... />`（`i` 非 void，输出 `<i></i>`）。
5. 动态 `${var}` → `{props.var}`；条件 `${cond ? a : b}` → `{cond ? <a/> : <b/>}`
   或 `{cond && <a/>}`，多元素用 Fragment `<>...</>`。
6. HTML 注释 `<!-- -->` → `{/* */}`（本批未涉及）。

## 4. 零偏差说明（行为变化）

- **属性间 / 子节点间 `\n` 与缩进丢失**：jsxToString 紧凑输出，属性间单
  空格、子节点直接拼接。原模板中的 `\n` + 空格缩进（如 status-tag 的
  `title=""\n  style=...`、page-count-table 的表格缩进）丢失。对 DOM 构建
  （`.append`/`.wrap`/`.prepend`）与 CSS 解析无影响，与示范
  `temporary-image-container.tsx` 风格一致。
- **`StatusTagHtml` 的 `variant` prop 语义变化**：原 render/filter 两变体
  的差异**仅在于 style 值内的 `\n`/尾空格**（`position:absolute;\n` vs
  `position:absolute; \n`）。转 CSSProperties 对象后两变体输出**完全一致**。
  `variant` 字段保留于接口以维持调用点稳定（不解构，避免 unused 警告），
  函数体不再按 variant 分支。DOM 渲染等价。
- **`page-count-table` 日志紧凑化**：原 `\n` + 缩进使 clog.log 输出多行
  可读表格；转换后变为单行紧凑 HTML。日志可读性略降，功能无影响。
- **文本节点转义**：jsxToString 对文本节点转义 `&` `<` `>`（属性值不
  转义）。原模板字符串拼接不转义。对常规文本（番号/标题/中文）无影响；
  含 `&`/`<`/`>` 的文本会变安全转义，DOM 文本内容一致。
- **`positionStyle` 字符串解析**：`StatusTagHtml` 的 `positionStyle`
  （`"right: 0; top:5px;"` / `"left: 0; top:5px;"`）在组件内按
  `includes("right")` 解析为 `{ right: 0, top: "5px" }` / `{ left: 0, top:
  "5px" }`，jsxToString 还原为 `right:0;top:5px` / `left:0;top:5px`（与
  原值 CSS 等价，仅空白差异）。

## 5. 执行验证记录

### 5.1 类型检查 + 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  488.25 kB │ gzip: 120.28 kB
✓ built in 297ms
```

`tsc -b`（strict + noUnusedLocals + noUnusedParameters）通过，无类型错误。
vite build 成功，产物 488.25 kB（gzip 120.28 kB）。

### 5.2 提交

文件：
- 删除：8 个 `.ts` 组件 + 2 个示范 `.tsx` + 3 个 `.ts` 插件
- 新增：8 个 `.tsx` 组件 + 3 个 `.tsx` 插件
- 文档：`doc/17-list-page-components-tsx.md`、`doc/README.md`

## 6. 相关文件链接

- `src/core/jsx-to-string.ts`（轻量渲染器，doc/16）
- `src/components/temporary-image-container.tsx`（首个试点）
- `doc/11-list-page-components.md`（原 HTML 字符串组件定稿，✅已执行，不改）
- `doc/13-remaining-html-components.md`（折叠分类三组件定稿，✅已执行，不改）
- `doc/16-jsx-to-string.md`（jsxToString 方案，✅已执行）
