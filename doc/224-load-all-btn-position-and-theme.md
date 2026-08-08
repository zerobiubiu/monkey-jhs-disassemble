# 加载全部按钮改左下角 + MissAV 暗色化

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.43.1 → 1.43.2（patch，优化）
> **前置文档**：doc/221（MissAV 瀑布流加载模式）、doc/223（暗色化与 cell 显隐）

## 1. 背景

用户实测反馈两个问题：

1. **MissAV「加载全部」按钮 UI 与暗色主题不符**：当前是 javdb 同款渐变蓝
   （`linear-gradient(#5d87c2, #4a90d9)` + 白字），在 missav 的 nord 暗色页面上突兀；
2. **位置与「回到顶部」按钮冲突**：「加载全部」浮动在右下（`right:20px; bottom:80px`）、
   「回到顶部」也在右下（`right:40px; bottom:40px`），同侧视觉拥挤。javdb 的加载全部
   按钮（`auto-page-plugin.css` 的 `.jhs-load-all-btn`）同样在右下，与 javdb 的回到顶部
   （`#jhs-back-to-top`）存在同类冲突。

用户要求：**加载全部按钮调到左侧**。

## 2. 方案

| 站点 | 按钮 | UI 处理 | 位置 |
|------|------|---------|------|
| MissAV | `.jhs-map-load-all-btn` | 渐变蓝 → **nord 暗色**（底色 #2e3440 / 边框 #4c566a / 文字 #d8dee9 / hover 底色 #3b4252 + frost 边框 #81a1c1） | `right:20px` → **`left:20px`**（bottom:80px 不变） |
| JavDB | `.jhs-load-all-btn` | 渐变蓝**保留**（javdb 浅色主题合适） | `right:20px` → **`left:20px`**（bottom:80px 不变） |

两层按钮分居左右下角，与回到顶部按钮（右下 `bottom:40px`）彻底错开。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/styles/missav-auto-page/missav-auto-page.css` | `.jhs-map-load-all-btn`：`right`→`left`；渐变蓝→nord 暗色（含 hover）；transition 补 border-color/background-color |
| `src/styles/auto-page-plugin.css` | `.jhs-load-all-btn`：`right`→`left`（javdb 浅色主题，渐变蓝保留） |
| `vite.config.ts` | version 1.43.1 → 1.43.2（patch） |
| `doc/224-load-all-btn-position-and-theme.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun + Chrome（构建/静态验证）。

### 验证命令

```text
$ bun run build
$ bun run lint
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bun run build
✓ 407 modules transformed.
dist/monkey-jhs-disassemble.user.js  … kB │ gzip: … kB
✓ built in ~1.3s（产物 @version 1.43.2 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  11 passed (11)
      Tests  163 passed (163)

$ bun run check:structure
check-structure: OK（CSS 文件数不变，纯样式修改）
```

### 验证结论

✅ 通过。构建/lint/163 测试/结构门禁全绿；产物 `@version 1.43.2`。

### 已知限制（需用户浏览器实测）

1. 左下角「加载全部」按钮与 missav 页面左下内容（如有）的视觉关系需目视确认；
2. javdb 左下角加载全部按钮位置需确认（浅色主题 UI 不变，仅换侧）。

## 5. 后续可扩展（不纳入本期）

- 无（纯样式调整）。