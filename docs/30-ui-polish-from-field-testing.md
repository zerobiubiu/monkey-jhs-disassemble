# 实测反馈打磨：请求列表入口/浮层、星级芯片口径、勾选与批量操作

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：预加载请求列表（入口按钮 + 浮层）、状态标签筛选的星级芯片、列表页批量操作 UI
> **前置文档**：`26-preload-request-list-panel.md`、`27-list-batch-actions.md`
> **替代文档**：无
> **生效版本**：v1.46.22

## 1. 来源：用户实测反馈三条

1. **请求列表按钮**：位置没问题，但与筛选器**缺少明确的风格与界限区分**；打开的面板位置不行 —— 应在**屏幕正中**，最好还能**拖动**。
2. **状态标签筛选**：星级档位应当和「已观看 / 已收藏 / 无状态标签」一样**当前页有什么显示什么**，而不是把 0–5 全铺开。
3. **卡片勾选框**：选中**没有明确 UI 响应**（勾选框看不到对号）；**没有批量选择手段**（只能挨个点）；弹出操作框虽然可用，但**操作按钮没有颜色区分**，操作起来不清晰。

## 2. 依据（impeccable + 本项目 DESIGN.md）

按 `impeccable` 的 `polish` 流程执行：`impeccable context` 载入 PRODUCT.md / DESIGN.md，
再读 `reference/craft-floor.md` 与 `reference/polish.md` 作为质量地板与打磨顺序。
本次属于**refinement**（保留既有视觉世界，只修局部缺陷），因此逐条对齐既有规范而非另立风格：

| 反馈 | DESIGN.md 依据 |
|---|---|
| 按钮要与芯片区分 | 「药丸 `50rem`：**只给筛选芯片与下拉选择器**」→ 入口按钮必须是**非药丸**的硬按钮（4px 圆角，紧凑按钮档） |
| 浮层居中 | 「浮层面板：12px 圆角 + 双影（远场 + 近场），全系统唯一的分层阴影」 |
| 勾选框要有对号 | 「让状态至少用两种手段表态：颜色 + 字重，颜色 + **符号**」 + PRODUCT.md「不只依赖颜色表达选中/禁用/错误」 |
| 按钮要有颜色区分 | 「浅色药丸按钮（`.a-primary` / `.a-success` / `.a-danger` / `.a-warning`）：Bulma `is-light` 风格」→ **复用既有 `.a-*` 语义按钮**，不新增色值（The Two-Greens Rule） |

## 3. 逐条实施

### 3.1 请求列表入口按钮：从「像芯片」改为「像动作」

- 形制改为**紧凑硬按钮**：`4px` 圆角（`--jhs-radius-sm`）、`24px` 高、`1px` 发丝线描边、
  白底 + 次级文字色；hover 转主色洗底 + 主色文字；`:active` 轻微压下；`:focus-visible` 走全局焦点环。
- 前置 `::before` 画一条**发丝线分隔**（`1px` 竖线），与左侧芯片组形成「筛选 vs 动作」的明确界限。

### 3.2 请求列表面板：屏幕居中 + 可拖动

- 容器改为 `top/left 50% + translate(-50%, -50%)`：**默认屏幕正中**。
- **拖动**：标题栏作把手（`pointerdown` → `pointermove` → `pointerup/pointercancel`，用 `setPointerCapture`），
  位置限制在视口内；首次拖动把「居中 transform」换算为绝对 `left/top`，避免基准变化导致跳位；
  拖动中加 `.is-dragging`（阴影加深）作为进行中的回应；按钮区域排除在把手之外（`target.closest('button')` 直接返回）。
- 表头 `cursor: move` / `:active` → `grabbing`；表头 `user-select: none`。
- 尺寸对齐浮层规格：`420px`（`max-width: min(420px, 92vw)`）、`max-height: min(70vh, 560px)`、`overflow: hidden`。
- 监听器统一挂 `plugin.supervisor`，随插件销毁回收。

### 3.3 星级芯片：只显示当前页实际存在的档位

- 新增纯函数 `visibleScoreChips(counts, activeValues)`：只返回**计数 > 0** 的档位，
  **额外保留「已激活」档位**（计数为 0 时也留），否则筛选态会在结果出现前无声消失。
- `stf-ui.ts` 改用它渲染 `0–5` 中命中的档位，不再整段铺开；原「有已读才生成」的总闸门被逐档判断取代。
- 口径与「已观看 / 已收藏 / 无状态标签」一致（当前页有什么显示什么）。

### 3.4 勾选框：对号 + 页面级响应

- 原生 `checkbox` 改为**视觉隐藏但保留键盘可达/可聚焦/有 `aria-label`**（`1px` + `opacity: 0`）。
- 勾选态由 `.is-checked` 绘制**白色对号**（边框旋转 45° 画出的勾，非 emoji、非字体图标），
  与主色实底形成「颜色 + 形状」双重表态。
- **被选中的卡片本体**加 `2px` 主色描边（`outline` 不占布局），让选择有页面级、可扫读的响应。
- 键盘焦点环：`.jhs-lp-batch-item:has(.jhs-lp-batch-checkbox:focus-visible)` → `2px` 主色 + offset `2px`。

### 3.5 批量选择手段 + 操作按钮语义色

- 工具栏分两组，中间发丝线分隔：
  - **选择**（`.a-normal` 中性）：`全选` / `反选` / `清空`；`全选/反选` 在 `count=0` 时**仍可用**（否则无法开始选择）。
  - **操作**（语义色）：`收藏`（`.a-warning` 橙）/ `已读 0星–5星`（`.a-success` 绿，6 档）/ `取消已读`（`.a-danger` 红）。
- 计数改为「已选 **3** / 40」：同时给出已选数与当前页可选总数（信息可扫读）。
- 控制器新增 `collectCheckboxCarNums()`（从已注入勾选框的卡片读番号）+ `BatchSelection.addAll / invert`（纯集合语义）；
  语义色按钮复用 `a-normal-buttons.css`，只做紧凑化（`height: 28px` / `margin-right: 0` / `4px` 圆角），**未新增任何色值**。
- 星级按钮文案统一为 `N星`（与筛选栏芯片同词，术语一致；不用 `★` 符号）。

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/status-tag-filter/stf-score.ts` | 新增 `visibleScoreChips`（纯函数） |
| `src/plugins/status-tag-filter/stf-ui.ts` | 星级芯片改为逐档可见性判断 |
| `src/plugins/list-page/lp-batch-state.ts` | `BatchSelection.addAll / invert` |
| `src/plugins/list-page/lp-batch.tsx` | `collectCheckboxCarNums` + 全选/反选分支 + `total` 传参 |
| `src/components/list-page/lp-batch-bar.tsx` | 勾选框（原生 input + `aria-label`）、工具栏两组 + 语义色类 + `N星` |
| `src/styles/list-page/lp-batch.css` | 对号、卡片选中描边、焦点环、双影工具栏、按钮紧凑化 |
| `src/plugins/other-site/osp-preload-panel.tsx` | 面板拖动（pointer 事件 + 视口钳制） |
| `src/styles/other-site/preload-queue-panel.css` | 入口按钮形态 + 分隔线、面板居中 + 浮层规格 + 拖动把手 |
| `tests/batch-selection-and-chip-visibility.test.ts` | **新增** 8 用例（全选/反选语义、芯片可见档位） |
| `tests/batch-ui-render.test.ts` | 同步工具栏渲染契约（`total`、两组按钮、禁用规则） |

## 5. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**27 文件 / 293 用例**（原 26 / 285，新增 8） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平 —— 未新增裸站点选择器） |

craft-floor 覆盖情况：对比度（对号用 `--jhs-color-bg` 白 / 主色底 ≈ 3.4:1，达非文本 3:1）、
状态齐备（hover / active / focus-visible / disabled）、浏览器表面（`font-variant-numeric: tabular-nums`
用于计数与番号）、文案（按钮名即动作名）、触控（勾选框热区由 `label` 承载）。

## 6. 真实浏览器验证建议

1. 筛选栏末尾「请求列表」：与左侧芯片**形制不同**（直角小按钮 + 左侧竖分隔线），点开面板**居中**。
2. 按住面板**标题栏拖动** → 位置跟手、不跳位、限制在视口内；点按钮不会误触发拖动。
3. 有已读卡片的页面：星级芯片只出现**实际存在的档位**（例如只有 3 星与 5 星时只显示这两枚）。
   取消全部星级筛选并翻页到没有该档位的页面 → 对应芯片消失。
4. 列表页勾选：左上角方框**出现白色对号**，卡片同时出现主色描边；Tab 键可聚焦并显示焦点环。
5. 工具栏：`全选` 一次选中整页（计数变 `已选 40 / 40`）、`反选` 取补集、`清空` 归零；
   `收藏`（橙）/ `已读 N星`（绿）/ `取消已读`（红）三色可辨，执行中全部禁用。

## 7. 已知限制

- 面板拖动为**会话内**状态：关闭再打开回到居中；不做位置持久化（用户未要求）。
- 拖动仅支持指针（鼠标 / 触摸 / 笔），未提供键盘移动面板的快捷键。
- 「全选」以**当前页已注入勾选框的卡片**为范围（含被其他筛选插件隐藏前的卡片集合）；
  与批量写入一样，只作用于当前页已渲染的卡片。
- 勾选框与状态标签注入点相同，若用户把状态标签设为左上角（`tagPosition=leftTop`）会与勾选框视觉相邻。
