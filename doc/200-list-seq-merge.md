# 200 - 详情页清单面板「序号清单合并 + 自动 Overflow」

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

视频详情页的清单平铺面板（`.jhs-list-panel`）逐条列出用户全部自建清单。当用户按
「文字+序号」习惯维护同一类清单（如 `等待更新1`/`等待更新2`、`迫切想看1/2/3`）时，
面板被大量同源清单占据，且 JavDB 单清单上限 501 部，满了需手动新建下一个序号清单并
重新勾选，操作繁琐。

需求：把同前缀的序号清单在面板里**合并为一行**；勾选时脚本**自动**把当前影片放入
JavDB 服务端最靠前的未满清单（按末尾序号 1→2→3 优先），满 501 顺延，全满则**自动
新建**下一序号清单。

## 2. 现状可复用能力

| 能力 | 位置 | 复用方式 |
|------|------|----------|
| 清单分页抓取 | `dpb-list-panel-fetch.ts`（`/users/simple_lists?vid=`） | 面板已聚合全部清单，分组数据源完整 |
| 条目结构化 | `dpb-list-panel-render.tsx` `createListPanelEntry` | 每条已解析 `data-list-id`/`data-list-name`/数量 |
| 加入/移除链路 | `dpb-list-panel.tsx` `forwardListPanelChange` | 勾选→按 listId 定位原生 checkbox→`dispatchEvent(change)`，由 JavDB 原生完成服务端写入 |
| 满员判定 | `updateListPanelEntryState` `count >= 501 && disabled` | 印证 501 上限；满员站点自行禁用 checkbox |
| 新建清单 | `video-lists-tag/vlt-create-list-api.ts` `createList` | `POST /lists/remote_create` + CSRF + 多级兜底定位新 checkbox；`finishCreateList` toast 明确「并已关联当前影片」，**建清单自动关联当前影片** |
| 面板刷新 | `vlt-helpers.ts` `refreshListPanel` → `panel.__jhsRefresh` | `createList` 完成后自动重渲染面板，overflow 无缝衔接 |

**架构洞察**：路由不依赖成员行是否渲染——`forwardListPanelChange` 始终基于常驻隐藏的
原生 `#modal-save-list [data-list-target="listContainer"]` 按 listId 定位。合并模块只需
保存成员 `{listId, 序号, count, checked, disabled}` 元数据即可路由。

**createList 复用决策**：VLT 的「新增清单」UI 本就挂在详情页清单面板上，`createList`
在详情页语境已验证安全，故**直接 import 复用，不上移 core**（避免 VLT 回归风险）。

## 3. 方案

### 3.1 分组规则（`*d`）

正则 `^(.+?)(\d+)$`（用户可在设置自定义）：
- `等待更新2` → base=`等待更新` / num=`2`；`ABC123` → base=`ABC` / num=`123`。
- base 全数字（纯数字清单名如 `2024`）不参与合并。
- **D1=A**：单个序号清单（仅 `等待更新1`）也按 base 展示，overflow 行为统一。
- 裸名（完整名 == 某组 base，如单独的 `等待更新`）吸收为该组 num=0 成员（最优先）。
- **D5=B**：设置「不参与合并的清单名」，完整名或 base 命中即回退为原名单条。

### 3.2 加入路由

勾选合并行 → 组内已有成员含此片则提示「已在组中」（幂等）；否则按序号升序取第一个
**未满（count<501 且非禁用）且未含片**的成员，转发原生勾选；全满则 `createList(base+最大序号+1)`
自动新建（已自动关联当前影片），完成后重渲染。

### 3.3 移除路由（D2=A）

取消勾选合并行 → 从组内**所有含片成员**串行移除（相邻 change 间隔 220ms，避免 JavDB
ajax 竞态）。

### 3.4 展示

合并行复用 `.jhs-list-item` 结构与 `__status[data-state]` 状态样式：名称=base、数量丸=
组成员总数、勾选态=任一成员含片、**D4=B 半选态**（部分含片时 `indeterminate`，虚线边框）。
合并行附「▸ N 个清单」展开明细（各成员序号/名称/数量/已含/已满）与「整理」按钮。

### 3.5 「整理」（可选增强 2，受数据范围约束）

详情页 `/users/simple_lists?vid=` 仅返回**当前影片**的清单归属与各清单总数，**无法获知
其他影片在各清单的分布**，故跨影片回填不可行（属未来清单页功能）。本版「整理」实现为
**当前影片在组内的去重收敛**：若当前影片同时占组内多个清单，移除其余、仅保留最靠前的
未满清单。

### 3.6 设置项（D3=A）

基础配置面板新增「清单收藏合并」分区：
- `listMergeEnabled`（开关，默认开启）
- `listMergePattern`（自定义正则，留空用默认；可选增强 3）
- `listMergeExcludeNames`（逗号分隔排除名，D5）

存储于 `settingObj`（`Setting` 为开放索引签名，无需改类型），`saveForm` 后 `refresh()`
重载生效。

## 4. 实施

### 4.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/detail-page-button/dpb-list-merge.ts` | **新增** 纯逻辑：`parseListName`/`compileMergePattern`/`isMergeExcluded`/`buildMergeConfig`/`groupEntries`/`isMemberFull`/`sortMembersByNum`/`pickTargetMember`/`nextListName`/`computeGroupCheckState` + 类型与常量（`DEFAULT_LIST_MERGE_PATTERN`/`LIST_FULL_THRESHOLD=501`） |
| `src/plugins/detail-page-button/dpb-list-merge-ui.ts` | **新增** DOM 与路由：`loadListMergeConfig`/`buildMergedRow`/`buildListPanelRows`/`refreshMergedRowDisplay`/`forwardListGroupChange`/`reflowGroup`/`toggleGroupDetail`/`syncMergedRowsForListId`；复用 VLT `createList` 与 `util-misc.sleep` |
| `src/plugins/detail-page-button/dpb-list-panel.tsx` | `renderListPanel` 注入 `buildListPanelRows` 分组；`forwardListPanelChange` 顶部识别合并行转路由；`syncListPanelInputState` 增 `syncMergedRowsForListId`；`bindListPanelControls` 增展开/整理点击委托 |
| `src/plugins/detail-page-button-plugin.tsx` | 新增 `_listMergeConfig` 字段（默认关闭直至加载）；`handle()` 详情页分支 `await loadListMergeConfig()` |
| `src/components/setting-panels/base-panel.tsx` | 新增「清单收藏合并」分区（开关 + 正则 + 排除名） |
| `src/plugins/setting/setting-form-load.ts` | `loadForm`/`saveForm` 增 3 个字段读写（排除名以 `string[]` 持久化） |
| `src/styles/rating-bar.css` | 合并行样式（`__bar`/`__toggle`/`__reflow`/`__detail`/`__member*` + `indeterminate` 虚线边框），复用既有调色板，无 `transition: all` |
| `tests/dpb-list-merge.test.ts` | **新增** 33 个纯逻辑单测（解析/容错/排除/配置/归组/满员/选取/命名/勾选态） |
| `vite.config.ts` | version `1.30.4` → `1.31.0`（新增功能模块，minor+1） |
| `doc/README.md` | 阅读顺序追加 200 + 进度概览文档计数更新 |
| `changelog/CHANGELOG.md` | 新增 v1.31.0 |
| `AGENTS.md` | DetailPageButtonPlugin 模块登记新增 2 模块 |

### 4.2 零硬编码 HTML 说明（§9.7）

合并行 DOM 以 `document.createElement` 命令式构建，与同模块既有 `createListPanelEntry`
完全一致（createElement 等价 API，非字符串字面量 UI 模板），不作违规。

## 5. 执行验证记录

### 构建

```
$ bun run build
$ tsc -b && vite build
✓ 382 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,094.88 kB │ gzip: 484.49 kB
✓ built in 1.54s
```

`tsc -b` 零错误；lightningcss 的 `Unexpected token Semicolon` 告警全部来自 `layer.css`
IE hack（`*display:inline`/`*zoom:1`），为 `errorRecovery:true` 预期容错，非本次引入。

### 测试

```
$ bun run test
 Test Files  5 passed (5)
      Tests  95 passed (95)
```

新增 `dpb-list-merge.test.ts` 33 用例全绿（含一处测试断言修正：自定义正则
`^(.+?)-p(\d+)$` 对 `收藏-p2` 的 base 为 `收藏`，`-p` 为字面量被消耗）。

### Lint

- `bun run lint`（ESLint）：0 errors / 0 warnings（基线保持）。
- `bunx stylelint src/styles/rating-bar.css`：通过。
  （`bun run lint:css` 全量报 `fold-category-plugin.css` 2 处
  `__HIGHLIGHTED_TAG_NUMBER__` 占位符错误，为既有基线，非本次改动文件。）

### 版本号

`vite.config.ts` `1.30.4` → `1.31.0`，产物 userscript 头部 `@version` 一致。

## 6. 后续验证建议（需登录 JavDB 人工验证）

1. 详情页打开清单面板，确认 `等待更新1/2` 合并为「等待更新」一行，数量丸显示组内总数。
2. 勾选合并行 → 当前影片加入序号最小且未满的清单；展开明细核对「已含」标记。
3. 将某清单加满至 501（或构造禁用态）→ 勾选合并行验证顺延到下一序号清单。
4. 组内全满 → 勾选验证自动新建 `等待更新N` 且当前影片已关联。
5. 取消勾选 → 验证从组内所有含片清单移除。
6. 「整理」→ 当前影片占多清单时收敛到最靠前；占单清单时提示无需整理。
7. 设置：关闭开关 / 改正则 / 填排除名（如 `Top10`）→ 保存刷新验证生效。
8. 半选态：当前影片仅在组内部分清单时，合并行呈虚线边框半选。

## 7. 用户试用验证（2026-07-27）

用户登录 JavDB 实测后反馈：「详情页版本我已经试过了，功能逻辑没啥问题」。合并展示、
勾选路由、批量移除、自动新建等核心路径均符合预期。跨影片回填（清单页版）属独立
后续功能，见本 doc §3.5 与 §6 说明，尚未实施。
