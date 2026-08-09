# docs/08 — 一致性治理与原子化（doc/149–179 融合）

> **文档类型**：📋 阶段档案（合并文档）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/149–179 共 31 份历史文档（类型化收尾 → 代码一致性治理 → 测试基建 → 回归修复 → HTML→TSX 提取 → 大文件拆分 → 原子化/复用 Wave）
> **合并说明**：按时间线精简融合为单文件；删除构建命令输出回放、逐条验证步骤、重复的产物大小记录；保留背景/根因、方案与决策、实施要点、结果、演进链与遗留问题。篇幅约原文总长 1/2。文中 "doc/NN" 为历史事件标识，指向原文档编号。
> **替代文档**：doc/149、150、151、152、153、154、155、156、157、158、159、160、161、162、163、164、165、166、167、168、169、170、171、172、173、174、175、176、177、178、179（合并完成后原文件删除）
> **生效版本**：v1.28.19（阶段末）

## 阶段概览

本阶段把「类型化收尾（149–150）→ 安全与 UI 一致性（151–153）→ 代码一致性治理轮次（154–160）→ 回归测试基建（161–164）→ 回归修复与结构规划（165–166）→ HTML→TSX 提取与零硬编码 HTML（167–170）→ WebDAV 修复（171）→ 大文件拆分与组件重组（172–173）→ 原子化/复用 Wave（174–179）」九段主线收束为可验证的工程状态：审计维度闭合至十四维、回归测试 28 用例全绿、src/ 全树零内联 HTML、超限文件全部拆分、原子化→复用循环达到不动点。期间确立的代码风格约定（导入六组、clog/console 分层、show.error 字符串、z-index 令牌、CSS 类名前缀、审计方法论、零硬编码 HTML 边界、大文件拆分与目录扁平度规则）最终固化进 AGENTS.md §9/§10/§11，成为后续所有编辑的强制规范。

## 1. 类型化收尾（doc/149–150）

### 背景/根因

`BasePlugin.pluginManager` 字段声明为 `any`，40 个插件经 `this.pluginManager` 访问 PluginManager 时无类型检查。`globals.d.ts` 中 6 个应用运行时全局（`show`/`utils`/`storageManager`/`clog`/`gmHttp`/`pluginManager`）同样为 `any`，数百处类型不匹配被掩盖。二者均为 ESLint `no-explicit-any` 警告来源。

### 方案与决策

- **doc/149**：`pluginManager: any = null` → `pluginManager!: PluginManager`（`import type`）。使用 definite assignment assertion（`!`），因该字段在 `PluginManager.register()` 中注入、不在构造函数初始化。
- **doc/150**：6 个全局经 ambient `.d.ts` 内联 `import()` 类型语法指向具体实现类型（`typeof import('../core/toast').show` 等），走 ts-import-type 规则的 ambient 例外条款。

### 实施要点

- doc/149 仅改 `src/plugins/base-plugin.ts` 一个文件。
- doc/150 类型化暴露 **69 处隐藏类型错误（12 个文件）**，修复模式：`carNum!` 非空断言 + `?? undefined`（detail-page-button-plugin 35 处）、`Number()` 转换（auto-page/list-page/history 等）、`null`→`undefined`、`as` 类型断言、`show.success`→`show.ok`、删除未使用变量；`RequestHeaders` 接口补 `[key: string]: string` 索引签名兼容 `Record<string, string>`。

### 结果

tsc 零错误。ESLint 警告 806→805（doc/149）→ 805（doc/150，全部为 `no-explicit-any`，来自 jQuery/layer/DOM 回调）。

### 演进链与遗留

805 个 `no-explicit-any` 警告主体需第三方库类型声明才能消除——doc/165 核实 `package.json` devDependencies 确无 `@types/jquery`/`@types/tabulator-tables`/`@types/layui-layer`（即 786 警告主体来源），big-bang 消除属多会话 backlog；doc/164 按「触及即消除」增量推进。

## 2. 安全加固与 UI 一致性（doc/151–153）

### 背景/根因

- **doc/151**（批次 1 安全项）：`jsxToString` 的 `escapeText()` 已转义文本节点 `&<>`，但 `renderAttrs()` 未转义属性值 `"`——攻击者可经 `"` 闭合属性注入新属性（如 `onmouseover="alert(1)"`）；`href`/`src` 无协议校验，`javascript:alert(1)` 可直接通过。
- **doc/152**（批次 5）：存在两套返回顶部按钮——`#jhs-back-to-top`（SettingPlugin，所有 javdb 页面）与 `#jdb-wf-back-to-top`（ListWaterfallPlugin，/users/lists 页面），后者始终重复。
- **doc/153**（批次 5）：9 个 CSS 文件使用 5 种量级 z-index（9999~9999999999）无统一管理；layer.js 的 z-index 无上限递增（每次开弹窗 +1、mousedown +1），above-layer 元素需 genuinely large 常量。

### 方案与决策

- **doc/151**：新增 `escapeAttr()`（转义 `&<>"` 四字符）应用于 `renderAttrs` 全部属性值输出（class/style/其他）；新增 `sanitizeUrl()`（`trim().toLowerCase()` 后对 `javascript:`/`data:`/`vbscript:` 前缀返回 `'#'`），仅应用于 `href`/`src`，允许 http/https/mailto/tel/相对路径。
- **doc/152**：`ListWaterfallPlugin.createBackToTopBtn()` 开头加 `if (document.getElementById('jhs-back-to-top')) return;`，已存在时跳过创建。
- **doc/153**：设计令牌新增两级 z-index：`--jhs-z-page: 9999`（页面内元素：back-to-top/load-all/瀑布流按钮/tag 下拉）、`--jhs-z-top: 999999999`（above-layer：tooltip/loading/logger/fc2/visit-history）；9 个 CSS 文件原值映射替换。**不修改** `image-preview.css`（`/* __Z_INDEX__ */` 为运行时占位符）。

### 结果

tsc 零错误。产物 +0.49 kB（doc/151）/ +0.05 kB（doc/152）/ −0.10 kB（doc/153）。doc/152 同时把 `package.json` version 1.27.5→1.27.8 与 vite.config.ts 同步。

### 演进链与遗留

doc/152 建立的「#jhs-back-to-top 存在即跳过」守卫是后续 doc/178 C1/C2 的伏笔：C1 合并两按钮的 CSS 孪生规则，C2 判定两套逻辑为**设计意图**（滚动动画不同，见 §10）。sanitizeUrl 协议白名单经受 doc/167 提取与 doc/151 测试套件持续保护。

## 3. 代码一致性治理轮次（doc/154–155）

### 背景/根因

用户要求「深入研究保证代码结构、代码风格、代码形式上的一致性，架构统一性，方案完整性，结构正确性」。doc/154 四维并行审计（console 一致性 / 错误处理 / 导入风格 / CSS 命名）定位 10 高 / 14 中 / 8 低共 32 项不一致；doc/155 把同一套约定推广到剩余 39 个插件文件，并修正一个由审计-执行链路引入的零偏差回归。

### 方案与决策

**错误处理统一化**：结构化日志走全局 `clog`、用户可见错误走全局 `show`；catch 块 `console.error`（带 `[JHS-*]` 前缀）→ `clog.error`；`show.error(err)` → `show.error('描述: ' + (err instanceof Error ? err.message : String(err)))`。

**导入顺序六组约定**（此后成为 §9.1）：① 外部类型 → ② 常量 → ③ 核心 → ④ 本地插件 → ⑤ 组件 → ⑥ CSS?raw 最后，组间空行。`import './core/libs'` 副作用导入恒居第 1 行（建立 $/layer/Tabulator 全局）；CSS?raw 为惰性字符串绑定、无求值期副作用，移至末尾安全。tsc `noUnusedLocals` + 未定义名检查为导入完整性硬安全网。

**CSS 类名去冲突**：`.menu-btn` 在 common-toolbar.css 与 setting-plugin.css 重名且声明冲突（同注入 head 互相竞争）→ 拆为 `.jhs-toolbar-menu-btn`（页面工具栏）/ `.jhs-setting-menu-btn`（设置弹窗），13 文件 68 处调用点按上下文同步；video-lists-tag.css 前半段 23 个无缀通用类名 + 1 个 `@keyframes` → 统一 `jhs-vlt-` 前缀，跨 4 文件调用点同步。

**审计方法论（doc/155 确立）**：四维并行审计首轮每维 20 条上限**静默截断**了 console 与 imports 维度（命中 20/20 即停），违反「无静默截断」原则；改为**无上限**重审得真实表面 **159 处**（console 125 / show.error 4 / imports 30，跨 39 文件）；发现完整持久化到 `local://r4-dispatch.md`，按发现数贪心装箱为 4 个互不相交编辑组（负载 40/40/40/39）；对抗 advisory 发现零偏差回归后窄范围回退而非全量重做。

### 关键决策：devtools 跟踪日志零偏差保留（doc/155）

`logger.tsx` 的 `addLog` **从不写 console**、仅推入页内面板；只有 `error()` 额外 `console.error(...)`——`clog.log/warn/debug` 仅面板可见，此设计与原 `jhs.user.js` 日志器（error-only 转发）一致。集成自独立脚本的模块（doc/45/126 等）使用**有意的 devtools 跟踪体系**：`${LOG_PREFIX}`/`${LOG}`/`[视频清单标签]` 模板字面量 `console.log/warn` 与 `%c` 着色工厂（car-status-logger、rating-utils）。第四轮把它们机械改成 `clog.log/warn` 后跟踪**静默从 devtools 消失**——功能行为变更，且 `tsc`/`vite build` 无法捕获。决策：

- **回退**：上述跟踪体系 `clog.log/warn` → `console.log/warn`（vlt-sync/vlt-tags/vlt-reconcile/list-reading-status/page-sort/status-tag-filter/list-waterfall/modal-list-disabler/other-site 预加载/missav-quick-copy）。
- **保留**：`console.error`→`clog.error`（clog.error 转发 console.error，devtools 仍可见，零偏差成立）；导入重排；`show.error` 守卫。
- **恢复**：`%c` 着色工厂按 archetype 原样还原（car-status-logger 配色取自 `archetype/missavStatusTag.user.js` L101-130；rating-utils 恢复 `%c[JHS-Rating][action]` + `background:#ffc107`）；missav-quick-copy 被误删的 4 条 `${LOG}` 跟踪逐字还原，其 catch 回退为原 `console.log`。
- **未触碰**：`logger.tsx`。曾考虑给 `log()/warn()` 加 console 转发「一次性」修复，被否决：违背 error-only 有意设计、60+ 处既有 `clog.log/warn` 会刷屏 devtools 制造原始从未产生的噪声、为回退 ~70 处机械替换而改最负载日志模块属本末倒置。
- **分层结论**：集成脚本保留原生 devtools 跟踪（`console.*` + `%c`），项目自有代码用面板 `clog`——**有意分层，非不一致**；未来 agent 不得为「表面一致」把跟踪体系改回 `clog.log/warn`。

### 结果

tsc 零错误。产物 2,024.89 kB（doc/154）→ 2,024.66 kB（doc/155）。doc/155 逐文件确认回退落地、8 个跟踪文件残留 `clog.log/warn` = 0、other-site 残留 `clog.warn` = 3（既有检测项，正确保留）。

## 4. 约定固化与审计闭合（doc/156–160）

### 背景/根因

doc/153–155 确立的风格约定只存在于各轮 doc 中，未写入 AGENTS.md 强制条款，后续 agent 无法自动遵守（doc/156）；全树审计还缺 `src/core/` 目录类与三个结构正确性、代码卫生、运行时正确性维度（doc/157–160）。

### 各轮增量结论

| 轮次 | 文档 | 增量结论 |
|------|------|----------|
| R5 | doc/156 | **约定固化为 AGENTS.md §9**（6 条：§9.1 导入顺序 / §9.2 日志分层 / §9.3 toast 安全 / §9.4 z-index 令牌 / §9.5 CSS 前缀 / §9.6 审计方法论）；`src/components/` 三维补审（console.* / show.error 直传 Error / 导入顺序）**全清洁**（scout 审计 34 个 .tsx），无 src/ 编辑，不递增版本号 |
| R6 | doc/157 | `src/core/` 闭合审计：console.*（非 excepted 文件）= 0；CSS?raw 导入违规 2 文件（image-preview.tsx / tooltip.ts 置首位）→ 移至末位；其余 26 文件合规；constants/、types/ 全清洁。**全树六维一致性审计闭合** |
| R7 | doc/158 | 结构正确性三维：空 `catch {}` = **17**（全部有意：三通道广播 best-effort 内层 catch / vlt-db 事务 abort 清理，外层均有 `clog.error`）；`@ts-ignore` = 0；`@ts-expect-error` = 0；块级 `eslint-disable` = 0；`eslint-disable-next-line` = **7**（logger.tsx 5 + hit-show-movie-item 1 + preview-video-quality-btn 1，全部 `no-explicit-any`，805 个警告中唯一被显式抑制者，属 backlog 不触碰）。**九维审计闭合**。纯文档轮次 |
| R8 | doc/159 | 代码卫生三维：TODO/FIXME/HACK/XXX = **0**；snake_case 方法 6 个（`merge_table_name`/`clean_no_url_blacklist`/`async_merge_other`/`merge_blacklist`/`merge_favoriteActress`/`merge_tow_car_list_table`——schema 版本化（doc/135）后为死代码但保留向后兼容，重命名会破坏 `runMigrationStep()` 映射）；snake_case 变量 3 个（`update_date`/`release_date`/`cover_src`——API schema 字段名，与数据源格式一致原则）；注释代码块 = 0。**修正 doc/158**：空 catch 计数 0→17（有意 best-effort）。**十二维审计闭合**。纯文档轮次 |
| R9 | doc/160 | 运行时正确性二维：生命周期清理 **0 泄漏**（`addEventListener` DOM 元素监听器随元素 GC、document/window 监听器为页面生命周期级有意保留；`setInterval` 全由 TaskSupervisor 管理；`setTimeout` 全为一次性 UI 延迟；`MutationObserver` 全由 `TaskSupervisor.observe()` 管理随插件销毁 disconnect）——「关闭功能后零永久轮询」条件满足；`getBean` 引用：40 个注册插件全部解析，**唯一例外 `Beyond60Plugin` 从未注册**（原始 jhs.user.js 忠实保留的死路径，注释明确标注，可选链 `?.` 保护）。**十四维审计闭合**。纯文档轮次 |

### 演进链与遗留

审计维度从 R3+R4 的六维（console→clog / show.error / 导入 / CSS 类名 / z-index / devtools 跟踪）逐轮扩至十四维；doc/159 修正 doc/158 的 catch 计数属「不可变文档追加修正」先例。审计轴此后收敛——doc/161 据此停止审计、转向被推迟的测试基建。

## 5. 回归测试基建（doc/161–164）

### 背景/根因

审计轴已收敛于十四维，继续审计只产出「全清洁」；而基线要求「最近完成的转为回归测试保护」、验证矩阵要求「每个发布必须通过测试」、批次 6 列「增加 Vitest、jsdom」——树中尚未落地（无 test 脚本、无 vitest 依赖）。doc/161 停止审计，把已交付修复（doc/151 XSS、doc/137 加密信封）纳入回归保护。

### 方案与决策

**运行器与隔离（doc/161）**：新增 devDependencies `vitest` + `jsdom`；`vitest.config.ts` 与 `vite.config.ts` **分离**（不引入 react/monkey 插件，`environment: 'node'`，`include: ['tests/**/*.test.ts']`）；测试目录 `tests/` 在 `src/` 之外 → `tsc -b`/`eslint src/`/`vite build` 均不覆盖，**新增/修改测试不改变用户脚本产物字节**。首两套件（无 JSX、无 DOM，用 `react.createElement` 构造节点）：`jsx-to-string.test.ts`（文本/属性转义、href/src 协议白名单含前导空白与大小写、on* 事件剥离、函数组件递归、Fragment 透明输出）与 `backup-crypto.test.ts`（AES-GCM 往返恒等、独立 salt/IV、信封结构 v=2/alg/kdf/iter=100000/salt 16B/iv 12B/ts ISO、错口令/篡改抛错、isBackupV2）。**刻意推迟**：schema 迁移幂等性需先引入可注入存储 seam，属独立工作，列为下一测试目标（right-sizing 非 scope shrink）。

**迁移 seam（doc/162）**：`StorageManager.forage` 从构造期硬绑定 `private readonly` 改为**仅声明 + 构造函数 `??` 回退**（`forageInstance ?? localforage.createInstance({...})`）；构造函数签名 `constructor(forageInstance?: unknown)`（用 `unknown` 而非 `any`）；新增 `static __resetForTesting()` 重置单例。附件四缺陷复核结论：**四项均已被 doc/135 修复**（迁移后缓存陈旧→`runMigrations` 循环后无条件清空 4 缓存；冻结对象 TypeError→迁移方法 `this.forage.getItem` 直读绕过 deepFreeze getter；无错误隔离→逐步 try/catch + break + 仅成功写版本号 + `navigator.locks`；首记录当版本号→`SCHEMA_VERSION_KEY` + `?? 0` + 版本门控，`clean_no_url_blacklist` 为全量 `.filter/.map` 扫描无 `[0]` 启发式），故**不改动方法体**（「修复」已工作的代码只会引入回归风险）。另修正 §9.2 违规：`merge_table_name` 6 处 `console.log('更正', oldKey)` → `clog.debug`（storage-manager 属核心基础设施，不适用跟踪例外）。

**迁移套件（doc/162，5 用例）**：`constants/site.ts` 模块加载期读 `window.location.href` → 该套件文件级 `// @vitest-environment jsdom`；手写 `FakeForage`（Map 后端，不引入 fake-indexeddb）；`beforeEach` 注入 `globalThis.clog`/`globalThis.utils` noop 替身。用例：幂等（v6 零步骤）/ 门控（v3→4-6）/ 全量 0→6 / 缓存失效 / 失败重试（版本停留 3）；断言采**字段级**避免整对象 `toEqual` 脆弱。

**附件路径正向回归（doc/163，+2 用例）**：`clean_no_url_blacklist`（跨 `blacklist`×`blacklist_car_list` 相互过滤、`key`/`recordTime` 删除、`recordTime`→`createTime`）与 `async_merge_other`（17 个废弃定时任务键 + `downPath115` 删除）此前只在全量用例中被顺带经过、未被断言——本轮第二 describe **直接调用**两公开方法：用例 6 断言番号侧保留 C1/C3、演员侧仅余 Alice（`createTime===1000` 且无 key/recordTime）；用例 7 断言 `theme` 保留、三个废弃键删除（`saveSetting` 路径补 `window.clean_cacheSettingObj` noop 替身）。修正套件头注释过时 `environment: node` 描述为 jsdom。

**增量 any 消除（doc/164）**：按批次 6「禁止新增 any，存量在每次触及相关文件时消除」将四个迁移方法**重类型到既有接口**（接口已含旧迁移字段为可选属性 + `[key: string]: any` 索引签名）：数组读取 `as Promise<CarRecord[]>`/`BlacklistItem[]`/`FavoriteActress[]`，回调参数 `: any` 删除改由推断，迁移体 `delete item.actress` 等因接口形状仍类型合法、**零 `as any` 回填**。4 方法共移除 18 处显式 any 标注。三项 backlog 保留并附理由：`merge_table_name`（六旧键形状混合无单一接口）、`async_merge_other`（操作 `Setting` 对象，索引签名已表达）、`getBlacklistCarList` 原始读（`utils.copyObj`/`deepFreeze` 自身为 any，局部收紧无下游收益）。

### 结果

测试 21 → 26（doc/162）→ **28**（doc/163，此后至阶段末保持 28/28）。eslint 805→**786**（doc/164，−19）。版本 1.28.3→1.28.4（doc/162，src 变更）→1.28.5（doc/164）；doc/161 属纯测试/工具变更不递增 userscript 版本，但把 `package.json` version 由 1.27.8 同步至 1.28.3（批次 6 元数据漂移修正）。迁移套件覆盖矩阵闭合：六步迁移 + `runMigrations` 编排（幂等/门控/全量/失败重试）全部有断言级保护。

### 演进链与遗留

doc/161 的 seam 推迟项在 doc/162 闭合；doc/162 的 5 用例在 doc/163 补为 7 用例；doc/164 的「触及即消除」成为后续波次 eslint 警告下降的机制之一。遗留：CI 尚未接入 `bun run test` 发布门禁（doc/161/162 后续验证建议）；storage-manager 残留 any ≈ 21 行（forage 字段、getSetting/saveSetting、接口索引签名、三项 backlog 方法）。

## 6. 回归修复与结构规划（doc/165–166）

### 背景/根因

- **doc/165**：用户实测两条回归——① 视频流弹出的 iframe 详情页**不加载**脚本信息；② 弹窗内 UI 错乱（疑 CSS 写错）。要求按「遍历文档→代码检查→方案自辩→可行性验证→修改→结构收敛→测试→文档」顺序执行，重点做目录/结构优化，并清理 `src/core/feature-flags.ts` 临时产物。**根因：`@noframes` 是回归源（非 CSS 编写错误）**。证据链：archetype 头部无 `@noframes`（仅 `@match`+`@include`）；弹窗即同源 iframe（layer `open type: 2`，doc/74/84/87/29 的跨 frame 逻辑——ESC 闸门挂 `window.top.__jhsEscGate`、`parent.document` 操作 layer 节点、封面点击委托——均以脚本在 iframe 内运行为前提）；`car-list-reader` 的 `if (window.self !== window.top) return;` 自守卫反证原始设计「处处运行、按需自守卫」；`@noframes` 不提供额外安全（`@match` 已限定 javdb.com/missav.*，跨域 iframe 本就不注入），唯一作用是**禁止脚本进入同源 layer 详情 iframe**——正是用户要的功能。`@noframes` 系 doc/136 作为「安全边界加固」加入，但无任何 doc 评估过它与 iframe 弹窗功能的冲突。
- **doc/166**：顶部导航栏「设置」「鉴定记录」按钮显示多余 Bulma 下拉箭头（「设▼」）。根因：箭头非 HTML 字符、非插件 CSS `content` 注入，而是站点 `.navbar-link:not(.is-arrowless)::after` 边框三角；原脚本的压制规则 `.nav-btn::after { content: none !important; }` 在 doc/02 CSS 提取时被破坏——样式首行提取为 `__css_text__ .nav-btn::after`，而运行时替换调用为**大写** `settingCssRaw.replace('__CSS_TEXT__', cssText)`：① 占位符大小写不匹配（`String.replace` 匹配不到，动态容器宽度 CSS 未落地，小写占位符原文注入页面）② 占位符与选择器粘在同一行（即便大小写匹配，替换后也破坏选择器结构）。浏览器按 CSS 错误恢复丢弃整条规则，Bulma 箭头在四个注入按钮上全部显现。

### 方案与决策

**doc/165 修复**：`vite.config.ts` 删除 `noframes: true` 一行，保留 doc/136 收窄后的 3 个官方 `@match`（真实安全意图不变）；隔离验证产物 `// @noframes` 计数 0、`@match` 三条齐全。

**恢复 in-iframe 执行后的双触发分析**（用户「一定要做好测试」要求）：逐项分类启动期副作用——`injectCss`（向 iframe head 注入同一份样式，期望行为）；全局挂载（赋给 iframe 自身 window，每文档独立）；BroadcastChannel（监听在 list-page.handle 页型门控，详情 iframe 不挂监听）；clog（`unsafeWindow.parent.clog` 存在则复用顶层 logger，跨 frame 共享为原始设计）；error/unhandledrejection 监听（各捕获本文档错误）；mousedown z-index（每文档）；tooltip/layer wrapper（ESC 闸门经 `window.top` 跨 frame 共享）；插件 register（内存内每文档）；`initPageContext`（按 iframe 自身 URL 计算，详情 iframe 内 `isDetailPage=true`，期望行为）；`runMigrations`（`navigator.locks` 串行+幂等）；`storageRevision.init`（senderId 排除自身 + `if(this.channel)return` 幂等）；autoBackup（日期键去重、最坏幂等 PUT）；`beforeunload destroyAll`（iframe 卸载销毁 iframe 资源）。**结论：全部副作用均为每文档独立/幂等/页型门控/自守卫/跨 frame 设计/与原始同行为，不引入数据/功能双触发回归**。两个记录项：① `registerDiagnosticsMenu` 在真实 Tampermonkey 下可能登记第二个「📊 插件诊断」菜单项（唯一新 cosmetic nit，本轮不修以保持干净归因，建议后续加 `if (window.self !== window.top) return;` 守卫）；② visit-history 守卫**已驳回**——`recordVisit()` 以 `location.pathname+search` 为键，顶层与弹窗 iframe 路径不同会记为两条**正确且不同**的访问记录，加守卫反而丢失「经弹窗打开的详情页」记录。

**CSS 复核**：`menu-btn` 改名内部完整（无悬空选择器）；VLT 前缀无残留；z-index `var()` 定义于 `:root` 同文档注入、值未变；`--jhs-color-text-muted: #999` 仅定义未使用（latent，不追）。弹窗 UI 乱真因是脚本未注入 iframe，非 CSS 写错。

**feature-flags 收敛（行为保持）**：弱类型 `Record<string, boolean>` → 封闭接口 `interface FeatureFlags`（无索引签名）+ 逐键 JSDoc 标明门控位置；16 个键、默认布尔值、localStorage 覆盖 IIFE **逐字节不改**（默认 true 的键即便当前无分支读取仍是用户可经 localStorage 关闭插件的对外控制，删除会剥夺该控制且 tsc/测试均无法捕获）；grep 证实全 src 无动态访问（无 `featureFlags[expr]`/spread/`Object.keys` 等）→ 封闭接口不破坏调用点，tsc 为键拼写安全网。

**结构规划（deferred）**：doc scout 确认当前 `src/` 顶层布局已符合 AGENTS.md §2，无任何 doc 提议重组 core/ 或移动 feature-flags（其「不统一」实为弱类型，已修复），故不做无依据目录搬迁（scope-creep 且高回归面）。真正的结构债是 3 个超大文件：`vlt-sync.ts`（2428）、`detail-page-button-plugin.tsx`（2041）、`setting-plugin.tsx`（1571）；给出 vlt-sync 拆分可执行大纲（vlt-broadcast 三重广播总线 / vlt-remote-sync 跨标签同步 / vlt-lock-queue Web Locks+队列 / 保留编排+失败 UI 回滚），setting/dpb 列候选待立项——后由 doc/172/173/177 执行。

**doc/166 修复**：`setting-plugin.css` 首行占位符改为**独立行的大写 `__CSS_TEXT__`** + 空行 + 独立 `.nav-btn::after { content: none !important; }` 规则；占位符行附加 `stylelint-disable-next-line selector-type-case` 注释——**注释文案刻意不含 `__CSS_TEXT__` 字面量**（`String.replace` 仅替换首次出现，注释含字面量会抢占匹配、使真正占位符残留并再次破坏规则）。`setting-plugin.tsx` 未改动（其 L212 替换调用本就是正确大写形式）。

### 结果

版本 1.28.5→1.28.6（doc/165）→1.28.7（doc/166）。doc/166 产物 2,024.95 kB；验证 `grep -c '__css_text__'` = 0（旧小写占位符已消失）、大写占位符 = 1。doc/165 诚实声明：无头 Chromium 无 `GM_*` 宿主无法忠实运行 userscript，`@noframes` 回归由「指令语义 + doc/74/84/87/29 + common-util 跨 frame 代码 + archetype 头部无 @noframes」**静态可证**，修复效果需用户在自己 Tampermonkey 中目视确认。

### 演进链与遗留

doc/136 加的 `@noframes` 在 doc/165 被移除（回归修复）；`registerDiagnosticsMenu` 菜单重复 nit 与 `--jhs-color-text-muted` 潜伏定义记入 doc/165 未修；vlt-sync 拆分大纲在 doc/172/173 落地。786 个 `no-explicit-any` 的主体来源（缺 @types 声明）在 doc/165 得到核实。

## 7. HTML→TSX 提取与零硬编码 HTML（doc/167–170）

### 背景/根因

- **doc/167**：全量审计发现 7 处 HIGH 级内联 HTML 模板字面量（~135 行），违反 §3.5 组件化约定（所有 UI 应为 `src/components/*.tsx` React 函数组件，经 `jsxToString()` 渲染）。
- **doc/168**：一轮提取后残留扫描发现 fc2-plugin.tsx 与 fc2-by-123av-plugin.tsx 各有 2 处 HIGH 动态内容模板仍为内联（一轮仅提取了弹窗骨架）；另有 5 处 §9.1 导入顺序违规 + 1 处 `void YES` 死代码 hack。
- **doc/169**：用户三项强制要求——① 全部 HTML 基于 React 组件生成，零硬编码 HTML 字符串；② 大文件拆分 + 代码复用 + 原子化 + 目录规划规则写死进 AGENTS.md；③ 标题栏检索按钮点击无响应 bug 修复。使用 superpowers:writing-skills 纪律（机械约束必须自动化）。
- **doc/170**：最终 src/-only 残留审计又发现 4 处内联 UI 模板字符串违规（common-util / new-video / list-waterfall / review），并对 icons.ts 的 8 个 SVG 常量做白名单复核。

### 方案与决策

**doc/167 一轮提取（7 处）**：fc2-plugin→`fc2-detail-dialog.tsx`（详情弹窗）；fc2-by-123av-plugin→`fc2-browse-page.tsx`（浏览页搜索表单+排序）；image-recognition-plugin→`image-recognition-dialog.tsx`（上传/预览弹窗）；magnet-hub-plugin→`magnet-result-card.tsx`（磁链结果卡片）；vlt-sync→`vlt-create-list-form.tsx`（新建清单表单）；plugin-diagnostics→`diagnostics-table.tsx`（诊断表格）；`constants/api.ts` 的 `markDataListHtml()` 删除并复用 `hit-show-movie-item.tsx` + `javDbApi` 聚合对象。附带：`jsx-to-string.ts` `renderAttrs` 新增 `htmlFor`→`for` 属性映射（与 `className`→`class` 对称），消除 vlt-create-list-form 的 `as any` hack。5 个插件/核心文件因 JSX 语法从 `.ts` 重命名为 `.tsx`（导入均无扩展名引用，零破坏）。行为保持：style 输出无冒号后空格/无尾分号但 CSS 解析器对空白不敏感（DOM 等价）；转义为安全正向偏差；`sanitizeUrl` 仅阻止 javascript:/data:/vbscript:，`magnet:` 与相对路径不受影响；void 标签自闭合 DOM 等价。

**doc/168 二轮提取（4 处）**：fc2-plugin 的 `fc2-movie-detail.tsx`（影片详情信息）与 `fc2-magnet-item.tsx`（磁链列表项）；fc2-by-123av-plugin 的 `fc2-123av-detail-dialog.tsx`（详情弹窗骨架）与 `fc2-123av-movie-info.tsx`（影片信息块）。导入顺序修复 5 文件（fc2-plugin / fc2-by-123av / magnet-hub-plugin / vlt-sync / plugin-diagnostics）；删除 `void YES;` hack + 未使用 `YES` 导入。

**doc/169 零硬编码 HTML 全清（15 文件 LOW）**：全部残留内联 HTML 字符串字面量（单元素 badge/mount/log/Tabulator formatter/SVG/CSS style 块）提取为 React 组件或经 jsxToString 渲染，新增 ~25 个直接组件 + 9 面板子组件 + 1 CSS 辅助（sanctioned 常量除外）。要点：3 个 `<style>` 块 → 独立 .css 文件（magnet-hub-plugin.css / image-recognition-plugin.css / translate-plugin.css）；SVG 的 kebab-only 属性无法以 JSX 属性表达 → 命名常量 + `dangerouslySetInnerHTML`（TOAST_SVG_ICONS / JAVDB_ICON_SVG）；4 文件 `.ts`→`.tsx`（screenshot/translate/missav-quick-copy/vlt-toast）。结果：src/ 全树零内联 HTML 字符串字面量（仅 2 个 sanctioned dangerouslySetInnerHTML 常量保留 SVG 路径数据，元素本身由组件生成）。

**doc/169 其余项**：`setting-dialog.tsx` 拆分 940→171 行（9 面板子组件 `setting-panels/` + `hr-style.ts`，bindClick/loadForm 全部 jQuery 选择器目标保留）；`constants/api.ts` any 收窄 14→0（MovieDetail/RelatedCollection any 字段收窄 + 6 个辅助接口 MovieActor/PreviewImage/MovieReview/RankingMovie/TopMoviesResponse/RawRelatedCollectionItem + 3 函数返回 + 2 回调参数，eslint 783→764）；机械结构门禁 `scripts/check-structure.ts`（`bun run check:structure`，800 行文件硬上限 + 20 直接子文件目录硬上限，**棘轮机制**——当前超限文件/目录以精确现状值 seeded、只许下调不许抬高，不接入 build/lint/test 为独立命令）；AGENTS.md §10/§11 规则写死；2 文件 `.tsx`→`.ts`（vlt-plugin / rating-display-plugin，无 JSX）；6 个 fc2 专属组件移入 `src/components/fc2/`（满足 §11.2，将 src/components 直接文件数 126→~120，清除 check:structure 门禁）；检索按钮修复（nav-bar-plugin `toggleOtherNavItem` 原按宽度在自定义检索框与站点检索栏间切换显隐，1024-1599px 显示未绑定的站点检索栏致无响应 → 桌面宽度 >1023 统一显示已绑定的自定义检索框）。

**doc/170 收尾（4 处 + 边界写死）**：`common-util.ts` insertStyle 的 `'<style>'+css+'</style>'` 拼接 → `styleBlockHtml(css, id?)` 辅助（style-block.tsx，`.indexOf('<style>')` 搜索 needle 保留不动）；new-video 头像弹窗 → 复用 `StyleBlock`；list-waterfall 回到顶部 `btn.innerHTML = '<svg...>'` → `scrollTopIconHtml()`（新 scroll-top-icon.tsx，SVG 仅 viewBox/d 无需 dangerouslySetInnerHTML）；review 星标 `Array(score).fill('<i class="icon-star"></i>')` → `jsxToString(<ReviewStarIcon />)`（新 review-star-icon.tsx）。死 SVG 清理（icons-trace + icon-trace 双重核实）：3 个 sanctioned 保留（EDIT_SVG/DELETE_SVG/REFRESH_SVG，经 React props→dangerouslySetInnerHTML 在函数组件内消费）；5 个 DEAD 删除（SETTING_SVG/CHECK_SVG/ACTRESS_SVG/NEW_SVG/BLACKLIST_SVG 及对应字段，赋给 BasePlugin 字段但全 src 零读取、唯一 importer 为 base-plugin.ts）。**§9.7 零硬编码 HTML 边界写死（四类 triage）**：违规 = 字符串字面量被解析进 DOM（innerHTML / jQuery .html/.append/.prepend/.after/.before / jQuery HTML 片段选择器 `$( '<...>' )` / 拼接进上述）且非 sanctioned 常量；豁免 = `.indexOf/.includes/.startsWith/.match/.test` 对 DOM 派生文本的字面量（不生成元素）；**不在范围** = jQuery `$( '<tag>' )`/`$( '<tag class=...>' )` 元素构造（jQuery 的 createElement 等价 API，非「拼字符串编写 UI 模板」，强制改写为 document.createElement 属风格偏好且对正在工作的插件文件引入无谓回归面）；sanctioned 数据常量 = 经 dangerouslySetInnerHTML 在组件内注入的 SVG/CSS 命名常量（元素本身仍由组件生成）。

### 结果

组件 91→97（doc/167，HIGH 内联 7→0）→101（doc/168，HIGH 4→0）→ +~25（doc/169，全树零内联 HTML）。版本 1.28.7 → 1.28.11（doc/167–170 期间递增，doc/170 最终门禁 v1.28.11 复核：build 通过 / test 28/28 / lint 0 errors / check:structure OK / 死符号 grep = 0）。eslint 786→785（doc/167，消除 as any 减 1）→783→764（doc/169，api.ts 收窄 −19；doc/168 未记录 warn 数）。

### 演进链与遗留

doc/167→168→169→170 为同一提取主线的四轮推进（HIGH→LOW→残留收尾），doc/170 的 §9.7 四类 triage 把「零硬编码 HTML」从原则变成可机械判定规则，防止后续把 jQuery 元素构造 idiom 误判为违规而空转。遗留：`markDataListHtml` 删除后 `javDbApi` 聚合对象成为 api.ts 的导出面（doc/167）；lint 0 errors 但 warn 数在 doc/170–173 各轮验证记录中未逐轮给出（见 §12 轨迹）。

## 8. WebDAV 备份修复（doc/171）

### 背景/根因

用户反馈设置面板 3 问题：① UI 布局混乱（输入框被 `max-width:220px`/`min-width:180px` 限制致标签与输入框间距过大，密码切换按钮被 `width:100%` 撑满换行）；② WebDAV 备份 401（`backupDataByWebDav`/`backupListBtnByWebDav` 从 `GM_getValue` 读凭据而非输入框，未保存的编辑不生效）；③ WebDAV URL 被删（`loadForm` 仅读 GM 新格式，旧 `settings.webDavUrl` 未迁移，保存时 `saveForm` 删旧格式并写空 GM）。另用户要求移除 WebDAV 备份加密（私有服务器无需加密）。

### 方案与决策

| # | 修复 |
|---|------|
| 1 | 移除 `.form-content` 的 max/min-width；密码字段用 flex 容器包裹 input + button |
| 2 | 备份读写优先读输入框 `$('#webDavUrl').val()`，回退 GM |
| 3 | `loadForm` 增加旧格式回退 + 首次加载自动迁移到 GM 新格式 |
| 4 | 加密移除：`backupDataByWebDav`/`autoBackup` 移除 `encryptBackupV2` 调用与 `backupPassword` 检查，直接上传明文 JSON；**保留** importData 解密路径（兼容旧加密备份）与 exportData 本地加密 |
| 5 | `transition: all 0.3s` 反模式（image-recognition-plugin.css `#upload-area`）窄化为 `transition: border-color 0.3s, background-color 0.3s` |

### 结果

build / test 28/28 / lint 0 errors 通过；验证 `encryptBackupV2` 仅出现在 importData（解密兼容）与 exportData（本地加密），`backupPassword` 仅出现在 loadForm/saveForm/importData/exportData。

### 演进链与遗留

doc/137 引入的备份加密在 doc/171 被降级为「仅本地导出加密 + 旧备份解密兼容」；WebDAV 凭据读取在 doc/175 Wave 2 进一步去重为 `getWebDavCredentials`。

## 9. 大文件拆分与组件重组（doc/172–173）

### 背景/根因

AGENTS §10/§11 要求单文件 ≤800 行、单目录 ≤20 直接子文件。doc/172 对 5 个超限文件做职责拆分、对 src/components/ 120+ 平铺文件做子目录重组；doc/173 回应设置面板 CSS 严重不统一（输入框对齐混乱、密码切换 emoji 不一致、颜色选择器原生突兀、面板布局五花八门）并完成 vlt-sync 最终拆分。

### 方案与决策（doc/172 大文件拆分）

| 文件 | 前→后 | 新增模块 |
|------|-------|----------|
| detail-page-button-plugin.tsx | 2043→413 | dpb-want-watched(317) / dpb-rating(505) / dpb-list-panel(658) / dpb-subtitle(187) / dpb-helpers(64) / dpb-types(17) |
| other-site-plugin.tsx | 1178→510 | osp-preload(390) / osp-filter-bar(262) / osp-helpers(48) / osp-enabled-sites(27) / osp-types(20) |
| list-reading-status-plugin.ts | 1103→275 | lrs-toolbar(421) / lrs-storage(246) / lrs-render(220) / lrs-types(32) |
| common-util.ts | 1094→519 | util-dom(157) / util-misc(124) / util-popup(98) / util-sort(92) / util-date(85) / util-download(74) / util-url(59) / util-cookie(50) / util-retry(40) / util-clipboard(16) |
| vlt-sync.tsx | 2425→2259 | vlt-broadcast(121) / vlt-remote-sync(64) / vlt-lock-queue(31)（上轮已拆） |

拆分模式：class 保留为 facade/delegate，方法组提取为独立函数（首参 `plugin: PluginType`，type-only import 避免循环依赖）；公共方法签名不变，getBean 运行时表面完整。

**组件目录重组**：src/components/ 从 120+ 平铺文件重组为 **25 个子目录、直接文件 0**——review(10) / related(8) / blacklist(8) / dialogs(8) / fc2(6，已有) / magnet-hub(6) / actress(5) / history(5) / setting(5) / top250(5) / dpb(5) / nav(4) / log(4) / other-site(4) / screen(4) / subtitle(4) / hit-show(3) / image-preview(3) / image-recognition(3) / preview-video(3) / movie(3) / want-watched(2) / misc(20，≤20 上限) / setting-panels(10，已有)。导入路径全部更新（131 外部 + 13 内部 = 144 处 import 重写）。check-structure.ts 移除 4 个 FILE_CEILINGS + src/components DIR_CEILINGS。删除死组件 `video-title-span.tsx`（doc/130 已标记）。

### 方案与决策（doc/173 设置面板 UI 统一化）

**CSS 设计系统**（setting-plugin.css 652→786 行）：`.setting-item` flex→CSS Grid（`grid-template-columns: 180px 1fr`）统一标签右对齐 + 输入框撑满；统一控件样式（input/select/textarea 高 36px、圆角 6px、focus 蓝色光环）；密码输入移除自定义 emoji 切换按钮、依赖浏览器原生 `::-ms-reveal`/Chrome 密码显示按钮；iOS 风格 toggle（`.jhs-toggle` 40×22px 灰→绿）；分区标题 + 分隔线（`.jhs-setting-section`/`-title`）；统一按钮（`.jhs-setting-btn--primary/success/danger/pink/mint`）；颜色选择器 36×36 圆角；只读输入框灰底；tooltip 图标（`.jhs-tooltip-icon`）。**8 个原子表单组件**（src/components/setting/）：SettingRow / SettingInput / SettingSelect / SettingToggle / SettingCheckbox / SettingSection / SettingButton / SettingColorRow。**9 个面板全部重构**，所有 id/class/data-attr 保留（120 个 jQuery 选择器审计：118 OK + 2 预期移除（密码切换）+ 0 缺失 + 0 死处理器）。独立预览页 `preview/settings-preview.html`（1387 行自包含 HTML），无需 Tampermonkey 即可浏览器视觉审查全部 9 面板。

**vlt-sync.tsx 最终拆分（2259→27 行 barrel re-exports）**：vlt-helpers.ts(338) / vlt-checkbox.ts(288) / vlt-server.ts(484) / vlt-create-list.tsx(687) / vlt-list-mgmt.ts(340)。

### 结果

check:structure OK（261 文件 / 39 目录，doc/172）；build / test 28/28 / lint 0 errors 全绿。

### 演进链与遗留

doc/165 的 vlt-sync 拆分大纲在 doc/172 落地前半（三模块），doc/173 完成最终拆分；doc/172 的 dpb/other-site/lrs/common-util 拆分是 doc/177 Wave 4 二次拆分的上游（彼时 common-util 522 行、dpb-list-panel 658 行等仍需再拆）。失物招领：doc/172 显示 vlt-sync.tsx 行数 2425 与 doc/165 记录的 2428 有微小出入（各轮计数口径）。

## 10. 原子化与复用 Wave（doc/174–179）

### 背景/根因

Round-2 审计后启动「先原子化拆分、再复用合并、再复查、多轮循环」工作流，目标：降低单文件行数、消除重复组件、抽取共享工具、收敛内联 any。Wave 1-2 以拆分+复用为主，Wave 3 聚焦复用合并，Wave 4 拆分与复用并行，doc/179 做收敛验证。

### Wave 1（doc/174）：storage-manager / vlt-tags 拆分 + review/related 复用合并

- **storage-manager.ts 1321→415**：拆出 `src/core/storage/` 六模块（car-list-ops / blacklist-ops / blacklist-car-list-ops / favorite-actress-ops / keyword-ops / storage-migrations）；类保留薄委托 + 类型再导出（CarRecord/BlacklistItem/FavoriteActress），外部 `from '../core/storage-manager'` 零改动，type-only 循环导入安全。
- **vlt-tags.ts 1028→421**：拆出 vlt-filter-bar / vlt-tag-renderer / vlt-sync-listener。
- **复用合并**：review/ × related/ 七对近同组件 → `src/components/shared/` 参数化组件（section-header / containers / status-message / end-message / error-message / load-more）；vlt-panel + missav-panel → `sync-panel`；新增 `colored-text-cell`；删除 16 个冗余组件文件；review-item / related-item 因字段不同保留。
- **共享工具**：util-translate（翻译去重，10s AbortController）/ util-async（withLoading 包装）/ tabulator-factory（zh-cn locale + 基础配置）/ back-to-top（按钮工厂）/ toast.failWithToast（失败 toast 包装）；接入 10 处调用点（list-page/translate/top250/hit-show/want-and-watched/dpb-subtitle/gfriends/list-waterfall/base-plugin/api）。
- **门禁修复**：补 `clean_no_url_blacklist`/`async_merge_other` 实例方法委托恢复测试 seam；tabulator-factory/back-to-top 归入 core/util 使 src/core 直接文件回落至 28 上限内。
- 结果：check:structure OK（281 文件 / 41 目录）；eslint 0 错（123 warn 基线）。

### Wave 2（doc/175）：6 个插件文件原子化 + 2 处组件复用 + 1 共享工具

- **setting-plugin.tsx 1568→497**：拆出 `src/plugins/setting/` 五模块（webdav-operations / cache-management / setting-form-binder / data-import-export / setting-keys）。三处去重：WebDAV 凭据校验 3 处 → `getWebDavCredentials`（autoBackup 走无 toast 的 `getWebDavCredentialsFromGm` 静默失败）；`withLoading` 收敛 5 处手动 `loading()`+`try/finally`（消除遗漏 `loading.close()` 风险）；`downloadJson` 抽取 3 处 Blob+createObjectURL（不引入 `utils.download` 的额外 toast）。
- **history-plugin.tsx 782→511 + blacklist-plugin.tsx 780→441**：各拆 tabulator 配置模块 + 业务模块（history-tabulator.tsx/history-batch-ops.ts；blacklist-tabulator.tsx/blacklist-scraper.tsx），tabulator 配置复用 core/tabulator-factory 消除两处重复的 zh-cn 本地化与通用选项；组件合并：history 源/状态单元格 → `shared/colored-text-cell`，删除两个字节相同的冗余组件（history-source-cell / history-status-cell）。
- **preview-video-plugin.tsx 661→157 + new-video-plugin.tsx 589→288**：拆出 dmm-resolver.tsx / quality-selector.ts / video-toolbar.tsx / actress-card-renderer.tsx / avatar-search.tsx。
- **共享工具**：`core/util/util-status-tag`（STATUS_TAG_CONFIG + 位置计算 + 注入），接入 list-page-plugin 两处状态标签渲染。
- 结果：eslint 123→**74**（−49，内联 any 块随类型化模块消除）；check:structure OK（294 文件 / 46 目录）。

### Wave 3（doc/176）：复用合并

- **三重广播总线统一（H×2，~140 行去重）**：新建 `core/util/broadcast.ts`（broadcastSend + broadcastSubscribe）统一 4 发送点 + 3 订阅点的 GM_setValue / localStorage / CustomEvent 三通道收发。**线格式逐字节保留**：`JSON.stringify` 写 GM/localStorage、对象传 CustomEvent `detail`；`eventName`/`eventDetail`/`raw` 选项保留站点差异（`jdb:last-sync` vs `jdb:sync-complete`；dpb CustomEvent detail 不含 time；dpb raw 自解析）。与原始一致的边界：无 senderId、无跨通道去重、无 teardown。迁移文件：vlt-broadcast / vlt-remote-sync / vlt-sync-listener / dpb-want-watched。消除「修 bug 须改 4 处」隐患。
- **failWithToast 补全（M，11 对）**：car-list-ops 10 对 + keyword-ops 1 对 `show.error`+`throw` → `failWithToast`；1 处独立 `show.error`+`return`（无 throw）保留。
- **红色 span 组件合并（M）**：`LogColored` 删除（零 JSX 导入者），`logColoredHtml` 重定义为 `ColoredTextCell(color='#f40')` 薄包装；`ConfirmWarn` 重定义为 `<br/>` + `ColoredTextCell` 薄包装；经 jsxToString 实证输出逐字节相同。
- **Fc2 对话框骨架合并（M→DEFERRED）**：共享骨架仅 ~6-10 行（非审计估计 ~40 行），干净合并需 ≥3 个 slot prop，总代码反增且可读性下降——按 AGENTS §10.2 判定为**有害过度抽象**，resolved-by-deferral（N/A）。
- broadcast.ts 归入 core/util/，修复 src/core 直接文件 29→28（ratchet 上限内）。
- 结果：eslint 74→**60**；check:structure OK（295 文件 / 46 目录）。

### Wave 4 原子化（doc/177，Round 4）

Round-4 审计发现 **list-page-plugin.tsx（734 行）从未原子化（先前 wave 的声明为假）**、多个已拆分 barrel 仍含残留逻辑（history/blacklist/new-video 数据层方法未移出）、15 个超 400 行文件混合多职责（vlt-create-list 687 / dpb-list-panel 658 / vlt-db 571 / common-util 522 / setting-form-binder 517 / logger 507 / dpb-rating 507 / auto-page 490 / vlt-server 484 / list-waterfall 469 / vlt-filter-bar 458 / fc2-by-123av 437 / lrs-toolbar 428 / other-site 510 / status-tag-filter 507）。8 个并行 worker 按目录隔离拆分 **18 个文件**，新建 7 子目录（list-page/、fc2-123av/、status-tag-filter/、auto-page/、list-waterfall/、video-lists-tag/db/、video-lists-tag/server/）+ 已有子目录新增模块（setting +3、history +1、blacklist +2、new-video +1、list-reading-status +2、detail-page-button +3、core/util +2）：

| 文件 | 前→后 | 新模块 |
|------|-------|--------|
| list-page-plugin.tsx | 734→258 | lp-filter.tsx / lp-dom.ts / lp-translate.ts / lp-jump-page.tsx |
| vlt-create-list.tsx | 687→11 | vlt-create-list-api.ts / vlt-create-list-ui.tsx |
| dpb-list-panel.tsx | 658→428 | dpb-list-panel-fetch.ts / dpb-list-panel-render.tsx |
| vlt-db.ts | 571→83 | db/vlt-db-core.ts / db/vlt-db-reconcile.ts / db/vlt-db-migrate.ts |
| common-util.ts | 522→283 | core/util/esc-layer.ts（ESC 层管理：gate+栈+全局键监听） |
| setting-form-binder.ts | 517→248 | setting/setting-form-load.ts / setting/setting-form-bind.ts |
| history-plugin.tsx | 511→431 | history/history-data.ts |
| other-site-plugin.tsx | 510→377 | other-site/osp-probe.tsx |
| status-tag-filter-plugin.ts | 507→235 | status-tag-filter/stf-collect.ts / stf-apply.ts / stf-ui.ts |
| logger.tsx | 507→259 | core/util/logger-panel.tsx |
| dpb-rating.tsx | 507→230 | dpb-rating-api.tsx |
| auto-page-plugin.ts | 490→304 | auto-page/ap-fetch.ts / ap-scroll.ts |
| vlt-server.ts | 484→215 | server/vlt-server-api.ts / server/vlt-server-recover.ts |
| list-waterfall-plugin.ts | 469→279 | list-waterfall/lw-fetch.ts / lw-scroll.ts |
| vlt-filter-bar.ts | 458→311 | vlt-filter-apply.ts |
| blacklist-plugin.tsx | 441→277 | blacklist/blacklist-data.tsx / blacklist/blacklist-add.tsx |
| fc2-by-123av-plugin.tsx | 437→170 | fc2-123av/fc2-browse.tsx / fc2-123av/fc2-detail.tsx |
| lrs-toolbar.ts | 428→213 | lrs-sort.ts / lrs-filter.ts |
| setting-plugin.tsx | 498→452 | setting/setting-tag-ops.ts |
| new-video-plugin.tsx | 288→154 | new-video/edit-actress.tsx |

D1 去重：list-page-plugin 内 3× 重复的 textContent 替换块提取为 `replaceTitleTextNodes`（lp-dom.ts），3 调用点统一。Ratchet 合规：src/core 28（上限内）/ core/util 18（≤20）/ video-lists-tag 20（≤20，db/ + server/ 嵌套避免超限）。结果：eslint 60→**59**；check:structure OK（331 文件 / 53 目录）；产物 2397.65 kB（gzip 612.19），较原子化前 **+20 kB**（新模块代码量，gzip +6）。

### Wave 4 复用合并（doc/178，Round 4）

基于 Round-4 复用审计 + director seed 的 3 个复用项（C1/C2/C3）执行；bus 采纳扫描 A1/A2/A3 经核全为 N/A/L（不同通道形状 / 无剩余 failWithToast 对 / 单用彩色 span），本轮仅执行 C1/C2/C3。

- **C3 simple_lists 分页获取去重（M，执行）**：dpb-list-panel 的清单分页抓取与 vlt-server 的权威状态查询共享 ~29 行「单页 fetch+parse」逻辑（AbortController + 10s 超时；`fetch` 携带 `{credentials:'same-origin', cache:'no-store', Accept:'application/json'}`；`response.ok` 校验；JSON 解析 `{lists, page}`；DOMParser 解析 `payload.lists`；从 `payload.page` 提取 `a[rel='next']`；nextUrl origin+pathname 校验 `/users/simple_lists`；设置 vid searchParam）→ 提取为 `core/util/util-simple-lists.ts` 的 `fetchSimpleListsPage(url, vid?)`。选 core/util 理由：两插件均已依赖的中立层（dpb 引 tabulator-factory/util-async，vlt 引 broadcast），不引入新跨插件依赖边；core/util 18+1=19 ≤ 20 上限。共享函数**仅做单页 fetch+parse**，不含循环、不含 throw-vs-null 决策；网络失败/HTTP 非 2xx/`payload.lists` 非字符串/下一页地址非法时**抛出**。两调用方保留循环与错误语义：dpb `fetchAllListPageEntries`（collect-all + throw）保留 `while`、`LIST_PANEL_MAX_PAGES` 上限、`visited` 循环检测与全部 throw（错误向上抛由 `loadAllListPages` 的 `.catch` 置 `jhsPagesStatus='partial'`）；vlt `fetchAuthoritativeCheckboxState`（search-one + null）保留 `for`（page<50）、命中 listId 早返回、`!result.nextUrl` 返回 `{checked:false,count:null,name:null}`、外层 try/catch 把 throw 转 `clog.error` + null。零偏差核对：两调用方超时原值均 10000ms（`LIST_PANEL_PAGE_TIMEOUT_MS`/`AUTHORITATIVE_LIST_TIMEOUT_MS`），共享函数沿用；fetch 选项/Accept/校验/提取/校验/searchParam 逐条保留；vlt 的「!ok→null」「格式异常→null」统一为 throw 再由外层 catch 收敛为 null，终态一致。消除 ~29 行跨插件重复 + salt/endpoint 双写隐患。
- **C1 back-to-top CSS 孪生（M，执行）**：`back-to-top-button.css`（#jhs-back-to-top）与 `list-waterfall-plugin.css`（#jdb-wf-back-to-top）的 4 组规则（base/:hover/.show/svg）声明体**逐字节相同**，仅选择器 id 不同。注入作用域核对：两 CSS 均经 processCss→insertStyle 注入 head，SettingPlugin 与 ListWaterfallPlugin 均未声明 pageTypes（默认空数组=所有页面类型）→ 每页都注入；back-to-top-button.css 在 `addBackToTopBtn` 中二次注入但 insertStyle 幂等去重。执行：4 组规则改分组选择器（`#jhs-back-to-top, #jdb-wf-back-to-top {...}`），声明体不变；从 list-waterfall-plugin.css 删除整段 `#jdb-wf-back-to-top` 规则（~52 行），保留 `.jdb-wf-loader*` 与 `@keyframes jdb-wf-spin`。两按钮计算样式不变。
- **C2 back-to-top 逻辑对（L/N-A，记录不合并）**：`setting-plugin.addBackToTopBtn` 与 `core/util/back-to-top.createBackToTopButton` 共存为**设计意图**：守卫 `back-to-top.ts:28` `if (document.getElementById('jhs-back-to-top') || document.getElementById(id)) return () => {}` 避免双按钮；滚动动画不同——设置按钮 `utils.smoothScrollToTop(500)`（requestAnimationFrame + cubic ease-in-out 补间，500ms）vs 瀑布流按钮 `window.scrollTo({top:0, behavior:'smooth'})`（原生）。合并会改变设置按钮滚动手感（500ms 自定义补间→原生 smooth），属零偏差风险，**不合并**并记录备查。
- 附带：vlt-helpers.ts 删除孤立常量 `AUTHORITATIVE_LIST_TIMEOUT_MS`（去重后无引用，超时值移入共享函数）。

### 收敛验证（doc/179，Round 4 执行 / Round 5–8 复查，纯文档轮次）

R5-6 工作级复查（只读）：R5 原子化 CONVERGED（L=12，H=0 M=0）、复用 CONVERGED（L=9，H=0 M=0）；R6 原子化 CONVERGED（L=2，H=0 M=0）、复用 CONVERGED（L=12，H=0 M=0）。R6 在未变更树上独立复核：20 个 barrel 行数与 R5 逐字节相同；≥400 行集合完全一致（11 文件，全内聚 L/N-A）；复用 C1/C3/D1 grep 证据（分组选择器存在 + 冗余块计数 0；`fetchSimpleListsPage` 单定义 + 双调用方；`replaceTitleTextNodes` 单定义 + 3 调用点）。

R7-8 导演级源码核查（只读，逐文件 import 图 / 函数清单）：14 个 ≥290 行文件全部判定——内聚：vlt-create-list-api.ts(546，唯一边界见下)/ lp-filter.tsx(288)/ db/vlt-db-core.ts(419，零网络/零DOM/零UI = DAO)/ rating-display-plugin.ts(440)/ vlt-tags.ts(421)/ vlt-reconcile.ts(410)/ page-sort-plugin.ts(400)/ osp-preload.tsx(393)；协调器：setting-plugin.tsx(451)/ dpb-list-panel.tsx(428)/ history-plugin.tsx(431，R4 M4 残留已落地)/ detail-page-button-plugin.tsx(414)；facade：storage-manager.ts(415)/ common-util.ts(296，R4 M2 ESC 已落地)。150–375 行带 Round 4 拆分目标 barrel 补查（6 文件）：other-site-plugin.tsx(375)/ auto-page-plugin.ts(304)/ list-waterfall-plugin.ts(279)/ status-tag-filter-plugin.ts(235)/ vlt-filter-bar.ts(311)/ lrs-toolbar.ts(213) 均为协调器或内聚；注——status-tag-filter 顶层不 import `stf-collect`、lrs-toolbar 不 import `lrs-sort` 非残留而是更整洁设计（collect/排序已完全移出 barrel，改由下一级消费者 stf-ui.doBuild / lrs-filter.applySortAndFilter 内部 import），恰是「helper 彻底离开 barrel」的证据。诚实边界：150–300 行带非 Round 4 拆分目标的单插件文件仍为工作级审计判定。

**唯一边界文件 vlt-create-list-api.ts 依赖方向解析**：`restoreCreateListUi`（L530-546，导出）看似应归 `-ui` 模块，但 `finishCreateList`（L496-525，**必须留在 -api**：L510 `refreshListPanel()` + L524 `handleCheckboxChange(...)` 为 IDB 同步）在 L507 调用它；`vlt-create-list-ui.tsx` L11 已 `import { createList, restoreCreateListUi } from './vlt-create-list-api'`——`-ui → -api` 边已存在、`-api` 不 import `-ui`，当前图为 DAG。若移入 `-ui` 会产生 `-api → -ui`，叠加既有边 = **ui↔api 循环**；若连 `finishCreateList` 一起移入则把 IDB 同步拖入 UI 模块 = 内聚退化。故 `{createList, finishCreateList, restoreCreateListUi}` 簇留 `-api`、`-ui` 作纯导入叶子，是无环且保内聚的选择 → 分级 **L/N-A**（非 M）；强行开 wave 只会引入成环风险的无效 churn。

**收敛判定**：原子化维度 R5/R6 工作级 CONVERGED、R7/R8 导演级确认全部 ≥290 行文件内聚/协调/facade、唯一边界按依赖方向解析为 L；复用维度无 ≥15 行同职责跨文件重复、无未采纳的干净采纳候选。**循环在 Round 4 执行后、Round 5–8 复查下达到不动点**。重开条件（精确）：仅当未来变更引入 ① 文件混合 ≥2 个因不同原因变化的独立职责；② ≥15 行、跨 ≥2 文件、同职责且形状干净可合并的重复块；③ 可拆分而不引入 import 循环、不把数据同步拖入 UI 模块的内聚簇。当前字节（dd54bc6）三者均不存在。

### 结果与演进链

提交：e17a3e7（v1.28.17 Wave 3 复用）/ 18ced63（v1.28.18 Wave 4 原子化）/ dd54bc6（v1.28.19 Wave 4 复用）；doc/179 为纯文档提交，不递增版本（保持 1.28.19），后续 §3.1 补查仍纯文档。Wave 间的演进链：storage-manager 162→164→174 三次触及分别完成 seam、any 消除、原子化拆分；vlt-sync 165→172→173→176→177→178 经历规划→三模块→27 行 barrel→广播总线统一→db/server 拆分→simple_lists 共享提取；back-to-top 152→178→179 从重复守卫演进到 CSS 孪生合并 + 逻辑对记录不合并。

## 11. 工程约定汇总（AGENTS.md §9/§10/§11 固化）

本阶段确立的代码风格与工程约定最终固化进 AGENTS.md，成为后续所有编辑的强制规范。各条款的由来与最终形态：

| 条款 | 确立轮次 | 固化文档 | 最终条款 |
|------|----------|----------|----------|
| §9.1 导入顺序 | doc/154（R3）+ doc/155（R4）铺开 | doc/156（§9）+ doc/157（core 闭合） | 六组：外部类型→常量→核心→本地插件→组件→CSS?raw 最后，组间空行；副作用导入（`import './core/libs'`）恒居首位；重排只改行序与分组，绝不增删/改名/改路径 |
| §9.2 日志分层 | doc/155（R4） | doc/156（§9） | clog 仅面板（error 例外同步转发 console.error）；集成脚本跟踪保留 console.* + %c；禁止 clog.info；未来 agent 不得为「表面一致」改回 clog.log/warn |
| §9.3 toast 安全 | doc/154（R3）+ doc/155（R4） | doc/156（§9） | show.error/ok/success 必须传字符串，`e instanceof Error ? e.message : String(e)` 守卫，禁止直传 Error 对象或 `e.message \|\| e` |
| §9.4 z-index 令牌 | doc/153 | doc/156（§9） | `--jhs-z-page: 9999`（页面内）/ `--jhs-z-top: 999999999`（above-layer）；禁止散落 9999/99999999 字面量；image-preview.css 的 `/* __Z_INDEX__ */` 运行时占位符不得替换为 var() |
| §9.5 CSS 类名前缀 | doc/154（R3） | doc/156（§9） | 插件专属类必须加 `jhs-` 或插件专属前缀（如 `jhs-vlt-`）；同一通用名不得在多个注入同一 head 的样式表中冲突重复定义 |
| §9.6 审计方法论 | doc/155（R4） | doc/156（§9） | 禁止静默截断（每维 20 条上限会掩盖真实表面）；完整发现持久化后按发现数装箱为互不相交并行编辑组；审计→执行链路的 console↔clog 转换须先按 §9.2 跟踪例外复核 |
| §9.7 零硬编码 HTML 边界 | doc/167–169 实践 | doc/170（收尾写死） | 四类 triage：违规（字符串字面量被解析进 DOM 且非 sanctioned 常量）/ needle 豁免（.indexOf/.includes/.startsWith/.match/.test 对 DOM 派生文本）/ jQuery `$( '<tag>' )` 元素构造 idiom（createElement 等价，不违规）/ sanctioned 数据常量（dangerouslySetInnerHTML 注入的 SVG/CSS 命名常量） |
| §10 大文件拆分与代码复用 | doc/169 立法 + doc/172–178 执行 | doc/169（§10） | 单文件 800 行硬上限 / 500 行软上限（触及须评估）；单一职责、按职责边界切分；禁止重复实现（新建前 grep 全 src）；组件原子化；拆分验证门禁 6 条（tsc+build / 测试 / DOM 等价 / 无循环导入 / 导入顺序 / check:structure） |
| §11 目录规划 | doc/169 立法 + doc/172 执行 | doc/169（§11） | 单目录直接子文件 ≤20；按插件域/功能层/页面类型划分子目录（kebab-case）；目录变更同步 AGENTS.md |

**机械执行**：doc/169 新增 `scripts/check-structure.ts`（`bun run check:structure`）以棘轮机制机械门禁 §10/§11——FILE_CEILINGS（800 行超限文件）与 DIR_CEILINGS（20 直接子文件超限目录）以精确现状值 seeded，只许下调不许抬高；doc/172 在拆分后移除 4 个 FILE_CEILINGS + src/components DIR_CEILINGS；后续每轮（172–177）均以 check:structure OK 作为门禁记录。审计维度闭合轨迹（doc/154→160）：六维（console→clog / show.error / 导入 / CSS 类名 / z-index / devtools 跟踪）→ 九维（+ 空 catch / ts-ignore / eslint-disable）→ 十二维（+ TODO / 死代码 / 命名）→ 十四维（+ 生命周期 / getBean 引用）。

## 12. 阶段结果轨迹

### 版本轨迹

| 版本 | 文档 | 说明 |
|------|------|------|
| 1.27.8 | doc/152 | package.json 由 1.27.5 同步（元数据） |
| 1.28.2 | doc/156 | 纯文档轮次，未递增 |
| 1.28.3 | doc/158/160/161 | doc/161 把 package.json 从 1.27.8 同步至此（批次 6 元数据修正） |
| 1.28.4 | doc/162 | seam + clog 修正（src 变更） |
| 1.28.5 | doc/164 | 增量 any 消除（src 类型变更） |
| 1.28.6 | doc/165 | @noframes 移除 + feature-flags 收敛 |
| 1.28.7 | doc/166 | 导航栏箭头修复（bug） |
| 1.28.11 | doc/170 | doc/167–170 期间递增，doc/170 最终门禁复核 |
| 1.28.17 / 1.28.18 / 1.28.19 | doc/179 | Wave 3 复用 / Wave 4 原子化 / Wave 4 复用（提交 e17a3e7 / 18ced63 / dd54bc6） |

### 产物大小

| 文档 | 大小（kB / gzip kB） | 变化 |
|------|---------------------|------|
| doc/149 | 2,022.45 / 466.86 | 起点 |
| doc/151 | 2,023.36 / 467.05 | +0.49（escapeAttr + sanitizeUrl） |
| doc/153 | 2,023.49 / 467.15 | −0.10（CSS 变量引用更短） |
| doc/154 | 2,024.89 / 467.29 | 一致性修复 |
| doc/155–160 | 2,024.66 / 467.32 | 稳定（156–160 纯文档/non-UI 轮次） |
| doc/166 | 2,024.95 / 467.45 | 占位符修复 |
| doc/177 | 2,397.65 / 612.19 | 原子化后 +20 kB（新模块代码量，gzip +6） |

### 测试

21（doc/161）→ 26（doc/162）→ **28**（doc/163）→ 28/28 贯穿 doc/164–178。套件：jsx-to-string（XSS）/ backup-crypto（AES-GCM）/ storage-migration（迁移，7 用例，jsdom 环境 + FakeForage）。

### 组件与文件数

- 组件：91→97（doc/167）→101（doc/168）→ +~25（doc/169，15 文件 LOW 全清）→ 25 子目录、直接文件 0（doc/172）→ Wave 合并删 16 个（doc/174）+ 2 个（doc/175）。
- 文件/目录：261/39（doc/172）→ 281/41（doc/174）→ 294/46（doc/175）→ 295/46（doc/176）→ 331/53（doc/177）。
- 大文件：5 个超限文件拆分（doc/172）→ 18 个超 400 行文件拆解（doc/177）→ 收敛后 ≥400 行集合 11 文件全内聚（doc/179 R6 复核）。

### ESLint 警告

806→805（doc/149）→ 805（doc/150–163）→ 786（doc/164，−19）→ 783→764（doc/169，api.ts 收窄 −19）→ 123 基线（doc/174）→ 74（doc/175，−49）→ 60（doc/176）→ 59（doc/177）。注：doc/170–173 各轮验证记录未给出 warn 数，764→123 的下降未在本阶段逐轮归因（Wave 1 报告基线 123）。

### 遗留问题清单

1. **805/786 个 `no-explicit-any` 警告主体**：需补 `@types/jquery`/`@types/tabulator-tables`/`@types/layui-layer` 类型声明（doc/165 已核实 devDependencies 缺失），big-bang 消除属多会话 backlog；doc/164 确立「触及即消除」增量推进。
2. **storage-manager 残留 any ≈ 21 行**（forage 字段、getSetting/saveSetting、接口索引签名、三项 backlog 方法）。
3. **registerDiagnosticsMenu 菜单重复 nit**（iframe 内可能登记第二个「插件诊断」菜单项，doc/165 记录未修，建议 `if (window.self !== window.top) return;` 守卫）。
4. **`--jhs-color-text-muted: #999` 定义未使用**（doc/165，latent 不追）。
5. **CI 尚未接入 `bun run test` 发布门禁**（doc/161/162 后续验证建议）。
6. **C2 back-to-top 逻辑对记录不合并**（doc/178/179，避免后续审计重复标记）。
7. **原子化循环重开条件**（doc/179 §7 三条精确条件，当前字节 dd54bc6 上均不存在）。