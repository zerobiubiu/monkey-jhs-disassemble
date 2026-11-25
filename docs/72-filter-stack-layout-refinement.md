# 72. 筛选区 `.jhs-filter-stack` 整体布局精修

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页与首页筛选区栈容器（`body > section > div > div.jhs-filter-stack`）、首页每周推荐浮层筛选区（`.jhs-weekly-recommend-filters`）、四栏筛选芯片明暗双主题与响应式布局
> **前置文档**：`50-filter-bar-order.md`、`70-site-native-tag-filter.md`、`71-filter-interaction-and-always-on-vlt-sync.md`
> **替代文档**：无
> **生效版本**：v1.51.1

## 1. 背景与视觉审计发现

在无头 Chrome（1280×760 明/暗模式、375×812 触控移动端）渲染当前 `.jhs-filter-stack` 实测后，按 `refactoring-ui` Workflow C/D 顺序定位到以下问题：

| # | 维度 | 级别 | 位置 | 规则 | 现状 | 修复方案 |
|---|---|---|---|---|---|---|
| 1 | Color / Dark Mode | P0 | `filter-chip-base.css` | `§5.6` / `DESIGN.md` | 仅第 4 栏「标签:」适配了暗色模式，前 3 栏在 `:root[data-theme='dark']` 下呈刺眼白底芯片与亮白底线，标签文字对比偏暗 | 在共享 `filter-chip-base.css` 统一四栏暗色表面、分隔线、标签与默认/无标签芯片配色，并剔除 `site-tag-filter.css` 中的重复暗色规则 |
| 2 | Color / Visibility | P0 | `preload-status-badge.css` | `§5.7` | 预加载激活芯片（如绿色 `成功匹配`）的状态圆点 `.pf-dot` 与背景同色完全隐身，文字左侧留出空白缺口 | 新增 `.preload-filter-chip.active[data-value] .pf-dot { background-color: #fff; }` 恢复圆点可见性 |
| 3 | Layout & Alignment | P1 | `filter-chip-base.css` | `§3.6` / `css-layout §3` | 四行各自独立 `flex`，因「预加载:」3 字比其余 2 字标签宽 13px，导致芯片左边缘错位（82px vs 95px） | 栈容器改用 `display: grid; grid-template-columns: max-content minmax(0, 1fr)` + `@supports (grid-template-columns: subgrid)`，四行右对齐冒号、芯片左边缘统一对齐 |
| 4 | Layout & Spacing | P1 | `filter-chip-base.css` | `§3.6` / `§8.4` / `§8.5` | `.jhs-filter-stack` 无自身容器边界与外边距，四行直接贴紧上方 `.tabs` 与下方 `.movie-list`（外距 0 < 内行距 20px），且末行保留多余底线 | 建立边车工具面板容器（`#fbfcfd` 底 + 1px 描边 + 6px 圆角 + `margin-block: 10px 14px`），行内对称 `padding-block: 6px`，末行去底线，空栈 `:empty { display: none }` |
| 5 | Typography & Responsive | P1 | `filter-chip-base.css` | `§3.5.1` / `§4.4` / `css-layout §4` | 芯片混合 `inline-block`/`inline-flex`、无 `tabular-nums`；375px 移动端左侧标签列挤占所有折行宽度 | 统一四栏芯片为 `inline-flex` / 12px / `min-height: 26px` / `tabular-nums`；新增 `@container jhs-filter-stack (inline-size <= 520px)` 单列堆叠与 `@media (pointer: coarse)` 32px 触控高度 |
| 6 | Hierarchy & Hover | P2 | `filter-chip-base.css` | `§2.4` / `DESIGN.md` | 四栏行标签无生效状态区分；清单/状态激活态悬停无反馈 | 利用 `:has()` 仅在有包含/排除条件的行加深标签字色，未激活行保持次级灰；统一四栏未选悬停与激活态 `opacity: 0.9` 悬停反馈 |

## 2. 实施清单

- [src/styles/filter-chip-base.css](file:///D:/monkey-jhs-disassemble/src/styles/filter-chip-base.css)：新增 `.jhs-filter-stack` 与 `.jhs-weekly-recommend-filters` 共享网格容器、subgrid 列对齐、`:has()` 生效行标签强调、统一芯片规格、四栏全量暗色主题、窄容器 `@container` 单列切换及 `@media (pointer: coarse)` 触控放大。
- [src/styles/preload-status-badge.css](file:///D:/monkey-jhs-disassemble/src/styles/preload-status-badge.css)：修复激活态 `.pf-dot` 与背景同色消失问题，复用共享 `inline-flex` 与 `gap`。
- [src/styles/site-tag-filter/site-tag-filter.css](file:///D:/monkey-jhs-disassemble/src/styles/site-tag-filter/site-tag-filter.css)：移除已上收至共享基础的暗色默认/排除态重复规则，仅保留按钮重置与本栏专属 active 配色。
- [src/styles/list-page/weekly-recommend.css](file:///D:/monkey-jhs-disassemble/src/styles/list-page/weekly-recommend.css)：移除与共享容器冲突的 `.jhs-weekly-recommend-filters` 旧 flex 规则，与主列表筛选区视觉同构。
- 版本与元数据：`vite.config.ts`、`package.json`（v1.51.0 → v1.51.1）、`CHANGELOG.md`、`docs/README.md`。

## 3. 后续验证建议

在真实 JavDB 列表页（明色与暗色主题）及手机窄屏下检查：
1. `.jhs-filter-stack` 四栏冒号与芯片左边缘保持一条垂直基线，与上方 `.tabs` 和下方 `.movie-list` 有清晰留白；
2. 暗色模式下四栏视觉完全统一，预加载激活芯片圆点清晰可见；
3. 空白处（容器内非芯片区域）双击仍可清空四栏条件；手机窄屏下标签自动置顶、芯片占满全宽。

## 4. 执行验证记录

### 执行环境
Windows x64、Bun 1.4.5、Node v26.13.1、Vite 8.2.1、Vitest 4.1.10、ESLint 10.8.1、Stylelint 17.14.1、`chrome-devtools` MCP 无头 Chrome。未安装任何新依赖。

### 验证命令
1. `chrome-devtools` MCP 渲染基于真实 `src/styles/*.css` 拼装的 JavDB 列表页预览（1280×760 明色、1280×760 暗色、375×812 触控移动端）并测量 DOM 几何与截图像素
2. `bun run build`（`tsc -b && vite build`）及产物头部 `@version` 校验
3. `bun run lint && bun run lint:css`
4. `bun run check:version && bun run check:docs && bun run check:structure && bun run check:selectors`
5. `bun run test tests/filter-chip-interactions.test.ts tests/vlt-live-sync.test.ts tests/site-tag-filter.test.ts tests/list-mount.test.ts tests/weekly-recommend-vlt-filters.test.ts tests/weekly-recommend-status-filters.test.ts tests/weekly-recommend-preload-filters.test.ts tests/weekly-recommend-filter-integration.test.ts tests/weekly-recommend-filter-boundary.test.ts tests/weekly-recommend-card-adapters.test.ts tests/weekly-recommend-isolation.test.ts`

### 实际输出
- 视觉渲染与 DOM 几何实测（1280×760 明/暗模式）：
  - 四栏 `labelRight` 全部为 `93px`、`chipsLeft` 全部为 `105px`（优化前为 `82 / 82 / 95 / 82px` 错位 13px）；
  - 四栏首行芯片中心与标签中心完全重合（`144 / 183 / 222 / 261px`，误差 0px），芯片高度统一 `26px`，整栈高度由 `188px` 收敛至 `169px`；
  - 暗色模式四栏视觉完全统一；预加载激活态 `.pf-dot` 清晰呈白色圆点；
  - 375×812 触控移动端下 `@container` 正确切换为标签置顶单列堆叠、芯片占满全宽并启用 `32px` 触控高度（像素审查顺带发现并修正了首版 `@container` 选择器特异性低于 `@supports` subgrid 规则的问题）。
- `bun run build`：通过（469 modules，`dist/monkey-jhs-disassemble.user.js` 1,446.04 kB / gzip 370.54 kB，头部 `@version 1.51.1`）。
- `bun run lint` / `bun run lint:css`：均通过，0 errors / 0 warnings。
- `bun run check:version`：`OK (userscript 1.51.1 = package.json 1.51.1)`。
- `bun run check:docs`：`OK (44 plugins [5 flagged], 70 core files)`。
- `bun run check:structure`：`OK (426 files, 71 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`。
- `bun run check:selectors`：`OK (81 files, 241 literals; 10 file(s) below baseline)`。
- 定向筛选测试套件：**11 个测试文件 / 92 项测试全部通过**。

### 前端或调用方验证
已通过无头 Chrome 在桌面明色（1280×760）、桌面暗色（1280×760）与手机触控端（375×812, DPR 2, touch）完成前后像素对比验证。

### 验证结论
全部视觉审查项、样式门禁、构建与测试均通过，可投入真实站点验收。

### 已知限制
无头 Chrome 视觉验证基于还原 JavDB Bulma 骨架与真实项目 CSS 的本地预览页，未接入已登录 JavDB 线上会话。
