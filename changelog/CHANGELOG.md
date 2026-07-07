# 更新日志

> 所有版本的变更记录，按版本倒序排列（最新在最前）。
>
> 版本号规则：`major.minor.patch`
> - **patch**：修 bug、小改动、优化、协同修复
> - **minor**：新增插件、新增功能模块、较大功能变更
> - **major**：架构级重构、不兼容变更

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
