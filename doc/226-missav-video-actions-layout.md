# MissAV 视频页自定义按钮独立分组与样式对齐

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.43.3 → 1.43.4（patch，布局调整）
> **前置文档**：doc/49（MissAV 快速复制集成）

## 1. 背景

用户实测反馈：missav 视频详情页中自定义按钮（复制番号 / 转到JavDB搜索）与原生按钮
混排，UI 不匹配、布局不合理。

Camoufox 量化实测（probe-video2）确认两个问题：

1. **UI 不匹配**：自定义按钮 class 含 `shadow-sm`（`boxShadow: rgba(0,0,0,0.05) 0 1px 2px`）
   + `mr-2`（`marginRight: 8px`），原生按钮无 shadow、间距由父容器 `space-x-6`
   （`marginLeft: 24px`）控制；自定义图标固定 16px/24px（原生 `h-3 w-3 xs:h-4 xs:w-4`
   响应式 12→16px）。
2. **布局不合理**：`prepend` 把「复制番号」插到原生工具栏最前（原生顺序
   收藏→片单→下载→分享被破坏）、`appendChild` 把「转到JavDB搜索」放到最后，
   两个自定义按钮混插在原生按钮流中。

## 2. 方案

| 项 | 调整 |
|----|------|
| 布局 | 不再 prepend/append 进原生工具栏，改为在工具栏**之后**插入独立按钮组 `.jhs-video-actions`（`flex flex-wrap justify-center space-x-4 md:space-x-6 py-4`，与原生工具栏同风格） |
| 按钮样式 | class 与原生按钮逐字对齐：去 `shadow-sm`/`mr-2`，间距由外层 `space-x` 控制 |
| 图标尺寸 | 剪贴板 SVG 去固定 width/height → `h-3 w-3 xs:h-4 xs:w-4`；JavDBIcon 解析后移除 24px 属性改同款响应式 class |
| 幂等 | 插入前检查 `.jhs-video-actions` 已存在则跳过（observer/existing 双路径防重复） |

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-quick-copy-plugin.tsx` | `insertButtons` 改为独立按钮组（`insertAdjacentElement('afterend')` + 幂等检查）；`createButton` class 对齐原生；`createSVGClipboard`/`createSVGJavDB` 图标尺寸改响应式 tailwind class |
| `vite.config.ts` | version 1.43.3 → 1.43.4（patch） |
| `doc/226-missav-video-actions-layout.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun + Chrome（构建/静态验证）；Camoufox 实测（`.superpowers/camoufox-missav/probe-video3.py`）。

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
✓ built in ~1.4s（产物 @version 1.43.4 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  11 passed (11)
      Tests  163 passed (163)

$ bun run check:structure
check-structure: OK (364 files, 62 dirs within limits)
```

### 前端或调用方验证（Camoufox 实测）

| 项 | 结果 |
|----|------|
| 样式对齐 | 自定义 vs 原生：`boxShadow: none`✓、`marginRight/Left: 0`✓（间距由 space-x）、`fontSize: 14px`✓、`height: 16px`✓ |
| 布局 | 原生工具栏恢复纯净（收藏/片单/下载/分享 4 项）；自定义按钮组 `.jhs-video-actions` 位于工具栏下方（top 814 vs 766），含「复制番号」「转到JavDB搜索」 |
| 幂等 | `.jhs-video-actions` 存在检查防重复插入 |

### 验证结论

✅ 通过。构建/lint/163 测试/结构门禁全绿；Camoufox 实测样式与布局对齐；产物
`@version 1.43.4`。

### 已知限制（需用户浏览器实测）

1. 独立按钮组在工具栏下方的视觉位置（与下方视频信息的间距）需目视确认；
2. 窄屏（移动端）下按钮组换行行为；
3. 图标渲染：JavDB tabler 图标去掉固定尺寸后在小尺寸下的清晰度。

## 5. 后续可扩展（不纳入本期）

- 无（纯布局调整）。