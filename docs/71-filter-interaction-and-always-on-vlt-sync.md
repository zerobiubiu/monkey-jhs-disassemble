# 71. 四栏三态筛选交互升级与清单标签永久实时同步架构重构

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页与首页筛选栏栈（`jhs-filter-stack`：筛选 / 状态 / 预加载 / 标签）、首页每周推荐浮层筛选、视频清单标签跨标签页实时同步架构
> **前置文档**：`50-filter-bar-order.md`、`62-weekly-recommend-scoped-filters.md`、`70-site-native-tag-filter.md`
> **替代文档**：无
> **生效版本**：v1.51.0

## 1. 背景

1. 清单筛选栏（`.jhs-vlt-filter-bar`）原从独立油猴脚本继承了 `<details>` 筛选模式下拉（`包含任意一个 / 全都包含 / 不包含以下标签 / 不包含以下任意一个`）与 `<label>` 自动刷新开关（`jdb:auto-refresh-enabled`）。
   - 模式下拉只对清单栏有效、与其余三栏交互割裂，且需要额外切模式才能排除特定标签；
   - 自动刷新开关在日常使用中始终需要保持开启，却导致 `VltTags` 类承担了 `GM_getValue`/`GM_setValue` 状态读写与广播监听委托，`vlt-sync-listener.ts` 也因此反向耦合 `VltTags`，且旧的全局 500ms 防抖窗口在并发批量清单操作或多标签页连续勾选时会静默吞掉其他番号的同步事件。
2. 需要移除上述两个旧控件及全部相关逻辑，在「筛选 / 状态 / 预加载 / 标签」四栏统一落地「左键包含 / 右键排除 / 四栏独立双击单选 / 空白区双击清空全部过滤条件」交互，并按「自动刷新永久开启」的既定不变量重构清单标签实时同步架构。

## 2. 方案与设计决策

### 2.1 四栏共享三态筛选交互引擎（`src/core/util/site/filter-chips.ts`）

抽离单一权威交互引擎，被清单（`vlt`）、状态（`status`）、预加载（`preload`）、原生标签（`siteTag`）四栏复用（含首页每周推荐浮层独立作用域）：

- **三态模型**：`none` / `include` / `exclude`。兼容保留各栏既有激活类名（`.jhs-vlt-active` / `.active`），新增共享排除类名 `.jhs-filter-excluded` 与 `data-filter-state` 属性，同步 `aria-pressed`（`false` / `true` / `mixed`），并为非原生 `<button>` 芯片补齐 `role="button"`、`tabindex="0"` 与 `Enter`（`keydown`）/`Space`（`keyup`）键盘交互。
- **手势约定**：
  - **左键单击**：切换包含态（未选/排除 → 包含；已包含 → 取消）。
  - **右键单击**（仅命中芯片时 `preventDefault()` 拦截浏览器右键菜单，空白区保留原生菜单）：切换排除态（未选/包含 → 排除；已排除 → 取消）。
  - **左键双击芯片**：清空本栏其余芯片状态，仅保留该芯片为「包含」；`stopPropagation()` 且不影响其他三栏。
  - **右键双击芯片**：由于浏览器不为右键触发原生 `dblclick`，以 350ms 时间窗识别同栏同芯片连续两次 `contextmenu`（亦兼容 `event.detail >= 2`），清空本栏其余芯片状态并仅保留该芯片为「排除」，不影响其他三栏。
  - **空白区双击全清**：由 `list-mount.ts`（`.jhs-filter-stack`）与 `filter-scope.ts`（`scope.mount`）幂等绑定 `bindFilterContainerClear()`；在容器内非芯片/非交互控件区域双击时，两阶段清空该容器内所有已注册筛选栏（第一遍统一起清芯片态并移除四栏隐藏标记、按交集恢复可见；第二遍统一刷新预加载可见计数并清理过期零计数芯片），且绝不误恢复 `data-hide` / `data-lrs-hidden` 与未知脚本隐藏。
- **统一匹配规则（`matchesIncludeExclude`）**：命中任意排除项即隐藏；存在包含项时需命中至少一项包含项（OR）；同栏混选包含与排除时按「包含且不命中排除」结算（如状态栏左键「已观看」+ 右键排除「0星」，标签栏左键「含磁鏈」+ 右键排除「含中字磁鏈」）。
- **推荐浮层双击防撕裂**：`WeeklyRecommendFilters` 改听冒泡自定义事件 `jhs-filter-change`，仅合批刷新预加载栏可见计数，不再重建正在被单/双击交互的其他筛选栏芯片 DOM。
- **视觉表态**：共享 `filter-chip-base.css` 定义排除态（洗底 `#fee2e2` + 危险描边 `#dc2626` + 深红 `#b91c1c` 删除线，对比度 5.16:1 ≥ WCAG AA 4.5:1，暗色模式同步适配），依靠颜色与删除线双通道表态，与预加载「匹配失败」的实底红包含态明确区分；四栏容器加 `user-select: none` 避免空白区双击高亮标题文本。

### 2.2 永久实时同步架构重构（`video-lists-tag/` + `broadcast.ts`）

- **移除开关与旧状态**：删除 `AUTO_REFRESH_KEY`、`autoRefreshEnabled`、`loadAutoRefreshState()`、`saveAutoRefreshState()`、`currentFilterMode`、`FILTER_MODES`、`buildFilterModeDropdown()`、`VltTags.setupAutoRefreshListener()` 及对应的 DOM 和 CSS（含 `accessibility.css` 中的两条减动选择器）。
- **解耦同步订阅与精准去重**：`src/core/util/broadcast.ts` 的 `broadcastSubscribe` 新增可选 `signal?: AbortSignal`，插件销毁时自动卸载 `document`/`window` 监听并屏蔽后续 GM 回调；`vlt-sync-listener.ts` 彻底解除对 `VltTags` 的依赖，提供 `shouldProcessTagSync`、`createTagSyncDeduper`（带 `time` 按 `(designation, action, association, time)` 跨通道回声精确去重，无 `time` 按番号独立窗口去重，不再误吞并发多番号更新）与 `subscribeTagSync`。
- **合批刷新与在途续跑**：`VltTags` 新增 `refreshDesignations(designations)`（多番号合并为单次 `VltDb.queryMoviesLists` 查询、只重绘变化卡片并单次更新筛选栏）、`queueDesignationRefresh(designation)`（50ms 窗口合批 + 在途期间新到番号自动续跑下一轮，确保零丢失）与 `destroy()`（清理挂起定时器与队列）。
- **插件壳统一收口**：`VideoListsTagPlugin.setupLiveRefresh()` 统一接线 DOM `MutationObserver`、`WEEKLY_RECOMMEND_ITEMS_EVENT`、`setupListMgmtBroadcastListener` 与 `subscribeTagSync`，全链路绑定 `this.supervisor.signal`。

## 3. 实施清单

- **新增源码**：
  - `src/core/util/site/filter-chips.ts`（四栏共享三态筛选交互、匹配与空白区清空引擎）
- **修改源码**：
  - `src/core/util/broadcast.ts`（`broadcastSubscribe` 支持可选 `AbortSignal`）
  - `src/core/util/site/list-mount.ts`、`src/core/util/site/filter-scope.ts`（绑定栈容器与独立作用域的空白区双击清空）
  - `src/plugins/video-lists-tag/vlt-sync-listener.ts`、`vlt-remote-sync.ts`、`vlt-tags.ts`、`vlt-plugin.ts`（永久实时同步重构、跨通道精准去重、合批刷新与生命周期回收）
  - `src/plugins/video-lists-tag/vlt-filter-bar.ts`、`vlt-filter-apply.ts`（移除模式下拉与自动刷新开关，接入共享三态筛选）
  - `src/plugins/status-tag-filter/stf-ui.ts`、`stf-apply.ts`（接入共享三态筛选与零计数清理）
  - `src/plugins/other-site/osp-filter-bar.ts`（接入共享三态筛选）
  - `src/plugins/site-tag-filter/stgf-ui.ts`、`stgf-apply.ts`（接入共享三态筛选与零计数清理）
  - `src/plugins/list-page/weekly-recommend-filters.ts`（改听 `jhs-filter-change` 仅刷新预加载可见计数）
  - `src/styles/filter-chip-base.css`、`src/styles/video-lists-tag.css`、`src/styles/accessibility.css`、`src/styles/site-tag-filter/site-tag-filter.css`
- **测试与元数据**：
  - 新增 `tests/filter-chip-interactions.test.ts`、`tests/vlt-live-sync.test.ts`
  - 更新 `tests/weekly-recommend-vlt-filters.test.ts`、`tests/weekly-recommend-card-adapters.test.ts`
  - 更新 `vite.config.ts`、`package.json`、`CHANGELOG.md`、`docs/plugin-catalog.md`、`docs/README.md`、`AGENTS.md`

## 4. 后续验证建议

在真实已登录 JavDB 列表页（如首页 `/`、`/censored`、演员页）安装构建产物 `dist/monkey-jhs-disassemble.user.js` 后验证：
1. `.jhs-vlt-filter-bar` 中不再出现模式下拉（`<details>`）与自动刷新开关（`<label>`）；
2. 在「筛选 / 状态 / 预加载 / 标签」四栏分别验证：左键单击包含、右键单击排除（无浏览器右键菜单）、左/右键双击仅重置当前栏并单选该项（不改变另外三栏）；
3. 双击 `.jhs-filter-stack` 空白处确认四栏条件一次清空且不误恢复已屏蔽卡片；首页「每周推荐」浮层内验证独立交互与空白双击全清；
4. 在另一标签页或详情弹窗连续勾选/取消多部影片的清单，列表页卡片标签与筛选栏实时自动刷新且不丢更新。

## 5. 执行验证记录

### 执行环境
Windows x64、Bun 1.4.5、Node v26.13.1、Vite 8.2.1、Vitest 4.1.10、ESLint 10.8.1、Stylelint 17.14.1。未安装任何新依赖。

### 验证命令
1. `bun run build`（`tsc -b && vite build`）及产物头部 `@version` 校验
2. `bun run lint && bun run lint:css`
3. `bun run check:version && bun run check:docs && bun run check:structure && bun run check:selectors`
4. `bun run test tests/filter-chip-interactions.test.ts tests/vlt-live-sync.test.ts tests/site-tag-filter.test.ts tests/list-mount.test.ts tests/weekly-recommend-vlt-filters.test.ts tests/weekly-recommend-status-filters.test.ts tests/weekly-recommend-preload-filters.test.ts tests/weekly-recommend-filter-integration.test.ts tests/weekly-recommend-filter-boundary.test.ts tests/weekly-recommend-card-adapters.test.ts tests/weekly-recommend-isolation.test.ts`
5. `NODE_OPTIONS="--localstorage-file=<temp>" bun run test`（全量回归摸底）

### 实际输出
- `bun run build`：通过（469 modules，`dist/monkey-jhs-disassemble.user.js` 1,440.21 kB / gzip 369.27 kB，头部 `@version 1.51.0`；第三方 `layer.css` 的既有 lightningcss IE hack 告警不影响构建）。
- `bun run lint` / `bun run lint:css`：均通过，0 errors / 0 warnings。
- `bun run check:version`：`OK (userscript 1.51.0 = package.json 1.51.0)`。
- `bun run check:docs`：`OK (44 plugins [5 flagged], 70 core files)`。
- `bun run check:structure`：`OK (426 files, 71 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`。
- `bun run check:selectors`：`OK (81 files, 241 literals; 10 file(s) below baseline)`。
- 定向筛选与实时同步套件：**11 个测试文件 / 92 项测试全部通过**（含新增 `tests/filter-chip-interactions.test.ts` 10 项与 `tests/vlt-live-sync.test.ts` 5 项）。
- 全量套件摸底：78 / 79 文件（961 / 963 项）通过；未通过的 2 项为与本次改动无关的既有限制 `tests/setting/backup-extra-restore.test.ts`（Node v26 原生 `localStorage` 与 `Storage.prototype.setItem` spy 差异，同 `doc/70` 记录）。

### 前端或调用方验证
已通过 jsdom 完整覆盖四栏左键包含、右键排除（含阻止默认菜单）、同栏包含+排除混合、四栏独立左/右键双击单选、`.jhs-filter-stack` 与每周推荐浮层空白区双击全清、键盘 Enter/Space 及 ARIA `aria-pressed` 同步、跨通道同步回声去重、多番号 50ms 合批查询与在途续跑、以及 `destroy()` 生命周期清理；未在真实登录态浏览器中直接渲染截图。

### 验证结论
全部静态检查、构建、目录/文档/版本/选择器门禁及 11 个相关测试文件（92 项）均一次通过，可投入真实站点安装验收。

### 已知限制
1. 未在真实已登录 JavDB 浏览器会话中做像素级视觉截图验证；需按 §4 在真实页面确认暗色/浅色主题下的排除态芯片显示与右键双击手感。
2. 全量测试在 Node v26 下的 2 项无关 `backup-extra-restore` 用例因宿主 `localStorage` 原型差异仍存在，与本轮变更无关。
