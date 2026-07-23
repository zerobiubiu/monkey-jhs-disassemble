# doc/178 — Wave 4 复用合并（Round 4）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

原子化→复用循环第四轮（Wave 4）。Wave 3（doc/176）完成三重广播总线统一与 failWithToast
补全后，本轮基于 Round-4 复用审计 + director seed 的 3 个复用项（C1/C2/C3）执行。

审计的 bus 采纳扫描（A1/A2/A3）经核全为 N/A/L（不同通道形状 / 无剩余 failWithToast 对 /
单用彩色 span），故本轮仅执行 C1/C2/C3 三项。

## C3 simple_lists 分页获取去重（M，已执行）

Round-4 审计 DUP-1：dpb-list-panel 的清单分页抓取与 vlt-server 的权威状态查询共享一段
~29 行的「单页 fetch+parse」逻辑（AbortController + 10s 超时；`fetch` 携带
`{credentials:'same-origin', cache:'no-store', Accept:'application/json'}`；`response.ok`
校验；JSON 解析 `{lists, page}`；DOMParser 解析 `payload.lists`；从 `payload.page` 提取
`a[rel='next']`；对 nextUrl 做 origin+pathname 校验 `/users/simple_lists`；设置 vid
searchParam）。

**提取位置**：新建 `src/core/util/util-simple-lists.ts`，导出
`fetchSimpleListsPage(url: string, vid?: string): Promise<{ entries: string; nextUrl: string | null }>`。
选 core/util 而非 `vlt-helpers.ts` 的理由：core/util 是两个插件都已依赖的中立层
（dpb 已引 `core/util/tabulator-factory`、`util-async`；vlt 已引 `core/util/broadcast`），
不引入任何新的跨插件依赖边；core/util 当前 18 个直接文件，加 1 个为 19 ≤ 20 上限。

**共享函数职责**：仅做单页 fetch+parse，不含循环、不含 throw-vs-null 决策。网络失败 /
HTTP 非 2xx / `payload.lists` 非字符串 / 下一页地址非法时**抛出**（真实错误）。

**两个调用方各自保留循环与错误语义**：

- `dpb-list-panel-fetch.ts` 的 `fetchAllListPageEntries`（collect-all + throw）：保留
  `while` 循环、`LIST_PANEL_MAX_PAGES` 上限、`visited` 循环检测与全部 `throw`；仅把内层
  单页 fetch+parse 替换为 `const page = await fetchSimpleListsPage(url.href, videoId)`。
  错误继续向上抛，由 `loadAllListPages` 的 `.catch` 置 `jhsPagesStatus='partial'` 并提示。
- `vlt-server-api.ts` 的 `fetchAuthoritativeCheckboxState`（search-one + null）：保留
  `for` 搜索循环（`page < 50`）、命中 `listId` 即早返回、`!result.nextUrl` 返回
  `{checked:false,count:null,name:null}`；外层 `try/catch` 把共享函数的 throw 转成
  `clog.error(...)` + `return null`（原有 null-on-error 语义）。

**零偏差核对**：两调用方超时原值均为 10000ms（`LIST_PANEL_PAGE_TIMEOUT_MS` 与
`AUTHORITATIVE_LIST_TIMEOUT_MS`），共享函数沿用 10000ms；fetch 选项、`Accept` 头、
`response.ok` 校验、`payload.lists` 类型守卫、`a[rel="next"]` 提取、origin/pathname 校验、
vid searchParam 设置均逐条保留。vlt 的「!ok → 返回 null」与「格式异常 → 返回 null」两条
路径，在共享函数中统一为 throw，再由 vlt 外层 catch 收敛为 null，终态一致。

消除 ~29 行跨插件重复 + salt/endpoint 双写隐患（此前改超时 / 改 endpoint 须同步两处）。

## C1 back-to-top CSS 孪生（M，已执行）

`src/styles/back-to-top-button.css`（`#jhs-back-to-top`）与
`src/styles/list-waterfall-plugin.css`（`#jdb-wf-back-to-top`）的 4 组规则
（base / `:hover` / `.show` / `svg`）声明体**逐字节相同**，仅选择器 id 不同。

**注入作用域核对**：两 CSS 均经 `PluginManager.processCss → utils.insertStyle` 注入 head；
SettingPlugin 与 ListWaterfallPlugin 均**未**声明 `pageTypes`（默认空数组 = 所有页面类型），
故二者在 javdb 站点的**每一个页面**都会注入。`back-to-top-button.css` 虽另在
`addBackToTopBtn` 中经 `insertStyle` 二次注入，但 `insertStyle` 幂等去重，无副作用。
因此把共享规则分组到 `back-to-top-button.css` 的 grouped selector，对两按钮在所有页面均可见，
零偏差成立。

**执行**：在 `back-to-top-button.css` 将 4 组规则的选择器改为分组形式
（`#jhs-back-to-top, #jdb-wf-back-to-top { ... }` 等），声明体不变；从
`list-waterfall-plugin.css` 删除整段 `#jdb-wf-back-to-top` 规则（base/hover/show/svg 共
~52 行），保留 `.jdb-wf-loader*` 与 `@keyframes jdb-wf-spin`。两按钮计算样式不变。

## C2 back-to-top 逻辑对（L/N-A，已记录不合并）

`setting-plugin.tsx` 的 `addBackToTopBtn` 与 `core/util/back-to-top.ts` 的
`createBackToTopButton` 共存为**设计意图**：

- 守卫：`back-to-top.ts:28` `if (document.getElementById('jhs-back-to-top') || document.getElementById(id)) return () => {}`
  ——list-waterfall 的按钮检测到设置插件已建 `#jhs-back-to-top` 时直接放弃创建，避免双按钮。
- 滚动动画不同：
  - 设置按钮：`utils.smoothScrollToTop(500)`（util-dom.ts，requestAnimationFrame +
    cubic ease-in-out 补间，500ms，`window.scrollTo(0, ...)`）。
  - 瀑布流按钮：`window.scrollTo({ top: 0, behavior: 'smooth' })`（浏览器原生平滑）。

合并二者会改变设置按钮的滚动手感（500ms 自定义补间 → 原生 smooth），属零偏差风险，
故**不合并**，记录备查，避免后续审计重复标记。

## 复用采纳扫描结论（A1/A2/A3）

| 项 | 结论 | 理由 |
| --- | --- | --- |
| A1 | N/A | 通道形状不同，无可统一的收发对 |
| A2 | N/A | 无剩余 `failWithToast` 候选对（Wave 3 已收敛） |
| A3 | L | 单用彩色 span，抽取不划算 |

## 实施清单

| 文件 | 操作 |
| --- | --- |
| `src/core/util/util-simple-lists.ts` | 新建：`fetchSimpleListsPage` 单页 fetch+parse |
| `src/plugins/detail-page-button/dpb-list-panel-fetch.ts` | 改：内层单页逻辑改调共享函数，保留 while+throw |
| `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 改：内层单页逻辑改调共享函数，保留 search+catch→null |
| `src/plugins/video-lists-tag/vlt-helpers.ts` | 改：删除孤立常量 `AUTHORITATIVE_LIST_TIMEOUT_MS`（去重后无引用，超时值移入共享函数） |
| `src/styles/back-to-top-button.css` | 改：4 组规则改 grouped selector（并入 `#jdb-wf-back-to-top`） |
| `src/styles/list-waterfall-plugin.css` | 改：删除 `#jdb-wf-back-to-top` 冗余规则段 |
| `doc/178-wave4-reuse-merge.md` | 新建：本文档 |

## 验证记录

由编排器门禁补填（tsc / vitest / eslint / stylelint / check:structure）。
