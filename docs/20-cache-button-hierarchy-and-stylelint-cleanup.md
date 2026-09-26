> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/styles/fold-category-plugin.css`、`src/styles/setting-plugin.css`、`src/components/setting/cache-item-html.tsx`
> **前置文档**：`docs/19-aria-serialization-and-tabpanel-fix.md`（本批接续处理 critique 遗留项与既有 stylelint 存量告警）
> **替代文档**：无
> **生效版本**：v1.46.11

# 收敛缓存卡片按钮层级，并清除 stylelint 存量告警

## 1. 背景

两件遗留项：

### 1.1 stylelint 长期报错（存量，非本批引入）

`src/styles/fold-category-plugin.css` 的 `border: __HIGHLIGHTED_TAG_NUMBER__px solid __HIGHLIGHTED_TAG_COLOR__` 触发 2 条 `value-keyword-case` 错误。这两处是**运行时占位符，必须保持大写**——由 `fold-category-plugin.tsx:60-61` 与 `favorite-actresses-plugin.tsx:67-68` 的 `initCss()` 分别 replace 为用户设置的高亮标签边框宽度/颜色。

因此**不能改小写**（改了运行时 replace 会静默失配，边框退化为无效声明），只能按项目既有惯例加 `stylelint-disable-next-line` 并写明原因。

### 1.2 缓存卡片三按钮无层级（critique P3）

chrome-devtools 实测：9 张缓存卡片 × 3 颗按钮 = **27 颗实心色块**，全部 `104.5×34`、`font-weight 500`、白色文字、无描边、间隙均 6px。

| 按钮 | 实测背景 | 问题 |
|------|---------|------|
| 清理 | `rgb(68,140,194)` 蓝 | 破坏性动作着彩色，与普通动作同权重；该蓝与主色钢蓝邻近，读起来像主操作 |
| 查看 | `rgb(178,190,192)` 灰蓝 | — |
| 导出 | `rgb(133,208,163)` 绿 | 绿色在系统语义里表示「成功」，这里只是「导出」 |

三颗完全同级，用户扫视时无法判断哪个是主操作、哪个有破坏性。这违反 `DESIGN.md` 两条既有规则：
- **颜色标记状态与选中，从不装饰**——这里的三种颜色不承载任何状态语义
- **破坏性动作不与常规动作同权重**——「清理」用实心彩块与「导出」并列

## 2. 方案

按层级重排三颗按钮，用**形态而非颜色**区分，颜色只在真正需要语义时出现：

| 按钮 | 改后 | 理由 |
|------|------|------|
| 清理（破坏性） | `.jhs-btn--danger-ghost`：白底 + 红字 + 红描边（`#ef4444` / `#fecaca`），hover 转 `#fee2e2` / `#b91c1c` | 保留危险语义但**不再用实心强调色**——它不在主操作位置。描边形态天然弱于实心，完成层级降级 |
| 查看（中性） | `.jhs-btn--ghost`：白底 + 灰字 + `#e2e8f0` 描边 | 复用已有变体，与全项目「次要动作」形态一致 |
| 导出（主操作，不变） | `.jhs-btn--mint`：实心浅绿 | 保留实心——**三颗里只有它继续强调**，主操作由此唯一 |

新增 `.jhs-btn--danger-ghost` 变体（`setting-plugin.css` 的统一按钮系统内），供其它「重要但低频的破坏性动作」复用。

**未改**：`.jhs-btn--mint` 的色值（仍是 `#85d0a3`，在 `DESIGN.md` 已登记）、按钮尺寸、间隙、`flex: 1` 等宽布局。

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/styles/fold-category-plugin.css` | 占位符声明上方加 `stylelint-disable-next-line value-keyword-case` + 原因注释（两条换行的块注释改为行内单行，因 `disable-next-line` 只作用于**紧随其后的一行**） |
| `src/styles/setting-plugin.css` | 新增 `.jhs-btn--danger-ghost` / `:hover` 变体 |
| `src/components/setting/cache-item-html.tsx` | 「清理」`--muted` → `--danger-ghost`；「查看」`--neutral` → `--ghost`；「导出」保持 `--mint` |

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-26
- 浏览器实测：Chrome 153.0.8010.54（chrome-devtools MCP `--autoConnect`，JavDB 页面）

### 验证命令

```bash
bun run build
bun run lint
bun run lint:css     # 本批重点
bun run test
bun run check:structure
bun run check:docs
```

### 实际输出

- `bun run build`：**exit 0**，产物头部 `// @version 1.46.11`
- `bun run lint`：exit 0
- **`bun run lint:css`：exit 0（全库零告警，此前长期为 2 条错误）**
- `bun run test`：**Test Files 15 passed · Tests 202 passed**
- `check:structure` / `check:docs`：OK

### 浏览器实测（改动前基线）

```
buttons: [
  { text:"清理", cls:"jhs-btn--muted",   bg:"rgb(68,140,194)",  w:104.5, h:34, weight:"500" },
  { text:"查看", cls:"jhs-btn--neutral", bg:"rgb(178,190,192)", w:104.5, h:34, weight:"500" },
  { text:"导出", cls:"jhs-btn--mint",    bg:"rgb(133,208,163)", w:104.5, h:34, weight:"500" }
]
gaps: [6, 6]   cards: 9
```

### 前端或调用方验证

**待用户在浏览器确认**（需刷新页面加载 v1.46.11）：「清理」应变为白底红字红描边、「查看」白底灰字灰描边、「导出」仍为实心浅绿。改动为纯 CSS 变体切换，无逻辑变更。

### 验证结论

`fold-category-plugin.css` 的 2 条存量 stylelint 错误已按项目惯例以「带原因的 disable」收口，**`lint:css` 首次全库零告警**；占位符保持大写，运行时替换链路未受影响（已用 `str contains` 复核字面量完整）。缓存卡片三按钮由「三个同级实心彩块」收敛为「一个主操作 + 两个描边次级」。

### 已知限制

- **按钮层级的观感为主观判断**，未做渲染对比或 A/B；具体配色可在浏览器中看过再调。
- 未改动 `.jhs-btn--mint` 色值——绿色在本项目语义里通常表示「成功」，作为「导出」的主操作色是既有用法，本次未挑战。
- `fold-category-plugin.css` 的 disable 注释只覆盖该两处占位符；若后续新增占位符需同样处理。

## 5. 关联

- 版本：v1.46.11（AGENTS.md §6.1.1，`src/` 样式与组件改动 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.11
- 前序：`docs/17`（统一按钮系统，本批新增 `--danger-ghost` 变体）
- 设计依据：`DESIGN.md`「颜色标记状态与选中，从不装饰」+「The Shadow-Is-Response Rule」同源的层级纪律
- 文档编号：本文件为 `docs/20-*`，对应 `changelog` 中的 doc/251
