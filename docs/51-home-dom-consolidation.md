# 51 - 首页两处 DOM 收敛：隐藏原生封面切换 + 我方按钮组不在首页显示

- **状态**：已执行
- **影响范围**：`src/core/page-context.ts`、`src/core/util/site/selectors.ts`、`src/styles/javdb-site.css`、`src/main.tsx`、`src/plugins/list-page-button-plugin.tsx`
- **前置文档**：doc/47（首页页面类型 `home`）、doc/48/49/50（筛选栏挂载与顺序）
- **生效版本**：v1.48.4（patch）

## 一、现场两处元素的身份

用户给出两处 DOM，先定性再动手：

| 位置 | 实际身份 | 结论 |
|---|---|---|
| `body > section > div > div.toolbar > div:nth-child(1)` | `<div class="button-group"><div class="buttons has-addons"><a href="/?lm=h&vft=1">大封面</a><a href="/?lm=v&vft=1">小封面</a></div></div>` —— **站点原生**「大封面 / 小封面」切换；同层还有 3 个 `button-group` | 站点原始控件，按产品要求在**首页**隐藏 |
| `body > section > div > div.main-tabs-wrap > div > div:nth-child(3)` | `<div style="display:flex;align-items:center"><a id="newVideoBtn" …>新作品检测 (13867)</a><a id="blacklistBtn" …>…</a></div>` —— **本脚本** `list-page-button-plugin.createMenuBtn()` 注入的按钮组，父层 `div.tabs.main-tabs.is-boxed` | 我方组件，按产品要求在**首页**不显示；其它列表页保持显示（见 §四） |

## 二、实现

### 2.1 隐藏原生封面大小切换（仅在首页）

- 注册表新增语义键 `listCoverSizeSwitch`
  = `body > section > div > div.toolbar .button-group:has(a[href*="vft=1"])`
  —— 用 `:has()` 按「含 `vft=1` 链接」定位，**不用 `:nth-child(1)`**（toolbar 里还有另外三个 `button-group`，位置不稳）。
- `javdb-site.css` 增加占位符 `/*__HIDE_COVER_SIZE__*/`，由 `main.tsx` 按页面替换：
  首页 → `选择器{display:none!important;}`，非首页 → 空串。沿用既有 `/*__HIDENAV2__*/` 的占位符模式，不新增运行时机制。
- 新增 `page-context.isJavdbHomePath(pathname?)`，`detectPageContext` 与 main.tsx **共用同一判定**（原先首页规则只写在检测函数里，共用后不会再出现两套口径）。

### 2.2 我方按钮组不在首页显示

- `list-page-button-plugin.handle()` 增加守卫 `if (pageContext.isHomePage) return;`（保留原 `window.isListPage` 守卫）。
- 该按钮组只在 `handle()` 里创建（`createMenuBtn()` 仅此一处调用）✓ 一处守卫即全覆盖。
- **不影响**排序能力：`sortItems()` 独立于按钮组 DOM（读 `localStorage.jhs_sortMethod` + `.movie-list .item`），首页原先无手动排序入口，行为不变。

## 三、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `46bb57a`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bunx tsc -b` | 0 错误 |
| `bun run test` | **41 文件 / 419 用例全部通过**；`tests/page-context-home.test.ts` 4 → 7 用例，新增 `isJavdbHomePath` 三例（`/` 与空串为首页、四类非首页路径、与 `detectPageContext().isHomePage` 同源） |
| `bun run lint` / `check:structure` / `check:docs` | 0 告警；OK（391 文件 / 67 核心文件） |
| `check:selectors` | OK（86 文件 / 262 处；新选择器写入注册表，未新增裸字面量） |
| `check:version` / `bun run build` | OK（1.48.4 = 1.48.4）；产物 `@version 1.48.4` |

- **已知限制**：真机复测待你确认（本机无外网出口）。判定口径：首页工具栏里**不再有**「大封面/小封面」；首页主标签栏里**不再有**「新作品检测 / 加入黑名单」按钮组；其它列表页两者照旧。

## 四、按钮组的其它显示位置（回答"还有没有别处显示"）

**有，且是全部列表页** —— 它的门控是 `pageTypes: ['list']` + `window.isListPage`（首页也满足，这正是它在首页出现的原因）。
按 `docs/javdb-site-structure.md` 的页型（均含 `.movie-list`）推断覆盖面：

`/censored`、`/uncensored`、`/western`、`/anime`（分类列表页）、`/actors/{id}`（演员页）、
`/series/{id}`（系列页）、`/rankings/*`（榜单页）、`/users/*`（用户清单/想看/已看）、`/search?q=…`（搜索页）、
以及 `/tags*`（分类标签页，其中「加入黑名单」按钮另有专门逻辑）。

⇒ 因此**不建议直接删除**该组件：它在上述页面提供「新作品检测」「加入黑名单」等入口。本轮只按你的要求把它从**首页**摘掉；若要彻底删除，请先在这些页面确认不再需要，我再执行（删除范围会同时涉及组件文件、样式与 AGENTS/目录清单）。

## 五、风险提示（已按要求执行，供你复核）

站点原生「大封面 / 小封面」切换隐藏后，首页**没有**其它入口切换封面尺寸 —— 本脚本并无等价功能（只有 `replaceHdImg` 替换高清封面，不改布局尺寸）。
其余列表页不受影响，仍可切换。若你希望**所有列表页**都隐藏，把 `main.tsx` 里的首页条件去掉即可（一行），告诉我我来改。