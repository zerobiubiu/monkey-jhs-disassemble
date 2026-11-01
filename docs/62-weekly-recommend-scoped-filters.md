# 62 - 推荐浮层独立筛选与隐藏原生收起链接

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：首页推荐浮层、三套筛选组件及主页面筛选范围
> **前置文档**：[61](61-weekly-recommend-card-processing.md)
> **生效版本**：v1.48.12

## 1. 背景

用户要求隐藏 `#jhs-weekly-recommend-title > h1 > a` 的「收起到下次更新」，并在浮层中
加入现有过滤筛选器。现有三栏以 document 全局查询定位控件、统计与选中项，直接多建
一套会混淆主页面和推荐；仅复制控件也无法正确筛选推荐卡片。

## 2. 方案

- 原生链接仅通过标题作用域内的 CSS 隐藏，保留节点和监听，不点击、不写入站点持久收起状态。
  销毁后标题回原位置，作用域样式不再隐藏链接。
- 提取 `FilterScope` 契约与公共查询/挂载/显隐方法。三套已有筛选组件增加可选 scope 参数，
  旧无参 API 继续作用于主页面，并显式排除局部范围控件本体和后代，防推荐先建时误认主栏。
- 推荐筛选由独立协调器复用原组件，按清单、状态/星级、预加载顺序挂载；只使用推荐卡片
  计数与选中项，清单筛选模式也在本地实例内独立。推荐不重复构建全局「自动刷新」开关，
  不写共享 GM 配置、不重复绑定「请求列表」开关事件。
- 局部三栏分别维护 `data-video-lists-tag-hidden`、`data-status-tag-hidden`、
  `data-preload-hidden`，与基础 `data-hide`、`data-lrs-hidden` 合并决定显隐；清空一栏
  只清自身标记。销毁清理局部筛选标记，基础屏蔽继续保留。
- 观察推荐卡片中的状态/清单/徽标数据更新，合批刷新计数并保留激活条件；不观察筛选插槽
  自身，也不把 style/隐藏属性作为触发源，防止自循环。预加载配置 ready 与状态/评分索引
  更新事件处理异步就绪，不要求重新打开面板。
- 筛选插槽点击后合批重算其他栏的可见计数，例如清单筛掉的失败卡片不再计入预加载失败数；
  以显式操作事件触发，不增加对自身 style 的观察。
- 预加载栏仅在全局配置已读完且真实开关允许时构建，沿用 doc/61 未打开浮层不执行推荐
  预加载的调度逻辑。构建筛选 UI 不发起预加载请求。

## 3. 实施文件

| 文件 | 改动 |
|---|---|
| `src/types/filter-scope.ts` | 三栏共用的范围契约 |
| `src/core/util/site/filter-scope.ts` | 主页面/局部查询、挂载顺序和五种隐藏原因交集 |
| `src/plugins/list-page/weekly-recommend-filters.ts` | 复用三栏的生命周期与刷新协调 |
| `src/plugins/list-page/weekly-recommend.tsx`、`list-page-plugin.tsx` | 推荐接线、打开刷新、销毁 |
| `src/components/list-page/weekly-recommend-panel.tsx`、`src/styles/list-page/weekly-recommend.css` | 筛选插槽与间距、隐藏原生收起链接 |
| `src/plugins/status-tag-filter/stf-{ui,apply,collect,score}.ts`、`status-tag-filter-plugin.ts` | 状态/星级范围与数据刷新事件 |
| `src/plugins/video-lists-tag/vlt-{tags,filter-bar,filter-apply,plugin}.ts` | 清单范围、模式、计数、主栏存在性判断 |
| `src/plugins/other-site/osp-filter-bar.ts`、`other-site-plugin.tsx` | 独立预加载栏、真实配置 ready 与一次性请求列表事件 |
| `src/constants/weekly-recommend.ts` | 预加载配置及状态数据就绪事件 |
| `tests/weekly-recommend-{status-filters,vlt-filters,preload-filters,filter-integration}.test.ts` | 独立范围与真实组件组合回归 |
| `AGENTS.md`、`docs/plugin-catalog.md`、`docs/javdb-site-structure.md`、`docs/README.md` | 新模块职责、核心文件计数 68 → 69、现状与索引 |
| `package.json`、`vite.config.ts`、`CHANGELOG.md` | patch 同步至 1.48.12 |

新增文件均放入已有功能域目录，没有移动/删除源文件或拆分操作，没有超过 500 行软上限的
新增源码；保留全部此前未提交改动，未提交、推送、安装工具或脚本。

## 4. 后续真实页面验证建议

打开首页推荐，确认标题不再显示原生持久收起链接，三栏在推荐卡片之前；同时切换主页面
和推荐中的清单/状态/预加载芯片，确认各自计数与结果独立。检查多栏交集、逐栏清空、
动态推荐、评分加载、预加载进度及关闭重开时条件保留，再检查窄屏和暗色显示。

## 5. 执行验证记录

### 环境

Windows / PowerShell，master，基线 Git 提交 1ed968a，沿用既有未提交工作；项目现有
Bun、TypeScript、Vite 8.2.1、Vitest、ESLint、Stylelint，无安装或升级。

### 命令与实际输出

以下最终命令均实际执行并观察到退出码 0：

| 命令 | 实际输出 / 结论 |
|---|---|
| `bun run test` | `Test Files 56 passed (56)`；`Tests 623 passed (623)` |
| `bun run build` | `tsc -b && vite build` 通过；443 modules，产物 1,314.34 kB，gzip 339.57 kB |
| `bun run lint`、`bun run lint:css` | 无 errors/warnings 输出 |
| `bun run check:structure` | 400 文件 / 68 目录，0 file-ceilings、3 dir-ceilings，未抬高棘轮 |
| `bun run check:docs` | 43 plugins [5 flagged]，69 core files |
| `bun run check:selectors` | 82 files，245 literals，8 个文件低于基线；未修改基线 |
| `bun run check:version` | userscript 1.48.12 = package.json 1.48.12 |
| `git diff --check` | 无输出 |
| `impeccable.cmd detect --json`（本轮推荐组件、样式、筛选协调器） | `[]` |
| `Select-String -LiteralPath dist/monkey-jhs-disassemble.user.js -Pattern '^// @version'` | 第 4 行为 `// @version      1.48.12` |

新增 35 项回归：状态/星级 scope 8 项、清单 scope 9 项、预加载 scope 10 项、真实三栏
协调与原生链接隐藏 8 项。覆盖推荐先建后主栏正常出现、两区计数/选中互不影响、清单模式
独立、激活项零计数保留、多栏交集及基础屏蔽恢复安全、预加载配置/评分索引晚到、动态内容
保留选择且只合批刷新一次、筛选后可见计数重算、销毁解绑、隐藏原生链接且不触发其操作。

源码构建通过后递增 patch，再次构建并核验产物版本。构建继续出现第三方 layer.css
既有 IE hack 的 10 条容错提示，退出码 0；本轮 CSS 门禁与机械设计检测无告警。

### 结论与限制

本轮以合成 DOM、真实筛选组件和已有数据替身验证，不操作用户浏览器、不连接第三方站点；
没有实站视觉、真实账号或网络请求验收。AOCI MCP 工具仍未提供，未执行正式认知读取/维护，
未改写索引；该限制延续 doc/59–61。
