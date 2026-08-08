# MissAV 瀑布流加载模式改造与封面修复

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.41.0 → 1.42.0（新增「加载全部」「回到顶部」按钮，minor）
> **前置文档**：doc/220（MissAV 列表页瀑布流初版）

## 1. 背景

doc/220 交付的 MissAV 瀑布流（滚动触底自动加载）经用户实测反馈两个问题：

1. **封面加载失败**：追加的缩略图封面图不显示（用户不确定是网络阻塞还是功能问题）；
2. **加载模式不符合预期**：用户要求对齐 javdb 视频流页面交互——底部「点击加载下一页」
   按钮（点一下加载一页）+「加载全部」按钮 +「一键回到顶部」按钮，而不是触底自动加载。

## 2. 根因分析（Camoufox 实测）

### 2.1 封面不加载的根因

探针（`.superpowers/camoufox-missav/probe7.py`）抓取 `?page=N` 服务端 HTML 发现：

- 缩略图 `<img>` 的 `src` 是 **1x1 透明占位图**（`data:image/png;base64,...`）；
- 真实封面 URL 在 **`data-src`** 属性（如 `https://fourhoi.com/hsoda-129/cover-t.jpg`）；
- 站点懒加载 JS 在**初始渲染时**把 `data-src` 提升到 `src`（当前页 DOM 12/12 均为真实 src）；
- **追加的节点不会触发站点懒加载初始化** → 封面永远停留在占位图（`naturalWidth: 1`）。

修复：追加缩略图前手动把 `data-src` 提升到 `src`。Camoufox 验证（probe8）：
提升后图片 `naturalWidth: 330`、24 个 fourhoi.com 真实封面请求发出，**封面正常加载**。

### 2.2 预览/详情页交互

用户实测确认：悬停预览视频可播放、点击可进详情页（追加节点的 Alpine 指令在真实
Tampermonkey 环境生效，可能与 Camoufox headless 下的行为不同）。本版不处理。

## 3. 方案

加载模式对齐 javdb AutoPagePlugin 的 **click 模式**：

| 交互 | 实现 |
|------|------|
| 触底检测 | 滚动监听检测 loader 进入「视口 + 800px」预加载区间 → 显示「点击加载下一页」按钮（不自动加载） |
| 加载一页 | 点击 loader（`jhs-map-click` 态）→ `fetchNextPage()`；加载完若仍在底部则按钮重现 |
| 加载全部 | `.jhs-map-load-all-btn` 浮动按钮（右下 bottom:80px），点击循环加载至末页/错误/无进展，文案「加载中...（第 N 页）」→「✓ 已全部加载」淡出移除 /「加载失败，点击重试」 |
| 回到顶部 | 复用 `core/util/back-to-top.ts` 的 `createBackToTopButton()`（右下 bottom:40px，圆形；样式复用 `back-to-top-button.css`） |
| 封面修复 | `map-selectors.liftDataSrcToSrc()`：容器内所有 `img[data-src]` 提升到 `src`，`fetchNextPage` 追加前调用 |

状态类名前缀统一为 `jhs-map-`（`jhs-map-click/loading/error/no-more`），守 §9.5。

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-auto-page/map-selectors.ts` | 新增纯函数 `liftDataSrcToSrc(container): number`（data-src→src 提升） |
| `src/plugins/missav-auto-page/map-fetch.ts` | `fetchNextPage` 追加前调用 `liftDataSrcToSrc(doc)`；成功 `loadedPages++`；finally 若仍在底部调用 `checkLoad()` 重现按钮；loader 类名改 `jhs-map-*` 前缀 |
| `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 重写：click 模式（checkLoad 显示按钮，不自动加载）；`showLoadAllBtn/loadAllPages/updateLoadAllBtn`；`createBackToTopButton()` 复用 + destroy 清理；字段 `loadAllBtn/isLoadingAll/loadedPages/backToTopCleanup`；initCss 拼接 missav-auto-page.css + back-to-top-button.css |
| `src/styles/missav-auto-page/missav-auto-page.css` | 新增（styles 直接文件数超上限 38，按 §11.1 建子目录）：loader 状态样式 + `.jhs-map-load-all-btn` 浮动按钮样式 |
| `tests/missav-auto-page.test.ts` | +3 用例：`liftDataSrcToSrc` 提升/不动/混合计数 |
| `vite.config.ts` | version 1.41.0 → 1.42.0 |
| `AGENTS.md` | §2 styles 标注 missav-auto-page/ 子目录；§3.3 MissavAutoPagePlugin 职责更新 |
| `doc/221-missav-auto-page-interaction-fix.md` | 本文档 |

## 5. 执行验证记录

### 执行环境

Windows + Bun + Chrome（构建/静态验证）；Camoufox 真实浏览器实测（`.superpowers/camoufox-missav/probe8.py`）。

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
dist/monkey-jhs-disassemble.user.js  2,188.35 kB │ gzip: 507.15 kB
✓ built in ~1.4s（产物 @version 1.42.0 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  9 passed (9)
      Tests  146 passed (146)   ← 含 liftDataSrcToSrc 3 用例

$ bun run check:structure
check-structure: OK (361 files, 60 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)
```

### 前端或调用方验证（Camoufox 实测）

| 项 | 结果 |
|----|------|
| 封面修复根因 | probe7：服务端 img src=1x1 占位图、data-src=真实 URL、追加后 naturalWidth=1（封面不加载根因确认） |
| 封面修复效果 | probe8：liftDataSrcToSrc 提升后 naturalWidth=330、24 个 cover 请求发出，封面正常加载 |
| 布局 | 追加缩略图直接作为 grid 子项（现有隔一层无样式包装 DIV），用户实测「布局也没问题」 |

### 验证结论

✅ 通过。构建/lint/146 测试/结构门禁全绿；产物 `@version 1.42.0`；封面修复经 Camoufox 实测确认。

### 已知限制（需用户浏览器实测）

1. **加载模式交互**：底部「点击加载下一页」按钮 + 「加载全部」+「回到顶部」三项需在
   真实 Tampermonkey 环境确认（触底显示按钮、点击加载一页、加载全部循环、回顶平滑）；
2. **封面加载**：追加页封面应即时显示（data-src 已提升），需确认无回归；
3. **Alpine 预览指令**：用户实测悬停预览/点击进详情页正常，未处理（Camoufox 下与真实
   环境行为有差异，以用户实测为准）。

## 6. 后续可扩展（不纳入本期）

- missav 瀑布流设置项（开关 / 预加载距离 / 默认加载模式）；
- 「加载全部」进度条的细粒度（当前按页数文案提示）。