# 05 阶段文档：加载全部、排序修复、列表页预加载与访问记录（doc/99–117）

> **文档类型**：📄 参考说明（时间线合并文档）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/99 ～ doc/117（20 份历史文档，v1.13.0 – v1.18.1）
> **合并说明**：将 20 份历史文档按时间线融合为一份精简文档，原文件随后删除。仅精简与融合原文内容，不新增事实；删去构建命令输出、逐条验证回放、边缘情况穷举推演与重复的产物大小记录等过程性细节；同一主题的多次迭代合并为单个条目并完整保留演进链；文中 "(doc/NN)" 为历史文档编号，用作事件标识，非文件路径。
> **前置文档**：doc/99 之前的历史阶段文档
> **替代文档**：doc/99–117 共 20 份（合并后原文件删除）

## 阶段概览

本阶段覆盖四条主线：其一，「加载全部」按钮随瀑布流落地（doc/99），随后实时显隐（doc/100）并与 loader 状态深度融合（doc/101）；其二，列表页排序组件丢失的连环修复，四步根因各不相同（doc/102 两篇、103、104、105）；其三，列表页预加载从完全透明的后台行为演进为「状态徽标 + 筛选栏 + 可配置面板」的完整闭环（doc/107→111）；其四，新增访问记录插件并逐步实时化、纳入备份（doc/112→116）。其间还修复了 SupJav 跳转地址不遵守设置的问题（doc/106），并在阶段末为预加载增加并发配置（doc/117）。

| 版本 | 主题 | 文档 |
|------|------|------|
| 1.13.0 | 「加载全部」按钮 + 清理死代码 | doc/99 |
| 1.13.1 | 按钮实时显隐 | doc/100 |
| 1.13.2 | 重复检测比例 + loader 深度融合 | doc/101 |
| 1.13.3 | /lists/ 排序恢复 ×2（两篇 102） | doc/102a / 102b |
| 1.13.4 | 移除 #sort-toggle-btn 隐藏 | doc/103 |
| 1.13.5 | 移除 PageSort autoPage 禁用 | doc/104 |
| 1.13.6 | 恢复演员页排序 | doc/105 |
| 1.13.7 | SupJav initUrl 遵守设置 | doc/106 |
| 1.14.0 | 预加载状态徽标 | doc/107 |
| 1.15.0 | 预加载筛选栏 + 深度跟踪 | doc/108 |
| 1.15.1 | 已缓存项补「成功匹配」徽标 | doc/109 |
| 1.16.0 | 「⚡ 预加载配置」设置面板 | doc/110 |
| 1.16.1 | 面板加强 + 缓存去重 + TTL | doc/111 |
| 1.17.0 | 访问记录插件 | doc/112 |
| 1.17.1 | 访问记录实时悬浮 | doc/113 |
| 1.17.2 | 访问记录 hover 重读真正实时 | doc/114 |
| 1.17.3 | 访问记录随备份 | doc/115 |
| 1.18.0 | 全量长期缓存随备份 | doc/116 |
| 1.18.1 | 预加载并发配置 | doc/117 |

---

## 1. 「加载全部」按钮（doc/99 → 100 → 101），v1.13.0–1.13.2

### 1.1 doc/99 初版：清理死代码 + 「加载全部」浮动按钮

**背景/根因**

- `AutoPagePlugin.shouldDisablePaging()` 中 `await storageManager.getSetting('autoPage', YES)` 读取了 setting 但完全未使用返回值（方法实际只检查「是否列表页」+「URL 是否命中特殊路径」），是原脚本遗留代码（逻辑移入 `loadNextPage` 后忘了删），属无效 IndexedDB 读取死代码。
- 瀑布流模式（autoPage=YES）需滚动到底部才触发下一页加载，用户需要一个点击即连续加载的「加载全部」按钮。

**方案与决策**

- 删除死代码行，方法签名保持 `async`（不影响调用方）。
- 新增浮动按钮：`position:fixed; right:20px; bottom:80px`；触发条件为 `waterfall()` 末尾 `hasMore && autoPage===YES`。点击 → `loadAllPages()` 循环 `await loadNextPage()` 直到无更多页。
- 按钮状态：加载中文案「加载中...（第 N 页）」+ 禁用态（`opacity:0.6; cursor:wait`）；完成「✓ 已全部加载」2 秒后淡出移除；失败「加载失败，点击重试」可点击重试。
- 防死循环：while 循环通过 `pageItems.length` 变化检测无进展（autoPage 被关 / `isLoading` 重入 / 出错时不追加新页 → length 不变 → break）。
- 防重入：`isLoadingAll` 标志；与 scroll 触发共存靠 `loadNextPage` 内部 `isLoading` 拦截并发请求。

**实施要点**：`src/plugins/auto-page-plugin.ts` 新增 `loadAllBtn`/`isLoadingAll` 字段与 `createLoadAllBtn()`/`loadAllPages()`/`updateLoadAllBtn()` 三方法；`src/styles/auto-page-plugin.css` 新增 `.jhs-load-all-btn` 样式（fixed 定位 + 渐变背景 + hover 上浮 + disabled 半透明 + fadeout）。

**结果**：version 1.12.9 → 1.13.0（新增功能，minor 递增）。

### 1.2 doc/100 实时显隐（设置面板切换即时生效）

**背景/根因**：按钮只在 `waterfall()` 页面加载时创建，用户通过设置面板切换「瀑布流模式」开关后需刷新才生效。根因是 `setting-plugin.tsx` 的 autoPage change 绑定只保存设置 + 显隐 `#sort-toggle-btn`，没有通知 AutoPagePlugin 创建/删除按钮。

**方案与决策**：AutoPagePlugin 新增公开方法 `showLoadAllBtn()` / `hideLoadAllBtn()`，setting-plugin 的 autoPage change 回调经 `getBean('AutoPagePlugin')` 实时调用：

- `showLoadAllBtn()`：已存在 / 无下一页 / 容器未初始化 → 不创建；幂等，重复调用安全。
- `hideLoadAllBtn()`：不存在 → 跳过；`loadAllPages` 进行中移除也安全（`loadNextPage` 因 autoPage=NO 返回 → `pageItems.length` 不变 → break → `updateLoadAllBtn` 对 null 跳过 → `finally` 重置 `isLoadingAll`）。

**实施要点**：`auto-page-plugin.ts`（新增两方法，`waterfall()` 末尾改用 `showLoadAllBtn()` 幂等调用）；`setting-plugin.tsx`（autoPage change 回调调用两方法）。

**结果**：version 1.13.0 → 1.13.1（patch）。

**演进链**：doc/100 完善 doc/99 的按钮生命周期——从「仅创建」到「可实时创建/销毁」。

### 1.3 doc/101 重复检测优化 + 与 loader 状态深度融合

**背景/根因**：用户使用「加载全部」时遇到「翻页内容出现重复数据，页码受JavDB限制，已停止瀑布流」错误，但按钮仍显示「✓ 已全部加载」——状态不一致。两个问题：

1. **重复检测误判**：`checkDuplicateCarNumbers` 原逻辑为 newList 中**连续 ≥2 个**番号在 existingList 即判定页码受限；而 `existingList = getBoxCarInfoList()` 取当前 DOM 所有已加载页的番号，「加载全部」循环多页后 existingList 极大，个别番号碰巧连续重复就误判。
2. **没有深度融合**：`loadAllPages` 循环退出后无脑显示「✓ 已全部加载」，没有感知 `loadNextPage` 设置的 `waterfall-error` loader 状态。

**方案与决策**

- 重复检测（base-plugin.ts）：连续≥2 → 统计 newList 中已存在番号**总数**，**重复比例 ≥50%** 才判定页码受限。JavDB 页码受限时返回重复内容 → 比例高 → 判定；新页有新内容、个别巧合重复 → 比例低 → 不判定；只看比例不受 existingList 大小影响。
- 深度融合：`loadAllPages` 退出后检查 `this.loader` 的 className + textContent，三态同步按钮文案：

| loader 状态 | 按钮文案 | 淡出 |
|------------|---------|------|
| `waterfall-error` + 含「重复」 | 已停止（页码受限） | 否 |
| `waterfall-error` + 其他 | 加载失败，点击重试 | 否 |
| 其他（no-more / loading） | ✓ 已全部加载 | 是（2 秒后） |

**实施要点**：`base-plugin.ts` 改重复比例检测；`auto-page-plugin.ts` 的 `loadAllPages` 循环退出后检查 loader 状态分流文案。

**结果**：version 1.13.1 → 1.13.2（patch）。

**遗留**：重复比例 50% 为经验阈值，仍依赖 JavDB 实际返回结构。

---

## 2. 排序组件丢失连环修复（doc/102 ×2 → 103 → 104 → 105），v1.13.3–1.13.6

> 本主题四步修复的**根因各不相同**：doc/102a 是 autoPage 无条件禁用排序误伤清单页；doc/102b 是静态页 MutationObserver 等待永不触发；doc/103 是普通列表页 `#sort-toggle-btn` 被隐藏；doc/104 是 PageSort 选择器仍被 autoPage 禁用；doc/105 是 doc/92/93 过度禁用演员页按钮组。

### 2.1 doc/102a 修复 /lists/* 清单页排序组件丢失

**背景/根因**：`/lists/*` 清单详情页有 `.movie-list`（isListPage=true）但通常无 `.pagination-next`（不支持瀑布流分页）。然而 autoPage=YES 时**无条件**禁用排序，涉及三处：`ListPageButtonPlugin.handle()` 隐藏 `#sort-toggle-btn`、`PageSortPlugin.handle()` 直接 return、`setting-plugin.tsx` 的 autoPage change 也隐藏。设计意图是「排序与瀑布流互斥」（瀑布流按原始顺序追加，排序会打乱追加顺序），但 `/lists/*` 无分页，该互斥在此页面不合理。

**方案与决策**：`/lists/` 路径下 autoPage=YES **不禁用**排序——判断加 `!currentHref.includes('/lists/')` 条件，互斥仅在有分页的列表页生效。

**实施要点**：`page-sort-plugin.ts`、`list-page-button-plugin.tsx`、`setting-plugin.tsx` 三处 autoPage 判断加 `/lists/` 排除条件。

**结果**：version 1.13.2 → 1.13.3（bug 修复）。

### 2.2 doc/102b 修复清单详情页排序按钮组不注入（静态页等待模式失效）

**背景/根因**：清单详情页的「按名称/评分升降序」按钮组不注入。`PageSortPlugin.waitForContainer` 照搬原 `pageSort.user.js` 的 MutationObserver 等待模式：原脚本 `@run-at document-end` 时容器 `body > section > div` 尚未出现，observer 会在渲染时触发；本项目 `@run-at document-idle`，handle 调用时 DOM 已解析完成、容器**已经存在**，observer 只响应**后续** mutation——`/lists/{id}` 是静态页（视频数有限、无瀑布流 append），body 子树长期无 mutation → observer 永不触发。实测 `/lists/Azm8DM` 5 秒内触发 0 次，同页 `.toolbar`/`.movie-list`/40 个 `.item` 全部就绪（`canInjectImmediately=true`），证明是等待模式问题而非 DOM 缺失。影响范围：`/lists/{id}` 必现；首页/标签页/搜索页等有瀑布流 append 触发 body mutation 的页面最终会触发但延迟。

**方案与决策**：`waitForContainer` 改为「先同步尝试，失败才 observer 等待」（与 `StatusTagFilterPlugin.init` 一致）：先调 `createSortSelector()`，返回 true 直接 return；返回 false（`.toolbar`/`.movie-list`/`.item` 任一未就绪）才挂 observer，回调内再次尝试，成功即 disconnect。`createSortSelector` 返回值 `void → boolean`（三处 early return 改 `false`）。防重入已分析：同步成功不挂 observer、observer 成功即 disconnect、失败调用无副作用，无需额外守卫。

**实施要点**：仅 `page-sort-plugin.ts`。

**结果**：version 1.13.2 → 1.13.3（与 doc/102a 同一版本步进，两篇 102 为同版本内的两次独立修复）。

**演进链**：doc/102a 恢复的是「排序开关不被隐藏」，doc/102b 恢复的是「排序选择器能注入」——两个独立根因共同构成 1.13.3。

### 2.3 doc/103 修复普通列表页排序丢失（真根因：autoPage 隐藏 #sort-toggle-btn）

**背景/根因**：doc/102 修好 `/lists/*`，但 `/movies`、`/tags` 等普通列表页排序仍不显示，用户怀疑 doc/92/93 清理误伤。排查排除：

- git diff 确认 doc/93（commit 26f108d）对 `menu-button-box-html.tsx` 的修改**仅删除**演员页相关代码（`actorsPage` prop + `filterAllVideo` 按钮 + `FILTER_ALL_TIP` 常量），完全没动 `#sort-toggle-btn` 的渲染逻辑；对 `list-page-button-plugin.tsx` 的修改也只是演员页早 return，不影响普通列表页。
- doc/92 所说「PageSortPlugin handle 直接 return」**从未落地**（git log 确认 `page-sort-plugin.ts` 仅 2 个 commit，均不含）。

真根因仍是 autoPage=YES 的排序互斥三处禁用（`ListPageButtonPlugin.handle` 隐藏 `#sort-toggle-btn`、`sortItems()` return、`PageSortPlugin.handle()` return、setting change 隐藏）；`/lists/*` 有排序是 doc/102 加了排除条件，普通列表页没有。

**方案与决策**：**移除 autoPage 对 `#sort-toggle-btn` 的隐藏逻辑**——排序按钮始终显示，用户可在瀑布流模式下手动排序（新追加项在末尾，不影响瀑布流顺序）；autoPage=NO 时页面加载仍自动排序（保持原行为）。`sortItems()` 移除 autoPage 判断（是否自动排序由 `handle()` 控制，用户手动点击时执行）。**PageSortPlugin 保持 autoPage=YES 不注入**——其 sortGuard MutationObserver 监听容器 childList，瀑布流 append 新页会触发误判重排，与瀑布流冲突；`/lists/*` 无瀑布流分页仍注入（doc/102 的 `/lists/` 条件保留）。

**实施要点**：`list-page-button-plugin.tsx`（handle 移除隐藏逻辑、sortItems 移除 autoPage 判断，保留 isSearchOrUserPage 跳过）；`setting-plugin.tsx`（autoPage change 移除 hide/show 逻辑，autoPage=NO 时调 `getBean('ListPageButtonPlugin')?.sortItems()`，删 unused `currentHref` import）。

**结果**：version 1.13.3 → 1.13.4（bug 修复）。

**演进链**：doc/103 部分推翻 doc/102a 的「排序与瀑布流互斥」思路——对 jhs 排序按钮彻底取消隐藏，仅保留 PageSort 的互斥。

### 2.4 doc/104 移除 PageSort 的 autoPage 禁用（所有列表页注入排序选择器）

**背景/根因**：doc/103 只移除了 `#sort-toggle-btn` 的隐藏，PageSort 排序选择器仍在 `autoPage=YES` 时 return 不注入，用户反馈 `/lists/*` 以外的页面排序组件仍未恢复。重新审查 sortGuard 实现后推翻「冲突严重」的旧判断：

- 仅 `activeSort !== null`（用户已选排序方式）时才触发重排；
- 有 `MAX_GUARD_RETRIES=5` 上限，超限放弃；用户手动点击排序按钮时计数重置为 0。
- 结论：用户没选排序方式时 sortGuard 不触发；选了排序后瀑布流 append 自动重排（含新项）是合理行为；5 次上限防死循环——冲突不严重。

**方案与决策**：移除 `handle()` 的 autoPage 检查（删整行），所有列表页注入 PageSort；同时删除 unused import（`currentHref` + `YES`）。

**实施要点**：仅 `page-sort-plugin.ts`。

**结果**：version 1.13.4 → 1.13.5（bug 修复）。

**演进链**：doc/104 彻底移除 doc/102a/103 对 PageSort 的 autoPage 互斥，排序恢复问题的修复到此收口。

### 2.5 doc/105 恢复演员页 /actors/* 排序组件

**背景/根因**：用户认为演员页也应显示排序组件。doc/92/93 因显示结构混乱把演员页的**整个按钮组**禁用（`createMenuBtn`/`bindEvent` 开头加 `/actors/` 早 return），导致既无 `#sort-toggle-btn` 也无 PageSort 排序选择器。doc/92 的原始问题是按钮组挂到 `.toolbar` 导致显示混乱，doc/93 的修复过度——应只解决 `.toolbar` 混乱而非整组禁用。

**方案与决策**：移除两个早 return，恢复按钮组注入。不会重蹈显示混乱：`createMenuBtn` 默认 containerEl 已是 `.main-tabs, .tabs`（不挂 `.toolbar`），PageSort 选择器单独注入 `.toolbar`，互不冲突。

**实施要点**：仅 `list-page-button-plugin.tsx`。

**结果**：version 1.13.5 → 1.13.6（修复）。

**演进链与遗留**：doc/105 是对 doc/92/93 过度禁用的修正（撤回）。遗留：`#sort-toggle-btn` 与 PageSort 的选中态互斥协调仍按 doc/37 既有方案运行。

---

## 3. doc/106 修复 SupJav 跳转地址未遵守外部网站设置，v1.13.7

**背景/根因**：详情页 SupJav 按钮的跳转地址始终为 `https://supjav.com/?s=<番号>`，不遵守设置弹窗「外部网站」面板的 `supJavUrl` 配置项。根因：`other-site-plugin.tsx` 的 supJav siteConfig 在 doc/52 加了 `initUrl` 以跳过 SupJav 全站 Cloudflare 拦截（直接显示黄色 + 搜索页链接，不发请求），但该 `initUrl` **硬编码**了 `https://supjav.com`。`handleSite` 执行路径：检测到 `initUrl` → 设 href（已被硬编码值设置）→ `noHandle` 未设 → else 分支 `if (buttonEl.attr('href')) return` → 读取设置项的 `getSupJavUrl()` **永远不会被调用**，设置形同虚设。对比 MissAv 无 `initUrl`，走完整 `handleSite` 流程经 `getBaseUrl` 读取设置，所以生效。

**方案与决策**：让 `initUrl` 改为异步读取 `getSupJavUrl()`，与 `getBaseUrl` 一致地尊重设置项。`SiteConfig.initUrl` 类型由 `(carNum: string) => string` 放宽为 `(carNum: string) => Promise<string> | string`（兼容同步/异步）；`handleSite` 调用处加 `await`（handleSite 本已是 async）。`preloadListPage` 的 `if (siteConfig.initUrl) continue;` 只检测存在性、不调用，无需改动。

**实施要点**：仅 `other-site-plugin.tsx`。

**结果**：version 1.13.6 → 1.13.7。默认值不变（缺省 `supJavUrl` 与硬编码相同），黄色 warn 状态与不发请求行为不变。

---

## 4. 列表页预加载状态闭环（doc/107 → 108 → 109），v1.14.0–1.15.1

### 4.1 doc/107 预加载实时状态徽标

**背景/根因**：OtherSitePlugin 在列表页预加载（doc/51 新增、doc/52 优化）missav 等站点缓存时对用户完全透明——`preloadListPage`/`preloadSite` 只读写 localStorage 缓存，不在 UI 上反映进度，用户无法知道哪些卡片正在预加载、是否命中、是否失败。需求：在 `.item` 的 `.video-title` 下方实时显示状态，四档：

- **排队中** — 已入队 AsyncTaskQueue 但尚未执行（串行限流）
- **请求中** — 正在请求搜索页（gmHttp.get）
- **成功匹配** — 搜索结果命中（单/多结果），已写缓存
- **匹配失败** — 未命中 / Cloudflare 拦截 / 其他错误

**方案与决策**

- DOM：`.video-title` afterend 插入状态条容器，每站点一个徽标（`data-site-id`）。注入点与 RatingDisplay（写 `.cover`）、ListPagePlugin（写 `.status-tag`）、VideoListsTag（写 `.custom-tags-display`）均不冲突。

```html
<div class="jhs-preload-status-bar">
  <span class="jhs-preload-status" data-site-id="missAvBtn">
    <span class="jhs-ps-name">missAv</span>
    <span class="jhs-ps-badge jhs-ps-queued">排队中</span>
  </span>
</div>
```
- 实时更新不重建 DOM：`updatePreloadStatus($item, siteId, status)` 幂等——徽标不存在时经 `jsxToString(<PreloadStatusBar/PreloadStatusBadge>)` 注入初始 HTML；已存在则 jQuery 直接改 `.jhs-ps-badge` 的 class 与 text。
- 状态流转：入队前「排队中」→ 任务开始「请求中」→ 命中「成功匹配」→ 未命中/CF 拦截/其他错误「匹配失败」；任务执行时站点已被标记拦截同「匹配失败」。
- Observer 安全：`.movie-list` 作用域三 observer（ListPagePlugin checkDom、OtherSitePlugin startPreloadObserver、PageSortPlugin sortGuard）均为 `{childList:true, subtree:false}`，只响应 `.item` 增删，不响应 item 内部变化；body subtree observer 均按谓词过滤，`.jhs-preload-status-*` 不匹配任何谓词（类名前缀刻意避开 `tag`/`status-tag`/`item` 等谓词前缀）。
- SupJav 不显示徽标：有 `initUrl`（doc/52 + doc/106 修复后读 `supJavUrl` 设置），`preloadListPage` 跳过不入队，故列表页徽标实际仅 missAv。
- 重试与幂等：成功项已写缓存，下次命中缓存跳过（徽标保持成功）；失败项未写缓存下次重试。

**实施要点**：新增 `src/components/preload-status-badge.tsx`（`PreloadStatusBar`/`PreloadStatusBadge` 组件 + `PreloadStatus` 类型 + `PRELOAD_STATUS_MAP` 状态→class/文案映射）与 `src/styles/preload-status-badge.css`（chip 布局、四档配色、请求中脉冲点动画）；修改 `other-site-plugin.tsx`。

**结果**：version 1.13.7 → 1.14.0（新增功能，minor 递增）。

### 4.2 doc/108 深度跟踪 + 筛选栏 + 样式优化

**背景/根因**：doc/107 上线后用户反馈三类问题：

1. **流式加载新 item 徽标延迟/缺失**：瀑布流 append 新 `.item` 后，徽标要等 `startPreloadObserver` 的 500ms 防抖 + 入队才创建，期间请求即将发出却没徽标（live 实测：首屏 40 item 正常，滚出 35 个新 item 后约 1.5s 内无徽标）。
2. **样式不好看**：徽标视觉粗糙，缺乏状态图标与配色层次。
3. **缺筛选组件**：要求按预加载状态过滤卡片，且筛选栏与其他筛选栏（`.status-tag-filter-bar`/`.tag-filter-bar`）「放在一块」，有预加载的页面都要有、实时刷新。

**方案与决策**

- **深度跟踪 `syncAllBadges()`**：扫描所有 `.movie-list .item`，对未缓存（`jhs_other_site` 无 `carNum_siteId` 键）且尚无徽标的可预加载站点（已启用、无 `initUrl`）预填「排队中」。`startPreloadObserver` 回调改为**立即** `syncAllBadges()` + `ensureFilterBar()` + `refreshFilterBar()`，再 300ms 防抖 `preloadListPage()`（入队 + 逐站点请求）。幂等设计：已缓存不产徽标、已有徽标不覆盖（避免降级正在请求/已失败态）、被屏蔽（`data-hide`）/番号提取失败跳过。**以 DOM 徽标为唯一真相**（与 StatusTagFilterPlugin 读 `.status-tag` 一致），无内存 store；PageSort 用 jQuery `.append(existingNodes)` **移动**节点（不重建），徽标随节点保留。
- **PreloadFilterBar**：镜像 StatusTagFilterPlugin 的挂载/芯片/过滤模式，但逻辑内聚于 OtherSitePlugin（深度耦合状态源，避免跨插件 getBean/事件）。挂载优先紧随 `.status-tag-filter-bar` → `.tag-filter-bar` → `.tabs.is-boxed`/`.actor-tags.tags` → section 回退；目标未就绪则 body subtree observer 重试。芯片固定 5 档（排队中/请求中/成功匹配/匹配失败/已缓存），带状态色圆点 + 实时计数，与 `.status-tag-filter-chip` 同款药丸样式；`refreshFilterBar` 150ms 防抖合并频繁状态变更，每条 `updatePreloadStatus` 都触发实时刷新。过滤用专用 `data-preload-hidden` 属性 + `display:none`，跳过其他隐藏插件已隐藏的卡片（`data-hide`/`data-lrs-hidden`/`data-status-tag-hidden`/`data-video-lists-tag-hidden`），OR 逻辑，无激活芯片仅恢复本插件隐藏项。计数排除被其他插件屏蔽的卡片，只反映实际可见卡片。
- 新增 `enableLoadOtherSite` 总开关（handle() 列表页分支）。
- 样式重写：徽标加状态图标（`✓` 成功绿 / `✕` 失败红 / 脉冲点请求中琥珀 / 纯文本排队中灰）+ 半透明药丸底；筛选栏芯片与 `.status-tag-filter-chip` 视觉统一。

**实施要点**：`other-site-plugin.tsx` 新增 `getPreloadableSites`/`syncAllBadges`/`getItemPreloadStatus` 与筛选栏系列方法（`initFilterBar`/`tryBuildFilterBar`/`findFilterMountTarget`/`buildFilterBar`/`collectPreloadCounts`/`applyPreloadFilter`/`refreshFilterBar`/`ensureFilterBar`）、`PRELOAD_CHIPS`/`PRELOAD_HIDDEN_ATTR`/`OTHER_HIDDEN_ATTRS` 静态常量与 `filterBarObserver`/`filterRefreshDebounce` 字段；`preload-status-badge.css` 重写。未新增源文件（筛选栏以命令式 createElement 实现，镜像 StatusTagFilterPlugin 先例）。

**结果**：version 1.14.0 → 1.15.0（新增功能，minor）。隔离逻辑验证（模拟 javdb 结构测试页）确认：首屏/流式新 item 徽标立即出现、计数实时、点击芯片过滤正确、幂等无 DOM 累积。

**演进链**：doc/108 修复 doc/107 的徽标延迟与缺组件问题，并把状态源统一为 DOM 徽标。

### 4.3 doc/109 修复仅匹配失败显示徽标（已缓存项补「成功匹配」）

**背景/根因**：用户反馈「为什么只有匹配失败了的，显示了，其他状态都没显示」。live 调研（`/lists/Azm8DM?f=download`）：73 个 item 中 56 个已缓存（`jhs_other_site` 有 `carNum_missAv` 键 = missav 曾命中），但 doc/108 的 `syncAllBadges` 对已缓存项**不创建徽标**（仅未缓存项预填「排队中」），故视觉上只剩 17 项未命中显示「匹配失败」——其他状态都没显示。

**方案与决策**：已缓存 = missav 曾命中 = 成功。给已缓存项补「成功匹配」徽标：

- `syncAllBadges`：已缓存项 → `updatePreloadStatus(success)`（无徽标则创建，陈旧「排队中」纠正为成功；已是成功则跳过避免重复写）。
- `handle()` 列表页分支：在 `preloadListPage` 前同步调 `syncAllBadges`，首屏已缓存项立即显示「成功匹配」。
- 筛选栏去掉「已缓存」芯片（已缓存即成功，语义合并），保留 4 档：排队中/请求中/成功匹配/匹配失败。
- `getItemPreloadStatus`：无徽标返回 `'none'`（原 `'cached'`）；`collectPreloadCounts` 只计 4 档（`none` 不计入）；CSS 删除 `cached` 芯片样式。

**实施要点**：`other-site-plugin.tsx` + `preload-status-badge.css`。

**结果**：version 1.15.0 → 1.15.1（bug 修复）。live 验证：28 个已缓存 item 补「成功匹配」徽标，新分布成功 28 / 失败 12 / none 0，全部 item 有徽标无空窗。

**演进链**：doc/108 的「已缓存不产徽标」设计造成视觉空窗，doc/109 修正为「已缓存即成功」，并同步收敛筛选栏为 4 档。

---

## 5. 预加载配置面板（doc/110 → 111），v1.16.0–1.16.1

### 5.1 doc/110 「⚡ 预加载配置」设置面板

**背景/根因**：doc/107-109 上线后，预加载相关行为（是否预加载、是否显示状态、防抖延迟、启用站点、清缓存）全部硬编码，用户无法在设置菜单调整，要求「全项配置拆解 + 设置菜单添加配置页面」。

**方案与决策**：SettingDialog 新增「⚡ 预加载配置」侧栏项 + `preload-panel` 面板，按 AGENTS.md §4.4「添加新面板的正确方式」实现（镜像 domain-panel 文本输入、base-panel checkbox/select + data-tip、vlt/missav-panel 动作按钮 + 状态 div 既有模式）。

| 配置项 | id | 类型 | 默认 | 控制行为 |
|--------|----|------|------|----------|
| 列表页预加载 | `enablePreload` | checkbox | yes | handle() 列表页分支总闸；关则不预加载、无徽标/筛选栏（详情页按钮仍受 enableLoadOtherSite 控制） |
| 显示状态徽标与筛选栏 | `enablePreloadStatus` | checkbox | yes | 徽标 + 筛选栏显隐；关则后台仍预加载缓存但不渲染 UI |
| 预加载防抖延迟 | `preloadDebounce` | number(ms) | 300 | startPreloadObserver 防抖时长（流式新 item 后多久入队请求） |
| 预加载站点 - MissAv | `preload-enable-missAvBtn` | checkbox | ✓ | 写 `jhs_enabled_sites`（getEnabledSites 读取） |
| 预加载站点 - SupJav | `preload-enable-supJavBtn` | checkbox | ✓ | 同上（SupJav 有 initUrl 跳过列表页预加载，仅详情页有效） |
| 清理预加载缓存 | `#clear-preload-cache-btn` | 动作按钮 | — | `localStorage.removeItem('jhs_other_site')` + 计数状态回显 |

总开关 `enableLoadOtherSite` 仍留在快捷设置面板（SimpleSettingPanel），不迁入本面板——避免两处 DOM 同 id 时 `$('#enableLoadOtherSite')` 匹配多元素；面板以 help 文案指引用户去快捷设置开关。

配置层级：

```
enableLoadOtherSite (总开关，SimpleSettingPanel)
 └ NO → 整个 OtherSitePlugin 不启动（详情页按钮 + 列表页预加载全无）
 └ YES
     ├ 详情页 → loadOtherSite（渲染按钮）
     └ 列表页 → enablePreload (列表页预加载)
         └ NO → 不预加载、无 UI
         └ YES → 后台预加载缓存
             └ enablePreloadStatus (显示状态徽标与筛选栏)
                 └ NO → 静默缓存，无 UI
                 └ YES → 徽标 + 筛选栏
```

**实施要点**：`setting-dialog.tsx`（侧栏 + preload-panel）；`setting-plugin.tsx`（loadForm 回填 / bindClick 清缓存 / saveForm 收集，站点 checkbox 写 `jhs_enabled_sites`）；`other-site-plugin.tsx`（新增 `preloadStatusEnabled`/`preloadDebounceMs` 字段，各 UI 方法加 `if(!preloadStatusEnabled) return`，防抖用 `preloadDebounceMs` 替代硬编码 300）。

**结果**：version 1.15.1 → 1.16.0（新增功能，minor）。

### 5.2 doc/111 面板加强 + 缓存去重 + TTL

**背景/根因**：两点反馈：

1. **设置不够详细需要加强**：面板配置项偏少、说明偏简。
2. **第三方站点缓存与预加载是同一缓存却重复清理**：doc/110 加了「清理预加载缓存」按钮清 `jhs_other_site`，而「缓存管理」面板 `cacheItems` 本就含 `{key:'jhs_other_site', text:'🌍 第三方站点缓存'}`——两处清同一缓存，重复且令人困惑。

**方案与决策**

- **缓存去重优化**：预加载面板**移除**「清理预加载缓存」按钮，改为**只读缓存状态**展示（`#preload-cache-stats`：总数 + MissAv/SupJav 分站计数 + 占用，切到该面板时 `refreshPreloadCacheStats()` 刷新，镜像 cache-panel 切换刷新）；面板内文案指明「此缓存即『缓存管理』面板的『第三方站点缓存』，清理请前往该面板」。清理唯一入口回归「缓存管理」面板（`jhs_other_site` 仍在 `cacheItems`，clean-all/clean-btn 覆盖）。
- **新增 `preloadCacheTTL`**（天数，0=永不过期，缺省 0）：命中缓存超过此天数视为过期，下次打开列表页重新预加载，平衡新鲜度与请求量。实现：缓存条目写入时附 `ts: Date.now()`；读取处统一经新方法 `isCacheEntryValid(entry)` 判定——TTL=0 永久有效、旧条目无 ts 视为有效（向后兼容）、有 ts 且未过期才有效。涉及 5 处读/写：handleSite 读（详情页命中回填）、handleSite 写、preloadListPage 跳过、preloadSite 写（列表页命中存缓存）、syncAllBadges 已缓存→成功徽标。
- 各配置项 `data-tip` help 文案细化（防抖/有效期/状态显隐/站点选择的用途与影响），TTL 项给出「建议 7-30 天」参考。

**实施要点**：`setting-dialog.tsx`（TTL 数字输入 + 只读统计块）；`setting-plugin.tsx`（loadForm/saveForm 读写 TTL、新增 `refreshPreloadCacheStats`、面板切换时刷新统计）；`other-site-plugin.tsx`（`preloadCacheTTLDays` 字段 + `isCacheEntryValid` 方法 + 5 处缓存读写改造）。

**结果**：version 1.16.0 → 1.16.1（优化 + bug 修复，patch）。

**演进链与遗留**：doc/111 修正 doc/110 的重复清理入口，并补上缓存新鲜度控制。遗留：TTL 过期只触发重新预加载，不主动清理旧缓存条目。

---

## 6. 访问记录插件（doc/112 → 113 → 114），v1.17.0–1.17.2

### 6.1 doc/112 VisitHistoryPlugin 初版

**背景/根因**：新功能需求——记录所有打开过的 javdb 页面，在详情页元数据面板（番號/導演/片商/系列/類別/演員等可跳转链接）悬浮显示「最近打开时间」。相对时间格式：1 分钟内「X秒前打开过」、1 小时内「X分钟前打开过」、1 天内「X小时前打开过」、1 周内「X天前打开过」、更久显示日期。

**方案与决策**：新增 `VisitHistoryPlugin`（本项目自创，非 archetype 拆分/集成/升级），单文件，注册到 PluginManager（javdb only）。

- **记录（全页）**：每次 `handle()`（每页加载一次）记录当前页 `pathname + search` → `Date.now()` 到 localStorage `jhs_visit_history`（`Map<path, ts>`）；超过 `MAX_ENTRIES`（5000）按 ts 升序淘汰最旧；配额超限兜底清空避免抛错阻断。
- **显示（详情页）**：`injectMetaLinkTooltips()`——容器优先指定选择器（`body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2)`），缺失回退 `.movie-panel-info`；链接 `.panel-block .value a[href]`（番號/導演/片商/系列/類別/演員，排除下载/訂正/外部站点等非元数据链接）；命中历史设 `data-tip-top` 复用全局 tooltip（core/tooltip.ts）；**捕获阶段刷新**——每个链接绑 `mouseover`（capture=true）重设 `data-tip-top`，使页面停留较久时悬浮仍显示实时相对时间（capture 先于 bubble，读到刷新值）。未访问过的链接不设属性。
- **路径归一化** `normalizePath(href)`：`new URL(href, location.origin)` 仅同源 javdb 链接返回 `pathname + search`，外部（missav/supjav）与 `javascript:` 跳过——记录与查询均用此归一 key，保证链接与访问记录匹配。
- **相对时间格式**：`<1 分钟` X秒前打开过；`<1 小时` X分钟前打开过；`<1 天` X小时前打开过；`<1 周` X天前打开过；`≥1 周` YYYY-MM-DD 打开过（本地时区）。
- **缓存管理联动**：`jhs_visit_history` 加入 SettingPlugin `cacheItems`（「🕐 访问记录」）。

**实施要点**：新增 `src/plugins/visit-history-plugin.ts`（recordVisit/readHistory/evictIfNeeded/injectMetaLinkTooltips/normalizePath/formatVisitTime/formatDate）；修改 `main.tsx`（注册，isJavdbSite 块）与 `setting-plugin.tsx`（cacheItems）。

**结果**：version 1.16.1 → 1.17.0（新增功能，minor）；JavDB 插件计数 39→40。live 验证：真实详情页命中 14 条元数据链接，href 归一化与相对时间格式全部符合规格。

### 6.2 doc/113 改为自定义实时 tooltip + 澄清备份归属

**背景/根因**：两个反馈：①计时显示不实时，悬浮后显示的时间是静态的，必须刷新页面才更新；②访问记录是随 WebDav 备份走，还是只保留在本地。

**根因与方案**

- **实时跳动**：doc/112 复用全局 tooltip（`data-tip-top` + `setupTooltip`），内容在 hover 时一次性捕获、闭包固化，悬浮期间不刷新。改为**自定义实时 tooltip**（`.jhs-visit-tooltip`）：`mouseenter` 显示 + `setInterval(1s)` 重算 `formatVisitTime(ts)`；`mouseleave`/scroll/resize 清除定时器 + 隐藏；样式对齐全局 `.js-tooltip`（浅绿底 `#f0fdf4` / 字色 `#166534` / 阴影）；不设 `data-tip-top`，避免与全局静态 tooltip 双重显示。
- **备份归属结论（当时的结论）**：设置/鉴定/黑名单等在 IndexedDB（localforage `JAV-JHS/appData`），`exportData` 全量序列化进备份；访问记录 `jhs_visit_history` 与预加载缓存等 localStorage 数据**不进备份**（`exportData` 仅 `forage.iterate` IndexedDB）。访问记录为**本机本地**，换浏览器/清站点数据会丢失。备注：若需跨设备同步，可后续迁入 IndexedDB 或在备份 payload 显式附加 localStorage 键（需处理导入合并策略）；当前保持 localStorage 同步写入（避免 IDB 异步在快速跳页时丢记录）。

**实施要点**：`visit-history-plugin.ts`（去 data-tip-top，改 mouseenter/mouseleave + 1s 定时刷新，新增 ensureTooltipEl/showVisitTooltip/hideVisitTooltip，initCss 注入）；新增 `src/styles/visit-history-tooltip.css`。

**结果**：version 1.17.0 → 1.17.1（优化，patch）。

### 6.3 doc/114 hover 重读 + 全链接绑定（真正实时）

**背景/根因**：doc/113 已改自定义 tooltip + 1s 定时器，用户仍反馈「必须刷新页面才能更新打开时间」。根因不是定时器本身，而是**注入时闭包固化**：`readHistory()` 仅页面加载时读一次，`ts` 在绑定闭包中固化，且当时未访问的链接**永不绑监听**：

```ts
const history = this.readHistory(); // 仅页面加载时读一次
const ts = history[path];
if (!ts) return; // 当时未访问 → 永不绑监听
el.addEventListener('mouseenter', () => this.showVisitTooltip(el, ts)); // ts 固化
```

典型失败路径：①详情页加载时某导演尚未访问 → 不绑事件 → 新标签打开导演页再回来仍无提示；②已有旧 ts（如 5 分钟前）→ 新标签再开一次导演页 → 悬浮仍显示「5分钟前」，直到刷新详情页。

**方案与决策**：

- 所有元数据链接都绑 mouseenter（不在注入时按 history 过滤）；
- **每次 hover 重读 localStorage**（`onEnter` 内 `readHistory()[path]` 取最新 ts）；
- 定时器内也重读该 path 的 ts（跨标签刚写过记录时，悬浮中即可更新到「几秒前」）；
- 刷新间隔 500ms（秒级文案更跟手）；
- `pageshow`（bfcache 前进/后退恢复）补 `recordVisit` + 强制重绑。

**实施要点**：`visit-history-plugin.ts`（inject 改全链接绑定；hover/tick 重读 history；pageshow；`__jhsVisitEnter` 防重复绑；`TICK_MS=500`）。

**结果**：version 1.17.1 → 1.17.2（bug 修复，patch）。

**演进链与遗留**：doc/113 把静态 tooltip 换成定时刷新，doc/114 进一步消除「注入时闭包固化」——两次迭代共同完成悬浮实时。遗留：localStorage 单键全量读写，5000 条上限下每次 hover 重读整表（规模可控，未做分片/索引优化）。

---

## 7. 访问记录与全量长期缓存随备份（doc/115 → 116），v1.17.3–1.18.0

### 7.1 doc/115 访问记录随 WebDav / JSON 备份

**背景/根因**：doc/113/114 说明访问记录仅存 localStorage、不进备份；用户要求访问时间记录可随脚本 WebDav 备份（及本地 JSON 导入导出）。

**方案与决策**：备份链路统一走 `SettingPlugin.buildBackupPayload`（手动 WebDav 备份 + 自动备份共用）：

```
{
  ...storageManager.exportData(),   // IndexedDB
  __meta: { credentialId, autoBackupConfig, backupTime },
  __localStorage: { jhs_visit_history: localStorage.getItem('jhs_visit_history') }  // string | null
}
```

导入（本地 JSON 覆盖导入 + WebDav 备份列表「导入」）：①`applyBackupLocalStorage(parsedData)`——有 `__localStorage.jhs_visit_history` 则写回 localStorage（覆盖），缺失/null 不动本地（兼容旧备份）；②`delete data.__localStorage` 避免 `storageManager.importData` 误写入 IndexedDB；③`storageManager.importData(parsedData)` 照常清空并写入 forage。本地「导出数据」改用 `buildBackupPayload`，与 WebDav 内容一致。常量 `VISIT_HISTORY_STORAGE_KEY` 从 `visit-history-plugin.ts` 导出，备份侧复用。

**实施要点**：`visit-history-plugin.ts`（导出常量）；`setting-plugin.tsx`（buildBackupPayload 注入 `__localStorage`、新增 `applyBackupLocalStorage`、本地/WebDav 导入前调用、exportData 改用 buildBackupPayload）。

**结果**：version 1.17.2 → 1.17.3（按 doc 记录标注 patch）。

### 7.2 doc/116 全量长期缓存随备份

**背景/根因**：用户确认缓存为**长期数据**，要求自动/手动备份均带上全部缓存，避免清站点数据或换机后丢失。此前仅 `jhs_visit_history` 进 `__localStorage`，`jhs_other_site` 等预加载/翻译/演员等缓存不进备份。

**分析结论**：

| 层级 | 是否已在备份 | 说明 |
|------|--------------|------|
| IndexedDB `JAV-JHS/appData` | ✅ exportData 全量 | setting、car_list、黑名单、vlt_*、listReadingStatus_data、jhsRatingDisplay_data 等 |
| localStorage 长期缓存 | ❌ → ✅ 本版 | 见下键清单 |
| GM 清单阅读/瀑布流 | ❌ → ✅ 本版 | listReading 主源在 GM，需一并备份 |
| API 签名 / 跨标签广播 | 不备份 | 可再生/瞬时 |
| 本机 credentialId / 上次自动备份日 | 不备份 | 本机绑定 |

**纳入 `__localStorage` 的键**（`src/core/backup-extra-storage.ts` 清单）：

- 缓存：`jhs_other_site`、`jhs_other_site_dmm`、`jhs_dmm_video`、`jhs_translate`、`jhs_actress_info`、`jhs_score_info`、`jhs_screenShot`、`jhs_visit_history`、`jdb:rating_cache_v2`
- 偏好：`jhs_enabled_sites`、`jhs_foldCategory`、`jhs_sortMethod`、`jhs_fancyboxThumbs`、`jhs_upgrade_flags`、`jhs_videoMuted`、`jhs_magnetHub_selectedEngine`、`jhs_appAuthorization`

**纳入 `__gmStorage` 的键**：`jdb:list-reading-status` / `jdb:list-rating` / `jdb:list-last-uri` / `jdb:list-sort` / `jdb:list-filter-read` / `jdb:list-filter-rating` / `jdb:list-waterfall-enabled`

**方案与决策**：新增 `backup-extra-storage.ts`：键清单 + `collectLocalStorageBackup` / `collectGmStorageBackup` / `applyBackupExtras`；`buildBackupPayload` 写入完整 `__localStorage` + `__gmStorage`；导入（本地 JSON + WebDav 导入）先 `applyBackupExtras` 再 `importData`；缓存管理面板补充 `jhs_other_site_dmm`、`jhs_screenShot`、`jdb:rating_cache_v2` 三项。手动 WebDav / 自动备份 / 本地导出共用 `buildBackupPayload`，内容一致。

**实施要点**：新增 `src/core/backup-extra-storage.ts`；修改 `setting-plugin.tsx`。

**结果**：version 1.17.3 → 1.18.0（功能扩展，minor 递增）。

**演进链与遗留**：doc/115 只带访问记录，doc/116 扩展为「全部长期缓存 + GM 清单状态」；doc/113 的「仅本地」结论被正式推翻。遗留：导入采用覆盖语义（`applyBackupExtras` 直接写回），无键级合并策略。

---

## 8. doc/117 预加载并发数配置，v1.18.1

**背景/根因**：预加载配置面板已有开关/防抖/TTL/站点，但请求调度固定串行（AsyncTaskQueue concurrency=1），大列表预加载偏慢。用户要求设置中增加并发控制。

**方案与决策**：

- **AsyncTaskQueue 支持 N 并发**（重写 `src/core/async-task-queue.ts`）：`constructor(concurrency=1)` / `setConcurrency(n)`；内部 `running` + `pending` 信号量调度；`addTask` 满并发则入队等待、完成后再 pump；单任务 catch 记 clog，不中断队列（与原版一致）；`waitAllFinished` 空闲时 resolve。concurrency=1 时语义等价原串行。
- 设置项 `preloadConcurrency`：默认 1，范围 1–10（1 最稳，增大加快但易触发 Cloudflare 拦截）。预加载面板新增数字输入 + data-tip；loadForm/saveForm 读写；`OtherSitePlugin.handle` 读取后 `preloadQueue.setConcurrency(...)`。

**实施要点**：`async-task-queue.ts`、`other-site-plugin.tsx`、`setting-dialog.tsx`、`setting-plugin.tsx`。

**结果**：version 1.18.0 → 1.18.1（按 doc 记录标注 patch）。

---

## 9. 阶段演进链与遗留问题

### 演进链总览

- **加载全部**：doc/99（初版）→ 100（实时显隐）→ 101（状态一致 + 重复检测修正）。
- **排序修复**：doc/102a（/lists/ 排除）→ 102b（静态页同步注入）→ 103（取消 `#sort-toggle-btn` 隐藏，部分推翻 102a 思路）→ 104（彻底移除 PageSort autoPage 禁用）→ 105（撤回 doc/92/93 演员页过度禁用）。
- **预加载闭环**：doc/107（徽标）→ 108（深度跟踪 + 筛选栏，消除 500ms 防抖延迟）→ 109（已缓存补成功徽标，修正 108 的视觉空窗）→ 110（硬编码参数化）→ 111（缓存清理去重 + TTL）。
- **访问记录**：doc/112（初版）→ 113（实时 tooltip，并明确「仅本地」）→ 114（hover 重读，修正 113 仍不实时）→ 115（推翻「仅本地」，纳入备份）→ 116（扩展为全量长期缓存 + GM 状态）。
- **其他**：doc/106 修复 doc/52 引入的 initUrl 硬编码；doc/117 为预加载增加并发配置。

### 遗留问题

- 重复检测 50% 阈值为经验值，依赖 JavDB 返回结构（doc/101）。
- `#sort-toggle-btn` 与 PageSort 的选中态互斥协调沿用 doc/37 方案（doc/105）。
- 预加载 TTL 过期只触发重新预加载，不主动清理旧缓存条目（doc/111）。
- 访问记录每次 hover 重读整张 5000 条 localStorage 表，未做分片/索引优化（doc/114）。
- 备份导入为覆盖语义，无键级合并策略（doc/116）。
- 预加载并发在 1–10 间权衡，增大易触发 Cloudflare 拦截（doc/117）。