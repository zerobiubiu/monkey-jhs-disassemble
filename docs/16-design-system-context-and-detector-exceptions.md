> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`DESIGN.md`（新建，视觉设计系统快照）、`.impeccable/config.json`（检测器例外登记，新建）、`.gitignore`、`src/styles/translate-plugin.css`、`src/styles/logger.css`、`src/core/util/logger-panel.tsx`、`src/components/setting-panels/fav-sync-panel.tsx`、`src/styles/list-reflow/list-reflow.css`
> **前置文档**：`docs/08-consistency-and-atomization.md`（§9/§10/§11 工程约定由来）、`docs/11-missav-and-finale.md`（CSS 与 @require 结构定型）
> **替代文档**：无
> **生效版本**：v1.46.7

# impeccable 设计系统上下文建立与检测器例外登记

## 1. 背景

项目长期缺少一份「视觉设计系统」的可读快照：令牌定义在 `src/styles/design-tokens.css`，但契约只存在于代码与历史 doc 的片段中。本轮引入 impeccable 工具链，按其 `document` → `polish` 流程完成两件事：**把设计系统显式化**，并用自动化检测收口界面层的历史偏差。

检测暴露的首个问题不在代码，而在快照本身。首版 `DESIGN.md` 只登记了 `design-tokens.css` 声明的 24 个值，随后 `impeccable detect src` 报出 **406 条 findings**——其中 392 条是 `design-system-*` 咨询级告警，全部指向「代码里的值不在 DESIGN.md 里」。这说明快照按「令牌层应该多干净」编写，而非按「代码实际渲染了什么」编写。

普查确认了两个事实：

1. **令牌层声明即止**：`design-tokens.css` 声明 39 个令牌，`rg 'var\(--jhs-'` 全库仅命中 9 处——**只有 `--jhs-z-top` 与 `--jhs-z-page` 被真正消费**（z-index 必须有共用常量，否则被 `layer.js` 的无上限递增碾压）。颜色、间距、圆角、字号、阴影、过渡、触控尺寸全部零消费，渲染路径写死字面量（`#5d87c2` 19 次、`#6c757d` 32 次、`#e2e8f0` 15 次）。
2. **视觉系统实为五套子系统拼合**：核心令牌层（钢蓝）、Bulma 站点族（列表页）、Flat-UI 族（日志面板）、Nord 暗色族（MissAV）、Tailwind 族（设置面板）。这不是设计失误，而是「并入原站」原则的直接后果；代价是中性灰膨胀到 18 阶、语义色出现 3–4 个近重复值。

## 2. 方案

### 2.1 快照按「实际渲染值」重建，并区分意图与存量

`DESIGN.md` frontmatter 重建为三层：

- **意图斜坡**（新增代码只允许使用）：颜色按子系统分组登记；字号 5 档（11/12/13/14/16px）；圆角 3 档（4/6/8px）+ 药丸/圆形；间距 6 档。
- **存量普查**（实测存在、标注为待收敛、明确「新增不得使用」）：字号另 9 阶（10/15/17/18/20/22/24/26/50px）、圆角另 10 阶（2/3/5/7/9/10/11/12/15/20px）。
- **中性灰 18 阶 + Tailwind slate 9 阶 + 列表面板 4 阶**：全部登记，并写明收敛方向（新代码只在令牌族与 slate 族取值，不新增阶）。

效果：`detect` findings **406 → 74**（advisory 392 → 65）。其中 5 条 `design-system-font` 完全消失——它们本就是快照缺口而非代码缺陷。

### 2.2 记录 Port-Fidelity 约束（本轮最关键的发现）

7 个样式表在文件头声明了**零偏差契约**：「CSS 规则内容与原脚本一致（缩进标准化，渲染等价）」：

`page-sort-plugin.css`、`list-waterfall-plugin.css`、`image-recognition-plugin.css`、`magnet-hub-plugin.css`、`list-reading-status-plugin.css`、`video-lists-tag.css`、`status-tag-filter-plugin.css`

其中的字体栈、缓动曲线属**冻结的移植产物**，改动需同步调整原脚本对照关系。此约束写入 `DESIGN.md` 的 **The Port-Fidelity Exception**，避免后续在「样式整理」中顺手改掉零偏差资产。

### 2.3 polish 原则：只修真实缺陷，例外登记而非静默忽略

对 14 条 warning 逐条判定，分三类处理：

## 3. 实施

### 3.1 真实修复（3 项）

| 文件 | 变更 | 理由 |
|------|------|------|
| `src/styles/translate-plugin.css` | 重写 `.translated-title`：移除 `linear-gradient` 背景、`4px` 绿色左边框、`20px` 字号、投影，改为一枚 6px 圆角 + 1px 发丝线 + `#fbfcfd` 底的标题栏（字号 20px → 14px） | 原实现与 DESIGN.md 基线四项冲突。**这是本轮唯一的界面视觉有意偏差**，已在文件头注释写明，非笔误 |
| `src/core/util/logger-panel.tsx` | `el.style.borderLeft` 由 `3px` 统一为 `4px` | 与 `.console-logger-entry` 的占位 `border-left: 4px solid transparent` 对齐。原 3px 会使**未识别类型**（走 `base` 样式）的条目比常规条目少 1px 边框宽度，产生横向位移 |
| `src/styles/logger.css` | 把占位边框的 4px 与上述实现的一致性要求写进注释 | 防止后续被「顺手改回 3px」而重新引入 1px 位移 |

### 3.2 例外登记（8 条，写入 `.impeccable/config.json`）

不以注释静默忽略，而是登记进**可评审、可解释、可回滚**的例外表（每条带 `reason`）：

| 规则 | 位置 | 判定 |
|------|------|------|
| `overused-font` | `magnet-hub-plugin.css`（Arial） | 零偏差契约内的冻结产物 |
| `overused-font` | `missav-renderer.ts`（Helvetica） | 零偏差契约；与 MissAV 页面 Tailwind 字体一致 |
| `bounce-easing` | `list-reading-status-plugin.css` | 零偏差契约；星级 hover 弹出曲线，改动会改变鼠标手感 |
| `layout-transition` | `fav-sync-panel.tsx` / `list-reflow.css` | **进度条宽度由 JS 驱动**（`$bar.css({width})` / `fillElement.style.width`），宽度过渡是必要的；改 `transform: scaleX` 会同时缩放 4px 圆角，破坏进度条形态 |
| `side-tab` | `logger-panel.tsx` | 日志类型标记色条是面板的识别机制（不依赖颜色也能定类型） |
| `side-tab` | `setting-plugin.css` | 侧栏激活态的三重表态之一（底色 + 左条 + 字重），与「不只靠颜色」原则一致 |
| `side-tab` | `help-dialog.css` | Flat-UI 血统遗留界面的既有形状 |

### 3.3 `.gitignore` 修正（两处缺陷）

原判据「工具链产物不入库」把整个 `.impeccable/` 忽略，但该目录同时含 `config.json`——**检测器例外登记需要团队共享**，本地忽略会导致换机器后例外失效、warning 复现。已改为：

```gitignore
.impeccable/*
!.impeccable/config.json     # 例外登记入库；design.json 侧车与 critique 快照留本地
```

同时删除了一处重复的 `.serena/` 行。

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-25

### 验证命令

```bash
bun run build          # tsc -b && vite build
bun run lint           # eslint（0 errors / 0 warnings 门禁）
bun run test           # vitest run
bun run check:structure
impeccable detect --json src
```

### 实际输出

- `bun run build`：**✓ built in 755ms**，409 modules，产物 1,187.50 kB（gzip 304.04 kB），`tsc -b` 无错误
- `bun run lint`：exit 0（无输出 = 零告警）
- `bun run test`：**Test Files 15 passed · Tests 198 passed**
- `bun run check:structure`：OK（373 files，63 dirs within limits）
- `impeccable detect --json src`：**exit 0，warnings 0**（advisory 65）
- 产物头部 `// @version 1.46.7` 与 `vite.config.ts` 一致

### 前端或调用方验证

静态验证覆盖。建议用户更新脚本后确认：① 标题翻译提示块已由渐变绿条改为低调标题栏；② 日志面板展开时条目左色条与占位宽度一致（未识别类型不再位移）。

### 验证结论

`tsc` 严格编译、构建、lint、**198 单测**、结构门禁全绿；检测器 warning 由 **14 条降至 0 条**。

14 条的完整去处（可逐条核对）：

| 处置 | 条数 | 明细 |
|------|------|------|
| 真实修复 | 1 | `translate-plugin.css` 的 `side-tab`（重写该规则后本条目自然消失） |
| warning 降为 advisory | 5 | 5 条 `design-system-font`——DESIGN.md 补登字体栈后不再报 warning |
| 例外登记 | 8 | 见 §3.2 表 |
| **合计** | **14** | |

注：`logger-panel.tsx` 与两处进度条的处置是**并行**的两件事——它们既在例外表中登记（`side-tab` / `layout-transition`），又各自做了实质修正（统一 4px 消除 1px 位移；补注释防止被改回）。上表按「该条 warning 最终是否仍报出」统计，故只计一次。无静默忽略。

### 已知限制

- **65 条 `design-system-color` advisory 仍在**：均为存量字面量的确未登记（如 `#f40` 4 次、`#f56c6c` 3 次等）。按 `The Grey-Ladder Rule` / `The Declared-Not-Wired Rule` 的收敛方向「触碰即迁移」，本批不机械替换。彻底收敛需要一次专项批次。
- **7 个零偏差样式表的字体/缓动未变**：属刻意保留；若未来要与设计系统统一，需作为独立决策并同步原脚本对照关系。
- 无浏览器自动化环境，未做渲染截图比对；视觉判断基于源码与 DESIGN.md 契约。

## 5. 关联

- 版本：v1.46.7（AGENTS.md §6.1.1，`src/` 样式与组件改动 → patch 递增）
- 文档编号：本文件为 `docs/16-*`，对应 `changelog` 中的 doc/247（阶段文档覆盖至 doc/242，变更文档 12/13/14/15 依次为 doc/243/244/245/246）
- changelog：`changelog/CHANGELOG.md` v1.46.7
- 设计系统快照：`DESIGN.md`（根目录，入库）
- 检测器例外登记：`.impeccable/config.json`（入库）
