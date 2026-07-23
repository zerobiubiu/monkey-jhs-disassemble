# doc/165 — iframe 弹窗回归修复 + feature-flags 收敛 + 结构优化规划

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景与方法

用户实测反馈两条回归：① 视频流中弹出的 iframe 详情页**不加载**脚本信息；② 弹窗内
**UI 错乱**，怀疑 CSS 写错；并要求按「遍历文档 → 代码检查 → 方案自辩/自查询 → 可行性
验证（含浏览器）→ 代码修改 → 结构收敛 → 测试 → 文档」的顺序执行，重点做**目录/结构**
优化，并清理 `src/core/feature-flags.ts` 这一为溶入大版本而生的临时产物。

本轮严格遵循该顺序：先 4 路只读 doc scout + 关键文件实读 + archetype/产物头 grep（**零
代码改动**）定位根因，再做隔离修复与收敛。

## 1. 根因：`@noframes` 是回归源（非 CSS 编写错误）

证据链（全部已核实）：

1. **原始无此指令**：`archetype/jhs.user.js` 头部（L1-35）仅有 `@match`+`@include`，
   **无 `@noframes`**。
2. **弹窗即同源 iframe**：archetype `utils.openPage` = `layer.open({ type: 2, ... })`，
   layer `type:2` 即 iframe 弹层；doc/74/84/87/29 明确把详情弹层称为「type=iframe 弹层
   （详情页 iframe）」，并依赖脚本在该 iframe 内运行（doc/87 的跨 frame ESC 闸门、
   doc/74 的封面点击委托均以此为前提）。
3. **跨 frame 代码预设 in-iframe 执行**：`src/core/common-util.ts:52-71,336-348,444-451`
   把 ESC 闸门挂在 `window.top.__jhsEscGate`、用 `parent.document` 操作 layer 节点——
   只有脚本在 iframe 内运行这些才有意义。
4. **原模型是「处处运行、按需自守卫」**：`car-list-reader-plugin.ts:56`
   `if (window.self !== window.top) return;` 是唯一的运行时自守卫，反证原始设计本就在
   iframe 内加载脚本。
5. **`@noframes` 不提供额外安全**：`@match` 已把注入限定到 `javdb.com`/`missav.*` 帧，
   跨域 iframe 本就不会注入；`@noframes` 唯一作用是**禁止脚本进入同源的 layer 详情
   iframe**——正是用户要的功能。

结论：`@noframes`（doc/136 作为「安全边界加固」加入，但**无任何 doc 评估过它与 iframe
弹窗功能的冲突**）使脚本及其 CSS 整体不进入弹窗 iframe → 同时造成「不加载」与「UI 乱」
（脚本没跑，它的样式/工具栏自然没注入）。顶层标签页非 iframe，故正常——与现象完全吻合。

## 2. 修复：移除 `noframes: true`（隔离交付，已验证）

- `vite.config.ts` 删除 `noframes: true` 一行；保留 doc/136 收窄后的 3 个官方 `@match`
  （真实安全意图不变）。
- 隔离验证（单改动归因）：构建产物 `// @noframes` 计数 **0**；`@match` 三条齐全；
  `tsc -b && vite build` 绿；`vitest` 28/28；eslint 786/0；stylelint 0。

## 3. 移除 `@noframes` 后的双触发分析（用户「一定要做好测试」所要求）

恢复 in-iframe 执行后，唯一新回归向量是「加载期全局副作用在 top + iframe 双触发」。逐项
分类（已读 `main.tsx` 全启动序列 + 各插件 handle 核实）：

| 启动期副作用 | 位置 | 在 iframe 内的行为 | 结论 |
|---|---|---|---|
| `injectCss` ×N | main.tsx:144-220 | 向 iframe head 注入同一份样式 | **期望行为**（即修复目的） |
| `window.utils/gmHttp/...` 全局 | main.tsx:153-161 | 赋给 iframe 自身 window | 每文档独立，安全（原始同） |
| `new BroadcastChannel('channel-refresh')` | main.tsx:164 | 仅建通道；其 message 监听在 list-page.handle（页型门控），详情 iframe 不挂监听 | 无双触发 |
| clog 创建 | main.tsx:219-230 | `unsafeWindow.parent.clog` 存在则**复用**顶层 logger | 跨 frame 共享，原始设计 |
| error/unhandledrejection 监听 | main.tsx:233-257 | 各捕获**本文档**错误 | 每文档独立，安全 |
| mousedown z-index 切换 | main.tsx:259-275 | 每文档 | 安全 |
| setupTooltip / setupLayerWrapper | main.tsx:279,284 | 每文档；layer 的 ESC 闸门经 `window.top` 跨 frame 共享 | 跨 frame 设计，安全 |
| 插件 register | main.tsx:290-340 | 内存内，每文档 | 安全 |
| initPageContext + isDetailPage 等 | main.tsx:345-348 | 按 **iframe 自身 URL** 计算 → 详情 iframe 内 isDetailPage=true | **期望行为** |
| processCss / processPlugins | main.tsx:349,366 | 详情插件在 iframe 内注入 | **期望行为** |
| runMigrations | main.tsx:351-353 | `navigator.locks('jhs-storage-migration', exclusive)` + 版本检查串行+幂等 | 并发安全/有益 |
| storageRevision.init | main.tsx:355 | 建通道；监听按 senderId 排除自身；`if(this.channel)return` 幂等 | 跨 frame 缓存失效，有益 |
| locale cookie 提示 | main.tsx:361-365 | 仅 en locale 触发（用户为 zh） | 可忽略，原始同 |
| autoBackup | main.tsx:368-372 | 经日期键去重；最坏首次同日重复一次幂等 WebDAV PUT | 原始在 iframe 同行为，非新回归 |
| registerDiagnosticsMenu | main.tsx:375 | 真实 Tampermonkey 下可能登记**第二个**「📊 插件诊断」菜单项 | **唯一新 cosmetic nit**（见下） |
| beforeunload destroyAll | main.tsx:377 | iframe 卸载销毁 iframe 资源 | 正确 |

**结论**：全部启动期副作用均为 每文档独立 / 幂等 / 页型门控 / 自守卫 / 跨 frame 设计 /
与原始同行为。移除 `@noframes` 不引入数据/功能双触发回归。

- **diagnostics 菜单 nit（已记录、本轮不修）**：`registerDiagnosticsMenu` 在启动序列末尾
  无条件调用；真实 Tampermonkey 中若 layer 弹窗 iframe 同时运行脚本，菜单可能出现重复
  「📊 插件诊断」项。这是**菜单 cosmetic 重复**，非用户报告的页面 UI 坏损；且无头浏览器
  无法复现（无 Tampermonkey 菜单宿主），故本轮**不修**以保持干净归因，建议后续加
  `if (window.self !== window.top) return;` 一行守卫（与 car-list-reader 同 idiom）。
- **visit-history 守卫——已驳回，不加**：`recordVisit()` 以 `location.pathname+search` 为键；
  顶层（列表页）与弹窗 iframe（详情页）路径**不同** → 记为两条**正确且不同**的访问记录。
  若加 `self!==top` 守卫，反而会**丢失**「经弹窗打开的详情页」的访问记录（覆盖回归）；且
  原始（无 @noframes）即按帧相同记录。故不加守卫。

## 4. CSS 复核结论：R3/R4 改名未坏，弹窗 UI 乱另有其因

- `menu-btn` 改名**内部完整**：全 src 命中均为 `jhs-toolbar-menu-btn`/`jhs-setting-menu-btn`，
  二者在 `common-toolbar.css`/`setting-plugin.css` 均有定义——**无悬空选择器**。
- VLT 前缀改名**无残留**：旧无缀选择器（custom-tags-display / tag-filter-* / filter-mode-*
  等）在 CSS 中 **0** 命中。
- z-index `var(--jhs-z-*)` 定义于 `:root`，插件 CSS 同文档注入，**可正常解析**；R3 仅把原
  字面量 9999/999999999 等值换名，**值未变**，非回归。
- `--jhs-color-text-muted: #999` 仅**定义未使用**（latent，非本次可见坏因，不追）。
- 故「弹窗 UI 乱」的真因是**脚本未注入弹窗 iframe**（@noframes 所致），而非 CSS 写错；
  移除 @noframes 后弹窗将重新获得脚本及其样式。

## 5. feature-flags.ts 收敛（行为保持）

- **改**：弱类型 `Record<string, boolean>` → 封闭接口 `interface FeatureFlags`（无索引签名），
  逐键 JSDoc 标明门控位置；分组注释保留。使键集合成为编译期可校验的文档化契约，与项目
  强类型风格统一。
- **不改（逐字节）**：16 个键、默认布尔值、localStorage 覆盖 IIFE（`Object.assign(featureFlags,
  stored)`）。故运行期行为与覆盖契约**完全不变**；不增删开关、不改默认值（默认 true 的键
  即便当前无代码分支读取，仍是用户可经 localStorage 关闭某插件的**对外控制**，删除会剥夺
  该控制，tsc/测试均无法捕获此类行为变更，故不随本轮删除）。
- **形状安全依据**：grep 全 src 对 `featureFlags` **无任何动态访问**（无 `featureFlags[expr]`、
  无 spread、无 `Object.keys/entries/values(featureFlags)`、无 `in featureFlags`）；全部为按名
  `featureFlags.xxx`。故封闭接口不破坏任何调用点，`tsc` 为键拼写安全网——已实测全码库编译
  零错误。
- **@types 核实**：`package.json` 含 jquery/tabulator-tables/layui-layer 运行时依赖，但
  devDependencies **无** `@types/jquery`/`@types/tabulator-tables`/`@types/layui-layer`——
  此即 786 个 `no-explicit-any` 警告的主体来源，亦为 §6.3「big-bang 消除需先补类型声明」
  的**已核实**依据。

## 6. 结构 / 目录优化：收敛结论 + 规划（deferred）

doc scout 结论（已核实）：

- 当前 `src/` 顶层布局**已符合** AGENTS.md §2；**无任何 doc** 提议重组 `core/`、移动
  `feature-flags.ts`、或拆分大文件；`core/` 从 15→28 模块均为有独立 doc 的逐步提取，无反向
  合并提案；feature-flags 归属 `core/` 由 doc/78 + AGENTS 明确。其「不统一」实为**弱类型**，
  已于 §5 修复，**无需移动**。
- 故本轮**不做**无依据的目录搬迁（那将是 scope-creep 且高回归面）。
- **真正的结构债**是 3 个超大文件：`vlt-sync.ts`(2428)、`detail-page-button-plugin.tsx`(2041)、
  `setting-plugin.tsx`(1571)。doc/40 仅对 list-reading-status 做过「不拆」显式决策，未触及
  上述三者。

**vlt-sync.ts 拆分规划（可执行大纲，deferred，非本轮实施）**：按职责切分为
① `vlt-broadcast.ts`（GM_setValue/localStorage/CustomEvent 三重广播总线）、
② `vlt-remote-sync.ts`（跨标签页 `GM_addValueChangeListener` 同步）、
③ `vlt-lock-queue.ts`（Web Locks + 同页队列）、④ `vlt-sync.ts` 保留编排 + 失败 UI 回滚。
每次提取以 `tsc` + 现有 28 测试 + 新增 vlt 专项测试为门禁。`setting-plugin`/`detail-page-button`
可按面板/区段类似拆分，但风险更高，列候选、暂不细化。该规划记入本文，待单独立项执行。

## 7. 浏览器验证诚实声明

- 无头 Chromium **无 `GM_*` 宿主**，**无法**忠实运行本 userscript；javdb 亦可能网络/反爬
  受限。故本轮的浏览器探针（首页 `self===top`、首页 iframe 数、详情 URL 为顶层文档）**仅
  佐证页面结构**，**不**作为 userscript 行为验证。
- @noframes 回归由「指令语义 + doc/74/84/87/29 + common-util 跨 frame 代码 + archetype 头部
  无 @noframes」**静态可证**；移除后的修复效果（弹窗重新加载脚本/样式）**需用户在自己的
  Tampermonkey 中目视确认**——本环境无法替代。

## 8. 实施清单

| 文件 | 操作 |
|------|------|
| `vite.config.ts` | 修改：删除 `noframes: true`（回归修复） |
| `src/core/feature-flags.ts` | 修改：`Record<string,boolean>` → 封闭 `interface FeatureFlags` + JSDoc；键/默认/IIFE 不变 |
| `AGENTS.md` | 修改：§6.3 将误插的「增量 any 消除」bullet 移至版本规则 bullet 之后（修正自引入的乱序）+ backlog 行补「@types 已核实」 |
| `doc/README.md` | 修改：阅读顺序追加 doc/165 |
| `changelog/CHANGELOG.md` | 修改：新增 v1.28.6 |

## 9. 执行验证记录

```
# 隔离修复 @noframes
$ bun run build && grep -c '@noframes' dist/monkey-jhs-disassemble.user.js   # → 0
$ grep '@match' dist/...   # 3 条齐全
$ bun run test   # 28/28

# feature-flags 收敛（封闭接口全码库类型检查）
$ bun run build   # tsc -b 零错误（按名调用点全部通过封闭接口）
$ bun run test    # 28/28（行为不变）
$ bun run lint    # 786/0（类型-only 改动未增 any 警告）

# 最终门禁（含版本同步 1.28.6）见最终构建
```

## 10. 版本号决策

本轮含 `src/` 改动（vite.config + feature-flags.ts）→ 按 §6.1.1 递增 patch：
1.28.5 → **1.28.6**；`package.json` version 字段同步。AGENTS/README/CHANGELOG 为配套文档。
