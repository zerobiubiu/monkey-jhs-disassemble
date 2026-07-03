# 14. CSS 与原版字符级对齐修复

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **对应原版**：`archetype/jhs.user.js`
> **关联文档**：`02-css-extraction.md`（CSS 提取模式，🔧待执行）

## 1. 问题描述

用户反馈「重构后 CSS 比原版有问题」。对 `src/styles/*.css`（`?raw` 注入）
与 `archetype/jhs.user.js` 中对应 CSS 段做**字符级**对比，发现重构在提取
CSS 时普遍破坏了与原版运行时注入值的一致性，主要差异类别：

1. **`<style>` 包裹与首尾换行丢失**：原版 `N`/`E`/`F`/`a-normal`/
   `loading`/`logger`/`viewer` 的运行时值均以 `\n<style>\n` 开头、
   `\n</style>\n` 结尾；重构 `.css` 仅保留 CSS 体，丢失包裹与首尾空白，
   导致 `H()`/`insertStyle()` 走 `createElement+textContent` 分支而非原版的
   `insertAdjacentHTML` 分支（注入机制不一致）。
2. **CRLF 化**：`.css` 工作区为 `\r\n`，原版为 `\n`（原版 0 CRLF）。
3. **空白规范化破坏**：`background-color:#c4b1b1;`（冒号无空格）、
   `.main-tab-btn`/`.tool-box .jhs-icon` 行尾空格、空行缩进 `     ` 等被
   编辑器/格式化器剥离或改写。
4. **loading/logger/viewer 整体重排**：追加 `/** */` 文档注释头、缩进由
   12 空格改为 4 空格、值规范化（`rgba(255,0,0,0.6)`→`rgba(255, 0, 0, 0.6)`）。
5. **`generateScrollbarCss()`**：与原 `F` 内 IIFE 逻辑一致（已验证）。
6. **插件 `initCss` 拼接 bug**：`NewVideoPlugin.initCss` 返回
   `newVideoCssRaw + avatarSelectDialogCssRaw`，而 `newVideoCssRaw` 含
   `<style>`、`avatar-select-dialog.css` 不含；`insertStyle` 检测到
   `<style>` 即**不再包裹**，导致 avatar CSS 作为纯文本注入 head 而**不生效**
   （`SettingPlugin.initCss` 拼接 `helpDialogCssRaw` 同理）。原版这两段 CSS 是
   在 `searchAvatar`/帮助弹窗 `layer.open` 的 **content** 内随 `<style>` 块
   注入，并非 `initCss`。
7. **tooltip/image-preview 包裹错位**：重构以
   `` `<style>${cssRaw}</style>` `` 包裹注入，与原版
   `\n        <style>\n            ...\n        </style>\n    ` 完整串的空白不一致。

## 2. 修复方案

### 2.1 `.css` 文件逐字符对齐（共 24 个，LF，零偏差）

以原版运行时值为基准重写 `.css`，使其与原版注入值**字符级一致**：

| 文件 | 对齐基准（原版） | 占位/包裹 |
|------|------------------|-----------|
| `javbus-masonry.css` | `N`（L167） | `${M}`→`/*__HIDENAV__*/`，含 `<style>` |
| `javdb-site.css` | `E`（L173） | `${j}`→`/*__HIDENAV2__*/`，含 `<style>` |
| `common-toolbar.css` | `F`（L174-189） | IIFE→`/*__SCROLLBAR__*/`，含 `<style>` |
| `a-normal-buttons.css` | `H("...")`（L208） | 含 `<style>` |
| `loading.css` | `insertAdjacentHTML`（L2058） | 含 `<style>` |
| `logger.css` | `insertAdjacentHTML`（L2367） | 含 `<style>` |
| `viewer.css` | `insertAdjacentHTML`（L2154） | 含 `<style>` |
| `preview-video-plugin.css` | `PreviewVideoPlugin.initCss`（L3636） | 无 `<style>`（原版即无） |
| `actress-info-plugin.css` | `ActressInfoPlugin.initCss`（L4161） | 含 `<style>` |
| `nav-bar-plugin.css` | `NavBarPlugin.initCss`（L4730） | 无 `<style>`（原版即无） |
| `other-site-plugin.css` | `OtherSitePlugin.initCss`（L4878） | 含 `<style>` |
| `history-plugin.css` | `HistoryPlugin.initCss`（L6446） | 含 `<style>`（保留原 `</style` 闭合缺漏） |
| `auto-page-plugin.css` | `AutoPagePlugin.initCss`（L9081） | 含 `<style>` |
| `new-video-plugin.css` | `NewVideoPlugin.initCss`（L11040） | 含 `<style>` |
| `fold-category-plugin.css` | `FoldCategoryPlugin.initCss`（L4020） | `${e.highlightedTagNumber\|\|1}`→`__HIGHLIGHTED_TAG_NUMBER__`、`${e.highlightedTagColor\|\|"#ce2222"}`→`__HIGHLIGHTED_TAG_COLOR__` |
| `setting-plugin.css` | `SettingPlugin.initCss`（L9481） | `${a}`→`__CSS_TEXT__`、`${r?"35px":"25px"}`→`__SIMPLE_SETTING_TOP__`、`${r?"-300%":"0"}`→`__SIMPLE_SETTING_RIGHT__` |
| `avatar-select-dialog.css` | `searchAvatar` 的 `r`（L11401）`<style>` 块 | 含 `<style>`，原 `<style>` 块整体 |
| `help-dialog.css` | 帮助弹窗 content（L10040）`<style>` 块 | 含 `<style>`，原 `<style>` 块整体 |
| `rating-bar.css` | `_injectRatingStyles` `textContent` 模板（L5742） | CSS 体（`textContent`，无 `<style>`） |
| `back-to-top-button.css` | `addBackToTopBtn` `insertStyle` 模板（L9560） | CSS 体（`insertStyle` 自动包裹） |
| `tooltip.css` | `setupTooltip` `insertAdjacentHTML` 串（L2888） | 含 `<style>`（完整串） |
| `image-preview.css` | `injectStyles` 模板 `e`（L2252） | 含 `<style>`，`${this.config.*}`→`/*__Z_INDEX__*/`/`/*__TRANSITION__*/`/`/*__MAX_WIDTH__*/`/`/*__MAX_HEIGHT__*/` |
| `setting-image-mode-vertical.css` | `applyImageMode` `t`（L10052） | `${e}`→`/*__OBJECT_POSITION__*/`，CSS 体 |
| `setting-image-mode-horizontal.css` | `applyImageMode` `e`（L10059） | CSS 体 |

> 占位 `replace` 位置与原版 `${...}` 插值位置一一对应；动态插件运行时
> `replace` 结果与原版 `${...}` 求值结果字符级一致。

### 2.2 `main.tsx`

- `generateScrollbarCss()`（L97-113）与原 `F` 内 IIFE 逻辑完全一致，**无需改动**，
  仅通过 `common-toolbar.css` 的 `/*__SCROLLBAR__*/` 占位 `replace` 注入。
- `H()` 调用链不变（`N`/`E`/`F`/`aNormal`/`loading`/`viewer` 经 `H()` 注入）。

### 2.3 插件 `initCss` / 注入点调整

- `NewVideoPlugin.initCss`（`src/plugins/new-video-plugin.ts`）：移除
  `+ avatarSelectDialogCssRaw`，仅返回 `newVideoCssRaw`（与原版 `initCss`
  返回值一致）；avatar CSS 改由 `searchAvatar` 的 `layer.open content` 拼接：
  `content = avatarSelectDialogCssRaw + AvatarSelectDialog(...)`，复刻原版
  `r = <style>块 + HTML`，字符级一致。
- `SettingPlugin.initCss`（`src/plugins/setting-plugin.ts`）：移除
  `+ helpDialogCssRaw`，仅返回 `settingCssRaw` 经三处占位 `replace`（与原版
  返回值一致）；帮助弹窗 CSS 改由 `#helpBtn` 点击时 `layer.open content` 拼接：
  `content = helpDialogCssRaw + HelpDialog()`，复刻原版帮助 content。
- `src/core/tooltip.ts`：`insertAdjacentHTML` 改为直接注入 `tooltipCssRaw`
  （`.css` 已含 `<style>`，不再额外包裹）。
- `src/core/image-preview.ts`：`injectStyles` 改为直接注入 `css`
  （`.css` 已含 `<style>`，占位 `replace` 后直接 `insertAdjacentHTML`）。

## 3. 执行验证记录

### 3.1 字符级对比（node 脚本提取原版运行时值 vs `.css`）

```
✓ javbus-masonry / javdb-site / common-toolbar / a-normal-buttons /
  loading / logger / viewer                  — 一致（主 7）
✓ preview-video / actress-info / nav-bar / other-site / history /
  auto-page / new-video / fold-category / setting — 一致（插件 initCss 9）
✓ avatar-select-dialog / help-dialog         — 一致（弹窗 <style> 块）
✓ rating-bar / back-to-top / tooltip / image-preview /
  setting-image-mode-vertical / horizontal   — 一致（非 initCss 6）
✓ generateScrollbarCss() == 原 F IIFE        — 一致（len 1010）
```

全部 24 个 `.css` 与原版运行时注入值**零偏差**（LF，无 CR）。

### 3.2 构建

```
$ pnpm run build   # tsc -b && vite build
✓ 154 modules transformed
dist/monkey-jhs-disassemble.user.js  476.12 kB │ gzip: 116.82 kB
✓ built in 285ms
```

`tsc -b` 类型检查通过，`vite build` 打包通过（`.css` 经 `?raw` 以字符串内联，
`<style>` 标签不触发 CSS 解析）。

### 3.3 行尾持久性

`git ls-files --eol` 显示 `i/lf w/lf`（索引与工作区均为 LF），原版
`archetype/jhs.user.js` 亦为 LF（0 CRLF），LF 在本仓库 checkout 后保持，
无需新增 `.gitattributes`。
