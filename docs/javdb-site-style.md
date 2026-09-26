# JavDB 站点视觉风格参考

> **文档类型**：📄 参考说明
> **文档状态**：📄 参考（当前状态文档，随站点改版持续维护）
> **影响范围**：所有注入 JavDB 的增强 UI（新插件、新面板、新按钮的视觉对齐基线）
> **前置文档**：`16-design-system-context-and-detector-exceptions.md`（本项目 DESIGN.md 由来）
> **替代文档**：无
> **生效版本**：v1.46.12（采集快照）

本文件记录 **JavDB 站点自身**（宿主）的视觉语言，作为增强层"并入原站"原则的**事实基线**。
本项目自身的令牌与规则见根目录 `DESIGN.md`；本文件只描述宿主，不改动宿主。

采集方式：Chrome DevTools MCP 读取真实页面计算样式 + 直接读取站点打包 CSS
（`https://javdb.com/packs/css/app-8ee07cf2.css`，260,042 字节）。样本页：详情页
`/v/pkWq0q`、列表页 `/`、演员页 `/actors/MVzk`、标签页 `/tags?c10=1`、用户清单页 `/users/lists`。

---

## 1. 技术基座

| 项 | 事实 |
|---|---|
| CSS 框架 | **Bulma**（语义色采用 Bulma 1.x 值：`#3e8ed0` / `#00d1b2` / `#48c78e` / `#ffe08a` / `#f14668`；同时残留 Bulma 0.9.x 的 `#3273dc` / `#485fc7`） |
| 样式表 | 单文件打包 CSS `/packs/css/app-<hash>.css`；页面 `link[rel=stylesheet]` 仅 1 个站点表 |
| 自定义属性 | **站点几乎不用 CSS 变量**：全页 `--*` 声明仅 6 个内部占位（`--single`/`--multiple`/`--image`/`--fb`/`--pt`/`--tw`），无颜色/间距 token。全部为硬编码字面量 |
| 主题 | **明/暗双主题**，切换靠 `:root[data-theme=dark]`（站点 CSS 中 84 条该前缀规则）。默认（无该属性）为明色 |
| 图标 | `icomoon` 图标字体（`document.fonts` 中唯一加载的自定义字体）；另有内联 SVG |
| 重置特征 | 大量 `border-radius:0`（站点 CSS 中 31 处）——**扁平直角是宿主基调** |

---

## 2. 字体

| 用途 | 字体栈 |
|---|---|
| 主栈（正文/UI） | `"Helvetica Neue", "Luxi Sans", "DejaVu Sans", Tahoma, "Hiragino Sans GB", "Microsoft Yahei", sans-serif` |
| 回退栈 | `BlinkMacSystemFont, -apple-system, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", Helvetica, Arial, sans-serif` |
| 等宽 | `monospace` |
| 图标 | `icomoon` |

- 基准字号 **16px**（`html` 与 `body` 同为 16px），正文行高 **24px**（1.5）。
- 正文颜色 `#4a4a4a`（Bulma `$text`）。
- 站点**不加载**日文/中文 webfont，依赖系统字体（`Hiragino Sans GB` / `Microsoft Yahei` 兜底 CJK）。

---

## 3. 颜色

### 3.1 Bulma 语义色（站点主调）

| 语义 | 值 | 备注 |
|---|---|---|
| link / info | `#3e8ed0` | `.button.is-info{background-color:#3e8ed0;color:#fff}` |
| link 深（hover/当前） | `#485fc7` | `.pagination-link.is-current{background-color:#485fc7}`；`.tabs li.is-active a{color:#485fc7}` |
| link 深 hover | `#3850b7` | |
| primary | `#00d1b2` | Bulma 青绿；深态 `#009e86` / `#00947e` |
| success | `#48c78e` | 深态 `#34a873`；浅底 `#effaf5`，深字 `#257953` |
| warning | `#ffe08a` | 深态 `#ffd257` |
| danger | `#f14668` | 深态 `#ee1742` / `#da1039` |
| link（0.9.x 残留） | `#3273dc` | 仍出现在列表卡片标题等；15 处 |

### 3.2 中性色

| 用途 | 值 |
|---|---|
| 正文 | `#4a4a4a` |
| 强调文字 / 标题 | `#363636`（`.title.is-4`、`.panel-block`、`strong`） |
| 深色（导航/暗面） | `#0a0a0a`、`#1c1c1c`、`#242424` |
| 次级文字 | `#7a7a7a`、`#777`（`.score` 值 `#555`） |
| 灰/边框 | `#dbdbdb`、`#e6e6e6`、`#ededed`、`#d9d9d9`、`#b5b5b5` |
| 浅底 | `#f5f5f5`、`#fafafa`、`#fff` |
| 禁用/占位 | `#999`（`.score-stars .gray`） |

### 3.3 JavDB 自有强调色（非 Bulma）

| 用途 | 值 | 证据 |
|---|---|---|
| 导航底色 | `#0a0a0a`（近黑） | `.navbar.is-fixed-top.is-black.is-fluid.main-nav`，计算背景 `rgb(10,10,10)` |
| 导航强调/激活链接 | `#ff8400`（橙） | `a.navbar-link` 计算色 `rgb(255,132,0)` |
| **演员链接** | `#f09`（`#ff0099` 热粉） | 站点 CSS：`:root[data-theme=dark] a.actor-female, a.actor-female{color:#f09}` |
| 评分徽标 | `#fc8300`（橙） | 站点 CSS `.score`：`color:#fff;background-color:#fc8300;border-radius:3px;top:4px;left:4px` |
| 星级 | `#fb0`（`#ffbb00`） | 站点 CSS `.score-stars [class^=icon-]{color:#fb0}` |
| 应用横幅 | `#635aee`（紫） | 站点 CSS `.app-desktop-banner{background-color:#635aee}` |

> **对增强层的含义**：`#f09` 是宿主给演员链接的**语义色**，本项目"收藏演员高亮"用的是自己的
> 红描边（`.highlighted{border:1px solid #ce2222}`），两者并存不冲突；若未来要给演员相关元素上色，
> 应优先考虑沿用 `#f09` 以免与宿主语义打架。

### 3.4 暗色主题（`:root[data-theme=dark]`）

| 用途 | 值 |
|---|---|
| 根背景 | `#333` |
| body 背景 | `#0a0a0a` |
| 链接 | `#70aeff`（主）/ `#50adec` |
| 面板/卡片面 | `#1a1a1a`、`#121212`、`#242424`、`#363636` |
| 边框 | `#333`（`.box`/`.navbar-dropdown` 在暗色下 `box-shadow:none;border:1px solid #333`） |
| 亮字 | `#f5f5f5`、`#ebfffc`、`#fffaeb` |
| 深字（浅底上） | `#946c00` |

### 3.5 半透明 / 遮罩

| 值 | 用途 |
|---|---|
| `rgba(0,0,0,.7)` | 导航下拉/暗面（站点 CSS 中 100 处） |
| `rgba(10,10,10,.98)` | `.is-bg-black` 导航底 |
| `rgba(10,10,10,.1/.2/.25)` | 卡片/控件 hover 阴影 |
| `rgba(<语义色>,.25)` | Bulma 各色的 hover 阴影（link/success/warning 各 4–6 处） |

---

## 4. 形与阴影

- **圆角：默认 0。** 站点 CSS 中 `border-radius:0` 出现 31 次；`.box{border-radius:0}`、`a{border-radius:0}`。
  少量例外：评分徽标 `3px`、个别 `4px`、圆点/头像 `50%`。
- **阴影：默认无。** `.box{box-shadow:none}`；阴影只用于浮层（dropdown/modal）。
- **描边：** 常规 `1px solid #dbdbdb`（`.button`），分隔线 `1px solid #ededed`（`.panel-block` 下边框）。

> 增强层用 4/6/8px 圆角与 1px 发丝线，是**独立一层的选择**；宿主本身是直角扁平。
> 两者不冲突（增强元素与原站同级并列），但**不要**把宿主的控件"改圆"。

---

## 5. 布局

| 项 | 值 |
|---|---|
| 页面容器 | `.container{max-width:1344px}`（分档 `960px` / `1152px` / `1344px`） |
| 详情页容器 | `display:grid; grid-template-columns:minmax(40px,40px) 1fr minmax(80px,80px); padding:6.4px; max-width:1344px` |
| 区块 | `.section{padding:3rem 1.5rem}` |
| 列系统 | `.columns{margin:-.75rem}`；`.column{padding:.75rem}`（Bulma flex 栅格） |
| 影片网格 | `.movie-list{display:grid; column-gap:.4rem; row-gap:1rem; grid-template-columns:repeat(4,minmax(0,1fr)); padding-bottom:.5rem}` |
| 网格变体 | `.movie-list.v{repeat(8,…)}`（视频列表）、`.movie-list.cols-5{repeat(5,…)}`、`.cols-3` |
| 响应式列数 | 桌面 4/5/8 列 → 平板 3 列 → 手机 2 列（随断点递减） |
| 详情页封面列 | `.column-video-cover{flex:none;width:70%;text-align:center;position:relative}` |
| 封面占位 | `.cover{background:#222;line-height:0}` |

**断点**（站点 CSS 中出现的 media query）：

- 桌面：`1024px`、`1216px`、`1408px`、`769px`
- 平板：`max-width:1023px`、`768px`
- 手机：`576px`、`475px`、`480px`、`470px`、`420px`、`375px`、`360px`、`240px`
- 组合：`241–480px`、`481–768px`

> 增强层只有 768px / 600px 两个断点，把网格/导航折叠交还宿主——本表是宿主自己的断点，
> **不要**把宿主断点搬进增强层样式。

---

## 6. 组件（站点原生，供增强层对齐）

### Navbar

- `.navbar.is-fixed-top.is-black.is-fluid.main-nav`：`background-color:#0a0a0a`、`min-height:3.25rem`、`z-index:30`、`display:flex`
- `.navbar-item{color:#0a0a0a;padding:8px 12px}`（明色默认）；暗色导航下为白字
- `.navbar-link` 激活/强调：`#ff8400`
- 结构：`div.navbar-brand` + `#navbar-menu-hero.navbar-menu > .navbar-start` + `#search-box.navbar-menu` + `#navbar-menu-user.navbar-menu > .navbar-end`

### Tabs

- 列表页：`.tabs.main-tabs.is-boxed > ul > li`
- 详情页：`.tabs.no-bottom > ul > li`（磁鏈 / 短評 / 相關清單）
- `.tabs li.is-active a{border-bottom-color:#485fc7;color:#485fc7}`
- 计算值：激活页签 `background:#3273dc`、白字、下边框 `#485fc7`

### Panel（详情页信息栏）

- `.panel{background:#fff}`
- `.panel-block{display:flex;align-items:center;color:#363636;padding:.5em .75em;border-bottom:1px solid #ededed}`
- `.panel-heading{background-color:#fff;color:#0a0a0a}`
- 行内结构：`strong`（标签）+ `span.value`（值）

### Button

- `.button{background-color:#fff;border:1px solid #dbdbdb;color:#363636;padding:calc(.5em - 1px) 1em;border-radius:0}`（高 40px）
- `.button.is-info{background-color:#3e8ed0;border-color:transparent;color:#fff}`
- `.button.is-light{background-color:#f5f5f5}`
- 小号：`.button.is-small`（计算高 30px、`padding:5px 12px`、字号 12px）

### Tag

- `.tag{font-size:12px;height:24px;padding:0 9px;border-radius:0}`
- `.tag.is-success`：计算 `color:#257953;background-color:#effaf5`
- `.tag.is-info.is-outlined`：描边变体（标签页大量使用）
- `.tag.is-light`：浅底（列表卡片"昨日首種"等）

### Pagination

- `.pagination-link.is-current{background-color:#485fc7;border-color:#485fc7;color:#fff}`
- `nav.pagination > a.pagination-next` + `ul.pagination-list > li > a.pagination-link` + `span.pagination-ellipsis`

### Box / 卡片

- `.box{background-color:#fff;border-radius:0;box-shadow:none;color:#4a4a4a;padding:1.25rem}`
- 列表卡片：`div.item > a.box > div.cover > img` + `div.video-title > strong` + `div.score > span.value > span.score-stars` + `div.meta` + `div.tags.has-addons > span.tag`

### Score

- `.score{padding-bottom:.2rem;color:#555;font-size:.8rem}`
- 封面徽标：`color:#fff;background-color:#fc8300;border-radius:3px;position:absolute;top:4px;left:4px;padding:1px 2px`
- 星级：`.score-stars [class^=icon-]{color:#fb0}`；空星 `.gray{color:#999}`

### 列表卡片标题

- `.movie-list .item .video-title{padding-top:.4rem;padding-bottom:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`
- 番号文本在 `div.video-title > strong`（计算字号 12.8px、颜色 `#3273dc`）

---

## 7. 与增强层的对接要点

1. **同构优先**：要"看起来像站点自己的控件"时，用 Bulma 类（`.button.is-info`、`.tag.is-success`、`.tabs`），
   而不是自造样式。本项目 `a-normal-buttons.css` 的 `.a-*` 药丸按钮族即此思路。
2. **语义色服从宿主**：状态徽标/筛选芯片的颜色应与站点 badge 语言一致（见 DESIGN.md
   "The Subsystem-Fidelity Rule"）。
3. **不动宿主骨架**：不改 `.container` 宽度、不改 `.movie-list` 列数（除非用户设置驱动，见
   `setting-plugin.tsx` 的 `__CSS_TEXT__`）、不改站点断点。
4. **演员链接是 `#f09`**：宿主已给演员链接语义色；增强层的高亮用独立红描边，不要覆盖宿主的 `color`。
5. **直角是宿主基调**：增强层自己的容器可以有 4/6/8px 圆角，但**不要**把宿主的 `.button`/`.tag`/`.box` 改圆。
6. **暗色主题**：宿主有 `:root[data-theme=dark]`。增强层若要在暗色下也正确，需按该属性做适配
   （当前增强层主要在明色下设计；这是未来扩展需注意的点）。

---

## 8. 采集方法与证据

- 页面计算样式：`getComputedStyle` 采样 `.navbar` / `.button` / `.tag` / `.panel-block` / `.movie-list` /
  `.column-video-cover` 等（详见 `21-javdb-selector-audit.md` 的实测记录）。
- 站点 CSS 事实：`fetch('https://javdb.com/packs/css/app-8ee07cf2.css')` 后统计 hex/rgb 频次与规则文本。
- 颜色频次（站点 CSS，前 12）：`#363636` 113、`#0a0a0a` 100、`#dbdbdb` 90、`#f5f5f5` 53、`#485fc7` 50、
  `#b5b5b5` 38、`#4a4a4a` 36、`#242424` 33、`#00d1b2` 31、`#3e8ed0` 30、`#48c78e` 30、`#ffe08a` 30。
- 打包 CSS 文件名带内容哈希（`app-8ee07cf2.css`），站点改版后哈希会变；本文档记录的是该快照。
