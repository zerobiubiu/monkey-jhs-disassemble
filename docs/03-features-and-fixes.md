# 03 功能迭代与修复（doc/49–75）

> **文档类型**：📄 参考说明（阶段整合）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/49 – doc/75，共 27 份历史文档（49–75 连续编号）
> **合并说明**：本文档由 `doc/` 下 49–75 号文档按时间线整合而成，原文件随后删除。仅精简与融合原文内容，不新增原文没有的事实、数字或结论；不确定的细节已删除而非猜测补全。"doc/NN" 仅作历史事件标识，非文件路径。版本演进：doc/49（v1.0.1→1.1.0）→ doc/75（v1.8.5，不递增）。

## 阶段概览

本阶段覆盖 JavDB Power Tools 从"发布前集成与更名"到"清单管理功能成型、详情页 UI 精简、合规收尾"的完整迭代。前半段完成 MissAV 播放页快捷插件集成、项目更名公开发布、OtherSite 列表页预加载与脚本精简；中段以清单功能为核心，经历了「新增清單」五连修（doc/56→60）与「删除/改名监听」重写（doc/61→62）两条重大演进链，最终确立"复用 JavDB 原生交互 + GM_xmlhttpRequest 自控请求"的稳定方案；后段完成 auto-favorite 自动收藏三连、评分缓存同步、自动备份、设置面板美化、详情页 UI 精简（隐藏冗余按钮组 + 拉黑按钮）与封面点击修复，并以 LICENSE 合规收尾。期间插件数 36→35（移除 ListParserPlugin），版本 1.1.0→1.8.5，产物约 1.81 MB→1.85 MB。

---

## 1. MissAV Quick Copy 集成与公开发布准备（doc/49–50）

### doc/49 — MissavQuickCopy 插件集成

**背景**：集成独立油猴脚本 `MissAV Quick Copy & Javdb Search`（v1.0.2，~190 行，同作者 zerobiubiu），为 MissAV 视频播放页提供番号快速复制与一键跳转 JavDB 搜索，要求与原脚本零偏差。

**方案与决策**：

| 决策点 | 选择 |
|--------|------|
| 站点与页面 | missav only，仅播放页（原 `@match missav.ws/*/*-*`，项目 match 已覆盖） |
| 拆分粒度 | 单文件，单一职责不拆子目录 |
| CSS | 无（按钮样式复用 missav 页面 tailwind class，initCss 返回空） |
| 打开新标签 | 保留 `<a>.click()` 实现（原脚本注释掉了 GM_openInTab/window.open） |
| DOM 创建 | 保留原生 createElement/createElementNS，不 TSX 化（非 innerHTML 模板） |
| 观察器 | MutationObserver 监听 document.body subtree，找到工具栏即 disconnect + 插入按钮 |

**实施要点**：新增 `src/plugins/missav-quick-copy-plugin.ts`（~300 行，类 + 6 个模块级辅助函数）；`main.tsx` 在 `if (isMissavSite)` 块注册。原脚本逐段映射为本项目模块：UserScript 头→vite.config.ts（match/grant 已覆盖，无需改）；selector 常量→模块级 `MENU_BAR_SELECTOR`；`extractCode`/`copyToClipboard`/`showToast`/`openInNewTab`/`createButton`/`createSVGClipboard`/`createSVGJavDB`/`insertButtons`→模块级函数；MutationObserver→`handle()`；IIFE 启动→main.tsx 注册。番号提取规则：FC2-PPV-\d+ 整体保留，其他取 pathname 末段前两段；复制用 `navigator.clipboard.writeText`；toast 为原生 DOM 浮动提示（fixed 定位 + opacity 过渡 + 2s 后淡出）。

**结果**：v1.0.1→1.1.0（minor：新增插件）。产物 1815.46 kB（gzip 415.22）。未新增 GM API（保留 `<a>.click()` 不依赖 GM_openInTab）。

### doc/50 — 项目重命名与公开发布准备

**背景**：项目准备公开发布，但 userscript 名称含"test"（`鉴黄师（test）`）、缺少 README、插件计数过时（AGENTS.md 记 35，实际 doc/49 后 36）、description 过时。

**方案与决策**：

- 对外名称改为 **JavDB Power Tools**（userscript name 同步），description 更新为"JavDB/MissAV 双站增强工具箱……36 个功能插件"；内部目录名 `monkey-jhs-disassemble` 不改（避免 git 历史断裂）
- README 全新重写：功能总览（6 大类 36 功能）+ 安装 + 配置 + 支持站点 + 技术架构 + 隐私说明 + 开发
- 同步 AGENTS.md 插件计数 35→36（javdb 34 + missav 2）、main.tsx 注释、doc/README.md

**结果**：v1.1.0→1.2.0。产物 1815.46 kB。公开发布前确认无隐私风险：`jdforrepam.com` 为 JavDB 官方 API 域名；`SIGNATURE_SALT` 为官方签名盐值，随脚本公开无安全风险；WebDav 凭据混淆为固定 salt 码点位移（非强加密），README 隐私说明已告知用户。

---

## 2. OtherSite 列表页预加载与脚本精简（doc/51–52）

### doc/51 — OtherSite 列表页预加载缓存

**背景**：OtherSitePlugin 的 missav/supjav 跳转按钮只在详情页打开后才请求解析搜索结果，用户点进详情页需等待请求完成按钮才变绿，体验不流畅。列表页每个 item 番号已知但预加载缓存为空。

**方案与决策**：

| 决策点 | 选择 |
|--------|------|
| 触发时机 | `handle()` 中 `isListPage` 分支 + MutationObserver 监听新 item（覆盖 autoPage 瀑布流新页） |
| 番号提取 | 复用 `ListPagePlugin.findCarNumAndHref()`，不重复造轮子 |
| 限流 | `AsyncTaskQueue` 串行执行（列表页 20-40 item × 2 站点 = 40-80 请求，防 Cloudflare 封禁） |
| 缓存复用 | `jhs_other_site` localStorage 同键同值，详情页 `handleSite` 命中直接回填，零修改 |
| 跳过策略 | 跳过已缓存 + 跳过 data-hide 屏蔽 item |
| 未命中 | 不缓存（避免缓存"未找到"导致永不重试） |
| 渲染 | 纯缓存预热，不渲染按钮 |

**实施要点**：`other-site-plugin.tsx` 新增 4 个类字段（preloadQueue/preloadObserver/preloadDebounce/PRELOAD_LOG）+ `preloadListPage()`（遍历 .item 提取番号、检查缓存、无缓存的入队限流）/ `preloadSite()`（纯缓存预热：请求搜索页 → 解析 → 写缓存，不操作按钮 DOM）/ `startPreloadObserver()`（监听 .movie-list 新 item，500ms 防抖）。预加载主流程：列表页加载 → `preloadListPage()` 遍历 `.movie-list .item` → `ListPagePlugin.findCarNumAndHref()` 提取番号 → 跳过 data-hide → 查 `jhs_other_site` 缓存（已缓存跳过）→ 入队 AsyncTaskQueue 串行 → `preloadSite()` 请求/解析/写缓存，失败静默（下次打开详情页重试）；用户打开详情页时 `handleSite()` 查缓存命中直接回填，零请求零延迟。preloadObserver 与 ListPagePlugin.checkDom 监听同一 `.movie-list` 容器，但只读不写 DOM（不触发 checkDom），checkDom 改 DOM 触发 preloadObserver 时 500ms 防抖后跳过已缓存，无副作用。

**结果**：产物 1818.98 kB（+3.52 kB）。

### doc/52 — 移除 ListParserPlugin + 预加载优化

**背景**：①用户要求完全移除"唤醒解析器"功能——ListParserPlugin（doc/43 集成）在清单详情页 `/lists/*` 插入按钮，通过 `lists://?url=` 自定义协议唤醒外部解析器，已不需要。②doc/51 预加载存在三个问题：依赖 `window.isListPage` 判断不准（`/lists/xxx` 有 `.movie-list` 却可能不匹配 isListPage，`/users/*` 无 `.movie-list` 却可能匹配）；日志不足；SupJav 全站 Cloudflare 拦截导致预加载逐个失败刷屏。

**方案与决策**：

- 删除 `src/plugins/list-parser-plugin.ts` + 移除 main.tsx 注册，插件计数 36→35（javdb 33 + missav 2），同步 AGENTS.md / README / description
- 预加载触发改为 `document.querySelector('.movie-list')` 存在判断：`/series/*`、`/search?q=`、`/lists/xxx`（清单详情页）预加载；`/users/lists`（无 .movie-list，容器是 `#lists > ul`）与 `/v/*` 详情页不预加载
- 日志增强：启动统计（`40 个 item（屏蔽 3）| 已缓存 12 | 入队 25 个任务`）+ 逐条命中/未命中/Cloudflare 拦截日志
- SupJav 加 `initUrl` 始终显示黄色（warn 态，href=搜索页），预加载跳过有 initUrl 的站点
- Cloudflare 容错：检测 403/"Just a moment..." 后将该站点加入 `blockedSiteIds`，本轮剩余任务全跳，下次页面加载 `handle()` 入口 `clear()` 重试
- 瀑布流联动确认：AutoPagePlugin（.movie-list）可联动；ListWaterfallPlugin（`#lists > ul`）不触发 observer 且 `/users/*` 无 .movie-list，天然不预加载

**结果**：v1.3.3→1.4.0。产物 1818.14 kB（较 v1.3.3 基线 1820.44 kB −2.30 kB，为删除文件的减量）。

---

## 3. 「等待更新」清单自动收藏（doc/53–55）

本小节为同一功能的两次增量修复，演进链：doc/53（写 IDB）→ doc/54（补三重广播）→ doc/55（联动星标评分）。

### doc/53 — 向「等待更新」清单添加视频时自动收藏

**背景/根因**：清单同步流程中未联动收藏操作。用户向名称含「等待更新」的清单添加视频后，需手动再点收藏按钮，操作链路长。清单 checkbox 统一入口在 `VideoListsTagPlugin` 的 `vlt-sync.ts`（`setupCheckboxListener` 防抖 300ms → `handleCheckboxChange`，已有完整 movieInfo 与 listInfo）。

**方案与决策**（保守，不覆盖用户已设置的其它状态）：

| CarRecord 状态 | 行为 | 提示 |
|----------------|------|------|
| 记录不存在 / `status === ''` | 自动收藏 | `⭐ [番号] 已自动收藏（添加至「清单名」）` |
| `status === FAVORITE_ACTION` | 跳过（已收藏） | 无（避免噪音） |
| 其它状态（filter/hasWatch/hasDown） | 跳过（不覆盖） | `ℹ️ 已标记为「XX」，跳过自动收藏` |

**实施要点**：`vlt-sync.ts` 新增 `AUTO_FAVORITE_KEYWORD = '等待更新'`（名称包含即触发）、`getActressNames()`（从 DOM `$('.female').prev()` 提取，与 `BasePlugin.getPageInfo` 一致）、`autoFavoriteIfPendingUpdate()`；`handleCheckboxChange` 同步成功后 `if (checked)` 时 fire-and-forget 调用（不阻塞三重广播，失败仅 toast + console.error）。

**结果**：v1.4.0→1.5.0。产物 1819.41 kB（+1.27 kB）。

### doc/54 — 补充三重广播事件链

**背景/根因**：doc/53 只写 IndexedDB 未触发后续事件链，导致当前详情页菜单按钮文案不刷新（仍显示「⭐ 收藏」）、其他标签页列表页 status-tag 未同步，与手动收藏效果不一致。手动收藏在 `saveCar` 后调用 `broadcastWantWatchedSync` 三重广播（GM_setValue / localStorage / CustomEvent），接收方 `setupWantWatchedSyncListener` 刷新详情页按钮文案（`showStatus`）与列表页 status-tag（`refreshItemStatusTag`）。

**方案与决策**：`vlt-sync.ts` 新增等价 `broadcastWantWatchedSync`（键 `jdb:want-watched-sync`，payload `{carNum, status, op, time}`），`saveCar` 成功后调用。**不调 `_triggerJavdbWant`**：它会调 JavDB API 将影片设为「想看」改变原生 UI——手动收藏 `favoriteOne` 同样不调；自动收藏场景用户仅勾选清单，不期望原生「想看」被联动勾选。

**结果**：v1.5.0→1.5.1。产物 1820.06 kB。

### doc/55 — 自动收藏联动星标评分组件

**背景/根因**：doc/53+54 后用户反馈视频详情页星标评分处的收藏不是收藏状态。星标评分组件（RatingBar）收藏高亮由 `_syncRatingBar()` 控制，它从 JavDB 原生 DOM（`.review-buttons`）检测「想看」按钮是否激活；仅写 JHS IDB + 广播不会激活原生「想看」按钮，故检测不到。`quickConvertToFav`（一键转收藏）之所以高亮，是因为它额外调用了 `_triggerJavdbWant()`（调 JavDB API 设为「想看」，`_execRailsJs` 执行返回 JS 同步更新 DOM）+ `_syncRatingBar()`。

**方案与决策**：`vlt-sync.ts` 新增 `triggerJavdbWantAndSyncRatingBar()`，通过 `pluginManager.getBean('DetailPageButtonPlugin')` 获取实例**复用**其 `_triggerJavdbWant()` + `_syncRatingBar()`（零侵入已定稿插件）。串行化与 `quickConvertToFav` 完全一致：复用实例 `_reviewChain` Promise 链 + `_wantWatchedSyncing` 守卫（防 MutationObserver 误触发 `onWantAdded` 重复写入）。容错：`DetailPageButtonPlugin` 未注册时仅 warn 跳过。

**结果**：v1.5.1→1.5.2。产物 1820.81 kB。至此自动收藏与手动收藏事件链完全对齐（saveCar → 三重广播 → toast → `_triggerJavdbWant` → `_syncRatingBar` → showStatus/refreshItemStatusTag）。

---

## 4. 「新增清單」功能与连环修复（doc/56–60）

本阶段最大的演进链：doc/56 提出方案 → doc/57/58/59 三次修复均未达完整效果 → doc/60 确立最终稳定方案。**每一步的失败根因必须完整保留**。

### doc/56 — 展开清单面板新增「新增清單」入口 + 自动同步关联

**背景/根因**：视频详情页「存入清單」原生弹窗被 CSS 永久隐藏（`rating-bar.css` `#modal-save-list{display:none}`），改为 `.jhs-list-panel` 平铺展示清单 checkbox，但弹窗 footer 内「創建新清單」按钮因此不可达，新增清单功能在展开布局下失效。更隐蔽的问题：JavDB 原生「新增清单」流程本身已自动把当前视频关联进新清单（表单 `#new_list` 含 `video_id` 隐藏域），但 Stimulus 内部把新 checkbox 设为 checked 时不派发 `change` 事件，`vlt-sync.setupCheckboxListener` 收不到，本地 IDB 的影片-清单关联永不落地——此前用户需手动「取消关联 → 再关联」才能让数据落地。

**方案与决策**：

原生弹窗关键 DOM 结构：`#modal-save-list`（CSS 隐藏、DOM 保留）内 `.modal-card-body` 含 `[data-list-target="listContainer"]`（checkbox 列表，含 data-list-id），`.modal-card-foot` 含 `[data-list-target="newListArea"]`（style="display:none"，内含 `form#new_list` action="/lists/remote_create" data-remote="true"，含 `input[list][name]` 新清单名输入、`input[type=hidden][video_id]`、submit 按钮、取消链接）与 `[data-list-target="optionsArea"]`（含「創建新清單」按钮 `button[data-action="list#newList"]` 与「我的清單」链接）。

1. 在 `.jhs-list-panel` 后方插入兄弟节点 `.jhs-list-create-wrap`（避免被 `_initListPanel` 的 `panel.innerHTML=''` 清空），UI 沿用 JavDB 全站 Bulma 风格；默认按钮态，点击切换为「输入框 + 保存 + 取消」行内表单，回车提交、Esc 取消
2. 提交时**驱动原生表单**（不自行发请求、不自行 `_execRailsJs`）：点击 modal 内 `button[data-action="list#newList"]`（Stimulus 展开 newListArea）→ 填入 `input[data-list-target="listNewNameInput"]` → 点击原生 `input[type=submit]`（Rails UJS ajax POST `/lists/remote_create`，携带 video_id，服务端创建清单 + 自动加入当前视频）→ 服务端返回 JS 把新 checkbox append 进 listContainer（已 checked）→ `DetailPageButtonPlugin._initListPanel` 的 MutationObserver 自动 clone 到 `.jhs-list-panel`
3. **自动同步本地 IDB 关联**（核心优化，消除手动步骤）：提交前快照 listContainer 内 checkbox 的 `data-list-id` 集合；提交后用 MutationObserver 对比快照找到新增 checkbox，显式调用 `handleCheckboxChange(movieInfo, listInfo, true)` 写入本地 VltDb 并触发三重广播
4. 容错：5s 超时兜底（报错 + 断开 observer）；表单未就绪（listContainer 尚未 ajax 加载完成）toast 引导刷新；完成后恢复 modal 内 newListArea 隐藏态 + 还原展开 UI

**实施**：`vlt-sync.ts` 新增 `setupCreateListButton` / `bindCreateListEvents` / `createListViaNativeForm` + 幂等标记 `_createListUiInjected`；`vlt-plugin.tsx` 详情页分支调用；`video-lists-tag.css` 新增 `.jhs-list-create-wrap` / `.jhs-list-create-form` 样式。零侵入 `DetailPageButtonPlugin`。

**结果**：v1.5.2→1.6.0（minor：新增功能模块）。产物 1825.78 kB。与 doc/53 联动：新建清单名含「等待更新」还会触发自动收藏。

### doc/57 — 修复新增清单后无即时反馈、必须刷新

**背景/症状**：用户反馈"清单创建是成功了，但点保存并没有一个正常且成功的完整效果，必须刷新才能看到；点了保存就仅仅创建了，再无其他任何效果"。三个症状：服务端创建成功（刷新可见）；`.jhs-list-panel` 不立即显示新清单；无 toast、无 IDB 关联同步、无自动收藏。

**根因（doc/57 的诊断，后被 doc/58 推翻）**：`createListViaNativeForm` 提交前捕获 `listContainer` 引用并把 MutationObserver 挂在该引用上；但 JavDB 的 Rails/Stimulus `list#onCreateSuccess` 响应会**整个替换** `listContainer` 元素（Turbo Stream / innerHTML 重渲染），替换后旧引用变孤立节点，observer 永不触发；新 listContainer 无人监听。`DetailPageButtonPlugin._initListPanel` 的 observer 同样挂在旧节点上，故 `.jhs-list-panel` 不自动 clone 新条目。

**方案与决策**：

1. MutationObserver 改挂不可替换的 `#modal-save-list`，回调内每次重新 `modal.querySelector('[data-list-target="listContainer"]')` 查最新节点，对比 beforeIds 快照
2. 200ms 轮询兜底（覆盖元素替换/`data-list-id` 延迟设置边界），与 observer 共享 `settled` 幂等守卫，先到先执行
3. 完成时主动 `refreshListPanel()`：从最新 listContainer 克隆全部条目（跳过「預設清單」）到 `.jhs-list-panel`，与 `_initListPanel` sync 等价、幂等
4. 超时 5s→8s（慢网络），超时时也尝试刷新一次平铺面板

**结果**：v1.6.0→1.6.1。产物 1826.87 kB。**未达预期，见 doc/58。**

### doc/58 — 改用 GM_xmlhttpRequest 直接发 ajax

**背景/症状**：doc/56+57 两次修复均未解决用户反馈的核心问题。doc/57 的「挂 modal + 轮询」完全无效，因为**根本没有新 checkbox 出现在 DOM 中**——轮询和 observer 都检测不到任何东西。

**根因（doc/57 诊断错误，doc/58 重新定位）**：JavDB 已从 Rails UJS 迁移到 **Turbo**。`form#new_list` 的 `data-remote="true"` 不再被任何 JS 拦截（Turbo 不识别该属性），`submitBtn.click()` 触发的是**常规表单 POST**，浏览器导航到 `/lists/remote_create`，整个脚本环境被卸载（setTimeout/MutationObserver/setInterval 全部销毁）。服务端虽创建了清单（刷新可见），但客户端无任何后续效果、listContainer 未被更新、发生页面导航。这解释了为什么 doc/57 的轮询根本没机会执行。

**方案与决策**：完全绕过原生表单提交，用 `GM_xmlhttpRequest` 自控请求与响应：

1. 收集 `#new_list` 表单字段（`list[name]`、`video_id`、`authenticity_token` 隐藏域），用新清单名覆盖名称字段
2. CSRF token 从 `<meta name="csrf-token">` 读取
3. `GM_xmlhttpRequest POST /lists/remote_create`，headers 带 `Content-Type: application/x-www-form-urlencoded` + `X-CSRF-Token` + `X-Requested-With: XMLHttpRequest` + `Accept: text/javascript`（模拟 Rails UJS ajax，服务端返回 `.js.erb` 模板而非 HTML 重定向）
4. 响应文本注入 `<script>` 在页面上下文执行
5. 3s 内每 100ms 轮询 listContainer 是否出现新 `data-list-id` checkbox
6. 兜底构建：JS 执行未产出新 checkbox 时，从响应文本正则 `data-list-id=["']([^"']+)["']` 提取清单 ID，克隆已有 checkbox `<label>` 修改属性后手动插入
7. 完成：`refreshListPanel()` + `handleCheckboxChange(add)` 同步 IDB + 三重广播 + 自动收藏

**关键设计决策**：不继续用原生表单（data-remote 已失效，原生 submit 必然导航）；注入 `<script>` 等效 Rails UJS 时代的 `eval` 且在页面上下文执行；URL 编码手动 `encodeURIComponent`（`gmHttp.postForm` 实现未做编码，属预存 bug，此处直接绕开）。

**实施**：`vlt-sync.ts` 删除 `createListViaNativeForm`，函数拆分如下：`createList(listName)`（主流程：收集字段 → 发请求 → 执行 JS → 轮询 → 兜底 → 完成）、`pollForNewCheckboxes(modal, beforeIds, timeoutMs)`（轮询检测新增 checkbox）、`manuallyBuildCheckbox(listContainer, listId, listName, videoId)`（兜底：克隆已有 checkbox 并修改属性）、`finishCreateList(newCheckboxes, listName)`（完成态：还原 UI + toast + refreshListPanel + handleCheckboxChange）、`restoreCreateListUi()`（还原「新增清單」展开 UI 到按钮态，幂等）、`refreshListPanel()`（doc/57 已有，保留）。

**结果**：v1.6.1→1.6.2。产物 1830.02 kB。请求成功、服务端创建成功，但**仍无法定位新 checkbox**，见 doc/59。

### doc/59 — 修复响应无 list-id + 全局繁简转换

**背景/根因**：doc/58 请求成功但用户控制台日志显示 `轮询未侦测到新 checkbox，尝试从响应提取 list-id 手动构建` → `新增清单后无法定位新 checkbox`。根因：JavDB 的 `/lists/remote_create` 响应**仅返回 `Toastr.success("...")` JS 代码**——不含 `data-list-id`、不含 HTML 片段、不更新 listContainer DOM。doc/58 的「响应正则提取 list-id」兜底完全无法匹配。新清单的 list-id 只能通过**额外请求 `/users/lists` 页面**查找。

**方案与决策**：

1. 新增 `fetchListIdByName` 兜底：`GET /users/lists` 获取清单页面 HTML，`DOMParser` 解析所有 `a[href*="/lists/"]` 链接，匹配清单名称后从 href 提取 `/lists/{id}` 中的 id
2. 链路变为多级兜底：注入执行 JS → 轮询 2s → 响应正则 → **GET /users/lists 匹配名称提取 list-id（核心兜底）** → 手动克隆 checkbox → 完成
3. 全局繁→简转换：用户要求插件 UI 文本统一简体中文，不沿用 JavDB 繁体。Python 脚本遍历 `src/` 全部 `.ts/.tsx` 按繁简映射表批量替换，覆盖 21 个文件（toast 文案、按钮文本、注释等）

**结果**：v1.6.2→1.6.3。产物 1831.56 kB。全项目无残留繁体（脚本扫描验证）。**繁简替换引入回归，见 doc/65/66；`fetchListIdByName` 实测无效，见 doc/60。**

### doc/60 — 改用 #save-list-button 切换重载 + 延迟优化（最终方案）

**背景/症状**：doc/59 失效——用户实测日志显示 `/users/lists 未找到名称含「X」的清单`。且操作延迟明显（≈2.7s）。

**根因（doc/59 诊断错误，doc/60 重新定位）**：doc/59 假设 `/users/lists` 页面 HTML 包含清单列表，实测证明 JavDB 已将该页面改造成**通过 JS（Turbo/Stimulus）动态加载清单数据**，服务端返回的原始 HTML 不含任何 `/lists/{id}` 链接，`fetchListIdByName` 永远找不到。但日志同时证实 doc/58 的 POST 创建请求本身已成功（响应 `Toastr.success`），问题只在「创建后如何在客户端拿到新清单的 list-id / 新 checkbox」。

**关键洞察**：`#save-list-button`（详情页菜单按钮）被点击时，JavDB 原生 Stimulus `list` 控制器会打开 `#modal-save-list` 模态框并发起 ajax 拉取用户的完整清单列表（含 data-list-id 的 checkbox）。因此：**创建请求成功后关闭模态框再重新打开，原生机制会重新拉取含新清单的完整列表，DOM 中即出现新 checkbox**——绕开所有"猜测响应格式 / 解析外部页面"的脆弱做法。

**方案与决策**：

1. 注入 `<script>` 执行 JS 响应
2. 快速轮询 200ms 检测 listContainer 是否被直接更新（保险位）
3. 从响应正则提取 `data-list-id`（保险位）
4. **核心兜底**：点击 `#save-list-button` 关闭模态框 → 等待 200ms → 再次点击重新打开 → 触发 Stimulus `list` 控制器 ajax 重新拉取 → 轮询 5s 检测新增 checkbox
5. 最后兜底：保留 `fetchListIdByName`（实测无效，作未来页面改造的保险位，增加调试日志：打印 `/users/lists 页面解析到 N 条 /lists/ 链接` 和页面文本前 500 字）
6. 完成：`refreshListPanel()` + `handleCheckboxChange(add)` + 三重广播 + 自动收藏

**延迟优化**：首次响应轮询 2000ms→200ms（响应格式实测稳定）；关闭模态框延迟 400ms→200ms；整体延迟从 ~2.7s 降至 ~0.7s。

**结果**：v1.6.3→1.6.4→1.6.5。产物 1832.52 kB。用户实测成功链路：`服务端响应: Toastr.success(...)` → `JS 响应已注入执行` → `响应无 list-id，通过切换 #save-list-button 重载清单列表` → `重载后侦测到 1 个新 checkbox，走正常完成流程` → `同步结果: movie=existed list=created association=created`。完整链路成功：服务端创建 + 客户端检测新 checkbox + 本地 IDB 关联新建，用户无需手动取消/再关联。

**历史路径回顾（doc/60 原文）**：

| 迭代 | 方案 | 结果 |
|------|------|------|
| doc/56 | 原生表单提交 | ✗ 失败（data-remote 在 Turbo 下不被拦截，常规 POST 页面导航） |
| doc/57 | observer 挂 modal | ✗ 失败（根本无新 checkbox 出现在 DOM） |
| doc/58 | GM_xmlhttpRequest | ✗ 请求成功，但响应无 list-id 无法定位新 checkbox |
| doc/59 | GET /users/lists | ✗ 失败（页面 JS 动态加载，HTML 不含清单列表） |
| doc/60 | `#save-list-button` 双击重载 + 延迟优化 | ✓ 成功（利用 JavDB 原生 Stimulus 重载机制） |

**教训**：优先复用 JavDB 原生交互（打开模态框即 ajax 加载清单列表），比猜测响应格式/解析外部页面 HTML 更可靠。

**遗留**：doc/58 排查指引揭示的响应格式变化风险（若响应文本无 `data-list-id` 且格式再变，需调整正则）；`gmHttp.postForm` 未做 URL 编码的预存 bug（doc/58 绕开但未修本身）。另外 doc/60 澄清用户控制台其余报错全部预存与本功能无关：JavDB 广告被浏览器拦截（ERR_BLOCKED_BY_CLIENT）、JavDB 自家 `movie_detail_controller` Stimulus bug、OtherSitePlugin 番号搜索 missav 404 噪音、ModalListDisablerPlugin 正常日志。

---

## 5. 清单删除/改名监听同步（doc/61–62）

演进链：doc/61（DOM 变化作成功信号）→ doc/62 重写（拦截原生操作 + 自行发请求 + 独立广播通道）。

### doc/61 — /users/lists 清单删除/改名监听 → 同步本地 IDB

**背景/根因**：用户在 `/users/lists` 管理页删除/改名清单后，服务端数据已变更但本地 IndexedDB（`vlt_inventory` / `vlt_movie_inventory`）仍保留旧数据：删除不清清单记录与所有 `designation::listId` 关联（列表页标签显示已不存在的清单名、筛选条目残留）；改名不更新 `name` 字段（标签仍显示旧名）。此前用户需手动「导出 → 编辑 JSON → 重新导入」，冗余易错。

**方案与决策**（事件驱动 + DOM 成功信号，不猜测 AJAX 时序）：

管理页 DOM 关键结构：`ul.user-lists-container > li.list-item#list-<listId>`（内含 `a[href="/lists/<listId>"] > strong.list-name` 与状态 meta、操作区 `div.operation`：分享按钮 `.copy-to-clipboard`、修改按钮 `button.modal-edit-list-button[data-list-id][data-target="modal-edit-list"]`、删除链接 `a[href="/users/remove_list?id=<listId>"][data-confirm][data-remote][data-method="delete"]`）；编辑弹窗 `#modal-edit-list` 全局唯一（Stimulus list 控制器管理，含 `input[data-list-target="inputName"]`、`input[type=hidden][data-list-target="inputId"]`、保存按钮 `[data-action="list#updateList"]`）。

| 操作 | DOM 成功信号 | IDB 同步动作 |
|------|-------------|-------------|
| 删除 | `#list-<listId>` `<li>` 从 DOM 移除 | `VltDb.deleteList(listId)` |
| 改名 | `#list-<listId>` 内 `.list-name` 文本变化 | `VltDb.renameList(listId, newName)` |

- 删除：MutationObserver 观察 `document.body` childList+subtree，检测 `removedNodes` 中 `id^="list-"` 元素。**不拦截删除链接 click**：删除链接有 `data-confirm`（原生 confirm 对话框，用户可能取消）且 ajax 可能失败；只有 ajax 成功后服务端返回 JS 移除节点，DOM 移除是零误报的成功信号
- 改名两步：捕获阶段（useCapture:true）监听 `.modal-edit-list-button` click 快照旧名 + listId（抢在 Stimulus 打开弹窗前）；捕获阶段监听保存按钮 `[data-action="list#updateList"]` click 读新名，新旧相同则跳过，否则 `waitForListNameChange()` 等 `.list-name` 文本变为新名（MutationObserver + 5s 超时兜底）后调 `VltDb.renameList()`
- VltDb 新增 `deleteList`（删 inventory + 所有 `::listId` 结尾关联，不删 `vlt_movies`——影片可能还关联其他清单）/ `renameList`（仅更新 name，清单不存在返回 false）
- 三重广播 `broadcastListMgmt()`，payload `designation: '*'` 表示全量刷新；`VltTags.handleSyncNotify` 收到后调 `refreshAllTags()`

**结果**：v1.6.5→1.7.0（minor：新增功能模块）。产物 1839.05 kB。`vlt-plugin.tsx` handle() 分支顺序更新为：①isDetailPage → setupCheckboxListener + setupCreateListButton → return；②`/users/lists` → setupListManagementListener → return（新增）；③!isListPage → return；④列表页：VltTags 标签显示 + 筛选 + Observer + 自动刷新。浏览器实测（未触碰真实数据）：数据结构确认（`vlt_inventory` 16 清单、`vlt_movie_inventory` 3567 条关联、键格式 `designation::listId` 与 deleteList 逻辑匹配、zK1MNE 306 条与 count 一致）、不存在的 listId 安全（renameList 返回 false、deleteList 返回 `{inventory:false, associations:0}`）、删除/改名检测虚拟元素验证通过。**用户实测失效，见 doc/62。**

### doc/62 — 重写：拦截原生操作 + 自行发请求 + 实时广播

**背景/症状**：doc/61 用户实测发现：删除后 IDB 关联未清除（MutationObserver 从未触发）；管理页删除后 DOM 不实时消失；删除未广播；详情页 checkbox 不消失；列表页标签不清除。

**根因（从 JavDB `app.js` 逆向确认）**：删除链接用 Rails UJS（`data-remote="true"` + `data-method="delete"`，`dataType:"script"`），**服务端返回的 JS 不移除 `<li>` 元素** → MutationObserver 永不触发；改名用 Stimulus `list#updateList`（POST `/users/update_list` `{id, name}`，返回 JSON `{success, name, message}`），成功后更新 `.list-name` textContent——DOM 会更新，但**无法实时广播到其他页面**。

**服务端 API（从 app.js 逆向确认）**：

| 操作 | API | 响应 |
|------|-----|------|
| 删除 | `DELETE /users/remove_list?id=<listId>`（带 X-CSRF-Token、X-Requested-With） | JavaScript（dataType=script，但不移除 DOM） |
| 改名 | `POST /users/update_list`（body `id=<listId>&name=<newName>` URL-encoded） | JSON `{success, name, message}`，成功后 Stimulus 更新 `.list-name` |

**方案与决策**：不再依赖 DOM 变化作成功信号，而是**全权接管**删除/改名操作：

| 操作 | 拦截方式 | 请求方式 | 成功信号 |
|------|---------|---------|---------|
| 删除 | 捕获阶段拦截删除链接 click + preventDefault | GM_xmlhttpRequest DELETE | HTTP 2xx/3xx |
| 改名 | 捕获阶段拦截保存按钮 click + preventDefault | GM_xmlhttpRequest POST | JSON `success: true` |

- 删除：拦截 → 从 href 提取 listId → 从 `data-confirm` 读确认消息显示原生 confirm() → 确认后 DELETE（带 CSRF token）→ 2xx/3xx 成功：`VltDb.deleteList` + `broadcastListMgmt('delete', listId)` + **主动移除 DOM `<li>`**（JavDB 不实时移除）+ toast；4xx/5xx → toast 失败不移除 DOM
- 改名：拦截保存按钮 → 读新名 → 新旧相同则关闭弹窗跳过 → POST → `success:true`：`VltDb.renameList` + 广播（带 newName）+ 更新 DOM textContent + 关闭弹窗 + toast；`success:false` → toast 显示服务端错误
- **独立广播通道 `jdb:list-mgmt`**：不再复用 `jdb:last-sync`（designation='*'），payload `{type: 'delete'|'rename', listId, newName?, time}`，三重广播（GM_setValue / localStorage / CustomEvent）
- 广播接收器 `setupListMgmtBroadcastListener` 在详情页和列表页均注册：详情页 onDelete → `removeDetailPageCheckbox(listId)`（从 `.jhs-list-panel` 和 `#modal-save-list` 移除整个 `<p class="control">`），onRename → `updateDetailPageCheckboxLabel`（清空文本节点后插入新名称，保留 `<span>(count)</span>`）；列表页 onDelete/onRename → `refreshAllTags()`
- 撤回 `vlt-tags.ts` 中 doc/61 的 `designation='*'` 分支

**实施**：`vlt-sync.ts` 重写 `setupListManagementListener()`，新增 `handleListDeletion` / `handleListRename` / `closeEditModal` / `getCsrfToken` / `extractListIdFromHref` / `setupListMgmtBroadcastListener` / `removeDetailPageCheckbox` / `updateDetailPageCheckboxLabel`；删除 `waitForListNameChange` / `extractListIdFromListItem`；`vlt-plugin.tsx` handle() 分支：详情页注册 `setupListMgmtBroadcastListener`（onDelete → removeDetailPageCheckbox，onRename → updateDetailPageCheckboxLabel），列表页注册（onDelete/onRename → refreshAllTags）。

**结果**：v1.7.0→1.7.1。产物 1842.98 kB。逻辑验证 6 项全部确认：CSRF token 可用；删除链接属性（href/data-method/data-remote/data-confirm）；改名 API 逆向；详情页 checkbox DOM 结构（`p.control > label.checkbox > input[data-list-id]`，`.jhs-list-panel` 与 `#modal-save-list` 两处）；广播机制（CustomEvent 发送接收正常）；标签文本更新逻辑（保留 `(count)`）。

---

## 6. 清单相关体验修复（doc/63–66）

### doc/63 — toast 被导航栏遮挡

**根因**：`#jdb-toast-container` 原 `top: 20px`，位于 JavDB 固定导航栏（`.main-nav.is-fixed-top`，高 56px，`z-index: 12345679`）覆盖区域（0-56px）内，通知被盖住不可见。`z-index: 99999` 本身高于导航栏无需调整。

**方案**：`top` 20px→72px（56px 导航栏 + 16px 间距）。修改 `video-lists-tag.css`。

**结果**：v1.7.1→1.7.2。产物 1842.98 kB（纯 CSS）。

### doc/64 — 删除清单性能优化：乐观 UI + 并行执行

**背景/根因**：用户反馈删除清单"慢"。瓶颈分析：原方案（doc/62）串行执行——先 `await` 服务器响应（数百 ms~数秒，最大瓶颈：JavDB 处理删除+关联表+计数），再删 IDB（~50ms），最后才移除 DOM。实测数据：`vlt_movie_inventory` 3563 条关联 83KB、`vlt_inventory` 13 条清单 2KB，deleteList 总耗时 ~50ms（2 次 get + 遍历 + 2 次 put），非瓶颈。

**方案与决策**（乐观 UI + 并行）：

```
点击删除 → confirm() → 立即移除 DOM + showToast('正在同步')
  → 并行: [GM_xmlhttpRequest DELETE] + [VltDb.deleteList]（Promise.all）
  → 都完成 → 广播 → toast 最终结果
```

1. confirm 后立即移除 DOM，用户即时看到清单消失
2. 网络请求与 IDB 删除并行（互不依赖，节省 ~50ms）
3. 无论服务器是否成功都广播（本地已清除，其他页面需同步）
4. 服务器失败时 warning toast「本地数据已清除，服务器响应异常，刷新后确认」，不恢复 DOM（服务器大概率已删除只是响应慢/超时）

失败场景表：正常 → 立即消失 + toast 成功；服务器慢/超时 → 立即消失 + warning；网络错误 → 立即消失 + warning。网络错误时服务器未删但本地已删，刷新后 DOM 清单重新出现（服务器还在），IDB 无记录 → 不一致但可自愈（可重新删除）。

**结果**：v1.7.2→1.7.3。产物 1842.86 kB。

### doc/65 — 修复「预设清单」过滤失效

**背景/根因**：`.jhs-list-panel` 本应过滤掉「預設清單」（只对自己可见的默认清单），但 doc/59 的全局繁→简替换把代码中的 `預設清單` 改为 `预设清单`，而 JavDB 服务端返回的 DOM 文本仍是**繁体** `預設清單` → `includes('预设清单')` 不匹配，过滤失败被克隆到面板。

**方案**：改为正则 `/预[设設]清[单單]/` 同时匹配简繁。修改 `detail-page-button-plugin.tsx` `_initListPanel` sync 函数 + `vlt-sync.ts` `refreshListPanel`。

**结果**：v1.7.3→1.7.4。产物 1842.87 kB。DOM 实测：listContainer 12 个子元素第 12 个为 `預設清單`（繁体），修复后面板 12→11 条。

### doc/66 — 修复繁→简替换破坏 DOM 选择器导致番号丢失

**背景/症状**：用户反馈访问外部网站时番号丢失、无法跳转。

**根因**：doc/59（commit `bcf046c`）全局繁→简替换把代码中的繁体改为简体，但 JavDB 服务端返回的 DOM 文本与 API 错误消息仍是繁体，导致 jQuery 选择器 / `includes()` 匹配 / `replace()` 全部失配。

**修复清单 — 功能性 bug（DOM 选择器/匹配，必须还原繁体，共 8 处）**：

| 文件 | 还原项 | 影响 |
|------|--------|------|
| `base-plugin.ts` `getPageInfo` | `a[title="複製番號"]` | **番号丢失**（选择器匹配不到 DOM） |
| `base-plugin.ts` `getActressPageInfo` | `'無碼'` | 无码类型检测失效 |
| `actress-info-plugin.tsx` `handle` | `strong:contains("演員")` | 演员信息插入位置失效 |
| `actress-info-plugin.tsx` `getAge` | `th:contains('現年齢')` | 维基年龄提取失效 |
| `list-page-plugin.tsx` `addBlacklist` | `'(無碼)'` | 演员名无码标签清除失效 |
| `storage-manager.ts` `UNCENSORED_TAG` | `'(無碼)'` | 收藏演员无码标签匹配失效 |
| `related-plugin.tsx` `fetchAndDisplay` | `'簽名已過期'` | API 签名过期错误检测失效 |
| `review-plugin.tsx` `fetchAndDisplayReviews` | `'簽名已過期'` | 同上 |

**修复清单 — 显示文本还原（生成的 DOM 输出还原为繁体，与 JavDB 原版一致）**：`hit-show-movie-item.tsx`（含中字磁鏈/含磁鏈/无磁鏈）、`nav-search-box.tsx`（演員/番號/清單/輸入影片番號.../進階檢索）、`preview-video-container.tsx`（預告片）、`top250-pagination.tsx`（上一頁/下一頁）、`top250-tool-bar.tsx`（含中字磁鏈）、`want-watched-hint-span.tsx`（看過）、`fc2-plugin.ts`（右鍵點擊.../個文件/複製）、`detail-page-button-plugin.tsx`（注释）。

**结果**：v1.7.4→1.7.5。产物 1842.88 kB。DOM 实测：`a[title="複製番號"]` 匹配 1 个元素（data-clipboard-text=JAC-236）；简体选择器匹配 0 个。

**遗留/教训**：繁→简替换只应作用于"脚本生成的 UI 文本"，不能触碰任何与服务端 DOM/API 交互的字符串字面量（选择器、匹配串、错误消息）。

---

## 7. 评分缓存同步（doc/67–68）

### doc/67 — 详情页标记已读时直接写入评分缓存

**背景/根因**：详情页点「已读」或星级按钮标记已观看时，`quickSetHasWatch(score)` 已拿到评分（0-5）并写入 JHS 本地库 `car_list`。但列表页评分显示组件 `RatingDisplayPlugin` 用**另一套独立缓存** `RatingCache`（localStorage `jdb:rating_cache_v2` + IDB 寄生 `jhsRatingDisplay_data`），两套缓存互不相通——列表页悬停已看卡片时仍需 `GM_xmlhttpRequest` 远程抓取详情页 HTML → `parseRating` 解析星级 → 写缓存，是一次**完全可以避免的网络请求**。根因是广播 payload 只携带 `{carNum, status, op}` 没有 score，`_invalidateCards` 收到 hasWatch+add 只能清缓存。

**方案与决策**（选型方案 B，扩展广播 payload 携带 score）：

- 方案 A（详情页直接调 `RatingCache.set`）被否：`detail-page-button-plugin` 反向依赖 `rating-display` 模块，破坏插件单向依赖（rating-display 注释明确"仅监听" detail-page-button 的事件）
- **方案 B（采用）**：广播 payload 增加 `score?: number`，列表页收到后写缓存；不破坏依赖方向、跨标签页受益、改动集中

语义边界：`score >= 1`（1-5 星）→ 直接写 RatingCache，列表页命中缓存显示评分免远程抓取；`score === 0`（已读未评分）→ 不写缓存（RatingCache 语义上只存 1-5，`parseRating` 对未评分返回 null 也不写），保持占位「已看」态；`onWatchedAdded`（MutationObserver 检测原生「已观看」添加）不携带 score，走原清缓存逻辑；想看/收藏/取消 → 走原清缓存逻辑。一致性验证：先评 3 星后改 5 星 → RatingCache.set 检测 rating 变化更新；先 5 星后取消观看 → 清缓存+移除标签；先 5 星后转想看 → 清缓存 + watchedMap.delete；用户在 javdb 原生页面改评分 → jhs 不知道不广播，RatingCache 保持旧值，init 悬停验证兜底（对 fromCache 项 delete jhsrdLoaded，首次悬停重新抓取验证）不受影响。

**实施**：`detail-page-button-plugin.tsx` `WantWatchedSyncPayload` 加 `score?: number`，`quickSetHasWatch` 广播时传 score（仅此一处）；`rating-display-plugin.tsx` `SyncPayload` 加字段，`_invalidateCards` 加 `score?: number` 参数：`hasWatch+add+score>=1` → `RatingCache.set(code, score)` 写缓存（不再 delete），其他情况走原清缓存逻辑；两处调用点（CustomEvent / localStorage storage 监听）传递 score。

**结果**：v1.7.5→1.7.6。产物 1843.05 kB。

### doc/68 — 0 星（已读未评分）显示 ★0 而非占位「已看」

**背景/根因**：doc/67 后用户反馈详情页点「已读」（0 星）后列表页仍显示绿色占位「已看」而非「★0」。doc/67 实现有两处将 0 星排除：①`_invalidateCards` 写入条件 `score && score >= 1`——JS 中 `0` 是 falsy，短路走 else 清缓存；②`RatingRenderer.showRating` 渲染分支 `rating && rating >= 1 && rating <= 5` 同样排除 0，`showRating(item, 0)` 降级为占位。

**方案与决策**（0 星语义澄清）：

- `RatingCache` 存 0 = 确定是**已读未评分**（由 jhs 详情页标记写入），区别于「未缓存」（不确定，需悬停远程抓取验证）
- `showRating(item, 0)`：显示金色「★0」，title「已看 · 0/5 星（未评分）」，与 1-5 星一致的 `is-rated` 样式
- `showRating(item, null/undefined)`：仍降级为占位「已看」（未缓存或解析失败）

**实施**：`_invalidateCards` 写入条件改为 `typeof score === 'number'`（0-5 均写入）；`rating-renderer.tsx` `showRating` 增加 `rating === 0` 分支（★0 金色标签），原 1-5 分支改 `else if`，占位降级分支不变。

**结果**：v1.7.6→1.7.7。产物 1843.47 kB。一致性验证：3 星→0 星更新（★3→★0）；0 星→3 星更新；0 星后取消观看清缓存；init 悬停验证对 ★0（is-rated）delete loaded 后 fetchRating，`parseRating` 对未评分返回 null 不覆盖，★0 保持并标记 loaded。

---

## 8. 自动备份与设置面板美化（doc/69–70）

### doc/69 — 自动备份功能（凭证 ID + 增量滚动 + 策略随文件保存）

**背景**：原脚本只有手动 WebDav 备份（设置面板「备份数据」按钮），用户需主动点击，数据丢失风险高。需求：默认每天第一次打开自动备份；配置项在设置「数据备份」面板控制；备份文件保存本机凭证 ID（唯一标识每台电脑的每个浏览器）；凭证 ID 首次打开创建，存浏览器本地不进备份系统；增量滚动（一个浏览器只保留一份备份文件，每次覆盖）；自动备份策略随文件保存。

**方案与决策**：

| 决策点 | 选择 |
|--------|------|
| 凭证 ID 存储 | GM_setValue（Tampermonkey 持久化），不在 IDB 内、不被 exportData 导出，天然不进入备份系统 |
| 凭证 ID 生成 | UUID v4（crypto.randomUUID + 兜底手动拼装），无第三方依赖 |
| 备份文件名 | `auto_<credentialId>.json`（固定名），一个浏览器一份，增量覆盖不堆叠历史 |
| 备份格式 | `{ ...exportData, __meta: { credentialId, autoBackupConfig, backupTime } }`，顶层 `__meta` 不污染 exportData 业务键 |
| 触发时机 | main.tsx 启动序列末尾（processPlugins 之后），javdb only |
| 触发频率 | daily（默认，按本机日期判断「每天第一次」）/ everyOpen / disabled |
| 失败处理 | 静默 console.warn（自动备份不打扰用户）；未配置 WebDav 静默跳过 |

**数据流**：首次打开脚本 → `getCredentialId()`（GM_getValue 无值则生成 UUID v4 并 GM_setValue 持久化）；每次打开脚本（main.tsx 启动序列末尾）→ `SettingPlugin.autoBackup()` → 读 `settings.autoBackupConfig`（默认 `{enabled:true, frequency:'daily'}`）→ `shouldAutoBackup(config)` 判断（disabled/关闭不触发；everyOpen 触发；daily 按本机日期 !== 上次备份日期触发）→ 未配置 WebDav 凭据静默跳过 → `buildBackupPayload()`（exportData + __meta 注入）→ encryptCredential → webdavClient.backup(folder, `auto_<id>.json`, content) → `markAutoBackupDone()` GM_setValue 记录今日日期。注入的 `__meta` 在导入时会被 importData 写入 IndexedDB，无副作用（凭证 ID 仍以 GM 存储的本地值为准，`__meta` 键不参与业务逻辑）。

**实施要点**：新增 `src/core/auto-backup.ts`（凭证 ID 管理 + 触发判断 + 文件名 + 日期记录 + 默认配置 + 类型定义）；`setting-dialog.tsx` 数据备份面板新增 3 控件（启用 checkbox / 频率 select / 凭证只读 input）；`setting-plugin.tsx` loadForm/saveForm + `buildBackupPayload`（注入 __meta）+ `autoBackup` 方法；手动备份 `backupDataByWebDav` 改用 `buildBackupPayload`，与自动备份共用保证格式一致。手动备份仍用时间戳文件名（`utils.getNowStr('_','_') + '.json'`），不受影响。WebDavClient.backup 先 MKCOL 建目录再 PUT 写入，PUT 覆盖同名文件。

**结果**：v1.7.7→1.8.0（minor：新增功能模块）。产物 1849.12 kB（214 modules，+5.65 kB）。

### doc/70 — 设置面板 UI 美化

**背景**：doc/69 后数据备份面板内容增多，但整体 UI 粗糙：侧栏背景朴素、按钮无 hover、表单输入框过窄且居中、缺少分区层次感。

**方案与决策**：统一主色 `#5d87c2`（WebDav 查看备份按钮的蓝色）贯穿全面板：

| 区域 | 优化 |
|------|------|
| 侧栏 | `#f5f5f5`→`#fbfcfd` 柔和背景，active 用主色半透明 `rgba(93,135,194,0.12)` |
| 侧栏菜单项 | 文字 `#333`→`#64748b` 柔和灰，hover 主色半透明 + 文字变主色 |
| 按钮 .menu-btn | 统一 `border-radius:6px` + hover 上浮 + `box-shadow` + `color:#fff` |
| 表单输入框 | `max-width:160px`→`220px` + 左对齐 + 圆角 + focus 主色光晕 |
| 复选框 | `accent-color:#5d87c2` 统一主色 |
| 设置项 | `margin-bottom:3px`→`8px` + `padding:6px 8px` + hover 主色半透明背景 |
| 底部按钮区 | `#eee`→`#e2e8f0` + `#fbfcfd` + flex 布局 + gap 间距 |
| 自动备份区域 | hr 分隔线→主色分区标题「⏰ 自动备份」+ 说明文案 |

**实施**：`setting-plugin.css` 重写 + `setting-dialog.tsx` 微调（侧栏背景、备份面板按钮 emoji+flex gap、自动备份分区标题、底部 flex、凭证 ID 字号 12→11px 颜色 `#94a3b8`）。

**结果**：v1.8.0→1.8.1。产物 1851.72 kB。

---

## 9. 详情页 UI 精简与拉黑按钮（doc/71–73）

演进链：doc/71（误判选择器，隐藏"原生评价面板"）→ doc/72（修正：实际应隐藏脚本自己的菜单状态行）→ doc/73（拉黑按钮补位）。

### doc/71 — 隐藏详情页原生评价操作面板（第一步）

**背景**：快捷评分模块（`DetailPageButtonPlugin._buildRatingBar`）已在详情页注入星星评分条（5 星 + 已读 + 收藏），完全覆盖 JavDB 原生评价操作面板，原生面板仍可见造成 UI 冗余。用户要求隐藏，对应选择器 `div:nth-child(4) > div > div:nth-child(2) > div:nth-child(1)`。

**方案与决策**：用 CSS `display:none` **隐藏而非去掉**（保留 DOM）。原因：`_buildRatingBar` 注入快捷评分条不受影响；`_syncRatingBar` 从原生 DOM 读状态（querySelector 正常）；`hookWantAndWatchedButtons` MutationObserver 正常；`_getReviewId` 从 `.review-buttons a[data-method=delete]` 提取 reviewId 正常；`_javdbReviewApi` + `_execRailsJs` 更新隐藏 DOM 正常。补充隐藏 `review-buttons` 内剩余原生 UI（`.rating-star` / `form` / `.field`），DOM 保留供 `_syncRatingBar` 读 `input[name="video_review[score]"][checked]` 与 `_getReviewId` 提取删除链接。

**结果**：v1.8.1→1.8.2。产物 1852.39 kB。**选择器误判，见 doc/72。**

### doc/72 — 修正：隐藏菜单按钮组状态行（屏蔽/收藏/已观看）

**doc/71 修正**：通过 MCP 访问 javdb 详情页确认，doc/71 使用的用户选择器 `div:nth-child(4) > div > div:nth-child(2) > div:nth-child(1)` 对应的实际是**脚本自己创建的 `DetailMenuButtons` 按钮组左行**（`#filterBtn`/`#favoriteBtn`/`#hasWatchBtn`），不是 JavDB 原生评价面板；原生评价面板早已被 rating-bar.css 原有规则隐藏（用户反馈"原来就没问题"）。本 doc 撤回 doc/71 在 rating-bar.css 新增的两条多余规则（`.review-buttons .rating-star/form/.field` + 面板选择器）。

**实际需求**：`DetailMenuButtons` 组件（`createMenuBtn` 注入到 `.tabs` 后方）含两行——左行（屏蔽/收藏/已观看）已被快捷评分条完全覆盖需隐藏；右行（磁力过滤 + 字幕迅雷 + 字幕 SubTitleCat）是独立功能必须保留。

**方案与决策**：给左行加 `className="jhs-menu-status-row"`、右行加 `className="jhs-menu-tools-row"`，rating-bar.css 隐藏左行。隐藏而非去掉：`createMenuBtn` 绑定了三个按钮的 click、`showStatus` 更新文案、快捷键（filterHotKey/favoriteHotKey/hasWatchHotKey）通过模拟这些按钮的 click 实现——隐藏后事件绑定与文案更新仍正常运行，不影响快捷键。

**结果**：v1.8.2→1.8.3。产物 1852.12 kB（−0.27 kB，撤回多余 CSS）。

### doc/73 — 快捷评分面板新增拉黑按钮（第二步）

**背景**：doc/72 隐藏菜单状态行后拉黑功能随之不可见，需在快捷评分面板新增「🚫 拉黑」按钮替代被隐藏的 `#filterBtn`。拉黑不能单纯屏蔽——需同时将 javdb 原生端设为已读 0 星（和已读按钮一样调 `_triggerJavdbReview(0)`），并弹确认框警告严重性。

**方案与决策**（拉黑 vs 普通已读）：

`quickBlock` 完整流程：点击 🚫 拉黑 → `utils.q` 确认框（警告严重性）→ 确认后：①removeCar 清除已有记录（避免 saveCar 抛错）②saveCar({ actionType: FILTER_ACTION }) ③`broadcastWantWatchedSync({status:'filter', op:'add'})` ④`_reviewChain` 串行：`_wantWatchedSyncing=true`（阻断 observer）→ `_triggerJavdbReview(0)`（设为已读 0 星）→ `_syncRatingBar()` → `_wantWatchedSyncing=false` ⑤showStatus + refresh + closePage。

| 行为 | 普通已读 `quickSetHasWatch(0)` | 拉黑 `quickBlock` |
|------|-------------------------------|------|
| JHS 本地状态 | `HAS_WATCH_ACTION` + score=0 | `FILTER_ACTION`（屏蔽） |
| javdb 原生端 | 设为已观看 0 星 | 同样设为已观看 0 星（不在想看列表、不出现在推荐） |
| 确认弹窗 | 无 | 必须有，警告严重性 |
| 操作后 | 留在详情页 | 关闭页面（`utils.closePage()`）+ 刷新（`refresh()`） |
| 广播 | `hasWatch+add` | `filter+add`（让列表页隐藏该卡片） |
| 互斥处理 | 先移除 favorite | 先移除已有记录（favorite/hasWatch），再写 FILTER_ACTION |
| observer 阻断 | `_wantWatchedSyncing=true` | 同样阻断（防 onWatchedAdded 覆盖 FILTER_ACTION） |

**关键风险处理**：①MutationObserver 误触发——`_triggerJavdbReview(0)` 触发 Rails JS 更新 `.review-buttons` DOM → `hookWantAndWatchedButtons` 检测"已观看"被添加 → `onWatchedAdded` 写入 `HAS_WATCH_ACTION`，与拉黑写的 `FILTER_ACTION` 冲突；解法与 `quickSetHasWatch` 一致：`_wantWatchedSyncing=true` 阻断 + `_reviewChain` 串行化。②`saveCar` 抛错——该番号已有记录（已收藏/已观看）时 `saveCar` 抛"已在收藏列表中"/"已在屏蔽列表中"；解法：先 `removeCar` 清除已有记录再写 `FILTER_ACTION`。③`_syncRatingBar` 增加 filter 状态——filter 是 JHS 独有（javdb 原生无屏蔽概念），原本只从原生 DOM 读 want/watched；新增异步查 `storageManager.getCar` 判断是否已拉黑，是则给 `.jhs-block-btn` 加 `is-active` 高亮（红色 `#de3333`）。

**实施**：`rating-bar-html.tsx` `.jhs-rating-actions` 内新增 `.jhs-block-btn`；`detail-page-button-plugin.tsx` `_buildRatingBar` 获取 blockBtn 绑定 click → 新增 `quickBlock` 方法（确认框 → removeCar → saveCar FILTER_ACTION → 广播 filter+add → `_reviewChain` 串行 `_triggerJavdbReview(0)` + `_syncRatingBar` → showStatus + refresh + closePage）；`rating-bar.css` `.jhs-block-btn` 样式（hover/is-active 红色/is-popping 动画）。

**结果**：v1.8.3→1.8.4。产物 1854.22 kB。快捷键屏蔽（filterHotKey）仍正常（事件绑定在隐藏的 `#filterBtn` 上）。

---

## 10. 封面点击委托修复（doc/74）

### doc/74 — 修复列表页封面图未加载时点击走原生跳转

**背景/症状**：首页及所有列表页，item 封面图片未加载完成时点击会走 JavDB 网站默认逻辑——`<a href="/v/xxx">` 打开新网页，而非脚本期望的 layer iframe 弹窗（`utils.openPage`）；图片加载完成后点击则正常。

**根因**：`ListPagePlugin.bindClick()` 用 jQuery 事件委托绑定 `$(selectorConfig.boxSelector).on('click', '.item img', ...)`——只有点击 `<img>` 元素本身才匹配。JavDB item DOM 结构：`div.item > a.box > div.cover`（CSS `min-height:350px` / `padding-top:142%`，**始终有面积**）`> img[loading="lazy"]`（原生懒加载，未加载时 `<img>` 无尺寸，不覆盖 `.cover` 全部面积）。用户实际点中的是 `.cover` div 或 `<a>` 父元素 → 委托不匹配 → `event.preventDefault()` 未执行 → 走原生 `<a>` 跳转。图片加载后 `<img>` 有尺寸覆盖 `.cover`，点击命中选择器，正常走 iframe 弹窗。

**方案与决策**：事件委托选择器 `.item img` → `.item .cover`。理由：`.cover` 有 CSS 撑开面积，图片未加载也始终可点击；`<img>` 在 `.cover` 内，点击 `<img>` 时事件冒泡也能匹配（jQuery 事件委托检查 `event.target` 祖先链）；不影响 `.item video`（视频播放）、`.item .video-title`（标题点击）的单独委托；不影响 `div.meta-buttons` 排除逻辑（`closest('div.meta-buttons')`）。contextmenu（右键屏蔽）同理：`.item img, .item video` → `.item .cover, .item video`。

**实施**：`list-page-plugin.tsx` `bindClick()` click 委托与 contextmenu 委托各改一处 + 注释说明。**不修改** archetype（原始脚本也用 `.item img`，本修复是对原始脚本的改进，不追溯）；`base-plugin.ts` `getSelector()` 的 `coverImgSelector: '.cover img'` 仍用于 `replaceHdImg()` 和 hover 预览，不改。

**结果**：产物 1854.23 kB。lightningcss Semicolon 警告为 layer.css IE hack（`*display:inline` 等）由 `errorRecovery: true` 容错的已知现象。

---

## 11. 法律与版权合规（doc/75）

### doc/75 — 法律条款与项目说明更新

**背景**：项目基于 GreasyFork 脚本 JAV-JHS（脚本 ID 558525）的 **3.3.6 版本**二次开发；原始脚本以 MIT 协议发布，3.3.6 之后的后续版本转为私密付费（GreasyFork 页面已对游客关闭）。本项目基于 MIT 协议下发布的 3.3.6 版本，行使 MIT 授予的修改与再发布权利。此前协议声明缺口：无 LICENSE 文件（MIT 强制要求附带许可证全文）；README License 节仅写 "MIT" 两字；vite.config.ts 无 @copyright 字段；package.json 无 license 字段。

**方案与决策**（补全 MIT 合规要求，明确衍生关系与归属）：

| 文件 | 变更 |
|------|------|
| `LICENSE` | 新建：MIT 全文 + 版权声明 `2024-2026 zerobiubiu` + 衍生关系说明 + 13 个集成脚本清单 |
| `README.md` | License 节重写为 "License & Attribution"：衍生关系声明（基于 JAV-JHS 3.3.6 / MIT / 后续转私密付费 / MIT 永久授权）+ 集成脚本致谢表 |
| `vite.config.ts` | userscript 头部增加 `@copyright: '2024-2026 zerobiubiu (https://github.com/zerobiubiu) — 基于 JAV-JHS 3.3.6 (MIT) 二次开发'` |
| `package.json` | 增加 `"license": "MIT"` 字段 |

**法律依据**：MIT 协议为永久授权——一旦以 MIT 发布，接收方权利不可撤销，后续版本改协议不影响已发布版本的 MIT 授权；MIT 对衍生作品的义务为保留版权声明 + 附带许可证文本（本项目通过 LICENSE 与 README Attribution 履行）；3.3.6 以 MIT 发布允许修改、合并、发布、再授权，本项目拆分重构 + 功能扩展属 MIT 明确允许的衍生作品。

**结果**：纯元数据/文档变更，不涉及 `src/` 源码逻辑修改，按版本号规则**不递增版本号**，保持 1.8.5。构建验证 vite-plugin-monkey 正确输出 `@copyright` 元数据到产物头部。

---

## 附：本阶段版本演进与产物大小总览

| 版本 | 主要变更 | 产物（gzip） |
|------|----------|-------------|
| 1.1.0 | doc/49 MissavQuickCopy 集成 | 1815.46 kB（415.22） |
| 1.2.0 | doc/50 更名 JavDB Power Tools + README | 1815.46 kB（415.25） |
| 1.4.0 | doc/52 移除 ListParserPlugin + 预加载优化 | 1818.14 kB（415.53） |
| 1.5.0–1.5.2 | doc/53–55 「等待更新」自动收藏三连 | 1819.41→1820.81 kB |
| 1.6.0–1.6.5 | doc/56–60 「新增清單」功能与连环修复 | 1825.78→1832.52 kB |
| 1.7.0–1.7.1 | doc/61–62 清单删除/改名监听与重写 | 1839.05→1842.98 kB |
| 1.7.2–1.7.7 | doc/63–68 toast/性能/繁简/评分缓存 | 1842.86→1843.47 kB |
| 1.8.0–1.8.1 | doc/69–70 自动备份 + 设置面板美化 | 1849.12→1851.72 kB |
| 1.8.2–1.8.4 | doc/71–73 详情页 UI 精简 + 拉黑按钮 | 1852.39→1854.22 kB |
| 1.8.5 | doc/74 封面点击修复；doc/75 法律条款（不递增） | 1854.23 kB（424.22） |

> 说明：doc/51 未在文中标注版本号；doc/52 对比基线为 v1.3.3（1820.44 kB）并提及 changelog 补录 v1.3.2/v1.3.3 条目——即 doc/51 与本批次之间存在未覆盖的 1.3.x 小版本（属其他批次文档范围），本表如实保留原文标注。

## 遗留问题汇总

- **`gmHttp.postForm` 未做 `encodeURIComponent`**（预存 bug，doc/58 确认）：新增清单请求手动编码绕开，gmHttp 本身未修
- **`fetchListIdByName`（GET /users/lists 解析）实测无效**（doc/60）：保留作未来 JavDB 页面改造的保险位
- **删除清单网络错误场景**（doc/64）：本地已删、服务器未删，刷新后清单重现，不一致但可自愈
- **原生页面直接改评分**（doc/67）：jhs 不知道、不广播，RatingCache 保持旧值，依赖 init 悬停验证兜底
- **新增清单响应格式变化风险**（doc/58 排查指引）：若服务端响应不再含 `data-list-id` 且格式再变，需调整兜底正则
- **繁→简替换边界**（doc/66 教训）：全局文本替换不得触碰与服务端 DOM/API 交互的字符串（选择器、匹配串、错误消息）