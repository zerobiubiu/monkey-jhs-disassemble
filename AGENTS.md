# 项目架构地图

> 本文档描述 `monkey-jhs-disassemble` 项目（对外名称 **JavDB Power Tools**）的完整架构，
> 供 AI agent 快速理解项目结构。
> 每次代码变更（新增/删除/重命名文件、修改核心架构）时必须同步更新本文档。

## 1. 项目概述

将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为基于
`vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目。
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。后续集成了多个独立油猟脚本，
形成 JavDB / MissAV 双站增强工具箱，共 40 个功能插件（JavDB 38 + MissAV 2）。

- **构建工具**：Vite 8 + vite-plugin-monkey 8
- **语言**：TypeScript 6（strict 模式，全量去 @ts-nocheck）
- **UI 框架**：React 19（仅用 jsxToString 渲染 HTML 字符串，不依赖 react-dom）
- **CSS 处理**：lightningcss（errorRecovery 容错 IE hack）
- **包管理**：Bun
- **构建命令**：`bun run build` = `tsc -b && vite build`

## 2. 目录结构总览

```
monkey-jhs-disassemble/
├── src/                    # 源码（tsconfig include）
│   ├── main.tsx            # 入口：启动序列 + 注册插件（javdb 含升级插件 + missav 2）
│   ├── core/               # 核心模块（含 feature-flags）
│   ├── plugins/            # 插件模块（base-plugin + plugin-manager + 各功能插件）
│   ├── components/         # React 函数组件（jsxToString 转 HTML 字符串）
│   │   ├── fc2/            # FC2 专属组件（6 个）
│   │   └── setting-panels/ # 设置面板子组件（9 个 + hr-style 辅助）
│   ├── constants/          # 常量（site/status/video-quality/api）
│   ├── resources/          # 资源（icons SVG）
│   ├── styles/             # CSS 文件（?raw import via initCss）
│   └── types/              # 类型声明（globals.d.ts）
├── archetype/              # 原始脚本 + 独立油猴脚本（只读参考）
├── doc/                    # 文档（NN-描述.md，编号递增，不可回头改）
├── dist/                   # 构建产物（vite build 清空重建）
├── changelog/              # 更新日志（CHANGELOG.md）
├── .agents/skills/         # Agent skills（userscript-integration）
├── PRODUCT.md              # 产品定位、品牌个性与界面设计原则
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
2. CSS 注入（javdb-site/a-normal-buttons/common-toolbar/accessibility/design-tokens/loading/viewer/logger）
3. 全局挂载（utils/gmHttp/storageManager/loadGfriends/filetreeDb/WebDavClient/refresh/cleanCache）
4. BroadcastChannel('channel-refresh') 跨标签页刷新
5. loading/show/showImageViewer 挂载
6. clog 日志控制台 + 全局异常捕获
7. tooltip
8. encryptCredential/decryptCredential + setupLayerWrapper
9. **PluginManager 实例化 + 注册 40 插件**（javdb 38 + missav 2，在 `if (isJavdbSite)` / `if (isMissavSite)` 块内）
10. **页面判定**（`initPageContext()` → `window.isDetailPage/isListPage/isFc2Page`）— **先于 CSS**
11. `await processCss()` — 并发执行所有插件 initCss（按 `pageTypes` 过滤不匹配插件）
12. `await storageManager.runMigrations()` — 版本化数据迁移（javdb only，后续启动仅读版本号 ~1ms）
13. `storageRevision.init()` + `onRemoteChange()` — 跨标签页缓存失效回调
14. `await processPlugins()` — 并发执行所有插件 handle（按 `pageTypes` 过滤）
15. `SettingPlugin.autoBackup()` — 自动备份（javdb only）
16. `registerDiagnosticsMenu()` — 插件诊断 Tampermonkey 菜单
17. `beforeunload` → `pluginManager.destroyAll()` — 销毁所有插件资源（TaskSupervisor.abort）

**关键点**：
- 页面判定先于 `processCss()`（doc/139：PluginManager 按 `pageTypes` 过滤）
- `window.isDetailPage` 等直接访问（doc/134：不再需要 `(window as any)`）
- 19 个插件声明 `pageTypes`，不匹配插件不注入 CSS、不执行 handle
- 9 个资源密集型插件使用 TaskSupervisor 管理定时器/Observer/事件监听器
- 版本化迁移（doc/135）：6 步映射为版本 0→6，后续启动仅 1 次 IDB 读取
- StorageRevision（doc/144）：16 个写入方法递增修订号 + BroadcastChannel 广播

### 3.2 插件系统

**`src/plugins/base-plugin.ts`** — BasePlugin 基类：
- `getName(): string` — 插件名（注册去重用）
- `async initCss(): Promise<string>` — 返回 CSS 字符串（由 PluginManager.utils.insertStyle 注入）
- `async handle(): Promise<void>` — 主逻辑
- `getBean<K>(name): PluginMap[K]` — 按名获取其他插件实例（泛型，已知名称返回精确类型）
- `get sites(): SiteType[]` — 适用站点（空 = 所有，doc/139）
- `get pageTypes(): PageType[]` — 适用页面类型（空 = 所有，doc/139/140）
- `destroy(): void` — 销毁钩子（TaskSupervisor.abort，doc/139）
- `getPageInfo()/getActressPageInfo()/getSelector()/getBoxCarInfo()` 等 — 列表页/详情页辅助

**`src/plugins/plugin-manager.ts`** — PluginManager：
- `register(pluginClass)` — 实例化 + 注入 pluginManager + 按 getName() 去重
- `getBean<K>(name): PluginMap[K] | undefined` — 按名获取插件实例（泛型类型安全）
- `processCss(): Promise<Plugin[]>` — 并发执行所有插件 initCss（按 pageTypes 过滤）
- `processPlugins(): Promise<Plugin[]>` — 并发执行所有插件 handle（按 pageTypes 过滤）
- `getDiagnostics()` — 获取插件诊断信息（注册数 + CSS/handle 执行结果 + 耗时）
- `destroyAll()` — 调用所有插件的 destroy()（beforeunload 时触发）

**`src/plugins/plugin-registry.ts`** — PluginMap 类型映射（doc/132）：
- 40 个插件名 → 具体类的 `import type` 映射，零运行时开销
- 新增插件时在此添加一行映射即可

### 3.3 插件清单

**主脚本拆分插件（22 个）**：来自 `archetype/jhs.user.js`

| 插件 | 文件 | 职责 |
|------|------|------|
| ListPagePlugin | list-page-plugin.tsx + list-page/ 子目录（4 模块：lp-filter / lp-dom / lp-translate / lp-jump-page） | 列表页主插件：过滤/状态标签/翻译/点击绑定 |
| AutoPagePlugin | auto-page-plugin.ts + auto-page/ 子目录（2 模块：ap-fetch / ap-scroll） | 瀑布流自动翻页 |
| FoldCategoryPlugin | fold-category-plugin.tsx | 折叠分类 |
| ListPageButtonPlugin | list-page-button-plugin.tsx | 列表页按钮组（批量打开/排序切换/加入黑名单） |
| HistoryPlugin | history-plugin.tsx（+1 新模块：history-data） | 鉴定记录 |
| SettingPlugin | setting-plugin.tsx（+3 新模块：setting-form-load / setting-form-bind / setting-tag-ops） | **设置弹窗（侧栏+面板）** + WebDav 备份 + 缓存清理 |
| NavBarPlugin | nav-bar-plugin.tsx | 导航栏 |
| HitShowPlugin | hit-show-plugin.tsx | 热播 |
| Top250Plugin | top250-plugin.tsx | Top250 排行榜 |
| DetailPagePlugin | detail-page-plugin.ts | 详情页主插件 |
| ReviewPlugin | review-plugin.tsx | 评论 |
| DetailPageButtonPlugin | detail-page-button-plugin.tsx（+3 新模块：dpb-list-panel-fetch / dpb-list-panel-render / dpb-rating-api） | 详情页按钮（想看/观看/评分/清单/字幕） |
| HighlightMagnetPlugin | highlight-magnet-plugin.ts | 高亮磁链 |
| PreviewVideoPlugin | preview-video-plugin.tsx | 预览视频 |
| ActressInfoPlugin | actress-info-plugin.tsx | 演员信息 |
| OtherSitePlugin | other-site-plugin.tsx（+1 新模块：osp-probe） | 第三方站点 |
| WantAndWatchedVideosPlugin | want-and-watched-videos-plugin.tsx | 想看/已观看 |
| RelatedPlugin | related-plugin.tsx | 相关清单 |
| BlacklistPlugin | blacklist-plugin.tsx（+2 新模块：blacklist-data / blacklist-add） | 黑名单 |
| FavoriteActressesPlugin | favorite-actresses-plugin.tsx | 收藏演员 |
| NewVideoPlugin | new-video-plugin.tsx（+1 新模块：edit-actress） | 新作品检测 |
| Fc2Plugin | fc2-plugin.tsx | FC2 |

**独立脚本集成插件（12 个）**：来自 `archetype/*.user.js`

| 插件 | 文件 | 来源脚本 | doc |
|------|------|----------|-----|
| RatingDisplayPlugin | rating-display/ 子目录（6 模块） | jhsRatingDisplay.user.js | doc/25 |
| KeyPageTurningPlugin | key-page-turning-plugin.ts | keyPageTurning.user.js | doc/34 |
| ModMyListOpenWayPlugin | mod-my-list-open-way-plugin.ts | modMyListOpenWay.user.js | doc/35 |
| PageSortPlugin | page-sort-plugin.ts | pageSort.user.js | doc/36+37 |
| StatusTagFilterPlugin | status-tag-filter-plugin.ts + status-tag-filter/ 子目录（3 模块：stf-collect / stf-apply / stf-ui） | statusTagFilter.user.js | doc/38 |
| ListWaterfallPlugin | list-waterfall-plugin.ts + list-waterfall/ 子目录（2 模块：lw-fetch / lw-scroll） | listWaterfall.user.js | doc/39 |
| ListReadingStatusPlugin | list-reading-status-plugin.ts（+2 新模块：lrs-sort / lrs-filter） | listReadingStatus.user.js | doc/40 |
| ModalListDisablerPlugin | modal-list-disabler-plugin.ts | modalListDisabler.user.js | doc/42 |
| VideoListsTagPlugin | video-lists-tag/ 子目录（6 模块，含服务端/本地对账） + db/ 子目录（3 模块：vlt-db-core / vlt-db-reconcile / vlt-db-migrate）+ server/ 子目录（2 模块：vlt-server-api / vlt-server-recover） | listsOptionSync + videoListsTag | doc/45 + doc/126 |
| CarListReaderPlugin | car-status-sync/ 子目录（6 模块） | jhsCarListReader.user.js | doc/46 |
| MissavStatusTagPlugin | car-status-sync/ 子目录（6 模块） | missavStatusTag.user.js | doc/46 |

**升级新插件（5 个，feature flag 可关）**：对照 `jhs.3.3.6.027`，见 doc/76（CoverButtonPlugin 已于 doc/82 删除）

| 插件 | 文件 | flag | 职责 |
|------|------|------|------|
| TranslatePlugin | translate-plugin.ts | translatePlugin | 详情页标题翻译 |
| ScreenShotPlugin | screenshot-plugin.ts | screenShotPlugin | javstore 截图墙 |
| MagnetHubPlugin | magnet-hub-plugin.tsx | magnetHubPlugin | 多引擎磁链 |
| ImageRecognitionPlugin | image-recognition-plugin.tsx | imageRecognitionPlugin | 以图识图 |
| Fc2By123AvPlugin | fc2-by-123av-plugin.tsx + fc2-123av/ 子目录（2 模块：fc2-browse / fc2-detail） | fc2By123AvPlugin | 123Av FC2 浏览 |

**新增功能插件（1 个）**：本项目自创（非 archetype 拆分/集成/升级）

| 插件 | 文件 | 职责 |
|------|------|------|
| VisitHistoryPlugin | visit-history-plugin.ts | 访问记录：记录所有打开过的 javdb 页面，详情页元数据链接悬浮显示「最近打开时间」（复用全局 tooltip） |

### 3.4 核心模块 `src/core/`

| 文件 | 职责 |
|------|------|
| feature-flags.ts | 升级特性开关（localStorage 可覆盖） |
| libs.ts | 第三方库 ESM import + 挂全局（$/layer/Tabulator/Toastify/localforage/Viewer/md5） |
| _jquery-global.ts | jquery 副作用模块（先于 layer 挂 window.jQuery） |
| storage-manager.ts | IndexedDB 存储管理（JAV-JHS/appData，localforage 实例；提供运行时缓存清理方法） |
| gm-http.ts | GM_xmlhttpRequest 封装（GET/POST/分块下载/重试） |
| common-util.ts | 通用工具（retry/htmlTo$dom/getUrlParam/isMobile/loopDetector） |
| toast.ts | Toastify-js 封装（show.ok/error/success） |
| loading.ts | 加载遮罩 |
| logger.tsx | 日志控制台（clog） |

| image-preview.tsx | 图片查看器 |
| viewer.ts | Viewer.js 配置 |
| webdav.ts | WebDav 客户端 |
| webdav-crypto.ts | WebDav 加密/解密 |
| gfriends.ts | GFriends 数据 |
| layer-wrapper.ts | layer.js 包装（默认 closeBtn/shadeClose + ESC 栈；注入 layer-fix.css） |
| tooltip.ts | tooltip |
| style-injector.ts | CSS 注入（injectCss） |
| jsx-to-string.ts | 轻量 JSX→HTML 字符串渲染器（替代 react-dom/server） |
| async-task-queue.ts | 异步任务队列 |
| auto-backup.ts | 自动备份（凭证 ID 管理 + 触发判断 + 增量滚动文件名） |
| plugin-diagnostics.tsx | 插件诊断（渲染状态表格 + 纯文本报告 + GM 菜单注册） |
| page-context.ts | 集中式页面类型检测（detectPageContext + pageContext 单例） |
| task-supervisor.ts | AbortSignal 统一生命周期管理（定时器/Observer/事件监听器） |
| list-dom-bus.ts | 列表页 DOM 变更总线（单 Observer + rAF 批量分发 .item 新增） |
| pagination-state.ts | 瀑布流分页状态机（idle/loading/error/exhausted + retry） |
| storage-revision.ts | 跨标签页存储修订号追踪（BroadcastChannel 广播 + 缓存失效回调） |
| util/ | 核心工具子目录：broadcast.ts（三重广播总线 GM/localStorage/CustomEvent 三通道统一收发，Wave 3 新增）、back-to-top.ts（回到顶部按钮工厂，rAF 节流滚动监听 + 平滑回顶）、tabulator-factory.ts（Tabulator 表格工厂，中文语言包 + 基础配置）、util-async.ts（withLoading 加载蒙层异步包装）、util-clipboard.ts（copyToClipboard 剪贴板复制）、util-cookie.ts（addCookie 批量写入 cookie）、util-date.ts（getNowStr 日期时间格式化）、util-dom.ts（insertStyle / htmlTo$dom DOM 工具）、util-download.ts（download 文件下载 + MIME 映射）、util-misc.ts（isMobile / sleep / copyObj 杂项工具）、util-popup.ts（q 确认框 / 响应式弹窗区域）、util-retry.ts（retry 带重试异步执行）、util-sort.ts（genericSort 多键排序）、util-status-tag.tsx（STATUS_TAG_CONFIG 状态标签配置与渲染）、util-translate.ts（translateText Google 翻译）、util-url.ts（isUrl / getUrlParam URL 工具）、esc-layer.ts（ESC 层管理：gate + 栈同步 + 全局键监听 + setupEscClose，Wave 4 新增）、logger-panel.tsx（日志面板 DOM 渲染 + 事件绑定 + 过滤 + localStorage 持久化，Wave 4 新增） |

### 3.5 组件 `src/components/`（135 个）

所有组件都是 **React 函数组件**，返回 JSX，经 `jsxToString()` 转 HTML 字符串后
供插件 `.append()` / `.html()` / `layer.open content` 消费。
不使用 react-dom/server，不依赖 react-dom。

### 3.6 样式 `src/styles/`

CSS 文件通过 `?raw` import 为字符串，由 `initCss()` 返回 →
`PluginManager.processCss()` → `utils.insertStyle()` 注入。
顶层 CSS 由 `main.tsx` 的 `injectCss()` 直接注入（最先注入
`design-tokens.css` 设计令牌，再注入 `accessibility.css` 无障碍样式）。
所有 CSS 已清理 `transition: all` 反模式（doc/147），使用具体过渡属性。

### 3.7 全局类型 `src/types/globals.d.ts`

声明 Tampermonkey Grant API（`GMXmlHttpRequestDetails` 接口 + 精确函数签名，
doc/145 类型化）和运行时全局（$/layer/Tabulator/utils/gmHttp/storageManager/
clog/show 等）。GM API 已类型化，应用全局仍为 `any`（后续逐步消除）。

### 3.8 工具链

- **构建**：`bun run build` = `tsc -b && vite build`
- **ESLint**：`bun run lint`（`eslint.config.js`，TypeScript recommended +
  `prefer-const`/`no-useless-escape` error 门禁，`no-explicit-any` warn，
  基线 0 errors / 764 warnings）
- **Stylelint**：`bun run lint:css`（`.stylelintrc.json`，CSS 一致性检查）

### 3.9 产品设计上下文 `PRODUCT.md`

记录 JavDB Power Tools 的目标用户、产品用途、品牌个性、反例、设计原则与无障碍基线。
涉及界面新增或改版时以此约束视觉语言和交互反馈，保持增强功能与 JavDB/Bulma 原站
体验一致。

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
    <div class="side-menu-item" data-panel="cache-panel">🧹 清理缓存</div>
    <div class="side-menu-item" data-panel="vlt-panel">📋 收藏清单关系</div>  ← doc/45 新增
    <div class="side-menu-item" data-panel="missav-panel">🎬 MissAV 同步</div>
    <div class="side-menu-item" data-panel="preload-panel">⚡ 预加载配置</div>  ← doc/110 新增
    <div class="side-menu-item" data-panel="diagnostics-panel">📊 插件诊断</div>  ← doc/133 新增
  </div>
  <div style="flex:1">  ← 内容区
    <div id="backup-panel" class="content-panel">...</div>
    <div id="base-panel" class="content-panel">...</div>
    ... 各面板 ...
    <div id="vlt-panel" class="content-panel">...</div>  ← doc/45 新增
    <div id="preload-panel" class="content-panel">...</div>  ← doc/110 新增
    <div id="diagnostics-panel" class="content-panel">...</div>  ← doc/133 新增
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
- diagnostics-panel 隐藏 saveBtn + 隐藏 clean-all
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

### 6.1.1 版本号自动递增规则（强制）

**每次修改 `src/` 下的源码内容（功能逻辑、CSS、类型、插件等）时，必须同步递增 `vite.config.ts` 中 `userscript.version` 的 patch 位。**

- 版本号格式：`major.minor.patch`（语义化版本）
- **patch 递增**：修 bug、小改动、优化、协同修复等 → `1.0.0` → `1.0.1` → `1.0.2`...
- **minor 递增**：新增插件、新增功能模块、较大功能变更 → patch 归零，minor+1 → `1.0.5` → `1.1.0`
- **major 递增**：架构级重构、不兼容变更 → minor/patch 归零，major+1 → `1.5.3` → `2.0.0`
- 纯文档修改（`doc/` 下的 `.md`）、纯 `AGENTS.md` 修改不递增版本号
- 修改 `vite.config.ts` 自身的构建配置（不改源码逻辑）不递增版本号
- **执行时机**：代码修改完成、`tsc -b && vite build` 验证通过后，在最终回复前递增版本号
- **验证**：构建产物 userscript 头部的 `@version` 应与 `vite.config.ts` 的 `version` 一致

### 6.2 tsconfig.app.json

- `strict: true` + `noUnusedLocals/Parameters` + `noFallthroughCasesInSwitch`
- `jsx: react-jsx`
- `moduleResolution: bundler`
- `target: ES2020` + `lib: ES2020`（注意：`Array.prototype.at` 需 ES2022，用 `[length-1]` 替代）
- `include: ["src"]`（.agents/ 不在 include 内，但 Zed TS 语言服务会扫描 .tsx）

### 6.3 测试运行器（Vitest）

- 命令：`bun run test` = `vitest run`（一次性运行，非 watch）。
- 配置：`vitest.config.ts`，**与 `vite.config.ts` 分离**——不引入 react/monkey 插件。
  `environment: 'node'`（Node 18+ 全局提供 `crypto.subtle`/`atob`/`btoa`，满足
  AES-GCM 路径）；`include: ['tests/**/*.test.ts']`。
- 测试目录 `tests/` **在 `src/` 之外**，故 `tsc -b`（app 仅 include src、node 仅
  include vite.config.ts）、`eslint src/`、`vite build` **均不覆盖** `tests/`——测试
  代码不影响用户脚本构建门禁，新增/修改测试不改变产物字节。
- 被测模块为纯函数，用 `react.createElement` 构造节点（非 JSX），无需 JSX 转换或 DOM。
- 当前套件（3 个）：`tests/jsx-to-string.test.ts`（doc/151 XSS 转义 + 协议白名单）、
  `tests/backup-crypto.test.ts`（doc/137 AES-GCM 往返 + 错口令/篡改拒绝，node 环境）、
  `tests/storage-migration.test.ts`（doc/135/162/163：第一组 `runMigrations` 集成契约
  幂等/门控/全量/缓存失效/失败重试 5 用例 + 第二组附件分析路径正向回归
  `clean_no_url_blacklist` 跨清单过滤/recordTime→createTime 与 `async_merge_other`
  废弃键删除 2 用例，共 7 用例）。迁移套件因 `constants/site.ts` 模块加载期读
  `window.location.href` 而用文件级 `// @vitest-environment jsdom` 指令，并以手写
  in-memory `FakeForage`（`Map` 后端）替代 IndexedDB，无 fake-indexeddb 依赖；
  `beforeEach` 注入 `globalThis.clog`/`globalThis.utils`/`window.clean_cacheSettingObj`
  noop 替身（后者供 `async_merge_other`→`saveSetting` 路径）。
- 可测试性 seam：`StorageManager` 构造函数 `constructor(forageInstance?: unknown)` 允许
  注入存储替身（生产无参调用行为不变），`static __resetForTesting()` 重置单例供用例隔离。
  参数用 `unknown` 而非 `any`，遵守「触及文件时消除新增 any」。
- devDependencies：`vitest` + `jsdom`（jsdom 预留给未来需 DOM 的套件；当前套件用 node）。
- **版本规则交互**：仅新增/修改测试（`tests/`、`vitest.config.ts`、`package.json` 的
  scripts/deps/version 字段）不改变用户脚本逻辑，**不递增 `userscript.version`**；
  `package.json` 的 `version` 字段与 `userscript.version` 同步属元数据修正（§6 批次 6）。
- 增量 any 消除示范（doc/164）：对**已触及文件**按批次 6「触及即消除」，将
  `storage-manager` 四个迁移方法的 `any[]` 收紧为 `CarRecord[]`/`BlacklistItem[]`/
  `FavoriteActress[]`（接口含旧迁移字段可选属性 + `[key:string]:any` 索引签名，回调改
  由上下文推断，零 `as any` 回填、无隐式 any）；eslint `no-explicit-any` 实测
  805→786（−19）。残留 any（字段 `forage: any`、`getSetting`/`saveSetting` 的 any、
  各接口索引签名、`merge_table_name`/`async_merge_other`/`getBlacklistCarList` 原始读）
  属多会话 backlog——big-bang 消除需先补 jQuery/layer/Tabulator 类型声明（doc/165 已核实
  `package.json` devDependencies 确无 `@types/jquery`/`@types/tabulator-tables`/
  `@types/layui-layer`，此即 786 警告主体来源），不在单轮内强推。

## 7. 文档规范

- `doc/NN-描述.md`，编号递增
- 头部元数据块：文档类型 + 文档状态
- 已执行（✅）的文档永不可改（migration 原则）
- 后续变更新建递增编号文档
- `doc/README.md` 维护文档清单 + 阅读顺序 + 当前进度概览

### 7.1 代码变更必须同步写 doc 文档（强制）

**每次修改 `src/` 下的源码（功能逻辑、bug 修复、优化、插件增删等）时，
必须在回答用户前同步编写 `doc/NN-描述.md` 文档，不等用户提醒。**

- 小变更（几行代码的 bug 修复/优化）可合并到同一份 doc 中，但必须在背景
  部分说明合并了哪些变更
- 大变更（新增/删除插件、架构调整）必须独立一份 doc
- 文档必须包含：背景、方案、实施（修改文件清单）、执行验证记录（tsc +
  vite build 输出）、后续验证建议
- 同时更新 `doc/README.md` 文档清单 + `changelog/CHANGELOG.md` +
  `vite.config.ts` version（按 §6.1.1 规则）
- **禁止**只改代码不写文档就回复用户

## 8. 更新本文档的时机

- 新增/删除/重命名源文件
- 新增/删除插件
- 修改核心架构（main.tsx 启动序列/PluginManager/BasePlugin）
- 新增/移除第三方库
- 修改构建配置（vite.config/tsconfig）
- 每次集成新独立脚本后

## 9. 代码风格与一致性约定（强制）

以下约定由 doc/153–156 确立，所有 agent 编辑 `src/` 时必须遵守；违反即视为缺陷。

### 9.1 导入顺序（六组，组间空行）

每个模块顶部 import 按下列顺序分组，组与组之间空一行；副作用导入
（`import './x'` 无绑定，如 `import './core/libs'`）若有则**恒居首位**：

1. 外部类型导入：`import type { ... } from 'react'` 等
2. 常量：`../constants/*`
3. 核心：`../core/*`，**含核心类型导入**（如 `import type { PageType } from '../core/page-context'`）
4. 本地插件：`./base-plugin` 及 `./<同级模块>`
5. 组件：`../components/*`
6. 样式：`*.css?raw` **恒居末位**

重排导入时**只改行序与空行分组，绝不增删/改名/改路径**；tsc 的 `noUnusedLocals`
与未定义名检查是导入完整性的硬安全网。

### 9.2 日志分层：clog vs console（含 devtools 跟踪例外）

`src/core/logger.tsx` 的 `addLog` **从不写 console**，仅推入页内面板；**只有
`error()` 额外 `console.error(...)`**。即 `clog.log`/`clog.warn`/`clog.debug`
**仅面板可见**——这是有意设计，且与原始 `jhs.user.js` 日志器一致，**不得**为
「表面一致」给 `log()`/`warn()` 加 console 转发（否则 60+ 处既有 `clog.log/warn`
会刷屏 devtools，制造原始从未产生的噪声）。`clog` **没有 `.info()` 方法**
（仅 log/error/warn/debug），禁止写 `clog.info(...)`。

项目自有代码的错误/恢复路径用 `clog.error`（同步转发 console.error，devtools 仍可见）。

**例外——集成本地脚本的 devtools 跟踪体系保留 `console.*`**：源自独立油猴脚本
（doc/45/126 等）的模块使用有意的 `${LOG}` / `${LOG_PREFIX}` / 方括号前缀模板字面量
`console.log/warn`，以及 `%c` 着色日志工厂（如 `car-status-sync/car-status-logger.ts`、
`rating-display/rating-utils.ts`）。把这些改成 `clog.log/warn` 会**静默丢失 devtools
同步诊断输出**，违反「与原始脚本零偏差」，且 `tsc`/`vite build` **无法捕获**。
因此：集成脚本的跟踪日志**保留 `console.log/warn`**；`%c` 工厂按 archetype 原样用
`console.*`。结论是**有意分层**——集成脚本保留原生 devtools 跟踪，项目自有代码用
面板 `clog`（沿用 doc/154 先例：彼时也只把 `console.error`→`clog.error`）。

### 9.3 toast 安全：show.error 必须传字符串

`show.error`/`show.ok`/`show.success`/`show.info` 期望字符串。禁止直传 Error 对象
或使用不安全的 `e.message || e`（非 Error 拒绝值会渲染为 `[object Object]`）。
统一写法：`show.error('描述: ' + (e instanceof Error ? e.message : String(e)))`。

### 9.4 z-index 层级（设计令牌）

layer.js 的 z-index **无上限递增**（每次开弹窗 +1、mousedown +1），故 above-layer
元素需 genuinely large 常量。`src/styles/design-tokens.css` 定义两级，**禁止**再出现
散落的 `9999`/`99999999`/`9999999999` 字面量：

- `--jhs-z-page: 9999`：页面内元素（back-to-top / load-all / 瀑布流按钮 / tag 下拉）
- `--jhs-z-top: 999999999`：above-layer 层（tooltip / loading / logger / fc2 / visit-history）

`image-preview.css` 的 `/* __Z_INDEX__ */` 为运行时占位符，**不得**替换为 `var()`。

### 9.5 CSS 类名前缀

插件专属类必须加 `jhs-` 或插件专属前缀（如 video-lists-tag 用 `jhs-vlt-`），避免与
站点/框架/其他插件冲突。同一通用名（如 `.menu-btn`）**不得**在多个注入同一 head 的
样式表中以冲突声明重复定义——按上下文拆为不同前缀名（见 doc/154 的
`.jhs-toolbar-menu-btn` / `.jhs-setting-menu-btn`）。

### 9.6 审计方法论

对全树做一致性审计时**禁止静默截断**（如「每维最多 20 条」会在命中上限时停扫，掩盖
真实表面）；必须无上限扫描，完整发现持久化到 `local://` 后再按发现数装箱为互不相交
的并行编辑组。审计→执行链路引入的任何 `console.log/warn`→`clog.log/warn` 转换，
须先用 §9.2 的跟踪例外复核，必要时窄范围回退（见 doc/155）。

### 9.7 零硬编码 HTML 边界（强制）

`src/` 内禁止以字符串字面量编写 **UI 模板**（按钮/弹窗/卡片/表格/列表项等多元素结构）；
此类 UI 必须为 `src/components/*.tsx` 的 React 组件，经 `jsxToString` 渲染为 HTML 字符串
（`.ts` 调用方用 `*Html()` 便捷辅助，如 `logColoredHtml`/`styleBlockHtml`/`scrollTopIconHtml`）。
判定与豁免：

- **违规**：字符串字面量被解析进 DOM——`innerHTML =`、jQuery `.html()/.append()/.prepend()/
  .after()/.before()`、jQuery HTML 片段选择器 `$( '<...>' )`、或拼接进上述——且非 sanctioned
  常量。
- **豁免（搜索/比较 needle）**：对 DOM 派生文本做 `.indexOf/.includes/.startsWith/.match/.test`
  的字面量（不生成元素），如 `css.indexOf('<style>')`、`.includes('<span>1005</span>')`。
- **不在本规则范围**：jQuery `$( '<tag>' )` / `$( '<tag class=...>' )` 元素构造（createElement
  等价 API，空容器/带属性句柄）；非「拼字符串编写 UI 模板」，不作违规、不强制改写。
- **sanctioned 数据常量**：经 `dangerouslySetInnerHTML` 在组件内注入的 SVG/CSS 命名常量
  （元素本身仍由组件生成）。

审计时按上述四类（违规 / needle 豁免 / jQuery 构造 idiom / sanctioned 常量）逐条 triage，
**禁止**把 jQuery 元素构造 idiom 计为违规而空转改写。

## 10. 大文件拆分与代码复用规则（强制）

以下规则对所有 agent 编辑 `src/` 时强制生效；违反即视为缺陷。

### 10.1 单文件行数上限

- **硬上限**：单个 `.ts`/`.tsx` 文件不得超过 **800 行**（含注释与空行）。
- **软上限**：超过 **500 行** 的文件必须在下次触及该文件时评估拆分可行性，
  并在 doc 中记录评估结论（拆分 or 不拆 + 理由）。
- 新增代码时，若添加后文件将超过 500 行，**必须先拆分再添加**，不得先添加后补拆。

### 10.2 拆分原则

- **单一职责**：每个文件/模块只承担一个明确职责。若一个文件包含 2 个以上
  不相关的职责（如「数据获取 + UI 渲染 + 事件绑定 + 状态管理」），必须拆分。
- **按职责边界切分**：优先按「数据层 / 逻辑层 / 视图层 / 事件层」切分，
  而非按行数机械切割。
- **提取共享逻辑**：若两个文件存在相似逻辑（>10 行重复），必须提取为
  `src/core/` 或同目录下的共享模块，禁止 copy-paste 式重复。
- **组件原子化**：`src/components/` 下的组件应尽可能原子化——一个组件
  只做一件事。若组件内包含多个独立 UI 区块（如 9 个面板），必须拆为子组件。

### 10.3 代码复用规则

- **禁止重复实现**：若 `src/` 中已存在功能相同或高度相似的函数/组件，
  必须复用，不得新建。新建前必须 grep 全 `src/` 确认无重复。
- **相似功能合并**：若发现两个函数/组件功能相似但实现不同（如
  `markDataListHtml` vs `HitShowMovieItem`），必须合并为唯一实现，
  删除冗余方。
- **共享常量/类型**：跨文件使用的常量、接口、类型必须放在
  `src/constants/` 或 `src/types/` 中，不得在多个文件内重复定义。

### 10.4 拆分验证门禁

每次拆分操作必须满足：
1. `tsc -b && vite build` 通过
2. `bun run test` 全绿
3. 拆分前后 `jsxToString` 输出 DOM 等价（若涉及 UI）
4. 无循环导入
5. 导入顺序符合 §9.1
6. `bun run check:structure` 通过——大文件行数 / 目录扁平度的机械门禁（scripts/check-structure.ts）。超限文件须在 FILE_CEILINGS 中且不得抬高 ceiling；拆分后下调 ceiling 或删除条目；新文件 >800 行直接失败。

## 11. 目录规划规则（强制）

### 11.1 扁平度上限

- 单个目录下的**直接子文件**（不含子目录）不得超过 **20 个**。
- 超过 20 个时，必须按功能域/职责创建子目录归类。
- `src/components/` 当前 ~120 个直接文件已超限——后续新增组件必须按插件域
  归入子目录（如 `components/setting-panels/`、`components/fc2/`、
  `components/review/` 等），不得继续平铺。fc2/（6 组件）和 setting-panels/（9 面板 + 辅助）已建立。
- 机械执行：`bun run check:structure` 对每个目录的直接子文件数做门禁（DIR_CEILINGS 棘轮），超 20 的新增直接失败。

### 11.2 子目录划分原则

- **按插件域**：每个插件若有 3 个以上专属组件，应创建
  `components/<plugin-name>/` 子目录。
- **按功能层**：`core/` 下若某类模块超过 5 个（如网络请求相关：
  gm-http/webdav/webdav-crypto/gm-http-retry），应归入子目录。
- **按页面类型**：若组件仅服务于特定页面（列表页/详情页/FC2 页），
  可归入 `components/list-page/`、`components/detail-page/` 等。
- **子目录命名**：kebab-case，语义化，与插件 `getName()` 或功能域对应。

### 11.3 目录变更同步

- 新增/删除/移动子目录时，必须同步更新 AGENTS.md §2 目录结构总览。
- 移动文件后必须确认所有导入路径已更新（优先使用 `lsp rename_file`）。
