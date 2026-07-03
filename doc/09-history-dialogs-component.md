# 09 - HistoryPlugin 鉴定记录弹窗转组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/history-plugin.ts` 有两处 `layer.open({ content })` 内联 HTML
字符串，与鉴定记录弹窗相关：

1. `openHistory`（L133，原 archetype `jhs.user.js` L6497）：`content` 为动态
   拼接的模板字符串——筛选区（`dataType` 下拉 + `searchCarNum` 搜索框 +
   重置链接）+ 批量操作区（`allSelectBox`，含移除/已观看/收藏/屏蔽按钮）+
   表格容器（`table-container`，供 success 回调内 `new Tabulator` 挂载）。
   其中 `${BLOCKED_TEXT}`/`${FAVORITED_TEXT}`/`${WATCHED_TEXT}`/
   `${WATCHED_COLOR}`/`${FAVORITE_COLOR}`/`${FAVORITE_TEXT}`/`${BLOCK_COLOR}`/
   `${BLOCK_TEXT}` 八处状态文案/颜色插值。
2. `editRecord`（L736，原 archetype `jhs.user.js` L7038）：`content` 为动态
   拼接的模板字符串——番号（只读输入框）/演员（多行文本框）/状态（下拉
   选择，含"请选择"占位 + 屏蔽/收藏/已观看三选项）/链接（输入框）/备注
   （多行文本框）构成的编辑表单。其中 `${carNum}`/`${names}`/`${status}`/
   `${url}`/`${remark}`/`${inputStyle}`/`${textareaStyle}`/`${statusOptions}`
   八处记录字段/样式/选项插值；状态选项内含嵌套模板
   `${statusOptions.map((opt) => `...`).join("")}`。

按 `doc/06-component-html-string.md` 确立的 HTML→组件统一规定（普通函数
返回 HTML 字符串，不用 JSX、不用 `renderToStaticMarkup`），将这两段
内联 HTML 提取为 `src/components/history-dialog.ts` 的
`HistoryDialog({ ... })` 与 `src/components/edit-record-dialog.ts` 的
`EditRecordDialog({ ... })`，插件层改为 `content: X(props)` 消费，与
`login-dialog` / `subtitle-*` / `temporary-image-container` 保持同一模式。

## 2. 修改方案

### 2.1 新建 `src/components/history-dialog.ts`

- 导出 `HistoryDialog(props: HistoryDialogProps): string`，函数体为模板字符串，
  原样保留原 content 的 HTML 结构、id（`filterBox`/`dataType`/`searchCarNum`/
  `clearSearchbtn`/`allSelectBox`/`table-container`）、类名（`menu-btn`/
  `a-info`/`multiple-history-*`）、内联 style、`\n` 转义与缩进、闭合标签
  缺漏，与原 content 字符串零偏差。
- 原八处状态常量插值改为 props：`blockedText`（BLOCKED_TEXT）、
  `favoritedText`（FAVORITED_TEXT）、`watchedText`（WATCHED_TEXT，下拉选项
  与已观看按钮共用）、`watchedColor`（WATCHED_COLOR）、`favoriteColor`
  （FAVORITE_COLOR）、`favoriteText`（FAVORITE_TEXT）、`blockColor`
  （BLOCK_COLOR）、`blockText`（BLOCK_TEXT）。声明
  `HistoryDialogProps` 接口。
- 文件用 `.ts`（无 JSX 语法，符合统一规定第 3 条）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.2 新建 `src/components/edit-record-dialog.ts`

- 导出 `EditRecordDialog(props: EditRecordDialogProps): string`，函数体为
  模板字符串，原样保留原 content 的 HTML 结构、id（`edit-carNum`/
  `edit-names`/`edit-status`/`edit-url`/`edit-remark`）、内联 style、`\n`
  转义与缩进、闭合标签缺漏、状态选项内嵌套模板
  `statusOptions.map((opt) => `...`).join("")`，与原 content 字符串零偏差。
- 原八处插值改为 props：`carNum`/`names`/`status`/`url`/`remark`（记录字段）、
  `inputStyle`/`textareaStyle`（静态样式串，由插件传入以保持组件为纯模板）、
  `statusOptions`（状态下拉选项列表）。声明 `EditRecordDialogProps` 接口
  与导出 `EditRecordStatusOption`（`{ value: string; text: string }`）供
  `statusOptions` 类型标注；`.map` 回调参数由原 `(opt: any)` 改为推断类型
  `(opt)`（输出 HTML 字符串一致）。
- 文件用 `.ts`（无 JSX 语法）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.3 修改 `src/plugins/history-plugin.ts`

- import 区按字母序于 `./base-plugin` 之后、`../constants/site` 之前插入：
  ```ts
  import { EditRecordDialog } from "../components/edit-record-dialog";
  import { HistoryDialog } from "../components/history-dialog";
  ```
- `openHistory` 内移除 `const html = \`...\`;` 赋值，`content` 由模板字符串
  改为调用：
  ```ts
  content: HistoryDialog({
      blockedText: BLOCKED_TEXT,
      favoritedText: FAVORITED_TEXT,
      watchedText: WATCHED_TEXT,
      watchedColor: WATCHED_COLOR,
      favoriteColor: FAVORITE_COLOR,
      favoriteText: FAVORITE_TEXT,
      blockColor: BLOCK_COLOR,
      blockText: BLOCK_TEXT,
  }),
  ```
- `editRecord` 内移除 `const html = \`...\`;` 赋值（保留 `console.log
  (statusOptions)` 与前置 `carNum`/`names`/`url`/`status`/`remark`/
  `textareaStyle`/`inputStyle`/`statusOptions` 局部变量构造），`content` 由
  模板字符串改为调用：
  ```ts
  content: EditRecordDialog({
      carNum, names, status, url, remark,
      inputStyle, textareaStyle, statusOptions,
  }),
  ```
- `openHistory` 的 success 回调（Tabulator 实例化、筛选/搜索/重置/表格链接
  点击/dataType 变更事件绑定）与 `editRecord` 的 success 回调（文本框
  autoResize）、yes 回调（读取各字段值并 `storageManager.updateCarInfo`）
  保持不变，事件绑定仍由插件持有，组件只负责静态结构 + 动态值插值。
- 状态常量（`BLOCKED_TEXT` 等）与状态动作（`FILTER_ACTION` 等）仍在插件内
  引用（作为 props 值传入组件，或在 `loadTableData` 列 formatter 内使用），
  导入不变，无未使用导入。
- 文件级 doc-comment 原已涵盖"内联 HTML/CSS 原样保留，仅替换模板插值变量名"
  说明，本次仅将两处 layer 弹窗 content 提取为组件，不改动文件级注释
  （提取行为符合既有"原样保留"语义：HTML 结构/类名/style/`\n` 转义零偏差）。

## 3. 执行验证记录

### 3.1 构建

```
$ pnpm run build
$ tsc -b && vite build
15:59:52 [vite] warning: `esbuild` option was specified by "vite:react-swc" plugin...
vite v8.1.2 building client environment for production...
✓ 67 modules transformed.
computing gzip size...
dist/monkey-jhs-disassemble.user.js  458.99 kB │ gzip: 114.67 kB
✓ built in 275ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build`
成功出包。模块数 65 → 67（新增 `history-dialog.ts`、
`edit-record-dialog.ts`）。

### 3.2 产物体积

- 修改前（doc 08 基线）：458.34 kB（gzip 114.39 kB）
- 修改后：**458.99 kB**（gzip 114.67 kB）
- 结论：与基线一致，无膨胀（HTML 字符串由插件文件移至组件文件，等价
  搬迁；新增两处函数调用与接口声明，增量可忽略）。✓

### 3.3 行为一致性核查

- `HistoryDialog({ ... })` 返回的 HTML 字符串与原 `openHistory` content
  模板逐字符一致（含 `\n` 转义、缩进、闭合标签缺漏、`#filterBox`/
  `#dataType`/`#searchCarNum`/`#clearSearchbtn`/`#allSelectBox`/
  `#table-container` id、`multiple-history-*` 类名、内联 style）；八处
  状态文案/颜色由常量直插改为 props 直插，求值结果零偏差。layer.open
  content 渲染行为一致，Tabulator 仍挂载到 `#table-container`，success
  回调事件绑定不受影响。✓
- `EditRecordDialog({ ... })` 返回的 HTML 字符串与原 `editRecord` content
  模板逐字符一致（含 `\n` 转义、缩进、`#edit-carNum`/`#edit-names`/
  `#edit-status`/`#edit-url`/`#edit-remark` id、内联 style、状态选项
  嵌套 `statusOptions.map` 模板、`status === "" ? "selected" : ""` 三元
  与 `status === opt.value ? "selected" : ""` 判定）；`.map` 回调参数
  由 `: any` 改为推断类型，输出字符串一致。success（autoResize）与
  yes（读取 DOM 值 + `updateCarInfo`）回调不受影响。✓
- 无 `react-dom/server` 引入，符合统一规定。✓
- 行尾：三文件均为 CRLF，与工程既有文件一致。✓

### 3.4 提交

- 主题：`History 弹窗转组件`
- 文件：`src/components/history-dialog.ts`（新增）、
  `src/components/edit-record-dialog.ts`（新增）、
  `src/plugins/history-plugin.ts`、
  `doc/09-history-dialogs-component.md`、`doc/README.md`
- hash：见下文 `git log` 输出
