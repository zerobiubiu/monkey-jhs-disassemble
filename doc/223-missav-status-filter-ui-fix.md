# MissAV 状态筛选 UI 暗色化 + 网格 cell 级显隐修复

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.43.0 → 1.43.1（patch，修复）
> **前置文档**：doc/222（MissAV 状态标签筛选初版）

## 1. 背景

doc/222 交付的 MissAV 状态标签筛选器经用户实测反馈两个问题：

1. **UI 风格不相符**：筛选栏复用了 javdb 的浅色主题样式（白底/浅边框/深灰文字），
   放在 missav 的 Tailwind nord 暗色页面上很突兀，观感不搭；
2. **筛选方式错误**：隐藏的是 `.thumbnail.group` 缩略图本身，但 missav 初始页结构是
   `grid > 包装DIV > .thumbnail.group`——包装 DIV（grid 直接子项）仍占位，隐藏内层
   缩略图后网格留空洞、布局不重排。用户期望隐藏后**布局结构正确变化**（网格无缝重排）。

## 2. 根因分析

### 2.1 UI 风格（设计决策修正）

doc/222 计划把 `missav-status-filter-*` 前缀加入 `filter-chip-base.css` 共享基础
（doc/180 三插件共享）。该基础是 javdb 浅色主题（白底 #fff / 边框 #dee2e6 / 文字
#495057）。但 missav 是 **Tailwind nord 暗色主题**（页面 bg 深色、文字 nord4 #d8dee9、
边框 nord3 #4c566a）——共享基础的前提"逐字节相同"不成立，应**独立定义暗色样式**。

### 2.2 网格空洞（DOM 结构实测）

Camoufox probe6 确认 missav 初始页结构：

```
grid（DIV.grid.grid-cols-2.md:grid-cols-3.xl:grid-cols-4.gap-5）
  └─ DIV.（无 class，grid 直接子项）
       └─ DIV.thumbnail.group
            └─ div.relative > a[alt] + video + img
```

瀑布流（doc/221）追加项则直接是 `grid > .thumbnail.group`（无包装层）。

`applyFilter` 对 `.thumbnail.group` 设 `display:none` 只隐藏内层缩略图，**外层包装 DIV
（grid 项）仍在布局流中** → 网格留空洞。显隐必须作用在 **grid cell**（grid 直接子项）上，
隐藏后 grid 自动重排。

## 3. 方案

| 项 | 修复 |
|----|------|
| UI 暗色化 | `missav-status-filter.css` 从「active 配色 + no-tag 变体」改为**完整暗色样式**（nord 配色：容器边框 #3b4252、标签/文字 #d8dee9、芯片底色 #2e3440、边框 #4c566a、hover frost #81a1c1、active #5d87c2）；`filter-chip-base.css` **回滚第四前缀**（恢复到 javdb 三插件共享，注释说明 missav 不参与原因） |
| cell 级显隐 | `mstf-apply.ts` 新增 `getCell()`：`grid > 包装DIV > .thumbnail.group` 时返回包装 DIV；`grid > .thumbnail.group`（瀑布流追加）时返回缩略图自身；判定用 className 含 `grid-cols` 而非 CSS 选择器（避免 `md\:grid-cols` 转义在 jsdom nwsapi 匹配失败——实现中实测发现） |

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-status-filter/mstf-apply.ts` | `getCell()` cell 级定位（className 判定，脱离 MAP_SEL 依赖）；`applyFilter` 对 cell 显隐 + `data-mstf-hidden` |
| `src/styles/missav-status-filter/missav-status-filter.css` | 完整 nord 暗色样式（bar/label/chips/chip/hover/active/no-status） |
| `src/styles/filter-chip-base.css` | 回滚第四前缀（恢复三插件共享），头部注释说明 missav 独立原因 |
| `tests/missav-status-filter.test.ts` | applyFilter 用例重构为 4 个（无 grid / 初始页包装 / 瀑布流追加 / 空 active 恢复）；+`afterEach` body 清理（jsdom 用例间 DOM 残留修复） |
| `tests/missav-status-filter-ui.test.ts` | buildPage 改为 `grid > 包装DIV > 缩略图` 结构；断言改为 grid cell（`.grid > div`）显隐 + 缩略图自身不受影响 |
| `vite.config.ts` | version 1.43.0 → 1.43.1（patch，修复） |

## 5. 执行验证记录

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
✓ built in ~1.3s（产物 @version 1.43.1 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  11 passed (11)
      Tests  163 passed (163)   ← applyFilter 用例 2→4，含 cell 级断言

$ bun run check:structure
check-structure: OK (364 files, 62 dirs within limits)
```

### 调试记录

实现中曾遇到 `MAP_SEL.grid`（`md\:grid-cols-3` CSS 转义）在 jsdom nwsapi 匹配失败，
导致 getCell 回退隐藏缩略图自身、测试红。改为 className 包含 `grid-cols` 判定后
通过（独立调试用例验证逻辑正确，根因是 jsdom 选择器转义 + 测试用例间 DOM 残留，
后者由 afterEach body 清理解决）。

### 验证结论

✅ 通过。构建/lint/163 测试/结构门禁全绿；产物 `@version 1.43.1`。

### 已知限制（需用户浏览器实测）

1. **暗色 UI**：筛选栏配色与 missav 页面融合度需目视确认（nord 令牌近似值，
   若与页面实际主题色有偏差可微调）；
2. **cell 级重排**：点击筛选后网格应无缝重排（初始页包装 DIV 隐藏）；
3. **瀑布流追加项**：追加的缩略图（grid 直接子项）筛选时隐藏自身，与初始页行为一致。

## 6. 后续可扩展（不纳入本期）

- 筛选状态持久化（localStorage 记住已选芯片）；
- 屏蔽/黑名单过滤。