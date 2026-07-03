# 19 - 黑名单组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`。`doc/17`/`doc/18` 先后将列表页/折叠分类 8 个、
鉴定记录/演员信息 9 个 HTML 字符串组件转 TSX 原生 React 组件，调用点改
`jsxToString(<Comp {...} />)`。

本次将 `blacklist-plugin` 相关的 9 个返回 HTML 字符串的 `.ts` 组件统一转为
TSX 原生 React 组件（JSX），调用点插件 `blacklist-plugin.ts`→`.tsx`，
9 处调用改 `jsxToString(<Comp {...props} />)`。规则与 `doc/17`/`doc/18` 一致，
本文件仅记录本批特有事项。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `blacklist-dialog.ts` | `blacklist-dialog.tsx` | 筛选区+表格容器；`urlType` 可见性由 `showUrlType` 决定 `display: showUrlType ? undefined : "none"` |
| `blacklist-confirm-message.ts` | `blacklist-confirm-message.tsx` | 确认提示；Fragment + 条件 `<br/>`+文案（`notFirstPageByQuery`/`notFirstPageByJavbus` 两独立判定） |
| `blacklist-data-type-options.ts` | `blacklist-data-type-options.tsx` | 三个 `<option>` 计数；Fragment |
| `blacklist-name-cell.ts` | `blacklist-name-cell.tsx` | `<a class="open-url">`；data-url/href/data-name/target 原样 |
| `blacklist-url-type-cell.ts` | `blacklist-url-type-cell.tsx` | `<span style={{color: hasTag ? "#cc4444" : undefined}}>` |
| `blacklist-status-cell.ts` | `blacklist-status-cell.tsx` | `<span data-tip style={{color: tipText ? "#cc4444" : undefined}}>` |
| `blacklist-action-cell.ts` | `blacklist-action-cell.tsx` | 删除按钮+被注释按钮；`{" "}` 保 `<span>` 前后空格；HTML 注释→JSX 注释 |
| `movie-list-wrapper.ts` | `movie-list-wrapper.tsx` | `<div dangerouslySetInnerHTML={{__html: html}}>` + 条件 `<a>` |
| `blacklist-pagination-counter.ts` | `blacklist-pagination-counter.tsx` | 统计文案+占位 span；`&nbsp;` JSX 解码为 U+00A0 |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 文件 | 改动 |
|------|------|
| `src/plugins/blacklist-plugin.tsx` | 加 `import { jsxToString }`；改 9 处：`BlacklistDialog`×1 / `BlacklistConfirmMessage`×1 / `BlacklistDataTypeOptions`×1 / `BlacklistPaginationCounter`×1 / `BlacklistNameCell`×1 / `BlacklistUrlTypeCell`×1 / `BlacklistStatusCell`×1 / `BlacklistActionCell`×1 / `MovieListWrapper`×1 |

## 3. 转换规则

沿用 `doc/17` §3 / `doc/18` §3。本批新增事项：

- **`dangerouslySetInnerHTML` 支持**：`MovieListWrapper` 的 `html` prop 为
  Beyond60Plugin 合并返回的原始 HTML 片段（含标签），不能作为 JSX 文本子节点
  （jsxToString 会转义 `<`/`>`）。改用 React 的 `dangerouslySetInnerHTML={{ __html: html }}`
  注入 div。为此给 `jsxToString` 增加 `dangerouslySetInnerHTML` 支持：
  - `renderAttrs` 跳过该 key（不渲染为 HTML 属性）；
  - DOM 元素渲染时取 `__html` 作为原始 inner HTML 输出（不转义），跳过 children。
- **条件空 `style=""`**：`BlacklistUrlTypeCell`/`BlacklistStatusCell` 原模板用
  `${cond ? "color:..." : ""}`，空条件时输出 `style=""`。TSX 改用
  `style={{ color: cond ? "#cc4444" : undefined }}`——`undefined` 被
  `styleToCss` 过滤，空对象 CSS 为空串，jsxToString 省略 `style` 属性
  （原 `style=""` 与无 `style` 属性 DOM 渲染等价）。
- **`&nbsp;` 实体**：`BlacklistPaginationCounter` 原模板 `&nbsp;&nbsp;&nbsp;`
  在 JSX 文本中由编译器解码为 U+00A0 字符。jsxToString 文本转义仅处理
  `&`/`<`/`>`，U+00A0 原样输出。浏览器解析 U+00A0 与 `&nbsp;` DOM 等价。
- **`<a>` 前后空格**：`BlacklistActionCell` 原 ` <span>✂️ 删除</span> ` 有
  前后空格，JSX 同行文本紧邻 tag 会被 trim，改用 `{" "}` 表达式显式保留。
- **HTML 注释 `<!-- -->`→JSX 注释**：`BlacklistActionCell` 的被注释按钮
  `<!-- <a class="keyword-btn">...</a>-->` 转为 `{/* ... */}`。jsxToString
  输出中注释不渲染（React 注释表达式求值为 undefined→`""`），原 HTML 注释
  亦不参与 DOM 查询（`.keyword-btn` 选择器两种模式均返回 null），行为等价。

## 4. 执行验证记录

### 4.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  494.26 kB │ gzip: 121.41 kB
✓ built in 331ms
```

`tsc -b` 通过 `strict` + `noUnusedLocals` + `noUnusedParameters` +
`noFallthroughCasesInSwitch` + `noUncheckedSideEffectImports`；
`vite build` 成功出包。

### 4.2 产物体积

| 阶段 | 原始 | gzip |
|------|------|------|
| doc/18 后 | 491.94 kB | 121.16 kB |
| **本档** | **494.26 kB** | **121.41 kB** |

较 doc/18 +2.32 kB（jsxToString `dangerouslySetInnerHTML` 分支 + 9 组件
JSX runtime 增量）。可接受（< 600 kB 阈值）。✓

### 4.3 提交

- 主题：`黑名单 9 组件转 TSX 原生组件`
- 文件：9 组件 `.ts`→`.tsx`（删原 `.ts`）、`blacklist-plugin.ts`→`.tsx`
  （9 处调用改 jsxToString）、`jsx-to-string.ts`（加 dangerouslySetInnerHTML
  支持）、本档、`doc/README.md`
