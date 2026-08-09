# 01 重构与组件化（doc/01–24 融合）

> **文档类型**：📄 参考说明（历史文档阶段融合）
> **文档状态**：📄 参考
> **阶段范围**：doc/01–doc/24（重构总计划 → 渐进式拆分 → HTML→组件 → jsxToString/TSX → 库 ESM 迁移）
> **合并说明**：本文档由 `doc/` 下 01–24 共 24 份历史文档按时间线精简融合而成。删除构建命令输出回放、逐条验证步骤回放、边缘情况穷举推演与重复的产物记录；保留背景/根因、方案与关键决策、实施要点（模块/文件级）、结果（version 变化、产物体积、组件数量、测试/构建结果）与演进链。文中 "(doc/NN)" 为历史事件标识，指向原 `doc/NN-*.md`。
> **前置文档**：无
> **替代文档**：doc/01–24（原文件随后删除）

## 阶段概览

doc/01–24 是项目重构第一阶段：把单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）渐进式拆分为 vite-plugin-monkey + React + TypeScript + SWC 工程。先以 legacy 过渡载体完成常量/CSS/核心模块/21 插件的外置，再按「组件返回 HTML 字符串」统一规定把全部注入用 HTML 转为函数组件，随后引入轻量 `jsxToString` 渲染器将 60+ 组件逐个升级为 TSX 原生 React 组件，最后把 7 个外部库由 `@require` CDN 注入改为 ESM 打包进产物。全程坚持「打包产物与原脚本零偏差」硬约束，每步以 `tsc -b && vite build` 验证，产物从 459.58 kB 演进至 1202.82 kB（库打包后）。

> 时间线说明：doc/01 为总计划文档，其「进度」章节是在整个重构推进过程中持续更新的，记录了 legacy 最终删除后的状态；doc/03–05 记录的是各批次的中间态（当时 legacy 仍在），两份视角存在时间重叠而非矛盾。

## 1. 重构总计划（doc/01）

### 1.1 背景与目标

将 `archetype/jhs.user.js`（11605 行混淆脚本）拆分重构为 `vite-plugin-monkey` + React + TypeScript + SWC 工程。硬约束：**打包产物功能逻辑、执行效果、执行顺序与原始脚本零偏差**。

### 1.2 原脚本架构分析

**脚本头部**（已迁入 `vite.config.ts` userscript）：

| 项 | 值 |
|----|----|
| match/include | `https://javdb.com/*` / `https://javdb*.com/*` |
| run-at | `document-idle` |
| @require | 9 个 CDN 库：parallel_GM_xmlhttpRequest、jquery、tabulator-tables、layui-layer、blueimp-md5、toastify-js、localforage、viewerjs、qrcodejs |
| @grant | GM_xmlhttpRequest、GM_openInTab、GM_setValue、GM_addValueChangeListener、unsafeWindow |
| @connect | xunlei.com、missav.live、javdb.com、supjav.com、127.0.0.1、* |

**全局对象**（运行时挂到 window/unsafeWindow）：

| 全局名 | 原定义 | 说明 |
|--------|--------|------|
| `utils` | `new J()` (CommonUtil) | 工具集：openPage/setupEscClose/importResource/q/formatDate/download/gmRequest 等 |
| `storageManager` | `new z()` (StorageManager) | IndexedDB/localforage 封装：carList/blacklist/favoriteActress/setting 等 |
| `gmHttp` | `new (class {...})()` | 网络请求：get/post/postForm/downloadFileInChunks/gmRequest |
| `show` | `{ok,error,info}` | Toastify 封装 |
| `loading` / `clog` | `function()` / `new o()` (Logger) | 加载动画 / 日志面板 |
| `pluginManager` | `new PluginManager()` | 插件管理器 |
| `refresh` | BroadcastChannel 回调 | 跨标签页刷新 |

**启动序列**（原 L11488-11564）：`utils.importResource(...)` 注入 4 个库 CSS（layui/toastify/viewer/tabulator）→ 包装 `layer.open`/`layer.close`（ESC 关闭 + overflow 处理）→ `new PluginManager()` → `unsafeWindow.pluginManager`；若 `isJavdbSite` 注册 21 个插件 → `processCss()`（各插件 `initCss` 注入 CSS）→ 异步 IIFE：设置 `window.isDetailPage/isListPage/isFc2Page` → `storageManager.merge_*()` 数据迁移序列 → 中文语言检查 → `processPlugins()`（各插件 `handle`）。

**插件清单**（注册顺序）：ListPagePlugin、AutoPagePlugin、FoldCategoryPlugin、ListPageButtonPlugin、HistoryPlugin、SettingPlugin、NavBarPlugin、HitShowPlugin、Top250Plugin、DetailPagePlugin、ReviewPlugin、DetailPageButtonPlugin、HighlightMagnetPlugin、PreviewVideoPlugin、FilterTitleKeywordPlugin、ActressInfoPlugin、OtherSitePlugin、WantAndWatchedVideosPlugin、BlacklistPlugin、FavoriteActressesPlugin、NewVideoPlugin。

**状态模型**：动作类型 `filter`/`favorite`/`hasWatch`，展示文本/颜色 屏蔽/收藏/已观看，布尔 `no`/`yes`，站点/类别 javdb/javbus/actor/actress/censored/uncensored，均已提取至 `src/constants/`。注：`hasDown`（已下载）状态已在原脚本历史中删除，勿再引入。

### 1.3 重构策略：渐进式整体迁移

1. **过渡载体**：原脚本原样迁入 `src/legacy/jhs.ts`（`@ts-nocheck`），立即可以打包且功能等价；`main.tsx` 仅 `import './legacy/jhs'` 触发执行。
2. **逐步提取**：从 legacy 按模块提取为正式 TS 文件，legacy 顶部以 `import { 语义名 as 原混淆名 }` 别名导入并删除原定义，legacy 逐步缩减。
3. **每步验证**：每次提取后 `pnpm run build` 验证可打包，git commit 跟踪。
4. **零偏差保障**：提取只做结构/类型/命名/CSS 拆分，不改控制流、不改执行顺序、不改副作用；CSS 用 `?raw` 字符串导入 + 原注入点保持顺序。

### 1.4 提取模式

- **常量提取**：纯数据常量 → `src/constants/*.ts`，legacy 别名导入（示例 `o→currentHref`、`r→isJavdbSite`、`d→FILTER_ACTION`、`L→VIDEO_QUALITY_LIST`）。
- **CSS 提取**：→ `src/styles/*.css` + `?raw`，原注入点改用 `xRaw`；含插值 CSS 用占位注释 `/*__TOKEN__*/` + replace（详见 doc/02）。
- **模块提取**：类/函数 → `src/core/*.ts`、`src/plugins/*.ts`；类型先 `any`/最小声明保证编译，后续逐步收紧。
- **HTML 字符串 → React 组件**：相对独立的静态/半静态 HTML 模板提取为 `src/components/*.tsx` 组件，返回 HTML 字符串供 layer/jQuery 消费；深度耦合 layer content 的动态 HTML 先提取为模板模块，待逻辑稳定后再组件化。原则：不破坏 layer/jQuery 消费契约。
- **命名优化**：全局/类成员/导出符号语义命名；单字母全局与局部同名时用别名避免误替换。

### 1.5 目录结构（规划）

```
src/
  main.tsx              入口（完整启动序列，强类型，无 @ts-nocheck）
  types/globals.d.ts    全局类型声明（@require 库、GM API、应用全局）
  constants/            常量（site/status/video-quality）
  resources/            CDN 资源清单、KV store 名
  styles/               提取的独立 CSS 文件（?raw 导入）
  core/                 基础设施（utils/storageManager/gmHttp/show/loading/clog/hotkey/imagePreview/viewer）
  plugins/              插件（PluginManager/BasePlugin + 21 插件）
  components/           React 组件 / HTML 模板（由原 HTML 字符串转换）
archetype/              原始脚本与历史文档（只读参考）
doc/                    迁移文档
```

### 1.6 一致性校验纪律（每次改代码后自查）

1. 插件清单：新增/删除/重命名插件类 → 同步插件清单（以注册序列为准）。
2. 状态模型：新增/删除状态常量 → 同步状态模型（`hasDown` 已删，勿再引入）。
3. 脚本头部：新增 `@grant`/`@connect`/`@require`/`@match` → 同步 `vite.config.ts`。
4. 设计决策：引入跨插件机制/同步链路 → 追加到文档；失效决策删除。
5. 外部行为变更（API 格式、错误码、配置项）→ 同步文档。

### 1.7 阶段结果与遗留

- 完成：脚手架（`pnpm create monkey` react-swc-ts）+ 整体迁移 + 全局类型声明 + 常量提取（site/status/video-quality/api/tabulator-zh）+ CSS 提取（5 顶层 + 9 插件）+ core 15 个模块 + 插件系统（base-plugin/plugin-manager）+ 21 插件外置 + 资源/API 提取 + build 脚本修复（`package.json` build 改为 `tsc -b && vite build` 真实类型检查）。验证：`tsc -b && vite build` 通过，59 modules，产物 459.58 kB（gzip 114.41 kB）。
- legacy 最终删除，启动序列整体迁入 `src/main.tsx`（367 行，强类型，无 `@ts-nocheck`），工程全量去 `@ts-nocheck`。
- 遗留：HTML 字符串 → React 组件的持续组件化（已示范性转换 3 个组件：`menu-button-box`/`rating-bar`/`status-tag`）——即后续 doc/06–23 的工作。

## 2. CSS 提取模式（doc/02）

**目标**：将散落在 legacy 中的内联 CSS 字符串提取为 `src/styles/*.css` 独立文件，`?raw` 导入后在原注入点注入，执行顺序与原脚本零偏差。

**三种模式**：

| 模式 | 适用 | 做法 |
|------|------|------|
| 2.1 纯静态 | `H("<style>...</style>")` / `insertAdjacentHTML` | CSS 去掉 `<style>` 包裹、`\n` 转真实换行写入 .css；原注入点改 `H(xxxCssRaw)`（H 自动包裹 `<style>`） |
| 2.2 含运行时插值 | `` `<style>...${M}...</style>` ``（条件追加片段） | .css 用占位注释 `/*__TOKEN__*/`，运行时 `xxxCssRaw.replace("/*__TOKEN__*/", M)` |
| 2.3 含运行时生成逻辑 | IIFE 生成滚动条 CSS | 静态部分 + `/*__SCROLLBAR__*/` 占位，IIFE 命名为 `generateScrollbarCss()` 后 replace |

**待提取清单（规划）**：

- 顶层全局 CSS：JavBus masonry 布局（`N`，含插值 `${M}`）、JavDb 站点样式（`E`，含 `${j}`）、通用工具栏/表格（`F`，IIFE 滚动条）、a-normal 按钮组（纯静态）、hideNav 片段（`M`/`j`，并入 N/E 占位）。
- 插件 `initCss`：DetailPagePlugin、PreviewVideoPlugin、FoldCategoryPlugin、ActressInfoPlugin、NavBarPlugin、OtherSitePlugin、AutoPagePlugin、SettingPlugin、NewVideoPlugin、HistoryPlugin 等 → 随插件外置同步提取到 `src/styles/<plugin>.css`（后续完成于 doc/13–14）。
- 内联样式：ImagePreview `injectStyles()`、Logger `createContainer()`、各 `layer.open content` 内联 style → 提取对应 core/插件/组件时同步处理。

**注意事项**：CSS 必须在原注入点注入（`H()`/`processCss`/`importResource`），不可改 `main.tsx` 顶层 `import './x.css'`，否则注入顺序与原始脚本不一致；4 个库 CSS（layui/toastify/viewer/tabulator）为外部 `<link>`，保留 `importResource` 机制不提取；`?raw` 类型由 `vite-env.d.ts`（reference vite/client）提供。

**进展**：已提取 `loading.css`（纯静态模式）。

## 3. 插件系统外置（doc/03–04）

**背景**：legacy 内含若干 `class XxxPlugin extends BasePlugin` 内联定义，逐个外置为 `src/plugins/<kebab-name>.ts` 独立模块，legacy 仅保留 import 与 `e.register(...)` 注册调用。

**集成模式**（每插件串行、独立 build + commit）：grep 定位类定义当前行号（legacy 已有位移，以实测为准）→ `sed` 删除整段 class 定义 → 顶部 import 区追加 import → 注册序列不变（同名 import 解析）→ build 通过后 commit；失败 `git checkout src/legacy/jhs.ts` 回滚。插件模块此前为未跟踪文件，commit 时一并 `git add` 纳入版本库（不改插件源码）。

### 3.1 首批 4 插件（doc/03）

| 插件 | legacy 删除范围 | 原型 archetype 行 | build | commit |
|------|----------------|-------------------|-------|--------|
| DetailPagePlugin | L417-453（37 行） | L3332-3368 | 25 modules · 428.34 kB | `f1a34be` |
| FilterTitleKeywordPlugin | L4252-4288（37 行） | L7286-7322 | 26 modules · 428.46 kB | `8ad5e86` |
| HighlightMagnetPlugin | L894-982（89 行） | L3927-4015 | 27 modules · 428.94 kB | `7bc8a51` |
| FoldCategoryPlugin | L895-1017（123 行） | L4016-4138 | 28 modules · 429.51 kB | `37d1e48` |

要点：HighlightMagnetPlugin 的残留引用 `this.getBean("HighlightMagnetPlugin")`（L2032）为运行时按名查找，因 `getName()` 返回同名字符串仍可解析，无需改动。

### 3.2 最终批次 3 插件（doc/04）

继首批及此后多批次（AutoPage、Blacklist、WantAndWatchedVideos、FavoriteActresses、NewVideo、History 等）之后，本批次为最终 3 个插件，删除顺序「先删后段」减少行号位移干扰（每步仍 grep 重新确认）。

| 插件 | legacy 删除范围 | 原型 archetype 行 | build | commit |
|------|----------------|-------------------|-------|--------|
| SettingPlugin | L3172-4307（1136 行） | L9429-10564 | 42 modules · 441.23 kB（gzip 108.25） | `cfb8720` |
| DetailPageButtonPlugin | L928-2250（1323 行） | L5118-6440 | 43 modules · 444.20 kB（gzip 108.81） | `b9af9f4` |
| ListPagePlugin | L929-1719（791 行） | L8279-9069 | 44 modules · 449.83 kB（gzip 110.13） | `56f7d14` |

### 3.3 结果

- 21 个插件中 **20 个外置**为 `src/plugins/` 独立模块，仅 `PreviewVideoPlugin`（预览视频解析器）保留内联。
- legacy 4426→1179 行（本批次净减 3247 行含 3 import）；产物 449.83 kB（gzip 110.13 kB）。
- 遗留：如需进一步外置 PreviewVideoPlugin 可按同一模式独立执行。

## 4. legacy 辅助代码提取到 core（doc/05）

**背景**：legacy（573 行）在插件/CSS/常量外置后仍残留三组与启动序列无关的可复用辅助代码，提取为正式 core 模块，legacy 仅保留启动序列与 CSS replace 胶水。

| 残留代码 | 原位置 | 目标模块 | 导出 |
|---------|--------|---------|------|
| `layer.open`/`layer.close` 包装（关闭后恢复 overflow、open 后挂 ESC） | 原 L474-495 | `src/core/layer-wrapper.ts` | `setupLayerWrapper()` |
| Tooltip 定位 + 注入样式 + hover 事件 IIFE | 原 L312-441 | `src/core/tooltip.ts` | `positionTooltip()` / `setupTooltip()` |
| WebDav 加密辅助 + salt | 原 L450-470 | `src/core/webdav-crypto.ts` | `Me` / `Ne` / `Le` |

**修改方案要点**：

- `layer-wrapper.ts`：`resetOverflowByShadeCount(delay=10)` 依据 `.layui-layer-shade` 计数延迟恢复 `documentElement.style.overflow`；`setupLayerWrapper()` 保存并包装原 `layer.close`/`layer.open`——close 先调原实现再重置 overflow，open 先保存原 success、新 success 先执行原 success 再 `utils.setupEscClose(index)`，控制流与原脚本一致。
- `tooltip.ts`：`TooltipableElement`（extends HTMLElement，挂 `tooltipElement`/`hoverTimeout`）、`TooltipDirection` 类型、`createTooltipElement(content)` 建 `.js-tooltip` 并 append body；`positionTooltip` 量尺寸→依方向计算坐标→空间不足且对侧容纳时翻转→视口夹紧→写 left/top + is-active；`setupTooltip()` 注入 TOOLTIP_CSS 并绑定 document mouseover/mouseout（命中 `[data-tip-*]` 延迟 50ms 显示，mouseout 清 timeout 移除）。
- `webdav-crypto.ts`：`Le`（salt）、`Me`（码点 +5 加密）、`Ne`（码点 -5 解密 + 去 salt）；保留原 NaN 时 `String.fromCodePoint` 抛 RangeError 行为。
- legacy 调整：tooltip IIFE → `setupTooltip()`；webdav 定义块 → 仅保留 `unsafeWindow.Me/Ne` 挂载（setting-plugin 仍以 `(window as any).Me/.Ne` 访问）；layer 包装块 → `setupLayerWrapper()`。

**未提取说明**：`me = "jhs_appAuthorization"` 为 legacy 内死代码（未被引用，constants/api 与 top250 各自保留同名常量），直接删除；`BroadcastChannel("channel-refresh")` + `window.refresh`/`cleanCache_*` 属启动序列的全局函数挂载，与启动耦合、提取收益小，保留在 legacy。

**结果**：legacy 573→405 行（-168）；新增 core：layer-wrapper 56 行 / tooltip 178 行 / webdav-crypto 38 行；产物 462.66 kB（gzip 113.30 kB）。

## 5. HTML 字符串 → 函数组件（doc/06–13）

### 5.1 统一规定：返回 HTML 字符串、移除 react-dom/server（doc/06）

**背景/根因**：`main.tsx` 提取 `TemporaryImageContainer` 时引入 `import { renderToStaticMarkup } from "react-dom/server"`，将组件 JSX 转为 HTML 字符串供 `$(html)` 消费。该导入将 react-dom/server 整包打入产物，产物从 459.58 kB 膨胀至 911 kB（+98%）；vite-plugin-monkey 无法 tree-shake 掉其内部模块。

**统一规定**（后续所有 HTML→组件转换遵循）：

- 组件为普通函数，返回 HTML 字符串（模板拼接，含 `${props.x}` 插值）；
- **不用 JSX、不用 renderToStaticMarkup**；
- 文件可用 `.ts`（无 JSX）或 `.tsx`（但无 JSX 语法）；
- 插件 `layer.open({ content })` 直接用 `ComponentName(props)` 返回的字符串；
- 属性值不做转义，与原始 jQuery `.append(htmlString)` 行为一致（零偏差）。

**修改方案**：`temporary-image-container.tsx` 函数签名由返回 JSX 改为返回 `string`（删除 `CSSProperties` import 与 `CONTAINER_STYLE` 常量，保留 props 接口与 doc-comment）；`main.tsx` 删除 react-dom/server import，`showImageViewer` 调用点由 `$(renderToStaticMarkup(<TemporaryImageContainer .../>))` 改为 `$(TemporaryImageContainer({ src, alt }))`。移除后 main.tsx 不再含 JSX，仅 `react`（由三个示范组件引用）保留。

**结果**：产物回落至 458.24 kB（gzip 114.26 kB），膨胀消除。残留：menu-button-box/rating-bar/status-tag 三个示范组件的文档注释仍将 renderToStaticMarkup 作为推荐用法（范围外，后随 doc/17/20 删除示范组件而消失）。

### 5.2 插件弹窗组件（doc/07–10）

**模式**：各插件 `layer.open` 内联 content 逐批提取为组件——HTML 结构/id/内联 style/`\n` 转义与缩进原样保留（零偏差），动态值改 props 注入，success/yes 回调事件绑定仍由插件持有（组件只负责静态结构）。

| doc | 插件 | 组件（新文件） | 要点 | 产物 |
|-----|------|---------------|------|------|
| 07 | top250 | `login-dialog.ts` LoginDialog | 登录表单（username/password/loginBtn + 内联 style 与 onfocus/onblur/onmouseover/onmouseout 内联 JS，字符串内 `\n`/`\'` 转义）转组件，无 props，静态；前导/尾部空白原样保留 | 458.18 kB（63 modules） |
| 08 | detail-page-button | `subtitle-table-dialog.ts` SubtitleTableDialog / `subtitle-preview-dialog.ts` SubtitlePreviewDialog | 迅雷字幕表格挂载容器（`#xunlei-table-container`，供 Tabulator 挂载）+ 深色等宽预览弹窗（`content` props 注入正文字符串）；预览组件含动态值故用 props | 458.34 kB（65 modules） |
| 09 | history | `history-dialog.ts` HistoryDialog / `edit-record-dialog.ts` EditRecordDialog | 8 处状态文案/颜色 props（blockedText/favoritedText/watchedText 等）；8 处记录字段/样式/`statusOptions.map` 嵌套模板 props；`.map` 回调 `: any` 改推断类型；闭合标签缺漏原样保留 | 458.99 kB（67 modules） |
| 10 | new-video | `new-video-dialog.ts` / `edit-actress-dialog.ts` / `cdn-select-dialog.ts` / `avatar-select-dialog.ts` | 4 弹窗（新作品检测面板 / 编辑女优表单 / CDN 源选择 / 头像选择网格）；searchAvatar 弹窗内嵌 `<style>` 提取为 `avatar-select-dialog.css` 由 `initCss` 拼接注入（后被 doc/14 修正）；`CdnSelectSource` 结构兼容 `GfriendsSource` 子集、插件直接传 `GFRIENDS_SOURCES` 不需适配 | 460.16 kB（77 modules） |

**doc/10 四弹窗细节**：`NewVideoDialog`（工具栏：`#checkNewVideoMsg` 计数 span + `#paramActressType` 类型下拉 + `#reLoad` 刷新按钮内嵌 `refreshSvg` SVG 图标；`#actress-card-container` 卡片网格 + `#actress-pagination` 分页容器，仅 `refreshSvg` 一处动态值）；`EditActressDialog`（`#edit-avatar-preview` 头像预览 + `#edit-actress-avatar` 输入框 + 搜索头像/选择 CDN 双按钮 + `#edit-actress-name`/`#edit-actress-allname`/`actressType` 下拉/`#edit-actress-newvideolist`/`#edit-remark`，七处动态值 avatar/name/textareaStyle/allNameText/actressType/newVideoText/remark）；`CdnSelectDialog`（`cdn-${index}` 单选组 + jsdelivr `(推荐)` 标记 + 当前源默认 `checked`，sources/currentIndex 两处动态值）；`AvatarSelectDialog`（`#gfriends-prompt` 标题显示初始张数 + `#gfriends-image-list` 内 `wrapper-${index}` 头像网格，含 data-url/data-wrapper-id/data-size-for 属性，avatarUrls 一处动态值）。

### 5.3 列表页与黑名单组件（doc/11–12）

**doc/11**：`list-page-button-plugin` 与 `list-page-plugin` 共 7 处 HTML 模板（`.append`/`.prepend`/`.wrap`/`$(html)`/`clog.log` 消费）转 5 个组件：

| 组件 | 替换位置 | 要点 |
|------|---------|------|
| `MenuButtonBoxHtml` | JavDb/JavBus 菜单按钮组（javdb 两行 / javbus 单行） | site/blacklistLabel/actorsPage/tagsPage/advancedSearch/searchOrUserPage/sortLabel/newVideoCount/starPage 多 props；flex-grow 计算移入组件内 |
| `StatusTagHtml` | renderItemStatusTag + filterMovieList 两处 status-tag | `variant: "render" \| "filter"` 区分字符级差异的两套模板（render `position:absolute;\n` 无尾空格；filter 有尾空格）；JavBus `<a>+<span>` 变体仅 filter 一处 |
| `VideoTitleSpan` | fixBusTitleBox `.wrap(html)` | 单 props imgTitle |
| `JumpPageControl` | addJumpPageControl 跳页控件 | 原 `$("<input>",{...})` 链式创建改为一次 `$(JumpPageControl(...))` 再 `$li.find` 取回绑定 |
| `PageCountTable` | filterMovieList `clog.log(html)` 统计表格 | 4 列耗时 + 屏蔽/收藏/演员/关键词/已观看/待鉴定/总数 |

要点：与既有 JSX 示范组件（`menu-button-box.tsx`/`status-tag.tsx`）内容等价，示范保留不动作为可选参考（后于 doc/17 删除）。结果：产物 463.84 kB（+3.68 kB，+0.80%）；两插件残留 HTML 核查无匹配。（过程备注：曾因 `fixBusTitleBox` 的 `.wrap` edit 错位触发 TS1128 语法错误，修正后通过。）

**doc/12**：`blacklist-plugin` 剩余 8 处零散 HTML 转 8 个组件：

| 组件 | 来源 | props |
|------|------|-------|
| `BlacklistConfirmMessage` | addBlacklist confirmMessage 拼接 | tagName/name/isAlreadyBlacklisted/isActress/notFirstPageByQuery/notFirstPageByJavbus |
| `BlacklistDataTypeOptions` | getTableData `$dataTypeSelect.html(...)` | totalCount/actorCount/actressCount |
| `BlacklistNameCell` / `BlacklistUrlTypeCell` / `BlacklistStatusCell` / `BlacklistActionCell` | loadTableData 4 个 Tabulator formatter | url/name；hasTag；tipText/statusText；无 |
| `MovieListWrapper` | filterActorVideo wrapperHtml | html/nextUrl |
| `BlacklistPaginationCounter` | loadTableData paginationCounter | actorCount/currentCarCount |

要点：原两个独立「非第一页」`if` 判定逻辑保留在插件，结果以布尔 prop 传入，组件内仍以两个独立 `if` 各自追加（两者皆成立时追加两次相同 br 注意，与原脚本一致）；类型修复 `tagName: string | undefined` → `string = ""`（演员分支保持空串，组件 isActress=true 时不读）。结果：产物 465.42 kB（+1.58 kB）；剩余字符串字面量均为纯文本/toast 文案/Tabulator 文案（非 HTML，不转换）。

### 5.4 剩余注入用 HTML 全面转组件 + CSS 提取（doc/13）

**背景**：全面扫描 `src/` 剩余 `$(html)` / `.html()` / `.append()` / `.prepend()` / `.before()` / `.after()` / `innerHTML =` / `layer.open content` / Tabulator formatter 等注入点，统一转组件；内联 `<style>` 提取为 `.css` + `?raw`。

**实施要点**：

- **plugins 全面转组件**：hit-show（RankingContainers 与 top250 共享、HitShowToolBar、HitShowScore、HitShowMovieItem）、top250（Top250NavLink、Top250Pagination、Top250ErrorMessage/LoadError、Top250ToolBar+YearButton）、nav-bar（NavSearchBox、NavOtherDropdown）、new-video（NewVideoDialogTitle、ActressCard、ActressPagination）、other-site（OtherSiteBox+Btn、SiteResultTag 与 preview-video 共享、OtherSiteCheckbox）、preview-video（PreviewVideoContainer、QualityBtn、ActionBtn）、review（ReviewHeader/Containers/Loading/Error/Empty/LoadMore/End/LinkContent/Item）、setting（SettingMountBox 变体、BackToTopButton、CacheItemHtml、VideoQualityOption、SimpleSettingPanel、KeywordLabel）、history（HistorySourceCell、HistoryStatusCell）、want-and-watched（WantWatchedImportButton、WantWatchedHintSpan）。
  > 原文数量矛盾提示：doc/13 执行记录称「新增 26 组件 + 5 CSS」，但其自身清单表列出的转换点多达约 40 处（含共享组件与 core 3 个），两数对不上，以清单为准。
- **core**：image-preview 的 `injectStyles` `<style>`（4 处运行时插值）→ `image-preview.css` + 占位 replace；tooltip TOOLTIP_CSS → `tooltip.css`；logger `_createLogElement` → `LoggerLogEntry`。
- **CSS 提取 5 个**：image-preview.css（占位 replace 模式）/ tooltip.css（纯静态）/ back-to-top-button.css（纯静态，经 `utils.insertStyle` 注入）/ setting-image-mode-vertical.css（`/*__OBJECT_POSITION__*/` 占位）/ setting-image-mode-horizontal.css（纯静态）。

**未转换项（豁免）**：

1. jQuery `$("<div></div>")` 空元素创建（等价 createElement，随后 `.css()` 设样式）——非模板注入。
2. storage-manager `clog.log('<span style="color:#f40">...')` 日志内联着色片段——消息内容格式化，非结构化 UI 模板。
3. logger 日志消息 URL 链接化与对象 JSON 换行——消息内容变换。
4. `utils.q` 确认对话框消息内联格式片段——对话框正文内容。
5. `common-util.insertStyle` 注入 helper 本身（等价 main.tsx 的 `H()`）。
6. doc-comment 中的 HTML 字面量——注释说明，非注入。

**结果**：产物 468.96 kB（gzip 117.99 kB）；运行时无裸 HTML 模板注入。

## 6. CSS 字符级对齐原版（doc/14）

**背景/根因**：用户反馈「重构后 CSS 比原版有问题」。对 `src/styles/*.css`（`?raw` 注入）与 `archetype/jhs.user.js` 对应 CSS 段做字符级对比，发现 7 类差异：

1. **`<style>` 包裹与首尾换行丢失**：原版 `N`/`E`/`F`/a-normal/loading/logger/viewer 运行时值均以 `\n<style>\n` 开头、`\n</style>\n` 结尾；重构 `.css` 仅保留 CSS 体，致 `H()`/`insertStyle()` 走 `createElement+textContent` 分支而非原版 `insertAdjacentHTML` 分支（注入机制不一致）。
2. **CRLF 化**：`.css` 工作区 `\r\n`，原版 `\n`（0 CRLF）。
3. **空白规范化破坏**：`background-color:#c4b1b1;`（冒号无空格）、`.main-tab-btn`/`.tool-box .jhs-icon` 行尾空格、空行缩进被编辑器/格式化器剥离或改写。
4. **loading/logger/viewer 整体重排**：追加 `/** */` 注释头、缩进 12→4 空格、值规范化（如 `rgba(255,0,0,0.6)`→`rgba(255, 0, 0, 0.6)`）。
5. **插件 `initCss` 拼接 bug**：`NewVideoPlugin.initCss` 返回 `newVideoCssRaw + avatarSelectDialogCssRaw`，而前者含 `<style>`、后者不含——`insertStyle` 检测到 `<style>` 即不再包裹，avatar CSS 作为纯文本注入 head **不生效**（`SettingPlugin` 拼接 `helpDialogCssRaw` 同理）。原版这两段 CSS 是在 `searchAvatar`/帮助弹窗 `layer.open` 的 **content** 内随 `<style>` 块注入，并非 `initCss`。
6. **tooltip/image-preview 包裹错位**：重构以 `` `<style>${cssRaw}</style>` `` 包裹注入，与原版 `\n<style>\n...\n</style>\n` 完整串的空白不一致。
7. `generateScrollbarCss()` 与原 `F` 内 IIFE 逻辑一致（已验证，无需改动）。

**修复方案**：

- **24 个 `.css` 逐字符对齐**（LF，零偏差）：以原版运行时值为基准重写，占位 `replace` 位置与原版 `${...}` 插值一一对应：

| 分组 | 文件 | 对齐基准（原版） | 占位/包裹 |
|------|------|------------------|-----------|
| 顶层 7 | javbus-masonry / javdb-site / common-toolbar / a-normal-buttons / loading / logger / viewer | `N`/`E`/`F`/`H("...")`/`insertAdjacentHTML` | 含 `<style>`；`/*__HIDENAV__*/`/`/*__HIDENAV2__*/`/`/*__SCROLLBAR__*/` |
| 插件 initCss 9 | preview-video / actress-info / nav-bar / other-site / history / auto-page / new-video / fold-category / setting | 各插件 `initCss` | 含 `<style>` 与否跟随原版；fold-category `__HIGHLIGHTED_TAG_NUMBER__`/`__HIGHLIGHTED_TAG_COLOR__`、setting `__CSS_TEXT__`/`__SIMPLE_SETTING_TOP__`/`__SIMPLE_SETTING_RIGHT__` |
| 弹窗 `<style>` 块 2 | avatar-select-dialog / help-dialog | `searchAvatar` 的 `r` / 帮助弹窗 content | 含 `<style>`，原块整体 |
| 非 initCss 6 | rating-bar / back-to-top-button / tooltip / image-preview / setting-image-mode-vertical / -horizontal | `_injectRatingStyles`/`addBackToTopBtn`/`setupTooltip`/`injectStyles`/`applyImageMode` | 按原注入方式（textContent 无 `<style>` / insertStyle 自动包裹 / 完整串 / 占位 replace） |

- **插件注入点调整**：`NewVideoPlugin.initCss` 移除 `+ avatarSelectDialogCssRaw`（仅返回 `newVideoCssRaw`），avatar CSS 改由 `searchAvatar` 的 `layer.open content` 拼接（复刻原版 `<style>块 + HTML`）；`SettingPlugin` 同理，帮助弹窗 CSS 改由 `#helpBtn` 点击时 content 拼接。
- **tooltip/image-preview**：直接注入已含 `<style>` 的 cssRaw，不再额外包裹。

**验证与结果**：node 脚本提取原版运行时值 vs `.css` 字符级对比，全部 24 个 `.css` 零偏差（LF 无 CR）；`generateScrollbarCss()` 与原 `F` IIFE 一致（len 1010）；`git ls-files --eol` 确认 LF 保持，无需 `.gitattributes`。产物 476.12 kB（gzip 116.82 kB）。

## 7. RelatedPlugin 对照 archetype 校准（doc/15）

**背景**：archetype 应用完整 `RelatedPlugin` 类（commit `66b2fdf`）后，重构侧 `related-plugin.ts` + `related-*.ts` 此前按「原版文档要点 + ReviewPlugin 对称模式」构建（当时 archetype 未含原始代码），对照校准发现 8 处偏差。

**修复项**：

- 头部文案 `📁 相关清单` → `相关清单`（archetype L10602 无 emoji）；
- 折叠头 `#relatedFold` 与重试 `#retryFetchRelateds` 链接色 `#1890ff` → `#1897ff`（archetype L10602/L10651）；
- 条目内联 style 补齐（对照 archetype L10702）：创建时间 span 加 `position:absolute;bottom:5px;right:10px;color:#999;font-size:12px`、名称链接补 `color:#2e8abb`、视频个数/收藏查看 `<p>` 补 `margin-top:5px`；
- 默认折叠状态 `enableLoadRelated` 默认 `YES` → `NO`（archetype L10598 默认折叠、首次展开才拉取；重构原依 ReviewPlugin 对称取 YES）。

**保留项**：`簽名已過期` 提示 + `clog.error` 为项目对称增强（与 review-plugin 一致；archetype 仅有 `console.error`），不回退。

**无需改动（已与 archetype 一致）**：DOM ID（relatedFold/relatedContainer/relatedFooter/relatedLoading/retryFetchRelateds/loadMoreRelateds/relatedEnd）；文案（获取清单中.../获取清单失败+重试/加载更多清单/已加载全部清单/无清单/加载中.../加载失败, 请点击重试）；容器/空态/结尾/加载更多/加载中模板字符串；条目字段（`#序号` floorIndex++ / `创建时间: {createTime}` / `/lists/{relatedId}`+`{name}` / `视频个数: {movieCount}` / `收藏次数: {collectionCount} 被查看次数: {viewCount}`）。

**结果**：校准提交 `ec41b55` 仅改 4 文件：related-header.ts / related-error.ts / related-item.ts / related-plugin.ts（+21/-17）；产物 483.49 kB（gzip 118.66 kB）。

## 8. jsxToString 与 TSX 迁移（doc/16–23）

### 8.1 轻量 jsxToString（doc/16）

**背景**：doc/06 的「组件返回 HTML 字符串、禁用 JSX」规定牺牲了 JSX 的类型安全与可组合性（条件渲染/列表渲染清晰、与 React 生态对齐）。需要**不引入 react-dom/server** 的轻量 JSX→HTML 渲染器。

**方案**：新建 `src/core/jsx-to-string.ts`，`jsxToString(node: ReactNode): string`，仅依赖 react 的**类型**（`import type`），运行时零依赖。适用范围：**纯函数组件**（无 hooks/state/effects，返回同步 ReactNode）。

处理规则：

- 函数组件：`(el.type as Function)(el.props)` 递归调用（纯函数组件，无 hooks）；
- DOM 元素：`<tag attrs>children</tag>`；void 元素（img/input/br/hr/meta/link）自闭合输出 `<tag attrs />`；
- Fragment：透明拼接 children；文本/数字：`String()`，文本转义 `&` `<` `>`（不转义 `"`）；数组：map 拼接；null/boolean/undefined/bigint/Promise/Portal：`''`。

属性处理：

| 属性 | 输出 | 说明 |
|------|------|------|
| `className` | `class` | React 属性名映射 |
| `style` 对象 | CSS 字符串 | camelCase→kebab-case（`{backgroundColor:'red'}`→`background-color:red`） |
| `style` 字符串 | 原样 | 不作解析 |
| `data-*` / `aria-*` / 其他 | `key="value"` | 原样输出 |
| 布尔 `true` | 裸属性 | 如 `disabled` |
| 布尔 `false` / `null` / `undefined` | 省略 | 不输出该属性 |
| `on*` 事件 | 忽略 | 事件由 jQuery/插件绑定 |

**与 doc/06 的关系（演进链）**：doc/06 已执行定稿不可改，其规定在「无轻量渲染器」前提下成立；doc/16 仅对 `TemporaryImageContainer` **一个组件**反转「返回 HTML 字符串」子规定，改回 JSX 函数组件，doc/06 规定对其余组件仍生效（后续每反转一个组件新建一份独立文档）。

**验证**（临时测试脚本，6 类用例）：

| # | 用例 | 输出要点 | 结论 |
|---|------|---------|------|
| 1 | `<TemporaryImageContainer src="...a.jpg" alt="封面" />` | `<img src="...a.jpg" alt="封面" />` | 与期望字符级一致 |
| 2 | alt 缺省 | `alt=""` 默认空串生效 | ✓ |
| 3 | 函数组件 + 数组 + 文本转义 + style 对象 | `<`/`>`/`&` 转义、camelCase→kebab-case、数组 map 拼接 | ✓ |
| 4 | 自闭合 + 布尔属性 + 事件忽略 | void 标签自闭合、`disabled` 裸属性、`onClick` 忽略 | ✓ |
| 5 | 文本 `<a> & <b>` | `&lt;a&gt; &amp; &lt;b&gt;` 文本节点转义 | ✓ |
| 6 | null/true/undefined/42/[1,"two",...] | 空值输出 `''`、数字 `"42"`、数组拼接 | ✓ |

**结果**：产物 485.12 kB（gzip 119.73 kB），相对基线 +3.77 kB（+0.78%），远低于 react-dom/server 的 +452 kB 膨胀（911 kB 回归点），< 600 kB 阈值；`react-dom/server` 运行时零引用。

### 8.2 各插件域 .ts→.tsx 批次（doc/17–23）

**演进链**：自 doc/17 起逐插件域把返回 HTML 字符串的函数组件转为 TSX 原生 React 组件；调用点插件文件 `.ts`→`.tsx`（`main.tsx` 无扩展名 import 自动解析），调用改 `jsxToString(<Comp {...props} />)`；`jsxToString` 能力随批次扩展（doc/19 增 `dangerouslySetInnerHTML` 支持）。

**统一转换规则**（doc/17 确立，后续沿用）：`class`→`className`；`style` 字符串→CSSProperties 对象（camelCase，`!important` 以字符串值写入）；`on*` 事件不写（由 jQuery 绑定）；void 标签自闭合；动态 `${var}`→`{props.var}`、条件 `${cond ? a : b}`→三元/`{cond && <a/>}`、多元素用 Fragment；HTML 注释→JSX 注释；`data-*`/`id`/`title` 原样。

**共通零偏差说明**：jsxToString 紧凑输出导致原模板 `\n`+缩进丢失（对 DOM 构建 `.append`/`.wrap`/`.prepend`/layer content 与 CSS 解析无影响）；文本节点转义 `&` `<` `>`（属性值不转义，DOM 文本内容一致且避免注入风险）；style 尾分号丢失（CSS 等价）。

| doc | 域 | 组件数 | 调用点 | 本批特有要点 | 产物 |
|-----|-----|--------|--------|-------------|------|
| 17 | list-page / fold-category | 8 | 3 插件 · 10 处 | 删除 2 个孤立示范 .tsx（status-tag/menu-button-box，职责由正式组件接管）；`StatusTagHtml` 的 `variant` 语义变化——render/filter 差异仅在 style 值 `\n`/尾空格，对象化后输出完全一致，`variant` 字段保留维持调用点稳定；`positionStyle` 字符串按 `includes("right")` 解析为对象；page-count-table 日志紧凑化（可读性略降，功能无影响） | 488.25 kB（gzip 120.28） |
| 18 | history / actress-info / favorite-actresses | 9 | 3 插件 · 14 处 | `<option selected>`→`selected={true}`；`readonly`→`readOnly`（HTML 属性名大小写不敏感，浏览器解析等同）；`inputStyle`/`textareaStyle` 由 string 改 CSSProperties 对象（React 19 类型收窄 style 不接受 string），edit-carNum 拼接用对象展开保持声明顺序；`HistoryNavButton` default 分支返回 null（`jsxToString(null)===""`，满足 noImplicitReturns） | 491.94 kB（gzip 121.16） |
| 19 | blacklist | 9 | 1 插件 · 9 处 | **jsxToString 新增 `dangerouslySetInnerHTML` 支持**（renderAttrs 跳过该 key，DOM 元素取 `__html` 作原始 inner HTML 不转义、跳过 children）；条件空 `style=""` 用 `style={{ color: cond ? "...": undefined }}`（undefined 被 styleToCss 过滤，与无 style 属性 DOM 等价）；`&nbsp;` JSX 解码 U+00A0；`{" "}` 保 `<a>` 前后空格；HTML 注释→JSX 注释（`.keyword-btn` 选择器两种模式均返回 null，行为等价） | 494.26 kB（gzip 121.41） |
| 20 | detail-page-button | 7 | 1 插件 · 7 处 | 删除孤立示范 `rating-bar.tsx`；渐变背景 `background: linear-gradient(...)` 原样字符串；`{" "}` 保两按钮间空格；`{"\n"}` 保 SubtitleLine 尾部换行（pre-wrap 下功能性保留）；SubtitlePreviewDialog 用 `dangerouslySetInnerHTML` 原始注入；`data-score={n}` number 输出带引号 | 495.97 kB（gzip 121.68） |
| 21 | setting | 9 | 1 插件 · 13 处 | **`key` prop 重命名为 `cacheKey`**（与 React 保留 prop 冲突，JSX transform 提取到 element.key 而非 props，输出 data-key 值不变）；❓ 与文案间空格 `{" "}` 显式保留；`!important` 字符串值；条件类名用模板字面量保留尾空格语义；SVG viewBox/path 自闭合还原；cacheItemsHtml/qualityOptionsHtml 用 `dangerouslySetInnerHTML` 注入 | 505.36 kB（gzip 122.35） |
| 22 | top250 / nav-bar / other-site / preview-video / want-watched | 17 | 4 插件（top250 已 .tsx）· 26 处 | LoginDialog on* 内联 JS 丢失（jsxToString 忽略 on* 事件，DOM 结构/id/style 零偏差、视觉装饰丢失，遗留 doc/23 修复）；OtherSiteCheckbox 的 `<label for>` 用 `{...{for:...} as Record<string,string>}` 展开（jsxToString 不转换 htmlFor）；href 含 `&` 用表达式保留避免 JSX 实体解码；OtherSiteBtn enabled=true 时无 style（原 `style=""` DOM 等价）；Top250YearButton 循环拼接紧凑无空白（buttons has-addons CSS 下视觉等价） | 517.33 kB（gzip 122.79） |
| 23 | core（logger / image-preview） | 3 | 2 个 core 文件 · 3 处 | `LoggerLogEntry` 的 `\n`+缩进以字符串字面量显式保留（JSX 编译器去除纯空白子节点）；message 为已格式化 HTML（含 `<a>`/`<br/>`）用 `dangerouslySetInnerHTML` 原样注入；`<img>` void 自闭合与浏览器 innerHTML 解析等价 | 518.40 kB（gzip 122.96） |

（doc/17–23 累计 60+ 个组件转为 TSX 原生 React 组件；doc/23 标注 `noImplicitThis` 已通过。doc/22 提交 `60833b1`：39 files，+1100/-599。）

**各批转换清单（.ts → .tsx，删原 .ts）**：

- **doc/17**（组件 8）：status-tag-html（合并删示范 status-tag.tsx）/ menu-button-box-html（合并删示范 menu-button-box.tsx）/ video-title-span / jump-page-control / page-count-table / fold-category-toolbar / fold-category-section-button / highlight-button；插件 3：list-page-plugin / list-page-button-plugin / fold-category-plugin。
- **doc/18**（组件 9）：history-dialog / edit-record-dialog / history-nav-button / history-action-buttons / history-source-cell / history-status-cell / actress-info-detail-segment / actress-info-star-page-html / favorite-actress-avatar-column；插件 3：history-plugin / actress-info-plugin / favorite-actresses-plugin。
- **doc/19**（组件 9）：blacklist-dialog / blacklist-confirm-message / blacklist-data-type-options / blacklist-name-cell / blacklist-url-type-cell / blacklist-status-cell / blacklist-action-cell / movie-list-wrapper / blacklist-pagination-counter；插件 1：blacklist-plugin。
- **doc/20**（组件 7）：detail-menu-buttons / rating-bar-html（合并删示范 rating-bar.tsx）/ list-panel / subtitle-action-cell / subtitle-line / subtitle-table-dialog / subtitle-preview-dialog；插件 1：detail-page-button-plugin。
- **doc/21**（组件 9）：setting-dialog / help-dialog / backup-file-dialog / setting-mount-box / simple-setting-panel / cache-item-html / video-quality-option / keyword-label / back-to-top-button；插件 1：setting-plugin。
- **doc/22**（组件 17）：login-dialog / top250-tool-bar / top250-year-button / top250-pagination / top250-error-message / top250-nav-link / nav-search-box / nav-other-dropdown / other-site-box / other-site-btn / other-site-checkbox / site-result-tag / preview-video-quality-btn / preview-video-action-btn / preview-video-container / want-watched-import-button / want-watched-hint-span；插件 4：nav-bar-plugin / other-site-plugin / preview-video-plugin / want-and-watched-videos-plugin（top250-plugin 已 .tsx）。
- **doc/23**（组件 3）：logger-log-entry / image-preview-img / image-preview-error；core 调用点 2：logger.ts / image-preview.ts → .tsx。

### 8.3 LoginDialog on* 内联 JS 丢失修复（doc/22→23 演进链）

**问题（doc/22 引入）**：`login-dialog.ts`→`.tsx` 时，原版内联 `onfocus`/`onblur`/`onmouseover`/`onmouseout` JS（archetype L4667-4685 的 `layer.open content` 字符串）被 jsxToString 忽略（renderAttrs 跳过 `on*` 属性）。DOM 结构与 id/类名/style 零偏差，但视觉装饰丢失：输入框 focus 时 borderColor `#4a8bfc`/background `#fff`，blur 恢复 `#e0e0e0`/`#f9f9f9`；`#loginBtn` mouseover 时 background `#3a7be0`，mouseout 恢复 `#4a8bfc`。

**修复（doc/23）**：在 `top250-plugin.tsx` 的 `openLoginDialog` success 回调顶部用 jQuery `.on(...)` 链式绑定等价事件。要点：`function` 非 arrow（jQuery 回调 `this` 为 DOM 元素，arrow 词法绑定外层无 style 属性）；`this: HTMLElement` 显式标注（strict `noImplicitThis`，项目惯例 detail-page-button-plugin L1438 用 `this: any`，此处用更精确的 `HTMLElement`）；绑定时机在 success 回调（layer 渲染后）与原版 DOM 解析即生效等价；**不改 `login-dialog.tsx` 组件本身**（组件只负责静态结构，事件绑定由调用方持有，与 doc/22 设计一致）。

## 9. 外部库 @require → ESM import 迁移（doc/24）

**背景**：原脚本 9 个 `@require` CDN 库，Tampermonkey 运行时注入全局变量：

| 库 | 版本 | npm 包 | 全局名 |
|----|------|--------|--------|
| parallel_GM_xmlhttpRequest | 540597/1613170 | 非 npm（GreasyFork 脚本） | parallel_GM_xmlhttpRequest |
| jquery | 3.7.1 | jquery | $ / jQuery |
| tabulator-tables | 6.3.1 | tabulator-tables | Tabulator |
| layui-layer | 1.0.9 | layui-layer | layer |
| blueimp-md5 | 2.19.0 | blueimp-md5 | md5 |
| toastify-js | 1.12.0 | toastify-js | Toastify |
| localforage | 1.10.0 | localforage | localforage |
| viewerjs | 1.11.1 | viewerjs | Viewer |
| qrcodejs | 1.0.0 | — | QRCode |

`src/types/globals.d.ts` 以 `declare const $: any` 等声明全局，代码直接用全局名；`src/main.tsx` 用 `utils.importResource` 动态创建 `<link>` 加载 4 个库 CSS。问题：`@require` 库运行时走 CDN 下载，依赖网络、加载有延迟。**用户选方案 B：逐库 import，彻底模块化**——接受产物体积增大，脚本本地执行无网络开销反而更快。

**库分类与决策**：

| 库 | 决策 | 原因 |
|----|------|------|
| jquery / tabulator-tables / toastify-js / localforage / viewerjs / blueimp-md5 / layui-layer | ✅ ESM import | 均有 npm 包且可 import（tabulator/viewer 有原生 ESM 入口；版本与原 `@require` 完全一致保零偏差） |
| qrcodejs | ❌ 直接移除 | 全项目（含 archetype 脚本体）均无 `QRCode` 调用，仅 @require 声明，从未使用 |
| parallel_GM_xmlhttpRequest | ❌ 保留 @require | GreasyFork 脚本，非 npm 包 |

**方案**：

- **中心 `src/core/libs.ts` + 全局挂载**：集中 import 7 库 + 4 库 CSS，挂 `window` 全局（供历史全局引用：layer-wrapper/plugins/main.tsx 仍用全局名 `$`/`layer`/`Tabulator`/`Toastify`/`localforage`/`Viewer`/`md5`），同时 `export` 各库供未来逐文件迁移；改动集中在 libs.ts + main.tsx + vite.config.ts + globals.d.ts，**无需逐个修改 plugins/core 文件**。
- **layer + jquery 耦合处理（关键）**：`layui-layer` 的 `layer.js` 是 CJS 脚本（非标准 UMD）——顶部 `require('./layer.css')`（CSS 随 JS 引入），尾部 `ready.run(jQuery)` 直接调用**全局裸变量 `jQuery`**（解析为 `window.jQuery`；若 layer 求值时未设置，`layer.open/close` 全部失效），尾部 `module.exports = layer`。jquery UMD 在 CJS 分支 `noGlobal=true` **不自动挂 `window.jQuery`**。ESM 静态 import 的模块顶层语句在所有 import 求值后才执行，无法在两条 import 之间插入 `window.jQuery = $` 副作用。**解法**：拆 `src/core/_jquery-global.ts`（`import $ from 'jquery'` + 挂 `window.jQuery/$`），`libs.ts` 顶部先 `import './_jquery-global'`（副作用导入），ESM 求值顺序保证 window.jQuery 先于 layer 求值就绪。
- **CSS**：4 个库 CSS 由 `importResource` 动态 `<link>` 改 ESM import（`layui-layer/layer.css`/`toastify-js/src/toastify.css`/`viewerjs/dist/viewer.min.css`/`tabulator-tables/dist/css/tabulator_semanticui.min.css`）——Vite build 时 inline 进 JS 产物，vite-plugin-monkey 注入 `<style>`（模块求值时即就绪、更早可用），替代原异步 `<link>`；项目自定义覆盖样式（`src/styles/viewer.css` 等）仍由 `main.tsx` 的 `H()` 注入不变。

**实施要点**：

- **类型问题**：`@types/jquery` 的 UMD 全局声明把全局 `$` 提升为精确 `JQueryStatic`，暴露十几个文件的隐藏类型问题（contentDocument / on overload / text() 返回 string|number|string[]|undefined / sort on JQuery 等）——**卸载 @types/jquery**（不在库迁移范围内，让 `$` 回到 `any` 与原 @require 一致），`globals.d.ts` 加 `declare module 'jquery'`；viewerjs 自带 types 使全局 `Viewer` 精确化，`VIEWER_CONFIG` 返回类型 `ViewerOptions`→`any`（与原全局为 any 时不检查 config 一致），并 `export interface ViewerOptions` 避免 noUnusedLocals；`@types/blueimp-md5` 的 `export as namespace md5` 与 `declare const md5` 兼容，保留；tabulator ESM 入口为命名导出 `export { Tabulator$1 as Tabulator }`，改 `import { Tabulator } from 'tabulator-tables'`。
- **CSS 构建**：`layui-layer/layer.css` 含 IE hack（`*display: inline`/`*zoom: 1`），Vite 8 默认 LightningCSS 严格模式中断 build——`vite.config.ts` 加 `css.lightningcss.errorRecovery: true` 容错 strip（modern 浏览器无需 IE hack，渲染等价）。曾测 `build.cssMinify: 'esbuild'` 同样报 `Expected identifier but found "*"` 且产物更大（1211.60 vs 1202.82 kB）、需额外安装 esbuild 包（Vite 8 不再默认捆绑），不采用。
- **依赖**：新增 dependencies jquery@3.7.1 / tabulator-tables@6.3.1 / layui-layer@1.0.9 / blueimp-md5@2.19.0 / toastify-js@1.12.0 / localforage@1.10.0 / viewerjs@1.11.1（与原 @require 同版本）；devDependencies @types/toastify-js / @types/localforage / @types/viewerjs / @types/blueimp-md5（@types/jquery 卸载）。
- **修改清单**：新增 `src/core/_jquery-global.ts`（副作用模块，供 libs.ts 最先引入）与 `src/core/libs.ts`（集中 import 7 库 + 4 CSS + 挂 window 全局 + export）；修改 `src/main.tsx`（顶部加 `import './core/libs'` 最先求值、移除 4 个 `utils.importResource`）、`vite.config.ts`（`@require` 只保留 parallel_GM_xmlhttpRequest）、`src/types/globals.d.ts`（加 `declare module 'layui-layer'`/`'tabulator-tables'`/`'jquery'`、移除 `declare const QRCode`、更新库来源注释）。

**结果**：7 库打包进产物，qrcodejs 移除，`@require` 仅剩 parallel_GM_xmlhttpRequest；产物 1202.82 kB（gzip 309.12 kB），较基线 518.40 kB 增 +684.42 kB（gzip +186.16 kB）。产物校验：userscript 头部 `@require` 只剩 1 个；产物中 `window.jQuery = import_jquery.default`（`_jquery-global.ts` 挂载）在 `ready.run(jQuery)`（layer.js）之前，求值顺序正确；库特征存在性匹配（Tabulator/localforage/Toastify/Viewer/md5）；vite-plugin-monkey 自动追加 `@grant GM_addStyle`（CSS inline 注入所需）与 `@grant window.close`。

## 10. 阶段演进链与遗留问题

**演进链梳理**：

- **插件外置**：doc/03 首批 4 插件 → 中间多批次（AutoPage/Blacklist/WantAndWatchedVideos/FavoriteActresses/NewVideo/History 等）→ doc/04 终批 3 插件（20/21 外置）。
- **CSS**：doc/02 确立三种提取模式 → doc/10 起插件 CSS 随弹窗提取（initCss 拼接）→ doc/13 补 5 个 CSS → doc/14 全部 24 个 `.css` 字符级对齐原版，并修复 doc/10 引入的 initCss 拼接 bug（avatar/help 弹窗 CSS 改回 layer.open content 内随 `<style>` 注入）。
- **HTML→组件**：doc/06 统一规定（组件返回 HTML 字符串、禁用 JSX）→ doc/07–13 全部注入用 HTML 转函数组件 → doc/16 引入轻量 `jsxToString` 开启回归 JSX → doc/17–23 逐插件域转 TSX 原生组件（60+ 个），doc/06 的规定随批次逐步反转；doc/19 为 jsxToString 扩展 `dangerouslySetInnerHTML`。
- **RelatedPlugin**：doc/13 按 ReviewPlugin 对称模式构建 → doc/15 对照 archetype 校正 8 处偏差。
- **LoginDialog**：doc/07 提取为字符串组件 → doc/22 转 TSX 致 on* 内联 JS 丢失 → doc/23 jQuery `.on` 等价补回。
- **外部库**：doc/24 将 9 个 `@require` 收敛为 7 库 ESM 打包 + qrcodejs 移除 + parallel_GM_xmlhttpRequest 保留。

**遗留问题**：

- `PreviewVideoPlugin` 仍内联于 legacy（doc/04），后随 legacy 整体删除由启动序列维护（doc/01 进度记录的总状态）。
- 三个示范组件（menu-button-box/rating-bar/status-tag）曾保留 renderToStaticMarkup 推荐注释，已随 doc/17（前两者）与 doc/20（rating-bar）删除示范组件而消除。
- 旧 `.ts` 组件的删除与调用点文件 `.ts`→`.tsx` 重命名均依赖 `main.tsx` 无扩展名 import 的 bundler resolution，后续新增调用点需保持该约定。
- jsxToString 的适用范围限定为**纯函数组件**（doc/16）：含 hooks/state/effects 的组件不在覆盖范围，工程当前无此类需求。
- 库迁移后 `$` 等全局仍为 `any`（doc/24 卸载 @types/jquery），业务代码的精确类型化留作后续阶段。

## 附：产物体积演进

| 里程碑 | 产物（kB） | gzip（kB） |
|--------|-----------|-----------|
| doc/01 整体迁移完成（初始基线） | 459.58 | 114.41 |
| doc/03 首批 4 插件外置 | 428.34–429.51 | — |
| doc/04 插件全量外置 | 449.83 | 110.13 |
| doc/05 legacy 辅助提取到 core | 462.66 | 113.30 |
| doc/06 移除 react-dom/server（911 kB 回归点修复） | 458.24 | 114.26 |
| doc/07–10 插件弹窗组件（login/subtitle/history/new-video） | 458.18–460.16 | — |
| doc/11–12 列表页/黑名单组件 | 463.84 / 465.42 | — |
| doc/13 剩余 HTML 全面转组件 | 468.96 | 117.99 |
| doc/14 CSS 字符级对齐原版 | 476.12 | 116.82 |
| doc/15 RelatedPlugin archetype 校准 | 483.49 | 118.66 |
| doc/16 轻量 jsxToString（+3.77 kB） | 485.12 | 119.73 |
| doc/17–23 TSX 迁移（8 批） | 488.25 → 518.40 | 120.28 → 122.96 |
| doc/24 7 库 ESM 打包（+684.42 kB） | 1202.82 | 309.12 |

> 原文对照说明：
> - doc/16 记录的「基线 481.35 kB」与其前序 doc/15 的 483.49 kB 存在小幅出入（两值均以原文为准，归属期间其他变更）；doc/03 外置批次的产物缩小属该阶段 legacy 收缩的正常快照。
> - doc/21 累计「共 31 个」与 doc/22 累计「共 42 个」对不上（按各批 8/9/9/7/9 实算为 42），故本文档不对累计数作断言，仅列各批组件数。
> - doc/13 的「26 组件」与清单表约 40 转换点不一致（见 §5.4）。