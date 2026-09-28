# JavDB Power Tools 文档中心

> 本文档是项目全部文档的**索引、规范与要求**的唯一入口。
> 架构说明（目录结构 / 插件系统 / 构建配置 / 代码风格）见根目录 `AGENTS.md`；产品设计约束见 `PRODUCT.md`。
> 本文档只负责：① 所有文档的索引与说明；② 文档规范；③ 文档相关的各项要求。

## 1. 文档索引与说明

项目文档体系由两类组成：

- **阶段文档**（`docs/NN-主题.md`）：按时间线合并的 11 份历史档案，覆盖原 `doc/01`~`doc/242` 全部历史变更。内容已精简融合（含义与原文档一致，删除构建输出回放、逐条验证步骤等过程性细节），保留背景/根因、方案与决策、实施要点、结果（版本/产物/测试）、演进链与遗留问题。
- **变更文档**（`docs/NN-描述.md`，NN 从 12 继续递增）：每次 `src/` 代码变更的随行记录（规范见 §3.1）。文件编号与阶段文档连续。

### 1.1 文档索引（阶段文档 + 变更文档）

| 文件 | 类型 | 阶段 / 编号 | 内容概览 |
|------|------|-------------|----------|
| `01-refactor-and-components.md` | 阶段 | 重构与组件化（doc/01–24） | 重构总计划、CSS 提取、插件外置、HTML→组件、jsxToString/TSX 迁移、库 ESM 迁移 |
| `02-script-integration-and-cleanup.md` | 阶段 | 独立脚本集成与清理（doc/25–48） | 13 个独立油猴脚本集成模式、死代码清理、FC2 恢复、terser、大型合并集成（VLT/跨站同步） |
| `03-features-and-fixes.md` | 阶段 | 功能迭代与修复（doc/49–75） | MissAV 快速复制、发布准备、自动收藏三连、新增清单五连修、清单同步重写、自动备份、评分缓存、UI 美化 |
| `04-upgrade-and-cleanup.md` | 阶段 | 升级对照与功能清理（doc/76–98） | 3.3.6.027 升级（批次 A–D）、CoverButton 删撤链、ESC 六次迭代、功能移除与恢复 |
| `05-list-preload-and-history.md` | 阶段 | 列表增强与预加载（doc/99–117） | 「加载全部」按钮、排序丢失连环修复、预加载徽标/筛选栏/面板、访问记录插件、缓存备份 |
| `06-waterfall-and-list-sync.md` | 阶段 | 瀑布流与清单同步（doc/118–129） | 瀑布流加载模式演进、快捷设置、等待更新联动、服务端/本地关联分叉根治、列表面板改版 |
| `07-architecture-and-tooling.md` | 阶段 | 架构审计与工具链（doc/130–148） | 六维度审计、PluginMap 注册表、类型安全、数据迁移版本化、安全加固、Runtime V2、ESLint/Stylelint |
| `08-consistency-and-atomization.md` | 阶段 | 一致性治理与原子化（doc/149–179） | 工程约定固化（§9/§10/§11 由来）、测试基建、HTML→TSX 提取、大文件拆分、Wave1–4、收敛验证 |
| `09-reuse-and-cross-site-sync.md` | 阶段 | 复用收敛与跨站同步（doc/180–199） | CSS 复用、pageTypes 门控修复、XSS 加固、跨站同步协议演进（187→195）、共享基础设施 |
| `10-list-management.md` | 阶段 | 清单功能深化（doc/200–217） | 清单序号合并、编号整理压实（期0–期2）、清单管理器、收藏双向同步、Git 备份通道 |
| `11-missav-and-finale.md` | 阶段 | MissAV 专区与收尾（doc/218–242） | MissAV 专区功能（瀑布流/筛选/预览弹窗）、评价状态自动校验、CDN @require 反转、依赖升级 |
| `12-indexeddb-persistent-data-migration.md` | 变更 | v1.46.3–1.46.4 | JavDB 大型 localStorage 缓存与恢复日志迁移；保留现有 JavDB/MissAV IndexedDB 和 GM 跨站同步 |
| `13-merged-row-uncheck-silent-failure.md` | 变更 | 待办（未修复） | 详情页合并行「取消」动作端与展示端共用同一原生 checkbox 查找器导致的静默失败；现场取证、代码定位与候选修法，待可复现时处理 |
| `14-visit-history-no-limit-and-fallback-lookup.md` | 变更 | v1.46.5 | 访问记录取消 5000 条上限；新增 `lookupVisitTime` 回退匹配（同 pathname 最新记录），修复翻页/筛选参数不一致时误报「无访问记录」 |
| `15-other-site-preload-cache-remove-limit.md` | 变更 | v1.46.6 | 外站预加载缓存取消 5000 条上限（删除 `PRELOAD_CACHE_MAX`/`evictStaleCache` LRU 淘汰）；有效期仍由 `preloadCacheTTL` 控制 |
| `16-design-system-context-and-detector-exceptions.md` | 变更 | v1.46.7 | 建立 `DESIGN.md` 视觉设计系统快照（按实际渲染值重建，区分意图斜坡与存量普查阶）；记录 7 个样式表的零偏差契约；检测器 warning 14 → 0（3 项真实修复 + 8 条带理由的例外登记） |
| `17-setting-surface-distill-and-harden.md` | 变更 | v1.46.8 | 设置界面收敛（评审 25/40 的后续执行）：三套按钮 + 两套开关 distill 为单一 `.jhs-btn`/`.jhs-toggle`；`#clean-all` 加确认框；侧栏 10 面板改 `role=tab` 按钮并支持方向键；移除两处装饰性渐变；危险按钮隔离与图标去重 |
| `18-setting-cache-action-relocation.md` | 变更 | v1.46.9 | 「清理全部缓存」从底栏移回缓存管理面板内部（它原与「保存设置」共用底栏栅位，开缓存管理时两者互换）；底栏恒为「保存设置」、位置不再变化 |
| `19-aria-serialization-and-tabpanel-fix.md` | 变更 | v1.46.10 | 修 `jsxToString` 把 `aria-*` 当 HTML 布尔属性序列化的缺陷（`aria-selected` 渲染为空串/属性缺失）；补齐 10 个面板的 `role=tabpanel` + `aria-labelledby` 关联；新增 4 条 ARIA 回归用例。由 chrome-devtools MCP 接入真实浏览器实测发现 |
| `20-cache-button-hierarchy-and-stylelint-cleanup.md` | 变更 | v1.46.11 | 缓存卡片三按钮由「三个同级实心彩块」收敛为「一个主操作 + 两个描边次级」（新增 `.jhs-btn--danger-ghost` 变体）；`fold-category-plugin.css` 的运行时占位符加 `stylelint-disable` 说明，`lint:css` 首次全库零告警 |
| `21-javdb-selector-audit.md` | 变更 | v1.46.12 | JavDB 选择器核验与女演员新旧兼容修复；实测详情/列表/演员/标签/高级搜索/榜单/用户清单等 80+ 项；已装构建端到端复测确认 `.highlighted` 11/11 生效；actress-info 与存储/迁移未动 |
| `22-site-selector-registry.md` | 变更 | v1.46.13 | 站点选择器收敛为单一注册表 `src/core/util/site/selectors.ts`（站点原生选择器事实表 + 新旧兼容查询 API）；新增 `bun run check:selectors` 棘轮门禁（禁新增裸站点字面量，两个失败分支已负向验证）；实测站点依赖面 284 处 / 90 文件 |
| `23-locale-zh-cn-adaptation.md` | 变更 | v1.46.14 | JavDB 简体中文（`?locale=zh-CN`）适配：`a[title="複製番號"]` 在简体/英文下失效（致命，carNum 断链），改走语言无关的 `.panel-block.first-block a[data-clipboard-text]`；注册表新增 `SITE_TEXT_VARIANTS` 多语言变体 + `textMatchesAny`/`queryActorMetaNameRows`/`isMaleActorPage`/`queryPublishTimeText`；三语言 fetch 实测取证 |
| `24-read-status-score-filter.md` | 变更 | v1.46.15–1.46.16 | 已读星级筛选（第 1 项增量）：`stf-score.ts`（car_list → `carNum→{status,score}` 索引，0–5 归一化）+ 筛选栏 6 个星级芯片（`0星`…`5星`）+ `stf-apply` 星级匹配；**判定不依赖 DOM 是否渲染「已读」标签**。增量二：`stf-render.ts` 从缓存**补渲染**缺失的状态标签（注入点三级回退）。共新增 13 用例 |
| `25-preload-priority-deprioritize-stated.md` | 变更 | v1.46.17 | 预加载优先级（第 2 项上半）：新增纯函数 `osp-preload-order.ts` 的 `orderItemsByPreloadPriority`，把带状态标签（已读/已收藏）的卡片稳定重排到队列末尾；判定以 car_list 为准（不依赖 DOM 标签）；新增 5 用例 |
| `26-preload-request-list-panel.md` | 变更 | v1.46.18 | 批量预加载请求列表面板（第 2 项下半）：`AsyncTaskQueue` 增任务句柄（getTasks/cancel/prioritize + 取消自检）；新增 `PreloadTaskRegistry`（失败留存/容量淘汰）与浮层面板（「请求列表」入口 → 队列可视化 + 重试/取消/置顶）；`enqueuePreloadTask` 抽取供首轮与重试共用；取消同步清除卡片徽标。新增 20 用例 |
| `27-list-batch-actions.md` | 变更 | v1.46.19 | 列表页勾选式批量操作（第 3 项，收口）：纯逻辑 `lp-batch-state.ts`（勾选集合 + 收藏/已读/取消已读三类写入计划）+ 卡片勾选框与底部工具栏（复用 status-tag 注入点）+ 新增存储原语 `clearCarWatchStatus`（**只清 status、保留记录**）。新增 9 用例 |
| `28-missing-score-fallback-ratingcache.md` | 变更 | v1.46.20 | **修正 doc/24 §7 的错误判断**：缺失 score 的可信来源就是已实现的「JavDB 个人评分」机制（`rating-display` 的 `RatingCache`）。索引新增 `hasScore`（区分「无 score」与「评 0 分」）+ 可选**注入式**回退源 `setScoreFallbackResolver`；插件加载缓存并注册变更钩子（抓分后芯片计数自动刷新）。仍**不写 car_list**。新增 8 用例 |
| `29-rating-persistence-and-backup-audit.md` | 变更 | v1.46.21 | 评分持久化 + 全插件评分存储审计：新增 `rating-persist.ts`（抓到评分后**落库 car_list**，只补空缺、不覆盖）；`watched-from-javdb` 不再写死 `score: 0`（遮蔽回退的污染源）；`RatingCache.onChange` 单槽→ `addChangeListener` 监听器集合；审计确认 car_list / RatingCache / VltDb / lrs 均已在备份范围。新增 7 用例 |
| `30-ui-polish-from-field-testing.md` | 变更 | v1.46.22 | 实测反馈打磨（impeccable polish）：请求列表入口改**紧凑硬按钮 + 发丝线分隔**（不再像芯片），面板**屏幕居中 + 可拖动**；星级芯片改为 `visibleScoreChips` **只显示当前页存在的档位**；勾选框画**白对号 + 卡片选中描边**、新增 `全选/反选/清空`、操作按钮复用既有 `.a-*` 语义色（收藏橙 / 已读绿 / 取消已读红）。新增 8 用例 |
| `31-batch-push-to-javdb-background-queue.md` | 变更 | v1.46.23–1.46.24 | 批量操作 → JavDB **后台推送队列**：新增 `lp-batch-sync.ts`（入队即返回，900ms/项节流串行 + 每项重试 2 次 + 汇总提示），复用 `sync-common` 的 `postWantToWatch`/`postWatched`；尊重 `autoServerSync` 开关；`destroy` 终止队列。v1.46.24 起**取消已读也推送**（`findReviewIdInHtml` 取 reviewId → `deleteReview` 删评价记录；用户已确认不写评价正文）。新增 12 用例 |
| `32-batch-bar-docked-ratingbar.md` | 变更 | v1.46.26 | 实测反馈二轮（impeccable polish）：批量操作条改为**常驻**挂筛选栏尾部（不再浮出、不随勾选数出现）；操作组与详情页快捷评分条**同构**（五颗星 + 收藏/已读/拉黑，复用 `rating-bar.css` 类名与配色）；新增 `planFilterBatch`（拉黑批量）与 `BatchActionKind='filter'` |
| `33-batch-ui-layering.md` | 变更 | v1.46.27 | 批量操作 **UI 分层**（实测反馈三轮）：选择类（请求列表/全选/反选/清空）改**常驻竖排栏**固定在视频流左侧屏幕中部、不随滚动；内容操作（五星+收藏/已读/拉黑）保持**浮出条**；请求列表入口迁至侧栏并经自定义事件解耦。含 §3 回归：**修复侧栏按钮「点了没反应」**（委托白名单漏配侧栏容器 → 抽 `isBatchUiControl` + 6 用例） |
| `34-load-all-docked-in-side-column.md` | 变更 | v1.46.28 | 「加载全部」**并入左侧常驻竖排栏**（同风格 + 主色区分）：侧栏新增「选择组槽位」（容器+槽位，刷新不再冲掉外部停靠按钮）；auto-page 停靠（带重试/降级）；停靠形态几何沿用 `.jhs-lp-batch-side-btn`、仅覆写配色为**主色实底**。新增 3 用例（槽位刷新保活） |

### 1.2 站点参考文档（固定名称，持续维护）

记录宿主站点（JavDB）自身的视觉语言与 DOM 结构，作为增强层“并入原站”原则的事实基线与开发依据。随站点改版更新，不占编号。

| 文件 | 类型 | 内容概览 |
|------|------|----------|
| `javdb-site-style.md` | 参考 | JavDB 站点视觉风格：Bulma 基座、字体栈、Bulma 语义色 + JavDB 自有强调色（导航 `#0a0a0a`、演员链接 `#f09`、评分 `#fc8300`）、暗色主题、圆角/阴影、布局与断点、组件规则、与增强层对接要点 |
| `javdb-site-structure.md` | 参考 | JavDB 站点结构：页面类型与通用骨架、详情/列表/演员/标签/用户清单/系列/榜单/搜索页的 DOM 层级与容器关系、扩展注入标记、选择器实测计数 |

## 2. 文档规范

### 2.1 存放位置与命名

- 文档一律存放于 `docs/` 子目录；`docs/` 只放文档及必要的文档资源，不放业务代码。
- 需要顺序管理的文档采用 `NN-描述.md`（如 `12-indexeddb-persistent-data-migration.md`），编号在 `docs/` 内全局连续递增（阶段文档 01–11 → 变更文档 12、13…）。
- 持续维护的当前状态文档使用固定名称（`README.md`、`plugin-catalog.md`）。
- 每个独立文档分类目录应包含 `README.md`，至少记录文档清单、文档类型、当前状态、推荐阅读顺序、相关代码/配置链接、已废弃与替代关系。

### 2.2 文档类型

| 类型 | 用途 |
|------|------|
| 📋 接口契约 | API、协议、请求响应、错误码和联调约定 |
| 🔧 开发指导 | 待执行/已执行的技术修改方案和验证步骤 |
| 📄 参考说明 | 调试记录、设计说明、现状分析和备忘信息 |
| 🚀 部署运维 | 部署、环境、配置、监控和故障处理 |
| 🧭 架构决策 | 重要技术选型、取舍、影响与替代方案 |
| 🧾 变更记录 | 已经执行的迁移、发布或行为变更 |

### 2.3 文档状态

| 状态 | 含义 |
|------|------|
| ✅ 已执行 | 历史定稿，永不可改（migration 原则） |
| 🔧 待执行 | 尚未实施或进行中 |
| 📄 参考 | 仅作参考 |
| ⚠️ 已过期 | 不再适用 |
| 🚫 已废弃 | 已被删除/取代 |

### 2.4 文档元数据

编号文档头部应包含必要元数据块：

```markdown
> **文档类型**：🔧 开发指导
> **文档状态**：🔧 待执行
> **影响范围**：后端认证模块
> **前置文档**：01-api-contract.md
> **替代文档**：无
> **生效版本**：待定
```

### 2.5 文档治理分类

两个类别，不得混淆：

- **当前状态文档**：描述系统当前有效状态，可随系统演进持续更新（`README.md`、`plugin-catalog.md`、当前 API 参考、配置说明、运维手册）。
- **不可变变更文档**：记录一次已执行的变更、迁移或架构决策（阶段文档 01–11、变更文档 12 起）。一旦标记 ✅ 已执行，正文原则上不再修改；发现错误或发生后续变化时，新建后继文档并标明替代关系。允许追加但不得重写的内容：实际执行记录、验证结果、关联提交、已知偏差、后续替代文档链接。

## 3. 文档相关要求（强制）

### 3.1 代码变更必须同步写文档

**每次修改 `src/` 下的源码（功能逻辑、bug 修复、优化、插件增删等）时，必须在回答用户前同步编写 `docs/NN-描述.md`，不等用户提醒。**

- 小变更（几行代码的 bug 修复/优化）可合并到同一份 doc 中，但必须在背景部分说明合并了哪些变更。
- 大变更（新增/删除插件、架构调整）必须独立一份 doc。
- 文档必须包含：背景、方案、实施（修改文件清单）、执行验证记录（tsc + vite build 输出）、后续验证建议。
- 同时更新本 README 的文档索引（§1.1 新增一行）+ `changelog/CHANGELOG.md` + `vite.config.ts` version（按 AGENTS.md §6.1.1 规则）。
- 新增/删除插件或核心模块时，同步更新 [`plugin-catalog.md`](plugin-catalog.md)（AGENTS.md §3.3/§3.4 的目录数据落点），并用 `bun run check:docs` 校验（插件集合/计数/站点拆分/`src/core/` 文件数四项一致性门禁）。
- **禁止**只改代码不写文档就回复用户。

### 3.2 编号与定期归并

- 新变更文档编号在 `docs/` 内**连续递增**：阶段文档占 01–11，变更文档从 **12** 起（`docs/12-描述.md`、`docs/13-描述.md`…）。编号只表示文档顺序。
- **定期归并**：变更文档积累到约 20 份或一个功能阶段结束时，按时间线将其精简融合进阶段文档体系（新增阶段文档或并入既有阶段文档），并同步更新本 README 的索引——防止文档数量再次膨胀。

### 3.3 版本号与文档

- 纯文档修改（`docs/` 下的 `.md`）、纯 `AGENTS.md` 修改不递增 `userscript.version`（见 AGENTS.md §6.1.1）。
- 文档变更若同时含 `src/` 逻辑修改，按 AGENTS.md §6.1.1 正常递增。

### 3.4 执行验证记录

涉及代码变更的文档完成后，在文档末尾追加：

```markdown
## N. 执行验证记录

### 执行环境
### 验证命令
### 实际输出
### 前端或调用方验证
### 验证结论
### 已知限制
```

验证通过后，将文档状态从 🔧 待执行改为 ✅ 已执行。

## 4. 相关文件

- 插件与核心模块清单：`plugin-catalog.md`（AGENTS.md §3.3/§3.4 的目录数据落点，增删时同步更新）
- 原始脚本：`archetype/jhs.user.js`（只读参考）
- 宿主站点参考：`javdb-site-style.md`（视觉语言）、`javdb-site-structure.md`（DOM 结构）；选择器有效性清单见 `21-javdb-selector-audit.md`
- 升级对照脚本：`archetype/jhs.3.3.6.027.user.js`（说明见 `11-missav-and-finale.md`）
- 工程入口：`src/main.tsx`（完整启动序列）
- 构建配置：`vite.config.ts`
- 架构说明：根目录 `AGENTS.md`