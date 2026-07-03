# 10 - NewVideoPlugin 弹窗转组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/new-video-plugin.ts` 有四处 `layer.open({ content })` 内联
HTML 字符串，与新作品检测 / 编辑女优 / 头像选择相关：

1. `openDialog`（L128，原 archetype `jhs.user.js` L11064）：`content` 为
   新作品检测面板——顶部工具栏（`checkNewVideoMsg` 计数 span +
   `paramActressType` 类型下拉 + `reLoad` 刷新按钮，按钮内嵌刷新 SVG
   图标 `${this.refreshSvg}`）+ `actress-card-container` 卡片网格容器 +
   `actress-pagination` 分页容器。仅一处动态值（`this.refreshSvg`，
   `BasePlugin` 实例属性）。
2. `editActress`（L321，原 archetype L11207）：`content` 为编辑女优表单
   ——头像预览（`edit-avatar-preview`）+ 头像链接输入框
   （`edit-actress-avatar`）+ 搜索头像/选择 CDN 源双按钮 + 主名称
   （`edit-actress-name`）+ 所有别名 textarea（`edit-actress-allname`）+
   演员类别下拉（`actressType`，含未知/有码/无码三选项，按当前值
   `selected`）+ 最新作品 textarea（`edit-actress-newvideolist`）+
   备注 textarea（`edit-remark`）。七处动态值：`avatar`（preview src 与
   input value 各一处）、`name`、`textareaStyle`（三处 textarea）、
   `allNameText`、`actressType`（三处 option selected 判定）、
   `newVideoText`、`remark`。
3. `editActress` 内 `#select-cdn-btn` 点击回调（L355-359，原 L11238）：
   `content` 为 CDN 源选择弹窗——标题提示（当前源名称）+ 一组单选按钮
   （`cdn-${index}`，每个源一项，含名称与 jsdelivr 推荐标记，当前源默认
   `checked`）+ 切换说明小字。原代码先 `GFRIENDS_SOURCES.map(...)` 拼出
   `radioButtonsHtml`，再拼到外层 `cdnDialogContent`。两处动态值：
   `GFRIENDS_SOURCES`（源列表，用 `name`/`json` 字段）、`currentIndex`
   （当前选中索引，`getCurrentCdnSource().index`）。
4. `searchAvatar`（L548-554，原 L11404）：`content` 为头像选择网格弹窗
   ——内嵌 `<style>` 块（`gfriends-*` 选择器样式）+ 标题提示
   （`gfriends-prompt`，显示初始头像张数）+ 滚动容器内的头像网格
   （`gfriends-image-list`，每项 `gfriends-image-item-wrapper` 含可选图片
   与尺寸标签）。原代码先 `avatarUrls.map(...)` 拼出 `imagesHtml`，再拼到
   外层 `dialogContent`。一处动态值：`avatarUrls`（头像 URL 列表，用于
   map 生成图片项与标题张数）。

按 `doc/06-component-html-string.md` 确立的 HTML→组件统一规定（普通函数
返回 HTML 字符串，不用 JSX、不用 `renderToStaticMarkup`），将这四段
内联 HTML 提取为四个组件文件，插件层改为 `content: X(props)` 消费；
`searchAvatar` 弹窗内 `<style>` 块的 CSS 提取为
`src/styles/avatar-select-dialog.css` + `?raw`，由插件 `initCss` 注入
（与 `setting-plugin` 的 `settingCssRaw + helpDialogCssRaw` 同一模式）。
与 `login-dialog` / `subtitle-*` / `history-*` / `temporary-image-container`
保持同一模式。

## 2. 修改方案

### 2.1 新建 `src/components/new-video-dialog.ts`

- 导出 `NewVideoDialog(props: NewVideoDialogProps): string`，函数体为模板
  字符串，原样保留原 content 的 HTML 结构、id（`checkNewVideoMsg`/
  `paramActressType`/`reLoad`/`actress-card-container`/`actress-pagination`）、
  类名（`newVideoToolBox`/`a-normal`/`jhs-scrollbar`）、内联 style、`\n`
  转义与缩进、select 与 a 标签间的空白行，与原 content 字符串零偏差。
- 原一处 `${this.refreshSvg}` 改为 props `refreshSvg`（类型 `string`）。
  声明 `NewVideoDialogProps` 接口。
- 文件用 `.ts`（无 JSX 语法，符合统一规定第 3 条）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.2 新建 `src/components/edit-actress-dialog.ts`

- 导出 `EditActressDialog(props: EditActressDialogProps): string`，函数体
  为模板字符串，原样保留原 content 的 HTML 结构、id（`edit-avatar-preview`/
  `edit-actress-avatar`/`search-avatar-btn`/`select-cdn-btn`/
  `edit-actress-name`/`edit-actress-allname`/`actressType`/
  `edit-actress-newvideolist`/`edit-remark`）、内联 style、`\n` 转义与缩进、
  闭合标签缺漏、三处 `actressType === "..." ? "selected" : ""` 三元判定，
  与原 content 字符串零偏差。
- 原七处插值改为 props：`avatar`（头像 URL，preview src 与 input value
  各一处）、`name`（主名称）、`textareaStyle`（三处 textarea 共用样式串）、
  `allNameText`（别名 textarea 内容）、`actressType`（类别，三处 option
  selected 判定）、`newVideoText`（最新作品 textarea 内容）、`remark`
  （备注 textarea 内容）。声明 `EditActressDialogProps` 接口。
- 文件用 `.ts`（无 JSX 语法）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.3 新建 `src/components/cdn-select-dialog.ts`

- 导出 `CdnSelectDialog(props: CdnSelectDialogProps): string`，函数体内部
  先 `sources.map((source, index) => \`...\`).join("")` 生成 `radioButtonsHtml`
  （原 `editActress` 内的逻辑搬迁），再拼到外层模板字符串。原样保留原
  content 的 HTML 结构、id（`cdn-${index}`）、`name`（`cdn-source`）、
  内联 style、`\n` 转义与缩进、`${index === currentIndex ? "checked" : ""}`
  三元、`${source.json.includes("jsdelivr") ? "(推荐)" : ""}` 判定，与原
  content 字符串零偏差。
- 原两处插值改为 props：`sources`（CDN 源列表）、`currentIndex`（当前
  选中索引）。声明 `CdnSelectDialogProps` 接口与导出 `CdnSelectSource`
  （`{ name: string; json: string }`，结构兼容 `../resources/gfriends` 的
  `GfriendsSource` 子集，故插件直接传 `GFRIENDS_SOURCES` 不需适配）。
- 文件用 `.ts`（无 JSX 语法）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.4 新建 `src/components/avatar-select-dialog.ts`

- 导出 `AvatarSelectDialog(props: AvatarSelectDialogProps): string`，函数体
  内部先 `avatarUrls.map((url, index) => \`...\`).join("")` 生成 `imagesHtml`
  （原 `searchAvatar` 内的逻辑搬迁），再拼到外层模板字符串。原样保留原
  content 的 HTML 结构、id（`gfriends-image-list-container`/
  `gfriends-prompt`/`gfriends-image-list`/`wrapper-${index}`）、类名
  （`gfriends-image-item-wrapper`/`gfriends-selectable-img`/
  `gfriends-size-tag`）、`data-*` 属性（`data-url`/`data-wrapper-id`/
  `data-size-for`）、内联 style、`\n` 转义与缩进，与原 content 字符串
  零偏差（仅移除原内嵌 `<style>...</style>` 块，CSS 改由 `initCss` 注入）。
- 原一处插值改为 props：`avatarUrls`（头像 URL 列表，用于 map 生成图片项
  与标题 `${avatarUrls.length}` 张数）。声明 `AvatarSelectDialogProps`
  接口。
- 文件用 `.ts`（无 JSX 语法）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.5 新建 `src/styles/avatar-select-dialog.css`

- 提取自原 `searchAvatar` 弹窗 content 内 `<style>` 块的 CSS 文本，
  原样保留前导空格（12 空格缩进，与 `help-dialog.css` 风格一致）、注释
  （`/* 保持上一个回答的美化样式 */` 等）、选择器（`#gfriends-image-list-
  container`/`#gfriends-prompt`/`#gfriends-image-list`/
  `.gfriends-image-item-wrapper`/`.gfriends-selectable-img`/
  `.gfriends-image-item-wrapper:hover`/`.gfriends-selectable-img.is-selected`/
  `.gfriends-size-tag`）、属性与值，与原 `<style>` 块内容零偏差
  （仅去掉外层 `<style>`/`</style>` 标签）。

### 2.6 修改 `src/plugins/new-video-plugin.ts`

- import 区于 `newVideoCssRaw` 之后新增：
  ```ts
  import avatarSelectDialogCssRaw from "../styles/avatar-select-dialog.css?raw";
  import { NewVideoDialog } from "../components/new-video-dialog";
  import { EditActressDialog } from "../components/edit-actress-dialog";
  import { CdnSelectDialog } from "../components/cdn-select-dialog";
  import { AvatarSelectDialog } from "../components/avatar-select-dialog";
  ```
- `initCss` 返回值由 `newVideoCssRaw` 改为 `newVideoCssRaw +
  avatarSelectDialogCssRaw`（拼接注入头像选择弹窗 CSS），并更新 doc-comment
  说明新增 `gfriends-*` 样式来源。
- `openDialog` 内移除 `const dialogContent: string = \`...\`;` 模板字符串
  赋值，改为：
  ```ts
  const dialogContent: string = NewVideoDialog({ refreshSvg: this.refreshSvg });
  ```
- `editActress` 内移除 `const dialogContent: string = \`...\`;` 模板字符串
  赋值（保留前置 `name`/`avatar`/`remark`/`allNameText`/`newVideoText`/
  `starId`/`textareaStyle`/`actressType` 局部变量构造），改为：
  ```ts
  const dialogContent: string = EditActressDialog({
      avatar, name, textareaStyle, allNameText, actressType, newVideoText, remark,
  });
  ```
- `editActress` 内 `#select-cdn-btn` 点击回调移除 `radioButtonsHtml` 与
  `cdnDialogContent` 两段模板字符串赋值，改为：
  ```ts
  const cdnDialogContent: string = CdnSelectDialog({
      sources: GFRIENDS_SOURCES,
      currentIndex,
  });
  ```
- `searchAvatar` 内移除 `imagesHtml` 与 `dialogContent` 两段模板字符串
  赋值（保留 `avatarUrls` 变量供 success 回调 `remaining` 计算用），改为：
  ```ts
  const dialogContent: string = AvatarSelectDialog({ avatarUrls });
  ```
- 四处 `layer.open` 的 `success`/`yes` 回调（数据加载/事件绑定/ESC 关闭/
  头像同步预览/textarea 自动增高/搜索头像/选择 CDN/保存回写/图片 load/
  error/点击选中回填）保持不变，事件绑定仍由插件持有，组件只负责静态
  结构 + 动态值插值。
- `GFRIENDS_SOURCES` 仍在插件内引用（作为 props 值传入 `CdnSelectDialog`，
  兼容 `CdnSelectSource[]` 类型，TS 协变允许），导入不变，无未使用导入。
- 文件级 doc-comment 原已涵盖"内联 HTML/CSS 原样保留，仅替换模板插值
  变量名"说明，本次仅将四处 layer 弹窗 content 提取为组件 + 一处 CSS
  提取为独立文件，不改动文件级注释（提取行为符合既有"原样保留"语义：
  HTML 结构/类名/style/`\n` 转义零偏差）。

## 3. 执行验证记录

### 3.1 构建

```
$ pnpm run build
$ tsc -b && vite build
16:41:02 [vite] warning: `esbuild` option was specified by "vite:react-swc" plugin...
vite v8.1.2 building client environment for production...
✓ 77 modules transformed.
computing gzip size...
dist/monkey-jhs-disassemble.user.js  460.16 kB │ gzip: 115.13 kB
✓ built in 261ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build`
成功出包。模块数较上次记录（67）增至 77（含本次新增
`new-video-dialog.ts`/`edit-actress-dialog.ts`/`cdn-select-dialog.ts`/
`avatar-select-dialog.ts` + `avatar-select-dialog.css` 共 5 个，其余为
期间其他变更）。

### 3.2 产物体积

- 修改前（doc 09 基线）：458.99 kB（gzip 114.67 kB）
- 修改后：**460.16 kB**（gzip 115.13 kB）
- 结论：与基线一致，无膨胀（HTML/CSS 字符串由插件文件移至组件/CSS
  文件，等价搬迁；新增四处函数调用与接口声明、一处 CSS `?raw` 拼接，
  增量 +1.17 kB 可忽略）。✓

### 3.3 行为一致性核查

- `NewVideoDialog({ refreshSvg })` 返回的 HTML 与原 `openDialog` content
  模板逐字符一致（含 `\n` 转义、缩进、select 与 a 标签间空白行、
  `#checkNewVideoMsg`/`#paramActressType`/`#reLoad`/
  `#actress-card-container`/`#actress-pagination` id、`newVideoToolBox`/
  `a-normal`/`jhs-scrollbar` 类名、内联 style）；`this.refreshSvg` 由
  实例属性直插改为 props 直插，求值结果零偏差。success 回调
  （`loadData`/`bindClick`/`setupEscClose`）不受影响。✓
- `EditActressDialog({ ... })` 返回的 HTML 与原 `editActress` content
  模板逐字符一致（含 `\n` 转义、缩进、闭合标签缺漏、九处 id、内联
  style、三处 `actressType === "..." ? "selected" : ""` 三元）；七处
  字段值/样式/类别由局部变量直插改为 props 直插，求值结果零偏差。
  success（头像同步预览/textarea 自动增高/搜索头像/选择 CDN）与 yes
  （读取 DOM 值并回写 `storageManager`）回调不受影响。✓
- `CdnSelectDialog({ sources, currentIndex })` 内部 `sources.map` 生成
  的单选按钮 HTML 与原 `radioButtonsHtml` 逐字符一致（含 `\n` 转义、
  缩进、`cdn-${index}` id/name、`index === currentIndex ? "checked" : ""`
  三元、`source.json.includes("jsdelivr") ? "(推荐)" : ""` 判定）；外层
  模板与原 `cdnDialogContent` 逐字符一致（含标题提示
  `sources[currentIndex].name`、切换说明小字）。`GFRIENDS_SOURCES`
  （`GfriendsSource[]`）结构兼容 `CdnSelectSource[]`（多 `base` 字段，
  TS 协变允许），传入不需适配。success（`setupEscClose`）与 yes（读取
  选中值/写 `localStorage`/`clearCache`/清 IndexedDB/`show.ok`）回调
  不受影响。✓
- `AvatarSelectDialog({ avatarUrls })` 内部 `avatarUrls.map` 生成的图片项
  HTML 与原 `imagesHtml` 逐字符一致（含 `\n` 转义、缩进、`wrapper-${index}`
  id、`gfriends-*` 类名、`data-*` 属性、`...` 占位文本）；外层模板与原
  `dialogContent` 逐字符一致（仅移除 `<style>` 块，标题提示
  `${avatarUrls.length}` 张数保留）。`<style>` 块 CSS 提取为
  `avatar-select-dialog.css`，由 `initCss` 拼接注入，选择器与原 `<style>`
  内容零偏差，渲染行为一致。success（图片 `load`/`error`/尺寸标签回填/
  错误图片移除/剩余计数/全失效关闭/点击选中回填编辑弹窗头像）回调
  不受影响，`avatarUrls` 变量仍供 `remaining` 计算用。✓
- 无 `react-dom/server` 引入，符合统一规定。✓
- 行尾：五文件均为 LF（与 `src/components`/`src/styles` 既有文件一致）。✓

### 3.4 提交

- 主题：`NewVideo 弹窗转组件`
- 文件：`src/components/new-video-dialog.ts`（新增）、
  `src/components/edit-actress-dialog.ts`（新增）、
  `src/components/cdn-select-dialog.ts`（新增）、
  `src/components/avatar-select-dialog.ts`（新增）、
  `src/styles/avatar-select-dialog.css`（新增）、
  `src/plugins/new-video-plugin.ts`、
  `doc/10-new-video-dialogs-component.md`、`doc/README.md`
- hash：见下文 `git log` 输出
