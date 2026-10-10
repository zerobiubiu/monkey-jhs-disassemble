# 53 - 设置弹层 polish：问号提示补可访问名 + 缓存面板信息文字改用次级文字令牌

- **状态**：已执行
- **类型**：变更（修复 + 无障碍）
- **生效版本**：v1.48.5（纯前端修复，patch）
- **前置文档**：`.impeccable/critique/2026-09-25T17-13-21Z__src-components-setting-setting-dialog-tsx.md`（critique 快照，已 closed）
- **替代/被替代**：无
- **提交**：`b75ff56 fix(ui): 设置弹层 polish —— 问号提示补可访问名 + 缓存面板信息文字改用次级文字令牌（doc/53）`

## 背景

`/impeccable polish` 对 critique 快照（2026-09-25，设置弹层 `setting-dialog.tsx`）做独立复核。快照两条 P1 经核实**已在后续轮次实现**，本轮不重复劳动，只修复核中新发现的真实缺口。

本轮补写本文档：`b75ff56` 的提交信息引用了 doc/53，但文档当时未落盘（索引也缺），此处补齐。

## 方案

### 一、快照两条 P1 的复核结论（不改代码）

| 快照问题 | 复核结论 | 证据 |
|---|---|---|
| 「清理全部缓存」危险动作缺确认框 | 已实现（doc/249） | `setting-panels/cache-panel.tsx` 内联确认流程；危险动作回到本面板 |
| 侧栏缺键盘/读屏支持 | 已实现（doc/248） | `setting-dialog.tsx` 侧栏为 `role="tablist"/"tab"/"tabpanel"` + `aria-selected` + `tabIndex` 轮询 + 方向键/Home/End 导航 |

### 二、本轮新修两处

1. **`jhs-qs-tip` 问号提示无可访问名称**（读屏只念「问号」）：`simple-setting-panel.tsx` 的 `Row` 内提示图标补 `role="img"` + `aria-label={tip}` —— 与视觉 tooltip 同源（同一 `tip` 变量喂 `data-tip` 与 `aria-label`），不引入第二份文案。
2. **`ink-muted`（`#999`，白底 2.85:1）语义越界**：`cache-panel.tsx` 把它用在**信息性文本**（缓存总量、说明段）上，DESIGN.md 对该色的定位是「占位/禁用/时间戳」→ 改用 `var(--jhs-color-text-secondary)`（`#6c757d`，白底 4.69:1）。

## 实施（改动文件清单）

| 文件 | 改动 |
|---|---|
| `src/components/setting/simple-setting-panel.tsx` | `Row` 的 `.jhs-qs-tip` 加 `role="img"` + `aria-label` |
| `src/components/setting-panels/cache-panel.tsx` | 两处内联 `color: '#999'` → `var(--jhs-color-text-secondary)` |

共 2 文件、+5/-3 行；无新增文件、无选择器/结构计数变化（`src/plugins` 43、`src/core` 67 不变）。

## 未做（记录，避免被误认为遗漏）

- **三套按钮 / 两套开关的体系收敛**：属 `distill` 规模，不在单 surface 的 polish 范围内（后续批次的 distill 处理其一）。
- **其余 13 处 `#999`**：散落在设置面板之外，属项目级主题化欠账，已在 doc/54 审计中记录为 P3。
- **共享组件 `shared/section-header.tsx`**：改动会溢出本 surface（设置弹层）的边界，未动。

## 执行验证记录

- **执行环境**：Windows 10.0.26300 / bun（`bun run`）/ Node 侧 vitest 4.1.10；HEAD 含 `b75ff56`。
- **验证命令与输出**：

  | 命令 | 实际输出 |
  |---|---|
  | `bun run test` | `Test Files 41 passed (41)` / `Tests 419 passed (419)`（3.91s） |
  | `bun run check:docs` | `check-doc-catalog: OK (43 plugins [5 flagged], 67 core files)` |
  | `bun run check:structure` | `check-structure: OK (389 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` |
  | `bun run check:selectors` | `check-site-selectors: OK (85 files, 258 literals; 0 file(s) below baseline)` |
  | `bun "probe-doc53.tsx"`（真实渲染管线 `jsxToString`） | `.jhs-qs-tip 共 5 处：均含 role="img" 且 aria-label：true`；`无 data-tip 却有 aria-label 的坏例：0`；`缓存面板内联 color 取值：["var(--jhs-color-text-secondary)","var(--jhs-color-text-secondary)"]`；`仍在用 #999：false` |

- **验证结论**：两处修复在**真实组件渲染产物**中可见且无遗漏（提示图标 5/5 合规、缓存面板内联色 2/2 走令牌）；门禁与全量用例通过，改动未触达结构/选择器/目录计数。
- **已知限制**：本环境**无浏览器自动化**，未做真机渲染与读屏实测；对比度为计算值（`#6c757d` on `#fff` = 4.69:1）；可访问名称的**实际播报**（是否顺口、是否冗余）未核，建议在实机读屏抽查一次。

## 后续验证建议

1. 实机（Tampermonkey + JavDB）打开快捷设置面板，用读屏（NVDA/VoiceOver）抽查问号提示是否念出提示内容。
2. 打开设置弹层 → 缓存面板，确认缓存总量与说明段文字为次级文字灰、可读性提升且不刺眼。