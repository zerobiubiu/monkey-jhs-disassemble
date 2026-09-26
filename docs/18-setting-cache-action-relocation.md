> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/components/setting-panels/cache-panel.tsx`、`src/components/setting/setting-dialog.tsx`、`src/plugins/setting/setting-form-bind.ts`、`src/styles/setting-plugin.css`
> **前置文档**：`docs/17-setting-surface-distill-and-harden.md`（本批是 v1.46.8 收敛后的位置修正）
> **替代文档**：无
> **生效版本**：v1.46.9

# 「清理全部缓存」从底栏移回缓存管理面板内部

## 1. 背景

v1.46.8 把「清理全部缓存」并入统一底栏后，它和「保存设置」**共用同一个底栏栅位**：打开缓存管理面板时 `#saveBtn` 隐藏、`#clean-all` 显示，两者互换。

这造成两个问题（用户反馈）：

1. **同一位置两种语义**。底栏在其它面板是「保存设置」，切到缓存管理就变成「清理全部缓存」——位置一样、颜色一样、大小一样，用户在同一位置点下去，后果完全不同。危险动作出现在用户来不及重新定位的位置。
2. **保存入口被顶掉**。缓存管理面板本身也有可保存项（`setting-form-bind.ts` 原逻辑在该面板隐藏 `saveBtn`），「清理全部缓存」占用底栏进一步加剧了「找不到保存在哪」。

这不是 v1.46.8 才引入的问题：二者从更早就同处底栏，且一直是**互斥显示**（`hide()/show()` 互换），因此用户从未同时看到它们，「样式不同就能区分」并不成立。v1.46.8 的按钮统一并未制造这个问题，只是**让两个按钮在视觉上完全同形**，使「同一位置两种语义」的隐患变得更彻底。

## 2. 方案

**把批量动作放回它的归属面板，底栏只保留「保存设置」。**

- `#clean-all` 移入 `cache-panel` 面板顶部（标题下方的统计行右侧），与 `#cache-total-size` 同一行两端对齐——**保持与底栏相同的右侧位置感**，减少肌肉记忆的割裂。
- 底栏移除 `#clean-all`，`#saveBtn` 独占，**在所有面板保持同一位置**（不再有「切换面板时底栏内容互换」）。
- 移除 `setting-form-bind.ts` 中所有 `$('#clean-all').hide()/show()` 调用（该元素已不在底栏，无需参与显隐切换）。

`handleCleanAllCache` 的**确认框逻辑不变**（v1.46.8 加的 `q()` 确认 + 代价文案继续生效）。

## 3. 实施

| 文件 | 变更 |
|------|------|
| `src/components/setting-panels/cache-panel.tsx` | 统计行改为 `space-between`，「清理全部缓存」按钮加入该行右侧；用裸 `.jhs-btn`（**非 `--compact`**，后者带 `flex: 1` 会把按钮拉满整行） |
| `src/components/setting/setting-dialog.tsx` | 底栏移除 `#clean-all` 块，仅保留 `#saveBtn`；清理其 `--isolated` 相关注释 |
| `src/plugins/setting/setting-form-bind.ts` | 删除 6 处 `$('#clean-all').hide()`/`show()`；面板切换逻辑只管理 `#saveBtn` |
| `src/styles/setting-plugin.css` | `#saveBtn, #clean-all { margin-top: 0 }` 收敛为 `#saveBtn`；顺带删除一处重复的规则块 |

底栏 `justify-content: flex-end` 保持不变（v1.46.8 已由 `textAlign` 改为 flex 右对齐），单个「保存设置」按钮仍靠右，位置不变。

## 4. 执行验证记录

### 执行环境

- Windows + Bun，项目根 `E:\monkey-jhs-disassemble`，2026-09-26

### 验证命令

```bash
bun run build
bun run lint
bun run lint:css
bun run test
bun run check:structure
bun run check:docs
impeccable detect --json src
rg -n 'clean-all' src
```

### 实际输出

- `bun run build`：**exit 0**，产物头部 `// @version 1.46.9`
- `bun run lint`：exit 0
- `bun run test`：**Test Files 15 passed · Tests 198 passed**
- `bun run check:structure`：OK（373 files / 63 dirs）
- `bun run check:docs`：OK（44 plugins / 61 core files）
- `impeccable detect --json src`：exit 0，**warnings 0**
- `rg -n 'clean-all' src` 仅 3 处命中：`cache-panel.tsx` 的按钮本体、`cache-management.ts` 的文档注释、`setting-form-bind.ts` 的事件绑定。**底栏与显隐逻辑中零残留**

### 前端或调用方验证

静态验证覆盖。建议用户在浏览器中确认：① 切到「缓存管理」，底栏仍是「保存设置」、位置不变；② 「清理全部缓存」出现在面板内统计行右侧，点击仍先弹确认框；③ 切到其它面板，底栏按钮不再发生互换。

### 验证结论

构建/lint/198 单测/结构门禁/文档门禁全绿，检测器 warning 保持 0。底栏从「按面板互换内容」变为「恒定保存设置」，危险动作回到其归属面板内部。

### 已知限制

- `bun run lint:css` 仍有 2 处报错，来自 `src/styles/fold-category-plugin.css` 的运行时占位符（必须大写，见 doc/248 已知限制），非本批引入、本批未触碰。
- 未做浏览器渲染比对；「清理全部缓存」在统计行右侧的实际视觉平衡（与 `#cache-total-size` 两端对齐）需人工确认。

## 5. 关联

- 版本：v1.46.9（AGENTS.md §6.1.1，`src/` 组件与样式改动 → patch 递增）
- changelog：`changelog/CHANGELOG.md` v1.46.9
- 前序：`docs/17`（v1.46.8 按钮/开关统一，本批修正其副作用）
- 设计依据：`DESIGN.md`「状态可信」原则——危险动作不应出现在用户来不及重新定位的共享位置
- 文档编号：本文件为 `docs/18-*`，对应 `changelog` 中的 doc/249
