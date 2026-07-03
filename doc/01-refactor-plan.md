---
文档类型: 🔧开发指导
文档状态: 🔧待执行
---

# 01 - 重构总计划

## 1. 背景与目标

将 `archetype/jhs.user.js`（11605 行混淆脚本）拆分重构为 `vite-plugin-monkey`
+ React + TypeScript + SWC 工程。硬约束：**打包产物功能逻辑、执行效果、执行
顺序与原始脚本零偏差**。

## 2. 原脚本架构分析

### 2.1 脚本头部要点（已迁入 `vite.config.ts` userscript）

- `@match https://javdb.com/*`、`@include https://javdb*.com/*`、`@run-at document-idle`
- `@require` 9 个 CDN 库：parallel_GM_xmlhttpRequest、jquery、tabulator-tables、
  layui-layer、blueimp-md5、toastify-js、localforage、viewerjs、qrcodejs
- `@grant`：GM_xmlhttpRequest、GM_openInTab、GM_setValue、GM_addValueChangeListener、unsafeWindow
- `@connect`：xunlei.com、missav.live、javdb.com、supjav.com、127.0.0.1、*

### 2.2 全局对象（运行时挂载到 window/unsafeWindow）

| 全局名 | 原类/定义 | 说明 |
|--------|-----------|------|
| `utils` | `new J()` (CommonUtil) | 工具集：openPage/setupEscClose/importResource/q/formatDate/download/gmRequest 等 |
| `storageManager` | `new z()` (StorageManager) | IndexedDB/localforage 封装：carList/blacklist/favoriteActress/setting 等 |
| `gmHttp` | `new (class {...})()` | 网络请求：get/post/postForm/downloadFileInChunks/gmRequest |
| `show` | `{ok,error,info}` | Toastify 封装 |
| `loading` | `function()` | 加载动画 |
| `clog` | `new o()` (Logger) | 日志面板 |
| `pluginManager` | `new PluginManager()` | 插件管理器 |
| `refresh` | BroadcastChannel 回调 | 跨标签页刷新 |

### 2.3 启动序列（`src/legacy/jhs.ts` 末尾，原 L11488-11564）

1. `utils.importResource(...)` 注入 4 个库 CSS（layui/toastify/viewer/tabulator）
2. 包装 `layer.open`/`layer.close`（ESC 关闭 + overflow 处理）
3. `new PluginManager()` → `unsafeWindow.pluginManager`；若 `isJavdbSite` 注册 21 个插件
4. `pluginManager.processCss()`（异步，各插件 `initCss` 注入 CSS）
5. 异步 IIFE：设置 `window.isDetailPage/isListPage/isFc2Page` →
   `storageManager.merge_*()` 数据迁移序列 → 中文语言检查 →
   `pluginManager.processPlugins()`（各插件 `handle`）

### 2.4 插件系统清单（注册顺序，仅 javdb）

ListPagePlugin、AutoPagePlugin、FoldCategoryPlugin、ListPageButtonPlugin、
HistoryPlugin、SettingPlugin、NavBarPlugin、HitShowPlugin、Top250Plugin、
DetailPagePlugin、ReviewPlugin、DetailPageButtonPlugin、HighlightMagnetPlugin、
PreviewVideoPlugin、FilterTitleKeywordPlugin、ActressInfoPlugin、OtherSitePlugin、
WantAndWatchedVideosPlugin、BlacklistPlugin、FavoriteActressesPlugin、NewVideoPlugin

### 2.5 状态模型

动作类型：`filter`/`favorite`/`hasWatch`；展示文本/颜色：屏蔽/收藏/已观看；
布尔：`no`/`yes`；站点/类别：javdb/javbus/actor/actress/censored/uncensored。
均已提取至 `src/constants/`。注：`hasDown`（已下载）状态已在原脚本历史中删除，
勿再引入。

## 3. 重构策略：渐进式整体迁移

1. **过渡载体**：原脚本原样迁入 `src/legacy/jhs.ts`（`@ts-nocheck`），保证立即可
   打包且功能等价。`src/main.tsx` 仅 `import './legacy/jhs'` 触发执行。
2. **逐步提取**：从 legacy 中按模块提取为正式 TS 文件，legacy 顶部以
   `import { 语义名 as 原混淆名 }` 别名导入并删除原定义。提取后 legacy 逐步缩减。
3. **每步验证**：每次提取后 `pnpm run build` 验证可打包，git commit 跟踪。
4. **零偏差保障**：提取只做结构/类型/命名/CSS 拆分，不改控制流、不改执行顺序、
   不改副作用；CSS 用 `?raw` 字符串导入 + 原注入点（H()/insertAdjacentHTML）保持顺序。

## 4. 目录结构

```
src/
  main.tsx              入口（触发 legacy 执行）
  legacy/jhs.ts         过渡载体（原脚本，逐步缩减）
  types/globals.d.ts    全局类型声明（@require 库、GM API、应用全局）
  constants/            常量（site/status/video-quality）
  resources/            CDN 资源清单、KV store 名
  styles/               提取的独立 CSS 文件（?raw 导入）
  core/                 基础设施（utils/storageManager/gmHttp/show/loading/clog/hotkey/imagePreview/viewer）
  plugins/              插件（PluginManager/BasePlugin + 21 插件）
  components/           React 组件 / HTML 模板（由原 HTML 字符串转换）
doc/                    迁移文档
archetype/              原始脚本与历史文档（只读参考）
```

## 5. 提取模式

### 5.1 常量提取

- 纯数据常量提取为 `src/constants/*.ts`，导出语义名。
- legacy：`import { 语义名 as 原字母 } from '../constants/...'`，删除原 `const`。
- 示例：`o→currentHref`、`r→isJavdbSite`、`d→FILTER_ACTION`、`L→VIDEO_QUALITY_LIST`。

### 5.2 CSS 提取（详见 `02-css-extraction.md`）

- 纯静态 CSS → `src/styles/*.css`，legacy `import xRaw from '../styles/x.css?raw'`，
  原 `H(x)`/`insertAdjacentHTML` 注入点改用 `xRaw`（H 自动包裹 `<style>`）。
- 含插值 CSS（如 `${M}` 条件追加）→ .css 用占位注释 `/*__TOKEN__*/`，
  legacy `xRaw.replace('/*__TOKEN__*/', 运行时片段)`。
- 执行顺序与原注入点完全一致，避免顺序偏差。

### 5.3 模块提取（core/plugins）

- 类/函数提取为 `src/core/*.ts`、`src/plugins/*.ts`，导出语义名类。
- legacy 别名导入，删除原定义。
- 类型：先 `any`/最小声明保证编译，后续逐步收紧。

### 5.4 HTML 字符串 → React 组件

- 原脚本大量 `layer.open({ content: '<html>' })` 与 `$(html)` 创建 DOM。
- 相对独立的静态/半静态 HTML 模板提取为 `src/components/*.tsx` React 组件，
  组件 `renderToString` 或返回 HTML 字符串供原调用点消费（保持 layer/jQuery 消费方式）。
- 深度耦合 layer content 的动态 HTML，提取为模板模块（返回字符串），待逻辑稳定后再组件化。
- 原则：不破坏 layer/jQuery 消费契约，避免执行偏差。

### 5.5 命名优化

- 全局/类成员/导出符号：语义命名（`o→currentHref`、`J→CommonUtil`、`z→StorageManager`）。
- 函数内局部变量：保留或适度语义化（降低误替换风险）。
- 单字母全局与局部同名时，用 `import {语义 as 原字母}` 别名避免全局替换误伤。

## 6. 资源/常量单独提取

- CDN 资源清单（gfriends `tt`、头像源 `it/st`、IndexedDB store 名 `ot/rt`、
  库 CSS URL 等）→ `src/resources/`。
- 请求头常量（`q`）、Tabulator 中文语言包 → `src/constants/`。

## 7. 进度

> 截止本次更新（commit 见文末 `git log`），legacy 仅余 405 行（启动序列 + CSS
> replace + BroadcastChannel + 库 CSS `importResource`），core/plugins/constants/
> resources/styles 均已提取完毕。下一步重心是 legacy 启动序列收尾与去 `@ts-nocheck`。

### 已完成

- [x] 脚手架与项目初始化
      - `pnpm create monkey` react-swc-ts 脚手架，项目名 `monkey-jhs-disassemble`
      - `vite.config.ts` 配置完整 userscript metadata（name/namespace/version/
        author/license/description/homepageURL/icon/match/include/runAt/connect/
        require/grant）
      - `pnpm-workspace.yaml` 设置 `verifyDepsBeforeRun: false`（绕过 @swc/core
        ignored builds 阻断 build）
      - git 初始化与首次提交
- [x] 整体迁移：原脚本整体迁入 `src/legacy/jhs.ts`（`@ts-nocheck`），产物功能等价
- [x] 类型声明：`src/types/globals.d.ts` 全局类型声明（@require 库、GM API、应用全局）
- [x] 常量提取：`src/constants/{site,status,video-quality,api,tabulator-zh}.ts`，
      legacy 别名导入
- [x] CSS 提取（顶层 + loading，详见 `02-css-extraction.md` 模式）
      - `src/styles/{loading,javbus-masonry,javdb-site,common-toolbar,
        a-normal-buttons}.css`
      - `?raw` 导入 + 原注入点（`H()`/`insertAdjacentHTML`）
      - 含插值/IIFE 的 CSS 用占位 `/*__TOKEN__*/` + `replace` 还原执行顺序
- [x] core 全模块提取（15 个）：`src/core/{common-util,storage-manager,gm-http,
      toast,loading,logger,hotkey,image-preview,viewer,webdav,gfriends,
      async-task-queue,layer-wrapper,tooltip,webdav-crypto}.ts`
- [x] 插件系统：`src/plugins/{base-plugin,plugin-manager}.ts` + 21 个插件模块
      全部外置（含 `PreviewVideoPlugin`，见 `03`/`04` 文档及后续提交）
- [x] 资源提取：`src/resources/gfriends.ts`
- [x] API 配置：`src/constants/api.ts`（API_BASE/reBuildSignature/请求方法）
- [x] 辅助代码提取：layer 包装 / tooltip / webdav 加密 → core（详见
      `05-legacy-helpers-extraction.md`）
- [x] build 脚本修复：`package.json` `build` 改为 `tsc -b && vite build`
      （真实类型检查，替代原 `vue-tsc -b` 占位）
- [x] build 验证通过：`tsc -b && vite build`，51 modules，产物 462.66 kB
      （gzip 113.30 kB）

### 待完成

- [ ] HTML 字符串 → React 组件：仅做示范性转换；深度耦合 layer content 的
      动态 HTML 暂保留为字符串模板，待逻辑稳定后再组件化（见 5.4 节原则）
- [ ] legacy 启动序列移 `main.tsx`：`src/legacy/jhs.ts` 仅余 405 行（启动序列 +
      CSS replace + BroadcastChannel + 库 CSS `importResource`），整体迁入
      `src/main.tsx` 后删除 legacy 文件
- [ ] 各插件 `initCss` CSS 提取为独立 .css：插件内联 CSS 字符串按
      `02-css-extraction.md` 模式提取到 `src/styles/<plugin>.css`（见 02
      文档 4.2 节清单）
- [ ] 全量去 `@ts-nocheck`：legacy 胶水代码逐步引入类型，最终移除
      `@ts-nocheck`（core/plugins 已是强类型，仅 legacy 残留）

## 8. 一致性校验（每次改代码后自查）

1. 插件清单：新增/删除/重命名插件类 → 同步第 2.4 节清单（以注册序列为准）。
2. 状态模型：新增/删除状态常量 → 同步第 2.5 节（`hasDown` 已删，勿再引入）。
3. 脚本头部：新增 `@grant`/`@connect`/`@require`/`@match` → 同步 `vite.config.ts`
   与第 2.1 节。
4. 设计决策：引入跨插件机制/同步链路 → 追加到本文档；失效决策从此删除。
5. 外部行为变更（API 格式、错误码、配置项）→ 同步文档。
