# 项目架构地图

> 本文档描述 `monkey-jhs-disassemble` 项目的完整架构，供 AI agent 快速理解项目结构。
> 每次代码变更（新增/删除/重命名文件、修改核心架构）时必须同步更新本文档。

## 1. 项目概述

将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为基于
`vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目。
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。

- **构建工具**：Vite 8 + vite-plugin-monkey 8
- **语言**：TypeScript 6（strict 模式，全量去 @ts-nocheck）
- **UI 框架**：React 19（仅用 jsxToString 渲染 HTML 字符串，不用 react-dom/server）
- **CSS 处理**：lightningcss（errorRecovery 容错 IE hack）
- **包管理**：Bun
- **构建命令**：`bun run build` = `tsc -b && vite build`

## 2. 目录结构总览

```
monkey-jhs-disassemble/
├── src/                    # 源码（tsconfig include）
│   ├── main.tsx            # 入口：启动序列 + 注册 33 插件
│   ├── core/               # 核心模块（15 个）
│   ├── plugins/            # 插件模块（base-plugin + plugin-manager + 31 插件）
│   ├── components/         # React 函数组件（jsxToString 转 HTML 字符串）
│   ├── constants/          # 常量（site/status/video-quality/api）
│   ├── resources/          # 资源（icons SVG）
│   ├── styles/             # CSS 文件（?raw import via initCss）
│   └── types/              # 类型声明（globals.d.ts）
├── archetype/              # 原始脚本 + 独立油猴脚本（只读参考）
├── doc/                    # 文档（NN-描述.md，编号递增，不可回头改）
├── dist/                   # 构建产物（vite build 清空重建）
├── .agents/skills/         # Agent skills（userscript-integration）
├── vite.config.ts          # Vite + vite-plugin-monkey 配置
├── tsconfig.json           # TS 根配置（references app + node）
├── tsconfig.app.json       # src/ 源码 TS 配置（strict, noEmit, jsx: react-jsx）
├── tsconfig.node.json      # vite.config.ts TS 配置
├── package.json            # 依赖 + scripts（build: tsc -b && vite build）
└── bun.lock                # Bun 锁文件
```

## 3. 核心架构

### 3.1 入口 `src/main.tsx`

**职责**：启动序列 + 插件注册。

**执行流程**：
1. `import './core/libs'` — 加载第三方库（jquery/tabulator/layer/toastify/localforage/viewer/md5）并挂全局
2. CSS 注入（javdb-site/common-toolbar/a-normal-buttons/loading/viewer/logger）
3. 全局挂载（utils/gmHttp/storageManager/loadGfriends/filetreeDb/WebDavClient/refresh/cleanCache）
4. BroadcastChannel('channel-refresh') 跨标签页刷新
5. loading/show/showImageViewer 挂载
6. clog 日志控制台 + 全局异常捕获
7. tooltip + 快捷键监听
8. encryptCredential/decryptCredential + setupLayerWrapper
9. **PluginManager 实例化 + 注册 33 插件**（`if (isJavdbSite)` 块内）
10. `processCss()` — 并发执行所有插件 initCss
11. 页面判定（isDetailPage/isListPage/isFc2Page）
12. storageManager 合并/清理
13. `processPlugins()` — 并发执行所有插件 handle

**关键点**：
- 所有插件在 `if (isJavdbSite)` 块内注册（非 javdb 站点不注册）
- `processCss()` 在 `processPlugins()` 之前执行（CSS 先于逻辑注入）
- `isDetailPage`/`isListPage`/`isFc2Page` 在 `window` 上全局挂载，插件以 `(window as any).isDetailPage` 访问

### 3.2 插件系统

**`src/plugins/base-plugin.ts`** — BasePlugin 基类：
- `getName(): string` — 插件名（注册去重用）
- `async initCss(): Promise<string>` — 返回 CSS 字符串（由 PluginManager.utils.insertStyle 注入）
- `async handle(): Promise<void>` — 主逻辑
- `getBean(name): BasePlugin` — 按名获取其他插件实例（跨插件调用）
- `getPageInfo()/getActressPageInfo()/getSelector()/getBoxCarInfo()` 等 — 列表页/详情页辅助

**`src/plugins/plugin-manager.ts`** — PluginManager：
- `register(pluginClass)` — 实例化 + 注入 pluginManager + 按 getName() 去重
- `getBean(name)` — 按名获取插件实例
- `processCss()` — 并发执行所有插件 initCss（Promise.allSettled）
- `processPlugins()` — 并发执行所有插件 handle（Promise.allSettled）

### 3.3 插件清单（33 个）

**主脚本拆分插件（22 个）**：来自 `archetype/jhs.user.js`

| 插件 | 文件 | 职责 |
|------|------|------|
| ListPagePlugin | list-page-plugin.tsx | 列表页主插件：过滤/状态标签/翻译/点击绑定/快捷键 |
| AutoPagePlugin | auto-page-plugin.ts | 瀑布流自动翻页 |
| FoldCategoryPlugin | fold-category-plugin.tsx | 折叠分类 |
| ListPageButtonPlugin | list-page-button-plugin.tsx | 列表页按钮组（批量打开/排序切换/加入黑名单） |
| HistoryPlugin | history-plugin.tsx | 鉴定记录 |
| SettingPlugin | setting-plugin.tsx | **设置弹窗（侧栏+面板）** + WebDav 备份 + 缓存清理 |
| NavBarPlugin | nav-bar-plugin.tsx | 导航栏 |
| HitShowPlugin | hit-show-plugin.tsx | 热播 |
| Top250Plugin | top250-plugin.tsx | Top250 排行榜 |
| DetailPagePlugin | detail-page-plugin.ts | 详情页主插件 |
| ReviewPlugin | review-plugin.tsx | 评论 |
| DetailPageButtonPlugin | detail-page-button-plugin.tsx | 详情页按钮（想看/观看/评分/清单/字幕） |
| HighlightMagnetPlugin | highlight-magnet-plugin.ts | 高亮磁链 |
| PreviewVideoPlugin | preview-video-plugin.tsx | 预览视频 |
| FilterTitleKeywordPlugin | filter-title-keyword-plugin.ts | 标题关键词过滤 |
| ActressInfoPlugin | actress-info-plugin.tsx | 演员信息 |
| OtherSitePlugin | other-site-plugin.tsx | 第三方站点 |
| WantAndWatchedVideosPlugin | want-and-watched-videos-plugin.tsx | 想看/已观看 |
| RelatedPlugin | related-plugin.tsx | 相关清单 |
| BlacklistPlugin | blacklist-plugin.tsx | 黑名单 |
| FavoriteActressesPlugin | favorite-actresses-plugin.tsx | 收藏演员 |
| NewVideoPlugin | new-video-plugin.tsx | 新作品检测 |
| Fc2Plugin | fc2-plugin.ts | FC2 |

**独立脚本集成插件（10 个）**：来自 `archetype/*.user.js`

| 插件 | 文件 | 来源脚本 | doc |
|------|------|----------|-----|
| RatingDisplayPlugin | rating-display/ 子目录（6 模块） | jhsRatingDisplay.user.js | doc/25 |
| KeyPageTurningPlugin | key-page-turning-plugin.ts | keyPageTurning.user.js | doc/34 |
| ModMyListOpenWayPlugin | mod-my-list-open-way-plugin.ts | modMyListOpenWay.user.js | doc/35 |
| PageSortPlugin | page-sort-plugin.ts | pageSort.user.js | doc/36+37 |
| StatusTagFilterPlugin | status-tag-filter-plugin.ts | statusTagFilter.user.js | doc/38 |
| ListWaterfallPlugin | list-waterfall-plugin.ts | listWaterfall.user.js | doc/39 |
| ListReadingStatusPlugin | list-reading-status-plugin.ts | listReadingStatus.user.js | doc/40 |
| ModalListDisablerPlugin | modal-list-disabler-plugin.ts | modalListDisabler.user.js | doc/42 |
| ListParserPlugin | list-parser-plugin.ts | listParser.user.js | doc/43 |
| VideoListsTagPlugin | video-lists-tag/ 子目录（5 模块） | listsOptionSync + videoListsTag | doc/45 |

### 3.4 核心模块 `src/core/`（15 个）

| 文件 | 职责 |
|------|------|
| libs.ts | 第三方库 ESM import + 挂全局（$/layer/Tabulator/Toastify/localforage/Viewer/md5） |
| _jquery-global.ts | jquery 副作用模块（先于 layer 挂 window.jQuery） |
| storage-manager.ts | IndexedDB 存储管理（JAV-JHS/appData，localforage 实例） |
| gm-http.ts | GM_xmlhttpRequest 封装（GET/POST/分块下载/重试） |
| common-util.ts | 通用工具（retry/htmlTo$dom/getUrlParam/isMobile/loopDetector） |
| toast.ts | Toastify-js 封装（show.ok/error/success） |
| loading.ts | 加载遮罩 |
| logger.tsx | 日志控制台（clog） |
| hotkey.ts | 快捷键监听 |
| image-preview.tsx | 图片查看器 |
| viewer.ts | Viewer.js 配置 |
| webdav.ts | WebDav 客户端 |
| webdav-crypto.ts | WebDav 加密/解密 |
| gfriends.ts | GFriends 数据 |
| layer-wrapper.ts | layer.js 包装 |
| tooltip.ts | tooltip |
| style-injector.ts | CSS 注入（injectCss） |
| jsx-to-string.ts | 轻量 JSX→HTML 字符串渲染器（替代 react-dom/server） |
| async-task-queue.ts | 异步任务队列 |

### 3.5 组件 `src/components/`

所有组件都是 **React 函数组件**，返回 JSX，经 `jsxToString()` 转 HTML 字符串后
供插件 `.append()` / `.html()` / `layer.open content` 消费。
不使用 react-dom/server，零运行时依赖（仅类型依赖 react）。

### 3.6 样式 `src/styles/`

CSS 文件通过 `?raw` import 为字符串，由 `initCss()` 返回 →
`PluginManager.processCss()` → `utils.insertStyle()` 注入。
顶层 CSS 由 `main.tsx` 的 `injectCss()` 直接注入。

### 3.7 全局类型 `src/types/globals.d.ts`

声明 Tampermonkey Grant API（GM_xmlhttpRequest 等）和运行时全局
（$/layer/Tabulator/utils/gmHttp/storageManager/clog/show 等）为 `any` 类型。

## 4. 设置弹窗架构（SettingPlugin）

**这是修改设置面板时必须理解的架构**：

### 4.1 组件结构

`SettingDialog` 组件（`src/components/setting-dialog.tsx`）返回完整的设置弹窗 HTML：

```
<div style="flex">  ← 外层 flex 容器
  <div style="width:140px">  ← 侧栏
    <div class="side-menu-item" data-panel="backup-panel">💾 数据备份</div>
    <div class="side-menu-item" data-panel="base-panel">⚙️ 基础配置</div>
    <div class="side-menu-item" data-panel="filter-panel">🚫 屏蔽配置</div>
    <div class="side-menu-item" data-panel="domain-panel">🌐 外部网站</div>
    <div class="side-menu-item" data-panel="hotkey-panel">⌨️ 快捷键配置</div>
    <div class="side-menu-item" data-panel="cache-panel">🧹 清理缓存</div>
    <div class="side-menu-item" data-panel="vlt-panel">📋 收藏清单关系</div>  ← doc/45 新增
  </div>
  <div style="flex:1">  ← 内容区
    <div id="backup-panel" class="content-panel">...</div>
    <div id="base-panel" class="content-panel">...</div>
    ... 各面板 ...
    <div id="vlt-panel" class="content-panel">...</div>  ← doc/45 新增
  </div>
</div>
```

### 4.2 打开弹窗

`SettingPlugin.openSettingDialog(panelName, callback)` →
`layer.open({ content: jsxToString(<SettingDialog ... />) })` →
`success` 回调中 `loadForm()` + `bindClick()`。

### 4.3 面板切换

`SettingPlugin.bindClick()` 绑定 `.side-menu-item` 的 click 事件：
- 切换 active 类
- 隐藏所有 `.content-panel`，显示选中的
- cache-panel 隐藏 saveBtn + 显示 clean-all
- vlt-panel 隐藏 saveBtn + 隐藏 clean-all
- 其他面板显示 saveBtn + 隐藏 clean-all

### 4.4 添加新面板的正确方式

1. 在 `SettingDialog` 组件中添加侧栏菜单项 + 面板内容
2. 在 `SettingPlugin.bindClick()` 中处理特殊按钮显隐逻辑
3. 在 `SettingPlugin.bindClick()` 中绑定新面板内按钮的事件
4. **不要**用 MutationObserver 监听弹窗出现再 DOM 注入——这是绕路

## 5. 独立脚本集成流程

详见 `.agents/skills/userscript-integration/SKILL.md`。

关键步骤：
1. 6 维度调研（站点/GM_API/数据源/事件源/网络/主项目冲突）
2. 第 1.5 步冲突排查（grep 关键操作符到 src/）
3. 模块拆分（单文件 or 子目录）
4. 编码（BasePlugin 子类 + initCss + handle）
5. main.tsx 注册
6. 文档（doc/NN-描述.md）
7. 验证（tsc -b + vite build）

## 6. 构建配置

### 6.1 vite.config.ts

- `entry: 'src/main.tsx'`
- `userscript`：name/namespace/version/match/include/grant/connect/run-at
- `grant`：GM_xmlhttpRequest/GM_openInTab/GM_setValue/GM_getValue/GM_addValueChangeListener/GM_registerMenuCommand/unsafeWindow
- `@require`：全部移除（7 库 ESM import + parallel_GM_xmlhttpRequest URL 失效）
- `css.lightningcss.errorRecovery: true`（layer.css IE hack 容错）
- `build.minify`：默认 esbuild（terser 可选但已回退）

### 6.2 tsconfig.app.json

- `strict: true` + `noUnusedLocals/Parameters` + `noFallthroughCasesInSwitch`
- `jsx: react-jsx`
- `moduleResolution: bundler`
- `target: ES2020` + `lib: ES2020`（注意：`Array.prototype.at` 需 ES2022，用 `[length-1]` 替代）
- `include: ["src"]`（.agents/ 不在 include 内，但 Zed TS 语言服务会扫描 .tsx）

## 7. 文档规范

- `doc/NN-描述.md`，编号递增
- 头部元数据块：文档类型 + 文档状态
- 已执行（✅）的文档永不可改（migration 原则）
- 后续变更新建递增编号文档
- `doc/README.md` 维护文档清单 + 阅读顺序 + 当前进度概览

## 8. 更新本文档的时机

- 新增/删除/重命名源文件
- 新增/删除插件
- 修改核心架构（main.tsx 启动序列/PluginManager/BasePlugin）
- 新增/移除第三方库
- 修改构建配置（vite.config/tsconfig）
- 每次集成新独立脚本后
