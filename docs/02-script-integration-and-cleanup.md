# 阶段二：独立脚本集成与清理（doc/25–48）

> **文档类型**：📄 参考说明（历史文档阶段融合）
> **文档状态**：✅ 已执行
> **阶段范围**：doc/25 – doc/48（共 24 份历史文档，按时间线融合）
> **合并说明**：本文档由 `doc/` 目录 24 份编号文档融合而成（25-rating-display-integration
> 至 48-status-tag-filter-deep-coordination），原文件随后删除。仅精简与融合原文内容，
> 不新增原文没有的事实、数字与结论；不确定细节一律删去。文中 `doc/NN` 数字引用为历史
> 事件标识。构建产物尺寸均指 `dist/monkey-jhs-disassemble.user.js`（kB / gzip kB）。
> **替代文档**：本阶段全部原编号文档
> **生效版本**：本阶段执行时 userscript version 固定为 `1.0.0`（doc/31 明确记录）

## 阶段概览

本阶段完成两件主线工作：一是对拆分重构后的工程做基底清理与修复（单字母标识符语义化
重命名、javbus 与其他死代码清除、FC2 功能恢复、Tabulator/CSS/评分交互三处修复，
doc/26–33）；二是批量集成 zerobiubiu 的 12 个独立油猴脚本为 BasePlugin 子类
（doc/25、34–43、45–46），形成了一套可复用的「来源脚本 → 集成方式 → 协同设计」
集成模式，其中 45/46 两个大型脚本还做了「去后端化/本地化」的根本性改造。期间还
尝试了 terser 最高压缩（doc/44，后被回退）与运行时调度/依赖清理（doc/47）、
深度协同修复（doc/48）。阶段结束时 javdb 侧插件从 22 个增至 33 个，并首次引入
missav 站点支持（2 个插件）。

## 一、集成模式建立：jhsRatingDisplay 评分显示（doc/25）

### 背景/根因

`archetype/jhsRatingDisplay.user.js`（916 行）是独立油猴脚本「JHS 评分显示 v2.0」，
与鉴黄师 `jhs.user.js` 同作者（zerobiubiu）。功能：javdb 列表页卡片封面显示个人评分
（1-5 星），首屏缓存优先、悬停懒加载、实时同步刷新。该脚本**寄生**读取鉴黄师的
IndexedDB（`JAV-JHS/appData/car_list`）获取已看列表，并监听鉴黄师广播的
`jdb:want-watched-sync` 事件实现实时刷新。这是本项目第一个独立脚本集成，
确立了后续所有集成的流程与模式。

### 方案与决策

- **目录结构**：新建 `src/plugins/rating-display/` 子目录，按职责拆 6 模块
  （rating-config / rating-utils / rating-cache / rating-net / rating-renderer.tsx /
  rating-display-plugin.tsx）+ 独立 CSS，依赖方向无循环。模块拆分映射：原脚本
  `CONFIG`→rating-config、`Utils`→rating-utils、`JhsDB`/`RatingCache`→rating-cache
  （getAllCarList 改复用 storageManager）、`Net`/`parseRating`/`fetchRating`→
  rating-net、`Renderer`→rating-renderer、`Core`→rating-display-plugin 类方法、
  `GM_addStyle` CSS→`src/styles/rating-display.css`。
- **可行性分析（6 维度）**：数据源一致（同库同键，直接复用 `storageManager.getCarList()`）；
  事件源已存在（仅监听 `jdb:want-watched-sync`）；GM_xmlhttpRequest 已有 grant；
  GM_addStyle 改走项目既定 `initCss()` 模式；GM_registerMenuCommand 需补 grant +
  globals.d.ts 声明（保留原脚本 4 个菜单命令）；站点限定 javdb only。
- **关键决策**：评分缓存保持原生 indexedDB API（storageManager.forage 为 private，
  原脚本即用原生 API，零偏差）；网络请求直接用全局 `GM_xmlhttpRequest` 而非
  gmHttp.gmRequest（后者对非 2xx reject 且自动 JSON.parse，语义不匹配）；
  innerHTML 生成用 `jsxToString`；MutationObserver 回调加 `instanceof Element`
  类型守护（Node 无 matches/querySelectorAll/closest）。

### 实施要点

双写缓存（localStorage 主 + IDB 寄生备份）；首屏缓存优先、悬停 500ms 懒加载；
缓存验证（首屏命中项标记 jhsrdFromCache，首次悬停重新抓取验证评分变化）；实时刷新
三通道（同标签页 CustomEvent / 跨标签页 storage 事件精确刷新 /
visibilitychange 标记待验证 + _dirty 时全量 refreshAll）；启动时比对
`jdb:want-watched-sync` 与 `jhsrd:last-sync-digest` 摘要不一致则清空缓存；
MutationObserver 监听新卡片（150ms 防抖）与 status-tag 变动即时刷新。
保留原脚本 4 个菜单命令（全量加载 / 清当前页 / 清所有 / 刷新已看）。

### 结果

插件 22→23。产物 1221.87 kB（gzip 314.19），较 doc/24 基线 +19.05 kB，
为 6 模块 + CSS 的合理增量。

### 演进链与遗留

原脚本旧版刷新机制修复（`archetype/doc/06` 提及）已在本集成 _invalidateCards
精确刷新中体现。遗留：需 Tampermonkey 运行时验证（标签显示/懒加载/跨标签同步/菜单）。

## 二、工程化清理：标识符重命名与死代码清除（doc/26–28）

### 2.1 单字母标识符语义化重命名（doc/26）

**背景/根因**：项目由单文件混淆脚本拆分重构而来，早期迁移为保留逐行对应，沿用了
大量混淆产物的单字母命名（`E/N/M/F/G/j`、`r/l`、`vt/se/ie`、`Le/Me/Ne` 等），
无含义、不可读，是工程化的长期债。

**方案与决策**：按场景与项目语义替换为可读名字，约定俗成保留循环计数器 `i/j/k`
与泛型 `T/A`。涉及 13 个文件：webdav-crypto 导出 `Le/Me/Ne` →
`WEBDAV_SALT/encryptCredential/decryptCredential`；hotkey 静态方法参数语义化；
main.tsx 的 CSS 区段常量（`M/N`→javbusHideNavCss/javbusMasonryCss、`j/E/F`→
javdbHideNavCss/javdbSiteCss/commonToolbarCss）、`generateScrollbarCss` 内部
`e/t/n/a/i`→scrollbarSelectors/appendPseudo/trackPseudo/thumbPseudo/
thumbHoverPseudo、BroadcastChannel（`G`→`refreshChannel`）、ImageViewer /
clog / 启动序列 IIFE 局部变量、`vt`→pluginManager、`se` 别名删除；window 全局
属性名同步语义化；rating-display 三模块回调参数；联动更新 setting-plugin
（5 处 `(window as any).Me/.Ne/.De`）与 new-video-plugin（1 处 `.lt`）访问点。

**关键发现（导入笔误）**：`main.tsx:13` 原为 `import { isJavdbSite as r, isJavdbSite as l }`，
`l` 本应是 `isJavbusSite`，导致 javbus 分支全部失效（masonry CSS 未注入、
isDetailPage/isListPage 恒 false）。重命名时同步修正为正确导入。**行为变化**：
javbus 站点上 isDetailPage/isListPage 现按 URL 实际判定（原先恒 false），需运行时
回归验证。

**结果**：产物 1223.66 kB（gzip 314.42），+1.79 kB（纯重命名，无逻辑新增）；
残留扫描确认旧名访问点全部清理。

**演进链**：doc/27 删除 javbus 支持后，本 doc 修正的 `isJavbusSite` 导入随之消解，
笔误来龙去脉以 doc/26 为定稿。

### 2.2 javbus 站点死代码清理（doc/27）

**背景/根因**：userscript 的 `@match` 只匹配 javdb.com，脚本从不在 javbus 运行，
`isJavbusSite` 恒为 false；全项目 javbus 分支均为永不执行的死代码，徒增产物体积
与阅读噪声。用户确认无需保留任何 javbus 支持。

**方案与决策**：一次性彻底删除，不留残留，不改变 javdb 行为。删除 `isJavbusSite`/
`JAVBUS` 常量、整个 `src/styles/javbus-masonry.css`（javdb 列表用 `.movie-list`，
不含 `.masonry`）；main.tsx 删 javbus CSS 注入与页面判定分支（isDetailPage 简化为
`href.includes('/v/')`，isListPage 简化为 `.movie-list` 判定）；7 个组件删 javbus
variant（`MenuButtonSite`/`StatusTagSite`/`HistoryNavButtonVariant`/挂载点等）；
11 个插件删 javbus 分支（含 review-plugin 整段 `/v2/search` 反查分支、highlight-magnet
的 `handleBus()`、list-page-plugin 的 `fixBusTitleBox()`/`cleanRepeatId()` 等）；
组件 prop 删除后清理调用方残留传参。

**结果**：`grep -rni "javbus|seejav|javsee|..."` 全项目零匹配；产物 1206.64 kB
（gzip 310.94），-17.02 kB（删 CSS + 十余处死代码分支）。

**残留修复（组件 prop 删除后调用方对齐）**：组件 `site`/`notFirstPageByJavbus`
prop 删除后，调用方遗留的 prop 传递引发 TS 报错，逐一清理——blacklist-plugin
删 `notFirstPageByJavbus={false}` 字面量、list-page-plugin 删两处 `site="javdb"`
（StatusTagHtml render/filter）、list-page-button-plugin 删一处 `site="javdb"`
（MenuButtonBoxHtml）。javdb 分支与 `if (isJavdbSite)` 守卫原样保留，运行期行为
不变。

### 2.3 其他死代码与多余导出清理（doc/28）

**背景/根因**：doc/27 之后用户要求继续排查"未知的死代码或非 javdb 支持"。

**排查结论**：无其他非 javdb 站点支持残留——`missav`/`supjav` 是 other-site-plugin
在 javdb 详情页生成第三方站点跳转按钮的有效功能，`fc2ppvdb` 只是 clog 异常过滤
关键词；`src/styles/` 下 23 个 CSS 全部被 `?raw` import，无未使用 CSS。

**清理内容**：
- 死代码：`src/constants/tabulator-zh.ts`（TABULATOR_ZH_CN 语言包，0 引用，
  属"未完成重构"产物，整文件删除）；`RatingNet` 聚合导出（0 引用）；
  history-plugin 的 123av 来源标签分支（用户从未在 123av 使用，永不执行）。
- 多余 export 收敛为模块内私有：`positionTooltip`/`createToast`/`parseFiletree`/
  `WEBDAV_SALT`。
- 不准确文案修正：other-site-plugin 实际只支持 MissAv + SupJav，设置面板文案
  误举"123AV"（3 处改正）。

**结果**：产物 1206.48 kB（gzip 310.91），-0.16 kB。已确认非死代码保留：
`API_BASE`/`reBuildSignature`、`ACTOR`/`ACTRESS`/`CENSORED`/`UNCENSORED`/
`isFc2Page`（javdb 的 fc2 搜索页判定，非 fc2 站点支持）等。

## 三、FC2 功能恢复与 archetype 更新（doc/29–30）

### 3.1 Fc2Plugin 迁移（doc/29）

**背景/根因**：用户报告 `search?q=fc2-ppv-4802496` 列表项点击失效（"点不开了"）。
根因：`archetype/jhs.user.js` 是**删减版**，移除了 `Fc2Plugin` 及 MagnetHubPlugin /
TranslatePlugin / ScreenShotPlugin / WangPan115TaskPlugin / Fc2By123AvPlugin 等插件，
但 `list-page-plugin` 等仍以 `getBean('Fc2Plugin')?.openFc2Dialog(...)` 调用；
bindClick 的 `.item img` 点击先 `preventDefault()` 阻止 `<a>` 默认跳转，随后可选链
`?.` 在插件缺失时静默失败——既不跳转也不开弹窗。此逻辑与删减版逐行一致，清理
javbus 时未触及。

**方案与决策**：用户提供未删减版 `jhs.user.js`（根目录），从中迁移 Fc2Plugin 主体
并注册。新增 `src/plugins/fc2-plugin.ts`（~300 行，含 getName/initCss/handle/
openFc2Dialog/loadData/handleMovieDetail/handleLongImg/handleMagnets/openFc2Page）
+ `fc2-plugin.css`；补回 `src/constants/status.ts` 的 hasDown 常量
（HAS_DOWN_ACTION/HAS_DOWN_TEXT/HAS_DOWN_COLOR，删减版已移除，Fc2Plugin 依赖）；
未删减版单字母依赖映射到项目模块：`o`→`currentHref`、`V(e)`→`fetchMovieDetail`
（constants/api，签名一致）、`U`→`API_BASE`、`O()`→`reBuildSignature`、
`d/h/g/p`→FILTER/FAVORITE/HAS_DOWN/HAS_WATCH_ACTION、`f/m/w/v/x/y/k/S`→
BLOCK/FAVORITE/HAS_DOWN/WATCHED 的 COLOR/TEXT 常量。5 个缺失插件依赖全部改为
可选链静默失败（磁力搜索弹窗 `if (!magnetHub) return`、标题翻译 `?.translate()`、
缩略图截图 `if (!screenShot) return`、115 离线下载 `?.handleAddTask()`、123av 分支
回退普通弹窗），其余依赖（Review/Related/OtherSite/DetailPageButton）项目均已
注册。

**结果**：插件 23→24；产物 1222.54 kB（gzip 315.09），+16.06 kB。

**遗留**：`getBean('Beyond60Plugin')` 在 auto-page-plugin 与 blacklist-plugin 中
被调用，但未删减版亦只有调用、无类定义、未注册——长期静默失败，不在本次范围。

### 3.2 archetype 原型更新为完整版（doc/30）

**背景/根因**：archetype 原为删减版——`03-simplify-to-javab-only.md` 将 Fc2Plugin
作为"非 javdb 站点插件"删除，但 FC2 实为 javdb 站内视频类型
（`/advanced_search?type=3`，番号前缀 `FC2-`），删除有误。

**操作**：用根目录完整版 `jhs.user.js` 覆盖 `archetype/jhs.user.js`（含 Fc2Plugin
类 + 注册 + 恢复 `@connect adult.contents.fc2.com` / `fc2ppvdb.com`，移除依赖已删
插件的 `#hasDownBtn`/`#magnetSearchBtn`）。`node --check` 语法通过。

**影响**：src 代码不受影响（Fc2Plugin 已在 doc/29 迁移为 TS 模块并注册）；
后续对照 archetype 时 Fc2Plugin 行号以完整版为准（doc/29 引用旧行号 L4162-4439，
新版为 L3926-4150，属预期差异）。

## 四、基底修复：Tabulator / CSS 布局 / 评分交互（doc/31–33）

### 4.1 Tabulator → TabulatorFull（doc/31）

**背景/根因**：详情页"字幕（迅雷）"弹窗表格"操作"列为空（预览/下载按钮不渲染），
控制台报 `Invalid column definition option: formatter` 与
`Tabulator Module Not Installed: responsiveLayout`。根因：Tabulator 6.x ESM 导出
两个类——基础类 `Tabulator`（`static defaultModules = false`，不注册任何模块）与
完整类 `TabulatorFull`；`src/core/libs.ts` 误导入基础类，Format 等模块未注册，
`SubtitleActionCell` 的 formatter 渲染结果永远不会写入单元格。archetype 通过
`@require` 加载 UMD 版，UMD 的 `window.Tabulator` 实际是 TabulatorFull，故一直
正常——这是 ESM 迁移（doc/24）引入的回归。

**影响范围**：所有使用 Tabulator `formatter` 列选项的插件——迅雷字幕列表
（detail-page-button-plugin）、备份文件列表（setting-plugin）、演员黑名单
（blacklist-plugin）、鉴定记录（history-plugin）。

**方案与决策**：仅改 `src/core/libs.ts` 一处：`import { TabulatorFull }`；
全局挂载名保持 `window.Tabulator` 不变，export 名保持 `Tabulator` 不变（业务代码
与调用处零改动）。

**验证**：dist 产物中 `win.Tabulator = TabulatorFull$1` 赋值正确（TabulatorFull
出现 4 次）；CDN 对照实验——用 CDN UMD 版（即 TabulatorFull）在 javdb 详情页创建
测试表格，操作列 formatter 正确输出 `<a class="a-primary">预览</a> <a
class="a-success">下载</a>`，证明修复后按钮正常渲染。

**结果**：产物 1704.80 kB（gzip 406.03），+482.26 kB——TabulatorFull 打包全部
模块（Format/Sort/Filter/Page/ResponsiveLayout/Export/...）的正确成本，与
archetype 加载完整 UMD 行为一致。CDN 对照实验验证 formatter 正常输出。

### 4.2 CSS 布局修复：toast 超宽与按钮贴连（doc/32）

**背景/根因**（两个独立问题）：
- **toast 超宽**（937px，正常约 200px）：lightningcss 压缩器将 toastify 源 CSS 的
  `max-width: fit-content` + `-moz-fit-content` 两行合并为只保留 `-moz-` 前缀，
  Chrome 不认导致 `max-width` 失效，退回 `.toastify` 的 `calc(50% - 20px)`。
- **设置面板按钮贴连**（间距 0px）：`jsxToString` 的 `renderChildren` 用
  `join('')` 拼接数组，丢失 inline-block 元素间空白；archetype 原版 HTML 模板中
  两按钮间有换行缩进空白，被浏览器渲染为约 4px 间距。

**方案与决策**：toast 在 `common-toolbar.css` 末尾加
`.toastify-center { max-width: fit-content !important }`（该文件经 `?raw` 加载
不经 lightningcss，`!important` 保证后注入覆盖）；按钮间距在 `setting-dialog.tsx`
两处相邻 `menu-btn` 间显式加 `{' '}`。不改 lightningcss 配置。

**结果**：产物 1705.48 kB（gzip 406.40）。运行时验证：toast 宽度恢复 222.2px，
按钮间距恢复约 4px。

**遗留**：jsxToString 空白丢失为系统性问题——所有经其渲染的组件，若 inline-block
元素在数组中相邻且无显式 `{" "}`，间距都会丢失；其他组件多用 flex/margin 不受影响，
后续发现同法修复。

### 4.3 收藏状态下评分星星解禁（doc/33）

**背景/根因**：详情页评分栏在"已收藏"状态时星星被禁用（`.jhs-stars.is-disabled`，
pointer-events: none），无法点击切换为"已观看 + N星"。这是 archetype 原版设计
（重构时忠实保留），但原版是逻辑 bug：三个操作（点星星→已观看+N星 / 点已读→
已观看+0星 / 点♥收藏→想看）应随时互相切换，`is-disabled` 阻断了收藏→已观看路径。

**方案与决策**：`_syncRatingBar()` 的 want 分支将 `add('is-disabled')` 改为
`remove('is-disabled')`。**注意**：此修复偏离 archetype 原版行为，属用户明确
要求的行为改进，非"零偏差"重构。

**结果**：产物 1705.49 kB（gzip 406.39）。三条路径闭环，随时切换。

## 五、独立脚本批量集成（doc/34–43）

### 5.0 集成模式归纳

doc/25 确立、doc/34–43 反复验证的集成模式，每个脚本浓缩为固定三段：

1. **来源脚本**：`archetype/<name>.user.js`（行数 + 版本 + 功能），同作者 zerobiubiu
   的独立脚本；集成前做 6 维度可行性调研（站点限定 / GM_* 依赖 / 数据源 / 事件源 /
   网络请求 / 主项目冲突）。
2. **集成方式**：转为 TS 模块化的 BasePlugin 子类注册到 PluginManager；站点限定靠
   main.tsx `if (isJavdbSite)` 块，**路径限定靠 `handle()` 内守卫等价替换原脚本
   `@include`/`@exclude`**（34 详情页排除、35 清单路径、39 路径白名单、40 三路径、
   43 双守卫等）；GM_addStyle 一律改走 `initCss()` 返回 CSS 字符串
   （`src/styles/<name>-plugin.css`，`?raw` import）；IIFE 闭包状态转类私有字段；
   TS 严苛性适配（null 守卫、类型断言、`at(-1)` 改 `[length-1]` 因 lib 仅 ES2020）；
   新增 GM grant 时同步补 globals.d.ts 声明。
3. **协同设计**：与主项目共享 DOM 容器/属性时的冲突排查与协调（显隐属性互不干扰、
   MutationObserver 单向触发、分工处理不同 li 集合、正向协同等），详见各条。

**四类集成形态**（按复杂度）：

| 形态 | 脚本 | 特点 |
|------|------|------|
| 极简 DOM 插件（无 CSS 无 GM_*） | 34 keyPageTurning / 35 modMyListOpenWay / 42 modalListDisabler / 43 listParser | 60–85 行源码，单文件 90–130 行 |
| DOM 插件 + CSS | 36 pageSort / 38 statusTagFilter / 39 listWaterfall | 190–510 行源码，单文件 + 独立 CSS |
| 大型单体（含数据层） | 25 rating-display / 40 listReadingStatus | 916 / 1391 行源码；前者拆 6 模块子目录，后者因状态高度内聚保持单文件 + 模块级数据层函数 |
| 多脚本合并集成 | 45 videoListsTag / 46 carStatusSync | 见第七节；前者合并 + 本地化，后者合并 + 去后端化 |

### 5.1 一览表

| doc | 来源脚本（行数） | 功能 | 集成方式 | 插件数 | 产物增量（kB） |
|-----|------------------|------|----------|--------|----------------|
| 25 | jhsRatingDisplay（916） | 列表页卡片评分显示 | 6 模块子目录 + CSS | 22→23 | +19.05 |
| 34 | keyPageTurning（60） | 左右方向键翻页 | 单文件，无 CSS | 24→25 | +1.59 |
| 35 | modMyListOpenWay（37） | 清单链接新标签 + RESTful 化 | 单文件，无 CSS | 25→26 | +0.95 |
| 36 | pageSort（190） | 单页内容排序（名称/评分） | 单文件 + CSS | 26→27 | +6.55 |
| 38 | statusTagFilter（280） | 状态标签芯片筛选 | 单文件 + CSS | 27→28 | +9.71 |
| 39 | listWaterfall（510） | 清单页瀑布流自动翻页 | 单文件 + CSS | 28→29 | +9.86 |
| 40 | listReadingStatus（1391） | 清单阅读进度 + 星级 + 排序筛选 | 单文件 + CSS | 29→30 | +30.81 |
| 42 | modalListDisabler（85） | 模态框禁用指定清单 | 单文件，无 CSS | 30→31 | +1.37 |
| 43 | listParser（75） | 唤醒解析器按钮（lists:// 协议） | 单文件，无 CSS | 31→32 | +2.30 |

### 5.2 轻量 DOM 插件：keyPageTurning（doc/34）

**来源脚本**：`keyPageTurning.user.js`（60 行）「Javdb 键盘翻页」v1.0——左右方向键
点击分页栏 `pagination-previous`/`pagination-next` 翻页。完全独立：不读 IDB、
不监听事件、不发网络请求，纯 DOM 事件监听。

**集成方式**：单文件 `key-page-turning-plugin.ts`（~110 行），无 CSS（initCss 返回
空串）、无 GM_*（grant 零改动）。详情页排除靠 `handle()` 首行
`if (window.isDetailPage) return;` 等价原脚本 `@exclude /v/*`。

**协同设计**（控制流保留要点）：isTyping 焦点守卫（input/textarea/select/
contentEditable 时不拦截方向键）；safeClick 双策略（优先 `a.click()`，兜底
`new MouseEvent(...)` + dispatchEvent，isTrusted 无法伪造）；长按连发锁
（lockLeft/lockRight，按下→抬起才接受下一次）；keydown 以 `{ passive: false }`
注册以允许 preventDefault。

**模块拆分映射**：原脚本 `SELECTOR_LEFT/RIGHT` 常量→顶层常量；`isTyping()`→
私有方法；`safeClick()`→私有方法；lockLeft/lockRight 闭包变量→私有字段；
keydown/keyup 监听→handle() 内。

**结果**：插件 24→25；1707.08 kB。

### 5.3 轻量 DOM 插件：modMyListOpenWay（doc/35）

**来源脚本**：`modMyListOpenWay.user.js`（37 行）「修改我的清单打开方式」v1.0——
清单链接 `target="_blank"` + 查询串格式（`/users/lists?id=xxx`）改为 RESTful
（`/lists/xxx`）；首页（page<2）隐藏第一项"所有清单"入口。纯 DOM 操作。

**集成方式**：单文件 `mod-my-list-open-way-plugin.ts`（~90 行）。路径守卫
`location.pathname.includes('/users/lists')` 等价原 `@include users/lists*`；
`at(-1)` 改 `[length-1]`（ES2020 lib）；querySelector 加 null 守卫（ul 缺失返回、
a 缺失 continue）。

**控制流保留要点**：last 路径末段取 `[length-1]`（区分 `/users/lists` 首页 vs
`/lists/{id}` 详情页）；isListsPage 判定（last === 'lists'，仅清单列表页改写
href）；page 解析（`Number(new URLSearchParams(location.search).get('page')) ||
1`）；首页隐藏第一项（page<2 时 `lis[0].style.display='none'` 且循环从下标 1
开始）；每个清单链接设 `a.target='_blank'`；href 从查询参数提取 id 改写为
`/lists/${id}` RESTful 格式。

**协同设计**：与后续 doc/39 listWaterfall 分工——本插件只处理首屏 li，
listWaterfall 只处理 append 的新 li，操作不同 li 集合。

**结果**：插件 25→26；1708.03 kB。

### 5.4 排序系统：pageSort 集成与 jhs 协调（doc/36 + doc/37）

**来源脚本**：`pageSort.user.js`（190 行）「Javdb 内容排序」v1.0——工具栏注入排序
按钮组（名称升/降序、评分升/降序），再次点击已选中项恢复原始顺序；排序守卫
（MutationObserver）监听 DOM 顺序被外部修改时自动重新应用（重试上限 5 次）。

**集成方式**：单文件 `page-sort-plugin.ts`（~240 行）+ CSS；jQuery 复用
全局 `$`（本项目 ESM import 3.7.1，原脚本 4.0.0 的 API 完全兼容，无需 @require）；
`injectSortStyles()` 改走 initCss；闭包状态转类字段（activeSort/isApplyingSort/
sortGuardRetries）；jQuery 事件回调 `function(e){$(this)}` 改箭头函数 +
`e.currentTarget`（DOM 等价）；SORT_CONFIGS 提为模块级单一数据源。

**控制流保留要点**：SORT_CONFIGS 单一数据源（按钮文本 + 排序函数，新增排序方式
只需追加一条）；`data-sort-original-index` 标记原始位置索引（doc/37 改为复用 jhs
的 data-original-index）；applySort 重入守卫（isApplyingSort 防排序守卫自触发）；
applySort 内重新查询当前节点（防节点替换后引用失效）；`sortGuard.takeRecords()`
清空 append 产生的 mutation 记录防误判；点击已选中项恢复原始（activeSort=null +
applySort(null)）；waitForContainer 用 MutationObserver 监听 body 子树等待
`body > section > div` 容器出现。

**协同设计**（doc/37，演进链第一步）：集成时未考虑 jhs 已有排序系统，两个排序系统
各自运行互相打架——双重排序（jhs `sortItems` vs pageSort `applySort` 都操作
`.movie-list .item`）、Observer 互相触发（checkDom vs sortGuard 可能死循环）、
autoPage 冲突（瀑布流 append 触发 sortGuard 打乱分页）、两套 data 标记。协调策略
为本插件**单方面适配、零侵入**：autoPage=YES 时不注入；仅 isListPage 注入；复用
jhs 的 `data-original-index`；点击 pageSort 按钮时清除 localStorage `jhs_sortMethod`
（jhs sortItems 在 sortMethod 为空时直接 return）；监听 `#sort-toggle-btn` click
清除 pageSort activeSort（同一时刻仅一个排序系统生效）；applySort 前后
disconnect/reconnect sortGuard 防自触发。

**协调后的运行时行为（4 场景）**：① 仅用 pageSort——点击排序清除 `jhs_sortMethod`，
jhs checkDom 触发后 sortItems 因 sortMethod 为空直接 return；② 从 pageSort 切到 jhs
——点击 `#sort-toggle-btn` 清除 pageSort activeSort，sortGuard 检查 activeSort 为
null 不排序；③ 从 jhs 切到 pageSort——点击 pageSort 按钮清除 `jhs_sortMethod`，
jhs 排序失效；④ autoPage 瀑布流——pageSort 不注入，AutoPagePlugin append 不受
影响。

**结果**：doc/36 插件 26→27、1714.58 kB；doc/37 +0.52 kB（1715.10 kB）。

**演进链**：doc/48 继续深化（jhs 屏蔽 data-hide 语义，见第九节）。
遗留：pageSort 选择器 `div.movie-list.h.cols-4.vcols-8` 在搜索页可能不匹配，
此时跳过注入（原脚本行为）。

### 5.5 筛选系统：statusTagFilter（doc/38）

**来源脚本**：`statusTagFilter.user.js`（280 行）「JavDB 状态标签筛选」v1.0——收集
`.tag.is-success.status-tag` 文本及计数生成筛选芯片（含"无状态标签"芯片），点击按
OR 逻辑筛选（命中任一选中标签即显示），再次点击取消。

**集成方式**：单文件 `status-tag-filter-plugin.ts`（~330 行）+ CSS；isListPage
守卫；status-tag 选择器与 HIDDEN_ATTR（`data-status-tag-hidden`）提为模块级常量；
Observer 150ms 防抖；`filterBar._refreshChips` 保留挂在 DOM 元素上（`as any`
访问，与原脚本一致）；`node.matches?.()`/`textContent?.trim()` 可选链防御。

**控制流保留要点**：collectStatusTagCounts 收集文本→计数映射；countNoStatusItems
统计无 status-tag 的卡片数；applyFilter OR 逻辑（命中任一选定标签即显示，
"无状态标签"芯片独立判断）；doBuild 重建芯片时保留已激活状态（activeValues
集合）；findMountTarget 挂载点优先级——`.tag-filter-bar` → 演员页
`.actor-tags.tags` / 普通 `.tabs.is-boxed` → `section > div` 第一个子元素 →
`body > section > div` 第一个子元素；init 10s 超时后用最终回退位置强行挂载。

**协同设计**（天然兼容，无需复杂协调）：jhs 注入的 status-tag 类名与脚本查找
完全匹配；原脚本已有协同安全设计——`hiddenByOther = display==='none' &&
!hasAttribute(HIDDEN_ATTR)`，jhs 用 `data-hide` 隐藏的卡片被识别为"被其他脚本
隐藏"并跳过，不恢复；jhs hide/show 触发本脚本 observer 为单向触发，不死循环；
autoPage 瀑布流 append 新页触发芯片计数刷新（正确行为）。

**结果**：插件 27→28；1724.81 kB。

**演进链**：doc/48 将该协同安全判断升级为依赖 `data-hide`（见第八节）。

### 5.6 瀑布流：listWaterfall（doc/39）

**来源脚本**：`listWaterfall.user.js`（510 行）「JavDB 清单瀑布流」v0.1.0——我的
清单/收藏的清单页滚动接近底部自动加载下一页：GM_xmlhttpRequest 抓 HTML →
DOMParser 解析 → 提取 `#lists > ul` 的 li → id 去重 → append → 链接重写
（target=_blank + `/lists/{id}` 短地址）→ 替换分页 nav → replaceState 同步 URL。
含 loader 三态（loading/error/no-more）+ 回到顶部按钮。

**集成方式**：单文件 `list-waterfall-plugin.ts`（~400 行）+ CSS；补 GM_getValue
grant（+globals.d.ts）；ALLOWED_PATHS 路径白名单守卫（`/users/lists` +
`/users/favorite_lists`）；GM_registerMenuCommand 移到 handle() 内注册（仅清单页）；
网络请求直接用全局 GM_xmlhttpRequest（按 status 判定，gmHttp 语义不匹配）；
`toggleEnabled` 用 `.bind(this)` 传给菜单命令；SVG innerHTML 保留原生（简单无
XSS 风险）；`container.parentNode!` 非空断言。

**控制流保留要点**：isEnabled/toggleEnabled 用 GM_getValue 读开关（默认开启，
toggle + confirm 刷新）；init 记录首屏 li id 到 loadedIds 集合去重；loader 三态
（loading 蓝色旋转 / error 红色点击重试 / no-more 绿色）；loadNextPage 抓 HTML →
DOMParser 解析 → 提取 li → 去重（首 li id 已存在则停止）→ append fragment →
rewriteItemLinks → 替换分页 nav；MAX_PAGES(200) 防异常无限加载；checkLoad 在
loader 距视口底部 PRELOAD_DISTANCE(800px) 时触发；滚动时自末页向前找首个
top ≤ scrollY 的页 replaceState 同步 URL；回到顶部按钮 rAF 节流、滚动 >300px
淡入、平滑回顶。

**协同设计**（无冲突，独立运行）：`#lists > ul` 容器主项目无任何插件操作
（AutoPagePlugin 只操作 `.movie-list` 视频列表页）；与 modMyListOpenWay 分工
（首屏 vs 新 li）；`#jdb-wf-back-to-top` 无同 ID 元素；pagination-next 与 jhs
BasePlugin.getSelector 在不同页面使用。

**结果**：插件 28→29；1734.67 kB。

### 5.7 大型单体：listReadingStatus（doc/40）

**来源脚本**：`listReadingStatus.user.js`（1391 行）「JavDB 清单阅读进度」v1.5——
清单列表页/详情页阅读进度下拉框 + 星级评分（1-5 星），数据双向实时同步，寄生 jhs
IndexedDB 实现跨浏览器备份恢复；清单列表页提供工具栏（10 种排序 + 阅读状态筛选 +
评分筛选）。

**集成方式**：单文件 `list-reading-status-plugin.ts`（~770 行）+ CSS（3 段
GM_addStyle 合并）。**决策**：1391 行但功能高度内聚（数据层 + UI 层 + 排序筛选层 +
入口共享闭包状态），拆子目录会导致大量状态在模块间传递，单文件 + CSS 更合适——
数据层为模块级函数（getRatingMap/saveRatingMap/setRating/getRating/getReadSet/
saveReadSet/markAsRead/markAsUnread/isRead/getLastUriMap/saveLastUri/getLastUri
+ openJhsDB/syncToIndexedDB/restoreFromIndexedDB），UI/排序筛选层为类方法
（ensureWidgets/ensureHeaderWidgets/processAllItems/createDropdown/createStarWidget
+ applySort/applyFilter/buildToolbar/refreshChips）；IIFE 闭包状态（isProcessing/
currentSort/filterReadStatus 等）转类字段。IndexedDB 寄生
`JAV-JHS/appData/listReadingStatus_data`，保留原生 API（与 doc/25 rating-cache
模式一致）；GM_setValue/getValue/addValueChangeListener 均已含，无需补 grant。

**功能要点**：10 种排序（默认/评分↑↓/影片数↑↓/点击数↑↓/最近访问↑↓/标题 A-Z），
`data-lrs-order` 稳定 tiebreaker；applySort 仅顺序实际变化时才重排（sortedIds vs
currentIds 比较，避免无变化 appendChild 触发循环）；三星级评分（1-5 SVG 五角星）
点击切换、再次点击取消；跨标签页同步 5 个键（GM_addValueChangeListener）；
IndexedDB 备份恢复逐字段合并（readingStatus 并集 + ratings 云端补缺 + lastUris
按 timestamp 取大）。

**协同设计**（天然兼容）：与 listWaterfall 共享 `#lists > ul > li`——append 新 li
触发本插件 MutationObserver 为新 li 注入组件（原脚本注释已考虑）；
与 modMyListOpenWay 操作不同子元素；**三套显隐属性互不干扰**
（`data-lrs-hidden` / `data-status-tag-hidden` / jhs `data-hide`），原脚本已有
hiddenByOther 检查；isProcessing 防重入 + lastLiCount 仅数量变化时刷新芯片。

**结果**：插件 29→30；1765.48 kB（+30.81，本阶段单次最大增量）。

### 5.8 @require 清理：parallel_GM_xmlhttpRequest 移除（doc/41）

**背景/根因**：`vite.config.ts` 遗留 1 个 `@require`——GreasyFork 的
`parallel_GM_xmlhttpRequest.js` 已失效（HTTP 410，作者删稿）。该脚本的作用是
覆盖全局 `GM_xmlhttpRequest` 突破 Tampermonkey 默认并发限制，src 代码无直接引用，
4 个文件（gm-http 的 gmRequest/分块下载、webdav、rating-net、list-waterfall）
间接受益。

**方案与决策**：从 vite.config.ts 移除 require 数组。影响评估：功能不中断（原生
GM_xmlhttpRequest 完全可用）；高并发场景不受影响（rating-net 自带限流器
FETCH_CONCURRENCY）；消除安装时的 @require 加载失败警告。

**结果**：1765.38 kB（-0.10）；产物头部无 `@require` 行，grant 列表完整。
doc/24 记录的"@require 仅剩 1 个"成为历史，本 doc 起为"@require 全部移除"。

### 5.9 轻量 DOM 插件：modalListDisabler（doc/42）

**来源脚本**：`modalListDisabler.user.js`（85 行）「JavDB 清单模态框禁用指定列表」
v1.0——监听「保存到清单」模态框（`#modal-save-list`）出现后自动禁用指定编号清单项
（默认 501）；仅未选中态（`!checked`）才禁用，保留用户取消勾选能力。

**集成方式**：单文件 `modal-list-disabler-plugin.ts`（~110 行），无 CSS；闭包
observer 转类字段；`Array.from(container.children)`（for...of 遍历 HTMLCollection
需降级）；input 类型断言 HTMLInputElement。

**控制流保留要点**：TARGET_LIST_ID=501 匹配 label 中 `(数字)` 格式
（span.innerHTML 正则提取）；disableTargetItem 仅未选中态（`!input.disabled &&
!input.checked`）才设 disabled；tryDisable 用 CONTAINER_SELECTOR 精确路径查找；
MutationObserver 监听 body subtree 覆盖模态框动态插入 + 内容异步加载。

**协同设计**（正向协同）：jhs 主项目也操作此模态框（DetailPageButtonPlugin.
_initListPanel，CSS `display:none !important` 隐藏但保留 DOM 供 ajax）；本插件
设 `disabled` 触发 jhs 的 attributeFilter（'checked','disabled'）→ cloneNode(true)
自动复制 disabled 到平铺面板——平铺面板中同样无法勾选被禁清单项，属正确行为。

**结果**：插件 30→31；1766.75 kB。

### 5.10 轻量 DOM 插件：listParser（doc/43）

**来源脚本**：`listParser.user.js`（75 行）「清单解析器」v1.0——清单详情页
（`/lists/*`）演员名称 span 后插入"唤醒解析器"按钮，点击通过 `lists://?url=<URL>`
自定义协议唤醒外部解析器应用。

**集成方式**：单文件 `list-parser-plugin.ts`（~130 行），无 CSS（内联 style）；
双路径守卫（`/lists/` 且排除 `/users/`）；MAX_RETRIES=50 / RETRY_INTERVAL=200
提为模块级常量；防重复插入（getElementById 检查）；setInterval 轮询 10s 等待 span
异步渲染。

**控制流保留要点**：SPAN_SELECTOR 精确选择
（`div.columns.is-mobile.section-columns span.actor-section-name`）；内联
Bootstrap 风格按钮（btn-primary 配色 #0d6efd + hover 变深 #0b5ed7，页面无
Bootstrap CSS 时仍美观）；click 唤醒协议 `location.href = 'lists://?url=' +
encodeURIComponent(origin + pathname)`（去除查询参数和 hash）。

**协同设计**（无冲突）：`.actor-section-name` 被 jhs 多插件共享，但 jhs 只读取
文本不修改 DOM，本插件只 `insertAdjacentElement('afterend')` 追加兄弟节点；
与 listReadingStatus 的 h2 prepend 插入点不同。

**结果**：插件 31→32；1769.05 kB。

### 5.11 协同设计模式汇总

本阶段 12 个集成脚本与主项目（jhs）的协同策略可归纳为五类模式：

| 模式 | 脚本 | 机制 |
|------|------|------|
| 天然兼容（无共享状态） | 25 评分显示 / 39 listWaterfall / 43 listParser | 数据或 DOM 与主项目无交集；或主项目只读文本、本插件只追加兄弟节点 |
| 显隐属性互不干扰 | 38 statusTagFilter / 40 listReadingStatus / 45 videoListsTag | 各自独立隐藏属性（data-status-tag-hidden / data-lrs-hidden / data-video-lists-tag-hidden）+ hiddenByOther 检查跳过其他脚本隐藏的卡片；doc/48 进一步升级为依赖 jhs 的 data-hide |
| 排序系统互斥 | 36/37 pageSort | 单方面适配：清除 jhs_sortMethod / 清除 activeSort，同一时刻仅一个排序系统生效；autoPage 开启时不注入 |
| 正向协同 | 42 modalListDisabler | 本插件设 disabled → jhs cloneNode(true) 自动复制到平铺面板，功能互补 |
| 分工协作 | 35 + 39 modMyListOpenWay / listWaterfall | 同一容器不同 li 集合（首屏 vs append 新 li）；40 的 observer 为 listWaterfall 新 li 注入组件（原脚本注释已考虑） |

**跨脚本共享约束**：多个脚本都操作 `#lists > ul > li`（35/39/40）与 `.item`
显隐（38/40/45），但通过不同属性、不同 li 集合、不同插入点互相隔离；
MutationObserver 均为单向触发（本插件改 DOM 不触发对方的过滤恢复逻辑），
不存在死循环。

## 六、构建压缩优化：terser 最高压缩（doc/44）

**背景/根因**：vite build 默认 esbuild minify 压缩保守（保留缩进换行、保留
console.log），产物 1769 kB（gzip 422 kB）偏大，用户要求尝试最高压缩率。

**方案与决策**：vite.config.ts 新增 build 配置：`minify: 'terser'` +
compress.passes=3 + pure_funcs 删除 console.log/debug/info（保留 console.error 便于
排错）+ drop_debugger + toplevel + unsafe 全套 + inline=2 + format.comments 保留
userscript 头部 + mangle.toplevel + mangle.reserved 保留外部按名访问的全局
（GM_* 全套、$ / jQuery / layer / Tabulator / Toastify / localforage / Viewer /
md5、utils / gmHttp / storageManager / clog / show / loading / pluginManager /
refresh / encryptCredential / decryptCredential / loadGfriends / filetreeDb /
WebDavClient / isDetailPage / isListPage / isFc2Page）+ sourcemap: false。
package.json 新增 devDependencies：terser + @types/terser。

**压缩对比**：产物 1769 → 1150 kB（-619，-35%），gzip 422 → 337 kB（-20%），
行数 42539 → 30（几乎全单行）；console.log 全部删除（pure_funcs 生效）而
console.error 保留；构建耗时 ~1s → ~11s（terser 多轮压缩较慢）；`node --check`
语法通过。

**演进链（重要）**：该 terser 配置**后被回退**——当前 `vite.config.ts` 无 terser
配置（build.minify 默认 esbuild），项目 AGENTS.md 亦记载「build.minify：默认
esbuild（terser 可选但已回退）」；回退后 doc/45（1816.07 kB）/ doc/47（1809.45 kB）/
doc/48（1809.85 kB）的产物尺寸均回到 esbuild 量级。**回退原因未在本阶段文档内
记录**（doc/44 自身已提示压缩后堆栈变量为单字母、调试困难；融合文档不猜测）。

**遗留**：调试时可用 `vite build --minify=esbuild`（快但弱）或
`--minify=false`（不压缩）。

## 七、大型合并集成：本地化与去后端化（doc/45–46）

### 7.1 VideoListsTag：合并 + 本地化（doc/45）

**背景/根因**：合并两个独立脚本——`listsOptionSync.user.js`（~600 行，详情页清单
checkbox 勾选/取消时同步到远程服务器）与 `videoListsTag.user.js`（~1280 行，列表页
从远程服务器查询番号所属清单、显示标签 + 筛选栏）。原脚本依赖远程 API
（`https://jls.zerobiubiu.top`）。

**方案与决策（根本性变更：远程 → 本地 IndexedDB）**：数据改存寄生
`JAV-JHS/appData`（随 jhs WebDav 备份），PostgreSQL 三表（movies/inventory/
movie_inventory）→ IDB 三键 JSON 对象；服务器 CTE 逐条映射为 `VltDb.sync()` JS
实现（movie_pre→`!!movies[designation]`、movie_upsert→存在则更新不覆盖 createdAt、
list_upsert→DO NOTHING、assoc_add→`!mi[key] && count < 501` 插入 + count+1、
assoc_del→删除 + count-1）；PostgreSQL 触发器（count ±1）→ 代码手动 ±1；
CHECK 约束 `count<=501` → 代码检查（`limit_exceeded`）；随机配色 → 代码从
bootstrapColors 选取。网络请求归零。

**可行性分析**：GM_* 依赖（setValue/getValue/addValueChangeListener/
registerMenuCommand）均已含无需补 grant；数据源本地 IDB（寄生 jhs 同库，WebDav
备份一起备份）；事件源三重广播（GM_setValue/localStorage/CustomEvent）跨标签页 + 跨脚本同步；无新增网络请求。

**主项目冲突排查**：显隐属性第四套（`data-video-lists-tag-hidden`）与
statusTagFilter 的 `data-status-tag-hidden`、listReadingStatus 的 `data-lrs-hidden`、
jhs 的 `data-hide` 互不干扰（原脚本已有 hiddenByOther 检查）；MutationObserver
只处理新 .item 标签注入，不影响 jhs 过滤；AutoPagePlugin 瀑布流 append 新页触发
observer 为正确行为（新页应注入标签）；IDB 新增 4 个键（vlt_movies/vlt_inventory/
vlt_movie_inventory/vlt_meta）与 car_list 等键不同名。
数据迁移：PostgreSQL 导出 JSON（3588 影片 + 12 清单 + 3548 关联，
`dist/vlt-migration-data.json`），通过 GM_registerMenuCommand 菜单"导入迁移数据"
选择文件导入 IDB。

**集成方式**：子目录 `src/plugins/video-lists-tag/` 5 模块（vlt-db ~290 行 /
vlt-toast ~180 行 / vlt-tags ~600 行 / vlt-sync ~230 行 / vlt-plugin.tsx ~120 行）
+ 独立 CSS（~280 行）+ 迁移数据文件。三重广播（GM_setValue + localStorage +
CustomEvent 'jdb:sync-complete'）保留原设计；Toast 自建队列式（不依赖 jhs
show）；4 种筛选模式（包含任意/全都包含/不包含以下标签/不包含以下任意一个）；
标签渲染有 url 用 `<a>`、无 url 用 `<span>`；自动刷新三监听（GM_addValueChangeListener
+ storage + CustomEvent）；MutationObserver 防抖增量 fetchAndMergeTags；协同安全
沿用 hiddenByOther 设计（第四套显隐属性 `data-video-lists-tag-hidden`）。

**实施后的数据迁移步骤**：从 PostgreSQL 导出 JSON → Tampermonkey 菜单「导入迁移
数据（PostgreSQL → IDB）」选择文件 → 导入成功页面自动刷新；IDB 数据随 jhs
WebDav 备份一起备份/恢复。

**结果**：插件 32→33；产物 1816.07 kB（gzip 433.20），+47.02 kB（合并两脚本 +
IDB + Toast + CSS）。远程服务器依赖完全移除。

**演进链**：doc/126 后续修复服务端/本地数据分歧（不在本阶段范围）。

### 7.2 CarStatusSync：跨站同步 + 去后端化（doc/46）

**背景/根因**：合并两个独立脚本，原经后端服务器（Cloudflare Workers + D1）中转——
`jhsCarListReader.user.js`（1320 行，javdb 端：读 JAV-JHS IndexedDB car_list →
转列存 gzip → POST 后端）与 `missavStatusTag.user.js`（895 行，missav 端：增量拉取
→ 写本地 IDB → 渲染状态标签）。集成目标：去除后端依赖、实时刷新、missav 端数据可
随 jhs WebDav 备份、保留后端数据库内容（设置面板导入）。

**方案与决策（核心架构：两层同步机制）**：
- **增量实时**：storageManager 5 个写方法（saveCar/updateCarInfo/removeCar/
  batchRemoveCars/saveCarList）内部触发 carListChangeCallback →
  `GM_setValue('jhs_car_status_delta', ...)`（几十字节，不压缩）→ missav 端
  GM_addValueChangeListener 实时收到 → upsert/delete → 刷新标签。
- **全量兜底**：页面加载延迟 2s → getCarList → 列存 + gzip + base64
  （~600KB）→ `GM_setValue('jhs_car_status_data', ...)` → missav 端解压全量 upsert。
- **核心原理**：集成后 javdb 与 missav 运行同一打包产物（同一 userscript），GM
  存储在所有实例间共享，remote=true 表示变更来自其他标签页/域名实例。
- missav 端独立 IDB（`MissAV-CarStatus/cars`，避免 missav 站点创建空 JAV-JHS 库）；
  WebDav 备份走设置面板导出（与 vlt-panel 模式一致）；后端数据导入支持列存 + 行式
  两种格式；missav 端全量处理有锁（5.5 万条），增量处理不锁不冷却。

**可行性分析（6 维度）**：站点限定多站（javdb + missav，match 增加
missav.ws/live，插件内按 isJavdbSite/isMissavSite 分支）；GM_API 全部已在 grant
（doc/40 已补 GM_getValue/GM_setValue，doc/39 已补 GM_addValueChangeListener）；
数据源 javdb 端读 storageManager.getCarList()（复用全局实例，不另开 IDB 连接）；
事件源 GM_addValueChangeListener 跨域实时通知（集成后同一 userscript，GM 存储共享，
remote=true 触发）；网络请求零（原 GM_xmlhttpRequest POST 后端已去除）；主项目
冲突无（missav 站点不注册 javdb 的 33 个插件；CarListReaderPlugin 只读 car_list
不操作 DOM）。

**集成方式**：子目录 `src/plugins/car-status-sync/` 6 模块（car-status-config /
car-status-columnar / car-status-db / missav-renderer / car-list-reader-plugin /
missav-status-tag-plugin）。站点：vite.config.ts match 增加 missav.ws/live，
新增 `isMissavSite` 常量；main.tsx 注册 2 新插件（javdb 端 + missav 端），
storageManager 合并操作加 isJavdbSite 守卫；设置弹窗新增「🎬 MissAV 同步」面板
（立即同步/导入/导出）。保留原脚本控制流：javdb 端 60s 冷却自动同步、missav 端
observer（childList + attributes(alt) 防抖）、视频页/列表页分支、FC2 番号归一化、
CompressionStream gzip、3000 条/批 IDB 写入。

**结果**：javdb 侧仍 33 插件，新增 missav 侧 2 插件；产物 1850.01 kB（gzip 441.06），
+34 kB。原后端服务器（`E:\cloudflare-javdb-video-status-table-server`）可停用（冷存储
备份）；HWM 增量过滤、失败重试队列、API Key 配置等后端相关逻辑已去除（GM 存储为
本地操作，不会失败）。

**演进链**：本阶段首次引入 MissAV 站点，后续 doc/218-238 的 MissAV 功能扩展
（不在本阶段范围）。

## 八、运行时调度与依赖清理（doc/47）

**背景/根因**：静态巡检发现的低风险问题——`PluginManager` 内部已 catch 插件异常
（返回 `{status:'rejected'}`），但外层按 `Promise.allSettled` 的 `result.status`
过滤，失败汇总不生效；`main.tsx` 以 fire-and-forget 调用
`processCss().then()`，与"CSS 先于插件逻辑注入"的架构约束不完全一致；
`StorageManager.merge_blacklist()` 遗留迁移分支 `!item.url && item.url.includes(...)`
恒 false 且有抛错风险；`ListPagePlugin` 通过全局 any 直接改 StorageManager
private 缓存字段；`layui-layer` 包自身已带 layer.css，libs.ts 又显式 import 一次
（重复构建警告）；react-dom / @types/react-dom 已无源码引用（与"仅 jsxToString
渲染 HTML 字符串"约束不一致）。

**方案与决策**：
- 插件调度：processCss/processPlugins 改为 `Promise.all` 收集结构化结果，插件级
  异常仍在单个任务内 catch，失败汇总改按 `result.status === 'rejected'` 判断。
- 启动顺序：main.tsx 移除独立 `processCss().then()`，启动 IIFE 内改为
  `await processCss()` → 页面判定 → storage 迁移/清理 → `await processPlugins()`。
- StorageManager：新增 public 方法 `clearFilterActorActressCarListCache()` /
  `clearSettingCache()`，ListPagePlugin 的 BroadcastChannel 缓存清理改走公开方法；
  merge_blacklist 的 `sort_type` 清理分支改为 `item.url && item.url.includes('sort_type')`
  并在清理后标记 itemChanged。
- 依赖与 CSS：删除 libs.ts 显式 `import 'layui-layer/layer.css'`；移除
  react-dom 与 @types/react-dom，更新 bun.lock。

**结果**：tsc -b + vite build 通过；产物 1809.45 kB（gzip 413.37）；layer.css IE
hack 警告仍为 doc/24 记录的已知无害警告，重复导入产生的第二组警告消失。

## 九、深度协同修复：StatusTagFilter 与 jhs 屏蔽的 data-hide 语义（doc/48）

**背景/根因**：用户报告独立脚本拆分模式下，item 筛选（statusTagFilter）和排序
（pageSort）会导致 jhs 屏蔽（filterMovieList 的 `data-hide`）失效——被屏蔽卡片在
筛选/排序操作后被错误重新显示。doc/37、doc/38 已解决大部分冲突，但残留**时序竞争
风险**：StatusTagFilter 的协同安全判断依赖易变的 `style.display`
（`display==='none' && !hasAttribute(HIDDEN_ATTR)`），在两种场景下可能误判——
filterMovieList 的 await 窗口（排序触发 checkDom → `await doFilter()` 读 IndexedDB
让出事件循环 → StatusTagFilter 150ms 防抖到期执行 applyFilter，此时 jhs 可能还没
重新 hide）；sortItems 的 empty+append 中间态（节点不在 DOM 中查不到）。

**关键洞察**：jhs 的屏蔽标记是 `data-hide` 属性（`filterMovieList` 置
`data-hide="yes"` 基于设置的屏蔽；`showCarNumBox` 置 `data-hide="<carNum>-hide"`
临时隐藏），**比 style.display 更可靠**：排序移动节点（append / empty().append）
用同一节点引用，内联 style 与 DOM 属性都不丢失；data-hide 是语义标记，只有 jhs
的 removeAttr 才移除。

**方案与决策（协同安全升级，零侵入）**：仅改 `status-tag-filter-plugin.ts`——
新增 `JHS_HIDE_ATTR = 'data-hide'` 常量；applyFilter 协同安全判断升级为
`hiddenByJhs = hasAttribute('data-hide')` + 原 display 检查兜底（兼容未知脚本）；
collectStatusTagCounts / countNoStatusItems 统计时排除带 data-hide 的卡片
（芯片计数只反映实际可见卡片）；applyFilter 无筛选恢复分支（size===0）增加
data-hide 保护（不恢复被 jhs 屏蔽的卡片）。不修改 jhs 的 ListPagePlugin /
ListPageButtonPlugin / PageSortPlugin。

**结果**：产物 1809.85 kB（gzip 413.45），+0.40 kB。逻辑验证：data-hide 在排序
移动节点后保留、jhs 取消屏蔽时同步移除（show + removeAttr）、两种值格式
（"yes"/"<carNum>-hide"）都经 hasAttribute 检测、PageSort 无需额外修改（只移动
节点不改显隐）。

## 十、阶段结果汇总

### 10.1 插件与站点

- javdb 侧插件 22 → **33**（新增：RatingDisplay / Fc2Plugin / KeyPageTurning /
  ModMyListOpenWay / PageSort / StatusTagFilter / ListWaterfall / ListReadingStatus /
  ModalListDisabler / ListParser / VideoListsTag，共 11 个）；
- 首次引入 missav 站点（match 增加 missav.ws/live，新增
  CarListReaderPlugin + MissavStatusTagPlugin 2 个插件）；
- 全项目 @require 清零（doc/41）。

### 10.2 产物体积演进（esbuild 口径）

| doc | 产物（kB） | gzip（kB） | 说明 |
|-----|-----------|------------|------|
| 25 | 1221.87 | 314.19 | 评分显示集成 |
| 26 | 1223.66 | 314.42 | 标识符重命名 |
| 27 | 1206.64 | 310.94 | javbus 死代码清理（-17） |
| 29 | 1222.54 | 315.09 | Fc2Plugin 迁移 |
| 31 | 1704.80 | 406.03 | TabulatorFull（+482，打包全部模块） |
| 34 | 1707.08 | 406.79 | 键盘翻页 |
| 36 | 1714.58 | 409.04 | pageSort |
| 38 | 1724.81 | 411.36 | statusTagFilter |
| 39 | 1734.67 | 414.29 | listWaterfall |
| 40 | 1765.48 | 420.83 | listReadingStatus（+30.81） |
| 43 | 1769.05 | 421.79 | listParser |
| 44 | **1150**（terser） | **337** | terser 最高压缩（-35%，后被回退） |
| 45 | 1816.07 | 433.20 | videoListsTag 合并集成 |
| 46 | 1850.01 | 441.06 | carStatusSync 合并集成 |
| 47 | 1809.45 | 413.37 | 运行时清理（依赖瘦身） |
| 48 | 1809.85 | 413.45 | data-hide 深度协同 |

### 10.3 验证口径

本阶段所有文档的验证均为**编译期验证**（tsc -b 退出码 0 + vite build 成功 +
产物 metadata 检查），运行时验证均列为"后续建议"（需 Tampermonkey 实际加载）。
doc/31 额外做了 CDN 对照实验与 dist 产物赋值检查，doc/32 做了页面注入测试。

**各集成的运行时验证建议汇总**（原文分散在各 doc 的"后续"节，此处合并）：

| 插件（doc） | 运行时验证要点 |
|-------------|----------------|
| 评分显示（25） | 卡片评分标签 / 悬停懒加载 / 跨标签同步 / 4 菜单 / 新卡片刷新 |
| 键盘翻页（34） | 列表页方向键翻页 / 搜索框不误触 / 长按不连发 / 详情页不触发 |
| 清单打开方式（35） | 首页隐藏首项 / 新标签打开 / RESTful 改写 / 详情页守卫生效 |
| pageSort（36/37） | 4 排序按钮 / 选中态 / 恢复原始 / 排序守卫 / 与 jhs 排序互斥 / autoPage 不注入 |
| statusTagFilter（38） | 芯片计数与筛选 / 无状态标签 / jhs 隐藏卡片不被恢复 / 瀑布流刷新计数 |
| listWaterfall（39） | 两清单页自动翻页 / loader 三态 / URL 同步 / 链接重写 / 回到顶部 |
| listReadingStatus（40） | 下拉框 + 星级 / 跨标签同步 / 10 种排序与筛选 / IDB 备份恢复 / 新 li 自动注入 |
| modalListDisabler（42） | 501 禁用 / 已选中不干预 / 平铺面板同步禁用 |
| listParser（43） | 按钮插入 / lists:// 协议唤醒（需系统注册协议）/ 防重复插入 |
| videoListsTag（45） | 标签显示 / 4 种筛选 / 详情页 checkbox 同步 / 跨标签自动刷新 / 501 上限 / WebDav 备份 |
| carStatusSync（46） | javdb 端自动同步 / missav 端标签渲染 / 跨域实时 / 设置面板导入导出 |
| data-hide 协同（48） | 各排序/筛选操作后屏蔽保持 / 芯片计数准确 / 瀑布流新页屏蔽保持 |

### 10.4 遗留问题

1. **Beyond60Plugin 未定义**（doc/29）：auto-page-plugin 与 blacklist-plugin 的
   `getBean('Beyond60Plugin')` 长期静默失败，未删减版亦无类定义，待后续处理。
2. **terser 回退未文档化**（doc/44 与 doc/45 之间）：压缩配置被回退为 esbuild，
   回退原因无文档记录（见第六节演进链）。
3. **jsxToString 空白丢失**（doc/32）：inline-block 相邻元素间距的系统性问题，
   采用显式 `{' '}` 逐处修复。
4. **javbus 行为变化**（doc/26）：导入笔误修正后 javbus 侧判定行为变化，需运行时
   回归（doc/27 删除 javbus 支持后该风险随之消解）。
5. **各插件的运行时验证**：清单瀑布流、阅读进度、跨标签同步、WebDav 备份、
   lists:// 协议唤醒等均为编译期通过，实际使用效果需在浏览器验证。

## 附：原文矛盾与无法确认事项说明

1. **terser 前后体积矛盾**：doc/44 报告 terser 压缩后 1150 kB，但 doc/45/47/48
   报告 1816/1809/1809 kB 并直接与 doc/43 基线比较（esbuild 量级）。已通过当前
   `vite.config.ts`（无 terser 配置）与 AGENTS.md（「terser 可选但已回退」）确认为
   **terser 配置被回退**；回退发生时机（45 之前或 45 时）与原因未在本阶段文档内
   记录，融合文档如实标注，未作推测。
2. **Fc2Plugin 行号不一致**：doc/29 引用 L4162-4439，doc/30 引用 L3926-4150——
   因 doc/30 将 archetype 替换为完整版，doc/30 已明确"行号以新版为准"，非矛盾。
3. **doc/46 小节标题笔误**：「| 4.2 构建（增量推送改造后） |」残留表格行标记，
   不影响内容，融合时按正常小节处理。
4. **doc/31 与 doc/40 的插件计数衔接**：doc/31 未提及插件数变化（非插件改动），
   一览表按 doc/29（24）→ doc/34（25）衔接，与各文档"与现有 N 插件并列"表述一致。