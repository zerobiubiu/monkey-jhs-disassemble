> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/styles/setting-plugin.css`、`src/components/setting/*`（setting-dialog / simple-setting-panel / setting-button / cache-item-html）、`src/components/setting-panels/*`（diagnostics / filter / list-manager）、`src/plugins/setting/cache-management.ts`、`src/plugins/setting/setting-form-bind.ts`
> **前置文档**：`docs/16-design-system-context-and-detector-exceptions.md`（DESIGN.md 快照与检测器例外登记；本批的评审依据）
> **替代文档**：无
> **生效版本**：v1.46.8

# 设置界面收敛：按钮/开关统一、破坏性操作加确认、侧栏键盘可达

## 1. 背景

`docs/16` 建立的 `DESIGN.md` 快照被 impeccable 用作评审基准后，对设置弹层（`SettingDialog`）与快捷浮层（`SimpleSettingPanel`）做了一次设计评审，得分 **25/40（Acceptable）**，并给出 5 个优先问题。本批按评审结论执行，顺序遵循「先收体系分裂，再修高风险项」——否则 P1 的确认弹窗与 P2 的危险按钮隔离要在三套按钮体系里各改一遍。

评审定位的根因有两条：

1. **同一个弹层里并存三套按钮 + 两套开关**（一致性与标准仅得 2/5）。三者尺寸、hover 手感、圆角各不相同；`.jhs-qs-btn-primary` 还带一处装饰性渐变，与 PRODUCT.md「不用装饰性渐变」直接冲突。
2. **两个高风险缺口**：`#clean-all` 一键清空全部缓存且无确认无撤销；10 个侧栏面板是裸 `<div>`，键盘完全无法抵达。

## 2. 方案

### 2.1 按钮收敛为单一 `.jhs-btn`（distill）

原先三套：`.jhs-setting-btn`（面板操作）、`.jhs-setting-menu-btn`（缓存卡片/菜单）、`.jhs-qs-btn`（快捷浮层）。现合并为一套基类 + 修饰符，几何基准取最完整的 `.jhs-setting-btn`：

| 类 | 用途 |
|---|---|
| `.jhs-btn` | 基准（34px 高 / `6px 16px` / 6px 圆角 / 13px / 500） |
| `.jhs-btn--primary` / `--success` / `--danger` / `--pink` / `--mint` | 实心语义色 |
| `.jhs-btn--neutral` / `--muted` | 缓存卡片的中性填充（原行内 `backgroundColor` 提升为类） |
| `.jhs-btn--ghost` | 白底描边（次要动作/取消） |
| `.jhs-btn--isolated` | 危险动作隔离（`margin-left: auto`） |
| `.jhs-btn--compact` | 紧凑变体（快捷浮层底部） |

同时统一交互语言：**hover 一律透明度提亮**（原 `.jhs-setting-menu-btn` 的 `translateY(-1px)+阴影`、`.jhs-qs-btn` 的 `translateY(-1px)` 取消），active 一律 `scale(0.97)`；补 `.jhs-btn:disabled/.is-disabled` 禁用态。

**装饰性渐变移除**：`.jhs-qs-btn-primary` 的 `linear-gradient(135deg, #5d87c2, #4a90d9)` 改为主色实底；快捷浮层头部的 `linear-gradient(180deg, #f8fafc, #fff)` 改为纯 `#f8fafc`。两处均与 PRODUCT.md 的反例清单冲突。

### 2.2 开关收敛为 `.jhs-toggle`（distill）

`input.mini-switch`（40×20 / 圆角 20px / 开态 `#4caf50`）与 `.jhs-toggle`（40×22 / 圆角 11px / 开态 `#22c55e`）是两套并行开关且都在生产使用。现统一到 `.jhs-toggle` 并删除 `mini-switch` 定义；`.jhs-toggle` 补齐 `display/vertical-align/min-width/max-width` 与 `:focus-visible` 焦点环，使其能接管原 `mini-switch` 的全部位置。

### 2.3 破坏性操作加确认（harden）

`handleCleanAllCache` 此前直接清空全部缓存。现接入项目既有的 `q()` 确认框（`core/util/util-popup.ts`，与其它破坏性操作一致），并在确认前统计受影响条目与总体积：

> 将清空 **N** 项缓存（共 **M** 条，约 X MB）。评分缓存清空后需重新获取；外站预加载缓存清空后对应影片需重新探测。**此操作不可撤销。**

清空逻辑本身不变，仅移入确认回调。

### 2.4 侧栏键盘可达（audit）

10 个侧栏项由裸 `<div>`（无 `tabindex`、无 `role`，只能鼠标点击）改为 **`role="tab"` 的 `<button>`**：

- 侧栏容器加 `role="tablist"` + `aria-orientation="vertical"` + `aria-label`；
- 每项加 `aria-selected` 与 roving `tabIndex`（激活项 `0`、其余 `-1`）；
- `setting-form-bind.ts` 补 `keydown` 处理：`↑/↓/←/→` 循环切换、`Home/End` 跳首尾，移动焦点并触发一次 click（与既有切换逻辑共用，不重写）；
- 各面板 emoji 包进 `<span aria-hidden="true">`，使读屏只念文字（「数据备份」而非「floppy disk 数据备份」）；
- `.side-menu-item` 补按钮外观重置（`appearance/background/border/width/text-align/font-family`）与 `:focus-visible` 焦点环（`outline-offset: -2px` 内收，避免贴边被裁）。

### 2.5 危险动作视觉隔离与图标冲突（layout）

- `#clean-all` 加 `.jhs-btn--isolated` 推到最右，与「保存设置」拉开距离；
- 图标冲突：快捷浮层的「💾 更多设置」与弹层的「💾 保存设置」共用同一软盘 emoji，语义不同却难以区分。**保存**改用 🗃️（磁盘组），**清理全部缓存**改用 🧨，两者均加 `aria-hidden`。

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/styles/setting-plugin.css` | 新增统一按钮系统 `.jhs-btn*`；删除 `.jhs-setting-btn*`/`.jhs-setting-menu-btn*`/`.jhs-qs-btn*` 三套定义；`mini-switch` 定义删除、`.jhs-toggle` 补全；移除两处装饰性渐变；`.side-menu-item` 按钮重置 + 焦点环；清理一处重复 `border-bottom` 与失效的 `:not(.mini-switch)` 选择器 |
| `src/components/setting/setting-dialog.tsx` | 侧栏 10 项改 `role=tab` 按钮（含 aria-selected/tabIndex/aria-hidden emoji）；底部按钮迁移 `.jhs-btn`，`#clean-all` 加隔离类，保存/清理图标去重 |
| `src/components/setting/simple-setting-panel.tsx` | 11 处 `mini-switch` → `jhs-toggle`；底部两按钮迁移 `.jhs-btn--ghost/--primary --compact` |
| `src/components/setting/setting-button.tsx` | 原子组件输出类改为 `.jhs-btn jhs-btn--{color}`（含注释同步） |
| `src/components/setting/cache-item-html.tsx` | 三个缓存操作按钮迁移 `.jhs-btn`，行内 `backgroundColor` 提升为 `--muted/--neutral/--mint` 修饰符 |
| `src/components/setting-panels/diagnostics-panel.tsx` | 复制/刷新按钮迁移（刷新按钮由无样式补为 `--ghost`） |
| `src/components/setting-panels/filter-panel.tsx`、`list-manager-panel.tsx` | 「添加」按钮迁移 `.jhs-btn--primary` |
| `src/plugins/setting/cache-management.ts` | `handleCleanAllCache` 接入 `q()` 确认 + 代价文案；新增 `q` import |
| `src/plugins/setting/setting-form-bind.ts` | 新增侧栏 `keydown` 方向键导航 |

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-25

### 验证命令

```bash
bun run build            # tsc -b && vite build
bun run lint             # eslint（0 errors / 0 warnings 门禁）
bun run lint:css         # stylelint
bun run test             # vitest run
bun run check:structure
bun run check:docs
impeccable detect --json src
rg 'jhs-setting-btn|jhs-setting-menu-btn|jhs-qs-btn|mini-switch' src
```

### 实际输出

- `bun run build`：**✓ built in 683ms**，409 modules，产物 1,192.24 kB（gzip 305.59 kB），`tsc -b` 无错误
- `bun run lint`：exit 0
- `bun run test`：**Test Files 15 passed · Tests 198 passed**
- `bun run check:structure`：OK（373 files，63 dirs within limits）
- `bun run check:docs`：OK（44 plugins，61 core files）
- `impeccable detect --json src`：**exit 0，warnings 0**
- `rg` 旧类名：**`.ts/.tsx` 中零残留**（`.css` 中仅剩描述性注释）
- 产物头部 `// @version 1.46.8` 与 `vite.config.ts` 一致

### 前端或调用方验证

静态验证覆盖。建议用户在浏览器中确认：① 设置面板可直接 Tab 进入侧栏并用方向键切换；② 「缓存管理」面板点「清理全部缓存」先弹确认框、取消后不清空；③ 快捷浮层的开关与弹层开关外观一致；④ 「保存设置」与「更多设置」图标可区分。

### 验证结论

`tsc` 严格编译、构建、eslint、**198 单测**、结构门禁、文档门禁全绿，检测器 warning 保持 0。三套按钮 / 两套开关在源码层零残留，旧类名只作为历史说明留在 CSS 注释中。

### 已知限制

- **`bun run lint:css` 仍有 2 处报错，非本批引入**：`src/styles/fold-category-plugin.css:33` 的 `__HIGHLIGHTED_TAG_NUMBER__` / `__HIGHLIGHTED_TAG_COLOR__` 是**运行时占位符，必须保持大写**（由 `fold-category-plugin.ts` 的 replace 消费），stylelint 的 `value-keyword-case` 规则不适用于该文件。本批未触碰该文件（`git diff` 可证），建议后续单独加 `stylelint-disable` + 说明，不在本批顺手改动。
- **`package.json` version 顺带修正**：原为 `1.46.4`，落后 `userscript.version` 三个 patch。按 AGENTS.md §6.3 属元数据修正，不单独计变更。
- 未做浏览器渲染比对（无自动化环境），视觉判断基于源码与 DESIGN.md 契约。

## 5. 关联

- 版本：v1.46.8（AGENTS.md §6.1.1，`src/` 组件与样式改动 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.8
- 设计依据：`DESIGN.md`（统一按钮系统对应「一致性」章节；确认弹窗对应「状态可信」原则）
- 评审快照：`.impeccable/critique/2026-09-25T17-13-21Z__src-components-setting-setting-dialog-tsx.md`
- 文档编号：本文件为 `docs/17-*`，对应 `changelog` 中的 doc/248
