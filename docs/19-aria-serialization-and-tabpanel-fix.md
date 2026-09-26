> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/core/jsx-to-string.ts`、`src/components/setting/setting-dialog.tsx`、`src/components/setting-panels/*`（10 个面板）、`tests/jsx-to-string.test.ts`
> **前置文档**：`docs/18-setting-cache-action-relocation.md`（本批修的是 v1.46.8/1.46.9 引入的缺陷）
> **替代文档**：无
> **生效版本**：v1.46.10

# 修复 ARIA 布尔序列化缺陷与 tab/tabpanel 关联

## 1. 背景

用 chrome-devtools MCP 接入真实浏览器（Chrome 153）读取 JavDB 页面后，对 v1.46.8/1.46.9 的改动做了实测复核。大部分通过，但**发现两处缺陷，其中一处是我在 v1.46.8 引入的**：

### 1.1 `aria-selected` 渲染结果无效（根因在 jsxToString）

实测真实 DOM：

| 位置 | 实测 `aria-selected` |
|------|---------------------|
| 激活项 | `""`（空字符串） |
| 其余 9 项 | `null`（属性根本不存在） |

期望是 `"true"` / `"false"`。两端都错：**读屏无法区分「未选中」与「属性不存在」**。

根因不在组件，而在 `jsxToString` 的 `renderAttrs`：

```ts
if (value === true) { parts.push(key); continue; }        // → 裸属性 aria-selected
if (value == null || value === false) continue;            // → false 整条省略
```

它把所有 `true` 当作 **HTML 布尔属性**处理（如 `disabled`），但 **`aria-*` 不是布尔属性**——ARIA 规范要求它们始终是字符串。`React.renderToStaticMarkup` 不会犯这个错，这是本渲染器的保真缺口（doc header 里原本就写着「布尔属性：`true` → 裸属性；`false` → 省略」，说明是有意为之，只是没考虑 `aria-*`）。

**影响面是全项目的 `aria-*`**，不止侧栏。

### 1.2 `tablist` 有 tab 但没有 tabpanel

v1.46.8 给侧栏加了 `role="tablist"` + `role="tab"`，但 10 个内容面板**一个都没有 `role="tabpanel"`**（实测 `tabpanelCount: 0`）。ARIA tab 模式要求 tab 关联到 tabpanel，否则 tablist 语义不完整。

## 2. 方案

### 2.1 jsxToString：`aria-*` 不走布尔分支

在通用布尔逻辑**之前**插入 `aria-*` 专属分支，一律输出字符串：

```ts
if (key.startsWith('aria-')) {
    if (value == null) continue;              // null/undefined 仍省略
    parts.push(`${key}="${escapeAttr(String(value))}"`);
    continue;
}
```

- `true` → `aria-x="true"`、`false` → `aria-x="false"`（不再裸属性 / 不再省略）
- `null` / `undefined` 仍省略（与 React 行为一致）
- **非 ARIA 布尔属性语义不变**：`disabled={true}` 仍是裸属性、`disabled={false}` 仍省略

### 2.2 组件层显式给字符串

即便渲染器已修，仍把 `aria-selected` 传成字符串字面量——两处都正确，代码意图也明确：

```ts
/** 必须返回字符串而非布尔：aria-selected 不是 HTML 布尔属性。 */
const ariaSelected = (id: string): 'true' | 'false' =>
    panelName === id ? 'true' : 'false';
```

用字面量联合类型（而非 `React.AriaAttributes['aria-selected']`），避免在 JSX pragma 下引入 `React` 命名空间。

### 2.3 补齐 tab ↔ tabpanel 关联

- 10 个面板的 `className="content-panel"` 处补 `role="tabpanel"` + `aria-labelledby={`tab-${panelId}`}`
- 侧栏 10 个 tab 补 `id="tab-<panelId>"`
- `sync-panel` 的 `panelId` 是运行时 prop（渲染 `missav-panel`），`aria-labelledby` 用模板串而非写死

### 2.4 缓存面板头部视觉微调

实测「总占用 11.3 MB」与「清理全部缓存」间距 **494px**（`space-between` 在 718px 宽面板里把两者推到两端）。改为 `align-items: baseline`、`gap: 12px`、`marginBottom: 12px`——按钮仍在右侧但不再与统计文字隔出一条空旷带。**这是主观调整，实际观感需人工确认。**

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/core/jsx-to-string.ts` | `renderAttrs` 新增 `aria-*` 专属分支；模块头与函数 doc 同步说明该例外 |
| `src/components/setting/setting-dialog.tsx` | 新增 `ariaSelected()` 辅助；10 处 `aria-selected` 改用字符串；10 个 tab 补 `id="tab-*"` |
| `src/components/setting-panels/*.tsx`（10 个） | 内容面板补 `role="tabpanel"` + `aria-labelledby` |
| `src/components/setting-panels/cache-panel.tsx` | 头部行 `baseline` + `gap` + 间距调整 |
| `tests/jsx-to-string.test.ts` | 新增 4 条 ARIA 回归用例 |

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-26
- 浏览器实测：Chrome 153.0.8010.54，经 chrome-devtools MCP `--autoConnect` 接入用户实际浏览器（JavDB 页面）

### 验证命令

```bash
bun run build
bun run lint
bun run lint:css
bun run test
bun run check:structure
bun run check:docs
impeccable detect --json src
```

### 实际输出

- `bun run build`：**exit 0**，产物头部 `// @version 1.46.10`
- `bun run lint`：exit 0
- `bun run test`：**Test Files 15 passed · Tests 202 passed**（较上批 +4，为本次新增的 ARIA 用例）
- `check:structure` / `check:docs`：OK
- `impeccable detect`：exit 0，warnings 0
- `bun run lint:css`：仅 `fold-category-plugin.css` 2 处既有报错（运行时占位符必须大写，见 doc/248 已知限制），非本批引入

### 浏览器实测（v1.46.9 构建，修复前基线）

| 检查项 | 结果 |
|--------|------|
| `.jhs-btn` 基类 / `--isolated` / `--compact` 是否生效 | ✅ 均在 |
| 旧类名是否还有活规则 | ✅ `live_old_rule: false`（仅存于注释） |
| `#saveBtn` 规格 | ✅ 34px 高 / 6px 圆角 / `6px 16px` padding / 13px，与 DESIGN.md 一致 |
| `#clean-all` 位置 | ✅ 祖先链确认在 `#cache-panel` 内，底栏仅 `#saveBtn` |
| 缓存卡片三按钮是否换行 | ✅ 未换行（各 104.5×34，卡片宽 351.5，同 1 行） |
| 方向键导航 | ✅ `ArrowDown` 缓存管理→清单管理器，焦点跟随且面板切换；`End` 跳插件诊断 |
| emoji `aria-hidden` | ✅ 激活项 `<span aria-hidden="true">💾</span> 数据备份` |
| **`aria-selected` 值** | ❌ 修复前：激活 `""`、其余 `null` |
| **`tabpanel` 数量** | ❌ 修复前：0 |

### 前端或调用方验证

**待用户在浏览器刷新后确认**：`aria-selected` 应为 `"true"`/`"false"`、`tabpanel` 数量为 10。修复已由单测锁定（4 条用例覆盖 `true`/`false`/`null`/非 ARIA 布尔对照），但真实 DOM 复核需刷新页面加载新构建。

### 验证结论

构建/lint/202 lint/结构门禁/文档门禁全绿，检测器 warning 保持 0。`jsx-to-string` 的 ARIA 序列化缺陷已修并被单测锁定，影响面覆盖全项目所有 `aria-*`；tab/tabpanel 关联补齐。

### 已知限制

- **Tab 键无法聚焦侧栏项**：键盘用户需先通过其它路径把焦点移入弹层。按用户决定**不做处理**（视为无此功能），`role="tablist"`/`role="tab"`/方向键导航作为后续可用的基础保留。
- **`jsxToString` 的 `role` 等其它属性不受影响**，本次仅调整 `aria-*`；`data-*` 仍走通用分支。
- 缓存面板头部间距调整为**主观判断**，未做渲染对比确认。
- `bun run lint:css` 的 2 处既有报错未处理（不属本批范围）。

## 5. 关联

- 版本：v1.46.10（AGENTS.md §6.1.1，`src/` 逻辑与组件改动 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.10
- 前序：`docs/17`（v1.46.8 引入侧栏 ARIA 与方向键）、`docs/18`（v1.46.9 移动清理按钮）
- 文档编号：本文件为 `docs/19-*`，对应 `changelog` 中的 doc/250
