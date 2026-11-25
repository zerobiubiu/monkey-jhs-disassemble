# 70. 站点原生卡片标签实时筛选器（SiteTagFilterPlugin）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：JavDB 影片列表页与首页筛选栏栈（`jhs-filter-stack`）、首页每周推荐浮层筛选、多栏交集显隐协同
> **前置文档**：`50-filter-bar-order.md`、`62-weekly-recommend-scoped-filters.md`
> **替代文档**：无
> **生效版本**：v1.50.0

## 1. 背景

JavDB 列表卡片 `.item` 的 `a > div.tags.has-addons` 内承载站点自身的属性标签（如「含磁鏈」「含中字磁鏈」「今日新種」「昨日首種」「可播放」等，随页面类型与界面语言变化，且并非每张卡片都带标签）。同时本脚本也会将状态标签（`.status-tag`，如 ⭐ 已收藏 / 👀 已观看 / 🚫 已屏蔽）与批量勾选框（`label.jhs-lp-batch-item`）追加到该容器内，或在无原生标签槽的推荐卡片中创建 `.jhs-status-tags` 兜底容器。

此前列表页已有三根筛选栏：清单（`筛选:`）、脚本状态与星级（`状态:`）、外站预加载（`预加载:`），尚缺针对站点原生卡片标签的独立筛选能力。

## 2. 方案与设计决策

1. **站点原生选择器单点注册**：
   - 在 `src/core/util/site/selectors.ts` 新增 `listNativeTag: '.tags.has-addons:not(.jhs-status-tags) > span:not(.status-tag)'`。
   - 采集同一卡片容器下的全部原生 `span`（对单原生标签卡片与 `span:nth-child(1)` 完全等价；对同时带「含磁鏈」「昨日首種」等多标签卡片不会漏采第二个原生标签），并严格排除扩展注入的 `.status-tag`、兜底容器 `.jhs-status-tags` 及 `<label class="jhs-lp-batch-item">`。
2. **不预设标签名单，完全实时动态渲染**：
   - 新增独立插件 `SiteTagFilterPlugin`（`src/plugins/site-tag-filter/`），按职责拆为采集（`stgf-collect.ts`）、应用（`stgf-apply.ts`）、UI（`stgf-ui.ts`）与插件生命周期入口（`site-tag-filter-plugin.ts`），仅在 `['list', 'home']` 且 `isVideoListContext()` 生效。
   - 扫描当前范围内未屏蔽卡片（跳过 `data-hide`），单卡去重统计原生标签与无原生标签卡片数。
   - 空态克制：整页无任何原生标签且无激活芯片时不挂载空栏；存在无原生标签卡片（或已选中 `no-tag`）时在首位显示虚线「无标签」芯片；已选芯片计数归零时保留 0 计数芯片供取消，取消后自动清理过期芯片或收起空栏。
   - 监听 `document.body` 的卡片/标签容器变动、`characterData` 与卡片 `data-hide` 属性变动（忽略自身筛选栏 DOM，150ms 防抖），兼容瀑布流翻页与异步渲染。
3. **四栏栈排序与主列表/浮层严格交集协同**：
   - `FILTER_BAR_PRIORITY` 扩展为 `{ vlt: 10, status: 20, preload: 30, siteTag: 40 }`，新栏前缀为 `标签:`，沿用 `filter-chip-base.css` 共享芯片视觉并用 `<button type="button" aria-pressed>` + `var(--jhs-color-primary-hover)` 实底白字（对比度 4.87:1 ≥ WCAG AA 4.5:1），兼顾暗色主题。
   - `filter-scope.ts` 的 `HIDDEN_ATTRIBUTES` 与 `osp-filter-bar.ts` 的 `OTHER_HIDDEN_ATTRS` 补齐 `data-site-tag-hidden`，新增 `isHiddenByUnknownScript()` 保护未知外部隐藏；主页面下清单/状态/预加载/原生标签四栏统一通过 `reconcileFilterVisibility()` 维护各自标记并按交集显隐，任意顺序点选或取消互不覆盖。
   - `WeeklyRecommendFilters` 同步接入 `refreshSiteTagFilterBar(this.scope)`，销毁时清理 `data-site-tag-hidden` 且保留 `data-hide`。

## 3. 实施清单

- **新增源码**：
  - `src/plugins/site-tag-filter/stgf-collect.ts`
  - `src/plugins/site-tag-filter/stgf-apply.ts`
  - `src/plugins/site-tag-filter/stgf-ui.ts`
  - `src/plugins/site-tag-filter/site-tag-filter-plugin.ts`
  - `src/styles/site-tag-filter/site-tag-filter.css`
- **修改源码**：
  - `src/core/util/site/selectors.ts`（新增 `listNativeTag`）
  - `src/core/util/site/list-mount.ts`（`FILTER_BAR_PRIORITY.siteTag = 40`）
  - `src/core/util/site/filter-scope.ts`（`HIDDEN_ATTRIBUTES` 新增 `data-site-tag-hidden` + `isHiddenByUnknownScript`）
  - `src/styles/filter-chip-base.css`（新增 `.jhs-site-tag-filter-*` 分组选择器）
  - `src/plugins/other-site/osp-filter-bar.ts`、`src/plugins/status-tag-filter/stf-apply.ts`、`src/plugins/video-lists-tag/vlt-filter-apply.ts`（主列表交集协同）
  - `src/plugins/list-page/weekly-recommend-filters.ts`（推荐浮层接入与清理）
  - `src/plugins/plugin-registry.ts`、`src/main.tsx`（注册 `SiteTagFilterPlugin`）
- **测试与元数据**：
  - `tests/site-tag-filter.test.ts`（新增 8 项回归用例）
  - `tests/list-mount.test.ts`（更新四栏入栈顺序断言）
  - `vite.config.ts`、`package.json`、`CHANGELOG.md`、`docs/plugin-catalog.md`、`docs/README.md`、`AGENTS.md`

## 4. 后续验证建议

在真实已登录 JavDB 列表页（如首页 `/`、`/censored`、演员页、排行榜）安装构建产物 `dist/monkey-jhs-disassemble.user.js` 后验证：
1. 卡片同时带「含磁鏈 / 含中字磁鏈 / 昨日首種」与「⭐ 已收藏」时，「标签:」栏只渲染站点原生标签与「无标签」，不混入收藏/已观看标签；
2. 滚动触发瀑布流加载下一页后，新出现的原生标签自动渲染且已激活筛选自动作用于新卡片；
3. 与「筛选: / 状态: / 预加载:」组合勾选及按任意顺序取消，列表结果始终为精确交集；
4. 打开首页「每周推荐」浮层，确认推荐内若有原生标签可独立筛选且不影响主列表。

## 5. 执行验证记录

### 执行环境
Windows x64、Bun 1.4.5、Node v26.13.1、Vite 8.2.1、Vitest 4.1.10、ESLint 10.8.1、Stylelint 17.14.1。未安装任何新依赖。

### 验证命令
1. `bun run build`（`tsc -b && vite build`）及产物头部 `@version` 检查
2. `bun run lint && bun run lint:css`
3. `bun run check:version && bun run check:docs && bun run check:structure && bun run check:selectors`
4. `bun run test tests/site-tag-filter.test.ts tests/list-mount.test.ts tests/weekly-recommend-filter-integration.test.ts tests/weekly-recommend-status-filters.test.ts tests/weekly-recommend-vlt-filters.test.ts tests/weekly-recommend-preload-filters.test.ts tests/weekly-recommend-filter-boundary.test.ts tests/weekly-recommend-isolation.test.ts`
5. `NODE_OPTIONS="--localstorage-file=<temp>" bun run test`（全量回归摸底）

### 实际输出
- `bun run build`：通过（468 modules，`dist/monkey-jhs-disassemble.user.js` 1,435.30 kB / gzip 367.72 kB，头部 `@version 1.50.0`；第三方 `layer.css` 的既有 lightningcss IE hack 告警不影响构建）。
- `bun run lint` / `bun run lint:css`：均通过，0 errors / 0 warnings。
- `bun run check:version`：`OK (userscript 1.50.0 = package.json 1.50.0)`。
- `bun run check:docs`：`OK (44 plugins [5 flagged], 69 core files)`。
- `bun run check:structure`：`OK (425 files, 71 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`。
- `bun run check:selectors`：`OK (81 files, 241 literals; 10 file(s) below baseline)`。
- 定向筛选套件：8 个测试文件 / **67 项测试全部通过**（含新增 `tests/site-tag-filter.test.ts` 8 项与 `tests/list-mount.test.ts` 四栏入栈断言）。
- 全量套件摸底：76 / 77 文件（946 / 948 项）通过；未通过的 2 项集中在无关的 `tests/setting/backup-extra-restore.test.ts`（Node v26 原生 `localStorage` 与 `Storage.prototype.setItem` spy 差异）。

### 前端或调用方验证
通过 jsdom 对真实 DOM 结构（含 `div.tags.has-addons > span` 多原生标签、脚本注入 `.status-tag`、`.jhs-status-tags` 兜底容器、批量勾选框、瀑布流动态追加、主列表四栏交集、每周推荐浮层隔离及 `aria-pressed` 同步）完成自动化端到端断言。

### 验证结论
新增插件、样式、多栏交集协同、注册表与文档门禁全部通过，构建产物版本号一致。

### 已知限制
- 未在登录态真实 JavDB 线上页面实测；多语言或特殊榜单页面的真实渲染效果建议按 §4 在浏览器中抽查。
- 当前本机 Node v26.13.1 环境下全量 Vitest 在 `tests/setting/backup-extra-restore.test.ts` 存在 2 项既有的 `localStorage` 原型 spy 环境差异（非本次改动引起）。
