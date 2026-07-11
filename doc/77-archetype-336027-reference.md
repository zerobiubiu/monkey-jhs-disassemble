# 77 - archetype/jhs.3.3.6.027.user.js 参考脚本说明

> **文档类型**：📄参考说明
> **文档状态**：✅已执行
> **文件路径**：`archetype/jhs.3.3.6.027.user.js`

## 1. 背景

本项目（JavDB Power Tools）最初以 `archetype/jhs.user.js`（v1.0，混淆版，11605 行，3088 符号）
为唯一原型拆分重构。该原型仅支持 JavDB 单站、3 态鉴定状态（屏蔽/收藏/已观看），
API 调用散落、无聚合层，定时任务由各插件各自实现。

`jhs.3.3.6.027.user.js` 是原作者发布的 **v3.3.6.027 维护版**，作为本项目的
**升级目标参考脚本**放入 `archetype/`。它相对 v1.0 做了大量功能演进与架构重构，
是 doc/76 落地记录与 doc/78 执行方案的对照基准。

本文档说明该文件的来源、内容、架构特点及与本项目的对应关系，供后续升级时查阅。

## 2. 文件基本信息

| 项 | 值 |
|---|---|
| 脚本名 | JAV-JHS |
| namespace | JAV-JHS |
| version | 3.3.6.027 |
| 行数 | ~10389 |
| 符号数 | 4147 |
| 代码风格 | 完全可读（去混淆，变量/类语义化命名） |
| 支持站点 | JavDB / JavBus / JavTrailers / SubTitleCat（4 站） |
| @grant | GM_xmlhttpRequest / GM_openInTab / unsafeWindow（3 项） |
| @connect | ~25 个域名 |
| @require | 9 个（含 parallel_GM_xmlhttpRequest + 8 库 CDN） |
| @run-at | document-idle |

## 3. 与旧版 v1.0 的关系

| 维度 | v1.0（`jhs.user.js`） | v3.3.6.027 |
|---|---|---|
| name | 鉴黄师 | JAV-JHS |
| 支持站点 | 1（JavDB） | 4（JavDB/JavBus/JavTrailers/SubTitleCat） |
| 鉴定状态 | 3 态 | 4 态（新增"已下载"） |
| javdb 注册插件 | 23 | 32 |
| 唯一插件总数 | 23 | 38 |
| API 层 | 散落函数（R/V/K/W/q/O） | `javDbApi` 聚合对象（11 方法） |
| 签名缓存窗口 | 20s，双 key | 300s，单 key |
| 定时任务 | 各插件独立 | `TaskPlugin` 统一调度（Web Locks + 并发限制） |
| 代码可读性 | 全混淆 | 完全可读 |

## 4. 核心架构特点

### 4.1 `javDbApi` 聚合层（L646-776）

封装 JavDB 官方 App API（域名 `jdforrepam.com`），统一鉴权签名、客户端伪装、图片 CDN 替换。
相对旧版散落函数，提供：

- `buildSignature()`：签名缓存 300s（旧版 20s），单一 key `jhs_jdsignature`
- `removeSignature()`：主动清除签名缓存（旧版无）
- `_updateImgServer(str)`：图片域名 `rhe951l4q` → `c0.jdbstatic.com`
- `getReviews / searchMovie / getMovieDetail / related / getMagnets / playback / login / top250`：8 个 API
- `markDataListHtml(movies)`：统一列表项 HTML 渲染，被 HitShow/TOP250/123Av 复用
- 客户端伪装：`User-Agent: Dart/3.5`、`app_version_number: 1.9.29`、`platform: ios`
- `top250` 支持 `Bearer` token 鉴权

### 4.2 StorageManager 4 态状态模型（L202-644）

鉴定记录 `status` 从 3 态扩展到 4 态：

| 常量 | 值 | 含义 |
|---|---|---|
| `Status_FILTER` | filter | 屏蔽 |
| `Status_FAVORITE` | favorite | 收藏 |
| `Status_HAS_DOWN` | hasDown | 已下载（**新增**） |
| `Status_HAS_WATCH` | hasWatch | 已观看 |

4 态在 `_handleSingleCar` / `ListPagePlugin.filterMovieList` / `HistoryPlugin` 表格 /
`DetailPageButtonPlugin` / `Fc2Plugin` / `SettingPlugin` 全链路打通。

缓存机制升级：4 个缓存字段（`cacheCarList`/`cacheFavoriteActressList`/`cacheBlacklistCarList`/`cacheSettingObj`），
读操作返回 `copyObj()` 深拷贝 / `deepFreeze()` 冻结，写操作统一走私有 `setItem_fn`。
移除 6 个一次性数据迁移方法（`merge_*`）。

### 4.3 TaskPlugin 定时任务调度器（L9487-9776）

集中管理黑名单检测 / 收藏演员同步 / 新作品检测三大周期任务：

- `navigator.locks.request` Web Locks 跨标签页单例锁（`singleTaskKey`）
- `limitConcurrency` 并发限制器（默认 2）+ `checkRequestSleep` 请求间隔
- `AsyncQueue` 串行化存储写入避免竞态
- 周期递归：完成后 5 分钟自动重启 `doTask`
- 三任务：`checkBlacklist` / `checkFavoriteActress` / `checkNewVideo`
- 替代旧版各插件独立检测逻辑

### 4.4 `categoryMap` 分类映射表（L5019-5360）

JavDB 分类 ID → 中文名的完整映射表（~400 条），供 `BlacklistPlugin` 屏蔽类型列 formatter
解析 URL `t` 参数映射真实类别名。覆盖题材分类（1-389）、年份（2001-2025）、时长区间（lt-45/45-90/90-120/gt-120）。

## 5. 完整插件清单

### 5.1 JavDB 块（32 个，L10305-10338）

| # | 插件类 | 行号 | 职责 |
|---|---|---|---|
| 1 | ListPagePlugin | L6089-6568 | 列表页主插件：过滤/状态标签/翻译/快捷键 |
| 2 | AutoPagePlugin | L6570-6736 | 瀑布流自动翻页 |
| 3 | Fc2Plugin | L2899-3081 | FC2 详情弹窗 |
| 4 | FoldCategoryPlugin | L3134-3212 | 折叠分类 |
| 5 | ListPageButtonPlugin | L5844-6016 | 列表页按钮组 |
| 6 | HistoryPlugin | L4367-4839 | 鉴定记录 |
| 7 | SettingPlugin | L6849-7651 | 设置弹窗 + WebDav 备份 |
| 8 | NavBarPlugin | L3571-3642 | 导航栏 |
| 9 | HitShowPlugin | L3305-3390 | 热播 |
| 10 | TOP250Plugin | L3392-3569 | Top250 排行榜 |
| 11 | CoverButtonPlugin | L8121-8298 | **新增** 封面悬浮工具栏 |
| 12 | ImageRecognitionPlugin | L7758-7943 | **新增** 以图识图 |
| 13 | Fc2By123AvPlugin | L8300-8645 | **新增** 123Av FC2 浏览 |
| 14 | WangPan115MatchPlugin | L9101-9292 | **新增** 115 网盘文件匹配 |
| 15 | DetailPagePlugin | L2373-2402 | 详情页主插件 |
| 16 | ReviewPlugin | L4841-4990 | 评论 |
| 17 | RelatedPlugin | L7957-8045 | 相关清单 |
| 18 | DetailPageButtonPlugin | L4024-4365 | 详情页按钮 |
| 19 | HighlightMagnetPlugin | L3083-3132 | 高亮磁链 |
| 20 | PreviewVideoPlugin | L2583-2731 | 预览视频 |
| 21 | FilterTitleKeywordPlugin | L4992-5017 | 标题关键词过滤 |
| 22 | ActressInfoPlugin | L3214-3303 | 演员信息 |
| 23 | OtherSitePlugin | L3658-3939 | 第三方站点（8 站） |
| 24 | WangPan115TaskPlugin | L8966-9099 | **新增** 115 网盘离线下载 |
| 25 | TranslatePlugin | L9452-9485 | **新增** 标题翻译 |
| 26 | WantAndWatchedVideosPlugin | L8047-8119 | 想看/已观看导入 |
| 27 | MagnetHubPlugin | L8647-8851 | **新增** 多引擎磁链聚合 |
| 28 | ScreenShotPlugin | L8853-8956 | **新增** javstore 截图墙 |
| 29 | BlacklistPlugin | L5362-5842 | 演员黑名单 |
| 30 | FavoriteActressesPlugin | L9302-9399 | 收藏演员 |
| 31 | NewVideoPlugin | L9912-10268 | 新作品检测 |
| 32 | TaskPlugin | L9487-9776 | **新增** 定时任务调度器 |

### 5.2 JavBus 块（24 个，L10339-10364）

含 JavDB 共享插件 + 4 个 JavBus 专属：

| 专属插件 | 行号 | 职责 |
|---|---|---|
| BusNavBarPlugin | L7945-7955 | JavBus 导航栏 |
| BusImgPlugin | L9401-9450 | JavBus 图片行高对齐 |
| BusDetailPagePlugin | L3941-4022 | JavBus 详情页（复制车号/换图） |
| BusPreviewVideoPlugin | L7653-7756 | JavBus 预览视频弹窗 |

### 5.3 站点专属（2 个，L10365-10366）

| 插件 | 行号 | 站点 |
|---|---|---|
| JavTrailersPlugin | L2799-2879 | javtrailers.com |
| SubTitleCatPlugin | L2881-2897 | subtitlecat.com |

### 5.4 唯一插件总数：38 个

JavDB 32 + JavBus 专属 4 + 站点专属 2 = 38。

## 6. 相对 v1.0 的新增插件（15 个全新增）

| 插件 | 核心能力 | 行号 |
|---|---|---|
| TaskPlugin | Web Locks 单例锁 + 并发限制 + AsyncQueue，三大周期任务 | L9487-9776 |
| CoverButtonPlugin | 列表封面 5 组悬浮按钮（缩略图/视频/鉴定/站点/复制） | L8121-8298 |
| ImageRecognitionPlugin | 3 引擎反向搜图（Google/Lens/Yandex），经 Imgur 转公网 URL | L7758-7943 |
| Fc2By123AvPlugin | 123Av FC2 浏览/详情弹窗，三站点协作 | L8300-8645 |
| MagnetHubPlugin | 3 引擎磁链聚合（U9A9/U3C3/Sukebei） | L8647-8851 |
| ScreenShotPlugin | javstore.net 长缩略图获取 | L8853-8956 |
| WangPan115TaskPlugin | 115 网盘离线下载任务提交 | L8966-9099 |
| WangPan115MatchPlugin | 115 网盘文件匹配 + 播放 | L9101-9292 |
| TranslatePlugin | 标题翻译（Google gtx，ja→zh-CN） | L9452-9485 |
| BusNavBarPlugin | JavBus 导航栏 | L7945-7955 |
| BusImgPlugin | JavBus 图片行高对齐 | L9401-9450 |
| BusDetailPagePlugin | JavBus 详情页 | L3941-4022 |
| BusPreviewVideoPlugin | JavBus 预览视频弹窗 | L7653-7756 |
| JavTrailersPlugin | javtrailers.com 站点适配 | L2799-2879 |
| SubTitleCatPlugin | subtitlecat.com 字幕适配 | L2881-2897 |

## 7. 相对 v1.0 移除的子系统

`DetailPageButtonPlugin` 从 ~1322 行简化到 ~342 行，移除三大子系统（共 ~25 方法）：

| 子系统 | 移除方法 | 影响 |
|---|---|---|
| Want/Watched 自动同步 | `hookWantAndWatchedButtons`/`detectWantWatchedState`/`onWantAdded`/`onWantRemoved`/`onWatchedAdded`/`onWatchedRemoved`/`removeCarIfStatus`/`broadcastWantWatchedSync`/`setupWantWatchedSyncListener`/`refreshItemStatusTag` | 不再自动同步 JavDB 原生"想看/看过"到 JHS，回归解耦 |
| 星星评分条 UI | `_buildRatingBar`/`_ensureListPanel`/`_initListPanel`/`_injectRatingStyles`/`_syncRatingBar`/`_setRatingBusy`/`addQuickActionButtons`/`quickSetHasWatch`/`quickConvertToFav` | 移除整个星星覆盖 UI |
| Rails Review API | `_getCsrfToken`/`_getVideoId`/`_getReviewId`/`_execRailsJs`/`_javdbReviewApi`/`_triggerJavdbReview`/`_triggerJavdbWant`/`_waitForDomChange`/`_waitForEl` | 不再通过 Rails API 操控 JavDB 原生评价 |

## 8. 关键行为变化（相对 v1.0）

| 变化点 | v1.0 → v3.3.6.027 |
|---|---|
| 番号匹配 | 精确 → `toLowerCase` 大小写不敏感 |
| 隐藏模式 | 仅 hide → hide/visibility 双模式（`movieShowType`） |
| 翻页 URL | `pushState` → `replaceState` |
| 签名缓存 | 20s 双 key → 300s 单 key |
| 图片域名 | `rhe951l4q` → `c0.jdbstatic.com` |
| WebDav 目录创建 | 直接 MKCOL → 幂等 `checkFolderExists`+`createFolder` |
| `downloadFileInChunks` | 触发浏览器下载 → 返回文本由调用方处理 |
| WantAndWatched 导入 | 逐条 getCar/saveCar → 批量 Set+saveCarList |
| OtherSite 站点数 | 2 → 8（新增 Jable/Avgle/JavTrailers/123Av/JavDb/JavBus/fanza） |
| HitShow/TOP250 重试 | 3 次重试 → 单次 try-catch |
| API 调用 | 散落函数 R/V/K/W/q → `javDbApi.*` 统一 |

## 9. 与本项目的对应关系

本项目当前基于 v1.0 拆分，已集成 35 个插件（JavDB 34 + MissAV 2，见 `AGENTS.md` §3.3）。
v3.3.6.027 相对本项目多出 10 个 javdb 新插件（见上表 §6 前 10 项），
且 4 态状态模型、javDbApi 聚合层、TaskPlugin 调度器等架构升级本项目尚未落地。

**升级方案**见：
- `doc/78-upgrade-plan-336027.md`（可插拔升级执行方案 / 分项设计，✅已执行）
- `doc/76-upgrade-from-336027.md`（落地实施与验证记录，✅已执行）

升级原则：全部改动带 feature flag（`src/core/feature-flags.ts`），默认全开，
控制台可单项回退对比调试。详见 doc/78 + doc/76。

## 10. 相关文件链接

- 原型文件：`archetype/jhs.3.3.6.027.user.js`
- 旧版原型：`archetype/jhs.user.js`（v1.0，本项目拆分基准）
- 执行方案：`doc/78-upgrade-plan-336027.md`
- 落地记录：`doc/76-upgrade-from-336027.md`
- 项目架构地图：`AGENTS.md`

## 11. 阅读建议

1. 先读本文件了解 v3.3.6.027 的整体架构与插件清单
2. 读 `doc/78-upgrade-plan-336027.md` 了解分项设计与 feature flag 方案
3. 读 `doc/76-upgrade-from-336027.md` 了解落地实施与验证细节
4. 升级具体功能时，对照本文件 §5 插件行号定位 v3.3.6.027 对应实现
5. 注意 §7 移除的子系统——本项目当前包含这些功能，升级时需评估是否跟随移除（属"减法"，需用户确认）
