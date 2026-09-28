# 「加载全部」并入左侧常驻竖排栏（同风格 + 主色区分）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：AutoPagePlugin 的「加载全部」按钮挂载位置与配色；列表页左侧竖排栏结构（新增选择组槽位）
> **前置文档**：`33-batch-ui-layering.md`
> **替代文档**：无
> **生效版本**：v1.46.28

## 1. 需求

> 「有一个加载全部按钮，也并入这几个按钮中同样的风格显示（颜色要有点区别）」

即：把 AutoPagePlugin 的「加载全部」从**独立浮层**（左下角渐变药丸）迁入列表页左侧常驻竖排栏，
与「请求列表 / 全选 / 反选 / 清空」同风格，但**配色要有区别**。

## 2. 方案

### 2.1 侧栏「只渲染一次」+ 停靠按钮插到组内第一位（结构前提）

侧栏原本每次刷新都整容器重写 `innerHTML` —— 任何**停靠**进来的按钮都会被冲掉。
但现在选择组是**静态结构**（只有「清空」的可用性会变），所以改为：

```html
<div class="jhs-lp-batch-side">                       <!-- 固定定位列（同一组） -->
  <button class="jhs-load-all-btn is-docked">加载全部</button>   <!-- 停靠方 prepend，组内第一位 -->
  <button data-act="request-list">请求列表</button>
  <button data-act="select-all">全选</button>
  <button data-act="invert">反选</button>
  <button data-act="clear">清空</button>
</div>
```

- `ensureBatchSideBar(container)`：**仅首次**（选择组缺失时）写入四键，之后只同步「清空」禁用态 ——
  **不再重写 DOM**，因此停靠按钮可长期存活（有回归测试锁定）；
- 停靠方用 `container.prepend(btn)` 插到**组内第一位**（用户明确要求），
  并用 CSS `order: -1` 双保险保持首位；
- 容器类名 `BATCH_SIDE_CLASS` 由 `list-page/lp-batch` 导出，停靠方导入常量而非硬编码字面量。

### 2.2 「加载全部」停靠逻辑（auto-page 侧）

`createLoadAllBtn` 改为：

1. 以 `<button type="button">` 创建（原为 `<div>`，改为按钮以获得原生键盘可达）；
2. 追加到 `document.body`（**先保留原浮层形态**，避免竞态期间按钮消失）；
3. 调 `dockLoadAllBtn(plugin)`：查找 `.jhs-lp-batch-side` → 命中则 `prepend` 并加 `is-docked`；
4. **未命中则重试**（`LOAD_ALL_DOCK_RETRIES = 10` × `300ms`，走 `plugin.supervisor` 定时器）——
   两个插件启动存在竞态（侧栏由 ListPagePlugin 异步创建）；重试耗尽则**保留浮层形态**（优雅降级）。

`hideLoadAllBtn` / `updateLoadAllBtn` / `loadAllPages` 逻辑不变（`remove()` 与 `textContent` 与挂载位置无关）。

### 2.3 配色：几何复用 + 仅覆写颜色

| 形态 | 几何 | 配色 |
|---|---|---|
| **停靠**（`.is-docked`） | **显式复位为流内几何**（`position: static; inset: auto; width: 100%` + 紧凑尺寸）—— 不依赖浮层规则被 `:not()` 排除 | **主色实底** `--jhs-color-primary` + 白字；hover 转 `--jhs-color-primary-hover` —— 与旁边**中性色**的选择组明确区分 |
| **浮层**（`:not(.is-docked)`，降级路径） | 原样保留（左下角、20px 圆角、渐变） | 原样（唯一被许可的装饰性渐变） |

**为什么停靠形态要显式复位几何**：父容器 `.jhs-lp-batch-side` 带 `transform`（`translateY(-50%)`），
若按钮残留 `position: fixed`，它会以**容器**为包含块定位 → 正好压在下面几个选择按钮上并错位
（实测反馈的「被选择按钮盖在下边、还不对齐」即此）。不依赖「基础规则恰好被排除」，直接复位才稳。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/list-page/lp-batch.tsx` | 导出 `BATCH_SIDE_CLASS` / `BATCH_SIDE_SLOT_CLASS`；新增并导出 `ensureBatchSideSlot`；`renderSideBar` 改为「容器 + 槽位」 |
| `src/plugins/auto-page/ap-scroll.ts` | `createLoadAllBtn` 改 `<button>` + 先挂 body 再停靠；新增 `dockLoadAllBtn`（带重试/降级）；导入 `BATCH_SIDE_CLASS` |
| `src/plugins/auto-page-plugin.ts` | `loadAllBtn` 类型 `HTMLDivElement` → `HTMLButtonElement` |
| `src/styles/auto-page-plugin.css` | 浮层样式限定 `:not(.is-docked)`；新增 `.is-docked` 配色覆写 |
| `src/styles/list-page/lp-batch.css` | 新增 `.jhs-lp-batch-side-select`（槽位纵向布局） |
| `tests/lp-batch-delegation.test.ts` | **新增** 3 用例：槽位创建/首子节点、**重复刷新不冲掉停靠按钮**、停靠按钮仍在白名单内 |

## 4. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**30 文件 / 318 用例**（新增 3） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 5. 真实浏览器验证建议

1. 开启瀑布流（autoPage）且有下一页时：列表页左侧竖排栏出现第 5 枚按钮「加载全部」，
   与前 4 枚**同宽同高、同一列**，配色为**主色实底**（其余为白底灰字）。
2. 勾选/取消卡片（触发侧栏刷新）→ 「加载全部」**不消失、位置不变**。
3. 点「加载全部」→ 文案变「加载中...（第 N 页）」、按钮变禁用态；加载完变「✓ 已全部加载」后淡出移除。
4. 关闭瀑布流（设置面板）→ 按钮移除；重新开启 → 重新出现且停靠在栏内。
5. 若侧栏因故不存在（如关闭了预加载筛选栏导致 ListPagePlugin 未建侧栏）→ 按钮保留**左下角浮层形态**（降级）。

## 6. 已知限制

- 停靠依赖 `.jhs-lp-batch-side` 存在：该容器由 ListPagePlugin 创建，若页面不是列表页或插件未激活，
  则退回浮层形态（已实现降级 + 重试，不报错）。
- 两插件之间通过**类名常量 + DOM**耦合（不是 import 业务逻辑），新增停靠方需同样导入
  `BATCH_SIDE_CLASS` 并自备 `is-docked` 配色。
- 停靠按钮与选择组共用列宽：列宽由最宽按钮（「加载全部」4 字）决定，其余按钮等高拉伸对齐。