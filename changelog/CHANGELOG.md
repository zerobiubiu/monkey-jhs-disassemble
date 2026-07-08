# 更新日志

> 所有版本的变更记录，按版本倒序排列（最新在最前）。
>
> 版本号规则：`major.minor.patch`
> - **patch**：修 bug、小改动、优化、协同修复
> - **minor**：新增插件、新增功能模块、较大功能变更
> - **major**：架构级重构、不兼容变更

---

## v1.8.1

**发布日期**：2026-07-08

### 优化

- **设置面板 UI 美化**（doc/70）：
  重写 `setting-plugin.css`，统一以 `#5d87c2` 为主色贯穿侧栏/按钮/表单/复选框。
  侧栏改柔和灰底 + active 主色高亮；`menu-btn` 统一圆角 + hover 上浮阴影；
  表单输入框左对齐 + focus 主色光晕；复选框 accent-color；设置项 hover 背景；
  底部按钮区 flex 布局 + gap 间距。数据备份面板按钮加 emoji，自动备份区域
  hr 改主色分区标题。

---

## v1.8.0

**发布日期**：2026-07-08

### 新增

- **自动备份功能**（doc/69）：
  默认每天第一次打开时自动备份到 WebDav，无需手动点击。新增核心模块
  `src/core/auto-backup.ts`，负责本机凭证 ID 管理、触发判断、增量滚动文件名。
  设置「数据备份」面板新增「启用自动备份」「备份频率」「本机凭证」三个配置项。
  备份格式注入 `__meta`（credentialId + autoBackupConfig + backupTime）。
  凭证 ID 用 UUID v4 生成，存 GM 存储（不进入备份系统），每台电脑的每个浏览器
  唯一。一个浏览器只保留一份 `auto_<credentialId>.json`，每次自动备份增量覆盖。
  自动备份策略随备份文件保存。支持三种频率：每天第一次打开（默认）/ 每次打开 /
  不自动备份。

---

## v1.7.7

**发布日期**：2026-07-08

### 修复

- **0 星（已读未评分）显示 ★0 而非占位「已看」**（doc/68）：
  doc/67 的评分缓存同步优化有两处将 0 星排除：`_invalidateCards` 写入条件
  `score && score >= 1`（0 是 falsy 短路为 false）+ `showRating` 渲染分支
  `rating && rating >= 1`（同样排除 0），导致详情页点「已读」后列表页仍显示
  占位「已看」。修正写入条件为 `typeof score === 'number'`（0-5 均写入），
  `showRating` 增加 `rating === 0` 分支显示金色「★0」。

---

## v1.7.6

**发布日期**：2026-07-08

### 优化

- **评分缓存同步优化：详情页标记已读时直接写入评分缓存**（doc/67）：
  详情页点击「已读」或星级按钮时 `quickSetHasWatch(score)` 已知评分，
  但列表页 `RatingDisplayPlugin` 使用独立的 `RatingCache`，两套缓存互不相通，
  导致列表页悬停已看卡片仍需 `GM_xmlhttpRequest` 远程抓取详情页解析评分。
  扩展 `broadcastWantWatchedSync` 广播 payload 携带 `score`，列表页
  `_invalidateCards` 收到 `hasWatch+add+score≥1` 时直接 `RatingCache.set`
  写缓存，`processItem` 命中缓存显示评分，免去远程抓取。`score=0`（已读未评分）、
  想看/收藏/取消等保持原清缓存逻辑不变。

---

## v1.7.5

**发布日期**：2026-07-08

### 修复

- **修复繁→简替换破坏 DOM 选择器导致番号丢失等问题**（doc/66）：
  doc/59（commit `bcf046c`）全局繁→简替换将代码中 jQuery 选择器、
  字符串匹配中的繁体改为简体，但 JavDB DOM/API 返回仍为繁体，
  导致全部失配。还原 8 处功能性 bug：
  - `base-plugin.ts`：`a[title="複製番號"]`（**番号丢失根因**）+
    `無碼` 检测
  - `actress-info-plugin.tsx`：`演員` / `現年齢` 选择器
  - `list-page-plugin.tsx` + `storage-manager.ts`：`（無碼）` 标签
  - `related-plugin.tsx` + `review-plugin.tsx`：`簽名已過期` 错误检测
  - 7 个组件显示文本还原为繁体（磁鏈/演員/番號/清單/預告片/上一頁/看過等）

---

## v1.7.4

**发布日期**：2026-07-08

### 修复

- **修复详情页清单面板「预设清单」过滤失效**（doc/65）：doc/59
  全局繁→简替换将代码中的 `預設清單` 改为 `预设清单`，但 JavDB
  DOM 返回仍为繁体 `預設清單`，`includes('预设清单')` 不匹配导致
  过滤失效、預設清單显示在面板中。改用正则 `/预[设設]清[单單]/`
  同时匹配简繁体。修改 `detail-page-button-plugin.tsx` 的
  `_initListPanel` sync 和 `vlt-sync.ts` 的 `refreshListPanel` 两处。

---

## v1.7.3

**发布日期**：2026-07-08

### 优化

- **删除清单性能优化：乐观 UI + 并行执行**（doc/64）：原方案串行
  等待服务器响应才移除 DOM，用户感知延迟大。改为 confirm 后立即
  移除 DOM（乐观更新），`GM_xmlhttpRequest DELETE` 与
  `VltDb.deleteList` 并行执行（`Promise.all`）。瓶颈分析：网络请求
  等待 JavDB 服务器响应是最大延迟源（数百ms~数秒），IDB 操作
  （83KB / 3563 条关联）仅 ~50ms 非瓶颈。服务器失败时 warning toast
  而非恢复 DOM。

---

## v1.7.2

**发布日期**：2026-07-08

### 修复

- **修复 toast 通知被导航栏遮挡**（doc/63）：`#jdb-toast-container`
  的 `top` 从 `20px` 改为 `72px`（导航栏高 56px + 16px 间距），
  z-index 99999 本身高于导航栏无需调整。

---

## v1.7.1

**发布日期**：2026-07-08

### 修复

- **重写清单删除/改名监听：拦截原生操作 + 自行发请求 + 实时广播**
  （doc/62）：doc/61 的 MutationObserver 方案失效——JavDB 删除 AJAX
  返回的 JS 不移除 `<li>`，需刷新才消失，observer 永远不触发，导致
  IDB 关联未清除、DOM 不实时消失、广播未发送。改为全权接管：
  - **删除**：捕获阶段拦截删除链接 click + preventDefault + 自行 confirm
    + GM_xmlhttpRequest DELETE → 成功后 deleteList + 广播 + 移除 DOM
  - **改名**：拦截保存按钮 click + GM_xmlhttpRequest POST
    /users/update_list → 成功后 renameList + 广播 + 更新 DOM
  - **独立广播通道** `jdb:list-mgmt`（不混用 jdb:last-sync）
  - **详情页**新增广播接收器：删除→移除 checkbox，改名→更新标签文本
  - **列表页**新增广播接收器：删除/改名→refreshAllTags 全量刷新
  - 从 app.js 逆向确认服务端 API（DELETE /users/remove_list +
    POST /users/update_list {id, name}）

---

## v1.7.0

**发布日期**：2026-07-08

### 新增

- **/users/lists 清单删除/改名监听→同步本地 IDB**（doc/61）：用户在
  清单管理页删除或改名清单后，服务端数据已变更但本地 IndexedDB 仍
  保留旧数据，导致列表页标签显示不一致。现以 DOM 变化作为成功信号
  自动同步：
  - **删除**：MutationObserver 检测 `#list-<listId>` `<li>` 从 DOM
    移除 → `VltDb.deleteList()`（删 inventory + 所有 `::listId` 关联）
  - **改名**：捕获阶段 click 快照旧名+listId → 保存时读新名 →
    MutationObserver 等 `.list-name` 文本变化 → `VltDb.renameList()`
  - 三重广播 `designation='*'` 触发列表页 `refreshAllTags` 全量刷新
  - VltDb 新增 `deleteList` / `renameList` 方法
  - 零侵入已定稿插件，不拦截/阻止 JavDB 原生删除/改名请求

---

## v1.6.5

**发布日期**：2026-07-08

### 优化

- **降低新增清单操作延迟**（doc/60）：首次轮询从 2000ms 降到 200ms
  （JavDB 响应实测永远是 `Toastr.success("...")` 不更新 DOM，长时间
  空轮询纯属浪费）。关闭模态框延迟从 400ms 降到 200ms。整体流程从
  ~2.7s 降至 ~0.7s。

---

## v1.6.4

**发布日期**：2026-07-08

### 修复

- **修复新增清单：改用 #save-list-button 切换重载替代 /users/lists 解析**
  （doc/60）：doc/59 的 GET /users/lists 解析方案实测失效——页面通过
  JS（Turbo/Stimulus）动态加载清单数据，原始 HTML 不含清单列表，
  `fetchListIdByName` 永远找不到新清单。改为在创建成功后点击
  `#save-list-button` 两次（关闭→重新打开模态框），触发 JavDB 原生
  Stimulus `list` 控制器重新 ajax 加载清单列表（含新清单 checkbox），
  轮询 5s 检测后完成 IDB 同步。多级兜底链路：轮询 2s → 正则提取 →
  #save-list-button 重载 → /users/lists 解析。

---

## v1.6.3

**发布日期**：2026-07-08

### 修复

- **修复新增清单响应无 list-id**（doc/59）：doc/58 的 GM_xmlhttpRequest
  方案成功发请求、服务端创建清单，但控制台日志显示响应仅为
  `Toastr.success("...")` JS——不含 `data-list-id`、不含 HTML、
  不更新 `listContainer`。doc/58 的「从响应正则提取 data-list-id」兜底
  无法匹配。新增 `fetchListIdByName`：`GET /users/lists` 页面 HTML →
  `DOMParser` 解析 `a[href*="/lists/"]` 链接 → 匹配清单名称 → 提取
  `/lists/{id}` 中的 list-id。`createList` 多级兜底链路：注入 JS 执行
  → 轮询 2s → 正则提取 → **GET /users/lists 匹配** → 手动克隆 checkbox
  构建 → refreshListPanel + handleCheckboxChange。

### 变更

- **全局繁→简字符替换**：用户要求插件 UI 文本统一简体中文，不沿用
  JavDB 网站繁体中文。Python 脚本遍历 `src/` 全部 21 个 `.ts/.tsx`
  文件批量替换繁体字（toast 文案、按钮文本、注释）。

---

## v1.6.2

**发布日期**：2026-07-08

### 修复

- **终极修复新增清单：改用 GM_xmlhttpRequest 直接发 ajax**（doc/58）：
  doc/57 的「observer 挂 modal + 轮询」修复实测无效，根因诊断错误。
  实际根因：JavDB 已从 Rails UJS 迁移到 Turbo，`form#new_list` 的
  `data-remote="true"` 不再被拦截，`submitBtn.click()` 触发**常规表单
  POST**（非 ajax），页面导航、脚本卸载，所有后续效果丢失。
  改为完全绕过原生表单提交，用 `GM_xmlhttpRequest` 直接发 ajax
  POST `/lists/remote_create`：从表单收集字段 + meta csrf-token +
  `X-Requested-With` + `Accept: text/javascript` 模拟 Rails UJS ajax；
  响应 JS 注入 `<script>` 页面上下文执行 + 3s 轮询检测新增 checkbox +
  兜底从响应正则提取 `data-list-id` 克隆已有 checkbox 手动构建；
  完成时 `refreshListPanel` + `handleCheckboxChange(add)` 同步 IDB。

---

## v1.6.1

**发布日期**：2026-07-08

### 修复

- **修复新增清单后无即时反馈、必须刷新页面才能看到**（doc/57）：
  doc/56 的 `MutationObserver` 挂在提交前的 `listContainer` 引用上，
  但 Rails/Stimulus 的 `onCreateSuccess` 响应会整个替换 `listContainer`
  元素，旧引用变孤立节点、observer 永不触发，导致「清单已创建但无任何
  后续效果（无 toast/无 IDB 同步/无自动收藏）、必须刷新页面才能看到」。
  重构 `createListViaNativeForm`：observer 改挂不可替换的
  `#modal-save-list` + 200ms 轮询兜底（共享 `settled` 幂等守护）+
  `detectNew` 每次重新查询最新 `listContainer`；完成时主动
  `refreshListPanel()` 从最新 `listContainer` 克隆到 `.jhs-list-panel`
  （与 `_initListPanel` sync 等价、幂等），即使该插件 observer 失效
  也能立即看到新清单；超时 5s→8s 兼顾慢网络。零侵入
  `DetailPageButtonPlugin`。

---

## v1.6.0

**发布日期**：2026-07-08

### 新增

- **展开清单面板新增「新增清單」入口 + 自动同步关联**（doc/56）：
  原生「存入清單」弹窗被 CSS 永久隐藏，footer 的「創建新清單」按钮
  不可达，展开布局下新增清单功能失效。在 `.jhs-list-panel` 旁插入
  Bulma 风格「➕ 新增清單」UI；提交时驱动原生表单 `#new_list`
  （Rails UJS ajax POST `/lists/remote_create`，服务端创建即自动关联
  视频，与网站原始流程完全等价）。同时由于 Stimulus 切换新 checkbox
  的 `checked` 不派发 `change` 事件，本地 IDB 关联同步原本失效——
  此前用户需手动「取消关联→再关联」才能同步，现通过 MutationObserver
  快照对比识别新增 checkbox 后显式 `handleCheckboxChange(add)`，
  彻底消除该手动步骤。零侵入已定稿插件。

---

## v1.5.2

**发布日期**：2026-07-08

### 修复

- **自动收藏联动星标评分组件**（doc/55）：doc/54 广播后详情页星标评分处
  收藏仍未高亮。根因是 `_syncRatingBar` 从 JavDB 原生 DOM 检测「想看」
  状态而非 JHS IDB。补充 `triggerJavdbWantAndSyncRatingBar`：通过
  `pluginManager.getBean` 获取 `DetailPageButtonPlugin` 实例，复用
  `_reviewChain` 串行调用 `_triggerJavdbWant`（JavDB API 设为想看 +
  Rails JS 同步更新 DOM）+ `_syncRatingBar`（刷新评分条收藏高亮），
  与 `quickConvertToFav` 完全一致。零侵入已定稿插件。

---

## v1.5.1

**发布日期**：2026-07-08

### 修复

- **自动收藏补充三重广播事件**（doc/54）：doc/53 的自动收藏仅写了
  IndexedDB，未触发后续事件链。补充 `broadcastWantWatchedSync` 三重广播
  （GM_setValue/localStorage/CustomEvent），与手动收藏
  （`onWantAdded`/`quickConvertToFav`）效果一致——详情页菜单按钮文案
  刷新 + 列表页 status-tag 同步刷新。

---

## v1.5.0

**发布日期**：2026-07-07

### 新增

- **向「等待更新」清单添加视频时自动收藏**（doc/53）：在详情页勾选名称
  包含「等待更新」的清单时，自动将未收藏的视频写入 JHS 收藏
  （`FAVORITE_ACTION`）。保守策略不覆盖已有其它状态（屏蔽/已观看），
  已收藏的视频跳过。fire-and-forget 不阻塞清单同步广播。

---

## v1.4.0

**发布日期**：2026-07-07

### 移除

- **移除清单解析器插件（ListParserPlugin）**：清单详情页的"唤醒解析器"按钮
  不再需要，完全移除。插件计数 36 → 35（javdb 33 + missav 2）。

### 优化

- **预加载触发逻辑优化**：不再依赖 `isListPage` 判断，改为直接检测 `.movie-list`
  是否存在。`/lists/xxx` 清单详情页现在也能预加载，`/users/*` 清单列表页
  自动排除。
- **预加载日志增强**：启动时打印 item 数/屏蔽数/已缓存数/入队任务数/被拦截
  站点；每个任务完成打印 ✓命中/✗未命中/⚠拦截。
- **SupJav 站点策略调整**：全站 Cloudflare 拦截严重，改为始终显示黄色
  （warn 状态）+ 搜索页链接，不再发任何请求。
- **预加载 Cloudflare 容错**：检测到 403 后跳过该站点本轮剩余任务。

---

## v1.3.3

**发布日期**：2026-07-07

### 优化

- **预加载触发逻辑优化**：不再依赖 `isListPage` 判断，改为直接检测 `.movie-list`
  是否存在。`/lists/xxx` 清单详情页（有 `.movie-list`）现在也能预加载，
  `/users/*` 清单列表页（容器是 `#lists > ul`）自动排除。
- **预加载日志增强**：启动时打印 item 数/屏蔽数/已缓存数/入队任务数/被拦截站点；
  每个任务完成打印 ✓命中/✗未命中/⚠拦截。
- **瀑布流联动确认**：`startPreloadObserver` 监听 `.movie-list` childList，
  AutoPage 瀑布流 append 新页自动触发预加载（500ms 防抖 + 跳过已缓存）。

---

## v1.3.2

**发布日期**：2026-07-07

### 变更

- **SupJav 站点策略调整**：SupJav 全站 Cloudflare 拦截严重，解析不可靠。
  改为始终显示黄色（warn 状态）+ 搜索页链接，不再发任何请求（预加载 +
  详情页加载均跳过）。利用已有的 `initUrl` 机制实现零侵入。

---

## v1.3.1

**发布日期**：2026-07-07

### 优化

- **OtherSitePlugin 预加载 Cloudflare 容错**：检测到 supjav/missav 返回
  403 + "Just a moment..." 后，标记该站点并跳过本轮剩余预加载任务，
  避免逐个失败刷屏 + 浪费请求。下次页面加载时自动重试。

---

## v1.3.0

**发布日期**：2026-07-07

### 新增

- **OtherSitePlugin 列表页预加载缓存**（doc/51）：列表页浏览时自动预加载
  missav/supjav 搜索结果缓存，打开详情页后按钮零延迟变绿。串行限流 +
  跳过已缓存 + autoPage 瀑布流新页自动预加载。

---

## v1.2.0

**发布日期**：2026-07-07

### 变更

- **项目重命名为 JavDB Power Tools**（doc/50）：userscript `@name` 从
  `鉴黄师（test）` 改为 `JavDB Power Tools`，`@description` 重写为
  双站 36 功能插件描述
- **README 全新重写**：6 大类 36 功能清单 + 安装/配置/支持站点/技术架构/
  隐私说明/开发指南
- **插件计数同步**：AGENTS.md / doc / main.tsx 统一为 36（javdb 34 + missav 2）

---

## v1.1.0

**发布日期**：2026-07-07

### 新增

- **MissAV Quick Copy & JavDB 搜索插件**（doc/49）：MissAV 播放页番号
  一键复制 + 跳转 JavDB 搜索。原生 createElement 创建按钮 + SVG 图标，
  保留原 `<a>.click()` 打开新标签页实现。

---

## v1.0.1

**发布日期**：2026-07-07

### 修复

- **StatusTagFilter 与 jhs 屏蔽深度协同修复**（doc/48）：协同安全判断从
  依赖易变的 `style.display` 升级为依赖稳定的语义属性 `data-hide`，
  彻底消除排序/筛选时序竞争导致的屏蔽失效。统计函数排除被屏蔽卡片，
  芯片计数不再失真。

---

## v1.0.0

**发布日期**：2026-07-07

**初始公开发布版本**。由单文件混淆脚本 `archetype/jhs.user.js`（11605 行）
拆分重构为 Vite + React + TypeScript 工程化项目，并集成多个独立油猴脚本，
形成 JavDB / MissAV 双站增强工具箱，共 36 个功能插件。

### 核心重构（doc/01-24）

- **架构搭建**（doc/01-05）：Vite + vite-plugin-monkey + React + TypeScript
  工程化搭建，单文件混淆脚本拆分为 core / plugins / components / constants /
  styles / types 模块化结构
- **组件化**（doc/06-23）：63 个 HTML 字符串 → React 函数组件（jsxToString
  渲染 HTML 字符串，不依赖 react-dom），覆盖弹窗/表格/按钮/状态标签/设置面板等
- **库 ESM 迁移**（doc/24）：7 个第三方库（jQuery/Tabulator/layer/Toastify/
  localforage/Viewer/blueimp-md5）从 `@require` CDN 改为 ESM import 打包进产物

### JavDB 主脚本拆分插件 — 23 个（来自 jhs.user.js）

- **ListPagePlugin**：列表页主插件（封面高清/状态过滤/状态标签/翻译/排序/快捷键）
- **AutoPagePlugin**：列表页瀑布流自动翻页
- **FoldCategoryPlugin**：分类区折叠/展开 + 标签高亮收藏
- **ListPageButtonPlugin**：列表页按钮组（批量打开/排序切换/加入黑名单）
- **HistoryPlugin**：鉴定记录（Tabulator 远程分页表格）
- **SettingPlugin**：设置弹窗 + WebDav 云备份 + 缓存管理
- **NavBarPlugin**：导航栏重构 + 以图识图
- **HitShowPlugin**：热播榜单（日/周/月榜）
- **Top250Plugin**：Top250 排行榜 + 登录框
- **DetailPagePlugin**：详情页外链 + fancybox 开关
- **ReviewPlugin**：详情页评论加载（折叠/分页/链接渲染）
- **DetailPageButtonPlugin**：详情页按钮组（屏蔽/收藏/已观看/磁力/字幕/评分）
- **HighlightMagnetPlugin**：磁链高画质优先过滤
- **PreviewVideoPlugin**：DMM 预告片解析播放
- **FilterTitleKeywordPlugin**：标题关键词右键屏蔽
- **ActressInfoPlugin**：演员信息（维基百科抓取身高/三围/罩杯）
- **OtherSitePlugin**：第三方站点跳转（MissAv/SupJav 搜索+缓存）
- **WantAndWatchedVideosPlugin**：想看/已观看列表导入
- **RelatedPlugin**：相关清单加载
- **BlacklistPlugin**：演员黑名单 + 递归抓取番号
- **FavoriteActressesPlugin**：收藏演员 + 头像替换（GFriends）
- **NewVideoPlugin**：新作品检测弹窗
- **Fc2Plugin**：FC2 番号详情弹窗

### 独立脚本集成插件 — 13 个（来自 archetype/*.user.js）

- **RatingDisplayPlugin**（doc/25）：列表页个人评分显示（缓存+懒加载）
- **KeyPageTurningPlugin**（doc/34）：左右方向键翻页
- **ModMyListOpenWayPlugin**（doc/35）：清单链接新标签打开 + 短地址
- **PageSortPlugin**（doc/36+37）：单页内容排序 + 与 jhs 排序系统协调优化
- **StatusTagFilterPlugin**（doc/38）：状态标签筛选芯片（OR 逻辑）
- **ListWaterfallPlugin**（doc/39）：清单页瀑布流自动翻页
- **ListReadingStatusPlugin**（doc/40）：清单阅读进度 + 1-5 星评分
- **ModalListDisablerPlugin**（doc/42）：保存到清单模态框自动禁用
- **ListParserPlugin**（doc/43）：清单解析器唤醒按钮
- **VideoListsTagPlugin**（doc/45）：清单标签同步 + 筛选栏 + 本地 IDB
- **CarListReaderPlugin**（doc/46）：javdb 端车辆状态增量推送 + 全量同步
- **MissavStatusTagPlugin**（doc/46）：missav 端状态标签渲染
- **MissavQuickCopyPlugin**（doc/49）：missav 播放页番号复制 + JavDB 跳转

### 基础设施优化（doc/26-33, 41, 44, 47）

- 标识符语义化重命名（doc/26）
- 清理 javbus 死代码（doc/27）+ 其他死代码（doc/28）
- FC2 插件迁移修复点击失效（doc/29）
- Tabulator 完整版修复 formatter 缺失（doc/31）
- CSS 布局修复（doc/32）：toast 超宽 + 按钮贴连
- 收藏状态下评分星星禁用修复（doc/33）
- terser 最高压缩率配置（doc/44）：产物 -35%
- 运行时调度优化（doc/47）：CSS 先于逻辑注入 + 依赖清理
- 移除失效的 parallel_GM_xmlhttpRequest @require（doc/41）

### 跨站同步（doc/46）

- 去后端化：JavDB → MissAV 状态同步改用 GM 存储跨域传递（零网络请求）
- 增量推送（实时）+ 全量兜底（页面加载）
- MissAV 端独立 IndexedDB + WebDav 备份支持
