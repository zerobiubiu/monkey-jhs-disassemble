# 06 - 瀑布流交互与清单同步（doc/118–129）

> **文档类型**：📄 参考说明（阶段融合文档）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/118 – doc/129，共 12 份历史文档
> **时间线**：2026-07-18 至 2026-07-19（doc/123、124 标注 07-18；doc/125–128 标注 07-19；doc/118–122、129 未标注执行日期）
> **合并说明**：本文由 doc/118–doc/129 共 12 份已执行文档按时间线融合精简而成。仅从原文提炼、合并，不新增原文不存在的事实、数字或结论；无法确认的细节一律删去。文中保留 "doc/NN" 数字引用作为历史事件标识（指向 doc/ 目录对应编号的原始文档，原文件在合并完成后删除）。两条同主题迭代链合并为单一条目：① 瀑布流加载模式 doc/118→doc/120→doc/127（常开化→分段控件→click 模式状态修复）；② 等待更新清单联动 doc/124→doc/125。另有一条跨文档证据链：doc/125 推测的 count 字符串拼接根因被 doc/126 现场核对推翻，但 v1.19.7 的 count 对账修复仍然有效。

## 阶段概览

本阶段围绕两条主线：瀑布流（列表/清单）加载交互的三次迭代（doc/118 常开与加载方式切换 → doc/120 分段按钮 → doc/127 click 模式状态机死锁修复），以及 JavDB 清单数据一致性（doc/124 评分后移出「等待更新」→ doc/125 count 对账与加入他清单取消等待更新 → doc/126 服务端/本地关联分叉根治 → doc/128 详情页清单面板结构化改版）。其间穿插快捷设置面板 UI 优化（doc/119）、瀑布流不再修改地址栏 URL（doc/121）、访问记录悬浮时间分级配色与空态（doc/122）、恢复导航栏搜索框粘贴自动搜索（doc/123）与 Top250/热播封面 CDN 域名轮换修复（doc/129）。版本从 1.18.1 演进至 1.20.1。

---

## 一、瀑布流加载模式演进（doc/118 → doc/120 → doc/127）

### doc/118 瀑布流常开 + 触底加载方式切换（1.18.1 → 1.19.0）

**背景/根因**

原快捷设置有「瀑布流模式」总开关（`autoPage`）：关 = 传统分页 + 自动排序，开 = 瀑布流 + 「加载全部」。用户要求：去掉瀑布流总开关、**默认常开**；触底加载分两种——自动下一页 / 底部出按钮点了再加载；「加载全部」按钮在仍有下一页时**一直存在**。

**方案与关键决策**

| 设置 | 说明 |
|------|------|
| ~~`autoPage` UI~~ | 移除；逻辑上瀑布流常开，不再以它关闭瀑布流 |
| **`autoPageLoadMode`** | `auto`（默认）触底自动加载下一页；`click` 触底显示「点击加载下一页」，点 loader 再加载 |

行为变化：

- `waterfall()` 不再判断 `autoPage === YES` 才显示「加载全部」，有下一页即显示；`loadNextPage` 不再因 `autoPage === NO` 早退
- `checkLoad`：`auto` → 调 `loadNextPage`；`click` → `setState('waterfall-click', '点击加载下一页')`
- loader 点击在 `waterfall-error` 或 `waterfall-click` 状态时加载
- 设置面板 `setLoadMode` 即时切换，无需整页刷新
- ListPageButtonPlugin 不再读 `autoPage`、不自动 `sortItems`（与常开瀑布流一致）

**实施要点（文件级）**：`components/simple-setting-panel.tsx`（瀑布流开关 → 触底加载方式 select）；`plugins/setting-plugin.tsx`（load/save `autoPageLoadMode`，移除 autoPage change）；`plugins/auto-page-plugin.ts`（loadMode/checkLoad/loader 点击/loadAll 常显/setLoadMode）；`styles/auto-page-plugin.css`（`.waterfall-click` 样式）；`plugins/list-page-button-plugin.tsx`（去掉 autoPage 自动排序分支）。

**结果**：列表页默认触底自动翻页 + 右下角「加载全部」常显；切「点按钮」后滑到底只出现蓝字「点击加载下一页」，点后才追加；「加载全部」始终可点。

### doc/120 触底加载控件改为分段按钮（1.19.1 → 1.19.2）

**背景/根因**：doc/118 引入的「触底加载」使用原生 `<select>`，在悬浮窄面板中下拉难用，样式与周围开关不统一。

**方案**：改为二选一**分段按钮**（segmented control）——同一行 `触底加载 + [ 自动 | 点按钮 ]`；容器 `#autoPageLoadMode` 用 `data-value` 存当前值；点击切换 `is-active`，即时写 `autoPageLoadMode` 并调 `AutoPagePlugin.setLoadMode`。存储键与语义不变（`auto` / `click`）。

**实施要点**：`simple-setting-panel.tsx`（select → `jhs-qs-seg` 双按钮）；`styles/setting-plugin.css`（分段按钮样式，删 `.jhs-qs-select`）；`setting-plugin.tsx`（回填 active + click 绑定）。

### doc/127 click 模式只能加载一次修复（1.19.8 → 1.19.9）

**背景/根因**：用户反馈「点按钮」模式下第一次滑底正常出现「点击加载下一页」，点击追加后继续滑底按钮不再出现。登录态现场复现于 `/lists/BdY5a`：首屏 40 条、下一页 `?page=2`；第一次触底 loader 为 `jhs-scroll waterfall-click`，点击后 80 条且服务端仍有下一页；第二次触底 loader 却保持 `jhs-scroll waterfall-loading`、文案为空。已排除 JavDB 末页、分页缺失及 `ListWaterfallPlugin` 干扰（该插件只处理 `/users/lists` 与 `/users/favorite_lists`，`/lists/BdY5a` 走 `AutoPagePlugin`）。

**根因**：`AutoPagePlugin.loadNextPage()` 发起请求时把 loader 切到 `waterfall-loading`。普通分页与 Beyond60 两条成功路径完成后，旧代码都执行 `setState('waterfall-loading', '')`——只清空文案，**没有退出 loading 状态**。click 模式的 `checkLoad()` 为防止请求重入，会拒绝处理仍带 `waterfall-loading` 的 loader，于是 `finally` 中的检查、后续 scroll 事件及列表 DOM 变化触发的检查全部被同一守卫拦截，形成状态机死锁。该问题由 doc/118 引入 click 模式时出现：新逻辑加了 loading 守卫，但沿用了旧自动模式「loading 类 + 空文案」表示加载结束的写法。

**方案**：普通分页与 Beyond60 成功后统一把 loader 切回中性空闲态 `setState('', '')`；保留 `waterfall-loading` 守卫确保真实请求期间不重复显示按钮或发起请求。之后沿用既有 `finally` 逻辑：新内容不足以把 loader 推出触发区时立即重新显示「点击加载下一页」但不自动请求；loader 已离开触发区则保持空闲，下次滑底重新显示按钮；无下一页仍进 `waterfall-no-more`；请求失败仍进 `waterfall-error` 并允许点击重试；自动模式与右下角「加载全部」流程不变。

**实施要点**：`plugins/auto-page-plugin.ts`（普通分页和 Beyond60 成功后退出 loading、回到空闲态；补充状态参数说明）。本次未增删或重命名源码文件，无需更新 AGENTS.md。

**结果**：浏览器行为验证——在复现后的 80 条页面将 loader 恢复为空闲态并触发 scroll 检查，立即重新得到 `waterfall-click / 点击加载下一页`，第二次点击后影片增加到 120 条，证明下一页 URL、事件绑定和追加逻辑均正常，唯一阻断点就是残留 loading 类。

**演进链与遗留**：doc/118 定义 `autoPageLoadMode` 语义 → doc/120 改控件外观（语义未变）→ doc/127 修复 click 模式因沿用自动模式状态写法导致的状态机死锁。遗留：后续验证建议覆盖「点按钮」连续三页、请求期间防重复点击、末页与失败态、自动模式 / 加载全部 / Beyond60 回归。

---

## 二、快捷设置面板 UI 优化（doc/119，1.19.0 → 1.19.1）

**背景/根因**：悬浮快捷设置（`SimpleSettingPanel`）长期沿用旧式 `setting-item` 纵向堆叠布局；面板定位依赖 CSS 占位 `__SIMPLE_SETTING_RIGHT__: -300%`，在导航栏右侧容易溢出或贴边难看；鼠标从「设置」移入面板时，按钮与面板间隙立刻触发 `mouseleave` 导致面板闪关；每次 `mouseenter` 都 `initSimpleSettingForm` 重复 `.on()`，事件可能叠加。

**方案与关键决策**：

1. **结构重写**：改为分组卡片布局（列表显示 / 浏览行为 / 功能 / 页面布局），行式「标签 + 控件」，底部固定「常见问题 / 更多设置」。
2. **定位与样式**：去掉 `__SIMPLE_SETTING_*__` 占位；面板 `top: calc(100% + 6px)`、`right: 0`、固定宽 340px；`::before` 热区桥接移入间隙；圆角/阴影/分区色与 mini-switch 尺寸约束。
3. **交互**：`mouseleave` 延迟 220ms 再关闭，`mouseenter` 取消定时器；表单绑定使用 `.jhsQs` 命名空间 + `off().on()` 防重复绑定；「显示所有已鉴定」开启时分项卡片 `is-disabled` 视觉弱化。

表单控件 **id 全部保留**，业务逻辑与 storage 键不变。

**实施要点**：`components/simple-setting-panel.tsx`（分组 `jhs-qs-*` 布局重写）；`styles/setting-plugin.css`（快捷面板定位 + 内部样式，删占位依赖）；`plugins/setting-plugin.tsx`（延迟关闭 / open helper；initCss 只 replace `__CSS_TEXT__`；form 命名空间绑定）。

**演进链**：其引入的面板框架随后承载 doc/120 的触底加载分段按钮（`jhs-qs-seg` 样式即本阶段新增），doc/128 的整体设置弹窗与快捷面板继续共用该表单绑定约定。

---

## 三、瀑布流不再修改地址栏 URL（doc/121，1.19.2 → 1.19.3）

**背景/根因**：列表瀑布流（AutoPagePlugin）滚动时会 `history.replaceState` / `pushState` 把地址栏改成 `?page=N`；清单瀑布流（ListWaterfallPlugin）同样 `replaceState`。用户希望瀑布流加载时**保持进入页面时的原始 URL**，方便复制/分享入口链接，也不污染浏览器历史。

**方案与关键决策**：

- `AutoPagePlugin.checkScrollPosition`：仍更新内部 `currentPage`（「加载全部」文案等），**不再**调用 `updatePageUrl`
- `updatePageUrl` / `updatePageUrl_old`：改为 no-op；移除对 `featureFlags.autoPageReplaceState` 的依赖
- `ListWaterfallPlugin.updateCurrentPageFromScroll`：去掉 `replaceState`

加载下一页仍用内存中的 `nextUrl`，与地址栏无关。

**实施要点**：`plugins/auto-page-plugin.ts`（去 URL 同步；updatePageUrl no-op；删 featureFlags import）；`plugins/list-waterfall-plugin.ts`（去 replaceState）。

**结果**：列表页与 `/users/lists` 等清单瀑布流滚动加载多页时地址栏不变，刷新仍回到进入时的入口页。

---

## 四、访问记录悬浮：时间分级配色 + 无记录提示（doc/122，1.19.3 → 1.19.4）

**背景/根因**：访问记录 tooltip 只有一种绿色，远近时间不直观；无访问记录的元数据链接 hover 无反馈，易误以为功能失效。

**方案**：分级阈值与文案规则一致（`formatVisitTime`）：

| 分级 | 条件 | 文案 | 配色感觉 |
|------|------|------|----------|
| sec | <1 分钟 | N秒前打开过 | 安全 · 翠绿 |
| min | <1 小时 | N分钟前打开过 | 安全 · 青绿 |
| hour | <1 天 | N小时前打开过 | 留意 · 琥珀 |
| day | <1 周 | N天前打开过 | 警告 · 橙 |
| old | ≥1 周 | YYYY-MM-DD 打开过 | 危险 · 红 |
| none | 无记录 | 无访问记录 | 白底灰字 |

所有元数据链接均绑定 hover；无记录也显示白框「无访问记录」。

**实施要点**：`plugins/visit-history-plugin.ts`（tier + 无记录；format 返回 text/tier）；`styles/visit-history-tooltip.css`（6 档配色 class）。

---

## 五、恢复导航栏搜索框粘贴自动搜索（doc/123，1.19.4 → 1.19.5）

**背景/根因**：用户反馈页面导航栏自定义搜索框（`#search-keyword`）的快捷功能失效，例如粘贴文本后不再自动跳转搜索。

**破坏时机**：提交 `3611d81`（2026-07-11）集成 jhs 3.3.6.027 可插拔升级（doc/76、doc/78 §⑩）时，`featureFlags.navBarNoPaste` 默认 `true`，跳过 paste 绑定。升级对照新版导航栏已无粘贴自动搜索，为「避免粘贴图片误触发搜索」引入该 flag。

**原版行为**（`archetype/jhs.user.js` L4993–5004）：粘贴时已做图片检测——剪贴板含 `image/*` 则直接 return，**仅文本粘贴**才 `setTimeout` 点击 `#search-btn`。因此「禁 paste」对图片本无必要，却误伤了番号/关键词粘贴即搜的常用快捷。回车搜索、点击检索按钮逻辑未受影响，仅 paste 被 flag 关掉。

**方案**：将 `navBarNoPaste` 默认值改回 `false`，恢复 paste 绑定；`nav-bar-plugin.tsx` 的 paste 分支无需改代码，flag 关时原逻辑即生效。仍可通过控制台 `localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ navBarNoPaste: true }))` 回退到升级后行为。

**实施要点**：`core/feature-flags.ts`（`navBarNoPaste: true` → `false`）。

**结果**：粘贴番号/文本自动打开/跳转 `/search?q=...`，粘贴图片不自动搜索；回车、点击「檢索」仍正常。

---

## 六、等待更新清单自动联动（doc/124 → doc/125）

### doc/124 评分/已读后自动移出「等待更新」（1.19.5 → 1.19.6）

**背景/根因**：用户在详情页做出评分（0–5 星）或点击「已读」（0 星）后，若当前视频仍在名称包含「等待更新」的清单中，应自动移出；不在该清单则不做任何处理。既有 doc/53 已实现向「等待更新」清单**添加**视频时自动收藏，本需求为其反向闭环：评完分/已读 = 不再「等待更新」→ 移出清单。

**切入点**：星标 1–5 走 `DetailPageButtonPlugin.quickSetHasWatch(score)`（已观看 + N 星）；「已读」按钮走 `quickSetHasWatch(0)`（已观看 + 0 星）。不挂钩拉黑 `quickBlock`、菜单「已观看」`hasWatchOne`（关页且无星级 UI）。

**方案**：在 `quickSetHasWatch` JHS 写入成功后 fire-and-forget 调用 `autoRemoveFromPendingUpdateOnWatch()`：

1. 扫描 `#modal-save-list` 内已勾选、且清单名含「等待更新」的 checkbox
2. `checked = false` + `dispatchEvent(change)` → 依次触发 JavDB Stimulus `list#listCheckboxChanged`（服务端移出）与 `setupCheckboxListener` → `handleCheckboxChange(..., false)`（本地 IDB + 广播 + toast）
3. 同步取消 `.jhs-list-panel` 克隆勾选（仅 UI，不二次派发）

关键词与 doc/53 共用 `AUTO_FAVORITE_KEYWORD = '等待更新'`（名称包含即匹配，如「等待更新-无码」）。

**兜底**：清单 DOM 已加载且已勾选 → 立即 uncheck（主路径）；DOM 未就绪但 VltDb 有关联 → 最多轮询约 3s 等 checkbox 再 uncheck；仍无 DOM → 仅 `handleCheckboxChange(..., false)` 本地 IDB 移除。评分未变化（同星级早退）不触发移出。

**实施要点**：`plugins/video-lists-tag/vlt-sync.ts`（新增 `autoRemoveFromPendingUpdateOnWatch` / `uncheckPendingUpdateListCheckboxes` / `findPendingUpdateListsForCurrentMovie`）；`plugins/detail-page-button-plugin.tsx`（`quickSetHasWatch` 成功后调用）。

### doc/125 加入他清单自动取消等待更新 + count 漂移修复（1.19.6 → 1.19.7）

**背景/根因**

- **Bug——清单「迫切想看4」实际 498 条却提示「已达上限 501 条」**：JavDB 端仅有 498 条视频，向其中添加新影片却 toast「已达收藏上限（501 条）」，其他清单正常。根因：`VltDb.sync` 的 add 分支上限检查读取 `inventory[listId].count`——该字段是**手动 ±1 维护的缓存值**，不与 `movie_inventory` 实际关联数自动对账，一旦漂移到 ≥501，后续所有 add 都误报 `limit_exceeded`。漂移最可能路径：count 被存为字符串（如导入数据 JSON 中 `"count": "498"`），`currentCount + 1` 执行**字符串拼接**（`"498" + 1 = "4981"`），下次 add 时 JS 强转数值比较 `"4981" >= 501` 为 true → 误报。其他漂移路径（并发 sync 覆盖、外部直接操作清单等）被同一对账机制覆盖。
- **新功能**：当「等待更新」清单中的视频被加入到**其他**清单时，自动取消其「等待更新」勾选——与 doc/53（加入等待更新即收藏）、doc/124（评分后移出等待更新）形成闭环；判定沿用 `AUTO_FAVORITE_KEYWORD` 包含匹配。

**方案**

1. **count 对账**：`VltDb.sync` 的 add/remove 分支每次 sync 都从 `movie_inventory` 实际关联数重新计算 `actualCount`，以实际值为上限检查依据并回写 `count` 字段使其逐步收敛。字符串 count 对账时直接覆盖为数值，永久消除字符串拼接；「迫切想看4」下次 add 时 `actualCount = 498 < 501`，正常添加。
2. **自动取消**：`vlt-sync.ts` 的 `handleCheckboxChange` 在 `checked === true` 分支内，当清单名**不含**「等待更新」关键词时调用 doc/124 已有的 `uncheckPendingUpdateListCheckboxes()`（取消勾选所有已勾选的「等待更新」checkbox 并派发 change → 服务端移除 + 本地 IDB 移除 + 广播 + toast）。该函数返回 0（无已勾选的等待更新清单）时 noop，符合「不在则无需处理」。

**实施要点**：`plugins/video-lists-tag/vlt-db.ts`（sync add/remove 分支：actualCount 对账 count 字段，上限检查改用 actualCount）；`plugins/video-lists-tag/vlt-sync.ts`（`checked` 分支：清单名不含关键词时调 `uncheckPendingUpdateListCheckboxes()`）。复用 doc/124 函数，零新增副作用。

**演进链与遗留**：doc/124 提供 `uncheckPendingUpdateListCheckboxes` 复用点，doc/125 借其完成「加入他清单→取消等待更新」闭环。doc/125 的 count 字符串拼接推断在 doc/126 被现场核对推翻（见下节），但 v1.19.7 的 count 对账修复仍有价值：doc/126 确认本次事故为真实本地关联未写入服务端，并非 count 类型问题。

---

## 七、JavDB 清单服务端/本地关联分叉修复（doc/126，1.19.7 → 1.19.8）

**背景/根因**：用户反馈详情页 `https://javdb.com/v/ne8nk9` 向「迫切想看4」添加影片提示已达 501 条，但 JavDB 清单页面当时只显示 498 条。登录态浏览器现场核对：

- 服务端：498 条、498 个唯一番号；本地 `vlt_movie_inventory`：501 条、501 个唯一番号
- 本地独有：`EBWH-144`、`EBWH-100`、`EBWH-164`；服务端独有：0 条

结论：本次事故**不是** doc/125 推测的 `inventory.count` 字符串拼接，而是三个**真实的本地关联未成功写入 JavDB**。doc/125 已执行文档按 migration 原则不回改；v1.19.7 对 count 缓存的修复仍然有效，但无法解决「服务端请求未确认、本地先写」问题。用户手动补齐三条后再次完整读取 13 页：服务端标题 501、501 个唯一番号、本地 501 个关联，双向差集均为 0。

**根因**：JavDB 原生 `list_controller#listCheckboxChanged` POST `{video_id, checked, list_id}`，只有响应 `data.success === true` 才代表站内写入成功，失败时原生代码会回退 checkbox。旧版 `setupCheckboxListener` 与原生 Stimulus 请求互不关联：它监听同一个 change，固定延迟 300ms 后直接调用 `VltDb.sync()`，因此下列情况都会让**本地先增加、服务端没有对应关联**：

1. JavDB 返回业务失败（包括 501 上限）
2. 网络失败、超时或响应解析失败
3. POST 尚未结束时关闭/跳转页面
4. 快速操作或多标签页导致独立 IDB 读写互相覆盖

此外，评分后自动移出「等待更新」的 DOM 不可用兜底曾明确「仅删除本地」，清单删除曾在 JavDB 请求和本地删除之间使用 `Promise.all`，也存在同类分叉风险。

**方案与关键决策**

1. **服务端成功后才写本地**：捕获阶段仅接管 `#modal-save-list` 的原生 checkbox change；平铺面板先按 `data-list-id` 映射到 modal，避免索引错位；阻止 Stimulus 重复请求，由插件发送与 JavDB 原生一致的 `/users/save_video_to_list` JSON POST；`success=true` 后再读取 `/users/simple_lists?vid=...` 的权威勾选态和数量，随后提交 IDB；`success=false` 不写本地并恢复 UI；按 `page` 中 `a[rel=next]` 完整翻页，只有耗尽分页后才能把「未找到清单」判为未勾选；网络结果不确定时不写本地、不清恢复日志，下次打开页面再读取最终权威状态。
2. **崩溃恢复与并发串行**：POST 前同步写入独立 localStorage 恢复日志（写失败则取消本次操作）；只有 JavDB 权威状态已读取且本地提交/完整对账成功后才删除日志；页面启动时恢复遗留日志，恢复动作与实时操作共用同一 association 队列；用 `navigator.locks` 对 `designation::listId` 加同源跨标签页排他锁，覆盖 POST → 权威读取 → IDB 提交的整个流程。
3. **原子 IDB 与安全对账**：`movies`、`inventory`、`movie_inventory`、`meta` 在同一个 IndexedDB readwrite transaction 内读取、计算、写回，消除多标签页「旧对象后写覆盖」；`meta` 增加 `epoch + listRevisions`，完整分页抓取期间若本地发生变化则 guard 冲突并零写入重试；详情页清单内容稳定后比较 JavDB 显示数量、当前影片勾选态与本地真实关联，有差异才触发全量对账；单次对账连续抓取两份完整分页快照，要求标题总数、原始条数、唯一番号数、全量番号顺序完全一致，任一分页失败、503/登录页/Cloudflare 页、重复番号、循环分页或两次快照变化均零写入；对账只替换目标 listId 的关联，保留其他清单、清单 style 和影片 createdAt。
4. **其他一致性修复**：评分后自动移出「等待更新」的 DOM 兜底改走同一服务端确认链路，删除「仅本地 remove」；清单删除改为 JavDB DELETE 成功后再删除本地 IDB 和 DOM；平铺面板到 modal 的 checkbox 映射由数组下标改为 `data-list-id`。

**实施要点（文件级）**：`vlt-sync.ts`（接管 checkbox 请求、权威状态分页读取、持久化恢复日志、同页队列、Web Locks、失败 UI 回滚；等待更新兜底与清单删除改为服务端成功优先）；`vlt-db.ts`（四逻辑对象单事务写入；revision/epoch/fingerprint guard；完整清单快照对账；服务端确认写入模式）；`vlt-reconcile.ts`（**新增**完整分页双快照抓取、严格校验、差异检测和自动对账模块）；`vlt-plugin.tsx`（更新模块说明）；`detail-page-button-plugin.tsx`（平铺清单 checkbox 按 `data-list-id` 映射）；AGENTS.md（模块数 5 → 6）。

**结果**：线上只读验证（用户手动补齐三条后）`expected=501, pages=13`，`serverCount=501, serverUnique=501, localCount=501`，`localOnly=[]`、`serverOnly=[]`，服务端与本地完全一致。

**演进链与遗留**：doc/125 的 count 缓存修复（v1.19.7）被确认为必要但非充分；doc/126 建立「服务端确认 → 权威复核 → 原子写本地 → 崩溃恢复日志 → 双快照对账」的完整一致性链路。遗留：后续验证建议覆盖满清单勾选回滚、模拟网络失败保留恢复日志、POST 后立即关页再打开恢复、双标签页 Web Lock 串行、人为制造本地 501/服务端 498 触发对账精确移除多余三条。

---

## 八、详情页清单面板 UI、排序与可靠交互优化（doc/128，1.19.9 → 1.20.0）

**背景/根因**：视频详情页原清单区域只是把 JavDB 隐藏弹窗中的 checkbox 逐项克隆到一个空容器：清单较多时缺少层级、搜索和统计；顺序完全服从服务端返回，用户要求默认名称降序并可切换；加载、空数据、网络失败和不可操作状态没有明确反馈；modal 或 listContainer 被 JavDB 替换时旧观察节点和按位置同步可能失效；`/users/simple_lists` 存在分页时首屏不能代表完整清单集合；新建清单若仅依据模糊名称或页面瞬时 DOM 判断，可能把错误 ID 写入本地关联。

本次在不改变 JavDB 原生 checkbox 写入链的前提下，将详情页清单区升级为稳定、可检索、可排序的渐进增强面板，并继续遵守 doc/126 的「服务端成功及权威复核后才能写本地」原则。

**方案与关键决策**

1. **信息结构与排序**：面板拆为四个稳定区域——标题与「已加入 / 显示」汇总；默认「名称降序」的排序选择器（可切换「名称升序」）；即时搜索框与独立清空按钮；只重绘条目的列表区以及加载、空数据和错误状态区。排序使用 `Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })`，同名时以 `listId` 稳定决胜。搜索和排序只改变展示克隆的可见性与顺序，不改变 JavDB 原生 DOM，也不影响服务端清单顺序。
2. **完整分页与稳定同步**：以 `/users/simple_lists?vid=...` 为权威清单源，跟随同源、同路径的 `rel=next` 聚合全部分页（50 页上限、已访问 URL 防环、10 秒超时）；后续页条目先按 `listId` 去重再补入隐藏 modal，所有操作仍由唯一的原生 checkbox 发出，展示面板不构造第二条服务端写入链；观察稳定的 modal 外壳而非一次性 listContainer，容器被替换时递增 generation，旧分页结果不得覆盖新一代数据；完整加载失败保留已取得数据并标记「部分清单」，初始化失败提供明确重试入口；source 消失、禁用或已过期时回滚展示 checkbox 并提示重试；原生 checkbox 的 checked/disabled/busy 变化优先就地同步，完整重绘时恢复原焦点。
3. **新建清单可靠性**：完整分页基线未就绪时禁用「新建」；提交前记录完整 `beforeIds`，随后仅接纳不在基线中的候选 ID；候选必须通过 `/users/simple_lists` 再次确认——规范化名称精确相等、当前影片 `checked=true`、数量有效；多个候选或结果未知均不得写本地；`/users/lists` 回退路径同样使用规范化精确名称和唯一 ID，再执行上述权威复核；成功后只提交已确认的单个 checkbox，失败或未知保留输入与焦点，不显示假成功；新建表单、取消、Enter、输入法组合键、busy 和焦点恢复均有独立状态控制。

**UI 与无障碍**：延续 JavDB/Bulma 的克制工具型风格，不引入装饰性渐变或重阴影；桌面端自适应双列、320px 可滚动条目区，移动端单列自然展开；名称最多两行、数量为独立徽标，选中态和「同步中 / 已满 / 不可用」不只依赖颜色；搜索、清空、重试及移动端条目具备清晰焦点和至少 44px 触控高度；`aria-live` 播报汇总和错误，`aria-busy` 表达加载/提交状态；支持 `prefers-reduced-motion`，禁用非必要过渡。以上取舍登记在根目录 `PRODUCT.md`，作为后续界面工作的产品与设计上下文。

**实施要点（文件级）**：`PRODUCT.md`（新增产品定位、视觉个性、反例、设计原则与 WCAG 2.1 AA 基线）；`components/list-panel.tsx`（空容器 → 语义化标题、排序、搜索、列表和状态外壳）；`detail-page-button-plugin.tsx`（默认名称降序/升序切换、搜索、汇总、完整分页聚合、稳定观察和可靠事件映射）；`vlt-sync.ts`（适配结构化名称/数量，强化 busy、焦点、新建清单唯一候选及服务端权威确认）；`styles/rating-bar.css`（清单面板桌面/移动布局、状态、加载、错误和无障碍样式）；`styles/video-lists-tag.css`（新建清单表单、按钮、焦点与移动端排列）。未新增或删除插件，未改变 PluginManager 注册及核心启动顺序。

**结果**：登录态只读验证 `v/ne8nk9`：接口共返回 13 项（12 个自定义清单 + 1 个预设清单），无下一页，面板正确展示 12 项；默认降序为「值得复盘 … 等待更新」，切换升序后反转；搜索「迫切想看」显示 5 项，汇总为「已加入 1 · 显示 5/12」，清空后恢复全部；桌面栏宽正确形成两列，移动视口单列、无内层滚动，搜索与清空控件均为 44px；「已满」状态、数字数量、焦点、空/加载/错误结构和包含括号的名称解析均通过检查；验证过程未点击原生 checkbox，未创建、删除或改名清单。专项审查未发现 P0/P1 问题：排序后的展示项仍只向唯一原生 checkbox 转发一次，新建清单在失败或未知状态下不会写入本地。

**演进链与遗留**：承接 doc/126 一致性链路并扩展为完整面板。遗留：真实账号加入/移出的提示与计数同步、多页清单搜索排序、新建清单断网失败路径、移动端实机长名称/软键盘/滚动位置保持等仍需部署后验证。

---

## 九、Top250/热播榜单封面 CDN 域名轮换修复（doc/129，1.20.0 → 1.20.1）

**背景/根因**：用户反馈 Top250 榜单页（`advanced_search?handleTop=1&period=daily`）封面图片加载失败。排查发现 `HitShowMovieItem` 组件（`src/components/hit-show-movie-item.tsx`）中封面 `cover_url` 的 CDN 域名替换使用**硬编码字面量** `replace('https://tp-iu.cmastd.com/rhe951l4q', 'https://c0.jdbstatic.com')`，而 `src/constants/api.ts` 的 `_updateImgServer` 已使用**域名无关正则** `replace(/https:\/\/.*?\/rhe951l4q/g, 'https://c0.jdbstatic.com')`；新版参考脚本 `archetype/jhs.3.3.6.027.user.js:661` 同样使用正则形式。当 API 返回的 `cover_url` 域名从 `tp-iu.cmastd.com` 轮换为其他 host（路径仍含 `/rhe951l4q`）时，字面量 replace 不匹配、不替换，`<img src>` 指向已失效的旧域名，导致封面加载失败。

Top250 榜单（`handleTop=1`）和热播榜单（`handlePlayback=1`）均通过 `HitShowPlugin.markDataListHtml` → `HitShowMovieItem` 渲染封面，因此两个榜单均受影响。

**方案与实施要点**：`HitShowMovieItem` 中的硬编码字面量替换改为调用 `_updateImgServer`（从 `../constants/api` 导入），`src` 属性改为 `_updateImgServer(movie.cover_url || '')`，与 `api.ts` 内 `markDataListHtml` 及新版参考脚本行为一致，兼容 CDN 域名轮换。

**结果**：封面图域名统一经 `_updateImgServer` 正则替换至 `c0.jdbstatic.com`，Top250 与热播两个榜单的封面加载恢复。

---

## 附：版本演进一览

| 版本 | 变更 | 文档 |
|------|------|------|
| 1.18.1 → 1.19.0 | 瀑布流常开 + 触底加载方式切换（去掉 autoPage 总开关，新增 autoPageLoadMode） | doc/118 |
| 1.19.0 → 1.19.1 | 快捷设置面板 UI 优化（分组卡片、定位、延迟关闭、防重复绑定） | doc/119 |
| 1.19.1 → 1.19.2 | 触底加载控件 select → 分段按钮 | doc/120 |
| 1.19.2 → 1.19.3 | 瀑布流不再修改地址栏 URL | doc/121 |
| 1.19.3 → 1.19.4 | 访问记录悬浮时间分级配色 + 无记录提示 | doc/122 |
| 1.19.4 → 1.19.5 | 恢复导航栏搜索框粘贴自动搜索（navBarNoPaste 默认回 false） | doc/123 |
| 1.19.5 → 1.19.6 | 评分/已读后自动移出「等待更新」清单 | doc/124 |
| 1.19.6 → 1.19.7 | 清单 count 漂移对账修复 + 加入他清单自动取消等待更新 | doc/125 |
| 1.19.7 → 1.19.8 | JavDB 清单服务端/本地关联分叉根治（服务端确认 + Web Locks + 原子 IDB + 双快照对账） | doc/126 |
| 1.19.8 → 1.19.9 | 修复瀑布流 click 模式只能加载一次（状态机死锁） | doc/127 |
| 1.19.9 → 1.20.0 | 详情页清单面板 UI、排序与可靠交互优化（+ PRODUCT.md WCAG 基线） | doc/128 |
| 1.20.0 → 1.20.1 | Top250/热播封面 CDN 域名轮换修复 | doc/129 |

## 阶段遗留问题汇总

- **瀑布流加载模式**（doc/118/120/127）：click 模式的多页连续加载、请求期间防重复点击、末页与失败态、自动模式 / 加载全部 / Beyond60 分支均需部署后回归验证。
- **清单一致性**（doc/126/128）：满清单勾选回滚、模拟网络失败保留恢复日志、POST 后立即关页再打开恢复、双标签页 Web Lock 串行、人为制造本地/服务端数量差触发双快照对账，以及真实账号加入/移出的提示与计数同步、多页清单搜索排序、新建清单断网失败路径、移动端实机交互，均留待后续验证。
- **根因谱系修正**：doc/125 将 501 误报归因于 count 字符串拼接的推测，被 doc/126 现场核对推翻（真实原因为本地关联未写入服务端）；该修正不改动已执行的 doc/125，v1.19.7 的 count 对账仍作为独立有效性保留。