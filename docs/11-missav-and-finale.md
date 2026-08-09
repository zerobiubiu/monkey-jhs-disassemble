# 阶段 11：MissAV 专区功能、评价同步与依赖升级收尾（doc/218—242）

> **文档类型**：📄 参考说明（历史文档融合）
> **文档状态**：✅ 已执行（融合）
> **阶段范围**：doc/218 — doc/242（25 份历史文档）
> **合并说明**：本文件由 doc/ 目录 25 份历史文档按时间线整合而成。删除过程性细节（构建命令输出、逐条验证步骤回放、边缘情况穷举推演、重复的产物大小记录），保留背景/根因、方案与关键决策、实施要点（模块或文件级）、结果（version 变化、测试数、产物大小、关键机制）、演进链与遗留问题。原文细节与数字以各 doc/NN 为准，本文不新增原文未含的事实；文中 "doc/NN" 为历史事件标识。
> **替代文档**：doc/218—242 共 25 份（合并后原文件删除）
> **前置文档**：doc/217 之前的历史阶段文档

## 阶段概览

本阶段是 MissAV 站点功能的密集建设期：先补 missav.ai 域名支持与状态标签首屏渲染提速（218—219），随后以 Camoufox 真实浏览器实测为证据链完成瀑布流（220—221）、状态筛选器（222—225）、视频页按钮布局（226—227）、视频流 iframe 详情弹窗（228—233）等 MissAV 专区功能；紧接着是 javdb 侧的评价/收藏/清单自动校验同步（234—235）与瀑布流 Cloudflare 403 修复（236），再以「对齐原始脚本」为原则回退 MissAV 请求头并删除登录守卫（237—238）；收尾阶段反转第三方库打包方式（打包 → CDN @require 外部引入，产物 -47%）并完成工具链与运行时依赖升级（239—242）。全程 11 个版本（1.40.0 → 1.46.2），测试套件从 132 增至 183 用例，验证手段以 Camoufox（反检测 Firefox）实测 + subagent 审查回环为主。

### 时间线索引

| doc | 主题 | 归属章节 |
|-----|------|---------|
| 218 | missav.ai 域名支持 | §1.1 |
| 219 | 状态标签首屏渲染提速（渲染与消费解耦） | §1.2 |
| 220 | MissAV 列表页瀑布流（滚动触底） | §2.1 |
| 221 | 瀑布流改 click 模式 + 封面 data-src→src 修复 | §2.2 |
| 222 | MissAV 状态标签筛选器 | §3.1 |
| 223 | 筛选 UI 暗色化 + 网格 cell 级显隐 | §3.2 |
| 224 | 「加载全部」按钮左下角 + 暗色化 | §3.3 |
| 225 | 瀑布流 loader 类名前缀修复 + tests 语言服务归属 | §3.4 |
| 226 | 视频页自定义按钮独立分组（后被 227 回退） | §4.1 |
| 227 | 按钮回原生工具栏 + isVideoDetailPath 守卫 + 去分割线 | §4.2 |
| 228 | 视频流 iframe 详情弹窗（初版） | §5.1 |
| 229 | 弹窗宽度最大化 900→1023px | §5.2 |
| 230 | 弹窗高度铺满 100% | §5.2 |
| 231 | 弹窗覆盖列表页顶部条（z-index 极限） | §5.3 |
| 232 | 二级弹窗覆盖 iframe 文档顶部条（移除守卫） | §5.3 |
| 233 | 弹窗去除过渡动画 | §5.4 |
| 234 | 评价/收藏/清单与 JavDB 状态自动校验同步 | §6.1 |
| 235 | 评价状态冲突选择弹窗 | §6.2 |
| 236 | javdb 瀑布流 Cloudflare 403（同源页面 fetch） | §7 |
| 237 | 回退 MissAV 请求头为原始脚本方式 | §8.1 |
| 238 | 删除 MissAV 搜索页登录保护判断 | §8.2 |
| 239 | 第三方库打包 → CDN @require 外部引入 | §9.1 |
| 240 | 工具链依赖升级（typescript 7 尝试回退） | §9.2 |
| 241 | tabulator-tables 6.5.2 + viewerjs 1.11.8 升级 | §9.3 |
| 242 | jquery 3.7.1 → 4.0.0 升级 | §9.4 |

## 1. MissAV 站点基础（218—219）

### 1.1 missav.ai 域名支持（doc/218）

**背景**：用户要求 MissAV 站点新增 `missav.ai` 域名支持，与 `missav.ws` 完全一致（即脚本在 missav.ai 上正常运行 missav 专属插件：状态标签 + 快速复制）。

**方案与决策**：MissAV 站点识别与执行范围由两处控制，两处同步新增 `ai`：

| 控制点 | 文件 | 变更 |
|--------|------|------|
| 站点判定 | `src/constants/site.ts` | `isMissavSite` 正则 `/missav\.(ws|live|com)/` → `/missav\.(ws|live|com|ai)/`，控制 `main.tsx` 的 `if (isMissavSite)` 块注册 MissavStatusTagPlugin / MissavQuickCopyPlugin，以及 `page-context.ts` 的 site 判定 |
| 脚本执行范围 | `vite.config.ts` | `userscript.match` 增加 `https://missav.ai/*`，否则 Tampermonkey 不会在该域名注入脚本 |

**无需其他改动的理由**：missav 两个插件（`missav-quick-copy-plugin.tsx` / `car-status-sync/`）均无对该站域名的网络请求（跨站同步走 GM 存储，零网络请求），`@connect` 无需新增（且 connect 已含 `'*'` 通配）；插件内无硬编码 missav 域名，handle() 内按 pathname/DOM 选择器守卫，与域名无关。

**结果**：version 1.40.0 → 1.40.1（小改动，patch）；产物 2,179.57 kB；README「支持站点」表 MissAV 行同步增加 `missav.ai`。

**验证摘要**：`tsc -b` 与 `vite build` 均通过；产物头部 `@version 1.40.1` 与 `@match https://missav.ai/*` 已核对（lightningcss 警告为 layer.css 已知无害项）；无独立前端，missav.ai 实站功能待用户更新脚本后验证。

**遗留问题**：需用户在 Tampermonkey 重新安装/更新脚本后，在 missav.ai 页面实测状态标签与快速复制功能（本环境无法打开真实站点验证）。

### 1.2 状态标签首屏渲染提速（doc/219）

#### 背景与问题定位

用户反馈：missav 页面有时等很久才出现状态标签（已收藏/已观看/已屏蔽/已下载）。根因分析（上一条会话，已核实代码）确认五条成因：

1. **渲染被消费阻塞（主因）**：`MissavStatusTagPlugin.handle()` 的启动序列中，`observeAndProcess()`（渲染入口）是**倒数第二步**，而它前面 `await consumeFull(undefined)` → `await consumeDeltaJournal(...)` → 消费验证 → 意图恢复全是**串行 await**。首屏标签出现时间 = 全量消费耗时 + 增量消费耗时 + 初始延迟，而不是「页面就绪」；
2. **全量消费耗时**：600KB gzip 解压 + 5.5 万条 `replaceLocalCars`（3000/批 ≈ 19 个 IDB 事务）+ 全库游标对账，慢机器 1~3s；
3. **增量逐条串行 + 每条全页重扫**：`consumeDeltaJournal` 对 journal 逐条 `applyDelta`，每条独立「Web Lock + 读水位线 + 读回滚快照 + IDB 事务」，且每条末尾都 `processAll()` 全页扫描一次。积压 256 条时增量消费 1~2s、全页重扫 256 次；
4. **渲染初始延迟 1.5s**：`observeAndProcess()` 内 `setTimeout(tryProcess, 1500)`——即使消费秒完成，标签也要等 1.5s 才首次尝试；
5. **`renderBadges` 强制同步布局**：对每个命中项调 `window.getComputedStyle(thumbDiv)` 判断定位，批量触发 reflow。

#### 目标与不变量

**目标**：首屏标签在页面 DOM 就绪后立即渲染（用 IDB 已有数据），消费完成后刷新为最新数据；增量积压时避免逐条全页重扫。

**不变量（与消费语义相关，不得破坏）**：修订号门控不变（`shouldApply` / `withSyncRevision` 的拒绝旧/重复逻辑不动）；消费顺序不变（全量先于增量、增量按修订号升序）；幂等重放不变（任何载荷可重复消费，结果一致）；崩溃恢复不变（意图日志 `writeIntent`/`clearIntent` 时序不被破坏）；零网络请求、零新增依赖、不引入新 GM 键。

#### 方案总览（任务分解）

| 任务 | 改动 | 风险 | 收益 |
|------|------|------|------|
| Task 1 | 渲染与消费解耦：`observeAndProcess()` 提前到消费之前 + 首次尝试由 1.5s 定时改为立即执行 | 低 | 首屏标签不再等全量/增量消费 |
| Task 2 | 增量消费合并页面刷新：`processAll` 从逐条移到批处理后 | 低 | 消除 256 次重复全页扫描 |
| Task 3 | `renderBadges` 消除 `getComputedStyle` 强制同步布局 | 低 | 批量渲染 reflow 消除 |

Task 4（真正批量事务合并）**不纳入本期**：收益需在 Task 1-3 落地后实测评估，且改动会触及 `withSyncRevision` 单条语义，风险/复杂度不成比例（YAGNI）。

#### 实施要点

**Task 1（`missav-status-tag-plugin.ts`）**：把 `observeAndProcess()` 移到消费之前（handle 启动序列由「注册监听 → consumeFull → consumeDeltaJournal → 消费验证 → 意图恢复 → observeAndProcess」改为先启动渲染、再消费，消费完成后由 applyFull/applyDelta 末尾的 `processAll` 刷新）；`setTimeout(tryProcess, 1500)` 改为立即 `tryProcess()`——`tryProcess` 内部逻辑不变（`.thumbnail.group` 存在 → processAll；否则 retries++ 后 500ms 重试，上限 30 次），删除 1.5s 初始延迟后重试链自动兜底。

**Task 2（`consumeDeltaJournal` / `applyDelta`）**：`applyDelta` **不再在末尾调用 `this.processAll()`**（已核实仅被 `consumeDeltaJournal` 调用，无其他调用点）；`consumeDeltaJournal` 在批量消费完成后统一刷新一次页面（`journal.length > 0` 时 `processAll()`）。所有调用点（handle 初始化 / GM 监听回调 / 强制重同步 / 意图恢复）均走此统一刷新，无遗漏。

**Task 3（`missav-renderer.ts` renderBadges）**：`if (window.getComputedStyle(thumbDiv).position === 'static')` 改为无条件 `thumbDiv.style.position = 'relative'`（幂等，对已是 relative/absolute 的元素重复设置无副作用，行为等价）。

#### 评估与风险

- **Task 1 提前渲染用旧数据**：消费期间页面显示上次 IDB 数据，消费完成后 `applyFull`/`applyDelta` 末尾的 `processAll()` 刷新——最终一致，可接受；
- **Task 1 期间并发读**：`processAll` 的 `queryLocalCars`（readonly 事务）与 `replaceLocalCars`（readwrite）并发——IDB 快照隔离，不同事务无死锁；
- **Task 2 刷新时机**：若某条 `applyDelta` 失败（被 catch），批处理末尾的 `processAll` 仍执行——用已应用部分渲染，失败条目下次重试，符合幂等语义；
- **不变量**：修订号门控、消费顺序、意图日志、GM 键均不变。

#### 结果与遗留

**结果**：执行方式为 subagent-driven development（3 个任务各派发独立 subagent + 逐任务审查，全部 Approved）；version 1.40.1 → 1.40.2（patch，性能优化）；测试 132/132 全绿；构建/lint（0 errors）/结构门禁（358 files, 58 dirs within limits）全绿。静态验证覆盖 `consumeDeltaJournal` 全部 5 个调用点均走统一刷新，无刷新点丢失；实时链路监听注册位置未动、修订号门控/意图日志/Web Lock/GM 键均未变更，javdb 修改标签后 missav 仍实时更新。

**验证判据（浏览器实测待用户，3 项）**：①首屏标签在 DOM 就绪后立即出现（不再等全量/增量消费）；②javdb 连续操作 20+ 条后切 missav，控制台「渲染标签」日志从「每条一次」降为「每次消费一次」；③缩略图标签定位仍为右上角、无样式回归。

**遗留问题**：①missav 页面浏览器实测未执行（无真实站点环境），需人工确认三点——首屏标签在 DOM 就绪后立即出现、增量消费日志从「每条一次」降为「每次消费一次」、缩略图标签定位仍为右上角无样式回归；②强制重同步菜单路径存在既有双重刷新（consumeDeltaJournal 后显式 processAll，Task 2 前已有），非本次回归，未处理。

**后续可扩展（不纳入本期）**：真正批量事务合并（一次锁内合并 journal 全部 items + 一条水位线，需先提取纯函数到 `car-status-journal.ts` 以复用测试基建）；`queryLocalCars` 逐番号 get → 游标批量匹配（页面缩略图 20-100 个时收益有限，暂不做）；全量消费双读固定 50ms 延迟（一致性收益 > 50ms 成本，不动）。

**演进链**：动因产生于 doc/218 会话对标签延迟的分析；本插件渲染的 `.missav-status-tag` 成为后续 doc/222 状态筛选器的数据源。

## 2. MissAV 瀑布流演进（220—221）

### 2.1 列表页瀑布流初版（doc/220）

#### 背景与需求

用户希望 missav 列表页支持瀑布流式加载（滚动触底自动加载下一页），替代手工点击分页。

#### Camoufox 实测证据（已验证事实）

用 Camoufox（反检测 Firefox，经 `uv run --with camoufox` 驱动）绕过 Cloudflare 访问 missav 实测：

| 探测项 | 实测结果 | 结论 |
|--------|----------|------|
| 页面可达 | `https://missav.ws/cn/new` → 200，JS challenge 自动通过 | Cloudflare 可绕 |
| 原生无限滚动 | 滚动到底 6 次，`.thumbnail.group` 恒为 12 | **无原生瀑布流**，需求有真实价值 |
| 分页机制 | 「下一页」链接 `?page=2`，数字链接连到 page=10+，每页 12 项 | 服务端渲染分页 `?page=N` |
| 英文站 | 分页按钮文本 `Next`（中文站 `下一页`） | 选择器需双语兼容 |
| 搜索页 | `/search/<番号>` 无分页链接（结果少） | 无分页链接时瀑布流自然停止 |
| 同源 fetch 抓 `?page=2` | **200**，117~146KB HTML，DOMParser 解析出完整 12 项，首项番号与翻页一致，内含 `?page=3` 链接 | **GM_xmlhttpRequest 抓 HTML 方案成立**（带 cookie 不被 Cloudflare 拦） |
| 域名重定向 | `missav.ws` → `missav.ws/dm539/cn/new`（随机前缀负载均衡） | 抓页 URL 必须用**当前 origin**（含随机前缀），直接复用页面里的 next 链接 |
| 列表容器 | `.thumbnail.group` 的网格父容器 `div.grid.grid-cols-2.md:grid-cols-3.xl:grid-cols-4.gap-5` | 追加目标明确 |
| 番号提取 | `a[alt]` + 现有 `normalizeCarNum()`（`missav-renderer.ts` 已 export） | 零新增 |

#### 与现有插件的协同

- **MissavStatusTagPlugin**：`observeAndProcess()` 的 MutationObserver 已监听 `.thumbnail.group` 动态出现并自动挂状态标签——瀑布流 append 的新缩略图**自动被覆盖**，渲染层零改动；
- **MissavQuickCopyPlugin**：只操作播放页工具栏，列表页无交集。

#### 方案与决策（架构与模块拆分）

复用 AutoPagePlugin / ListWaterfallPlugin 已验证的模式：**滚动触底 → 抓下一页 HTML → DOMParser 解析 → 提取缩略图 → 去重追加 → 更新下一页链接**。

`src/plugins/missav-auto-page/` 子目录（参考 auto-page/ 先例）：

| 文件 | 职责 |
|------|------|
| `map-selectors.ts` | 选择器常量 + 纯函数（`findNextUrl` / `extractThumbs` / `collectCarNums`） |
| `map-fetch.ts` | `fetchNextPage`：GM_xmlhttpRequest 抓取 + DOMParser 解析 + 去重 + 追加 |
| `missav-auto-page-plugin.ts` | 插件主类：容器定位、滚动监听、状态机、TaskSupervisor 生命周期、loader 状态条 |

纯函数接口：`findNextUrl(doc): string | null`——找文本为 `下一页`/`Next` 的 `a[href*='page=']` 链接，返回绝对 href，无则 null；`extractThumbs(container): HTMLElement[]`——提取 `.thumbnail.group` 元素数组；`collectCarNums(thumbs): string[]`——从 `a[alt]` 提取番号并 `normalizeCarNum` 归一化。

#### 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 容器选择器 | `div.grid.grid-cols-2.md\:grid-cols-3.xl\:grid-cols-4.gap-5` | 实测精确；降级用 `.thumbnail.group` 的父链 |
| 下一页链接 | 页内 `a[href*='page=']` 中文本 `下一页`/`Next` 的链接 | 双语兼容；实测存在；href 为绝对 URL（含随机前缀） |
| 抓取方式 | `GM_xmlhttpRequest`（带 cookie） | 与同源 fetch 等价，实测 200 不被拦 |
| 去重 | 维护已加载番号 Set（normalizeCarNum 后），新页首项已存在即停止 | 参考 lw-fetch loadedIds |
| 状态管理 | 复用 `PaginationStateMachine`（core/pagination-state.ts） | AutoPagePlugin 同款，canLoad/loadSuccess/loadError 语义现成 |
| 生命周期 | `TaskSupervisor` | 项目统一约定 |
| 每页 12 项 | 滚动预加载距离 800px（比 javdb 500px 大，12 项页高较短） | 减少频繁抓取 |
| 搜索页 | 无分页链接 → nextUrl=null → hasMore=false，自然停止 | 实测无需特判 |
| 设置项 | 本期不做（默认开启） | YAGNI，用户未要求开关 |
| 状态条 | `.jhs-map-loader` 元素（加载中/到底了/错误重试），CSS 内联于 initCss | 参考 auto-page loader |

#### 实施要点与审查回环

- 主类 handle()：容器定位（`MAP_SEL.grid`，降级父链）→ 无容器返回 → 注入 loader → `nextUrl = findNextUrl(document)` + `pagination.init` + 预填 `loadedCarNums`（当前页）→ 滚动监听（800px 触底检测）→ loader click 错误重试；
- `fetchNextPage` 核心：`pagination.canLoad` + `nextUrl` 存在才执行；`gmGet` 抓 HTML → DOMParser → `extractThumbs`（空则抛错）→ 去重判定（首项番号已存在 → 置 nextUrl=null、`loadSuccess(false)`、loader「已经到底了」）→ append 到容器 → `findNextUrl` 更新 nextUrl → `pagination.loadSuccess(!!next)`；失败走 `clog.error` + `loadError()` + loader「加载失败，点击重试」。

**实施后审查回环（probe5-6）确认**：

| 审查项 | 实测结果 | 结论 |
|--------|----------|------|
| 去重 alt 可用性 | 当前页 DOM 12/12 缩略图均有 `a[alt]`；服务端 HTML 含大量 alt 属性 | I-1 解除 |
| 主选择器命中 | 网格容器选择器在真实页面命中（12 项） | 容器选择器可用 |
| 降级父链 | `.thumbnail.group` → 无 class DIV → grid（1 层包装），`parentElement.parentElement` 恰好命中 grid | I-2 解除 |
| 视频页 | 视频页有同款 grid（底部推荐 16 项）但**无分页链接**；已加 `isVideoPage()` 守卫跳过 | I-3 修复 |
| 追加布局 | grid 直接子元素是 12 个无样式包装 DIV，追加缩略图本身为 grid 项，视觉需真实浏览器确认 | 已知限制 |
| Alpine 预览 | 服务端 HTML 缩略图含 `@mouseenter/@click` Alpine 指令，append 后不会自动初始化（预览功能可能失效） | 已知限制 |

#### 验证方案与风险

- 纯函数：`tests/missav-auto-page.test.ts`（node 环境）；静态：`tsc -b` / lint(0/0) / `check:structure`；
- 风险与兜底：Cloudflare 若拦 GM 请求，兜底用 `buildBrowserNavHeaders`（src/plugins/other-site/osp-helpers.ts 已 export）补导航头；图片加载假设服务端渲染完整 src（实施时验证）；随机前缀域直接复用页面内 next 链接，不自行拼 URL；不变量——不触碰状态标签渲染、修订号门控、跨站同步。

#### 结果与遗留

**结果**：执行方式为 subagent-driven development（2 任务 + 1 修复回环，逐任务审查 Approved）；version 1.40.2 → 1.41.0（新增功能插件，minor）；测试 143（9 文件，含新增 missav-auto-page 11 用例）；产物 2,183.83 kB。

**验证摘要**：实施前探针（probe1-4）确认无原生无限滚动、服务端分页 `?page=N`（每页 12 项）、同源 fetch 抓页 200 不被 Cloudflare 拦、英文站「Next」中文站「下一页」、搜索页无分页；实施后审查回环（probe5-6）确认 I-1（alt 可用）/ I-2（降级父链命中）/ I-3（视频页守卫修复）。浏览器实测 4 项判据：①列表页滚动到底自动加载第 2 页、缩略图追加且状态标签自动出现；②连续加载至最后一页 →「已经到底了」；③英文站 `/en` 同样正常；④搜索页无分页 → 不触发加载、不报错。

**已知限制（需用户浏览器实测）**：①滚动加载实测需真实 Tampermonkey 环境确认；②**Alpine 预览指令**——追加缩略图悬停预览（`@mouseenter` setPreview）可能不生效（追加节点不触发 Alpine init），点击跳转（`@click`）如失效则无法点入详情页——若实测确认，后续需在 append 后调用 `Alpine.initTree(container)` 或剥离指令；③追加缩略图直接作为 grid 子项（现有项隔一层无样式包装 DIV），视觉需真实页面确认无错位；④Cloudflare 频率限制——探针期间短时密集请求曾遇一次 403（临时限流），GM_xmlhttpRequest 真实使用频率低，风险低。

**后续可扩展（不纳入本期）**：设置项（瀑布流开关 / 预加载距离 / 每页项数提示）；视频播放页底部推荐也可瀑布流（`.thumbnail.group` 同样存在，需验证分页链接）。

### 2.2 加载模式改 click + 封面 data-src→src 修复（doc/221）

#### 背景

doc/220 交付的 MissAV 瀑布流（滚动触底自动加载）经用户实测反馈两个问题：

1. **封面加载失败**：追加的缩略图封面图不显示（用户不确定是网络阻塞还是功能问题）；
2. **加载模式不符合预期**：用户要求对齐 javdb 视频流页面交互——底部「点击加载下一页」按钮（点一下加载一页）+「加载全部」按钮 +「一键回到顶部」按钮，而不是触底自动加载。

#### 根因分析（Camoufox 实测）

探针抓取 `?page=N` 服务端 HTML 发现：缩略图 `<img>` 的 `src` 是 **1x1 透明占位图**（`data:image/png;base64,...`）；真实封面 URL 在 **`data-src`** 属性（如 `https://fourhoi.com/hsoda-129/cover-t.jpg`）；站点懒加载 JS 在**初始渲染时**把 `data-src` 提升到 `src`（当前页 DOM 12/12 均为真实 src）；**追加的节点不会触发站点懒加载初始化** → 封面永远停留在占位图（`naturalWidth: 1`）。

修复：追加缩略图前手动把 `data-src` 提升到 `src`。Camoufox 验证（probe8）：提升后图片 `naturalWidth: 330`、24 个 fourhoi.com 真实封面请求发出，**封面正常加载**。

#### 方案与决策

加载模式对齐 javdb AutoPagePlugin 的 **click 模式**：

| 交互 | 实现 |
|------|------|
| 触底检测 | 滚动监听检测 loader 进入「视口 + 800px」预加载区间 → 显示「点击加载下一页」按钮（不自动加载） |
| 加载一页 | 点击 loader（`jhs-map-click` 态）→ `fetchNextPage()`；加载完若仍在底部则按钮重现 |
| 加载全部 | `.jhs-map-load-all-btn` 浮动按钮（右下 bottom:80px），点击循环加载至末页/错误/无进展，文案「加载中...（第 N 页）」→「✓ 已全部加载」淡出移除 /「加载失败，点击重试」 |
| 回到顶部 | 复用 `core/util/back-to-top.ts` 的 `createBackToTopButton()`（右下 bottom:40px，圆形；样式复用 `back-to-top-button.css`） |
| 封面修复 | `map-selectors.liftDataSrcToSrc()`：容器内所有 `img[data-src]` 提升到 `src`，`fetchNextPage` 追加前调用 |

状态类名前缀统一为 `jhs-map-`（`jhs-map-click/loading/error/no-more`）。

#### 实施要点（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-auto-page/map-selectors.ts` | 新增纯函数 `liftDataSrcToSrc(container): number`（data-src→src 提升） |
| `src/plugins/missav-auto-page/map-fetch.ts` | `fetchNextPage` 追加前调用 `liftDataSrcToSrc(doc)`；成功 `loadedPages++`；finally 若仍在底部调用 `checkLoad()` 重现按钮；loader 类名改 `jhs-map-*` 前缀 |
| `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 重写：click 模式（checkLoad 显示按钮，不自动加载）；`showLoadAllBtn/loadAllPages/updateLoadAllBtn`；`createBackToTopButton()` 复用 + destroy 清理；字段 `loadAllBtn/isLoadingAll/loadedPages/backToTopCleanup`；initCss 拼接 missav-auto-page.css + back-to-top-button.css |
| `src/styles/missav-auto-page/missav-auto-page.css` | 新增（styles 直接文件数超上限，按目录规划建子目录）：loader 状态样式 + `.jhs-map-load-all-btn` 浮动按钮样式 |
| `tests/missav-auto-page.test.ts` | +3 用例：`liftDataSrcToSrc` 提升/不动/混合计数 |

#### 结果与遗留

**结果**：version 1.41.0 → 1.42.0（新增「加载全部」「回到顶部」按钮，minor）；测试 146（含 liftDataSrcToSrc 3 用例）；产物 2,188.35 kB。Camoufox 实测确认封面修复根因与效果；用户实测追加缩略图「布局也没问题」、悬停预览/点击进详情页正常（追加节点的 Alpine 指令在真实 Tampermonkey 环境生效，可能与 Camoufox headless 下行为不同，本版不处理）。

**验证摘要**：probe7 确认封面不加载根因（服务端 img src=1x1 占位图、data-src=真实 URL、追加后 naturalWidth=1）；probe8 确认修复效果（liftDataSrcToSrc 提升后 naturalWidth=330、24 个 cover 请求发出、封面正常加载）；构建/lint/146 测试/结构门禁全绿。

**已知限制（需用户浏览器实测）**：①底部「点击加载下一页」+「加载全部」+「回到顶部」三交互确认（触底显示按钮、点击加载一页、加载全部循环、回顶平滑）；②追加页封面应即时显示（data-src 已提升），需确认无回归；③Alpine 预览指令以用户实测为准，未处理。

**后续可扩展（不纳入本期）**：missav 瀑布流设置项（开关 / 预加载距离 / 默认加载模式）；「加载全部」进度条细粒度（当前按页数文案提示）。

## 3. MissAV 状态筛选（222—225）

### 3.1 状态标签筛选器初版（doc/222）

#### 背景与需求

用户要求给 missav 加状态标签筛选器，像 javdb 的 StatusTagFilterPlugin 一样：在列表页通过「⭐ 已收藏 / 🔍 已观看 / 🚫 已屏蔽 / 💾 已下载 / 无状态标签」芯片筛选瀑布流内容。

#### 可行性要点（已验证）

- **数据源现成**：missav 缩略图上的 `.missav-status-tag` 标签已由 MissavStatusTagPlugin 渲染（`dataset.status` = favorite/hasWatch/filter/hasDown），筛选器直接读 DOM 标签，零新数据源；
- **挂载点实测确认**（Camoufox probe9）：grid 正上方有 `DIV.flex.justify-between.mb-6`（原生"过滤: 所有"行），筛选栏插到其后，位置天然；
- **样式基础现成**：`filter-chip-base.css`（doc/180）已提取筛选栏+芯片共享基础（`.status-tag-filter-*` / `.jhs-vlt-filter-*` / `.preload-filter-*` 三前缀分组），扩展第四个前缀 `missav-status-filter-*` 即可，零重复实现；
- **协同**：标签渲染（MissavStatusTagPlugin）、瀑布流（MissavAutoPagePlugin）均通过 MutationObserver 自动覆盖新缩略图，筛选器另挂 observer 刷新计数 + 重新应用即可。

**协同安全**（参考 doc/48 的 data-hide 语义）：missav 端无其他隐藏机制（标签插件只挂标签、瀑布流只追加），筛选器用独立 `data-mstf-hidden` 属性标记自己隐藏的卡片，与其他插件/原生渲染零冲突。

#### 方案与决策（架构与模块拆分）

数据流：`mstf-collect.ts` 收集 `.missav-status-tag` dataset.status → 计数 → 主类构建筛选栏 + 挂载 → `mstf-apply.ts` OR 过滤（`data-mstf-hidden` 协同）→ MutationObserver 防抖刷新 chips（保留 active）+ 重新应用。

| 文件 | 职责 |
|------|------|
| `src/plugins/missav-status-filter/mstf-collect.ts` | 纯函数 + DOM 收集：`NO_TAG_VALUE` / `STATUS_ORDER` / `statusToLabel` / `getItemStatus` / `collectStatusCounts` |
| `src/plugins/missav-status-filter/mstf-apply.ts` | 过滤：`shouldShow`（纯函数）/ `applyFilter`（DOM） |
| `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 主类：构建筛选栏、挂载、芯片交互、MutationObserver、生命周期 |
| `src/styles/missav-status-filter/missav-status-filter.css` | active 配色 + no-tag 变体（专属） |
| `tests/missav-status-filter.test.ts` | 纯函数回归测试（jsdom，首行 `// @vitest-environment jsdom`） |

**纯函数接口**（Task 2 依赖，签名精确）：`NO_TAG_VALUE = 'no-tag'`；`STATUS_ORDER: string[]`（favorite/hasWatch/filter/hasDown）；`statusToLabel(status)`（STATUS_CONFIG.label，未知 status 原样返回）；`getItemStatus(item)`（读 `.missav-status-tag` 的 `dataset.status`，无标签 null）；`collectStatusCounts()`（遍历 `.thumbnail.group`，返回 显示名→计数；无标签记入 `NO_TAG_VALUE`）；`shouldShow(itemStatus, activeValues)`（active 空 → true；否则 `activeValues.has(itemStatus ?? NO_TAG_VALUE)`）；`applyFilter(activeValues)`（遍历 `.thumbnail.group`，调 shouldShow 显隐 + `data-mstf-hidden` 属性）。

#### 关键设计

| 决策点 | 选择 |
|--------|------|
| 类名前缀 | `missav-status-filter-*`（bar/label/chips/chip），加入 filter-chip-base.css 分组选择器第四个前缀 |
| 芯片顺序 | 固定 `STATUS_ORDER = ['favorite','hasWatch','filter','hasDown']`（STATUS_CONFIG.label 显示）→ 最后「无状态标签」（计数为 0 的跳过） |
| 过滤逻辑 | `shouldShow(status, active)`：active 空 → 全显示；否则 OR（命中任一状态显示）；隐藏卡片 `display:none` + `data-mstf-hidden="yes"`，显示卡片移除属性 |
| 挂载 | `DIV.flex.justify-between.mb-6` afterend；降级 `h1` 后；再降级 grid 前 |
| 刷新 | MutationObserver（childList + attributes:['data-status']）防抖 150ms → 重建 chips（保留 active）+ applyFilter |
| 芯片交互 | chips 容器 click 委托（重建后仍有效）：`closest('.missav-status-filter-chip')` → toggle active → 重应用 |
| 协同 | 独立 `data-mstf-hidden` 属性；不触碰 `.missav-status-tag` 渲染、瀑布流追加、原生 Alpine |
| 生命周期 | TaskSupervisor（observer/防抖计时器）；handle 内 `if (isVideoPage()) return;` 守卫 |

#### 审查回环（关键发现与修复）

subagent 审查发现 3 项并已修复（复审 Approved）：

| 级别 | 问题 | 修复 |
|------|------|------|
| Critical | `renderChips` 的 `chip.dataset.value` 存显示 label（'⭐ 已收藏'），而 `applyFilter` 按原始 `dataset.status` key（'favorite'）匹配 → 点击芯片会把全部卡片隐藏 | 遍历 `STATUS_ORDER` 原始 key，`dataset.value = status`（文本仍显示 label）；+接线测试 `missav-status-filter-ui.test.ts` |
| Important | observer 无门控，renderChips 重建触发自身 → 每 150ms 一次死循环 | `observerNeedsRefresh` 门控：仅 `.thumbnail.group`/`.missav-status-tag` 新增/删除或 `data-status` 属性变更才刷新 |
| Minor | `tryBuild()` 失败无重试（挂载点迟到时筛选栏永不出现） | observer 回调门控通过后先 `tryBuild()`；removedNodes 检查补充 |

**与 javdb 版的移植差异**：javdb 用文本匹配（value=标签文本），missav 用属性匹配（dataset.status 原始 key）——审查回环发现并修正了这个差异。

#### 评估与风险

- **标签渲染时序**：跨站同步消费后 MissavStatusTagPlugin 才渲染标签，筛选器 observer 监听 `data-status` 属性变化自动刷新——最终一致；
- **瀑布流**：追加新缩略图 → observer childList 触发 → 刷新 chips + 重应用筛选；
- **无状态标签**：跨站同步未覆盖的番号显示「无状态标签」芯片；
- **不变量**：不触碰 `data-mstf-hidden` 之外的 DOM 属性；不修改标签渲染/瀑布流/跨站同步。

#### 结果与遗留

**结果**：执行方式为 subagent-driven development（2 任务 + 1 审查回环修复，审查 Approved）；version 1.42.0 → 1.43.0（新增功能插件，minor）；测试 161（含 mstf 纯函数 14 + 接线 1 用例）；产物头部 `@version 1.43.0` 已核对。

**验证摘要**：纯函数套件覆盖 shouldShow（空 active 全 true / 命中 / 未命中 / 无标签状态）、statusToLabel、getItemStatus、collectStatusCounts（混合计数 / 无标签计入 / 空页面）、applyFilter（OR 显隐 + 属性）；接线测试锁定 chip `dataset.value` 契约（原始 status key）；挂载点由 Camoufox probe9 实测。浏览器实测判据：芯片计数正确、点击 OR 过滤、与瀑布流/标签渲染协同、挂载视觉无挤压错位。

**已知限制（需用户浏览器实测）**：①筛选栏交互——芯片计数正确、点击 OR 过滤、与瀑布流新缩略图协同；②挂载视觉——筛选栏插入「过滤: 所有」行后的布局（无挤压/错位）；③无状态标签——跨站同步尚未覆盖的番号计入「无状态标签」芯片。

**已知偏差**：第三级挂载回退（挂载行与 h1 均缺失时）对缩略图祖父元素（grid）执行 `afterend`（插到 grid 后而非计划文本的 grid 前）——该路径在 Camoufox 实测的主挂载行存在时不触发，无行为影响，记录待后续统一。

**后续可扩展（不纳入本期）**：屏蔽/黑名单过滤（按关键词/黑名单隐藏 missav 内容）；筛选状态持久化（localStorage 记住已选芯片）。

### 3.2 筛选 UI 暗色化 + 网格 cell 级显隐（doc/223）

#### 背景

doc/222 交付的 MissAV 状态标签筛选器经用户实测反馈两个问题：

1. **UI 风格不相符**：筛选栏复用了 javdb 的浅色主题样式（白底/浅边框/深灰文字），放在 missav 的 Tailwind nord 暗色页面上很突兀，观感不搭；
2. **筛选方式错误**：隐藏的是 `.thumbnail.group` 缩略图本身，但 missav 初始页结构是 `grid > 包装DIV > .thumbnail.group`——包装 DIV（grid 直接子项）仍占位，隐藏内层缩略图后网格留空洞、布局不重排。用户期望隐藏后**布局结构正确变化**（网格无缝重排）。

#### 根因分析

**UI 风格（设计决策修正）**：doc/222 计划把 `missav-status-filter-*` 前缀加入 `filter-chip-base.css` 共享基础（doc/180 三插件共享）。该基础是 javdb 浅色主题（白底 #fff / 边框 #dee2e6 / 文字 #495057）。但 missav 是 **Tailwind nord 暗色主题**（页面 bg 深色、文字 nord4 #d8dee9、边框 nord3 #4c566a）——共享基础的前提"逐字节相同"不成立，应**独立定义暗色样式**。

**网格空洞（DOM 结构实测）**：Camoufox probe6 确认 missav 初始页结构 `grid → DIV.（无 class，grid 直接子项）→ DIV.thumbnail.group → div.relative > a[alt] + video + img`；瀑布流追加项则直接是 `grid > .thumbnail.group`（无包装层）。`applyFilter` 对 `.thumbnail.group` 设 `display:none` 只隐藏内层缩略图，**外层包装 DIV（grid 项）仍在布局流中** → 网格留空洞。显隐必须作用在 **grid cell**（grid 直接子项）上，隐藏后 grid 自动重排。

#### 方案与决策

| 项 | 修复 |
|----|------|
| UI 暗色化 | `missav-status-filter.css` 从「active 配色 + no-tag 变体」改为**完整暗色样式**（nord 配色：容器边框 #3b4252、标签/文字 #d8dee9、芯片底色 #2e3440、边框 #4c566a、hover frost #81a1c1、active #5d87c2）；`filter-chip-base.css` **回滚第四前缀**（恢复到 javdb 三插件共享，注释说明 missav 不参与原因） |
| cell 级显隐 | `mstf-apply.ts` 新增 `getCell()`：`grid > 包装DIV > .thumbnail.group` 时返回包装 DIV；`grid > .thumbnail.group`（瀑布流追加）时返回缩略图自身；判定用 className 含 `grid-cols` 而非 CSS 选择器（避免 `md\:grid-cols` 转义在 jsdom nwsapi 匹配失败） |

#### 实施要点（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-status-filter/mstf-apply.ts` | `getCell()` cell 级定位（className 判定，脱离 MAP_SEL 依赖）；`applyFilter` 对 cell 显隐 + `data-mstf-hidden` |
| `src/styles/missav-status-filter/missav-status-filter.css` | 完整 nord 暗色样式（bar/label/chips/chip/hover/active/no-status） |
| `src/styles/filter-chip-base.css` | 回滚第四前缀（恢复三插件共享），头部注释说明 missav 独立原因 |
| `tests/missav-status-filter.test.ts` | applyFilter 用例重构为 4 个（无 grid / 初始页包装 / 瀑布流追加 / 空 active 恢复）；+`afterEach` body 清理（jsdom 用例间 DOM 残留修复） |
| `tests/missav-status-filter-ui.test.ts` | buildPage 改为 `grid > 包装DIV > 缩略图` 结构；断言改为 grid cell（`.grid > div`）显隐 + 缩略图自身不受影响 |

**调试记录**：实现中曾遇到 `MAP_SEL.grid`（`md\:grid-cols-3` CSS 转义）在 jsdom nwsapi 匹配失败，导致 getCell 回退隐藏缩略图自身、测试红；改为 className 包含 `grid-cols` 判定后通过（独立调试用例验证逻辑正确，根因是 jsdom 选择器转义 + 测试用例间 DOM 残留，后者由 afterEach body 清理解决）。

#### 结果与遗留

**结果**：version 1.43.0 → 1.43.1（patch，修复）；测试 163（applyFilter 用例 2→4，含 cell 级断言）。

**验证摘要**：构建/lint/163 测试/结构门禁全绿；调试记录——`MAP_SEL.grid`（`md\:grid-cols-3` CSS 转义）在 jsdom nwsapi 匹配失败导致测试红，改为 className 含 `grid-cols` 判定 + `afterEach` body 清理后通过。浏览器实测判据：暗色 UI 与页面融合度、cell 级重排（初始页包装 DIV 隐藏后网格无缝重排）、瀑布流追加项筛选隐藏自身。

**已知限制（需用户浏览器实测）**：①暗色 UI 与 missav 页面融合度需目视确认（nord 令牌近似值，若与页面实际主题色有偏差可微调）；②cell 级重排——点击筛选后网格应无缝重排（初始页包装 DIV 隐藏）；③瀑布流追加项（grid 直接子项）筛选时隐藏自身，与初始页行为一致。

**后续可扩展（不纳入本期）**：筛选状态持久化（localStorage 记住已选芯片）；屏蔽/黑名单过滤。

### 3.3 「加载全部」按钮左下角 + 暗色化（doc/224）

#### 背景

用户实测反馈两个问题：①MissAV「加载全部」按钮 UI 与暗色主题不符——当前是 javdb 同款渐变蓝（`linear-gradient(#5d87c2, #4a90d9)` + 白字），在 missav 的 nord 暗色页面上突兀；②位置与「回到顶部」按钮冲突——「加载全部」浮动在右下（`right:20px; bottom:80px`）、「回到顶部」也在右下（`right:40px; bottom:40px`），同侧视觉拥挤（javdb 的 `.jhs-load-all-btn` 同样在右下，与 javdb 的回到顶部 `#jhs-back-to-top` 存在同类冲突）。用户要求：**加载全部按钮调到左侧**。

#### 方案与决策

| 站点 | 按钮 | UI 处理 | 位置 |
|------|------|---------|------|
| MissAV | `.jhs-map-load-all-btn` | 渐变蓝 → **nord 暗色**（底色 #2e3440 / 边框 #4c566a / 文字 #d8dee9 / hover 底色 #3b4252 + frost 边框 #81a1c1） | `right:20px` → **`left:20px`**（bottom:80px 不变） |
| JavDB | `.jhs-load-all-btn` | 渐变蓝**保留**（javdb 浅色主题合适） | `right:20px` → **`left:20px`**（bottom:80px 不变） |

两层按钮分居左右下角，与回到顶部按钮（右下 bottom:40px）彻底错开。

#### 实施要点与结果

修改 `src/styles/missav-auto-page/missav-auto-page.css`（`.jhs-map-load-all-btn`：right→left；渐变蓝→nord 暗色含 hover；transition 补 border-color/background-color）与 `src/styles/auto-page-plugin.css`（`.jhs-load-all-btn`：right→left，渐变蓝保留）。

**结果**：version 1.43.1 → 1.43.2（patch，优化）；测试 163（CSS 文件数不变，纯样式修改）。已知限制：左下角按钮与 missav 页面左下内容（如有）的视觉关系需目视确认；javdb 左下角加载全部按钮位置需确认（浅色主题 UI 不变，仅换侧）。无后续扩展（纯样式调整）。

### 3.4 loader 类名前缀修复 + tests 语言服务归属（doc/225）

#### 背景

两件事：

1. **诊断清理（用户反馈）**：编辑器语言服务报 2 个 `Cannot find module` 误报（`map-fetch.ts` import `./missav-auto-page-plugin`、`tests/missav-status-filter.test.ts` import `mstf-apply`）。tsc -b / tsc --noEmit / build / test 全部通过，证明是语言服务项目图问题而非代码错误；
2. **意外发现的真实 bug**：`map-fetch.ts` 的 `setLoader` 调用用的是**无前缀类名**（`'loading'`/`'error'`/`'no-more'`），而 doc/223 后 CSS 已改为 `jhs-map-` 前缀（`.jhs-map-loader.jhs-map-loading` 等）——类名不匹配导致 loading/error/no-more 状态样式失效（仅 click 态正常，因主类用对了前缀）。

#### 根因与修复

- **Cannot find module（语言服务项目图）**：`tests/` 不在任何 tsconfig include，语言服务把测试文件当作孤儿文件解析，import `../src/...` 间歇失败。修复：新建 `tests/tsconfig.json`（模仿 `scripts/tsconfig.json` 先例：moduleResolution bundler + react/node types + paths 指向 src shim，**不接入根 tsconfig references**，不参与 tsc -b/build/门禁）；`map-fetch.ts` 删除并重建文件强制重新索引（内容不变，仅补充注释）；
- **loader 类名前缀 bug**：`fetchNextPage` 的 `setLoader('loading', ...)` 生成 `class="jhs-map-loader loading"`，与 CSS `.jhs-map-loader.jhs-map-loading` 不匹配。修复：统一为带前缀类名（`jhs-map-loading`/`jhs-map-error`/`jhs-map-no-more`），与主类 `jhs-map-click` 及 doc/223 CSS 一致。

#### 结果与遗留

**结果**：version 1.43.2 → 1.43.3（patch，bug 修复）；测试 163；Zed 语言服务诊断全项目干净（此前 2 个 Cannot find module 误报已清除）。

**验证摘要**：构建/lint/163 测试/结构门禁全绿；language server diagnostics 确认「No errors or warnings found in the project」。已知限制：`tests/tsconfig.json` 仅服务编辑器语言服务，不参与 tsc -b / vitest / 构建门禁（与 scripts/tsconfig.json 同模式）；语言服务误报属编辑器状态问题，若再次出现，删除对应文件重建即可恢复索引。无后续扩展。

## 4. 视频页按钮与布局（226—227）

### 4.1 自定义按钮独立分组（doc/226，后被回退）

#### 背景

用户实测反馈：missav 视频详情页中自定义按钮（复制番号 / 转到JavDB搜索）与原生按钮混排，UI 不匹配、布局不合理。Camoufox 量化实测（probe-video2）确认两个问题：

1. **UI 不匹配**：自定义按钮 class 含 `shadow-sm`（`boxShadow: rgba(0,0,0,0.05) 0 1px 2px`）+ `mr-2`（`marginRight: 8px`），原生按钮无 shadow、间距由父容器 `space-x-6`（`marginLeft: 24px`）控制；自定义图标固定 16px/24px（原生 `h-3 w-3 xs:h-4 xs:w-4` 响应式 12→16px）；
2. **布局不合理**：`prepend` 把「复制番号」插到原生工具栏最前（原生顺序 收藏→片单→下载→分享被破坏）、`appendChild` 把「转到JavDB搜索」放到最后，两个自定义按钮混插在原生按钮流中。

#### 方案与决策

| 项 | 调整 |
|----|------|
| 布局 | 不再 prepend/append 进原生工具栏，改为在工具栏**之后**插入独立按钮组 `.jhs-video-actions`（`flex flex-wrap justify-center space-x-4 md:space-x-6 py-4`，与原生工具栏同风格） |
| 按钮样式 | class 与原生按钮逐字对齐：去 `shadow-sm`/`mr-2`，间距由外层 `space-x` 控制 |
| 图标尺寸 | 剪贴板 SVG 去固定 width/height → `h-3 w-3 xs:h-4 xs:w-4`；JavDBIcon 解析后移除 24px 属性改同款响应式 class |
| 幂等 | 插入前检查 `.jhs-video-actions` 已存在则跳过（observer/existing 双路径防重复） |

#### 结果

**结果**：version 1.43.3 → 1.43.4（patch，布局调整）；测试 163；Camoufox 实测（probe-video3）样式与布局对齐——自定义 vs 原生：`boxShadow: none`、`marginRight/Left: 0`（间距由 space-x）、`fontSize: 14px`、`height: 16px`；原生工具栏恢复纯净（收藏/片单/下载/分享 4 项）；自定义按钮组 `.jhs-video-actions` 位于工具栏下方（top 814 vs 766）。

**验证摘要**：幂等性——`.jhs-video-actions` 存在检查防重复插入（observer/existing 双路径）；构建/lint/163 测试/结构门禁全绿。

**已知限制**：独立按钮组在工具栏下方的视觉位置（与下方视频信息的间距）需目视确认；窄屏（移动端）下按钮组换行行为；JavDB tabler 图标去掉固定尺寸后在小尺寸下的清晰度。

**演进链**：本方案被 doc/227 回退（用户明确要求按钮与原生组件同一行）。

### 4.2 按钮回原生工具栏 + 视频页守卫 + 去分割线（doc/227，取代 226）

#### 背景

用户对 doc/226 的调整反馈三点：

1. **按钮恢复原样**：复制番号 / 转到JavDB搜索 按钮应放回原生播放页工具栏（`div.flex.flex-wrap.justify-center.space-x-4.md:space-x-6.py-8.rounded-md.shadow-sm`），与网站原始组件（收藏/片单/下载/分享）**同一行**，而非独立成组；
2. **筛选器不在视频详情页显示**：实测发现筛选器在视频页出现（不该出现）；
3. **筛选栏去分割线**：`border-bottom` 分割线影响视觉，应改用间距分离。

#### 根因分析（Camoufox 实测）

**筛选器为何在视频页显示**：`isVideoPage()` 检测 `#sprite-plyr`，但该播放器 **DOM 延迟渲染**——Camoufox 实测 `t0/t500` 时不存在、`t1500` 才出现。handle 在 document-idle（t0 附近）执行，`isVideoPage()` 返回 false → 守卫失效 → 筛选器经 `h1` 降级挂载点挂到视频页（视频页无 `div.flex.justify-between.mb-6` 主挂载点，回退到 h1）。

**按钮分组（doc/226 回退）**：用户明确要求按钮与原生组件同一行，撤销 doc/226 的独立成组，恢复 prepend/append 混插（样式对齐修复保留）。

#### 方案与决策

| 项 | 调整 |
|----|------|
| 按钮 | `insertButtons` 恢复 `menuBar.prepend(copyBtn)` + `menuBar.appendChild(javdbBtn)`（与原生同一行）；样式对齐保留（无 shadow-sm/mr-2、图标响应式） |
| 视频页守卫 | 新增纯函数 `isVideoDetailPath(path)`（mstf-collect）：pathname 末段为连字符番号（`mkmp-745`/`fc2-ppv-4955762`）且非 `/search/` 路径 → 视频页；handle 改为 `if (isVideoPage() \|\| isVideoDetailPath(location.pathname)) return;`——不依赖 `#sprite-plyr` 时序；MissavAutoPagePlugin 同步（同根因） |
| 分割线 | `.missav-status-filter-bar` 移除 `border-bottom`，`padding: 8px 0 16px 0`（底部间距自然分离） |
| 测试 | +5 用例：`isVideoDetailPath`（视频页/列表页/搜索页/分类页/FC2） |

#### 结果与遗留

**结果**：version 1.43.4 → 1.43.5（patch）；测试 168（+5 isVideoDetailPath 用例）；Camoufox 实测（probe-video4/5）——视频页按钮同一行（顺序「复制番号→收藏→片单→下载→分享→转到JavDB搜索」全部 top:766）、视频页筛选器不显示（filterBarDisplayed: false，h1 兄弟为原生工具栏）、列表页筛选栏无 border-bottom（padding 16px 底部间距）。

**验证摘要**：+5 `isVideoDetailPath` 用例覆盖视频页/列表页/搜索页/分类页/FC2 五类路径；构建/lint/168 测试/结构门禁全绿。

**已知限制（需用户浏览器实测）**：视频页按钮在工具栏中的视觉（与原生按钮间距 space-x 一致、无 shadow）；列表页筛选栏无分割线、间距观感；视频页无筛选器确认。

**演进链**：该守卫成为后续 doc/228 视频预览弹窗「iframe 内瀑布流/筛选器自动跳过、零改动」的协同基础。

## 5. 视频流 iframe 详情弹窗（228—233）

### 5.1 初版实现（doc/228）

#### 背景与需求

用户希望 missav 列表页（视频流）支持 **javdb 同款交互**：点击视频卡片弹出 **iframe 界面**加载视频详情页，突出显示左侧主内容区（播放器 + 标题 + 工具栏），而无需跳转新页面。用户实测确认：**missav 在 1024px 宽度以下（不含 1024）会自动隐藏右侧推荐栏**，因此 iframe 宽度设 <1024 即可自然突出左侧，无需额外隐藏逻辑。

**交互确认（用户已确认三项）**：①所有列表页卡片**左键点击 → 弹窗**；中键/右键/Ctrl+点击保留原生行为（新标签打开详情页）；②弹窗内容加载**完整详情页**（播放器/收藏/片单/下载/分享/复制番号/转 JavDB 全部可用），**顶部条不隐藏**；③弹窗尺寸 `min(900px, 视口宽-40px)` × 90% 高。

#### Camoufox 实测证据（已验证事实）

| 探测项 | 实测结果 | 结论 |
|--------|----------|------|
| 响应式右侧栏 | 视口 900/1023px 右侧栏 `display:none`（左侧 736px 占满）；1024/1200px 右侧 `display:flex`（300px，左侧 668px） | **<1024 自动隐藏右侧，用户说法完全正确** |
| iframe 加载详情页 | 列表页内嵌 900px 宽 iframe 加载 `/cn/mkmp-745` → 右侧自动隐藏、左侧 736px 占满、`#sprite-plyr` 播放器正常加载、标题正确 | **iframe 方案成立，无需特殊隐藏逻辑** |
| 卡片点击结构 | `.thumbnail.group` 带 Alpine `@click="clickPreview('<uuid>')"` + 内部 `a[href]`（详情页链接，2 个封面链接 + 1 个标题链接） | 拦截点明确 |
| 站点原生点击 | 点击卡片触发 `clickPreview`（Alpine），页面出现一个空 iframe（站点预览容器），**不跳转** | 拦截后需阻止 Alpine 冒泡，避免站点预览弹层 |
| 拦截可行性 | 捕获阶段 `document.addEventListener('click', ..., true)` + `preventDefault()` + `stopPropagation()` → 点击 `a[href]` 后 `location.href` 不变 | **capture 拦截 + 阻止传播方案可行**（Alpine 委托监听在 document，捕获阶段 stopPropagation 可阻断） |
| 详情页顶部 | 900px 视口：顶部条 56px 显示（用户确认**不隐藏**）；内容区 `padding-top: 80px` 为站点自身布局 | 不做任何 CSS 注入，iframe 内即完整详情页 |

#### 与现有插件的协同

- **MissavAutoPagePlugin / MissavStatusFilterPlugin**：`isVideoDetailPath` 守卫（doc/227）在 iframe 视频页内自动跳过瀑布流/筛选器——**零改动**；
- **MissavQuickCopyPlugin**：iframe 视频页内正常插入「复制番号/转JavDB」按钮（弹窗内可用）——**零改动，预期行为**；
- **MissavStatusTagPlugin**：视频页无缩略图网格，observer 无目标——**零改动**；
- **MissavVideoPreviewPlugin（新）**：iframe 内视频页底部有推荐区（同款 `.thumbnail.group` grid），点击推荐缩略图同样弹新窗（嵌套 layer，与 javdb iframe 内行为一致）。

**与 javdb openPage 机制对齐**：javdb 的 `utils.openPage`（`src/core/common-util.ts`）为 `layer.open({ type: 2, content: url, area: getResponsiveArea(['85%','90%']) })`，javdb 详情页用 `?hideNav=1` 隐藏导航。**missav 无需任何 URL 参数/CSS 注入**：iframe 宽度 <1024px 自动隐藏右侧推荐栏，顶部条保留（用户确认），iframe 内即完整详情页。仅复用 `layer.open({ type: 2 })` iframe 弹窗机制。

#### 方案与决策（架构与模块拆分）

`src/plugins/missav-video-preview/` 子目录（参考 missav-auto-page/ 先例）：

| 文件 | 职责 |
|------|------|
| `mv-selectors.ts` | 选择器常量 + 纯函数（`CARD_SEL` / `findDetailUrl` / `isPlainLeftClick`） |
| `missav-video-preview-plugin.ts` | 插件主类：文档级捕获 click 拦截 + layer.open 弹窗 |

纯函数接口：`CARD_SEL = '.thumbnail.group'`；`findDetailUrl(card)`——从卡片内 `a[href]` 取详情绝对 URL（querySelector 首个 `a[href]`，返回 `.href` 绝对 URL）；`isPlainLeftClick(e)`——`e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey`。

#### 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拦截方式 | `document` 捕获阶段 click 监听（`{ capture: true }`）+ `target.closest(CARD_SEL)` 命中 → `preventDefault` + `stopPropagation` | 实测可行；捕获阶段 stopPropagation 阻断 Alpine document 委托（clickPreview 不触发） |
| 触发按键 | 左键（`e.button === 0`）且非 Ctrl/Cmd/Shift/Alt 修饰键 → 弹窗；中键/右键/Ctrl+点击 → 保留原生行为（新标签） | 对齐 javdb openPage 语义（ctrl/meta 新标签） |
| 弹窗 | `layer.open({ type: 2, content: url, area: [\`min(900, vw-40)px\`, '90%'], scrollbar: false })` | 900px < 1024 右侧自动隐藏；layer-wrapper 已提供 ESC/closeBtn 基建 |
| iframe 内处理 | **无 URL 参数、无 CSS 注入**；iframe 内即完整详情页（顶部条保留，用户确认） | 用户明确「顶部条不需要隐藏」；右侧栏由站点响应式自动隐藏 |
| 推荐区嵌套 | iframe 视频页内点击底部推荐缩略图 → iframe 内 layer 弹窗 | 与 javdb iframe 行为一致；layer 在 iframe 文档内层叠 |
| 生命周期 | `TaskSupervisor` 管理捕获监听器 | 项目统一约定 |
| 守卫 | 列表页全站注册（无 pageTypes 覆写）；iframe 视频页推荐区仍可弹窗 | 与 missav-auto-page 同模式 |
| 设置项 | 本期不做（默认开启） | YAGNI，用户未要求开关 |
| 样式 | 无独立 CSS 文件、无 initCss | 纯 DOM 拦截 + 既有 layer 基础设施，零样式 |

**弹窗尺寸计算**：`min(900, vw - 40)` 用 `getResponsiveArea(['85%','90%'])` 不适用（85% 在宽屏可能 >1024 触发右侧栏显示）；改为显式 `area: [(Math.min(900, window.innerWidth - 40)) + 'px', '90%']`。

#### 实施要点

主类 handle()：注册捕获阶段 click 监听（TaskSupervisor 管理）——`e.target.closest(CARD_SEL)` 命中 + `isPlainLeftClick(e)` → `findDetailUrl(card)` → 非空时 `e.preventDefault()` + `e.stopPropagation()` → `layer.open({ type: 2, content: url, area: [width, '90%'], scrollbar: false })`；`width = Math.min(900, window.innerWidth - 40)` 像素字符串；弹窗 URL 为完整详情页 URL（不加任何参数，顶部条保留）。注册：main.tsx isMissavSite 块 + plugin-registry.ts 映射。

#### 评估与风险

- **Alpine 预览冲突**：捕获阶段 stopPropagation 阻断 clickPreview（实测验证）；若 Alpine 在捕获阶段另有 document 级监听（未实测到），兜底在卡片上直接挂 click 监听；
- **iframe 内脚本执行**：userscript 在 iframe 文档内完整运行（无 @noframes），各插件守卫已验证（doc/227）；
- **layer 嵌套**：iframe 内 layer.open 在 iframe 文档内层叠（javdb 同行为），关闭后 shade 计数恢复（layer-wrapper 已处理）；
- **随机前缀域**：详情 URL 从卡片 `a[href]` 提取（绝对 URL 含随机前缀），不自行拼接；
- **不变量**：不触碰状态标签渲染、跨站同步、瀑布流/筛选器逻辑；新插件独立注册 isMissavSite 块。

#### 结果、最终审查修复与遗留

**结果**：执行方式为 subagent-driven development（计划 3 任务，逐任务审查）；version 1.43.5 → 1.44.0（新增功能插件，minor）；测试 177（12 文件，含新增 missav-video-preview 9 用例）；产物 2,198.15 kB。Camoufox 实测确认：列表页卡片拦截（Alpine clickPreview 不触发）、900px iframe 弹窗（右侧自动隐藏、Plyr 加载、标题正确）。

**验证摘要（Camoufox 回归判据 4 项）**：①列表页左键点击卡片 → 900px iframe 弹窗，右侧自动隐藏、左侧占满、Plyr 播放器加载、顶部条保留、复制番号按钮可用；②中键/右键/Ctrl+点击 → 新标签打开（原生行为）；③弹窗内点击底部推荐缩略图 → 嵌套弹窗；④关闭弹窗后列表页滚动/瀑布流/筛选器正常。

**最终审查修复（3 项，commit 3a2f656 / 1e0c64a，版本保持 1.44.0——发布前审查回环内）**：

- **I-1（Important）**：状态徽章 `.missav-status-tag`（`<a target="_blank" href="javdb详情">`，由 car-status-sync/missav-renderer 的 createBadge 挂到卡片内部）的左键点击会被视频预览捕获拦截吞掉（preventDefault + 弹 missav 预览窗），徽章「点击跳转 javdb」核心交互失效；修复为 handler 内 `target?.closest('.missav-status-tag')` 命中即 return（放行原生跳转）；
- M-1：TaskSupervisor 使用插件计数实为 11（grep 全量确认），文档 10 → 11；
- M-2：main.tsx 陈旧注释「javdb 的 33 个插件」→ 39（javdb 块实际注册 39）。

**已知限制（需用户浏览器实测）**：①弹窗交互实测——Camoufox 探针已实测列表页卡片拦截 + 900px iframe 右侧自动隐藏 + Plyr 加载，但**真实 Tampermonkey 环境**下的弹窗交互需用户浏览器实测——左键弹窗 / 修饰键新标签 / 嵌套弹窗 / 关闭后瀑布流正常四项；②Alpine 兜底（若 Alpine 在捕获阶段另有 document 级监听，需在卡片上直接挂 click 监听，未触发）。

**后续可扩展（不纳入本期）**：设置项（弹窗开关 / 宽高比）；javdb 列表页点击卡片也改弹窗（现有 dialogOpenDetail 设置已支持，无需改）。

### 5.2 尺寸六连调之一：宽度 900→1023、高度 90%→100%（doc/229—230）

**背景（doc/229）**：用户反馈 doc/228 实现的视频预览弹窗 **900px 宽度太小**，应最大化利用 **1023px（< 1024 的极限）**——missav 站点在 1024px 以下（不含 1024）自动隐藏右侧推荐栏，弹窗宽度取极限值可在不触发右侧栏的前提下获得最大内容区。

**背景（doc/230）**：用户反馈弹窗高度 `90%` 上下留白——既然宽度已最大化至 1023px，高度应**铺满 100%**：上下高度不影响左侧内容区展示（右侧推荐栏已由响应式隐藏），铺满可获得最大可视面积。

**方案与决策**：

| 项 | doc/229 | doc/230 |
|----|---------|---------|
| 宽度上限 | `Math.min(900, window.innerWidth - 40)` → `Math.min(1023, window.innerWidth - 40)` | 保持 `min(1023, 视口宽 - 40)` 不变 |
| 高度 | 保持 `90%` 不变 | `area: [.., '90%']` → `area: [.., '100%']` |
| 注释 | 插件头部 doc-comment 同步更新（900 → 1023） | 插件头部 doc-comment 同步更新（90% → 100%） |

**结果**：1.44.0 → 1.44.1 → 1.44.2（均 patch，小优化）；测试 177 全绿；产物 2,198.23 kB（两次）。无独立前端，产物头部版本号已核对。已知限制：弹窗宽度实际值取决于视口——`min(1023, 视口宽 - 40)`，宽屏取 1023px，窄屏（<1063px）跟随视口收窄；1023px 是 <1024 的极限值，若 missav 未来调整响应式断点需重新实测；高度 100% 即弹窗铺满视口高度（layer.js 计算）。

### 5.3 弹窗覆盖顶部条：列表页与 iframe 二级弹窗（doc/231—232）

**背景（doc/231）**：用户反馈打开的弹窗上部被**打开前的页面组件**遮挡——列表页顶部固定条（`body > div:nth-child(2) > div.relative > div`，即 `div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest`）盖在弹窗上方，弹窗上部不可见。

**根因（Camoufox 实测，probe-stack.py）**：

| 元素 | z-index | position |
|------|---------|----------|
| 列表页顶部条（fixed z-max，56px） | **2147483647**（CSS 整数最大值） | fixed |
| layer 弹窗（默认起始值） | **19891014** | fixed |

→ 顶部条 z-index 远大于 layer 弹窗，弹窗打开时顶部条渲染在弹窗之上。由于 2147483647 已是 CSS 整数上限，**无法通过提高弹窗 z-index 覆盖**，唯一可靠方案是**弹窗打开期间隐藏该顶部条，关闭时恢复**。

**方案与决策（doc/231）**：`TOP_BAR_SEL = 'div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest'` 常量；打开时非视频页（`!isVideoDetailPath`）→ 记录原 display 并设 `display:none`；关闭时 layer `end` 回调恢复原 display（layer-wrapper 不劫持 end，所有关闭路径触发）；iframe 视频页内嵌套弹窗**不隐藏**顶部条（用户确认 doc/228「顶部条不隐藏」）。

**结果**：1.44.2 → 1.44.3（patch，bug 修复）；测试 177；产物 2,198.24 kB。

**验证摘要**：Camoufox 堆叠实测（probe-stack.py）确认根因——列表页顶部条 z-index 2147483647（fixed，56px）高于 layer 弹窗 19891014，无法通过 CSS 超越，隐藏方案（弹窗期间 display:none + end 恢复）为唯一可靠方案；构建/lint/177 测试/结构门禁全绿。

**背景（doc/232）**：用户反馈**二级弹窗**（iframe 视频页内点击推荐缩略图嵌套打开的弹窗）没有覆盖 `body > div:nth-child(3) > div.relative > div`——即 iframe 视频页文档内的顶部条盖在二级弹窗上方。

**根因（Camoufox 实测，probe-stack2.py）**：**列表页与 iframe 视频页的顶部条是同一 class**（`div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest`），z-index 均为 CSS 最大值 2147483647。doc/231 的修复加了 `isVideoDetailPath` 守卫，意图「iframe 视频页内保留顶部条」（对齐 doc/228 用户确认「顶部条不隐藏」）——但该守卫**误伤二级弹窗**：iframe 文档内打开二级弹窗时跳过隐藏，iframe 顶部条盖住二级弹窗。

**方案与决策（doc/232）**：**移除 `isVideoDetailPath` 守卫**——任何文档打开弹窗时都隐藏当前文档顶部条。语义澄清：弹窗打开时隐藏的是**当前文档**的顶部条——列表页弹窗隐藏列表页的、iframe 二级弹窗隐藏 iframe 文档的；一级弹窗 iframe 内加载的详情页顶部条（独立文档）不受影响，仍保留（doc/228 确认）。关闭恢复（layer `end` 回调恢复原 display）不变。

**结果**：1.44.3 → 1.44.4（patch，bug 修复）；测试 177；产物 2,198.67 kB。Camoufox 实测确认 iframe 视频页顶部条与列表页同一 class、`TOP_BAR_SEL` 可命中。

**验证摘要**：probe-stack2.py 实测 iframe 视频页（900px 视口加载 `/cn/mkmp-745`）顶部条 class 与列表页一致、z-index 2147483647；一级弹窗 iframe 详情页顶部条为独立文档，不受隐藏影响（doc/228 确认保留不变）；构建/lint/177 测试/结构门禁全绿。

**已知限制（两版共性）**：弹窗打开时列表页/iframe 文档顶部条暂时隐藏、关闭后恢复；一级弹窗 iframe 内加载的详情页顶部条始终保留（独立文档）；若站点未来调整顶部条 class 或 z-index 策略需重新实测。

### 5.4 去除过渡动画（doc/233）

**背景**：用户反馈 missav 的 iframe 弹出层**不要过渡动画**，像 javdb 一样**直接弹出**——过渡动画浪费性能且无作用。

**方案与决策**：对齐 javdb `utils.openPage`（`src/core/common-util.ts`）的参数——`anim: -1`（layer.js 中 `-1` 表示**无进入动画**，直接显示）+ `isOutAnim: false`（**无退出动画**，关闭时直接消失）。

**结果**：1.44.4 → 1.44.5（patch，优化）；测试 177；产物 2,198.57 kB。弹窗直接弹出/关闭无动画，与 javdb openPage 行为一致；无独立前端，产物头部版本号已核对；需用户浏览器实测确认。

**演进链**：228 → 229 → 230 → 231 → 232 → 233 六连调，均为用户实测反馈驱动，弹窗最终形态为 `min(1023, 视口宽-40) × 100%`、打开期间隐藏当前文档顶部条、无动画；232 修正了 231 守卫的误伤（移除 isVideoDetailPath 条件）。

## 6. 评价状态自动校验同步（234—235）

### 6.1 自动校验同步（doc/234）

#### 背景

用户反馈两类（三类）数据错位问题：

1. **评分/已读/收藏**：点击时脚本先写本地 IndexedDB（JHS），再推送 JavDB。网络抖动等原因可能「脚本已写入、服务器未写入」。再次打开该影片时，脚本与 JavDB 状态不一致；
2. **误拦截 bug**：脚本已存下评分但服务器未同步时，用户再点相同评分会被脚本拦截提示「评分未变化」（`quickSetHasWatch` 只看本地记录）；收藏同理（`quickConvertToFav` 拦住「已是已收藏」）。此时服务器其实没有该状态，用户无法通过脚本补推；
3. **视频清单同理**：清单 checkbox 变更在服务器未确认时本地不写（`postJavdbListMutation` 需 `confirmed`），但存在「本地已有关联、服务器未勾选」的错位场景（如恢复日志重推路径、历史数据），原有 `runAutomaticReconciliation` 只做服务器 → 本地方向，会把本地独有关联反向抹掉。

要求：**打开影片时自动核实服务器与脚本状态匹配，按脚本记录向 JavDB 自动同步**，不便时反向（服务器 → 本地）。

#### 方案与决策

**评价状态自动校验（新模块 `dpb-review-sync.ts`）**：详情页 `.review-buttons` 出现后延迟 1.2s 执行一次比对（`plugin._autoSyncChecked` 单页一次）：

- **已完全一致** → 跳过；
- **方向 1（首选）**：脚本有记录、服务器完全没有评价（无想看/无已看）→ 按脚本记录推送：`favorite → triggerJavdbWant()`、`hasWatch → triggerJavdbReview(score)`；
- **方向 2（反向）**：服务器有评价、脚本无记录 → 拉取服务器状态写入本地（含评分）；
- **方向 3（冲突）**：双方均有但状态不一致 → 跳过并 `clog.warn`（沿用 doc/210「绝不降级」原则，避免误覆盖）。

推送经 `_reviewChain` 串行化 + `_wantWatchedSyncing` 阻断 MutationObserver 防递归。

**修复误拦截 bug（`dpb-rating-api.tsx`）**：`quickSetHasWatch` 拦截条件由「本地已 hasWatch + 同分」改为「**服务器**已确认 watched + 同分」，服务器未同步时不再拦截、正常推送；`quickConvertToFav` 拦截条件由「本地已 favorite」改为「**服务器**已确认 want」，服务器未同步时先移除本地再重存，触发重新推送（避免 `saveCar` 抛「已在收藏列表中」）。

**清单本地独有关联自动补推（`vlt-reconcile.ts`）**：`runAutomaticReconciliation` 按「当前影片归属」判断方向：

- **归属一致 + 数量一致** → 跳过；
- **归属一致 + 数量不一致** → 既有全量校准（服务器 → 本地）；
- **本地有关联、服务器未勾选** → 新增 `pushLocalOnlyAssociation`：`postJavdbListMutation(videoId, listId, true)` 补推 JavDB（经 `enqueueAssociationTask` 串行 + Web Lock），成功后按本地 `actualCount` 更新服务器数量显示；失败保留本地并提示；
- **服务器已勾选、本地无关联** → 既有全量校准（服务器 → 本地）。

**恢复日志重推（`vlt-server-recover.ts`）**：`commitAuthoritativeState` 增加：权威状态与 `entry.desiredChecked` 相反时（服务器大概率未写入该项变更），重试 `postJavdbListMutation` 推送期望状态，重推确认后才提交本地；重推未确认则保留恢复日志（下次打开页面再试），避免反向把用户期望抹掉。

**设置开关（`autoServerSync`，默认开启）**：两种自动同步共用同一开关，见「对账校准」面板；关闭后：评价状态自动校验不再执行（`setupAutoReviewSync` 直接不注册）；清单本地独有关联不再补推（保留日志提示）。

#### 实施要点（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/detail-page-button/dpb-review-sync.ts` | **新增**：`readServerReviewState` / `setupAutoReviewSync` / `autoSyncReviewState` / `enqueuePush` |
| `src/plugins/detail-page-button/dpb-rating-api.tsx` | 修复 `quickSetHasWatch` / `quickConvertToFav` 拦截条件为服务器状态 |
| `src/plugins/detail-page-button-plugin.tsx` | 新增 `_autoSyncChecked` 标志；handle() 读 `autoServerSync` 并注册 `setupAutoReviewSync`；头部注释补模块 |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | 新增 `setAutoServerSyncEnabled` / `pushLocalOnlyAssociation`；`runAutomaticReconciliation` 分方向处理 |
| `src/plugins/video-lists-tag/server/vlt-server-recover.ts` | `commitAuthoritativeState` 权威状态与期望相反时重推 |
| `src/plugins/video-lists-tag/vlt-plugin.ts` | handle() 注入 `autoServerSync` 到 `setAutoServerSyncEnabled` |
| `src/components/setting-panels/list-manager-panel.tsx` | 「对账校准」新增 `autoServerSync` 开关 |
| `src/plugins/setting/setting-form-load.ts` | `autoServerSync` 读写（默认开启） |

#### 结果与遗留

**结果**：version 1.44.5 → 1.45.0（minor，新增功能模块；package.json version 字段同步）；测试 177；产物 2,206.89 kB；构建/lint/结构门禁全绿。

**验证摘要**：无独立前端，产物 userscript 头部 `@version 1.45.0` 已核对；自动校验的「本地优先」方向需用户浏览器实测确认（网络/登录态正常时）。

**已知限制**：①自动校验的「本地优先」方向需要用户浏览器实测确认（网络/登录态正常时）；②冲突（本地想看 vs 服务器已看等）默认跳过，需用户手动处理或使用「收藏同步」面板（doc/210）批量核对；③频繁打开大量详情页时会逐页出现同步 toast，属预期提示。

### 6.2 冲突选择弹窗（doc/235，doc/234 增强）

#### 背景

doc/234 的自动校验同步中，方向 3（脚本与服务器双方均有评价状态但不一致，如脚本已看 2 星 vs 服务器已看 4 星、脚本收藏 vs 服务器已看）原先**跳过并记录日志**。用户反馈：冲突场景不应静默跳过，应**弹出确认弹窗让用户选择使用谁的数据**。

#### 方案与决策

**冲突弹窗（新组件 `src/components/dpb/review-conflict-dialog.tsx`）**：`layer.open` type:1 内容弹窗（中标题「评价状态冲突 - 番号」），展示双方状态描述——**脚本记录**：⭐ 已收藏（想看）/ 🔍 已看 N 星 / 🚫 已拉黑；**网站数据**：⭐ 想看 / 🔍 已看 N 星。

三个自绘按钮（`data-conflict-choice` 契约，`success` 回调绑定 click）：

| 按钮 | 行为 |
|------|------|
| 使用脚本记录（local） | 推送脚本 → 服务器：favorite → `triggerJavdbWant()`；hasWatch → `triggerJavdbReview(score)`；filter → `triggerJavdbReview(0)`（同 quickBlock 语义） |
| 使用网站数据（server） | 拉取服务器 → 本地：watched → `saveCar(hasWatch + score)`；want → `saveCar(favorite)`，均广播 + 刷新菜单文案 |
| 取消（cancel） | 本次不处理，下次打开页面再校验 |

**实现要点**：layer.js 仅原生支持两个按钮回调（`yes`/`cancel`，无 `btn3`），故用内容弹窗 + success 回调自绘按钮；关闭钮 / ESC（layer 包装自动挂 setupEscClose）/ 遮罩点击（默认 shadeClose）经 `cancel` 回调统一视为取消，`settled` 防重复结算。

**弹窗类别**：冲突判断沿用 doc/234 方向 3 的到达条件（双方均有状态且不一致），覆盖 favorite/hasWatch/filter 与服务器 want/watched 的任意矛盾组合；已完全一致的状态（服务器想看=脚本收藏、服务器已看同分=脚本已看同分）仍早退，不弹窗。

#### 实施要点与结果

`dpb-review-sync.ts` **重命名 → `.tsx`**（新增 JSX 消费）；方向 3 由「跳过+日志」改为 `confirmReviewConflict` 弹窗 + local/server/cancel 三路处理；头部注释同步。

**结果**：version 1.45.0 → 1.45.1（patch，doc/234 增强；package.json version 字段同步）；测试 177；产物 2,212.09 kB；构建/lint/结构门禁全绿。

**验证摘要**：无独立前端，产物 userscript 头部 `@version 1.45.1` 已核对；弹窗需用户构造冲突场景（如「脚本已看 2 星 vs 服务器已看 4 星」）实测。

**已知限制**：①弹窗需用户浏览器实测确认（构造「脚本已看 2 星 vs 服务器已看 4 星」等冲突场景）；②选择「使用脚本记录」覆盖服务器时不会二次确认（弹窗本身即确认动作）；③冲突弹窗一次页面最多出现一次（单影片单评价状态），不会叠加。

**演进链**：234 确立四方向自动校验与「冲突跳过」缺省，235 将冲突处理从静默跳过升级为显式用户选择（local/server/cancel 三路）。

## 7. javdb 瀑布流 Cloudflare 403 修复（doc/236）

#### 背景

用户反馈 javdb 瀑布流加载报错。现场诊断（用户浏览器实测）：

1. 列表页瀑布流 loader 显示「加载失败，点击重试」（`waterfall-error`）；
2. 页面上下文 `fetch('...?page=2', { credentials: 'include' })` 直接请求下一页 → **200、正常解析出影片条数、非验证页**；
3. Console 捕获脚本报错：`请求失败,状态码: 403` + 响应体为 Cloudflare **Managed Challenge**（`<title>Just a moment...</title>`，`cType: 'managed'`）。

**根因**：瀑布流走 `gmHttp.get()`（`GM_xmlhttpRequest`），该请求缺少 `sec-ch-ua` / `sec-fetch-*` 等浏览器指纹头，被 javdb 的 Cloudflare 按「非浏览器请求」返回 **403 + Managed Challenge**；而页面上下文 fetch 携带浏览器指纹与 Cookie 可正常通过（用户实测 + 脚本内评分/收藏/清单同步历来走页面 fetch 均正常佐证）。

#### 方案与决策

**新增共享工具 `src/core/util/util-fetch-html.ts`**：`fetchJavdbPageHtml(url)`——同源页面 fetch（`credentials: 'include'` + `cache: no-store` + `Accept: text/html`），行为与 vlt-reconcile 原局部 `fetchHtmlDocument` 一致：

- 仅 429/502/503/504 带退避重试（最多 3 次），其余非 2xx 直接抛错；
- Cloudflare 验证页 / 登录页兜底检测抛错（`<title>` 含 cloudflare/just a moment、无 `<body>`、`form[action*="sign_in"]`）；
- 返回原始 HTML 字符串。

**接入点（同源 javdb 页面抓取统一改走页面 fetch）**：

| 文件 | 改动 |
|------|------|
| `src/plugins/auto-page/ap-fetch.ts` | `gmHttp.get(plugin.nextUrl)` → `fetchJavdbPageHtml(plugin.nextUrl)`（**已确认故障点**，覆盖列表页/清单详情页 `/lists/{id}` 瀑布流） |
| `src/plugins/list-waterfall/lw-fetch.ts` | 删除裸 `GM_xmlhttpRequest` 的 `gmGet`，改调 `fetchJavdbPageHtml`（同根因：/users/lists 清单瀑布流） |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | 局部 `fetchHtmlDocument` 重构为共享工具薄包装（去重复实现，行为不变） |

瀑布流其余逻辑（重复番号判定、分页状态机、loader 状态、加载全部）不变。

#### 结果与遗留

**结果**：version 1.45.1 → 1.45.2（patch，bug 修复；package.json version 字段同步）；测试 177；产物 2,211.78 kB；构建/lint/结构门禁全绿。

**验证摘要**：诊断链完整——用户实测页面 fetch 200 非验证页 + 脚本 gmHttp 403 Managed Challenge，根因锁定请求头差异；修复后需用户更新脚本重载列表页 / 清单详情页滚动验证；若浏览器本身被 Cloudflare 挑战仍显示「加载失败，点击重试」，属正常兜底。

**已知限制**：①需用户浏览器实测：更新脚本后重载列表页 / 清单详情页，滚动触发瀑布流翻页，应正常追加（不再出现「加载失败，点击重试」）；②若页面 fetch 仍被 Cloudflare 挑战（浏览器本身被验证），会显示「加载失败，点击重试」，属正常兜底（不会静默伪装成「已经到底了」）；③同根因的 `want-and-watched-videos-plugin.tsx`（JavDB→JHS 批量导入）与 `blacklist-scraper.tsx`（黑名单全量扫描）仍走 `gmHttp.get` 抓 javdb 同源页面，可能同样被 403 拦截；本次未改动（不同功能模块），如需一并修复可复用本工具。

## 8. MissAV 请求回退与登录守卫移除（237—238）

### 8.1 回退 MissAV 请求头为原始脚本方式（doc/237）

#### 背景

用户要求先复刻原始 `archetype/jhs.user.js` 的 MissAV 详情页请求方式进行对比测试。原始脚本在 `OtherSitePlugin.handleSite()` 中使用 `gmHttp.get(searchUrl, null, siteConfig.headers, true)`——原始 MissAV 配置没有额外请求头。当前工程此前额外注入了 `buildBrowserNavHeaders(baseUrl)`，包含 `Referer`、`Sec-Fetch-*`、`Accept-Language` 等浏览器导航头。用户希望暂时移除这层差异，只验证原始请求方式。

#### 方案与决策（实施范围）

仅修改 MissAV 请求调用：

- `src/plugins/other-site/osp-probe.tsx`：详情页即时探测改为传递 `siteConfig.headers`；
- `src/plugins/other-site/osp-preload.tsx`：列表页预加载改为传递 `siteConfig.headers`；
- 移除上述两个文件中未再使用的 `buildBrowserNavHeaders` 导入。

以下内容保持不变：`jhs_other_site` 缓存结构、`preloadCacheTTL` 有效期、列表页预加载队列/并发数/去重/徽标/`blockedSiteIds`、登录页检测、MissAV 解析选择器与结果分类、`followRedirect: true`、失败提示与缓存写入逻辑。

#### 结果

**结果**：version 1.45.2 → 1.45.3（patch，测试性回退）；测试 177；产物 2,211.14 kB；构建/lint/结构门禁全绿。

**性质定位**：本次改动的目标是**对比原始请求方式的实际成功率**，不声称已解决 MissAV 的 CORS 或 Cloudflare 限制。已知限制：MissAV 请求仍从 JavDB 页面通过 `GM_xmlhttpRequest` 发起，浏览器页面 `fetch` 的 CORS 限制仍然存在；本次没有引入 iframe、`postMessage` 或跨页面桥接。待用户更新脚本后，在 JavDB 视频详情页和视频流列表页清除旧缓存并测试 MissAV 查询结果。

### 8.2 删除 MissAV 搜索页登录保护性判断（doc/238）

#### 背景

当前工程后续新增了 MissAV 搜索页登录检测：当响应 HTML 被识别为登录页时，详情页显示黄色警告，列表页预加载标记失败并输出「搜索页需要登录，跳过预加载」。用户要求恢复与原始 `archetype/jhs.user.js` 一致的行为——原始脚本没有登录页判断，而是请求后直接按 `.text-secondary` 解析搜索结果，未找到结果时按原有未命中逻辑处理。

#### 方案与决策（实施范围）

删除以下新增保护性判断：

- `src/plugins/other-site/osp-probe.tsx`：删除详情页登录表单、密码输入框和登录关键词检测；清理详情页检测残留的 `siteName` 局部变量；
- `src/plugins/other-site/osp-preload.tsx`：删除列表页登录页检测、失败徽标更新和「搜索页需要登录，跳过预加载」日志。

保留：原始 `gmHttp.get(searchUrl, undefined, siteConfig.headers, true)` 请求方式；现有缓存、TTL、列表页预加载队列、并发限制、去重、状态徽标和 Cloudflare 错误分类；搜索结果解析与未命中处理。

#### 结果与经验结论

**结果**：version 1.45.3 → 1.45.4（patch，行为回退）；测试 177；产物 2,209.63 kB；构建/lint/结构门禁全绿。

**用户安装 1.45.4 后实测确认**：MissAV 列表页预加载恢复正常；原因确认为后续新增逻辑偏离原始脚本请求/解析流程，导致预加载失败；恢复原始 `gmHttp.get(searchUrl, undefined, siteConfig.headers, true)` 请求方式，并删除登录页保护性判断后，预加载可以正常工作。

**经验结论**（原文记录）：不要在没有实测证据的情况下为 MissAV 额外添加请求头模拟或登录页保护分支；后续应保持原始请求方式，避免再次引入未经验证的行为差异。已知行为：MissAV 返回登录页时，不再单独显示「需要登录」保护提示，而会按照原始脚本流程继续解析；如果解析不到 `.text-secondary`，将按原有「未命中」路径处理。

**演进链**：237 回退请求头 → 238 回退登录守卫，两步共同完成「MissAV 行为对齐原始脚本」；238 附用户实测确认与教训总结。

## 9. 依赖升级与收尾（239—242）

### 9.1 第三方库打包 → CDN @require 外部引入（doc/239）

#### 背景

doc/24 将 7 个第三方库（jquery / tabulator-tables / toastify-js / localforage / viewerjs / blueimp-md5 / layui-layer）从 `@require` CDN 改为 ESM import 打包进产物，产物膨胀至 **2,209.63 kB**（gzip 511.88 kB，1.45.4 实测）。用户要求反转打包方式：**脚本库 JS 不打包，改为通过 CDN URL 外部引入**（userscript 头部 `@require`）；库 CSS 继续打包（实测仅 ~88.9 KB，占产物 ~4%）。

#### 方案与决策

**`build.externalGlobals`（vite-plugin-monkey v8 内置）**：`'模块名': ['CDN 全局变量名', '@require URL', ...]`——模块标记为 bundle external 不打包进产物；import 绑定编译为对 CDN 全局的访问（IIFE 参数注入）；URL 自动写入 userscript 头部 `@require`（仅当模块被实际 import）。

**命名导入陷阱（Tabulator，关键）**：最小实验（临时工程构建验证）确认 IIFE 全量 interop（`__toESM`）行为：

| 写法 | 编译产物 | 运行时结果 |
|------|----------|-----------|
| `import { TabulatorFull } from 'tabulator-tables'` | `tabulator_tables.TabulatorFull` | **undefined**（CDN 全局 `Tabulator` 无 `TabulatorFull` 静态属性） |
| `import Tabulator from 'tabulator-tables'` | `tabulator_tables.default` | ✓ 完整类本身 |

CDN `tabulator.min.js` 的全局 `Tabulator` 本身就是含全部模块的完整类（UMD 返回值即 `TabulatorFull`）。故 **libs.ts 必须改默认导入**；其余 6 库默认导入均编译为 `.default` 访问，正常。

**CSS 处理**：库 JS 外部化后，layer.js 不再打包，其 `require('./layer.css')` 自动带入的 layer.css 会丢失，需在 libs.ts **显式 `import 'layui-layer/layer.css'`**；其余 3 个库 CSS（toastify / viewer / tabulator）继续打包。实测打包产物中 4 段库 CSS 共 **91,015 B（~88.9 KB）**，占产物 ~4%：layer.css 45,044 B（其中 35,320 B 为 6 个 base64 内联图片）/ tabulator 37,375 B / viewer 7,514 B / toastify 1,082 B——移 CDN 收益极小，且引入样式加载网络依赖与闪烁风险，故 CSS 保留打包。

**类型 shim**：tsconfig 无 `esModuleInterop`，`tabulator-tables` 此前无 paths shim（真实包无 default 导出），默认导入需新增 shim（`src/types/tabulator-shim.d.ts`：`declare const Tabulator: any; export default Tabulator;`，与 jquery-shim 同模式）+ `tsconfig.app.json` paths 新增 `"tabulator-tables": ["./src/types/tabulator-shim.d.ts"]`。

**CDN URL（与原始 archetype/jhs.user.js 完全一致，全部实测 200）**：

```
jquery@3.7.1/dist/jquery.min.js
tabulator-tables@6.3.1/dist/js/tabulator.min.js
layui-layer@1.0.9/dist/layer.min.js
blueimp-md5@2.19.0/js/md5.min.js
toastify-js@1.12.0/src/toastify.min.js  ← jsdelivr 动态 minify src/toastify.js
localforage@1.10.0/dist/localforage.min.js
viewerjs@1.11.1/dist/viewer.min.js
```

qrcodejs（全项目未使用）与 parallel_GM_xmlhttpRequest（GreasyFork URL 410 失效）不引入。

#### 实施要点（修改文件清单）

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | version 1.45.4→1.46.0；新增 `build.externalGlobals`（7 映射 + CDN URL）；更新 @require 注释 |
| `src/core/libs.ts` | `import { TabulatorFull }` → `import Tabulator`（默认导入）；`window.Tabulator = Tabulator`；export 同步；显式 `import 'layui-layer/layer.css'`；注释更新为 CDN 说明 |
| `src/types/tabulator-shim.d.ts` | **新增**：`declare const Tabulator: any; export default Tabulator;`（与 jquery-shim 同模式） |
| `tsconfig.app.json` | paths 新增 `"tabulator-tables": ["./src/types/tabulator-shim.d.ts"]` |
| `src/types/globals.d.ts` | 头部注释更新（库来源改为 CDN @require 注入页面全局） |
| `package.json` | version 1.45.4→1.46.0（与 userscript.version 同步） |

#### 结果与遗留

**结果**：version 1.45.4 → 1.46.0（minor）；产物 **1,167.82 kB**（gzip 299.67 kB），较 1.45.4 基线 2,209.63 kB **-1,041.81 kB（-47%）**；产物头部 `@require` 恢复 7 行 CDN URL（顺序与 archetype 一致）；产物 IIFE 尾部 `})($, layer, Tabulator, Toastify, localforage, Viewer, md5);` 正确接收 7 个 CDN 全局；interop 校验 `window.Tabulator = tabulator_tables.default`（**无** `Tabulator.TabulatorFull` 访问）；4 段库 CSS 仍在产物（`_css(` ×4）；测试 177 全绿；lint 0 errors。

**验证摘要**：`tsc -b && vite build` 通过；`window.layer/jQuery/Viewer/md5/localforage` 均 `.default` 访问；7 个 CDN URL 全部实测 200。

**已知限制**：①恢复 CDN 网络依赖——jsdelivr 不可用时库加载失败、功能全挂（Tampermonkey 会缓存 @require，缓解部分风险）；②库版本锁定在 URL 中，升级需手动改 vite.config.ts 的 externalGlobals；③`@types/tabulator-tables` 仍驻留 devDependencies 但不再被模块解析使用（shim 接管），属无害冗余，暂不清理。

**后续验证建议**：在 GreasyFork/Tampermonkey 实测安装与更新（@require 拉取与缓存）；建议真机回归收藏/已看/评分、Tabulator 表格、layer 弹窗、toast、图片查看器、md5 相关（WebDav 备份加密）；若未来 jsdelivr 不可用，可将 CDN 域名换为 unpkg/bootcdn 等镜像（externalGlobals 单点修改）。

### 9.2 工具链依赖升级（doc/240）

#### 背景

用户要求将项目依赖升级至最新版（2026-08-09 时点）。

#### 方案与决策（工具链，本批执行）

| 包 | 旧版本 | 新版本 | 说明 |
|----|--------|--------|------|
| vite | ^8.0.11 | ^8.2.1 | minor |
| vite-plugin-monkey | ^8.0.0 | ^8.1.0 | minor |
| @vitejs/plugin-react | ^6.0.3 | ^6.0.5 | patch |
| react（dependency） | ^19.2.6 | ^19.2.8 | patch |
| eslint | ^10.7.0 | ^10.8.1 | patch |
| typescript-eslint | ^8.65.0 | ^8.66.0 | patch |
| jsdom | ^29.1.1 | ^30.0.1 | major（仅测试环境） |
| @types/node | ^26.1.1 | ^26.2.0 | patch |
| @types/react | ^19.2.14 | ^19.2.18 | patch |

**保持锁定（运行时 CDN 库，不升级）**：7 个运行时库的 npm 版本与 `vite.config.ts` `externalGlobals` 的 CDN @require URL 严格同步（doc/239 架构），升级即改运行时行为、违背「与原始脚本零偏差」原则：

- **blueimp-md5 / layui-layer / localforage / toastify-js**：本已是 latest，无需动；
- **jquery 3.7.1 → 4.0.0**（major）：jQuery 4 移除大量废弃 API，全项目未类型化 `$` 调用 + 全部集成脚本均按 3.x 行为编写，升级风险高且 CDN URL 需同步；
- **tabulator-tables 6.3.1 → 6.5.2 / viewerjs 1.11.1 → 1.11.8**（minor）：CDN URL 需同步，改运行时行为。

**typescript 7.0.2 尝试后回退**：尝试过 `typescript@^7.0.2`（native 编译器），`tsc -b` 构建通过；**但 typescript-eslint 8.66.0 硬性拒绝 TS 7.0**（`typescript-eslint does not support TS 7.0`，追踪 issue #10940，支持需等 TS ≥7.1），lint 门禁失败；回退至 `typescript@^6.0.3`，待 typescript-eslint 支持后另行升级。

#### 实施与结果

`package.json` 按升级清单更新（`bun add` / `bun add -d` + `bun install` 更新 bun.lock 与 node_modules）；其余文件零改动（不触碰 src/，**不升 userscript.version**——依赖升级不改变用户脚本逻辑，保持 1.46.0）。

**结果**：产物 1,168.26 kB（gzip 299.73 kB），`@require` 7 行、Tabulator interop `.default` 均正确；测试 177 全绿（jsdom 30）；lint 0 errors（eslint 10.8.1 + typescript-eslint 8.66.0 + TS 6）；结构门禁 OK（build/test/lint/check:structure 四门禁全绿）。

**已知限制**：typescript 7.0 待 typescript-eslint 支持（TS ≥7.1）后再升级；jquery 4.0.0 / tabulator 6.5.2 / viewerjs 1.11.8 如需升级，须连同 vite.config.ts CDN URL 同步修改并做运行时回归（用户未确认，暂不动）。

### 9.3 tabulator-tables 6.5.2 + viewerjs 1.11.8 升级（doc/241）

#### 背景

doc/240 升级工具链时，7 个运行时 CDN 库保持锁定（版本与 `externalGlobals` URL 严格同步）。用户随后确认：**tabulator-tables 与 viewerjs 可以升级**（npm 包 + CDN URL 同步），jquery 4.0.0 需验证后再定，暂不动。

#### 方案与决策

| 库 | 旧版本 | 新版本 | 升级类型 |
|----|--------|--------|----------|
| tabulator-tables | 6.3.1 | **6.5.2** | minor（bugfix + 新特性），CDN URL + npm 包同步 |
| viewerjs | 1.11.1 | **1.11.8** | minor（bugfix），CDN URL + npm 包同步 |

- `vite.config.ts` `externalGlobals` 两处 URL 同步改版本（npm 打包 CSS 与 CDN JS 必须同版本，否则 UI 错位）；
- 其余 5 库（jquery 3.7.1 / layer 1.0.9 / md5 2.19.0 / toastify 1.12.0 / localforage 1.10.0）保持不动；
- 版本号 1.46.0 → **1.46.1**（运行时库行为变化，需用户更新脚本）。

#### 实施与结果

修改 `package.json`（tabulator-tables 6.3.1→6.5.2、viewerjs 1.11.1→1.11.8，exact 锁定风格不变；version 1.46.1）、`bun.lock`（bun add 更新）、`vite.config.ts`（externalGlobals 两处 URL 版本更新；注释更新——tabulator/viewer 为本次升级，jquery 待验证）。

**结果**：CDN URL 探测（4 个：两库 JS + 两库 CSS）全部 200，CSS 路径（tabulator_semanticui.min.css / viewer.min.css）不变；产物 1,168.21 kB（gzip 299.25 kB），`@require` 含 tabulator@6.5.2 / viewerjs@1.11.8，`@version 1.46.1`；tabulator 6.5.2 UMD 全局仍 `return TabulatorFull`（interop 默认导入不变）；测试 177 全绿；lint 0 errors。

**已知限制**：与原始 archetype 的 tabulator/viewer 版本偏差属**有意升级**（用户确认），doc/239 的「URL 与 archetype 完全一致」表述自此对这两库不再成立；jquery 4.0.0 升级待用户另行确认后处理（需运行时回归）。后续验证建议：真机回归 Tabulator 表格（formatter/排序/分页）与 Viewer 图片查看器（缩放/旋转/全屏）。

### 9.4 jquery 3.7.1 → 4.0.0 升级（doc/242）

#### 背景

doc/241 升级 tabulator/viewerjs 时，jquery 4.0.0 因大版本变更暂缓，用户要求先验证可行性再决定。可行性验证结论（jsdom 实测 + 全量代码扫描）：**可行、低风险**。用户确认执行，并同时要求新增 jquery×layer 兼容回归测试。

#### 前置可行性验证（摘要）

- CDN `jquery@4.0.0/dist/jquery.min.js` 返回 200；
- jsdom 冒烟：layui-layer 1.0.9 + jquery 4.0.0 全兼容（`ready.run(jQuery)` 初始化、`layer.open/msg/close/load/tips` 正常、`$(window).width()/.height()/.scrollTop()` 无异常）；
- src/ 全量扫描：jQuery 4 移除的 13 个静态方法（`$.trim/isArray/parseJSON/type/now/isNumeric/isFunction/isWindow/camelCase/nodeName/cssNumber/cssProps/fx.interval`）、`toggleClass(布尔)` 签名、原型 `push/sort/splice`、`.size()`、`:even/:odd`、`.attr(name,false)` —— **全部零命中**；
- 先例：archetype/pageSort.user.js 本即 `@require jquery@4.0.0`；@types/jquery 已是 ^4.0.1。

#### 方案与决策

| 项 | 内容 |
|----|------|
| npm 包 | `jquery` 3.7.1 → **4.0.0**（exact 锁定，与 CDN 同步） |
| CDN URL | `externalGlobals.jquery` → `jquery@4.0.0/dist/jquery.min.js` |
| 版本号 | 1.46.1 → **1.46.2**（patch，运行时库变更） |
| 回归测试 | 新增 `tests/jquery4-layer-compat.test.ts`（6 用例，jsdom） |

**不改任何 src/ 业务代码**（libs.ts / _jquery-global.ts / types shim 对外部化与 any 声明不敏感）。

#### 回归测试设计要点

- `// @vitest-environment jsdom`；`window.eval` 按 @require 顺序注入 `node_modules/jquery/dist/jquery.min.js` → `layui-layer/dist/layer.js`（与 CDN 同源同版）；
- **坑 1**：vitest jsdom 下动态 `<script>` 注入不执行（实测），改用 `window.eval`；
- **坑 2**：layer.js 的 `ready.getPath` 读 `document.scripts[last].src`，eval 环境无 script 元素抛 `Cannot read ... 'src'`——先插入占位 `<script src=...>` 解决；
- 断言：jquery 版本 4.0.0、layer 初始化、`$(window)` 尺寸 API 不抛错、`layer.open` 产出 `.layui-layer` DOM / close / closeAll / msg / load / tips、项目常用 jQuery API 冒烟。

#### 实施与结果

修改 `package.json`（jquery 3.7.1→4.0.0；version 1.46.1→1.46.2）、`bun.lock`、`vite.config.ts`（externalGlobals jquery URL → 4.0.0；注释更新；userscript.version 1.46.2）；新增 `tests/jquery4-layer-compat.test.ts`。

**结果**：version **1.46.2**；产物 1,168.21 kB（gzip 299.24 kB），`@require` 含 `jquery@4.0.0`，`@version 1.46.2`，`window.jQuery = jquery.default` interop 不变；测试 **13 文件 183 用例**全绿（177 + 新增 6）；lint 0 errors。

**已知限制**：①**focus/blur 事件顺序改为 W3C 标准**（blur→focusout→focus→focusin），若发现依赖旧顺序的交互需单独处理；②`.attr(name, false)` 现在删除属性（src/ 零命中，无影响）；③移除 IE<11/旧浏览器支持（现代浏览器运行无影响）。

**后续验证建议**：真机回归确认 focus 相关交互与全部 layer/Tabulator 功能（layer 弹窗打开/关闭/拖拽、Tabulator 表格排序/分页/formatter、跨标签页同步、toast、图片查看器）；若 jquery 后续出 4.0.x patch，按 doc/241 同模式升级（npm + CDN URL 同步）。

**演进链**：239 确立 CDN @require 架构与「npm 版本 = CDN URL 版本」约束 → 240 升级工具链但运行时库锁定 → 241 按用户确认升级 tabulator/viewer（升级先例）→ 242 经可行性验证升级 jquery 4.0.0 并新增兼容回归测试锁定 layer 兼容性。

## 10. 演进链与遗留问题汇总

### 演进链（主要线索）

- **MissAV 请求行为对齐原始脚本**：doc/237（回退请求头）→ doc/238（删除登录守卫，用户实测确认恢复）；经验结论——不要无实测证据为 MissAV 添加请求头模拟或保护分支。
- **视频预览弹窗**：doc/228（初版，捕获拦截 + iframe 弹窗）→ 229/230（宽度 1023 / 高度 100%）→ 231（隐藏列表页顶部条）→ 232（修正 231 守卫误伤，改为隐藏当前文档顶部条）→ 233（去动画）；依据 doc/227 的 `isVideoDetailPath` 守卫实现 iframe 内插件自动跳过。
- **评价状态同步**：doc/234（四方向自动校验 + autoServerSync 开关）→ 235（冲突跳过升级为显式选择弹窗）。
- **依赖收尾**：doc/239（CDN @require 反转，产物 -47%）→ 240（工具链升级，TS 7 尝试回退）→ 241（tabulator/viewer 升级）→ 242（jquery 4.0.0 升级）。
- **被回退的方案**：doc/226 视频页按钮独立分组被 227 回退（恢复与原生同一行，样式对齐保留）；doc/222 计划将筛选前缀并入 filter-chip-base 共享基础被 223 回滚（改独立 nord 暗色样式）。

### 遗留问题

- **待用户浏览器实测**（各 doc 共有的共性遗留）：missav.ai 域名功能（218）；标签首屏渲染即时性（219）；瀑布流三按钮交互与封面（221）；筛选器芯片交互与暗色融合度、cell 重排（222/223）；「加载全部」左下角视觉（224）；视频页按钮与筛选栏观感（227）；视频预览弹窗交互与嵌套（228）；自动校验「本地优先」方向与冲突弹窗（234/235）；javdb 瀑布流 403 修复（236）。
- **Alpine 预览指令**：瀑布流追加节点不触发 Alpine init 曾列为风险（220），后经用户实测确认真实环境正常（221），未处理——若回归需 `Alpine.initTree(container)` 或剥离指令。
- **已知行为偏差**：筛选器第三级挂载回退对 grid 执行 afterend（222，主挂载存在时不触发）；doc/239「URL 与 archetype 完全一致」对 tabulator/viewer 两库不再成立（241）。
- **未处理但可复用能力**：`want-and-watched-videos-plugin.tsx` 与 `blacklist-scraper.tsx` 仍走 `gmHttp.get` 抓 javdb 同源页面，可能被 Cloudflare 403 拦截，可复用 `fetchJavdbPageHtml` 一并修复（236）。
- **待后续升级**：typescript 7.0 待 typescript-eslint 支持（TS ≥7.1）后再升级（240）；jquery 4.0.x patch 按 doc/241 模式升级（242）；jsdelivr 不可用时可将 externalGlobals CDN 域名换为 unpkg/bootcdn 等镜像（239）。
- **版本演进总览**（本阶段 11 个版本）：1.40.0 →（218）→ 1.40.1 →（219）→ 1.40.2 →（220）→ 1.41.0 →（221）→ 1.42.0 →（222）→ 1.43.0 →（223）→ 1.43.1 →（224）→ 1.43.2 →（225）→ 1.43.3 →（226）→ 1.43.4 →（227）→ 1.43.5 →（228）→ 1.44.0 →（229）→ 1.44.1 →（230）→ 1.44.2 →（231）→ 1.44.3 →（232）→ 1.44.4 →（233）→ 1.44.5 →（234）→ 1.45.0 →（235）→ 1.45.1 →（236）→ 1.45.2 →（237）→ 1.45.3 →（238）→ 1.45.4 →（239）→ 1.46.0 →（240，不升版）→ 1.46.1 →（241）→ 1.46.2 →（242）。