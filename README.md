# JavDB Power Tools

> JavDB / MissAV 双站增强用户脚本 —— 收藏管理、屏蔽过滤、跨站同步、榜单、云备份一站式工具箱。
>
> 基于 Vite + React + TypeScript 工程化构建，由原单文件混淆脚本 `jhs.user.js`（11000+ 行）
> 拆分重构而来，并集成了多个独立油猴脚本，功能逻辑与原脚本零偏差。

## ✨ 功能总览

脚本在 **JavDB** 与 **MissAV** 两个站点运行，覆盖列表页、详情页、演员页、清单页等场景，
提供 **42 个功能插件**（JavDB 39 + MissAV 3）。

### 📋 列表页增强

| 功能 | 说明 |
|------|------|
| 状态标签 | 自动在视频卡片上标注已收藏 / 已观看 / 已屏蔽等状态 |
| 状态筛选 | 按 status-tag 文本生成筛选芯片，OR 逻辑快速过滤 |
| 标题过滤 | 标题关键词右键加入屏蔽词，列表页自动隐藏匹配项 |
| 演员屏蔽 | 黑名单演员的影片自动隐藏，支持演员/女演员分类 |
| 排序 | 默认 / 评价人数 / 时间 三档排序 + 按名称/评分升降序单页排序 |
| 自动翻页 | 滚动到底自动加载下一页（瀑布流），超 60 页走 Beyond60 |
| 快捷键 | 左右方向键翻页 |
| 封面高清 | 列表页缩略图替换为高清图 + 悬浮大图预览 |
| 分类折叠 | 列表页分类区一键折叠/展开 + 标签高亮收藏 |
| 翻译缓存 | 番号译文缓存，避免重复请求 |
| 个人评分 | 列表页卡片显示你的个人评分（首屏缓存 + 悬停懒加载） |
| 预加载 | 可配置的列表页数据预加载（筛选芯片 UI） |

### 📄 详情页增强

| 功能 | 说明 |
|------|------|
| 顶部按钮组 | 屏蔽 / 收藏 / 已观看 / 磁力过滤 / 字幕搜索 / 评分 / 清单面板 |
| 磁链过滤 | 高画质优先（4K/-c/-u/-uc 标红），隐藏低画质 |
| 磁链聚合 | 多引擎磁链搜索聚合（需 feature flag 开启） |
| 预告片 | DMM 预告片解析播放 + 画质切换 / 快进工具栏 |
| 第三方跳转 | 一键跳转 MissAv / SupJav 等第三方站点（搜索 + 缓存） |
| 演员信息 | 从日文维基百科抓取身高 / 三围 / 罩杯 / 生日 / 年龄 |
| 收藏演员 | 高亮已收藏演员 + 演员页收藏/取消 + 头像替换（GFriends） |
| 评论加载 | 从远程 API 加载评论（折叠 / 分页 / 链接渲染 / 右键屏蔽） |
| 相关清单 | 从远程 API 加载相关清单（折叠 / 分页 / 重试） |
| 标题翻译 | 详情页标题翻译（需 feature flag 开启） |
| 截图墙 | javstore 截图墙展示（需 feature flag 开启） |
| 以图识图 | 封面图搜索引擎识别（需 feature flag 开启） |
| 标题过滤 | 详情页标题右键选中文本加入屏蔽关键词 |
| FC2 支持 | FC2 番号详情弹窗 + 123Av FC2 浏览（需 feature flag 开启） |

### 🏆 榜单

| 功能 | 说明 |
|------|------|
| 热播榜单 | 拦截"播放排行"改写为日/周/月热播榜 + 评分渲染 |
| Top250 | 拦截"猜你喜歡"改写为 Top250 排行榜（分类/年份/字幕切换 + 登录） |

### 📚 清单管理

| 功能 | 说明 |
|------|------|
| 清单标签 | 清单 checkbox 同步本地 IDB + 列表页显示标签/筛选栏（JavDB 服务端权威对账） |
| 瀑布流 | 我的清单/收藏清单页自动翻页加载 |
| 阅读进度 | 清单阅读进度下拉框 + 1-5 星评分（双向同步） |
| 模态禁用 | "保存到清单"模态框自动禁用指定编号清单项 |
| 链接改写 | 我的清单链接改新标签打开 + RESTful 短地址 |

### 🔄 跨站同步

| 功能 | 说明 |
|------|------|
| 状态同步 | JavDB 端收藏/屏蔽/观看状态实时同步到 MissAV（零网络请求，GM 存储跨域传递） |
| 增量 journal | 每次操作追加到 journal 数组，带单调修订号，超阈值去重压缩 |
| 全量快照 | 页面加载时列存 + gzip 全量同步，修订号保护 + journal 裁剪 |
| 修订号门控 | 双层门控（内存 + IDB 持久化），防重复消费、防旧数据覆盖新数据 |
| 对账写入 | 全量消费时对比快照删除本地多余记录，失败自动回滚 |
| 崩溃恢复 | 意图日志（localStorage）记录未完成消费，下次加载自动恢复 |
| MissAV 标签 | MissAV 页面缩略图上显示 JHS 状态标签（已收藏/已观看/已屏蔽/已下载） |
| 快速复制 | MissAV 播放页番号一键复制 + 跳转 JavDB 搜索 |
| 诊断菜单 | Tampermonkey 菜单一键转储同步状态（GM/IDB/水位线）到控制台 + 剪贴板 |
| 强制重同步 | 清除 IDB 水位线后重新消费全量 + 增量 |

### 💾 数据管理

| 功能 | 说明 |
|------|------|
| 云备份 | WebDav 备份/恢复全部数据（收藏/黑名单/演员/设置/清单），支持 AES-GCM 加密 |
| 自动备份 | 每日首次打开自动增量备份（滚动文件名，每浏览器一份） |
| 本地导入导出 | JSON 格式导入导出 |
| 鉴定记录 | 导航栏入口 + 远程分页表格（筛选/排序/批量变更状态） |
| 新作品检测 | 按女优类型过滤的卡片网格 + 分页 + 编辑 |
| 访问记录 | 记录所有打开过的 javdb 页面，详情页元数据悬浮显示最近打开时间 |
| 缓存管理 | 设置面板查看各缓存大小/条目数 + 清理/导出 |
| 插件诊断 | 设置面板查看所有插件注册/CSS/handle 执行状态与耗时 |

## 🚀 安装

### 前置要求

- 浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/) v5.x+
- 浏览器：Chrome / Edge / Firefox

### 方式一：直接安装（推荐）

1. 安装 Tampermonkey 浏览器扩展
2. 下载 [`dist/monkey-jhs-disassemble.user.js`](./dist/monkey-jhs-disassemble.user.js)
3. 在 Tampermonkey 中新建脚本，粘贴内容并保存（或直接拖入浏览器安装）

### 方式二：从源码构建

```bash
# 克隆仓库
git clone <repo-url>
cd monkey-jhs-disassemble

# 安装依赖（需 Bun）
bun install

# 构建
bun run build    # = tsc -b && vite build

# 产物在 dist/monkey-jhs-disassemble.user.js（~2,071 kB / gzip ~479 kB）
```

## ⚙️ 配置

安装后在 JavDB 页面点击导航栏的设置按钮打开设置面板（9 个面板）：

- **💾 数据备份**：WebDav 地址/用户名/密码 + 备份/恢复 + 自动备份策略
- **⚙️ 基础配置**：状态标签位置、显示开关、autoPage 瀑布流等
- **🚫 屏蔽配置**：标题关键词、评论关键词
- **🌐 外部网站**：MissAv / SupJav 等第三方站点域名与启用开关
- **🧹 清理缓存**：查看/清理/导出各缓存
- **📋 收藏清单关系**：清单标签管理（VLT 数据导入/导出/同步）
- **🎬 MissAV 同步**：立即同步 / 导入 / 导出
- **⚡ 预加载配置**：列表页预加载策略
- **📊 插件诊断**：所有插件注册/CSS/handle 执行状态与耗时

## 🌐 支持站点

| 站点 | 域名 | 功能 |
|------|------|------|
| JavDB | `javdb.com` | 全部 38 个插件 |
| MissAV | `missav.ws` / `missav.live` / `missav.ai` | 状态标签 + 快速复制 + 列表页瀑布流 |

## 🔧 技术架构

- **构建工具**：Vite 8 + vite-plugin-monkey 8
- **语言**：TypeScript 6（strict 模式，全量去 `@ts-nocheck`）
- **UI 框架**：React 19（jsxToString 渲染 HTML 字符串，不依赖 react-dom）
- **CSS 处理**：lightningcss（errorRecovery 容错 IE hack）
- **包管理**：Bun
- **代码质量**：ESLint（0 errors / 0 warnings）+ Stylelint（0 errors）+ Vitest 测试
- **第三方库**：jQuery / Tabulator / layer.js / Toastify / localforage / Viewer.js / blueimp-md5（全部 ESM import 打包，`@require` 全部移除）

### 插件系统

所有功能以 `BasePlugin` 子类形式注册到 `PluginManager`，统一调度：

- `initCss()` — 返回 CSS 字符串，构建时注入
- `handle()` — 主逻辑，页面加载后并发执行（按 `pageTypes` 过滤）
- `getBean(name)` — 跨插件类型安全调用（`PluginMap` 映射）
- `destroy()` — 销毁钩子（`TaskSupervisor` 统一定时器/Observer/事件监听器生命周期）

### 跨站同步架构

```
javdb 端                              GM 存储                     missav 端
─────────                             ────────                    ─────────
saveCar → callback                    jhs_car_status_delta        GM_addValueChangeListener
  → pushDelta                         = journal 数组               → consumeDeltaJournal
  → nextRevision (Web Lock)           [{action,items,ts,rev}]       → applyDelta
  → appendDeltaJournal                                             → withSyncRevision (门控+回滚)
                                                                   → upsertLocalCars → IDB
页面加载 needsSync                     jhs_car_status_data          页面加载
  → syncFullCarStatus                 = 列存+gzip 快照              → consumeFull
  → publishSnapshot (修订号保护)       {data,count,revision,        → replaceLocalCars (对账)
  → journal 裁剪                       mode,ready}                  → processAll → renderBadges
```

### 共享基础设施

`src/core/sync/` 提供跨站同步与 VLT 清单同步共用的并发控制原语：

- `withExclusiveLock` — Web Locks 统一包装（降级直接执行）
- `KeyedQueue` — 键控串行队列（同 key 串行，异 key 并发，自清理防泄漏）
- `sync-intent-journal` — 意图日志（崩溃恢复）

## 🔒 隐私说明

- **本地存储**：所有数据（收藏/黑名单/演员/设置/清单）存储在浏览器 IndexedDB（`JAV-JHS/appData`），不上传任何服务器
- **跨站同步**：JavDB → MissAV 状态同步通过 Tampermonkey GM 存储（`GM_setValue`/`GM_addValueChangeListener`）跨域传递，**零网络请求**
- **WebDav 备份**：仅当你主动配置 WebDav 地址时才启用；支持 AES-GCM 加密，建议使用应用专用密码
- **远程 API**：评论/相关清单/Top250 数据来自 JavDB 官方 API，请求带签名鉴权
- **无埋点**：脚本不含任何 analytics / tracking / telemetry

## 📝 开发

### 目录结构

```
src/
├── main.tsx              # 入口：17 步启动序列 + 注册 40 插件
├── core/                 # 核心模块（29 个 + sync/ 子目录）
│   └── sync/             # 跨站同步共享基础设施（Web Lock / 队列 / 意图日志）
├── plugins/              # 插件模块（40 个，含 car-status-sync/ 和 video-lists-tag/ 子目录）
├── components/           # React 函数组件（135 个，25 个子目录）
├── constants/            # 常量
├── resources/            # 资源（icons SVG）
├── styles/               # CSS 文件（37 个，含 design-tokens 设计令牌）
└── types/                # 类型声明
```

### 测试

```bash
bun run test             # vitest run（4 个测试套件，58 个用例）
```

### 文档

详细开发文档见 [`doc/`](./doc/) 目录（196 份），按编号递增，每份文档记录一次技术变更。
已执行文档永不可改（migration 原则）。

## 📝 更新日志

详见 [`changelog/CHANGELOG.md`](./changelog/CHANGELOG.md)。

## 📄 License & Attribution

本项目基于 **MIT 协议** 发布，详见 [`LICENSE`](./LICENSE)。

### 衍生关系声明

本项目（JavDB Power Tools）是基于 GreasyFork 脚本 [**JAV-JHS**](https://greasyfork.org/zh-CN/scripts/558525-jav-jhs)（脚本 ID: 558525）**3.3.6 版本**的二次开发。

- 原始脚本由 **zerobiubiu** 以 MIT 协议发布
- 3.3.6 之后的后续版本转为私密付费，不再公开
- 本项目基于 MIT 协议下发布的 3.3.6 版本进行拆分重构与功能扩展，行使 MIT 协议授予的修改与再发布权利
- MIT 协议为永久授权，不因后续版本改协议而失效

### 集成脚本致谢

本项目集成了以下独立油猴脚本（均来自 zerobiubiu，原始 MIT 协议）：

| 脚本 | 功能 |
|------|------|
| `jhsRatingDisplay.user.js` | 评分显示 |
| `keyPageTurning.user.js` | 快捷键翻页 |
| `modMyListOpenWay.user.js` | 清单链接改写 |
| `pageSort.user.js` | 列表页排序 |
| `statusTagFilter.user.js` | 状态标签筛选 |
| `listWaterfall.user.js` | 清单瀑布流 |
| `listReadingStatus.user.js` | 清单阅读进度 |
| `modalListDisabler.user.js` | 模态框禁用 |
| `videoListsTag.user.js` | 清单标签 |
| `listsOptionSync.user.js` | 清单选项同步 |
| `jhsCarListReader.user.js` | 状态同步器 |
| `missavStatusTag.user.js` | MissAV 状态标签 |
| `MissAV Quick Copy & Javdb Search.user.js` | MissAV 快速复制 |

原始脚本存档于 [`archetype/`](./archetype/) 目录。

## 👤 Author

zerobiubiu
