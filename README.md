# JavDB Power Tools

> JavDB / MissAV 双站增强用户脚本 —— 收藏管理、屏蔽过滤、跨站同步、榜单、云备份一站式工具箱。
>
> 基于 Vite + React + TypeScript 工程化构建，由原单文件混淆脚本 `jhs.user.js`（11000+ 行）
> 拆分重构而来，并集成了多个独立油猴脚本，功能逻辑与原脚本零偏差。
>
> 🛠️ **功能使用说明与详细描述见 [`GREASYFORK.md`](./GREASYFORK.md)**（脚本页附加信息同源，含逐面板设置教程与 FAQ）。

## ✨ 功能总览

脚本在 **JavDB** 与 **MissAV** 两个站点运行，覆盖列表页、详情页、演员页、清单页等场景，
提供 **44 个功能插件**（JavDB 39 + MissAV 5）。

| 分类 | 核心能力 |
|------|----------|
| 📋 列表页 | 状态标签（已收藏/已观看/已屏蔽）、status-tag 筛选芯片、标题关键词过滤、演员屏蔽、三种排序、瀑布流自动翻页、封面高清、分类折叠、个人评分显示、外站预加载 |
| 📄 详情页 | 顶部按钮组（屏蔽/收藏/已观看/字幕搜索/评分/清单面板）、磁链过滤与多引擎聚合、DMM 预告片、第三方站点跳转、演员信息（维基百科）、收藏演员、评论/相关清单加载、标题翻译、截图墙、以图识图、FC2 支持 |
| 🏆 榜单 | 热播榜改写（日/周/月 + 评分）与 Top250 排行榜（分类/年份/字幕切换 + 登录） |
| 📚 清单管理 | 清单 checkbox 本地 IDB 同步（服务端权威对账）、清单瀑布流、阅读进度 + 星级、模态框禁用、RESTful 链接改写、编号清单序号合并与压实整理 |
| 🔄 跨站同步 | JavDB → MissAV 收藏/屏蔽/观看状态实时同步（零网络请求，GM 存储跨域传递）、增量 journal + 修订号门控 + 对账回滚 + 崩溃恢复、MissAV 状态标签、一键复制番号、诊断菜单 |
| 💾 数据管理 | WebDav 云备份（AES-GCM 加密 + 自动备份）、本地导入导出、鉴定记录、新作品检测、访问记录、缓存管理与插件诊断 |

完整功能列表与逐项说明见 [`GREASYFORK.md`](./GREASYFORK.md#功能详解)。

## 🚀 安装

### 前置要求

- 浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/) v5.x+
- 浏览器：Chrome / Edge / Firefox

### 方式一：直接安装（推荐）

1. 安装 Tampermonkey 浏览器扩展
2. 打开 GitHub 上最新的构建产物 [`dist/monkey-jhs-disassemble.user.js`](./dist/monkey-jhs-disassemble.user.js)，
   Tampermonkey 会自动弹出安装确认页 → 点击安装
3. 或在 Tampermonkey 中新建脚本，粘贴内容并保存

> 脚本头部含 `@updateURL` / `@downloadURL`，Tampermonkey 会自动检查更新。

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/zerobiubiu/monkey-jhs-disassemble.git
cd monkey-jhs-disassemble

# 安装依赖（需 Bun）
bun install

# 构建
bun run build    # = tsc -b && vite build

# 产物在 dist/monkey-jhs-disassemble.user.js（约 1.17 MB / gzip 约 300 KB）
```

## ⚙️ 配置

安装后在 JavDB 页面点击导航栏的设置按钮打开设置面板（9 个面板）：

- **💾 数据备份**：WebDav 地址/用户名/密码 + 备份/恢复 + 自动备份策略
- **⚙️ 基础配置**：状态标签位置、显示开关、瀑布流加载模式等
- **🚫 屏蔽配置**：标题关键词、评论关键词
- **🌐 外部网站**：MissAv / SupJav 等第三方站点域名与启用开关
- **🧹 清理缓存**：查看/清理/导出各缓存
- **📋 清单管理器**：序号合并、排序显示、编号整理、对账校准与数据管理
- **🎬 MissAV 同步**：立即同步 / 导入 / 导出
- **⚡ 预加载配置**：列表页预加载策略与并发数
- **📊 插件诊断**：所有插件注册/CSS/handle 执行状态与耗时

每个面板的使用说明见 [`GREASYFORK.md`](./GREASYFORK.md#设置面板使用说明)。

## 🌐 支持站点

| 站点 | 域名 | 插件数 |
|------|------|--------|
| JavDB | `javdb.com` | 39 个 |
| MissAV | `missav.ws` / `missav.live` / `missav.ai` | 5 个（状态标签/快速复制/瀑布流/状态筛选/视频预览） |

## 🔧 技术架构

- **构建工具**：Vite 8 + vite-plugin-monkey 8
- **语言**：TypeScript 6（strict 模式，全量去 `@ts-nocheck`）
- **UI 框架**：React 19（jsxToString 渲染 HTML 字符串，不依赖 react-dom）
- **CSS 处理**：lightningcss（errorRecovery 容错 IE hack）
- **包管理**：Bun
- **代码质量**：ESLint（0 errors / 0 warnings）+ Stylelint（0 errors）+ Vitest（13 个测试文件 / 183 用例）
- **第三方库**：jQuery / Tabulator / layer.js / Toastify / localforage / Viewer.js / blueimp-md5 —— 7 库 CDN `@require` 外部引入（`externalGlobals` 自动生成，URL 与原始脚本一致），库 CSS 仍打包

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

`src/core/sync/` 提供跨站同步与清单同步共用的并发控制原语：

- `withExclusiveLock` — Web Locks 统一包装（降级直接执行）
- `KeyedQueue` — 键控串行队列（同 key 串行，异 key 并发，自清理防泄漏）
- `sync-intent-journal` — 意图日志（崩溃恢复）

## 📝 开发

### 目录结构

```
src/
├── main.tsx              # 入口：启动序列 + 注册 44 插件
├── core/                 # 核心模块（22 个 + util/ 工具集 + sync/ 子目录）
│   ├── util/             # 核心工具（broadcast/back-to-top/esc-layer/util-fetch-html 等）
│   └── sync/             # 跨站同步共享基础设施（Web Lock / 队列 / 意图日志）
├── plugins/              # 插件模块（44 个，含 car-status-sync/ 和 video-lists-tag/ 子目录）
├── components/           # React 函数组件（139 个，26 个子目录）
├── constants/            # 常量
├── resources/            # 资源（icons SVG）
├── styles/               # CSS 文件（41 个，含 design-tokens 设计令牌）
└── types/                # 类型声明
```

插件与核心模块完整清单见 [`docs/plugin-catalog.md`](./docs/plugin-catalog.md)。

### 测试

```bash
bun run test             # vitest run（13 个测试文件，183 个用例）
```

### 文档

开发文档见 [`docs/`](./docs/)（文档中心），索引、规范与要求见 [`docs/README.md`](./docs/README.md)。
历史文档已按时间线合并为 11 份阶段文档；已执行文档不可回改（migration 原则）。

## 📝 更新日志

详见 [`CHANGELOG.md`](./CHANGELOG.md)。

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

zerobiubiu（[GitHub](https://github.com/zerobiubiu)）