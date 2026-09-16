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
│   ├── core/               # 核心模块（含 feature-flags、util/、sync/ 子目录）
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

共 **61 个文件**：顶层 28 + `storage/`（存储域拆分）+ `sync/`（跨站同步共享设施）+ `util/`（核心工具集）三个子目录 33。
**完整清单（含职责）见 [`docs/plugin-catalog.md`](docs/plugin-catalog.md)**，增删模块时同步更新该文件；`bun run check:docs` 会校验本文件的插件/模块计数与 catalog 是否一致。

### 3.5 组件 `src/components/`（139 个）

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
- **版本规则交互**：仅改测试（tests/、vitest.config.ts、package.json 的 scripts/deps/version）不递增 `userscript.version`；package.json version 与 userscript.version 同步属元数据修正
- 当前套件（13 个测试文件）：jsx-to-string（doc/151 XSS 转义，9 用例）· backup-crypto（doc/137 AES-GCM 往返，8 用例）· storage-migration（doc/135/162/163 迁移契约 + 附件路径，7 用例，jsdom + 手写 FakeForage）· car-status-consume（跨站同步消费侧，34 用例）· dpb-list-merge（doc/200 清单合并，33 用例）· lr-planner（doc/202 压实规划，8 用例）· lr-execute（doc/216 压实执行，8 用例）· git-backup-client（doc/217 Git 备份，21 用例）· missav-auto-page（doc/220 瀑布流，14 用例，jsdom）· missav-status-filter（doc/222 状态筛选，21 用例，jsdom）· missav-status-filter-ui（接线契约，1 用例，jsdom）· missav-video-preview（doc/228 预览弹窗，9 用例，jsdom）· jquery4-layer-compat（doc/242 jquery4×layer 兼容回归，6 用例，jsdom）

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

`image-preview.css` 的 `/* __Z_INDEX__ */` 为运行时占位符，**不得**替换为 `var()`。

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