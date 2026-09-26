# JavDB 站点结构参考

> **文档类型**：📄 参考说明
> **文档状态**：📄 参考（当前状态文档，随站点改版持续维护）
> **影响范围**：所有依赖 JavDB 原生 DOM 的插件（选择器读取、挂载点定位、注入边界）
> **前置文档**：`21-javdb-selector-audit.md`（选择器逐项实测清单）
> **替代文档**：无
> **生效版本**：v1.46.12（采集快照）

本文件把历次在真实页面读到的 **JavDB 站点 DOM 结构**集中保存，作为开发依据。配套的
"选择器有效/失效/不适用"逐项清单见 `21-javdb-selector-audit.md`；站点视觉语言见
`javdb-site-style.md`。

采集方式：Chrome DevTools MCP 在真实页面执行 `querySelectorAll` + DOM 遍历输出骨架。
样本页：详情页 `/v/pkWq0q`、列表页 `/`、演员页 `/actors/MVzk`、标签页 `/tags?c10=1`、
用户清单页 `/users/lists`、系列页 `/series/q41e`、榜单页 `/rankings/top`。

---

## 1. 页面类型与通用骨架

| 页面类型 | 路由示例 | 关键容器 |
|---|---|---|
| 详情页 | `/v/{id}` | `.video-detail` |
| 列表页 | `/`、`/censored`、`/uncensored`、`/western`、`/anime` | `.movie-list.h.cols-4.vcols-8` |
| 演员页 | `/actors/{id}` | `.section-columns` + `.actor-tags` + `.movie-list` |
| 系列页 | `/series/{id}` | `.movie-list` + `.tabs.is-boxed` |
| 标签页 | `/tags`、`/tags?c10=1` | `#tags > dl` |
| 榜单页 | `/rankings/top`、`/rankings/playback` | `.movie-list` + `.section .container .box` |
| 用户页 | `/users/lists`、`/users/want_watch_videos`、`/users/watched_videos` | `#lists > ul` 或 `.movie-list` |
| 搜索页 | `/search?q=…`、`/search?f=actor&q=…` | `.movie-list` / `.actor-box` |
| 高级检索 | `/search_advanced?type=…` | `.section .container > .box` |

**通用骨架**（所有页面共有，顺序固定）：

```html
nav.app-desktop-banner            <!-- 顶部应用横幅（#635aee 紫） -->
nav.navbar.is-fixed-top.is-black.is-fluid.main-nav
  div.navbar-brand                <!-- logo + 移动端图标 + 扩展注入的迷你设置/历史按钮 -->
  div#navbar-menu-hero.navbar-menu > div.navbar-start   <!-- 主菜单 31 个 a.navbar-item -->
  div#search-box.navbar-menu > div.navbar-start         <!-- 搜索：select#search-type + input#search-keyword -->
  div#navbar-menu-user.navbar-menu > div.navbar-end     <!-- 用户菜单 -->
nav.sub-header                    <!-- 次要导航 -->
nav.moj-header                    <!-- 公告 -->
section.section > div.container   <!-- 主体：见下各页 -->
nav#footer.navbar.is-dark.is-fluid
div.float-buttons                 <!-- 回到顶部/磁链跳转 -->
```

**扩展注入标记**（本项目注入，**不属于**站点原生 DOM，审计/选择器时应排除）：

- `.jhs-*`、`#jhs-*`（如 `#jhs-back-to-top`、`.jhs-toolbar-menu-btn`、`.jhs-list-panel`、`.jhs-scroll`）
- `#otherSiteBox`（外站按钮容器）
- `.status-tag-filter-bar`、`.preload-filter-bar`（筛选栏）
- `#mini-setting-btn`、`#miniHistoryBtn`、`#historyBtn`、`#setting-btn`
- `#gemini-jump-page-control`（跳页控件）、`.jhs-preload-status-bar`、`.jhs-vlt-tags-display`
- `select.list-reading-dropdown`、`.list-rating-stars`（清单阅读状态）

---

## 2. 详情页 `/v/{id}`

### 2.1 骨架

```html
div.video-detail
  h2.title.is-4
    strong                    <!-- 番号（如 DAZD-314） -->
    strong.current-title      <!-- 原标题 -->
    div.translated-title      <!-- 翻译标题（扩展注入） -->
  div.video-meta-panel
    div.columns.is-desktop
      div.column.column-video-cover
        a > img.video-cover   <!-- 封面（.column-video-cover img） -->
      div.column
        nav.panel.movie-panel-info
          div.panel-block.first-block
          div.panel-block …（共 7 行，见 2.2）
          div.review-buttons
          div#otherSiteBox.panel-block          <!-- 扩展注入 -->
          section.jhs-list-panel                <!-- 扩展注入 -->
  div.columns > div.column > article.message.video-panel
    div.message-body > div.tile-images.preview-images   <!-- 剧照（.preview-images .tile-item） -->
  div.columns > div.column
    div.tabs.no-bottom
      ul > li.is-active / li / li               <!-- 磁鏈 / 短評 / 相關清單 -->
    div#tabs-container
      div#magnets > article.message.video-panel
      div#reviews
      div#lists
    article.message.video-panel                 <!-- 读取中占位 -->
  div.columns > div.column > article.message.video-panel  <!-- TA(們)還出演過（.tile-images.tile-small） -->
  div.columns > div.column > article.message.video-panel  <!-- 你可能也喜歡 -->
  div#modal-comment-warning.modal
  div#modal-save-list.modal
```

### 2.2 信息栏 `.movie-panel-info` 的 7 个原生行

| # | 选择器 | 标签（`strong`） | 值容器 | 备注 |
|---|---|---|---|---|
| 0 | `.panel-block.first-block` | `番號:` | `span.value` | 含 `a.button.is-white.copy-to-clipboard`；值 = `DAZD-314`；链接 `a[title="複製番號"]` 也在本行 |
| 1 | `.panel-block` | `日期:` | `span.value` | 值 = `2026-10-27`；`strong:contains("日期:")` 命中 |
| 2 | `.panel-block` | `時長:` | `span.value` | 值 = `230 分鍾` |
| 3 | `.panel-block` | `片商:` | `span.value` | 含 1 个链接 |
| 4 | `.panel-block` | `評分:` | `span.value` | 值 = `4.0分, 由4人評價` |
| 5 | `.panel-block` | `類別:` | `span.value` | 含 5 个链接 |
| 6 | `.panel-block` | `演員:` | `span.value` | **含 11 个 `a.actor-female`**；`strong:contains("演員")` 命中 |

后续 `.panel-block`：`div.review-buttons`（想看/已看/评分）、外站、清单面板等。

### 2.3 演员链接结构（改版关键）

```html
<span class="value">
  <a class="actor-female" href="/actors/BKMM">大槻ひびき</a>,
  <a class="actor-female" href="/actors/X301">七瀬アリス</a>, …
</span>
```

- **新结构**：链接自身带 `actor-female`；href 末段是 starId。
- **旧结构**：`<a href="/actors/…">名</a><span class="female">♀</span>`，靠 `.female` 的前置兄弟取链接。
- 实测：详情页 `.female` = 0、`a.actor-female` = 11（旧读法失效，新类有效）。
- 男演员对应 `a.actor-male` / 旧 `.male`（样本页均 0，未能判定）。

### 2.4 评价按钮区 `.review-buttons`

- `body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons`
- 页面上 `.review-buttons` 出现 3 处（1 主容器 + 2 分组）。
- 「已看」：`a[href='/users/watched_videos'] .tag.is-success.is-light`
- 「想看」：`a[href='/users/want_watch_videos'] .tag.is-info.is-light`（当前样本 0）
- 评分：`input[name="video_review[score]"]`（5 个 radio）；已选 `input[name="video_review[score]"][checked]`（当前样本 0）
- 删除链接：`.review-buttons a[data-method='delete'][href*='/reviews/']`
- 分栏挂载点：`.review-buttons > div:nth-child(1) > div > div`

### 2.5 其它详情页选择器

| 选择器 | 含义 | 实测 |
|---|---|---|
| `a[title="複製番號"]` | 番号复制按钮 | 1（值 `DAZD-314`） |
| `h2.title` | 详情页标题 | 1 |
| `strong.current-title` | 原标题 | 1 |
| `.origin-title` | 原题名（翻译用） | 0（回退 `.current-title`） |
| `.panel-block .value` | 元数据值容器 | 7 |
| `.panel-block .value a[href]` | 元数据内链接 | 18 |
| `.panel-block.first-block a[data-clipboard-text]` | VLT 取番号 | 1 |
| `.column-video-cover img` | 封面图 | 1 |
| `.preview-images .tile-item` | 剧照 | 12 |
| `strong:contains("演員")` | actress-info 插入锚点 | 1 |

---

## 3. 列表页 `/`、`/censored` 等

### 3.1 骨架

```html
section.section > div.container
  div#search-bar-container.columns.search-bar-container
    div.status-tag-filter-bar          <!-- 扩展注入 -->
    div.preload-filter-bar             <!-- 扩展注入 -->
    div.column > div.search-bar-wrap
  div.site-announce.notification.is-warning
  div#search-image-modal.modal
  div#select-search-image-modal.modal
  div.main-tabs-wrap
    div.tabs.main-tabs.is-boxed
      ul > li × 10                     <!-- 資訊/热播/全部/有碼/無碼/歐美/FC2/123Av-Fc2/動漫 -->
      div > a#waitCheckBtn.jhs-toolbar-menu-btn.main-tab-btn   <!-- 扩展注入 -->
      div > a#newVideoBtn / #blacklistBtn / #sort-toggle-btn   <!-- 扩展注入 -->
    button.main-tabs-more
    nav.main-tabs-panel
  div.toolbar
    div.button-group > div.buttons.has-addons > a.button.is-small（封面大小/磁鏈/字幕/短評/排序）
  div.movie-list.h.cols-4.vcols-8
    div.item × 40
  div.jhs-scroll                       <!-- 扩展注入 -->
  nav.pagination
    a.pagination-next "下一頁"
    ul.pagination-list > li > a.pagination-link(.is-current) + span.pagination-ellipsis
    li#gemini-jump-page-control        <!-- 扩展注入 -->
```

### 3.2 列表卡片 `.item` 结构

```html
div.item
  a.box
    div.cover[.contain] > img          <!-- 封面（.cover img） -->
    div.video-title > strong           <!-- 番号（.video-title strong） -->
    div.jhs-preload-status-bar         <!-- 扩展注入 -->
    div.score > span.value > span.score-stars   <!-- 评分 -->
    div.meta                           <!-- 日期（2026-09-25） -->
    div.jhs-vlt-tags-display           <!-- 扩展注入 -->
    div.tags.has-addons
      span.tag.is-success "含磁鏈"
      span.tag.is-first-torrent.is-light "昨日首種"
```

- 站点原生：`.cover` / `.video-title > strong` / `.score` / `.meta` / `.tags.has-addons > span.tag`
- 结构等价写法：`a > div.video-title > strong`（多处插件用此取番号）

### 3.3 列表页选择器实测

| 选择器 | 实测（首页） | 备注 |
|---|---|---|
| `.movie-list` | 1 | class = `movie-list h cols-4 vcols-8` |
| `.movie-list .item` | 40 | 演员页/系列页同为 40/20 |
| `.movie-list .item a.box` | 40 | |
| `.video-title strong` | 40 | |
| `.cover img` | 40 | |
| `.main-tabs` / `.tabs` | 1 / 1 | |
| `.main-tabs ul li` | 9 | 不含扩展注入按钮 |
| `.toolbar a.button` | 10 | |
| `.pagination` / `.pagination-list li a` | 1 / 6 | |
| `.pagination-next` | 1 | |
| `.pagination-ellipsis` | 1 | |
| `.tabs.is-boxed` | 1 | |
| `body > section > div > div.movie-list.h.cols-4.vcols-8` | 1 | 列表定位（PageSort 用） |
| `body > section > div > div.toolbar` | 1 | 工具栏定位 |

---

## 4. 演员页 `/actors/{id}`

### 4.1 骨架

```html
section.section > div.container
  div.columns.is-desktop.section-columns
    div.column.actor-avatar
      div.image > span.avatar          <!-- 头像（.avatar，背景图） -->
    div.column.section-title
      h2.title.is-4.has-text-justified
        span.actor-section-name "朝日奈美緒, 朝日奈みお"
        br
        span.section-meta "みお"
        br
        span.section-meta "77 部影片"
  div.columns > div.column.section-addition
    div.field.has-addons
      #button-collect-actor / #button-uncollect-actor   <!-- 收藏按钮 -->
  div.toolbar
    div.button-group > div.buttons.has-addons
  div.actor-tags.tags
    div.content.collapse
      a.button.is-link.is-outlined.tag-expand   <!-- 展开/收起 -->
      a.tag.is-medium.is-link.is-outlined "全部"
      a.tag.is-medium.is-outlined "可播放" / "單體作品" / "含磁鏈" / "含字幕" / "VR(28)" …
  div.movie-list.h.cols-4.vcols-8
    div.item × 40
  nav.pagination
```

### 4.2 关键选择器

| 选择器 | 含义 | 实测 |
|---|---|---|
| `.actor-section-name` | 演员名（可含别名，逗号分隔） | 1 |
| `.section-meta` | 别名/影片数（`:not(:contains('影片'))` 取名称，`:contains('男優')` 判性别） | 2 |
| `.avatar` | 头像（`background-image`） | 1 |
| `.actor-tags.tags` / `.actor-tags .content` | 标签区 | 1 / 1 |
| `.tags a.tag` | 演员页标签 | 78 |
| `.tag-expand` | 标签展开控件 | 1 |
| `#button-collect-actor` | 收藏按钮（href `/actors/{id}/collect`） | 1 |
| `#button-uncollect-actor` | 取消收藏（href `/actors/{id}/uncollect`） | 1 |
| `body > section > div > div.actor-tags.tags` | 筛选栏挂载点 | 1 |
| `.section-columns` | 头像替换的插入容器 | 1 |
| `a.actor-female` / `.female` | — | 演员页均为 0（该页无演员链接） |

**男演员页**（如 `/actors/PpQ0`）：`.section-meta` 文本含 `男優`，`.section-meta:contains('男優')` 命中，
其余结构与女演员页相同。

---

## 5. 标签页 `/tags`、`/tags?c10=1`

```html
div#tags
  dl
    dt#tag-category-{N}.tag-category
      a.button.is-small.is-info.tag-expand
        span.text "收起" / "展開"
        span.icon > i.icon-angle-double-up / -down
      strong "基本" / "年份" / "主題" / "角色" / "服裝" / "體型" …
      a.tag "全部"                      <!-- 或 a.tag.is-info.is-outlined -->
      span.tag_labels
        a.tag.is-outlined "…" × N
        div.tag.is-info > button.delete.is-small   <!-- 已选标签 -->
```

| 选择器 | 含义 | 实测（`/tags?c10=1`） |
|---|---|---|
| `#tags` | 标签容器 | 1 |
| `#tags .tag-category` | 分类块 | 10 |
| `#tags .tag-category .tag-expand` | 展开控件 | 10 |
| `#tags a.tag` | 标签链接 | 353 |
| `#tags dl div.tag.is-info` | 已选标签 | 1（「含磁鏈」） |
| `.movie-list .item` / `.pagination` | 该页也可带结果列表 | 40 / 1 |

- `.highlighted` 类由扩展 `fold-category` 插件加在高亮标签上（`.tag.is-outlined.highlighted`）。

---

## 6. 用户清单页 `/users/lists`

```html
div#lists.common-list.is-hoverable
  ul
    li#list-{ID}.list-item.columns
      div.column.is-10
        span.list-rating-stars > svg.list-rating-star × 5
        select.list-reading-dropdown > option "未读完" / "已读完"   <!-- 扩展注入 -->
        a > strong.list-name "等待更新1"
        br
        span.meta "501 部影片, 被點擊了 2003 次"
      div.column.is-2
        div.operation.field.has-addons
          p.control > button.button.is-info.is-small.copy-to-clipboard "分享"
          p.control > button.button.is-info.is-small.modal-button.modal-edit-list-button
          p.control > a.button.is-danger.is-small "刪除"
  div.jdb-wf-loader.no-more "已经到底了"
```

| 选择器 | 含义 | 实测 |
|---|---|---|
| `#lists` | 清单目录容器 | 1 |
| `#lists > ul` | 清单列表 | 1 |
| `#lists > ul > li` | 清单项 | 15 |
| `div.column.is-10 > a` | 清单标题链接 | 22 |
| `nav.pagination` / `a.pagination-previous` | 分页 | 1 / 1 |
| `.movie-list` | — | 0（该页用 `#lists`，不是 `.movie-list`） |

**用户影片列表**（`/users/want_watch_videos`、`/users/watched_videos`）：改用 `.movie-list .item`
（20 项）+ `nav.pagination` + `a.pagination-next`，**无** `#lists`。

> 区分要点：`/users/lists` 是**清单目录**（`#lists > ul`），`/users/<视频清单>` 是**影片列表**
> （`.movie-list`）。扩展 `other-site` 预加载据此判断（有 `.movie-list` 才预加载）。

---

## 7. 系列页 `/series/{id}`

```html
section.section > div.container
  div.columns.is-mobile.section-columns > div > h2   <!-- 系列标题 -->
  div.tabs.is-boxed                                  <!-- 筛选页签 -->
  div.movie-list … > div.item × 20
  nav.pagination
```

| 选择器 | 实测（`/series/q41e`） |
|---|---|
| `.movie-list` / `.movie-list .item` | 1 / 20 |
| `.tabs` / `.tabs.is-boxed` | 1 / 1 |
| `body > section > div > div.columns.is-mobile.section-columns > div > h2` | 1 |
| `.pagination` | 0（单页系列；多页时 `/series/Pm9?page=2` 命中 1） |
| `a.pagination-next` / `a.pagination-previous` | 多页系列各 1 |

---

## 8. 榜单页 `/rankings/top`、`/rankings/playback`

| 选择器 | `/rankings/top` | `/rankings/playback` |
|---|---|---|
| `.movie-list .item` | 40 | 60 |
| `.section .container .box` | 40 | 60 |
| `.pagination` | 1 | 0 |
| `.toolbar a.button` | 0 | 5 |
| `.empty-message` | 0（有结果） | 0（有结果） |
| `h2.section-title` | 0 | 0 |
| `#sort-toggle-btn` | 1（扩展注入） | 1（扩展注入） |

---

## 9. 高级检索 `/search_advanced`

| 选择器 | 实测 |
|---|---|
| `h2.section-title` | 1（「進階檢索」） |
| `.section .container > .box` | 1 |
| `section > div > div.box` | 1 |
| `#tags` | 1 |
| `.empty-message` | 1 |
| `form`（GET `/search_advanced`） | 字段：`type` / `score_min` / `score_max` / `released_start` / `released_end` / `maker` / `series` / `director` / `publisher` / `actors[]` / `tags[]` / `q` / `qm` / `sb` / `p` / `d` / `c` / `s` / `i` / `v` |

**FC2 结果页** `/search_advanced?type=3&score_min=0&d=1`：`h2.section-title` 1、
`.section .container > .box` 1、`section > div > div.box` 1、`.movie-list .item` 40、`.pagination` 1。

> 注意：导航上的 FC2 链接当前指向 `/advanced_search?type=3&…`，该路径返回 **404**；可用表单路由是
> `/search_advanced?…`。属 URL 兼容问题，不在选择器范围内（详见 `21-javdb-selector-audit.md`）。

---

## 10. 搜索页 `/search`

| 路由 | 关键结构 | 实测 |
|---|---|---|
| `/search?q=…` | `.movie-list .item`、`.tabs.is-boxed` | 影片结果 |
| `/search?f=actor&q=…` | `.actor-box` / `.actor-box strong` | 3 / 3 |

---

## 11. 与 `21-javdb-selector-audit.md` 的分工

- **本文件**：站点的**结构事实**（页面骨架、DOM 层级、容器关系、注入边界）。
- **`21-javdb-selector-audit.md`**：逐条选择器的**有效性判定**（有效 / 失效 / 不适用 + 计数证据），
  以及已确认失效项的根因与修复。

两者配套使用：新增插件选挂载点看本文件；核对某选择器是否仍有效看 doc/21。

---

## 12. 采集方法与已知限制

- 采集：Chrome DevTools MCP 在真实登录态页面执行 DOM 遍历与 `querySelectorAll` 计数。
- 已知限制：
  - 首页根路径曾遇 Cloudflare **HTTP 451**（地区法律封锁），恢复后采集；此类拦截可能复现。
  - 用户公开档案页（`.is-user-page`）等隐私路由未采集。
  - 站点改版后本文件会过期；采集时站点 CSS 哈希为 `app-8ee07cf2.css`。
