# 50 - 三根筛选栏的顺序权威（统一栈容器 + 优先级）

- **状态**：已执行
- **影响范围**：`src/core/util/site/list-mount.ts`、`src/plugins/status-tag-filter/{stf-ui,..}`、`src/plugins/status-tag-filter-plugin.ts`、`src/plugins/video-lists-tag/vlt-filter-bar.ts`、`src/plugins/other-site/osp-filter-bar.ts`、`scripts/site-selector-baseline.json`
- **前置文档**：doc/48（挂载锚点单点化）、doc/49（挂载点 = 目标 + 方位）
- **生效版本**：v1.48.3（patch）

## 一、现象与根因

doc/49 之后布局正常了，但**三根筛选栏的顺序错了**：正常应为
**筛选（清单标签）→ 状态（状态标签芯片）→ 预加载（外站预加载）**，
实测首页被挂成 **状态 → 预加载 → 筛选**（筛选落到最后）。

根因：三根栏**各自**解析锚点直插，而插件由 `processPlugins` 并发执行，顺序取决于挂载先后：

| 栏 | 原锚点策略 | 结果 |
|---|---|---|
| 清单标签栏（筛选） | 结构式标签栏之后，否则**影片列表之前** | 紧贴列表 → 排最后 |
| 状态标签栏（状态） | 清单标签栏之后，否则站点锚点 | 插在列表之前的位置 |
| 预加载栏 | 另有一份链：`.status-tag-filter-bar` → `.jhs-vlt-filter-bar` → 结构式 → 容器，且 `ensureFilterBar` 会**主动把本栏搬到状态栏之后** | 插到状态栏后 → 中间 |

即：**插入方位同一份规则被复制了三遍**（doc/49 已指出两遍，这是第三遍），谁先谁后就听命于并发调度。

## 二、实现：栈容器 + 优先级

`list-mount.ts` 增加「顺序权威」：

| 导出 | 作用 |
|---|---|
| `FILTER_STACK_CLASS`（`jhs-filter-stack`） | 三根栏统一的容器类名 |
| `FILTER_BAR_PRIORITY` = `{ vlt: 10, status: 20, preload: 30 }` | **唯一顺序表**：筛选 → 状态 → 预加载 |
| `ensureFilterStack()` | 取回或按挂载点创建栈容器（无锚点返回 null） |
| `mountFilterBar(bar, priority)` | 按优先级插入：插在第一个优先级更大的兄弟之前，否则追加 |

三处调用方全部改走 `mountFilterBar`，并删除各自的邻接/搬动逻辑：

- `vlt-filter-bar.buildFilterBar()` → `mountFilterBar(bar, FILTER_BAR_PRIORITY.vlt)`；
- `stf-ui.doBuild(mount?)` → 缺省入栈（`status`），**仅超时兜底**才直挂（保留原有 10s 强挂；
  此时若有锚点则走入栈、连锚点都没有才直挂 body 顶部）；
- `osp-filter-bar` → 删除整条 `findFilterMountTarget()` 与 `ensureFilterBar` 里的「搬到状态栏之后」，
  改为 `mountFilterBar(bar, FILTER_BAR_PRIORITY.preload)`；`ensureFilterBar` 只保留「缺则建 + 刷新芯片」。

容器本身挂在 doc/49 的挂载点上（首页 = 影片列表之前），因此**顺序与位置都不再依赖挂载先后**。

## 三、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `05e4aae`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bunx tsc -b` | 0 错误（过程中发现 `stf-ui` 多引入一个未用符号，已删） |
| `bun run test` | **41 文件 / 416 用例全部通过**；`tests/list-mount.test.ts` 增至 9 用例，新增三条顺序回归：**逆序挂载仍得「筛选→状态→预加载」**、栈容器只建一次且与列表同层、无锚点时不建空容器 |
| `bun run lint` / `check:structure` / `check:docs` | 0 告警；OK（391 文件 / 67 核心文件） |
| `check:selectors` | OK；删除预加载栏那份重复链后**再次收紧**基线到 86 文件 / 262 处 |
| `check:version` / `bun run build` | OK（1.48.3 = 1.48.3）；产物 `@version 1.48.3` |

- **已知限制**：真机复测待你确认顺序（本机无外网出口）。
- **判定口径**：首页自上而下应为 **筛选 → 状态 → 预加载**，三栏在影片列表上方同一区域内。

## 四、经验（并入 doc/49 §四 的同一条规则）

> **顺序也是挂载的一部分**：只要「谁插在哪」由多个调用方各自决定，并发执行下顺序必然随机。
> 凡是共享同一位置的 UI，都应有一个显式的顺序表（此处 `FILTER_BAR_PRIORITY`）与唯一的入栈入口；
> 调用方只声明自己的优先级，不解析邻居。