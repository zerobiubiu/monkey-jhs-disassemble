# 74. MissAV 状态筛选区功能同步与 Nord 暗色布局升级

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`MissavStatusFilterPlugin`（`src/plugins/missav-status-filter/`）、`src/styles/missav-status-filter/missav-status-filter.css`、`src/core/util/site/filter-chips.ts`
> **前置文档**：`71-filter-interaction-and-always-on-vlt-sync.md`、`73-filter-stack-frameless-canvas.md`
> **替代文档**：无
> **生效版本**：v1.52.0

## 1. 背景

v1.51.0–1.51.2 已为 JavDB 四栏筛选区落地三态包含/排除、左右键双击单选、空白区双击全清以及无背板网格布局；MissAV 端的 `MissavStatusFilterPlugin` 仍停留在仅左键 OR 切换与旧式 flex 样式，缺少右键排除、双击单选、空白区清空、零计数保活及键盘/窄屏适配。需将 MissAV 筛选区功能与 JavDB 保持同步，同时严格遵循 `DESIGN.md` 的 Subsystem-Fidelity Rule，视觉贴合 MissAV Tailwind Nord 暗色主题。

## 2. 方案

1. **复用共享三态引擎**：
   - `filter-chips.ts` 的 `clearFilterContainer` 扩展支持容器自身即已注册筛选栏的单栏场景（除多栏栈 `.jhs-filter-stack` 外，也可直接绑定在 `.missav-status-filter-bar` 自身）。
   - `mstf-apply.ts` 的 `shouldShow` 与 `applyFilter` 升级接受 `ReadonlySet<string> | FilterSelections`，向下兼容旧集合入参同时通过 `matchesIncludeExclude` 支持排除及包含+排除混选。
   - `missav-status-filter-plugin.ts` 全面接入 `bindFilterBarInteraction`、`bindFilterContainerClear`、`initFilterChip`、`collectChipStates`、`readFilterSelections`，实现左键包含、右键排除、左/右键双击单选、空白区双击全清、DOM 变更保活含零计数芯片及取消即清理、Enter/Space 键盘无障碍与 `aria-pressed`（`false` / `true` / `mixed`）。
2. **MissAV Nord 暗色无背板风格**：
   - 保持无背景无外框透贴 MissAV 暗色画布，使用两列 CSS Grid 左齐页面主轴，空芯片时经 `:has(.missav-status-filter-chips:empty)` 自动隐藏。
   - 延续 Nord 暗色系（`#2e3440` / `#3b4252` / `#4c566a` / `#d8dee9` / `#81a1c1` / `#8fbcbb` / `--jhs-color-primary`），新增暗底红洗底 + 危险描边 + 浅红删除线排除态（对比度 > 7:1）、`:has()` 生效行标签轻强调、`@media (width <= 600px)` 窄屏单列堆叠与 `@media (pointer: coarse)` 32px 触控放大。

## 3. 实施清单

- [src/core/util/site/filter-chips.ts](file:///D:/monkey-jhs-disassemble/src/core/util/site/filter-chips.ts)
- [src/plugins/missav-status-filter/mstf-apply.ts](file:///D:/monkey-jhs-disassemble/src/plugins/missav-status-filter/mstf-apply.ts)
- [src/plugins/missav-status-filter/missav-status-filter-plugin.ts](file:///D:/monkey-jhs-disassemble/src/plugins/missav-status-filter/missav-status-filter-plugin.ts)
- [src/styles/missav-status-filter/missav-status-filter.css](file:///D:/monkey-jhs-disassemble/src/styles/missav-status-filter/missav-status-filter.css)
- 测试与元数据：`tests/missav-status-filter.test.ts`、`tests/missav-status-filter-ui.test.ts`、`vite.config.ts`、`package.json`、`CHANGELOG.md`、`docs/plugin-catalog.md`、`docs/README.md`

## 4. 后续验证建议

在真实 MissAV 列表页与搜索页验证：
1. 左键包含、右键排除（不弹浏览器右键菜单）、左右键双击单选、双击状态栏空白处清空并恢复全部缩略图（不留网格空洞）；
2. 桌面与移动端视觉自然融入 MissAV Nord 暗色主题，无多余背板。

## 5. 执行验证记录

### 执行环境
Windows x64、Bun 1.4.5、Node v26.13.1、Vite 8.2.1、Vitest 4.1.10、ESLint 10.8.1、Stylelint 17.14.1、`chrome-devtools` MCP 无头 Chrome。

### 验证命令
1. `chrome-devtools` MCP 渲染本地 MissAV Tailwind Nord 暗色预览页（1280×720 桌面端 + 375×812 触控移动端）视觉验收
2. `bun run build`（`tsc -b && vite build`）及产物头部 `@version` 检查
3. `bun run lint && bun run lint:css`
4. `bun run check:version && bun run check:docs && bun run check:structure && bun run check:selectors`
5. `bun run test tests/missav-status-filter.test.ts tests/missav-status-filter-ui.test.ts tests/filter-chip-interactions.test.ts tests/site-tag-filter.test.ts tests/weekly-recommend-vlt-filters.test.ts tests/weekly-recommend-status-filters.test.ts tests/weekly-recommend-preload-filters.test.ts tests/weekly-recommend-filter-integration.test.ts`

### 实际输出
- 视觉验收：1280×720 桌面端无背板透贴、左边缘与标题/缩略图网格齐平、Nord 暗色芯片与红洗底删除线排除态清晰克制；375×812 触控移动端按 `<= 600px` 正确切换为标签置顶单列堆叠与 32px 触控高度。
- `bun run build`：通过（469 modules，`dist/monkey-jhs-disassemble.user.js` 1,449.63 kB / gzip 371.87 kB，头部 `@version 1.52.0`）。
- `bun run lint` / `bun run lint:css`：0 errors / 0 warnings。
- `bun run check:version` / `check:docs` / `check:structure` / `check:selectors`：全部 `OK`。
- 筛选回归测试套件：**8 个测试文件 / 78 项测试全部通过**（含 MissAV 25 项：单元 22 + UI 接线与三态交互 3）。

### 前端或调用方验证
已通过无头 Chrome 桌面端与触控移动端截图、jsdom 三态交互回归用例完整验证。

### 验证结论
全部静态检查、构建、门禁、视觉复核与单元测试均一次通过。

### 已知限制
视觉验证基于还原 MissAV Nord 暗色骨架的本地预览页，未接入线上真实 MissAV 页面。
