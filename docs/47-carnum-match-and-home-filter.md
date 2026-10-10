# 47 - 番号匹配口径统一、遗留项收敛与 JavDB 首页筛选组件

- **状态**：已执行
- **影响范围**：`src/core/{page-context,storage/*,util/site/*,util/*}`、`src/plugins/{list-page-plugin,status-tag-filter-plugin,video-lists-tag/*,setting/*,detail-page-button/*,new-video/*,missav-*}`
- **前置文档**：doc/46（领域重构试点与后续路线）、doc/45（外站访问计数）、doc/139（Runtime V2 页面类型）、doc/227（MissAV 视频页判定）
- **生效版本**：v1.48.0（minor：含用户可见的功能变化 —— 首页显示过滤/筛选组件）

---

## 一、番号匹配口径统一（承接 doc/46 §3.2，用户选定方案 A）

### 1.1 差异到底是什么

`car_list`（番号清单）里，同一条记录的**番号字符串按写入时的页面原文存储**（不归一化）；
读/写路径对「两个番号算不算同一个」的口径分成了两派：

| 路径 | 匹配口径（重构前） |
|------|------------------|
| `saveSingleCar`（新增/更新去重） | 跟随 `featureFlags.caseInsensitiveCarNum`（**默认 true = 忽略大小写**） |
| `getCar`（按番号查询） | 跟随开关 |
| `saveCar`（写库后推送增量） | 跟随开关 |
| `saveCarList`（批量写库后推送增量） | 跟随开关 |
| `clearCarWatchStatus`（批量取消已读） | 跟随开关（入参先 trim） |
| `updateCarInfo`（更新已有记录） | **固定精确匹配**（`===`，不读开关） |
| `removeCar`（删除单条） | **固定精确匹配** |
| `batchRemoveCars`（批量删除） | **固定精确匹配**（`Set` 精确查找） |

后果（同一番号、同一功能内自相矛盾）：

- `dpb-want-watched.ts:206` 的 `removeCarIfStatus` 是「先 `getCar` 再 `removeCar`」：
  `getCar` 忽略大小写 → **找得到**；`removeCar` 精确 → **删不掉**，只弹一句「X 不存在」并返回 false，
  记录留在库里（详情页取消「想看/已看」后清单仍有该条）。
- `history-batch-ops.ts:54` 批量删除：命中 0 条 → 静默 `false`，面板提示「没有一个存在于列表中」。
- `history-plugin.tsx:425` `updateCarInfo`：未命中 → `failWithToast` **抛错**（该 helper 是 `never` 类型，抛异常终止），面板操作报错。
- 触发条件：写入时的页面原文与后续传入的番号大小写不同。JavDB 列表卡片/详情页通常大写，
  因此**实际触发概率低**；差异的价值在于它是「能读到却改不了」的静默不一致，且违反开关自身的声明语义
  （`featureFlags.ts` 注释：该开关就是「番号匹配是否忽略大小写」）。

### 1.2 处理（方案 A）

三处改为跟随开关，与读取路径同口径；`updateCarInfo` 的「记录不存在」保持抛错（既有行为），
不再依赖大小写运气：

```ts
// car-list-ops.ts（三处）
const car = list.find((item) => carNumEquals(item.carNum, carNum, featureFlags.caseInsensitiveCarNum));
const filtered = list.filter((item) => !carNumEquals(item.carNum, carNum, featureFlags.caseInsensitiveCarNum));
const numSet = new Set(carNums.map((n) => carNumKey(n, caseInsensitive)));
const filtered = list.filter((item) => !numSet.has(carNumKey(item.carNum, caseInsensitive)));
```

**行为变化**：开关开启时（默认），原本因大小写不同而失败的删除/更新现在会成功；
开关关闭时退回精确匹配（用例覆盖）。方向单一 —— 只把「失败」变「成功」，不会误删大小写不同的另一条记录
（判定依据是同一套 `carNumKey`）。

### 1.3 落地验证

`tests/car-list-ops-match.test.ts`（7 用例，jsdom + 手写 FakeForage + `utils`/`show`/`Toastify` 替身）：
get 读得到→remove 删得掉、批量删除、更新不抛错、取消已读对照；开关关闭时三条路径退回精确匹配且不误删。

---

## 二、JavDB 首页显示过滤/筛选组件

### 2.1 历史复核（结论：历史上是显示的）

| 证据 | 内容 |
|------|------|
| `archetype/jhs.user.js:11887-11890` | 列表过滤门控 = `window.isListPage = $('.movie-list').length>0 \|\| href.includes('advanced_search')`，**没有**首页排除 |
| `archetype/statusTagFilter.user.js:9` | 状态标签筛选栏原脚本 `@include javdb*.com/*`，**无任何页面门控** |
| `archetype/videoListsTag.user.js:9、:1057-1089` | 清单标签筛选栏原脚本 @include 全站，只要求页面有 `.item` |
| `docs/javdb-site-structure.md:25、205-219` | 站点参考把 **`/` 列为列表页**（影片列表容器 `movie-list h cols-4 vcols-8`），实测 `.movie-list` 1 / `.item` 40 / `.tabs.is-boxed` 1 |
| `docs/21-javdb-selector-audit.md:45-46` | 筛选栏挂载点 `body > section > div > div.tabs.is-boxed` 在首页命中 1 |
| `vite.config.ts:32` | `match: ['https://javdb.com/*', …]` 覆盖首页；`constants/site.ts` 的 `isJavdbSite = href.includes('javdb')` 亦为真 |

即：① 脚本本身在首页运行；② 首页是影片列表页；③ 过滤/筛选组件的挂载点存在；
④ 历史（原脚本）与当前代码的门控条件都是「`.movie-list` 存在或 advanced_search」——**没有**「首页排除」这类规则。

### 2.2 当前代码的结构性风险

`pageContext.isListPage` 在 `main.tsx` 启动时**一次性**检测（`document-idle`），
而过滤/筛选组件同时受 `pageTypes: ['list']` 与内层 `if (!window.isListPage) return;` 双重门控：

- 若首页的影片列表在 document-idle 时尚未出现（首页含 `.main-tabs` 等客户端渲染区块），
  `isListPage=false` → `pageType='unknown'` → **三个过滤/筛选组件整体不执行**，且不会重试。
- 这是「历史上显示、现在不显示」唯一可由代码解释的机制；站点侧是否近期改版无法在本环境实测（见 §六 限制）。

### 2.3 实现（确定性放行，不依赖 DOM 竞态）

1. `src/core/page-context.ts`
   - `PageType` 增加 `'home'`；`PageContextResult` 增加 `isHomePage`。
   - `isHomePage = isJavdbSite && (pathname === '/' || pathname === '')`。
   - `pageType` 优先级：`detail > fc2 > list > home > unknown` —— **列表容器存在时仍是 `list`**，
     因此不影响其它 `pageTypes:['list']` 插件的既有行为；`home` 只在「首页 + 未检出列表容器」时生效。
   - 新增 `isVideoListContext()` = `pageContext.isListPage || pageContext.pageType === 'home'`。
2. 三个过滤/筛选组件接入
   - `list-page-plugin`（卡片过滤 + 批量栏）：`pageTypes: ['list','home']`；`doFilter()` 守卫换 `isVideoListContext()`。
   - `status-tag-filter-plugin`（状态标签芯片筛选栏）：同上。
   - `video-lists-tag/vlt-plugin`（清单标签筛选栏）：列表分支守卫换 `isVideoListContext()`（该插件无 pageTypes 覆写）。

**未纳入**（历史行为里也没有）：`list-reading-status` 工具栏（原脚本 @include 只有 `/users/*`、`/lists/*`）、
`list-waterfall`（原脚本 @include `/users/lists*`）；`list-page-button` 保持 `['list']` 不变。

### 2.4 落地验证

`tests/page-context-home.test.ts`（4 用例，jsdom + 站点常量替身）：首页未检出列表 → `home` 且 `isVideoListContext()` 为真；
检出列表 → 仍是 `list`；`isHomePage` 只由 pathname 决定；站点标识为 javdb。

---

## 三、遗留项处置（承接 doc/46 §六）

### 3.1 已完成

| # | 项 | 处理 |
|---|----|------|
| 2 | **跨站全量载荷双构造**（唯一带协议风险项） | 新增 `plugins/car-status-sync/car-status-publish.ts` 作为发布侧**唯一权威构造点**：`allocateRevision` / `appendDeltaJournal` / `publishSnapshot` 自 `car-list-reader-plugin` 原样迁入，并新增 `publishFullSnapshot(getCarList)` 用例（取数 → 列存 → gzip → 分配修订号 → 协议完整载荷 → 指针保护写入 → 日志裁剪 + `SYNCED_REV`/`LAST_SYNC_TIME` 侧效应）。自动全量同步与设置面板 `handleMissavSync` 都改走它 |
| 3 | 状态枚举单源 | `car-status-config.STATUS_LIST` 改为由 `constants/status.ts` 的动作常量派生（**顺序不变**，列存协议顺序 filter→favorite→hasDown→hasWatch） |
| 6a | CSRF 读取 5 份 → 1 | 新增 `core/util/site/csrf.ts`（`getCsrfToken` + `getCsrfTokenWithFormFallback`），删掉 `vlt-helpers`、`jhs-sync/sync-common`、`dpb-rating-api` 三份实现与两处内联；`dpb-rating` 中已无人引用的 `getCsrfToken` 再导出同步删除 |
| 6b | MissAV 视频页判定跨插件耦合 | `isVideoDetailPath` 从 `plugins/missav-status-filter/mstf-collect.ts` 迁到 `core/util/site/missav-paths.ts`，两个 missav 插件改引共享模块 —— 顺带消除一条「跨插件目录 import 内部实现」 |
| 6d′ | 外站访问计数**迁移缺口**（doc/45 遗留） | `persistent-data-migration.MAP_SPECS` 补 `jhs_external_visit → externalVisit`：此前只在读写侧登记 legacy 键，持久存储一旦激活旧数据就再也读不到 |

### 3.2 本轮明确推迟（含理由）

| # | 项 | 理由 |
|---|----|------|
| 1 | 18 条跨插件内部 import 收口 | 需要给每个域定义公开 API 面（`public.ts` 或 `getBean` 契约），涉及 DOM 契约与 vlt/清单域，属独立一轮；本轮只顺手消掉 1 条 |
| 4/5 | 巨型函数/巨型文件拆分（`handle()` 174 行、`initReflowPanel()` 305 行、`car-status-db.ts` 639 行等） | 这些函数无测试覆盖，先补桩再拆才安全；拆分是纯结构调整，与协议/行为修复不同批更不易混淆 |
| 7 | 破 95 文件巨型环 | 已实测该 SCC **100% 是类型层环**（rollup 擦除后为 DAG，无运行期风险）。破环需改 30+ 处 `getBean` 的泛型形态或给 44 个插件加模块增强，收益（图更干净）低于代价（类型推断退化或大改面） |
| 6c | FC2 前缀语义 3 套 | 6 处实现分三族：①只剥字面 `FC2-`（5 处，其中 `/^FC2-/` 与 `'FC2-'` 对非前缀串结果不同）、②忽略大小写剥 `FC2-(PPV-)` 且要求纯数字、③截图插件「去 PPV + 去全部连字符」且在**同一函数内**有另一种口径。合并会改变 `FC2-PPV-…` 入参的产出（①给出 `PPV-1234567`，②给出 `1234567`），属于**潜在 bug 修复**而非安全合一，需单独决策 |
| 6d″ | 缓存键白名单三表派生 | 三表（备份白名单 / 清理命名空间映射 / 迁移规格）当前 8 键一致但**用途不同**（白名单还含 8 个偏好键 + `jdb:rating_cache_v2` 特判）。收敛需要一个带用途视图的单源注册表，改动触及备份与清缓存行为，宜单独一轮 |

---

## 四、实施（改动文件清单）

新增：

- `src/core/util/site/csrf.ts`、`src/core/util/site/missav-paths.ts`
- `src/plugins/car-status-sync/car-status-publish.ts`
- `tests/car-list-ops-match.test.ts`、`tests/car-status-publish.test.ts`、`tests/page-context-home.test.ts`
- `docs/47-*.md`（本文件）

修改：

| 文件 | 改动 |
|------|------|
| `src/core/storage/car-list-ops.ts` | 三处匹配口径跟随 `caseInsensitiveCarNum` |
| `src/core/page-context.ts` | `PageType` 增 `home`、`isHomePage`、`isVideoListContext()` |
| `src/core/storage/persistent-data-migration.ts` | `MAP_SPECS` 补 `jhs_external_visit` |
| `src/plugins/list-page-plugin.tsx` / `status-tag-filter-plugin.ts` | `pageTypes: ['list','home']` + 守卫换 `isVideoListContext()` |
| `src/plugins/video-lists-tag/vlt-plugin.ts` | 列表分支守卫换 `isVideoListContext()` |
| `src/plugins/car-status-sync/car-status-config.ts` | `STATUS_LIST` 由状态常量派生 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 发布机制迁出，只留调度；改调 `publishFullSnapshot` |
| `src/plugins/setting/data-import-export.ts` | `handleMissavSync` 改调发布用例（含失败原因提示） |
| CSRF 5 个调用方（`vlt-list-mgmt` / `vlt-server-api` / `sync-common` / `dpb-rating-api` / `dpb-rating` / `actress-card-renderer` / `vlt-create-list-api`） | 改引共享实现 |
| `src/plugins/missav-status-filter/{mstf-collect,missav-status-filter-plugin}.ts`、`missav-auto-page/missav-auto-page-plugin.ts`、`tests/missav-status-filter.test.ts` | 改引 `core/util/site/missav-paths` |
| `AGENTS.md` / `docs/plugin-catalog.md` / `docs/README.md` / `changelog/CHANGELOG.md` / `vite.config.ts` / `package.json` | 计数、索引、版本 v1.48.0 |

---

## 五、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `d4f138e`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bunx tsc -b` | 0 错误 |
| `bun run test` | **40 文件 / 407 用例全部通过**（本轮新增 3 文件 19 用例：匹配口径 7 + 发布用例 8 + 首页判定 4） |
| `bun run lint` / `bun run lint:css` | 0 告警 |
| `bun run check:structure` | OK（390 文件 / 68 目录；其中 `src/core/util` 21 直属文件曾触发上限，据此把 CSRF 模块归入 `util/site/`） |
| `bun run check:docs` | OK（44 插件 [5 flagged]，66 核心文件） |
| `bun run check:selectors` | OK（88 文件 / 274 字面量；注释中的反引号选择器字面量曾触发违规，已改写措辞） |
| `bun run check:version` | OK（userscript 1.48.0 = package.json 1.48.0） |
| `bun run build` | 通过，产物 `@version 1.48.0` |

- **验证结论**：三条行为变更均有用例固化（匹配口径、发布载荷协议完整性、首页页面类型）；
  四条门禁（含本轮被拦下两次并据此修正结构的棘轮）与构建通过。
- **已知限制**：
  1. **无法获取 JavDB 首页当前 DOM**：本机 curl 直连与 `127.0.0.1:7890` 代理均返回 `HTTP=000`（无外网出口），
     因此「首页列表容器是否在 document-idle 前出现」只能依据 doc/21、`docs/javdb-site-structure.md`（站点实测快照）
     与原脚本门控推断，未在真实浏览器复验。首页改动的实现对两种情况都成立（容器在 → `list`；不在 → `home`），
     但**建议在真机首页确认一次**（见 §六 建议的 4 行控制台自检）。
  2. 发布用例的验证是「纯逻辑 + GM 替身」（含 gzip 真实压缩），未在真实跨标签页/跨域环境跑端到端。
  3. `handleMissavSync` 的用户可见行为有两处变化：`count===0` 时不再写入空快照（与消费端拒收一致，给出「列存后无有效记录」提示）；
     已有更新快照时提示「已有更新的快照，未覆盖」（此前会直接覆盖）。

## 六、后续建议

1. **真机首页自检**（4 行，控制台执行）：
   `document.querySelectorAll('.movie-list').length` / `window.isListPage` /
   `document.querySelector('.status-tag-filter-bar')` / `document.querySelector('.jhs-vlt-filter-bar')`
   —— 用于确认首页当前是 `list` 还是 `home` 路径，并确认芯片栏/标签栏是否已挂载。
2. doc/46 §六 剩余项按 §3.2 的顺序推进（建议先 4/5 拆巨型函数并补桩，再动 1 与 6c/6d″）。