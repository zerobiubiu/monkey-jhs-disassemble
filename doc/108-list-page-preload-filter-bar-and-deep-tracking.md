# 108 - 预加载状态深度融合：实时跟踪 + 筛选栏 + 样式优化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/107 实现了列表页预加载状态徽标，但用户反馈三类问题：

1. **流式加载新 item 徽标延迟/缺失**：AutoPage 瀑布流 append 新 `.item` 后，
   徽标要等 `startPreloadObserver` 的 500ms 防抖 + `preloadListPage` 入队才创建，
   期间新 item 无徽标但请求即将发出——「没做到跟踪」。live 调研确认：
   首屏 40 item 徽标正常，滚出 35 个新 item 后约 1.5s 内无徽标（等防抖）。
2. **样式不好看**：徽标视觉粗糙，缺乏状态图标与配色层次。
3. **缺筛选组件**：要求按预加载状态过滤卡片，且筛选栏须与其他筛选栏
   （`.status-tag-filter-bar` / `.tag-filter-bar`）「放在一块」，有预加载的
   页面都要有，实时刷新。

用户要求「这个 dom 和原来的视频流外部网站预加载应该深度融合」「深度处理」。

## 2. 方案

### 2.1 深度跟踪：消除徽标延迟（syncAllBadges）

新增 `syncAllBadges()`：扫描所有 `.movie-list .item`，对未缓存（`jhs_other_site`
无 `carNum_siteId` 键）且尚无徽标的可预加载站点（已启用、无 `initUrl`）预填
「排队中」徽标。

`startPreloadObserver` 回调改为：**立即** `syncAllBadges()`（新 item 一出现即
显示「排队中」）+ `ensureFilterBar()` + `refreshFilterBar()`，再 300ms 防抖
`preloadListPage()`（入队 + 逐站点请求，任务执行时转「请求中」→终态）。

幂等设计：已缓存（不产徽标）、已有徽标（不覆盖，避免降级正在请求/已失败态）、
被屏蔽（`data-hide`）/番号提取失败（跳过）。状态以 DOM 徽标为唯一真相
（与 StatusTagFilterPlugin 读 `.status-tag` 一致），无需内存 store——
PageSort 用 jQuery `.append(existingNodes)` **移动**节点（不重建），徽标随
节点保留（前置调研确认 page-sort-plugin.ts:367/381 + list-page-button-plugin.tsx:227）。

### 2.2 预加载筛选栏（PreloadFilterBar）

镜像 StatusTagFilterPlugin 的挂载/芯片/过滤模式，但逻辑内聚于 OtherSitePlugin
（深度耦合状态源，避免跨插件 getBean/事件）：

- **挂载**（`findFilterMountTarget`）：优先紧随 `.status-tag-filter-bar` →
  `.tag-filter-bar` → `.tabs.is-boxed` / `.actor-tags.tags` → section 回退，
  与现有筛选栏「放在一块」。`initFilterBar` 立即挂载，目标未就绪则 body
  subtree observer 重试（镜像 StatusTagFilter tryBuild）。`ensureFilterBar`
  在 observer 回调中补建 + 当 `.status-tag-filter-bar` 晚于本插件挂载时
  将本栏移至其后，保持顺序。
- **芯片**（`buildFilterBar`，命令式 createElement）：固定 5 档（排队中/
  请求中/成功匹配/匹配失败/已缓存），每芯片带状态色圆点 + 实时计数，
  与 `.status-tag-filter-chip` 同款药丸样式（`border-radius:50rem`）。
  `refreshChips` 保留激活状态、重建芯片；`refreshFilterBar` 150ms 防抖
  合并频繁状态变更，每条 `updatePreloadStatus` 都触发实时刷新。
- **过滤**（`applyPreloadFilter`）：专用 `data-preload-hidden` 属性 +
  `display:none`。协同安全——跳过其他筛选/隐藏插件已隐藏的卡片
  （`data-hide`/`data-lrs-hidden`/`data-status-tag-hidden`/
  `data-video-lists-tag-hidden`），OR 逻辑，无激活芯片仅恢复本插件隐藏项。
- **计数**（`collectPreloadCounts`）：排除被其他插件屏蔽的卡片，只反映
  实际可见卡片（与 StatusTagFilter 一致）。

### 2.3 样式深度优化

重写 `preload-status-badge.css`：

- **徽标**：`✓`（成功，绿）/`✕`（失败，红）/脉冲点（请求中，琥珀）/纯文本
  （排队中，灰）状态图标 + 配色 + 半透明药丸底，紧凑美观，一眼可辨。
- **筛选栏芯片**：与 `.status-tag-filter-chip` 同款药丸 + 状态色圆点 +
  active 配色（每档独立 active 色），视觉统一。

### 2.4 observer 安全（前置调研确认）

`.movie-list` observer `{childList:true, subtree:false}` 只响应直接子节点
（.item）增删/重排，不响应 item 内部徽标变更（不自我循环）。body subtree
observer（RatingDisplay/StatusTagFilter/VideoListsTag 等）会 fire 但均
按谓词过滤，`.jhs-preload-status-*` / `.preload-filter-*` 不匹配任何谓词 →
no-op（类名前缀刻意避开 `tag`/`status-tag`/`item` 等谓词）。

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/other-site-plugin.tsx` | handle() 增 enableLoadOtherSite 总开关 + 列表页分支调 `initFilterBar`；新增 `getPreloadableSites`/`syncAllBadges`/`getItemPreloadStatus` + 筛选栏系列方法（`initFilterBar`/`tryBuildFilterBar`/`findFilterMountTarget`/`buildFilterBar`/`collectPreloadCounts`/`applyPreloadFilter`/`refreshFilterBar`/`ensureFilterBar`）；`updatePreloadStatus` 末尾调 `refreshFilterBar`；`startPreloadObserver` 改为立即 sync+ensure+refresh 再 300ms 防抖 preload；新增 `PRELOAD_CHIPS`/`PRELOAD_HIDDEN_ATTR`/`OTHER_HIDDEN_ATTRS` 静态常量 + `filterBarObserver`/`filterRefreshDebounce` 字段 |
| `src/styles/preload-status-badge.css` | 重写：徽标增状态图标（✓/✕/脉冲）+ 配色；新增筛选栏 + 芯片（药丸/圆点/active 配色）样式 |
| `vite.config.ts` | version 1.14.0→1.15.0 |
| `doc/README.md` | 文档清单新增 doc/108 |
| `changelog/CHANGELOG.md` | 新增 v1.15.0 条目 |

> `src/components/preload-status-badge.tsx`（徽标组件）与 `src/styles/preload-status-badge.css`
> 文件名沿用 doc/107，未新增源文件；筛选栏以命令式 createElement 实现
> （镜像 StatusTagFilterPlugin 先例，非组件）。

## 4. 执行验证记录

### 4.1 类型检查 + 构建

```bash
$ npx tsc -b            # 通过
$ npx vite build        # 1,893.13 kB / gzip 436.13 kB；@version 1.15.0
```

### 4.2 隔离逻辑验证（模拟 javdb 结构的测试页）

模拟 `.tabs.is-boxed` + `.status-tag-filter-bar` + `.movie-list .item` 结构，
复刻徽标/筛选栏/同步/过滤逻辑，验证：

- 首屏 8 item → 徽标 + 筛选栏挂载于 `.status-tag-filter-bar` 之后，计数
  「排队中 8」实时准确
- 「+ 流式加载新 item」×3 → 新 item **立即**出现「排队中」徽标（无延迟），
  计数 →「排队中 11」
- 失败→成功转换 → 计数实时刷新（「匹配失败 11」→「成功匹配 4 / 匹配失败 7」）
- 点击「成功匹配」芯片 → 仅显示 4 个；「匹配失败」→ 仅 7 个；「已缓存」→ 0
- 过滤与计数幂等，无 DOM 重复累积

## 5. 后续验证建议

1. **真机流式加载**：javdb 列表页滚出瀑布流新页 → 新 item 立即显示「排队中」
   徽标（不再等防抖）
2. **筛选栏同行**：筛选栏位于 `.status-tag-filter-bar` / `.tag-filter-bar`
   旁边，样式协调
3. **实时计数**：预加载过程中芯片计数实时变化（排队中递减、匹配失败/成功递增）
4. **点击过滤**：点「匹配失败」仅显示失败卡片，再点取消；与 jhs 状态标签筛选、
   VideoListsTag 筛选并存（互不干扰隐藏）
5. **排序后保留**：PageSort 按名称排序 → 徽标随节点保留、筛选栏计数重计
6. **SupJav 无徽标**：列表页无 supJav 徽标（initUrl 跳过预加载）
7. **关闭开关**：设置中 enableLoadOtherSite=NO → 无徽标、无筛选栏、无预加载
