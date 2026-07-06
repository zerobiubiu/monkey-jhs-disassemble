# 38 - StatusTagFilter 状态标签筛选插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/statusTagFilter.user.js`（280 行）是独立油猴脚本 `JavDB 状态标签筛选` v1.0，
功能：根据页面上 `status-tag` 文本内容动态生成筛选芯片，过滤显示视频卡片。收集
`.tag.is-success.status-tag` 文本及计数，生成芯片（含"无状态标签"芯片），点击芯片
按 OR 逻辑筛选（命中任一选中标签即显示）；再次点击取消。与本项目 `jhs.user.js`
（鉴黄师）是同一作者 zerobiubiu 的独立脚本。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 27 插件并列。要求：
- 转换为 TS 为主的语言（本脚本用 `document.createElement` 创建 DOM，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only，仅列表页 | 原脚本 `@include https://javdb*.com/*`；本项目 `if (isJavdbSite)` 块注册，`handle()` 内加 `if (!isListPage) return` 守卫（详情页无 .item） |
| GM_* 依赖 | ✅ 仅 GM_addStyle | 原脚本只用 `GM_addStyle` 注入 CSS；改走 `initCss()` 返回 CSS 字符串（项目既定模式），不引入 GM_addStyle grant |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 click 事件 + MutationObserver |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| 主项目冲突 | ✅ 天然兼容 | 见 §1.4 |

### 1.4 主项目冲突排查

原脚本操作 `.item` 显隐 + 查找 `.tag.is-success.status-tag` + MutationObserver 监听
`document.body`，与 jhs 主项目 `ListPagePlugin.filterMovieList` 高度重叠。但原脚本
已有"协同安全"设计，经排查**天然兼容，无需复杂协调**：

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| status-tag 选择器匹配 | jhs 注入的 status-tag class 为 `tag is-success status-tag`（StatusTagHtml 组件）；本脚本查找 `.tag.is-success.status-tag` | **完全匹配**，本脚本能正确读取 jhs 注入的标签文本。无需协调 |
| `.item` 显隐双重管理 | jhs 用 `$item.hide().attr('data-hide', YES)`（jQuery hide 设 display:none + data-hide 属性）；本脚本用 `item.style.display` + `data-status-tag-hidden` 属性 | **原脚本已有协同安全设计**：`hiddenByOther = display==='none' && !hasAttribute(HIDDEN_ATTR)` → jhs 隐藏的卡片（有 data-hide 无 data-status-tag-hidden）被识别为"被其他脚本隐藏"并跳过。**天然兼容** |
| MutationObserver 互相触发 | jhs `checkDom` 监听 `.movie-list` childList → `filterMovieList`（hide/show 改 display）；本脚本监听 `body` subtree → `updateFilterBar` → `applyFilter`（改 display） | jhs hide/show 触发本脚本 observer → `applyFilter`，但协同安全设计跳过 jhs 隐藏的卡片，不恢复它们；本脚本 `applyFilter` 不改 jhs 隐藏的卡片 display，不触发 jhs observer。**单向触发，不会死循环** |
| autoPage 瀑布流 | `AutoPagePlugin` append 新页 → 触发本脚本 observer → `updateFilterBar` | **正确行为**：新页加入后应刷新芯片计数 + 重新应用筛选。原脚本 MutationObserver 设计即为响应 jhs 异步添加 .item |
| isListPage 守卫 | 原脚本 `@include javdb*.com/*` 所有页面 | `handle()` 内加 `if (!isListPage) return`，非列表页不注入（详情页无 .item） |

## 2. 方案

### 2.1 目录结构
280 行单一职责（状态标签筛选），不拆子目录。有 CSS，拆出 CSS 文件：

```
src/plugins/status-tag-filter-plugin.ts       # 状态标签筛选插件（extends BasePlugin）
src/styles/status-tag-filter-plugin.css       # 筛选栏 + 芯片样式
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 + CSS | 280 行单一职责，无需子目录拆分 |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 原脚本 `GM_addStyle`；改走项目既定 initCss 模式，不引入 GM_addStyle grant |
| isListPage 守卫 | `handle()` 内 `if (!isListPage) return` | 原脚本 `@include javdb*.com/*` 所有页面；本项目所有插件注册在 `if (isJavdbSite)` 块不区分页面，需代码内守卫（详情页无 .item） |
| status-tag 选择器 | 提为模块级常量 `STATUS_TAG_SELECTOR` | 原脚本内联 `.item .tags.has-addons .tag.is-success.status-tag` 多处重复；提取常量避免不一致 |
| HIDDEN_ATTR | 提为模块级常量 `data-status-tag-hidden` | 与 jhs 的 `data-hide` 区分，协同安全设计的关键 |
| 闭包状态 → 类字段 | `observerDebounce`/`observer` 转为类私有字段 | 原脚本 IIFE 闭包变量；类化后需跨方法共享 |
| `filterBar._refreshChips` | 保留挂在 DOM 元素上 | 原脚本设计；`updateFilterBar` 通过 `querySelector` + `as any` 访问，与原脚本一致 |
| `node.matches?.()` | 保留可选链 | 原脚本用 `node.matches?.()` 防御非 Element 节点；TS 中 `Node` 无 `matches` 方法，可选链 + `?.` 防御 |
| `textContent?.trim()` | 加可选链 | 原脚本 `el.textContent.trim()` 假定非 null；TS 中 `textContent` 为 `string \| null`，加 `?.` 兜底 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-10 | vite.config.ts（已含 javdb 站点匹配，无需改） |
| `GM_addStyle(...)` CSS | L12-55 | `src/styles/status-tag-filter-plugin.css`（?raw import via initCss） |
| `collectStatusTagCounts()` | L40-52 | 模块级函数 `collectStatusTagCounts` |
| `countNoStatusItems()` | L57-66 | 模块级函数 `countNoStatusItems` |
| `HIDDEN_ATTR` 常量 | L70 | 模块级常量 |
| `applyFilter()` | L75-120 | `StatusTagFilterPlugin.applyFilter()` |
| `createFilterChip()` | L130-145 | `StatusTagFilterPlugin.createFilterChip()` |
| `doBuild()` | L150-195 | `StatusTagFilterPlugin.doBuild()` |
| `findMountTarget()` | L197-220 | `StatusTagFilterPlugin.findMountTarget()` |
| `tryBuild()` | L225-232 | `StatusTagFilterPlugin.tryBuild()` |
| `updateFilterBar()` | L234-240 | `StatusTagFilterPlugin.updateFilterBar()` |
| MutationObserver | L243-261 | `StatusTagFilterPlugin.startObserving()` + 类字段 `observerDebounce`/`observer` |
| `init()` | L250-280 | `StatusTagFilterPlugin.init()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/status-tag-filter-plugin.ts` | ~330 | StatusTagFilterPlugin 类（extends BasePlugin，handle 初始化 + tryBuild + doBuild + applyFilter + startObserving） |
| `src/styles/status-tag-filter-plugin.css` | ~60 | `.status-tag-filter-bar` / `.status-tag-filter-chip` / `.active` / `.no-status` 样式 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import StatusTagFilterPlugin；`if (isJavdbSite)` 块 `manager.register(StatusTagFilterPlugin)`；注释 27→28 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 27→28） |

### 3.3 控制流保留要点

1. **collectStatusTagCounts**：遍历 `.tag.is-success.status-tag`，收集文本→计数映射
2. **countNoStatusItems**：遍历 `.item`，统计无 status-tag 的卡片数
3. **applyFilter 协同安全**：`hiddenByOther = display==='none' && !hasAttribute(HIDDEN_ATTR)`，被其他脚本（jhs）隐藏的卡片不纳入管理
4. **applyFilter OR 逻辑**：命中任一选定标签即显示；"无状态标签"芯片独立判断，与标签匹配 OR 连接
5. **createFilterChip**：芯片文本=标签名+计数；点击 toggle active + applyFilter
6. **doBuild refreshChips**：重建芯片时保留已激活状态（activeValues 集合）
7. **findMountTarget 优先级**：`.tag-filter-bar` → 演员页 `.actor-tags.tags` / 普通 `.tabs.is-boxed` → `section > div` 第一个子元素 → `body > section > div` 第一个子元素
8. **MutationObserver 防抖**：监听 body subtree，新增 .item/status-tag 时 150ms 防抖后 updateFilterBar
9. **init 超时兜底**：10s 超时后用最终回退位置强行挂载

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
dist/monkey-jhs-disassemble.user.js  1,724.81 kB │ gzip: 411.36 kB
✓ built in 1.02s
```
构建成功。产物 1724.81 kB（gzip 411.36 kB），较 doc/37 基线 1715.10 kB
（gzip 409.15 kB）+9.71 kB（gzip +2.21 kB），为 status-tag-filter 插件 + CSS 的合理增量。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API（原脚本 GM_addStyle 改走 initCss），userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 列表页出现筛选栏（"状态:" 标签 + 芯片组）
  - 芯片显示 jhs 注入的 status-tag 文本 + 计数（如"⭐ 已收藏 12"）
  - 点击芯片筛选（OR 逻辑，命中任一选中标签即显示）
  - 再次点击已选中芯片取消筛选，恢复显示
  - "无状态标签"芯片筛选无 status-tag 的卡片
  - jhs 隐藏的卡片（data-hide）不被本脚本恢复（协同安全）
  - autoPage 瀑布流 append 新页后芯片计数刷新
  - 详情页不注入筛选栏（isListPage 守卫）
- **协同安全验证**：jhs `filterMovieList` 隐藏卡片后，本脚本的 `applyFilter` 不恢复它们；
  本脚本隐藏卡片后，jhs `filterMovieList` 的 `data-hide` 逻辑不受影响（本脚本用
  `data-status-tag-hidden` 属性，不设 `data-hide`）
