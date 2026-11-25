# 73. 筛选区去背板融入 JavDB 原站画布

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/styles/filter-chip-base.css`（`.jhs-filter-stack` 与 `.jhs-weekly-recommend-filters`）
> **前置文档**：`72-filter-stack-layout-refinement.md`
> **替代文档**：无（修正 doc/72 中的容器背板决策）
> **生效版本**：v1.51.2

## 1. 背景

v1.51.1 为 `.jhs-filter-stack` 添加了浅灰底色（`#fbfcfd` / 暗色 `#1a1a1a`）、外框与圆角容器，实看效果相比 JavDB 扁平直角的原站画布过于突出显眼。需要去掉额外背景与外框，让筛选区直接透贴并自然融入原站页面。

## 2. 方案

- 删除 `.jhs-filter-stack` 与 `.jhs-weekly-recommend-filters` 在明/暗主题下的 `background`、`border`、`border-radius` 与横向 `padding`，保留 `margin-block: 4px 12px` 与下方 `.movie-list` 留出干净间隔；
- 行间分隔线改用与 JavDB `.panel-block` 一致的 `#ededed`（暗色 `#262626`），末行无底线；
- 去背板后四栏标签由右对齐改为左对齐（`justify-self: start`），使「筛选:/状态:/预加载:/标签:」与上方 `.tabs` 及下方 `.movie-list` 共享同一左侧页面主轴，同时经 `subgrid` 维持四行芯片左边缘垂直成线；
- 保留 v1.51.1 的统一暗色芯片、激活态预加载白色圆点、`:has()` 生效行标签强调、`@container` 窄容器单列堆叠与触控目标放大。

## 3. 实施清单

- [src/styles/filter-chip-base.css](file:///D:/monkey-jhs-disassemble/src/styles/filter-chip-base.css)
- 元数据：`vite.config.ts`、`package.json`（v1.51.2）、`CHANGELOG.md`、`docs/README.md`

## 4. 后续验证建议

在 JavDB 真实明/暗主题列表页确认筛选区完全透贴页面底色，左侧与页签/卡片网格严格平齐且芯片左边缘对齐。

## 5. 执行验证记录

### 执行环境
Windows x64、Bun 1.4.5、Vite 8.2.1、Stylelint 17.14.1、`chrome-devtools` MCP 无头 Chrome。

### 验证命令
1. `chrome-devtools` MCP 渲染本地 JavDB 预览页（1280×760 明/暗双主题）测量几何并截图检查
2. `bun run build`（`tsc -b && vite build`）及产物头部 `@version` 检查
3. `bun run lint:css && bun run check:version && bun run check:docs && bun run check:structure`

### 实际输出
- 视觉与 DOM 几何实测：`tabsLeft = 40px`、`cardLeft = 40px`、四栏 `labelLeft` 均为 `40px`（与原站页签和卡片左轴严格齐平），四栏 `chipsLeft` 均为 `92px`，整栈高度进一步收敛至 `155px`；明/暗双主题均无多余背板与外框，直接融入宿主画布。
- `bun run build`：通过（469 modules，`dist/monkey-jhs-disassemble.user.js` 1,445.83 kB / gzip 370.56 kB，头部 `@version 1.51.2`）。
- `bun run lint:css`：0 errors / 0 warnings。
- `bun run check:version` / `check:docs` / `check:structure`：全部 `OK`。

### 前端或调用方验证
已通过无头 Chrome 明/暗双主题截图确认无底透贴效果、左侧齐轴与芯片列对齐。

### 验证结论
全部检查通过，无回归。

### 已知限制
无头 Chrome 截图基于还原 JavDB 骨架的本地预览页，未接入已登录 JavDB 线上会话。
