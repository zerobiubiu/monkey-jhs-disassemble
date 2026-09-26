# 站点选择器注册表 + 机械门禁

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：所有依赖 JavDB / MissAV 原生 DOM 的插件（选择器读取、挂载点定位、注入边界）
> **前置文档**：`21-javdb-selector-audit.md`（选择器有效性清单）、`javdb-site-structure.md`（站点结构）
> **替代文档**：无
> **生效版本**：v1.46.13

## 1. 背景

`21-javdb-selector-audit.md` 已证实：站点改版（`.female` → `.actor-female`）会让散落在各插件里的
**裸选择器字面量**集体失效，而定位受影响调用点只能靠全树搜索。

实测现状（本变更前）：

- `src/` 内选择器调用点 **1,287 处 / 161 个文件**（含大量项目自有 UI）；
- 其中**站点原生**选择器字面量 **284 处 / 90 个文件**——这才是真正的"站点依赖面"；
- 没有单一出处，也没有门禁阻止继续新增。

`src/core/util/site/actress-links.ts`（doc/21 引入）已经验证了"选择器 + 新旧兼容读取"的正确做法，
本变更把它推广为**注册表 + 门禁**。

## 2. 方案

### 2.1 注册表模块 `src/core/util/site/selectors.ts`

- `SITE_SELECTORS`：站点原生选择器事实表（按「全局骨架 / 详情页 / 列表页 / 分页 / 演员页 / 标签页 /
  用户清单 / 系列页」分组），每项为 `{ current, legacy? }`；
- `SiteSelector` / `SiteSelectorKey` 类型；
- 查询 API：`siteSelector(key)`、`siteQuery(key, root?)`、`siteQueryOne(key, root?)`、
  `siteQueryCompat(key, root?)`（新结构优先、旧结构回退）；
- 只收**站点原生** DOM（`.movie-list`、`.actor-female`、`#tags`、`body > section > div` 等），
  **不收**项目自有 UI（`.jhs-*`、`#setting-*`、`#otherSiteBox`）。

与 `actress-links.ts` 的分工：后者是"选择器 + 兼容读取逻辑"的先例（含单测），本模块是扁平事实表。

### 2.2 门禁 `scripts/check-site-selectors.ts` + `bun run check:selectors`

采用与 `check-structure.ts` 相同的**棘轮（ratchet）**机制：

- `SITE_SIGNATURES`：站点原生 DOM 的**辨识性**特征串（刻意排除 `.box` / `.item` / `.tag` 等通用
  Bulma 名，避免误伤自有 UI）；
- 统计每个文件里"引号内含站点特征串"的字面量数量；
- `scripts/site-selector-baseline.json` 记录现状基线，**只允许下降**：
  - 已有文件计数上升 → FAIL；
  - 出现新文件 → FAIL；
- 三种模式：默认门禁 / `--report`（按文件排序的清单）/ `--update-baseline`（人工确认后重写）。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/core/util/site/selectors.ts` | **新增** 站点选择器注册表（306 行） |
| `scripts/check-site-selectors.ts` | **新增** 棘轮门禁脚本 |
| `scripts/site-selector-baseline.json` | **新增** 基线（90 文件 / 284 字面量） |
| `package.json` | 新增 script `check:selectors` |
| `AGENTS.md` §3.4 | core 文件数 62 → **63**；util 子目录 34 → **35** |
| `docs/plugin-catalog.md` | core 62 → **63**；`util/` 21 → **22**（含新增 `site/selectors`） |

**未改动**：`actress-info-plugin.tsx`（按既定目标保持原样）、任何存储 / 迁移代码、用户数据。

## 4. 执行验证记录

### 执行环境

Windows / Bun；`bun run check:selectors`（独立命令，不接入 build / lint / test）。

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run check:selectors --report` | `90 files, 284 site-selector literals` |
| `bun run check:selectors --update-baseline` | `baseline updated (90 files, 284 literals)` |
| `bun run check:selectors` | `OK (90 files, 284 literals; 0 file(s) below baseline)` |
| `bun run build` | exit 0 |
| `bun run lint` | exit 0 |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0（16 文件 / 206 用例） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0（44 plugins / **63** core files） |

### 门禁负向测试（证明真能拦截）

| 场景 | 构造 | 实际输出 |
|---|---|---|
| **新增文件**引入站点字面量 | 临时建 `src/__selector-gate-probe.ts`（含 `.movie-list .item`） | `FAIL` + `NEW site-selector literal(s) (1) — 请先加入 core/util/site/selectors.ts 注册表`，exit 1 |
| **已有文件**计数上升 | 临时把基线 `base-plugin.ts` 由 9 下调为 8 | `FAIL` + `base-plugin.ts: 9 > 8 — 新增了站点选择器字面量，请改用注册表`，exit 1 |

两个分支均验证通过；探针与基线改动已还原（还原后门禁恢复 `OK`）。

### 验证结论

注册表模块可编译、可被引用；门禁两个失败分支均实测可拦截，且对现状零误报（284 处基线全绿）。

## 5. 后续验证建议

1. **迁移期**：新增/修改涉及站点 DOM 的代码时，先从 `SITE_SELECTORS` 取值；每迁移一处，
   对应文件计数下降，可择机 `--update-baseline` 下调基线（棘轮只降不升）。
2. **站点改版时**：按 `javdb-site-structure.md` 的 Runbook 四步走（查结构 → 查 doc/21 →
   改注册表 → 跑门禁）。
3. **签名表维护**：若发现新的站点特征类名，加入 `SITE_SIGNATURES`；若某签名误伤自有 UI，
   收紧为更具体的形态（如带 `#` 前缀）。
4. **长期**：随迁移推进，`284` 应逐步下降；基线归零时可把门禁从"棘轮"升级为"禁止任何裸站点字面量"。

## 6. 已知限制

- 门禁基于**正则统计**（引号内含特征串），不做 AST 解析：可能统计到注释外的字符串拼接，
  但作为**棘轮**足够（只关心是否新增）。
- 基线是"现状快照"，不是"应然值"——它允许存量存在，只禁止增量；收敛靠迁移推进。
- `SITE_SIGNATURES` 为人工维护的辨识性列表，不追求穷尽站点全部类名。


## 7. 首批调用点迁移（同批追加）

注册表建成后立即迁移了三个纯字符串替换点（行为等价）：

| 文件 | 迁移内容 | 计数变化 |
|---|---|---|
| `src/plugins/key-page-turning-plugin.ts` | `SELECTOR_LEFT/RIGHT` → `siteSelector('paginationPrevPath'/'paginationNextPath')` | 2 → **0** |
| `src/plugins/video-lists-tag/vlt-helpers.ts` | 番号/标题/日期/封面 4 处 → `detailMetaClipboard`/`detailCurrentTitle`/`detailPublishTime`/`detailCoverImg` | 10 → **7** |
| `src/plugins/favorite-actresses-plugin.tsx` | 演员名/元信息/头像 3 处 → `actorSectionName`/`actorSectionMetaName`/`actorAvatar` | 3 → **1** |

**迁移后基线**：`89 files, 277 literals`（原 90 / 284）。

迁移后重跑门禁：`build` / `lint` / `lint:css` / `test`（206 用例）/ `check:structure` /
`check:docs` / `check:selectors` **全部 exit 0**；`dist` `@version` = `1.46.13`。

**未迁移（存量，按“触碰即迁移”推进）**：其余 86 个文件 / 277 处，以 `review-plugin.tsx`（13）、
`dpb-list-merge-ui.ts`（11）、`base-plugin.ts`（9）居前；棘轮只降不升，迁移一处即可下调基线。
