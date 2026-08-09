# 插件与核心模块清单

> **文档类型**：📄 参考说明（当前状态文档）
> **文档状态**：📄 参考
> **说明**：本文件是 `AGENTS.md` §3.3/§3.4 的目录数据落点——全部插件清单与 `src/core/` 模块清单。
> 架构关系与规则见 [`AGENTS.md`](../AGENTS.md)；文档索引、规范与要求见 [`README.md`](README.md)。
> **新增/删除插件或核心模块文件时，必须同步更新本文件与 `AGENTS.md` 的插件计数。**

## 1. 插件清单

共 44 个功能插件（JavDB 39 + MissAV 5）。多模块插件的子目录拆分见各插件源码目录（`src/plugins/<name>/`）。

### 1.1 主脚本拆分插件（22 个）

来自 `archetype/jhs.user.js`

| 插件 | 职责 |
|------|------|
| ListPagePlugin | 列表页主插件：过滤/状态标签/翻译/点击绑定 |
| AutoPagePlugin | 瀑布流自动翻页 |
| FoldCategoryPlugin | 折叠分类 |
| ListPageButtonPlugin | 列表页按钮组（批量打开/排序切换/加入黑名单） |
| HistoryPlugin | 鉴定记录 |
| SettingPlugin | 设置弹窗（侧栏+面板）+ WebDav/Git 备份 + 缓存清理 |
| NavBarPlugin | 导航栏 |
| HitShowPlugin | 热播 |
| Top250Plugin | Top250 排行榜 |
| DetailPagePlugin | 详情页主插件 |
| ReviewPlugin | 评论 |
| DetailPageButtonPlugin | 详情页按钮（想看/观看/评分/清单/字幕/清单序号合并/评价状态自动校验同步） |
| HighlightMagnetPlugin | 高亮磁链 |
| PreviewVideoPlugin | 预览视频 |
| ActressInfoPlugin | 演员信息 |
| OtherSitePlugin | 第三方站点（含列表页预加载） |
| WantAndWatchedVideosPlugin | 想看/已观看 |
| RelatedPlugin | 相关清单 |
| BlacklistPlugin | 黑名单 |
| FavoriteActressesPlugin | 收藏演员 |
| NewVideoPlugin | 新作品检测 |
| Fc2Plugin | FC2 |

### 1.2 独立脚本集成插件（12 个）

来自 `archetype/*.user.js`

| 插件 | 来源脚本 |
|------|----------|
| RatingDisplayPlugin | jhsRatingDisplay.user.js |
| KeyPageTurningPlugin | keyPageTurning.user.js |
| ModMyListOpenWayPlugin | modMyListOpenWay.user.js |
| PageSortPlugin | pageSort.user.js |
| StatusTagFilterPlugin | statusTagFilter.user.js |
| ListWaterfallPlugin | listWaterfall.user.js |
| ListReadingStatusPlugin | listReadingStatus.user.js |
| ModalListDisablerPlugin | modalListDisabler.user.js |
| VideoListsTagPlugin | listsOptionSync + videoListsTag |
| CarListReaderPlugin | jhsCarListReader.user.js |
| MissavStatusTagPlugin | missavStatusTag.user.js |
| MissavQuickCopyPlugin | MissAV Quick Copy & Javdb Search.user.js |

### 1.3 升级新插件（5 个，feature flag 可关）

对照 `jhs.3.3.6.027`（CoverButtonPlugin 已删除）

| 插件 | flag | 职责 |
|------|------|------|
| TranslatePlugin | translatePlugin | 详情页标题翻译 |
| ScreenShotPlugin | screenShotPlugin | javstore 截图墙 |
| MagnetHubPlugin | magnetHubPlugin | 多引擎磁链 |
| ImageRecognitionPlugin | imageRecognitionPlugin | 以图识图 |
| Fc2By123AvPlugin | fc2By123AvPlugin | 123Av FC2 浏览 |

### 1.4 新增功能插件（5 个）

本项目自创（非 archetype 拆分/集成/升级）

| 插件 | 职责 |
|------|------|
| VisitHistoryPlugin | 访问记录：详情页元数据链接悬浮「最近打开时间」 |
| ListReflowPlugin | 清单页编号整理：压实计划预览（期1）+ 压实执行引擎（期2） |
| MissavAutoPagePlugin | MissAV 列表页瀑布流：点击加载下一页 + 加载全部 + 回到顶部；修复懒加载封面（data-src→src）；视频页守卫 |
| MissavStatusFilterPlugin | MissAV 状态筛选：dataset.status → 芯片筛选栏（OR 过滤，data-mstf-hidden 协同）；nord 暗色样式；cell 级显隐 |
| MissavVideoPreviewPlugin | MissAV 视频流 iframe 详情弹窗：捕获阶段拦截 + 修饰键保留原生新标签 + 可嵌套弹窗 |

## 2. 核心模块 `src/core/`

| 文件 | 职责 |
|------|------|
| feature-flags.ts | 升级特性开关（localStorage 可覆盖） |
| libs.ts | 第三方库 CDN @require（externalGlobals）+ 挂全局（$/layer/Tabulator/Toastify/localforage/Viewer/md5），库 CSS 仍打包 |
| _jquery-global.ts | jquery 副作用模块（先于 layer 挂 window.jQuery） |
| storage-manager.ts | IndexedDB 存储管理（JAV-JHS/appData，localforage 实例；运行时缓存清理） |
| gm-http.ts | GM_xmlhttpRequest 封装（GET/POST/分块下载/重试） |
| common-util.ts | 通用工具（retry/htmlTo$dom/getUrlParam/isMobile/loopDetector） |
| toast.ts / loading.ts / logger.tsx | Toastify 封装（show.ok/error/success）/ 加载遮罩 / 日志控制台（clog） |
| image-preview.tsx / viewer.ts | 图片查看器 / Viewer.js 配置 |
| webdav.ts / webdav-crypto.ts / gfriends.ts | WebDav 客户端 / WebDav 加密解密 / GFriends 数据 |
| layer-wrapper.ts | layer.js 包装（默认 closeBtn/shadeClose + ESC 栈；注入 layer-fix.css） |
| tooltip.ts / style-injector.ts | tooltip / CSS 注入（injectCss） |
| jsx-to-string.ts | 轻量 JSX→HTML 字符串渲染器（替代 react-dom/server） |
| async-task-queue.ts | 异步任务队列 |
| auto-backup.ts | 自动备份（凭证 ID 管理 + 触发判断 + 增量滚动文件名） |
| plugin-diagnostics.tsx | 插件诊断（状态表格 + 纯文本报告 + GM 菜单注册） |
| page-context.ts | 集中式页面类型检测（detectPageContext + pageContext 单例） |
| task-supervisor.ts | AbortSignal 统一生命周期管理（定时器/Observer/事件监听器） |
| list-dom-bus.ts | 列表页 DOM 变更总线（单 Observer + rAF 批量分发 .item 新增） |
| pagination-state.ts | 瀑布流分页状态机（idle/loading/error/exhausted + retry） |
| storage-revision.ts | 跨标签页存储修订号追踪（BroadcastChannel 广播 + 缓存失效回调） |
| sync/ | 跨站同步共享基础设施：withExclusiveLock（Web Locks 包装，降级直接执行）、KeyedQueue（键控串行队列）、sync-intent-journal（意图日志，崩溃后恢复消费） |
| util/ | 核心工具：broadcast（三重广播总线）、back-to-top、tabulator-factory、util-async/clipboard/cookie/date/dom/download/misc/popup/retry/sort/status-tag/translate/url、esc-layer、logger-panel、util-simple-lists、util-fetch-html（同源 fetch 规避 Cloudflare 403） |