# 18 - 鉴定记录/演员信息组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖。`doc/17` 将列表页/折叠分类 8 个
HTML 字符串组件转 TSX 原生 React 组件，调用点改 `jsxToString(<Comp {...} />)`，
产物 488.25 kB（gzip 120.28 kB）。

本次将鉴定记录（`HistoryPlugin`）与演员信息（`ActressInfoPlugin`）、
收藏演员（`FavoriteActressesPlugin`）相关的 9 个返回 HTML 字符串的 `.ts`
组件统一转为 TSX 原生 React 组件（JSX），3 个调用点插件 `.ts`→`.tsx`，
调用改 `jsxToString(<Comp {...props} />)`。规则与 `doc/17` 一致，本文件
仅记录本批特有事项。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `history-dialog.ts` | `history-dialog.tsx` | 筛选区/批量操作区/表格容器；`<option selected>` → `selected={true}` |
| `edit-record-dialog.ts` | `edit-record-dialog.tsx` | 编辑表单；`inputStyle`/`textareaStyle` 由 string 改 CSSProperties（见 §4） |
| `history-nav-button.ts` | `history-nav-button.tsx` | 三变体 desktop/mini/javbus；switch + default null |
| `history-action-buttons.ts` | `history-action-buttons.tsx` | 行操作按钮组；data-car-num/data-href 原样 |
| `history-source-cell.ts` | `history-source-cell.tsx` | 来源列 `<span style={{color}}>` |
| `history-status-cell.ts` | `history-status-cell.tsx` | 状态列 `<span style={{color}}>` |
| `actress-info-detail-segment.ts` | `actress-info-detail-segment.tsx` | 有/无信息版；导出 `ActressWikiInfo` 类型 |
| `actress-info-star-page-html.ts` | `actress-info-star-page-html.tsx` | 有/无信息版；`import type { ActressWikiInfo }` |
| `favorite-actress-avatar-column.ts` | `favorite-actress-avatar-column.tsx` | 头像占位列；无 props |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 文件 | 改动 |
|------|------|
| `src/plugins/history-plugin.tsx` | 加 `import { jsxToString }` + `import type { CSSProperties }`；改 11 处：`HistoryNavButton`×3（handle desktop/mini/javbus）/ `HistoryDialog`×1（openHistory content）/ `HistorySourceCell`×4（来源 formatter）/ `HistoryStatusCell`×1（状态 formatter）/ `HistoryActionButtons`×1（操作 formatter）/ `EditRecordDialog`×1（editRecord content）；`editRecord` 内 `textareaStyle`/`inputStyle` 由 CSS 字符串改 CSSProperties 对象 |
| `src/plugins/actress-info-plugin.tsx` | 加 `import { jsxToString }`；改 2 处：`ActressInfoDetailSegment`×1（handleDetailPage segment）/ `ActressInfoStarPageHtml`×1（handleStarPage html） |
| `src/plugins/favorite-actresses-plugin.tsx` | 加 `import { jsxToString }`；改 1 处：`FavoriteActressAvatarColumn`×1（replaceActressAvatar avatarColumnHtml） |

> 调用点文件原为 `.ts`，因需写 JSX 语法，重命名为 `.tsx`。`main.tsx` 以
> 无扩展名 `import` 引入这三个插件，TS bundler 解析自动定位到 `.tsx`。

## 3. 转换规则

沿用 `doc/17` §3（`class`→`className`、`style` 字符串→CSSProperties 对象
camelCase、`data-*` 原样、自闭合 void 标签、动态 `${var}`→`{props.var}`、
`\n`/缩进紧凑化 DOM 等价）。本批新增事项：

- **`<option selected>`**：原 HTML 裸 `selected` 属性 → JSX `selected={true}`
  （history-dialog 的"所有"选项）或 `selected={status === opt.value}` 布尔
  驱动（edit-record-dialog 的状态下拉）。jsxToString 对 `true` 输出裸
  `selected`，对 `false` 省略，与原 `${cond ? "selected" : ""}` 等价。
- **`<input readonly>`**：JSX/React 类型要求 `readOnly`（camelCase）。
  jsxToString 输出裸 `readOnly`——HTML 属性名大小写不敏感，浏览器/jQuery
  解析时等同 `readonly`，行为等价（DOM 等价，见 §4）。
- **`style` 字符串 prop → CSSProperties 对象**：edit-record-dialog 原接收
  `inputStyle`/`textareaStyle` 为 CSS 字符串（调用方拼字面量），转 TSX 时
  一并对象化——组件 prop 类型改 `CSSProperties`，调用方 `editRecord` 内两
  个 const 由字符串改对象。edit-carNum 的 `${inputStyle} background-color:
  #f0f0f0;` 拼接 → `{ ...inputStyle, backgroundColor: "#f0f0f0" }` 对象
  展开。React 19 类型将 `style` 收窄为 `CSSProperties`（不再接受 `string`），
  故 string 形式无法直接通过类型检查；对象化是与其他已转组件一致的解法。

## 4. 零偏差说明（行为变化）

- **属性间 / 子节点间 `\n` 与缩进丢失**：jsxToString 紧凑输出，原模板中的
  `\n` + 空格缩进丢失。对 DOM 构建（`.append`/`.prepend`/`.before`/`layer
  content`）与 CSS 解析无影响，与 `doc/17` 一致。
- **`readOnly` 属性名大小写**：原 HTML `readonly` → jsxToString 输出
  `readOnly`（camelCase）。HTML 属性名大小写不敏感，浏览器解析等同，
  `edit-carNum` 输入框仍为只读。DOM 等价。
- **`inputStyle`/`textareaStyle` 由 string 改 CSSProperties 对象**：原 CSS
  字符串（如 `width: 100%; padding: 8px; ...`）改为对象（`{ width: "100%",
  padding: "8px", ... }`），jsxToString 经 `styleToCss` 还原为
  `width:100%;padding:8px;...`（无空格、无尾 `;`、camelCase→kebab-case）。
  与原值 CSS 等价，仅空白/尾分号差异，与 `doc/17` 其它 style 转换一致。
  edit-carNum 的 `background-color:#f0f0f0` 声明顺序（在 inputStyle 之后）
  由对象展开 `{ ...inputStyle, backgroundColor }` 保持一致。
- **`selected` 布尔化**：原 `${cond ? "selected" : ""}` 字符串插值 →
  `selected={cond}` 布尔。jsxToString 对 `true`→裸 `selected`，`false`→
  省略。与原输出一致。
- **文本节点转义**：jsxToString 对文本节点转义 `&` `<` `>`（属性值不转义）。
  对常规文本（番号/演员名/中文/URL）无影响；与 `doc/17` 一致。
- **`HistoryNavButton` default 分支**：variant 为有限联合，switch 覆盖三
  变体 + `default: return null`（原返回 `""`）。`jsxToString(null) === ""`，
  等价。default 实际不可达，保留以满足 `noImplicitReturns`。

## 5. 执行验证记录

### 5.1 类型检查 + 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  491.94 kB │ gzip: 121.16 kB
✓ built in 310ms
```

`tsc -b`（strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch）通过，无类型错误。vite build 成功，产物
491.94 kB（gzip 121.16 kB），较 `doc/17` 基线 488.25 kB +3.69 kB
（gzip +0.88 kB），为 9 个组件 + 3 插件引入 JSX 的 SWC 编译增量，与
`doc/17` 8 组件 +3.13 kB 量级一致。

### 5.2 调用点核对

- `history-plugin.tsx`：11 处 `jsxToString(<Comp .../>)`（grep 核对：3 nav
  + 1 dialog + 4 source + 1 status + 1 action + 1 edit-record），无残留
  `Component({...})` 调用。
- `actress-info-plugin.tsx`：2 处（detail-segment + star-page-html）。
- `favorite-actresses-plugin.tsx`：1 处（avatar-column）。
- 合计 14 处调用点全部改 jsxToString。

### 5.3 提交

文件：
- 删除：9 个 `.ts` 组件 + 3 个 `.ts` 插件
- 新增：9 个 `.tsx` 组件 + 3 个 `.tsx` 插件
- 文档：`doc/18-history-actress-components-tsx.md`、`doc/README.md`

## 6. 相关文件链接

- `src/core/jsx-to-string.ts`（轻量渲染器，doc/16）
- `src/components/status-tag-html.tsx`（先例，doc/17）
- `doc/09-history-dialogs-component.md`（鉴定记录弹窗组件定稿，✅已执行，不改）
- `doc/13-remaining-html-components.md`（history source/status cell、actress-info 组件定稿，✅已执行，不改）
- `doc/16-jsx-to-string.md`（jsxToString 方案，✅已执行）
- `doc/17-list-page-components-tsx.md`（列表页/折叠分类组件 TSX 转换，✅已执行，规则参照）
