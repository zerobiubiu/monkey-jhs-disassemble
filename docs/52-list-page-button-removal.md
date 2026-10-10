# 52 - 删除列表页按钮组组件（ListPageButtonPlugin）

- **状态**：已执行
- **影响范围**：删除 `src/plugins/list-page-button-plugin.tsx`、`src/components/misc/menu-button-box-html.tsx`；修改 `src/plugins/list-page-plugin.tsx`、`src/plugins/{main-registry,page-sort-plugin}`、`src/main.tsx`、`src/plugins/plugin-registry.ts`、`docs/plugin-catalog.md`、`AGENTS.md`
- **前置文档**：doc/51（该组件在首页已被摘除）、doc/44（遗留死件裁决：本插件内的 `HAS_DOWN_TEXT` 本地残留）
- **生效版本**：v1.48.5（patch：删除已停用组件，无行为回退）

## 一、依据

doc/51 交付时报告了该按钮组在其它列表页的覆盖面（搜索/演员/系列/榜单/用户/标签等）。用户实机验证：**这些位置都没有显示**（系其本人早前主动关闭，细节已不可考），并确认"这个组件可以彻底删除了，不用了"。

按仓库「零引用即死件」口径先做引用盘点，结果：组件文件本体、模板组件、注册项与内部调用构成闭环，删除后无外部依赖（详见 §三）。

## 二、删除范围与能力影响

**删除**：

| 对象 | 说明 |
|---|---|
| `src/plugins/list-page-button-plugin.tsx` | 插件本体：按钮组渲染（`createMenuBtn`/`bindEvent`）、`openWaitCheck`/`openFavorite` 批量打开、排序循环按钮的 `jhs_sortMethod` 写入 |
| `src/components/misc/menu-button-box-html.tsx` | 按钮组模板（React → `jsxToString`），仅被上述插件引用 |
| 注册与类型 | `main.tsx` 的 import + `manager.register(ListPageButtonPlugin)`；`plugin-registry.PluginMap` 条目 |
| 计数 | 插件 44 → 43（JavDB 39 → 38；§1.1 主脚本拆分 22 → 21）；组件 140 → 139 |

**保留（迁走，行为不变）**：

- `sortItems()`（依 `localStorage.jhs_sortMethod` 重排列表项）**迁入 `list-page-plugin`** —— 它的唯一活调用点就是 `list-page-plugin.checkDom()` 的容器观察回调。
  迁入时把两处站点选择器改为注册表取用（`siteSelector('list')` / `siteSelector('listItem')`），符合「新增选择器必须走注册表」的门禁口径。
- `waitCheckCount` 设置项：仍被设置面板（`base-panel.tsx`、`setting-form-load.ts`）与 `page-count-table.tsx`（`currentPageWaitCheckCount` 统计）读取，**未变成孤儿**，故保留。
- `.jhs-toolbar-menu-btn` 样式：与详情页按钮组（`components/dpb/detail-menu-buttons.tsx`）共用，**保留**（未发现本按钮组专属 CSS 规则）。

**随之消失的能力**（用户确认无需）：列表页顶部的「打开待鉴定」「打开已收藏」「新作品检测」「演员黑名单」「加入黑名单」「排序切换」六个入口，以及它们的批量打开逻辑。

## 三、引用盘点（删除前）

| 检查 | 结果 |
|---|---|
| `getBean('ListPageButtonPlugin')` | 仅 `list-page-plugin.tsx:192`（`sortItems`）→ 已迁走 |
| `MenuButtonBoxHtml` / `menu-button-box-html` | 仅该插件引用 → 随文件删除，零残留 |
| 测试引用 | 无 |
| `.jhs-toolbar-menu-btn` 等 class | 详情页按钮组仍在用 → 样式保留 |
| `HAS_DOWN_TEXT` | 该插件内的**本地残留常量**随文件消失；`constants/status.ts` 与 FC2 详情弹窗中的同名常量与本组件无关，保留 |

## 四、执行验证记录

- **执行环境**：Windows 10.0.26300 x64；bun；分支 `master`；基线 `029770d`。
- **命令与输出**：

| 命令 | 结果 |
|------|------|
| `bunx tsc -b` | 0 错误（删除后由类型系统兜住注册表/导入残留） |
| `bun run test` | **41 文件 / 419 用例全部通过**（无用例引用该组件，计数不变） |
| `bun run lint` | 0 告警 |
| `bun run check:docs` | OK（**43 插件** [5 flagged]，67 核心文件）—— 门禁双向比对 `main.tsx` 注册集合与 catalog §1 清单 |
| `bun run check:structure` | OK（389 文件 / 68 目录；少 2 个文件） |
| `bun run check:selectors` | 迁入的排序代码改为注册表取用后 OK；删除文件使字面量下降，基线随之**收紧**到 85 文件 / 258 处 |
| `bun run build` | 通过，产物 `@version 1.48.5` |

- **残留检查**：`grep ListPageButtonPlugin|MenuButtonBoxHtml` 仅剩注释级说明（已同步为历史说明），无代码引用。

## 五、遗留与后续

1. `jhs_sortMethod` 现已**无写入方**（原由被删的排序按钮写入）→ `sortItems()` 只对历史上已设置该键的用户继续生效；该键仍在备份白名单（`backup-extra-storage.ts`）中。若之后确认连排序也要一并移除，删 `sortItems()` 与其调用点即可（一行调用 + 约 60 行方法）。
2. 若将来需要恢复「批量打开待鉴定/已收藏」能力，应从 `list-page-plugin` 或批量栏（`lp-batch`）另建入口，而不再恢复本插件（其六按钮聚合的形态与现行筛选栏布局冲突，正是 doc/48–51 一路收敛掉的东西）。