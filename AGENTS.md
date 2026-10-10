# 项目架构地图

> 本文档描述 `monkey-jhs-disassemble` 项目（对外名称 **JavDB Power Tools**）的完整架构，
> 供 AI agent 快速理解项目结构。
> 每次代码变更（新增/删除/重命名文件、修改核心架构）时必须同步更新本文档。
> **文档规范与文档相关要求见 [`docs/README.md`](docs/README.md)**，本文档不包含文档内容。

## 1. 项目概述

将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为基于
`vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目。
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。后续集成了多个独立油猴脚本，
形成 JavDB / MissAV 双站增强工具箱，共 44 个功能插件（JavDB 39 + MissAV 5）。

- **构建**：Vite 8 + vite-plugin-monkey 8；`bun run build` = `tsc -b && vite build`
- **语言**：TypeScript 6（strict，全量去 @ts-nocheck）
- **UI**：React 19（仅用 jsxToString 渲染 HTML 字符串，不依赖 react-dom）
- **CSS**：lightningcss（errorRecovery 容错 IE hack）；**包管理**：Bun

## 2. 目录结构总览

```
monkey-jhs-disassemble/
├── src/                    # 源码（tsconfig include）
│   ├── main.tsx            # 入口：启动序列 + 注册插件（javdb 含升级插件 + missav 5）
│   ├── core/               # 核心模块（含 domain/（领域层）、feature-flags、util/（含 site/）、sync/ 子目录）
│   ├── plugins/            # 插件模块（base-plugin + plugin-manager + 各功能插件）
│   ├── components/         # React 函数组件（jsxToString 转 HTML 字符串，按插件域分子目录）
│   ├── constants/          # 常量（site/status/video-quality/api）
│   ├── resources/          # 资源（icons SVG）
│   ├── styles/             # CSS 文件（?raw import via initCss，含 list-reflow/ 等子目录）
│   └── types/              # 类型声明（globals.d.ts）
├── archetype/              # 原始脚本 + 独立油猴脚本（只读参考）
├── docs/                   # 文档中心（索引、规范与要求见 docs/README.md）
├── dist/                   # 构建产物（vite build 清空重建）
├── changelog/              # 更新日志（CHANGELOG.md）
├── .agents/skills/         # Agent skills（userscript-integration）
├── PRODUCT.md              # 产品定位、品牌个性与界面设计原则
└── vite.config.ts / tsconfig*.json / package.json / bun.lock
```

## 3. 核心架构

### 3.1 入口 `src/main.tsx`

**职责**：启动序列 + 插件注册。执行流程：

1. `import './core/libs'` — 第三方库 CDN @require 注入，挂全局（$/layer/Tabulator/Toastify/localforage/Viewer/md5）
2. CSS 注入（javdb-site/a-normal-buttons/common-toolbar/accessibility/design-tokens/loading/viewer/logger）
3. 全局挂载（utils/gmHttp/storageManager/loadGfriends/filetreeDb/WebDavClient/refresh/cleanCache）
4. BroadcastChannel('channel-refresh') 跨标签页刷新
5. loading/show/showImageViewer 挂载
6. clog 日志控制台 + 全局异常捕获
7. tooltip
8. encryptCredential/decryptCredential + setupLayerWrapper
9. **PluginManager 实例化 + 注册 44 插件**（javdb 39 + missav 5，按 `if (isJavdbSite/isMissavSite)` 块）
10. **页面判定**（`initPageContext()` → `window.isDetailPage/isListPage/isFc2Page`）— **先于 CSS**
11. `await processCss()` — 并发执行插件 initCss（按 pageTypes 过滤不匹配插件）
12. `await storageManager.runMigrations()` — 版本化迁移（javdb only，后续启动仅读版本号 ~1ms）
13. `storageRevision.init()` + `onRemoteChange()` — 跨标签页缓存失效回调
14. `await processPlugins()` — 并发执行插件 handle（按 pageTypes 过滤）
15. `SettingPlugin.autoBackup()` — 自动备份（javdb only）
16. `registerDiagnosticsMenu()` — 插件诊断 Tampermonkey 菜单
17. `beforeunload` → `pluginManager.destroyAll()` — 销毁插件资源（TaskSupervisor.abort）

**关键点**：页面判定先于 `processCss()`；`window.isDetailPage` 等直接访问（无 `(window as any)`）；14 个插件声明 `pageTypes`（不匹配不注入 CSS/不执行 handle）；11 个资源密集型插件用 TaskSupervisor 管理定时器/Observer/事件；版本化迁移 6 步→版本 0→6；StorageRevision 16 个写入方法递增修订号 + BroadcastChannel 广播。

### 3.2 插件系统

**`src/plugins/base-plugin.ts`** — BasePlugin 基类：
- `getName()` 插件名（注册去重）；`async initCss()` 返回 CSS 字符串；`async handle()` 主逻辑
- `getBean<K>(name): PluginMap[K]` 按名获取其他插件实例（泛型，已知名称返回精确类型）
- `get sites()/get pageTypes()` 适用站点/页面（空 = 所有）；`destroy()` 销毁钩子（TaskSupervisor.abort）
- `getPageInfo()/getActressPageInfo()/getSelector()/getBoxCarInfo()` 等列表页/详情页辅助

**`src/plugins/plugin-manager.ts`** — PluginManager：
- `register(pluginClass)` 实例化 + 注入 pluginManager + 按 getName() 去重
- `getBean<K>(name)` 按名获取插件实例；`processCss()/processPlugins()` 并发执行（按 pageTypes 过滤）
- `getDiagnostics()` 插件诊断（注册数 + CSS/handle 执行结果 + 耗时）；`destroyAll()` 销毁全部

**`src/plugins/plugin-registry.ts`** — PluginMap 类型映射：40 个插件名 → 具体类 `import type` 映射，零运行时开销；新增插件时添加一行。

### 3.3 插件清单

共 **44 个功能插件**（JavDB 39 + MissAV 5）：主脚本拆分 22 + 独立脚本集成 12 + 升级新插件 5（feature flag 可关）+ 新增功能插件 5。
**完整清单（含职责/来源脚本/flag）见 [`docs/plugin-catalog.md`](docs/plugin-catalog.md)**，增删插件时同步更新该文件。

### 3.4 核心模块 `src/core/`

共 **67 个文件**：顶层 26 + `domain/`（领域层共享内核）+ `storage/`（存储域拆分）+ `sync/`（跨站同步共享设施）+ `util/`（核心工具集，含 site/）四个子目录 41。
**完整清单（含职责）见 [`docs/plugin-catalog.md`](docs/plugin-catalog.md)**，增删模块时同步更新该文件；`bun run check:docs` 会校验本文件的插件/模块计数与 catalog 是否一致。

### 3.5 组件 `src/components/`（140 个）

所有组件都是 **React 函数组件**，返回 JSX，经 `jsxToString()` 转 HTML 字符串后
供插件 `.append()` / `.html()` / `layer.open content` 消费。不使用 react-dom/server。

### 3.6 样式 `src/styles/`

CSS 文件通过 `?raw` import 为字符串，由 `initCss()` 返回 → `processCss()` → `utils.insertStyle()` 注入。
顶层 CSS 由 `main.tsx` 的 `injectCss()` 直接注入（最先 `design-tokens.css` 设计令牌 →
`accessibility.css` 无障碍样式 → `filter-chip-base.css` 筛选芯片共享基础）。
所有 CSS 已清理 `transition: all` 反模式，使用具体过渡属性。

### 3.7 全局类型 `src/types/globals.d.ts`

声明 Tampermonkey Grant API（`GMXmlHttpRequestDetails` 接口 + 精确函数签名）
和运行时全局（$/layer/Tabulator/utils/gmHttp/storageManager/clog/show 等）。
GM API 已类型化，应用全局仍为 `any`（后续逐步消除）。

### 3.8 工具链

- **构建**：`bun run build` = `tsc -b && vite build`
- **ESLint**：`bun run lint`（TypeScript recommended + prefer-const/no-useless-escape error 门禁，no-explicit-any warn，基线 0 errors / 0 warnings）
- **Stylelint**：`bun run lint:css`（`.stylelintrc.json`，CSS 一致性检查）
- **结构门禁**：`bun run check:structure`（§10/§11 文件行数与目录扁平度棘轮）
- **文档一致性门禁**：`bun run check:docs`（`docs/plugin-catalog.md` ↔ `src/main.tsx` 注册数、`src/core/` 文件数、catalog 内计数陈述；均不接入 build/lint/test）
- **版本一致性门禁**：`bun run check:version`（`package.json` version 与 `vite.config.ts` `userscript.version` 漂移即 FAIL；均不接入 build/lint/test）

### 3.9 产品设计上下文 `PRODUCT.md`

记录 JavDB Power Tools 的目标用户、产品用途、品牌个性、反例、设计原则与无障碍基线。
涉及界面新增或改版时以此约束视觉语言和交互反馈，保持与 JavDB/Bulma 原站体验一致。

## 4. 设置弹窗架构（SettingPlugin）

**修改设置面板前必须理解**：

`SettingDialog`（`src/components/setting-dialog.tsx`）返回完整设置弹窗 HTML：外层 flex 容器 =
固定 140px 侧栏（`.side-menu-item[data-panel=...]`）+ 内容区（`.content-panel`）。现有侧栏项：

💾 backup-panel（数据备份）· ⚙️ base-panel（基础配置）· 🚫 filter-panel（屏蔽配置）· 🌐 domain-panel（外部网站）· 🧹 cache-panel（清理缓存）· 📋 vlt-panel（清单管理器）· 🎬 missav-panel（MissAV 同步）· ⚡ preload-panel（预加载配置）· 📊 diagnostics-panel（插件诊断）

- **打开**：`SettingPlugin.openSettingDialog(panel, cb)` → `layer.open({ content: jsxToString(<SettingDialog/>) })` → success 回调中 `loadForm()` + `bindClick()`
- **面板切换**：`bindClick()` 绑定 `.side-menu-item` click：切 active、显隐 `.content-panel`；cache-panel 隐藏 saveBtn 显示 clean-all；vlt-panel 与 diagnostics-panel 均隐藏 saveBtn + 隐藏 clean-all；其他面板显示 saveBtn + 隐藏 clean-all
- **新增面板**：① `SettingDialog` 加侧栏项 + 面板内容 ② `bindClick()` 处理特殊按钮显隐 ③ 绑定新面板内按钮事件 ④ **不要**用 MutationObserver 监听弹窗出现再 DOM 注入（绕路）

## 5. 独立脚本集成流程

详见 `.agents/skills/userscript-integration/SKILL.md`。关键步骤：
1. 6 维度调研（站点/GM_API/数据源/事件源/网络/主项目冲突）
2. 冲突排查（grep 关键操作符到 src/）
3. 模块拆分（单文件 or 子目录）
4. 编码（BasePlugin 子类 + initCss + handle）
5. main.tsx 注册
6. 编写 docs/NN-描述.md（规范见 docs/README.md）
7. 验证（tsc -b + vite build）

## 6. 构建配置

### 6.1 vite.config.ts

- `entry: 'src/main.tsx'`；`userscript`：name/namespace/version/match/include/grant/connect/run-at
- `grant`：GM_xmlhttpRequest/GM_openInTab/GM_setValue/GM_getValue/GM_addValueChangeListener/GM_registerMenuCommand/unsafeWindow
- `@require`：7 库 CDN 引入（build.externalGlobals 自动生成，URL 与 archetype 一致）；parallel_GM_xmlhttpRequest URL 失效不引入
- `css.lightningcss.errorRecovery: true`（layer.css IE hack 容错）；`build.minify` 默认 esbuild（terser 可选已回退）

### 6.1.1 版本号自动递增规则（强制）

**每次修改 `src/` 下的源码内容（功能逻辑、CSS、类型、插件等）时，必须同步递增 `vite.config.ts` 中 `userscript.version` 的 patch 位。**

- 格式 `major.minor.patch`：patch = 修 bug/小改动/优化；minor = 新增插件/功能模块/较大变更（patch 归零）；major = 架构级重构/不兼容（minor/patch 归零）
- 纯文档修改（`docs/` 下 `.md`）、纯 `AGENTS.md` 修改、`vite.config.ts` 自身构建配置（不改源码逻辑）均不递增
- `package.json` 的 `version` 须与 `userscript.version` 保持同步（同步属元数据修正、不另行递增；`bun run check:version` 校验漂移）
- **时机**：代码修改完成、`tsc -b && vite build` 验证通过后，在最终回复前递增
- **验证**：构建产物 userscript 头部 `@version` 应与 `vite.config.ts` 一致

### 6.2 tsconfig.app.json

`strict` + `noUnusedLocals/Parameters` + `noFallthroughCasesInSwitch`；`jsx: react-jsx`；
`moduleResolution: bundler`；`target/lib: ES2020`（`Array.prototype.at` 需 ES2022，用 `[length-1]` 替代）；`include: ["src"]`。

### 6.3 测试运行器（Vitest）

- 命令：`bun run test` = `vitest run`。配置 `vitest.config.ts` 与 `vite.config.ts` 分离（不引入 react/monkey 插件），`environment: 'node'`，`include: ['tests/**/*.test.ts']`
- `tests/` 在 `src/` 之外——`tsc -b`/`eslint src/`/`vite build` 均不覆盖，测试代码不影响构建门禁与产物字节
- 被测模块为纯函数（`react.createElement` 构造节点，无需 JSX 转换或 DOM）
- seam：`StorageManager` 构造函数 `constructor(forageInstance?: unknown)` 可注入替身 + `static __resetForTesting()`；参数用 `unknown`（遵守「触及文件时消除新增 any」）
- devDependencies：`vitest` + `jsdom`
- **版本规则交互**：仅改测试（tests/、vitest.config.ts、package.json 的 scripts/deps/version）不递增 `userscript.version`；package.json version 与 userscript.version 同步属元数据修正（`bun run check:version` 校验漂移）
- 当前套件（41 个测试文件 / 413 用例，截至 v1.48.2）：async-task-queue（10 用例）· backup-crypto（doc/137 AES-GCM 往返，8 用例）· batch-selection-and-chip-visibility（勾选集合与评分芯片可见性，8 用例）· batch-ui-render（doc/33 批量 UI 渲染契约，8 用例）· cache-probe（doc/40 内置缓存诊断探针，7 用例，jsdom）· car-list-ops-match（doc/47 番号匹配口径，7 用例，jsdom + 手写 FakeForage）· car-status-consume（跨站同步消费侧，34 用例）· dpb-list-merge（doc/200 清单合并，37 用例）· dpb-list-merge-ui（doc/41 合并行路由回归，9 用例，jsdom + 假时钟）· external-visit-count（doc/45 外站访问统计，8 用例，jsdom）· git-backup-client（doc/217 Git 备份，21 用例）· jhs-sync-review-id（doc/214 reviewId 提取，6 用例）· jquery4-layer-compat（doc/242 jquery4×layer 兼容回归，6 用例，jsdom）· jsx-to-string（doc/151 XSS 转义 + doc/19 aria 序列化，17 用例）· lp-batch-delegation（doc/33 委托白名单回归，10 用例）· lp-batch-state（doc/27 批量计划纯逻辑，9 用例）· lp-batch-sync（doc/31 后台推送队列，8 用例）· lr-execute（doc/216 压实执行，8 用例）· list-mount（doc/48/49 筛选栏挂载点，6 用例，jsdom）· lr-planner（doc/202 压实规划，8 用例）· missav-auto-page（doc/220 瀑布流，14 用例，jsdom）· missav-status-filter（doc/222 状态筛选，21 用例，jsdom）· missav-status-filter-ui（接线契约，1 用例，jsdom）· missav-video-preview（doc/228 预览弹窗，9 用例，jsdom）· op-sync-records（doc/38 操作同步账本，12 用例）· op-sync-table（doc/38 面板表格渲染，5 用例）· osp-preload-order（doc/25 预加载优先级，5 用例）· page-context-home（doc/47 JavDB 首页页面类型，4 用例，jsdom + 站点常量替身）· persistent-data-migration（doc/12 持久数据迁移校验，5 用例）· preload-task-registry（doc/26 请求列表注册表，9 用例）· car-status-publish（doc/47 发布侧载荷唯一构造点，8 用例）· rating-backup-roundtrip（doc/29 评分备份往返，3 用例）· rating-persist（doc/29 评分落库，7 用例）· site-selectors（doc/22 注册表查询 API，11 用例）· stf-score（doc/24 星级索引，13 用例）· stf-score-fallback（doc/28 评分回退源，8 用例）· storage-cache-invalidation（doc/39 分流失效，4 用例）· storage-migration（doc/135/162/163 迁移契约 + 附件路径，7 用例，jsdom + 手写 FakeForage）· util-site-selectors（doc/21 选择器工具，4 用例）· video-identity（doc/46 番号身份领域规则，18 用例）· visit-history-lookup（doc/14 回退匹配，10 用例）

## 7. 文档规范与文档相关要求

**文档规范、文档索引与文档相关要求全部见 [`docs/README.md`](docs/README.md)（文档中心）**：

- 文档索引与说明：阶段文档（01–11）+ 变更文档编号规则（从 12 起连续递增）
- 文档规范：存放位置与命名、文档类型、文档状态、文档元数据、文档治理分类
- 文档相关要求：代码变更必须同步写文档（强制）、编号与定期归并、版本号与文档、执行验证记录

本文件（AGENTS.md）不包含文档内容，只保留上述引用。

## 8. 更新本文档的时机

- 新增/删除/重命名源文件
- 新增/删除插件
- 修改核心架构（main.tsx 启动序列/PluginManager/BasePlugin）
- 新增/移除第三方库
- 修改构建配置（vite.config/tsconfig）
- 每次集成新独立脚本后

## 9. 代码风格与一致性约定（强制）

以下约定由历史文档确立，所有 agent 编辑 `src/` 时必须遵守；违反即视为缺陷。

### 9.1 导入顺序（六组，组间空行）

每个模块顶部 import 按下列顺序分组，组间空一行；副作用导入（`import './x'` 无绑定，
如 `import './core/libs'`）若有则**恒居首位**：

1. 外部类型导入：`import type { ... } from 'react'` 等
2. 常量：`../constants/*`
3. 核心：`../core/*`，**含核心类型导入**（如 `import type { PageType } from '../core/page-context'`）
4. 本地插件：`./base-plugin` 及 `./<同级模块>`
5. 组件：`../components/*`
6. 样式：`*.css?raw` **恒居末位**

重排导入时**只改行序与空行分组，绝不增删/改名/改路径**；tsc 的 `noUnusedLocals`
与未定义名检查是导入完整性的硬安全网。

### 9.2 日志分层：clog vs console（含 devtools 跟踪例外）

`clog.addLog` **从不写 console**，仅推入页内面板；仅 `error()` 额外 `console.error()`——
`clog.log/warn/debug` 仅面板可见（与原始 jhs 日志器一致，**不得**加 console 转发造成
devtools 刷屏）。`clog` **没有 `.info()` 方法**（仅 log/error/warn/debug），禁止写 `clog.info(...)`。
项目自有代码的错误/恢复路径用 `clog.error`。

**例外——集成脚本的 devtools 跟踪保留 `console.*`**：源自独立油猴脚本的模块使用有意的
`${LOG}`/`%c` 模板 `console.log/warn`（如 car-status-logger、rating-utils）。改成 clog 会
**静默丢失 devtools 同步诊断输出**，违反零偏差。结论：集成脚本保留原生 devtools 跟踪，
项目自有代码用面板 clog。

### 9.3 toast 安全：show.error 必须传字符串

`show.error/ok/success/info` 期望字符串。禁止直传 Error 对象或 `e.message || e`
（非 Error 拒绝值渲染为 `[object Object]`）。统一写法：
`show.error('描述: ' + (e instanceof Error ? e.message : String(e)))`。

### 9.4 z-index 层级（设计令牌）

layer.js 的 z-index **无上限递增**（每次开弹窗 +1、mousedown +1）。`design-tokens.css`
定义两级，**禁止**再出现散落的 `9999`/`99999999`/`9999999999` 字面量：

- `--jhs-z-page: 9999`：页面内元素（back-to-top / load-all / 瀑布流按钮 / tag 下拉）
- `--jhs-z-top: 999999999`：above-layer 层（tooltip / loading / logger / fc2 / visit-history）

### 9.5 CSS 类名前缀

插件专属类必须加 `jhs-` 或插件专属前缀（如 video-lists-tag 用 `jhs-vlt-`），避免与
站点/框架/其他插件冲突。同一通用名（如 `.menu-btn`）**不得**在多个注入同一 head 的
样式表中以冲突声明重复定义——按上下文拆为不同前缀名（`.jhs-toolbar-menu-btn` /
`.jhs-setting-menu-btn`）。

### 9.6 审计方法论

对全树做一致性审计时**禁止静默截断**（如「每维最多 20 条」会掩盖真实表面）；必须
无上限扫描，完整发现持久化到 `local://` 后再按发现数装箱为互不相交的并行编辑组。
审计→执行链路引入的 `console.log/warn`→`clog.log/warn` 转换，须先用 §9.2 的跟踪例外
复核，必要时窄范围回退。

### 9.7 零硬编码 HTML 边界（强制）

`src/` 内禁止以字符串字面量编写 **UI 模板**（按钮/弹窗/卡片/表格/列表项等多元素结构）；
必须为 `src/components/*.tsx` React 组件，经 `jsxToString` 渲染为 HTML 字符串
（`.ts` 调用方用 `*Html()` 便捷辅助，如 `logColoredHtml`）。判定与豁免：

- **违规**：字符串被解析进 DOM——`innerHTML =`、jQuery `.html()/.append()/.prepend()/.after()/.before()`、`$( '<...>' )` 拼接——且非 sanctioned 常量
- **豁免（needle）**：对 DOM 派生文本做 `.indexOf/.includes/.startsWith/.match/.test` 的字面量（不生成元素）
- **不在范围**：jQuery `$( '<tag>' )` 元素构造（createElement 等价）；sanctioned 数据常量（经 `dangerouslySetInnerHTML` 注入的 SVG/CSS 命名常量）

审计按四类（违规 / needle 豁免 / jQuery 构造 idiom / sanctioned 常量）逐条 triage，
**禁止**把 jQuery 元素构造 idiom 计为违规而空转改写。

## 10. 大文件拆分与代码复用规则（强制）

以下规则对所有 agent 编辑 `src/` 时强制生效；违反即视为缺陷。

### 10.1 单文件行数上限

- **硬上限**：单个 `.ts`/`.tsx` 文件不得超过 **800 行**（含注释与空行）。
- **软上限**：超过 **500 行**的文件必须在下一次触及该文件时评估拆分可行性，并在 doc 中记录结论（拆分 or 不拆 + 理由）。
- 新增代码时，若添加后文件将超过 500 行，**必须先拆分再添加**，不得先添加后补拆。

### 10.2 拆分原则

- **单一职责**：一个文件承担 2 个以上不相关职责（如「数据获取 + UI 渲染 + 事件绑定 + 状态管理」）必须拆分。
- **按职责边界切分**：优先按「数据层 / 逻辑层 / 视图层 / 事件层」切分，而非按行数机械切割。
- **提取共享逻辑**：>10 行重复必须提取为 `src/core/` 或同目录共享模块，禁止 copy-paste 式重复。
- **组件原子化**：组件只做一件事；含多个独立 UI 区块（如 9 个面板）必须拆为子组件。

### 10.3 代码复用规则

- **禁止重复实现**：新建前 grep 全 `src/` 确认无功能相同/高度相似的函数/组件；发现相似功能合并为唯一实现，删除冗余方。
- **共享常量/类型**：跨文件使用的常量、接口、类型必须放 `src/constants/` 或 `src/types/`，不得多处重复定义。

### 10.4 拆分验证门禁

每次拆分操作必须满足：
1. `tsc -b && vite build` 通过
2. `bun run test` 全绿
3. 拆分前后 `jsxToString` 输出 DOM 等价（若涉及 UI）
4. 无循环导入
5. 导入顺序符合 §9.1
6. `bun run check:structure` 通过——大文件行数/目录扁平度机械门禁（scripts/check-structure.ts，FILE_CEILINGS/DIR_CEILINGS 棘轮，不得抬高 ceiling）

## 11. 目录规划规则（强制）

### 11.1 扁平度上限

- 单个目录下的**直接子文件**（不含子目录）不得超过 **20 个**；超限必须按功能域/职责创建子目录归类。
- `src/components/` 已超限——新增组件必须按插件域归入子目录（如 `components/setting-panels/`、`components/fc2/`），不得继续平铺。
- 机械执行：`bun run check:structure` 对每目录直接子文件数做门禁（DIR_CEILINGS 棘轮），超 20 的新增直接失败。

### 11.2 子目录划分原则

- **按插件域**：插件若 ≥3 个专属组件，建 `components/<plugin-name>/` 子目录。
- **按功能层**：`core/` 下某类模块超过 5 个（如网络请求相关）应归入子目录。
- **按页面类型**：仅服务特定页面的组件可归入 `components/list-page/`、`components/detail-page/` 等。
- **子目录命名**：kebab-case，语义化，与插件 `getName()` 或功能域对应。

### 11.3 目录变更同步

- 新增/删除/移动子目录时，必须同步更新 AGENTS.md §2 目录结构总览。
- 移动文件后必须确认所有导入路径已更新（优先使用 `lsp rename_file`）。

<!-- aoci:begin -->
## AOCI 仓库认知

AOCI 为本仓库维护一个稳定、可版本化、可增量更新的仓库级认知层，供模型跨任务复用对系统的理解。

`aoci.txt` 是面向模型的结构化认知索引。它以每个受管理文件、数据库表或其他受管理对象一条独立 Entry 的方式，用符号标签与 F/R/A/S 语义表达对象的核心职责、重要关系、对外契约，以及理解或修改系统时必须知道的非显然约束和设计决策。

Header、目录段和全部 Entry 共同组成完整仓库索引，可以覆盖前端、后端、配置、数据库结构及其他受管理内容。受管理内容发生变化时，通常只需维护受影响的认知条目，不需要重新生成整个索引。

AOCI 提供系统架构、对象职责、重要关系、对外契约和关键约束的高密度视图。

### 工作原理

AOCI 采用“模型生成、模型读取”的认知闭环。

Header、Entry 和 Curation 语义的创作只按当前机器签发的 Plan 与实时 Guide 执行；由 Host 模型基于当前绑定证据独立完成。

Entry 的语义必须来自模型对真实证据的理解。不得仅依据路径、文件名、扩展名、AST、符号列表、依赖扫描、正则、固定模板或规则引擎推导、预填、拼接或改写索引语义。

对 Fresh Bootstrap，只按当前机器签发的 Plan 和实时 Guide 执行。当它们要求创作时，Host 模型创作 Root、Meta、Tag 和 F/R/A/S，提供 authoring-run 声明，并把它绑定到 Plan、Evidence 与完整 Candidate。不得要求 AOCI 填写 `origin=host_model`、制造 Receipt 或把程序生成的 Framework 当作语义。本文件不自行重建 Onboarding 流程。内部批次不是用户决策；只有遇到既有批准边界或真实的安全、漂移、CAS、Recovery 条件才停止。

### 最小使用入口

- `aoci_rules`：取得当前AOCI版本的会话运行合同。
- `aoci_overview`：建立或恢复本仓库的完整认知。
- `aoci_maintain`：受管理对象达到最终稳定状态后检查认知是否需要维护。
- `aoci_update_entry`：提交与当前证据和源码摘要绑定的完整语义更新批次。
- `aoci_report`：仅当当前布局和工具状态支持时，在证据不足、无法可靠生成语义时登记待办，不猜写。

其他MCP工具、CLI命令、参数和专项流程，以当前工具说明、Guide和 `--help` 返回内容为准，不在本文件中重复完整手册。

本区块只规定仓库接入、认知使用和收尾原则。`aoci_rules` 承载当前会话合同，Guide实时输出承载当前Plan的执行顺序与停点，工具Schema、Spec和Validator承载机器结构与判据；Prompt、Description、README和静态文档不能覆盖这些机器事实。

### 建立、生成和恢复认知

1. 每个新的 Agent Run 开始时，应先判断：

   - 本仓库是否已经存在可用的完整AOCI索引；
   - 当前上下文中是否已有与本仓库根、当前索引版本和当前AOCI服务相匹配，并且模型仍可可靠使用的完整仓库认知。

2. 仓库已经存在可用的完整索引，但当前Run没有可靠完整认知时，先调用 `aoci_rules`，再调用 `aoci_overview`。

   完整认知仍可靠时直接复用。局部不确定本身不要求机械重读系统全貌。

   本Run从已知Host上下文压缩恢复时（包括宿主注入的压缩摘要），必须把此前模型认知视为不可靠。压缩handoff不得保留或摘要正式Whole-Index，也不得保留或摘要任何Overview Header、Entry、Chunk、Challenge或Attestation正文；只能保留安全续接所需的receipt身份、未完成write或Recovery状态，以及立即重载指令。复制进handoff的Whole-Index语义或receipt不能证明恢复后模型的当前认知可靠。若当前上下文已无法可靠保留运行合同，先调用 `aoci_rules`。继续业务任务前，使用 `refresh_reasons=["context_compaction"]` 和新的 `refresh_event_id` 调用普通完整Whole-Index `aoci_overview`（不设置 `check_only` 或设为false）；不得使用 `check_only` 或认知probe。原样跟随每个 `next_cursor` 直到 `completed=true`，确认交付，并且只基于新交付正文提交一次Attestation。完成这次新的完整传输后，即使Attestation为partial或fail也消费该generation，并按既有合同继续source-bound任务，不再自动调用第二次Overview。

   AOCI可以针对 `context_compaction`、项目 `cognition_refresh_threshold` 下的机器 `semantic_threshold` 或主要 `phase_transition` 提供checkpoint与认知状态事实。只需要这些紧凑事实时使用 `check_only=true`；这些事实只向Agent提供建议，不替模型决定是否需要系统全貌。

   Agent显式调用普通 `aoci_overview`（未设置 `check_only` 或为false）时，只要能形成一致的CognitionSet，AOCI必须完整交付请求scope。不得因为已有receipt、阈值未达到或没有待处理刷新原因而抑制正文。正式认知Dirty或Stale时仍交付正文，但必须标记不可靠。存在未决恢复或无法形成一致snapshot时失败关闭，不返回混合正文。

   普通Overview返回 `continuation_required=true` 时，必须原样提交 `next_cursor` 并自动继续到 `completed=true`。不得询问用户、开始业务任务或给出阶段性系统结论。Host截断、缺块、重复、乱序、cursor失败、Index变化或`chunk_tokens`变化时停止本次认知链。Attestation完成前不得用Memory、源码、Spec、`aoci.txt`、历史会话、scope、search或Entry读取修补或补充Whole-Index认知。Challenge ordinal是正式Entry序列中的1-based位置；Header内容、注释、空行、Section/Overview/Chunk Marker、Receipt与Metadata均不计数，Chunk Receipt ordinal使用同一序列。Attestation必须原样回绑本次Challenge发布的当前`index_sha256`、`entry_sequence_sha256`与`entry_count`；旧Index、旧Entry序列、旧数量或旧Attestation均无效。完整链结束后只正式提交一次既有模型认知Attestation；同一响应只允许一次不改变语义答案的JSON Schema或字段格式修正。对象、Tag或F不匹配即失败且认知吸收不确定，不得语义重试或旁路补答。首次认知失败时还不得执行Root/Meta、Migration、全局布局或其他未重新绑定的系统级决策。上下文压缩刷新若传输完整、认知身份不变、治理对齐且没有Recovery或第三方冲突，即使Attestation为partial或fail也消耗该refresh generation，并继续原任务，不再自动重读Overview。`system_mastery_percent`只自评系统框架——架构、职责、强关系、稳定外部契约以及高熵安全和维护约束——不表示完整实现或运行实况知识；机器索引覆盖率必须分开。默认只向用户输出由本次真实覆盖率、Challenge、块数、Token和掌握度生成的规定成功或失败一句话。Host截断时提示用户把 `overview_delivery.chunk_tokens` 设置为更小的合法值后重新开始，不得自动修改。

   加法认知等级必须与严格证明字段分开解释。`delivery_verified`表示已加载Index且Host交付已确认，但完整认知验证仍未完成；应表达为“已加载且交付已验证”，不得描述为“没有认知”或“没有理解系统”。`cognition_verified`要求Attestation通过（Challenge至少80%的ordinal完全正确且对象身份至多失手一处），`cognition_governed`还要求治理对齐。通用完整读取失败句只用于真实交付故障。

   当Overview响应包含可选`cognition-state/v2`投影时，必须分别解释各维度。其Level止于`model_cognition_usable`；`strict_attestation_verified`、`governance_aligned`与`current_system_cognition_reliable`都是独立状态，绝不参与该Level。ordinal、对象身份、Tag或核心F不匹配可以导致严格Attestation失败，而模型认知仍然可用；不得仅凭这种不匹配就宣称模型没有理解系统。只有`current_system_cognition_reliable=true`允许无保留地声称当前完整系统认知可靠。投影缺失时继续使用上述Legacy解释。

   普通的只读审计、分析、检查、不修改代码或不提交、不push，不自动等于严格零写入，也不改变上述认知有效性判断。Codex Memory和历史Skill只能辅助恢复经验、用户偏好与调查方向，不能替代与当前仓库根、索引摘要、AOCI服务身份和认知范围匹配的当前认知收据；项目AGENTS和当前AOCI身份在AOCI状态上优先于历史Memory。

   只有用户明确禁止Ledger、元数据、`.aoci`运行资产及任何文件写入时，才按严格零写入处理。若必要的认知建立与该边界冲突，必须报告冲突并请求用户裁决或建议使用隔离副本，不得静默以Memory替代当前仓库认知。

3. 仓库没有可用的完整索引，或当前只有最小骨架、Header不完整、Entries未完成、必要Curation尚未裁决时，如果需要建立正式完整AOCI索引，先取得 `aoci_rules`，然后进入当前AOCI Guide。由Guide依据仓库真实状态决定下一阶段并完成必要安全步骤。

   `aoci_maintain` 不替代索引建立流程。

   不在本文件中自行重建或硬编码完整索引生成状态机。

4. 在长程任务中，模型负责保留当前认知收据并正确使用刷新门禁：

   - Host报告上下文压缩或模型已知系统全貌丢失时，执行上述强制 `context_compaction` 重载规则；AOCI不能自行推断Host事件；
   - 进入真正的主要阶段时声明 `phase_transition`，不得把函数、测试运行或小步骤当作阶段；
   - 在有用的稳定检查点通过 `check_only=true` 取得机器语义计数；
   - 除已知压缩的强制重载外，由Agent判断当前任务是否需要再次显式获取指定scope或完整Overview；
   - 在维护和对齐完成前，保留AOCI报告的Dirty或Stale可靠性状态。

### 任务收尾与认知维护

5. 纯只读问答、分析、版本核验，或没有产生受AOCI管理对象变化的任务，不需要调用维护工具。当前AOCI版本是任意`aoci_overview` check_only或`aoci_maintain`响应里的`cognition_receipt.mcp_service_version`；二进制路径是项目`.mcp.json`里的`command`，CLI不必在PATH上。

6. 发生受AOCI管理对象变化时，待其达到本次任务的最终稳定状态后，只调用一次 `aoci_maintain`。不要在每次中间修改后逐文件维护。

7. 若维护结果返回真实语义候选，Host 模型必须基于每个候选绑定的对象和必要证据，独立创作完整标签与F/R/A/S更新。通过 `aoci_update_entry` 一次提交当前机器签发批次的完整候选集合，同时原样保留每项 `source_sha256`、`candidate_id` 与对应domain批次身份。`max_entries`只限制单次请求和原子事务，不限制logical plan、Whole-Index或Managed Scope。`remaining`非零时，在当前批次成功Apply后重新调用Maintain并从新preimage继续；绝不能为满足transport上限缩减Index覆盖或自行截取返回批次。

   没有足够证据且当前布局支持 `aoci_report` 时，使用它而不猜测、套用模板或为消除待办而生成缺乏证据的认知。

8. 必须遵守工具返回的结构化状态和安全边界：

   - `repair_required`：只修复明确命中的候选，再重新提交当前机器签发的完整批次；
   - `stopped`：结束当前写入尝试并检查 `failed_step`、错误、正式写入证据与Recovery。auto模式下，已证明零写入则记录closure并重新Plan；完整Intent和可证明postimage则Resume；策略要求Rollback且preimage可证明则精确恢复后重新Plan。只有证据不足、第三方正式字节冲突、需要审批或外部动作，或命中其他真实安全边界时，才停止整个用户任务；
   - 冲突、审批、人工裁决、权限和安全信号不得忽略；
   - 已经对齐后不得重复维护或重复写入；`refresh_ready_for_overview` 是checkpoint事实，由Agent决定是否为下一阶段请求普通完整Overview。

   维护完成后如果又修改了任何受管理对象，之前的维护结果失效，应在新的最终稳定状态重新完成收尾。

9. 用户只限制业务文件范围，但没有明确禁止仓库托管资产时，AOCI托管资产可以在收尾阶段为保持认知一致而更新，并应在审计和提交中与业务文件区分。

   用户明确禁止修改 `aoci.txt`、`.aoci`、元数据或任何额外文件时，以用户限制为准，不得写入，并如实报告剩余不一致。

### 专项流程

初始化、完整索引生成、Header生成、Entries生成、数据库结构索引、Curation、人工评审和故障恢复，只按当前AOCI Guide或工具在对应阶段返回的指令、命令和安全停点执行。

不预加载、不猜测，也不自行重建这些专项流程。平台调用方式、请求格式、批次上限、审批规则、索引格式细节和恢复步骤由对应Guide、工具说明、模型Prompt和CLI帮助按需提供。
<!-- aoci:end -->
