# 阶段 09：CSS/复用收敛、XSS 加固与跨站同步协议单线化（doc/180—199）

> **文档类型**：📋 阶段档案（合并文档）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/180 — doc/199 共 20 份历史文档
> **合并说明**：本文件由 doc/ 目录 20 份历史文档按时间线整合而成。删除过程性细节（构建命令输出、逐条验证步骤回放、产物大小记录、边缘情况穷举），保留背景/根因、方案与关键决策、实施要点、结果、演进链与遗留问题。原文细节与数字以各 doc/NN 为准，本文不新增原文未含的事实。文中 "doc/NN" 为历史事件标识。
> **替代文档**：doc/180—199 共 20 份（合并后原文件删除）
> **前置文档**：doc/149—179（阶段 08）
> **生效版本**：v1.30.4（阶段末）

## 阶段概览

本阶段前半段延续阶段 08 的收敛与治理工作：CSS 跨文件复用（180）、pageTypes 门控误伤两次修复（181—182）、codex-dev 分支安全加固提取（183—185）与 @noframes 回归回退（186）。后半段是项目唯一一条长线程——跨站车号状态同步协议：doc/187 以 feature flag 引入基于「单调修订号 + 增量 journal + 门控 + 对账 + 回滚」的 P3 协议，随后经 188（IDB 版本冲突）→189（增量形状路由）→190（徽章冻结）→191（诊断菜单）→192（消费侧健壮性）→193（iframe 回调未注册）连续修复，至 doc/194 删除 flag 与全部旧路径单线化（v1.29.0），doc/195 提取 `src/core/sync/` 共享基础设施（withExclusiveLock / KeyedQueue / intent journal）并修复 pushDelta 竞态（v1.30.0）。阶段末尾完成 ESLint 警告清零（196）与网络层三处修复（197—199），阶段末版本 v1.30.4。

### 时间线索引

| doc | 主题 | 版本 | 归属章节 |
|-----|------|------|---------|
| 180 | CSS 筛选芯片共享基础（filter-chip-base.css） | 较 v1.28.19 产物略减 | §1.1 |
| 181 | 修复 /users/lists 页面插件被跳过 | — | §1.2 |
| 182 | pageTypes 系统性审计（演员页/访问记录） | — | §1.3 |
| 183 | codex-dev 提取 Phase 1（P0-C 超时 + P0-J noframes + 安全函数导出） | v1.28.23（P0-J 引入） | §2.1 |
| 184 | codex-dev 提取 Phase 2（XSS/URL/沙箱加固） | v1.28.24（K 项） | §2.2 |
| 185 | review-item 评论正文 XSS（safeReviewNodes） | — | §2.3 |
| 186 | 回退 @noframes（iframe 视频详情页回归） | 回退自 v1.28.23 的 P0-J | §2.4 |
| 187 | 跨站同步协议升级（feature flag 默认关） | v1.28.28 flag-ON 一致性修正 | §3.1/3.2 |
| 188 | MissAV IDB 版本冲突（统一 openLocalDB） | 1.28.29 | §3.3 |
| 189 | 增量按载荷形状路由（deltaRoute） | 1.28.29→1.28.30 | §4.1 |
| 190 | MissAV 徽章状态冻结（renderBadges 重建） | 1.28.30→1.28.31 | §4.2 |
| 191 | 跨站同步诊断菜单命令 | 1.28.31→1.28.32 | §4.3 |
| 192 | 消费侧健壮性（journal 共享模块/强制重同步/22 用例） | 1.28.32→1.28.33 | §4.4 |
| 193 | iframe 详情页增量回调未注册 | 1.28.33→1.28.34 | §4.5 |
| 194 | 统一协议删除双路径（净减 ~488 行） | 1.28.34→1.29.0 | §5.1 |
| 195 | 共享基础设施 src/core/sync/ + pushDelta 竞态 | 1.29.0→1.30.0 | §5.2 |
| 196 | ESLint 警告清零（764→0） | — | §6.1 |
| 197 | gmRequest 重定向检测误判（finalUrl 可选 + 缺 return） | 1.30.1→1.30.2 | §6.2 |
| 198 | osp-preload doPreloadSite 三处 bug | — | §6.3 |
| 199 | 外站探测请求伪装浏览器导航头 | 1.30.3→1.30.4 | §6.4 |

## 1. CSS 复用收敛与 pageTypes 门控修复（180—182）

### 1.1 CSS 筛选芯片共享基础提取（doc/180）

**背景/根因**：Round 4 的 TS/TSX 复用扫描以函数签名 / try-catch 形状为锚点，未系统比较 CSS 规则块。导演级 CSS 全文件审查发现 `status-tag-filter-plugin.css` / `video-lists-tag.css` / `preload-status-badge.css` 三文件的筛选栏+芯片基础样式（bar/label/chips/chip/hover）逐字节相同（~30 声明 × 3 文件），仅类名前缀与 active 配色不同。这是先前扫描方法论的覆盖缺口（TS/TSX 锚点未覆盖 CSS-to-CSS 跨文件重复），非收敛逻辑本身的失败。

**方案与决策**：新建 `src/styles/filter-chip-base.css`，以分组选择器统一 5 个共享规则块；各插件 CSS 仅保留 active 配色与 no-tag/pf-dot 变体。`main.tsx` 顶层 injectCss 注入（design-tokens 之后、accessibility 之前）。

**零偏差处理**：stf/vlt 原始芯片为 `display: inline-block`（纯文本内容），preload 为 `inline-flex; align-items: center`（含 `.pf-dot` 子元素）。共享基础采用 `inline-block`（匹配 stf/vlt 原始值），preload 自有 CSS 覆盖为 `inline-flex`（initCss 后注入的级联顺序胜出），三插件渲染与原始逐字节一致。

**实施要点**：`filter-chip-base.css` 新建（+66）；`status-tag-filter-plugin.css` 68→25、`video-lists-tag.css` 474→431、`preload-status-badge.css` 184→144；`main.tsx` +2 行；`scripts/check-structure.ts` 的 src/styles 文件数上限 37→38。

**结果**：tsc 0 错 / vitest 28/28 / eslint 0 错（59 warn）/ stylelint 干净 / check:structure OK；产物 2395.39 kB（gzip 611.52 kB），较 v1.28.19 略减（CSS 去重）。

### 1.2 修复 /users/lists 页面插件被跳过（doc/181）

**背景/根因**：用户报告 /users/lists 页面「我的清单」功能全部失效（清单删除/改名不同步、阅读进度工具栏不显示、清单标签不渲染）。根因：commit 5b4f447（v1.28.15，Wave 1）为 PluginManager 添加 `matchesPage()` 门控后，`VideoListsTagPlugin` 和 `ListReadingStatusPlugin` 声明 `pageTypes: ['detail', 'list']`，但 /users/lists 页面的 `pageContext.pageType` 解析为 `'unknown'`（无 `/v/`、无 `.movie-list`、无 `advanced_search`），两插件被**静默跳过**——`handle()` 从未执行。此 bug 非 v1.28.18–v1.28.20 的原子化/复用 wave 引入。

**方案与决策**：移除两插件的 `pageTypes` getter 覆写（及其 `import type { PageType }`），继承默认 `[]`（匹配所有页面）。两插件 `handle()` 内部已有健壮的路径守卫（`isDetailPage` / `/users/lists` / `isListPage` 早返回），与 `ListWaterfallPlugin` 和 `ModMyListOpenWayPlugin`（无 pageTypes 覆写、在 /users/lists 上正常工作）模式一致。

**实施要点**：`vlt-plugin.ts`、`list-reading-status-plugin.ts` 各删 `get pageTypes()` + `import type { PageType }`。

### 1.3 pageTypes 系统性交叉审计（doc/182）

**背景/根因**：doc/181 修复后，对全部声明 pageTypes 的插件做系统性交叉审计，发现另外两个插件存在同类 bug（根因同 doc/181：matchesPage() 门控与 handle() 内部路径守卫不一致）。

**方案与决策（修复表）**：

| 插件 | 原 pageTypes | 问题 | 修复 |
|------|-------------|------|------|
| FavoriteActressesPlugin | ['detail'] | bindEvent() 绑定 /actors/xxx 页面的收藏/取消收藏按钮，但演员页 pageType 为 'list' 或 'unknown'，导致按钮失效 | 移除 pageTypes 覆写 |
| VisitHistoryPlugin | ['detail'] | recordVisit() 应记录所有 javdb 页面访问，pageTypes 限制导致非详情页访问不被记录 | 移除 pageTypes 覆写；内部 `if(window.isDetailPage)` 已限定 tooltip 注入 |

**实施要点**：`favorite-actresses-plugin.tsx`、`visit-history-plugin.ts` 各删 `get pageTypes()` + `import type { PageType }`。

**演进链**：doc/181 修复单点 → doc/182 扩展到全量审计（同根因、同修法，两轮同为 pageTypes 门控误伤）。

## 2. codex-dev 提取与安全加固（183—186）

### 2.1 Phase 1：P0 修复 + 安全函数导出（doc/183）

**背景**：基于 codex-dev 分支交叉审计，按优先级提取 P0 + P1 前置改动。

- **P0-C 详情页清单面板超时保护**：`ensureListPanel` 以 400ms 间隔无限递归等待 `#otherSiteBox`，OtherSite 插件未启用时永久卡住。修复：添加 `DETAIL_DOM_WAIT_TIMEOUT_MS = 15_000` 常量，超时后回退挂载到 nav 末尾 + `clog.warn` 日志。文件：`dpb-list-panel.tsx`。
- **P0-J @noframes 用户脚本头**：脚本可在 iframe 内执行，扩大攻击面。修复：vite.config.ts 添加 `noframes: true`。**（后被 doc/186 回退）**
- **P1 前置 导出安全函数**：`escapeText`/`escapeAttr`/`sanitizeUrl` 为 jsx-to-string 内部函数，插件无法调用。修复：添加 `export` 关键字，使插件可直接进行 URL 校验和 HTML 转义。文件：`jsx-to-string.ts`。

### 2.2 Phase 2：XSS / URL / 沙箱加固（doc/184）

**背景**：codex-dev 提取 Phase 2，落地 P1/P2 安全加固项。

- **E1 日志 XSS 中和**：`logger.tsx` 的 `addLog` 不再内嵌链接化 HTML，`entry.message` 始终保存原始文本，URL 链接化推迟到渲染期。`logger-log-entry.tsx` 以 `linkifySafe` 将消息切分为文本段与 URL 段：文本段作为普通 JSX 子节点（`jsxToString` 自动转义 `&`/`<`/`>`，XSS 在此被中和），URL 段经 `sanitizeUrl` 净化后渲染为 `<a target="_blank" rel="noopener noreferrer">`。彻底消除 `dangerouslySetInnerHTML`。公共 API 签名不变（60+ 调用点零改动）；localStorage 持久化格式不变；§9.2 console 分层不变。
- **E2 tooltip innerHTML → textContent**：全量 grep 确认所有 `data-tip` 来源均为纯文本（静态串/数字插值/关键词/演员名），`tooltip.ts` 改 `textContent`。
- **F 出站链接 / URL 加固**：消灭 `javascript:` 注入——`missav-renderer.ts` 用 `sanitizeUrl` 校验，缺失/非法时 `removeAttribute('href')` 使其不可导航；`section-error-message.tsx` 删除硬编码 `href='javascript:;'`（重试由外部 jQuery 按 id 绑定，href 仅装饰）。`encodeURIComponent`：`api.ts` 的 movieId 路径与查询，以及 `fc2`/`history`/`nav-bar`/`screenshot` 的查询值。`noopener,noreferrer`：`fc2`/`history`/`nav-bar`/`screenshot`/`list-page-button`/`lp-dom` 的 `window.open`。
- **K unsafeWindow 收敛**：`main.tsx` 将 `utils`/`loadGfriends`/`filetreeDb`/`loading`/`show`/`clog` 的 `unsafeWindow` 写入收敛到沙箱 `window`（其中 `utils`/`loadGfriends`/`filetreeDb` 原为冗余赋值，直接删除该行；`loading`/`show`/`clog` 改链式赋值目标）。grep 确认 src 无 `unsafeWindow.<name>` 读取；保留 `unsafeWindow.parent.clog` 的父框架读取；grant 列表保留 `unsafeWindow`。

**延后项（doc/184 明确延后，后分别由 doc/185 与 doc/187 落地）**：
- review-item.tsx 评论正文（JavDB API 非可信 HTML）的 `dangerouslySetInnerHTML` 消除：正确实现需 `DOMParser` 遍历（保留 text/`<a>`/`<br>`、剥离其余标签）；直接复用 `linkifySafe` 会把 `<br>`/`<b>` 转义为字面文本导致排版错乱。该 XSS 面为**既有**状态而非本次引入。`stars` 为调用方生成的可信 `<i>` 标记，保留原注入安全。
- **P3 跨站同步协议**（Web Lock 跨标签互斥 + 增量 journal 压缩 + 条件回滚 + MissAV IDB v2 + 批量对账，替换 `replaceLocalCars` 的 `objectStore.clear()`）：改动量最大（约 1200 行，跨 6 个 car-status-sync 文件）且为数据完整性核心，因 good 模型配额耗尽延后。

### 2.3 review-item 评论正文 XSS 加固（doc/185）

**背景**：doc/184 延后的 review-item 评论正文 XSS。`content` 来自 JavDB API（不可信 HTML），原以 `dangerouslySetInnerHTML` 原始注入；同文件 `stars` 为可信 `<i class="icon-star">` 标记，安全，维持原 raw 注入。

**方案与决策**：新增纯函数 `safeReviewNodes(html)`——`DOMParser` 解析后递归遍历 `body.childNodes`：

- 文本节点 → 字符串子节点（jsxToString 转义 `&`/`<`/`>`）
- `<a>` → href 经 `sanitizeUrl`，强制 `target="_blank" rel="noopener noreferrer"`，保留 class/style
- `<br>` → `<br />`
- 白名单内联标签（b/i/em/strong/p/span）→ 保留标签，仅复制 class/style（`parseInlineStyle` 解析内联 style 为 React style 对象），剥离其余属性（含 on 事件属性）
- 其余标签（script/iframe/img/svg 等）→ 剥离标签、保留子节点

`parseInlineStyle` 仅做字符串切分 + kebab→camel，无 eval/正则回溯，try/catch 兜底。安全论证：仅复制 class/style 两类属性；on 事件属性、非 a 元素的 href/src/action 等永不复制，事件向量无法注入；style 在 evergreen 浏览器中不可执行 `javascript:`，与加固前行为等价。

**首版回归修正**：首版 safeReviewNodes 剥离全部属性且未白名单 SPAN，导致 ReviewLinkContent 生成的可信样式丢失（ed2k 高亮 `<span>` 被解包、magnet/http 的 `<a class="a-primary">` 失去 a-primary 外观）。本版白名单加入 SPAN 并在保留标签上复制 class/style，恢复保真度。

**结果**：`dangerouslySetInnerHTML` 仅余 stars 一处（可信）。

### 2.4 回退 @noframes（doc/186）

**背景**：v1.28.23 的 P0-J（doc/183）依 codex-dev 安全加固在 vite.config.ts 加入 `noframes: true`（禁止脚本在任何 iframe 内运行）。但本项目「视频流」功能在 iframe 内打开视频详情页，且 iframe 内详情页**需要本脚本运行**（注入增强功能）；@noframes 使脚本在 iframe 内完全不加载，导致视频流打开的 iframe 视频详情页失效（回归）。

**安全权衡**：codex-dev 加 @noframes 的意图是缩小攻击面。但本脚本的 `@match` 已把执行范围限定在 javdb.com / missav.ws / missav.live 等源，页面内匹配这些源的第三方 iframe 极少；@noframes 的边际安全收益不足以抵消破坏视频流功能，故回退。

**附注**：v1.28.24 的 K（unsafeWindow→window 收敛，doc/184）保留了 iframe 内继承父窗口 `clog` 的逻辑（`window.clog = unsafeWindow.parent.clog`）；该逻辑在 @noframes 下为死代码，回退后重新按预期生效——iframe 内复用父页日志面板。

**演进链**：doc/183 引入 @noframes → doc/186 回退（渲染回归）；doc/184 延后项 → doc/185（review-item）与 doc/187（P3 协议）落地。

## 3. 跨站同步协议：flag 引入与基础设施（187—188）

### 3.1 协议升级（feature flag 默认关）（doc/187）

**背景**：codex-dev P3——跨站车号状态同步协议升级，替换 `replaceLocalCars` 的 `objectStore.clear()`（全量擦除，写入中途失败即丢数据）。改动前 master 仅有 doc/138 的基础 revision 门控。全部实现位于 `featureFlags.crossSiteSyncProtocol` 之后，**默认关**。

**方案与决策（按模块）**：

| 模块 | 新增能力 |
|------|---------|
| car-status-db | withSyncRevision / withLocalSyncLock（navigator.locks 跨标签互斥）/ 批量对账（先 upsert 校验条数、再删多余、失败恢复快照，替换 clear()）/ getCarListSnapshot / normalizeLocalRecord / normalizeJavdbUrlPath。IDB 请求版本 = flag ? 2 : 1；sync_meta 仅在升级到 v2 时创建，flag 关时 DB 维持 v1、不迁移 |
| car-list-reader-plugin | 单调修订号（GM_KEY_CAR_STATUS_REVISION）+ 增量 journal（按 carNum 去重 + 500 上限 + gzip 全量收敛）+ fullResyncRequested 补发 |
| missav-status-tag-plugin | 消费队列串行化（enqueueConsume + lock）+ 修订号门控（canApplyRevision，旧载荷不复活已删记录）+ 全量后补消费保留的增量 journal |
| car-status-columnar | 严格列存校验（validateColumnarSnapshot / parseColumnarImport / normalizeUrl：HTTPS + javdb.com 主机） |
| car-status-config | 新增类型与常量 |

**不变量**：flag 关（默认）时运行行为与改动前**逐字节一致**——未修改任何既有函数体，新协议仅经 `if (featureFlags.crossSiteSyncProtocol)` 在调用点分支，else 分支调用原函数原参数。

**启用与风险**：默认关闭；启用方式为控制台 `localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ crossSiteSyncProtocol: true }))` 后刷新。**启用前必须跨标签页实测**（javdb 改状态 → missav 实时/全量同步、关标签/刷新不丢、并发标签不互相覆盖），本环境无法做用户脚本跨标签实测；flag 关路径已由 tsc/vitest 覆盖，flag 开路径需人工实测。

### 3.2 flag-ON 一致性修正（v1.28.28）

- handle() 页面加载全量同步在 flag 开时改走 `syncFullCarStatusFlagged`（修订号保护发布 + 裁剪增量日志），与 pushDelta/consume* 门控一致。
- 菜单命令「🔁 全量同步车辆状态到 missav」回调在 flag 开时同样改走 `syncFullCarStatusFlagged`，避免手动全量同步在 flag-ON 下用无 revision 的旧载荷覆盖新快照、毒化修订号序导致后续增量被误判过期。
- flag 关两条路径均走原 `syncFullCarStatus`，逐字节不变；flag 关字节等价不变量保持。

### 3.3 MissAV IDB 版本冲突（doc/188）

**背景/根因**：P3 移植（doc/187）引入两个 IndexedDB opener 打开同名 DB（`MISSAV_DB_NAME`）：`openLocalDB()` 硬编码 version 1（仅 `cars` 仓库），`openLocalDBFlagged()` 打开 `MISSAV_DB_VERSION`（2，`cars` + `sync_meta`）。flag 开启时 flagged 消费路径（`applyFullFlagged` → `replaceLocalCars` → `upsertLocalCarsFlagged` → `openLocalDBFlagged()`）将 DB 升级到 v2，此后任何旧 CRUD 函数（`upsertLocalCars` / `queryLocalCars` / `deleteLocalCars` 等）经 `openLocalDB()` 以 v1 打开，触发 "The requested version (1) is less than the existing version (2)."——flag-ON 全量同步写入 60k 记录后 `processAll()` → `queryLocalCars()` 崩溃，MissAV 页面标签不渲染；同理 `applyDeltaFlagged` 调用 v1 的 `upsertLocalCars`/`deleteLocalCars` 也在 v2 升级后崩溃。

**方案与决策**：统一为单一 opener `openLocalDB()`（`MISSAV_DB_VERSION` 2），`onupgradeneeded` 含 `sync_meta` 创建守卫（`oldVersion < MISSAV_DB_VERSION && !contains`）；删除 `openLocalDBFlagged`（22 行），9 处调用替换为 `openLocalDB()`。

**结果/影响**：flag-OFF 首次运行 post-update 时 DB 从 v1→v2 升级（创建空 `sync_meta` 仓库），旧 CRUD 仅读写 `cars`、不触及 `sync_meta`，用户可见行为零变化；flag-ON 所有路径统一 v2 opener，不再版本冲突。版本 1.28.29。

**演进链**：doc/187 双 opener 引入 → doc/188 统一（为 doc/189 的 flag-OFF 走 journal 路径提供 sync_meta 前提）。

## 4. 跨站同步消费侧修复链（189—193）

### 4.1 增量按载荷形状路由（doc/189）

**背景/根因**：与 doc/188 独立的第二个跨站同步 bug——「发布端 javdb 开 flag、消费端 missav 没开」时**静默丢数据**（不报错、标签不变、无「增量更新」日志）。机制：发布端 `pushDelta()` 在 flag ON 时走 `appendDeltaJournal`，把 `GM_KEY_CAR_STATUS_DELTA` 写成**数组 journal**；flag OFF 时写成**单对象** `{action,items,ts}`。消费端增量监听器原本按**消费端自己**的 flag 选解析器——ON 走 `consumeDeltaJournal`（兼容数组 + 单对象），OFF 走 `consumeDelta`（只认单对象 `.action`）；数组传入时 `delta.action === undefined`，upsert/delete 两分支都不进，直接掉到 `processAll()`，**不写库、不报错** = 静默丢弃。flag 存 `localStorage['jhs_upgrade_flags']`（按域名隔离），GM 存储跨域共享，flag 默认 false，故 javdb=ON / missav=OFF 必触发；反向（javdb=OFF / missav=ON）安全，因 `readDeltaJournal` 会把单对象包成数组。全量路径 `consumeFull` 只读 `data/count/hwm`，两种全量格式都含这些字段，形状兼容，无需改。

**方案与决策**：让消费端**按载荷形状路由**而非按本地 flag，使任意 flag 组合都不静默丢；flag 对称时行为逐字节不变（零偏差硬要求）：

1. 增量监听器 dispatch：`Array.isArray(newValue)` → 无条件 `consumeDeltaJournal`；否则（单对象）维持原逻辑（本地 flag ON→journal，OFF→legacy）。
2. 初始化兜底：flag OFF 分支原本只 `consumeFull` 不读 journal；补一条——若 `GM_getValue(GM_KEY_CAR_STATUS_DELTA)` 是数组，也 `consumeDeltaJournal` 一次（否则 javdb=ON 只发增量时，missav=OFF 初始化也丢）。
3. 可测试 seam：形状路由判定抽成纯函数 `deltaRoute(newValue, localFlagOn)`，监听器与初始化共用。

**可行性核实**（改前 read 确认）：`consumeDeltaJournal` → `applyDeltaFlagged` → `withSyncRevision` → `upsertLocalCars`/`deleteLocalCars` 全链路**无** featureFlags 守卫，flag-OFF 走得通；`sync_meta` 因 doc/188 统一 opener 在 v2 升级时无条件创建，journal 路径不崩；修订号门控正常生效（`lastAppliedRevision` 初值 -1）。

**deltaRoute 边界语义**：数组（含空数组）→ `'journal'`（空数组经 `readDeltaJournal([])` 过滤为 `[]`，消费器空转无副作用）；单对象 → 按本地 flag（ON→journal，OFF→legacy）；null/undefined/字符串 → 按本地 flag（监听器 newValue 真值守卫与初始化 Array.isArray 判定下不会收到，判 legacy 与修复前逐字节一致）。

**结果**：新增 `car-status-delta-route.ts` + `tests/delta-route.test.ts`（8 用例），vitest 28→36/36；版本 1.28.29→1.28.30。未改 featureFlags 默认值、javdb 发布侧与 `openLocalDB`。

**flag 组合影响矩阵**：

| 组合 | 路由结果 | 行为 |
|------|---------|------|
| 双 OFF | `deltaRoute(单对象, false) = 'legacy'` → consumeDelta | 逐字节不变（旧路径） |
| 双 ON | `deltaRoute(数组, true) = 'journal'` → consumeDeltaJournal | 逐字节不变（旧路径） |
| javdb=ON / missav=OFF（**修复点**） | 数组增量改走 consumeDeltaJournal | 正常 upsert/delete + processAll，不再静默丢；初始化也补消费数组 |
| javdb=OFF / missav=ON | `deltaRoute(单对象, true) = 'journal'` | 原本安全，行为不变 |

### 4.2 MissAV 徽章状态冻结（doc/190）

**背景/根因**：`renderBadges()`（missav-renderer.ts）对已挂载 `.missav-status-tag` 徽章的缩略图直接 `continue`（`if (item.querySelector('.missav-status-tag')) continue;`），不检查状态是否变更。跨站同步后 `processAll()` 在同一页面再次调用时，IDB 已正确更新、`queryLocalCars` 也返回新状态，但徽章被跳过，永远冻结在初始状态。原始脚本（archetype/missavStatusTag.user.js）有同样的 skip 逻辑但无跨站同步——徽章只在页面加载时创建一次，skip 无害；本项目新增的跨站同步（doc/46）使 `processAll()` 在页面生命周期内被多次调用（增量消费/全量消费/MutationObserver），skip 与多次渲染冲突。

**方案与决策**：`createBadge()` 在 `<a>` 元素上写入 `a.dataset.status = status`（`data-status` 属性不可见，不影响 DOM 外观）。`renderBadges()` 的 skip 逻辑改为：先查番号 → 归一化 → 查 carMap 得 record（无 record 则 continue，与原行为一致）；已有徽章时 `existing.dataset.status === record.status` → continue，否则 `existing.remove()` 走正常 createBadge + appendChild 重建；无已有徽章 → 正常创建。`total++` 移至 skip 判定之后（状态未变的项不计入 total，与原语义一致；状态变更项计入）。

**与原始脚本的偏差说明**：本修复改变 renderBadges 对已有徽章的行为（原无条件跳过 → 新状态变更时替换），不违反零偏差原则——原始脚本场景（页面加载单次调用 + MutationObserver 仅处理新增缩略图）从未触发"状态变更后再次渲染"，本修复是让本项目新增的跨站同步功能正确工作。

**结果**：仅改 `missav-renderer.ts`；版本 1.28.30→1.28.31。

### 4.3 跨站同步诊断菜单（doc/191）

**背景**：跨站同步涉及 GM 存储、IndexedDB、修订号、增量 journal 等多个状态源，出问题时难以快速定位。新增 Tampermonkey 菜单命令，一键转储全部同步状态到控制台 + 剪贴板，方便用户反馈和开发者排查。

**方案与决策**：
- javdb 端「🔍 诊断：跨站同步发布侧」：site / version / flag / gmRevision / carListRev / syncedRev / journal（长度 + 最近 5 条摘要）/ fullSnapshot。
- missav 端「🔍 诊断：跨站同步消费侧」：site / version / flag / gmRevision / journal（最近 3 条）/ fullSnapshot / idb（syncMeta 修订号元数据 / carCount / MGT-140 抽样记录）/ inMemory（lastAppliedRevision / lastAppliedKind 页面实例水位线）。
- 基础设施：`globals.d.ts` 新增 `GM_info` 类型声明；vite.config.ts grant 列表新增 `GM_info`。

**约束**：纯只读诊断，不修改同步逻辑；菜单注册 try/catch；clipboard 写入失败静默降级（仅控制台输出）；show.ok 提示操作完成。版本 1.28.31→1.28.32。**（doc/193 的诊断输出随后成为定位 iframe 回调未注册的关键证据）**

### 4.4 消费侧健壮性加固（doc/192）

**背景**：用户在 javdb 把 MGT-140 从「已读」改为「收藏」后，missav 页面（含刷新后）徽章不更新。前序 doc/188（IDB 版本）、doc/189（增量形状路由）、doc/190（徽章冻结）已修复三个独立 bug，但问题仍在。对整条链路（javdb saveCar → carListChangeCallback → pushDelta → journal 写 GM → missav consume → withSyncRevision → IDB → processAll → renderBadges）穷举式源码追踪，**结论**：所有代码路径在 flag-ON/flag-ON 场景下逻辑正确。最可能的失败原因是用户浏览器仍运行旧构建（未含 doc/188-190 修复），或 IDB 修订号水位线因旧版本残留/时钟异常被污染，导致合法增量被 `canApplyRevision` 静默拒绝且**无任何恢复手段**。

**方案与决策（5 项）**：

1. **提取共享增量日志解析模块 `car-status-journal.ts`**：两插件底部各有 4-6 个**逐字节相同**的私有函数（`readDeltaJournal`/`sortDeltaJournal`/`isDeltaPayload`/`getPayloadRevision`/`compactDeltaJournal`/`countDeltaItems`），提取后两端改为 import（`payloadRevision` 统一为 `getPayloadRevision`），函数签名和逻辑零变更，仅 move + rename + re-export。
2. **missav 端「🔄 强制重新同步（清除水位线）」菜单**：清 IDB `sync_meta` 已应用修订号水位线 + 重置内存 `lastAppliedRevision = -1` + 重新消费 GM 全量快照与增量 journal + 刷新页面标签——给用户一键恢复手段，无需手动清 IDB 或重装脚本。
3. **页面加载消费验证（步骤 4.5）**：handle() 步骤 4（消费 GM 存储）之后、步骤 5（observeAndProcess）之前，读 `GM_KEY_CAR_STATUS_REVISION`；若 GM 修订号 > IDB 水位线，说明初始化消费被门控拒绝了合法条目，自动补消费一次 journal。
4. **视频页选择器兜底**：`processVideoPage` 的两个精确 CSS 选择器（`body > div:nth-child(3) > ...`）极度脆弱，missav 改版即失效；新增两个选择器均未命中时回退 `document.body` 全页扫描。
5. **集成测试 `tests/car-status-consume.test.ts`（22 用例）**：readDeltaJournal（数组/单对象/null/undefined/混合过滤）、sortDeltaJournal（revision 升序 + 稳定）、isDeltaPayload（合法 upsert/delete、缺字段、空 items、非法 status）、getPayloadRevision（revision/ts 回退/缺失）、端到端（模拟 javdb 写入 → missav 读取解析）。

**结果**：版本 1.28.32→1.28.33。验证：diagnostics 0 errors / 0 warnings；build/test 因终端超时未完成，需用户手动运行确认 22 新用例 + 既有用例全绿。

### 4.5 iframe 详情页增量回调未注册（doc/193）

**背景**：用户仍报告同一症状（javdb 详情页改状态 → missav 徽章不更新）。前序 doc/188/189/190/192 修复了四个独立问题，但问题仍在。**诊断数据（用户提供）**：`journal.length: 0`（增量 journal 为空，标记收藏时 delta 从未写入）、`carListRev: 0`（GM_KEY_CAR_LIST_REV 从未递增，pushDeltaFlagged 从未成功执行）、`fullSnapshot.ready` 缺失（快照由旧版非 flag 路径发布）。

**根因**：javdb 详情页通过 **layui 弹窗 iframe** 打开，`CarListReaderPlugin.handle()` 首行 `if (window.self !== window.top) return;` 在 iframe 中直接返回，导致 `storageManager.setCarListChangeCallback(...)` **从未执行**。用户在 iframe 中点击收藏时：`favoriteOne()` → `storageManager.saveCar(...)` → 触发 `sm.carListChangeCallback?.({ action: 'upsert', upserts: [car] })`，但 iframe 中的 callback 是 `undefined` → `undefined?.()` **静默跳过**，不报错、不推送、不递增 carListRev。全量同步也永不重跑（carListRev=0, syncedRev=0 → needsSync=false），missav 永远只能拿到首次加载时的旧快照。

**方案与决策**：将 `setCarListChangeCallback` 调用移到 iframe 守卫**之前**（增量回调必须在所有帧、含 layui 详情页 iframe 内注册）。每个帧有独立 `storageManager` 实例（Tampermonkey 每帧独立执行脚本），callback 注册互不干扰；iframe 中 saveCar → callback → pushDelta → journal → missav 消费。菜单命令、全量同步、诊断菜单仍限制在 top frame（避免多 iframe 重复注册）。

**结果**：版本 1.28.33→1.28.34。build/test 因终端超时未完成。

**演进链（189—193 修复链）**：doc/188（IDB 版本）→ doc/189（形状路由）→ doc/190（徽章冻结）→ doc/192（消费侧健壮性）→ doc/193（iframe 回调）——同一用户症状（MGT-140 状态不更新）连续五次根因定位，每步均为独立缺陷，最终由诊断菜单（doc/191）提供定位证据。

## 5. 统一协议与共享基础设施（194—195）

### 5.1 统一协议：删除双路径、单线化（doc/194）

**背景**：自 doc/187 引入 `crossSiteSyncProtocol` flag 后，所有核心函数都存在 flagged / non-flagged 两个版本，共计 **10 处 flag 分支、6 对重复函数、~350 行冗余代码**。flag 默认关闭，但实际生产环境用户已手动开启（两侧 `localStorage.jhs_upgrade_flags.crossSiteSyncProtocol = true`），旧路径成为死代码。本次重构**删除 flag 和全部旧路径**，让 P3 协议（修订号 journal + 门控 + 对账 + 回滚）成为唯一实现；同时删除为 flag 不对称设计的补丁模块 `car-status-delta-route.ts`（doc/189）并清理死常量。

**方案与决策**：

| 层 | 操作 |
|----|------|
| feature-flags.ts | 从 interface 和默认值删除 `crossSiteSyncProtocol`；localStorage 残留键由 `Object.assign` 复制到对象上但无代码读取，无害 |
| javdb 发布端（car-list-reader-plugin） | 删旧 `syncFullCarStatus()`（~65 行无条件覆盖写）、旧 `pushDelta()` 路径体（~38 行单对象覆盖写）、`isFullSyncing` 旧锁变量；重命名 `syncFullCarStatusFlagged`/`pushDeltaFlagged`/`isFullSyncingFlagged` → 基础名；删 3 处 flag 分支（菜单命令/增量推送入口/页面加载全量同步）与诊断 `flag` 字段 |
| missav 消费端（missav-status-tag-plugin） | 删旧 `consumeDelta()`（~26 行无门控直写）、旧 `consumeFull()`（~48 行 `isFullConsuming` 布尔锁 + 只 upsert 不删）、`isFullConsuming`；重命名 `consumeFullFlagged`/`applyDeltaFlagged`/`applyFullFlagged` → 基础名；删 5 处 flag 分支；简化增量监听器（删 `deltaRoute` 路由，所有增量无条件走 `consumeDeltaJournal`）；删诊断 `flag` 字段 |
| IDB 层（car-status-db） | 删旧 `upsertLocalCars()`（~41 行无 normalizeLocalRecord 校验）、旧 `importLocalDB()` 路径（~46 行 clear()+put）、`buildJavdbUrlLocal()`（~7 行，与 car-status-columnar 的 `buildJavdbUrl` 完全重复）；重命名 `upsertLocalCarsFlagged`/`importLocalDBFlagged` → 基础名；删 1 处 flag 分支 |
| 删除模块 | `car-status-delta-route.ts`（43 行）+ `tests/delta-route.test.ts`（~80）——统一后所有增量恒走 journal，legacy 路由永不触发 |
| 清理 | `car-status-config.ts` 删死常量 `GM_KEY_LAST_SYNC_TS`（全 src/ 无引用）+ ⚑ 注释；`car-status-columnar.ts` 清 flag 门控注释块 |

**统一后的协议（唯一路径）**：

- **增量路径**：`saveCar → callback → pushDelta → nextRevision()（Web Lock + 单调修订号）→ appendDeltaJournal()（读→追加→排序→压缩→写 GM）→ 超 256 项去重、超 500 项改发全量`
- **全量路径**：`needsSync → syncFullCarStatus → nextRevision() → 读 car_list → 列存 → gzip → publishSnapshot（修订号保护 + journal 裁剪）`
- **消费-增量**：`GM_addValueChangeListener(DELTA) → consumeDeltaJournal → readDeltaJournal → sortDeltaJournal → enqueueConsume(applyDelta) → isDeltaPayload 校验 → shouldApply（内存门控）→ withSyncRevision（Web Lock + IDB 门控 + 回滚）→ upsertLocalCars（normalizeLocalRecord 校验）→ markApplied → processAll`
- **消费-全量**：`GM_addValueChangeListener(DATA) → consumeFull → validateColumnarSnapshot 严格校验 → shouldApply → withSyncRevision → replaceLocalCars（对账：写新+删旧+回滚）→ markApplied → processAll`
- **页面加载初始化**：`consumeFull(undefined) + consumeDeltaJournal(journal) + 消费验证（GM revision > IDB 水位线 → 补消费）`

**结果**：净减 **~488 行**；10 处 flag 分支 → 0；6 对重复函数 → 6 个唯一实现；1 个冗余模块删除。版本 1.28.34→**1.29.0**（minor 递增）。

**兼容性**：GM DELTA 统一后恒为数组，`readDeltaJournal` 兼容单对象（包成 `[value]`），旧版 javdb 写的单对象仍能被新版 missav 消费——**滚动升级安全**；IDB 已统一 v2 无破坏性变更；localStorage 残留键无害；备份：`car_list`（源数据）在 WebDav 备份中，GM 同步键和 missav IDB 为可再生缓存/传输层，无需备份（换浏览器后 needsSync=true 自动重建）。验证：全项目 diagnostics 0 errors；grep 确认 `featureFlags`/`Flagged`/`deltaRoute` 在 car-status-sync 与 src/tests 中 **0 残留**；build/test 因终端超时未完成。

### 5.2 共享基础设施 + 消费侧增强 + pushDelta 竞态修复（doc/195）

**背景**：doc/194 单线化后 car-status-sync 链路仍存在四类优化点：

1. **重复基础设施**：Web Locks 排他锁包装有 3 处近乎相同的实现（`withPublisherLock` / `withLocalSyncLock` / vlt-lock-queue 的 `withAssociationLock`）；键控串行队列有 2 处重复（`enqueueConsume` / `enqueueAssociationTask`）。
2. **消费侧无崩溃恢复**：missav 端「已接收但未完成消费」的载荷若在 IDB 写入中途崩溃/中断，下次加载无从知晓，只能等下一次实时通知或每日兜底全量。
3. **全量读取无一致性校验**：`applyFull` 读 GM 全量快照时 javdb 端可能正在写入，理论上会读到混合数据。
4. **pushDelta 竞态**：详情页收藏/已看/屏蔽触发 `saveCar` 后，异步增量推送可能被紧随的 `utils.closePage()` 中断，导致 GM 写入丢失。

**方案与决策**：

- **任务 1 共享基础设施 `src/core/sync/`**：`sync-lock.ts` 的 `withExclusiveLock(lockName, task)`（Web Locks 统一包装，`navigator.locks` 不可用时降级直接执行）；`sync-queue.ts` 的 `KeyedQueue`（同 key 串行、异 key 并发，前一任务失败不阻塞后续，队列尾自清理防泄漏）；`sync-intent-journal.ts` 意图日志 `writeIntent`/`clearIntent`/`readPendingIntents`/`cleanStaleIntents`（借鉴 VLT pending journal，键 `jhs:car-sync-intent:{revision}`）；`index.ts` 统一出口。`KeyedQueue.enqueue` 采用「队列尾 Promise + resolveTail」实现，规避「每次 `.then` 创建新 Promise 导致自清理比较恒不等」的 bug：队列尾 `tail` 是稳定引用，任务结算后 `resolveTail()`，`tail.then` 中比较 `queues.get(key) === tail` 成立才删除 Map 项。
- **任务 2 迁移 car-status 到共享基础设施**：car-list-reader 删模块级 `withPublisherLock` + `NavigatorWithOptionalLocks`，3 处调用（`nextRevision`/`appendDeltaJournal`/`publishSnapshot`）改 `withExclusiveLock(JAVDB_SYNC_LOCK_NAME, task)`；car-status-db 同（2 处：`withSyncRevision`/`importLocalDB` → `MISSAV_SYNC_LOCK_NAME`）；missav-status-tag 删 `consumeQueue` 属性与 `enqueueConsume` 方法，改 `new KeyedQueue()`，2 处调用 `enqueue('consume', task)`。
- **任务 3a 意图日志（消费侧崩溃恢复）**：`applyDelta`/`applyFull` 在 `shouldApply` 门控通过后 `writeIntent(revision, kind)`；消费成功（含门控拒绝的幂等路径）后 `clearIntent`；catch 分支不清理（下次加载恢复）。handle() 步骤 4.5（消费验证）之后新增 **4.6 意图日志恢复**：`readPendingIntents()` 升序遍历，delta 类型重新 `consumeDeltaJournal`（幂等，门控防重复应用），full 类型仅清理（步骤 4 已 consumeFull）；最后 `cleanStaleIntents()`（默认 24h 过期）。
- **任务 3b 双读一致性（applyFull）**：读 GM 全量快照后，若为非监听器路径（`!payload`），间隔 50ms 复读一次，比较 `revision ?? ts`；不一致时 logWarn 并采用第二次读取结果，防止读取期间 javdb 正在写入导致混合数据。
- **任务 4 pushDelta 竞态修复**：car-list-reader 新增 `private pendingPush: Promise<void>` 跟踪当前推送；原 `pushDelta`（异步、内含 try/catch）重命名为 `pushDeltaAsync`（去内部 try/catch，错误上抛）；新 `pushDelta(event): void` 为 fire-and-forget 入口（`this.pendingPush = this.pushDeltaAsync(event).catch(logErr)`）；新增 `waitForPendingPush()`。`detail-page-button-plugin.tsx` 的 `favoriteOne`/`hasWatchOne`/`filterOne`（filterOne 在 `utils.q` 回调内部）在 `saveCar` 之后、`closePage` 之前 `getBean('CarListReaderPlugin')` 并 `await clr.waitForPendingPush()`，避免 closePage 中断异步 GM 写入。

**结果**：版本 1.29.0→**1.30.0**。**锁名不变**（`JAVDB_SYNC_LOCK_NAME='jhs-javdb-car-status-publisher'`、`MISSAV_SYNC_LOCK_NAME='jhs-missav-car-status-sync'`），跨标签互斥行为不变；GM 存储格式不变；意图日志为**新增 localStorage 键**（`jhs:car-sync-intent:*`），不影响既有数据，24h 自动清理无泄漏；**VLT 未动**（`vlt-lock-queue.ts` 的 `withAssociationLock`/`enqueueAssociationTask` 保持原样，由后续任务迁移）；`pushDelta` 签名由 async `Promise<void>` 变为同步 `void`（唯一调用方 `setCarListChangeCallback` 忽略返回值，无影响）。验证：全项目 diagnostics 0 errors；grep 确认 `withPublisherLock`/`withLocalSyncLock`/`enqueueConsume`/`NavigatorWithOptionalLocks` 0 残留；build/test 因终端工具不可用未运行。

## 6. ESLint 清理与网络修复（196—199）

### 6.1 ESLint 警告清零（doc/196）

**背景**：项目 ESLint 基线为 0 errors / 764 warnings，本次将全部警告清零以提升工程质量。

**修改分类（12 类）**：第三方库 `any` ~25（globals.d.ts / shim，文件级 `eslint-disable no-explicit-any`）；`import()` 类型注解 6（行内 disable）；`no-useless-assignment` 死初始值 8（`let x = init` → `let x: Type`）；空 `catch {}` 5（补 `/* ignore */`）；`preserve-caught-error` 5（行内 disable + 原因注释，ES2020 限制）；未使用 eslint-disable 指令 2（移正或删除）；表达式语句 3（`void expr` 或改 if/const）；无用 try/catch 1（删包装）；`hasOwnProperty` 直接调用 1（改 `Object.prototype.hasOwnProperty.call()`）；仅类型导入 1（改 `import type`）；未使用类型参数 1（`T` → `_T`）；冗余 ignores 模式 1（eslint.config.js 删 `*.config.*`）。

**结果**：20 个文件修改（globals.d.ts / jquery-shim / layui-layer-shim / main.tsx / logger.tsx / gm-http.ts / storage-manager / car-list-ops / image-preview / util-sort / history-plugin / dpb-want-watched / dpb-subtitle / actress-info / history-tabulator / lrs-sort / lp-filter / dmm-resolver / vlt-list-mgmt / vlt-create-list-api + eslint.config.js）；diagnostics 全项目 **No errors or warnings found**；所有修改为纯 lint 层面，**零业务逻辑变更**。

### 6.2 修复 gmRequest 重定向检测误判（doc/197）

**背景/根因**：`gm-http.ts` 的 `gmRequest` 在 onload 回调中做重定向检测，原实现存在两个缺陷：

1. **`finalUrl` 为可选字段，缺失时恒判为重定向**：`GmResponse.finalUrl` 声明为可选，某些 Tampermonkey 版本/浏览器组合在响应中**不提供** `finalUrl`；`response.finalUrl !== requestUrl` 在 `undefined` 时退化为 `undefined !== requestUrl` **恒为 true**，所有携带 `followRedirect: true` 的请求即便未发生重定向也被 `reject('请求被重定向了...')`，功能全面失效。
2. **`reject()` 后缺 `return`**：执行流继续进入状态码判断分支，虽因 Promise 已 settle 结果不受影响，但逻辑不干净。

**方案与决策**：重定向条件增加 `finalUrl` 存在性检查（`response.finalUrl && response.finalUrl !== requestUrl`），`reject()` 后补 `return`。行为变化：finalUrl 存在且偏离 → 仍拒绝；存在且相等 → 不拒绝进入状态码判断；**缺失 → 跳过检测**（有意的宽松化：宁可漏检重定向，也不因字段缺失拒绝正常请求）。

**结果**：版本 1.30.1→1.30.2；tsc -b + vite build 通过。

### 6.3 修复 osp-preload doPreloadSite 三处 bug（doc/198）

**背景**：`osp-preload.tsx` 的 `doPreloadSite` 存在三处与原始脚本 / `probeSite`（osp-probe.tsx）行为不一致的 bug：

1. **href 解析失败静默跳过**：`if (!href) return;` 将解析异常伪装成「未命中」，原始脚本和 `probeSite` 均为 `throw new Error('解析href失败')`。
2. **登录页检测过于宽泛**：`bodyText.includes('登录')` 会匹配搜索结果页导航栏的「登录」按钮文本，导致正常搜索结果被误判为登录页；原始脚本 `handleSite` 完全没有登录页检测，`probeSite` 使用表单选择器 + 正则匹配 title/全文。
3. **catch 块缺少「重定向」错误分类**：只区分 Cloudflare（Just a moment / 403）和其他错误，缺少 `probeSite` 的「重定向」（域名失效）分支。

**方案与决策**：href 解析失败改 throw（对齐 probeSite，进入 catch 被正确记录）；登录检测收窄为 `<title>` 正则（`/登录|登陆|登入|sign\s*in|log\s*in/i`）+ 登录表单（`form[action*="login"]`/`form[action*="signin"]`、`input[type="password"]`）+ 保留 `bodyText.includes('登入你的帳戶')` 与 `'註冊一個新帳戶'`（missav 登录页特征文本，不会出现在搜索结果页）；catch 块在 Cloudflare 分支之后、通用错误分支之前增加 `errorMsg.includes('重定向')` → 输出「域名失效（被重定向）」，对齐 probeSite 三段式错误分类。

**结果**：`npx tsc -b --noEmit` 通过；`bun run build` 成功。

### 6.4 外站探测请求伪装浏览器导航头（doc/199）

**背景**：列表页预加载（`doPreloadSite`）和详情页探测（`probeSite`）通过 `GM_xmlhttpRequest` 向 missav.ws 等站点发起搜索请求时 Cloudflare 返回 403。根因：`GM_xmlhttpRequest` 从 javdb.com 跨域请求时不携带 `Sec-Fetch-*`、`Referer`、`Accept-Language` 等浏览器导航头，Cloudflare Bot Management 将这类「裸」请求判定为机器人；浏览器地址栏直接打开正常（自动携带完整导航头）。此外 `cf_clearance` Cookie 通常 `SameSite=Lax`，跨域请求不携带，进一步加剧拦截。

**方案与决策**：新增 `buildBrowserNavHeaders(baseUrl)` 共享纯函数（`osp-helpers.ts`），生成与浏览器地址栏直接访问一致的请求头：

| 请求头 | 值 | 作用 |
|--------|-----|------|
| `Accept` | `text/html,application/xhtml+xml,...` | 标准 HTML 文档 Accept |
| `Accept-Language` | `zh-CN,zh;q=0.9,en;q=0.8` | 中文语言偏好 |
| `Referer` | `<origin>/` | 模拟站点内部导航来源 |
| `Sec-Fetch-Dest` | `document` | 请求目标为文档 |
| `Sec-Fetch-Mode` | `navigate` | 导航模式 |
| `Sec-Fetch-Site` | `same-origin` | **关键**：声称同站请求 |
| `Sec-Fetch-User` | `?1` | 用户触发导航 |
| `Upgrade-Insecure-Requests` | `1` | HTTPS 升级 |

`doPreloadSite` 和 `probeSite` 的 `gmHttp.get` 调用改为合并 `buildBrowserNavHeaders(baseUrl)` + `siteConfig.headers`（后者优先覆盖）。

**局限性**：若 Cloudflare 校验 TLS 指纹 / JS Challenge / `cf_clearance` Cookie 的 SameSite 限制，仅靠请求头无法完全绕过；为「最佳努力」优化，不保证对所有防护等级有效；仍被拦截时建议用户在设置中切换策略更宽松的镜像站（如 missav.live）。

**结果**：版本 1.30.3→1.30.4；tsc 0 errors；浏览器实测待用户确认。

## 7. 演进链与遗留问题汇总

### 演进链（主要线索）

| 线索 | 路径 |
|------|------|
| CSS 复用收敛 | doc/180（filter-chip-base.css 分组选择器，Round 4 覆盖缺口） |
| pageTypes 门控修复 | doc/181（/users/lists 两插件）→ doc/182（系统性审计：演员页/访问记录） |
| codex-dev 提取 | doc/183（Phase 1：P0-C 超时 + P0-J noframes + 安全函数导出）→ doc/184（Phase 2：XSS/URL/沙箱）→ doc/185（延后项 review-item XSS 落地）→ doc/186（回退 P0-J @noframes，iframe 回归） |
| **跨站同步协议（主线）** | doc/187（flag 引入 P3 协议：修订号 journal + 门控 + 对账 + 回滚）→ doc/188（双 opener IDB 版本冲突统一）→ doc/189（增量形状路由，flag 不对称静默丢）→ doc/190（徽章冻结）→ doc/191（诊断菜单，为定位提供证据）→ doc/192（消费侧健壮性：journal 共享模块/强制重同步/消费验证/选择器兜底）→ doc/193（iframe 回调未注册，诊断数据定位）→ doc/194（删双路径单线化，net −488 行）→ doc/195（共享基础设施 withExclusiveLock/KeyedQueue/intent journal + pushDelta 竞态） |
| 工程质量 | doc/196（ESLint 764→0）→ doc/197（gmRequest finalUrl 可选）→ doc/198（osp-preload 三 bug）→ doc/199（Cloudflare 导航头伪装） |

### 最终架构要点（跨站同步协议，doc/194+195 收敛后）

- **发布侧**：`saveCar → callback → pushDelta`（fire-and-forget + `waitForPendingPush` 防 closePage 竞态）→ `nextRevision()`（Web Lock + 单调修订号）→ `appendDeltaJournal()`（数组 journal，256 项去重 / 500 项改全量）→ 全量路径含 `publishSnapshot`（修订号保护 + journal 裁剪）。
- **消费侧**：`GM_addValueChangeListener`（DELTA/DATA）→ 严格校验（`isDeltaPayload` / `validateColumnarSnapshot`）→ `shouldApply`（内存门控）+ `withSyncRevision`（Web Lock + IDB 门控 + 回滚）→ 增量 `upsertLocalCars`（normalizeLocalRecord）/ 全量 `replaceLocalCars`（对账：写新 + 删旧 + 失败恢复快照）→ `markApplied` → `processAll`。
- **崩溃恢复**：意图日志 `jhs:car-sync-intent:{revision}`（write/clear/read/clean，24h 过期）+ 页面加载 4.5 消费验证 + 4.6 意图恢复（delta 重消费、full 仅清理）。
- **共享基础设施**：`src/core/sync/` 的 `withExclusiveLock`（Web Locks 统一包装 + 降级）、`KeyedQueue`（键控串行 + 尾自清理）、`sync-intent-journal`（意图日志）。
- **容错手段**：强制重新同步菜单（清水位线）+ 双侧诊断菜单（GM/IDB/水位线/journal 转储）。

### 遗留问题

- **跨标签页实测未完成**：doc/187 flag-ON 路径、doc/195 竞态修复与意图恢复均需跨标签页人工实测（本环境无法做用户脚本跨标签验证）。
- **构建/测试未在本环境完成**：doc/192/193/194/195 的 `bun run build` / `bun run test` 因终端超时或工具不可用未能运行，需用户手动执行确认（doc/192 提示确认 22 新用例 + 既有用例全绿）。
- **VLT 未迁移共享基础设施**：`vlt-lock-queue.ts` 的 `withAssociationLock`/`enqueueAssociationTask` 保持原样，由后续任务迁移（doc/195）。
- **共享模块可测性**：`KeyedQueue` / 意图日志纯函数未补单元测试，可后续补充（doc/195）。
- **Cloudflare 绕过为最佳努力**：TLS 指纹 / JS Challenge / `cf_clearance` SameSite 限制下仅靠请求头无法完全绕过（doc/199）。
- **重定向检测有意的宽松化**：`finalUrl` 缺失时跳过重定向检测，可能漏检真实重定向（doc/197）。
- **@noframes 放弃**：脚本仍在匹配源的 iframe（视频流详情页）内执行，接受该攻击面（doc/186 权衡）。
- **GM 同步键与 missav IDB 无备份**：属可再生缓存/传输层，换浏览器后 `needsSync=true` 自动重建（doc/194）。