# 49 - 筛选栏挂载点（目标 + 方位）：修首页布局错乱

- **状态**：已执行
- **影响范围**：`src/core/util/site/{list-mount,selectors}.ts`、`src/plugins/status-tag-filter/{stf-ui,..}`、`src/plugins/status-tag-filter-plugin.ts`、`src/plugins/video-lists-tag/vlt-filter-bar.ts`、`scripts/site-selector-baseline.json`
- **前置文档**：doc/48（挂载锚点单点化）
- **生效版本**：v1.48.2（patch）

## 一、现场：修好了"不显示"，但换来了"错乱"

装 v1.48.1 后实测：`{ver:'1.48.1', ml:1, tabs:1, stfBar:true, vltBar:true, batchSide:true}` ——
两根栏都挂上了（doc/48 的目标达成），但页面**布局错乱**。

根因是 doc/48 里我新加的「宽松式标签栏」这一级回退：首页那个 `.tabs.is-boxed`（计数 1）
**嵌在影片卡片网格内部**，而两处插入逻辑都是「插在锚点之后」（`insertAdjacentElement('afterend')`）
→ 两根栏被插进网格，成了网格项，于是整块列表塌掉。

同时暴露出第二个问题：**插入方位这条规则被复制了两份** ——
`stf-ui.doBuild()` 用 `mountTarget.matches('.jhs-vlt-filter-bar, .actor-tags.tags, .tabs.is-boxed')`
判断「插其后还是插其前」，而 `vlt-filter-bar` 无条件「插其后」。口径一分叉，同类问题就会复发。

## 二、实现（挂载点 = 目标 + 方位）

1. `list-mount.ts` 的类型由「元素」升级为**挂载点**：

   | 顺序 | 锚点 | 方位 | 说明 |
   |---|---|---|---|
   | 1 | 演员页标签区 | `afterend` | 演员页既有位置 |
   | 2 | 结构式筛选标签栏 | `afterend` | 清单/搜索/系列等既有页面保持既有位置 |
   | 3 | **影片列表容器** | `beforebegin` | **新增**：与列表同层兄弟 → 绝不会落进网格 |
   | 4 | 页面容器（内层 → 外层） | `afterbegin` | 无列表容器时挂到顶部 |

   导出 `findListMountPoint(pathname?)` 与 `applyListMountPoint(mount, bar)`。
2. **删除宽松式键** `tabsBoxedLoose`（正是它把插入点带进网格的那一级），注册表回到结构式 + 容器兜底。
3. `stf-ui`：删除 `doBuild` 里那份 `matches(...)` 方位判断，改调 `applyListMountPoint`；
   `findMountTarget()` → `findMountPoint()`（优先邻接清单标签栏，否则共享锚点）。
4. `status-tag-filter-plugin`：`tryBuild()` 与 10s 超时强挂改走挂载点 API
   （超时兜底 = `{target: document.body, position: 'afterbegin'}`）。
5. `vlt-filter-bar.buildFilterBar()`：同样改走挂载点 API。

结果：**两根栏都落在影片列表正上方、与列表同层**，插入方位由挂载点统一决定 —— 规则只剩一份。

## 三、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `3fd618c`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bunx tsc -b` | 0 错误（挂载点 API 在两处调用方全部改到位） |
| `bun run test` | **41 文件 / 413 用例全部通过**；`tests/list-mount.test.ts` 重写为 6 用例，含两条现场回归：「首页形态（标签栏嵌在网格内、结构式命中 0）→ 锚在列表之前」与「插入后筛选栏与列表同层、`list.contains(bar) === false`」 |
| `bun run lint` / `check:structure` / `check:docs` | 0 告警；OK（391 文件 / 67 核心文件） |
| `check:selectors` | OK；删除宽松式键后**再次收紧**基线到 86 文件 / 267 处 |
| `check:version` / `bun run build` | OK（1.48.2 = 1.48.2）；产物 `@version 1.48.2` |

- **验证结论**：挂载点与方位由单一函数决定，且「不落进网格」有断言保护；四门禁与构建通过。
- **已知限制**：真机复测待做（本机无外网出口）。判定口径：两根栏应出现在**影片列表上方**且
  页面其余部分布局不受影响。

## 四、经验（写进规则，避免复发）

1. **插入方位与锚点必须同源**：只要有两个调用点各自判断"插前还是插后"，就一定会分叉。
2. **结构性选择器不可用宽松式兜底**：宽松式命中的元素可能在完全不同的布局上下文里；
   正确的兜底是"换一个语义等价的锚点"（这里是从标签栏换到影片列表本身），而不是"同一语义换松选择器"。
3. 挂载类改动必须配"插入后同层/不在网格内"的断言 —— 只断言"元素存在"挡不住本次这类问题
   （doc/48 的用例正是只断言了目标元素，才让错乱漏到真机）。