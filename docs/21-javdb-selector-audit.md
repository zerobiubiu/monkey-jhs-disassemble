# JavDB 站点选择器审计与女演员链接兼容修复

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：JavDB 详情页、影片列表页、演员页的 DOM 选择器读取
> **前置文档**：无
> **替代文档**：无
> **生效版本**：v1.46.12（待发布）

## 1. 背景与审计范围

JavDB 详情页演员 DOM 已从旧读法 `$('.female').prev()` 改版。旧选择器在真实详情页返回空集，会使女演员名读取、收藏演员高亮、清单自动记录演员名等功能失效。本次仅处理已由真实 DOM 证实失效的女演员读取路径；没有证据证明男演员标记 `.male` 也已改版，因此保留原读取逻辑。

按原始源码中 jQuery/CSS 查询调用做了候选扫描（316 个 selector 表达式；约 105 个候选涉及站点 DOM，含页面专属与运行时选择器）。下表包含已核实项及源码识别出的待测候选，但候选池尚未逐个完成实测与归类；因此本记录仍是部分审计，不宣称全量完成。零匹配只有在确认页面适用且有新结构正向命中时才标作失效。

## 2. 真实页面证据

实测使用 Chrome DevTools MCP；样本页面为 JavDB 实际页面，不是手写 HTML。计数均为执行 `document.querySelectorAll(selector).length` 的结果；jQuery `:contains()` 项以对应节点的文本匹配核对。

| 页面 | URL / 样本 | 观测到的结构 |
|---|---|---|
| 详情 | `https://javdb.com/v/pkWq0q`（DAZD-314） | `.actor-female` 11，`.female` 0；`.movie-panel-info`、`.video-meta-panel nav > div:nth-child(2) > span`、`.panel-block .value`、`a[title="複製番號"]`、`h2.title` 均命中；`.column-video-cover img` 加载后命中 |
| 首页影片列表 | `https://javdb.com/` | `.movie-list` 1、`.movie-list .item` 40、`.video-title strong` 40、`.cover img` 40；`.main-tabs`、`.tabs`、`.pagination`、`.pagination-list`、`.pagination-next` 均命中 |
| 演员页 | `https://javdb.com/actors/MVzk` | `.actor-section-name`、`.actor-tags .content`、`.avatar` 各 1；`.tags a.tag` 78、`.tag-expand` 1、`.movie-list .item` 40；分页当前页与下一页控件均命中 |
| 系列列表 | `https://javdb.com/series/q41e` | `.movie-list` 1、`.movie-list .item` 20、`.tabs` 1；该系列当前只有一页，分页控件为 0 属不适用 |

## 3. 已实测选择器清单

状态：**有效** = 在适用页面已单独实测并命中；**失效** = 适用页面上旧选择器为 0，且新结构有正向命中；**不适用** = 该页面类型不应有此结构；**未测** = 未对该 selector 单独查询，或尚未访问其专属路由/运行状态。

| 选择器 | 用途/消费者 | 详情 | 首页列表 | 演员页 | 系列页 | 结论 |
|---|---|---:|---:|---:|---:|---|
| `a.actor-female` | 详情页演员链接 | 11 | 0 | 0 | 0 | 详情页有效；其他页不适用 |
| `.female` | 旧版女性标记，历史实现用 `.prev()` 取链接 | 0 | 0 | 0 | 0 | 详情页确认失效；列表/演员/系列页不适用 |
| `.actor-male` | 新版男性演员链接候选 | 0 | 未测 | 0 | 0 | 未证实；样本详情无男演员，不能判断失效 |
| `.male` | 旧版男性标记 | 0 | 未测 | 0 | 0 | 未证实；保留原逻辑 |
| `.movie-list` | 影片列表容器 | 不适用 | 1 | 1 | 1 | 各列表页有效 |
| `.movie-list .item` | 列表影片卡片 | 不适用 | 40 | 40 | 20 | 各列表页有效 |
| `.movie-list .item a.box` | 列表影片卡片链接 | 不适用 | 40 | 40 | 20 | 首页/演员/系列列表有效 |
| `.video-title strong` | 列表影片标题 | 不适用 | 40 | 40 | 20 | 首页/演员/系列列表有效 |
| `.cover img` | 列表卡片封面 | 不适用 | 40 | 40 | 20 | 首页/演员/系列列表有效 |
| `.column-video-cover img` | 详情页封面图 | 1 | 0 | 0 | 0 | 详情页有效；列表/演员/系列页不适用 |
| `.main-tabs` | 首页主标签栏 | 不适用 | 1 | 0 | 0 | 首页有效；演员/系列页无此栏属页面差异 |
| `.tabs` | 通用标签栏 | 1 | 1 | 0 | 1 | 详情/首页/系列页有效；演员页无此栏属页面差异 |
| `.tabs.is-boxed` | 视频列表筛选标签栏 | 0 | 1 | 0 | 1 | 首页/系列页有效；演员页用 actor-tags 区域 |
| `body > section > div > div.tabs.is-boxed` | 筛选标签栏挂载点 | 0 | 1 | 0 | 1 | 首页/系列页有效；详情/演员页无此挂载点 |
| `body > section > div > div.columns.is-mobile.section-columns > div > h2` | 列表阅读状态标题挂载点 | 0 | 0 | 0 | 1 | 系列页标题有效；分页系列页 `/series/Pm9?page=2` 也命中 1 |
| `.pagination` | 列表分页 | 不适用 | 1 | 1 | 0 | 首页和演员页有效；单页系列不适用 |
| `.pagination-list` | 分页页码列表 | 不适用 | 1 | 1 | 0 | 首页和演员页有效 |
| `.pagination-list li a` | 分页链接 | 不适用 | 6 | 2 | 0 | 首页和演员页有效；单页系列不适用 |
| `.pagination-link.is-current` | 当前页按钮 | 不适用 | 1 | 1 | 0 | 首页和演员页有效 |
| `.pagination-next` | 下一页按钮 | 不适用 | 1 | 1 | 0 | 首页和演员页有效；单页系列不适用 |
| `nav.pagination` | 分页 nav 容器 | 0 | 1 | 1 | 0 | 首页面/列表页有效；`/series/Pm9?page=2` 命中 1 |
| `.pagination-previous` | 分页上一页按钮 | 0 | 0 | 0 | 0 | 首页面均无上一页；`/series/Pm9?page=2` 命中 1 |
| `body > section > div > nav > a.pagination-previous` | 键盘翻页的上一页链接 | 0 | 0 | 0 | 0 | 首页面无上一页；`/series/Pm9?page=2` 命中 1 |
| `body > section > div > nav > a.pagination-next` | 键盘翻页的下一页链接 | 0 | 1 | 1 | 0 | 首页/演员页有效；`/series/Pm9?page=2` 命中 1 |
| `a > div.video-title > strong` | 列表番号标题读取 | 0 | 40 | 40 | 20 | 首页/演员/系列列表有效 |
| `.pagination-ellipsis` | 分页省略号 | 不适用 | 1 | 0 | 0 | 首页有效；演员页无需省略号，系列单页不适用 |
| `.pagination-btn` | 项目 `ActressPagination` 组件生成按钮 | 不适用 | 不适用 | 不适用 | 不适用 | extension-owned；非 JavDB 原生选择器，排除 |
| `.actor-section-name` | 演员页名称 | 不适用 | 不适用 | 1 | 不适用 | 演员页有效 |
| `.actor-tags .content` | 演员页标签区域 | 不适用 | 不适用 | 1 | 不适用 | 演员页有效 |
| `.avatar` | 演员页头像 | 不适用 | 不适用 | 1 | 不适用 | 演员页有效 |
| `body > section > div > div.actor-tags.tags` | 演员页标签/筛选挂载区 | 0 | 0 | 1 | 0 | 演员页有效；其他样本无演员标签容器 |
| `#button-collect-actor` | 演员页「收藏」原生按钮 | 0 | 0 | 1 | 0 | 演员页有效（href `/actors/MVzk/collect`） |
| `#button-uncollect-actor` | 演员页「取消收藏」原生按钮 | 0 | 0 | 1 | 0 | 演员页有效（href `/actors/MVzk/uncollect`） |
| `.tags a.tag` | 演员页标签链接 | 0 | 0 | 78 | 0 | 演员页有效；`/tags` 分类页使用不同的 `#tags a.tag` |
| `.tag-expand` | 标签展开控件 | 0 | 0 | 1 | 0 | 演员页 1；`/tags?c10=1` 10；其他样本无标签展开区 |
| `.movie-panel-info` | 详情页信息面板 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.video-meta-panel nav > div:nth-child(2) > span` | 详情页日期读取 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.panel-block .value` | 详情页元数据值 | 7 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `a[title="複製番號"]` | 详情页番号复制数据源 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效，值为 `DAZD-314` |
| `h2.title` | 详情页标题 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.panel-block.first-block a[data-clipboard-text]` | VLT 详情 HTML 的番号元素 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `body > section > div > div.video-detail > div.video-meta-panel` | 详情页信息容器（按钮挂载） | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.video-meta-panel > div > div:nth-child(2) > nav` | 详情页原生操作栏 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons` | 原生评价按钮挂载点 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.review-buttons` | 原生评价状态容器 | 3 | 不适用 | 不适用 | 不适用 | 详情页有效；页面内含多个分组容器 |
| `.review-buttons > div:nth-child(1) > div > div` | 评价面板分栏挂载点 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2)` | 详情原生操作栏父容器 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.review-buttons a[data-method='delete'][href*='/reviews/']` | 原生评价删除链接 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效；当前 review 有删除链接 |
| `.panel-block .value a[href]` | 详情元数据内链接（tooltip） | 18 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `.review-buttons a[href='/users/want_watch_videos'] .tag.is-info.is-light` | 「想看」状态芯片 | 0 | 不适用 | 不适用 | 不适用 | 当前用户样本没有「想看」状态，0 不判 selector 失效 |
| `.review-buttons a[href='/users/watched_videos'] .tag.is-success.is-light` | 「已看」状态芯片 | 1 | 不适用 | 不适用 | 不适用 | 当前用户样本有效 |
| `input[name="video_review[score]"]` | 原生评分 radio | 5 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `input[name="video_review[score]"][checked]` | 已选评分读取 | 0 | 不适用 | 不适用 | 不适用 | 当前样本未评分；状态不适用，不判 selector 失效 |
| `.video-meta-panel a` | 详情页视频信息区链接 | 29 | 不适用 | 不适用 | 不适用 | 详情页有效 |
| `strong:contains("日期:")` | `BasePlugin.getPageInfo()` 发布日期读取 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效；`日期:` 标签命中 1 |
| `strong:contains("演員")` | actress-info 插件的详情页插入锚点 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效；插件其余 `.female` 读取仍不适用且保持未改 |
| `strong.current-title` | VLT 下载详情 HTML 标题读取 | 1 | 不适用 | 不适用 | 不适用 | 详情页有效；命中标题链接 |
| `.origin-title` | 标题翻译优先目标 | 0 | 0 | 不适用 | 不适用 | 当前详情/首页无原题名节点；`.current-title` 回退命中，不判失效 |
| `.current-title` | 标题翻译回退目标 | 1 | 0 | 不适用 | 不适用 | 详情页有效；首页没有详情标题属不适用 |
| `.section-meta:not(:contains('影片'))` | 演员页名称/简介读取 | 不适用 | 不适用 | 1 | 不适用 | 女演员页有效；选中名称节 `みお`，排除影片计数节 |
| `.section-meta:contains('男優')` | 演员页性别角色判定 | 不适用 | 不适用 | 0（女演員）/ 1（男演員） | 不适用 | `/actors/PpQ0` 的 `男優, 3345 部影片` 命中，角色选择有效 |
| `.container .info` | 详情页外站信息挂载点 | 0 | 0 | 0 | 0 | 四类样本无此挂载点；不替代有效的 `.movie-panel-info` |
| `body > section > div` | 过滤栏备用根容器 | 1 | 1 | 1 | 1 | 四类样本均有根容器；仅在优先挂载点缺失时使用 |
| `body > section > div > div` | 过滤栏备用直接子容器 | 5 | 11 | 13 | 13 | 四类样本均有结构；优先 `.tabs.is-boxed` / `.actor-tags.tags` 命中时不走回退 |
| `.empty-message` | 热播/Top250 空状态清理 | 不适用 | 0 | 不适用 | 不适用 | `/rankings/top` 与 `/rankings/playback` 均有结果且为空态节点为 0；不判故障 |
| `#navbar-menu-hero` | 全局导航主菜单 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `#navbar-menu-hero .navbar-start` | 导航左侧区域 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `#navbar-menu-hero a.navbar-item` | 导航主菜单项 | 31 | 31 | 31 | 31 | 四类样本均有效 |
| `#navbar-menu-user .navbar-end` | 用户菜单区域 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `.navbar-end` | 全局导航右侧区 | 2 | 2 | 2 | 2 | 四类样本均有效 |
| `.navbar-search` | 全局导航搜索框 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `.navbar-item` | 全局导航项（FC2 文本选择器的候选节点） | 75 | 76 | 75 | 75 | 四类样本均有导航项 |
| `a.navbar-link[href="/makers"]` | 片商入口 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `a[href*="/feedbacks/new"]` | 反馈入口 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `a[href*="rankings/playback"]` | 热播排行榜入口 | 1 | 2 | 1 | 1 | 各样本均有效；首页另有一个菜单副本 |
| `a[href*="rankings/top"]` | TOP250 入口 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `a[href*="theporndude.com"]` | 外部导航链接 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `.main-nav` | 全局导航主容器 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `.container-fluid` | 页面宽度容器 | 0 | 0 | 0 | 0 | 四类样本均未使用，不据此判站点失效 |
| `.toolbar a.button` | 首页工具栏按钮 | 不适用 | 10 | 未测 | 未测 | 首页有效 |
| `body > section > div > div.movie-list.h.cols-4.vcols-8` | 首页/列表容器定位 | 不适用 | 1 | 1 | 1 | 首页、演员、系列列表均有效 |
| `body > section > div > div.toolbar` | 列表工具栏定位 | 不适用 | 1 | 1 | 1 | 首页、演员、系列列表均有效 |
| `.section .container` | 页面内容容器 | 1 | 1 | 1 | 1 | 四类样本均有效 |
| `.section .container .box` | 内容卡片容器 | 0 | 40 | 40 | 20 | 列表页有效；详情页用独立信息面板 |
| `#tags` | 标签筛选容器 | 0 | 0 | 0 | 0 | `/tags?c10=1` 与 `/search_advanced` 各 1；四个主体样本不含分类面板 |
| `#tags .tag-category .tag-expand` | 标签分类展开控件 | 0 | 0 | 0 | 0 | `/tags?c10=1` 命中 10；高级检索页无此控件属页面差异 |
| `#tags dl div.tag.is-info` | 当前选中标签 | 0 | 0 | 0 | 0 | `/tags?c10=1` 命中 1（「含磁鏈」） |
| `h2.section-title` | 高级检索标题 | 未测 | 0 | 不适用 | 不适用 | `/search_advanced` 与 FC2 结果页、演员搜索各 1；榜单页无此标题属页面差异 |
| `section > div > div.box` | 高级检索结果区 | 未测 | 0 | 不适用 | 不适用 | `/search_advanced` 与 FC2 结果页各 1；标签页无此布局 |
| `.main-tabs ul li:contains("猜你喜歡")` | Top250 导航入口替换 | 不适用 | 0 | 不适用 | 不适用 | 首页主标签无该文案；`/rankings/top` 导航入口仍有效，不为已不存在的标签加替代项 |
| `$('.navbar-item:contains("FC2")')` | 导航栏 FC2 文本入口 | 未测 | 4 | 未测 | 未测 | 首页有效；所设 href 的旧路由 404，属 URL 问题 |
| `$('.tabs a:contains("FC2")')` | 标签栏 FC2 文本入口 | 未测 | 1 | 未测 | 未测 | 首页有效；所设 href 的旧路由 404，属 URL 问题 |
| `.actor-box strong` | 演员搜索卡片关键词高亮 | 未测 | 0 | 0（演员主页）/ 3（`?f=actor` 搜索） | 不适用 | 演员搜索结果有效；普通首页与演员主页无 actor-box |
| `#lists` | JavDB 用户清单目录容器 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 1 |
| `#lists > ul` | 用户清单目录列表 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 1 |
| `#lists > ul > li` | 用户清单目录项 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 15 |
| `div.column.is-10 > a` | 用户清单项标题链接 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 22；仅读计数 |
| `.is-user-page .column.is-one-quarter` | 用户公开页评分卡片 | 不适用 | 不适用 | 不适用 | 不适用 | 未测：未访问公开用户档案页；两个当前用户清单页均无此结构 |
| `#lists` | JavDB「我的清单」容器 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 1 |
| `#lists > ul` | JavDB 清单目录列表 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 1 |
| `#lists > ul > li` | JavDB 清单目录项 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 15 |
| `div.column.is-10 > a` | 清单目录项标题链接 | 不适用 | 不适用 | 不适用 | 不适用 | `/users/lists` 命中 22；仅计数，未读清单文本 |
| `.is-user-page .column.is-one-quarter` | 用户公开页评分卡片分支 | 不适用 | 不适用 | 不适用 | 不适用 | 未测：未打开用户公开页；登录清单页不含此结构，不据此判失效 |


### 3.1 专属路由补充实测（Chrome DevTools，2026-09-26）

| 页面 | 已实测选择器与结果 | 判定 |
|---|---|---|
| `/tags?c10=1` | `#tags` 1；`#tags .tag-category` 10；`#tags .tag-category .tag-expand` 10；`#tags a.tag` 353；`#tags dl div.tag.is-info` 1；`.movie-list .item` 40；`.pagination` 1 | 标签页折叠、链接、已选标签和列表分页均有效 |
| `/search_advanced` | `h2.section-title` 1；`.section .container > .box` 1；`section > div > div.box` 1；`#tags` 1；`.empty-message` 1 | 高级检索页结构有效 |
| `/search_advanced?type=3&score_min=0&d=1` | `h2.section-title` 1；`.section .container > .box` 1；`section > div > div.box` 1；`.movie-list .item` 40；`.pagination` 1；结果文本为 FC2 影片 | 正确路由上的 FC2 高级检索选择器有效 |
| `/rankings/top` | `.movie-list .item` 40；`.section .container .box` 40；`.pagination` 1；`.empty-message` 0；`h2.section-title` 0 | 榜单列表和分页有效；有结果时无空状态节点属不适用 |
| `/rankings/playback` | `.movie-list .item` 60；`.section .container .box` 60；`.toolbar a.button` 5；`.pagination` 0；`.empty-message` 0 | 热播列表与工具栏有效；该结果页无分页/空状态属页面状态 |
| `/actors/PpQ0`（男演员森林原人） | `.section-meta` 1，文本 `男優, 3345 部影片`；`.section-meta:contains('男優')` 命中；`.actor-section-name`、`.actor-tags .content`、`.avatar` 各 1；`.tags a.tag` 214 | 男演员页元数据/角色判定选择器有效 |
| `/search?f=actor&q=森林原人` | `.actor-box` 3；`.actor-box strong` 3；演员链接 6 | 演员搜索结果标题选择器有效 |
| `/users/lists`（只读 DOM 计数） | `#lists` 1；`#lists > ul` 1；`#lists > ul > li` 15；`div.column.is-10 > a` 22；`nav.pagination` 1；上一页 1 | 清单目录选择器有效；没有读取清单名称/内容 |
| `/users/want_watch_videos`（只读 DOM 计数） | `.movie-list .item` 20；`nav.pagination` 1；`a.pagination-next` 1；`#lists` 0 | 用户影片列表由 `.movie-list` 承载；没有读取影片文本 |
| `/users/watched_videos`（只读 DOM 计数） | `.movie-list .item` 20；`nav.pagination` 1；`a.pagination-next` 1；`#lists` 0 | 同上；仅结构计数，不读取清单内容 |
| `/users/lists`（仅读 DOM 计数） | `#lists` 1；`#lists > ul` 1；`#lists > ul > li` 15；`div.column.is-10 > a` 22；`nav.pagination` 1；`a.pagination-previous` 1；`.movie-list` 0 | JavDB 清单目录选择器有效；未读取清单文本 |
| `/users/want_watch_videos`（仅读 DOM 计数） | `.movie-list .item` 20；`.pagination`/`nav.pagination` 1；`a.pagination-next` 1；`#lists` 0；`.is-user-page .column.is-one-quarter` 0 | 用户影片列表页由 `.movie-list` 路径承载；未读取影片文本 |
| `/users/watched_videos`（仅读 DOM 计数） | `.movie-list .item` 20；`.pagination`/`nav.pagination` 1；`a.pagination-next` 1；`#lists` 0；`.is-user-page .column.is-one-quarter` 0 | 同上；仅结构计数，不读取清单内容 |
| `/v/BzXnyr`、`/v/1AK4JW`、`/v/mO70gD` | `a.actor-male` 各 0 | 样本演员区均只有女性演员，不能据此判新版男性链接失效 |
| `/v/BzXnyr`、`/v/1AK4JW`、`/v/mO70gD` | `.male` 各 0 | 样本无男性演员标记，保留旧读法，待含男性演员的详情页再测 |

**旁证（非选择器，不在本次修复范围）**：FC2 导航当前指向 `/advanced_search?type=3&score_min=0&d=1`，真实返回 404；网站当前可用表单路由为 `/search_advanced?type=3&score_min=0&d=1`，返回 FC2 结果。`fc2-plugin.tsx` 中该旧 URL/路由判断属于 URL 兼容问题，本任务限定只修选择器，故未改。首页 `.main-tabs ul li` 共 9 项，但不含「猜你喜歡」；Top250 的 `/rankings/top` 导航链接仍存在，因此该 `:contains("猜你喜歡")` 旧目标标为不适用/无目标，不另造标签。

### 3.2 修复后真实详情页探针

`/v/pkWq0q` 普通硬刷新后，DOM 为 `a.actor-female` 11、`.female` 0，用户存储只读核验到该影片演员与收藏 ID 交集 11，`enableFavoriteActresses` 有效，但**当前已安装脚本**仍显示 `.highlighted` 0；页面中的 `.highlighted` CSS 已加载，规则计算为 `1px solid rgb(206, 34, 34)`。这说明浏览器当前运行的已安装脚本尚未体现本次磁盘构建的修复（或生产集成仍有问题）。

另用一次性 DOM 探针按源码中的 `a.actor-female` → href 末段 starId 匹配流程读取同一批只读记录：命中 11/11，临时加类时 `.highlighted` 为 11、边框为 `1px solid rgb(206, 34, 34)`；探针随后移除临时类/标题，结束时 `.highlighted` 恢复为 0。探针未写入 IndexedDB/GM 存储。

**端到端复测（已安装构建）**：用户将 v1.46.12 构建更新进 Tampermonkey 后，在 `/v/pkWq0q` 重新打开页面（无需临时探针），实测 `a.actor-female` 11、`.female` 0、`.highlighted` 11，命中链接 `title` 均为「高亮已收藏演员, 可在设置-基础配置中关闭」、计算边框 `1px solid rgb(206, 34, 34)`，`.highlighted` CSS 已加载。修复后的插件在真实详情页生效，C7 达成。

### 明确排除的非站点选择器

`.movie-info-container`、`.movie-gallery .image-list`、`.screen-container`、`a[data-cnsub-value]`、`.pagination-btn` 与 `#actress-pagination` 等由本项目组件生成（FC2 弹窗、截图面板、Top250 工具条、演员卡片分页），不是 JavDB 原生 DOM 依赖；不纳入站点改版故障统计。`#otherSiteBox` 同样由项目组件生成。

## 4. 根因与最小修复

确认的根因是详情页演员链接的选择器/关系改变：真实页上 `.female` 为 0，而 `a.actor-female` 有 11 个；原 `$('.female').prev()` 因而返回空集。没有男演员的样本不能用于推断 `.male` 是否失效。

新增纯读取模块 `src/core/util/site/actress-links.ts`：先查询 `a.actor-female`，无命中才按旧 `.female` 的前置兄弟回退；支持当前 `document` 和下载 HTML 的 detached DOM。接入仍在使用的四处读取：

- `base-plugin.ts`：详情页 `getPageInfo().actress`。
- `favorite-actresses-plugin.tsx`：收藏女优高亮。
- `video-lists-tag/vlt-helpers.ts`：清单记录演员名读取。
- `list-page-plugin.tsx`：解析 GMHttp 下载的详情页 HTML，并将 detached DOM 根传入 helper。

`actress-info-plugin.tsx` 按要求保持原样；它仍使用旧 `.female` 读法，因此在新版详情页不会读到演员名。该插件已弃置，本次不修、不删除。`.male` 也保留，待有含男演员的真实详情页样本后再判断。

## 5. 数据安全边界

本次没有修改 `storage-migrations.ts`、任何 StorageManager/IndexedDB/GM 存储写入路径；没有删除、迁移、清理或覆盖用户数据。helper 仅查询 DOM 并返回文本/链接，不持久化任何内容。既有空 `names` 不会被扫描回填或清空。今后用户主动触发的业务写入可能读取到新的演员名；这不是后台迁移，也不会由本修复自动触发。浏览器验证期间仅以 IndexedDB readonly transaction 读取所需标志/ID；schema 版本为 6（当前要求 6），临时 DOM 高亮探针清理后恢复为 0，无存储写入。

## 6. 修改文件

- 新增 `src/core/util/site/actress-links.ts`。
- 修改 `src/plugins/base-plugin.ts`、`favorite-actresses-plugin.tsx`、`list-page-plugin.tsx`、`video-lists-tag/vlt-helpers.ts`。
- 新增 `tests/util-site-selectors.test.ts`（覆盖新版优先、旧版回退、无演员、detached DOM）。
- 同步 `AGENTS.md` 与 `docs/plugin-catalog.md` 的 `src/core/` 文件总数（62）及 `util/` 子目录总数（21）。

## 7. 执行验证记录

### 执行环境

Windows / Bun；真实页面由 Chrome DevTools MCP 访问。直接 HTTP 请求 JavDB 返回 `403 Forbidden`，浏览器 MCP 为页面观测通道。

### 已执行

- `bun run build`：exit 0（`tsc -b && vite build`；产物 1,194.58 kB；LightningCSS 对 legacy `*zoom` 报 warning，但构建成功）。
- `bun run lint`：exit 0。
- `bun run lint:css`：exit 0。
- `bun run test`：exit 0；16 个测试文件、206 个测试通过。
- `bun run check:structure`：exit 0；374 files / 64 dirs 在门禁内。
- `bun run check:docs`：exit 0；44 plugins、62 core files。
- `impeccable detect --json`（本次 5 个改动源码）：exit 0，结果 `[]`。
- `dist/monkey-jhs-disassemble.user.js` 的 `@version` 与 `package.json` / `vite.config.ts` 均为 `1.46.12`。
- helper 测试由 jsdom 解析新版与旧版 DOM；纯函数不触碰 storage。
- 数据安全核对：`git status --short -- src/core/storage src/plugins/actress-info-plugin.tsx` 无输出；未改动任何迁移/存储文件，也未改动 actress-info 插件。
- 额外 `git diff --check` exit 2：只报告工作区既有的 9 个设置面板文件尾随空格（不在本任务修改范围）；该命令不包含未跟踪的新文件。

### 复测结果与已知限制

- Chrome DevTools MCP 已恢复；除四个主体样本外，已实测 `/tags?c10=1`、`/search_advanced`、FC2 高级检索结果页、`/rankings/top`、`/rankings/playback`、男演员页 `/actors/PpQ0` 和演员搜索结果。结果见 §3.1。
- `/v/pkWq0q` 端到端复测（用户将 v1.46.12 构建更新进 Tampermonkey 后）：`a.actor-female` 11、`.female` 0、`.highlighted` **11/11**，每个命中链接的 `title` 为「高亮已收藏演员, 可在设置-基础配置中关闭」，计算样式为 `1px solid rgb(206, 34, 34)`；`.highlighted` CSS 已加载。修复后的插件在真实详情页生效，C7 达成。
- 已知限制：静态扫描的约 105 个站点候选未逐项全部映射/分类（已实测 80+ 项），少数隐私/运行时路由（用户公开档案页 `.is-user-page .column.is-one-quarter`）标为未测；不影响主体结论。FC2 旧 URL 返回 404 属 URL 兼容问题，不在本次仅修选择器范围内。

## 8. 结论

已修复真实证据确认的 `.female` 失效根因，并以新旧兼容 helper 保留旧结构；build、lint、lint:css、test、check:structure、check:docs 与 `impeccable detect` 均通过。选择器清单已覆盖详情/列表/演员/标签/榜单/用户清单等路由的 80+ 项实测，临时探针与已安装构建的端到端复测均确认 11 个收藏演员被正确加高亮；actress-info 插件与存储/迁移代码未改动，schema 版本仍为 6。少数隐私/运行时路由（如用户公开档案页 `.is-user-page`）标为未测，不影响主体结论。
