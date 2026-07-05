# 36 - PageSort 内容排序插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/pageSort.user.js`（190 行）是独立油猴脚本 `Javdb 内容排序` v1.0，
功能：对 Javdb 的单页内容排序（按名称升序/降序、按评分升序/降序）。在工具栏注入
排序按钮组，点击切换排序方式；再次点击已选中项恢复原始顺序。排序守卫
（MutationObserver）监听 DOM 顺序是否被外部修改，自动重新应用排序（重试上限 5 次）。
与本项目 `jhs.user.js`（鉴黄师）是同一作者 zerobiubiu 的独立脚本，完全独立，
不读 IDB、不监听事件、不发网络请求，纯 DOM + jQuery 操作。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 26 插件并列。要求：
- 转换为 TS 为主的语言（本脚本无 HTML 模板，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析（集成前调研）

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only | 原脚本 `@include https://javdb*.com/*`；main.tsx `if (isJavdbSite)` 块注册 |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 jQuery 事件委托 + MutationObserver |
| GM_* API | 无 | 纯 DOM + jQuery 操作，无需补 grant |
| CSS | ✅ 改走 initCss | 原脚本 `injectSortStyles()` 用 `document.createElement('style')` 注入；改走 `initCss()` 返回 CSS 字符串，提取到 `src/styles/page-sort-plugin.css` |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| jQuery | ✅ 复用全局 $ | 原脚本 `@require jquery@4.0.0`；本项目已 ESM import jquery 3.7.1 并挂全局（libs.ts）；API 兼容（`$('<div>', {css/class/text})`/`.find()`/`.children()`/`.append()`/`.on()`/`.each()` 均为稳定 API），无需 @require |
| 运行时机 | ✅ 无影响 | 原脚本 `@run-at document-end` + `waitForContainer()`；本项目 `@run-at document-idle` + `processPlugins()` 在页面加载后执行，且保留 `waitForContainer()` 等待容器就绪 |

## 2. 方案

### 2.1 目录结构
190 行单一职责（排序），不拆子目录。有 CSS，拆出 CSS 文件：

```
src/plugins/page-sort-plugin.ts       # 内容排序插件（extends BasePlugin）
src/styles/page-sort-plugin.css       # 排序按钮选中态样式
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 + CSS | 190 行单一职责，无需子目录拆分 |
| jQuery 来源 | 复用全局 $ | 本项目已 ESM import jquery 3.7.1 并挂全局；原脚本 4.0.0 API 兼容；无需 @require |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 原脚本 `injectSortStyles()` 用 `document.createElement('style')`；改走项目既定 initCss 模式 |
| 闭包状态 → 类字段 | `activeSort`/`isApplyingSort`/`sortGuardRetries`/`sortGuard`/`$container` 转为类私有字段 | 原脚本用 IIFE 闭包承载局部状态；类化后状态需跨方法共享 |
| jQuery `function(e) { $(this) }` | 箭头函数 + `e.currentTarget` | 原脚本事件回调用 `function` + `this`（DOM 元素）；类化后需访问类实例 `this`，改用箭头函数保留 `this` 为类实例，`e.currentTarget` 获取 DOM 元素（jQuery 事件委托中 `this` 与 `e.currentTarget` 都指向匹配委托选择器的元素，DOM 等价） |
| `$items.each(function(i) { this.setAttribute })` | `function(this: HTMLElement, i)` | 原脚本用 `this`（DOM 元素）setAttribute；TS 需显式 `this: HTMLElement` 类型标注；`i` 显式 `String(i)` 转字符串（原脚本隐式转换） |
| `parseInt(...)` 空值 | `parseInt(... \|\| '0') \|\| 0` | 原脚本 `parseInt(a.getAttribute(...))` 可能传 null（NaN）；TS 中 `getAttribute` 返回 `string \| null`，加 `|| '0'` 兜底，`|| 0` 兜底 NaN（语义等价，原脚本 NaN 时 `ai-bi` 为 NaN，sort 行为不确定，此处兜底为 0 更稳健） |
| `SORT_CONFIGS` | 模块级常量 | 原脚本在 `createSortSelector` 内定义；提到模块级避免每次调用重建，且 `sortFn` 仅引用全局 `$`/`compareItems`/`getScore`，无闭包依赖 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-11 | vite.config.ts（已含 javdb 站点匹配 + jquery ESM，无需改） |
| `injectSortStyles()` | L15-24 | 移除（改走 initCss）；CSS 提取到 `src/styles/page-sort-plugin.css` |
| `compareItems()` | L28-35 | 模块级函数 `compareItems` |
| `getScore()` | L40-47 | 模块级函数 `getScore` |
| `newOption()` | L49-53 | 模块级函数 `newOption` |
| `createSortSelector()` | L57-176 | `PageSortPlugin.createSortSelector()` + 模块级 `SORT_CONFIGS` |
| `SORT_CONFIGS` | L78-99 | 模块级常量 `SORT_CONFIGS` |
| `activeSort`/`isApplyingSort`/`sortGuardRetries`/`MAX_GUARD_RETRIES` | L68-72 | 类私有字段 |
| `applySort()` | L97-135 | `PageSortPlugin.applySort()` |
| `sortGuard` (MutationObserver) | L138-149 | 类字段 `sortGuard` + `createSortSelector` 内创建 |
| 按钮组构建 | L152-170 | `createSortSelector` 内 |
| 事件委托 | L172-176 | `createSortSelector` 内（箭头函数 + e.currentTarget） |
| `waitForContainer()` | L179-190 | `PageSortPlugin.waitForContainer()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/page-sort-plugin.ts` | ~240 | PageSortPlugin 类（extends BasePlugin，handle 等待容器 + createSortSelector + applySort + 排序守卫） |
| `src/styles/page-sort-plugin.css` | ~10 | `.button.is-small.selected-method` 选中态样式 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import PageSortPlugin；`if (isJavdbSite)` 块 `manager.register(PageSortPlugin)`；注释 26→27 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 26→27） |

### 3.3 控制流保留要点

1. **SORT_CONFIGS 单一数据源**：按钮文本 + 排序函数，新增排序方式只需追加一条，按钮创建与排序逻辑自动同步
2. **data-sort-original-index 标记**：注入时给每个 item 打上原始位置索引，恢复原始顺序时按此排序
3. **applySort 重入守卫**：`isApplyingSort` 防止排序守卫自己触发自己；进入即置 true，退出置 false
4. **重新查询 DOM**：`applySort` 内 `$container.children('.item').get()` 重新查询当前节点（防止节点被替换后引用失效）
5. **takeRecords 清空 mutation**：`sortGuard.takeRecords()` 清空 append 产生的 mutation 记录，防止微任务触发守卫误判
6. **MutationObserver 排序守卫**：监听 `childList`，外部修改顺序时自动重新应用 `activeSort`（重试上限 5 次，防止死循环）
7. **再次点击已选中项恢复原始**：点击已选中按钮时移除选中态、`activeSort=null`、`applySort(null)` 恢复原始顺序
8. **waitForContainer 等待容器**：MutationObserver 监听 body 子树，`body > section > div` 出现后触发 `createSortSelector`

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
dist/monkey-jhs-disassemble.user.js  1,714.58 kB │ gzip: 409.04 kB
✓ built in 998ms
```
构建成功。产物 1714.58 kB（gzip 409.04 kB），较 doc/35 基线 1708.03 kB
（gzip 407.08 kB）+6.55 kB（gzip +1.96 kB），为 page-sort 插件 + CSS 的合理增量。

警告仍为 layer.css IE hack（`*display`/`*zoom`/`*position`/`_display`，doc/24 已记录，
lightningcss errorRecovery 容错 strip，无害）。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API，userscript 头部 grant 无变化。原脚本 `@require jquery` 不再
需要（本项目已 ESM import jquery 3.7.1 并挂全局）。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 列表页工具栏出现 4 个排序按钮（名称升/降序、评分升/降序）
  - 点击"按照名称升序"，按钮选中态（绿色背景），列表按番号 localeCompare 排序
  - 再次点击已选中按钮，取消选中，恢复原始顺序
  - 切换其他排序方式，选中态正确转移
  - 排序守卫：外部修改 DOM 顺序后自动重新应用（控制台日志 `检测到 DOM 顺序被外部修改`）
  - 非列表页（如详情页）不注入排序按钮（工具栏/列表容器不存在，跳过）
- **jQuery 版本差异**：原脚本 4.0.0，本项目 3.7.1。使用的 API（`$('<div>', {css/class/text})`/
  `.find()`/`.children()`/`.append()`/`.on()`/`.each()`/`.siblings()`/`.hasClass()`/
  `.addClass()`/`.removeClass()`/`.text()`)均为稳定 API，3.7.1 完全支持
- **选择器维护**：若 javdb 页面结构变更，修改 `body > section > div > div.toolbar` 与
  `body > section > div > div.movie-list.h.cols-4.vcols-8` 选择器
