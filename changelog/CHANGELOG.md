# 更新日志

> 所有版本的变更记录，按版本倒序排列（最新在最前）。
>
> 版本号规则：`major.minor.patch`
> - **patch**：修 bug、小改动、优化、协同修复
> - **minor**：新增插件、新增功能模块、较大功能变更
> - **major**：架构级重构、不兼容变更

---

## v1.28.19

**发布日期**：2026-07-24

### 重构

- **C3 simple_lists 分页获取去重**（doc/178）：提取 fetchSimpleListsPage 到 core/util/util-simple-lists.ts；dpb-list-panel-fetch 保留 collect-all+throw，vlt-server-api 保留 search-one+catch→null；消除 ~29 行跨插件重复。
- **C1 back-to-top CSS 孪生去重**（doc/178）：4 条规则块逐字节相同，合并为分组选择器 #jhs-back-to-top, #jdb-wf-back-to-top；删除 list-waterfall-plugin.css 冗余块（~52 行），保留 @keyframes jdb-wf-spin。
- **C2 back-to-top 逻辑对**（doc/178）：分级 L/N-A，不合并（jQuery tween vs native smooth 共存为设计意图），记录备查。
- **复用采纳扫描**：broadcast 总线 / failWithToast / ColoredTextCell 全 N/A/L。

---

## v1.28.18

**发布日期**：2026-07-24

### 重构

- **Round-4 原子化拆分**（doc/177）：18 个超 400 行文件拆分为原子模块，新建 7 个子目录 + 25 个新模块；list-page-plugin 734→258（此前从未原子化）、vlt-create-list 687→11、dpb-list-panel 658→428、vlt-db 571→83、common-util 522→283、logger 507→259 等。
- **D1 去重**：list-page 3× textContent 替换块提取为 `replaceTitleTextNodes`。
- **Ratchet 合规**：core 根 28 / util 18 / video-lists-tag 20 均在上限内。
- **eslint 警告下降**：60→59。

---

## v1.28.17

**发布日期**：2026-07-23

### 重构

- **三重广播总线统一**（doc/176）：新建 core/util/broadcast.ts（broadcastSend + broadcastSubscribe），统一 4 发送 + 3 订阅点的三通道收发，线格式逐字节保留；消除"修 bug 须改 4 处"隐患（~140 行去重）。
- **failWithToast 补全**（doc/176）：car-list-ops 10 对 + keyword-ops 1 对 show.error+throw 改 failWithToast。
- **红色 span 组件合并**（doc/176）：LogColored/ConfirmWarn 合并为 ColoredTextCell 薄包装，经 jsxToString 实证输出逐字节相同。
- **Fc2 骨架合并 DEFERRED**（doc/176）：共享骨架仅 ~6-10 行，干净合并需 ≥3 slot prop，判定为有害过度抽象，标记 resolved-by-deferral。
- **eslint 警告下降**：74→60。

---

## v1.28.16

**发布日期**：2026-07-23

### 重构

- **Wave 2 原子化拆分**（doc/175）：setting-plugin.tsx 1568→497（5 模块 + WebDAV 凭据去重 + withLoading + downloadJson）；history 782→511、blacklist 780→441（tabulator 配置复用 + 业务模块）；preview-video 661→157、new-video 589→288（5 模块 + util-status-tag）。
- **组件复用合并**（doc/175）：history 源/状态单元格合并为 shared/colored-text-cell，删除 2 冗余组件。
- **eslint 警告下降**：123→74（拆分消除内联 any 块）。

---

## v1.28.15

**发布日期**：2026-07-23

### 重构

- **Wave 1 原子化拆分**（doc/174）：storage-manager.ts 1321→415（6 仓储模块）；vlt-tags.ts 1028→421（3 模块）。
- **组件复用合并**（doc/174）：review/related 七对组件合并为 shared/ 参数化组件，vlt/missav 面板合并为 sync-panel，删除 16 冗余组件。
- **共享工具抽取**（doc/174）：util-translate / util-async(withLoading) / tabulator-factory / back-to-top / failWithToast，接入 10 处调用点。

---

## v1.28.14

**发布日期**：2026-07-23

### 修复

- **设置面板 UI 统一化**（doc/173）：CSS Grid 表单布局（180px 标签 + 撑满输入框）；统一控件样式（36px 高/6px 圆角/focus 蓝色光环）；移除 emoji 密码切换按钮（依赖浏览器原生）；iOS 风格 toggle 开关；分区标题+分隔线；统一按钮色系；颜色选择器样式化。8 个原子表单组件（SettingRow/Input/Select/Toggle/Checkbox/Section/Button/ColorRow）；9 面板全部重构；120 个 jQuery 选择器审计全通过。独立预览页 preview/settings-preview.html。

### 重构

- **vlt-sync.tsx 最终拆分**（doc/173）：2259→27 行 barrel + 5 新模块（helpers 338 / checkbox 288 / server 484 / create-list 687 / list-mgmt 340）。

---

## v1.28.13

**发布日期**：2026-07-23

### 重构

- **5 个大文件职责拆分**（doc/172）：detail-page-button-plugin 2043→413（+6 模块）、other-site-plugin 1178→510（+5 模块）、list-reading-status-plugin 1103→275（+4 模块）、common-util 1094→519（+10 模块 facade 模式）；vlt-sync 上轮已拆 2425→2259（+3 模块）。
- **组件目录重组**（doc/172）：src/components/ 从 120+ 平铺文件重组为 25 个子目录（review/related/blacklist/dialogs/magnet-hub/actress/history/setting/top250/dpb/hit-show/image-preview/image-recognition/nav/log/other-site/preview-video/screen/subtitle/movie/want-watched/misc 等），直接文件数 0，144 处 import 路径更新。
- **机械门禁更新**：check-structure.ts 移除 4 个 FILE_CEILINGS + 1 个 DIR_CEILINGS 条目。

---

## v1.28.12

**发布日期**：2026-07-23

### 修复

- **设置面板 UI 布局修复**（doc/171）：移除 `.form-content` 的 max-width/min-width 限制；密码字段用 flex 容器包裹防止切换按钮换行。
- **WebDAV 401 修复**（doc/171）：备份/查看操作优先从输入框读取凭据（未保存的编辑即时生效），回退 GM 存储。
- **WebDAV URL 丢失修复**（doc/171）：loadForm 增加旧格式 `settings.*` 回退 + 首次加载自动迁移到 GM 新格式。

### 优化

- **WebDAV 备份移除加密**（doc/171）：WebDAV 备份改为明文 JSON 上传（私有服务器无需加密）；移除 backupPassword 检查和 encryptBackupV2 调用；保留 importData 解密路径兼容旧加密备份；保留 exportData 本地加密。WebDAV 凭据不在备份 payload 中（BACKUP_GM_KEYS 不含 jhs_webdav_* 键）。
- **transition:all 反模式窄化**（doc/171）：image-recognition-plugin.css `#upload-area` 的 `transition: all` 窄化为具体属性。

---

## v1.28.11

**发布日期**：2026-07-23

### 修复

- **4 处残留内联 UI 模板修复**（doc/170）：common-util insertStyle / new-video 头像弹窗的
  `<style>` 拼接改走 StyleBlock/styleBlockHtml；list-waterfall 回到顶部 SVG、review 星标
  改走新组件 scroll-top-icon / review-star-icon。

### 重构

- **死 SVG 常量清理**（doc/170）：删除 icons.ts 5 个零读取 SVG 常量及 base-plugin 对应
  import/字段（SETTING/CHECK/ACTRESS/NEW/BLACKLIST_SVG）；3 个在用常量经 DSI 组件消费保留。
- **零硬编码 HTML 边界写死**（doc/170 / AGENTS §9.7）：明确违规/needle 豁免/jQuery 构造
  idiom/sanctioned 常量四类，禁止把 `$('&lt;tag&gt;')` 元素构造误判为违规。

---

## v1.28.10

**发布日期**：2026-07-23

### 修复

- **标题栏检索按钮无响应**（doc/169）：toggleOtherNavItem 在 1024-1599px 显示未绑定的站点检索栏，改为桌面宽度统一显示已绑定的自定义检索框。

### 重构

- **零硬编码 HTML**（doc/169）：15 文件全部内联 HTML 字符串字面量提取为 ~25 个新 React 组件 + 3 个 CSS 提取 + 2 个 SVG dangerouslySetInnerHTML 常量；src/ 全树零内联 HTML。
- **setting-dialog 拆分**（doc/169）：940 行 → 171 行 + 9 面板子组件（setting-panels/ 子目录）。
- **api.ts any 收窄**（doc/169）：14 any → 0；eslint warnings −19。
- **机械结构门禁**（doc/169）：scripts/check-structure.ts 独立命令，800 行/20 文件棘轮。
- **AGENTS §10/§11**（doc/169）：大文件拆分 + 目录规划规则写死。
- **.tsx→.ts 重命名**（doc/169）：vlt-plugin + rating-display-plugin（无 JSX）。
- **fc2 组件子目录**（doc/169）：6 组件移入 components/fc2/。

---

## v1.28.9

**发布日期**：2026-07-23

### 重构

- **二轮内联 HTML 提取**（doc/168）：提取 fc2-plugin.tsx 和 fc2-by-123av-plugin.tsx 中 4 处 HIGH 残留动态内容模板为 4 个新 TSX 组件（fc2-movie-detail/fc2-magnet-item/fc2-123av-detail-dialog/fc2-123av-movie-info）；HIGH 内联 HTML 从 4→0。
- **§9.1 导入顺序修复**（doc/168）：5 个重命名插件文件的六组导入顺序违规修正。
- **死代码清理**：删除 fc2-by-123av-plugin.tsx 的 `void YES;` hack 及未使用导入。

---

## v1.28.8

**发布日期**：2026-07-23

### 重构

- **内联 HTML 模板字面量提取为 TSX 组件**（doc/167）：将 7 处 HIGH 级别内联 HTML（~135 行）从插件/核心/常量文件提取为 6 个新 TSX 组件 + 复用 1 个已有组件；删除 `constants/api.ts` 的 `markDataListHtml()` 重复函数与 `javDbApi` 聚合对象；5 个文件因 JSX 语法从 `.ts` 重命名为 `.tsx`；`jsx-to-string.ts` 新增 `htmlFor`→`for` 属性映射消除 `as any` hack；组件总数 91→97；eslint warnings −1。

---

## v1.28.7

**发布日期**：2026-07-23

### 修复

- **导航栏「设置」「鉴定记录」按钮多余下拉箭头**（doc/166）：修复 javdb.com
  顶部导航栏插件注入的「设置」「鉴定记录」按钮显示 Bulma `.navbar-link::after`
  边框三角箭头（「设▼」）的问题。根因为 CSS 提取重构遗留缺陷：
  `src/styles/setting-plugin.css` L1 的动态占位符为小写 `__css_text__`，与
  `setting-plugin.tsx` `initCss()` 中 `.replace('__CSS_TEXT__', cssText)` 的大写
  形式不匹配，且占位符与选择器融合在同一行，致使原本用于压制站点继承箭头的
  `.nav-btn::after { content: none !important; }` 规则变成无效选择器
  `__css_text__ .nav-btn::after` 而被浏览器丢弃。修复：将占位符改为独立行的大写
  `__CSS_TEXT__`（与运行时替换精确匹配，动态容器宽度 CSS 正常落地），
  `.nav-btn::after` 恢复为有效独立规则，压制全部四个携带 `nav-btn` 类的注入按钮
  （setting-btn / mini-setting-btn / historyBtn / miniHistoryBtn，桌面与 mini 变体）
  的箭头；占位符行附 `stylelint-disable-next-line selector-type-case` 注释（占位符
  须保持大写），注释文案刻意不含占位符字面量以免抢占 `String.replace` 的首次匹配。
  未改动 `setting-plugin.tsx` 及任何组件（按钮 `nav-btn` 类与原始 userscript 字符级
  一致）。`tsc -b && vite build` 通过、28/28 测试全绿、ESLint 0 errors（786 基线
  警告无新增）、Stylelint 0 errors。

---

## v1.28.6

**发布日期**：2026-07-23

### 修复

- **iframe 弹窗回归修复**（doc/165）：移除 doc/136 误加的 `@noframes`（vite.config `noframes: true`），恢复脚本注入同源 layer 详情 iframe——原始 archetype 头部无此指令，且 `utils.openPage`/跨 frame ESC 闸门/`car-list-reader` 自守卫均预设 in-iframe 执行；`@noframes` 同时导致弹窗「不加载脚本信息」与「UI 错乱」（脚本未跑故样式未注入），顶层标签页非 iframe 故不受影响。保留 doc/136 收窄后的 3 个官方 `@match`（真实安全意图不变）。双触发复核：全部启动期副作用均为每文档独立/幂等/页型门控/自守卫/跨 frame 设计/与原始同行为，无数据/功能双触发回归；唯一新 cosmetic nit 为真实 Tampermonkey 下弹窗 iframe 可能重复登记「📊 插件诊断」菜单项（已记录、deferred，非用户报告的页面坏损）。visit-history 守卫经路径键分析**驳回**（顶层=列表、弹窗=详情为两条正确不同记录，加守卫反致覆盖回归）。

### 重构

- **feature-flags 强类型收敛**（doc/165）：`Record<string,boolean>` → 封闭 `interface FeatureFlags`（无索引签名）+ 逐键 JSDoc，使键集合成为编译期可校验契约，与项目强类型风格统一；grep 全 src 证实 `featureFlags` 零动态访问（全按名），故封闭接口不破坏任何调用点；16 键/默认值/localStorage 覆盖 IIFE 逐字节保留，行为不变；tsc 全码库编译零错误、28/28 测试不变、eslint 786/0 未增警告。

### 文档

- **AGENTS §6.3 顺序修正 + @types 已核实**（doc/165）：将 doc/164 误插于 seam 与 devDependencies 之间的「增量 any 消除」bullet 移至版本规则 bullet 之后；并在 backlog 行补注 `package.json` devDependencies 确无 `@types/jquery`/`@types/tabulator-tables`/`@types/layui-layer`（已核实，即 786 警告主体来源）。
- **结构/目录优化规划**（doc/165，deferred）：核实当前 `src/` 布局已符合 AGENTS §2、无 doc 提议重组 `core/`/移动 feature-flags（其「不统一」实为弱类型，已修复）；真正的结构债为 `vlt-sync.ts`(2428)/`detail-page-button-plugin.tsx`(2041)/`setting-plugin.tsx`(1571)，给出 `vlt-sync` 按广播/远程同步/锁队列/编排的拆分大纲，待单独立项，本轮不做无依据目录搬迁。
- **浏览器验证诚实声明**（doc/165）：无头 Chromium 无 `GM_*` 宿主，无法忠实运行 userscript；@noframes 回归静态可证，弹窗修复效果需用户在自有 Tampermonkey 目视确认。

---

## v1.28.5

**发布日期**：2026-07-23

### 类型

- **storage-manager 迁移方法增量 any 消除**（doc/164）：对已触及文件按批次 6
  「触及即消除」规则，将 `clean_no_url_blacklist` / `merge_blacklist` /
  `merge_favoriteActress` / `merge_tow_car_list_table` 四个迁移方法的 `any[]`
  重类型为既有接口 `CarRecord[]` / `BlacklistItem[]` / `FavoriteActress[]`，回调参数
  改由上下文推断（接口含旧迁移字段可选属性 + `[key:string]:any` 索引签名，故
  `delete item.actress` / `item.role = …` / 展开赋值仍合法，零 `as any` 回填、无隐式
  any）。`tsc -b` 严格编译通过；eslint `no-explicit-any` 警告实测 **805→786（−19）**；
  行为不变，28/28 测试全绿。`merge_table_name`（混合形状旧键数组）、
  `async_merge_other`（`Setting` 类型）、`getBlacklistCarList` 原始读（经 any 型
  copyObj/deepFreeze 无下游收益）三项有意保留为 backlog，见 doc/164。

## v1.28.4

**发布日期**：2026-07-23

### 正确性

- **schema 迁移回归测试 + 可注入存储 seam**（doc/162）：为 `StorageManager` 增加
  构造函数 `forageInstance?: unknown` 注入点与 `__resetForTesting()` 单例重置
  （仅测试），落地 doc/161 推迟的迁移幂等性回归套件（5 用例：version=6 幂等 /
  version=3 门控仅跑 4-6 / 全量 0→6 旧键迁移+删除 / 迁移后缓存失效 / 失败步骤保留
  版本号下次重试）；`tests/storage-migration.test.ts` 用 jsdom 环境 + 手写
  in-memory fake forage，无新依赖。
- **§9.2 违规修正**（doc/162）：`merge_table_name` 6 处裸
  `console.log('更正', oldKey)` → `clog.debug`（storage-manager 属项目核心基础
  设施，不适用集成脚本跟踪例外）。
- **附件四缺陷复核**（doc/162）：附件列举的 stale-cache / 冻结对象 TypeError /
  无错误隔离 / 首记录当版本号四项**均已被 doc/135 修复**（`runMigrations` 后置
  缓存全清、迁移直读 forage 绕过 deepFreeze、逐步 try/catch + 版本保留重试 +
  navigator.locks、`clean_no_url_blacklist` 已全量 `.filter/.map` 扫描无 `[0]`
  启发式）；本轮无对应方法体改动。


## v1.28.3

**发布日期**：2026-07-23

### 一致性

- **core 模块导入顺序修正**（doc/157）：`image-preview.tsx` 和 `tooltip.ts` 的
  CSS?raw 导入从首位移至末位，符合 AGENTS.md §9.1 六组约定。core 目录其余
  26 个文件导入顺序已合规；console 维度全清洁（仅 clog.*/show.*，无裸 console.*）。

## v1.28.2

**发布日期**：2026-07-23

### 一致性

- **剩余插件错误处理 / 导入 / toast 一致性**（doc/155）：39 个插件文件 159 处
  修复——catch 块 `console.error`→`clog.error`、`show.error` 直传 Error / 不安全
  `e.message || e` 改为 `instanceof` 守卫、导入按六组约定重排、移除死调试日志与
  重复 `console.error`。
- **devtools 跟踪日志保留（零偏差修正）**（doc/155）：集成脚本的
  `${LOG}`/`${LOG_PREFIX}`/方括号前缀跟踪体系（vlt-sync/vlt-tags/vlt-reconcile/
  list-reading-status/page-sort/status-tag-filter/list-waterfall/modal-list-disabler/
  other-site 预加载/missav-quick-copy）回退为 `console.log/warn`——`clog.log/warn`
 仅写面板不打 devtools，转换会静默丢失同步诊断输出；`%c` 着色日志工厂
  （car-status-logger、rating-utils）按 archetype 原样恢复；`logger.tsx` 的
  error-only 转发为有意设计，未改动。项目自有代码继续用 `clog`，集成本地脚本保留
  原生 devtools 跟踪——这是有意的分层（沿用第三轮先例）。

## v1.28.1

**发布日期**：2026-07-23

### 一致性

- **错误处理统一化**（doc/154）：detail-page-button-plugin（13 处）、history-plugin、
  blacklist-plugin 的 catch 块由 `console.error` 改为 `clog.error`，写入类失败补
  `show.error` 用户反馈；修复 `show.error(err)` 直传 Error 对象渲染为
  `[object Object]` 的问题（字幕搜索）。
- **导入顺序统一化**（doc/154）：main.tsx + 5 个插件按六组约定重排（外部类型 →
  常量 → 核心 → 本地插件 → 组件 → CSS?raw 最后）；入口文件 CSS?raw 由中段移至末尾。
- **CSS 类名去冲突**（doc/154）：`.menu-btn` 在 common-toolbar 与 setting-plugin
 重名冲突，拆为 `.jhs-toolbar-menu-btn` / `.jhs-setting-menu-btn`（13 文件 68 处
  调用点同步）；video-lists-tag.css 前半段无缀类名统一加 `jhs-vlt-` 前缀
  （23 个类 + 1 个 keyframes，跨 4 文件调用点同步）。

## v1.28.0

**发布日期**：2026-07-23

### 优化

- **z-index 统一化**（doc/153）：9 个 CSS 文件的超大 z-index（9999~9999999999）
  统一为设计令牌变量：`--jhs-z-page: 9999`（页面内元素：back-to-top/load-all/
  瀑布流按钮/tag 下拉）和 `--jhs-z-top: 999999999`（above-layer 层：tooltip/
  loading/logger/fc2/visit-history-tooltip）。layer.js z-index 无上限递增，
  above-layer 层需 genuinely large 常量保证始终在弹窗之上。
  image-preview.css 的 `/* __Z_INDEX__ */` 占位符保留（运行时动态替换）。

## v1.27.9

**发布日期**：2026-07-23

### 优化

- **合并两套返回顶部控件**（doc/152）：ListWaterfallPlugin 的 `#jdb-wf-back-to-top`
  在 SettingPlugin 的 `#jhs-back-to-top` 已存在时跳过创建（`/users/lists` 页面
  SettingPlugin 已注入返回顶部按钮，避免重复）。
- **package.json 版本同步**（doc/152）：`1.27.5` → `1.27.8`（与 vite.config.ts 同步）。

## v1.27.8

**发布日期**：2026-07-23

### 安全

- **jsxToString XSS 加固**（doc/151）：`renderAttrs` 所有属性值添加
  `escapeAttr()` 转义（`&`/`<`/`>`/`"`），阻止通过 `"` 闭合属性注入
  新属性；`href`/`src` 属性添加 `sanitizeUrl()` 协议校验，阻止
  `javascript:`/`data:`/`vbscript:` 危险协议（返回 `#`）。
  文本节点 `escapeText()` 已有（`&`/`<`/`>`），属性值此前未转义。

## v1.27.7

**发布日期**：2026-07-23

### 优化

- **应用全局类型化**（doc/150）：globals.d.ts 中 6 个应用全局从 `any` 升级为
  精确类型（`utils: CommonUtil`、`storageManager: StorageManager`、
  `gmHttp: GmHttp`、`show: typeof show`、`clog: Logger`、
  `pluginManager: PluginManager`），消除数百处调用点的 `any` 传播。
- **69 处隐藏类型错误修复**（doc/150）：类型化暴露的被 `any` 掩盖的
  类型不匹配，涉及 12 个文件（api.ts/gm-http.ts/storage-manager.ts/
  gfriends.ts/detail-page-button-plugin.tsx/auto-page-plugin.ts/
  blacklist-plugin.tsx/new-video-plugin.tsx/other-site-plugin.tsx/
  fc2-plugin.ts/fc2-by-123av-plugin.ts/history-plugin.tsx/
  list-page-plugin.tsx/list-page-button-plugin.tsx/
  favorite-actresses-plugin.tsx/want-and-watched-videos-plugin.tsx/
  top250-plugin.tsx/setting-plugin.tsx/preview-video-plugin.tsx）。
  修复模式：`null`→`undefined`、`!` 非空断言、`?? undefined`、
  `Number()` 转换、`RequestHeaders` 索引签名。

## v1.27.6

**发布日期**：2026-07-23

### 优化

- **BasePlugin.pluginManager 类型化**（doc/149）：`pluginManager: any` →
  `pluginManager!: PluginManager`，消除 BasePlugin 核心字段的 `any` 类型，
  所有 40 个插件继承精确类型。ESLint 警告 806→805。

## v1.27.5

**发布日期**：2026-07-23

### 新增

- **Stylelint 工具链**（doc/148）：新增 `.stylelintrc.json`
  （stylelint-config-standard + 项目规则覆盖），`bun run lint:css` 脚本。
  `--fix` 自动修复 442 处（`rgba()`→`rgb()` CSS Color L4 + 格式化），
  基线 0 errors。全部 CSS 文件（含 layer-fix.css）均通过 lint。

### 优化

- **AGENTS.md 工具链同步**（doc/148）：§3.6 样式节补充 design-tokens/
  accessibility 注入说明 + transition:all 清理记录；§3.7 全局类型节
  补充 GM API 类型化说明；新增 §3.8 工具链节（build/lint/lint:css）；
  §3.1 CSS 注入枚举补充 design-tokens。

## v1.27.4

**发布日期**：2026-07-23

### 优化

- **ESLint 基线归零**（doc/147 补充）：手动修复 15 个 error 级违规
  （storage-manager.ts 3 处解构 `let`→`const` 拆分、logger.tsx 正则
  字符类内 2 处多余 `\/` 转义），`prefer-const`/`no-useless-escape`
  保持 error 门禁。`bun run lint` 输出 0 errors, 806 warnings。

## v1.27.3

**发布日期**：2026-07-23

### 新增

- **设计令牌**（doc/147）：新增 `src/styles/design-tokens.css`，
  `:root` 定义 CSS 自定义属性（主色/语义色/中性色/间距/圆角/字体/
  阴影/z-index 层级/过渡/触控目标），令牌值与实际调色板一致
  （`--jhs-color-primary: #5d87c2`）。main.tsx 全局注入。
- **ESLint 工具链**（doc/147）：新增 `eslint.config.js`
  （TypeScript，`no-explicit-any`/`consistent-type-imports`/`no-unused-vars`
  均为 warn），`bun run lint` 脚本。
  基线：806 warnings（0 errors），`prefer-const`/`no-useless-escape` 保持 error 门禁。

### 优化

- **CSS `transition: all` 清理**（doc/147）：12 个 CSS 文件中 19 处
  `transition: all` 替换为具体过渡属性（color/background-color/opacity/
  transform/box-shadow/border-color），消除全属性过渡反模式，
  保留原有 duration 和 timing-function。

## v1.27.2

**发布日期**：2026-07-23

### 优化

- **AGENTS.md 架构文档同步**（doc/146）：§3.1 启动序列更新为 17 步
  （initPageContext → processCss 页面过滤 → runMigrations →
  storageRevision → processPlugins → destroyAll）；§3.2 BasePlugin
  新增 sites/pageTypes/destroy，PluginManager 新增 matchesPage/destroyAll。
- **代码一致性修复**（doc/146）：Top250Plugin getName() 对齐 PluginMap
  键名（'TOP250Plugin' → 'Top250Plugin'）；main.tsx 插件计数注释
  更新为 40（38 javdb + 2 missav）。

## v1.27.1

**发布日期**：2026-07-23

### 新增

- **无障碍基础样式**（doc/145）：新增 `src/styles/accessibility.css`，
  全局 `:focus-visible` 焦点环（键盘导航可见，鼠标点击不显示）+
  `@media (prefers-reduced-motion: reduce)` 禁用动画/过渡。
- **GM API 类型化**（doc/145）：`globals.d.ts` 中 6 个 Tampermonkey
  Grant API 从 `any` 升级为精确类型声明（`GMXmlHttpRequestDetails` 接口 +
  函数签名），消除 GM 调用处的类型盲区。

### 修复

- **StorageRevision 跨会话失效**（doc/144 补充）：修订号每会话从 0 开始，
  不跨会话单调递增。修复为任何远程消息都触发缓存失效（senderId 排除自身），
  修订号仅作元数据。

### 优化

- **package.json 同步**（doc/145）：version 同步为 1.27.0，
  description 更新为 JavDB Power Tools 品牌名。

## v1.27.0

**发布日期**：2026-07-23

### 新增

- **StorageRevision 跨标签页缓存失效**（doc/144）：新增
  `src/core/storage-revision.ts`，StorageManager 的 16 个写入方法
  在 `forage.setItem` 成功后调用 `storageRevision.increment()`，
  通过 BroadcastChannel 广播修订号到其他标签页。
  其他标签页收到广播后自动失效 carList/setting/blacklistCarList 缓存，
  解决多标签页同时操作时缓存不一致问题。
  main.tsx 启动时 `storageRevision.init()` + `onRemoteChange()` 注册回调。

## v1.26.0

**发布日期**：2026-07-23

### 新增

- **瀑布流分页状态机**（doc/143）：新增 `src/core/pagination-state.ts`，
  `PaginationStateMachine` 将 auto/click 两种加载模式统一为明确的状态转换
  （idle/loading/error/exhausted），保证有下一页时按钮持续存在。
  `auto-page-plugin` 移除散落的 `hasMore`/`isLoading` 布尔标志，
  14 处引用替换为状态机调用，错误状态支持 retry 恢复。
- **外站预加载 keyed 去重 + LRU 淘汰**（doc/143）：
  `other-site-plugin` 新增 `inflightPreloads` Map，同一 carNum+site
  并发请求复用 in-flight Promise；缓存超过 5000 条时按 ts 淘汰最旧条目
  （无 ts 旧格式优先淘汰）。

## v1.25.3

**发布日期**：2026-07-23

### 优化

- **TaskSupervisor 全量迁移完成**（doc/142）：剩余 4 个插件迁移到
  TaskSupervisor 统一生命周期管理，累计 9 个插件完成迁移：
  - `list-page-plugin`：checkDom MutationObserver → supervisor
  - `list-reading-status-plugin`：MutationObserver + 7 个 addEventListener → supervisor
  - `modal-list-disabler-plugin`：body MutationObserver → supervisor
  - `list-waterfall-plugin`：scroll/click addEventListener + setTimeout → supervisor

### 新增

- **ListDomBus 列表页 DOM 变更总线**（doc/142）：新增
  `src/core/list-dom-bus.ts`，集中管理 .movie-list 容器的
  MutationObserver，将新增 .item 元素在 requestAnimationFrame
  内批量分发给注册的处理器。替代各插件各自创建独立 Observer
  的模式，减少 Observer 数量、避免重复遍历、保证单帧内一次性处理。

## v1.25.2

**发布日期**：2026-07-23

### 优化

- **TaskSupervisor 生命周期迁移**（doc/141）：5 个插件从原始
  setTimeout/MutationObserver/addEventListener 迁移到 TaskSupervisor 统一管理：
  - `visit-history-plugin`：setInterval + 4 个 addEventListener → supervisor
  - `auto-page-plugin`：scroll/click addEventListener + 3 个 setTimeout → supervisor
  - `status-tag-filter-plugin`：2 个 MutationObserver + 3 个 setTimeout → supervisor
  - `page-sort-plugin`：waitForContainer MutationObserver → supervisor
    （sortGuard 保留原有 disconnect/reconnect 模式）
  - `other-site-plugin`：2 个 MutationObserver + 2 个 setTimeout → supervisor
  - 所有 5 个插件实现 `destroy()` → `supervisor.abort()`，
    页面卸载时一次性清理全部资源

## v1.25.1

**发布日期**：2026-07-23

### 优化

- **19 个插件 pageTypes 声明**（doc/140）：为所有页面特定插件添加
  `pageTypes` getter，PluginManager 在 processCss/processPlugins 时
  按页面类型过滤，不匹配的插件不注入 CSS、不执行 handle：
  - 详情页（9 个）：detail-page/detail-page-button/favorite-actresses/
    highlight-magnet/preview-video/review/screenshot/translate/visit-history
  - 列表页（6 个）：auto-page/fold-category/list-page-button/list-page/
    page-sort/status-tag-filter
  - 混合（3 个）：other-site/list-reading-status/vlt → `['detail', 'list']`
  - 非详情页（1 个）：key-page-turning → `['list', 'fc2', 'unknown']`
  - 其余 21 个插件保持空 pageTypes（匹配所有页面）

## v1.25.0

**发布日期**：2026-07-23

### 新增

- **Runtime V2 基础设施**（doc/139）：
  - `src/core/page-context.ts`：集中式页面类型检测（`detectPageContext()`），
    将原 main.tsx 散落的 isDetailPage/isListPage/isFc2Page 判定提取为独立模块，
    在 processCss 之前执行，插件可通过 `pageContext` 单例获取检测结果。
  - `src/core/task-supervisor.ts`：AbortSignal 统一生命周期管理，
    提供 `setTimeout`/`setInterval`/`observe`/`addEventListener` 注册方法，
    `abort()` 一次性清理所有资源，防止内存泄漏和幽灵回调。
  - `BasePlugin` 新增 `sites`/`pageTypes` getter（空数组 = 匹配所有，向后兼容）
    和 `destroy()` 钩子。
  - `PluginManager` 新增 `matchesPage()` 过滤（processCss/processPlugins 时
    按 pageType 跳过不匹配的插件）和 `destroyAll()` 方法。
  - main.tsx 启动序列重排：页面判定 → processCss → 迁移 → processPlugins，
    页面卸载时调用 `destroyAll()`。

## v1.24.1

**发布日期**：2026-07-23

### 优化

- **全量同步版本门控**（doc/138）：`CarListReaderPlugin` 不再每次页面加载都
  执行全量 55k 记录同步。新增 `jhs_car_list_rev`（变更代号，每次增量推送递增）
  和 `jhs_car_status_synced_rev`（上次同步代号），仅在数据变更或超过 24 小时
  兜底间隔时执行全量同步。无变更页面加载跳过读取+深拷贝+列存+gzip+GM 写入
  全流程，控制台输出「跳过全量同步」日志。

## v1.24.0

**发布日期**：2026-07-23

### 新增

- **AES-GCM 加密备份 V2**（doc/137）：新增 `src/core/backup-crypto.ts`，
  使用 AES-GCM + PBKDF2-SHA-256（100,000 次迭代）替代原 Caesar 位移混淆。
  每次加密使用独立随机 salt（16 字节）和 IV（12 字节），信封包含格式版本、
  算法标识和创建时间。旧 V1 格式仅保留导入兼容。
- **备份口令字段**（doc/137）：设置面板「数据备份」新增「备份口令」输入框
  （`type="password"` + 👁 切换），口令存储在 GM 私有存储，永不写入备份文件。

### 安全

- **WebDAV 凭据迁移到 GM 私有存储**（doc/137）：`webDavUrl`/`webDavUsername`/
  `webDavPassword` 从 settings 对象（明文 IndexedDB）迁移到 `GM_setValue`
  （油猴私有存储），保存时自动清除旧字段。页面脚本无法通过 storageManager 读取。
- **备份口令仅本机存储**（doc/137）：`jhs_backup_password` 存储在 GM 私有存储，
  不随备份文件导出。新设备恢复时需重新输入口令。

## v1.23.0

**发布日期**：2026-07-23

### 安全

- **权限边界收窄**（doc/136）：移除 `unsafeWindow` 上的 `gmHttp`/`storageManager`/
  `WebDavClient`/`encryptCredential`/`decryptCredential`/`pluginManager` 暴露，
  页面脚本不再能访问 HTTP 客户端、存储管理器、加密函数和插件管理器。
  仅保留 `utils`/`loadGfriends`/`filetreeDb`（页面功能依赖）。
- **站点匹配精确化**（doc/136）：删除宽泛 `include`（`javdb*.com`/`missav*.ws`/
  `missav*.live`），保留 3 个官方 `match`；新增 `@noframes` 禁止 iframe 内执行。
- **密码输入隐藏**（doc/136）：WebDAV 密码输入框改为 `type="password"` +
  👁 显示/隐藏切换按钮。
- **备份导入原子性**（doc/136）：`importData` 改为「验证→暂存→切换」三阶段，
  使用临时 localforage 实例（`appData_import_staging`），失败时主数据库不变。
  导入成功后自动执行 `runMigrations()` 迁移老备份。
- **备份附加存储白名单**（doc/136）：`applyBackupExtras` 新增
  `ALLOWED_LOCALSTORAGE_KEYS`（17 键）/ `ALLOWED_GM_KEYS`（7 键）白名单，
  白名单外的键跳过并 warn；拆分为 `stripBackupExtras`（导入前剥离）+
  `applyBackupExtras`（导入成功后写回），确保主数据失败时不写入附加存储。

## v1.22.0

**发布日期**：2026-07-23

### 优化

- **版本化数据迁移**（doc/135）：6 个历史迁移方法改为版本化一次性执行。
  新增 `__jhs_schema_version` 键（当前版本 6），后续启动仅读取版本号（~1ms），
  不再每次页面打开都执行 12 次 IndexedDB 旧键检查 + 5.5 万条番号全量扫描。
  使用 `navigator.locks` 防止多标签页并发迁移；每步成功后才写入版本号，
  失败保留当前版本下次重试。
- **迁移冻结对象修复**（doc/135）：`merge_blacklist`/`merge_favoriteActress`/
  `merge_tow_car_list_table`/`clean_no_url_blacklist` 改为直接 `forage.getItem()`
  读取原始数据，绕过 `deepFreeze`（原代码修改冻结对象会抛 TypeError）。
- **迁移缓存失效修复**（doc/135）：迁移写入 IDB 后统一清理受影响的运行时缓存
  （`cacheCarList`/`cacheFavoriteActressList`/`cache_filter_actor_actress_car_list`/
  `cacheSettingObj`），避免迁移后当前页面继续读取旧缓存。
- **首条记录启发式移除**（doc/135）：`clean_no_url_blacklist` 不再用第一条记录
  判断迁移状态（混合数据会错误跳过），改为版本门控。

### 修复

- **健壮性修复 15 处**（doc/135）：4 处 JSON.parse 无 try-catch（preview-video 3 处、
  screenshot 1 处）、3 处 querySelector/parseInt null 安全（setting-plugin）、
  1 处 actress 非空断言（new-video）、7 处异步/NaN/null 防护
  （common-util/logger/main/api/fc2-by-123av）。

## v1.21.2

**发布日期**：2026-07-23

### 优化

- **`(window as any)` 完全消除**（doc/134）：globals.d.ts 新增 Window 接口
  扩展（8 个第三方库全局字段），libs.ts / _jquery-global.ts / layer-wrapper.ts /
  setting-plugin.tsx 全部 `(window as any)` 替换为类型安全访问，
  代码中 `(window as any)` 从 56 处降至 **0 处**。
- **诊断增强**（doc/134）：Plugin 接口新增 `durationMs` 字段，processPlugins
  记录每个插件 handle() 执行耗时；诊断表格新增「耗时」列 + 总耗时统计；
  插件名 HTML 转义防护。

## v1.21.1

**发布日期**：2026-07-23

### 优化

- **`(window as any)` 类型安全清扫**（doc/133）：将 40 处
  `(window as any).isDetailPage/isListPage/isFc2Page/cleanCache_*/filetreeDb/showImageViewer`
  替换为类型安全的 `window.*` 访问（Window 接口已在 main.tsx 声明），
  `(window as any)` 从 56 处降至 16 处。
- **诊断模块提取**（doc/133）：main.tsx 内联的 25 行诊断 UI 提取至
  `src/core/plugin-diagnostics.ts`（`renderDiagnosticsHtml` /
  `renderDiagnosticsText` / `registerDiagnosticsMenu`），入口文件减至一行调用。

### 新增

- **设置面板「📊 插件诊断」**（doc/133）：设置弹窗新增侧栏菜单项 +
  诊断面板，展示 40 个插件的 CSS/handle 执行状态表格 +
  「📋 复制诊断报告」按钮（纯文本格式，便于反馈问题）。

## v1.21.0

**发布日期**：2026-07-23

### 新增

- **插件诊断菜单**（doc/132）：Tampermonkey 菜单新增「📊 插件诊断」命令，
  弹窗展示 40 个插件的 CSS/handle 执行状态（✅/❌/⏭️），快速定位启动失败插件。

### 优化

- **类型安全插件注册表**（doc/132）：新增 `plugin-registry.ts` 的 `PluginMap`
  接口，将 40 个插件名映射到具体类。`PluginManager.getBean` / `BasePlugin.getBean`
  改为泛型签名，已知插件名返回精确类型（非 `any`），消除 66 处 getBean 调用的
  类型盲区。新增 `registrationComplete` 时序标记 + 未注册插件 `console.warn` 诊断。
- **预存类型错误修复**（doc/132）：修复 6 个被 `any` 掩盖的预存类型错误：
  Beyond60Plugin 死路径类型断言（2 处）、`carNum` null 安全（1 处）、
  不存在的 `getAv123Url` 方法调用（1 处）、`favoriteOne` 多余参数（1 处）、
  `carNum` null 传递（1 处）。

## v1.20.3

**发布日期**：2026-07-23

### 优化

- **api.ts 死代码清理**（doc/131）：删除 4 个零引用导出函数（`removeSignature`/
  `searchMovie`/`getMagnets`/`login`）、2 个去 export（`RequestHeaders`/
  `DEFAULT_REQUEST_HEADERS`）、`javDbApi` 聚合对象从 12 属性精简为仅
  `markDataListHtml`。
- **car-status-sync 日志工厂**（doc/131）：提取 `createLogger(prefix)` 共享工厂，
  消除 car-list-reader/missav-status-tag 的 4×2 重复日志函数。
- **Fc2By123Av 竞态守卫**（doc/131）：`_querySeq` 序列号守卫，防止快速搜索/排序/
  分页操作的后发先至覆盖。
- **base-plugin 类型收窄**（doc/131）：`CarInfo`/`SelectorConfig` 接口去 export。

## v1.20.2

**发布日期**：2026-07-23

### 修复

- **StorageManager 缓存失效缺失**（doc/130）：`removeCar`/`batchRemoveCars`/
  `removeFavoriteActress` 写入 IDB 后未同步运行时缓存字段，`storageCacheDeepCopy`
  开启时后续 `getCarList()` 返回已删除的幽灵记录。
- **MagnetHub 请求无超时 + 竞态**（doc/130）：`GM_xmlhttpRequest` 添加 15s 超时 +
  序列号守卫，修复服务器无响应时永久挂起及快速切换引擎 tab 时旧响应覆盖新结果。
- **JSON.parse 无 try-catch 防护**（doc/130）：`list-page-plugin`（1 处）、
  `other-site-plugin`（7 处）、`actress-info-plugin`（2 处）的
  `JSON.parse(localStorage.getItem(...))` 添加 try-catch，损坏缓存回退空对象
  而非崩溃。
- **Translate 翻译无超时**（doc/130）：裸 `fetch()` 添加 `AbortController` + 10s
  超时，API 无响应时显示「翻译超时」而非永久挂起。

### 移除

- **VideoTitleSpan 死亡组件**（doc/130）：删除零 import、零引用的
  `src/components/video-title-span.tsx`。

---

## v1.20.1

**发布日期**：2026-07-22

### 修复

- **Top250/热播榜单封面图加载失败**（doc/129）：`HitShowMovieItem` 封面 CDN 域名
  替换由硬编码字面量（`tp-iu.cmastd.com`）改为域名无关正则 `_updateImgServer`，
  兼容 API 返回的 CDN 域名轮换，修复 `advanced_search?handleTop=1` 及
  `handlePlayback=1` 榜单封面图无法加载的问题。

## v1.20.0

**发布日期**：2026-07-19

### 新增

- **详情页清单排序与搜索**（doc/128）：清单默认按名称降序排列，可切换名称升序；
  新增即时搜索、清空按钮、已加入/显示数量汇总，并保留用户的搜索和排序状态。

### 优化

- **清单面板结构与视觉**（doc/128）：改为标题、工具栏、条目区和状态区的稳定结构；
  桌面端自适应双列并限制高度，移动端单列自然展开；补齐加载骨架、空数据、失败重试、
  同步中/已满/不可用状态以及键盘焦点、ARIA 播报、44px 触控和减少动态效果支持。
- **完整分页与交互可靠性**（doc/128）：聚合 `/users/simple_lists` 全部分页，使用
  `data-list-id` 将排序后的展示项映射到 JavDB 原生 checkbox；处理 modal 内容替换、
  旧请求覆盖、重复点击、超时和部分分页，避免顺序变化造成误操作。
- **新建清单确认链**（doc/128）：仅在完整基线就绪后允许新建；对新增 ID、规范化名称、
  当前影片勾选状态做服务端权威复核，候选不唯一或网络结果未知时不写本地状态。

---

## v1.19.9

**发布日期**：2026-07-19

### 修复

- **瀑布流点按钮模式只能加载一次**（doc/127）：修复普通分页与 Beyond60 成功后
  loader 仍残留 `waterfall-loading`、导致后续触底检查永久被防重入守卫拦截的问题；
  成功且仍有下一页时现会回到空闲态，下一次触底可重新显示「点击加载下一页」。

---

## v1.19.8

**发布日期**：2026-07-19

### 修复

- **清单服务端/本地关联分叉**（doc/126）：现场确认「迫切想看4」曾为 JavDB
  498 条、本地 501 条，三个本地独有番号来自旧版在 JavDB 请求成功前即写 IDB。
  现在接管原生 checkbox 请求，仅在 `success=true` 且 `/users/simple_lists`
  权威状态复核后提交本地；业务失败回滚 UI，网络结果不确定则保留持久化日志并在
  下次打开页面恢复。
- **清单并发和对账安全**（doc/126）：同一影片/清单使用同页队列 + Web Locks
  跨标签页串行；VLT 四个逻辑对象改为单 IndexedDB 事务；发现数量或当前影片归属
  不一致时，连续抓取两份完整分页快照并通过 revision/epoch/fingerprint guard
  原子校准，任何缺页、重复、验证页或抓取期变化均零写入。
- **其他清单一致性路径**（doc/126）：评分后移出「等待更新」不再允许仅删除本地；
  删除清单改为 JavDB 成功后再删 IDB；平铺面板 checkbox 改按 `data-list-id`
  映射，避免清单顺序变化时操作错项。

---

## v1.19.7

**发布日期**：2026-07-19

### 修复

- **清单 count 漂移致误报 501 上限**（doc/125）：`VltDb.sync` 上限检查改用
  `movie_inventory` 实际关联数而非 `inventory.count` 缓存字段。根因是 count
  字段被存为字符串（如导入数据）后 `count + 1` 字符串拼接到 "4981" 触发
  `>= 501` 误报；并发/外部操作也可能致漂移。每次 sync 对账后 count 收敛。

### 功能

- **加入他清单时自动取消等待更新**（doc/125）：详情页勾选「非等待更新」清单时，
  若视频仍在名称含「等待更新」的清单中则自动取消勾选（复用 doc/124 的 uncheck
  函数）。与 doc/53/124 形成闭环。

---

## v1.19.6

**发布日期**：2026-07-18

### 功能

- **评分后移出「等待更新」**（doc/124）：详情页 0–5 星/已读成功后，若当前
  视频在名称含「等待更新」的清单中则自动取消勾选移出（复用 Stimulus + VltDb
  链路）；不在清单则 noop。与 doc/53 添加自动收藏形成闭环。

---

## v1.19.5

**发布日期**：2026-07-18

### 修复

- **导航栏粘贴自动搜索**（doc/123）：恢复 `#search-keyword` 粘贴文本后自动
  跳转检索。根因是 doc/76 升级 3.3.6.027 时 `navBarNoPaste` 默认 true 整段
  关掉 paste；原版本已跳过图片剪贴板，默认改回 false。

---

## v1.19.4

**发布日期**：2026-07-16

### 优化

- **访问记录悬浮分级**（doc/122）：按秒/分/时/天/更久五档配色（近=安全绿 →
  远=危险红）；无访问记录时显示白框「无访问记录」，避免误以为未生效。

---

## v1.19.3

**发布日期**：2026-07-16

### 变更

- **瀑布流不改地址栏**（doc/121）：列表/清单瀑布流加载与滚动时不再
  `pushState`/`replaceState`，地址栏保持进入页面时的原始 URL。

---

## v1.19.2

**发布日期**：2026-07-16

### 优化

- **触底加载控件**（doc/120）：快捷设置里原生下拉改为分段按钮「自动 / 点按钮」，
  与开关同一行、点击即切换，视觉与操作更顺手。

---

## v1.19.1

**发布日期**：2026-07-16

### 优化

- **快捷设置 UI**（doc/119）：悬浮面板改为分组卡片布局（列表显示 / 浏览行为 /
  功能 / 页面布局），固定宽度右对齐定位（去掉 `-300%` 占位），鼠标移入间隙不再
  闪关（延迟关闭 + 热区桥接），表单事件命名空间防重复绑定。

---

## v1.19.0

**发布日期**：2026-07-16

### 变更

- **瀑布流常开 + 触底加载方式**（doc/118）：快捷设置去掉「瀑布流模式」总开关，
  列表瀑布流默认开启。新增「触底加载方式」：`自动加载下一页` / `点按钮加载下一页`
  （滑到底显示「点击加载下一页」）。「加载全部」在有下一页时始终显示。

---

## v1.18.1

**发布日期**：2026-07-16

### 新增

- **预加载并发数**（doc/117）：设置「预加载配置」增加 `preloadConcurrency`
  （1–10，默认 1 串行）。`AsyncTaskQueue` 支持可配置并发；列表预加载可同时
  发起多路 missav 请求以加速，过高可能触发 Cloudflare，建议 1–3。

---

## v1.18.0

**发布日期**：2026-07-16

### 新增

- **全量长期缓存随 WebDav / 本地备份**（doc/116）：手动备份、自动备份、JSON
  导出统一附带 `__localStorage`（预加载/翻译/演员/评分/截图/访问记录/列表评分
  缓存 + 站点启用等偏好）与 `__gmStorage`（清单阅读进度/评分/瀑布流开关等）。
  导入时 `applyBackupExtras` 写回后剥离，避免写入 IndexedDB。IndexedDB 主数据
  原样全量导出不变。缓存管理面板补充 DMM 伴生/截图/列表评分缓存项。

---

## v1.17.3

**发布日期**：2026-07-16

### 新增

- **访问记录随 WebDav / JSON 备份**（doc/115）：`buildBackupPayload` 增加
  `__localStorage.jhs_visit_history`；手动备份、自动备份、本地导出均包含访问
  记录；导入时写回 localStorage（覆盖）并从 payload 剥离，避免误写入
  IndexedDB。旧备份无该字段时导入不改动本地访问记录。

---

## v1.17.2

**发布日期**：2026-07-16

### 修复

- **访问记录仍需刷新才更新打开时间**（doc/114）：根因是注入时 `history`/`ts`
  闭包固化，且当时未访问的链接不绑监听。改为全部元数据链接绑 hover；
  **每次悬浮与定时 tick 都重读 localStorage** 取最新 ts；500ms 刷新文案；
  `pageshow` 处理 bfcache。新开标签访问后切回详情页无需 F5 即可看到
  「X秒前打开过」并持续跳动。

---

## v1.17.1

**发布日期**：2026-07-16

### 修复

- **访问记录悬浮时间实时跳动**（doc/113）：原先复用全局 tooltip，文案在 hover
  时固化，需刷新页面才更新。改为自定义 `.jhs-visit-tooltip`：mouseenter 启动
  1s 定时器重算「X秒/分钟前打开过」，mouseleave/scroll/resize 隐藏。访问记录
  仍为 localStorage 本地（不随 WebDav 备份，备份仅序列化 IndexedDB）。

---

## v1.17.0

**发布日期**：2026-07-16

### 新增

- **访问记录插件**（doc/112）：新增 `VisitHistoryPlugin`，记录所有打开过的 javdb
  页面（localStorage `jhs_visit_history`，path→时间戳，5000 条 LRU 淘汰）。在影片
  详情页元数据面板的可跳转链接（番號/導演/片商/系列/類別/演員，选择器
  `.movie-panel-info .panel-block .value a[href]`）上悬浮显示「最近打开时间」——
  复用项目全局 tooltip（设 `data-tip-top`，捕获阶段刷新使停留较久仍实时），格式：
  <1 分「X秒前打开过」、<1 时「X分钟前打开过」、<1 天「X小时前打开过」、
  <1 周「X天前打开过」、更久「YYYY-MM-DD 打开过」。路径经 `new URL` 同源归一化
  匹配。`jhs_visit_history` 加入「缓存管理」面板可清理。live 真机验证选择器命中
  14 条元数据链接、归一化与时间格式均符合规格。

---

## v1.16.1

**发布日期**：2026-07-16

### 优化

- **预加载面板加强 + 缓存去重**（doc/111）：(1) 预加载面板移除重复的「清理预加载
  缓存」按钮——它与「缓存管理」面板的「第三方站点缓存」（`jhs_other_site`）是同一
  缓存。改为只读缓存状态（总数 + MissAv/SupJav 分站计数 + 占用，切换面板刷新），
  清理唯一入口回归缓存管理面板。(2) 新增「预加载缓存有效期」`preloadCacheTTL`
  （天数，0=永不过期）：缓存条目写入附 `ts`，读取统一经 `isCacheEntryValid` 判定
  过期（5 处读/写：handleSite 读/写、preloadListPage 跳过、preloadSite 写、
  syncAllBadges），过期条目触发重新预加载。(3) 细化各配置项 help 文案。

---

## v1.16.0

**发布日期**：2026-07-16

### 新增

- **预加载配置面板**（doc/110）：设置菜单新增「⚡ 预加载配置」侧栏 + `preload-panel`
  面板，全项拆解视频流外部网站预加载的可调行为：`enablePreload`（列表页预加载总闸）、
  `enablePreloadStatus`（状态徽标与筛选栏显隐）、`preloadDebounce`（防抖延迟 ms）、
  MissAv/SupJav 站点启用 checkbox（写 jhs_enabled_sites）、「清理预加载缓存」动作按钮。
  OtherSitePlugin `handle` 增 `enablePreload` 闸 + 读取 `preloadStatusEnabled`/
  `preloadDebounceMs`，徽标与筛选栏方法以该开关早 return 守卫，`startPreloadObserver`
  用配置防抖值替代硬编码 300。总开关 `enableLoadOtherSite` 仍留快捷设置面板
  （避免同 id 冲突）。镜像 domain/base/vlt/missav 既有面板模式。

---

## v1.15.1

**发布日期**：2026-07-16

### 修复

- **仅匹配失败显示徽标、其他状态空白**（doc/109）：已缓存项（missav 曾命中、
  `jhs_other_site` 有 `carNum_missAv` 键）原 `syncAllBadges` 不建徽标，致列表页
  仅未命中的「匹配失败」项有徽标、已缓存项全空白。改为已缓存项补「成功匹配」
  徽标（无徽标或陈旧「排队中」才写，已是成功则跳过）；`handle()` 列表页分支在
  `preloadListPage` 前同步调 `syncAllBadges` 使首屏即时可见；筛选栏去「已缓存」
  芯片（已缓存即成功，语义合并）留 4 档（排队中/请求中/成功匹配/匹配失败）。

---

## v1.15.0

**发布日期**：2026-07-16

### 新增

- **预加载状态深度融合：实时跟踪 + 筛选栏 + 样式优化**（doc/108）：针对
  doc/107 反馈深度重构。(1) syncAllBadges 让流式加载（AutoPage append）的
  新 item 一出现即显示「排队中」徽标，消除 500ms 防抖延迟（startPreloadObserver
  改为立即 sync+ensure+refresh 再 300ms 防抖 preloadListPage）。(2) 新增预加载
  筛选栏，镜像 StatusTagFilterPlugin 挂载链，挂于 `.status-tag-filter-bar` 旁，
  5 档芯片（排队中/请求中/成功匹配/匹配失败/已缓存）实时计数 + 点击过滤，
  专用 `data-preload-hidden` 属性 + 协同安全（跳过 data-hide/data-status-tag-hidden
  等其他筛选插件隐藏项）。(3) 样式深度优化：徽标 ✓/✕/脉冲点状态图标 + 配色，
  芯片药丸 + 状态色圆点 + active，与 .status-tag-filter-chip 视觉统一。状态以
  DOM 徽标为唯一真相，PageSort 移动节点保留徽标，observer 安全已前置调研确认。

---

## v1.14.0

**发布日期**：2026-07-16

### 新增

- **列表页预加载实时状态徽标**（doc/107）：OtherSitePlugin 列表页预加载
  missav 缓存时，于每个 `.item` 的 `.video-title` 下方注入状态条 + 每站点
  徽标，四档状态（排队中/请求中/成功匹配/匹配失败）实时反映预加载进度。
  新增 `PreloadStatusBar`/`PreloadStatusBadge` 组件 +
  `preload-status-badge.css`；`updatePreloadStatus` 幂等方法 find-or-create
  后 jQuery 改 class/text 不重建 DOM；前置调研确认对所有 MutationObserver
  安全（`.movie-list` 三 observer subtree:false 不响应 item 内部变化；
  body subtree observer 按谓词过滤，类名前缀避开 `tag`/`status-tag` 等谓词）。

---

## v1.13.7

**发布日期**：2026-07-16

### 修复

- **SupJav 跳转地址未遵守外部网站设置**（doc/106）：详情页 SupJav 按钮跳转
  地址始终硬编码 `https://supjav.com`，未读取设置项 `supJavUrl`。根因是
  doc/52 给 supJavBtn 加的 `initUrl` 写死了域名，而 `handleSite` 检测到
  `initUrl` 设 href 后 `else` 分支因 href 已存在直接 return，致
  `getSupJavUrl()` 永不调用。`initUrl` 改为 async 读取 `getSupJavUrl()`，
  类型放宽为 `Promise<string> | string`，调用处加 `await`。

---

## v1.13.6

**发布日期**：2026-07-14

### 修复

- **恢复演员页 /actors/* 排序组件**（doc/105）：doc/92/93 因 .toolbar 显示
  混乱把演员页整个按钮组禁用（createMenuBtn/bindEvent 早 return），过度删除。
  移除早 return 恢复注入，按钮组挂 `.main-tabs/.tabs`（不挂 .toolbar）避免
  混乱，PageSort 排序选择器注入 `.toolbar` 不冲突。

---

## v1.13.5

**发布日期**：2026-07-14

### 修复

- **PageSort 排序选择器在 autoPage=YES 时仍不注入**（doc/104）：doc/103 只
  恢复了 #sort-toggle-btn（jhs 排序按钮），但 PageSort 排序选择器（按钮组）
  仍 `autoPage===YES → return` 不注入。重新审查 sortGuard MutationObserver
  发现冲突不严重：仅 `activeSort≠null`（用户已选排序方式）时才触发重排，
  有 `MAX_GUARD_RETRIES=5` 上限防死循环。移除 handle 的 autoPage 检查 +
  /lists/ 条件，所有列表页注入 PageSort。删 unused currentHref/YES import。

---

## v1.13.4

**发布日期**：2026-07-14

### 修复

- **普通列表页排序组件丢失**（doc/103）：git 确认非 doc/92/93 导致（只删演员页
  actorsPage prop + filterAllVideo，未动 sort-toggle-btn）。真正原因是 autoPage=YES
  时排序与瀑布流互斥——#sort-toggle-btn 被隐藏 + sortItems 跳过。移除 autoPage
  对 #sort-toggle-btn 的隐藏逻辑：排序按钮始终显示，autoPage=NO 自动排序，
  autoPage=YES 保持原始顺序但用户可手动点击排序。sortItems 移除 autoPage 判断。
  PageSort 保持 autoPage=YES 不注入（sortGuard MutationObserver 与瀑布流 append
  冲突），/lists/* 仍注入（doc/102 条件保留）。

---

## v1.13.3

**发布日期**：2026-07-14

### 修复

- **视频清单详情页排序按钮组不注入**（doc/102）：`PageSortPlugin.waitForContainer`
  照搬原脚本 `archetype/pageSort.user.js` 的 MutationObserver 等待模式——
  原 `@run-at document-end` 时 `body > section > div` 尚未出现，observer 会在
  section 渲染时触发；但本项目 `@run-at document-idle` 时 section **已经存在**，
  MutationObserver 不会在 `observe()` 时立即触发回调，只在**后续 mutation** 时
  触发。视频清单详情页 `/lists/{id}` 是静态页（视频数有限、通常单页无瀑布流
  append），`document.body` 子树长期无 mutation → observer **永不触发** →
  `createSortSelector` **永不调用** → 排序按钮组（按照名称/评分升降序）不注入。
  实测在 `/lists/Azm8DM` 安装模拟 observer 5 秒触发次数 = 0，证实根因。
  修复：`waitForContainer` 改为「先同步尝试 `createSortSelector()`，成功直接
  return，失败才挂 observer 等待异步渲染」（与 `StatusTagFilterPlugin.init`
  一致）；`createSortSelector` 返回值 `void→boolean`，三处 early return 返回
  `false`，末尾返回 `true`。同步路径成功后不挂 observer，不会重复调用；
  observer 路径成功即 disconnect，亦不会重复调用，无需额外防重入守卫。

---

## v1.13.3

**发布日期**：2026-07-14

### 修复

- **/lists/* 清单页排序组件丢失**（doc/102）：autoPage=YES 时无条件禁用排序
  （#sort-toggle-btn 隐藏 + PageSort 不注入），但 /lists/* 清单详情页不支持
  瀑布流分页（无 .pagination-next，AutoPagePlugin 显示"已经到底了"），
  排序互斥不合理。三处加 `!currentHref.includes('/lists/')` 条件
  （page-sort handle / list-page-button handle / setting-plugin autoPage
  change），使 /lists/ 页面 autoPage=YES 仍显示排序组件。

---

## v1.13.2

**发布日期**：2026-07-14

### 修复

- **重复检测误判 + 加载全部状态不一致**（doc/101）：`checkDuplicateCarNumbers`
  原逻辑"连续≥2个重复"在加载全部累积大量页后易误判（existingList 为 DOM 全部
  已加载番号，个别碰巧连续重复即触发）。改为重复比例≥50%才判定页码受限
  （JavDB 返回重复内容时大部分会重复）。`loadAllPages` 循环退出后无脑显示
  "✓已全部加载"未感知 loadNextPage 的 waterfall-error 状态——改为检查 loader
  className+textContent 区分"已停止页码受限"/"加载失败点击重试"/"全部加载完"
  三种结果，按钮与 loader 状态一致。

---

## v1.13.1

**发布日期**：2026-07-14

### 优化

- **「加载全部」按钮实时显示/隐藏**（doc/100）：doc/99 的按钮只在页面加载时
  创建，切换瀑布流模式需刷新才生效。新增 `showLoadAllBtn()` / `hideLoadAllBtn()`
  方法，setting-plugin 的 autoPage change 通过 `getBean('AutoPagePlugin')`
  实时调用，开启即时出现、关闭即时消失，不需刷新。`showLoadAllBtn` 幂等
  （已存在/无下一页/容器未初始化跳过），正在 loadAllPages 时 `hideLoadAllBtn`
  安全移除（循环自然退出）。

---

## v1.13.0

**发布日期**：2026-07-13

### 新增

- **瀑布流「加载全部」按钮**（doc/99）：autoPage=YES 且有下一页时，页面
  右下角出现蓝色浮动按钮，点击后循环 loadNextPage 自动加载所有后续页，
  无需逐页滚动。加载中显示「加载中...（第 N 页）」+ 禁用态；完成显示
  「✓ 已全部加载」后淡出移除；失败显示「加载失败，点击重试」。通过
  pageItems.length 变化检测无进展防死循环，isLoadingAll 防重入。

### 清理

- **清理 shouldDisablePaging 遗留调用**：删除 AutoPagePlugin 中
  `await getSetting('autoPage', YES)` 读取但未使用返回值的死代码行。

---

## v1.12.9

**发布日期**：2026-07-13

### 清理

- **彻底删除 4 设置项功能读取逻辑**（doc/98，方案 B）：doc/97 保留了各插件
  getSetting 读取（方案 A，可恢复/可查询），用户确认改为彻底删除，功能固定按
  默认值运行，不给老用户兜底。逐项删除：① list-page-plugin hoverBigImg 读取 +
  ImagePreview 创建/bindEvents + ImagePreview import + 注释；② screenshot-plugin
  enableLoadScreenShot 判断行；③ preview-video-plugin enableLoadPreviewVideo
  两处条件（L459 简化为仅 autoPlay 判断、L547 删除 === NO return）；
  ④ setting-plugin applyImageMode 竖图分支 + verticalImgCssRaw import +
  孤儿 CSS 文件 setting-image-mode-vertical.css。产物 -7.26 kB，5 关键词 0 残留。

---

## v1.12.8

**发布日期**：2026-07-13

### 优化

- **整理优化快捷设置菜单**（doc/97）：精简 SimpleSettingPanel，删除 4 个不常用
  设置项的 UI + 绑定（保留功能读取按默认值运行）：① hoverBigImg 启用悬浮大图
  （含 ImagePreview 创建/销毁绑定，删除 unused import）；② enableLoadScreenShot
  加载长缩略图（含 .screen-container 移除）；③ enableLoadPreviewVideo 更高画质
  预览视频；④ enableVerticalModel 竖图模式（含 applyImageMode 调用，方法保留）。
  调整 2 个默认值：containerColumns 默认 5→4、containerWidth 默认 100%→70%
  （各修改 3 处）。功能初始化在各插件 getSetting 中保留，底层 setting 键保留
  可查可恢复。产物 -4.07 kB，UI/绑定 0 残留。

---

## v1.12.7

**发布日期**：2026-07-13

### 清理

- **清理 115 视频匹配相关残留死代码**（doc/96）：115 网盘三件套插件
  （WangPan115TaskPlugin / WangPan115MatchPlugin / WangPan115Plugin）在 doc/03
  已删除，但入口/UI 残留仍散落 src。本次清理 5 处死代码：① simple-setting-panel
  「启用115视频匹配」设置项；② setting-plugin enable115Match 绑定；
  ③ review-link-content 评论区磁链/ed2k 旁的「115离线下载」按钮（保留链接本身）；
  ④ fc2-plugin FC2 弹窗磁链后的「115离线下载」按钮注入块；⑤ help-dialog
  「如何多浏览器同时登录115网盘」帮助段落。保留 storage-manager 的 downPath115
  善后清理逻辑（自动清除老用户 setting 残留配置）。产物 -3.02 kB。

---

## v1.12.6

**发布日期**：2026-07-13

### 优化

- **磁力搜索按钮并入字幕搜索菜单行**（doc/95）：原 `#magnetSearchBtn` 由
  `createMenuBtn` 在 `DetailMenuButtons` 渲染后单独 `.after()` 注入，样式为
  Bulma `button is-small is-warning`，与同行 `menu-btn` 渐变按钮风格割裂。改为
  由 `DetailMenuButtons` 组件右行 `.jhs-menu-tools-row` 内条件渲染（新增
  `showMagnetSearch` prop），放 `#search-subtitle-btn` 之后，采用 `menu-btn` +
  渐变背景 `rgb(245,140,1)→rgb(84,161,29)` 统一风格。删除 `createMenuBtn`
  单独注入逻辑，保留 click 事件绑定。feature flag `magnetHubPlugin` 控制显隐。

---

## v1.12.5

**发布日期**：2026-07-12

### 修复

- **跨标签页收藏/已观看状态标签不同步**（doc/94）：doc/76 为
  `StorageManager.getCarList()` 引入运行时缓存 `cacheCarList`，但
  `clearCarListCache()` 从未调用，导致列表页 `cacheCarList` 在其他标签页
  修改番号记录后仍为旧值。在 `handleSync`（`broadcastWantWatchedSync` 接收端）
  和 BroadcastChannel `refresh` 分支（`refresh()` 接收端）两处，
  于读取数据前调用 `storageManager.clearCarListCache()`，确保从 IndexedDB
  重读最新值后正确刷新 `.status-tag`。

---

## v1.12.4

**发布日期**：2026-07-12

### 移除

- **演员页不再渲染菜单按钮组**（doc/93）：补完 doc/92 未落地的代码改动。
  `ListPageButtonPlugin` 的 `createMenuBtn`/`bindEvent` 在 `/actors/` 页直接
  返回，`MenuButtonBoxHtml` 不再注入 `.toolbar`，彻底消除
  `div.toolbar > div:nth-child(3/4)` 两个脚本节点（打开待鉴定/已收藏/加入黑名单/
  一键屏蔽/新作品检测/演员黑名单/排序切换）。同步删除已失效的 `actorsPage`
  渲染分支、`#filterAllVideo` 绑定、`loadObj` 属性；`fold-category` 的
  `loopDetector` 加演员页前置命中，避免 `#waitCheckBtn` 缺失致 10s 空轮。

---

## v1.12.3

**发布日期**：2026-07-12

### 移除

- **清理 .toolbar 脚本控件**（doc/92）：不再注入 PageSort 排序条；演员页菜单按钮
  不再挂到 `.toolbar`（改 section-addition / section-title），消除
  `div.toolbar > div:nth-child(3/4)` 脚本生成节点。

---

## v1.12.2

**发布日期**：2026-07-12

### 修复

- **关键词标签删除钮乱码**（doc/91）：`keyword-label.tsx` 经 PowerShell 写回时 UTF-8
  损坏，`×` 变成 `脳`；重写为 `\u00d7` 正确输出。

---

## v1.12.1

**发布日期**：2026-07-12

### 修复

- **恢复视频标题屏蔽词**（doc/90）：doc/89 误删标题关键词配置与列表过滤；现仅保留
  设置「屏蔽配置」中的标题屏蔽词管理 + 列表关键词过滤。划词、评论区屏蔽词、
  封面右键屏蔽仍不恢复。

---

## v1.12.0

**发布日期**：2026-07-12

### 移除

- **屏蔽配置与划词/封面右键屏蔽**（doc/89）：删除设置「屏蔽配置」面板（划词开关、
  评论/标题屏蔽词）；删除列表封面右键屏蔽、标题关键词过滤、评论区关键词过滤与
  划词加入；删除 `FilterTitleKeywordPlugin`。详情页屏蔽按钮与演员黑名单保留。

---

## v1.11.0

**发布日期**：2026-07-12

### 移除

- **设置快捷键配置及业务快捷键**（doc/88）：删除设置侧栏「快捷键配置」面板；
  移除列表页/详情页/预览视频/折叠分类相关快捷键注册与按钮上的快捷键提示；
  删除 `src/core/hotkey.ts` 与 main 中 Hotkey 监听。方向键翻页插件保留。

---

## v1.10.8

**发布日期**：2026-07-12

### 修复

- **ESC 一次关掉所有弹层**（doc/87 最终修复，前六次未成功的真根因）：
  - 诊断版（1.10.7）在 handler 内嵌 console.log 实测，输出显示 ESC 只触发
    了 TOP frame handler 一次（eventTarget=BODY），关掉了外层 type=iframe
    弹层→iframe 销毁→iframe 内磁力搜索二级弹层跟着消失。
  - 真根因：ESC 不在 iframe 内触发（焦点在 body），事件不传递到 iframe
    document，外层 handler 找不到 iframe 内弹层，直接关外层 iframe 弹层。
  - 修复：外层 handler 检测顶层是 type=iframe 弹层时，检查 iframe
    contentDocument 内有无可见 .layui-layer；有则释放 gate 并向
    iframe contentDocument dispatchEvent ESC keydown（composed:true），
    让 iframe 内 handler getTopLayerEl 找到并关闭内层弹层；无则正常关
    外层弹层。ESC 逐级关闭成立。

---

## v1.10.6

**发布日期**：2026-07-11

### 修复

- **ESC 一次关掉所有弹层**（doc/87 最终修复，doc/85/86 及 doc/87 初版三次
  未成功的真根因）：
  - doc/87 初版（1.10.5）把 `escLayerGate` 从模块级 `const` 改为
    `unsafeWindow.__jhsEscGate`——思路对但仍失败：实测诊断
    `gateIsTopGate=false`，证明 Tampermonkey 中每个 frame 的 `unsafeWindow`
    指向**当前 frame 自己的 window**，并非跨 frame 共享的 top，锁仍按
    frame 隔离。
  - 最终改挂 `window.top.__jhsEscGate`：同源前提下 parent 与同源 iframe
    访问同一顶层 window 对象，gate 真正共享；跨域 iframe 访问
    `window.top` 招致 SecurityError，try/catch 回退当前 frame
    `unsafeWindow/window`（本脚本不在跨域 iframe 内运行，无需共享）。
  - 根因本质：layer.open type=2 同源 iframe 弹层 + iframe 内 javdb 子
    页脚本同时绑了父子两份 keydown 捕获 handler，模块级/unsafeWindow
    gate 每 frame 一份不互斥，一次物理 ESC 两个 handler 都 tryEnter 成功
    → 一次关多层。`window.top` 共享后任一 handler 先 tryEnter 锁住，另
    一失败 return；iframe 无自身弹层则 release，父 handler 接力关父 弹层。一次物理按键严格只关一层，逐级关闭成立。

---

## v1.10.5

**发布日期**：2026-07-11

### 修复

- **ESC 一次关掉所有弹层**（doc/87，doc/85/86 两次未成功的真根因）：
  `escLayerGate` 从模块级 `const`（每个 frame 各执一份独立实例）改为
  `unsafeWindow.__jhsEscGate` 跨所有 frame 共享单例。根因是 layer.open
  type=2 iframe 弹层 + iframe 内同源 javdb 子页脚本同时绑了父子两份
  keydown 捕获 handler，两把锁不互斥，一次物理 ESC 触发两个 handler
  各关一层。共享后任一 handler `tryEnter` 成功即锁住，另一失败 return；
  iframe 内无自身弹层则 `release()`，父 handler 接力关父弹层。一次物理
  按键严格只关一层，逐级关闭成立。

---

## v1.10.4

**发布日期**：2026-07-11

### 修复

- **ESC 仍一次关全部**（doc/86）：模块级 `escLayerGate`（按下锁定、抬起解锁）；
  关闭前立即 `display:none` 摘掉顶层（规避 layer 200ms 关闭动画期 DOM 仍在）；
  一次物理按键只关最顶一层。

---

## v1.10.3

**发布日期**：2026-07-11

### 修复

- **ESC 一次关闭全部弹层**（doc/85）：改为按 DOM z-index 只关最顶层；忽略
  `event.repeat`；`_escClosing` 同按键周期锁 + keyup 解锁；document 仅捕获
  阶段单路径监听，避免连发/双绑定导致逐级失效。

---

## v1.10.2

**发布日期**：2026-07-11

### 修复

- **弹窗缺少关闭按钮 / ESC 误关多层**（doc/84）：lightningcss 解析 layer.css
  IE hack 时丢掉 `.layui-layer-setwin` 的 `position/right`，右上角 × 不可见；
  新增 layer-fix.css 覆盖；默认 `closeBtn:1`、type1/2 默认可点遮罩关闭；
  `layer.close` 同步 ESC 栈，ESC 只关最上层。

---

## v1.10.1

**发布日期**：2026-07-11

### 修复

- **设置面板开关按钮显示异常**（doc/83）：doc/70 美化引入的 `.form-content *`
 （`box-sizing:border-box` + padding）与 `.content-panel input[type=checkbox]`
  （16×16）压过 `.mini-switch`，开关全部变形；排除冲突并强化开关选择器。

---

## v1.10.0

**发布日期**：2026-07-11

### 移除

- **删除封面工具栏全套**（doc/82）：移除 CoverButtonPlugin 本体、设置「基础配置」
  中五个「封面工具栏 - *」开关（loadForm/saveForm）、featureFlags.coverButtonPlugin、
  ListPagePlugin 触发、BasePlugin 升级 SVG 字段、`upgrade-icons.ts`、以及
  `.tool-box .jhs-icon` 专用样式。列表页封面不再注入悬浮快捷按钮。

---

## v1.9.4

**发布日期**：2026-07-11

### 变更

- **撤销 CoverButton 可见性加固**（doc/81）：恢复由设置「封面工具栏」五开关
  控制显隐的简洁实现；去掉 `.jhs-cover-toolbar` 独立行、console 诊断、延迟补注、
  checkDom 额外注入、设置 end 回调等 1.9.2/1.9.3 改动。doc/80 仅作历史排查记录。

---

## v1.9.3

**发布日期**：2026-07-11

### 修复

- **CoverButton series 页仍不可见**（doc/80）：注入日志改 `console.log`（原先
  `clog.debug` 默认过滤看不到）；工具栏改挂 `.meta` 后独立行
  `.jhs-cover-toolbar`；800ms/2s 延迟补注适配异步列表
  （**已于 1.9.4 撤销**）

---

## v1.9.2

**发布日期**：2026-07-11

### 修复

- **CoverButton 列表工具栏不可见**（doc/80）：无 `.tags` 时自动创建容器；
  强化图标尺寸/不透明度 CSS；`enableSvgBtn` 仅对显式关闭隐藏；瀑布流
  `checkDom` 补注入；阻止点击穿透卡片链接；设置关闭后热更新显隐
  （**已于 1.9.4 撤销**）

---

## v1.9.1

**发布日期**：2026-07-11

### 修复

- **123Av-Fc2 导航出现两次**（doc/79）：根因是 `$('.navbar-start').append`
  同时命中主导航与 `#search-box` 内的 `.navbar-start`；改为在主栏 FC2 项后
  单点 `after` 插入，tabs 区单独补链并去重
- **识图按钮不显示**（doc/79）：误用 `#jhs-search-box`；在 `NavSearchBox`
  内置 `#search-img-btn`，并绑定 `ImageRecognitionPlugin`；原生 `.search-image`
  同步 rebind

---

## v1.9.0（对照 3.3.6.027 可插拔升级）

**发布日期**：2026-07-11

### 新增

- **featureFlags 可插拔升级开关中心**（doc/76）：`src/core/feature-flags.ts`，
  默认全开，可用 `localStorage['jhs_upgrade_flags']` 单项回退
- **TranslatePlugin**：详情页标题 Google 翻译 + 缓存
- **ScreenShotPlugin**：javstore.net 长缩略图截图墙
- **CoverButtonPlugin**：列表封面悬浮工具栏（截图/预览/鉴定/第三方/复制）
- **MagnetHubPlugin**：U9A9 / U3C3 / Sukebei 多引擎磁链聚合
- **ImageRecognitionPlugin**：以图识图（Google / Lens / Yandex + Imgur 中转）
- **Fc2By123AvPlugin**：123Av FC2 浏览/搜索/详情弹窗

### 优化

- 签名缓存 20s→300s（单 key `jhs_jdsignature`）+ `removeSignature`
- 番号大小写不敏感匹配
- 瀑布流 `replaceState` 不污染历史栈
- 想看/已观看批量导入（Set 查重 + saveCarList + 200ms 间隔）
- 已鉴定内容 hide / visibility 双模式
- StorageManager 读路径深拷贝防污染
- WebDav 目录幂等创建
- 西方番号 `carNum.YY.MM.DD` 格式化
- 演员名 `user-select:all` 一键复制
- 导航栏移除粘贴自动搜索
- `javDbApi` 聚合层 + `markDataListHtml`

### 版本

- `1.8.5` → `1.9.0`（minor：新插件 + 基础设施）

---

## v1.8.5（法律条款更新）

**发布日期**：2026-07-11

### 文档/元数据

- **补全 MIT 协议合规声明**（doc/75）：新建 `LICENSE` 文件（MIT 全文+版权声明
  `2024-2026 zerobiubiu`+衍生关系说明+13 集成脚本清单）；README License 节重写
  为 License & Attribution（基于 JAV-JHS 3.3.6 MIT 二次开发，后续版本转私密
  付费，MIT 永久授权）；vite.config.ts 增加 `@copyright` 元数据；
  package.json 增加 `"license": "MIT"` 字段。纯元数据/文档变更，不递增版本号

---

## v1.8.5

**发布日期**：2026-07-11

### 修复

- **修复列表页封面图未加载时点击走原生跳转**（doc/74）：
  `ListPagePlugin.bindClick()` 的 click 事件委托选择器从 `.item img` 改为
  `.item .cover`，contextmenu 从 `.item img, .item video` 改为
  `.item .cover, .item video`。根因：JavDB 封面图使用 `loading="lazy"`
  原生懒加载，图片未加载时 `<img>` 无尺寸，用户实际点中 `.cover` div 而非
  `<img>`，导致 `.item img` 选择器不匹配、走 JavDB 原生 `<a>` 跳转。
  `.cover` 有 CSS `min-height`/`padding-top` 撑开面积，始终可点击。

---

## v1.8.4

**发布日期**：2026-07-08

### 新增

- **快捷评分面板新增拉黑按钮**（doc/73）：
  在详情页快捷评分条新增「🚫 拉黑」按钮，替代被隐藏的 #filterBtn。点击后弹
  确认框警告严重性，确认后写 FILTER_ACTION + 广播 filter+add + 调
  _triggerJavdbReview(0) 设为已读0星（用 _wantWatchedSyncing 阻断
  MutationObserver 防止 onWatchedAdded 覆盖 FILTER_ACTION 状态）+ 关闭页面。
  _syncRatingBar 新增异步查 JHS 记录高亮 filter 状态（红色 #de3333）。

---

## v1.8.3

**发布日期**：2026-07-08

### 修复

- **修正隐藏目标 + 隐藏菜单按钮组状态行**（doc/72）：
  doc/71 误判了用户选择器对应的元素。通过 MCP 访问 javdb 详情页确认，
  该选择器对应的是脚本创建的 DetailMenuButtons 左行（屏蔽/收藏/已观看），
  非原生评价面板（原生已被 rating-bar.css 原有规则隐藏）。撤回 doc/71 多余
  CSS，给 DetailMenuButtons 左行加 className jhs-menu-status-row，
  在 rating-bar.css 中 display none 隐藏左行，保留右行（磁力/字幕按钮）。
  DOM 保留，快捷键事件绑定和 showStatus 文案更新正常运行。

---

## v1.8.2

**发布日期**：2026-07-08

### 优化

- **隐藏详情页原生评价操作面板**（doc/71）：
  快捷评分模块已完全覆盖原生评价功能（想看/看過/星级），原生面板造成 UI 冗余。
  在 `rating-bar.css` 新增 CSS 规则：隐藏原生星级 radio + 评价表单（`.rating-star` /
  `form` / `.field`），以及隐藏用户指定选择器对应的操作面板（`div:nth-child(1)`，
  nav 的兄弟元素）。使用 `display:none` 保留 DOM，不影响 `_syncRatingBar` 状态
  读取、`hookWantAndWatchedButtons` MutationObserver 监听、`_getReviewId` 提取
  reviewId。快捷评分条在 nav 内不受影响。

---

## v1.8.1

**发布日期**：2026-07-08

### 优化

- **设置面板 UI 美化**（doc/70）：
  重写 `setting-plugin.css`，统一以 `#5d87c2` 为主色贯穿侧栏/按钮/表单/复选框。
  侧栏改柔和灰底 + active 主色高亮；`menu-btn` 统一圆角 + hover 上浮阴影；
  表单输入框左对齐 + focus 主色光晕；复选框 accent-color；设置项 hover 背景；
  底部按钮区 flex 布局 + gap 间距。数据备份面板按钮加 emoji，自动备份区域
  hr 改主色分区标题。

---

## v1.8.0

**发布日期**：2026-07-08

### 新增

- **自动备份功能**（doc/69）：
  默认每天第一次打开时自动备份到 WebDav，无需手动点击。新增核心模块
  `src/core/auto-backup.ts`，负责本机凭证 ID 管理、触发判断、增量滚动文件名。
  设置「数据备份」面板新增「启用自动备份」「备份频率」「本机凭证」三个配置项。
  备份格式注入 `__meta`（credentialId + autoBackupConfig + backupTime）。
  凭证 ID 用 UUID v4 生成，存 GM 存储（不进入备份系统），每台电脑的每个浏览器
  唯一。一个浏览器只保留一份 `auto_<credentialId>.json`，每次自动备份增量覆盖。
  自动备份策略随备份文件保存。支持三种频率：每天第一次打开（默认）/ 每次打开 /
  不自动备份。

---

## v1.7.7

**发布日期**：2026-07-08

### 修复

- **0 星（已读未评分）显示 ★0 而非占位「已看」**（doc/68）：
  doc/67 的评分缓存同步优化有两处将 0 星排除：`_invalidateCards` 写入条件
  `score && score >= 1`（0 是 falsy 短路为 false）+ `showRating` 渲染分支
  `rating && rating >= 1`（同样排除 0），导致详情页点「已读」后列表页仍显示
  占位「已看」。修正写入条件为 `typeof score === 'number'`（0-5 均写入），
  `showRating` 增加 `rating === 0` 分支显示金色「★0」。

---

## v1.7.6

**发布日期**：2026-07-08

### 优化

- **评分缓存同步优化：详情页标记已读时直接写入评分缓存**（doc/67）：
  详情页点击「已读」或星级按钮时 `quickSetHasWatch(score)` 已知评分，
  但列表页 `RatingDisplayPlugin` 使用独立的 `RatingCache`，两套缓存互不相通，
  导致列表页悬停已看卡片仍需 `GM_xmlhttpRequest` 远程抓取详情页解析评分。
  扩展 `broadcastWantWatchedSync` 广播 payload 携带 `score`，列表页
  `_invalidateCards` 收到 `hasWatch+add+score≥1` 时直接 `RatingCache.set`
  写缓存，`processItem` 命中缓存显示评分，免去远程抓取。`score=0`（已读未评分）、
  想看/收藏/取消等保持原清缓存逻辑不变。

---

## v1.7.5

**发布日期**：2026-07-08

### 修复

- **修复繁→简替换破坏 DOM 选择器导致番号丢失等问题**（doc/66）：
  doc/59（commit `bcf046c`）全局繁→简替换将代码中 jQuery 选择器、
  字符串匹配中的繁体改为简体，但 JavDB DOM/API 返回仍为繁体，
  导致全部失配。还原 8 处功能性 bug：
  - `base-plugin.ts`：`a[title="複製番號"]`（**番号丢失根因**）+
    `無碼` 检测
  - `actress-info-plugin.tsx`：`演員` / `現年齢` 选择器
  - `list-page-plugin.tsx` + `storage-manager.ts`：`（無碼）` 标签
  - `related-plugin.tsx` + `review-plugin.tsx`：`簽名已過期` 错误检测
  - 7 个组件显示文本还原为繁体（磁鏈/演員/番號/清單/預告片/上一頁/看過等）

---

## v1.7.4

**发布日期**：2026-07-08

### 修复

- **修复详情页清单面板「预设清单」过滤失效**（doc/65）：doc/59
  全局繁→简替换将代码中的 `預設清單` 改为 `预设清单`，但 JavDB
  DOM 返回仍为繁体 `預設清單`，`includes('预设清单')` 不匹配导致
  过滤失效、預設清單显示在面板中。改用正则 `/预[设設]清[单單]/`
  同时匹配简繁体。修改 `detail-page-button-plugin.tsx` 的
  `_initListPanel` sync 和 `vlt-sync.ts` 的 `refreshListPanel` 两处。

---

## v1.7.3

**发布日期**：2026-07-08

### 优化

- **删除清单性能优化：乐观 UI + 并行执行**（doc/64）：原方案串行
  等待服务器响应才移除 DOM，用户感知延迟大。改为 confirm 后立即
  移除 DOM（乐观更新），`GM_xmlhttpRequest DELETE` 与
  `VltDb.deleteList` 并行执行（`Promise.all`）。瓶颈分析：网络请求
  等待 JavDB 服务器响应是最大延迟源（数百ms~数秒），IDB 操作
  （83KB / 3563 条关联）仅 ~50ms 非瓶颈。服务器失败时 warning toast
  而非恢复 DOM。

---

## v1.7.2

**发布日期**：2026-07-08

### 修复

- **修复 toast 通知被导航栏遮挡**（doc/63）：`#jdb-toast-container`
  的 `top` 从 `20px` 改为 `72px`（导航栏高 56px + 16px 间距），
  z-index 99999 本身高于导航栏无需调整。

---

## v1.7.1

**发布日期**：2026-07-08

### 修复

- **重写清单删除/改名监听：拦截原生操作 + 自行发请求 + 实时广播**
  （doc/62）：doc/61 的 MutationObserver 方案失效——JavDB 删除 AJAX
  返回的 JS 不移除 `<li>`，需刷新才消失，observer 永远不触发，导致
  IDB 关联未清除、DOM 不实时消失、广播未发送。改为全权接管：
  - **删除**：捕获阶段拦截删除链接 click + preventDefault + 自行 confirm
    + GM_xmlhttpRequest DELETE → 成功后 deleteList + 广播 + 移除 DOM
  - **改名**：拦截保存按钮 click + GM_xmlhttpRequest POST
    /users/update_list → 成功后 renameList + 广播 + 更新 DOM
  - **独立广播通道** `jdb:list-mgmt`（不混用 jdb:last-sync）
  - **详情页**新增广播接收器：删除→移除 checkbox，改名→更新标签文本
  - **列表页**新增广播接收器：删除/改名→refreshAllTags 全量刷新
  - 从 app.js 逆向确认服务端 API（DELETE /users/remove_list +
    POST /users/update_list {id, name}）

---

## v1.7.0

**发布日期**：2026-07-08

### 新增

- **/users/lists 清单删除/改名监听→同步本地 IDB**（doc/61）：用户在
  清单管理页删除或改名清单后，服务端数据已变更但本地 IndexedDB 仍
  保留旧数据，导致列表页标签显示不一致。现以 DOM 变化作为成功信号
  自动同步：
  - **删除**：MutationObserver 检测 `#list-<listId>` `<li>` 从 DOM
    移除 → `VltDb.deleteList()`（删 inventory + 所有 `::listId` 关联）
  - **改名**：捕获阶段 click 快照旧名+listId → 保存时读新名 →
    MutationObserver 等 `.list-name` 文本变化 → `VltDb.renameList()`
  - 三重广播 `designation='*'` 触发列表页 `refreshAllTags` 全量刷新
  - VltDb 新增 `deleteList` / `renameList` 方法
  - 零侵入已定稿插件，不拦截/阻止 JavDB 原生删除/改名请求

---

## v1.6.5

**发布日期**：2026-07-08

### 优化

- **降低新增清单操作延迟**（doc/60）：首次轮询从 2000ms 降到 200ms
  （JavDB 响应实测永远是 `Toastr.success("...")` 不更新 DOM，长时间
  空轮询纯属浪费）。关闭模态框延迟从 400ms 降到 200ms。整体流程从
  ~2.7s 降至 ~0.7s。

---

## v1.6.4

**发布日期**：2026-07-08

### 修复

- **修复新增清单：改用 #save-list-button 切换重载替代 /users/lists 解析**
  （doc/60）：doc/59 的 GET /users/lists 解析方案实测失效——页面通过
  JS（Turbo/Stimulus）动态加载清单数据，原始 HTML 不含清单列表，
  `fetchListIdByName` 永远找不到新清单。改为在创建成功后点击
  `#save-list-button` 两次（关闭→重新打开模态框），触发 JavDB 原生
  Stimulus `list` 控制器重新 ajax 加载清单列表（含新清单 checkbox），
  轮询 5s 检测后完成 IDB 同步。多级兜底链路：轮询 2s → 正则提取 →
  #save-list-button 重载 → /users/lists 解析。

---

## v1.6.3

**发布日期**：2026-07-08

### 修复

- **修复新增清单响应无 list-id**（doc/59）：doc/58 的 GM_xmlhttpRequest
  方案成功发请求、服务端创建清单，但控制台日志显示响应仅为
  `Toastr.success("...")` JS——不含 `data-list-id`、不含 HTML、
  不更新 `listContainer`。doc/58 的「从响应正则提取 data-list-id」兜底
  无法匹配。新增 `fetchListIdByName`：`GET /users/lists` 页面 HTML →
  `DOMParser` 解析 `a[href*="/lists/"]` 链接 → 匹配清单名称 → 提取
  `/lists/{id}` 中的 list-id。`createList` 多级兜底链路：注入 JS 执行
  → 轮询 2s → 正则提取 → **GET /users/lists 匹配** → 手动克隆 checkbox
  构建 → refreshListPanel + handleCheckboxChange。

### 变更

- **全局繁→简字符替换**：用户要求插件 UI 文本统一简体中文，不沿用
  JavDB 网站繁体中文。Python 脚本遍历 `src/` 全部 21 个 `.ts/.tsx`
  文件批量替换繁体字（toast 文案、按钮文本、注释）。

---

## v1.6.2

**发布日期**：2026-07-08

### 修复

- **终极修复新增清单：改用 GM_xmlhttpRequest 直接发 ajax**（doc/58）：
  doc/57 的「observer 挂 modal + 轮询」修复实测无效，根因诊断错误。
  实际根因：JavDB 已从 Rails UJS 迁移到 Turbo，`form#new_list` 的
  `data-remote="true"` 不再被拦截，`submitBtn.click()` 触发**常规表单
  POST**（非 ajax），页面导航、脚本卸载，所有后续效果丢失。
  改为完全绕过原生表单提交，用 `GM_xmlhttpRequest` 直接发 ajax
  POST `/lists/remote_create`：从表单收集字段 + meta csrf-token +
  `X-Requested-With` + `Accept: text/javascript` 模拟 Rails UJS ajax；
  响应 JS 注入 `<script>` 页面上下文执行 + 3s 轮询检测新增 checkbox +
  兜底从响应正则提取 `data-list-id` 克隆已有 checkbox 手动构建；
  完成时 `refreshListPanel` + `handleCheckboxChange(add)` 同步 IDB。

---

## v1.6.1

**发布日期**：2026-07-08

### 修复

- **修复新增清单后无即时反馈、必须刷新页面才能看到**（doc/57）：
  doc/56 的 `MutationObserver` 挂在提交前的 `listContainer` 引用上，
  但 Rails/Stimulus 的 `onCreateSuccess` 响应会整个替换 `listContainer`
  元素，旧引用变孤立节点、observer 永不触发，导致「清单已创建但无任何
  后续效果（无 toast/无 IDB 同步/无自动收藏）、必须刷新页面才能看到」。
  重构 `createListViaNativeForm`：observer 改挂不可替换的
  `#modal-save-list` + 200ms 轮询兜底（共享 `settled` 幂等守护）+
  `detectNew` 每次重新查询最新 `listContainer`；完成时主动
  `refreshListPanel()` 从最新 `listContainer` 克隆到 `.jhs-list-panel`
  （与 `_initListPanel` sync 等价、幂等），即使该插件 observer 失效
  也能立即看到新清单；超时 5s→8s 兼顾慢网络。零侵入
  `DetailPageButtonPlugin`。

---

## v1.6.0

**发布日期**：2026-07-08

### 新增

- **展开清单面板新增「新增清單」入口 + 自动同步关联**（doc/56）：
  原生「存入清單」弹窗被 CSS 永久隐藏，footer 的「創建新清單」按钮
  不可达，展开布局下新增清单功能失效。在 `.jhs-list-panel` 旁插入
  Bulma 风格「➕ 新增清單」UI；提交时驱动原生表单 `#new_list`
  （Rails UJS ajax POST `/lists/remote_create`，服务端创建即自动关联
  视频，与网站原始流程完全等价）。同时由于 Stimulus 切换新 checkbox
  的 `checked` 不派发 `change` 事件，本地 IDB 关联同步原本失效——
  此前用户需手动「取消关联→再关联」才能同步，现通过 MutationObserver
  快照对比识别新增 checkbox 后显式 `handleCheckboxChange(add)`，
  彻底消除该手动步骤。零侵入已定稿插件。

---

## v1.5.2

**发布日期**：2026-07-08

### 修复

- **自动收藏联动星标评分组件**（doc/55）：doc/54 广播后详情页星标评分处
  收藏仍未高亮。根因是 `_syncRatingBar` 从 JavDB 原生 DOM 检测「想看」
  状态而非 JHS IDB。补充 `triggerJavdbWantAndSyncRatingBar`：通过
  `pluginManager.getBean` 获取 `DetailPageButtonPlugin` 实例，复用
  `_reviewChain` 串行调用 `_triggerJavdbWant`（JavDB API 设为想看 +
  Rails JS 同步更新 DOM）+ `_syncRatingBar`（刷新评分条收藏高亮），
  与 `quickConvertToFav` 完全一致。零侵入已定稿插件。

---

## v1.5.1

**发布日期**：2026-07-08

### 修复

- **自动收藏补充三重广播事件**（doc/54）：doc/53 的自动收藏仅写了
  IndexedDB，未触发后续事件链。补充 `broadcastWantWatchedSync` 三重广播
  （GM_setValue/localStorage/CustomEvent），与手动收藏
  （`onWantAdded`/`quickConvertToFav`）效果一致——详情页菜单按钮文案
  刷新 + 列表页 status-tag 同步刷新。

---

## v1.5.0

**发布日期**：2026-07-07

### 新增

- **向「等待更新」清单添加视频时自动收藏**（doc/53）：在详情页勾选名称
  包含「等待更新」的清单时，自动将未收藏的视频写入 JHS 收藏
  （`FAVORITE_ACTION`）。保守策略不覆盖已有其它状态（屏蔽/已观看），
  已收藏的视频跳过。fire-and-forget 不阻塞清单同步广播。

---

## v1.4.0

**发布日期**：2026-07-07

### 移除

- **移除清单解析器插件（ListParserPlugin）**：清单详情页的"唤醒解析器"按钮
  不再需要，完全移除。插件计数 36 → 35（javdb 33 + missav 2）。

### 优化

- **预加载触发逻辑优化**：不再依赖 `isListPage` 判断，改为直接检测 `.movie-list`
  是否存在。`/lists/xxx` 清单详情页现在也能预加载，`/users/*` 清单列表页
  自动排除。
- **预加载日志增强**：启动时打印 item 数/屏蔽数/已缓存数/入队任务数/被拦截
  站点；每个任务完成打印 ✓命中/✗未命中/⚠拦截。
- **SupJav 站点策略调整**：全站 Cloudflare 拦截严重，改为始终显示黄色
  （warn 状态）+ 搜索页链接，不再发任何请求。
- **预加载 Cloudflare 容错**：检测到 403 后跳过该站点本轮剩余任务。

---

## v1.3.3

**发布日期**：2026-07-07

### 优化

- **预加载触发逻辑优化**：不再依赖 `isListPage` 判断，改为直接检测 `.movie-list`
  是否存在。`/lists/xxx` 清单详情页（有 `.movie-list`）现在也能预加载，
  `/users/*` 清单列表页（容器是 `#lists > ul`）自动排除。
- **预加载日志增强**：启动时打印 item 数/屏蔽数/已缓存数/入队任务数/被拦截站点；
  每个任务完成打印 ✓命中/✗未命中/⚠拦截。
- **瀑布流联动确认**：`startPreloadObserver` 监听 `.movie-list` childList，
  AutoPage 瀑布流 append 新页自动触发预加载（500ms 防抖 + 跳过已缓存）。

---

## v1.3.2

**发布日期**：2026-07-07

### 变更

- **SupJav 站点策略调整**：SupJav 全站 Cloudflare 拦截严重，解析不可靠。
  改为始终显示黄色（warn 状态）+ 搜索页链接，不再发任何请求（预加载 +
  详情页加载均跳过）。利用已有的 `initUrl` 机制实现零侵入。

---

## v1.3.1

**发布日期**：2026-07-07

### 优化

- **OtherSitePlugin 预加载 Cloudflare 容错**：检测到 supjav/missav 返回
  403 + "Just a moment..." 后，标记该站点并跳过本轮剩余预加载任务，
  避免逐个失败刷屏 + 浪费请求。下次页面加载时自动重试。

---

## v1.3.0

**发布日期**：2026-07-07

### 新增

- **OtherSitePlugin 列表页预加载缓存**（doc/51）：列表页浏览时自动预加载
  missav/supjav 搜索结果缓存，打开详情页后按钮零延迟变绿。串行限流 +
  跳过已缓存 + autoPage 瀑布流新页自动预加载。

---

## v1.2.0

**发布日期**：2026-07-07

### 变更

- **项目重命名为 JavDB Power Tools**（doc/50）：userscript `@name` 从
  `鉴黄师（test）` 改为 `JavDB Power Tools`，`@description` 重写为
  双站 36 功能插件描述
- **README 全新重写**：6 大类 36 功能清单 + 安装/配置/支持站点/技术架构/
  隐私说明/开发指南
- **插件计数同步**：AGENTS.md / doc / main.tsx 统一为 36（javdb 34 + missav 2）

---

## v1.1.0

**发布日期**：2026-07-07

### 新增

- **MissAV Quick Copy & JavDB 搜索插件**（doc/49）：MissAV 播放页番号
  一键复制 + 跳转 JavDB 搜索。原生 createElement 创建按钮 + SVG 图标，
  保留原 `<a>.click()` 打开新标签页实现。

---

## v1.0.1

**发布日期**：2026-07-07

### 修复

- **StatusTagFilter 与 jhs 屏蔽深度协同修复**（doc/48）：协同安全判断从
  依赖易变的 `style.display` 升级为依赖稳定的语义属性 `data-hide`，
  彻底消除排序/筛选时序竞争导致的屏蔽失效。统计函数排除被屏蔽卡片，
  芯片计数不再失真。

---

## v1.0.0

**发布日期**：2026-07-07

**初始公开发布版本**。由单文件混淆脚本 `archetype/jhs.user.js`（11605 行）
拆分重构为 Vite + React + TypeScript 工程化项目，并集成多个独立油猴脚本，
形成 JavDB / MissAV 双站增强工具箱，共 36 个功能插件。

### 核心重构（doc/01-24）

- **架构搭建**（doc/01-05）：Vite + vite-plugin-monkey + React + TypeScript
  工程化搭建，单文件混淆脚本拆分为 core / plugins / components / constants /
  styles / types 模块化结构
- **组件化**（doc/06-23）：63 个 HTML 字符串 → React 函数组件（jsxToString
  渲染 HTML 字符串，不依赖 react-dom），覆盖弹窗/表格/按钮/状态标签/设置面板等
- **库 ESM 迁移**（doc/24）：7 个第三方库（jQuery/Tabulator/layer/Toastify/
  localforage/Viewer/blueimp-md5）从 `@require` CDN 改为 ESM import 打包进产物

### JavDB 主脚本拆分插件 — 23 个（来自 jhs.user.js）

- **ListPagePlugin**：列表页主插件（封面高清/状态过滤/状态标签/翻译/排序/快捷键）
- **AutoPagePlugin**：列表页瀑布流自动翻页
- **FoldCategoryPlugin**：分类区折叠/展开 + 标签高亮收藏
- **ListPageButtonPlugin**：列表页按钮组（批量打开/排序切换/加入黑名单）
- **HistoryPlugin**：鉴定记录（Tabulator 远程分页表格）
- **SettingPlugin**：设置弹窗 + WebDav 云备份 + 缓存管理
- **NavBarPlugin**：导航栏重构 + 以图识图
- **HitShowPlugin**：热播榜单（日/周/月榜）
- **Top250Plugin**：Top250 排行榜 + 登录框
- **DetailPagePlugin**：详情页外链 + fancybox 开关
- **ReviewPlugin**：详情页评论加载（折叠/分页/链接渲染）
- **DetailPageButtonPlugin**：详情页按钮组（屏蔽/收藏/已观看/磁力/字幕/评分）
- **HighlightMagnetPlugin**：磁链高画质优先过滤
- **PreviewVideoPlugin**：DMM 预告片解析播放
- **FilterTitleKeywordPlugin**：标题关键词右键屏蔽
- **ActressInfoPlugin**：演员信息（维基百科抓取身高/三围/罩杯）
- **OtherSitePlugin**：第三方站点跳转（MissAv/SupJav 搜索+缓存）
- **WantAndWatchedVideosPlugin**：想看/已观看列表导入
- **RelatedPlugin**：相关清单加载
- **BlacklistPlugin**：演员黑名单 + 递归抓取番号
- **FavoriteActressesPlugin**：收藏演员 + 头像替换（GFriends）
- **NewVideoPlugin**：新作品检测弹窗
- **Fc2Plugin**：FC2 番号详情弹窗

### 独立脚本集成插件 — 13 个（来自 archetype/*.user.js）

- **RatingDisplayPlugin**（doc/25）：列表页个人评分显示（缓存+懒加载）
- **KeyPageTurningPlugin**（doc/34）：左右方向键翻页
- **ModMyListOpenWayPlugin**（doc/35）：清单链接新标签打开 + 短地址
- **PageSortPlugin**（doc/36+37）：单页内容排序 + 与 jhs 排序系统协调优化
- **StatusTagFilterPlugin**（doc/38）：状态标签筛选芯片（OR 逻辑）
- **ListWaterfallPlugin**（doc/39）：清单页瀑布流自动翻页
- **ListReadingStatusPlugin**（doc/40）：清单阅读进度 + 1-5 星评分
- **ModalListDisablerPlugin**（doc/42）：保存到清单模态框自动禁用
- **ListParserPlugin**（doc/43）：清单解析器唤醒按钮
- **VideoListsTagPlugin**（doc/45）：清单标签同步 + 筛选栏 + 本地 IDB
- **CarListReaderPlugin**（doc/46）：javdb 端车辆状态增量推送 + 全量同步
- **MissavStatusTagPlugin**（doc/46）：missav 端状态标签渲染
- **MissavQuickCopyPlugin**（doc/49）：missav 播放页番号复制 + JavDB 跳转

### 基础设施优化（doc/26-33, 41, 44, 47）

- 标识符语义化重命名（doc/26）
- 清理 javbus 死代码（doc/27）+ 其他死代码（doc/28）
- FC2 插件迁移修复点击失效（doc/29）
- Tabulator 完整版修复 formatter 缺失（doc/31）
- CSS 布局修复（doc/32）：toast 超宽 + 按钮贴连
- 收藏状态下评分星星禁用修复（doc/33）
- terser 最高压缩率配置（doc/44）：产物 -35%
- 运行时调度优化（doc/47）：CSS 先于逻辑注入 + 依赖清理
- 移除失效的 parallel_GM_xmlhttpRequest @require（doc/41）

### 跨站同步（doc/46）

- 去后端化：JavDB → MissAV 状态同步改用 GM 存储跨域传递（零网络请求）
- 增量推送（实时）+ 全量兜底（页面加载）
- MissAV 端独立 IndexedDB + WebDav 备份支持
