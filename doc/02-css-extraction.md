---
文档类型: 🔧开发指导
文档状态: 🔧待执行
---

# 02 - CSS 提取模式

## 1. 目标

将散落在 `src/legacy/jhs.ts` 中的内联 CSS 字符串提取为 `src/styles/*.css` 独立
文件，通过 `?raw` 导入后在原注入点注入，保证执行顺序与原始脚本零偏差。

## 2. 提取模式

### 2.1 纯静态 CSS

原脚本中 `H("<style>...</style>")` 或 `document.head.insertAdjacentHTML("beforeend", "<style>...</style>")`。

提取步骤：
1. 将 CSS（去掉 `<style>` 包裹，模板字符串里的 `\n` 转为真实换行）写入
   `src/styles/xxx.css`。
2. legacy 顶部 `import xxxCssRaw from "../styles/xxx.css?raw";`
3. 原注入点改为 `H(xxxCssRaw)`（`H` 的 `insertStyle` 会自动包裹 `<style>`）
   或 `document.head.insertAdjacentHTML("beforeend", "<style>" + xxxCssRaw + "</style>")`。

> 注：JS 模板字符串中的 `\n` 是转义为换行符，.css 文件用真实换行等价；
> `H()` 对含/不含 `<style>` 标签的字符串均能正确注入。

### 2.2 含运行时插值的 CSS

原脚本中 `const N = \`<style>... ${M} ...</style>\``（`M` 为条件追加片段）。

提取步骤：
1. .css 文件中用占位注释 `/*__TOKEN__*/` 代替 `${M}`。
2. legacy：`const N = xxxCssRaw.replace("/*__TOKEN__*/", M);`
3. `H(N)` 注入点不变。

### 2.3 含运行时生成逻辑的 CSS

原脚本 `const F = \`<style>... ${(function(){...})()} ...</style>\``（IIFE 生成滚动条 CSS）。

提取步骤：
1. .css 文件静态部分 + 占位 `/*__SCROLLBAR__*/`。
2. legacy：将 IIFE 命名为 `generateScrollbarCss()` 函数，
   `const F = commonToolbarCssRaw.replace("/*__SCROLLBAR__*/", generateScrollbarCss());`

## 3. 已提取

| CSS | 文件 | 对原变量 | 模式 |
|-----|------|----------|------|
| 加载动画 | `src/styles/loading.css` | loading `<style>` | 纯静态（2.1） |

## 4. 待提取清单

### 4.1 顶层全局 CSS

| CSS | 原变量 | legacy 行（参考） | 模式 |
|-----|--------|------|------|
| JavBus masonry 布局 | `N` | L70 | 含插值 `${M}`（2.2） |
| JavDb 站点样式 | `E` | L76 | 含插值 `${j}`（2.2） |
| 通用工具栏/表格 | `F` | L77-92 | 含 IIFE 滚动条（2.3） |
| a-normal 按钮组 | `H("...")` | L207 区域 | 纯静态（2.1） |
| hideNav 片段 | `M`/`j` | L65/L71 | 条件片段，可并入 N/E 占位 |

### 4.2 插件 initCss（processCss 阶段注入）

DetailPagePlugin、PreviewVideoPlugin、FoldCategoryPlugin、ActressInfoPlugin、
NavBarPlugin、OtherSitePlugin、AutoPagePlugin、SettingPlugin、NewVideoPlugin、
HistoryPlugin 等的 `initCss()` 返回的 CSS 字符串。
→ 在提取对应插件到 `src/plugins/` 时，同步提取其 CSS 到 `src/styles/<plugin>.css`。

### 4.3 内联样式

- ImagePreview `injectStyles()`（L2251 区域）
- Logger `createContainer()` 内联样式
- 各 `layer.open({ content: "<html style=...>" })` 内联 style
→ 在提取对应 core/插件/组件时同步处理。

## 5. 注意事项

- **执行顺序**：CSS 必须在原注入点注入（`H()`/`processCss`/`importResource`），
  不可改用 `main.tsx` 顶层 `import './x.css'`，否则注入顺序与原始脚本不一致。
- **库 CSS**：`utils.importResource(...)` 加载的 4 个 CDN CSS（layui/toastify/viewer/tabulator）
  为外部 `<link>`，保留 `importResource` 机制，不提取为本地 .css。
- **?raw 类型**：`vite/client`（`src/vite-env.d.ts` 已 reference）提供 `*?raw` 的
  `string` 类型声明，`import x from './x.css?raw'` 类型为 `string`。
