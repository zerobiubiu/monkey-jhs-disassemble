# 04 - 升级与功能清理（doc/76–98）

> **文档类型**：📄 参考说明（阶段融合文档）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/76 – doc/98，共 23 份历史文档
> **时间线**：2026-07-11 至 2026-07-12（doc/87 标注 07-12；doc/83 起多数文档未标执行日期）
> **合并说明**：本文由 doc/76–doc/98 共 23 份已执行文档按时间线融合精简而成。仅从原文提炼、合并，不新增原文不存在的事实、数字或结论；无法确认的细节一律删去。文中保留 "doc/NN" 数字引用作为历史事件标识（指向 doc/ 目录对应编号的原始文档，原文件在合并完成后删除）。三条关键演进链完整呈现：① CoverButton 加固→撤销→删除（doc/80→81→82）；② ESC 关闭弹窗六次迭代、doc/87 为真根因最终版（doc/84→85→86→87）；③ 移除后恢复（doc/89 移除标题关键词过滤 → doc/90 恢复）。

## 阶段概览

本阶段以对照作者维护版 jhs.3.3.6.027 的可插拔升级为主线（doc/76–78）：以 feature flag 机制落地 10 项行为优化、javDbApi 聚合层与 6 个新插件，版本升至 1.9.0。随后按用户要求进入多轮功能清理：CoverButton 封面工具栏经历排查加固、撤销加固、整体删除（doc/80–82）；弹窗关闭交互从关闭按钮不可见一路追到 ESC 跨 frame 真根因，共六次迭代（doc/84–87）；屏蔽功能经历 doc/89 大幅删除与 doc/90 部分恢复。快捷键系统、演员页工具栏按钮、115 残留死代码依次移除，快捷设置菜单精简并最终彻底删除 4 个设置项的功能读取（doc/97–98）。版本从 1.9.0 演进至 1.12.9。

---

## 一、升级对照基准：jhs.3.3.6.027 参考脚本（doc/77）

### 背景/根因

本项目最初以 `archetype/jhs.user.js`（v1.0，混淆版，11605 行，3088 符号）为唯一原型拆分重构，仅支持 JavDB 单站、3 态鉴定状态（屏蔽/收藏/已观看），API 调用散落、无聚合层，定时任务由各插件各自实现。

`jhs.3.3.6.027.user.js` 是作者发布的 **v3.3.6.027 维护版**（完全可读、去混淆，约 10389 行、4147 符号，@grant 3 项、@connect 约 25 域名、@require 9 个、@run-at document-idle），放入 `archetype/` 作为升级目标参考脚本，是 doc/76 落地记录与 doc/78 执行方案的对照基准。

### 相对 v1.0 的关键差异

| 维度 | v1.0（jhs.user.js） | v3.3.6.027 |
|---|---|---|
| 支持站点 | 1（JavDB） | 4（JavDB/JavBus/JavTrailers/SubTitleCat） |
| 鉴定状态 | 3 态 | 4 态（新增「已下载」hasDown） |
| javdb 注册插件 / 唯一插件总数 | 23 / 23 | 32 / 38 |
| API 层 | 散落函数（R/V/K/W/q/O） | `javDbApi` 聚合对象（11 方法） |
| 签名缓存窗口 | 20s，双 key | 300s，单 key |
| 定时任务 | 各插件独立 | `TaskPlugin` 统一调度（Web Locks + 并发限制） |
| 代码可读性 | 全混淆 | 完全可读 |

### 核心架构特点

- **javDbApi 聚合层**（L646-776）：封装 JavDB 官方 App API（域名 jdforrepam.com），统一鉴权签名/客户端伪装/图片 CDN 替换。`buildSignature()` 签名缓存 300s 单 key `jhs_jdsignature`（旧版 20s 双 key）；`removeSignature()` 主动清缓存（旧版无）；`_updateImgServer()` 图片域名 `rhe951l4q`→`c0.jdbstatic.com`；8 个 API（getReviews/searchMovie/getMovieDetail/related/getMagnets/playback/login/top250）；`markDataListHtml(movies)` 统一列表项 HTML，被 HitShow/TOP250/123Av 复用；客户端伪装 `User-Agent: Dart/3.5`、`app_version_number: 1.9.29`、`platform: ios`；top250 支持 `Bearer` token 鉴权。
- **StorageManager 4 态状态模型**：`Status_FILTER=filter`（屏蔽）/ `Status_FAVORITE=favorite`（收藏）/ `Status_HAS_DOWN=hasDown`（已下载，新增）/ `Status_HAS_WATCH=hasWatch`（已观看），在 `_handleSingleCar`/ListPagePlugin.filterMovieList/HistoryPlugin 表格/DetailPageButtonPlugin/Fc2Plugin/SettingPlugin 全链路打通。缓存字段扩到 4 个（`cacheCarList`/`cacheFavoriteActressList`/`cacheBlacklistCarList`/`cacheSettingObj`），读操作返回 `copyObj()` 深拷贝 / `deepFreeze()` 冻结，写操作统一走私有 `setItem_fn`；移除 6 个一次性数据迁移方法（`merge_*`）。
- **TaskPlugin 定时任务调度器**（L9487-9776）：`navigator.locks.request` Web Locks 跨标签页单例锁 + `limitConcurrency` 并发限制器（默认 2）+ `checkRequestSleep` 请求间隔 + `AsyncQueue` 串行化存储写入；周期任务完成后 5 分钟自动重启；集中管理 `checkBlacklist`/`checkFavoriteActress`/`checkNewVideo` 三大任务，替代旧版各插件独立检测。
- **categoryMap 分类映射表**（L5019-5360）：约 400 条 JavDB 分类 ID→中文名映射，供 BlacklistPlugin 屏蔽类型列 formatter 解析 URL `t` 参数；覆盖题材分类（1-389）、年份（2001-2025）、时长区间（lt-45/45-90/90-120/gt-120）。

### 插件清单与新增插件

- 唯一插件总数 38 个 = JavDB 块 32 + JavBus 专属 4（BusNavBar/BusImg/BusDetailPage/BusPreviewVideo）+ 站点专属 2（JavTrailers/SubTitleCat）。
- 相对 v1.0 全新增 15 个插件：

| 插件 | 核心能力 |
|---|---|
| TaskPlugin | Web Locks 单例锁 + 并发限制 + AsyncQueue，三大周期任务 |
| CoverButtonPlugin | 列表封面 5 组悬浮按钮（缩略图/视频/鉴定/站点/复制） |
| ImageRecognitionPlugin | 3 引擎反向搜图（Google/Lens/Yandex），经 Imgur 转公网 URL |
| Fc2By123AvPlugin | 123Av FC2 浏览/详情弹窗，三站点协作 |
| MagnetHubPlugin | 3 引擎磁链聚合（U9A9/U3C3/Sukebei） |
| ScreenShotPlugin | javstore.net 长缩略图获取 |
| WangPan115TaskPlugin / WangPan115MatchPlugin | 115 网盘离线下载任务提交 / 文件匹配 + 播放 |
| TranslatePlugin | 标题翻译（Google gtx，ja→zh-CN） |
| BusNavBarPlugin / BusImgPlugin / BusDetailPagePlugin / BusPreviewVideoPlugin | JavBus 专属适配 |
| JavTrailersPlugin / SubTitleCatPlugin | 站点专属适配 |

- **DetailPageButtonPlugin 大幅简化**：从约 1322 行精简到约 342 行，移除三大子系统（共约 25 方法）：Want/Watched 自动同步（不再自动同步 JavDB 原生「想看/看过」，回归解耦）、星星评分条 UI（移除整个星星覆盖 UI）、Rails Review API（不再通过 Rails API 操控原生评价）。

### 关键行为变化（v1.0 → v3.3.6.027）

| 变化点 | 变化 |
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
| API 调用 | 散落函数 → `javDbApi.*` 统一 |

### 与本项目的对应关系

doc/77 当时项目基于 v1.0 拆分，已集成 35 个插件（JavDB 34 + MissAV 2）；v3.3.6.027 相对本项目多出上表前 10 个 javdb 新插件，且 4 态模型、javDbApi 聚合层、TaskPlugin 调度器尚未落地。升级方案见 doc/78，落地记录见 doc/76。

---

## 二、可插拔升级执行方案（doc/78）

### 背景/根因

原项目根目录 `upgrade-plan-temp.md`（临时执行方案）迁入 `doc/` 编号归档，与已执行落地内容一致。核心原则：**所有改动可插拔式替换**——每项有独立 feature flag，运行时可切换新/旧逻辑，保证对比调试性。范围仅 javdb 站点、仅功能实现差异。

### 可插拔机制

- **feature-flags.ts 开关中心**：17 个 flag 默认全开，运行时读 `localStorage['jhs_upgrade_flags']`（JSON）覆盖默认值，解析失败保持默认。
- **落地规则**：行为优化（①-⑩）在原函数内 `if (featureFlags.xxx) { 新逻辑 } else { 旧逻辑 }`，**保留旧逻辑分支不删代码**；基础设施（⑭）新增聚合对象、原函数保留作兼容别名；新插件（⑫⑬⑮⑰⑱ 20）在 main.tsx 注册前判断 flag，插件内部 `getBean` 用可选链兼容未注册场景。
- **对比调试**：全开→新版行为；控制台单项置 false→回退该项；刷新对比定位回归；排查完 `removeItem` 恢复。

### 分批执行计划

| 批次 | 项 | 特征 | 风险 |
|---|---|---|---|
| A | ①–⑩ 行为优化 | 全独立，保留旧分支 | 低 |
| B | ⑫⑬⑭ | 基础设施 + 独立新插件 | 低 |
| C | ⑮⑰⑱ | 依赖型新插件 | 中 |
| D | 20 | 复合型新插件，依赖 B+C | 中 |

依赖关系：⑮ CoverButtonPlugin 依赖 ⑬（getScreenshot）+ 已有 DMM fetcher；20 Fc2By123AvPlugin 依赖 ⑫⑬⑰⑭ + 已有 OtherSite/DetailPageButton；⑱ 经 NavBarPlugin 注入按钮。每批完成后 `tsc -b && vite build` 验证 + 浏览器实测再进下一批。

### 各项详细方案

| 项 | 目标 | 关键改动 | flag |
|---|---|---|---|
| ① 签名缓存 20s→300s + removeSignature | 签名窗口放大 25 倍 + 主动清除 | 新增 `SIGNATURE_TTL_SECONDS_V2=300`、单 key `jhs_jdsignature`；key 名变更后旧缓存自然失效无需迁移 | upgradeSignature300s |
| ② 番号大小写不敏感匹配 | 避免 `ABC-123` vs `abc-123` 查不到/重复入库 | getCar 比较 toLowerCase；filterMovieList 入集/查询/关键词匹配均 lowercase | caseInsensitiveCarNum |
| ③ AutoPagePlugin replaceState | 翻页不污染浏览器历史栈 | updatePageUrl 内 replaceState | autoPageReplaceState |
| ④ WantAndWatched 批量导入 | O(n) 逐条查重 → O(1) Set 查重；逐条 saveCar → 批量 saveCarList | 页开头建 carNumCache Set；页末 saveCarList；请求间隔 1000ms→200ms；新增「正在处理第 X 页」进度提示 | wantWatchBatchImport |
| ⑤ movieShowType 双模式 | 已鉴定内容支持 hide/visibility 两种模式 | 设置 base-panel 新增单选；filterMovieList 按模式 hide() 或占位透明；`data-movieShowType` 标记切换时重置 | movieShowTypeVisibility |
| ⑥ StorageManager 缓存深拷贝/冻结 | 读操作返回拷贝防外部污染缓存 | `copyObj`/`deepFreeze` 工具；缓存字段扩到 4 个；getCarList/getFavoriteActressList/getSetting 返回 copyObj，getBlacklistCarList 返回 deepFreeze(copyObj)；写操作统一走私有 setItem_fn 内聚缓存失效；注意 main.tsx `window.cleanCache_*` 钩子兼容 | storageCacheDeepCopy |
| ⑦ WebDav 目录幂等创建 | 重复 MKCOL 不报错 | 新增 `checkFolderExists`（PROPFIND Depth:0，404 返 false）+ `createFolder`（先 check 再 MKCOL）；backup/getBackupList 改用 createFolder | webdavIdempotentMkdir |
| ⑧ BasePlugin `_formatWesternCar` | 西方番号 `carNum.YY.MM.DD` 格式化 | carNum 纯字母且 rawDate 含日期时拼接；getBoxCarInfo 调用 | westernCarFormat |
| ⑨ ActressInfoPlugin user-select | 演员名一键整名复制 | 演员名 `<strong>` 内层包 `user-select:all` span；无信息显示「暂无此演员信息」 | actressUserSelectAll |
| ⑩ NavBarPlugin 移除 paste | 避免粘贴图片误触发搜索 | paste 事件绑定处 flag 开时跳过 | navBarNoPaste |
| ⑫ TranslatePlugin 独立化 | 标题翻译独立成插件，覆盖列表页+详情页 | 新建插件：标题元素降级链（.origin-title→.current-title→h3）→注入 loading→localStorage `jhs_translate` 缓存→Google gtx `ja→zh-CN`；ListPagePlugin flag 开时委托 getBean 可选链 | translatePlugin |
| ⑬ ScreenShotPlugin | 从 javstore.net 获取长缩略图（截图墙） | `jhs_screenShot` 缓存；javstore 搜索→番号模糊匹配→详情页解析 `CLICK HERE`/`_s.jpg`（去 `.th` 后缀）；失败占位+重试；@connect 补 javstore.net | screenShotPlugin |
| ⑭ javDbApi 聚合层 + markDataListHtml | 散落函数聚合 + 新增能力 | 新增 javDbApi 对象（11 方法）；原 fetchMovieReviews 等保留作兼容别名；新增 `_updateImgServer`/`markDataListHtml`/`login`/`getMagnets`/`searchMovie`；ReviewPlugin 签名过期时调 removeSignature（依赖 ①）；调用方 hit-show/top250/review/related/fc2 按 flag 选择 | javDbApiAggregate |
| ⑮ CoverButtonPlugin（依赖 ⑬） | 列表页封面卡片悬浮工具栏（5 组按钮） | addSvgBtn 给每个 .item 注入 tool-box；5 组按钮：screen→截图 / video→DMM 预览 / handle→鉴定子菜单 / site→第三方子菜单 / copy→复制番号/标题/下载封面；ListPagePlugin.doFilter 触发；SettingPlugin 5 个 SVG 开关；BasePlugin 需新增 screenSvg/videoSvg/handleSvg/siteSvg/copySvg 等字段 | coverButtonPlugin |
| ⑰ MagnetHubPlugin | 多引擎磁链搜索聚合（U9A9/U3C3/Sukebei） | createMagnetHub 聚合 UI（Tab+原网页链接+结果区）；searchEngine 支持 parseHtml/parseJson + sessionStorage 缓存；结果含复制磁链 + 115 离线下载按钮；DetailPageButton/Fc2Plugin 磁力搜索按钮接入；localStorage `jhs_magnetHub_selectedEngine` 记忆 | magnetHubPlugin |
| ⑱ ImageRecognitionPlugin | 以图识图（Google 旧版/Lens/Yandex 3 引擎） | layer 弹窗（上传/预览/搜索区）；拖拽/选择/粘贴(Ctrl+V)输入；base64 上传 Imgur（Client-ID d70305e7c3ac5c6）转公网 URL；NavBar 搜索栏新增 `#search-img-btn`；localStorage `jhs_selectedSites` 持久化 | imageRecognitionPlugin |
| 20 Fc2By123AvPlugin（依赖 ⑫⑬⑰⑭） | 在 JavDB 嵌入 123Av FC2 浏览/搜索/详情弹窗 | handle 注入导航入口 + `/advanced_search?type=100` 页 hookPage+handleQuery；详情弹窗含信息/磁链/鉴定/字幕/第三方；get123AvVideoInfo/getActressInfo(fc2ppvdb.com)/getImgList(adult.contents.fc2.com)/getMovie(123Av ajax)；复用 javDbApi.markDataListHtml；8 种排序；Fc2Plugin flag 开时委托 | fc2By123AvPlugin |

### @connect 汇总

| 新插件 | 需补 @connect |
|---|---|
| ⑬ ScreenShotPlugin | `javstore.net` |
| ⑰ MagnetHubPlugin | `u9a9.com`、`u3c3.com`、`sukebei.nyaa.si`、`btsow.lol` |
| ⑱ ImageRecognitionPlugin | `imgur.com`、`lens.google.com`、`yandex.ru` |
| ⑫ TranslatePlugin | `translate-pa.googleapis.com` |
| 20 Fc2By123AvPlugin | `123av.com`、`fc2ppvdb.com`、`adult.contents.fc2.com` |

@grant 现有 3 项足够无需新增；@connect 修改属构建配置变更不递增版本号，新插件源码落地后递增 patch/minor。版本策略：批次 A patch 递增，批次 B/C/D minor 递增。

### 注意事项（执行约束）

1. 不删旧逻辑：行为优化项 flag 关分支保留旧代码确保可回退
2. 新插件间互相 `getBean` 必须可选链，兼容被依赖插件未注册场景
3. 签名 key 改名后旧缓存自然失效，无需数据迁移
4. ⑥ 扩缓存字段时注意 `window.cleanCache_*` 钩子兼容
5. ⑭ 调用方迁移时保留原函数别名，flag 控制走哪个
6. 新插件 CSS 用 `initCss` 返回走 `processCss` 注入
7. ⑮ 需 BasePlugin 新增 SVG 图标字段

---

## 三、升级落地记录（doc/76）

### 背景/根因

按执行方案 doc/78 落地升级（对照 `archetype/jhs.3.3.6.027.user.js` 相对当前工程的功能差异）。原则：全部改动带 feature flag（默认全开）、控制台可 `localStorage.setItem('jhs_upgrade_flags', ...)` 单项回退；**不恢复已删除的 TaskPlugin 定时检测**（不在升级范围）。

### 批次落地一览

| 批次 | 内容 | flag 前缀 |
|------|------|-----------|
| A | ①–⑩ 行为优化 | upgradeSignature300s / caseInsensitiveCarNum / autoPageReplaceState / wantWatchBatchImport / movieShowTypeVisibility / storageCacheDeepCopy / webdavIdempotentMkdir / westernCarFormat / actressUserSelectAll / navBarNoPaste |
| B | ⑫ TranslatePlugin、⑬ ScreenShotPlugin、⑭ javDbApi 聚合 | translatePlugin / screenShotPlugin / javDbApiAggregate |
| C | ⑮ CoverButtonPlugin、⑰ MagnetHubPlugin、⑱ ImageRecognitionPlugin | coverButtonPlugin / magnetHubPlugin / imageRecognitionPlugin |
| D | 20 Fc2By123AvPlugin | fc2By123AvPlugin |

### 实施要点（文件级）

- **新增**：`src/core/feature-flags.ts`（升级开关中心）、`src/resources/upgrade-icons.ts`（封面工具栏 SVG）、6 个新插件文件（translate-plugin.ts / screenshot-plugin.ts / magnet-hub-plugin.ts / cover-button-plugin.tsx / image-recognition-plugin.tsx / fc2-by-123av-plugin.ts）。
- **修改（核心）**：`api.ts`（签名 300s / removeSignature / javDbApi / markDataListHtml）、`common-util.ts`（copyObj / deepFreeze）、`storage-manager.ts`（大小写不敏感 / 缓存深拷贝）、`webdav.ts`（checkFolderExists / createFolder 幂等）、`base-plugin.ts`（_formatWesternCar + 新 SVG 字段）、`auto-page-plugin.ts`（replaceState flag）、`list-page-plugin.tsx`（番号大小写 / movieShowType / CoverButton 触发）、`want-and-watched-videos-plugin.tsx`（批量导入）、`nav-bar-plugin.tsx`（禁 paste / 识图按钮）、`setting-plugin.tsx` + `setting-dialog.tsx`（movieShowType + 5 SVG 开关读写）、`actress-info-detail-segment.tsx`（user-select:all）、`preview-video-plugin.tsx`（导出 fetchDmmPreviewVideo）、`detail-page-button-plugin.tsx`（磁力搜索入口）、`main.tsx`（flag 条件注册 6 个新插件）、`vite.config.ts`（version 1.9.0 + @connect 域名）。

### 结果

version 1.9.0；`bun run build`（tsc -b && vite build）通过。对比调试：单项回退置 false 刷新对比，`removeItem` 恢复全部默认。

### 已知简化 / 遗留问题

- CoverButton 第三方域名 jable/avgle/123av 使用默认值（OtherSite 未存这些键）
- Fc2By123Av 列表解析适配 123av 多版 DOM，复杂布局可能需再校准
- 列表页标题翻译仍走 ListPagePlugin 内联逻辑（TranslatePlugin 专责详情页）
- 行为优化项旧分支已用 flag 保留，稳定后可择机删除旧代码

### 演进链

方案链：doc/78（执行方案）→ doc/76（落地记录）；对照基准：doc/77。

---

## 四、升级后修复：123Av-Fc2 导航与识图按钮（doc/79）

### 背景

升级落地（doc/76/78）后用户反馈：① 标题栏 `123Av-Fc2`（`/advanced_search?type=100`）出现两次；② 自定义检索区识图按钮未出现。

### 根因

- **123Av-Fc2 双份**：`Fc2By123AvPlugin.handle` 用 `$('.navbar-start').append(...)`，而页面上有两处 `.navbar-start`——站点主导航 `#navbar-menu-hero .navbar-start` 与脚本注入的 `#search-box .navbar-start`（NavSearchBox），jQuery 对两者都 append。原版 336027 是单点插入（特定 `a:nth-child(4)` 后 `.after` + `.tabs li:contains("FC2")` 后 `.after`），不会命中搜索框。
- **识图按钮缺失**：`NavBarPlugin.hookSearch` 误写选择器 `#jhs-search-box`（不存在），实际检索框 id 为 `#search-box`；且原版把 `#search-img-btn` 直接写在搜索框 HTML 里（进阶检索与检索按钮之间），不是事后 append。

### 方案与实施

1. **Fc2By123AvPlugin** 新增 `injectNavEntry()`：优先在 `#navbar-menu-hero` 内 FC2 链接后 `after` 插入（`id=navbar-item-123av-fc2`）；回退仅 `#navbar-menu-hero .navbar-start`（不碰 `#search-box`）；tabs 存在 FC2 时在其后补一项（去重）。
2. **NavSearchBox**（`nav-search-box.tsx`）：模板内置 `#search-img-btn`「识图」。
3. **NavBarPlugin**：绑定 `#search-img-btn` → `ImageRecognitionPlugin.open`；flag 关则 hide；`hookOldSearch` 同步 rebind 原生 `.search-image`。

修改文件：`fc2-by-123av-plugin.ts` / `nav-search-box.tsx` / `nav-bar-plugin.tsx`。

### 结果

version 1.9.0 → 1.9.1；构建通过。验证要点：任意 javdb 页主栏 FC2 旁仅一个 `123Av-Fc2`、自定义搜索框无该链；宽屏检索与原生搜索均有识图入口；关 `imageRecognitionPlugin` flag 后识图隐藏。

---

## 五、CoverButton 生命周期：加固 → 撤销 → 删除（doc/80 → 81 → 82）

> 本阶段第一关键演进链：doc/80 排查加固（1.9.2/1.9.3）→ doc/81 撤销加固（1.9.4）→ doc/82 整体删除插件（1.10.0）。

### doc/80 不可见排查与加固

**背景**：用户反馈列表页看不到 CoverButtonPlugin 工具栏图标。

**加固前 5 个可能根因**：

| # | 可能根因 |
|---|---|
| 1 | 注入点脆弱：仅 `$box.find('.tags').append`，无 `.tags` 的卡片静默失败（jQuery 对空集 append 无效果） |
| 2 | 图标过淡：`opacity: .3` 且未强制 SVG 尺寸，部分主题下几乎看不见 |
| 3 | `enableSvgBtn` 误隐藏：非 `yes`/`true` 一律 `toggle(false)`，异常空值会把五组图标全藏 |
| 4 | 瀑布流时机：`checkDom` MutationObserver 未再调 `addSvgBtn`（archetype 有），新追加卡片可能没有工具栏 |
| 5 | 点击穿透：工具栏在 `<a.box>` 内，未 stopPropagation 时难用 |

**修复**：无 `.tags` 时自动在 `a.box` 末尾创建 `.tags.jhs-tool-tags` 再注入；CSS 强制 22px 图标、opacity 0.75、flex 布局、z-index；`enableSvgBtn` 仅显式 `no`/`false` 隐藏且选择器限 `.tool-box` 内；`checkDom` doFilter 后再调 `addSvgBtn`；tool-box 点击 `preventDefault` + `stopPropagation`；clog.debug 输出注入统计；设置弹窗 `end` 回调 `enableSvgBtn` 热更新显隐。

**1.9.3 追加**（series 页仍无日志/不可见）：用户 `/series/Y8bD` 控制台有 StatusTag/VLT/pageSort/CarSync 输出、无任何 CoverButton 输出。根因补充：clog.debug 默认过滤器 base 不包含 debug 看不到；仅挂 `.tags` 在 series 布局不够稳。追加改动：注入日志改 `console.log('[CoverButton] ...')`；优先挂载到 `.meta` 之后独立行 `.jhs-cover-toolbar`（与清单标签同级）；800ms / 2000ms 延迟补注两轮适配 series 异步渲染。

**版本**：1.9.1 → 1.9.2 → 1.9.3。位置说明：工具栏在每张卡片日期/meta 下方一行右侧（独立 `.jhs-cover-toolbar`），不是封面中央悬浮。

### doc/81 撤销加固

**背景**：用户确认 CoverButton 未显示的根因是**设置里已有独立开关**（`enableScreenSvg` / `enableVideoSvg` / `enableHandleSvg` / `enableSiteSvg` / `enableCopySvg`），关闭后工具栏不显示属预期行为。据此要求撤销 doc/80 为「强制可见」做的 1.9.2/1.9.3 加固，恢复升级方案中的简洁实现。

**撤销内容**：`.meta` 后独立行 `.jhs-cover-toolbar`（仍只 append 到 `.tags`）；`console.log` / 延迟 800ms·2s 补注；强制图标 CSS / opacity 0.75 等；`checkDom` 内额外 `addSvgBtn`；设置弹窗 `end` → `enableSvgBtn`；`enableSvgBtn` 宽松判定 / 防点击穿透等（恢复 `toggle(enabled === YES)`）。

**保留内容**：CoverButtonPlugin 本体（doc/76 升级落地）、`ListPagePlugin.doFilter` 末尾 `addSvgBtn`（方案 ⑮）、设置面板 5 个「封面工具栏」开关（loadForm/saveForm）、`featureFlags.coverButtonPlugin` 总开关。

**使用说明**：工具栏要显示：设置 → 基础配置 → 封面工具栏五开关打开并保存刷新；全局关闭：`featureFlags.coverButtonPlugin = false`。

**版本**：1.9.3 → 1.9.4。doc/80 保留为历史排查记录，doc/81 为准表示加固已撤销。

### doc/82 整体删除

**背景**：用户要求将该全套内容（列表封面悬浮快捷按钮：长缩略图 / 预览视频 / 鉴定处理 / 第三方网站 / 复制）深度清理。对齐 archetype 侧 `archetype/doc/02-remove-cover-button-plugin.md` 对 `jhs.user.js` 的删除策略：只要不干扰其他功能的相关代码一律删除。历史文档 doc/76（落地）、doc/80（可见性排查）、doc/81（撤销加固）保持不变（已执行文档不可回头改），仅作溯源。

**删除清单**：

| 类别 | 路径/内容 |
|---|---|
| 插件本体 | `src/plugins/cover-button-plugin.tsx` 整文件（initCss/handle/addSvgBtn/enableSvgBtn/bindClick/showImg/showVideo） |
| 注册与调用 | `main.tsx` 移除 import 与 flag 注册；`list-page-plugin.tsx` doFilter 末尾移除 `getBean('CoverButtonPlugin')?.addSvgBtn?.()`；`feature-flags.ts` 移除 `coverButtonPlugin: true` |
| 设置面板 | `setting-dialog.tsx` 删除 5 个「封面工具栏 - *」setting-item + 两侧 `<hr>` 中多余一条；`setting-plugin.tsx` loadForm/saveForm 删除 enableScreenSvg 等 5 键读写 |
| SVG 与样式 | `upgrade-icons.ts` 整文件删除（COPY/DOWN/HANDLE/SITE/VIDEO/SCREEN/RECOVERY_VIDEO）；`base-plugin.ts` 移除 import 及 7 个 class 字段；`common-toolbar.css` 移除 `.tool-box .jhs-icon`（榜单页 tool-box 空容器不受影响） |
| 文档与版本 | `AGENTS.md` 插件计数 41→40（JavDB 39→38）、升级新插件 6→5、去掉 CoverButton 行；`doc/README.md` 计数同步；changelog v1.10.0 条目；`vite.config.ts` version 1.9.4 → 1.10.0（minor：删除整插件模块） |

**明确保留（不删）**：ScreenShotPlugin（详情页/其它入口仍可长缩略图，仅封面栏调用点消失）；PreviewVideoPlugin、详情页鉴定/复制、OtherSite 等既有路径；ranking-containers 的 `.tool-box` 空容器（HitShow/Top250 工具栏挂载点）；历史 doc/76–81 与 archetype 对照脚本（只读参考）。

**验证**：`bun run build` 通过；产物约 1905.91 kB（gzip 437.47 kB），@version 1.10.0；`src/` 与 `dist/` 对删除关键词（CoverButtonPlugin/coverButtonPlugin/cover-button-plugin/enableScreenSvg 等/封面工具栏/upgrade-icons/addSvgBtn/enableSvgBtn/screenSvg 等）grep 0 命中；两个文件已不存在。

### 演进链小结

doc/80（加固，1.9.2/1.9.3）→ doc/81（撤销加固，1.9.4）→ doc/82（删除整套，1.10.0），CoverButton 从本阶段 6 个升级新插件中移除（升级新插件 6→5）。doc/80 的地位被 doc/81 推翻，doc/82 终结整个功能。

---

## 六、设置开关 CSS 冲突修复（doc/83）

### 背景/根因

设置面板（SettingDialog）与悬浮简化设置（SimpleSettingPanel）中的 `.mini-switch` 开关全部显示异常：不再是 40×20 圆角滑块，而是被压扁或变成 16×16 小方块，开关滑块 `::before` 圆点错位。

根因来自 doc/70 设置面板 UI 美化时新增/改写的选择器与 `.mini-switch` 冲突：

| 冲突规则 | 特异性 | 破坏效果 |
|---------|--------|---------|
| `.form-content * { width:100%; padding:5px 8px; box-sizing:border-box }` | (0,1,0) | 与 `.mini-switch` 同级；`box-sizing:border-box` + padding 把 40×20 内容区压扁 |
| `.content-panel input[type='checkbox'] { width:16px; height:16px }` | (0,2,1) | 高于 `.mini-switch` (0,1,0)，强制 16×16，开关样式失效 |

原版 archetype 中 `.form-content *` 无 `box-sizing:border-box`，也无 `.content-panel input[type='checkbox']` 规则，故原版开关正常。

### 方案与实施

1. `.form-content *` 改为 `.form-content > *:not(.mini-switch):not(br)`，不再给开关/换行施加 width/padding/box-sizing
2. `.content-panel input[type='checkbox']` 加 `:not(.mini-switch)`，只美化普通复选框
3. 开关选择器升级为 `input.mini-switch[type='checkbox']`（特异性 (0,2,1)）+ 显式 `padding:0; margin:0; min/max-width:40px; flex-shrink:0`，防止其它表单规则再覆盖

修改文件：`src/styles/setting-plugin.css`。

### 结果

version 1.10.0 → 1.10.1；构建通过。验证要点：设置弹窗与悬浮简化设置的开关恢复圆角滑块样式，普通 checkbox 仍为 16×16 + accent-color 主色。

---

## 七、弹窗关闭交互：关闭按钮与 ESC 逐级关闭（doc/84 → 85 → 86 → 87）

> 本阶段第二关键演进链：doc/84 修复关闭按钮不可见 + ESC 栈（1.10.2）→ doc/85 逐级关闭（1.10.3）→ doc/86 硬门（1.10.4）→ doc/87 初版/二版/三版/最终版（1.10.5/1.10.6/1.10.7/1.10.8）。doc/87 的最终版（1.10.8）为真根因命中。

### doc/84 弹窗右上角关闭按钮 + ESC 只关最上层

**背景**：① 设置等 layer 弹窗只能按 ESC 关闭，右上角没有关闭按钮；② 仅列表内嵌视频页（iframe + shadeClose）可点空白遮罩关闭；③ 打开二级弹窗后再按 ESC，会把所有弹窗一起关掉。

**根因**：
- **关闭按钮不可见**：`layui-layer/layer.css` 含 IE 前缀 hack（`*right`、`_display` 等），Vite 使用 lightningcss 压缩时（`errorRecovery: true`）解析失败，**连带丢掉相邻标准属性**。`.layui-layer-setwin` 的 `position:absolute; right:15px; *right:0; top:15px` 中 `*right:0` 为 Unexpected token，整段定位被吃掉，产物只剩 `top:15px`（丢失 `position:absolute; right:15px`）→ 关闭钮不在标题栏右上角。layer 默认 `closeBtn: 1` 仍会生成 DOM，但位置错乱不可见。
- **ESC 关多层**：`utils.layerIndexStack` 只在 `setupEscClose` 入栈，经关闭钮 / shade / 代码 `layer.close` 关闭时未出栈，栈内残留已销毁索引；配合 `layer.closeAll` 路径更易一次清光。

**方案**：新增 `layer-fix.css`，用无 IE hack 的标准规则 `!important` 还原 setwin/close1/close2 定位；`layer.open` 包装未指定时默认 `closeBtn: 1`；type 1/2 未指定时默认 `shadeClose: true`（显式 `false` 如 Top250 登录仍保留）；`layer.close` / `closeAll` 同步清理栈，ESC 前过滤 DOM 已不存在的索引，只关最上层；`setupLayerWrapper()` 内 `injectCss(layerFixCss)`。

**实施**：`src/styles/layer-fix.css`（新增）、`src/core/layer-wrapper.ts`、`src/core/common-util.ts`（_handleGlobalEscKey 剪枝死索引只关最上层）。version 1.10.1 → 1.10.2。

### doc/85 ESC 逐级关闭（防一次关全部）

**背景**：doc/84 修复关闭钮后，用户反馈 ESC 仍一次关掉所有弹层，无法逐级关闭（先关二级、再关一级）。

**根因分析**（可能叠加因素）：① keydown 自动重复（`event.repeat`）：按住 ESC 或系统连发，同一物理按键连续触发多次 handler，每层关一次，体感为「一次全关」；② 仅依赖 `layerIndexStack` 顺序，栈与真实 DOM/z-index 不一致时可能关错层；③ 监听重复：jQuery bubble + 多处 `setupEscClose` 叠加时同一次 keydown 可能进入 handler 多次（doc/84 的 close 出栈不足以挡住同 tick 内连关）。

**方案**（重写 CommonUtil ESC 关闭逻辑）：`getTopLayerIndex()` 扫描 `.layui-layer[times]`，跳过 loading/tips，按 z-index 取最顶层；忽略 `event.repeat`；`_escClosing` 锁（同一次按键周期只关一层，keyup 解锁 + 400ms 兜底防死锁）；仅捕获阶段 `document.addEventListener(..., true)`，去掉 jQuery document bubble 双绑定；同源 iframe document 同样捕获绑定，共用 handler / 锁；`syncLayerIndexStack` 剔除已销毁索引。

**实施**：`src/core/common-util.ts`。version 1.10.2 → 1.10.3。

### doc/86 ESC 逐级关闭硬门修复

**背景**：doc/84 / doc/85 之后 ESC 仍一次关掉全部弹层。

**根因（重新定位）**：① layer 关闭动画：`layer.close` 在 `anim` 开启时 200ms 后才从 DOM 移除，此前节点仍在，若 handler 同 tick / 连发再取「顶层」，可能连关或状态错乱；② 实例锁不可靠：`_escClosing` 在实例上，keyup 过早 `false` 后 keydown 连发可再进 handler；③ 门闩与「可见顶层」未同步：关了但未立刻从候选集排除。

**方案**：模块级 `escLayerGate`（keydown 成功关一层后锁住，keyup Escape 才解锁，800ms 兜底）；调 `layer.close` 前立即摘除顶层（`data-jhs-esc-closing=1` + `display:none`，层 + 对应 shade）；`getTopLayerEl` 跳过 loading/tips / 关闭中 / display:none，按 z-index 取顶；`event.repeat` 忽略；捕获阶段单路径。

**效果**：一次物理按键只关最顶一层；松手后再按才关下一层。

**实施**：`src/core/common-util.ts`。version 1.10.3 → 1.10.4。**注意：请务必重装脚本**（旧版缓存会导致「怎么改都没用」）。

### doc/87 ESC 逐级关闭 iframe 内层优先修复（最终）

**背景**：doc/84、85、86、87 初版（1.10.5）、87 二版（1.10.6）、87 三版（1.10.7 诊断版）共六次尝试均未成功，本文为最终修复。

**诊断过程与根因演进**：

| 版本 | 怀疑点 | 措施 | 结果 |
|---|---|---|---|
| doc/85 (1.10.3) | `event.repeat` 连发 + getTopLayerIndex 取错层 | repeat 忽略 + DOM z-index 顶层 + `_escClosing` 实例锁 | 未命中 |
| doc/86 (1.10.4) | 实例锁不可靠 + layer 关闭动画 DOM 仍在 | 模块级 `escLayerGate` + 立即 `display:none` + 800ms 兜底 | 未命中 |
| doc/87 初版 (1.10.5) | gate 每 frame 一份不互斥 | 挂 `unsafeWindow.__jhsEscGate` | 未命中（实测 `gateIsTopGate=false`：Tampermonkey 中每 frame 的 unsafeWindow 指向自己 window） |
| doc/87 二版 (1.10.6) | 同帧不互斥 | 改 `window.top.__jhsEscGate` | 未命中（实测 `topGateShared=true` gate 共享了，但仍一次关两层） |
| doc/87 三版 (1.10.7) | — | 内嵌 `console.log` 诊断让用户实测 | 暴露真根因 |

**真根因（诊断输出）**：`[JHS-ESC-DIAG] { frame: TOP, gateLockedBefore: false, layersInThisDoc: 1, stackInThisFrame: [1], eventTarget: BODY }` → `CLOSING layer 1 in frame TOP`。要点：

1. ESC 只触发了一次，只有 **TOP frame 的 handler 被调用**，iframe frame handler 根本没跑
2. `eventTarget: BODY`——ESC 的 target 是外层 body，**焦点不在 iframe 内**
3. 外层 handler 找到最顶层 `.layui-layer`——是 `type=iframe` 弹层（详情页 iframe），直接关掉它
4. **iframe 弹层被关 → iframe DOM 销毁 → iframe 里的磁力搜索二级弹层跟随消失**

本质：只关了一层，但关的是**外层 iframe 弹层**而非 iframe 内更内层的二级弹层——因为内层弹层在 iframe document 里，外层 document 的 `getTopLayerEl` 查不到它；关掉 iframe 弹层后 iframe 销毁，内层弹层跟着没了，体感「一次关全部」。关键约束：iframe document 是独立事件目标，父 document 的 keydown 事件不会自动传递到 iframe contentDocument，所以 iframe 内 handler 不会自然被触发（即使 `setupEscClose` 给 iframe contentDocument 绑了 handler）。

**最终方案（1.10.8）**：外层 handler 检测到顶层是 `type=iframe` 弹层时：

1. 检查 iframe `contentDocument` 内是否有可见的 `.layui-layer`（内层弹层，跳过 loading/tips/关闭中/隐藏）
2. 若**有内层弹层**：释放 gate → 主动向 iframe `contentDocument` `dispatchEvent` 一个 ESC `KeyboardEvent`（`composed: true`）→ iframe 内 handler 收到 ESC → `tryEnter` 成功（gate 已释放）→ `getTopLayerEl` 在 iframe document 找到内层弹层并关闭它 → iframe handler 的 800ms `setTimeout` 兜底释放 gate → 外层 handler `return`（不关外层 iframe 弹层）
3. 若**无内层弹层**：正常关外层 iframe 弹层

互斥保证：外层先 `tryEnter` 锁住 gate → 释放 → dispatch 到 iframe；iframe handler `tryEnter` 成功（gate 已释放）→ 关内层 → 800ms 后释放；同一次按键不会重复 `tryEnter`；gate 共享 `window.top.__jhsEscGate`，跨 frame 互斥可靠。

**实施**：`src/core/common-util.ts`（_handleGlobalEscKey 新增 iframe 内层弹层检测 + 向 iframe contentDocument dispatch ESC keydown + 移除诊断日志）。version 1.10.7 → 1.10.8。

**与前几次修复的关系**：

| 版本 | 修复 | 保留 / 撤销 |
|---|---|---|
| doc/85 (1.10.3) | `event.repeat` 忽略 + getTopLayerEl | **保留**（防连发基础） |
| doc/86 (1.10.4) | 模块级 `escLayerGate` + 立即 `display:none` | **保留**（防动画期重入） |
| doc/87 初版 (1.10.5) | `unsafeWindow.__jhsEscGate` | **撤销**（每 frame 独立无效） |
| doc/87 二版 (1.10.6) | `window.top.__jhsEscGate` | **保留**（gate 跨 frame 共享） |
| doc/87 三版 (1.10.7) | 诊断日志 | **已撤销**（移除） |
| doc/87 最终 (1.10.8) | iframe 内层弹层检测 + dispatch ESC | **本次新增** |

验证路径：列表页点击封面打开详情 iframe 弹层 → iframe 内打开磁力搜索二级弹层 → 按一次 ESC 只关二级、再按一次关详情弹层、长按 ESC 只关一层。

**演进链**：doc/84（关闭按钮 + ESC 栈）→ doc/85（连发与顶层）→ doc/86（硬门）→ doc/87 三版诊断暴露真根因（焦点在 iframe 外层、外层 handler 关掉 iframe 弹层连带内层消失）→ doc/87 最终版 dispatch ESC 进 iframe 实现内层优先。六次迭代中 doc/85/86 与 doc/87 二版的机制被保留为最终方案的基础，doc/87 初版与三版被撤销。

---

## 八、移除快捷键配置与业务快捷键（doc/88）

### 背景

用户要求将设置中的「快捷键配置」面板全部清理，相关功能模块也不再需要：列表页悬停快捷屏蔽/收藏/观看、详情页快捷键、折叠分类/控制台快捷键、按钮上的快捷键提示等。说明：独立插件 `KeyPageTurningPlugin`（方向键翻页）不依赖设置快捷键系统，**保留**。

### 方案与实施

| 类别 | 处理 |
|---|---|
| 设置 UI | 删除侧栏「⌨️ 快捷键配置」+ `#hotkey-panel` 整块（setting-dialog.tsx，去掉 block/favorite/watched props） |
| SettingPlugin | 删除 loadForm/saveForm 中 hotkey 读写与 `handleHotkeyInput` / `parseHotkey` / `isDuplicateHotkey` |
| ListPagePlugin | 删除 `bindListPageHotKey` 及 `$currentImage`/热键字段 |
| DetailPageButtonPlugin | 删除 `bindHotkey`、热键字段、`answerCount`/force 屏蔽、按钮文案中的 `(快捷键)` 后缀 |
| PreviewVideoPlugin / FoldCategory | 去掉 hotKey 展示与读取（含 preview-video-action-btn.tsx / fold-category-toolbar.tsx 的 hotKey prop） |
| 核心 | 删除 `src/core/hotkey.ts`；main.tsx 去掉 Hotkey keydown/keyup 监听 |

### 结果

version 1.10.8 → 1.11.0（功能移除）；构建通过。行为变化：设置弹窗侧栏无「快捷键配置」；列表页/详情页按 a/s 等键不再触发屏蔽/收藏；详情菜单按钮无 `(a)` 类快捷键后缀；方向键翻页（KeyPageTurning）仍可用。

---

## 九、屏蔽功能清理与标题关键词过滤恢复（doc/89 → 90 → 91）

> 本阶段第三关键演进链：doc/89 移除屏蔽配置面板与划词/封面右键屏蔽（1.12.0）→ doc/90 修正误删、恢复视频标题屏蔽词（1.12.1）→ doc/91 修复恢复文件的编码乱码（1.12.2）。

### doc/89 移除屏蔽配置面板与划词/封面右键屏蔽

**背景**：用户要求进一步删除：① 设置中的「屏蔽配置」面板；② 列表页视频封面右键屏蔽番号；③ 评论区屏蔽词（配置 + 过滤 + 划词加入）；④ 划词屏蔽（标题选中右键加入关键词）。**保留**：详情页按钮「屏蔽」单番号、演员黑名单、简易设置中「屏蔽单番号/演员」显示开关。

**方案**：

| 项 | 处理 |
|----|------|
| 设置 filter-panel | 整面板删除（划词开关 + 评论/标题关键词管理） |
| FilterTitleKeywordPlugin | 删除插件 + main 注销 |
| 列表 contextmenu 右键屏蔽 | 删除 |
| 列表标题关键词过滤 | 删除匹配/标签/计数 |
| 评论关键词过滤 + 右键加入 | 删除 |
| 简易设置「屏蔽关键词」开关 | 删除 |
| keyword-label 组件 | 删除（无引用） |
| 帮助文案「系列番号关键词」 | 删除对应章节 |

**实施文件**：setting-dialog.tsx / simple-setting-panel.tsx / setting-plugin.tsx / list-page-plugin.tsx / review-plugin.tsx / filter-title-keyword-plugin.ts（删除）/ keyword-label.tsx（删除）/ page-count-table.tsx / help-dialog.tsx / main.tsx。

**结果**：version 1.11.0 → 1.12.0；构建通过。

### doc/90 恢复视频标题屏蔽词（修正 doc/89 误删）

**背景**：doc/89 删除屏蔽相关能力时误删了「视频标题屏蔽词」整套功能。用户澄清：设置菜单中只删明细项（划词开关、评论区屏蔽词），**标题屏蔽应保留**。

**仍删除（保持 doc/89）**：启用划词屏蔽 + `FilterTitleKeywordPlugin`；评论区屏蔽词配置/过滤/划词加入；列表封面右键屏蔽番号。

**恢复内容**：

| 项 | 说明 |
|----|------|
| 设置 filter-panel | 仅保留「视频标题屏蔽词」管理 |
| KeywordLabel + addLabelTag/addKeyword | 标签增删 |
| loadForm/saveForm 标题词读写 | `getTitleFilterKeyword` / `saveTitleFilterKeyword` |
| 列表关键词过滤 | 匹配标题/番号前缀 + 状态标签 + 计数 |
| 简易设置 showFilterKeywordItem | 显示已屏蔽关键词内容开关 |
| 帮助文案 | 系列番号用标题关键词 |

**实施文件**：setting-dialog.tsx / keyword-label.tsx / simple-setting-panel.tsx / setting-plugin.tsx / list-page-plugin.tsx / page-count-table.tsx / help-dialog.tsx。

**结果**：version 1.12.0 → 1.12.1；构建通过。

### doc/91 修复关键词标签删除钮乱码

**背景**：设置「视频标题屏蔽词」标签右侧删除钮显示为 `脳` 而非 `×`。

**根因**：doc/90 用 PowerShell `Out-File` 从 git 恢复 `keyword-label.tsx` 时 UTF-8 损坏，`×`（U+00D7）被错误解码为 `脳`。

**修复**：重写 `src/components/keyword-label.tsx`，删除钮使用 `'\u00d7'`（×）。

**结果**：version 1.12.1 → 1.12.2；构建通过，dist 中为 UTF-8 C3 97（×）。

---

## 十、二级工具栏控件清理（doc/92 → 93）

### doc/92 清理 .toolbar 内脚本注入控件

**背景**：用户要求不再显示 `body > section > div > div.toolbar > div:nth-child(3)` 与 `div:nth-child(4)`，二者均由本脚本注入到 JavDB 二级工具栏 `.toolbar`。

**来源**：`PageSortPlugin`（向 `.toolbar` append 排序按钮组）；`ListPageButtonPlugin`（演员页，向 `.toolbar, .section-addition` 追加 MenuButtonBoxHtml 两个 flex 行）。

**方案**：① PageSortPlugin `handle` 直接 return，不再注入 toolbar 排序条（列表仍可用 `#sort-toggle-btn` jhs 排序）；② ListPageButtonPlugin 演员页不再挂 `.toolbar`，改为 `section-addition` → `h2.section-title` → `main-tabs/tabs`。

**结果**：version 1.12.2 → 1.12.3。

### doc/93 补完演员页按钮组移除

**背景**：doc/92 曾描述此清理，但实际提交未改动 `list-page-button-plugin.tsx` / `page-sort-plugin.ts`（仅改了 hotkey/filter 相关文件），演员页按钮仍渲染。本文档补完实际落地。

**内容**：`https://javdb.com/actors/*` 页面 `.toolbar` 内脚本注入的两个按钮组 div：第 3 子节点（打开待鉴定 / 打开已收藏 / 加入黑名单 / 一键屏蔽所有作品）、第 4 子节点（新作品检测 / 演员黑名单 / 排序方式切换），均由 `ListPageButtonPlugin.createMenuBtn` 经 `MenuButtonBoxHtml` 组件注入。

**方案**：演员页不再渲染 `MenuButtonBoxHtml`，`createMenuBtn` / `bindEvent` 在 `currentHref.includes('/actors/')` 时直接 return。由此产生的死代码一并清理：

| 文件 | 改动 |
|---|---|
| `list-page-button-plugin.tsx` | createMenuBtn/bindEvent 演员页早返回；删除已失效的 `#filterAllVideo` 点击绑定（filterAllVideo 仅演员页渲染，现已无节点）；删除 `loadObj` 属性（仅 filterAllVideo 绑定使用）；调用处去掉 `actorsPage` prop |
| `menu-button-box-html.tsx` | 删除 `actorsPage` prop + 其渲染分支（addBlacklistBtn + filterAllVideo 的演员页变体）；删除 `FILTER_ALL_TIP` 常量；更新 JSDoc |
| `fold-category-plugin.tsx` | `loopDetector` 轮询条件加 `/actors/` 前置，演员页立即命中避免 10s 空轮（createFoldBtn 在演员页无 `#tags` 自然早返回） |

**未改动（保留）**：`BlacklistPlugin.filterAllVideo` 方法保留（仅失去外部调用入口，方法本身递归调用仍在，TS 不报错；属跨插件清理，留待后续）；`PageSortPlugin` 仍按原逻辑注入 `.toolbar`（用户本次仅要求清理 MenuButtonBoxHtml 两个 div，PageSort 排序条是独立控件，不在本次范围）；演员页 `sortItems` 仍执行（依 localStorage 排序列表项，不依赖按钮）。

**结果**：version 1.12.3 → 1.12.4；tsc -b 零错误，构建通过。

**演进链**：doc/93 修正 doc/92 的落地不完整（doc/92 描述与实际提交不符）。

---

## 十一、跨标签页状态标签同步修复（doc/94）

### 背景/根因

用户报告：在视频详情页点击收藏或已读后，列表页（其他标签页）视频卡片右上角的已收藏/已观看状态标签（`.status-tag`）不刷新。

根因：doc/76（commit `3611d81`，集成 jhs 3.3.6.027）为 `StorageManager.getCarList()` 引入了运行时缓存 `cacheCarList`（受 `featureFlags.storageCacheDeepCopy` 控制，默认开启）。缓存仅在**本页** `saveCar`/`removeCar` 时更新，**不跨标签页同步**。两条跨标签页同步路径均受影响：

| 路径 | 触发方 | 接收方 | 缓存问题 |
|------|--------|--------|----------|
| `broadcastWantWatchedSync`（GM_setValue + localStorage + CustomEvent） | `quickConvertToFav`/`quickSetHasWatch`/`onWantAdded`/`onWatchedAdded` | `setupWantWatchedSyncListener` → `refreshItemStatusTag` → `renderItemStatusTag` → `getCar` | 列表页 `cacheCarList` 为旧值 |
| `refresh()`（BroadcastChannel `channel-refresh`） | `favoriteOne`/`hasWatchOne`/`filterOne` 等 | `handle` 的 `refresh` 分支 → `doFilter` → `filterMovieList` → `getCarList` | 列表页 `cacheCarList` 为旧值 |

`clearCarListCache()` 方法自 doc/76 起就已定义但**从未被调用**，属遗漏。

### 方案与实施

在两条跨标签页同步路径的接收端，于读取数据前清除 `cacheCarList`：

1. `detail-page-button-plugin.tsx` `handleSync`：payload 校验通过后、`showStatus`/`refreshItemStatusTag` 之前，调 `storageManager.clearCarListCache()`
2. `list-page-plugin.tsx` BroadcastChannel `refresh` 分支：`doFilter()` 之前调 `storageManager.clearCarListCache()`

清除后 `getCar`/`getCarList` 会从 IndexedDB 重读最新值，状态标签正确刷新。

### 结果

version 1.12.4 → 1.12.5；tsc -b 零错误，构建通过。验证要点：Tab B 收藏/已读/拉黑后切回 Tab A 列表，卡片右上角标签分别显示「已收藏」/「已观看」/「已屏蔽」。

---

## 十二、磁力搜索按钮并入菜单行（doc/95）

### 背景/根因

视频详情页顶部工具按钮组 `DetailMenuButtons`（注入在 `.tabs` 后方）右行 `.jhs-menu-tools-row` 原本包含：磁力过滤开关 / 字幕(迅雷) / 字幕(SubTitleCat)，三个按钮均使用 `menu-btn` class + 渐变背景 + 统一 `width`/`padding:8px 0`/白字居中风格。

磁力搜索按钮（`#magnetSearchBtn`）却由 `createMenuBtn` 在组件渲染之后**单独**用 jQuery `.after()` 注入到 `.movie-panel-info, .tabs` 之后，样式为 `<a class="button is-small is-warning" style="margin:8px 0">`（Bulma 黄色小按钮），与同行其他按钮风格割裂，且位置游离在菜单行之外。用户要求把磁力搜索按钮放进该行（对应 `.jhs-menu-tools-row` 右行，见 doc/72 MCP 确认），并采用同样的风格样式自动匹配。

### 方案与实施

将磁力搜索按钮从「运行时单独 DOM 注入」改为「由 `DetailMenuButtons` 组件在右行内条件渲染」：

1. **`DetailMenuButtons` 组件**新增 prop `showMagnetSearch: boolean`，为 true 时在右行末尾（`#search-subtitle-btn` 之后）渲染 `#magnetSearchBtn`，样式复用 archetype 原始磁力搜索按钮的渐变配色 `linear-gradient(to right, rgb(245,140,1), rgb(84,161,29))`，结构（`menu-btn` class + `width:120px` + `padding:8px 0` + 白字居中 + 内嵌 `<span>磁力搜索</span>`）与字幕按钮完全一致。
2. **`createMenuBtn`** 调用组件时传入 `showMagnetSearch={featureFlags.magnetHubPlugin}`，删除原 `.after(...)` 单独注入逻辑，保留 `#magnetSearchBtn` 的 click 事件绑定（打开 MagnetHub 弹窗）。

**渲染等价性**：flag 为 true（默认）→ 组件渲染按钮 DOM 存在、事件绑定生效；flag 为 false → 组件不渲染按钮（`{false && <a/>}` 经 jsxToString 输出空串）、事件绑定块不执行——与原逻辑一致。

**实施文件**：`src/components/detail-menu-buttons.tsx`、`src/plugins/detail-page-button-plugin.tsx`。

### 结果

version 1.12.5 → 1.12.6（UI 样式统一，patch 递增）；tsc -b 零错误，构建通过。验证要点：右行按钮顺序为 关闭磁力过滤 / 字幕(迅雷) / 字幕(SubTitleCat) / **磁力搜索**，风格统一；关 `magnetHubPlugin` flag 后按钮消失、其余按钮不受影响。

---

## 十三、115 网盘残留死代码清理（doc/96）

### 背景/根因

115 网盘三件套插件（`WangPan115TaskPlugin` 离线下载 / `WangPan115MatchPlugin` 视频匹配 / `WangPan115Plugin` 登录页）的**插件本身**在 doc/03（精简为 javdb 专用脚本）时已删除，但其**入口与 UI 残留**仍散落在组件和插件中，点击或勾选均无实际效果（死代码）：

- 设置面板「启用115视频匹配」开关（`#enable115Match`）——勾选只写 IndexedDB，无插件消费，纯死设置项
- 评论区磁链/ed2k 旁的「115离线下载」按钮（`down-115`）——点击 `getBean` 返回 undefined 静默失败
- FC2 弹窗磁链后的「115离线下载」按钮注入块——`WangPan115TaskPlugin` 未迁移，`?.handleAddTask` 静默失败
- 帮助对话框「如何多浏览器同时登录115网盘?」段落——115 登录功能已不存在
- `fc2-plugin.ts` 头部注释把 `WangPan115TaskPlugin` / `115离线` 列为缺失依赖

### 方案与实施

| 文件 | 改动 |
|---|---|
| `simple-setting-panel.tsx` | 删除「启用115视频匹配」设置项（`#enable115Match`）；头部注释去掉「115匹配、」 |
| `setting-plugin.tsx` | 删除 `#enable115Match` 的 `prop('checked')` + `on('change')` 绑定块（8 行） |
| `review-link-content.tsx` | ed2k 分支删除 `<button class="down-115">115离线下载</button>`（保留 `<span>` 显示链接）；magnet 分支删除同款按钮（保留 `<a>` 链接）；头部 doc-comment 同步 |
| `fc2-plugin.ts` | 删除 FC2 弹窗 `$('#magnets-content').html()` 后追加「115离线下载」按钮的 `.each(...)` 注入块（27 行）；头部注释缺失依赖「5 个」→「4 个」 |
| `help-dialog.tsx` | 删除第 4 条「如何多浏览器同时登录115网盘?」帮助段落 |

**保留项**：`storage-manager.ts` 的 `downPath115` 善后清理逻辑（删除老用户 IndexedDB setting 中残留的 `downPath115` 键，属「清理旧数据」的善后工作，不是功能代码；保留可让已升级用户的残留配置被自动清除）。

### 结果

version 1.12.6 → 1.12.7（清理死代码，patch 递增）；tsc -b 零错误，5 个修改文件无 error/warning；产物约 1887.86 kB，较清理前 -3.02 kB；产物 grep 验证 `115离线下载` / `enable115Match` / `down-115` / `登录115网盘` / `WangPan115TaskPlugin` 均 0 次。

---

## 十四、快捷设置菜单精简与功能读取删除（doc/97 → 98）

### doc/97 整理优化快捷设置菜单（方案 A）

**背景**：快捷设置面板（`SimpleSettingPanel`）设置项过多，部分开关用户不常调整且功能默认值已合理；页面列数默认 5、页面宽度默认 100% 偏宽。需精简菜单 + 优化默认值。

**处理原则**：删除设置项 = 删除 UI（`SimpleSettingPanel` 中的 setting-item div）+ 删除绑定逻辑（`initSimpleSettingForm` 中的 prop/on change）；**保留功能读取** = 各插件中的 `storageManager.getSetting(...)` 调用不动，功能按默认值（或老用户已保存值）运行；**可恢复**（底层 setting 键保留，UI 代码 git 可恢复）；**可查询**（控制台 `storageManager.getSetting('xxx', default)` 仍可查）；**清理干净**（删除后不留孤儿代码）。

**逐项明细**：

| # | 设置项 | UI | 绑定 | 功能读取（保留） | 默认值 |
|---|--------|----|------|------------------|--------|
| 1 | hoverBigImg（启用悬浮大图） | 删 | 删（含 ImagePreview 创建/销毁） | list-page-plugin getSetting('hoverBigImg', NO) | NO（关闭） |
| 2 | enableLoadScreenShot（加载长缩略图） | 删 | 删（含 .screen-container 移除） | screenshot-plugin getSetting('enableLoadScreenShot', 'yes') | yes（加载） |
| 3 | enableLoadPreviewVideo（更高画质预览视频） | 删 | 删 | preview-video-plugin 两处 getSetting(..., YES) | YES（开启） |
| 4 | enableVerticalModel（竖图模式） | 删 | 删（含 applyImageMode 调用） | setting-plugin applyImageMode getSetting(..., NO) | NO（横图） |
| 5 | containerColumns（页面列数） | 保留 | 保留 | initCss + form | **5 → 4** |
| 6 | containerWidth（页面宽度） | 保留 | 保留 | initCss + form | **100% → 70%** |

补充要点：项 1 删除后 `ImagePreview` 的 import 在 setting-plugin.tsx 已无其他引用，一并删除，功能初始化保留在 list-page-plugin（页面加载时按 setting 值创建）；项 4 的 `applyImageMode` 方法保留（initCss 和 containerColumns input 仍调用），内部读取保留；项 5/6 各改 3 处默认值（initCss `??` + form `||` × 2）；containerWidth 存储值为实际百分比（70-100），range 值 = 宽度 - 70（0-30），默认 70% 对应 range=0（最小值）。

**实施文件**：`simple-setting-panel.tsx`（删 4 项 UI + 清理冗余空行 + 头部注释）、`setting-plugin.tsx`（删 4 项绑定 + 删除 unused `import { ImagePreview }` + 两默认值各 3 处）。

**结果**：version 1.12.7 → 1.12.8（菜单整理 + 默认值调整，patch 递增）；产物约 1883.79 kB，较清理前 -4.07 kB；4 个设置项 id 在产物中 0 匹配（UI + 绑定已清除），功能读取（getSetting 调用）全部保留。

### doc/98 彻底删除 4 个设置项的功能读取逻辑（方案 B）

**背景**：doc/97 删除了四个设置项的 UI + 绑定，但保留了功能读取逻辑（各插件中的 `getSetting` 调用），功能按默认值运行、老用户 setting 值仍生效（**方案 A**）。用户确认改为**方案 B**：彻底删除功能读取逻辑，功能固定按默认值运行，不给老用户兜底，逻辑删除即可。

**逐项明细**：

| # | 设置项 | 读取点 | 删除内容 | 连带清理 | 固定行为 |
|---|--------|--------|----------|----------|----------|
| 1 | hoverBigImg | list-page-plugin.tsx:709 | `getSetting('hoverBigImg', NO)` + ImagePreview 创建/绑定逻辑 | `import { ImagePreview }` + 相关注释 | 悬浮大图不启用 |
| 2 | enableLoadScreenShot | screenshot-plugin.ts:19 | `if (getSetting(...) !== 'yes') return;` 判断行 | 无 | 长缩略图始终加载 |
| 3 | enableLoadPreviewVideo | preview-video-plugin.tsx:459,547 | L459 条件简化（删该设置，保留 autoPlay 判断）；L547-549 删除 `=== NO return` 判断 | 无（YES/NO 在 L559/562 仍用） | 更高画质预览始终解析 |
| 4 | enableVerticalModel | setting-plugin.tsx applyImageMode | 删除 `getSetting('enableVerticalModel', NO)` + YES 分支（竖图 CSS），方法简化为固定注入横图 CSS | `import verticalImgCssRaw` + 孤儿文件 `setting-image-mode-vertical.css` | 固定横图模式 |

**实施文件**：`list-page-plugin.tsx` / `screenshot-plugin.ts` / `preview-video-plugin.tsx` / `setting-plugin.tsx` / `src/styles/setting-image-mode-vertical.css`（删除文件）。

**结果**：version 1.12.8 → 1.12.9（删除功能读取逻辑 + 孤儿 CSS，patch 递增）；tsc -b 零错误，4 个修改文件无 error/warning；产物约 1876.53 kB，较 doc/97 后 -7.26 kB；5 个关键词（hoverBigImg / enableLoadScreenShot / enableLoadPreviewVideo / enableVerticalModel / verticalImgCssRaw）产物中均 0 匹配。

**遗留**：4 个 setting 键仍在 IndexedDB，但代码不再读取，值无意义（控制台 `storageManager.getSetting('hoverBigImg', 'no')` 仍返回旧值）。

**演进链**：doc/97（方案 A：删 UI + 绑定、保留功能读取）→ doc/98（方案 B：彻底删功能读取，用户明确不兜底老用户）。

---

## 附：版本演进一览

| 版本 | doc | 主题 |
|---|---|---|
| 1.9.0 | 76 | 对照 3.3.6.027 可插拔升级落地（批次 A–D） |
| 1.9.1 | 79 | 修复 123Av-Fc2 导航双份与识图按钮缺失 |
| 1.9.2 / 1.9.3 | 80 | CoverButton 可见性加固（含 series 页追加） |
| 1.9.4 | 81 | 撤销 CoverButton 可见性加固 |
| 1.10.0 | 82 | 删除 CoverButtonPlugin 全套（minor） |
| 1.10.1 | 83 | 设置开关 CSS 冲突修复 |
| 1.10.2 | 84 | 弹窗关闭按钮 + ESC 栈同步 |
| 1.10.3 | 85 | ESC 逐级关闭（event.repeat + z-index 顶层） |
| 1.10.4 | 86 | ESC 硬门（模块级 gate + 立即摘除） |
| 1.10.5 / 1.10.6 / 1.10.7 / 1.10.8 | 87 | ESC 跨 frame 真根因最终修复（四版） |
| 1.11.0 | 88 | 移除快捷键配置与业务快捷键 |
| 1.12.0 | 89 | 移除屏蔽配置面板与划词/封面右键屏蔽 |
| 1.12.1 | 90 | 恢复视频标题屏蔽词（修正误删） |
| 1.12.2 | 91 | 关键词标签删除钮乱码修复 |
| 1.12.3 | 92 | 清理 .toolbar 脚本注入控件 |
| 1.12.4 | 93 | 补完演员页按钮组移除 |
| 1.12.5 | 94 | 跨标签页状态标签同步修复 |
| 1.12.6 | 95 | 磁力搜索按钮并入菜单行 |
| 1.12.7 | 96 | 115 网盘残留死代码清理 |
| 1.12.8 | 97 | 快捷设置菜单精简（删 4 项 UI + 改 2 默认值） |
| 1.12.9 | 98 | 彻底删除 4 设置项功能读取（方案 B） |

## 阶段遗留问题汇总

- **doc/76**：CoverButton 第三方域名 jable/avgle/123av 使用默认值；Fc2By123Av 123av 多版 DOM 解析可能需再校准；列表页标题翻译仍内联在 ListPagePlugin；行为优化旧 flag 分支可择机删除。
- **doc/82**：ScreenShotPlugin 详情页入口保留可用；ranking-containers 的 `.tool-box` 空容器保留（HitShow/Top250 工具栏挂载点）。
- **doc/93**：`BlacklistPlugin.filterAllVideo` 方法保留但失去外部调用入口（跨插件清理留待后续）；PageSortPlugin 仍按原逻辑注入 `.toolbar`（独立控件，不在清理范围）。
- **doc/96**：`downPath115` 善后清理逻辑保留，自动清除老用户残留配置。
- **doc/97/98**：4 个设置项键仍在 IndexedDB 但代码不再读取，值无意义。