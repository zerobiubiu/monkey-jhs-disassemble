# 45 - VideoListsTag 视频清单标签插件集成（合并 + 本地化改造）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
合并两个独立油猴脚本：
- `archetype/listsOptionSync.user.js`（~600 行）— 详情页清单 checkbox 勾选/取消时同步到远程服务器
- `archetype/videoListsTag.user.js`（~1280 行）— 列表页从远程服务器查询番号所属清单，显示标签 + 筛选栏

### 1.2 根本性变更
原脚本通过远程服务器 API（`https://jls.zerobiubiu.top`）同步数据，此处改为**本地 IndexedDB**
（寄生 `JAV-JHS/appData`，随 jhs WebDav 备份）：

| 原 API | 本地替代 | 说明 |
|--------|----------|------|
| `POST /api/sync/movies_lists` | `VltDb.sync()` | 影片 upsert + 清单 upsert + 关联 add/remove |
| `POST /api/movies_lists` | `VltDb.queryMoviesLists()` | 批量查询番号所属清单 |
| PostgreSQL 触发器（count 维护） | 代码手动 ±1 | `sync()` 内 add 时 count+1，remove 时 count-1 |
| CHECK 约束 `count<=501` | 代码检查 | `sync()` 内 add 时检查 `count >= 501` → `limit_exceeded` |
| 清单 style 随机配色 | 代码从 `bootstrapColors` 选取 | `sync()` 内新建清单时 `randomBootstrapStyle()` |

### 1.3 数据迁移
从 PostgreSQL（Neon）导出全量数据为 JSON（`dist/vlt-migration-data.json`）：
- movies: 3588 条
- inventory: 12 条
- movie_inventory: 3548 条

用户通过 `GM_registerMenuCommand` 菜单"导入迁移数据"选择 JSON 文件导入到 IDB。

### 1.4 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only | `@include javdb*.com/*`；`if (isJavdbSite)` 块注册 |
| GM_* 依赖 | GM_setValue/getValue(已含) / GM_addValueChangeListener(已含) / GM_registerMenuCommand(已含) | 无需补 grant |
| 数据源 | 本地 IndexedDB（JAV-JHS/appData） | 寄生 jhs 同库，WebDav 备份一起备份 |
| 事件源 | 三重广播（GM_setValue/localStorage/CustomEvent） | 跨标签页 + 跨脚本同步 |
| 网络请求 | **无**（原 GM_xmlhttpRequest → 远程服务器，已移除） | 全部改为本地 IDB |
| 主项目冲突 | ✅ 天然兼容 | 见 §1.5 |

### 1.5 主项目冲突排查

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| `.item` 显隐 | 本插件用 `data-video-lists-tag-hidden`；statusTagFilter 用 `data-status-tag-hidden`；listReadingStatus 用 `data-lrs-hidden`；jhs 用 `data-hide` | **四套属性互不干扰**：原脚本已有 `hiddenByOther` 检查 |
| MutationObserver | 本插件监听 body subtree（新 .item 加入）；jhs `ListPagePlugin.checkDom` 监听 .movie-list childList | **不冲突**：本插件只处理新 .item 的标签注入，不影响 jhs 过滤 |
| AutoPagePlugin 瀑布流 | append 新页 → 触发本插件 observer → handleNewItems | **正确行为**：新 .item 加入后应注入标签 |
| IndexedDB 寄生 | `JAV-JHS/appData` 新增 4 个键（vlt_movies/vlt_inventory/vlt_movie_inventory/vlt_meta） | **不冲突**：与 storageManager 的 car_list 等键不同名 |

## 2. 方案

### 2.1 目录结构
子目录拆分（合并两个脚本 + IDB 数据层）：

```
src/plugins/video-lists-tag/
├── vlt-db.ts            # IndexedDB 数据层（VltDb.sync/queryMoviesLists/check/importData）
├── vlt-toast.ts         # Toast 通知（showToast，队列式）
├── vlt-tags.ts          # 标签显示 + 筛选栏（VltTags）
├── vlt-sync.ts          # checkbox 同步 + 三重广播（setupCheckboxListener/handleCheckboxChange）
└── vlt-plugin.tsx       # 插件入口（VideoListsTagPlugin）

src/styles/video-lists-tag.css  # 标签 + 筛选栏 + Toast 样式
dist/vlt-migration-data.json    # PostgreSQL 导出的迁移数据
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 数据存储 | 寄生 JAV-JHS/appData IndexedDB | 随 jhs WebDav 备份；与 doc/25 rating-cache 模式一致 |
| 数据结构 | 3 个 JSON 对象（movies/inventory/movieInventory）存储在 IDB 键值 | PostgreSQL 三表 → IDB 三键，查询用 JS 对象遍历 |
| count 维护 | 代码手动 ±1（add 时 +1，remove 时 -1） | PostgreSQL 用触发器，IDB 无触发器，在 sync() 内手动执行 |
| count 上限检查 | `count >= 501` → `limit_exceeded` | PostgreSQL CHECK 约束等价 |
| movie upsert | 存在则更新（不覆盖 createdAt），不存在则新建 | 与服务器 CTE `ON CONFLICT DO UPDATE` 一致 |
| list upsert | 存在不更新（`ON CONFLICT DO NOTHING`） | 与服务器 CTE 一致 |
| style 随机配色 | 新建清单时 `randomBootstrapStyle()` | 与服务器 `randomBootstrapStyle()` 一致 |
| 三重广播 | GM_setValue + localStorage + CustomEvent | 保留原设计，功能性无损 |
| 迁移导入 | GM_registerMenuCommand 菜单 + 文件选择器 | 方案 A：用户手动导入 JSON |
| Toast | 自建队列式（不依赖 jhs show） | 原脚本自建 toast，样式和队列行为不同 |

### 2.3 服务器 CTE → IDB 等价映射

服务器 `POST /api/sync/movies_lists` 的单条 CTE 语句（L164-256）→ `VltDb.sync()` 的 JS 实现：

| CTE 步骤 | SQL | IDB 等价 |
|----------|-----|----------|
| movie_pre | `SELECT 1 FROM movies WHERE designation = ?` | `!!movies[designation]` |
| movie_upsert | `INSERT ... ON CONFLICT DO UPDATE` | 存在则更新字段（不覆盖 createdAt），不存在则新建 |
| list_pre | `SELECT 1 FROM inventory WHERE list_id = ?` | `!!inventory[listId]` |
| list_upsert | `INSERT ... ON CONFLICT DO NOTHING` | 不存在则新建（含 randomStyle），存在则跳过 |
| assoc_add | `INSERT ... WHERE count < 501 AND NOT EXISTS` | `!mi[key] && count < 501` → 插入 + count+1 |
| assoc_del | `DELETE ... RETURNING` | `mi[key]` → delete + count-1 |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/video-lists-tag/vlt-db.ts` | ~290 | VltDb 类（sync/queryMoviesLists/check/importData/isImported/getAllInventory） |
| `src/plugins/video-lists-tag/vlt-toast.ts` | ~180 | showToast 队列式通知 |
| `src/plugins/video-lists-tag/vlt-tags.ts` | ~600 | VltTags 类（标签显示 + 筛选栏 + 自动刷新监听） |
| `src/plugins/video-lists-tag/vlt-sync.ts` | ~230 | getMovieInfo/getListInfo/syncMoviesLists/handleCheckboxChange/setupCheckboxListener |
| `src/plugins/video-lists-tag/vlt-plugin.tsx` | ~120 | VideoListsTagPlugin 类（插件入口 + 迁移菜单 + observer） |
| `src/styles/video-lists-tag.css` | ~280 | 标签 + 筛选栏 + 筛选模式 + Toast 样式 |
| `dist/vlt-migration-data.json` | ~1800 kB | PostgreSQL 导出的迁移数据（3588 影片 + 12 清单 + 3548 关联） |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import VideoListsTagPlugin；`if (isJavdbSite)` 块 `manager.register(VideoListsTagPlugin)`；注释 32→33 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新 |

### 3.3 控制流保留要点

1. **sync 等价 CTE**：movie upsert（created_at 保留）+ list upsert（DO NOTHING）+ association add/remove（count 检查 + ±1）
2. **三重广播**：GM_setValue + localStorage + CustomEvent 'jdb:sync-complete'
3. **标签显示**：从 IDB 查询 → tagsCache → addTagDisplay 渲染（有 url 用 `<a>`，无 url 用 `<span>`）
4. **4 种筛选模式**：包含任意/全都包含/不包含以下标签/不包含以下任意一个
5. **协同安全**：`data-video-lists-tag-hidden` 属性 + `hiddenByOther` 检查
6. **自动刷新**：GM_addValueChangeListener + localStorage storage + CustomEvent 三重监听
7. **MutationObserver**：监听新 .item 加入 → handleNewItems（防抖增量 fetchAndMergeTags）
8. **迁移导入**：GM_registerMenuCommand 菜单 → 文件选择器 → VltDb.importData → 刷新页面

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,816.07 kB │ gzip: 433.20 kB
✓ built in 1.04s
```
构建成功。产物 1816.07 kB（gzip 433.20 kB），较 doc/43 基线 1769.05 kB
（gzip 421.79 kB）+47.02 kB（gzip +11.41 kB），为合并两个脚本 + IDB + Toast + CSS 的增量。

### 4.3 userscript metadata 验证
未新增 GM_* API（GM_setValue/getValue/addValueChangeListener/registerMenuCommand 已含）。

## 5. 后续

### 5.1 数据迁移步骤
1. 确保 `dist/vlt-migration-data.json` 已生成（从 PostgreSQL 导出）
2. 在 Tampermonkey 加载构建产物
3. 访问 javdb 任意页面
4. Tampermonkey 菜单 → "导入迁移数据（PostgreSQL → IDB）"
5. 选择 `dist/vlt-migration-data.json`
6. 导入成功后页面自动刷新
7. 列表页应显示标签，详情页勾选清单 checkbox 应同步到 IDB

### 5.2 运行时验证
- 列表页：卡片下方显示清单标签（Bootstrap Badge Pill 风格）
- 筛选栏：4 种模式 + 标签芯片 + 无标签芯片 + 自动刷新开关
- 详情页：勾选/取消清单 checkbox → Toast 通知 → 三重广播 → 列表页自动刷新
- 跨标签页：A 标签页勾选 → B 标签页自动刷新标签
- count 上限：清单达 501 条时 → `limit_exceeded` Toast
- WebDav 备份：IDB 数据随 jhs 备份一起备份/恢复

### 5.3 远程服务器
已完全移除远程服务器依赖（`https://jls.zerobiubiu.top` 不再被调用）。
