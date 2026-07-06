# 40 - ListReadingStatus 清单阅读进度插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/listReadingStatus.user.js`（1391 行）是独立油猴脚本 `JavDB 清单阅读进度` v1.5，
功能：为我的清单页面和清单详情页添加阅读进度下拉框和星级评分（1-5星），数据双向实时
同步，寄生 jhs IndexedDB 实现跨浏览器备份恢复；清单列表页提供排序与筛选工具栏
（10 种排序 + 阅读状态筛选 + 评分筛选）。与本项目 `jhs.user.js`（鉴黄师）是同一作者
zerobiubiu 的独立脚本。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 29 插件并列。要求：
- 转换为 TS 为主的语言（本脚本用 `document.createElement` 创建 DOM，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only，`/users/favorite_lists*` + `/users/lists*` + `/lists/*` | 原脚本 3 条 `@include`；`handle()` 内加路径守卫 |
| GM_* 依赖 | GM_setValue/getValue(已含) / GM_addValueChangeListener(已含) / GM_addStyle(改走 initCss) | 无需补 grant |
| 数据源 | GM_setValue/getValue（6 个键）+ 寄生 jhs IndexedDB（`JAV-JHS/appData/listReadingStatus_data`） | 与 storageManager 同库不同键，保留原生 indexedDB API（与 doc/25 rating-cache 模式一致） |
| 事件源 | GM_addValueChangeListener（跨标签页同步 5 个键） | 已在 grant |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| 主项目冲突 | ✅ 天然兼容 | 见 §1.4 |

### 1.4 主项目冲突排查

原脚本操作 `#lists > ul > li`（清单列表项），grep `data-lrs-hidden`/`listReadingStatus_data`
等到 `src/` 确认主项目无任何插件使用这些标识。原脚本已有协同安全设计。

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| DOM 容器共享（ListWaterfall） | 两者都操作 `#lists > ul > li`；ListWaterfall append 新 li，listReadingStatus 注入组件 + 排序 | **不冲突**：ListWaterfall append 新 li 触发 listReadingStatus 的 MutationObserver → `processAllItems` 为新 li 注入组件。原脚本注释已考虑"listWaterfall 追加" |
| DOM 容器共享（ModMyListOpenWay） | 两者都操作 `#lists > ul > li`；ModMyListOpenWay 修改链接，listReadingStatus 注入组件 | **不冲突**：ModMyListOpenWay 只改链接 href/target，listReadingStatus 在 li 内 div 注入下拉框/星级，操作不同子元素 |
| li 显隐协同 | listReadingStatus 用 `data-lrs-hidden`；statusTagFilter 用 `data-status-tag-hidden`；jhs 用 `data-hide` | **三套属性互不干扰**：原脚本已有 `hiddenByOther` 检查，跳过其他脚本隐藏的卡片 |
| MutationObserver | listReadingStatus 监听 body subtree；ListWaterfall append li 触发 | **正确行为**：新 li 加入后注入组件 + 刷新排序。`isProcessing` 防重入 + `lastLiCount` 仅数量变化时刷新芯片 |
| IndexedDB 寄生 | `JAV-JHS/appData/listReadingStatus_data` 与 storageManager 同库不同键 | **不冲突**：与 doc/25 rating-cache 模式一致，保留原生 indexedDB API |

**结论：天然兼容，无需复杂协调**。

## 2. 方案

### 2.1 目录结构
1391 行但功能高度内聚（数据层 + UI 层 + 排序筛选层 + 入口共享闭包状态），单文件 + CSS
更合适（拆子目录会导致大量状态在模块间传递）：

```
src/plugins/list-reading-status-plugin.ts       # 清单阅读进度插件（extends BasePlugin）
src/styles/list-reading-status-plugin.css       # 下拉框 + 星级 + 工具栏样式（3 段 GM_addStyle 合并）
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 + CSS | 1391 行但功能高度内聚，IIFE 闭包状态（isProcessing/currentSort/filterReadStatus 等）转为类字段，拆模块会导致大量状态传递 |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 原脚本 3 段 GM_addStyle 合并到 1 个 .css |
| 路径守卫 | `handle()` 内检查 `/users/favorite_lists` + `/users/lists` + `/lists/{id}` | 原脚本 3 条 `@include` |
| IndexedDB | 保留原生 `indexedDB` API | 寄生 `JAV-JHS/appData/listReadingStatus_data`，storageManager.forage 为 private 无法访问（与 doc/25 一致） |
| 数据层函数 | 模块级函数（不依赖实例状态） | getRatingMap/saveRatingMap/setRating/getRating/getReadSet/saveReadSet/markAsRead/markAsUnread/isRead/getLastUriMap/saveLastUri/getLastUri + openJhsDB/syncToIndexedDB/restoreFromIndexedDB |
| UI/排序筛选层 | 类方法（访问类字段 isProcessing/currentSort 等） | ensureWidgets/ensureHeaderWidgets/processAllItems/createDropdown/createStarWidget + applySort/applyFilter/applySortAndFilter/buildToolbar/refreshChips |
| 闭包状态 → 类字段 | isProcessing/currentSort/filterReadStatus/filterRatingChips/isToolbarProcessing/orderCounter/lastLiCount/observer/isDetailPage | 原脚本 IIFE 闭包变量 |
| `toolbar._readHost` 等 | 保留挂在 DOM 元素上（`(toolbar as any)._readHost`） | 原脚本设计；`refreshChips` 通过 `as any` 访问 |
| `event.target` | `IDBVersionChangeEvent` 的 target 断言为 `IDBOpenDBRequest` | TS 中 `event.target` 为 `EventTarget \| null`，需断言 |
| `Object.entries` 迭代 | `uri as { path: string; timestamp: number }` 类型断言 | TS 中 `Object.entries` 返回 `[string, any][]`，需断言 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| 常量（LOG/KEY/DB/ATTR/STAR_PATH） | L23-531 | 模块级常量 |
| 数据层（getRatingMap ~ isRead） | L34-502 | 模块级函数 |
| IndexedDB 备份（openJhsDB/syncToIndexedDB/restoreFromIndexedDB） | L129-259 | 模块级函数 |
| 3 段 GM_addStyle CSS | L263-445 | `src/styles/list-reading-status-plugin.css` |
| UI 层（updateSelectAppearance ~ processAllItems） | L510-753 | 类方法 |
| 排序筛选层（loadToolbarState ~ restoreToolbarUI） | L779-1283 | 类方法 |
| 入口（isDetailPage/loadToolbarState/注入/恢复/observer/同步） | L1284-1390 | `handle()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/list-reading-status-plugin.ts` | ~770 | ListReadingStatusPlugin 类（数据层模块级函数 + UI/排序筛选类方法 + handle 入口） |
| `src/styles/list-reading-status-plugin.css` | ~170 | `.list-reading-dropdown` + `.list-rating-star` + `.list-toolbar` + `.list-filter-chip` 样式 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import ListReadingStatusPlugin；`if (isJavdbSite)` 块 `manager.register(ListReadingStatusPlugin)`；注释 29→30 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 29→30） |

### 3.3 控制流保留要点

1. **数据层**：GM_getValue/setValue 持久化 6 个键（阅读状态/评分/访问记录/排序/筛选阅读/筛选评分）
2. **IndexedDB 备份**：syncToIndexedDB 写入 `listReadingStatus_data`；restoreFromIndexedDB 逐字段合并恢复（readingStatus 并集 + ratings 云端补缺 + lastUris 按 timestamp 取大）
3. **ensureWidgets**：为 li 注入下拉框（已读完/未读完）+ 星级评分（1-5 SVG 五角星）+ 访问链接
4. **ensureHeaderWidgets**：详情页 h2 标题注入下拉框 + 星级；saveLastUri 记录访问
5. **10 种排序**：默认/评分↓↑/影片数↓↑/点击数↓↑/最近访问↓↑/标题A-Z；`data-lrs-order` 稳定 tiebreaker
6. **applySort 优化**：仅顺序实际变化时才重排（sortedIds vs currentIds 比较），避免无变化 appendChild 触发循环
7. **applyFilter 协同安全**：`data-lrs-hidden` 标记 + `hiddenByOther` 跳过其他脚本隐藏的卡片
8. **MutationObserver**：`isProcessing` 防重入 + `Promise.resolve().then()` 延迟复位 + `lastLiCount` 仅数量变化时刷新芯片
9. **GM_addValueChangeListener**：跨标签页同步 5 个键，恢复 UI + 重新排序筛选

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```
全量类型检查通过，无错误无警告。

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,765.48 kB │ gzip: 420.83 kB
✓ built in 1.03s
```
构建成功。产物 1765.48 kB（gzip 420.83 kB），较 doc/39 基线 1734.67 kB
（gzip 414.29 kB）+30.81 kB（gzip +6.54 kB），为大型插件（~770 行 TS + 170 行 CSS）的合理增量。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API（GM_setValue/getValue/GM_addValueChangeListener 已在 grant），
userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 清单列表页（`/users/lists`）：每个 li 出现下拉框（已读完/未读完）+ 星级评分
  - 清单详情页（`/lists/{id}`）：h2 标题出现下拉框 + 星级评分 + "继续浏览→"链接
  - 下拉框切换已读完/未读完，跨标签页实时同步
  - 星级评分点击切换，再次点击取消
  - 工具栏：10 种排序 + 阅读状态筛选（已读完/未读完）+ 评分筛选（有评分/无评分/1-5星）
  - 重置筛选按钮
  - IndexedDB 备份恢复：换浏览器后从 jhs 备份恢复评分和阅读进度
  - ListWaterfall append 新 li 后自动注入组件（MutationObserver 触发）
  - ModMyListOpenWay 修改的链接不被本插件覆盖（操作不同子元素）
