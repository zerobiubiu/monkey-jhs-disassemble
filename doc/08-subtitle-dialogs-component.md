# 08 - DetailPageButton 字幕弹窗转组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/detail-page-button-plugin.ts` 有两处 `layer.open({ content })`
内联 HTML 字符串，与字幕功能相关：

1. `searchXunLeiSubtitle`（L1230-1234，原 archetype `jhs.user.js` L6151）：
   `content` 为静态 HTML 字符串字面量——外层
   `height:100%;overflow:hidden;` 容器 + 内层 `#xunlei-table-container`
   占位 div，供 success 回调内 `new Tabulator("#xunlei-table-container", {...})`
   挂载迅雷字幕表格。
2. `previewSubtitle`（L1542-1548，原 archetype `jhs.user.js` L6425）：
   `content` 为动态拼接的模板字符串——深色等宽字体预览容器
   `<div style="...#1E1E1E...">${htmlContent}</div>`，其中 `htmlContent`
   为 `lines.forEach` 拼接的带行号 span 的字幕正文。

按 `doc/06-component-html-string.md` 确立的 HTML→组件统一规定（普通函数
返回 HTML 字符串，不用 JSX、不用 `renderToStaticMarkup`），将这两段
内联 HTML 提取为 `src/components/subtitle-table-dialog.ts` 的
`SubtitleTableDialog()` 与 `src/components/subtitle-preview-dialog.ts` 的
`SubtitlePreviewDialog({ content })`，插件层改为 `content: X(props)`
消费，与 `login-dialog` / `temporary-image-container` 保持同一模式。

## 2. 修改方案

### 2.1 新建 `src/components/subtitle-table-dialog.ts`

- 导出 `SubtitleTableDialog(): string`，函数体为模板字符串，原样保留原
  content 的 HTML 结构、id（`xunlei-table-container`）、内联 style。
- 前导/尾部空白（开头换行+20 空格、结尾换行+16 空格，及首行 `<div>` 后
  的一个尾随空格）原样保留，与原 content 字符串零偏差（原字符串以单引号
  + `\n` 转义书写，本组件改为模板字符串 + 字面换行/空格，求值结果一致）。
- 本容器无动态值，故无 props（与统一规定第 4 条一致：动态插值用 props，
  无动态值可无 props）。
- 文件用 `.ts`（无 JSX 语法，符合统一规定第 3 条）。
- 补全文件级与函数级 doc-comment（用途/返回值）。

### 2.2 新建 `src/components/subtitle-preview-dialog.ts`

- 导出 `SubtitlePreviewDialog({ content }: SubtitlePreviewDialogProps): string`，
  函数体为模板字符串，原样保留外层 div 的内联 style（深色背景、等宽字体、
  `white-space:pre-wrap;overflow:auto;height:100%;`）。
- 外层 div 为固定模板，动态字幕正文（previewSubtitle 内由 `lines.forEach`
  拼接的 `output`/`htmlContent`）通过 `props.content` 注入，与原
  `<div ...>${htmlContent}</div>` 行为一致。
- 本容器含动态值，故用 props（统一规定第 4 条）；声明
  `SubtitlePreviewDialogProps { content: string }` 接口。
- 文件用 `.ts`（无 JSX 语法）。
- 补全文件级、接口级与函数级 doc-comment（用途/参数/返回值）。

### 2.3 修改 `src/plugins/detail-page-button-plugin.ts`

- import 区按字母序于 `./base-plugin` 之后插入：
  ```ts
  import { SubtitlePreviewDialog } from "../components/subtitle-preview-dialog";
  import { SubtitleTableDialog } from "../components/subtitle-table-dialog";
  ```
- `searchXunLeiSubtitle` 内 `content` 由字符串字面量改为调用：
  ```ts
  content: SubtitleTableDialog(),
  ```
- `previewSubtitle` 内 `content` 由模板字符串改为调用：
  ```ts
  content: SubtitlePreviewDialog({ content: htmlContent }),
  ```
- `searchXunLeiSubtitle` 的 success 回调（Tabulator 实例化、列配置、
  预览/下载按钮事件绑定、ESC 关闭）与 `previewSubtitle` 的下载按钮
  （btn/btn1 → utils.download）、标题与区域尺寸保持不变，事件绑定仍由
  插件持有，组件只负责静态结构（+ 预览组件的正文插值）。
- 同步更新文件级 doc-comment：原"内联 CSS/HTML（含 ... layer 弹窗
  content ...）原样保留"一条补充说明两处字幕弹窗 content 已提取为
  SubtitleTableDialog / SubtitlePreviewDialog 组件（引用 doc/06 统一规定）。

## 3. 执行验证记录

### 3.1 构建

```
$ pnpm run build
$ tsc -b && vite build
15:46:10 [vite] warning: `esbuild` option was specified by "vite:react-swc" plugin...
vite v8.1.2 building client environment for production...
✓ 65 modules transformed.
computing gzip size...
dist/monkey-jhs-disassemble.user.js  458.34 kB │ gzip: 114.39 kB
✓ built in 270ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build`
成功出包。模块数 63 → 65（新增 `subtitle-table-dialog.ts`、
`subtitle-preview-dialog.ts`）。诊断（diagnostics）三文件均无 error/warning。

### 3.2 产物体积

- 修改前（doc 07 基线）：458.18 kB（gzip 114.28 kB）
- 修改后：**458.34 kB**（gzip 114.39 kB）
- 结论：与基线一致，无膨胀（HTML 字符串由插件文件移至组件文件，等价
  搬迁；预览组件新增一处函数调用与接口声明，增量可忽略）。✓

### 3.3 行为一致性核查

- `SubtitleTableDialog()` 返回的 HTML 字符串与原 content 字面量逐字符
  一致（含前导/尾部空白、内联 style、`#xunlei-table-container` id）；
  layer.open content 渲染行为零偏差，Tabulator 仍挂载到
  `#xunlei-table-container`。✓
- `SubtitlePreviewDialog({ content: htmlContent })` 返回的 HTML 与原
  模板字符串 `<div ...>${htmlContent}</div>` 逐字符一致；预览容器样式、
  注入的正文字符串零偏差。✓
- 无 `react-dom/server` 引入，符合统一规定。✓

### 3.4 提交

- 主题：`DetailPageButton 字幕弹窗转组件`
- 文件：`src/components/subtitle-table-dialog.ts`（新增）、
  `src/components/subtitle-preview-dialog.ts`（新增）、
  `src/plugins/detail-page-button-plugin.ts`、
  `doc/08-subtitle-dialogs-component.md`、`doc/README.md`
- hash：见下文 `git log` 输出
