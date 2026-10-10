# 48 - 列表页筛选栏挂载锚点单点化（首页清单标签栏不显示）

- **状态**：已执行
- **影响范围**：`src/core/util/site/{selectors,list-mount}.ts`、`src/plugins/status-tag-filter/stf-ui.ts`、`src/plugins/video-lists-tag/{vlt-filter-bar,vlt-plugin}.ts`、`src/plugins/list-page-plugin.tsx`、`scripts/site-selector-baseline.json`
- **前置文档**：doc/47（首页显示过滤/筛选组件）、doc/22（站点选择器注册表）
- **生效版本**：v1.48.1（patch：修挂载回退，无新增功能面）

## 一、现场数据与诊断

装 v1.48.0 后在 `https://javdb.com/` 实测（控制台单表达式）：

```json
{ "path": "/", "ml": 1, "items": 40, "tabs": 1,
  "stfBar": true, "vltBar": false, "batchSide": true, "jhsEls": 340 }
```

即：首页是列表页、容器与 40 张卡都在、**状态标签芯片栏已挂上**、批量栏已挂上，
**只有「清单标签筛选栏」没挂**。定位到两处挂载链的差异：

| 位置 | 原挂载链 | 首页结果 |
|---|---|---|
| `status-tag-filter/stf-ui.findMountTarget()` | `.jhs-vlt-filter-bar` → 演员标签区 → **结构式**筛选标签栏 → 内层容器首子元素 → 外层容器首子元素（+ 插件内 10s 强挂） | 命中（走兜底） |
| `video-lists-tag/vlt-filter-bar.buildFilterBar()` | **只有结构式** `body > section > div > div.tabs.is-boxed` 一条，命中 0 即 `return` | 静默不挂 |

配合实测 `document.querySelectorAll('.tabs.is-boxed').length === 1` 但
`document.querySelectorAll('body > section > div > div.tabs.is-boxed').length === 0`
（首页该元素不在标准层）→ 结论：**清单标签栏缺的正是回退链**。

## 二、实现

1. **共享单点** `src/core/util/site/list-mount.ts`：`findListMountTarget(pathname?)`，
   顺序为「演员页标签区 → 结构式筛选标签栏 → 宽松式筛选标签栏 → 内层容器首子元素 →
   外层容器首子元素 → null」。两处栏共用同一锚点，因此两根栏始终相邻
   （后挂的插在已挂栏之后）。全部选择器取自注册表，模块内不持有站点字面量。
2. **注册表新增 3 键**（`selectors.ts`）：`tabsBoxedLoose`、`sectionList`、`sectionListInner`
   （演员页标签区复用既有 `actorTags`）。
3. **两处改用共享单点**：`stf-ui.findMountTarget()` 保留「优先 `.jhs-vlt-filter-bar`」的
   相邻语义后委托；`vlt-filter-bar.buildFilterBar()` 改调共享函数（删掉只认结构式的那条链）。
4. **挂载重试**：`vlt-plugin.setupItemObserver` 在列表发生变更且清单标签栏仍缺席时重试
   `buildFilterBar()` —— 覆盖「锚点晚于首屏出现」的页面，避免整轮不显示。
5. **顺带修正**：`list-page-plugin.checkDom()` 的守卫仍是 `window.isListPage`（doc/47 只改了
   `doFilter` 与三个组件），改为 `isVideoListContext()`；容器缺失时由 `clog.error`
   降为 `clog.debug`（首页/改版页没有该容器不应刷错误日志）。

## 三、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `566de43`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bun run test` | **41 文件 / 412 用例全部通过**（新增 `tests/list-mount.test.ts` 5 用例，含「标签栏嵌在别处 → 宽松式命中」这条首页回归） |
| `bunx tsc -b` | 0 错误（过程中发现新增键与既有 `actorTags` 重名，已改为复用既有键） |
| `bun run lint` / `bun run check:structure` | 0 告警；OK（391 文件 / 68 目录） |
| `bun run check:docs` | OK（44 插件 [5 flagged]，**67 核心文件**） |
| `bun run check:selectors` | OK；改后两文件低于基线，已执行 `--update-baseline` **收紧**到 87 文件 / 268 字面量 |
| `bun run check:version` | OK（userscript 1.48.1 = package.json 1.48.1） |
| `bun run build` | 通过，产物 `@version 1.48.1` |

- **验证结论**：挂载回退链与「结构式命中 0 时仍能找到锚点」已由用例固化；四门禁与构建通过。
- **已知限制**：**真机复测待做** —— 本机无外网出口，无法在 javdb.com 首页确认 `vltBar` 变为
  `true`。请装 v1.48.1 后在同一页跑 doc/47 §六 那条单表达式，`vltBar: true` 即闭环。

## 四、后续建议

- 若真机复测发现两根栏位置不理想（例如都落在兜底容器处），把首页真实层级补进注册表
  （`tabsBoxedLoose` 之上再加一条结构式锚点）即可，无需改调用方 —— 这正是把锚点收成单点的收益。
- 遗留项 #1/#4/#5/#7 与 FC2 前缀、缓存键三表派生仍按 doc/47 §3.2 的顺序推进。