---
name: JavDB Power Tools
description: 注入 JavDB / MissAV 的工具型增强层——克制、并行、状态可信
colors:
  # ───── 品牌与核心令牌层（src/styles/design-tokens.css）─────
  primary: "#5d87c2"
  primary-hover: "#4a73b0"
  primary-wash: "#e8eef6"
  primary-bright: "#4a90d9"
  # ───── 语义状态（令牌层）─────
  success: "#64bb69"
  warning: "#d7a80c"
  error: "#de3333"
  info: "#25b1dc"
  switch-on: "#22c55e"
  danger-strong: "#ef4444"
  # ───── Bulma 品牌族（原站同构，站点自带语义）─────
  bulma-link: "#3273dc"
  bulma-link-alt: "#485fc7"
  bulma-success: "#48c774"
  bulma-success-deep: "#2fb972"
  bulma-success-soft: "#48c78e"
  bulma-danger: "#f14668"
  # ───── 列表面板族（rating-bar / list-reflow 的局部令牌）─────
  list-ink: "#2f3540"
  list-ink-soft: "#3d4652"
  list-scan: "#596574"
  list-border: "#dfe4ea"
  list-muted: "#5f6b7a"
  list-surface: "#fff"
  list-subtle: "#f6f8fa"
  # ───── Flat-UI 族（日志面板专用；独立子系统）─────
  flatui-shell: "#2c3e50"
  flatui-shell-hover: "#34495e"
  flatui-accent: "#3498db"
  flatui-accent-deep: "#2980b9"
  flatui-link: "#337ab7"
  flatui-muted: "#7f8c8d"
  flatui-faint: "#95a5a6"
  flatui-error: "#e74c3c"
  flatui-warn: "#f39c12"
  flatui-track: "#ecf0f1"
  # ───── Nord 暗色族（MissAV 专用；站点是 Tailwind nord 暗色主题）─────
  nord0: "#2e3440"
  nord1: "#3b4252"
  nord3: "#4c566a"
  nord4: "#d8dee9"
  nord-frost: "#81a1c1"
  nord-aurora: "#8fbcbb"
  nord-faint: "#7c8794"
  # ───── 预加载状态语义族（preload-status-badge / 清单阅读状态）─────
  status-queued: "#8a8a8a"
  status-requesting: "#d97706"
  status-success: "#198754"
  status-success-deep: "#157347"
  status-failed: "#dc2626"
  status-success-alt: "#4caf50"
  status-success-alt-deep: "#1f7a3d"
  status-error-alt: "#f44336"
  status-warn-alt: "#ff9800"
  # ───── 评分族 ─────
  rating-gold: "#ffc107"
  rating-orange: "#f57c00"
  rating-amber: "#f59e0b"
  rating-amber-soft: "#f5b301"
  rating-amber-pale: "#ffce3a"
  # ───── 强调/告警（页面级）─────
  accent-orange: "#ff8400"
  danger-deep: "#b91c1c"
  danger-mid: "#dc3545"
  danger-alt: "#cc4444"
  danger-strong-alt: "#d32f2f"
  danger-dark: "#8d2929"
  danger-dark-soft: "#a32626"
  danger-css-kw: "#c00"
  link-bootstrap: "#007bff"
  link-bootstrap-alt: "#0d6efd"
  link-deep: "#0d47a1"
  link-strong: "#1976d2"
  link-blue-alt: "#2196F3"
  link-blue-deep: "#234f96"
  link-sky: "#0369a1"
  # ───── 浅色洗底（Bulma is-light 药丸 + Tailwind 50/100 阶）─────
  wash-blue: "#e0f2fe"
  wash-blue-mid: "#bae6fd"
  wash-green: "#dcfce7"
  wash-green-mid: "#bbf7d0"
  wash-red: "#fee2e2"
  wash-red-mid: "#fecaca"
  wash-orange: "#ffedd5"
  wash-orange-mid: "#fed7aa"
  wash-amber: "#fff3cd"
  wash-amber-soft: "#fffbeb"
  wash-red-soft: "#fef2f2"
  wash-green-soft: "#f0fdf4"
  wash-amber-body: "#725500"
  green-deep: "#166534"
  orange-deep: "#9a3412"
  accent-pink: "#d25a88"
  accent-mint: "#85d0a3"
  accent-lime: "#aade66"
  # ───── Tailwind slate 辅助灰阶（设置面板；见 Colors 收敛规则）─────
  slate-900: "#27313c"
  slate-ink: "#1e293b"
  slate-body: "#334155"
  slate-muted: "#64748b"
  slate-faint: "#94a3b8"
  slate-edge: "#cbd5e1"
  slate-edge-deep: "#d1d5db"
  slate-divider: "#f1f5f9"
  slate-subtle: "#f8fafc"
  slate-mist: "#e0e0e0"
  # ───── 中性灰阶（实测 18 阶；见 Neutral 收敛规则）─────
  grey-000: "#000000"
  grey-100: "#333333"
  grey-200: "#555555"
  grey-300: "#666666"
  grey-400: "#888888"
  grey-500: "#b5b5b5"
  grey-600: "#cccccc"
  grey-700: "#d0d0d0"
  grey-750: "#dddddd"
  grey-800: "#e9e9e9"
  grey-850: "#eeeeee"
  grey-900: "#f0f0f0"
  paper-hover: "#f5f5f5"
  paper-warm: "#f9f9f9"
  paper-soft: "#f8f9fa"
  paper-cool: "#fbfcfd"
  paper: "#ffffff"
  hairline: "#e2e8f0"
  hairline-soft: "#edf0f4"
  hairline-mist: "#edf0f3"
  ink: "#363636"
  ink-secondary: "#6c757d"
  ink-muted: "#999999"
  ink-faint: "#938585"
  ink-blush: "#cabdbd"
  ink-pinkish: "#d4cece"
  # ───── 半透明黑（覆盖/遮罩层）─────
  scrim-05: "rgb(0 0 0 / 0.05)"
  scrim-08: "rgb(0 0 0 / 0.08)"
  scrim-10: "rgb(0 0 0 / 0.10)"
  scrim-20: "rgb(0 0 0 / 0.20)"
  scrim-40: "rgb(0 0 0 / 0.40)"
  scrim-70: "rgb(0 0 0 / 0.70)"
  scrim-88: "rgb(0 0 0 / 0.88)"
typography:
  # 意图斜坡（新增代码只允许这 5 阶）
  headline:
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
  # 实测普查阶（存量；不在意图斜坡内，新增不得使用，见 Five-Size Rule）
  census-10:
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.5
  census-15:
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
  census-17:
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  census-18:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  census-20:
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.5
  census-22:
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.3
  census-24:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  census-26:
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.3
  census-50:
    fontSize: "50px"
    fontWeight: 300
    lineHeight: 1.2
  mono:
    fontFamily: "Consolas, Monaco, 'Andale Mono', monospace"
    fontSize: "12px"
    lineHeight: 1.5
  # 局部浮层系统栈（仅限完全浮于页面之上的浮层）
  stack-segoe:
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  stack-apple:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    lineHeight: 1.4
  stack-arial:
    fontFamily: "Arial, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  stack-helvetica:
    fontFamily: "\"Helvetica Neue\", \"Luxi Sans\", \"DejaVu Sans\", Tahoma, \"Hiragino Sans GB\", \"Microsoft Yahei\", sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
rounded:
  # 意图斜坡
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
  # 实测普查阶（存量）
  census-2: "2px"
  census-3: "3px"
  census-5: "5px"
  census-7: "7px"
  census-9: "9px"
  census-10: "10px"
  census-11: "11px"
  census-12: "12px"
  census-15: "15px"
  census-20: "20px"
  pill: "50rem"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
components:
  button-panel:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "34px"
  button-panel-danger:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "34px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  button-toolbar:
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    width: "80px"
  chip-filter:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0.25em 0.7em"
  chip-filter-nord:
    backgroundColor: "{colors.nord0}"
    textColor: "{colors.nord4}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0.25em 0.7em"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "36px"
  input-switch:
    backgroundColor: "{colors.slate-edge-deep}"
    rounded: "{rounded.full}"
    size: "40px 22px"
  nav-side-item:
    textColor: "{colors.slate-muted}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "11px 16px"
    width: "170px"
  badge-status:
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.lg}"
    padding: "1px 7px"
  panel-floating:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.lg}"
    width: "340px"
---

# Design System: JavDB Power Tools

## Overview

**Creative North Star: "边车（The Sidecar）"**

这个系统不是一套界面，而是**挂在别人的车旁边的边车**。JavDB 与 MissAV 是主机：它们的导航、网格、字体、Bulma 控件语义照常运转，增强层只在旁边加挂自己的货箱——筛选栏、状态徽标、清单工具、数据面板。这条隐喻解释了三件在其他工具箱里说不清的事：为什么增强元素**不与原站抢层级而是同级并列**；为什么任何增强失效都必须让原站**照常开走**；以及为什么「用 MutationObserver 硬塞 DOM」被当作违纪而不是技术选择——边车不该去改主机的发动机。

材料性格是**工具，不是仪表盘**。信息密度高、字号小（正文 13px，最小 11px），靠字重与底色划分层级而不是靠留白堆叠；控件是硬的——4–8px 圆角、1px 发丝线、1.5px 芯片描边，没有一处装饰性大圆角。静止的表面是平的，阴影只在两种情况下出现：**状态回应**（hover 抬升 1–2px）与**浮层托举**（340px 快捷设置面板）。这不是极简主义，是克制：屏幕上多一个视觉重音，用户就少看一眼影片标题。

这个系统由**五个子系统调色板**拼成，而不是一个统一调色板——核心令牌层（钢蓝）、Bulma 站点族（列表页）、Flat-UI 族（日志面板）、Nord 暗色族（MissAV）、Tailwind 族（设置面板）。它们各自与其宿主同构，这是「并入原站」原则的直接后果。代价是中性灰阶膨胀到 18 阶、语义色出现三到四个近重复值；这些作为**存量普查**记录在案，收敛方向写在规则里。

**Key Characteristics:**

- 与原站同级并列，覆盖而不改造宿主骨架；增强层失效时原站必须完好
- 五级意图字号 11 / 12 / 13 / 14 / 16px；实测另有 9 个存量阶，不再新增
- 圆角重心 6px，意图斜坡 4 / 6 / 8px；实测另有 10 个存量阶
- 扁平为默认；阴影是状态与浮层的语法，不是表面的语法
- 并行在场：筛选栏与卡片徽标沿用站点 badge 语言，配色服从站点
- 焦点环统一 2px `#5d87c2` / offset 2px，触控目标 ≥44px
- 五套子系统调色板并存（令牌 / Bulma / Flat-UI / Nord / Tailwind），各自与宿主同构

## Colors

五套调色板按**宿主归属**划分，而不是按色相；每套内部颜色标记状态与选中，从不装饰。

### Primary

- **静谧钢蓝** (`#5d87c2`)：核心品牌强调色。出现位置全部是「这里是当前上下文或可操作」——设置面板区块标题、侧栏激活项、输入框聚焦描边、复选框 accent、快捷设置活动分段、主按钮底色、全局焦点环、MissAV 筛选芯片选中态。HSL 约 215° / 48% / 56%，低饱和中性蓝，放在 JavDB 自己的 Bulma 蓝旁边不会打架。
- **深钢蓝** (`#4a73b0`)：主色的压下态令牌。**现存实现的主按钮 hover 用 `opacity: 0.9` 提亮，不是这个更深的值**——该令牌已声明但零消费。
- **雾蓝洗底** (`#e8eef6`)：主色的极浅底，用于替代 `rgb(93 135 194 / 0.08)` 这类半透明底。
- **亮钢蓝** (`#4a90d9`)：快捷设置主按钮渐变的第二个色停（`linear-gradient(135deg, #5d87c2, #4a90d9)`）。

### Secondary

语义状态分**两组**，分别服务不同的宿主语言：

- **令牌组**：叶绿 `#64bb69`、琥珀 `#d7a80c`、信号红 `#de3333`、湖青 `#25b1dc`（`--jhs-color-*`），以及面板修饰符开关绿 `#22c55e` / 危险红 `#ef4444`。
- **预加载状态组**（`preload-status-badge`，与实际 HTTP 结果绑定）：排队 `#8a8a8a`、请求中 `#d97706`、成功 `#198754`、失败 `#dc2626`，另有 `#157347`（成功 hover）、`#4caf50` / `#1f7a3d`（紧凑开关开态、磁链已复制）、`#f44336`（瀑布流加载错误）、`#ff9800`（占位）。

**The Two-Greens Rule.** 系统里有四个「成功绿」（`#64bb69` 令牌 / `#22c55e` 开关 / `#4caf50` 紧凑开关 / `#198754` + `#48c774` Bulma），四个「错误红」（`#de3333` 令牌 / `#ef4444` 按钮 / `#dc3545` / `#dc2626`），三个「链接蓝」（`#3273dc` Bulma / `#007bff` / `#0d6efd` Bootstrap）。这是历史欠账不是设计意图：**新代码用令牌值或所属子系统族的值**，不得再引入第五个近似色。

### Tertiary

- **Bulma 品牌族**（列表页，与原站自带语义同构）：链接蓝 `#3273dc`、链接蓝深 `#485fc7`、成功绿 `#48c774`、成功绿深 `#2fb972`、成功绿柔 `#48c78e`、危险红 `#f14668`。仅当「这块增强要看起来像站点自己的控件」时使用。
- **Nord 暗色族**（MissAV 专用，站点是 Tailwind nord 暗色主题）：`nord0 #2e3440`、`nord1 #3b4252`、`nord3 #4c566a`、`nord4 #d8dee9`、frost `#81a1c1`、aurora `#8fbcbb`、弱化 `#7c8794`。**必须成组使用**：把一个 `#5d87c2` 芯片丢进 nord 暗色列表会立刻显出异物感。
- **Flat-UI 族**（日志面板专用，独立子系统）：外壳 `#2c3e50` / `#34495e`、强调 `#3498db` / `#2980b9` / `#337ab7`、弱化 `#7f8c8d` / `#95a5a6`、错误 `#e74c3c`、警告 `#f39c12`、轨道 `#ecf0f1`。

### Neutral

**纸白与极浅底**：`#ffffff`、`#fbfcfd`（设置侧栏）、`#f9f9f9`、`#f8f9fa`、`#f5f5f5`、`#f6f8fa`、`#f0f0f0`、`#eeeeee`、`#e9e9e9`、`#e0e0e0`。

**发丝线**：`#e2e8f0`（主描边）、`#edf0f4` / `#edf0f3`（列表面板内部）、`#dfe4ea`（列表面板边框）、`#dddddd` / `#d0d0d0`（插件的粗细边界）、`#cccccc`。

**文字灰**：`#363636`（正文）、`#6c757d`（**全项目最高频色值，32 次**；次级文字、未激活侧栏、面板标签、筛选栏前缀）、`#999999`（占位/禁用/时间戳）、`#888888`、`#666666`、`#555555`、`#333333`、`#000000`。

**Tailwind slate 族**（设置面板与新插件，未令牌化）：`slate-900 #27313c`、`#1e293b`、`#334155`、`#64748b`、`#94a3b8`、`#cbd5e1`、`#d1d5db`、`#f1f5f9`、`#f8fafc`。

**The Grey-Ladder Rule.** 中性灰实测 **18 阶**（`#000`→`#fff`），另有 9 阶 Tailwind slate 与 4 阶列表面板专用灰。这是一个失去约束的阶梯，不是一套色板。收敛方向：**新代码只在 `--jhs-*` 令牌与 Tailwind slate 两族中取值**；确需新灰时，必须复用现有阶的最近值，不新增阶。存量按触碰即迁移逐步收敛。

**The Declared-Not-Wired Rule.** `src/styles/design-tokens.css` 声明了 39 个令牌，其中**只有 `--jhs-z-top` 与 `--jhs-z-page` 被 `var()` 真正消费**——颜色、间距、圆角、字号、阴影、过渡、触控尺寸全部是「声明即止」，渲染路径写死字面量。令牌层的值是对的，缺的只是接线。**新代码必须写 `var(--jhs-color-primary)` 而不是 `#5d87c2`**；既有字面量按触碰即迁移的方式逐步收敛，不做一次性机械替换。

实测存量（doc/54 审计快照）：TSX 字面色值 **384 处 vs `var(--jhs-*)` 2 处（覆盖率 0.5%）**，CSS 538 vs 182（25.3%）；`impeccable detect` 因此长期报 71 条调色板漂移（severity=advisory，全部落在「字面值不在 DESIGN.md 内」这一个类别）。债务是**集中的、可一次收口的**，不是分散的随手乱写。

**The Subsystem-Fidelity Rule.** 每个子系统调色板只在其宿主的上下文中使用。Nord 族只在 MissAV 页面，Flat-UI 族只在日志面板，Bulma 族只在紧邻站点原生控件的列表页。跨域搬用一族颜色进另一族的地盘，是比色值不一致更严重的问题。

**The Contrast-On-Subtle Rule.** 次级文字 `#6c757d` 只在**纯白底**上达标（4.69:1）。落在浅灰底上必须加深一档——实测 `#f8fafc` 4.48 / `#f1f5f9` 4.28 / `#e2e8f0` **3.80**，三者均低于 4.5:1（WCAG AA 1.4.3）。**在 `#f0f0f0` 及更浅的灰底上写次级文字，改用 slate-600 `#475569`（7.5:1）。** `#999999`（白底 2.85:1）只限占位、禁用、时间戳，不得用作信息性文本。**已按此规则修正的信息性文本**：`cache-item-html` 的缓存容量/条目行、`actress-info-detail-segment` 的空态提示、`review-conflict-dialog` 的说明段、`fc2-plugin` 的 `.search-loading`、`new-video-plugin` 的 `.actress-card-allname`；保留的登记用途：`related-item`/`review-item` 的序号与时间戳、`section-header` 的分隔线渐变（非文字）、`design-tokens.css` 的令牌声明本身。

**The Danger-On-Light Rule.** 危险色作**文字或图标**时浅底需 ≥4.5:1：用 `#dc2626`（白底 4.83）。`#ef4444`（3.76）、`#f40`（3.45）、`#dc3545` 只可用于**可填充控件底**（配白字）、实底徽标或深色底前景，不得直接作浅底文字色。**已按此规则修正**：`fav-sync-panel` / `fav-sync-bind` 的「建议先备份数据」、`highlight-magnet-plugin` 的 4K 行标红。**例外（移植保真，不改）**：`blacklist-confirm-message` / `quick-block-confirm-message` / `confirm-warn` / `log-colored` 四个组件声明了与原脚本「字节级相同 / DOM 等价」的契约，其 `#f40` 属被冻结的移植产物，改动需同步原脚本对照关系（与 The Port-Fidelity Exception 同源逻辑）。

## Typography

**Display Font:** 无（本系统不设 —— 增强层不存在 display 级文字）
**Body Font:** 继承宿主机（JavDB / MissAV 的站点字体栈），项目**不声明全局 `font-family`**
**Label/Mono Font:** 等宽 `Consolas, Monaco, 'Andale Mono', monospace`（缓存文本与代码块）；四个局部系统栈仅用于完全浮于页面之上的浮层。栈内的 `ui-monospace` / `SFMono-Regular` / `-apple-system` / `BlinkMacSystemFont` 是**平台回退项而非项目自选字体**（不随包分发，也无字重文件），设计检测器把它们报成字体告警属预期，不修。

**Character:** 字体是借来的，不是选的——这条约束本身就是设计。增强文字出现在原站文字旁边，任何自有字体都会制造可见的接缝。性格由**字号与字重**承担：13px 正文配 600 字重的小标签，形成紧凑但不糊的层级。

### Hierarchy

- **Headline** (600, 16px, lh 1.35)：面板与区块主标题、浮层标题。
- **Title** (600, 14px, lh 1.4)：设置区块标题（用主色）、侧栏项、区块小标题。
- **Body** (400, 13px, lh 1.5)：表单值、说明文字、按钮文字。**13px 是骨架字号**。
- **Label** (600, 12px, lh 1.5, letter-spacing 0.02em)：按钮、芯片、工具栏按钮、浮层小标题。
- **Caption** (600, 11px, lh 1.5)：卡片内状态徽标、浮层副标题——高密度区域，尺寸退让给信息。

**存量普查阶**（不属于意图斜坡，新增不得使用）：10、15、17、18、20、22、24、26、50px。其中 18px 用于收藏同步面板标题、22px 用于帮助弹层、50px 用于一处插件大标题。另有相对单位 `0.7–0.9em` / `0.72–0.9rem` / `1.2em`（随宿主字号缩放，是刻意的站点适配，不并入 px 斜坡）。

**The Five-Size Rule.** 意图字号只有 11 / 12 / 13 / 14 / 16 五档。需要区分层级时改**字重与颜色**，不加第六个字号。实测另有 9 个存量阶（见上），它们是待收敛的普查结果而非可用选项；**新增代码只允许五档**。需要强调时改字重，不用渐变文字、不用夸张字间距。

**The Borrowed-Face Rule.** 不在 `src/` 里新增全局 `font-family` 声明。四个局部系统栈（`'Segoe UI', Tahoma…` / `-apple-system…` / `Arial, sans-serif` / `Helvetica Neue…`）只允许出现在**完全浮于页面上方的浮层或压在图上的标签**。

**The Port-Fidelity Exception.** `page-sort-plugin.css`、`list-waterfall-plugin.css`、`image-recognition-plugin.css`、`magnet-hub-plugin.css`、`list-reading-status-plugin.css`、`video-lists-tag.css`、`status-tag-filter-plugin.css` 七个样式表在文件头声明了「CSS 规则内容与原脚本一致（缩进标准化，渲染等价）」的**零偏差契约**。其中的字体栈、缓动曲线、色值属于**被冻结的移植产物**，改动它们需要同时改动原脚本对照关系，属于独立决策——不得在普通样式整理中顺手修改。

## Layout

增强层的空间模型是**嵌入**而不是**拥有**：所有布局发生在一个由 `layer.open` 提供的弹层容器或原站既有的网格单元内，从不重排宿主。

- **设置弹层**：外层 `display: flex; height: 100%`；左侧栏固定 `170px`（`background: #fbfcfd`、`border-right: 1px solid #e2e8f0`），内容面板 `flex: 1` 纵向滚动。侧栏项 `padding: 11px 16px`。
- **设置项网格**：`.setting-item` 用 `grid-template-columns: 180px 1fr` + `gap: 12px`。这是全项目最严格的对齐契约——新增设置项必须落进这个网格。
- **紧凑列表行**：`.jhs-qs-row` `min-height: 36px`、`padding: 6px 8px`；子卡片行 32px。密度下限由触控目标 44px（`--jhs-touch-target`）在移动端接管。
- **间距阶**：4 / 8 / 12 / 16 / 20 / 24px。间距普遍贴合这六档；5 / 6 / 10 / 15px 的位置是历史残留。
- **响应式**：全项目只有两个断点——`@media (width <= 768px)`（日志面板、评分条、清单标签）与 `@media (width <= 600px)`（分页按钮）。**这是刻意的**：卡片网格、导航折叠、容器宽度全部交还宿主站点。
- **滚动**：所有自建滚动容器挂 `.jhs-scrollbar`（运行时注入 6px 宽、`#888` 滑块、`#f1f1f1` 轨道的主题化滚动条）。

**The Host-Owns-the-Grid Rule.** 增强层不设全局 `font-family`、不改 `.container` 之外的宿主网格、不动宿主断点。唯一允许的全局布局干预是 `setting-plugin.tsx` 里经 `__CSS_TEXT__` 占位符注入的容器宽度与列数调整——它由用户设置驱动，属于产品功能而非样式选择。

## Elevation & Depth

**扁平为默认，抬升只回应状态。** 静止的表面没有阴影：卡片、区块、输入框、芯片在默认态都是纯底色加 1px 描边。阴影有且只有两类用途——**浮层托举**与**悬停回应**。

### Shadow Vocabulary

- **令牌三级**（声明在 `design-tokens.css`，未被 `var()` 消费）：`0 1px 3px rgb(0 0 0 / 0.08)` / `0 2px 8px rgb(0 0 0 / 0.12)` / `0 4px 16px rgb(0 0 0 / 0.16)`
- **实际渲染路径**：
  - 悬停抬升（卡片）：`0 2px 8px rgb(0 0 0 / 0.10)` + `transform: translateY(-2px)` — `.cache-item:hover`
  - 工具栏按钮：`0 2px 5px rgb(0 0 0 / 0.10)` 静止 / `0 3px 6px rgb(0 0 0 / 0.15)` hover + `translateY(-1px)`
  - 浮层面板：`0 10px 40px rgb(15 23 42 / 0.12), 0 2px 8px rgb(15 23 42 / 0.06)` — 双影（远场 + 近场），全系统唯一的分层阴影
  - 浮层主按钮：`0 2px 8px rgb(74 144 217 / 0.28)` → hover `0 4px 12px rgb(74 144 217 / 0.35)`（同色系带色阴影）
  - 悬浮控件：`0 4px 12px rgb(0 0 0 / 0.30)`（返回顶部）/ `0 4px 16px rgb(0 0 0 / 0.28)`（Toast）——漂浮在任意内容之上，需要更硬的分离
  - 评分徽标：`0 2px 8px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(255 255 255 / 0.1) inset`（压在封面图上）
  - 日志面板：`0 5px 15px rgb(0 0 0 / 0.1)`、折叠钮 `-2px 0 5px rgb(0 0 0 / 0.1)`
- **模糊**：`backdrop-filter: blur(4px)`（返回顶部）/ `blur(6px)`（清单 Toast）。**仅限悬浮于任意内容之上的元素**；PRODUCT.md 明确拒绝玻璃拟态，这两个是既存例外，不得扩散。

### Named Rules

**The Shadow-Is-Response Rule.** 表面静止时没有阴影。给一个静止卡片加阴影，就是把它错误的宣告为可点击或更高层级。

**The Blur-Only-Above Rule.** `backdrop-filter` 只允许出现在「底下是什么完全不可预测」的浮层上。有确定背景的元素用半透明纯色，不用模糊。

## Shapes

形语言是**工具的形**：小圆角、可见描边、明确边界。

- **意图圆角 4 / 6 / 8px**：4px 给紧凑型按钮（工具栏、关键词标签）；6px 给**绝大多数控件**（面板按钮、输入框、下拉、设置项 hover 底）；8px 给容器级元素（快捷设置区块与子卡片、Toast）。全系统重心 6px。
- **实测普查阶**（存量，不属于意图斜坡）：2、3、5、7、9、10、11、12、15、20px。其中 10px 用于列表面板与快捷设置区块、12px 用于浮层面板与评分徽标、9px 用于状态徽标与分段控件、3px／5px 分散在磁链与翻译插件里。
- **药丸 `50rem`**：只给筛选芯片与下拉选择器。让它们与原站 badge 语言同构。
- **圆形 `50%`**：只给开关旋钮、问号提示图标、状态点、返回顶部按钮、头像。
- **描边**：常规边界 `1px`；筛选芯片用 `1.5px`（芯片尺寸小，1px 缩放后会被吃掉）。
- **不对称形**：日志面板折叠钮 `border-radius: 120px 10px 0 0`、窗口 `10px 0 10px 10px`——贴在屏幕右下角，外向角圆、贴边角方。这是唯一刻意的非对称。
- **直角**：不出现在任何自有控件上，只属于宿主的表格与分隔线。

**The Six-Pixel Center of Gravity Rule.** 拿不准用什么圆角时用 6px。新增圆角值之前先证明意图三档（4/6/8）真的不适用；实测已有 10 个普查阶，**不是新增第 11 阶的理由**。

## Components

### Buttons

- **Shape:** 6px 圆角，无边框，`display: inline-flex` 居中
- **Primary:** `#5d87c2` 底 + `#fff` 文字，`height: 34px` / `padding: 6px 16px` / 13px / 500。工具栏按钮是紧凑变体：`min-width: 80px` / `padding: 7px 12px` / 4px 圆角 / 12px / 700 + 文字投影，因为要压在封面图上
- **Hover / Focus:** **hover 用 `opacity: 0.9`（或 0.88）提亮，不换底色**；active 用 `scale(0.97)` 或 `translateY(0)` 回弹；focus 走全局 2px `#5d87c2` 外框
- **Secondary / Ghost:** 白底 + `#64748b` 文字 + `1px #e2e8f0` 描边，hover 转 `#f8fafc` 底 / `#475569` 文字 / `#cbd5e1` 描边。浮层主按钮用 `linear-gradient(135deg, #5d87c2, #4a90d9)` + 带色阴影——**这是全系统唯一允许的装饰性渐变**
- **浅色药丸按钮**（`.a-normal` / `.a-primary` / `.a-success` / `.a-danger` / `.a-warning` / `.a-info`）：Bulma `is-light` 风格——浅底 + 同色系深文字 + 同色系浅描边（如 `#e0f2fe` / `#0369a1` / `#bae6fd`）

### Chips

- **Style:** `padding: 0.25em 0.7em` / `font-size: 0.75em` / 600 / `border-radius: 50rem` / `1.5px solid #dee2e6` / 白底 / `#495057` 文字
- **State:** hover 只改描边与底色（`#adb5bd` / `#f8f9fa`），不动位置；active 由各插件自定填充色。三个筛选栏（`status-tag-filter` / `video-lists-tag` / `preload-status-badge`）共享 `filter-chip-base.css` 的同一组选择器，**改基础样式会同时影响三处**
- **Nord 变体:** MissAV 筛选芯片走独立的暗色样式（`nord0` 底 / `nord3` 描边 / `nord4` 文字，hover 转 frost，选中转主色），刻意不并入浅色基础

### Cards / Containers

- **Corner Style:** 区块 10px、子卡片 8px、浮层面板 12px、列表面板 10px
- **Background:** 区块 `#f8fafc`、子卡片 `#ffffff`、浮层 `#ffffff`——**靠明度差一级分层，不靠阴影**
- **Border:** 区块 `1px #f1f5f9`（同色系底上的分隔）、子卡片 `1px #e2e8f0`、列表面板 `1px #dfe4ea`
- **Internal Padding:** 区块 `8px 8px 4px`、子卡片 `4px`、列表行 `6px 8px`

### Inputs / Fields

- **Style:** `height: 36px` / `padding: 6px 12px` / `1px solid #d1d5db` / 6px 圆角 / 13px / `#1e293b` 文字 / 白底。颜色选择器同高同圆角，宽度 36px
- **Focus:** 描边转 `#5d87c2` + `box-shadow: 0 0 0 2px rgb(93 135 194 / 0.15)`。**光晕用主色的 15% 透明版，不用灰色**
- **Readonly / Disabled:** 只读转 `#f8fafc` 底 / `#94a3b8` 文字 / `#e2e8f0` 描边；禁用走 `opacity: 0.6`
- **开关:** `.jhs-toggle` 40×22px / 圆角 11px / 关态 `#d1d5db` / 开态 `#22c55e` / 旋钮 18px 白圆 + `translateX(18px)`。紧凑开关 `input.mini-switch` 为 40×20px / 圆角 20px / 关态 `#e0e0e0` / 开态 `#4caf50`。**两组开关各自为政是历史欠账，两者都在生产使用中**。命中区：视觉维持 40×22，用透明 `::after` 向外括到 **40×44**（旋钮占用 `::before`）；行标签以 `<label for>` 联动（`setting-row.tsx` / `simple-setting-panel.tsx`），问号提示图标留在 label 外不参与激活。
- **下拉选择器:** 药丸形（`50rem`）、`1.5px solid #ced4da`、`0.72–0.78rem`、内联 SVG 箭头（`data:` URI，随文字色切换）。列表页工具栏专用
- **复选框:** 16px，`accent-color: #5d87c2`

### Navigation

侧栏导航（设置弹层）是唯一自建导航：`padding: 11px 16px` / 14px / 500 / `#64748b`，24×24 图标槽位，`nowrap` + `ellipsis`。左侧 `3px` 透明描边占位，hover 转 `rgba(93 135 194 / 0.08)` 底 + 主色文字，激活转 `rgba(93 135 194 / 0.12)` 底 + `3px` 主色左条 + 主色文字 + 600 字重。**激活态是底色、描边、字重三重表态**——这是「不只靠颜色」原则的具体落点。

### Status Badge（signature）

卡片内每站点的预加载状态徽标（`.jhs-preload-status`）：`padding: 1px 7px` / 圆角 9px / `rgb(0 0 0 / 0.05)` 半透明底 / 11px。四个状态各有专属符号而非只有颜色：排队 `#8a8a8a` 纯文字、请求中 `#d97706` + 6px 脉冲圆点（1s 呼吸）、成功 `#198754` + `✓`、失败 `#dc2626` + `✕`。配对出现的筛选芯片用 7px 状态色圆点作为 `::before`，active 时整块转为该状态色的实底 + 白字。

### Floating Panel（signature）

快捷设置浮层（`.jhs-qs-panel` + `.simple-setting` 容器）：`340px` 宽（`max-width: min(340px, 92vw)`）/ 圆角 12px / 双影 / `overflow: hidden`，头部 `linear-gradient(180deg, #f8fafc, #fff)` + 底部 `#fafbfc`，正文 `max-height: min(78vh, 560px)` 滚动。体内是「区块（`#f8fafc` 底 + 10px 圆角）→ 行（36px 高）→ 子卡片（白底 + 8px 圆角）」的三层嵌套，禁用子卡片转 `opacity: 0.55` + `pointer-events: none`。紧贴触发按钮的一侧有一条 10px 高的透明热区（`::before`），防止指针移入时误关。

### Progress Bar（signature）

清单页与收藏同步共用的进度条：轨道 `8px` 高 / 圆角 `4px` / `#e2e8f0`，填充 `#48c774`（Bulma 成功绿）/ 圆角 `4px` / `transition: width 0.3s ease`。**填充宽度由 JS 驱动（`style.width`），因此不得为 `width` 设置 CSS 过渡之外的花样**——写死宽度或改 `transform` 会破坏进度语义。文字用 `font-variant-numeric: tabular-nums` + 11px 弱化灰，让数字跳动时不抖。

## Do's and Don'ts

### Do:

- **Do** 新代码里写 `var(--jhs-color-primary)` 而不是 `#5d87c2`。令牌已声明、值已正确，缺的只是接线。
- **Do** 先判断这块界面属于哪个子系统（Bulma 列表页 / Nord MissAV / Flat-UI 日志 / Tailwind 设置），然后**整族取值**，不跨族混用。
- **Do** 筛选芯片沿用站点 badge 语言：`padding: 0.25em 0.7em` / `border-radius: 50rem` / `1.5px solid #dee2e6`。三个筛选栏共用 `filter-chip-base.css`，改动前先确认另外两处。
- **Do** 给静止表面留平面。需要区分层级时改**底色明度一级**（`#f8fafc` 区块上放 `#fff` 子卡片），不要加阴影。
- **Do** 让状态至少用两种手段表态：颜色 + 字重，颜色 + 符号（`✓` / `✕` / 脉冲点）。
- **Do** 保持 44px 触控目标（`--jhs-touch-target`）。
- **Do** 给自建滚动容器挂 `.jhs-scrollbar`。
- **Do** 保留 `:focus-visible` 的 `2px solid #5d87c2` / `outline-offset: 2px`。
- **Do** 动效只用两档：`150ms ease`（微反馈）与 `250ms ease`（面板与布局）。`prefers-reduced-motion` 的兜底是**「减少而非抹平」**（`accessibility.css`）：停掉循环与一次性入场动画、把 10 处位移过渡（transform / width）摘成立即到位、滚动改即时，但**保留颜色 / 底色 / 描边 / 阴影 / 透明度 / 填充的状态过渡**——动作反馈不因减动而消失。
- **Do** 设置项落进 `grid-template-columns: 180px 1fr` + `gap: 12px` 的既有网格。
- **Do** 需要新图标时画 SVG 或从 `src/resources/icons.ts` 取。
- **Do** 改动那七个带零偏差契约的样式表前，先确认原脚本对照关系是否需要同步更新（见 The Port-Fidelity Exception）。

### Don't:

- **Don't** 扩散 `backdrop-filter`。它只出现在返回顶部按钮与清单 Toast 上；PRODUCT.md 明确拒绝玻璃拟态。
- **Don't** 新增装饰性渐变。唯一的合法渐变是浮层主按钮与评分徽标的状态渐变；**渐变文字一条都不允许**。
- **Don't** 再引入第四个近似语义色。现存四个成功绿、四个错误红、三个链接蓝已经够多。
- **Don't** 新增中性灰阶。实测已有 18 阶通用灰 + 9 阶 Tailwind slate + 4 阶列表面板灰；需要新灰时在现有阶里找最近的。
- **Don't** 新增字号或圆角阶。意图斜坡分别是 5 档与 3 档，实测普查已各有 9 与 10 个存量阶——**不是继续扩充的理由**。
- **Don't** 在卡片、列表项、提示条上加 >1px 的单边彩色描边。现存 `.help-content`（4px `#3498db`）、`.side-menu-item.active`（3px 主色）、`logger-panel` 的行内 `borderLeft`（3px）是历史偏差；新元素不得再引入。
- **Don't** 用 emoji 充当图标系统。设置侧栏现有的 emoji 是偏差，`src/resources/icons.ts` 里已有 SVG；新图标一律 SVG。
- **Don't** 在 `src/` 里声明全局 `font-family`。局部系统栈只允许出现在完全浮于页面之上的浮层。
- **Don't** 自己发明 z-index。页面内元素用 `var(--jhs-z-page)`（9999），above-layer 层用 `var(--jhs-z-top)`（999999999）——`layer.js` 的 z-index 无上限递增，散落字面量必然被它碾压。
- **Don't** 把 10px / 12px 圆角用在按钮或输入框上。控件圆角的重心是 6px。
- **Don't** 改宿主的全局网格、断点或 `.container`。唯一的全局布局干预由用户设置驱动。
- **Don't** 用 `MutationObserver` 监听弹层出现再注入 DOM。这是「边车不该改主机发动机」最常被违反的地方。


## Host Site Baseline（宿主站点事实基线）

本文件描述的是**增强层自身**的设计系统。宿主 JavDB 站点自身的视觉语言与 DOM 结构另存为独立参考文档，作为“并入原站”原则的事实依据：

- **宿主视觉语言**：[`docs/javdb-site-style.md`](docs/javdb-site-style.md) —— Bulma 基座（`#3e8ed0` / `#00d1b2` / `#48c78e` / `#ffe08a` / `#f14668`）、字体栈（`"Helvetica Neue", "Luxi Sans", …`，基准 16px）、JavDB 自有强调色（导航底 `#0a0a0a`、导航强调 `#ff8400`、**演员链接 `#f09`**、评分徽标 `#fc8300`、星级 `#fb0`）、暗色主题 `:root[data-theme=dark]`、**扁平直角（`border-radius:0`）**、`.container` 1344px、`.movie-list` 网格与断点。
- **宿主结构**：[`docs/javdb-site-structure.md`](docs/javdb-site-structure.md) —— 详情/列表/演员/标签/用户清单/系列/榜单/搜索页的 DOM 骨架与容器关系，含扩展注入标记清单。
- **选择器有效性**：[`docs/21-javdb-selector-audit.md`](docs/21-javdb-selector-audit.md)。

新增注入 UI 时：选挂载点看结构文档；对齐视觉看风格文档；核对选择器是否仍有效看 doc/21。
**注意**：宿主是直角扁平，本增强层用 4/6/8px 圆角是**独立一层**的选择——不要反向把宿主控件“改圆”。
