# MissAV 视频预览二级弹窗覆盖 iframe 文档顶部条

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.3 → 1.44.4（patch，bug 修复）
> **前置文档**：doc/228（iframe 详情弹窗）、doc/231（弹窗覆盖列表页顶部条）

## 1. 背景

用户反馈：**二级弹窗**（iframe 视频页内点击推荐缩略图嵌套打开的弹窗）没有覆盖
`document.querySelector("body > div:nth-child(3) > div.relative > div")`——
即 iframe 视频页文档内的顶部条盖在二级弹窗上方。

## 2. 根因（Camoufox 实测）

探针 `.superpowers/camoufox-missav/probe-stack2.py` 实测 iframe 视频页
（900px 视口加载 `/cn/mkmp-745`）：

| 元素 | class | z-index | position |
|------|-------|---------|----------|
| iframe 视频页顶部条（`body > div:nth-child(3) > div.relative > div`） | `fixed z-max w-full bg-gradient-to-b from-darkest` | 2147483647 | fixed，56px |
| 列表页顶部条（doc/231） | 同一 class | 2147483647 | fixed，56px |

→ **列表页与 iframe 视频页的顶部条是同一 class**（`div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest`），
z-index 均为 CSS 最大值 2147483647。

doc/231 的修复加了 `isVideoDetailPath(location.pathname)` 守卫，意图「iframe 视频页
内保留顶部条」（对齐 doc/228 用户确认「顶部条不隐藏」）——但该守卫**误伤二级弹窗**：
iframe 文档内打开二级弹窗时跳过隐藏，iframe 顶部条盖住二级弹窗。

## 3. 方案

| 项 | 改动 |
|----|------|
| 守卫 | **移除 `isVideoDetailPath` 守卫**——任何文档打开弹窗时都隐藏当前文档顶部条 |
| 语义澄清 | 弹窗打开时隐藏的是**当前文档**的顶部条：列表页弹窗隐藏列表页的、iframe 二级弹窗隐藏 iframe 文档的；一级弹窗 iframe 内加载的详情页顶部条（独立文档）不受影响，仍保留（doc/228 确认） |
| 关闭恢复 | layer `end` 回调恢复原 display（不变） |

```ts
// 修改前（doc/231）：iframe 视频页内跳过隐藏 → 二级弹窗被 iframe 顶部条遮挡
if (!isVideoDetailPath(location.pathname)) {
    topBar = document.querySelector(TOP_BAR_SEL);
    if (topBar) { topBar.style.display = 'none'; }
}

// 修改后：任何文档打开弹窗都隐藏当前文档顶部条
const topBar = document.querySelector<HTMLElement>(TOP_BAR_SEL);
const topBarPrevDisplay = topBar ? topBar.style.display : '';
if (topBar) { topBar.style.display = 'none'; }
```

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` | 移除 `isVideoDetailPath` import + 条件守卫（改为无条件隐藏当前文档顶部条）；`TOP_BAR_SEL` 注释更新为「当前文档顶部条」 |
| `vite.config.ts` | version 1.44.3 → 1.44.4（patch） |
| `doc/232-missav-video-preview-cover-iframe-top-bar.md` | 本文档 |

## 5. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）；Camoufox 实测 iframe 视频页顶部条结构（`.superpowers/camoufox-missav/probe-stack2.py`）。

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
dist/monkey-jhs-disassemble.user.js  2,198.67 kB │ gzip: 509.71 kB
✓ built in ~1s（产物头部 @version 1.44.4 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证（Camoufox 实测 iframe 视频页顶部条）

| 项 | 结果 | 结论 |
|----|------|------|
| iframe 视频页顶部条 class | `fixed z-max w-full bg-gradient-to-b from-darkest` | 与列表页同一 class，`TOP_BAR_SEL` 可命中 |
| z-index | 2147483647 | 高于 layer 弹窗，需隐藏 |
| 一级弹窗 iframe 详情页顶部条 | 独立文档，不受隐藏影响 | doc/228 确认保留不变 |

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.44.4`。

### 已知限制（需用户浏览器实测）

1. 二级弹窗打开时 iframe 文档顶部条暂时隐藏、关闭后恢复；
2. 一级弹窗 iframe 内加载的详情页顶部条始终保留（独立文档，doc/228 确认）；
3. 若站点未来调整顶部条 class 或 z-index 策略需重新实测。